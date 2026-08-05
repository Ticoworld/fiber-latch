import { describe, expect, it } from "vitest";

import {
  AccessReceiptValidationError,
  buildAccessReceiptClaims,
} from "../src/index.js";
import type { BuildAccessReceiptClaimsInput } from "../src/index.js";

const validInput: BuildAccessReceiptClaimsInput = {
  iss: "https://access.example.test",
  sub: "user_42",
  aud: "protected-api",
  iat: 1_785_000_000,
  nbf: 1_785_000_000,
  exp: 1_785_003_600,
  jti: "6bb2b5ce-8768-4bbb-86f5-8610c994972d",
  intent_id: "intent_01",
  resource_id: "course/module-1",
  policy_id: "policy_single_access_v1",
  payment_ref: "payment_ref_opaque_01",
  grant_type: "single_redemption",
  max_redemptions: 1,
};

function invalidInput(overrides: Record<string, unknown> = {}): unknown {
  return { ...validInput, ...overrides };
}

function expectValidationFailure(input: unknown): AccessReceiptValidationError {
  try {
    buildAccessReceiptClaims(input as BuildAccessReceiptClaimsInput);
    throw new Error("Expected buildAccessReceiptClaims to reject the input.");
  } catch (error) {
    expect(error).toBeInstanceOf(AccessReceiptValidationError);
    return error as AccessReceiptValidationError;
  }
}

