# Live Fiber Verification Status

This document records historical testnet proof for the FiberLatch backend and
its host-owned Fiber payment adapter. It does not describe a payment-verification
feature of `@fiberlatch/access`, which starts after a trusted payment or permission
decision. New package adopters should use the
[package guide](../packages/access/README.md).

## Historical Proof Status

The original live Fiber verification blocker has been resolved for a tiny testnet payment.

The historical backend proved this flow:

`paid Fiber payment -> signed access receipt -> one-time redemption`

A real paid Fiber testnet `payment_hash` was verified by the host-owned adapter through Fiber v0.8.1 RPC, converted into a signed access receipt, verified, redeemed once, and rejected on second redemption.

## What Was Previously Blocked

Earlier, FiberLatch could prove the local receipt lifecycle, but live Fiber payment verification was still blocked by testnet routing and payment settlement issues.

That meant the project could show:

- access intent creation
- receipt issuance logic
- receipt verification
- one-time redemption
- duplicate redemption rejection

But it could not yet honestly claim that a real paid Fiber testnet payment had been verified before issuing a receipt.

## What Is Proven Now

The live paid testnet path is now proven for a tiny payment.

This proves:

- Fiber payment status can be checked through Fiber v0.8.1 RPC
- a paid Fiber `payment_hash` can be used as the trigger for issuing an access receipt
- the signed receipt can be verified
- the receipt can be redeemed once
- duplicate redemption can be rejected

## What Is Still Not Proven

This does not prove:

- production readiness
- mainnet readiness
- merchant checkout readiness
- generalized payment gateway behavior
- refund handling
- subscription handling
- long-running hosted reliability
- full frontend user experience

## Current Safe Claim

The historical FiberLatch backend proves a full testnet flow where its host-owned adapter verifies a live paid Fiber `payment_hash` through Fiber v0.8.1 RPC before receipt issuance, verification, one-time redemption, and rejection on second redemption. This does not make the published access package a payment verifier.

This is testnet-only proof. Production and mainnet readiness are not claimed.
