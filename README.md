# FiberLatch

FiberLatch helps a Node.js app turn a trusted payment or permission decision
into a signed receipt for limited access to a protected resource. Its reusable
package, `@fiberlatch/access`, creates and checks receipts while your app keeps
control of payment trust, storage, and the final decision to serve the
resource.

FiberLatch does not verify that a payment happened. Your app makes that
decision first, then uses FiberLatch to issue and safely check access later.

## Install

```sh
npm install @fiberlatch/access
```

The package supports Node.js `>=22.12.0`. It is native ESM, with supported
CommonJS package-root usage through Node's `require(esm)` behavior. There is no
browser runtime.

## Why use FiberLatch?

Use FiberLatch when your app needs to give limited access after it has already
trusted a payment or another business decision, such as:

- a paid API or private service
- a paid article, file, or download
- access to a course or module
- one-time or limited-use access

It handles the signed receipt, checks that the receipt matches the expected
user and resource, returns clear allow-or-deny results, and gives your app a
safe store boundary for recording use. Your app still owns payment
verification, trusted storage, revocation, and the final serve-or-deny
decision.

## 60-second model

```text
your app decides access should be granted
            |
            v
create and sign receipt
            |
            v
client presents receipt later
            |
            v
check receipt and expected user/resource/rules
            |
            v
your app records one use safely, then serves or denies the resource
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

The normal flow is to build receipt claims after your app trusts a payment or
permission decision, sign them with a trusted Ed25519 key, then check the
receipt against trusted request context and record its use in your app's store.

See the [FiberLatch Access package guide](packages/access/README.md) for the
complete issuance, redemption, error, store, and CommonJS documentation.

## What FiberLatch Access provides

- Access-receipt claim validation
- Ed25519 receipt signing and verification
- Checks that a receipt matches the trusted subject, resource, policy, and
  intent context
- Safe use recording through your app's atomic `AccessReceiptStore`
- Typed success, denial, and fail-closed system results

## Responsibility boundary

FiberLatch Access owns the receipt boundary. The host owns the surrounding
business and persistence decisions.

| FiberLatch Access | Host application |
| --- | --- |
| Receipt claim validation | Payment or business verification |
| Ed25519 signing and verification | Subject and identity decisions |
| Receipt matching against trusted context | Resource, policy, and intent meaning |
| Redemption result boundary | Trusted key configuration |
| Store command/result boundary | Storage, revocation, and redemption counts |
| Fail-closed redemption result mapping | Final resource access decision |

`payment_ref` is a reference that can link a receipt to a payment record, not
payment proof. The package does not perform payment verification, call Fiber
RPC during normal verification or redemption, persist receipts, revoke
receipts, or ship a production database adapter.

## Runnable example

The [paid-resource example](examples/paid-resource) is the complete executable
integration path. It demonstrates server-side demo data for a payment the app
already trusts, receipt issuance, a protected-resource request, first-use
success, replay denial, and the single-process atomic consume behavior of its
demonstration store.

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

## Project history

Project and delivery records are available for reviewers and contributors.
They are not required to install or use the package.

- [Approved proposal](https://talk.nervos.org/t/dis-fiberlatch-access-open-source-access-control-for-fiber-payments/10414)
- [Weeks 1-2 public update](https://talk.nervos.org/t/dis-fiberlatch-access-open-source-access-control-for-fiber-payments/10414/4?u=ticoworld)
- [Weeks 3-4 public update](https://talk.nervos.org/t/dis-fiberlatch-access-open-source-access-control-for-fiber-payments/10414/5?u=ticoworld)
- [Package verification guide](docs/fiberlatch-access-verification.md)
- [Final/pre-final delivery report](docs/fiberlatch-access-final-report.md)
- [Grant ledger](docs/fiberlatch-access-grant-ledger.md)
- [Access specifications](docs/fiberlatch-access-scope.md)

## License

ISC. See [LICENSE](LICENSE).
