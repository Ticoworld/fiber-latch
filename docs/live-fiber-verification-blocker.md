# Live Fiber Verification Blocker

FiberLatch has:
- signed access receipts
- JWKS verification
- persisted access intents
- idempotent creation
- reconciliation worker
- a Fiber v0.8.1-aligned real adapter
- safe live-test script

Live Fiber verification is not yet proven because the workspace does not have:
- a real paid Fiber `payment_hash`
- a proven payer-side setup that can safely pay a Fiber invoice
- a local or otherwise controlled Fiber node/wallet path with channel setup, `ChannelReady`/`CHANNEL_READY`, route availability, and sufficient liquidity
- a paid result that drives FiberLatch receipt issuance

Phase 2D update:
- documented public Fiber testnet RPC nodes are reachable
- public `node_info` returned Fiber `0.8.1`
- public `new_invoice` succeeded with official v0.8.1-shaped params
- public `get_invoice(payment_hash)` succeeded for the created unpaid invoice
- the returned invoice status was `Open`
- FiberLatch's mapper and real adapter correctly treated `Open` as unpaid and did not issue verification

Phase 2E update:
- public node1 and node2 remained reachable
- a fresh public node2 invoice was created and queried
- the invoice status remained `Open`
- public node1 reported ready channels to public node2 when queried with `pubkey`, but this does not prove local payer readiness
- the workspace does not have `fnn`/`fnn-cli`, `ckb-cli`, a local CKB key/address, a funded payer address, or a local Fiber node data directory
- Docker CLI is installed, but the Docker daemon was not available during the attempt
- the payer path stopped before local node startup, channel opening, `CHANNEL_READY`, and `send_payment`

Phase 2F update:
- official Windows native Fiber `v0.8.1` binaries were downloaded outside the repo and verified by SHA-256 digest
- `fnn`, `fnn-cli`, and `fnn-migrate` now run locally by full path
- official Windows native `ckb-cli v2.0.0` was downloaded outside the repo and verified by SHA-256 digest
- `ckb-cli` now runs locally by full path
- an external nodeA runtime layout was prepared at `C:\Users\timot\Desktop\2026\CKB\fiber-local-node`
- official Fiber testnet `config.yml` and `fnn-cli.exe` were copied into the external nodeA directory
- no local account was created because `ckb-cli account new` did not prove secret-free output from help text
- `ckb-cli --local-only account list` returned no existing local accounts
- no private key was printed, exported, copied, or committed

Phase 2G update:
- external Fiber toolchain and runtime directories still exist outside the repo
- `fnn`, `fnn-cli`, `fnn-migrate`, and `ckb-cli` still run by full path
- `ckb-cli account new` was inspected but not run because help text does not explicitly guarantee secret-free output
- local CKB account creation was completed manually by the human
- public testnet address, `lock_arg`, and `lock_hash` were shared and documented only in masked form
- faucet page displayed `Claim Success` for `100000.0` CKB to the masked testnet address
- CLI/on-chain spendable balance has not yet been verified
- no private key, seed phrase, mnemonic, password, keystore, or node runtime secret was printed or committed
- manual account creation and funding instructions are documented in `docs/local-fiber-account-funding.md`
- the local node is running and has a `ChannelReady` channel to public node1
- public node1 reports 89 ready CKB channels to public node2 in the latest exact guide-shaped retry
- a fresh public node2 invoice was created with amount `0x5f5e100`, currency `Fibt`, expiry `0xe10`, and generated `payment_preimage`
- a fresh public node2 invoice still could not be paid from the local node
- `send_payment` failed with `PathFind error: no path found`
- `get_payment` returned `Failed`
- `get_invoice` remained `Open`
- local graph diagnostics confirmed the local node knows node1, node2, the local CKB channel to node1, and CKB graph channels between node1 and node2
- public node1 still reports 89 ready CKB channels to node2 with at least 1 CKB outbound liquidity from node1
- `send_payment` dry-run without a route hint failed with `PathFind error: no path found`
- `send_payment` dry-run with `trampoline_hops` set to public node1 produced one route-shaped `Created` result and fee estimate `0x7a120`
- real `send_payment` with `trampoline_hops` set to public node1 failed with `Insufficient balance: max outbound liquidity 0 is insufficient, required amount: 100000000`
- a strict invoice-shape retry using `final_cltv: "0x28"` failed at dry-run with the same `max outbound liquidity 0` error, so no second real payment was attempted
- node2 invoices from the trampoline attempts remained `Open`

The blocker is no longer "no public endpoint can be reached," "missing local binaries," "no local account," "no local channel," or only "no path found." The exact remaining blocker is Fiber route/liquidity construction from the local node to node2 through node1. Automatic routing reports no path; trampoline routing gets further but real send fails because the route builder reports `max outbound liquidity 0` despite the local channel being `ChannelReady` and public node1 reporting ready CKB channels to node2. Only after the local node can execute a payment and node2 returns `Paid` can FiberLatch verify a paid `payment_hash` and issue a receipt from the paid result.

Current honest claim:
FiberLatch has a Fiber v0.8.1-aligned verification adapter, a complete signed receipt lifecycle, public-node proof that unpaid Fiber testnet invoices can be created and queried without issuing receipts, local Windows-native Fiber/CKB CLI tooling prepared outside the repo, a manually created local CKB testnet account with faucet claim success observed, a live local node with a ready channel to public node1, and a real public-node payment attempt with explicit trampoline routing. Paid verification remains blocked on Fiber route/liquidity construction to node2.

Current dishonest claim:
FiberLatch verifies real Fiber testnet payments.

Next proof needed:
Resolve the trampoline route/liquidity failure, make a real Fiber testnet payment that turns node2 `get_invoice(payment_hash)` to `Paid`, run FiberLatch verification against the resulting paid `payment_hash`, and record the sanitized receipt-issuance result.
