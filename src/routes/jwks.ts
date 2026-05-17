import type { FastifyInstance } from "fastify";
import { JwksResponseSchema } from "../contracts/jwks";
import type { FiberLatchService } from "../services/fiber-latch-service";

interface JwksRouteDependencies {
  service: FiberLatchService;
}

export function registerJwksRoute(app: FastifyInstance, dependencies: JwksRouteDependencies): void {
  app.get("/.well-known/jwks.json", async () => {
    const jwks = await dependencies.service.getPublicJwks();
    return JwksResponseSchema.parse(jwks);
  });
}
