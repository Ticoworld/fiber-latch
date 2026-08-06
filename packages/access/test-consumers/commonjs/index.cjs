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

  const matched = access.evaluateAccessReceiptBindings(verified, {
    sub: verified.sub,
    resource_id: verified.resource_id,
    policy_id: verified.policy_id,
    intent_id: verified.intent_id,
  });

  if (JSON.stringify(matched) !== JSON.stringify({ status: "matched" })) {
    throw new Error("Expected the packed CommonJS binding to match.");
  }

  const denied = access.evaluateAccessReceiptBindings(verified, {
    sub: verified.sub,
    resource_id: "course/other-module",
    policy_id: verified.policy_id,
    intent_id: verified.intent_id,
  });

  if (JSON.stringify(denied) !== JSON.stringify({ status: "binding_denied", phase: "binding" })) {
    throw new Error("Expected the packed CommonJS binding denial.");
  }

  let consumeCalls = 0;
  const store = {
    async consume(command) {
      consumeCalls += 1;
      if (command.jti !== verified.jti) {
        throw new Error("Unexpected redemption command.");
      }
      return consumeCalls === 1
        ? { outcome: "consumed", exhausted: false }
        : { outcome: "receipt_exhausted" };
    },
  };

  const redemptionSuccess = await access.redeemAccessReceipt({
    token: await signer(claims),
    expected: {
      sub: verified.sub,
      resource_id: verified.resource_id,
      policy_id: verified.policy_id,
      intent_id: verified.intent_id,
    },
    verifier,
    store,
    current_time: now,
  });

  if (JSON.stringify(redemptionSuccess) !== JSON.stringify({ status: "success", exhausted: false })) {
    throw new Error("Expected the packed CommonJS redemption success.");
  }

  const redemptionDenial = await access.redeemAccessReceipt({
    token: await signer(claims),
    expected: {
      sub: verified.sub,
      resource_id: verified.resource_id,
      policy_id: verified.policy_id,
      intent_id: verified.intent_id,
    },
    verifier,
    store,
    current_time: now,
  });

  if (JSON.stringify(redemptionDenial) !== JSON.stringify({
    status: "consumption_denied",
    phase: "consumption",
    reason: "receipt_exhausted",
  })) {
    throw new Error("Expected the packed CommonJS redemption denial.");
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
