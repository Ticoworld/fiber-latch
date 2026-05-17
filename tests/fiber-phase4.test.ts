import { afterEach, describe, expect, it } from "vitest";
import { createRealFiberClient } from "../src/integrations/fiber/real-fiber-client";
import { mapFiberRawStatus } from "../src/integrations/fiber/fiber-status-mapper";
import { FiberReconciliationWorker } from "../src/workers/fiber-reconciliation-worker";
import { createTestApp } from "./helpers/test-app";
import { createScriptedFiberClient } from "./helpers/scripted-fiber-client";

describe("phase 4 fiber reconciliation", () => {
  afterEach(() => {
    delete process.env.FIBER_RPC_URL;
    delete process.env.FIBER_RPC_AUTH_TOKEN;
  });

  it("maps expected Fiber raw statuses to internal intent states", () => {
    expect(mapFiberRawStatus("open")).toMatchObject({
      normalizedState: "payment_pending",
      intentStatus: "PENDING_VERIFICATION",
      shouldIssueReceipt: false,
    });

    expect(mapFiberRawStatus("settled")).toMatchObject({
      normalizedState: "paid_verified",
      intentStatus: "VERIFIED",
      shouldIssueReceipt: true,
    });

    expect(mapFiberRawStatus("canceled")).toMatchObject({
      normalizedState: "failed",
      intentStatus: "REJECTED",
      shouldIssueReceipt: false,
    });

    expect(mapFiberRawStatus("expired")).toMatchObject({
      normalizedState: "expired",
      intentStatus: "EXPIRED",
      shouldIssueReceipt: false,
    });

    expect(mapFiberRawStatus("unknown_status")).toMatchObject({
      normalizedState: "unknown",
      intentStatus: "PENDING_VERIFICATION",
      shouldIssueReceipt: false,
    });
  });

  it("normalizes real Fiber adapter responses from raw transport payloads", async () => {
    const client = createRealFiberClient({
      rpcUrl: "https://fiber.example.test/rpc",
      authToken: null,
      network: "testnet",
      invoiceTimeoutSeconds: 900,
      transport: async ({ method }) => {
        if (method === "invoice.get_invoice") {
          return {
            statusCode: 200,
            body: {
              result: {
                status: "settled",
                payment_reference: "invoice_123",
                transaction_hash: "tx_123",
                settled_at: "2026-05-17T10:00:00.000Z",
              },
            },
          };
        }

        return {
          statusCode: 200,
          body: {
            result: {
              status: "open",
              payment_reference: "invoice_123",
            },
          },
        };
      },
    });

    const verification = await client.verifyPayment({ paymentReference: "invoice_123" });

    expect(verification).toMatchObject({
      verified: true,
      paymentReference: "invoice_123",
      invoiceStatus: "PAID",
      transactionHash: "tx_123",
      settledAt: "2026-05-17T10:00:00.000Z",
      rawStatus: "settled",
    });
  });

  it("reconciles a paid intent once and does not duplicate the receipt on subsequent runs", async () => {
    const fiberClient = createScriptedFiberClient({
      "invoice_paid_once": "UNPAID",
    });
    const context = await createTestApp(
      {
        fiberClientMode: "real",
      },
      fiberClient,
    );

    try {
      const createResponse = await context.app.inject({
        method: "POST",
        url: "/v1/access-intents",
        payload: {
          resource: {
            key: "resource:phase4-paid",
            type: "CONTENT",
          },
          subject: {
            type: "END_USER",
            id: "subject_paid_once",
          },
          paymentRef: "invoice_paid_once",
          idempotencyKey: "phase4-paid-once",
        },
      });

      expect(createResponse.statusCode).toBe(201);
      const created = createResponse.json() as {
        accessIntent: {
          id: string;
          status: string;
          accessReceipt: { receiptToken: string | null } | null;
        };
      };

      expect(created.accessIntent.status).toBe("PENDING_VERIFICATION");
      expect(created.accessIntent.accessReceipt).toBeNull();

      fiberClient.setStatus("invoice_paid_once", "PAID");

      const worker = new FiberReconciliationWorker({
        service: context.service,
        pollIntervalMs: 10,
      });

      const firstSummary = await worker.runOnce();
      expect(firstSummary.verified).toBe(1);
      expect(firstSummary.receiptsIssued).toBe(1);

      const receiptCountAfterFirstRun = await context.prisma.accessReceipt.count({
        where: {
          accessIntentId: created.accessIntent.id,
        },
      });
      expect(receiptCountAfterFirstRun).toBe(1);

      const secondSummary = await worker.runOnce();
      expect(secondSummary.receiptsIssued).toBe(0);

      const receiptCountAfterSecondRun = await context.prisma.accessReceipt.count({
        where: {
          accessIntentId: created.accessIntent.id,
        },
      });
      expect(receiptCountAfterSecondRun).toBe(1);

      const eventTypes = await context.prisma.eventLog.findMany({
        where: {
          accessIntentId: created.accessIntent.id,
        },
        orderBy: {
          createdAt: "asc",
        },
        select: {
          eventType: true,
        },
      });

      expect(eventTypes.map((event) => event.eventType)).toEqual(
        expect.arrayContaining([
          "ACCESS_INTENT_CREATED",
          "ACCESS_INTENT_PAYMENT_PENDING",
          "ACCESS_INTENT_VERIFIED",
          "ACCESS_RECEIPT_ISSUED",
        ]),
      );
    } finally {
      await context.cleanup();
    }
  });

  it.each([
    ["expired_invoice", "EXPIRED", "EXPIRED"],
    ["failed_invoice", "FAILED", "REJECTED"],
  ])("does not issue a receipt for %s Fiber status", async (paymentRef, fiberStatus, expectedIntentStatus) => {
    const fiberClient = createScriptedFiberClient({
      [paymentRef]: fiberStatus as "EXPIRED" | "FAILED",
    });

    const context = await createTestApp(
      {
        fiberClientMode: "real",
      },
      fiberClient,
    );

    try {
      const createResponse = await context.app.inject({
        method: "POST",
        url: "/v1/access-intents",
        payload: {
          resource: {
            key: `resource:${paymentRef}`,
            type: "API",
          },
          subject: {
            type: "SERVICE_ACCOUNT",
            id: `svc_${paymentRef}`,
          },
          paymentRef,
          idempotencyKey: `idempotency-${paymentRef}`,
        },
      });

      expect(createResponse.statusCode).toBe(201);
      const created = createResponse.json() as {
        accessIntent: {
          id: string;
          status: string;
          accessReceipt: unknown;
        };
      };

      expect(created.accessIntent.status).toBe(expectedIntentStatus);
      expect(created.accessIntent.accessReceipt).toBeNull();

      const worker = new FiberReconciliationWorker({
        service: context.service,
        pollIntervalMs: 10,
      });
      const summary = await worker.runOnce();

      expect(summary.receiptsIssued).toBe(0);

      const receiptCount = await context.prisma.accessReceipt.count({
        where: {
          accessIntentId: created.accessIntent.id,
        },
      });
      expect(receiptCount).toBe(0);
    } finally {
      await context.cleanup();
    }
  });

  it("does not issue a receipt when Fiber status is unknown", async () => {
    const fiberClient = createScriptedFiberClient({
      invoice_unknown: "UNKNOWN",
    });
    const context = await createTestApp(
      {
        fiberClientMode: "real",
      },
      fiberClient,
    );

    try {
      const createResponse = await context.app.inject({
        method: "POST",
        url: "/v1/access-intents",
        payload: {
          resource: {
            key: "resource:unknown",
            type: "FILE",
          },
          subject: {
            type: "END_USER",
            id: "subject_unknown",
          },
          paymentRef: "invoice_unknown",
        },
      });

      expect(createResponse.statusCode).toBe(201);
      const created = createResponse.json() as {
        accessIntent: {
          id: string;
          status: string;
          accessReceipt: unknown;
        };
      };

      expect(created.accessIntent.status).toBe("PENDING_VERIFICATION");
      expect(created.accessIntent.accessReceipt).toBeNull();

      const worker = new FiberReconciliationWorker({
        service: context.service,
        pollIntervalMs: 10,
      });
      const summary = await worker.runOnce();

      expect(summary.receiptsIssued).toBe(0);

      const receiptCount = await context.prisma.accessReceipt.count({
        where: {
          accessIntentId: created.accessIntent.id,
        },
      });
      expect(receiptCount).toBe(0);
    } finally {
      await context.cleanup();
    }
  });
});
