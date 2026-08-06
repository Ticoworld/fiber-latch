import { describe, expect, it } from "vitest";

import {
  buildAccessReceiptClaims,
  evaluateAccessReceiptBindings,
} from "../src/index.js";
import type {
  AccessReceiptBindingResult,
  AccessReceiptClaims,
  AccessReceiptExpectedBindings,
} from "../src/index.js";
import { asRuntimeInput, validClaims } from "./test-helpers.js";

function canonicalClaims(overrides: Record<string, unknown> = {}): AccessReceiptClaims {
  return buildAccessReceiptClaims(validClaims(overrides));
}

function expectedFor(claims: AccessReceiptClaims): AccessReceiptExpectedBindings {
  return {
    sub: claims.sub,
    resource_id: claims.resource_id,
    policy_id: claims.policy_id,
    intent_id: claims.intent_id,
  };
}

function expectMatched(result: AccessReceiptBindingResult): void {
  expect(result).toEqual({ status: "matched" });
  expect(Object.keys(result)).toEqual(["status"]);
  expect(Object.isFrozen(result)).toBe(true);
}

function expectDenied(result: AccessReceiptBindingResult): void {
  expect(result).toEqual({ status: "binding_denied", phase: "binding" });
  expect(Object.keys(result).sort()).toEqual(["phase", "status"]);
  expect(Object.isFrozen(result)).toBe(true);
}

function attemptMutation(mutation: () => void): void {
  try {
    mutation();
  } catch (error) {
    expect(error).toBeInstanceOf(TypeError);
  }
}

const requiredBindingFields = [
  "sub",
  "resource_id",
  "policy_id",
  "intent_id",
] as const;

