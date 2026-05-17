export interface FiberLatchRuntimeConfig {
  fiberClientMode: "fake" | "real";
  fiberNetwork: "testnet";
  fiberRpcUrl: string | null;
  fiberRpcAuthToken: string | null;
  fiberPollIntervalMs: number;
  fiberInvoiceTimeoutSeconds: number;
  issuer: string;
  audience: string;
  receiptTtlSeconds: number;
  defaultMaxRedemptions: number;
  privateJwkJson: string | null;
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseFiberClientMode(value: string | undefined): "fake" | "real" {
  if (!value || value.trim() === "") {
    return "fake";
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "fake" || normalized === "real") {
    return normalized;
  }

  throw new Error(`Unsupported FIBER_CLIENT_MODE value: ${value}`);
}

export function loadRuntimeConfig(env: NodeJS.ProcessEnv = process.env): FiberLatchRuntimeConfig {
  const fiberClientMode = parseFiberClientMode(env.FIBER_CLIENT_MODE);
  const fiberNetwork = (env.FIBER_NETWORK ?? "testnet").trim().toLowerCase();

  if (fiberNetwork !== "testnet") {
    throw new Error(`Unsupported FIBER_NETWORK value: ${env.FIBER_NETWORK}`);
  }

  return {
    fiberClientMode,
    fiberNetwork: "testnet",
    fiberRpcUrl: env.FIBER_RPC_URL?.trim() ? env.FIBER_RPC_URL.trim() : null,
    fiberRpcAuthToken: env.FIBER_RPC_AUTH_TOKEN?.trim() ? env.FIBER_RPC_AUTH_TOKEN.trim() : null,
    fiberPollIntervalMs: parsePositiveInt(env.FIBER_POLL_INTERVAL_MS, 15000),
    fiberInvoiceTimeoutSeconds: parsePositiveInt(env.FIBER_INVOICE_TIMEOUT_SECONDS, 900),
    issuer: env.FIBERLATCH_ISSUER ?? "fiber-latch:testnet",
    audience: env.FIBERLATCH_AUDIENCE ?? "fiber-latch-access",
    receiptTtlSeconds: parsePositiveInt(env.FIBERLATCH_DEFAULT_RECEIPT_TTL_SECONDS, 3600),
    defaultMaxRedemptions: parsePositiveInt(env.FIBERLATCH_DEFAULT_MAX_REDEMPTIONS, 1),
    privateJwkJson: env.FIBERLATCH_RECEIPT_PRIVATE_JWK?.trim() ? env.FIBERLATCH_RECEIPT_PRIVATE_JWK : null,
  };
}
