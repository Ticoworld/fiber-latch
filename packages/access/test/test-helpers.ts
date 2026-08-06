import { base64url, exportJWK, generateKeyPair, importJWK, SignJWT } from "jose";
import type { JWK, JWTHeaderParameters, JWTPayload } from "jose";

import type {
  AccessReceiptJwk,
  BuildAccessReceiptClaimsInput,
} from "../src/index.js";

export interface TestKeyPair {
  readonly privateJwk: AccessReceiptJwk;
  readonly publicJwk: AccessReceiptJwk;
}

export async function generateTestKeyPair(kid: string): Promise<TestKeyPair> {
  const { privateKey, publicKey } = await generateKeyPair("EdDSA", { extractable: true });

  return {
    privateJwk: {
      ...(await exportJWK(privateKey)),
      alg: "EdDSA",
      kid,
    },
    publicJwk: {
      ...(await exportJWK(publicKey)),
      alg: "EdDSA",
      kid,
    },
  };
}

export function validClaims(overrides: Record<string, unknown> = {}): BuildAccessReceiptClaimsInput {
  const now = Math.floor(Date.now() / 1000);

  return {
    iss: "https://access.example.test",
    sub: "user_42",
    aud: "protected-api",
    iat: now - 30,
    nbf: now - 20,
    exp: now + 300,
    jti: "jti_test_01",
    intent_id: "intent_test_01",
    resource_id: "course/module-1",
    policy_id: "policy_single_access_v1",
    payment_ref: "payment_ref_test_01",
    grant_type: "single_redemption",
    max_redemptions: 1,
    ...overrides,
  } as BuildAccessReceiptClaimsInput;
}

export async function signPayload(
  privateJwk: AccessReceiptJwk,
  payload: Record<string, unknown>,
  protectedHeader: Record<string, unknown> = {
    alg: "EdDSA",
    typ: "JWT",
    kid: privateJwk.kid,
  },
): Promise<string> {
  const key = await importJWK(privateJwk as JWK, "EdDSA");

  return new SignJWT(payload as JWTPayload)
    .setProtectedHeader(protectedHeader as JWTHeaderParameters)
    .sign(key);
}

export function replaceProtectedHeader(
  token: string,
  protectedHeader: Record<string, unknown>,
): string {
  const [, payload, signature] = token.split(".");
  const encodedHeader = base64url.encode(
    new TextEncoder().encode(JSON.stringify(protectedHeader)),
  );

  return `${encodedHeader}.${payload}.${signature}`;
}

export function asRuntimeInput(value: unknown): never {
  return value as never;
}

export function publicClaimKeys(): string[] {
  return [
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
  ];
}
