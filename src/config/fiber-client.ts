import type { FiberClient } from "../integrations/fiber/fiber-client";
import { createFakeFiberClient } from "../integrations/fiber/fake-fiber-client";
import { createRealFiberClient } from "../integrations/fiber/real-fiber-client";
import type { FiberLatchRuntimeConfig } from "./runtime";

export function createFiberClient(runtimeConfig: FiberLatchRuntimeConfig): FiberClient {
  if (runtimeConfig.fiberClientMode === "real") {
    if (!runtimeConfig.fiberRpcUrl) {
      throw new Error("FIBER_RPC_URL is required when FIBER_CLIENT_MODE=real");
    }

    return createRealFiberClient({
      rpcUrl: runtimeConfig.fiberRpcUrl,
      authToken: runtimeConfig.fiberRpcAuthToken,
      network: runtimeConfig.fiberNetwork,
      invoiceTimeoutSeconds: runtimeConfig.fiberInvoiceTimeoutSeconds,
    });
  }

  return createFakeFiberClient();
}
