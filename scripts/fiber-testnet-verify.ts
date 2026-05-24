import { loadRuntimeConfig } from "../src/config/runtime";
import { createFiberClient } from "../src/config/fiber-client";

function maskValue(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length <= 8) {
    return `${trimmed.slice(0, 2)}...${trimmed.slice(-2)}`;
  }

  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function readOptionalEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function parsePositiveAmountSats(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("FIBER_MANUAL_AMOUNT_SATS must be a positive integer");
  }

  return parsed;
}

function readManualPaymentHash(): string | null {
  const paymentHash = readOptionalEnv("FIBER_MANUAL_PAYMENT_HASH");
  const legacyPaymentRef = readOptionalEnv("FIBER_MANUAL_PAYMENT_REF");

  if (paymentHash && legacyPaymentRef && paymentHash !== legacyPaymentRef) {
    throw new Error(
      "FIBER_MANUAL_PAYMENT_HASH and FIBER_MANUAL_PAYMENT_REF were both set with different values",
    );
  }

  return paymentHash ?? legacyPaymentRef;
}

function ensureLiveTestEnv(): {
  paymentHash: string | null;
  amountSats: number | null;
  memo: string | null;
} {
  const fiberClientMode = requireEnv("FIBER_CLIENT_MODE");
  if (fiberClientMode !== "real") {
    throw new Error("FIBER_CLIENT_MODE must be set to real for live Fiber testnet verification");
  }

  const fiberNetwork = requireEnv("FIBER_NETWORK");
  if (fiberNetwork !== "testnet") {
    throw new Error("FIBER_NETWORK must be set to testnet for live Fiber testnet verification");
  }

  requireEnv("FIBER_RPC_URL");

  const paymentHash = readManualPaymentHash();
  const amountSatsRaw = readOptionalEnv("FIBER_MANUAL_AMOUNT_SATS");
  const memo = readOptionalEnv("FIBER_MANUAL_MEMO");

  if (paymentHash && amountSatsRaw) {
    throw new Error(
      "Set only one of FIBER_MANUAL_PAYMENT_HASH/FIBER_MANUAL_PAYMENT_REF or FIBER_MANUAL_AMOUNT_SATS",
    );
  }

  if (!paymentHash && !amountSatsRaw) {
    throw new Error(
      "Set either FIBER_MANUAL_PAYMENT_HASH (preferred), FIBER_MANUAL_PAYMENT_REF (legacy alias), or FIBER_MANUAL_AMOUNT_SATS",
    );
  }

  if (amountSatsRaw && !memo) {
    throw new Error("FIBER_MANUAL_MEMO is required when FIBER_MANUAL_AMOUNT_SATS is set");
  }

  return {
    paymentHash,
    amountSats: amountSatsRaw ? parsePositiveAmountSats(amountSatsRaw) : null,
    memo,
  };
}

async function main(): Promise<void> {
  const runtime = loadRuntimeConfig({
    ...process.env,
    FIBER_CLIENT_MODE: "real",
    FIBER_NETWORK: "testnet",
  });
  const liveTestEnv = ensureLiveTestEnv();

  const client = createFiberClient(runtime);

  if (liveTestEnv.paymentHash) {
    const paymentHash = liveTestEnv.paymentHash;
    const verification = await client.verifyPayment({ paymentHash });
    console.log(
      JSON.stringify(
        {
          operation: "verify",
          paymentHash: maskValue(paymentHash),
          verified: verification.verified,
          invoiceStatus: verification.invoiceStatus,
          rawStatus: verification.rawStatus ?? null,
          invoiceAddress: maskValue(verification.invoiceAddress),
          settledAt: verification.settledAt,
          lastUpdatedAt: verification.lastUpdatedAt,
          failedError: verification.failedError,
          fee: verification.fee,
        },
        null,
        2,
      ),
    );
    return;
  }

  if (liveTestEnv.amountSats) {
    if (!client.createInvoice) {
      throw new Error("The configured Fiber client does not support invoice creation");
    }

    const invoice = await client.createInvoice({
      amount: liveTestEnv.amountSats,
      description: liveTestEnv.memo ?? "FiberLatch manual testnet invoice",
      expiry: runtime.fiberInvoiceTimeoutSeconds,
    });

    console.log(
      JSON.stringify(
        {
          operation: "create-invoice",
          invoiceAddress: maskValue(invoice.invoiceAddress),
          paymentHash: maskValue(invoice.paymentHash),
          invoiceStatus: invoice.invoiceStatus,
          rawStatus: invoice.rawStatus,
          settledAt: invoice.settledAt,
        },
        null,
        2,
      ),
    );
    return;
  }

  throw new Error(
    "Set either FIBER_MANUAL_PAYMENT_HASH/FIBER_MANUAL_PAYMENT_REF or FIBER_MANUAL_AMOUNT_SATS to run the manual Fiber testnet script",
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
