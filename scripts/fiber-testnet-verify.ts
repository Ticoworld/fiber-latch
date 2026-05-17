import { loadRuntimeConfig } from "../src/config/runtime";
import { createFiberClient } from "../src/config/fiber-client";

function maskReference(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length <= 8) {
    return `${trimmed.slice(0, 2)}…${trimmed.slice(-2)}`;
  }

  return `${trimmed.slice(0, 4)}…${trimmed.slice(-4)}`;
}

async function main(): Promise<void> {
  const runtime = loadRuntimeConfig();

  if (runtime.fiberClientMode !== "real") {
    throw new Error("FIBER_CLIENT_MODE=real is required for the manual Fiber testnet script");
  }

  const client = createFiberClient(runtime);

  const paymentReference = process.env.FIBER_MANUAL_PAYMENT_REF?.trim() ?? null;
  const amountSats = Number(process.env.FIBER_MANUAL_AMOUNT_SATS ?? "");
  const memo = process.env.FIBER_MANUAL_MEMO?.trim() || "FiberLatch manual testnet invoice";

  if (paymentReference) {
    const verification = await client.verifyPayment({ paymentReference });
    console.log(
      JSON.stringify(
        {
          operation: "verify",
          paymentReference: maskReference(paymentReference),
          verified: verification.verified,
          invoiceStatus: verification.invoiceStatus,
          rawStatus: verification.rawStatus ?? null,
          transactionHash: maskReference(verification.transactionHash),
          settledAt: verification.settledAt,
        },
        null,
        2,
      ),
    );
    return;
  }

  if (Number.isFinite(amountSats) && amountSats > 0) {
    if (!client.createInvoice) {
      throw new Error("The configured Fiber client does not support invoice creation");
    }

    const invoice = await client.createInvoice({
      amountSats,
      memo,
      expirySeconds: runtime.fiberInvoiceTimeoutSeconds,
      metadata: {
        source: "fiber-testnet-verify",
      },
    });

    console.log(
      JSON.stringify(
        {
          operation: "create-invoice",
          invoiceReference: maskReference(invoice.invoiceReference),
          paymentReference: maskReference(invoice.paymentReference),
          invoiceStatus: invoice.invoiceStatus,
          rawStatus: invoice.rawStatus,
          transactionHash: maskReference(invoice.transactionHash),
          settledAt: invoice.settledAt,
        },
        null,
        2,
      ),
    );
    return;
  }

  throw new Error("Set FIBER_MANUAL_PAYMENT_REF or FIBER_MANUAL_AMOUNT_SATS to run the manual Fiber testnet script");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
