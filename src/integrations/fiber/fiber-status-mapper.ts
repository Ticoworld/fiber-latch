import type { AccessIntentStatus } from "@prisma/client";

export type FiberNormalizedIntentState =
  | "waiting"
  | "payment_pending"
  | "paid_verified"
  | "expired"
  | "failed"
  | "unknown";

export interface FiberStatusMapping {
  normalizedState: FiberNormalizedIntentState;
  intentStatus: AccessIntentStatus;
  shouldIssueReceipt: boolean;
  isTerminal: boolean;
}

const OPEN_STATUS_VALUES = new Set(["open", "unpaid", "pending", "created"]);
const PAID_STATUS_VALUES = new Set(["paid", "succeeded", "settled", "confirmed", "finalized"]);
const EXPIRED_STATUS_VALUES = new Set(["expired", "timed_out", "timeout", "timedout"]);
const FAILED_STATUS_VALUES = new Set(["failed", "canceled", "cancelled", "rejected"]);

function normalizeStatusValue(rawStatus: string): string {
  return rawStatus.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export function mapFiberRawStatus(rawStatus: string | null | undefined): FiberStatusMapping {
  if (rawStatus == null || rawStatus.trim() === "") {
    return {
      normalizedState: "waiting",
      intentStatus: "PENDING_VERIFICATION",
      shouldIssueReceipt: false,
      isTerminal: false,
    };
  }

  const normalized = normalizeStatusValue(rawStatus);

  if (OPEN_STATUS_VALUES.has(normalized)) {
    return {
      normalizedState: normalized === "created" ? "waiting" : "payment_pending",
      intentStatus: "PENDING_VERIFICATION",
      shouldIssueReceipt: false,
      isTerminal: false,
    };
  }

  if (PAID_STATUS_VALUES.has(normalized)) {
    return {
      normalizedState: "paid_verified",
      intentStatus: "VERIFIED",
      shouldIssueReceipt: true,
      isTerminal: false,
    };
  }

  if (EXPIRED_STATUS_VALUES.has(normalized)) {
    return {
      normalizedState: "expired",
      intentStatus: "EXPIRED",
      shouldIssueReceipt: false,
      isTerminal: true,
    };
  }

  if (FAILED_STATUS_VALUES.has(normalized)) {
    return {
      normalizedState: "failed",
      intentStatus: "REJECTED",
      shouldIssueReceipt: false,
      isTerminal: true,
    };
  }

  return {
    normalizedState: "unknown",
    intentStatus: "PENDING_VERIFICATION",
    shouldIssueReceipt: false,
    isTerminal: false,
  };
}
