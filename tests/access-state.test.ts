import { describe, expect, it } from "vitest";
import {
  ACCESS_INTENT_STATUSES,
  ACCESS_RECEIPT_STATUSES,
  canIssueAccessReceiptFromIntent,
  canRedeemAccessReceipt,
  canTransitionAccessIntent,
  canTransitionAccessReceipt,
  isAccessIntentTerminal,
  isAccessReceiptTerminal,
} from "../src/domain/access-state";

describe("access state model", () => {
  it("keeps access intent transitions strict", () => {
    expect(ACCESS_INTENT_STATUSES).toContain("PENDING_VERIFICATION");
    expect(ACCESS_INTENT_STATUSES).toContain("RECEIPT_ISSUED");
    expect(canTransitionAccessIntent("PENDING_VERIFICATION", "VERIFIED")).toBe(true);
    expect(canTransitionAccessIntent("VERIFIED", "PENDING_VERIFICATION")).toBe(false);
    expect(canIssueAccessReceiptFromIntent("VERIFIED")).toBe(true);
    expect(canIssueAccessReceiptFromIntent("PENDING_VERIFICATION")).toBe(false);
    expect(isAccessIntentTerminal("REJECTED")).toBe(true);
    expect(isAccessIntentTerminal("VERIFIED")).toBe(false);
  });

  it("keeps access receipt transitions strict", () => {
    expect(ACCESS_RECEIPT_STATUSES).toContain("ISSUED");
    expect(ACCESS_RECEIPT_STATUSES).toContain("EXHAUSTED");
    expect(canTransitionAccessReceipt("ISSUED", "EXHAUSTED")).toBe(true);
    expect(canTransitionAccessReceipt("EXHAUSTED", "ISSUED")).toBe(false);
    expect(canRedeemAccessReceipt("ISSUED")).toBe(true);
    expect(canRedeemAccessReceipt("REVOKED")).toBe(false);
    expect(isAccessReceiptTerminal("EXHAUSTED")).toBe(true);
    expect(isAccessReceiptTerminal("ISSUED")).toBe(false);
  });
});
