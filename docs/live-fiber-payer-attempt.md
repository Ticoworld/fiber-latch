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

## Phase 2G Route Retry Attempt

Date: 2026-05-24

Waited 3 minutes after the local channel reached `ChannelReady`, then retried with the live local node and the documented public nodes.

Sanitized retry output:

```json
{
  "localNode": {
    "channelCount": "0x1",
    "readyChannelsToNode1": [
      {
        "channelId": "0x761d692d...3753cd56",
        "stateName": "ChannelReady",
        "fundingUdtTypeScript": null,
        "localBalance": "0x956257100",
        "remoteBalance": "0x38407b700",
        "isPublic": true,
        "enabled": true
      }
    ]
  },
  "node1ToNode2": {
    "readyCkbChannelCount": 89,
    "readyChannelsToNode2": [
      {
        "channelId": "0x922e22e8...97e31aa2",
        "stateName": "ChannelReady",
        "fundingUdtTypeScript": null,
        "localBalance": "0x38407b700",
        "remoteBalance": "0x956257100",
        "isPublic": true,
        "enabled": true
      }
    ]
  },
  "invoiceCreate": {
    "amount": "0x5f5e100",
    "currency": "Fibt",
    "expiry": "0xe10",
    "usedPaymentPreimage": true,
    "paymentPreimagePrinted": false,
    "invoiceAddress": "fibt100000...qp3s9alu",
    "paymentHash": "0x3959f4c1...ad56ea6a"
  },
  "sendPayment": {
    "hasError": true,
    "errorMessage": "Send payment error: Failed to build route, PathFind error: no path found"
  },
  "getPayment": {
    "status": "Failed"
  },
  "getInvoice": {
    "status": "Open"
  }
}
```

Route retry result:

- local channel to node1: `ChannelReady`
- node1 to node2 ready CKB channels: 89
- fresh invoice amount: `0x5f5e100`
- `payment_preimage` used: yes, not printed
- `send_payment`: failed
- `get_payment`: `Failed`
- `get_invoice`: `Open`

The blocker after the retry is routing/gossip/path discovery from the local node to node2 through node1.

## Phase 2G Trampoline Payment Attempt

Date: 2026-05-24

After the automatic route retry failed with `PathFind error: no path found`, `fnn-cli payment send_payment --help` was inspected and showed an explicit `trampoline_hops` option:

- `trampoline_hops`: optional explicit trampoline hops
- when set to `[t1, t2, ...]`, routing finds a path from payer to `t1`, then encodes the inner trampoline onion from `t1` through the remaining hops to final

Local graph diagnostics showed:

```json
{
  "localGraphMentionsNode1": true,
  "localGraphMentionsNode2": true,
  "localToNode1CkbChannels": 1,
  "node1ToNode2CkbChannels": 4,
  "node1ToNode2DirectionalUpdatesInLocalGraph": 0
}
```

Public node1 liquidity diagnostics showed:

```json
{
  "publicNode1ToNode2TotalChannels": 107,
  "publicNode1ToNode2ReadyCkbChannels": 89,
  "readyCkbWithNode1OutboundAtLeast1Ckb": 89
}
```

A dry-run probe using `trampoline_hops` with node1 produced a route-shaped result:

```json
{
  "invoiceCreated": true,
  "invoiceMasked": "fibt100000...gp0m4agw",
  "paymentHashMasked": "0xcb6ad392...24746ca7",
  "dryRunWithoutHint": {
    "error": "Send payment error: Failed to build route, PathFind error: no path found"
  },
  "dryRunWithTrampolineNode1": {
    "status": "Created",
    "fee": "0x7a120"
  },
  "paidAttempted": false,
  "preimagePrinted": false
}
```

The real payment attempt then used a fresh node2 invoice and `trampoline_hops` with node1:

```json
{
  "invoiceCreated": true,
  "invoiceMasked": "fibt100000...qpvx8rc0",
  "paymentHashMasked": "0x54ddf549...9391d6c5",
  "sendPayment": {
    "error": "Send payment error: Failed to build route, Insufficient balance: max outbound liquidity 0 is insufficient, required amount: 100000000"
  },
  "finalPayment": {
    "status": "Failed",
    "fee": "0x0"
  },
  "finalInvoice": {
    "status": "Open"
  },
  "paidReached": false,
  "preimagePrinted": false
}
```

A final strict invoice-shape check added the official example's `final_cltv: "0x28"` field. That dry-run failed before any real send:

