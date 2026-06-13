import type { JWK } from "jose";
import type { AccessReceiptClaims, AccessReceiptSignInput } from "../../domain/receipt-claims";

export type { AccessReceiptClaims, AccessReceiptSignInput } from "../../domain/receipt-claims";

export interface SignedAccessReceipt {
  token: string;
  claims: AccessReceiptClaims;
}

export interface VerifiedAccessReceipt {
  verified: boolean;
  claims: AccessReceiptClaims | null;
  reason: string | null;
}

export interface JwksDocument {
  keys: JWK[];
}

export interface AccessReceiptSigner {
  sign(input: AccessReceiptSignInput): Promise<SignedAccessReceipt>;
  verify(token: string): Promise<VerifiedAccessReceipt>;
  getPublicJwks(): Promise<JwksDocument>;
}
