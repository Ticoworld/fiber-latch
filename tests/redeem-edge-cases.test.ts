import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestApp } from "./helpers/test-app";
import type { AccessReceiptSignInput } from "../src/integrations/receipts/access-receipt-signer";

describe("redeem edge cases", () => {
  let appContext: Awaited<ReturnType<typeof createTestApp>>;

  beforeAll(async () => {
    appContext = await createTestApp();
  });

  afterAll(async () => {
    if (appContext) {
      await appContext.cleanup();
    }
  });

  function baseSignInput(overrides: Partial<AccessReceiptSignInput> = {}): AccessReceiptSignInput {
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + 3600 * 1000);

    return {
      subjectId: "subject_edge_case",
      audience: appContext.runtimeConfig.audience,
      issuer: appContext.runtimeConfig.issuer,
      issuedAt,
      notBefore: issuedAt,
      expiresAt,
      jti: randomUUID(),
      intentId: `intent_${randomUUID()}`,
      resourceId: "resource:redeem-edge-case",
      policyId: `policy_${randomUUID()}`,
      paymentRef: null,
      grantType: "single_redemption",
      maxRedemptions: 1,
      ...overrides,
    };
  }

  it("returns a structured DENIED for a malformed token without a 400 or 500", async () => {
    const response = await appContext.app.inject({
      method: "POST",
      url: "/v1/receipts/redeem",
      payload: {
        receiptToken: "not-a-valid-jwt-token",
        resource: { key: "resource:redeem-edge-case", type: "CONTENT" },
        subject: { type: "END_USER", id: "subject_edge_case" },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      redemption: {
        status: "DENIED",
        accessGranted: false,
        receiptStatus: null,
        reason: "INVALID_RECEIPT_TOKEN",
      },
    });
  });

  it("denies redemption with RECEIPT_NOT_FOUND for a validly signed token with no matching receipt", async () => {
    const signed = await appContext.receiptSigner.sign(baseSignInput());

    const response = await appContext.app.inject({
      method: "POST",
      url: "/v1/receipts/redeem",
      payload: {
        receiptToken: signed.token,
        resource: { key: "resource:redeem-edge-case", type: "CONTENT" },
        subject: { type: "END_USER", id: "subject_edge_case" },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      redemption: {
        status: "DENIED",
        accessGranted: false,
        accessReceiptId: null,
        accessIntentId: null,
        receiptStatus: null,
        reason: "RECEIPT_NOT_FOUND",
      },
    });
  });

  it("denies redemption with RECEIPT_EXPIRED for a token whose JWT exp claim has already passed", async () => {
    const issuedAt = new Date(Date.now() - 7200 * 1000);
    const signed = await appContext.receiptSigner.sign(
      baseSignInput({
        issuedAt,
        notBefore: issuedAt,
        expiresAt: new Date(issuedAt.getTime() + 3600 * 1000),
      }),
    );

    const response = await appContext.app.inject({
      method: "POST",
      url: "/v1/receipts/redeem",
      payload: {
        receiptToken: signed.token,
        resource: { key: "resource:redeem-edge-case", type: "CONTENT" },
        subject: { type: "END_USER", id: "subject_edge_case" },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      redemption: {
        status: "DENIED",
        accessGranted: false,
        accessReceiptId: null,
        accessIntentId: null,
        receiptStatus: "EXPIRED",
        reason: "RECEIPT_EXPIRED",
      },
    });
  });

  it("denies redemption with RECEIPT_CLAIMS_INVALID for a token signed with an unexpected issuer", async () => {
    const signed = await appContext.receiptSigner.sign(
      baseSignInput({
        issuer: "untrusted-issuer:testnet",
      }),
    );

    const response = await appContext.app.inject({
      method: "POST",
      url: "/v1/receipts/redeem",
      payload: {
        receiptToken: signed.token,
        resource: { key: "resource:redeem-edge-case", type: "CONTENT" },
        subject: { type: "END_USER", id: "subject_edge_case" },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      redemption: {
        status: "DENIED",
        accessGranted: false,
        accessReceiptId: null,
        accessIntentId: null,
        receiptStatus: null,
        reason: "RECEIPT_CLAIMS_INVALID",
      },
    });
  });
});
