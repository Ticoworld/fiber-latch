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

The blocker is no longer "no public endpoint can be reached." The exact remaining blocker is paid verification: a real paid Fiber testnet `payment_hash` must be produced through a safe payer setup and then verified by FiberLatch so that receipt issuance is driven by the paid Fiber result.

Current honest claim:
FiberLatch has a Fiber v0.8.1-aligned verification adapter, a complete signed receipt lifecycle, and public-node proof that unpaid Fiber testnet invoices can be created and queried without issuing receipts.

Current dishonest claim:
FiberLatch verifies real Fiber testnet payments.

Next proof needed:
Use a safe payer setup with channel readiness, route availability, and liquidity to make a real Fiber testnet payment, then run FiberLatch verification against the resulting paid `payment_hash` and record the sanitized receipt-issuance result.
