import * as access from "@fiberlatch/access";

const run = async (): Promise<void> => {
  const generated = (await globalThis.crypto.subtle.generateKey(
    { name: "Ed25519" } as AlgorithmIdentifier,
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;
  const privateJwk: access.AccessReceiptJwk = {
    ...(await globalThis.crypto.subtle.exportKey("jwk", generated.privateKey)),
    alg: "EdDSA",
    kid: "consumer-typescript-key",
  };
  const publicJwk: access.AccessReceiptJwk = {
    ...(await globalThis.crypto.subtle.exportKey("jwk", generated.publicKey)),
    alg: "EdDSA",
    kid: "consumer-typescript-key",
  };
  const now = Math.floor(Date.now() / 1000);
  const input: access.BuildAccessReceiptClaimsInput = {
    iss: "https://access.example.test",
    sub: "user_42",
    aud: "protected-api",
    iat: now - 30,
    nbf: now - 20,
    exp: now + 300,
    jti: "jti_typescript_01",
    intent_id: "intent_typescript_01",
    resource_id: "course/module-1",
    policy_id: "policy_single_access_v1",
    payment_ref: null,
    grant_type: "single_redemption",
    max_redemptions: 1,
  };
  const claims: access.AccessReceiptClaims = access.buildAccessReceiptClaims(input);

  const signerPromise: Promise<access.AccessReceiptSigner> = access.createAccessReceiptSigner({
    privateKey: privateJwk,
  });
  const verifierPromise: Promise<access.AccessReceiptVerifier> = access.createAccessReceiptVerifier({
    publicKeys: [publicJwk],
    issuer: "https://access.example.test",
    audience: "protected-api",
  });
  const signer = await signerPromise;
  const verifier = await verifierPromise;
  const token: string = await signer(claims);
  const verified: access.AccessReceiptClaims = await verifier(token);

  if (verified.payment_ref !== null || verified.sub !== "user_42") {
    throw new Error("Expected the TypeScript sign-and-verify round trip to preserve claims.");
  }
};

void run();
