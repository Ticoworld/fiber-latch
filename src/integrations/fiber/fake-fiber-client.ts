import { randomUUID } from "node:crypto";
import type {
  FiberClient,
  FiberInvoiceInput,
  FiberInvoiceResult,
  FiberVerificationInput,
  FiberVerificationResult,
} from "./fiber-client";

function isPaidPaymentReference(paymentReference: string): boolean {
  const normalized = paymentReference.trim().toLowerCase();
  return normalized.startsWith("paid:") || normalized.startsWith("paid_") || normalized.endsWith(":paid");
}

function isUnpaidPaymentReference(paymentReference: string): boolean {
  const normalized = paymentReference.trim().toLowerCase();
  return normalized.startsWith("unpaid:") || normalized.startsWith("unpaid_") || normalized.endsWith(":unpaid");
}

export function createFakeFiberClient(): FiberClient {
  return {
    mode: "fake",
    async createInvoice(input: FiberInvoiceInput): Promise<FiberInvoiceResult> {
      const invoiceReference = `fake_inv_${randomUUID()}`;
      return {
        invoiceReference,
        paymentReference: invoiceReference,
        invoiceStatus: "UNPAID",
        settledAt: null,
        transactionHash: null,
        rawStatus: "UNPAID",
        rawResponse: {
          invoiceReference,
          amountSats: input.amountSats,
          memo: input.memo,
          expirySeconds: input.expirySeconds,
          metadata: input.metadata ?? null,
        },
      };
    },

    async verifyPayment(input: FiberVerificationInput): Promise<FiberVerificationResult> {
      const paymentReference = input.paymentReference.trim();
      const verifiedAt = new Date().toISOString();

      if (!paymentReference) {
        return {
          verified: false,
          paymentReference,
          verifiedAt,
          transactionHash: null,
          invoiceStatus: "UNKNOWN",
          settledAt: null,
          rawStatus: "UNKNOWN",
          rawResponse: null,
        };
      }

      if (isPaidPaymentReference(paymentReference)) {
        return {
          verified: true,
          paymentReference,
          verifiedAt,
          transactionHash: `fiber_tx_${randomUUID()}`,
          invoiceStatus: "PAID",
          settledAt: verifiedAt,
          rawStatus: "PAID",
          rawResponse: {
            paymentReference,
            status: "PAID",
          },
        };
      }

      if (isUnpaidPaymentReference(paymentReference)) {
        return {
          verified: false,
          paymentReference,
          verifiedAt,
          transactionHash: null,
          invoiceStatus: "UNPAID",
          settledAt: null,
          rawStatus: "UNPAID",
          rawResponse: {
            paymentReference,
            status: "UNPAID",
          },
        };
      }

      return {
        verified: false,
        paymentReference,
        verifiedAt,
        transactionHash: null,
        invoiceStatus: "UNKNOWN",
        settledAt: null,
        rawStatus: "UNKNOWN",
        rawResponse: {
          paymentReference,
          status: "UNKNOWN",
        },
      };
    },
  };
}
