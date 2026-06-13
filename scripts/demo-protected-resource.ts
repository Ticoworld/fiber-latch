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

/**
 * The protected resource is an in-memory stand-in for content a third-party
 * server might gate behind a FiberLatch access receipt. It is not a real
 * file, route, or server.
 */
const PROTECTED_RESOURCE = {
  key: "demo:protected:premium-article",
  type: "CONTENT" as const,
  content: "This is the protected premium article body.",
};

const SUBJECT = {
  type: "END_USER" as const,
  id: "demo-protected-user-001",
};

interface GateAttempt {
  granted: boolean;
  contentReturned: boolean;
  reason: string | null;
  accessReceiptId: string | null;
  jti: string | null;
}

/**
 * Models how a third-party protected resource server would decide whether
 * to return its content: deny outright with no receipt token, otherwise ask
 * FiberLatch to redeem the receipt for this resource/subject and only return
 * content when accessGranted is true.
 */
async function accessProtectedResource(
  app: Awaited<ReturnType<typeof buildApp>>,
  receiptToken: string | null,
): Promise<GateAttempt> {
  if (!receiptToken) {
    return {
      granted: false,
      contentReturned: false,
      reason: "NO_RECEIPT_PROVIDED",
      accessReceiptId: null,
      jti: null,
    };
  }

  const response = await app.inject({
    method: "POST",
    url: "/v1/receipts/redeem",
    payload: {
      receiptToken,
      resource: {
        key: PROTECTED_RESOURCE.key,
        type: PROTECTED_RESOURCE.type,
      },
      subject: SUBJECT,
    },
  });

  const body = response.json() as {
    redemption: {
      accessGranted: boolean;
      accessReceiptId: string | null;
      jti: string | null;
      reason: string | null;
    };
  };

  return {
    granted: body.redemption.accessGranted,
    contentReturned: body.redemption.accessGranted,
    reason: body.redemption.reason,
    accessReceiptId: body.redemption.accessReceiptId,
    jti: body.redemption.jti,
  };
}

async function main(): Promise<void> {
  const dbFileName = `demo-protected-resource-${randomUUID()}.db`;
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
      const noReceiptAttempt = await accessProtectedResource(app, null);

      const createResponse = await app.inject({
        method: "POST",
        url: "/v1/access-intents",
        payload: {
          resource: {
            key: PROTECTED_RESOURCE.key,
            type: PROTECTED_RESOURCE.type,
          },
          subject: SUBJECT,
          paymentRef: "paid:demo-protected-resource-001",
          idempotencyKey: "demo-protected-resource-001",
        },
      });

      if (createResponse.statusCode !== 201) {
        throw new Error(`Expected access intent creation to return 201, got ${createResponse.statusCode}`);
      }

      const worker = new FiberReconciliationWorker({
        service: app.fiberLatch,
        pollIntervalMs: 10,
      });

      await worker.runOnce();

      const receiptToken = capturedReceiptToken.value;
      if (!receiptToken) {
        throw new Error("Demo receipt token was not captured");
      }

      const validReceiptAttempt = await accessProtectedResource(app, receiptToken);
      const reusedReceiptAttempt = await accessProtectedResource(app, receiptToken);

      const summary = {
        demo: "protected-resource",
        protectedResource: {
          key: PROTECTED_RESOURCE.key,
          type: PROTECTED_RESOURCE.type,
        },
        noReceiptAttempt: {
          granted: noReceiptAttempt.granted,
          contentReturned: noReceiptAttempt.contentReturned,
          reason: noReceiptAttempt.reason,
        },
        validReceiptAttempt: {
          granted: validReceiptAttempt.granted,
          contentReturned: validReceiptAttempt.contentReturned,
          reason: validReceiptAttempt.reason,
          accessReceiptId: maskValue(validReceiptAttempt.accessReceiptId),
          jti: maskValue(validReceiptAttempt.jti),
        },
        reusedReceiptAttempt: {
          granted: reusedReceiptAttempt.granted,
          contentReturned: reusedReceiptAttempt.contentReturned,
          reason: reusedReceiptAttempt.reason,
          accessReceiptId: maskValue(reusedReceiptAttempt.accessReceiptId),
          jti: maskValue(reusedReceiptAttempt.jti),
        },
        receiptTokenCaptured: receiptToken !== null,
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
