# Non-Goals

FiberLatch is intentionally narrow.

It is not:
- Spindle
- checkout
- POS
- a creator platform
- a merchant dashboard
- subscriptions
- refunds
- a generic payment gateway
- a raw Fiber RPC wrapper

What that means in practice:
- no checkout UX
- no merchant reporting or accounting
- no subscription billing logic
- no refund workflows
- no broad payment abstraction layer
- no public endpoint that exposes raw Fiber RPC responses

The only purpose of FiberLatch is to turn a verified payment signal into a signed access receipt, then let callers verify and redeem that receipt against a specific resource and subject.