describe("buildAccessReceiptClaims", () => {
  it("builds a canonical single-redemption claim object with every required member", () => {
    const claims = buildAccessReceiptClaims(validInput);

    expect(claims).toEqual(validInput);
    expect(Object.keys(claims).sort()).toEqual([
      "aud",
      "exp",
      "grant_type",
      "iat",
      "intent_id",
      "iss",
      "jti",
      "max_redemptions",
      "nbf",
      "payment_ref",
      "policy_id",
      "resource_id",
      "sub",
    ]);
  });

  it("builds a valid multi-redemption claim object", () => {
    expect(
      buildAccessReceiptClaims({
        ...validInput,
        grant_type: "multi_redemption",
        max_redemptions: 2,
      }),
    ).toMatchObject({ grant_type: "multi_redemption", max_redemptions: 2 });
  });

  it("preserves a valid payment reference string and explicit null", () => {
    expect(buildAccessReceiptClaims(validInput).payment_ref).toBe("payment_ref_opaque_01");
    expect(buildAccessReceiptClaims({ ...validInput, payment_ref: null }).payment_ref).toBeNull();
  });

  it("accepts strict time ordering with iat less than nbf and nbf less than exp", () => {
    const claims = buildAccessReceiptClaims({
      ...validInput,
      iat: 1_785_000_000,
      nbf: 1_785_000_001,
      exp: 1_785_003_600,
    });

    expect(claims).toMatchObject({ iat: 1_785_000_000, nbf: 1_785_000_001, exp: 1_785_003_600 });
  });

  it("accepts an empty payment_ref string because it is an allowed string value", () => {
    expect(buildAccessReceiptClaims({ ...validInput, payment_ref: "" }).payment_ref).toBe("");
  });

  it("accepts iat equal to nbf when nbf is before exp", () => {
    expect(buildAccessReceiptClaims(validInput).iat).toBe(validInput.nbf);
  });

  it("strips unknown properties without mutating the input", () => {
    const input = {
      ...validInput,
      unknown_claim: "ignored",
      private_key: "must-not-appear",
    } as BuildAccessReceiptClaimsInput & Record<string, unknown>;
    const before = { ...input };

    const claims = buildAccessReceiptClaims(input);

    expect(claims).not.toHaveProperty("unknown_claim");
    expect(claims).not.toHaveProperty("private_key");
    expect(input).toEqual(before);
    expect(Object.keys(claims)).not.toContain("private_key");
  });

  it.each([
    "iss",
    "sub",
    "aud",
    "iat",
    "nbf",
    "exp",
    "jti",
    "intent_id",
    "resource_id",
    "policy_id",
    "payment_ref",
    "grant_type",
    "max_redemptions",
  ])("rejects a missing required property: %s", (property) => {
    const input = { ...validInput } as Record<string, unknown>;
    delete input[property];

    expectValidationFailure(input);
  });

  it.each(["iss", "sub", "aud", "jti", "intent_id", "resource_id", "policy_id"])(
    "rejects an empty required string: %s",
    (property) => {
      expectValidationFailure(invalidInput({ [property]: "" }));
    },
  );

  it("rejects an undefined payment_ref instead of treating it as null", () => {
    expectValidationFailure(invalidInput({ payment_ref: undefined }));
  });

  it("rejects a payment_ref with an invalid type", () => {
    const error = expectValidationFailure(
      invalidInput({ payment_ref: { private_key: "sensitive" } }),
    );

    expect(error.message).not.toContain("private_key");
    expect(JSON.stringify(error)).not.toContain("sensitive");
  });

  function expectSafeNumericFailure(
    input: unknown,
    path: string,
    invalidValue: number,
  ): void {
    const error = expectValidationFailure(input);
    const serialisedError = JSON.stringify(error);

    expect(error.message).toBe("Invalid access receipt claims.");
    expect(serialisedError).not.toContain(String(invalidValue));
    expect(error.issues.map((issue) => issue.path)).toContainEqual([path]);
  }

  it.each([
    ["iat", 1_785_000_000.5],
    ["nbf", 1_785_000_001.5],
    ["exp", 1_785_003_600.5],
  ])("rejects a fractional %s", (property, value) => {
    expectSafeNumericFailure(invalidInput({ [property]: value }), property, value);
  });

  it("rejects negative infinity as a time value", () => {
    expectSafeNumericFailure(
      invalidInput({ iat: Number.NEGATIVE_INFINITY }),
      "iat",
      Number.NEGATIVE_INFINITY,
    );
  });

  it("rejects an unsafe integer as a time value", () => {
    const unsafeInteger = Number.MAX_SAFE_INTEGER + 1;

    expectSafeNumericFailure(invalidInput({ exp: unsafeInteger }), "exp", unsafeInteger);
  });

  it.each([0, -1, 1.5])("rejects max_redemptions=%s", (maxRedemptions) => {
    expectValidationFailure(invalidInput({ max_redemptions: maxRedemptions }));
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects non-finite max_redemptions=%s",
    (maxRedemptions) => {
      expectSafeNumericFailure(
        invalidInput({ max_redemptions: maxRedemptions }),
        "max_redemptions",
        maxRedemptions,
      );
    },
  );

  it("accepts the minimum max_redemptions value of one for single redemption", () => {
    expect(buildAccessReceiptClaims({ ...validInput, max_redemptions: 1 }).max_redemptions).toBe(1);
  });

  it("rejects inconsistent grant_type and max_redemptions combinations", () => {
    expectValidationFailure(invalidInput({ grant_type: "single_redemption", max_redemptions: 2 }));
    expectValidationFailure(invalidInput({ grant_type: "multi_redemption", max_redemptions: 1 }));
  });

  it("rejects unsupported grant types", () => {
    expectValidationFailure(invalidInput({ grant_type: "unlimited" }));
  });

  it("requires iat to be no later than nbf", () => {
    expectValidationFailure(invalidInput({ iat: validInput.nbf + 1 }));
  });

  it("requires nbf to be strictly before exp", () => {
    expectValidationFailure(invalidInput({ nbf: validInput.exp }));
    expectValidationFailure(invalidInput({ nbf: validInput.exp + 1 }));
  });

  it.each([
    ["iat", "2026-01-01T00:00:00.000Z"],
    ["nbf", Number.NaN],
    ["exp", Number.POSITIVE_INFINITY],
  ])("rejects a non-integer numeric time value for %s", (property, value) => {
    expectValidationFailure(invalidInput({ [property]: value }));
  });

  it("does not expose a raw Zod error or the complete invalid input", () => {
    const invalid = invalidInput({
      payment_ref: { token: "secret-token", private_key: "secret-key" },
    });
    const error = expectValidationFailure(invalid);

    expect(error).not.toHaveProperty("name", "ZodError");
    expect(error.name).toBe("AccessReceiptValidationError");
    expect(error.message).toBe("Invalid access receipt claims.");
    expect(error.message).not.toContain("secret-token");
    expect(error.message).not.toContain("secret-key");
    expect(JSON.stringify(error)).not.toContain("secret-token");
    expect(JSON.stringify(error)).not.toContain("secret-key");
    expect(error.issues).toEqual([
      { path: ["payment_ref"], reason: "invalid type" },
    ]);
  });
});
