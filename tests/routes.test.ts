import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestApp } from "./helpers/test-app";

describe("phase 3 routes", () => {
  let appContext: Awaited<ReturnType<typeof createTestApp>>;

  beforeAll(async () => {
    appContext = await createTestApp();
  });

  afterAll(async () => {
    if (appContext) {
      await appContext.cleanup();
    }
  });

  it("serves versioned public routes and rejects the old unversioned intent path", async () => {
    const oldRoute = await appContext.app.inject({
      method: "POST",
      url: "/access-intents",
      payload: {},
    });

    expect(oldRoute.statusCode).toBe(404);

    const health = await appContext.app.inject({
      method: "GET",
      url: "/health",
    });

    expect(health.statusCode).toBe(200);
    expect(health.json()).toMatchObject({
      ok: true,
      service: "fiber-latch",
      phase: "phase-3",
      network: "testnet",
    });
  });

  it("returns 404 for a missing access intent", async () => {
    const response = await appContext.app.inject({
      method: "GET",
      url: "/v1/access-intents/missing-intent-id",
    });

    expect(response.statusCode).toBe(404);
  });

  it("returns the existing intent for a repeated idempotency key", async () => {
    const payload = {
      resource: {
        key: "resource:idempotent",
        type: "CONTENT",
      },
      subject: {
        type: "END_USER",
        id: "subject_idempotent",
      },
      paymentRef: "unpaid:invoice_idempotent",
      idempotencyKey: "intent-idempotency-key-001",
    };

    const firstResponse = await appContext.app.inject({
      method: "POST",
      url: "/v1/access-intents",
      payload,
    });
    const secondResponse = await appContext.app.inject({
      method: "POST",
      url: "/v1/access-intents",
      payload,
    });

    expect(firstResponse.statusCode).toBe(201);
    expect(secondResponse.statusCode).toBe(200);

    const first = firstResponse.json() as {
      accessIntent: { id: string; status: string };
    };
    const second = secondResponse.json() as {
      accessIntent: { id: string; status: string };
    };

    expect(second.accessIntent.id).toBe(first.accessIntent.id);
    expect(second.accessIntent.status).toBe(first.accessIntent.status);

    const storedCount = await appContext.prisma.accessIntent.count({
      where: {
        idempotencyKey: "intent-idempotency-key-001",
      },
    });

    expect(storedCount).toBe(1);
  });

  it("persists an access intent and issues a receipt for a paid fake payment", async () => {
    const createResponse = await appContext.app.inject({
      method: "POST",
      url: "/v1/access-intents",
      payload: {
        resource: {
          key: "resource:alpha",
          type: "CONTENT",
        },
        subject: {
          type: "END_USER",
          id: "subject_123",
        },
        paymentRef: "paid:invoice_001",
      },
    });

    expect(createResponse.statusCode).toBe(201);
    const created = createResponse.json() as {
      accessIntent: {
        id: string;
        status: string;
        paymentRef: string | null;
        accessReceipt: {
          id: string;
          receiptToken: string | null;
          status: string;
        } | null;
      };
    };

    expect(created.accessIntent.status).toBe("RECEIPT_ISSUED");
    expect(created.accessIntent.paymentRef).toBe("paid:invoice_001");
    expect(created.accessIntent.accessReceipt).not.toBeNull();
    expect(created.accessIntent.accessReceipt?.receiptToken).toEqual(expect.any(String));

    const getResponse = await appContext.app.inject({
      method: "GET",
      url: `/v1/access-intents/${created.accessIntent.id}`,
    });

    expect(getResponse.statusCode).toBe(200);
    expect(getResponse.json()).toMatchObject({
      accessIntent: {
        id: created.accessIntent.id,
        status: "RECEIPT_ISSUED",
        resource: {
          key: "resource:alpha",
          type: "CONTENT",
        },
        subject: {
          type: "END_USER",
          id: "subject_123",
        },
        paymentRef: "paid:invoice_001",
      },
    });
  });

  it("returns a real JWKS document", async () => {
    const response = await appContext.app.inject({
      method: "GET",
      url: "/.well-known/jwks.json",
    });

    expect(response.statusCode).toBe(200);
    const jwks = response.json() as { keys: Array<Record<string, unknown>> };
    expect(jwks.keys.length).toBe(1);
    expect(jwks.keys[0]).toMatchObject({
      kty: "OKP",
      alg: "EdDSA",
      use: "sig",
      kid: expect.any(String),
      crv: "Ed25519",
      x: expect.any(String),
    });
  });

  it("verifies a valid receipt token", async () => {
    const createResponse = await appContext.app.inject({
      method: "POST",
      url: "/v1/access-intents",
      payload: {
        resource: {
          key: "resource:beta",
          type: "FILE",
        },
        subject: {
          type: "SERVICE_ACCOUNT",
          id: "svc_001",
        },
        paymentRef: "paid:invoice_002",
      },
    });

    const created = createResponse.json() as {
      accessIntent: {
        accessReceipt: {
          receiptToken: string;
        } | null;
      };
    };

    const receiptToken = created.accessIntent.accessReceipt?.receiptToken;
    expect(receiptToken).toEqual(expect.any(String));

    const verifyResponse = await appContext.app.inject({
      method: "POST",
      url: "/v1/receipts/verify",
      payload: {
        receiptToken,
      },
    });

    expect(verifyResponse.statusCode).toBe(200);
    expect(verifyResponse.json()).toMatchObject({
      receiptVerification: {
        verified: true,
        receiptStatus: "ISSUED",
        reason: null,
      },
    });
  });

  it("redeems a receipt atomically and exhausts it after one use", async () => {
    const createResponse = await appContext.app.inject({
      method: "POST",
      url: "/v1/access-intents",
      payload: {
        resource: {
          key: "resource:gamma",
          type: "API",
        },
        subject: {
          type: "END_USER",
          id: "subject_456",
        },
        paymentRef: "paid:invoice_003",
      },
    });

    const created = createResponse.json() as {
      accessIntent: {
        id: string;
        accessReceipt: {
          id: string;
          receiptToken: string;
        } | null;
      };
    };

    const receiptToken = created.accessIntent.accessReceipt?.receiptToken;
    expect(receiptToken).toEqual(expect.any(String));

    const firstRedemption = await appContext.app.inject({
      method: "POST",
      url: "/v1/receipts/redeem",
      payload: {
        receiptToken,
        resource: {
          key: "resource:gamma",
          type: "API",
        },
        subject: {
          type: "END_USER",
          id: "subject_456",
        },
      },
    });

    expect(firstRedemption.statusCode).toBe(200);
    expect(firstRedemption.json()).toMatchObject({
      redemption: {
        status: "GRANTED",
        accessGranted: true,
        receiptStatus: "EXHAUSTED",
        redemptionCount: 1,
        maxRedemptions: 1,
        reason: null,
      },
    });

    const secondRedemption = await appContext.app.inject({
      method: "POST",
      url: "/v1/receipts/redeem",
      payload: {
        receiptToken,
        resource: {
          key: "resource:gamma",
          type: "API",
        },
        subject: {
          type: "END_USER",
          id: "subject_456",
        },
      },
    });

    expect(secondRedemption.statusCode).toBe(200);
    expect(secondRedemption.json()).toMatchObject({
      redemption: {
        status: "DENIED",
        accessGranted: false,
        receiptStatus: "EXHAUSTED",
        reason: "RECEIPT_NOT_ACTIVE",
      },
    });

    const receiptRecord = await appContext.prisma.accessReceipt.findUnique({
      where: {
        id: created.accessIntent.accessReceipt!.id,
      },
    });

    expect(receiptRecord).not.toBeNull();
    expect(receiptRecord).toMatchObject({
      redemptionCount: 1,
      active: false,
      status: "EXHAUSTED",
    });
  });

  it(
    "rejects an expired receipt during verification",
    async () => {
      const shortLivedContext = await createTestApp({
        receiptTtlSeconds: 1,
      });

      try {
        const createResponse = await shortLivedContext.app.inject({
          method: "POST",
          url: "/v1/access-intents",
          payload: {
            resource: {
              key: "resource:delta",
              type: "CONTENT",
            },
            subject: {
              type: "END_USER",
              id: "subject_789",
            },
            paymentRef: "paid:invoice_004",
          },
        });

        const created = createResponse.json() as {
          accessIntent: {
            accessReceipt: {
              receiptToken: string;
            } | null;
          };
        };

        const receiptToken = created.accessIntent.accessReceipt?.receiptToken;
        expect(receiptToken).toEqual(expect.any(String));

        await new Promise((resolve) => setTimeout(resolve, 1100));

        const verifyResponse = await shortLivedContext.app.inject({
          method: "POST",
          url: "/v1/receipts/verify",
          payload: {
            receiptToken,
          },
        });

        expect(verifyResponse.statusCode).toBe(200);
        expect(verifyResponse.json()).toMatchObject({
          receiptVerification: {
            verified: false,
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
