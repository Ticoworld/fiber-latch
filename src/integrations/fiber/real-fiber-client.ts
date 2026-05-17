import { randomUUID } from "node:crypto";
import type {
  FiberClient,
  FiberInvoiceInput,
  FiberInvoiceResult,
  FiberVerificationInput,
  FiberVerificationResult,
} from "./fiber-client";
import { mapFiberRawStatus } from "./fiber-status-mapper";

export interface FiberRpcTransportRequest {
  method: string;
  params: Record<string, unknown>;
}

export interface FiberRpcTransportResponse {
  statusCode: number;
  body: unknown;
}

export type FiberRpcTransport = (request: FiberRpcTransportRequest) => Promise<FiberRpcTransportResponse>;

export interface RealFiberClientOptions {
  rpcUrl: string;
  authToken: string | null;
  network: "testnet";
  invoiceTimeoutSeconds: number;
  transport?: FiberRpcTransport;
}

function toMaskedReference(reference: string): string {
  const trimmed = reference.trim();
  if (trimmed.length <= 10) {
    return `${trimmed.slice(0, 4)}...${trimmed.slice(-2)}`;
  }

  return `${trimmed.slice(0, 6)}...${trimmed.slice(-4)}`;
}

function readStringField(value: unknown, keys: string[]): string | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  for (const key of keys) {
    const candidate = (value as Record<string, unknown>)[key];
    if (typeof candidate === "string" && candidate.trim() !== "") {
      return candidate;
    }
  }

  return null;
}

function readNestedResponse(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object") {
    return {};
  }

  const raw = body as Record<string, unknown>;
  const candidates = [raw.result, raw.data, raw.invoice, raw.payment, raw.response];

  for (const candidate of candidates) {
    if (candidate && typeof candidate === "object") {
      return candidate as Record<string, unknown>;
    }
  }

  return raw;
}

function createJsonRpcTransport(options: RealFiberClientOptions): FiberRpcTransport {
  return async ({ method, params }) => {
    const response = await fetch(options.rpcUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(options.authToken
          ? {
              authorization: `Bearer ${options.authToken}`,
            }
          : {}),
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: randomUUID(),
        method,
        params: {
          network: options.network,
          ...params,
        },
      }),
    });

    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }

    if (!response.ok) {
      throw new Error(`Fiber RPC request failed with HTTP ${response.status}`);
    }

    const error = body && typeof body === "object" ? (body as Record<string, unknown>).error : null;
    if (error && typeof error === "object") {
      const message = readStringField(error, ["message", "reason"]) ?? "Unknown Fiber RPC error";
      throw new Error(message);
    }

    return {
      statusCode: response.status,
      body,
    };
  };
}

function toInvoiceStatus(normalizedState: ReturnType<typeof mapFiberRawStatus>): FiberInvoiceResult["invoiceStatus"] {
  if (normalizedState.normalizedState === "paid_verified") {
    return "PAID";
  }

  if (normalizedState.normalizedState === "unknown") {
    return "UNKNOWN";
  }

  return "UNPAID";
}

function buildVerificationResult(
  paymentReference: string,
  body: unknown,
  verifiedAt: string,
): FiberVerificationResult {
  const raw = readNestedResponse(body);
  const rawStatus = readStringField(raw, ["status", "state", "invoice_status", "payment_status"]);
  const mapped = mapFiberRawStatus(rawStatus);
  const settledAt =
    readStringField(raw, ["settled_at", "settledAt", "paid_at", "paidAt"]) ?? (mapped.shouldIssueReceipt ? verifiedAt : null);
  const transactionHash =
    readStringField(raw, ["transaction_hash", "transactionHash", "tx_hash", "txHash", "hash"]) ?? null;

  return {
    verified: mapped.shouldIssueReceipt,
    paymentReference,
    verifiedAt,
    transactionHash,
    invoiceStatus: toInvoiceStatus(mapped),
    settledAt,
    rawStatus,
    rawResponse: raw,
  };
}

export function createRealFiberClient(options: RealFiberClientOptions): FiberClient {
  const transport = options.transport ?? createJsonRpcTransport(options);

  return {
    mode: "real",

    async createInvoice(input: FiberInvoiceInput): Promise<FiberInvoiceResult> {
      const response = await transport({
        method: "invoice.new_invoice",
        params: {
          amount_sats: input.amountSats,
          memo: input.memo,
          expiry_seconds: input.expirySeconds ?? options.invoiceTimeoutSeconds,
          metadata: input.metadata ?? null,
        },
      });

      const body = readNestedResponse(response.body);
      const rawStatus = readStringField(body, ["status", "state", "invoice_status", "payment_status"]);
      const mapped = mapFiberRawStatus(rawStatus);
      const invoiceReference =
        readStringField(body, ["invoice_reference", "invoiceReference", "invoice_id", "invoiceId"]) ??
        readStringField(body, ["payment_reference", "paymentReference"]) ??
        `fiber_invoice_${randomUUID()}`;

      return {
        invoiceReference,
        paymentReference: readStringField(body, ["payment_reference", "paymentReference"]) ?? invoiceReference,
        invoiceStatus: toInvoiceStatus(mapped),
        settledAt: readStringField(body, ["settled_at", "settledAt", "paid_at", "paidAt"]),
        transactionHash:
          readStringField(body, ["transaction_hash", "transactionHash", "tx_hash", "txHash", "hash"]) ?? null,
        rawStatus,
        rawResponse: body,
      };
    },

    async verifyPayment(input: FiberVerificationInput): Promise<FiberVerificationResult> {
      const verifiedAt = new Date().toISOString();

      const invoiceResponse = await transport({
        method: "invoice.get_invoice",
        params: {
          payment_reference: input.paymentReference,
          paymentReference: input.paymentReference,
        },
      });

      const invoiceBody = readNestedResponse(invoiceResponse.body);
      const invoiceStatus = readStringField(invoiceBody, ["status", "state", "invoice_status", "payment_status"]);
      if (invoiceStatus) {
        return buildVerificationResult(input.paymentReference, invoiceBody, verifiedAt);
      }

      const paymentResponse = await transport({
        method: "payment.get_payment",
        params: {
          payment_reference: input.paymentReference,
          paymentReference: input.paymentReference,
        },
      });

      return buildVerificationResult(input.paymentReference, paymentResponse.body, verifiedAt);
    },
  };
}
