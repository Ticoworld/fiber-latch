import type { AccessReceiptStatus, ResourceType, SubjectType } from "./access-state";
import { isIsoDateExpired } from "./access-state";

export interface PreAtomicRedemptionSignatureClaims {
  jti: string;
  intent_id: string;
  resource_id: string;
  policy_id: string;
  sub: string;
  max_redemptions: number;
}

export interface PreAtomicRedemptionSignatureResult {
  verified: boolean;
  claims: PreAtomicRedemptionSignatureClaims | null;
  reason: string | null;
}

export interface PreAtomicRedemptionReceiptSnapshot {
  id: string;
  jti: string;
  accessIntentId: string;
  resourcePolicyId: string;
  status: AccessReceiptStatus;
  resourceKey: string;
  resourceType: ResourceType;
  subjectType: SubjectType;
  subjectId: string;
  redemptionCount: number;
  maxRedemptions: number;
  exp: Date;
}

export interface PreAtomicRedemptionDenial {
  status: "DENIED";
  accessGranted: false;
  accessReceiptId: string | null;
  accessIntentId: string | null;
  jti: string | null;
  receiptStatus: AccessReceiptStatus | null;
  resource: { key: string; type: ResourceType };
  subject: { type: SubjectType; id: string };
  redemptionCount: number;
  maxRedemptions: number;
  redeemedAt: string;
  reason: string;
}

export interface EvaluatePreAtomicRedemptionDenialInput {
  signature: PreAtomicRedemptionSignatureResult;
  receipt: PreAtomicRedemptionReceiptSnapshot | null;
  resource: { key: string; type: ResourceType };
  subject: { type: SubjectType; id: string };
  redeemedAt: string;
  now: Date;
}

/**
 * Pre-atomic redemption denial check.
 *
 * Returns a structured DENIED result for early, signature/snapshot-only
 * denial cases, or null if no pre-atomic denial applies and the caller
 * should continue to the atomic DB redemption path.
 *
 * This helper never decides GRANTED or EXHAUSTED, never increments
 * redemptionCount, and never reads or writes the database.
 */
export function evaluatePreAtomicRedemptionDenial(
  input: EvaluatePreAtomicRedemptionDenialInput,
): PreAtomicRedemptionDenial | null {
  const { signature, receipt, resource, subject, redeemedAt, now } = input;

  if (!signature.verified || !signature.claims) {
    const expired = signature.reason === "RECEIPT_EXPIRED";
    return {
      status: "DENIED",
      accessGranted: false,
      accessReceiptId: null,
      accessIntentId: null,
      jti: null,
      receiptStatus: expired ? "EXPIRED" : null,
      resource,
      subject,
      redemptionCount: 0,
      maxRedemptions: 0,
      redeemedAt,
      reason: signature.reason ?? "INVALID_RECEIPT_TOKEN",
    };
  }

  if (!receipt) {
    return {
      status: "DENIED",
      accessGranted: false,
      accessReceiptId: null,
      accessIntentId: null,
      jti: signature.claims.jti,
      receiptStatus: null,
      resource,
      subject,
      redemptionCount: 0,
      maxRedemptions: 0,
      redeemedAt,
      reason: "RECEIPT_NOT_FOUND",
    };
  }

  if (isIsoDateExpired(receipt.exp.toISOString(), now)) {
    return {
      status: "DENIED",
      accessGranted: false,
      accessReceiptId: receipt.id,
      accessIntentId: receipt.accessIntentId,
      jti: receipt.jti,
      receiptStatus: "EXPIRED",
      resource,
      subject,
      redemptionCount: receipt.redemptionCount,
      maxRedemptions: receipt.maxRedemptions,
      redeemedAt,
      reason: "RECEIPT_EXPIRED",
    };
  }

  if (
    signature.claims.intent_id !== receipt.accessIntentId ||
    signature.claims.resource_id !== receipt.resourceKey ||
    signature.claims.policy_id !== receipt.resourcePolicyId ||
    signature.claims.sub !== receipt.subjectId ||
    signature.claims.max_redemptions !== receipt.maxRedemptions ||
    resource.key !== receipt.resourceKey ||
    resource.type !== receipt.resourceType ||
    subject.id !== receipt.subjectId ||
    subject.type !== receipt.subjectType
  ) {
    return {
      status: "DENIED",
      accessGranted: false,
      accessReceiptId: receipt.id,
      accessIntentId: receipt.accessIntentId,
      jti: receipt.jti,
      receiptStatus: receipt.status,
      resource,
      subject,
      redemptionCount: receipt.redemptionCount,
      maxRedemptions: receipt.maxRedemptions,
      redeemedAt,
      reason: "RECEIPT_CLAIMS_MISMATCH",
    };
  }

  return null;
}
