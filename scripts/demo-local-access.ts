import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { buildApp } from "../src/app";
import { loadRuntimeConfig } from "../src/config/runtime";
import { loadReceiptSigningKeyMaterial } from "../src/config/signing-key";
import { createJwtAccessReceiptSigner } from "../src/integrations/receipts/jwt-access-receipt-signer";
import { createFakeFiberClient } from "../src/integrations/fiber/fake-fiber-client";
import { FiberReconciliationWorker } from "../src/workers/fiber-reconciliation-worker";

function maskValue(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length <= 8) {
    return `${trimmed.slice(0, 2)}...${trimmed.slice(-2)}`;
  }

  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
}

function prepareDatabase(databaseUrl: string): void {
  execFileSync(
    process.execPath,
    [
      path.join(process.cwd(), "node_modules", "prisma", "build", "index.js"),
      "db",
      "push",
      "--skip-generate",
      "--accept-data-loss",
    ],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        RUST_BACKTRACE: "1",
        RUST_LOG: "debug",
        PRISMA_LOG_LEVEL: "debug",
      },
      stdio: "pipe",
    },
  );
}

function createDemoFiberClient() {
  const baseClient = createFakeFiberClient();
  return {
    ...baseClient,
    mode: "real" as const,
  };
}

async function main(): Promise<void> {
  const dbFileName = `demo-local-access-${randomUUID()}.db`;
  const dbFile = path.join(process.cwd(), dbFileName);
  const databaseUrl = `file:./${dbFileName}`;
  const capturedReceiptToken = { value: null as string | null };

  rmSync(dbFile, { force: true });
  rmSync(`${dbFile}-journal`, { force: true });

  try {
    prepareDatabase(databaseUrl);

    const prisma = new PrismaClient({
      datasources: {
        db: {
          url: databaseUrl,
        },
      },
    });

    const runtime = loadRuntimeConfig({
      ...process.env,
      FIBER_CLIENT_MODE: "fake",
      FIBER_NETWORK: "testnet",
    });
    const keyMaterial = await loadReceiptSigningKeyMaterial({
      privateJwkJson: runtime.privateJwkJson,
    });
    const baseSigner = createJwtAccessReceiptSigner(keyMaterial, runtime.issuer, runtime.audience);
    const receiptSigner = {
      async sign(input: Parameters<typeof baseSigner.sign>[0]) {
        const signed = await baseSigner.sign(input);
        capturedReceiptToken.value = signed.token;
        return signed;
      },
      async verify(token: string) {
        return baseSigner.verify(token);
      },
      async getPublicJwks() {
        return baseSigner.getPublicJwks();
      },
    };

    const app = await buildApp({
      prisma,
      runtimeConfig: runtime,
      fiberClient: createDemoFiberClient(),
      signingKeyMaterial: keyMaterial,
      receiptSigner,
      logger: false,
    });

    await app.ready();

    try {
      const createResponse = await app.inject({
        method: "POST",
        url: "/v1/access-intents",
        payload: {
          resource: {
            key: "demo:content:alpha",
            type: "CONTENT",
          },
          subject: {
            type: "END_USER",
            id: "demo-user-001",
          },
          paymentRef: "paid:demo-access-001",
          idempotencyKey: "demo-access-001",
        },
      });

      if (createResponse.statusCode !== 201) {
        throw new Error(`Expected access intent creation to return 201, got ${createResponse.statusCode}`);
      }

      const created = createResponse.json() as {
        accessIntent: {
          id: string;
          status: string;
          accessReceipt: { receiptToken: string | null } | null;
        };
      };

      const worker = new FiberReconciliationWorker({
        service: app.fiberLatch,
        pollIntervalMs: 10,
      });

      const workerSummary = await worker.runOnce();

      const hydratedIntentResponse = await app.inject({
        method: "GET",
        url: `/v1/access-intents/${created.accessIntent.id}`,
      });

      if (hydratedIntentResponse.statusCode !== 200) {
        throw new Error(`Expected intent lookup to return 200, got ${hydratedIntentResponse.statusCode}`);
      }

      const hydratedIntent = hydratedIntentResponse.json() as {
        accessIntent: {
          id: string;
          status: string;
          accessReceipt: {
            id: string;
            jti: string;
            status: string;
            receiptToken: string | null;
            redemptionCount: number;
            maxRedemptions: number;
          } | null;
        };
      };

      const receiptToken = capturedReceiptToken.value;
      if (!receiptToken) {
        throw new Error("Demo receipt token was not captured");
      }

      const verifyResponse = await app.inject({
        method: "POST",
        url: "/v1/receipts/verify",
        payload: {
          receiptToken,
        },
      });

      if (verifyResponse.statusCode !== 200) {
        throw new Error(`Expected receipt verification to return 200, got ${verifyResponse.statusCode}`);
      }

      const firstRedemptionResponse = await app.inject({
        method: "POST",
        url: "/v1/receipts/redeem",
        payload: {
          receiptToken,
          resource: {
            key: "demo:content:alpha",
            type: "CONTENT",
          },
          subject: {
            type: "END_USER",
            id: "demo-user-001",
          },
        },
      });

      const secondRedemptionResponse = await app.inject({
        method: "POST",
        url: "/v1/receipts/redeem",
        payload: {
          receiptToken,
          resource: {
            key: "demo:content:alpha",
            type: "CONTENT",
          },
          subject: {
            type: "END_USER",
            id: "demo-user-001",
          },
        },
      });

      const receiptRecord = await prisma.accessReceipt.findUnique({
        where: {
          accessIntentId: created.accessIntent.id,
        },
      });

      const summary = {
        demo: "local-access",
        intent: {
          id: maskValue(created.accessIntent.id),
          status: created.accessIntent.status,
          receiptIssued: created.accessIntent.accessReceipt !== null,
        },
        worker: {
          inspected: workerSummary.inspected,
          verified: workerSummary.verified,
          receiptsIssued: workerSummary.receiptsIssued,
        },
        receipt: {
          id: maskValue(hydratedIntent.accessIntent.accessReceipt?.id ?? null),
          jti: maskValue(hydratedIntent.accessIntent.accessReceipt?.jti ?? null),
          status: hydratedIntent.accessIntent.accessReceipt?.status ?? null,
          active: receiptRecord?.active ?? null,
          redemptionCount: receiptRecord?.redemptionCount ?? null,
          maxRedemptions: receiptRecord?.maxRedemptions ?? null,
          tokenCaptured: true,
        },
        verification: {
          statusCode: verifyResponse.statusCode,
          verified: verifyResponse.json().receiptVerification.verified,
          receiptStatus: verifyResponse.json().receiptVerification.receiptStatus,
        },
        redemption: {
          firstStatusCode: firstRedemptionResponse.statusCode,
          firstResult: firstRedemptionResponse.json().redemption.status,
          secondStatusCode: secondRedemptionResponse.statusCode,
          secondResult: secondRedemptionResponse.json().redemption.status,
          secondReason: secondRedemptionResponse.json().redemption.reason,
        },
      };

      console.log(JSON.stringify(summary, null, 2));
    } finally {
      await app.close();
      await prisma.$disconnect();
    }
  } finally {
    rmSync(dbFile, { force: true });
    rmSync(`${dbFile}-journal`, { force: true });
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
