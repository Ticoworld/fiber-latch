import { cpSync, accessSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(packageDir, '..', '..');
const npmCli = process.env.npm_execpath;

if (!npmCli) {
  throw new Error('npm_execpath is required to run distribution verification.');
}

function runProcess(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env ?? process.env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const stdout = result.stdout?.trim() ?? '';
    const stderr = result.stderr?.trim() ?? '';
    throw new Error(
      [
        `Command failed: ${command} ${args.join(' ')}`,
        stdout ? `stdout:\n${stdout}` : '',
        stderr ? `stderr:\n${stderr}` : '',
      ]
        .filter(Boolean)
        .join('\n\n'),
    );
  }

  return result.stdout ?? '';
}

function runNpm(args, cwd) {
  return runProcess(process.execPath, [npmCli, ...args], { cwd });
}

function ensureFileExists(filePath) {
  accessSync(filePath);
}

function parsePackResult(output, packDir) {
  const trimmed = output.trim();
  if (!trimmed) {
    throw new Error('npm pack did not return JSON output.');
  }

  const parsed = JSON.parse(trimmed);
  const packInfo = Array.isArray(parsed) ? parsed[0] : parsed;

  if (!packInfo || typeof packInfo !== 'object') {
    throw new Error('npm pack returned an unexpected payload.');
  }

  const candidate = typeof packInfo.path === 'string' && packInfo.path
    ? packInfo.path
    : typeof packInfo.filename === 'string' && packInfo.filename
      ? path.join(packDir, packInfo.filename)
      : null;

  if (!candidate) {
    throw new Error('npm pack did not report a tarball path.');
  }

  return path.resolve(candidate);
}

function copyFixtureInto(projectDir, fixtureDir) {
  cpSync(fixtureDir, projectDir, { recursive: true });
}

function assertWithin(baseDir, targetPath) {
  const relative = path.relative(baseDir, targetPath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Path escaped workspace boundary: ${targetPath}`);
  }
}

async function main() {
  const distJs = path.join(packageDir, 'dist', 'index.js');
  const distTypes = path.join(packageDir, 'dist', 'index.d.ts');
  ensureFileExists(distJs);
  ensureFileExists(distTypes);

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'fiberlatch-access-'));
  const packDir = path.join(tempRoot, 'pack');
  const esmProject = path.join(tempRoot, 'esm-consumer');
  const cjsProject = path.join(tempRoot, 'commonjs-consumer');
  const tsProject = path.join(tempRoot, 'typescript-consumer');
  let tarballPath = '';

  try {
    rmSync(packDir, { recursive: true, force: true });
    mkdirSync(packDir, { recursive: true });
    rmSync(esmProject, { recursive: true, force: true });
    rmSync(cjsProject, { recursive: true, force: true });
    rmSync(tsProject, { recursive: true, force: true });

    const packJson = runNpm([
      'pack',
      '--json',
      '--pack-destination',
      packDir,
    ], packageDir);

    tarballPath = parsePackResult(packJson, packDir);
    assertWithin(packDir, tarballPath);
    ensureFileExists(tarballPath);

    const fixtures = [
      {
        name: 'esm',
        source: path.join(packageDir, 'test-consumers', 'esm'),
        project: esmProject,
        command: () => runProcess(process.execPath, ['index.js'], { cwd: esmProject }),
      },
      {
        name: 'commonjs',
        source: path.join(packageDir, 'test-consumers', 'commonjs'),
        project: cjsProject,
        command: () => runProcess(process.execPath, ['index.cjs'], { cwd: cjsProject }),
      },
      {
        name: 'typescript',
        source: path.join(packageDir, 'test-consumers', 'typescript'),
        project: tsProject,
        command: () => runProcess(
          process.execPath,
          [
            path.join(repoRoot, 'node_modules', 'typescript', 'bin', 'tsc'),
            '-p',
            'tsconfig.json',
          ],
          { cwd: tsProject },
        ),
      },
    ];

    for (const fixture of fixtures) {
      copyFixtureInto(fixture.project, fixture.source);
      runNpm([
        'install',
        '--no-save',
        '--ignore-scripts',
        '--no-audit',
        '--no-fund',
        '--package-lock=false',
        tarballPath,
      ], fixture.project);
      fixture.command();
      if (fixture.name !== 'typescript') {
        console.log(`Verified ${fixture.name} packed consumer.`);
      }
    }

    console.log('Verified typescript packed consumer.');
    console.log('Distribution proof completed successfully.');
  } finally {
    if (tarballPath) {
      rmSync(tarballPath, { force: true });
    }
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
