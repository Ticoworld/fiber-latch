import { randomUUID } from "node:crypto";
import type { FiberClient, FiberVerificationInput, FiberVerificationResult } from "./fiber-client";

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
        };
      }

      return {
        verified: false,
        paymentReference,
        verifiedAt,
        transactionHash: null,
        invoiceStatus: "UNKNOWN",
        settledAt: null,
      };
    },
  };
}
