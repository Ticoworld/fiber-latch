import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const EXAMPLE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPOSITORY_ROOT = resolve(EXAMPLE_ROOT, "../..");
const ACCESS_PACKAGE_ROOT = resolve(REPOSITORY_ROOT, "packages/access");
const npmCli = process.env.npm_execpath;

if (!npmCli) {
  throw new Error("npm_execpath is required to run packed example verification.");
}

function runProcess(command, args, cwd, stdio = "inherit") {
  const result = spawnSync(command, args, {
    cwd,
    env: process.env,
    encoding: "utf8",
    stdio: stdio === "pipe" ? ["ignore", "pipe", "pipe"] : "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(" ")}`);
  }

  return result.stdout ?? "";
}

function runNpm(args, cwd, stdio = "inherit") {
  return runProcess(process.execPath, [npmCli, ...args], cwd, stdio);
}

function exampleFiles(root) {
  const files = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "scripts") {
          visit(path);
        }
      } else if (entry.isFile() && path.endsWith(".mjs")) {
        files.push(path);
      }
    }
  };
  visit(root);
  return files;
}

function verifyPackageRootImports(root) {
  const forbidden = [
    "../../packages/access/src",
    "../../../packages/access/src",
    "packages/access/dist",
    "../../packages/access/dist",
    "@fiberlatch/access/src",
    "@fiberlatch/access/dist",
  ];

  for (const path of exampleFiles(root)) {
    const contents = readFileSync(path, "utf8");
    for (const fragment of forbidden) {
      if (contents.includes(fragment)) {
        throw new Error(`Forbidden package import path in ${path}: ${fragment}`);
      }
    }
  }
}

function main() {
  verifyPackageRootImports(EXAMPLE_ROOT);
  runNpm(["run", "build:access"], REPOSITORY_ROOT);
  runNpm(["run", "test:access:example"], REPOSITORY_ROOT);
  runNpm(["run", "demo:access:example"], REPOSITORY_ROOT);

  const temporaryRoot = mkdtempSync(join(tmpdir(), "fiberlatch-paid-resource-"));
  const packedDirectory = join(temporaryRoot, "packed");
  const consumerDirectory = join(temporaryRoot, "consumer");
  mkdirSync(packedDirectory);

  try {
    const packOutput = runNpm(
      ["pack", "--json", "--pack-destination", packedDirectory],
      ACCESS_PACKAGE_ROOT,
      "pipe",
    );
    const packInfo = JSON.parse(packOutput);
    const tarball = resolve(
      packedDirectory,
      Array.isArray(packInfo) ? packInfo[0].filename : packInfo.filename,
    );
    if (!readdirSync(packedDirectory).includes(tarball.split(/[\\/]/u).pop())) {
      throw new Error("npm pack did not produce an access package tarball.");
    }

    cpSync(EXAMPLE_ROOT, consumerDirectory, { recursive: true });
    verifyPackageRootImports(consumerDirectory);
    runNpm(
      [
        "install",
        "--no-audit",
        "--no-fund",
        "--ignore-scripts",
        "--no-package-lock",
        tarball,
      ],
      consumerDirectory,
    );
    runNpm(["run", "test"], consumerDirectory);
    runNpm(["run", "demo"], consumerDirectory);
    console.log("packed paid-resource acceptance passed");
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
