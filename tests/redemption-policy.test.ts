import { describe, expect, it } from "vitest";
import {
  evaluatePreAtomicRedemptionDenial,
  type PreAtomicRedemptionReceiptSnapshot,
  type PreAtomicRedemptionSignatureResult,
} from "../src/domain/redemption-policy";

describe("evaluatePreAtomicRedemptionDenial", () => {
  const resource = { key: "resource:demo", type: "CONTENT" as const };
  const subject = { type: "END_USER" as const, id: "subject_123" };
  const redeemedAt = "2026-01-01T01:00:00.000Z";
  const now = new Date("2026-01-01T01:00:00.000Z");

  const validClaims = {
    jti: "jti_abc123",
    intent_id: "intent_abc123",
    resource_id: resource.key,
    policy_id: "policy_abc123",
    sub: subject.id,
    max_redemptions: 1,
  };

  const validSignature: PreAtomicRedemptionSignatureResult = {
    verified: true,
    claims: validClaims,
    reason: null,
  };

  const validReceipt: PreAtomicRedemptionReceiptSnapshot = {
    id: "receipt_1",
    jti: validClaims.jti,
    accessIntentId: validClaims.intent_id,
    resourcePolicyId: validClaims.policy_id,
    status: "ISSUED",
    resourceKey: resource.key,
    resourceType: resource.type,
    subjectType: subject.type,
    subjectId: subject.id,
    redemptionCount: 0,
    maxRedemptions: 1,
    exp: new Date("2026-01-01T02:00:00.000Z"),
  };

  it("returns DENIED with the provided reason for an invalid token/signature", () => {
    const signature: PreAtomicRedemptionSignatureResult = {
      verified: false,
      claims: null,
      reason: "INVALID_RECEIPT_TOKEN",
    };

    const result = evaluatePreAtomicRedemptionDenial({
      signature,
      receipt: null,
      resource,
      subject,
      redeemedAt,
      now,
    });

    expect(result).toMatchObject({
      status: "DENIED",
      accessGranted: false,
      accessReceiptId: null,
      accessIntentId: null,
      jti: null,
      receiptStatus: null,
      reason: "INVALID_RECEIPT_TOKEN",
    });
  });

  it("returns DENIED RECEIPT_EXPIRED with receiptStatus EXPIRED for a JWT-level expired signature result", () => {
    const signature: PreAtomicRedemptionSignatureResult = {
      verified: false,
      claims: null,
      reason: "RECEIPT_EXPIRED",
    };

    const result = evaluatePreAtomicRedemptionDenial({
      signature,
      receipt: null,
      resource,
      subject,
      redeemedAt,
      now,
    });

    expect(result).toMatchObject({
      status: "DENIED",
      accessGranted: false,
      receiptStatus: "EXPIRED",
      reason: "RECEIPT_EXPIRED",
    });
  });

  it("returns DENIED RECEIPT_NOT_FOUND when the signature verifies but no stored receipt matches", () => {
    const result = evaluatePreAtomicRedemptionDenial({
      signature: validSignature,
      receipt: null,
      resource,
      subject,
      redeemedAt,
      now,
    });

    expect(result).toMatchObject({
      status: "DENIED",
      accessGranted: false,
      accessReceiptId: null,
      accessIntentId: null,
      jti: validClaims.jti,
      receiptStatus: null,
      reason: "RECEIPT_NOT_FOUND",
    });
  });

  it("returns DENIED RECEIPT_EXPIRED when the stored receipt's exp has already passed", () => {
    const expiredReceipt: PreAtomicRedemptionReceiptSnapshot = {
      ...validReceipt,
      exp: new Date("2026-01-01T00:00:00.000Z"),
    };

    const result = evaluatePreAtomicRedemptionDenial({
      signature: validSignature,
      receipt: expiredReceipt,
      resource,
      subject,
      redeemedAt,
      now,
    });

    expect(result).toMatchObject({
      status: "DENIED",
      accessGranted: false,
      accessReceiptId: expiredReceipt.id,
      accessIntentId: expiredReceipt.accessIntentId,
      jti: expiredReceipt.jti,
      receiptStatus: "EXPIRED",
      reason: "RECEIPT_EXPIRED",
    });
  });

  it("returns DENIED RECEIPT_CLAIMS_MISMATCH when the requested resource does not match the stored receipt", () => {
    const result = evaluatePreAtomicRedemptionDenial({
      signature: validSignature,
      receipt: validReceipt,
      resource: { key: "resource:other", type: "CONTENT" },
      subject,
      redeemedAt,
      now,
    });

    expect(result).toMatchObject({
      status: "DENIED",
      accessGranted: false,
      accessReceiptId: validReceipt.id,
      accessIntentId: validReceipt.accessIntentId,
      jti: validReceipt.jti,
      receiptStatus: validReceipt.status,
      reason: "RECEIPT_CLAIMS_MISMATCH",
    });
  });

  it("returns null for a valid pre-atomic snapshot with no early denial", () => {
    const result = evaluatePreAtomicRedemptionDenial({
      signature: validSignature,
      receipt: validReceipt,
      resource,
      subject,
      redeemedAt,
      now,
    });

    expect(result).toBeNull();
  });
});
