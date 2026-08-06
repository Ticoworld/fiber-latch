# FiberLatch Access

FiberLatch Access is a Node package under implementation. This checkpoint provides package-owned receipt claim construction and validation, Ed25519 receipt signing, and Ed25519 receipt verification.

- `@fiberlatch/access` is a provisional package name.
- `private: true` prevents accidental publication.
- The package may still be packed locally for verification.
- Binding evaluation, atomic redemption, and the `AccessReceiptStore` implementation are not available yet.
- The paid-resource example is not available yet.
- Minimum Node version: `>=22.12.0`.
- Implementation format: native ESM.
- Supported CommonJS hosts use Node's `require(esm)` behavior.
- Browser support is not included.
- Package publication has not occurred.
- The backend remains the reference implementation.

The committed consumer fixtures exercise the public claim, signing, and verification operations through the package boundary.
