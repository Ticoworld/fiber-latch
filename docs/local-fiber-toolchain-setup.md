# Phase 2F Report: Local Fiber Toolchain Setup Attempt

Date: 2026-05-24

Scope: environment/toolchain proof only. No FiberLatch product features, UI, checkout, API route changes, receipt logic changes, live paid verification claims, committed secrets, committed node data, or committed runtime files were added.

## Environment Checked

- OS: Microsoft Windows NT `10.0.26200.0`
- PowerShell: `5.1.26100.8457`
- WSL: available, default distribution `Ubuntu`, WSL version `2`
- WSL distributions: `Ubuntu` stopped, `docker-desktop` stopped
- Docker CLI: available, Docker `29.2.1`
- Docker daemon: unavailable, daemon connection failed at `npipe:////./pipe/dockerDesktopLinuxEngine`
- Git: `git version 2.52.0.windows.1`
- Node: `v22.14.0`
- npm: `11.7.0`
- Rust/Cargo: not available on PATH
- existing `fnn`/`fnn-cli`/`fnn-migrate`: not available before setup
- existing `ckb-cli`: not available before setup

## Official Sources Used

- Fiber public-node guide: https://www.fiber.world/docs/quick-start/connect-nodes
- Fiber release `v0.8.1`: https://github.com/nervosnetwork/fiber/releases/tag/v0.8.1
- Fiber latest release API: https://api.github.com/repos/nervosnetwork/fiber/releases/latest
- `ckb-cli` repository: https://github.com/nervosnetwork/ckb-cli
- `ckb-cli` release `v2.0.0`: https://github.com/nervosnetwork/ckb-cli/releases/tag/v2.0.0
- `ckb-cli` latest release API: https://api.github.com/repos/nervosnetwork/ckb-cli/releases/latest

The official Fiber public-node guide says to download `fnn`, use `ckb-cli`, create/export a local account key into the Fiber node `ckb` directory, copy `config.yml` and `fnn-cli`, fund the node address, start the node, connect to public node1, open a channel, wait for `ChannelReady`/`CHANNEL_READY`, then send payment.

## Chosen Setup Path

Chosen path: Windows native binaries.

Why:

- official Fiber `v0.8.1` release provides `fnn_v0.8.1-x86_64-windows.tar.gz`
- official `ckb-cli v2.0.0` release provides `ckb-cli_v2.0.0_x86_64-pc-windows-msvc.zip`
- WSL is installed but stopped
- Docker daemon is unavailable
- Rust/Cargo is unavailable, so source build is not the safest path
- Windows native archives avoid system-wide installation and keep all tooling outside the repo

## Toolchain Result

- `fnn` available: yes
- `fnn-cli` available: yes
- `fnn-migrate` available: yes
- `ckb-cli` available: yes

Versions:

```text
fnn Fiber v0.8.1 (b560023 2026-04-16)
fnn-cli 0.8.1
fnn-migrate 0.8.1
ckb-cli 2.0.0 (80efc21 2025-12-03)
```

Downloaded official assets outside the repo:

- `C:\Users\timot\Desktop\2026\CKB\fiber-local-toolchain\downloads\fnn_v0.8.1-x86_64-windows.tar.gz`
- `C:\Users\timot\Desktop\2026\CKB\fiber-local-toolchain\downloads\ckb-cli_v2.0.0_x86_64-pc-windows-msvc.zip`
- `C:\Users\timot\Desktop\2026\CKB\fiber-local-toolchain\downloads\ckb-cli_v2.0.0_x86_64-pc-windows-msvc.zip.asc`

SHA-256 checks:

```json
[
  {
    "name": "fnn_v0.8.1-x86_64-windows.tar.gz",
    "expectedSha256": "09698a8699c9cd8ba52fd2711c96d3f62bc451d5aa1adc41cf7546ea8f40cb9d",
    "sha256Matches": true
  },
  {
    "name": "ckb-cli_v2.0.0_x86_64-pc-windows-msvc.zip",
    "expectedSha256": "74977644ac84652c8d2c7ecf983091b3ca9425c34a429eff25ebf8b01f51d2d1",
    "sha256Matches": true
  },
  {
    "name": "ckb-cli_v2.0.0_x86_64-pc-windows-msvc.zip.asc",
    "expectedSha256": "c7632479ee1b950951f9a8381c609dcc6e955381080db84ee82ea53754bc9cdd",
    "sha256Matches": true
  }
]
```

Extracted toolchain paths:

- Fiber: `C:\Users\timot\Desktop\2026\CKB\fiber-local-toolchain\fiber-v0.8.1`
- `ckb-cli`: `C:\Users\timot\Desktop\2026\CKB\fiber-local-toolchain\ckb-cli-v2.0.0`

