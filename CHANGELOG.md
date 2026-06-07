# Changelog

All entries describe what was proven or changed in each phase. Proof boundaries are stated explicitly. Live paid Fiber testnet verification is proven at Phase 3. See tag `fiberlatch-live-paid-proof`.

---

## Phase 3 — 2026-05-27

### Live Paid Fiber Verification Proven

- Local `fnn` node successfully started and synchronized routing graph.
- A real Fiber testnet payment of a tiny amount (1,000 shannons) was successfully executed via trampoline route through public node1 to a public node2 invoice.
- The node2 invoice successfully transitioned to `Paid`.
- The FiberLatch verification script (`npm run fiber:testnet:verify`) successfully queried the real paid `payment_hash`.
- The `demo-live-paid-issuance.ts` script successfully proved the complete service-layer path: it ingested the live paid `payment_hash`, created an `AccessIntent`, ran the reconciliation worker, issued a signed JWT `AccessReceipt`, verified the JWT, and atomically redeemed it.
- **Note:** This payment was a tiny testnet amount. This proves the integration lifecycle but does not declare production or mainnet readiness.

---

## Phase 2G — 2026-05-24

### Local payer setup and payment attempts

- Local CKB testnet account created manually in a secret-safe shell session outside Codex. Only masked public address (`ckt1qzda0c...cq6p4hrw`), `lock_arg`, and `lock_hash` were documented in the repo.
- Official CKB testnet faucet displayed `Claim Success` for `100000.0 CKB` to the masked local address.
- Local `fnn` node started using the external runtime at `C:\...\fiber-local-node\nodeA`.
- Local RPC at `http://127.0.0.1:8227` responded correctly.
- Local node successfully connected to public node1 (`18.162.235.225:8119`) and opened a CKB channel.
- Channel to public node1 reached `ChannelReady` and was confirmed `enabled: true` with non-zero `localBalance`.
- Public node1 reported 89 ready CKB channels to public node2 at the time of the payment attempt.
- A fresh public node2 invoice (`0x5f5e100` shannons, currency `Fibt`) was created using a generated `payment_preimage`.

**Payment attempt — automatic routing:**
- `send_payment` to the node2 invoice address was attempted from the local node.
- Result: `PathFind error: no path found`.
- `get_payment`: `Failed`.
- `get_invoice` on node2: `Open`.

**Payment attempt — trampoline routing:**
- `fnn-cli payment send_payment --help` was inspected; the `trampoline_hops` option allows explicit hop specification.
- Dry-run `send_payment` without a route hint: `PathFind error: no path found`.
- Dry-run `send_payment` with `trampoline_hops` set to public node1 pubkey: `status: "Created"`, `fee: "0x7a120"`. This is a route-shaped dry-run result only; it does not prove settlement.
- Real `send_payment` with `trampoline_hops` set to public node1: `Insufficient balance: max outbound liquidity 0 is insufficient, required amount: 100000000`.
- A second attempt using an invoice with the official `final_cltv: "0x28"` field failed at dry-run with the same `max outbound liquidity 0` error; no second real send was attempted.
- `get_payment`: `Failed`.
- `get_invoice` on node2: `Open`.

**What was not proven:**
- A Fiber testnet payment reaching `Paid` from this workspace.
- FiberLatch verifying a real paid Fiber `payment_hash`.
- FiberLatch issuing a signed access receipt driven by a real paid Fiber payment.

See `docs/live-fiber-payer-attempt.md` and `docs/live-fiber-verification-blocker.md` for full sanitized outputs.

---

## Phase 2F — 2026-05-24

### Local Fiber toolchain setup

- Official Windows-native Fiber `v0.8.1` binaries downloaded outside the repo: `fnn`, `fnn-cli`, `fnn-migrate`.
- Official Windows-native `ckb-cli v2.0.0` downloaded outside the repo.
- SHA-256 digests of all downloaded archives verified against official GitHub release API values.
- Extracted toolchain at `C:\...\fiber-local-toolchain`. No system PATH changes made.
- External runtime layout prepared at `C:\...\fiber-local-node\nodeA` with official Fiber testnet `config.yml` and `fnn-cli.exe` copied in.
- No private keys, seed phrases, mnemonics, passwords, or node runtime secrets were printed, pasted, or committed at any point.
- No binaries or runtime data were committed to the FiberLatch repo.
- `fnn --version`: `Fiber v0.8.1 (b560023 2026-04-16)`.
- `fnn-cli --version`: `0.8.1`.
- `ckb-cli --version`: `2.0.0 (80efc21 2025-12-03)`.

