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

FiberLatch Access starts after the host application has already trusted a payment
or permission decision. It turns that trusted decision into a signed, scoped
access receipt that callers can verify and redeem against host-supplied bindings.
Payment trust remains host-owned. Fiber payments were the original project
context; the historical backend's payment adapter is not part of the published
access package. See the [package guide](../packages/access/README.md).
