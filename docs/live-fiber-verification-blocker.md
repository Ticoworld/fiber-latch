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

The blocker is no longer "no public endpoint can be reached" or "missing local binaries." The exact remaining blocker is paid verification through a funded local payer: a local CKB testnet address/key must be created without exposing secrets, funded, exported into the external Fiber node directory, used to start `fnn`, connected to public node1, brought to `CHANNEL_READY`, and used to pay a public node2 invoice. Only after that can FiberLatch verify a paid `payment_hash` and issue a receipt from the paid result.

Current honest claim:
FiberLatch has a Fiber v0.8.1-aligned verification adapter, a complete signed receipt lifecycle, public-node proof that unpaid Fiber testnet invoices can be created and queried without issuing receipts, and local Windows-native Fiber/CKB CLI tooling prepared outside the repo. Paid verification remains blocked on local account creation, funding, node startup, channel readiness, and payment execution.

Current dishonest claim:
FiberLatch verifies real Fiber testnet payments.

Next proof needed:
Create a secret-safe local CKB testnet account, capture only masked public address/lock_arg, export the key into the external Fiber node directory without printing it, fund the address, start `fnn`, connect to public node1, open a channel, wait for `CHANNEL_READY`, confirm route availability, make a real Fiber testnet payment, run FiberLatch verification against the resulting paid `payment_hash`, and record the sanitized receipt-issuance result.
