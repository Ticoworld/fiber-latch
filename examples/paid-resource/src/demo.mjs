import assert from "node:assert/strict";

import { VERIFIED_PAYMENT_FIXTURE_ID } from "./paid-resource-service.mjs";
import { startPaidResourceServer } from "./server.mjs";

async function jsonRequest(url, options) {
  const response = await fetch(url, options);
  const body = await response.json();
  return { response, body };
}

async function main() {
  const instance = await startPaidResourceServer();

  try {
    const issued = await jsonRequest(`${instance.url}/receipt`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ payment_fixture_id: VERIFIED_PAYMENT_FIXTURE_ID }),
    });
    assert.equal(issued.response.status, 201);
    assert.equal(typeof issued.body.receipt, "string");
    console.log("payment fixture accepted");
    console.log("receipt issued");

    const firstAccess = await jsonRequest(`${instance.url}/resource`, {
      headers: { authorization: `Bearer ${issued.body.receipt}` },
    });
    assert.equal(firstAccess.response.status, 200);
    assert.equal(typeof firstAccess.body.content, "string");
    console.log("first protected access allowed");

    const secondAccess = await jsonRequest(`${instance.url}/resource`, {
      headers: { authorization: `Bearer ${issued.body.receipt}` },
    });
    assert.equal(secondAccess.response.status, 403);
    assert.deepEqual(secondAccess.body, { error: "access_denied" });
    console.log("second use denied");
    console.log("demo passed");
  } finally {
    await instance.close();
  }
}

main().catch((error) => {
  console.error(`demo failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
