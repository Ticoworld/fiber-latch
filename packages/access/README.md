# FiberLatch Access

FiberLatch Access is the private, unpublished Node package delivered for the
FiberLatch Access grant. It provides a small package-root API for constructing,
signing, verifying, binding, and redeeming access receipts after a host has
established payment trust.

The grant implementation exists, but the package remains private and has not
been published to npm. It is built and packed locally for clean-consumer
verification.

## Runtime API

The primary package surface comprises five runtime operations and one type-only
contract:

| Operation | Responsibility |
| --- | --- |
| `buildAccessReceiptClaims` | Validate and return the canonical receipt claims object. |
| `createAccessReceiptSigner` | Create an Ed25519 signer from trusted private-key configuration. |
| `createAccessReceiptVerifier` | Create a verifier from trusted Ed25519 public keys, issuer, and audience. |
| `evaluateAccessReceiptBindings` | Purely compare verified claims with host subject, resource, policy, intent, and optional redemption-limit context. |
| `redeemAccessReceipt` | Verify a token, evaluate bindings, and call the host store's one atomic consume operation. |
| `AccessReceiptStore` (type-only) | Define the host-owned atomic consume boundary; this is not a shipped production adapter. |

The package also exports the type-only `AccessReceiptStore` contract. The host
implements its `consume` operation and owns authoritative persistence,
revocation, exhaustion, and concurrency. The package does not ship a
production database adapter.

`redeemAccessReceipt` does not verify payment or perform Fiber RPC. A signed
receipt is not payment proof, binding success does not itself grant access, and
the host remains responsible for the final protected-resource decision.

## Runtime and distribution boundary

- Minimum Node.js version: `>=22.12.0`.
- The package is native ESM.
- Supported CommonJS use relies on Node's `require(esm)` behaviour.
- Browser support is not included.
- `private: true` prevents accidental npm publication.
- The package can be packed locally, but no npm registry publication is
  claimed.
- Process-local memory is suitable for demonstrations only; it is not
  distributed replay protection.

## Repository and packed-tarball use

From the repository root, install the workspace and verify the package:

```sh
npm ci
npm run verify:access:package
```

For an isolated tarball check, build and pack from `packages/access`, then
install the generated tarball into a clean Node consumer. The repository's
distribution test and paid-resource acceptance already perform this packed
boundary verification; no registry package is required.

The paid-resource example is available at
[`examples/paid-resource`](../../examples/paid-resource), with its walkthrough
in [`examples/paid-resource/README.md`](../../examples/paid-resource/README.md).

Further reviewer material:

- [`docs/fiberlatch-access-verification.md`](../../docs/fiberlatch-access-verification.md)
- [`docs/fiberlatch-access-final-report.md`](../../docs/fiberlatch-access-final-report.md)
- [`docs/fiberlatch-access-grant-ledger.md`](../../docs/fiberlatch-access-grant-ledger.md)