```json
{
  "invoiceCreated": true,
  "invoiceMasked": "fibt100000...qpxa5yaj",
  "paymentHashMasked": "0x7cfc7f01...b931d641",
  "invoiceUsedFinalCltv": true,
  "dryRun": {
    "error": "Send payment error: Failed to build route, Insufficient balance: max outbound liquidity 0 is insufficient, required amount: 100000000"
  },
  "realSendAttempted": false,
  "paidReached": false,
  "preimagePrinted": false
}
```

Trampoline attempt result:

- automatic `send_payment` still fails with `PathFind error: no path found`
- `trampoline_hops` can change the failure mode and produced one route-shaped dry-run result
- real `send_payment` with `trampoline_hops` failed before settlement with `max outbound liquidity 0`
- node2 `get_invoice` remained `Open`
- FiberLatch live paid verification was not run because no invoice reached `Paid`

## Exact Blocker

Primary blocker: Fiber routing/liquidity path construction from the local node to node2 through node1.

Specific blockers:

- `send_payment` was attempted and failed with `PathFind error: no path found`
- `send_payment` with `trampoline_hops` was attempted and failed with `Insufficient balance: max outbound liquidity 0 is insufficient, required amount: 100000000`
- invoice remained `Open`
- local channel state still shows `ChannelReady`, enabled, CKB channel, local balance, and no pending TLCs
- public node1 still reports ready CKB channels to node2 with at least 1 CKB local outbound liquidity
- the remaining issue is now Fiber's path construction/liquidity accounting for the trampoline route, not FiberLatch code

Earlier Phase 2E stopped before funding because no local address existed yet. Later Phase 2G created and funded a local testnet account and reached `ChannelReady`; the current blocker is the route/liquidity failure above.

## What Is Now Proven

- Public node1 and node2 remain reachable over Fiber JSON-RPC.
- Public node2 still accepts `new_invoice`.
- Public node2 still returns a `payment_hash`.
- Public node2 still returns `Open` for an unpaid invoice.
- Public node1 can report channel information for node2 when queried with `pubkey`; ready public channels were observed between the public nodes.
- This workspace has a live local node and ready local channel, but the payer path still cannot pay node2 because automatic routing fails and the trampoline route fails real send with `max outbound liquidity 0`.

## What Is Still Not Proven

- A local Fiber payer node can complete a paid payment from this workspace.
- A local CKB address can be used by Fiber to complete a paid payment here.
- A public-node route from the local node to node2 can be built and executed reliably.
- A public node2 invoice can be paid from this workspace.
- FiberLatch can verify a real paid Fiber `payment_hash`.
- FiberLatch can issue and redeem a receipt driven by a real paid Fiber payment.

## Safe Week 10 Wording

FiberLatch has a backend-only signed receipt lifecycle and a Fiber v0.8.1-aligned adapter. Phase 2E confirmed the official public-node payer path requirements, Phase 2F installed and verified official local tooling, Phase 2G created the local account, established a `ChannelReady` local channel, and proved the next blocker is Fiber route/liquidity construction: automatic routing reports no path and trampoline routing reports `max outbound liquidity 0`.

## Claims Still Forbidden

- FiberLatch verifies real Fiber payments.
- FiberLatch completed a paid Fiber testnet payment.
- FiberLatch issued a receipt from a live paid Fiber payment.
- FiberLatch can run the payer path from this workspace today.
- Public-node invoice creation proves settlement.
- Local channel readiness guarantees route discovery.
- A trampoline dry-run result proves settlement.

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
- `Start-Sleep -Seconds 180`
- combined Node route retry script covering node1-to-node2 `list_channels`, exact guide-shaped public `new_invoice`, local `send_payment`, local `get_payment`, and node2 `get_invoice`
- `fnn-cli graph graph_nodes --limit 1000 --raw-data --output-format json`
- `fnn-cli graph graph_channels --limit 5000 --raw-data --output-format json`
- `fnn-cli payment send_payment --help`
- JSON-RPC `send_payment` dry-run without `trampoline_hops`
- JSON-RPC `send_payment` dry-run with `trampoline_hops` set to public node1
- JSON-RPC real `send_payment` with `trampoline_hops` set to public node1
- JSON-RPC `get_payment(payment_hash)` for the trampoline attempt
- JSON-RPC `get_invoice(payment_hash)` on public node2 for the trampoline attempt
- JSON-RPC `new_invoice` with `final_cltv: "0x28"` for strict official invoice-shape check
