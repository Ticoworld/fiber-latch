export type FiberClientMode = "fake" | "real";
export type FiberInvoiceStatus = "PAID" | "UNPAID" | "UNKNOWN";

export interface FiberInvoiceInput {
  amountSats: number;
  memo: string;
  expirySeconds: number;
  metadata?: Record<string, unknown> | undefined;
}

export interface FiberInvoiceResult {
  invoiceReference: string;
  paymentReference: string;
  invoiceStatus: FiberInvoiceStatus;
  settledAt: string | null;
  transactionHash: string | null;
  rawStatus: string | null;
  rawResponse: unknown;
}

export interface FiberVerificationInput {
  paymentReference: string;
}

export interface FiberVerificationResult {
  verified: boolean;
  paymentReference: string;
  verifiedAt: string;
  transactionHash: string | null;
  invoiceStatus: FiberInvoiceStatus;
  settledAt: string | null;
  rawStatus?: string | null;
  rawResponse?: unknown;
}

export interface FiberClient {
  mode: FiberClientMode;
  createInvoice?(input: FiberInvoiceInput): Promise<FiberInvoiceResult>;
  verifyPayment(input: FiberVerificationInput): Promise<FiberVerificationResult>;
}
