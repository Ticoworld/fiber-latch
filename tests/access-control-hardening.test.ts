import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestApp } from "./helpers/test-app";

describe("phase 5 access-control hardening", () => {
  let appContext: Awaited<ReturnType<typeof createTestApp>>;

  beforeAll(async () => {
    appContext = await createTestApp();
  });

  afterAll(async () => {
    if (appContext) {
      await appContext.cleanup();
    }
  });

  async function issueReceipt(
    resourceKey: string,
    resourceType: "CONTENT" | "FILE" | "API",
    subject: { type: "END_USER" | "SERVICE_ACCOUNT"; id: string },
    paymentRef: string,
  ) {
    const createResponse = await appContext.app.inject({
      method: "POST",
      url: "/v1/access-intents",
      payload: {
        resource: { key: resourceKey, type: resourceType },
        subject,
        paymentRef,
      },
    });

    expect(createResponse.statusCode).toBe(201);

    const created = createResponse.json() as {
      accessIntent: {
        accessReceipt: {
          id: string;
          receiptToken: string | null;
        } | null;
      };
    };

    const receiptToken = created.accessIntent.accessReceipt?.receiptToken;
    expect(receiptToken).toEqual(expect.any(String));

    return {
      receiptToken: receiptToken as string,
      accessReceiptId: created.accessIntent.accessReceipt!.id,
    };
  }

  it("denies redemption when the requested resource does not match the receipt claims", async () => {
    const { receiptToken } = await issueReceipt(
      "resource:phase5-resource-a",
      "CONTENT",
      { type: "END_USER", id: "subject_phase5_resource" },
      "paid:phase5-resource-mismatch",
    );

    const redemption = await appContext.app.inject({
      method: "POST",
      url: "/v1/receipts/redeem",
      payload: {
        receiptToken,
        resource: { key: "resource:phase5-resource-b", type: "CONTENT" },
        subject: { type: "END_USER", id: "subject_phase5_resource" },
      },
    });

    expect(redemption.statusCode).toBe(200);
    expect(redemption.json()).toMatchObject({
      redemption: {
        status: "DENIED",
        accessGranted: false,
        reason: "RECEIPT_CLAIMS_MISMATCH",
      },
    });
  });

  it("denies redemption when the requested subject does not match the receipt claims", async () => {
    const { receiptToken } = await issueReceipt(
      "resource:phase5-subject",
      "CONTENT",
      { type: "END_USER", id: "subject_phase5_a" },
      "paid:phase5-subject-mismatch",
    );

    const redemption = await appContext.app.inject({
      method: "POST",
      url: "/v1/receipts/redeem",
      payload: {
        receiptToken,
        resource: { key: "resource:phase5-subject", type: "CONTENT" },
        subject: { type: "END_USER", id: "subject_phase5_b" },
      },
    });

    expect(redemption.statusCode).toBe(200);
    expect(redemption.json()).toMatchObject({
      redemption: {
        status: "DENIED",
        accessGranted: false,
        reason: "RECEIPT_CLAIMS_MISMATCH",
      },
    });
  });

  it("denies redemption of a revoked receipt", async () => {
    const subject = { type: "END_USER" as const, id: "subject_phase5_revoked" };
    const { receiptToken, accessReceiptId } = await issueReceipt(
      "resource:phase5-revoked",
      "CONTENT",
      subject,
      "paid:phase5-revoked",
    );

    await appContext.prisma.accessReceipt.update({
      where: { id: accessReceiptId },
      data: {
        status: "REVOKED",
        active: false,
        revokedAt: new Date(),
      },
    });

    const redemption = await appContext.app.inject({
      method: "POST",
      url: "/v1/receipts/redeem",
      payload: {
        receiptToken,
        resource: { key: "resource:phase5-revoked", type: "CONTENT" },
        subject,
      },
    });

    expect(redemption.statusCode).toBe(200);
    expect(redemption.json()).toMatchObject({
      redemption: {
        status: "DENIED",
        accessGranted: false,
        receiptStatus: "REVOKED",
        reason: "RECEIPT_NOT_ACTIVE",
      },
    });
  });

  it("returns verified: false for a malformed receipt token without throwing", async () => {
    const verifyResponse = await appContext.app.inject({
      method: "POST",
      url: "/v1/receipts/verify",
      payload: {
        receiptToken: "not-a-valid-jwt-token",
      },
    });

    expect(verifyResponse.statusCode).toBe(200);
    expect(verifyResponse.json()).toMatchObject({
      receiptVerification: {
        verified: false,
        accessReceiptId: null,
        accessIntentId: null,
        receiptStatus: null,
        reason: "INVALID_RECEIPT_TOKEN",
      },
    });
  });

  it(
    "allows redemption up to maxRedemptions and denies the redemption beyond it",
    async () => {
      const multiRedeemContext = await createTestApp({
        defaultMaxRedemptions: 2,
      });

      try {
        const subject = { type: "END_USER" as const, id: "subject_phase5_multi" };
        const createResponse = await multiRedeemContext.app.inject({
          method: "POST",
          url: "/v1/access-intents",
          payload: {
            resource: { key: "resource:phase5-multi", type: "CONTENT" },
            subject,
            paymentRef: "paid:phase5-multi",
          },
        });

        expect(createResponse.statusCode).toBe(201);
        const created = createResponse.json() as {
          accessIntent: {
            accessReceipt: { receiptToken: string | null } | null;
          };
        };
        const receiptToken = created.accessIntent.accessReceipt?.receiptToken;
        expect(receiptToken).toEqual(expect.any(String));

        const redeemPayload = {
          receiptToken,
          resource: { key: "resource:phase5-multi", type: "CONTENT" as const },
          subject,
        };

        const firstRedemption = await multiRedeemContext.app.inject({
          method: "POST",
          url: "/v1/receipts/redeem",
          payload: redeemPayload,
        });

        expect(firstRedemption.statusCode).toBe(200);
        expect(firstRedemption.json()).toMatchObject({
          redemption: {
            status: "GRANTED",
            accessGranted: true,
            receiptStatus: "ISSUED",
            redemptionCount: 1,
            maxRedemptions: 2,
            reason: null,
          },
        });

        const secondRedemption = await multiRedeemContext.app.inject({
          method: "POST",
          url: "/v1/receipts/redeem",
          payload: redeemPayload,
        });

        expect(secondRedemption.statusCode).toBe(200);
        expect(secondRedemption.json()).toMatchObject({
          redemption: {
            status: "GRANTED",
            accessGranted: true,
            receiptStatus: "EXHAUSTED",
            redemptionCount: 2,
            maxRedemptions: 2,
            reason: null,
          },
        });

        const thirdRedemption = await multiRedeemContext.app.inject({
          method: "POST",
          url: "/v1/receipts/redeem",
          payload: redeemPayload,
        });

        expect(thirdRedemption.statusCode).toBe(200);
        expect(thirdRedemption.json()).toMatchObject({
          redemption: {
            status: "DENIED",
            accessGranted: false,
            receiptStatus: "EXHAUSTED",
            redemptionCount: 2,
            maxRedemptions: 2,
            reason: "RECEIPT_NOT_ACTIVE",
          },
        });
      } finally {
        await multiRedeemContext.cleanup();
      }
    },
    10000,
  );

  it(
    "denies redemption of an expired receipt",
    async () => {
      const shortLivedContext = await createTestApp({
        receiptTtlSeconds: 1,
      });

      try {
        const subject = { type: "END_USER" as const, id: "subject_phase5_expired" };
        const createResponse = await shortLivedContext.app.inject({
          method: "POST",
          url: "/v1/access-intents",
          payload: {
            resource: { key: "resource:phase5-expired", type: "CONTENT" },
            subject,
            paymentRef: "paid:phase5-expired",
          },
        });

        expect(createResponse.statusCode).toBe(201);
        const created = createResponse.json() as {
          accessIntent: {
            accessReceipt: { receiptToken: string | null } | null;
          };
        };
        const receiptToken = created.accessIntent.accessReceipt?.receiptToken;
        expect(receiptToken).toEqual(expect.any(String));

        await new Promise((resolve) => setTimeout(resolve, 1100));

        const redemption = await shortLivedContext.app.inject({
          method: "POST",
          url: "/v1/receipts/redeem",
          payload: {
            receiptToken,
            resource: { key: "resource:phase5-expired", type: "CONTENT" },
            subject,
          },
        });

        expect(redemption.statusCode).toBe(200);
        expect(redemption.json()).toMatchObject({
          redemption: {
            status: "DENIED",
            accessGranted: false,
            receiptStatus: "EXPIRED",
            reason: "RECEIPT_EXPIRED",
          },
        });
      } finally {
        await shortLivedContext.cleanup();
      }
    },
    10000,
  );
});
