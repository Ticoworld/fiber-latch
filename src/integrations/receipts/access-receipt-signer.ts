import type { JWK } from "jose";

export interface AccessReceiptClaims {
  iss: string;
  sub: string;
  aud: string;
  iat: number;
  nbf: number;
  exp: number;
  jti: string;
  intent_id: string;
  resource_id: string;
  policy_id: string;
  payment_ref: string | null;
  grant_type: string;
  max_redemptions: number;
}

export interface AccessReceiptSignInput {
  subjectId: string;
  audience: string;
  issuer: string;
  issuedAt: Date;
  notBefore: Date;
  expiresAt: Date;
  jti: string;
  intentId: string;
  resourceId: string;
  policyId: string;
  paymentRef: string | null;
  grantType: string;
  maxRedemptions: number;
}

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
