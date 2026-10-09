import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import * as companion from '@fiberlatch/postgres-store';
import { redeemAccessReceipt } from '@fiberlatch/access';

assert.deepEqual(Object.keys(companion), ['createPostgresAccessReceiptStore']);
const require = createRequire(import.meta.url);
assert.equal(require('@fiberlatch/postgres-store').createPostgresAccessReceiptStore,
  companion.createPostgresAccessReceiptStore);
assert.throws(() => require.resolve('@fiberlatch/postgres-store/dist/index.js'),
  { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' });
const schema = readFileSync(new URL(import.meta.resolve(
  '@fiberlatch/postgres-store/sql/001_access_receipts.sql')), 'utf8');
assert(schema.includes('CREATE TABLE public.access_receipts'));
const command = {
  jti: "packed-' OR true --", iss: 'issuer', sub: 'subject', aud: 'audience',
  intent_id: 'intent', resource_id: 'resource', policy_id: 'policy',
  grant_type: 'multi_redemption', max_redemptions: 3, exp: 2000000000, current_time: 1,
};
let calls = 0;
const store = companion.createPostgresAccessReceiptStore(async (sql, parameters) => {
  calls++;
  assert(!sql.includes(command.jti));
  assert.equal(parameters[0], command.jti);
  return { rows: [{ outcome: 'receipt_missing', exhausted: null }] };
});
assert.deepEqual(await store.consume(command), { outcome: 'receipt_missing' });
assert.equal(calls, 1);
assert.equal(typeof redeemAccessReceipt, 'function');
console.log('CLEAN RUNTIME: PASS (published access 0.1.1; ESM/synchronous require; exports; SQL resource; bound query)');
