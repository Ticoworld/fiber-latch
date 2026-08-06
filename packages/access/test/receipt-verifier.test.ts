import { base64url } from "jose";
import { beforeAll, describe, expect, it } from "vitest";

import {
  AccessReceiptConfigurationError,
  AccessReceiptVerificationError,
  createAccessReceiptSigner,
  createAccessReceiptVerifier,
} from "../src/index.js";
import type { AccessReceiptVerifierConfiguration } from "../src/index.js";
import {
  asRuntimeInput,
  generateTestKeyPair,
  publicClaimKeys,
  replaceProtectedHeader,
  signPayload,
  validClaims,
} from "./test-helpers.js";

let firstKey: Awaited<ReturnType<typeof generateTestKeyPair>>;
let secondKey: Awaited<ReturnType<typeof generateTestKeyPair>>;
let verifier: Awaited<ReturnType<typeof createAccessReceiptVerifier>>;

beforeAll(async () => {
  firstKey = await generateTestKeyPair("verify-key-01");
  secondKey = await generateTestKeyPair("verify-key-02");
  verifier = await createAccessReceiptVerifier({
    publicKeys: [firstKey.publicJwk, secondKey.publicJwk],
    issuer: "https://access.example.test",
    audience: "protected-api",
  });
});

async function validToken(
  key = firstKey,
  overrides: Record<string, unknown> = {},
): Promise<string> {
  return signPayload(key.privateJwk, validClaims(overrides));
}

async function expectConfigurationFailure(config: unknown): Promise<AccessReceiptConfigurationError> {
  try {
    await createAccessReceiptVerifier(asRuntimeInput(config));
    throw new Error("Expected verifier configuration to be rejected.");
  } catch (error) {
    expect(error).toBeInstanceOf(AccessReceiptConfigurationError);
    return error as AccessReceiptConfigurationError;
  }
}

async function expectVerificationFailure(
  token: unknown,
  selectedVerifier = verifier,
): Promise<AccessReceiptVerificationError> {
  try {
    await selectedVerifier(asRuntimeInput(token));
    throw new Error("Expected verification to be rejected.");
  } catch (error) {
    expect(error).toBeInstanceOf(AccessReceiptVerificationError);
    const verificationError = error as AccessReceiptVerificationError;
    expect(verificationError.name).toBe("AccessReceiptVerificationError");
    expect(verificationError.message).toBe("Access receipt verification failed.");
    expect(verificationError.code).toBe("verification_denied");
    return verificationError;
  }
}

