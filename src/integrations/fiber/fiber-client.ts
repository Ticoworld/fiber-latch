export type FiberClientMode = "fake" | "real";
export type FiberInvoiceStatus = "PAID" | "UNPAID" | "UNKNOWN";

export interface FiberInvoiceInput {
  amount: number;
  description: string;
  expiry?: number | undefined;
}

export interface FiberInvoiceResult {
  invoiceAddress: string;
  paymentHash: string;
  invoiceStatus: FiberInvoiceStatus;
  settledAt: string | null;
  rawStatus: string | null;
  rawResponse: unknown;
}

export interface FiberVerificationInput {
  paymentHash: string;
}

export interface FiberVerificationResult {
  verified: boolean;
  paymentHash: string;
  verifiedAt: string;
  invoiceStatus: FiberInvoiceStatus;
  settledAt: string | null;
  invoiceAddress: string | null;
  createdAt: string | null;
  lastUpdatedAt: string | null;
  failedError: string | null;
  fee: string | null;
  rawStatus?: string | null;
  rawResponse?: unknown;
}

export interface FiberClient {
  mode: FiberClientMode;
  createInvoice?(input: FiberInvoiceInput): Promise<FiberInvoiceResult>;
  verifyPayment(input: FiberVerificationInput): Promise<FiberVerificationResult>;
}
