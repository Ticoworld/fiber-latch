import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { buildApp } from "../../src/app";
import type { FiberLatchRuntimeConfig } from "../../src/config/runtime";

export interface TestAppContext {
  app: Awaited<ReturnType<typeof buildApp>>;
  prisma: PrismaClient;
  cleanup: () => Promise<void>;
}

export async function createTestApp(
  runtimeOverrides: Partial<FiberLatchRuntimeConfig> = {},
): Promise<TestAppContext> {
  const dbFileName = "debug-test.db";
  const dbFile = path.join(process.cwd(), dbFileName);
  const databaseUrl = `file:./${dbFileName}`;

  execFileSync(
    process.execPath,
    [
      path.join(process.cwd(), "node_modules", "prisma", "build", "index.js"),
      "db",
      "push",
      "--force-reset",
      "--skip-generate",
      "--accept-data-loss",
    ],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
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
    logger: false,
  });

  await app.ready();

  return {
    app,
    prisma,
    cleanup: async () => {
      await app.close();
      await prisma.$disconnect();
      rmSync(dbFile, { force: true });
      rmSync(`${dbFile}-journal`, { force: true });
    },
  };
}
