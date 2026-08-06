import { createServer } from "node:http";
import { pathToFileURL } from "node:url";

import {
  PROTECTED_RESOURCE_CONTENT,
  VERIFIED_PAYMENT_FIXTURE_ID,
  createPaidResourceService,
} from "./paid-resource-service.mjs";

const MAX_BODY_BYTES = 16 * 1024;

function writeJson(response, statusCode, body) {
  const payload = JSON.stringify(body);
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
  });
  response.end(payload);
}

async function readJson(request) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      throw new Error("request body too large");
    }
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function bearerToken(request) {
  const authorization = request.headers.authorization;
  if (typeof authorization !== "string") {
    return null;
  }

  const match = /^Bearer ([^\s]+)$/u.exec(authorization);
  return match?.[1] ?? null;
}

async function handleRequest(request, response, service) {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");

  if (request.method === "POST" && url.pathname === "/receipt") {
    let body;
    try {
      body = await readJson(request);
    } catch {
      writeJson(response, 400, { error: "invalid_request" });
      return;
    }

    const issued = await service.issueReceipt(body?.payment_fixture_id);
    if (issued.status !== "issued") {
      writeJson(response, 403, { error: "payment_not_verified" });
      return;
    }

    writeJson(response, 201, { receipt: issued.receipt });
    return;
  }

  if (request.method === "GET" && url.pathname === "/resource") {
    const token = bearerToken(request);
    if (!token) {
      writeJson(response, 401, { error: "access_denied" });
      return;
    }

    const redemption = await service.redeemReceipt(token);
    if (redemption.status === "success") {
      writeJson(response, 200, {
        resource_id: service.expectedBindings.resource_id,
        content: PROTECTED_RESOURCE_CONTENT,
      });
      return;
    }

    if (redemption.status === "system_failure") {
      writeJson(response, 503, { error: "service_unavailable" });
      return;
    }

    writeJson(response, 403, { error: "access_denied" });
    return;
  }

  writeJson(response, 404, { error: "not_found" });
}

export async function startPaidResourceServer({ port = 0, service } = {}) {
  const activeService = service ?? (await createPaidResourceService());
  const server = createServer((request, response) => {
    void handleRequest(request, response, activeService).catch(() => {
      if (!response.headersSent) {
        writeJson(response, 500, { error: "internal_error" });
      } else {
        response.destroy();
      }
    });
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    await new Promise((resolve) => server.close(resolve));
    throw new Error("Example server did not expose a TCP address.");
  }

  return {
    port: address.port,
    url: `http://127.0.0.1:${address.port}`,
    service: activeService,
    server,
    close: () => new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    }),
  };
}

export { VERIFIED_PAYMENT_FIXTURE_ID };

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const instance = await startPaidResourceServer();
  let stopping = false;

  const stop = async () => {
    if (stopping) {
      return;
    }
    stopping = true;
    await instance.close();
    process.exit(0);
  };

  process.once("SIGINT", () => void stop());
  process.once("SIGTERM", () => void stop());
  console.log(`paid-resource example listening at ${instance.url}`);
}
