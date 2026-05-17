import "fastify";
import type { FiberLatchService } from "../services/fiber-latch-service";

declare module "fastify" {
  interface FastifyInstance {
    fiberLatch: FiberLatchService;
  }
}
