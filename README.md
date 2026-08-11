# FiberLatch

FiberLatch is a Node.js access-receipt project for the boundary after a host
application has already established payment or business trust. Its reusable
package, `@fiberlatch/access`, signs and verifies receipts, checks them against
trusted host context, and coordinates one redemption through host-owned
storage.

It is useful when a service needs to turn an already-trusted entitlement into
bounded access to a protected resource without coupling the access boundary to
a web framework, payment SDK, or database.

## Install

```sh
npm install @fiberlatch/access
```

The package supports Node.js `>=22.12.0`. It is native ESM, with supported
CommonJS package-root usage through Node's `require(esm)` behavior. There is no
browser runtime.

## 60-second model

```text
trusted host payment/business decision
            |
            v
build canonical claims -> sign access receipt
            |
            v
client presents bearer receipt
            |
            v
verify -> bind to trusted context -> atomically redeem
            |
            v
host serves or denies the protected resource
```

FiberLatch Access does not decide whether payment happened. The host makes
that decision before issuance and keeps the final serve-or-deny decision.

## Package preview

The package-root API is framework-independent:

```js
import {
  buildAccessReceiptClaims,
  createAccessReceiptSigner,
  createAccessReceiptVerifier,
  redeemAccessReceipt,
} from "@fiberlatch/access";
```

The normal flow is to build canonical claims after the host trusts an
entitlement, sign them with a trusted Ed25519 key, then redeem the bearer
receipt against trusted request context and an authoritative host store.

See the [FiberLatch Access package guide](packages/access/README.md) for the
complete issuance, redemption, error, store, and CommonJS documentation.

## What FiberLatch Access provides

- Canonical access-receipt claim validation
- Ed25519 receipt signing and verification
- Binding evaluation against trusted subject, resource, policy, and intent
  context
- Redemption orchestration through a host-owned atomic `AccessReceiptStore`
- Typed success, denial, and fail-closed system results

## Responsibility boundary

FiberLatch Access owns the receipt boundary. The host owns the surrounding
business and persistence decisions.

| FiberLatch Access | Host application |
| --- | --- |
| Claim validation | Payment or business verification |
| Ed25519 signing and verification | Subject and identity decisions |
| Trusted binding evaluation | Resource, policy, and intent meaning |
| Redemption orchestration | Trusted key configuration |
| Store command/result boundary | Persistence, revocation, and authoritative counts |
| Fail-closed redemption result mapping | Final resource access decision |

`payment_ref` is correlation metadata, not payment proof. The package does not
perform payment verification, call Fiber RPC during normal verification or
redemption, persist receipts, revoke receipts, or ship a production database
adapter.

## Runnable example

The [paid-resource example](examples/paid-resource) is the complete executable
integration path. It demonstrates a host-owned trusted payment fixture,
receipt issuance, a protected-resource request, first-use success, replay
denial, and the single-process atomic consume semantics of its demonstration
store.

The example is intentionally honest: its payment fixture is not a real Fiber
payment, and its in-memory store is not distributed replay protection.

## Runtime and limitations

- Node.js `>=22.12.0`
- Native ESM, with supported package-root CommonJS usage on compatible Node
  versions
- No browser runtime
- No payment verification inside `@fiberlatch/access`
- No normal-redemption Fiber RPC call
- No production database adapter
- No distributed replay-protection implementation
- No production-readiness or mainnet-readiness claim
- No formal security-audit claim

## Development

The repository also contains the historical FiberLatch backend and the
reusable access package. From a fresh checkout, the focused development path
is:

```sh
npm ci
npm run prisma:generate
npm test
npm run build
npm run verify:access:package
npm run verify:access:example
```

Package adopters should use npm. Contributors can inspect the package source
under `packages/access/src`, its tests under `packages/access/test`, and the
integration example under `examples/paid-resource`.

Report product bugs or documentation issues through
[GitHub Issues](https://github.com/Ticoworld/fiber-latch/issues).

## Project records

Grant and implementation records remain available for readers who need the
project history or delivery evidence. They are not required to install or use
the package.

- [Approved proposal](https://talk.nervos.org/t/dis-fiberlatch-access-open-source-access-control-for-fiber-payments/10414)
- [Weeks 1-2 public update](https://talk.nervos.org/t/dis-fiberlatch-access-open-source-access-control-for-fiber-payments/10414/4?u=ticoworld)
- [Weeks 3-4 public update](https://talk.nervos.org/t/dis-fiberlatch-access-open-source-access-control-for-fiber-payments/10414/5?u=ticoworld)
- [Package verification guide](docs/fiberlatch-access-verification.md)
- [Final/pre-final delivery report](docs/fiberlatch-access-final-report.md)
- [Grant ledger](docs/fiberlatch-access-grant-ledger.md)
- [Access specifications](docs/fiberlatch-access-scope.md)

D1-D6 remain recorded as VERIFIED COMPLETE. D7 remains IN PROGRESS - FINAL
WEEKS 5-6 VERIFICATION PENDING.

## License

ISC. See [LICENSE](LICENSE).
