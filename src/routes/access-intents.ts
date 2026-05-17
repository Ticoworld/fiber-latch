import type { FastifyInstance } from "fastify";
import {
  CreateAccessIntentRequestSchema,
  CreateAccessIntentResponseSchema,
  GetAccessIntentResponseSchema,
} from "../contracts/access-intents";
import type { FiberLatchService } from "../services/fiber-latch-service";

interface AccessIntentRouteDependencies {
  service: FiberLatchService;
}

export function registerAccessIntentRoutes(
  app: FastifyInstance,
  dependencies: AccessIntentRouteDependencies,
): void {
  app.post("/v1/access-intents", async (request, reply) => {
    const body = CreateAccessIntentRequestSchema.parse(request.body);
    const result = await dependencies.service.createAccessIntent(body);

    return reply.code(result.created ? 201 : 200).send(
      CreateAccessIntentResponseSchema.parse({
        accessIntent: result.accessIntent,
      }),
    );
  });

  app.get("/v1/access-intents/:id", async (request, reply) => {
    const params = request.params as { id?: string };
    const accessIntent = await dependencies.service.getAccessIntent(params.id ?? "");

    if (!accessIntent) {
      return reply.code(404).send({
        error: "Not Found",
        message: "Access intent not found",
      });
    }

    return reply.send(
      GetAccessIntentResponseSchema.parse({
        accessIntent,
      }),
    );
  });
}
