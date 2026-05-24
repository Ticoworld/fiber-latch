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

// Official Fiber v0.8.1 statuses are:
// - invoice: Open, Cancelled, Expired, Received, Paid
// - payment: Created, Inflight, Success, Failed
// We keep a few legacy local-only values so the fake adapter and existing demo remain compatible.
const PENDING_STATUS_VALUES = new Set(["open", "received", "created", "inflight", "unpaid", "pending"]);
const PAID_STATUS_VALUES = new Set(["paid", "success", "succeeded", "settled", "confirmed", "finalized"]);
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

  if (PENDING_STATUS_VALUES.has(normalized)) {
    return {
      normalizedState: "payment_pending",
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
