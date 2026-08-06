const access = require("@fiberlatch/access");
const { generateKeyPairSync } = require("node:crypto");

async function main() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const privateJwk = {
    ...privateKey.export({ format: "jwk" }),
    alg: "EdDSA",
    kid: "consumer-commonjs-key",
  };
  const publicJwk = {
    ...publicKey.export({ format: "jwk" }),
    alg: "EdDSA",
    kid: "consumer-commonjs-key",
  };
  const now = Math.floor(Date.now() / 1000);

  const claims = access.buildAccessReceiptClaims({
    iss: "https://access.example.test",
    sub: "user_42",
    aud: "protected-api",
    iat: now - 30,
    nbf: now - 20,
    exp: now + 300,
    jti: "jti_commonjs_01",
    intent_id: "intent_commonjs_01",
    resource_id: "course/module-1",
    policy_id: "policy_single_access_v1",
    payment_ref: "payment_ref_commonjs_01",
    grant_type: "single_redemption",
    max_redemptions: 1,
  });

  const signer = await access.createAccessReceiptSigner({ privateKey: privateJwk });
  const verifier = await access.createAccessReceiptVerifier({
    publicKeys: [publicJwk],
    issuer: "https://access.example.test",
    audience: "protected-api",
  });
  const verified = await verifier(await signer(claims));

  if (verified.payment_ref !== "payment_ref_commonjs_01") {
    throw new Error("Expected the payment reference to be preserved.");
  }
}

if (typeof access !== "object" || access === null) {
  throw new Error("Expected the package namespace to be an object.");
}

if (Object.getPrototypeOf(access) !== null) {
  throw new Error("Expected a namespace object returned by require(esm).");
}

if ("default" in access) {
  throw new Error("Expected no default export in the package.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
