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

  const expected: access.AccessReceiptExpectedBindings = {
    sub: verified.sub,
    resource_id: verified.resource_id,
    policy_id: verified.policy_id,
    intent_id: verified.intent_id,
    max_redemptions: verified.max_redemptions,
  };
  const matched: access.AccessReceiptBindingResult = access.evaluateAccessReceiptBindings(
    verified,
    expected,
  );

  if (matched.status === "matched") {
    const matchedStatus: "matched" = matched.status;
    void matchedStatus;
  } else {
    const deniedPhase: "binding" = matched.phase;
    void deniedPhase;
    throw new Error("Expected the TypeScript binding to match.");
  }

  const denied = access.evaluateAccessReceiptBindings(verified, {
    ...expected,
    resource_id: "course/other-module",
  });

  if (denied.status !== "binding_denied" || denied.phase !== "binding") {
    throw new Error("Expected the TypeScript binding denial.");
  }

  const command: access.AccessReceiptConsumeCommand = {
    jti: verified.jti,
    iss: verified.iss,
    sub: verified.sub,
    aud: verified.aud,
    intent_id: verified.intent_id,
    resource_id: verified.resource_id,
    policy_id: verified.policy_id,
    grant_type: verified.grant_type,
    max_redemptions: verified.max_redemptions,
    exp: verified.exp,
    current_time: now,
    expected_max_redemptions: verified.max_redemptions,
  };

  const representableOutcomes = [
    { outcome: "consumed", exhausted: false },
    { outcome: "consumed", exhausted: true },
    { outcome: "receipt_missing" },
    { outcome: "receipt_revoked" },
    { outcome: "receipt_exhausted" },
    { outcome: "receipt_expired" },
    { outcome: "authority_mismatch" },
    { outcome: "concurrency_conflict" },
    { outcome: "system_failure" },
  ] satisfies readonly access.AccessReceiptConsumeResult[];
  void representableOutcomes;

  const store: access.AccessReceiptStore = {
    async consume(receivedCommand) {
      const sameJti: string = receivedCommand.jti;
      void sameJti;
      return { outcome: "consumed", exhausted: false };
    },
  };
  const consumeResult: access.AccessReceiptConsumeResult = await store.consume(command);

  if (consumeResult.outcome === "consumed") {
    if (consumeResult.exhausted) {
      const exhausted: true = consumeResult.exhausted;
      void exhausted;
    } else {
      const remaining: false = consumeResult.exhausted;
      void remaining;
    }
  }
};

void run();

const typeProofCommand: access.AccessReceiptConsumeCommand = {
  jti: "jti_typescript_01",
  iss: "https://access.example.test",
  sub: "user_42",
  aud: "protected-api",
  intent_id: "intent_typescript_01",
  resource_id: "course/module-1",
  policy_id: "policy_single_access_v1",
  grant_type: "single_redemption",
  max_redemptions: 1,
  exp: 123,
  current_time: 100,
};

// @ts-expect-error: jti is a required receipt identity field.
const commandMissingJti: access.AccessReceiptConsumeCommand = {
  iss: "https://access.example.test",
  sub: "user_42",
  aud: "protected-api",
  intent_id: "intent_typescript_01",
  resource_id: "course/module-1",
  policy_id: "policy_single_access_v1",
  grant_type: "single_redemption",
  max_redemptions: 1,
  exp: 123,
  current_time: 100,
};
void commandMissingJti;

// @ts-expect-error: current_time is a required trusted execution field.
const commandMissingCurrentTime: access.AccessReceiptConsumeCommand = {
  jti: "jti_typescript_01",
  iss: "https://access.example.test",
  sub: "user_42",
  aud: "protected-api",
  intent_id: "intent_typescript_01",
  resource_id: "course/module-1",
  policy_id: "policy_single_access_v1",
  grant_type: "single_redemption",
  max_redemptions: 1,
  exp: 123,
};
void commandMissingCurrentTime;

const commandWithToken: access.AccessReceiptConsumeCommand = {
  ...typeProofCommand,
  // @ts-expect-error: raw tokens are not part of the store command.
  token: "untrusted-token",
};
void commandWithToken;

const commandWithPaymentRef: access.AccessReceiptConsumeCommand = {
  ...typeProofCommand,
  // @ts-expect-error: payment_ref is not part of the store command.
  payment_ref: "payment-correlation",
};
void commandWithPaymentRef;

const storeWithNonPromiseConsume: access.AccessReceiptStore = {
  // @ts-expect-error: consume must return a Promise.
  consume(receivedCommand) {
    void receivedCommand;
    return { outcome: "consumed", exhausted: false };
  },
};
void storeWithNonPromiseConsume;

const invalidConsumeOutcome = {
  // @ts-expect-error: the outcome must be one of the approved store outcomes.
  outcome: "not-an-approved-outcome",
} satisfies access.AccessReceiptConsumeResult;
void invalidConsumeOutcome;

// @ts-expect-error: consumed results must include the exhausted discriminator.
const consumedWithoutExhausted: access.AccessReceiptConsumeResult = {
  outcome: "consumed",
};
void consumedWithoutExhausted;

const generalBoolean = Math.random() > 0.5;
// TypeScript permits boolean here because true | false collapses to boolean
// for assignability; exact literal narrowing is proven in the valid branch above.
const consumedWithGeneralBoolean = {
  outcome: "consumed",
  exhausted: generalBoolean,
} satisfies access.AccessReceiptConsumeResult;
void consumedWithGeneralBoolean;

const invalidBindingStatus = {
  // @ts-expect-error: binding results expose only the approved status literals.
  status: "not-a-binding-status",
  phase: "binding",
} satisfies access.AccessReceiptBindingResult;
void invalidBindingStatus;

const invalidBindingPhase = {
  status: "binding_denied",
  // @ts-expect-error: binding denial has exactly the binding phase literal.
  phase: "not-binding",
} satisfies access.AccessReceiptBindingResult;
void invalidBindingPhase;

const denialWithoutExhausted: Exclude<access.AccessReceiptConsumeResult, { outcome: "consumed" }> = {
  outcome: "receipt_missing",
};
// @ts-expect-error: denial outcomes do not expose exhausted.
const denialExhausted: boolean = denialWithoutExhausted.exhausted;
void denialExhausted;
