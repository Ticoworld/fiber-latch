/// <reference path="../src/types/fastify.d.ts" />
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { buildApp } from "../src/app";
import { loadRuntimeConfig } from "../src/config/runtime";
import { loadReceiptSigningKeyMaterial } from "../src/config/signing-key";
import { createJwtAccessReceiptSigner } from "../src/integrations/receipts/jwt-access-receipt-signer";
import { createFiberClient } from "../src/config/fiber-client";
import { FiberReconciliationWorker } from "../src/workers/fiber-reconciliation-worker";

function maskValue(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.length <= 8) return `${trimmed.slice(0, 2)}...${trimmed.slice(-2)}`;
  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
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

async function main(): Promise<void> {
  const paymentHash = requireEnv("FIBER_MANUAL_PAYMENT_HASH");
  requireEnv("FIBER_RPC_URL");

  const dbFileName = `demo-live-issuance-${randomUUID()}.db`;
  const dbFile = path.join(process.cwd(), dbFileName);
  const databaseUrl = `file:./${dbFileName}`;
  const capturedReceiptToken = { value: null as string | null };

  rmSync(dbFile, { force: true });
  rmSync(`${dbFile}-journal`, { force: true });

  try {
    prepareDatabase(databaseUrl);

    const prisma = new PrismaClient({
      datasources: { db: { url: databaseUrl } },
    });

    const runtime = loadRuntimeConfig({
      ...process.env,
      FIBER_CLIENT_MODE: "real",
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
      async verify(token: string) { return baseSigner.verify(token); },
      async getPublicJwks() { return baseSigner.getPublicJwks(); },
    };

    const fiberClient = createFiberClient(runtime);

    const app = await buildApp({
      prisma,
      runtimeConfig: runtime,
      fiberClient,
      signingKeyMaterial: keyMaterial,
      receiptSigner,
      logger: false,
    });

    await app.ready();

    try {
      const resourceKey = "live:content:beta";
      const subjectId = "live-user-002";
      
      const createResponse = await app.inject({
        method: "POST",
        url: "/v1/access-intents",
        payload: {
          resource: { key: resourceKey, type: "CONTENT" },
          subject: { type: "END_USER", id: subjectId },
          paymentRef: paymentHash,
          idempotencyKey: `live-access-${randomUUID()}`,
        },
      });

      if (createResponse.statusCode !== 201) {
        throw new Error(`Expected access intent creation to return 201, got ${createResponse.statusCode}: ${createResponse.body}`);
      }

      const created = createResponse.json() as { accessIntent: { id: string; status: string; accessReceipt: any } };

      const worker = new FiberReconciliationWorker({
        service: app.fiberLatch,
        pollIntervalMs: 10,
      });

      await worker.runOnce();

      const hydratedIntentResponse = await app.inject({
        method: "GET",
        url: `/v1/access-intents/${created.accessIntent.id}`,
      });

      const hydratedIntent = hydratedIntentResponse.json() as {
        accessIntent: {
          id: string;
          status: string;
          accessReceipt: { id: string; jti: string; status: string; } | null;
        };
      };

      const receiptToken = capturedReceiptToken.value;
      if (!receiptToken) {
        throw new Error("Live receipt token was not captured (was the payment verified?)");
      }

      const verifyResponse = await app.inject({
        method: "POST",
        url: "/v1/receipts/verify",
        payload: { receiptToken },
      });

      if (verifyResponse.statusCode !== 200) {
        throw new Error(`Receipt verification returned ${verifyResponse.statusCode}: ${verifyResponse.body}`);
      }

      const firstRedemptionResponse = await app.inject({
        method: "POST",
        url: "/v1/receipts/redeem",
        payload: {
          receiptToken,
          resource: { key: resourceKey, type: "CONTENT" },
          subject: { type: "END_USER", id: subjectId },
        },
      });

      if (firstRedemptionResponse.statusCode !== 200) {
        throw new Error(`First redemption returned ${firstRedemptionResponse.statusCode}: ${firstRedemptionResponse.body}`);
      }

      const secondRedemptionResponse = await app.inject({
        method: "POST",
        url: "/v1/receipts/redeem",
        payload: {
          receiptToken,
          resource: { key: resourceKey, type: "CONTENT" },
          subject: { type: "END_USER", id: subjectId },
        },
      });

      const summary = {
        demo: "live-paid-issuance",
        paymentHash: maskValue(paymentHash),
        intent: {
          id: maskValue(created.accessIntent.id),
          status: hydratedIntent.accessIntent.status,
          receiptIssued: hydratedIntent.accessIntent.accessReceipt !== null,
        },
        receipt: {
          id: maskValue(hydratedIntent.accessIntent.accessReceipt?.id ?? null),
          status: hydratedIntent.accessIntent.accessReceipt?.status ?? null,
          tokenCaptured: !!receiptToken,
        },
        verification: {
          verified: verifyResponse.json().receiptVerification?.verified ?? false,
        },
        redemption: {
          firstResult: firstRedemptionResponse.json().redemption?.status ?? "ERROR",
          secondResult: secondRedemptionResponse.json().redemption?.status ?? "ERROR",
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
