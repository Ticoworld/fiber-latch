import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { databaseUrl, safeErrorCode } from './environment.mjs';

const packageDir = fileURLToPath(new URL('../', import.meta.url));
const npmCli = process.env.npm_execpath;
assert(npmCli, 'Run through npm so npm_execpath is available');
const neon = process.argv.includes('--neon');
const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'fiberlatch-postgres-store-'));

function within(base, target) {
  const relative = path.relative(base, target);
  assert(relative && !relative.startsWith('..') && !path.isAbsolute(relative), 'Unsafe temporary path');
}

function run(command, args, cwd, env = process.env, redact = false) {
  const result = spawnSync(command, args, { cwd, env, encoding: 'utf8', timeout: 180000 });
  if (result.error || result.status !== 0) {
    // Database child output/errors are deliberately never forwarded on failure.
    throw new Error(redact ? 'Packed PostgreSQL smoke failed; raw errors withheld'
      : `Verification command failed: ${args[0]}\n${result.stdout ?? ''}\n${result.stderr ?? ''}`);
  }
  return result.stdout;
}

function npm(args, cwd) {
  return run(process.execPath, [npmCli, ...args], cwd);
}

try {
  within(os.tmpdir(), tempRoot);
  assert(!tempRoot.startsWith(packageDir), 'Consumer must be outside the package');
  const packDir = path.join(tempRoot, 'pack');
  const consumer = path.join(tempRoot, 'consumer');
  mkdirSync(packDir);
  mkdirSync(consumer);
  const [packed] = JSON.parse(npm(['pack', '--json', '--pack-destination', packDir], packageDir));
  assert.equal(packed.name, '@fiberlatch/postgres-store');
  assert.equal(packed.version, '0.1.0');
  const archive = path.join(packDir, packed.filename);
  within(packDir, archive);
  const expected = ['LICENSE', 'README.md', 'dist/index.d.ts', 'dist/index.js', 'package.json', 'sql/001_access_receipts.sql'];
  const actual = run('tar', ['-tzf', archive], packDir).trim().split(/\r?\n/)
    .map(name => name.replace(/^package\//, '')).sort();
  assert.deepEqual(actual, expected);
  const hash = createHash('sha256').update(readFileSync(archive)).digest('hex');
  console.log(`PACK: PASS (${actual.join(', ')}); SHA256 ${hash}`);

  writeFileSync(path.join(consumer, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
  npm(['install', '--ignore-scripts', '--no-audit', '--no-fund', archive, '@fiberlatch/access@0.1.1'], consumer);
  const installed = path.join(consumer, 'node_modules', '@fiberlatch', 'postgres-store');
  assert(!lstatSync(installed).isSymbolicLink(), 'Tarball must not resolve through a workspace link');
  const metadata = JSON.parse(readFileSync(path.join(installed, 'package.json'), 'utf8'));
  assert.deepEqual(metadata.dependencies ?? {}, {});
  assert.deepEqual(metadata.peerDependencies, { '@fiberlatch/access': '0.1.1' });
  const lock = JSON.parse(readFileSync(path.join(consumer, 'package-lock.json'), 'utf8'));
  assert.deepEqual(Object.keys(lock.packages).filter(key => key).sort(), [
    'node_modules/@fiberlatch/access', 'node_modules/@fiberlatch/postgres-store',
    'node_modules/jose', 'node_modules/zod',
  ]);
  for (const file of ['runtime.mjs', 'types.mts', 'postgres.mjs']) {
    copyFileSync(path.join(packageDir, 'test-consumers', file), path.join(consumer, file));
  }
  assert.equal(readFileSync(path.join(installed, 'sql/001_access_receipts.sql'), 'utf8'),
    readFileSync(path.join(packageDir, 'sql/001_access_receipts.sql'), 'utf8'));
  console.log(run(process.execPath, ['runtime.mjs'], consumer).trim());

  // Install consumer-owned tools/driver only after testing the runtime-only graph.
  npm(['install', '--save-dev', '--ignore-scripts', '--no-audit', '--no-fund',
    'typescript@5.9.3', '@types/node@22.19.19', 'pg@8.23.1', '@types/pg@8.20.0'], consumer);
  copyFileSync(path.join(consumer, 'types.mts'), path.join(consumer, 'types.cts'));
  run(process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit', '--strict',
    '--module', 'NodeNext', '--moduleResolution', 'NodeNext', '--target', 'ES2022', 'types.mts', 'types.cts'], consumer);
  console.log('CLEAN TYPES: PASS (ESM/CommonJS NodeNext; consumer-owned compiler; pg executor)');
  if (neon) {
    console.log(run(process.execPath, ['postgres.mjs'], consumer,
      { ...process.env, FIBERLATCH_PACK_SMOKE_DATABASE_URL: databaseUrl() }, true).trim());
  }
} catch (error) {
  console.error(`DISTRIBUTION: FAIL (${safeErrorCode(error)}): ${error.message}`);
  process.exitCode = 1;
} finally {
  within(os.tmpdir(), tempRoot);
  assert(path.basename(tempRoot).startsWith('fiberlatch-postgres-store-'));
  rmSync(tempRoot, { recursive: true, force: true });
  console.log('DISPOSABLE CONSUMER CLEANUP: PASS');
}
