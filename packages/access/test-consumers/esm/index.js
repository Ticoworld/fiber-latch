import * as access from "@fiberlatch/access";
import { generateKeyPairSync } from "node:crypto";

const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const privateJwk = {
  ...privateKey.export({ format: "jwk" }),
  alg: "EdDSA",
  kid: "consumer-esm-key",
};
const publicJwk = {
  ...publicKey.export({ format: "jwk" }),
  alg: "EdDSA",
  kid: "consumer-esm-key",
};
const now = Math.floor(Date.now() / 1000);

const claims = access.buildAccessReceiptClaims({
  iss: "https://access.example.test",
  sub: "user_42",
  aud: "protected-api",
  iat: now - 30,
  nbf: now - 20,
  exp: now + 300,
  jti: "jti_esm_01",
  intent_id: "intent_esm_01",
  resource_id: "course/module-1",
  policy_id: "policy_single_access_v1",
  payment_ref: null,
  grant_type: "single_redemption",
  max_redemptions: 1,
});

if (claims.grant_type !== "single_redemption") {
  throw new Error("Expected a single-redemption claim.");
}

const signer = await access.createAccessReceiptSigner({ privateKey: privateJwk });
const verifier = await access.createAccessReceiptVerifier({
  publicKeys: [publicJwk],
  issuer: "https://access.example.test",
  audience: "protected-api",
});
const token = await signer(claims);
const verified = await verifier(token);

if (verified.sub !== "user_42" || verified.payment_ref !== null) {
  throw new Error("Expected the sign-and-verify round trip to preserve claims.");
}

if (typeof access.AccessReceiptVerificationError !== "function") {
  throw new Error("Expected the verification error export.");
}

if (typeof access !== "object" || access === null) {
  throw new Error("Expected the package namespace to be an object.");
}

if (Object.getPrototypeOf(access) !== null) {
  throw new Error("Expected an ESM namespace object.");
}

if ("default" in access) {
  throw new Error("Expected no default export in the package.");
}
