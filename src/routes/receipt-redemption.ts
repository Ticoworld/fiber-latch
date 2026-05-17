import type { FastifyInstance } from "fastify";
import {
  RedeemAccessReceiptRequestSchema,
  RedeemAccessReceiptResponseSchema,
} from "../contracts/receipt-redemption";
import type { FiberLatchService } from "../services/fiber-latch-service";

interface ReceiptRedemptionDependencies {
  service: FiberLatchService;
}

export function registerReceiptRedemptionRoute(
  app: FastifyInstance,
  dependencies: ReceiptRedemptionDependencies,
): void {
  app.post("/v1/receipts/redeem", async (request, reply) => {
    const body = RedeemAccessReceiptRequestSchema.parse(request.body);
    const redemption = await dependencies.service.redeemAccessReceipt(
      body.receiptToken,
      body.resource,
      body.subject,
    );

    return reply.send(
      RedeemAccessReceiptResponseSchema.parse({
        redemption,
      }),
    );
  });
}
