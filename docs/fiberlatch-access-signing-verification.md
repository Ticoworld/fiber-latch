# FiberLatch Access Signing and Verification Rules

## Purpose

FiberLatch Access signs and verifies compact JWT access receipts using Ed25519
keys and the JOSE `EdDSA` algorithm. Verification establishes that a receipt
matches configured cryptographic and claim policy. It does not verify a
payment, consume a receipt, or make the final access decision.

## Trusted key configuration

Create a signer with a trusted private JWK and a verifier with trusted public
JWKs, a trusted issuer, and a trusted audience.

Private and public keys must be JWK objects with:

- `kty: "OKP"`;
- `crv: "Ed25519"`;
- a non-empty `kid`; and
- a valid 32-byte base64url public value in `x`.

A private key must also contain a valid 32-byte base64url `d`. A public key
must not contain `d`. If present, `alg` must be `EdDSA`, `use` must be `sig`,
and `key_ops` must permit the required signing or verification operation.

Verifier public-key `kid` values must be unique. The verifier selects a key
only from this configured trusted set. It does not discover keys from a token
or network location.

Invalid signer or verifier configuration throws
`AccessReceiptConfigurationError` with developer-facing issue paths and
reasons. This includes malformed keys, an empty key list, duplicate key IDs,
empty issuer or audience, unsupported configuration properties, and invalid
clock-tolerance or token-size options.

## Signing

`createAccessReceiptSigner({ privateKey })` imports the trusted Ed25519 private
key and returns an async signer. The signer validates claims with
`buildAccessReceiptClaims` before signing, then creates a JWT with this
protected header:

```json
{ "alg": "EdDSA", "typ": "JWT", "kid": "configured-key-id" }
```

Malformed or inconsistent claims cause `AccessReceiptValidationError`; they
are not signed. The package does not generate, store, rotate, or publish keys.
Your app is responsible for securely providing its long-lived signing material.

## Verification

`createAccessReceiptVerifier({ publicKeys, issuer, audience, ... })` returns
an async verifier. For each receipt it:

1. requires a compact three-segment base64url token within the configured size
   limit (4 KiB by default; 256 through 16,384 bytes when configured);
2. accepts only the protected-header keys `alg`, `typ`, and `kid`;
3. requires `alg: "EdDSA"`, `typ: "JWT"`, and a non-empty `kid` found in the
   configured trusted key set;
4. verifies the signature with that trusted Ed25519 public key;
5. checks the configured issuer and audience;
6. checks `nbf` and `exp`, with an optional tolerance from zero to 60 seconds;
   and
7. requires and canonicalizes every receipt claim described in the receipt
   format.

The verifier rejects malformed tokens, unsupported headers, tampered
signatures, wrong issuer or audience, expired or not-yet-valid receipts,
unknown keys, and malformed or inconsistent claims. Unknown payload properties
are stripped from the successful claim result.

## Failure behavior

An untrusted receipt fails with the generic
`AccessReceiptVerificationError`. Its stable public message and code do not
expose cryptographic failure details, key details, or parsed receipt claims.

Configuration and claim-construction problems are different: they are
developer-facing `AccessReceiptConfigurationError` and
`AccessReceiptValidationError` values with structured issues. Applications
should correct those trusted setup or issuance inputs rather than return their
details to a bearer-token client.

When using `redeemAccessReceipt`, an ordinary verification denial becomes
`{ status: "verification_denied", phase: "verification" }`. Unexpected
verifier failures become `system_failure`, which must fail closed.

## Boundaries

The verifier does not fetch remote JWKs, use token-controlled key URLs, host a
JWKS endpoint, rotate keys, manage production keys, verify payments, call
Fiber RPC, or support a browser runtime. It also does not replace your app's
trusted binding checks, receipt store, replay protection, or final resource
decision.

For receipt fields and claim relationships, see
[Receipt Format](fiberlatch-access-receipt-format.md). For host-owned expiry,
replay protection, and consumption, see
[Expiration and Replay Rules](fiberlatch-access-expiration-replay.md).
