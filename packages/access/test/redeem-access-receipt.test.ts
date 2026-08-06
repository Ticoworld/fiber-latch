import { describe, expect, it } from "vitest";

import {
  AccessReceiptVerificationError,
  buildAccessReceiptClaims,
  redeemAccessReceipt,
} from "../src/index.js";
import type {
  AccessReceiptClaims,
  AccessReceiptConsumeCommand,
  AccessReceiptConsumeResult,
  AccessReceiptExpectedBindings,
  AccessReceiptRedemptionResult,
  AccessReceiptStore,
  RedeemAccessReceiptInput,
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

function expectExactResult(
  result: AccessReceiptRedemptionResult,
  expected: AccessReceiptRedemptionResult,
): void {
  expect(result).toEqual(expected);
  expect(Object.keys(result).sort()).toEqual(Object.keys(expected).sort());
  expect(JSON.stringify(result)).not.toContain("sentinel");
}

function makeInput(
  overrides: Partial<RedeemAccessReceiptInput> = {},
): RedeemAccessReceiptInput {
  const claims = canonicalClaims();
  const store: AccessReceiptStore = {
    consume: async () => ({ outcome: "consumed", exhausted: false }),
  };

  return {
    token: "sentinel-token",
    expected: expectedFor(claims),
    verifier: async () => claims,
    store,
    current_time: Math.floor(Date.now() / 1000),
    ...overrides,
  };
}

function malformedStoreResult(result: unknown): AccessReceiptStore {
  return {
    consume: async () => asRuntimeInput(result),
  };
}

describe("redeemAccessReceipt", () => {
  it.each([
    ["remaining capacity", { outcome: "consumed", exhausted: false }, { status: "success", exhausted: false }],
    ["authoritative exhaustion", { outcome: "consumed", exhausted: true }, { status: "success", exhausted: true }],
  ] as const)("maps consumed with %s", async (_label, storeResult, expectedResult) => {
    const result = await redeemAccessReceipt(
      makeInput({
        store: { consume: async () => storeResult },
      }),
    );

    expectExactResult(result, expectedResult);
  });

  it("verifies, binds, consumes once, and preserves the exact command boundary", async () => {
    const claims = canonicalClaims({ unknown_claim: { sentinel: "claim" } });
    const commands: AccessReceiptConsumeCommand[] = [];
    let verifierCalls = 0;
    const expected: AccessReceiptExpectedBindings = {
      ...expectedFor(claims),
      max_redemptions: claims.max_redemptions,
      unknown_expected: { sentinel: "expected" },
    } as AccessReceiptExpectedBindings;
    const store: AccessReceiptStore = {
      consume: async (command) => {
        commands.push(command);
        return { outcome: "consumed", exhausted: false };
      },
    };

    const result = await redeemAccessReceipt({
      token: "sentinel-token",
      expected,
      verifier: async () => {
        verifierCalls += 1;
        return {
          ...claims,
          unknown_claim: { sentinel: "verified-payload" },
        } as AccessReceiptClaims;
      },
      store,
      current_time: 123,
    });

    expectExactResult(result, { status: "success", exhausted: false });
    expect(verifierCalls).toBe(1);
    expect(commands).toHaveLength(1);
    expect(commands[0]).toEqual({
      jti: claims.jti,
      iss: claims.iss,
      sub: claims.sub,
      aud: claims.aud,
      intent_id: claims.intent_id,
      resource_id: claims.resource_id,
      policy_id: claims.policy_id,
      grant_type: claims.grant_type,
      max_redemptions: claims.max_redemptions,
      exp: claims.exp,
      current_time: 123,
      expected_max_redemptions: claims.max_redemptions,
    });
    expect(Object.keys(commands[0] ?? {}).sort()).toEqual([
      "aud",
      "current_time",
      "exp",
      "expected_max_redemptions",
      "grant_type",
      "intent_id",
      "iss",
      "jti",
      "max_redemptions",
      "policy_id",
      "resource_id",
      "sub",
    ]);
  });

  it("omits expected_max_redemptions when the host did not supply it", async () => {
    const claims = canonicalClaims();
    let command: AccessReceiptConsumeCommand | undefined;
    const result = await redeemAccessReceipt({
      ...makeInput({ expected: expectedFor(claims) }),
      verifier: async () => claims,
      store: {
        consume: async (receivedCommand) => {
          command = receivedCommand;
          return { outcome: "consumed", exhausted: false };
        },
      },
    });

    expectExactResult(result, { status: "success", exhausted: false });
    expect(command).toBeDefined();
    expect(Object.prototype.hasOwnProperty.call(command, "expected_max_redemptions")).toBe(false);
  });

  it("maps an expected verification denial without calling binding or the store", async () => {
    let storeCalls = 0;
    const result = await redeemAccessReceipt(
      makeInput({
        verifier: async () => {
          throw new AccessReceiptVerificationError();
        },
        store: {
          consume: async () => {
            storeCalls += 1;
            return { outcome: "consumed", exhausted: false };
          },
        },
      }),
    );

    expectExactResult(result, { status: "verification_denied", phase: "verification" });
    expect(storeCalls).toBe(0);
  });

  it("maps an unexpected verifier failure to system_failure without exposing it", async () => {
    const error = new Error("sentinel verifier internals");
    let storeCalls = 0;
    const result = await redeemAccessReceipt(
      makeInput({
        verifier: async () => {
          throw error;
        },
        store: {
          consume: async () => {
            storeCalls += 1;
            return { outcome: "consumed", exhausted: false };
          },
        },
      }),
    );

    expectExactResult(result, { status: "system_failure", phase: "system" });
    expect(storeCalls).toBe(0);
    expect(JSON.stringify(result)).not.toContain(error.message);
  });

  it("maps binding denial and stops before store consumption", async () => {
    const claims = canonicalClaims();
    let storeCalls = 0;
    const result = await redeemAccessReceipt(
      makeInput({
        verifier: async () => claims,
        expected: { ...expectedFor(claims), resource_id: "sentinel-resource" },
        store: {
          consume: async () => {
            storeCalls += 1;
            return { outcome: "consumed", exhausted: false };
          },
        },
      }),
    );

    expectExactResult(result, { status: "binding_denied", phase: "binding" });
    expect(storeCalls).toBe(0);
    expect(JSON.stringify(result)).not.toContain("sentinel-resource");
  });

  it("maps an unexpected binding failure to system_failure", async () => {
    const claims = canonicalClaims();
    const expected = new Proxy(expectedFor(claims), {
      get(target, property, receiver) {
        if (property === "sub") {
          throw new Error("sentinel binding internals");
        }
        return Reflect.get(target, property, receiver);
      },
    });
    let storeCalls = 0;

    const result = await redeemAccessReceipt(
      makeInput({
        verifier: async () => claims,
        expected,
        store: {
          consume: async () => {
            storeCalls += 1;
            return { outcome: "consumed", exhausted: false };
          },
        },
      }),
    );

    expectExactResult(result, { status: "system_failure", phase: "system" });
    expect(storeCalls).toBe(0);
  });

  it.each([
    "receipt_missing",
    "receipt_revoked",
    "receipt_exhausted",
    "receipt_expired",
    "authority_mismatch",
    "concurrency_conflict",
  ] as const)("maps store denial %s safely", async (outcome) => {
    const result = await redeemAccessReceipt(
      makeInput({
        store: { consume: async () => ({ outcome }) },
      }),
    );

    expectExactResult(result, {
      status: "consumption_denied",
      phase: "consumption",
      reason: outcome,
    });
  });

  it("maps store system_failure and thrown store errors to system_failure", async () => {
    const returned = await redeemAccessReceipt(
      makeInput({ store: { consume: async () => ({ outcome: "system_failure" }) } }),
    );
    const thrown = await redeemAccessReceipt(
      makeInput({
        store: {
          consume: async () => {
            throw new Error("sentinel store internals");
          },
        },
      }),
    );

    expectExactResult(returned, { status: "system_failure", phase: "system" });
    expectExactResult(thrown, { status: "system_failure", phase: "system" });
    expect(JSON.stringify(thrown)).not.toContain("sentinel store internals");
  });

  it("does not retry a concurrency conflict", async () => {
    let storeCalls = 0;
    const result = await redeemAccessReceipt(
      makeInput({
        store: {
          consume: async () => {
            storeCalls += 1;
            return { outcome: "concurrency_conflict" };
          },
        },
      }),
    );

    expectExactResult(result, {
      status: "consumption_denied",
      phase: "consumption",
      reason: "concurrency_conflict",
    });
    expect(storeCalls).toBe(1);
  });

  it.each([
    null,
    1,
    "unknown",
    {},
    { outcome: "consumed" },
    { outcome: "consumed", exhausted: "true" },
    { outcome: "not-approved" },
  ])("fails closed for malformed store result %#", async (storeResult) => {
    const result = await redeemAccessReceipt(makeInput({ store: malformedStoreResult(storeResult) }));

    expectExactResult(result, { status: "system_failure", phase: "system" });
  });

  it.each([
    null,
    [],
    { verifier: undefined },
    { verifier: "not-a-function" },
    { store: undefined },
    { store: {} },
    { store: { consume: "not-a-function" } },
    { current_time: -1 },
    { current_time: 1.5 },
    { current_time: Number.NaN },
    { current_time: Number.POSITIVE_INFINITY },
    { current_time: Number.MAX_SAFE_INTEGER + 1 },
    { current_time: "100" },
  ])("fails closed for malformed orchestration input %#", async (invalid) => {
    let verifierCalls = 0;
    let storeCalls = 0;
    const base = makeInput({
      verifier: async () => {
        verifierCalls += 1;
        return canonicalClaims();
      },
      store: {
        consume: async () => {
          storeCalls += 1;
          return { outcome: "consumed", exhausted: false };
        },
      },
    });
    const candidate = Array.isArray(invalid)
      ? invalid
      : invalid === null
        ? invalid
        : { ...base, ...invalid };

    const result = await redeemAccessReceipt(asRuntimeInput(candidate));

    expectExactResult(result, { status: "system_failure", phase: "system" });
    expect(verifierCalls).toBe(0);
    expect(storeCalls).toBe(0);
  });

  it("passes an untrusted token to the verifier and maps its ordinary denial", async () => {
    let receivedToken: unknown;
    const result = await redeemAccessReceipt(
      makeInput({
        token: asRuntimeInput({ sentinel: "token" }),
        verifier: async (token) => {
          receivedToken = token;
          throw new AccessReceiptVerificationError();
        },
      }),
    );

    expectExactResult(result, { status: "verification_denied", phase: "verification" });
    expect(receivedToken).toEqual({ sentinel: "token" });
    expect(JSON.stringify(result)).not.toContain("token");
  });

  it("does not mutate orchestration input or verified claims", async () => {
    const claims = canonicalClaims({ unknown_nested: { sentinel: "claim" } });
    const expected = {
      ...expectedFor(claims),
      unknown_nested: { sentinel: "expected" },
    };
    const input = makeInput({
      expected,
      verifier: async () => ({ ...claims, unknown_nested: { sentinel: "claim" } } as AccessReceiptClaims),
      store: { consume: async () => ({ outcome: "consumed", exhausted: false }) },
    });
    const beforeClaims = structuredClone(claims);
    const beforeExpected = structuredClone(expected);

    const result = await redeemAccessReceipt(input);

    expectExactResult(result, { status: "success", exhausted: false });
    expect(input.token).toBe("sentinel-token");
    expect(input.current_time).toEqual(expect.any(Number));
    expect(claims).toEqual(beforeClaims);
    expect(expected).toEqual(beforeExpected);
    expect(expected.unknown_nested).toEqual({ sentinel: "expected" });
  });
});
