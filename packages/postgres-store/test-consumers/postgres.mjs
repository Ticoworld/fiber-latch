import assert from 'node:assert/strict';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import pg from 'pg';
import { buildAccessReceiptClaims, createAccessReceiptSigner,
  createAccessReceiptVerifier, redeemAccessReceipt } from '@fiberlatch/access';
import { createPostgresAccessReceiptStore } from '@fiberlatch/postgres-store';

const connectionString = process.env.FIBERLATCH_PACK_SMOKE_DATABASE_URL;
assert(connectionString && new URL(connectionString).hostname.endsWith('.neon.tech'));
const pool = new pg.Pool({ connectionString, max: 2, connectionTimeoutMillis: 20000, statement_timeout: 20000 });
pool.on('error', () => { process.exitCode = 1; });
const jti = `packed-consumer-${randomUUID()}`;
try {
  const now = Number((await pool.query('SELECT floor(extract(epoch FROM clock_timestamp()))::text AS now')).rows[0].now);
  const claims = buildAccessReceiptClaims({
    jti, iss: 'packed-issuer', sub: 'packed-subject', aud: 'packed-audience',
    intent_id: 'packed-intent', resource_id: 'packed-resource', policy_id: 'packed-policy',
    grant_type: 'multi_redemption', max_redemptions: 3, iat: now - 20, nbf: now - 10,
    exp: now + 300, payment_ref: null,
  });
  // Host-owned trusted fixture issuance; no migration or existing data changes.
  await pool.query(`INSERT INTO public.access_receipts
    (jti, iss, sub, aud, intent_id, resource_id, policy_id, grant_type, max_redemptions, iat, nbf, exp, payment_ref)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`, [
    claims.jti, claims.iss, claims.sub, claims.aud, claims.intent_id, claims.resource_id,
    claims.policy_id, claims.grant_type, claims.max_redemptions, claims.iat, claims.nbf, claims.exp, claims.payment_ref,
  ]);
  const keys = generateKeyPairSync('ed25519');
  const signer = await createAccessReceiptSigner({ privateKey: { ...keys.privateKey.export({ format: 'jwk' }), kid: 'packed-key' } });
  const verifier = await createAccessReceiptVerifier({ publicKeys: [{ ...keys.publicKey.export({ format: 'jwk' }), kid: 'packed-key' }],
    issuer: claims.iss, audience: claims.aud });
  const token = await signer(claims);
  const store = createPostgresAccessReceiptStore((sql, parameters) => pool.query(sql, [...parameters]));
  const expected = { sub: claims.sub, resource_id: claims.resource_id, policy_id: claims.policy_id,
    intent_id: claims.intent_id, max_redemptions: 3 };
  for (let use = 1; use <= 4; use++) {
    const result = await redeemAccessReceipt({ token, verifier, store, expected, current_time: Math.floor(Date.now() / 1000) });
    assert.deepEqual(result, use <= 3 ? { status: 'success', exhausted: use === 3 }
      : { status: 'consumption_denied', phase: 'consumption', reason: 'receipt_exhausted' });
    assert.equal((await pool.query('SELECT redemption_count::text AS count FROM public.access_receipts WHERE jti=$1', [jti])).rows[0].count,
      String(Math.min(use, 3)));
  }
  const version = (await pool.query('SHOW server_version')).rows[0].server_version;
  console.log(`PACKED NEON: PASS (PostgreSQL ${version}; signed receipt; uses 1/2/3 succeed; use 4 exhausted; count 3)`);
} finally {
  try {
    await pool.query('DELETE FROM public.access_receipts WHERE jti=$1', [jti]);
  } finally {
    await pool.end();
  }
}
