import { afterEach, describe, expect, it, vi } from "vitest";
import { createRealFiberClient } from "../src/integrations/fiber/real-fiber-client";
import { mapFiberRawStatus } from "../src/integrations/fiber/fiber-status-mapper";
import { FiberReconciliationWorker } from "../src/workers/fiber-reconciliation-worker";
import { createTestApp } from "./helpers/test-app";
import { createScriptedFiberClient } from "./helpers/scripted-fiber-client";

const PAID_PAYMENT_HASH = `0x${"1".repeat(64)}`;
const PENDING_PAYMENT_HASH = `0x${"2".repeat(64)}`;

describe("phase 4 fiber reconciliation", () => {
  afterEach(() => {
    delete process.env.FIBER_RPC_URL;
    delete process.env.FIBER_RPC_AUTH_TOKEN;
    vi.restoreAllMocks();
  });

  it.each([
    ["Open", "payment_pending", "PENDING_VERIFICATION", false],
    ["Received", "payment_pending", "PENDING_VERIFICATION", false],
    ["Paid", "paid_verified", "VERIFIED", true],
    ["Expired", "expired", "EXPIRED", false],
    ["Cancelled", "failed", "REJECTED", false],
    ["Created", "payment_pending", "PENDING_VERIFICATION", false],
    ["Inflight", "payment_pending", "PENDING_VERIFICATION", false],
    ["Success", "paid_verified", "VERIFIED", true],
    ["Failed", "failed", "REJECTED", false],
    ["UNKNOWN_STATUS", "unknown", "PENDING_VERIFICATION", false],
  ])(
    "maps official Fiber status %s to the expected internal state",
    (rawStatus, normalizedState, intentStatus, shouldIssueReceipt) => {
      expect(mapFiberRawStatus(rawStatus)).toMatchObject({
        normalizedState,
        intentStatus,
        shouldIssueReceipt,
      });
    },
  );

  it("sends a Fiber v0.8.1 new_invoice request with array params and official field names", async () => {
    const paymentHash = `0x${"a".repeat(64)}`;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        result: {
          invoice_address: "fibt_invoice_address_001",
          invoice: {
            data: {
              payment_hash: paymentHash,
            },
          },
        },
      }),
    } as Response);

    const client = createRealFiberClient({
      rpcUrl: "https://fiber.example.test/rpc",
      authToken: null,
      network: "testnet",
      invoiceTimeoutSeconds: 900,
    });

    const invoice = await client.createInvoice({
      amount: 100,
      description: "test invoice",
      expiry: 3600,
    });

    expect(invoice).toMatchObject({
      invoiceAddress: "fibt_invoice_address_001",
      paymentHash,
      invoiceStatus: "UNKNOWN",
      rawStatus: null,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, requestInit] = fetchMock.mock.calls[0];
    const body = JSON.parse(String((requestInit as RequestInit).body));

    expect(body.jsonrpc).toBe("2.0");
    expect(body.method).toBe("new_invoice");
    expect(Array.isArray(body.params)).toBe(true);
    expect(body.params).toEqual([
      {
        amount: "0x64",
        description: "test invoice",
        currency: "Fibt",
        expiry: "0xe10",
      },
    ]);
  });

  it("sends get_invoice with payment_hash and parses an official Paid invoice response", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        result: {
          invoice_address: "fibt_invoice_address_002",
          invoice: {
            data: {
              payment_hash: PAID_PAYMENT_HASH,
            },
          },
          status: "Paid",
        },
      }),
    } as Response);

    const client = createRealFiberClient({
      rpcUrl: "https://fiber.example.test/rpc",
      authToken: null,
      network: "testnet",
      invoiceTimeoutSeconds: 900,
    });

    const verification = await client.verifyPayment({ paymentHash: PAID_PAYMENT_HASH });

    expect(verification.paymentHash).toBe(PAID_PAYMENT_HASH);
    expect(verification.verified).toBe(true);
    expect(verification.invoiceStatus).toBe("PAID");
    expect(verification.rawStatus).toBe("Paid");
    expect(verification.invoiceAddress).toBe("fibt_invoice_address_002");
    expect(verification.settledAt).toBe(verification.verifiedAt);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, requestInit] = fetchMock.mock.calls[0];
    const body = JSON.parse(String((requestInit as RequestInit).body));

    expect(body.method).toBe("get_invoice");
    expect(body.params).toEqual([
      {
        payment_hash: PAID_PAYMENT_HASH,
      },
    ]);
  });

  it("falls back to get_payment with payment_hash and parses official payment fields", async () => {
    const createdAtMs = 1716556800000;
    const lastUpdatedAtMs = 1716556801000;
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          result: {
            invoice_address: "fibt_invoice_address_003",
            invoice: {
              data: {
                payment_hash: PENDING_PAYMENT_HASH,
              },
            },
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          result: {
            payment_hash: PENDING_PAYMENT_HASH,
            status: "Success",
            created_at: `0x${createdAtMs.toString(16)}`,
            last_updated_at: `0x${lastUpdatedAtMs.toString(16)}`,
            failed_error: null,
            fee: "0x2a",
          },
        }),
      } as Response);

    const client = createRealFiberClient({
      rpcUrl: "https://fiber.example.test/rpc",
      authToken: null,
      network: "testnet",
      invoiceTimeoutSeconds: 900,
    });

    const verification = await client.verifyPayment({ paymentHash: PENDING_PAYMENT_HASH });

    expect(verification).toMatchObject({
      paymentHash: PENDING_PAYMENT_HASH,
      verified: true,
      invoiceStatus: "PAID",
      rawStatus: "Success",
      createdAt: new Date(createdAtMs).toISOString(),
      lastUpdatedAt: new Date(lastUpdatedAtMs).toISOString(),
      settledAt: new Date(lastUpdatedAtMs).toISOString(),
      fee: "42",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [, firstRequestInit] = fetchMock.mock.calls[0];
    const [, secondRequestInit] = fetchMock.mock.calls[1];
    const firstBody = JSON.parse(String((firstRequestInit as RequestInit).body));
    const secondBody = JSON.parse(String((secondRequestInit as RequestInit).body));

    expect(firstBody.method).toBe("get_invoice");
    expect(firstBody.params).toEqual([
      {
        payment_hash: PENDING_PAYMENT_HASH,
      },
    ]);
    expect(secondBody.method).toBe("get_payment");
    expect(secondBody.params).toEqual([
      {
        payment_hash: PENDING_PAYMENT_HASH,
      },
    ]);
  });

  it("reconciles an official Paid status once and does not duplicate the receipt on subsequent runs", async () => {
    const paymentHash = `0x${"b".repeat(64)}`;
    const fiberClient = createScriptedFiberClient({
      [paymentHash]: "Open",
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
          paymentRef: paymentHash,
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

      fiberClient.setStatus(paymentHash, "Paid");

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
    } finally {
      await context.cleanup();
    }
  });

  it.each([
    ["Expired", "EXPIRED"],
    ["Cancelled", "REJECTED"],
    ["Failed", "REJECTED"],
  ])("does not issue a receipt for terminal Fiber status %s", async (fiberStatus, expectedIntentStatus) => {
    const paymentHash = `0x${fiberStatus.toLowerCase().padEnd(64, "c").slice(0, 64)}`;
    const fiberClient = createScriptedFiberClient({
      [paymentHash]: fiberStatus as "Expired" | "Cancelled" | "Failed",
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
            key: `resource:${fiberStatus}`,
            type: "API",
          },
          subject: {
            type: "SERVICE_ACCOUNT",
            id: `svc_${fiberStatus}`,
          },
          paymentRef: paymentHash,
          idempotencyKey: `idempotency-${fiberStatus}`,
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

  it.each(["Open", "Received", "Created", "Inflight", "UNKNOWN"])(
    "does not issue a receipt when Fiber status is %s",
    async (fiberStatus) => {
      const paymentHash = `0x${fiberStatus.toLowerCase().padEnd(64, "d").slice(0, 64)}`;
      const fiberClient = createScriptedFiberClient({
        [paymentHash]: fiberStatus as "Open" | "Received" | "Created" | "Inflight" | "UNKNOWN",
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
              key: `resource:${fiberStatus.toLowerCase()}`,
              type: "FILE",
            },
            subject: {
              type: "END_USER",
              id: `subject_${fiberStatus.toLowerCase()}`,
            },
            paymentRef: paymentHash,
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
    },
  );
});
