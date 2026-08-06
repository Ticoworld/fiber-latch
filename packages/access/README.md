# FiberLatch Access

FiberLatch Access is a Node package under implementation. This checkpoint provides package-owned receipt claim construction and validation, Ed25519 receipt signing, Ed25519 receipt verification, pure binding evaluation, and a type-only atomic store contract.

- `@fiberlatch/access` is a provisional package name.
- `private: true` prevents accidental publication.
- The package may still be packed locally for verification.
- `redeemAccessReceipt` orchestration, production persistence adapters, and backend integration are not available yet.
- `AccessReceiptStore` is a host-implemented atomic boundary; the package does not ship a production database adapter.
- Process-local memory is not production replay protection.
- Binding success does not itself grant access, and signed receipts do not replace persisted authority.
- The paid-resource example is not available yet.
- Minimum Node version: `>=22.12.0`.
- Implementation format: native ESM.
- Supported CommonJS hosts use Node's `require(esm)` behavior.
- Browser support is not included.
- Package publication has not occurred.
- The backend remains the reference implementation.

The committed consumer fixtures exercise the public claim, signing, verification, binding, and type-only store contract through the package boundary.
