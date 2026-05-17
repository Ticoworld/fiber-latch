import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { buildApp } from "../../src/app";
import type { FiberLatchRuntimeConfig } from "../../src/config/runtime";
import type { FiberClient } from "../../src/integrations/fiber/fiber-client";
import type { FiberLatchService } from "../../src/services/fiber-latch-service";

export interface TestAppContext {
  app: Awaited<ReturnType<typeof buildApp>>;
  prisma: PrismaClient;
  service: FiberLatchService;
  cleanup: () => Promise<void>;
}

export async function createTestApp(
  runtimeOverrides: Partial<FiberLatchRuntimeConfig> = {},
  fiberClient?: FiberClient,
): Promise<TestAppContext> {
  const dbFileName = `debug-test-${randomUUID()}.db`;
  const dbFile = path.join(process.cwd(), dbFileName);
  const databaseUrl = `file:./${dbFileName}`;

  rmSync(dbFile, { force: true });
  rmSync(`${dbFile}-journal`, { force: true });

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

  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  });

  const runtimeConfig: FiberLatchRuntimeConfig = {
    fiberClientMode: "fake",
    fiberNetwork: "testnet",
    fiberRpcUrl: null,
    fiberRpcAuthToken: null,
    fiberPollIntervalMs: 15000,
    fiberInvoiceTimeoutSeconds: 900,
    issuer: "fiber-latch:testnet",
    audience: "fiber-latch-access",
    receiptTtlSeconds: 3600,
    defaultMaxRedemptions: 1,
    privateJwkJson: null,
    ...runtimeOverrides,
  };

  const app = await buildApp({
    prisma,
    runtimeConfig,
    fiberClient,
    logger: false,
  });

  await app.ready();

  return {
    app,
    prisma,
    service: app.fiberLatch,
    cleanup: async () => {
      await app.close();
      await prisma.$disconnect();
      rmSync(dbFile, { force: true });
      rmSync(`${dbFile}-journal`, { force: true });
    },
  };
}
