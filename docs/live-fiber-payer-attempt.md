# Phase 2E Report: Payer Path Execution Attempt

Date: 2026-05-24

Scope: proof work only. No product features, UI, dashboard, checkout, POS, creator tooling, API route changes, receipt-signing changes, or redemption changes were made.

Official references checked:

- Fiber public-node guide: https://www.fiber.world/docs/quick-start/connect-nodes
- Fiber public nodes manual: https://github.com/nervosnetwork/fiber/blob/develop/docs/public-nodes.md
- Fiber RPC reference: https://github.com/nervosnetwork/fiber/blob/develop/crates/fiber-lib/src/rpc/README.md
- Fiber releases: https://github.com/nervosnetwork/fiber/releases

## Environment Status

- OS: Microsoft Windows NT `10.0.26200.0`
- Fiber binary availability: not found on PATH and not found in the repo
- `fnn` availability: no
- `fnn-cli` availability: no
- `fnn-migrate` availability: no
- `ckb-cli` availability: no
- Docker CLI availability: yes, Docker `29.2.1`
- Docker daemon availability: no, daemon connection failed at `npipe:////./pipe/dockerDesktopLinuxEngine`
- local Fiber node data in repo: none found for `testnet-fnn`, `nodeA`, `.fiber`, `fiber-node`, or `data`
- relevant local env var names: none found for `FIBER*`, `CKB*`, or `RUSD*`
- local node feasibility: not feasible in this workspace during this attempt

The latest stable Fiber release API returned `v0.8.1` and listed `fnn_v0.8.1-x86_64-windows.tar.gz`, but no download or install was performed.

## Official Payer Path Extracted

The official public-node path requires:

- download `fnn`/`fnn-cli` v0.8.0 or higher
- install or provide `ckb-cli`
- create a local CKB account and export the private key into the local Fiber node's `ckb/key`
- keep the local Fiber data directory outside the repo or ignored
- copy testnet `config.yml` and `fnn-cli` into the local node directory
- fund the local node address
- start local node A with `FIBER_SECRET_KEY_PASSWORD`, `fnn -c <config> -d <data-dir>`
- get public node1 pubkey from `node_info`
- connect local node A to public node1 at `/ip4/18.162.235.225/tcp/8119/p2p/QmXen3eUHhywmutEzydCsW4hXBoeVmdET2FJvMX69XJ1Eo`
- open a public CKB channel from local node A to public node1
- wait for `ChannelReady`/`CHANNEL_READY`
- wait for route gossip if `send_payment` initially cannot build a route
- create an invoice on public node2 at `http://18.163.221.211:8227`
- send payment from local node A to the node2 invoice
- poll `get_invoice(payment_hash)` on node2 until `Paid` or terminal failure
- only then run FiberLatch live verification and receipt issuance

Required amounts and ports from the official guide:

- public node1 P2P: `18.162.235.225:8119`
- public node1 RPC: `http://18.162.235.225:8227`
- public node2 P2P: `18.163.221.211:8119`
- public node2 RPC: `http://18.163.221.211:8227`
- local default RPC for `fnn-cli`: `http://127.0.0.1:8227`
- CKB channel example: fund local address with `10000` CKB, open channel with at least `500` CKB because public node1 auto-accept minimum is documented as `438` CKB
- RUSD path: guide says `20` RUSD or more for the RUSD UDT example; not required for the CKB invoice path attempted here
- faucet pages checked reachable: `https://faucet.nervos.org/`, `https://testnet0815.stablepp.xyz/faucet`, `https://testnet.joyid.dev/`

## Public Node Status

- node1 reachable: yes
- node2 reachable: yes
- invoice creation: yes
- payment_hash obtained: yes
- get_invoice status: `Open`

Sanitized public-node precheck:

```json
{
  "node1": {
    "reachable": true,
    "httpStatus": 200,
    "version": "0.8.1",
    "nodeName": "CkbaNode-1",
    "pubkey": "02b6d4e3ab...0302be71",
    "channelCount": "0xf",
    "peersCount": "0xa"
  },
  "node2": {
    "reachable": true,
    "httpStatus": 200,
    "version": "0.8.1",
    "nodeName": "CkbaNode-2",
    "pubkey": "0291a6576b...d1912fcc",
    "channelCount": "0xc",
    "peersCount": "0x8"
  },
  "publicNode1ToNode2Channels": {
    "queried": true,
    "httpStatus": 200,
    "hasError": false,
    "queriedWithField": "pubkey",
    "channelCount": 8,
    "readyChannelsObserved": true
  },
  "createInvoice": {
    "httpStatus": 200,
    "hasError": false,
    "invoiceAddress": "fibt11p7y8...cqt3a93t",
    "paymentHash": "0xabe50cd7...d6b1a17e",
    "invoiceCurrency": "Fibt",
    "invoiceAmount": "0x1",
    "hasInvoiceObject": true
  },
  "getInvoice": {
    "httpStatus": 200,
    "hasError": false,
    "status": "Open",
    "invoiceAddress": "fibt11p7y8...cqt3a93t",
    "paymentHash": "0xabe50cd7...d6b1a17e",
    "invoiceCurrency": "Fibt",
    "invoiceAmount": "0x1"
  }
}
```

