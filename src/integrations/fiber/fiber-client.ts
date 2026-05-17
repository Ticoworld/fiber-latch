export type FiberInvoiceStatus = "PAID" | "UNPAID" | "UNKNOWN";

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
}

export interface FiberClient {
  verifyPayment(input: FiberVerificationInput): Promise<FiberVerificationResult>;
}
