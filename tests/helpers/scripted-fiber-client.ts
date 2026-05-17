import { randomUUID } from "node:crypto";
import type {
  FiberClient,
  FiberInvoiceInput,
  FiberInvoiceResult,
  FiberVerificationInput,
  FiberVerificationResult,
} from "../../src/integrations/fiber/fiber-client";

export type ScriptedFiberStatus = "OPEN" | "UNPAID" | "PAID" | "SUCCEEDED" | "SETTLED" | "FAILED" | "EXPIRED" | "CANCELED" | "UNKNOWN";

export interface ScriptedFiberClient extends FiberClient {
  setStatus: (paymentReference: string, status: ScriptedFiberStatus) => void;
}

export function createScriptedFiberClient(
  initialStatuses: Record<string, ScriptedFiberStatus> = {},
): ScriptedFiberClient {
  const statuses = new Map<string, ScriptedFiberStatus>(Object.entries(initialStatuses));

  return {
    mode: "real",

    setStatus(paymentReference: string, status: ScriptedFiberStatus) {
      statuses.set(paymentReference, status);
    },

    async createInvoice(input: FiberInvoiceInput): Promise<FiberInvoiceResult> {
      const invoiceReference = `scripted_inv_${randomUUID()}`;
      statuses.set(invoiceReference, "UNPAID");
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
        },
      };
    },

    async verifyPayment(input: FiberVerificationInput): Promise<FiberVerificationResult> {
      const status = statuses.get(input.paymentReference) ?? "UNKNOWN";
      const verifiedAt = new Date().toISOString();

      switch (status) {
        case "PAID":
        case "SUCCEEDED":
        case "SETTLED":
          return {
            verified: true,
            paymentReference: input.paymentReference,
            verifiedAt,
            transactionHash: `tx_${randomUUID()}`,
            invoiceStatus: "PAID",
            settledAt: verifiedAt,
            rawStatus: status,
            rawResponse: {
              paymentReference: input.paymentReference,
              status,
            },
          };
        case "OPEN":
        case "UNPAID":
          return {
            verified: false,
            paymentReference: input.paymentReference,
            verifiedAt,
            transactionHash: null,
            invoiceStatus: "UNPAID",
            settledAt: null,
            rawStatus: status,
            rawResponse: {
              paymentReference: input.paymentReference,
              status,
            },
          };
        case "FAILED":
        case "EXPIRED":
        case "CANCELED":
          return {
            verified: false,
            paymentReference: input.paymentReference,
            verifiedAt,
            transactionHash: null,
            invoiceStatus: "UNPAID",
            settledAt: null,
            rawStatus: status,
            rawResponse: {
              paymentReference: input.paymentReference,
              status,
            },
          };
        default:
          return {
            verified: false,
            paymentReference: input.paymentReference,
            verifiedAt,
            transactionHash: null,
            invoiceStatus: "UNKNOWN",
            settledAt: null,
            rawStatus: "UNKNOWN",
            rawResponse: {
              paymentReference: input.paymentReference,
              status: "UNKNOWN",
            },
          };
      }
    },
  };
}
