import { readFileSync } from 'node:fs';
import pg from 'pg';
import { databaseUrl, safeErrorCode } from './environment.mjs';

let client;
try {
  const action = process.argv[2];
  if (action !== 'check' && action !== 'apply') throw new Error('Use check or apply');
  client = new pg.Client({ connectionString: databaseUrl(), connectionTimeoutMillis: 15000, statement_timeout: 15000 });
  await client.connect();
  const { rows } = await client.query('SELECT 1 AS connected');
  if (rows[0]?.connected !== 1) throw new Error('SELECT 1 failed');
  console.log('NEON CONNECTION CHECK: PASS (SELECT 1)');
  if (action === 'apply') {
    await client.query('BEGIN');
    await client.query(readFileSync(new URL('../sql/001_access_receipts.sql', import.meta.url), 'utf8'));
    await client.query('COMMIT');
    console.log('EXPLICIT MIGRATION: PASS (public.access_receipts)');
  }
} catch (error) {
  if (client) await client.query('ROLLBACK').catch(() => {});
  console.error(`DATABASE CHECK: FAIL (${safeErrorCode(error)}); raw errors withheld`);
  process.exitCode = 1;
} finally {
  if (client) await client.end().catch(() => {});
}