describe("createAccessReceiptVerifier", () => {
  it("constructs with one or more trusted public keys before returning a callable", async () => {
    const oneKeyVerifier = await createAccessReceiptVerifier({
      publicKeys: [firstKey.publicJwk],
      issuer: "https://access.example.test",
      audience: "protected-api",
    });

    expect(oneKeyVerifier).toBeTypeOf("function");
    await expect(oneKeyVerifier(await validToken())).resolves.toMatchObject({
      jti: "jti_test_01",
    });
    await expect(verifier(await validToken(secondKey))).resolves.toMatchObject({
      jti: "jti_test_01",
    });
  });

  it("accepts permitted public JWK metadata", async () => {
    const configured = await createAccessReceiptVerifier({
      publicKeys: [{ ...firstKey.publicJwk, alg: "EdDSA", use: "sig", key_ops: ["verify"] }],
      issuer: "https://access.example.test",
      audience: "protected-api",
    });

    await expect(configured(await validToken())).resolves.toMatchObject({
      jti: "jti_test_01",
    });
  });

  it.each([
    ["missing config", undefined],
    ["null config", null],
    ["array config", []],
    ["missing public keys", {}],
    ["non-array public keys", { publicKeys: {} }],
    ["empty public keys", { publicKeys: [] }],
  ])("rejects %s", async (_label, config) => {
    await expectConfigurationFailure(config);
  });

  it.each([
    ["wrong kty", { kty: "EC" }],
    ["wrong curve", { crv: "X25519" }],
    ["missing kid", { kid: undefined }],
    ["empty kid", { kid: "" }],
    ["missing x", { x: undefined }],
    ["empty x", { x: "" }],
    ["malformed x", { x: "bad!" }],
    ["private material", { d: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" }],
  ])("rejects public key with %s", async (_label, override) => {
    await expectConfigurationFailure({
      publicKeys: [{ ...firstKey.publicJwk, ...override }],
      issuer: "https://access.example.test",
      audience: "protected-api",
    });
  });

  it("rejects duplicate key IDs, empty issuer/audience, unsupported algorithms, and bad limits", async () => {
    await expectConfigurationFailure({
      publicKeys: [firstKey.publicJwk, { ...secondKey.publicJwk, kid: firstKey.publicJwk.kid }],
      issuer: "https://access.example.test",
      audience: "protected-api",
    });
    await expectConfigurationFailure({
      publicKeys: [firstKey.publicJwk],
      issuer: "",
      audience: "protected-api",
    });
    await expectConfigurationFailure({
      publicKeys: [firstKey.publicJwk],
      issuer: "https://access.example.test",
      audience: "",
    });
    await expectConfigurationFailure({
      publicKeys: [firstKey.publicJwk],
      issuer: "https://access.example.test",
      audience: "protected-api",
      algorithm: "RS256",
    });
    await expectConfigurationFailure({
      publicKeys: [firstKey.publicJwk],
      issuer: "https://access.example.test",
      audience: "protected-api",
      clockTolerance: -1,
    });
    await expectConfigurationFailure({
      publicKeys: [firstKey.publicJwk],
      issuer: "https://access.example.test",
      audience: "protected-api",
      maxTokenSize: 1.5,
    });
  });

  it.each([
    ["sign-only key_ops", { key_ops: ["sign"] }],
    ["empty key_ops", { key_ops: [] }],
    ["conflicting key_ops", { key_ops: ["verify", "sign"] }],
    ["malformed key_ops", { key_ops: "verify" }],
    ["conflicting alg", { alg: "RS256" }],
    ["conflicting use", { use: "enc" }],
  ])("rejects public key with %s metadata", async (_label, override) => {
    const error = await expectConfigurationFailure({
      publicKeys: [{ ...firstKey.publicJwk, ...override }],
      issuer: "https://access.example.test",
      audience: "protected-api",
    });

    const field = Object.prototype.hasOwnProperty.call(override, "key_ops")
      ? "key_ops"
      : Object.prototype.hasOwnProperty.call(override, "alg")
        ? "alg"
        : "use";
    expect(error.issues).toEqual([
      {
        path: ["publicKeys", "0", field],
        reason: field === "key_ops"
          ? "unsupported key operations"
          : `must be ${field === "alg" ? "EdDSA" : "sig"}`,
      },
    ]);
  });

  it.each([
    ["below minimum", 255],
    ["above maximum", 16_385],
    ["zero", 0],
    ["negative", -1],
    ["fractional", 1.5],
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["unsafe integer", Number.MAX_SAFE_INTEGER + 1],
  ])("rejects %s maxTokenSize configuration", async (_label, maxTokenSize) => {
    await expectConfigurationFailure({
      publicKeys: [firstKey.publicJwk],
      issuer: "https://access.example.test",
      audience: "protected-api",
      maxTokenSize,
    });
  });

  it("verifies claims and returns only the sanitised approved members", async () => {
    const token = await signPayload(firstKey.privateJwk, {
      ...validClaims(),
      unknown_sensitive_claim: "must-not-return",
    });
    const claims = await verifier(token);

    expect(Object.keys(claims).sort()).toEqual(publicClaimKeys());
    expect(claims).not.toHaveProperty("unknown_sensitive_claim");
    expect(claims.payment_ref).toBe("payment_ref_test_01");
  });

  it("preserves payment_ref null and accepts the not-before boundary", async () => {
    const now = Math.floor(Date.now() / 1000);
    const claims = await verifier(
      await validToken(firstKey, { payment_ref: null, iat: now - 5, nbf: now, exp: now + 300 }),
    );

    expect(claims.payment_ref).toBeNull();
    expect(claims.nbf).toBe(now);
  });

  it("rejects non-string, empty, oversized, structurally malformed, and malformed-header tokens", async () => {
    await expectVerificationFailure(42);
    await expectVerificationFailure("");
    await expectVerificationFailure("a.b.c.d");
    await expectVerificationFailure("!!!!.eyJmb28iOiJiYXIifQ.signature");

    const malformedJsonHeader = `${base64url.encode(new TextEncoder().encode("{"))}.payload.signature`;
    await expectVerificationFailure(malformedJsonHeader);

    const oversizedVerifier = await createAccessReceiptVerifier({
      publicKeys: [firstKey.publicJwk],
      issuer: "https://access.example.test",
      audience: "protected-api",
      maxTokenSize: 256,
    });
    await expectVerificationFailure(await validToken(), oversizedVerifier);
  });

  it("accepts a token exactly at the configured UTF-8 byte limit and rejects one byte below it", async () => {
    const token = await validToken();
    const tokenBytes = new TextEncoder().encode(token).byteLength;
    const exactVerifier = await createAccessReceiptVerifier({
      publicKeys: [firstKey.publicJwk],
      issuer: "https://access.example.test",
      audience: "protected-api",
      maxTokenSize: tokenBytes,
    });
    const smallerVerifier = await createAccessReceiptVerifier({
      publicKeys: [firstKey.publicJwk],
      issuer: "https://access.example.test",
      audience: "protected-api",
      maxTokenSize: tokenBytes - 1,
    });

    await expect(exactVerifier(token)).resolves.toMatchObject({ jti: "jti_test_01" });
    await expectVerificationFailure(token, smallerVerifier);
  });

  it.each([
    ["alg none", { alg: "none", typ: "JWT", kid: "verify-key-01" }],
    ["wrong algorithm", { alg: "RS256", typ: "JWT", kid: "verify-key-01" }],
    ["missing typ", { alg: "EdDSA", kid: "verify-key-01" }],
    ["wrong typ", { alg: "EdDSA", typ: "JWS", kid: "verify-key-01" }],
    ["missing kid", { alg: "EdDSA", typ: "JWT" }],
    ["empty kid", { alg: "EdDSA", typ: "JWT", kid: "" }],
    ["unknown kid", { alg: "EdDSA", typ: "JWT", kid: "unknown-key" }],
    ["jku", { alg: "EdDSA", typ: "JWT", kid: "verify-key-01", jku: "https://attacker.test" }],
    ["embedded jwk", { alg: "EdDSA", typ: "JWT", kid: "verify-key-01", jwk: { kty: "OKP" } }],
    ["x5u", { alg: "EdDSA", typ: "JWT", kid: "verify-key-01", x5u: "https://attacker.test" }],
    ["x5c", { alg: "EdDSA", typ: "JWT", kid: "verify-key-01", x5c: ["certificate"] }],
  ])("rejects %s", async (_label, header) => {
    const token = await validToken();
    await expectVerificationFailure(replaceProtectedHeader(token, header));
  });

  it("rejects a protected header containing crit", async () => {
    const token = await validToken();
    await expectVerificationFailure(
      replaceProtectedHeader(token, {
        alg: "EdDSA",
        typ: "JWT",
        kid: "verify-key-01",
        crit: ["b64"],
      }),
    );
  });

  it("rejects a protected header containing b64 false", async () => {
    const token = await validToken();
    await expectVerificationFailure(
      replaceProtectedHeader(token, {
        alg: "EdDSA",
        typ: "JWT",
        kid: "verify-key-01",
        b64: false,
      }),
    );
  });

  it("rejects a protected header whose JSON value is an array", async () => {
    const token = await validToken();
    await expectVerificationFailure(
      replaceProtectedHeader(token, asRuntimeInput(["not-an-object"])),
    );
  });

  it("rejects an invalid signature under a trusted kid", async () => {
    const token = await validToken();
    const [header, payload, signature] = token.split(".");
    const alteredSignature = `${header}.${payload}.${signature[0] === "A" ? "B" : "A"}${signature.slice(1)}`;
    await expectVerificationFailure(alteredSignature);
  });

  it("rejects a token signed by an untrusted key under a trusted kid", async () => {
    const untrusted = await generateTestKeyPair("untrusted-key");
    const token = await signPayload(
      { ...untrusted.privateJwk, kid: firstKey.publicJwk.kid },
      validClaims(),
    );
    await expectVerificationFailure(token);
  });

  it("rejects issuer, audience, not-before, and expiration failures", async () => {
    await expectVerificationFailure(await validToken(firstKey, { iss: "wrong-issuer" }));
    await expectVerificationFailure(await validToken(firstKey, { aud: "wrong-audience" }));
    await expectVerificationFailure(await validToken(firstKey, { iat: Math.floor(Date.now() / 1000), nbf: Math.floor(Date.now() / 1000) + 120 }));

    const now = Math.floor(Date.now() / 1000);
    await expectVerificationFailure(await validToken(firstKey, { iat: now - 30, nbf: now - 20, exp: now }));
  });

  it.each([
    ["missing required claim", { payment_ref: undefined }],
    ["invalid payment_ref", { payment_ref: { secret: "unknown" } }],
    ["invalid time order", { iat: 100, nbf: 90, exp: 200 }],
    ["inconsistent grant", { grant_type: "multi_redemption", max_redemptions: 1 }],
    ["unsafe numeric claim", { iat: Number.MAX_SAFE_INTEGER + 1, nbf: Number.MAX_SAFE_INTEGER + 2, exp: Number.MAX_SAFE_INTEGER + 3 }],
  ])("rejects %s", async (_label, override) => {
    await expectVerificationFailure(await validToken(firstKey, override));
  });

  it("exposes only the stable generic verification error", async () => {
    const token = await validToken(firstKey, { unknown_sensitive_claim: "secret-value" });
    const [header, payload, signature] = token.split(".");
    const invalidSignature = `${header}.${payload}.${signature[0] === "A" ? "B" : "A"}${signature.slice(1)}`;
    const error = await expectVerificationFailure(invalidSignature);
    const serialised = JSON.stringify(error);

    expect(error).toEqual(expect.objectContaining({
      name: "AccessReceiptVerificationError",
      message: "Access receipt verification failed.",
      code: "verification_denied",
    }));
    expect(serialised).not.toContain(token);
    expect(serialised).not.toContain("secret-value");
    expect(serialised).not.toContain("JOSE");
    expect(serialised).not.toContain("cause");
    expect(Object.keys(error)).toEqual(["code", "name"]);
  });
});
