import { afterEach, expect, it, vi } from "vitest";

import { asRuntimeInput, validClaims } from "./test-helpers.js";

afterEach(() => {
  vi.doUnmock("../src/receipt-claims.js");
  vi.resetModules();
});

it("propagates an unexpected canonicalisation error instead of returning binding_denied", async () => {
  const sentinel = new Error("unexpected canonicalisation sentinel");

  vi.doMock("../src/receipt-claims.js", async () => {
    const actual = await vi.importActual<typeof import("../src/receipt-claims.js")>(
      "../src/receipt-claims.js",
    );

    return {
      ...actual,
      buildAccessReceiptClaims: () => {
        throw sentinel;
      },
    };
  });

  const { evaluateAccessReceiptBindings } = await import("../src/receipt-bindings.js");
  const claims = validClaims();

  expect(() =>
    evaluateAccessReceiptBindings(
      asRuntimeInput(claims),
      {
        sub: claims.sub,
        resource_id: claims.resource_id,
        policy_id: claims.policy_id,
        intent_id: claims.intent_id,
      },
    ),
  ).toThrow(sentinel);
});
