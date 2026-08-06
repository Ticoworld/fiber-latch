import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { describe, expect, it, vi } from "vitest";

describe("unexpected verifier failures", () => {
  it("propagates an unexpected jwtVerify error instead of converting it to denial", async () => {
    const { privateKey, publicKey } = await generateKeyPair("EdDSA", { extractable: true });
    const publicJwk = {
      ...(await exportJWK(publicKey)),
      alg: "EdDSA",
      kid: "unexpected-error-key",
    };
    const now = Math.floor(Date.now() / 1000);
    const token = await new SignJWT({
      iss: "https://access.example.test",
      sub: "user_42",
      aud: "protected-api",
      iat: now - 30,
      nbf: now - 20,
      exp: now + 300,
      jti: "jti_unexpected_error",
      intent_id: "intent_unexpected_error",
      resource_id: "course/module-1",
      policy_id: "policy_single_access_v1",
      payment_ref: null,
      grant_type: "single_redemption",
      max_redemptions: 1,
    })
      .setProtectedHeader({ alg: "EdDSA", typ: "JWT", kid: "unexpected-error-key" })
      .sign(privateKey);
    const sentinel = new Error("unexpected-jwtVerify-sentinel");

    vi.doMock("jose", async () => {
      const actual = await vi.importActual<typeof import("jose")>("jose");
      return {
        ...actual,
        jwtVerify: (async () => {
          throw sentinel;
        }) as typeof actual.jwtVerify,
      };
    });
    vi.resetModules();

    try {
      const { createAccessReceiptVerifier } = await import("../src/index.js");
      const verifier = await createAccessReceiptVerifier({
        publicKeys: [publicJwk],
        issuer: "https://access.example.test",
        audience: "protected-api",
      });

      await expect(verifier(token)).rejects.toBe(sentinel);
    } finally {
      vi.doUnmock("jose");
      vi.resetModules();
    }
  });
});