describe("evaluateAccessReceiptBindings", () => {
  it("matches all required bindings without payment proof semantics", () => {
    const claims = canonicalClaims({ payment_ref: "payment_ref_binding_01" });

    expectMatched(evaluateAccessReceiptBindings(claims, expectedFor(claims)));
  });

  it.each([
    ["single redemption", canonicalClaims({ max_redemptions: 1 }), undefined],
    ["multi redemption", canonicalClaims({ grant_type: "multi_redemption", max_redemptions: 2 }), undefined],
    ["equal optional limit", canonicalClaims({ max_redemptions: 1 }), 1],
  ])("matches a valid %s receipt", (_label, claims, maxRedemptions) => {
    const expected = {
      ...expectedFor(claims),
      ...(maxRedemptions === undefined ? {} : { max_redemptions: maxRedemptions }),
    };

    expectMatched(evaluateAccessReceiptBindings(claims, expected));
  });

  it("does not treat null payment_ref as payment proof", () => {
    const claims = canonicalClaims({ payment_ref: null });

    expectMatched(evaluateAccessReceiptBindings(claims, expectedFor(claims)));
  });

  it("strips an unknown claim through canonical validation without mutating claims", () => {
    const claims = {
      ...validClaims(),
      unknown_claim: "ignored",
      sensitive_value: "must-not-appear",
    } as unknown as AccessReceiptClaims;
    const before = { ...claims };

    expectMatched(evaluateAccessReceiptBindings(claims, expectedFor(claims)));
    expect(claims).toEqual(before);
  });

  it.each([
    ["sub", { sub: "other_subject" }],
    ["resource_id", { resource_id: "resource:other" }],
    ["policy_id", { policy_id: "policy_other" }],
    ["intent_id", { intent_id: "intent_other" }],
  ])("denies an independent %s mismatch", (_property, override) => {
    const claims = canonicalClaims();

    expectDenied(
      evaluateAccessReceiptBindings(claims, {
        ...expectedFor(claims),
        ...override,
      }),
    );
  });

  it("denies an independent optional redemption-limit mismatch", () => {
    const claims = canonicalClaims({ grant_type: "multi_redemption", max_redemptions: 2 });

    expectDenied(
      evaluateAccessReceiptBindings(claims, {
        ...expectedFor(claims),
        max_redemptions: 3,
      }),
    );
  });

  it.each(["sub", "resource_id", "policy_id", "intent_id"] as const)(
    "denies missing expected %s",
    (property) => {
      const claims = canonicalClaims();
      const expected = { ...expectedFor(claims) } as Record<string, unknown>;
      delete expected[property];

      expectDenied(evaluateAccessReceiptBindings(claims, asRuntimeInput(expected)));
    },
  );

  it.each([
    ["null", null],
    ["array", []],
    ["string", "invalid-context"],
    ["number", 42],
  ])("denies a %s expected context", (_label, value) => {
    expectDenied(
      evaluateAccessReceiptBindings(
        canonicalClaims(),
        asRuntimeInput(value),
      ),
    );
  });

  it.each([
    ["sub", null],
    ["resource_id", 42],
    ["policy_id", {}],
    ["intent_id", []],
  ])("denies a malformed expected %s", (property, value) => {
    const claims = canonicalClaims();

    expectDenied(
      evaluateAccessReceiptBindings(
        claims,
        asRuntimeInput({ ...expectedFor(claims), [property]: value }),
      ),
    );
  });

  it.each(["sub", "resource_id", "policy_id", "intent_id"] as const)(
    "denies an empty expected %s",
    (property) => {
      const claims = canonicalClaims();

      expectDenied(
        evaluateAccessReceiptBindings(claims, {
          ...expectedFor(claims),
          [property]: "",
        }),
      );
    },
  );

  it.each(requiredBindingFields)(
    "denies an own undefined expected %s",
    (property) => {
      const claims = canonicalClaims();
      const expected = {
        ...expectedFor(claims),
        [property]: undefined,
      };

      expect(Object.prototype.hasOwnProperty.call(expected, property)).toBe(true);
      expectDenied(
        evaluateAccessReceiptBindings(claims, asRuntimeInput(expected)),
      );
    },
  );

  it.each(requiredBindingFields)(
    "denies an inherited expected %s value",
    (property) => {
      const claims = canonicalClaims();
      const expectedValues = expectedFor(claims);
      const expected = Object.create({ [property]: expectedValues[property] }) as Record<
        string,
        unknown
      >;

      for (const field of requiredBindingFields) {
        if (field !== property) {
          expected[field] = expectedValues[field];
        }
      }

      expect(Object.prototype.hasOwnProperty.call(expected, property)).toBe(false);
      for (const field of requiredBindingFields) {
        if (field !== property) {
          expect(Object.prototype.hasOwnProperty.call(expected, field)).toBe(true);
        }
      }

      expectDenied(
        evaluateAccessReceiptBindings(claims, asRuntimeInput(expected)),
      );
    },
  );

  it.each([
    ["undefined", undefined],
    ["zero", 0],
    ["negative", -1],
    ["fraction", 1.5],
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["unsafe integer", Number.MAX_SAFE_INTEGER + 1],
    ["string", "1"],
  ])("denies an invalid expected max_redemptions value: %s", (_label, value) => {
    const claims = canonicalClaims();

    expectDenied(
      evaluateAccessReceiptBindings(
        claims,
        asRuntimeInput({ ...expectedFor(claims), max_redemptions: value }),
      ),
    );
  });

  it("ignores unknown expected properties and does not mutate expected context", () => {
    const claims = canonicalClaims();
    const expected = {
      ...expectedFor(claims),
      unknown_policy_input: "not-a-security-input",
    } as AccessReceiptExpectedBindings & Record<string, unknown>;
    const before = { ...expected };

    expectMatched(evaluateAccessReceiptBindings(claims, expected));
    expect(expected).toEqual(before);
  });

  it.each([
    ["missing claim", (() => { const value = validClaims(); delete (value as Record<string, unknown>).sub; return value; })()],
    ["invalid claim type", validClaims({ resource_id: 7 })],
    ["invalid grant relationship", validClaims({ grant_type: "single_redemption", max_redemptions: 2 })],
    ["invalid time relationship", validClaims({ iat: 100, nbf: 99 })],
    ["missing payment_ref", (() => { const value = validClaims() as Record<string, unknown>; delete value.payment_ref; return value; })()],
  ])("returns binding_denied for malformed claims: %s", (_label, claims) => {
    expectDenied(
      evaluateAccessReceiptBindings(
        asRuntimeInput(claims),
        expectedFor(canonicalClaims()),
      ),
    );
  });

  it("does not expose claim, expected, payment, or validation values in denial", () => {
    const claims = canonicalClaims({ payment_ref: "sensitive-payment-reference" });
    const expected = {
      ...expectedFor(claims),
      resource_id: "private-resource-context",
    };
    const result = evaluateAccessReceiptBindings(claims, expected);

    expectDenied(result);
    expect(JSON.stringify(result)).not.toContain("sensitive-payment-reference");
    expect(JSON.stringify(result)).not.toContain("private-resource-context");
    expect(JSON.stringify(result)).not.toContain("resource_id");
  });

  it("returns fresh frozen matched results", () => {
    const claims = canonicalClaims();
    const expected = expectedFor(claims);
    const first = evaluateAccessReceiptBindings(claims, expected);
    const second = evaluateAccessReceiptBindings(claims, expected);

    expectMatched(first);
    expectMatched(second);
    expect(first).not.toBe(second);
  });

  it("returns fresh frozen denied results", () => {
    const claims = canonicalClaims();
    const expected = {
      ...expectedFor(claims),
      resource_id: "resource:other",
    };
    const first = evaluateAccessReceiptBindings(claims, expected);
    const second = evaluateAccessReceiptBindings(claims, expected);

    expectDenied(first);
    expectDenied(second);
    expect(first).not.toBe(second);
  });

  it("resists mutation of matched results", () => {
    const claims = canonicalClaims();
    const result = evaluateAccessReceiptBindings(claims, expectedFor(claims));

    attemptMutation(() => Object.assign(result, { status: "changed" }));
    expectMatched(result);
    attemptMutation(() => Object.assign(result, { phase: "binding" }));
    expectMatched(result);
    attemptMutation(() => Object.assign(result, { reason: "must-not-appear" }));
    expectMatched(result);
  });

  it("resists mutation of denied results", () => {
    const claims = canonicalClaims();
    const result = evaluateAccessReceiptBindings(claims, {
      ...expectedFor(claims),
      resource_id: "resource:other",
    });

    attemptMutation(() => Object.assign(result, { status: "changed" }));
    expectDenied(result);
    attemptMutation(() => Object.assign(result, { phase: "other" }));
    expectDenied(result);
    attemptMutation(() => Object.assign(result, { reason: "must-not-appear" }));
    expectDenied(result);
  });

  it("isolates later matched results from earlier mutation attempts", () => {
    const claims = canonicalClaims();
    const expected = expectedFor(claims);
    const first = evaluateAccessReceiptBindings(claims, expected);

    attemptMutation(() => Object.assign(first, { status: "changed" }));

    const second = evaluateAccessReceiptBindings(claims, expected);
    expectMatched(first);
    expectMatched(second);
    expect(first).not.toBe(second);
  });

  it("isolates later denied results from earlier mutation attempts", () => {
    const claims = canonicalClaims();
    const expected = {
      ...expectedFor(claims),
      resource_id: "resource:other",
    };
    const first = evaluateAccessReceiptBindings(claims, expected);

    attemptMutation(() => Object.assign(first, { phase: "other" }));

    const second = evaluateAccessReceiptBindings(claims, expected);
    expectDenied(first);
    expectDenied(second);
    expect(first).not.toBe(second);
  });

  it("preserves nested unknown claim and expected input objects", () => {
    const unknownClaim = { nested: { value: "claim-secret" } };
    const unknownExpected = { nested: { value: "expected-secret" } };
    const claimsWithUnknown = {
      ...validClaims(),
      unknown_claim: unknownClaim,
    };
    const claims = claimsWithUnknown as unknown as AccessReceiptClaims;
    const expected = {
      ...expectedFor(canonicalClaims()),
      unknown_policy_input: unknownExpected,
    } as AccessReceiptExpectedBindings & Record<string, unknown>;
    const claimsSnapshot = structuredClone(claims);
    const expectedSnapshot = structuredClone(expected);

    Object.freeze(unknownClaim.nested);
    Object.freeze(unknownClaim);
    Object.freeze(unknownExpected.nested);
    Object.freeze(unknownExpected);
    Object.freeze(claims);
    Object.freeze(expected);

    const result = evaluateAccessReceiptBindings(claims, expected);

    expectMatched(result);
    expect(claims).toEqual(claimsSnapshot);
    expect(expected).toEqual(expectedSnapshot);
    expect(claimsWithUnknown.unknown_claim).toBe(unknownClaim);
    expect(unknownClaim.nested).toEqual({ value: "claim-secret" });
    expect(expected.unknown_policy_input).toBe(unknownExpected);
    expect(unknownExpected.nested).toEqual({ value: "expected-secret" });
    expect(JSON.stringify(result)).not.toContain("claim-secret");
    expect(JSON.stringify(result)).not.toContain("expected-secret");
  });
});
