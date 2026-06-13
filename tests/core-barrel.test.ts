import { describe, expect, it } from "vitest";
import {
  buildAccessReceiptClaims,
  evaluatePreAtomicRedemptionDenial,
  mapFiberRawStatus,
  type AccessReceiptSignInput,
  type PreAtomicRedemptionReceiptSnapshot,
  type PreAtomicRedemptionSignatureResult,
} from "../src/core";

describe("core barrel smoke test", () => {
  describe("mapFiberRawStatus", () => {
    it("maps an official Paid status to a verified, receipt-issuing state", () => {
      expect(mapFiberRawStatus("Paid")).toMatchObject({
        normalizedState: "paid_verified",
        intentStatus: "VERIFIED",
        shouldIssueReceipt: true,
      });
    });

    it("does not map an Open status to verified", () => {
      const result = mapFiberRawStatus("Open");

      expect(result.intentStatus).not.toBe("VERIFIED");
      expect(result.shouldIssueReceipt).toBe(false);
    });
  });

  describe("buildAccessReceiptClaims", () => {
    it("maps AccessReceiptSignInput to the exact AccessReceiptClaims shape", () => {
      const input: AccessReceiptSignInput = {
        subjectId: "subject_123",
        audience: "fiber-latch-audience",
        issuer: "fiber-latch-issuer",
        issuedAt: new Date("2026-01-01T00:00:00.000Z"),
        notBefore: new Date("2026-01-01T00:00:05.000Z"),
        expiresAt: new Date("2026-01-01T01:00:00.000Z"),
        jti: "jti_abc123",
        intentId: "intent_abc123",
        resourceId: "resource:demo",
        policyId: "policy_abc123",
        paymentRef: "0x".concat("a".repeat(64)),
        grantType: "single_redemption",
        maxRedemptions: 1,
      };

      expect(buildAccessReceiptClaims(input)).toEqual({
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
      });
    });
  });

  describe("evaluatePreAtomicRedemptionDenial", () => {
    const resource = { key: "resource:demo", type: "CONTENT" as const };
    const subject = { type: "END_USER" as const, id: "subject_123" };
    const redeemedAt = "2026-01-01T01:00:00.000Z";
    const now = new Date("2026-01-01T01:00:00.000Z");

    it("returns DENIED with INVALID_RECEIPT_TOKEN for an invalid signature", () => {
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
        reason: "INVALID_RECEIPT_TOKEN",
      });
    });

    it("returns null for a clean valid pre-atomic snapshot", () => {
      const validClaims = {
        jti: "jti_abc123",
        intent_id: "intent_abc123",
        resource_id: resource.key,
        policy_id: "policy_abc123",
        sub: subject.id,
        max_redemptions: 1,
      };

      const signature: PreAtomicRedemptionSignatureResult = {
        verified: true,
        claims: validClaims,
        reason: null,
      };

      const receipt: PreAtomicRedemptionReceiptSnapshot = {
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

      const result = evaluatePreAtomicRedemptionDenial({
        signature,
        receipt,
        resource,
        subject,
        redeemedAt,
        now,
      });

      expect(result).toBeNull();
    });
  });
});
