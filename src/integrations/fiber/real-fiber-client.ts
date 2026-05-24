import { randomUUID } from "node:crypto";
import type {
  FiberClient,
  FiberInvoiceInput,
  FiberInvoiceResult,
  FiberVerificationInput,
  FiberVerificationResult,
} from "./fiber-client";
import { mapFiberRawStatus } from "./fiber-status-mapper";

const FIBER_RPC_CONTRACT_VERSION = "v0.8.1";
const FIBER_JSON_RPC_VERSION = "2.0";
const FIBER_RPC_METHODS = {
  newInvoice: "new_invoice",
  getInvoice: "get_invoice",
  getPayment: "get_payment",
} as const;
const FIBER_TESTNET_CURRENCY = "Fibt";

type FiberRpcParams = Record<string, unknown>;

export interface FiberRpcTransportRequest {
  method: string;
  params: [FiberRpcParams];
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

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function readStringField(value: unknown, keys: string[]): string | null {
  const record = readRecord(value);
  if (!record) {
    return null;
  }

  for (const key of keys) {
    const candidate = record[key];
    if (typeof candidate === "string" && candidate.trim() !== "") {
      return candidate;
    }
  }

  return null;
}

function readResultObject(body: unknown): Record<string, unknown> {
  const record = readRecord(body);
  if (!record) {
    return {};
  }

  return readRecord(record.result) ?? record;
}

function readPaymentHash(value: unknown): string | null {
  const directPaymentHash = readStringField(value, ["payment_hash"]);
  if (directPaymentHash) {
    return directPaymentHash;
  }

  const invoice = readRecord(readRecord(value)?.invoice);
  const invoiceData = readRecord(invoice?.data);
  return readStringField(invoiceData, ["payment_hash"]);
}

function parseRpcInteger(value: unknown): bigint | null {
  if (typeof value === "bigint") {
    return value >= 0n ? value : null;
  }

  if (typeof value === "number") {
    if (!Number.isInteger(value) || value < 0) {
      return null;
    }

    return BigInt(value);
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (/^0x[0-9a-f]+$/i.test(trimmed) || /^\d+$/.test(trimmed)) {
    try {
      return BigInt(trimmed);
    } catch {
      return null;
    }
  }

  return null;
}

function readTimestampField(value: unknown, keys: string[]): string | null {
  const record = readRecord(value);
  if (!record) {
    return null;
  }

  for (const key of keys) {
    const parsed = parseRpcInteger(record[key]);
    if (parsed == null || parsed > BigInt(Number.MAX_SAFE_INTEGER)) {
      continue;
    }

    return new Date(Number(parsed)).toISOString();
  }

  return null;
}

function readIntegerField(value: unknown, keys: string[]): string | null {
  const record = readRecord(value);
  if (!record) {
    return null;
  }

  for (const key of keys) {
    const parsed = parseRpcInteger(record[key]);
    if (parsed != null) {
      return parsed.toString();
    }
  }

  return null;
}

function toHexQuantity(value: number): string {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error("Fiber RPC numeric params must be positive integers");
  }

  return `0x${value.toString(16)}`;
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
        jsonrpc: FIBER_JSON_RPC_VERSION,
        id: randomUUID(),
        method,
        params,
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

    const error = readRecord(body)?.error;
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

function toFiberCurrency(network: RealFiberClientOptions["network"]): string {
  if (network === "testnet") {
    return FIBER_TESTNET_CURRENCY;
  }

  throw new Error(`Unsupported Fiber network for RPC contract ${FIBER_RPC_CONTRACT_VERSION}: ${network}`);
}

function buildVerificationResult(paymentHash: string, body: unknown, verifiedAt: string): FiberVerificationResult {
  const result = readResultObject(body);
  const rawStatus = readStringField(result, ["status"]);
  const mapped = mapFiberRawStatus(rawStatus);
  const lastUpdatedAt = readTimestampField(result, ["last_updated_at"]);

  return {
    verified: mapped.shouldIssueReceipt,
    paymentHash: readPaymentHash(result) ?? paymentHash,
    verifiedAt,
    invoiceStatus: toInvoiceStatus(mapped),
    settledAt: mapped.shouldIssueReceipt ? lastUpdatedAt ?? verifiedAt : null,
    invoiceAddress: readStringField(result, ["invoice_address"]),
    createdAt: readTimestampField(result, ["created_at"]),
    lastUpdatedAt,
    failedError: readStringField(result, ["failed_error"]),
    fee: readIntegerField(result, ["fee"]),
    rawStatus,
    rawResponse: result,
  };
}

export function createRealFiberClient(options: RealFiberClientOptions): FiberClient {
  const transport = options.transport ?? createJsonRpcTransport(options);

  return {
    mode: "real",

    async createInvoice(input: FiberInvoiceInput): Promise<FiberInvoiceResult> {
      const params: FiberRpcParams = {
        amount: toHexQuantity(input.amount),
        currency: toFiberCurrency(options.network),
      };

      const trimmedDescription = input.description.trim();
      if (trimmedDescription) {
        params.description = trimmedDescription;
      }

      const expiry = input.expiry ?? options.invoiceTimeoutSeconds;
      if (expiry > 0) {
        params.expiry = toHexQuantity(expiry);
      }

      const response = await transport({
        method: FIBER_RPC_METHODS.newInvoice,
        params: [params],
      });

      const result = readResultObject(response.body);
      const invoiceAddress = readStringField(result, ["invoice_address"]);
      const paymentHash = readPaymentHash(result);

      if (!invoiceAddress || !paymentHash) {
        throw new Error(
          `Fiber ${FIBER_RPC_CONTRACT_VERSION} new_invoice response is missing invoice_address or payment_hash`,
        );
      }

      return {
        invoiceAddress,
        paymentHash,
        invoiceStatus: "UNKNOWN",
        settledAt: null,
        rawStatus: null,
        rawResponse: result,
      };
    },

    async verifyPayment(input: FiberVerificationInput): Promise<FiberVerificationResult> {
      const verifiedAt = new Date().toISOString();

      const invoiceResponse = await transport({
        method: FIBER_RPC_METHODS.getInvoice,
        params: [
          {
            payment_hash: input.paymentHash,
          },
        ],
      });

      const invoiceResult = readResultObject(invoiceResponse.body);
      const invoiceStatus = readStringField(invoiceResult, ["status"]);
      if (invoiceStatus) {
        return buildVerificationResult(input.paymentHash, invoiceResult, verifiedAt);
      }

      const paymentResponse = await transport({
        method: FIBER_RPC_METHODS.getPayment,
        params: [
          {
            payment_hash: input.paymentHash,
          },
        ],
      });

      return buildVerificationResult(input.paymentHash, paymentResponse.body, verifiedAt);
    },
  };
}
