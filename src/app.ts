import Fastify, { type FastifyInstance } from "fastify";
import { ZodError } from "zod";
import type { PrismaClient } from "@prisma/client";
import { loadRuntimeConfig, type FiberLatchRuntimeConfig } from "./config/runtime";
import { createFiberClient } from "./config/fiber-client";
import { loadReceiptSigningKeyMaterial, type ReceiptSigningKeyMaterial } from "./config/signing-key";
import { prisma as defaultPrisma } from "./lib/prisma";
import type { FiberClient } from "./integrations/fiber/fiber-client";
import { createJwtAccessReceiptSigner } from "./integrations/receipts/jwt-access-receipt-signer";
import type { AccessReceiptSigner } from "./integrations/receipts/access-receipt-signer";
import { FiberLatchService } from "./services/fiber-latch-service";
import { registerAccessIntentRoutes } from "./routes/access-intents";
import { registerHealthRoute } from "./routes/health";
import { registerJwksRoute } from "./routes/jwks";
import { registerReceiptRedemptionRoute } from "./routes/receipt-redemption";
import { registerReceiptVerificationRoute } from "./routes/receipt-verification";

export interface BuildAppOptions {
  logger?: boolean;
  prisma?: PrismaClient;
  fiberClient?: FiberClient;
  runtimeConfig?: FiberLatchRuntimeConfig;
  signingKeyMaterial?: ReceiptSigningKeyMaterial;
  receiptSigner?: AccessReceiptSigner;
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const runtimeConfig = options.runtimeConfig ?? loadRuntimeConfig();
  const prisma = options.prisma ?? defaultPrisma;
  const fiberClient = options.fiberClient ?? createFiberClient(runtimeConfig);
  const signingKeyMaterial =
    options.signingKeyMaterial ??
    (await loadReceiptSigningKeyMaterial({
      privateJwkJson: runtimeConfig.privateJwkJson,
    }));
  const receiptSigner =
    options.receiptSigner ??
    createJwtAccessReceiptSigner(signingKeyMaterial, runtimeConfig.issuer, runtimeConfig.audience);
  const service = new FiberLatchService(prisma, fiberClient, receiptSigner, runtimeConfig);
  const app = Fastify({ logger: options.logger ?? false });

  app.decorate("fiberLatch", service);

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: "Bad Request",
        message: "Request validation failed",
        issues: error.issues,
      });
    }

    app.log.error(error);
    return reply.status(500).send({
      error: "Internal Server Error",
      message: "FiberLatch hit an unexpected error",
    });
  });

  registerHealthRoute(app);
  registerAccessIntentRoutes(app, { service });
  registerReceiptVerificationRoute(app, { service });
  registerReceiptRedemptionRoute(app, { service });
  registerJwksRoute(app, { service });

  return app;
}
