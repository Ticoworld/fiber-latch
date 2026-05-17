import type { FastifyInstance } from "fastify";
import {
  VerifyAccessReceiptRequestSchema,
  VerifyAccessReceiptResponseSchema,
} from "../contracts/receipt-verification";
import type { FiberLatchService } from "../services/fiber-latch-service";

interface ReceiptVerificationDependencies {
  service: FiberLatchService;
}

export function registerReceiptVerificationRoute(
  app: FastifyInstance,
  dependencies: ReceiptVerificationDependencies,
): void {
  app.post("/v1/receipts/verify", async (request, reply) => {
    const body = VerifyAccessReceiptRequestSchema.parse(request.body);
    const verification = await dependencies.service.verifyAccessReceipt(body.receiptToken);

    return reply.send(
      VerifyAccessReceiptResponseSchema.parse({
        receiptVerification: verification,
      }),
    );
  });
}
