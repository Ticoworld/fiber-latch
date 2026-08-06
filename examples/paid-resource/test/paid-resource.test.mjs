import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import {
  PROTECTED_RESOURCE_CONTENT,
  VERIFIED_PAYMENT_FIXTURE_ID,
  createPaidResourceService,
} from "../src/paid-resource-service.mjs";
import { startPaidResourceServer } from "../src/server.mjs";

let instance;

async function requestJson(url, options) {
  const response = await fetch(url, options);
  return { response, body: await response.json() };
}

async function issueReceipt(target = instance) {
  return requestJson(`${target.url}/receipt`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ payment_fixture_id: VERIFIED_PAYMENT_FIXTURE_ID }),
  });
}

async function accessResource(receipt, target = instance) {
  return requestJson(`${target.url}/resource`, {
    headers: { authorization: `Bearer ${receipt}` },
  });
}

async function verifiedClaims(target, receipt) {
  return target.service.verifier(receipt);
}

before(async () => {
  instance = await startPaidResourceServer();
});

after(async () => {
  await instance.close();
});

test("verified payment fixture issues a single-use receipt", async () => {
  const issued = await issueReceipt();

  assert.equal(issued.response.status, 201);
  assert.equal(typeof issued.body.receipt, "string");
  const claims = await verifiedClaims(instance, issued.body.receipt);
  assert.equal(claims.sub, "demo-user");
  assert.equal(claims.intent_id, "demo-intent-001");
  assert.equal(claims.resource_id, "premium-article");
  assert.equal(claims.grant_type, "single_redemption");
  assert.equal(claims.max_redemptions, 1);
});

test("unknown payment fixture is rejected before receipt issuance", async () => {
  const rejected = await requestJson(`${instance.url}/receipt`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ payment_fixture_id: "not-a-verified-payment" }),
  });

  assert.equal(rejected.response.status, 403);
  assert.deepEqual(rejected.body, { error: "payment_not_verified" });
});

test("first protected access succeeds", async () => {
  const issued = await issueReceipt();
  const access = await accessResource(issued.body.receipt);

  assert.equal(access.response.status, 200);
  assert.equal(access.body.content, PROTECTED_RESOURCE_CONTENT);
});

test("replay of a single-use receipt is denied without content", async () => {
  const issued = await issueReceipt();
  const first = await accessResource(issued.body.receipt);
  const replay = await accessResource(issued.body.receipt);

  assert.equal(first.response.status, 200);
  assert.equal(replay.response.status, 403);
  assert.deepEqual(replay.body, { error: "access_denied" });
  assert.equal(JSON.stringify(replay.body).includes(PROTECTED_RESOURCE_CONTENT), false);
});

test("two concurrent protected requests allow exactly one single-use redemption", async () => {
  const concurrentInstance = await startPaidResourceServer();

  try {
    const issued = await issueReceipt(concurrentInstance);
    const responses = await Promise.all([
      accessResource(issued.body.receipt, concurrentInstance),
      accessResource(issued.body.receipt, concurrentInstance),
    ]);
    const successes = responses.filter(({ response }) => response.status === 200);
    const denials = responses.filter(({ response }) => response.status === 403);

    assert.equal(successes.length, 1);
    assert.equal(denials.length, 1);
    assert.equal(concurrentInstance.service.store.consumeCalls, 2);
    assert.equal(denials[0].body.error, "access_denied");
  } finally {
    await concurrentInstance.close();
  }
});

test("tampered receipt is denied without protected content", async () => {
  const issued = await issueReceipt();
  const receipt = issued.body.receipt;
  const segments = receipt.split(".");
  const replacement = segments[1][0] === "A" ? "B" : "A";
  const tampered = `${segments[0]}.${replacement}${segments[1].slice(1)}.${segments[2]}`;
  const access = await accessResource(tampered);

  assert.equal(access.response.status, 403);
  assert.deepEqual(access.body, { error: "access_denied" });
  assert.equal(JSON.stringify(access.body).includes(PROTECTED_RESOURCE_CONTENT), false);
});

test("wrong host binding is denied before the store is called", async () => {
  const target = await createPaidResourceService();
  const issued = await target.issueReceipt(VERIFIED_PAYMENT_FIXTURE_ID);
  const result = await target.redeemReceipt(issued.receipt, {
    ...target.expectedBindings,
    resource_id: "another-resource",
  });

  assert.deepEqual(result, { status: "binding_denied", phase: "binding" });
  assert.equal(target.store.consumeCalls, 0);
});

test("persisted authority mismatch is denied", async () => {
  const target = await createPaidResourceService();
  const issued = await target.issueReceipt(VERIFIED_PAYMENT_FIXTURE_ID);
  const claims = await target.verifier(issued.receipt);
  target.store.tamperAuthorityForTest(claims.jti, { resource_id: "persisted-resource" });

  const result = await target.redeemReceipt(issued.receipt);

  assert.deepEqual(result, {
    status: "consumption_denied",
    phase: "consumption",
    reason: "authority_mismatch",
  });
});

test("expired persisted receipt is denied", async () => {
  const target = await createPaidResourceService();
  const issued = await target.issueReceipt(VERIFIED_PAYMENT_FIXTURE_ID);
  const claims = await target.verifier(issued.receipt);
  target.store.expire(claims.jti);

  const result = await target.redeemReceipt(issued.receipt);

  assert.deepEqual(result, {
    status: "consumption_denied",
    phase: "consumption",
    reason: "receipt_expired",
  });
});

test("host-revoked receipt is denied", async () => {
  const target = await createPaidResourceService();
  const issued = await target.issueReceipt(VERIFIED_PAYMENT_FIXTURE_ID);
  const claims = await target.verifier(issued.receipt);
  target.store.revoke(claims.jti);

  const result = await target.redeemReceipt(issued.receipt);

  assert.deepEqual(result, {
    status: "consumption_denied",
    phase: "consumption",
    reason: "receipt_revoked",
  });
});

test("denial responses expose no receipt, claims, key, or store details", async () => {
  const issued = await issueReceipt();
  const claims = await verifiedClaims(instance, issued.body.receipt);
  const firstAccess = await accessResource(issued.body.receipt);
  const state = instance.service.store.getPersistedStateForTest(claims.jti);
  const denial = await accessResource(issued.body.receipt);

  assert.equal(firstAccess.response.status, 200);
  assert.equal(denial.response.status, 403);
  assert.deepEqual(denial.body, { error: "access_denied" });
  assert.equal(JSON.stringify(denial.body).includes(issued.body.receipt), false);
  assert.equal(JSON.stringify(denial.body).includes(claims.jti), false);
  assert.equal(JSON.stringify(denial.body).includes("privateKey"), false);
  assert.equal("token" in state, false);
  assert.equal("payment_ref" in state.authority, false);
  assert.equal(JSON.stringify(state).includes(issued.body.receipt), false);
});

test("the example server shuts down cleanly", async () => {
  const target = await startPaidResourceServer();
  await target.close();
  assert.equal(target.server.listening, false);
});