See `docs/local-fiber-toolchain-setup.md`.

---

## Phase 2E — 2026-05-24

### Official payer path requirements documented

- Official Fiber public-node payer path extracted from the Fiber docs and public-node guide.
- Requirements documented: download `fnn`/`fnn-cli`, provision `ckb-cli`, create a local CKB account, export the private key into the node `ckb/key` directory, fund the local address, start `fnn`, connect to public node1, open a channel, wait for `ChannelReady`, then attempt `send_payment` toward a public node2 invoice.
- The workspace did not have local Fiber/CKB tooling or a funded payer identity at the time of this phase; the payer path stopped at safe public-node RPC checks.

See `docs/live-fiber-payer-attempt.md`.

---

## Phase 2D — 2026-05-24

### Public Fiber node proof attempt

- Both documented public Fiber testnet RPC nodes reachable over JSON-RPC:
  - node1: `http://18.162.235.225:8227`
  - node2: `http://18.163.221.211:8227`
- `node_info` on both nodes returned HTTP 200 and `version: "0.8.1"`.
- `new_invoice` on node2 succeeded using official v0.8.1 shaped params (`amount`, `currency`, `description`, `expiry`). An `invoiceAddress` and a `paymentHash` (nested at `invoice.data.payment_hash`) were returned.
- `get_invoice(payment_hash)` succeeded on node2 using the in-memory `payment_hash`. Status returned: `Open`.
- FiberLatch's real adapter created an invoice and queried it against the public node.
- FiberLatch's mapper correctly normalized `Open` to `payment_pending` and did not issue a receipt.
- No payment was attempted or claimed in this phase.
- No live paid verification was proven.

See `docs/live-fiber-attempt.md`.

---

## Phase 2 (adapter) — 2026-05-24

### Fiber v0.8.1 adapter alignment

- `real-fiber-client.ts` updated to match the official Fiber v0.8.1 JSON-RPC contract:
  - `new_invoice` params now use the correct array-wrapped object shape.
  - `payment_hash` is read from the nested `invoice.data.payment_hash` location via `readPaymentHash()`.
  - `get_invoice` and `get_payment` use the correct method names and response field paths.
  - Invoice status vocabulary: `Open`, `Received`, `Paid`, `Expired`, `Cancelled`.
  - Payment status vocabulary: `Created`, `Inflight`, `Success`, `Failed`.
- `fiber-status-mapper.ts` normalizes all official statuses to internal FiberLatch states. Unknown or ambiguous statuses never issue a receipt.
- Adapter-level and phase-4 reconciliation tests updated to cover all official Fiber status values.

---

## Phase 1 — 2026-05-24

### Local receipt lifecycle proven

**Backend skeleton:**
- Fastify HTTP server.
- Prisma + SQLite persistence.
- TypeScript build via `tsc`.
- Test runner: Vitest.

**Public routes implemented and tested:**
- `POST /v1/access-intents` — creates an access intent; idempotent via `idempotencyKey`.
- `GET /v1/access-intents/:id` — fetches one intent by id.
- `POST /v1/receipts/verify` — verifies a signed receipt token.
- `POST /v1/receipts/redeem` — redeems a receipt atomically; marks exhausted at `maxRedemptions`.
- `GET /.well-known/jwks.json` — serves the public signing key.

**Receipt lifecycle:**
- Signed JWT access receipts issued by the reconciliation worker when a paid status is confirmed.
- JWKS published for external verification.
- Receipts verified by signature, time bounds, and persisted state.
- Redemption count incremented atomically; receipt marked `EXHAUSTED` on final redemption.
- Second redemption of an exhausted receipt is rejected.

**Fake Fiber adapter:**
- Simulates paid/unpaid/failed/expired status signals for local development and testing.
- Does not represent a real Fiber payment. Used only in `FIBER_CLIENT_MODE=fake`.

**Local demo (`npm run demo:local-access`):**
- One access intent created.
- Reconciliation worker issues exactly one signed receipt.
- Receipt verified: success.
- First redemption: `GRANTED`.
- Second redemption: `DENIED` (`RECEIPT_NOT_ACTIVE`).

**Validation at time of Phase 1:**
- `npm test`: 32 tests, 3 files, all pass.
- `npm run build`: TypeScript compile clean.
- `npm run demo:local-access`: full lifecycle confirmed.

See `docs/demo-proof.md`.

---

## Current validation (as of 2026-05-27)

- `npm test`: **32 tests, 3 files, all pass.**
- `npm run build`: **TypeScript compile clean.**
- `npm run demo:local-access`: **First redemption `GRANTED`, second redemption `DENIED`.**
