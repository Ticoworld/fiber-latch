export interface FiberLatchRuntimeConfig {
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

export function loadRuntimeConfig(env: NodeJS.ProcessEnv = process.env): FiberLatchRuntimeConfig {
  return {
    issuer: env.FIBERLATCH_ISSUER ?? "fiber-latch:testnet",
    audience: env.FIBERLATCH_AUDIENCE ?? "fiber-latch-access",
    receiptTtlSeconds: parsePositiveInt(env.FIBERLATCH_DEFAULT_RECEIPT_TTL_SECONDS, 3600),
    defaultMaxRedemptions: parsePositiveInt(env.FIBERLATCH_DEFAULT_MAX_REDEMPTIONS, 1),
    privateJwkJson: env.FIBERLATCH_RECEIPT_PRIVATE_JWK?.trim() ? env.FIBERLATCH_RECEIPT_PRIVATE_JWK : null,
  };
}
