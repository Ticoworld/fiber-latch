# FiberLatch Access Receipt Format

## Purpose

A FiberLatch Access receipt is a signed JWT that represents access your app has
already decided to grant. It is not proof that a payment happened, and it does
not make the final decision to serve a resource. Your app establishes payment
or business trust before issuing a receipt, keeps its own trusted state, and
makes the final access decision.

The package validates receipt claims before signing them and validates the
signed claims again after verification.

## Claim set

Every canonical package claim set has these claims. There are no optional
canonical claims. `payment_ref` is required, but its value may be `null`.

| Claim | Type | Rule and meaning |
| --- | --- | --- |
| `iss` | non-empty string | Trusted issuer identifier. |
| `sub` | non-empty string | Subject receiving access. |
| `aud` | non-empty string | Intended audience for the receipt. |
| `iat` | integer | Issued-at time in Unix seconds. |
| `nbf` | integer | Not-before time in Unix seconds. |
| `exp` | integer | Expiration time in Unix seconds. |
| `jti` | non-empty string | Stable receipt identity used by your app's receipt state. |
| `intent_id` | non-empty string | Your app's access-intent identifier. |
| `resource_id` | non-empty string | Your app's protected-resource identifier. |
| `policy_id` | non-empty string | Your app's access-policy identifier. |
| `payment_ref` | string or `null` | Correlation value for a host payment record. It is not payment proof. |
| `grant_type` | `single_redemption` or `multi_redemption` | Declares the redemption model. |
| `max_redemptions` | positive integer | Maximum permitted redemptions. |

The claim builder requires these relationships:

```text
iat <= nbf < exp
single_redemption => max_redemptions = 1
multi_redemption  => max_redemptions > 1
```

## Creating claims

Use `buildAccessReceiptClaims` with values from trusted application context.
It rejects missing required claims, invalid types, empty identifiers, invalid
time relationships, and inconsistent redemption settings with
`AccessReceiptValidationError`.

Unknown properties are stripped from the canonical claim object. They are not
signed as FiberLatch receipt claims and are not returned by the verifier as
trusted claims.

The signer validates its input again before producing a receipt. Supplying a
previously built claim object is the normal path, but the second validation
prevents malformed values from being signed if untyped runtime input reaches
the signer.

## What a receipt proves

A successfully verified receipt proves only that a configured trusted issuer
signed this claim set for the configured audience and that its cryptographic
and claim checks passed. It does not prove that a client paid, that the receipt
has not already been used, or that your app should serve a resource.

Before redemption, your app must supply expected values from trusted request
and application context. The package checks `sub`, `resource_id`, `policy_id`,
and `intent_id`, plus `max_redemptions` when your app supplies that limit. Do
not copy expected values from the bearer receipt itself.

Replay protection and final authorization require your app's trusted storage
and policy decision. They are described in
[Expiration and Replay Rules](fiberlatch-access-expiration-replay.md).

## Compatibility boundary

The package accepts and returns only the canonical claims above. A receipt
that is missing a required claim, has malformed values, violates the claim
relationships, or fails signature or time verification is denied. Receipt
extensions are not part of this format; unknown payload properties are not
trusted package claims.

This format does not define payment settlement, payment routing, user
management, a database schema, or an HTTP response format.
