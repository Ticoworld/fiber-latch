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

export function buildAccessReceiptClaims(input: AccessReceiptSignInput): AccessReceiptClaims {
  return {
    iss: input.issuer,
    sub: input.subjectId,
    aud: input.audience,
    iat: Math.floor(input.issuedAt.getTime() / 1000),
    nbf: Math.floor(input.notBefore.getTime() / 1000),
    exp: Math.floor(input.expiresAt.getTime() / 1000),
    jti: input.jti,
    intent_id: input.intentId,
    resource_id: input.resourceId,
    policy_id: input.policyId,
    payment_ref: input.paymentRef,
    grant_type: input.grantType,
    max_redemptions: input.maxRedemptions,
  };
}
