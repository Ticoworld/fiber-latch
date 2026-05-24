import { randomUUID } from "node:crypto";
import type {
  FiberClient,
  FiberInvoiceInput,
  FiberInvoiceResult,
  FiberVerificationInput,
  FiberVerificationResult,
} from "../../src/integrations/fiber/fiber-client";

export type ScriptedFiberStatus =
  | "Open"
  | "Received"
  | "Paid"
  | "Cancelled"
  | "Expired"
  | "Created"
  | "Inflight"
  | "Success"
  | "Failed"
  | "UNKNOWN";

export interface ScriptedFiberClient extends FiberClient {
  setStatus: (paymentHash: string, status: ScriptedFiberStatus) => void;
}

function buildInvoiceResponse(paymentHash: string, status: ScriptedFiberStatus) {
  return {
    invoice_address: `fibt_${paymentHash.slice(0, 12)}_${randomUUID()}`,
    invoice: {
      data: {
        payment_hash: paymentHash,
      },
    },
    status,
  };
}

function buildPaymentResponse(paymentHash: string, status: ScriptedFiberStatus, verifiedAt: string) {
  const timestamp = Date.parse(verifiedAt);
  return {
    payment_hash: paymentHash,
    status,
    created_at: `0x${timestamp.toString(16)}`,
    last_updated_at: `0x${timestamp.toString(16)}`,
    failed_error: status === "Failed" ? "scripted failure" : null,
    fee: "0x0",
  };
}

export function createScriptedFiberClient(
  initialStatuses: Record<string, ScriptedFiberStatus> = {},
): ScriptedFiberClient {
  const statuses = new Map<string, ScriptedFiberStatus>(Object.entries(initialStatuses));

  return {
    mode: "real",

    setStatus(paymentHash: string, status: ScriptedFiberStatus) {
      statuses.set(paymentHash, status);
    },

    async createInvoice(input: FiberInvoiceInput): Promise<FiberInvoiceResult> {
      const paymentHash = `0x${randomUUID().replace(/-/g, "").padEnd(64, "0").slice(0, 64)}`;
      const invoiceAddress = `fibt_${randomUUID()}`;
      statuses.set(paymentHash, "Open");

      return {
        invoiceAddress,
        paymentHash,
        invoiceStatus: "UNKNOWN",
        settledAt: null,
        rawStatus: null,
        rawResponse: {
          invoice_address: invoiceAddress,
          invoice: {
            amount: `0x${input.amount.toString(16)}`,
            data: {
              payment_hash: paymentHash,
            },
            description: input.description,
          },
        },
      };
    },

    async verifyPayment(input: FiberVerificationInput): Promise<FiberVerificationResult> {
      const status = statuses.get(input.paymentHash) ?? "UNKNOWN";
      const verifiedAt = new Date().toISOString();

      switch (status) {
        case "Paid":
          return {
            verified: true,
            paymentHash: input.paymentHash,
            verifiedAt,
            invoiceStatus: "PAID",
            settledAt: verifiedAt,
            invoiceAddress: `fibt_${randomUUID()}`,
            createdAt: null,
            lastUpdatedAt: verifiedAt,
            failedError: null,
            fee: null,
            rawStatus: status,
            rawResponse: buildInvoiceResponse(input.paymentHash, status),
          };
        case "Open":
        case "Received":
        case "Cancelled":
        case "Expired":
          return {
            verified: false,
            paymentHash: input.paymentHash,
            verifiedAt,
            invoiceStatus: status === "Expired" || status === "Cancelled" ? "UNPAID" : "UNPAID",
            settledAt: null,
            invoiceAddress: `fibt_${randomUUID()}`,
            createdAt: null,
            lastUpdatedAt: null,
            failedError: null,
            fee: null,
            rawStatus: status,
            rawResponse: buildInvoiceResponse(input.paymentHash, status),
          };
        case "Created":
        case "Inflight":
        case "Success":
        case "Failed":
          return {
            verified: status === "Success",
            paymentHash: input.paymentHash,
            verifiedAt,
            invoiceStatus: status === "Success" ? "PAID" : "UNPAID",
            settledAt: status === "Success" ? verifiedAt : null,
            invoiceAddress: null,
            createdAt: verifiedAt,
            lastUpdatedAt: verifiedAt,
            failedError: status === "Failed" ? "scripted failure" : null,
            fee: "0",
            rawStatus: status,
            rawResponse: buildPaymentResponse(input.paymentHash, status, verifiedAt),
          };
        default:
          return {
            verified: false,
            paymentHash: input.paymentHash,
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
              payment_hash: input.paymentHash,
              status: "UNKNOWN",
            },
          };
      }
    },
  };
}
