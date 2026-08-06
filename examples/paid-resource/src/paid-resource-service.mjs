import { randomUUID, webcrypto } from "node:crypto";

import {
  buildAccessReceiptClaims,
  createAccessReceiptSigner,
  createAccessReceiptVerifier,
  redeemAccessReceipt,
} from "@fiberlatch/access";

export const VERIFIED_PAYMENT_FIXTURE_ID = "demo-payment-001";
export const DEMO_KEY_ID = "paid-resource-demo-key";
export const DEMO_ISSUER = "https://paid-resource.example.test";
export const DEMO_AUDIENCE = "paid-resource-example";
export const RECEIPT_LIFETIME_SECONDS = 300;
export const PROTECTED_RESOURCE_CONTENT =
  "Premium article content available after one verified payment.";

const VERIFIED_PAYMENT_FIXTURES = new Map([
  [
    VERIFIED_PAYMENT_FIXTURE_ID,
    Object.freeze({
      payment_ref: VERIFIED_PAYMENT_FIXTURE_ID,
      sub: "demo-user",
      intent_id: "demo-intent-001",
      resource_id: "premium-article",
      policy_id: "single-use-access",
    }),
  ],
]);

export const HOST_EXPECTED_BINDINGS = Object.freeze({
  sub: "demo-user",
  resource_id: "premium-article",
  policy_id: "single-use-access",
  intent_id: "demo-intent-001",
  max_redemptions: 1,
});

const AUTHORITY_FIELDS = [
  "jti",
  "iss",
  "sub",
  "aud",
  "intent_id",
  "resource_id",
  "policy_id",
  "grant_type",
  "max_redemptions",
  "exp",
];

function authorityFromClaims(claims) {
  return Object.fromEntries(AUTHORITY_FIELDS.map((field) => [field, claims[field]]));
}

function authorityMatches(command, authority) {
  return AUTHORITY_FIELDS.every((field) => command[field] === authority[field]);
}

export function verifyPaymentFixture(fixtureId) {
  if (typeof fixtureId !== "string") {
    return null;
  }

  const fixture = VERIFIED_PAYMENT_FIXTURES.get(fixtureId);
  return fixture ? { ...fixture } : null;
}

export class DemoAccessReceiptStore {
  #records = new Map();
  #consumeCalls = 0;

  registerIssuedReceipt(claims) {
    if (this.#records.has(claims.jti)) {
      throw new Error("Receipt identity is already registered.");
    }

    this.#records.set(claims.jti, {
      authority: authorityFromClaims(claims),
      expiresAt: claims.exp,
      redemptionCount: 0,
      revoked: false,
      exhausted: false,
    });
  }

  async consume(command) {
    this.#consumeCalls += 1;
    const record = this.#records.get(command.jti);

    if (!record) {
      return { outcome: "receipt_missing" };
    }

    if (!authorityMatches(command, record.authority)) {
      return { outcome: "authority_mismatch" };
    }

    if (
      command.expected_max_redemptions !== undefined &&
      command.expected_max_redemptions !== record.authority.max_redemptions
    ) {
      return { outcome: "authority_mismatch" };
    }

    if (record.revoked) {
      return { outcome: "receipt_revoked" };
    }

    if (command.current_time >= record.expiresAt) {
      return { outcome: "receipt_expired" };
    }

    const persistedLimit = record.authority.max_redemptions;
    if (record.exhausted || record.redemptionCount >= persistedLimit) {
      return { outcome: "receipt_exhausted" };
    }

    const nextRedemptionCount = record.redemptionCount + 1;
    record.redemptionCount = nextRedemptionCount;
    record.exhausted = nextRedemptionCount >= persistedLimit;

    return { outcome: "consumed", exhausted: record.exhausted };
  }

  revoke(jti) {
    const record = this.#records.get(jti);
    if (record) {
      record.revoked = true;
    }
  }

  expire(jti) {
    const record = this.#records.get(jti);
    if (record) {
      record.expiresAt = 0;
    }
  }

  tamperAuthorityForTest(jti, changes) {
    const record = this.#records.get(jti);
    if (record) {
      record.authority = { ...record.authority, ...changes };
    }
  }

  get consumeCalls() {
    return this.#consumeCalls;
  }

  getPersistedStateForTest(jti) {
    const record = this.#records.get(jti);
    return record ? structuredClone(record) : null;
  }
}

async function generateDemoKeys() {
  const keyPair = await webcrypto.subtle.generateKey(
    { name: "Ed25519" },
    true,
    ["sign", "verify"],
  );
  const privateKey = {
    ...(await webcrypto.subtle.exportKey("jwk", keyPair.privateKey)),
    alg: "EdDSA",
    kid: DEMO_KEY_ID,
  };
  const publicKey = {
    ...(await webcrypto.subtle.exportKey("jwk", keyPair.publicKey)),
    alg: "EdDSA",
    kid: DEMO_KEY_ID,
  };

  return { privateKey, publicKey };
}

export async function createPaidResourceService({ clock = () => Date.now() / 1000 } = {}) {
  const { privateKey, publicKey } = await generateDemoKeys();
  const signer = await createAccessReceiptSigner({ privateKey });
  const verifier = await createAccessReceiptVerifier({
    publicKeys: [publicKey],
    issuer: DEMO_ISSUER,
    audience: DEMO_AUDIENCE,
  });
  const store = new DemoAccessReceiptStore();
  const expectedBindings = { ...HOST_EXPECTED_BINDINGS };

  function currentTime() {
    return Math.floor(clock());
  }

  async function issueReceipt(paymentFixtureId) {
    const verifiedPayment = verifyPaymentFixture(paymentFixtureId);
    if (!verifiedPayment) {
      return { status: "payment_not_verified" };
    }

    const issuedAt = currentTime();
    const claims = buildAccessReceiptClaims({
      iss: DEMO_ISSUER,
      sub: verifiedPayment.sub,
      aud: DEMO_AUDIENCE,
      iat: issuedAt,
      nbf: issuedAt,
      exp: issuedAt + RECEIPT_LIFETIME_SECONDS,
      jti: randomUUID(),
      intent_id: verifiedPayment.intent_id,
      resource_id: verifiedPayment.resource_id,
      policy_id: verifiedPayment.policy_id,
      payment_ref: verifiedPayment.payment_ref,
      grant_type: "single_redemption",
      max_redemptions: 1,
    });
    const receipt = await signer(claims);

    store.registerIssuedReceipt(claims);
    return { status: "issued", receipt };
  }

  async function redeemReceipt(token, bindings = expectedBindings) {
    return redeemAccessReceipt({
      token,
      expected: bindings,
      verifier,
      store,
      current_time: currentTime(),
    });
  }

  return Object.freeze({
    expectedBindings,
    issueReceipt,
    redeemReceipt,
    store,
    verifier,
  });
}
