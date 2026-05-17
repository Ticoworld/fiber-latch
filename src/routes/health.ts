import type { FastifyInstance } from "fastify";
import { HealthResponseSchema } from "../contracts/health";

export function registerHealthRoute(app: FastifyInstance): void {
  app.get("/health", async () => {
    return HealthResponseSchema.parse({
      ok: true,
      service: "fiber-latch",
      phase: "phase-3",
      network: "testnet",
    });
  });
}
