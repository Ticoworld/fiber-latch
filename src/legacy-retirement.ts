import { createServer } from "node:http";
import type { FastifyServerFactory } from "fastify";

export const LEGACY_SERVER_RETIRED_MESSAGE =
  "The historical FiberLatch HTTP service is retired from network serving: " +
  "payment-to-purchase ownership, amount, asset and resource authorization are incomplete. " +
  "Use the npm packages after host-owned authorization. See docs/legacy-service-status.md.";

// Preserve Fastify injection for historical tests/demos without providing a
// network listener. There is deliberately no environment or runtime opt-in.
export const historicalServerFactory: FastifyServerFactory = (handler) => {
  const server = createServer(handler);
  server.listen = () => {
    // Match Node's asynchronous listen-error contract, including Fastify's
    // callback form, without ever calling the real socket-binding method.
    queueMicrotask(() => server.emit("error", new Error(LEGACY_SERVER_RETIRED_MESSAGE)));
    return server;
  };
  return server;
};
