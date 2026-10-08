import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

// Deliberately ignore ambient DATABASE_URL and every other environment file.
export function databaseUrl() {
  const url = parseEnv(readFileSync(new URL('../../../.env.local', import.meta.url), 'utf8')).DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL missing from repo .env.local');
  // Preserve certificate verification explicitly, avoiding pg's future mode change.
  const parsed = new URL(url);
  if (!parsed.hostname.endsWith('.neon.tech')) throw new Error('Expected authorized Neon database');
  parsed.searchParams.set('sslmode', 'verify-full');
  return parsed.toString();
}

export function safeErrorCode(error) {
  return /^[A-Z0-9_]+$/.test(error?.code ?? '') ? error.code : 'CHECK_FAILED';
}
