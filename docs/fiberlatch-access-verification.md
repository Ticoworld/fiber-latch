# FiberLatch Access Reviewer Verification Guide

## 1. Purpose

This guide gives a reviewer a short, reproducible path through the completed
FiberLatch Access grant delivery. It verifies the private package, its
distribution boundary, the paid-resource example, and the historical backend
regression without treating the backend or its live Fiber proof as grant-funded
package implementation.

## 2. Supported environment

- Node.js >=22.12.0
- Node 22 and Node 24 are the supported CI runtimes
- npm workspace support
- Windows, macOS, or Linux; Windows may report transient npm EBUSY cleanup
  details
- native ESM package consumers; supported CommonJS consumers use Node
  require(esm)
- no browser runtime

The package is private and unpublished. Verification packs it locally and uses
the generated tarball in a clean consumer.

## 3. Clean-install acceptance

From the repository root, run:

~~~sh
npm ci
npm run verify:access:grant
git diff --check
git status --short
~~~

The acceptance script is intentionally transparent:

~~~text
npm run prisma:generate
npm test
npm run build
npm run verify:access:package
npm run verify:access:example
~~~

npm ci remains outside the npm script so the reviewer can see and control the
clean installation step.

## 4. Expected validations

The current committed evidence and local acceptance should show:

- 235 access-package tests passing
- 57 historical backend tests passing
- 12 paid-resource example tests passing
- backend and package TypeScript builds passing
- publint passing
- ATTW passing
- packed ESM, CommonJS, and TypeScript consumers passing
- packed paid-resource acceptance passing
- first protected access succeeding
- replay of the same receipt being denied

The evidence does not depend on an exact npm installation package count.

## 5. Focused package commands

~~~sh
npm run test:access
npm run verify:access:package
~~~

verify:access:package covers package tests, the package build, strict publint,
ATTW type-entry validation, and external distribution consumers.

## 6. Paid-resource demonstration

~~~sh
npm run test:access:example
npm run demo:access:example
npm run verify:access:example
~~~

The example's server-owned fixture is deliberately not a real Fiber payment.
The automated flow accepts the fixture, issues a receipt, grants the first
protected request, and denies the second use. It does not call Fiber RPC.

For the manual HTTP flow, run:

~~~sh
node examples/paid-resource/src/server.mjs
~~~

The server prints its actual URL and port on startup; use that value in the
documented curl requests.

## 7. Packed-package proof

The paid-resource verifier performs these boundary checks:

1. Build the access package.
2. Run the example tests and demonstration in the workspace.
3. Pack @fiberlatch/access locally.
4. Copy the example into a temporary clean consumer.
5. Install only the generated package tarball into that consumer.
6. Scan the copied example for forbidden source or distribution imports.
7. Rerun the example tests and demo from the packed consumer.
8. Remove the temporary root in finally.

The package distribution fixtures separately cover ESM, CommonJS, and
TypeScript package-root consumers. No npm registry publication is involved.

## 8. Node 22 and Node 24 CI evidence

D5 package distribution evidence:

- commit [f7e5b7b](https://github.com/Ticoworld/fiber-latch/commit/f7e5b7b72f3bec285bd09e2dd4d710fd2811238e)
- GitHub Actions run [31078601378](https://github.com/Ticoworld/fiber-latch/actions/runs/31078601378)
- Node 22 passed
- Node 24 passed

D6 paid-resource evidence:

- commit [e06ad18](https://github.com/Ticoworld/fiber-latch/commit/e06ad183f25fd35ea7570914ad38bf695940d6f3)
- GitHub Actions run [31093114518](https://github.com/Ticoworld/fiber-latch/actions/runs/31093114518)
- Node 22 passed
- Node 24 passed
- package verification passed
- packed paid-resource acceptance passed

This checkpoint does not claim a D7 commit or D7 CI run. D7 remains pending
final independent grant review.

## 9. Expected Windows EBUSY handling

Windows npm cleanup can transiently fail with EBUSY when a process still has
a packed file or temporary directory open. The packed verifier captures child
stdout and stderr in a failed-command diagnostic so the cause is visible, and
its temporary-root cleanup remains in finally.

If a command reports EBUSY, close processes holding the package or temporary
consumer, rerun the command, and require a successful exit before treating the
packed acceptance as evidence. Do not suppress the child exit failure.

## 10. What successful verification proves

Successful acceptance proves that the committed package API builds, its tests
pass, its declared package boundary resolves for the supported consumer forms,
and the example works from a locally packed package. It proves the demonstrated
first-use and replay-denial flow and the host store's single-process atomic
semantic example.

## 11. What it does not prove

It does not prove a production database adapter, distributed replay protection,
payment verification, payment settlement, Fiber RPC integration in the package
path, hosted service operation, browser support, mainnet operation,
production-readiness, or a formal security audit. It also does not turn the
example fixture into a Fiber payment or make the historical backend proof a
grant-funded package feature.

## 12. Repository-cleanliness check

After validation, inspect the exact state:

~~~sh
git diff --check
git status --short
git diff --cached --name-status
git ls-files --others --exclude-standard
~~~

During this D7 checkpoint, the expected status is a set of unstaged
documentation, root-script, and narrow packed-verification changes. The index
must remain empty, and no tarball, temporary consumer, generated key or token,
example-local lockfile, database file, private path, or unrelated repository
file should appear. After the later final commit, the same checks should be
clean.