No system PATH changes were made.

## Runtime Directory

- path: `C:\Users\timot\Desktop\2026\CKB\fiber-local-node`
- tracked by git: no
- inside FiberLatch repo: no

Prepared layout:

```text
C:\Users\timot\Desktop\2026\CKB\fiber-local-node\nodeA
C:\Users\timot\Desktop\2026\CKB\fiber-local-node\nodeA\ckb
C:\Users\timot\Desktop\2026\CKB\fiber-local-node\nodeA\config.yml
C:\Users\timot\Desktop\2026\CKB\fiber-local-node\nodeA\fnn-cli.exe
```

The `config.yml` file was copied from the official Fiber `config\testnet\config.yml`. No local node was started.

## Local Testnet Address

- created: no
- identified existing address: no
- `ckb-cli --local-only account list`: returned `[]`
- masked public address: none
- private key printed: no
- private key exported: no
- key copied into Fiber node directory: no

Reason: `ckb-cli account new --help` says it creates a new account and prints related information, but does not guarantee secret-free output. This phase stopped before account creation to avoid exposing private material in command logs.

## Funding Requirement

Official public-node guide funding requirements:

- local node address funding: `10000` CKB for the documented setup
- public node1 CKB channel open: at least `500` CKB because public node1 auto-accept minimum is documented as `438` CKB
- CKB unit note: `1 CKB = 100,000,000` shannons
- optional RUSD path: `20` RUSD or more for the RUSD UDT example; not required for the CKB invoice payer path

Funding sources from official guide:

- CKB faucet: `https://faucet.nervos.org`
- RUSD faucet: `https://testnet0815.stablepp.xyz/faucet`
- JoyID testnet wallet page for RUSD flow: `https://testnet.joyid.dev`

Current blocker: no local address exists yet, so no funding can be requested.

## Files Changed

- `docs/local-fiber-toolchain-setup.md`
- `docs/live-fiber-verification-blocker.md`

External files created outside the repo:

- `C:\Users\timot\Desktop\2026\CKB\fiber-local-toolchain`
- `C:\Users\timot\Desktop\2026\CKB\fiber-local-node`

## Commands Run

- `git status --short`
- `git log --oneline -5`
- inspected `docs/live-fiber-payer-attempt.md`
- inspected `docs/live-fiber-verification-blocker.md`
- checked OS and PowerShell version
- `wsl --status`
- `wsl --list --verbose`
- `docker --version`
- `docker info --format '{{json .ServerVersion}}'`
- `git --version`
- `node --version`
- `npm --version`
- `rustc --version`
- `cargo --version`
- official GitHub release API checks for Fiber and `ckb-cli`
- created external toolchain/runtime directories
- downloaded official Fiber and `ckb-cli` Windows assets
- verified SHA-256 digests
- extracted downloaded assets
- ran `fnn.exe --version`
- ran `fnn-cli.exe --version`
- ran `fnn-migrate.exe --version`
- ran `ckb-cli.exe --version`
- copied official Fiber testnet config and `fnn-cli.exe` into the external nodeA directory
- ran `ckb-cli.exe account --help`
- ran `ckb-cli.exe account new --help`
- ran `ckb-cli.exe --local-only --output-format json account list`
- `npm test`
- `npm run build`
- `npm run demo:local-access`

## Validation Result

- `npm test`: passed, 3 test files, 32 tests
- `npm run build`: passed
- `npm run demo:local-access`: passed, first redemption `GRANTED`, second redemption `DENIED`

## What Is Now Proven

- Official Windows native Fiber `v0.8.1` tools can run locally.
- Official Windows native `ckb-cli v2.0.0` can run locally.
- Downloaded tool archives match official GitHub API SHA-256 digests.
- A local Fiber nodeA runtime layout exists outside the repo with official testnet config and `fnn-cli`.
- No private key was printed, exported, copied, or committed.

## What Is Still Not Proven

- A local testnet CKB account/address exists for this payer path.
- The local address can be funded.
- `fnn` can start successfully with a funded key.
- A channel can be opened to public node1.
- `ChannelReady`/`CHANNEL_READY` can be reached.
- `send_payment` can pay a public node2 invoice.
- FiberLatch can verify a real paid Fiber `payment_hash`.

## Exact Next Step

Create a local CKB testnet account in a controlled secret-safe shell session, capture only masked public address/lock_arg, export the private key to `C:\Users\timot\Desktop\2026\CKB\fiber-local-node\nodeA\ckb\key` without printing it, fund the address from the official faucet, then start `fnn` and attempt the public-node payer path.