## Payer Path Attempt

- local node started: no
- local node funded: no
- connected to public node1: no
- channel opened: no
- `CHANNEL_READY` reached: no
- `send_payment` attempted: no
- `send_payment` result: not attempted
- `get_invoice` final status: `Open`

The payer path was not attempted beyond safe public-node checks because the workspace does not have the required local Fiber/CKB tooling or a funded local payer identity.

## FiberLatch Verification

- live paid `payment_hash` verified: no
- receipt issued from live paid Fiber result: no
- receipt redeemed from live paid Fiber result: no

No FiberLatch live paid verification was run because the invoice never became `Paid`.

## Local Validation

- `npm test`: passed, 3 test files, 32 tests
- `npm run build`: passed
- `npm run demo:local-access`: passed, first redemption `GRANTED`, second redemption `DENIED`

## Sanitized Outputs Saved

- `docs/live-fiber-payer-attempt.md`
- `docs/live-fiber-verification-blocker.md`

## Exact Blocker

Primary blocker: missing local payer setup.

Specific blockers:

- missing `fnn`/`fnn-cli` binary
- missing `ckb-cli`
- no local CKB key/address discovered
- no local Fiber node data directory
- no funded local payer address
- balance cannot be checked because no local address exists
- channel cannot be opened because local node cannot start and has no funded key
- `CHANNEL_READY` cannot be reached without opening a channel
- `send_payment` cannot be attempted without local node, funding, channel readiness, and route availability
- invoice remained `Open`

Faucet pages were reachable, but no funding action was possible or attempted because there was no local address to fund.

## What Is Now Proven

- Public node1 and node2 remain reachable over Fiber JSON-RPC.
- Public node2 still accepts `new_invoice`.
- Public node2 still returns a `payment_hash`.
- Public node2 still returns `Open` for an unpaid invoice.
- Public node1 can report channel information for node2 when queried with `pubkey`; ready public channels were observed between the public nodes.
- This workspace currently cannot execute the local payer path without additional tooling and funding setup.

## What Is Still Not Proven

- A local Fiber payer node can run from this workspace.
- A local CKB address can be created, exported, funded, and used by Fiber here.
- A channel can be opened from a local node to public node1.
- `CHANNEL_READY` can be reached from a local node.
- A public node2 invoice can be paid from this workspace.
- FiberLatch can verify a real paid Fiber `payment_hash`.
- FiberLatch can issue and redeem a receipt driven by a real paid Fiber payment.

## Safe Week 10 Wording

FiberLatch has a backend-only signed receipt lifecycle and a Fiber v0.8.1-aligned adapter. Phase 2E confirmed the official public-node payer path requirements, re-verified public node reachability, created and queried another unpaid public-node invoice, and stopped before payer execution because the workspace lacks local Fiber/CKB tooling, a funded local address, and channel readiness.

## Claims Still Forbidden

- FiberLatch verifies real Fiber payments.
- FiberLatch completed a paid Fiber testnet payment.
- FiberLatch issued a receipt from a live paid Fiber payment.
- FiberLatch can run the payer path from this workspace today.
- Public-node invoice creation proves settlement.

## Commands Run

- `git status --short`
- `git log --oneline -5`
- OS checks through PowerShell/.NET
- `Get-Command` checks for `fnn`, `fnn-cli`, `fnn-migrate`, `fiber`, `fiber-cli`, and `ckb-cli`
- repo file checks for local Fiber/CKB binaries and node data directories
- env-name-only check for `FIBER*`, `CKB*`, and `RUSD*`
- `docker --version`
- `docker info --format '{{json .ServerVersion}}'`
- inspected `docs/live-fiber-attempt.md`
- inspected `docs/live-fiber-verification-blocker.md`
- inspected `docs/live-fiber-next-steps.md`
- read official Fiber public-node guide and related official references
- GitHub release API check for latest stable Fiber release metadata
- safe GET reachability checks for official faucet/wallet pages
- JSON-RPC `node_info` against public node1 and node2
- JSON-RPC `list_channels` on node1 using the public-guide `peer_pubkey` field
- JSON-RPC `list_channels` on node1 using the RPC-reference `pubkey` field
- JSON-RPC `new_invoice` on public node2
- JSON-RPC `get_invoice(payment_hash)` on public node2 using the in-memory hash
- `npm test`
- `npm run build`
- `npm run demo:local-access`
