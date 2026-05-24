import { randomUUID } from "node:crypto";
import type {
  FiberClient,
  FiberInvoiceInput,
  FiberInvoiceResult,
  FiberVerificationInput,
  FiberVerificationResult,
} from "./fiber-client";

function isPaidPaymentHash(paymentHash: string): boolean {
  const normalized = paymentHash.trim().toLowerCase();
  return normalized.startsWith("paid:") || normalized.startsWith("paid_") || normalized.endsWith(":paid");
}

function isUnpaidPaymentHash(paymentHash: string): boolean {
  const normalized = paymentHash.trim().toLowerCase();
  return normalized.startsWith("unpaid:") || normalized.startsWith("unpaid_") || normalized.endsWith(":unpaid");
}

export function createFakeFiberClient(): FiberClient {
  return {
    mode: "fake",
    async createInvoice(input: FiberInvoiceInput): Promise<FiberInvoiceResult> {
      const invoiceAddress = `fake_inv_${randomUUID()}`;
      return {
        invoiceAddress,
        paymentHash: invoiceAddress,
        invoiceStatus: "UNPAID",
        settledAt: null,
        rawStatus: "UNPAID",
        rawResponse: {
          invoiceAddress,
          amount: input.amount,
          description: input.description,
          expiry: input.expiry ?? null,
        },
      };
    },

    async verifyPayment(input: FiberVerificationInput): Promise<FiberVerificationResult> {
      const paymentHash = input.paymentHash.trim();
      const verifiedAt = new Date().toISOString();

      if (!paymentHash) {
        return {
          verified: false,
          paymentHash,
          verifiedAt,
          invoiceStatus: "UNKNOWN",
          settledAt: null,
          invoiceAddress: null,
          createdAt: null,
          lastUpdatedAt: null,
          failedError: null,
          fee: null,
          rawStatus: "UNKNOWN",
          rawResponse: null,
        };
      }

      if (isPaidPaymentHash(paymentHash)) {
        return {
          verified: true,
          paymentHash,
          verifiedAt,
          invoiceStatus: "PAID",
          settledAt: verifiedAt,
          invoiceAddress: null,
          createdAt: null,
          lastUpdatedAt: verifiedAt,
          failedError: null,
          fee: null,
          rawStatus: "PAID",
          rawResponse: {
            payment_hash: paymentHash,
            status: "PAID",
          },
        };
      }

      if (isUnpaidPaymentHash(paymentHash)) {
        return {
          verified: false,
          paymentHash,
          verifiedAt,
          invoiceStatus: "UNPAID",
          settledAt: null,
          invoiceAddress: null,
          createdAt: null,
          lastUpdatedAt: null,
          failedError: null,
          fee: null,
          rawStatus: "UNPAID",
          rawResponse: {
            payment_hash: paymentHash,
            status: "UNPAID",
          },
        };
      }

      return {
        verified: false,
        paymentHash,
        verifiedAt,
        invoiceStatus: "UNKNOWN",
        settledAt: null,
        invoiceAddress: null,
        createdAt: null,
        lastUpdatedAt: null,
        failedError: null,
        fee: null,
        rawStatus: "UNKNOWN",
        rawResponse: {
          payment_hash: paymentHash,
          status: "UNKNOWN",
        },
      };
    },
  };
}
