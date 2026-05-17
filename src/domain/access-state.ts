export const RESOURCE_TYPES = ["CONTENT", "FILE", "API"] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

export const SUBJECT_TYPES = ["END_USER", "SERVICE_ACCOUNT"] as const;
export type SubjectType = (typeof SUBJECT_TYPES)[number];

export const ACCESS_INTENT_STATUSES = [
  "PENDING_VERIFICATION",
  "VERIFIED",
  "RECEIPT_ISSUED",
  "REJECTED",
  "EXPIRED",
] as const;
export type AccessIntentStatus = (typeof ACCESS_INTENT_STATUSES)[number];

const ACCESS_INTENT_TRANSITIONS: Record<AccessIntentStatus, readonly AccessIntentStatus[]> = {
  PENDING_VERIFICATION: ["VERIFIED", "REJECTED", "EXPIRED"],
  VERIFIED: ["RECEIPT_ISSUED", "EXPIRED"],
  RECEIPT_ISSUED: ["EXPIRED"],
  REJECTED: [],
  EXPIRED: [],
};

export function canTransitionAccessIntent(from: AccessIntentStatus, to: AccessIntentStatus): boolean {
  return ACCESS_INTENT_TRANSITIONS[from].includes(to);
}

export function canIssueAccessReceiptFromIntent(status: AccessIntentStatus): boolean {
  return status === "VERIFIED";
}

export function isAccessIntentTerminal(status: AccessIntentStatus): boolean {
  return status === "REJECTED" || status === "EXPIRED";
}

export const ACCESS_RECEIPT_STATUSES = ["ISSUED", "EXHAUSTED", "REVOKED", "EXPIRED"] as const;
export type AccessReceiptStatus = (typeof ACCESS_RECEIPT_STATUSES)[number];

const ACCESS_RECEIPT_TRANSITIONS: Record<AccessReceiptStatus, readonly AccessReceiptStatus[]> = {
  ISSUED: ["EXHAUSTED", "REVOKED", "EXPIRED"],
  EXHAUSTED: [],
  REVOKED: [],
  EXPIRED: [],
};

export function canTransitionAccessReceipt(from: AccessReceiptStatus, to: AccessReceiptStatus): boolean {
  return ACCESS_RECEIPT_TRANSITIONS[from].includes(to);
}

export function canRedeemAccessReceipt(status: AccessReceiptStatus): boolean {
  return status === "ISSUED";
}

export function isAccessReceiptTerminal(status: AccessReceiptStatus): boolean {
  return status === "EXHAUSTED" || status === "REVOKED" || status === "EXPIRED";
}

export const REDEMPTION_STATUSES = ["GRANTED", "DENIED"] as const;
export type RedemptionStatus = (typeof REDEMPTION_STATUSES)[number];

export const EVENT_LOG_TYPES = [
  "RESOURCE_POLICY_CREATED",
  "RESOURCE_POLICY_UPDATED",
  "ACCESS_INTENT_CREATED",
  "ACCESS_INTENT_VERIFIED",
  "ACCESS_RECEIPT_ISSUED",
  "ACCESS_RECEIPT_VERIFIED",
  "ACCESS_RECEIPT_REDEEMED",
  "ACCESS_RECEIPT_REDEMPTION_REJECTED",
  "ACCESS_RECEIPT_REVOKED",
] as const;
export type EventLogType = (typeof EVENT_LOG_TYPES)[number];

export function isIsoDateExpired(isoDate: string, now = new Date()): boolean {
  return new Date(isoDate).getTime() <= now.getTime();
}
