import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import pg from "pg";
import type { AccessReceiptConsumeCommand, AccessReceiptStore } from "@fiberlatch/access";
import { createPostgresAccessReceiptStore } from "../src/index.js";
import { databaseUrl, safeErrorCode } from "../scripts/environment.mjs";

type Fixture = AccessReceiptConsumeCommand & {
  iat: number;
  nbf: number;
  redemption_count: number;
  revoked_at: string | null;
  payment_ref: string | null;
};

const created: string[] = [];
const results: { name: string; passed: boolean }[] = [];
const races: { attempts: number; successes: number; denials: number; final_count: string; maximum: string }[] = [];
// Optional name substring for focused reruns of a changed acceptance case.
const caseFilter = process.argv[2];
let pool: pg.Pool | undefined;
let activeCase = "initialization";

async function run(name: string, test: () => Promise<void>) {
  if (caseFilter && !name.includes(caseFilter)) return;
  activeCase = name;
  try {
    await test();
    results.push({ name, passed: true });
    console.log(`PASS: ${name}`);
  } catch (error) {
    results.push({ name, passed: false });
    throw error;
  }
}

async function main() {
  pool = new pg.Pool({
    connectionString: databaseUrl(), max: 24,
    connectionTimeoutMillis: 20000, statement_timeout: 20000,
  });
  // Background transport errors must not dump connection metadata.
  pool.on("error", () => { process.exitCode = 1; });
  const db = pool;
  const store = createPostgresAccessReceiptStore((sql, values) => db.query(sql, [...values]));
  const epoch = async () => Number((await db.query("SELECT floor(extract(epoch FROM clock_timestamp()))::text AS now")).rows[0].now);

  async function fixture(overrides: Partial<Fixture> = {}): Promise<Fixture> {
    const now = await epoch();
    const row: Fixture = {
      jti: `postgres-proof-${randomUUID()}`, iss: "proof-issuer", sub: "proof-subject", aud: "proof-audience",
      intent_id: "proof-intent", resource_id: "proof-resource", policy_id: "proof-policy",
      grant_type: "multi_redemption", max_redemptions: 3,
      exp: now + 3600, current_time: now, iat: now - 20, nbf: now - 10,
      redemption_count: 0, revoked_at: null, payment_ref: null, ...overrides,
    };
    created.push(row.jti);
    await db.query(`INSERT INTO public.access_receipts (
      jti, iss, sub, aud, intent_id, resource_id, policy_id, grant_type,
      max_redemptions, exp, iat, nbf, redemption_count, revoked_at, payment_ref
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`, [
      row.jti, row.iss, row.sub, row.aud, row.intent_id, row.resource_id, row.policy_id,
      row.grant_type, row.max_redemptions, row.exp, row.iat, row.nbf,
      row.redemption_count, row.revoked_at, row.payment_ref,
    ]);
    return row;
  }

  async function count(row: Fixture) {
    const data = (await db.query(`SELECT redemption_count::text AS count, max_redemptions::text AS max
      FROM public.access_receipts WHERE jti=$1`, [row.jti])).rows[0];
    assert(BigInt(data.count) <= BigInt(data.max));
    return data.count as string;
  }

  async function denied(row: Fixture, command: AccessReceiptConsumeCommand, outcome: string, adapter = store) {
    const before = await count(row);
    assert.deepEqual(await adapter.consume(command), { outcome });
    assert.equal(await count(row), before, "denial changed the counter");
  }

  await run("Neon SELECT 1 and explicit table exists", async () => {
    assert.equal((await db.query("SELECT 1 AS ok")).rows[0].ok, 1);
    assert.equal((await db.query("SELECT to_regclass('public.access_receipts')::text AS name")).rows[0].name, "access_receipts");
  });

  for (const max of [1, 3, 10, 100]) {
    await run(`limit ${max}: final use allowed, next denied`, async () => {
      const row = await fixture({ max_redemptions: max, grant_type: max === 1 ? "single_redemption" : "multi_redemption" });
      for (let use = 1; use <= max; use++) {
        assert.deepEqual(await store.consume(row), { outcome: "consumed", exhausted: use === max });
        assert.equal(await count(row), String(use));
      }
      await denied(row, row, "receipt_exhausted");
    });
  }

  await run("missing receipt, including SQL-like JTI", async () => {
    const row = await fixture();
    assert.deepEqual(await store.consume({ ...row, jti: "missing-' OR true --" }), { outcome: "receipt_missing" });
    assert.equal(await count(row), "0");
  });

  for (const field of ["iss", "sub", "aud", "intent_id", "resource_id", "policy_id", "exp", "max_redemptions", "grant_type"] as const) {
    await run(`authority mismatch: ${field}`, async () => {
      const row = await fixture();
      const command = field === "grant_type" ? { ...row, grant_type: "single_redemption" as const, max_redemptions: 1 }
        : { ...row, [field]: typeof row[field] === "number" ? (row[field] as number) + 1 : `${row[field]}-different` };
      await denied(row, command, "authority_mismatch");
    });
  }

  await run("expected maximum mismatch", async () => {
    const row = await fixture();
    await denied(row, { ...row, expected_max_redemptions: 10 }, "authority_mismatch");
  });
  await run("matching expected maximum", async () => {
    const row = await fixture();
    assert.deepEqual(await store.consume({ ...row, expected_max_redemptions: 3 }), { outcome: "consumed", exhausted: false });
  });
  await run("revoked receipt", async () => {
    const row = await fixture({ revoked_at: new Date().toISOString() });
    await denied(row, row, "receipt_revoked");
  });
  await run("expiry at trusted host boundary", async () => {
    const row = await fixture();
    await denied(row, { ...row, current_time: row.exp }, "receipt_expired");
  });
  await run("database clock expiry with stale host time", async () => {
    const now = await epoch();
    const row = await fixture({ iat: now - 20, nbf: now - 10, exp: now - 1, current_time: now - 2 });
    await denied(row, row, "receipt_expired");
  });
  await run("not-before enforced against host time", async () => {
    const row = await fixture();
    await denied(row, { ...row, current_time: row.nbf - 1 }, "authority_mismatch");
  });
  await run("not-before enforced against database clock", async () => {
    const now = await epoch();
    const row = await fixture({ nbf: now + 60, current_time: now + 60 });
    await denied(row, row, "authority_mismatch");
  });
  await run("not-before equality allowed", async () => {
    const row = await fixture();
    assert.deepEqual(await store.consume({ ...row, current_time: row.nbf }), { outcome: "consumed", exhausted: false });
  });
  await run("already exhausted receipt", async () => {
    const row = await fixture({ redemption_count: 3 });
    await denied(row, row, "receipt_exhausted");
  });
  await run("full safe-integer quota: final use remains exact", async () => {
    const row = await fixture({ max_redemptions: Number.MAX_SAFE_INTEGER, redemption_count: Number.MAX_SAFE_INTEGER - 1, exp: Number.MAX_SAFE_INTEGER });
    assert.deepEqual(await store.consume(row), { outcome: "consumed", exhausted: true });
    assert.equal(await count(row), String(Number.MAX_SAFE_INTEGER));
    await denied(row, row, "receipt_exhausted");
  });
  await run("invalid command fails closed without database query", async () => {
    const row = await fixture();
    let calls = 0;
    const adapter = createPostgresAccessReceiptStore(async (sql, values) => { calls++; return db.query(sql, [...values]); });
    for (const bad of [
      { ...row, max_redemptions: Number.MAX_SAFE_INTEGER + 1 },
      { ...row, exp: NaN }, { ...row, current_time: -1 },
      { ...row, expected_max_redemptions: 0 }, { ...row, jti: "" },
      null as unknown as AccessReceiptConsumeCommand,
    ]) assert.deepEqual(await adapter.consume(bad), { outcome: "system_failure" });
    assert.equal(calls, 0);
    assert.equal(await count(row), "0");
  });

  for (const max of [1, 10, 100]) {
    await run(`24 concurrent final-slot contenders (max ${max})`, async () => {
      const row = await fixture({ max_redemptions: max, redemption_count: max - 1, grant_type: max === 1 ? "single_redemption" : "multi_redemption" });
      const clients: pg.PoolClient[] = [];
      try {
        // Acquire all connections first: no shared JS store/mutex or serial client queue.
        for (let i = 0; i < 24; i++) clients.push(await db.connect());
        const outcomes = await Promise.all(clients.map((client) =>
          createPostgresAccessReceiptStore((sql, values) => client.query(sql, [...values])).consume(row)));
        assert.equal(outcomes.filter((result) => result.outcome === "consumed").length, 1);
        assert.equal(outcomes.filter((result) => result.outcome === "receipt_exhausted").length, 23);
        assert.deepEqual(outcomes.find((result) => result.outcome === "consumed"), { outcome: "consumed", exhausted: true });
      } finally {
        for (const client of clients) client.release();
      }
      const final = await count(row);
      assert.equal(final, String(max));
      races.push({ attempts: 24, successes: 1, denials: 23, final_count: final, maximum: String(max) });
      console.log(`RACE: 24 attempts, 1 success, 23 denied, count=${final}/${max}`);
    });
  }

  await run("host transaction rollback and commit", async () => {
    const row = await fixture({ max_redemptions: 1, grant_type: "single_redemption" });
    const client = await db.connect();
    try {
      const adapter = createPostgresAccessReceiptStore((sql, values) => client.query(sql, [...values]));
      await client.query("BEGIN");
      assert.deepEqual(await adapter.consume(row), { outcome: "consumed", exhausted: true });
      assert.equal(await count(row), "0", "uncommitted use visible outside transaction");
      await client.query("ROLLBACK");
      assert.equal(await count(row), "0");
      await client.query("BEGIN");
      assert.deepEqual(await adapter.consume(row), { outcome: "consumed", exhausted: true });
      await client.query("COMMIT");
      assert.equal(await count(row), "1");
      await denied(row, row, "receipt_exhausted");
    } finally {
      await client.query("ROLLBACK").catch(() => {});
      client.release();
    }
  });

  async function waitForLock(pid: number) {
    for (let attempt = 0; attempt < 100; attempt++) {
      const status = (await db.query("SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1", [pid])).rows[0];
      if (status?.wait_event_type === "Lock") return;
      await delay(50);
    }
    throw new Error("contender did not demonstrably wait on a row lock");
  }

  async function withBlockedConsumer(row: Fixture, lockedWork: (holder: pg.PoolClient) => Promise<void>, releaseLock: () => Promise<void>, expected: string, beforeLock?: () => Promise<void>) {
    const holder = await db.connect();
    const waiter = await db.connect();
    let pending: ReturnType<AccessReceiptStore["consume"]> | undefined;
    try {
      await waiter.query("BEGIN");
      const pid = (await waiter.query("SELECT pg_backend_pid() AS pid")).rows[0].pid as number;
      if (beforeLock) await beforeLock();
      await holder.query("BEGIN");
      await lockedWork(holder);
      pending = createPostgresAccessReceiptStore((sql, values) => waiter.query(sql, [...values])).consume(row);
      await waitForLock(pid);
      await releaseLock();
      await holder.query("COMMIT");
      assert.deepEqual(await pending, { outcome: expected });
      await waiter.query("COMMIT");
      assert.equal(await count(row), "0");
    } finally {
      await holder.query("ROLLBACK").catch(() => {});
      if (pending) await pending;
      await waiter.query("ROLLBACK").catch(() => {});
      holder.release();
      waiter.release();
    }
  }

  await run("lock-only wait across expiry: stale request denied", async () => {
    const original = await fixture();
    const row = { ...original };
    await withBlockedConsumer(row,
      async (holder) => { await holder.query("SELECT jti FROM public.access_receipts WHERE jti=$1 FOR UPDATE", [row.jti]); },
      async () => {
        assert(await epoch() < row.exp, "expiry already passed before the observed lock wait");
        while (await epoch() < row.exp) await delay(100);
      },
      "receipt_expired",
      async () => {
        // Install the deadline after both connections/transaction are ready.
        // This update commits BEFORE the lock holder begins; the lock holder
        // itself never changes the row, exercising the lock-only expiry case.
        row.exp = (await epoch()) + 12;
        await db.query("UPDATE public.access_receipts SET exp=$2 WHERE jti=$1", [row.jti, row.exp]);
      });
  });
  await run("revocation committed while contender waits", async () => {
    const row = await fixture();
    await withBlockedConsumer(row,
      async (holder) => { await holder.query("UPDATE public.access_receipts SET revoked_at=clock_timestamp() WHERE jti=$1", [row.jti]); },
      async () => {}, "receipt_revoked");
  });

  await run("real SQL error fails closed with one execution", async () => {
    const row = await fixture();
    let calls = 0;
    const adapter = createPostgresAccessReceiptStore((sql, values) => {
      calls++;
      return db.query(sql.replaceAll("public.access_receipts", "public.nonexistent_postgres_proof_table"), [...values]);
    });
    await denied(row, row, "system_failure", adapter);
    assert.equal(calls, 1);
  });
  await run("serialization failure stays closed; host rolls back", async () => {
    const row = await fixture();
    const client = await db.connect();
    let calls = 0;
    try {
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
      await client.query("SELECT redemption_count FROM public.access_receipts WHERE jti=$1", [row.jti]);
      assert.deepEqual(await store.consume(row), { outcome: "consumed", exhausted: false });
      const adapter = createPostgresAccessReceiptStore((sql, values) => { calls++; return client.query(sql, [...values]); });
      assert.deepEqual(await adapter.consume(row), { outcome: "system_failure" });
      assert.equal(calls, 1);
      await assert.rejects(client.query("SELECT 1"), (error: unknown) => (error as { code: string }).code === "25P02");
      await client.query("ROLLBACK");
      assert.equal(await count(row), "1");
    } finally {
      await client.query("ROLLBACK").catch(() => {});
      client.release();
    }
  });
  await run("unknown/lost results after commit fail closed without retry", async () => {
    const invalidResponses = [
      { rows: [] }, { rows: [{ outcome: "unexpected", exhausted: null }] },
      { rows: [{ outcome: "consumed", exhausted: "true" }] },
      { rows: [{ outcome: "receipt_missing", exhausted: true }] },
      { rows: [{ outcome: "consumed", exhausted: true }, { outcome: "consumed", exhausted: true }] },
      null,
    ];
    for (const response of invalidResponses) {
      const row = await fixture({ max_redemptions: 1, grant_type: "single_redemption" });
      let calls = 0;
      const adapter = createPostgresAccessReceiptStore(async (sql, values) => {
        calls++;
        await db.query(sql, [...values]);
        if (response === null) throw new Error("response lost after committed transition");
        return response;
      });
      assert.deepEqual(await adapter.consume(row), { outcome: "system_failure" });
      assert.equal(calls, 1);
      assert.equal(await count(row), "1");
      await denied(row, row, "receipt_exhausted");
    }
  });

  await run("database constraints reject invalid neutral state", async () => {
    for (const invalid of [
      { redemption_count: -1 }, { redemption_count: 4 }, { max_redemptions: 0 },
      { grant_type: "single_redemption" as const }, { max_redemptions: 1 },
      { max_redemptions: Number.MAX_SAFE_INTEGER + 1 }, { exp: Number.MAX_SAFE_INTEGER + 1 },
      { jti: "" }, { iss: "" },
    ]) await assert.rejects(fixture(invalid), (error: unknown) => (error as { code: string }).code === "23514");
    const now = await epoch();
    await assert.rejects(fixture({ nbf: now + 10, exp: now + 10 }), (error: unknown) => (error as { code: string }).code === "23514");
    await assert.rejects(fixture({ iat: now + 10, nbf: now }), (error: unknown) => (error as { code: string }).code === "23514");
    const row = await fixture();
    await assert.rejects(fixture({ jti: row.jti }), (error: unknown) => (error as { code: string }).code === "23505");
    await assert.rejects(db.query("UPDATE public.access_receipts SET redemption_count=max_redemptions+1 WHERE jti=$1", [row.jti]),
      (error: unknown) => (error as { code: string }).code === "23514");
    assert.equal(await count(row), "0");
  });
}

try {
  await main();
} catch (error) {
  console.error(`FAIL: ${activeCase} (${safeErrorCode(error)}); raw errors withheld`);
  process.exitCode = 1;
} finally {
  if (pool) {
    try {
      // Only this run's explicit fixture JTIs; no truncation or migration here.
      await pool.query("DELETE FROM public.access_receipts WHERE jti=ANY($1::text[])", [created]);
      console.log("CLEANUP: only this run's fixture receipts removed");
    } catch (error) {
      console.error(`CLEANUP FAILED (${safeErrorCode(error)})`);
      process.exitCode = 1;
    }
    await pool.end();
  }
  console.log(JSON.stringify({ cases: results.length, passed: results.filter((result) => result.passed).length, races }));
}
