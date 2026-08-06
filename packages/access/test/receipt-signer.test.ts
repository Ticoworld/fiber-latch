import { decodeJwt, decodeProtectedHeader } from "jose";
import { describe, expect, it } from "vitest";

import {
  AccessReceiptConfigurationError,
  AccessReceiptValidationError,
  createAccessReceiptSigner,
} from "../src/index.js";
import type { AccessReceiptSignerConfiguration } from "../src/index.js";
import {
  asRuntimeInput,
  generateTestKeyPair,
  publicClaimKeys,
  validClaims,
} from "./test-helpers.js";

async function configurationFailure(config: unknown): Promise<AccessReceiptConfigurationError> {
  try {
    await createAccessReceiptSigner(asRuntimeInput(config));
    throw new Error("Expected signer configuration to be rejected.");
  } catch (error) {
    expect(error).toBeInstanceOf(AccessReceiptConfigurationError);
    return error as AccessReceiptConfigurationError;
  }
}

describe("createAccessReceiptSigner", () => {
  it("creates a signer and emits the approved compact JWT profile", async () => {
    const keyPair = await generateTestKeyPair("signer-key-01");
    const signer = await createAccessReceiptSigner({ privateKey: keyPair.privateJwk });
    const token = await signer(validClaims());

    expect(token.split(".")).toHaveLength(3);
    expect(decodeProtectedHeader(token)).toEqual({
      alg: "EdDSA",
      typ: "JWT",
      kid: "signer-key-01",
    });
    expect(decodeJwt(token)).toEqual(validClaims());
  });

  it("preserves string and null payment_ref values in the signed payload", async () => {
    const keyPair = await generateTestKeyPair("signer-key-02");
    const signer = await createAccessReceiptSigner({ privateKey: keyPair.privateJwk });

    expect(decodeJwt(await signer(validClaims({ payment_ref: "payment_123" }))).payment_ref).toBe(
      "payment_123",
    );
    expect(decodeJwt(await signer(validClaims({ payment_ref: null }))).payment_ref).toBeNull();
  });

  it("accepts permitted private JWK metadata", async () => {
    const keyPair = await generateTestKeyPair("signer-key-metadata");
    const signer = await createAccessReceiptSigner({
      privateKey: {
        ...keyPair.privateJwk,
        alg: "EdDSA",
        use: "sig",
        key_ops: ["sign"],
      },
    });

    await expect(signer(validClaims())).resolves.toMatch(/^[^.]+\.[^.]+\.[^.]+$/u);
  });

  it("signs only canonical claims and strips unknown input properties", async () => {
    const keyPair = await generateTestKeyPair("signer-key-03");
    const signer = await createAccessReceiptSigner({ privateKey: keyPair.privateJwk });
    const claims = {
      ...validClaims(),
      unknown_sensitive_claim: "must-not-be-signed",
    };

    const payload = decodeJwt(await signer(asRuntimeInput(claims)));

    expect(Object.keys(payload).sort()).toEqual(publicClaimKeys());
    expect(payload).not.toHaveProperty("unknown_sensitive_claim");
  });

  it.each([
    ["missing config", undefined],
    ["null config", null],
    ["array config", []],
    ["missing private key", {}],
    ["null private key", { privateKey: null }],
    ["array private key", { privateKey: [] }],
  ])("rejects %s", async (_label, config) => {
    await configurationFailure(config);
  });

  it.each([
    ["wrong kty", { kty: "EC" }],
    ["wrong curve", { crv: "X25519" }],
    ["empty kid", { kid: "" }],
    ["empty x", { x: "" }],
    ["empty d", { d: "" }],
    ["malformed x", { x: "not-base64url!" }],
    ["malformed d", { d: "not-base64url!" }],
    ["conflicting alg", { alg: "RS256" }],
    ["conflicting use", { use: "enc" }],
    ["unsupported key operations", { key_ops: ["encrypt"] }],
  ])("rejects private key configuration with %s", async (_label, override) => {
    const keyPair = await generateTestKeyPair("signer-key-invalid");
    await configurationFailure({
      privateKey: { ...keyPair.privateJwk, ...override },
    });
  });

  it.each([
    ["verify-only", ["verify"]],
    ["empty", []],
    ["conflicting", ["sign", "encrypt"]],
    ["malformed", "sign"],
  ])("rejects private key with %s key_ops metadata", async (_label, keyOps) => {
    const keyPair = await generateTestKeyPair("signer-key-ops");
    const error = await configurationFailure({
      privateKey: { ...keyPair.privateJwk, key_ops: keyOps },
    });

    expect(error.issues).toEqual([
      { path: ["privateKey", "key_ops"], reason: "unsupported key operations" },
    ]);
  });

  it("rejects a public-only JWK and caller-controlled algorithm settings", async () => {
    const keyPair = await generateTestKeyPair("signer-key-public-only");
    const publicOnly = { ...keyPair.publicJwk };
    await configurationFailure({ privateKey: publicOnly });
    await configurationFailure({ privateKey: keyPair.privateJwk, algorithm: "RS256" });
  });

  it("does not expose private configuration values in configuration errors", async () => {
    const keyPair = await generateTestKeyPair("signer-key-secret");
    const error = await configurationFailure({
      privateKey: { ...keyPair.privateJwk, d: "bad-private-material" },
    });

    expect(error.name).toBe("AccessReceiptConfigurationError");
    expect(error.message).toBe("Invalid access receipt configuration.");
    expect(JSON.stringify(error)).not.toContain("bad-private-material");
    expect(JSON.stringify(error)).not.toContain(keyPair.privateJwk.d as string);
  });

  it("rejects an inconsistent private x and d pair without exposing key material", async () => {
    const firstKey = await generateTestKeyPair("signer-key-x");
    const secondKey = await generateTestKeyPair("signer-key-d");
    const inconsistentPrivateJwk = {
      ...secondKey.privateJwk,
      x: firstKey.publicJwk.x,
      kid: "signer-key-inconsistent",
    };

    const error = await configurationFailure({ privateKey: inconsistentPrivateJwk });
    const serialised = JSON.stringify(error);

    expect(error.name).toBe("AccessReceiptConfigurationError");
    expect(serialised).not.toContain(firstKey.publicJwk.x as string);
    expect(serialised).not.toContain(secondKey.privateJwk.d as string);
    expect(serialised).not.toContain("signer-key-inconsistent");
  });

  it.each([
    ["missing claim", { payment_ref: undefined }],
    ["invalid grant relationship", { grant_type: "single_redemption", max_redemptions: 2 }],
    ["invalid time ordering", { iat: 2, nbf: 1, exp: 3 }],
    ["unsafe time value", { exp: Number.MAX_SAFE_INTEGER + 1 }],
  ])("rejects %s with AccessReceiptValidationError", async (_label, override) => {
    const keyPair = await generateTestKeyPair("signer-key-claims");
    const signer = await createAccessReceiptSigner({ privateKey: keyPair.privateJwk });

    await expect(signer(asRuntimeInput(validClaims(override)))).rejects.toBeInstanceOf(
      AccessReceiptValidationError,
    );
  });

  it("does not expose a caller header override", async () => {
    const keyPair = await generateTestKeyPair("signer-key-header");
    const error = await configurationFailure({
      privateKey: keyPair.privateJwk,
      protectedHeader: { alg: "none", typ: "JWT", kid: "attacker" },
    });

    expect(error.issues).toEqual([
      { path: ["protectedHeader"], reason: "unsupported configuration" },
    ]);
  });
});
