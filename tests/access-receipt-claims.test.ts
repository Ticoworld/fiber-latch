import { describe, expect, it } from "vitest";
import { buildAccessReceiptClaims } from "../src/integrations/receipts/jwt-access-receipt-signer";
import type { AccessReceiptSignInput } from "../src/integrations/receipts/access-receipt-signer";

describe("buildAccessReceiptClaims", () => {
  const baseInput: AccessReceiptSignInput = {
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

  it("maps AccessReceiptSignInput to the exact AccessReceiptClaims shape", () => {
    expect(buildAccessReceiptClaims(baseInput)).toEqual({
      iss: "fiber-latch-issuer",
      sub: "subject_123",
      aud: "fiber-latch-audience",
      iat: Math.floor(baseInput.issuedAt.getTime() / 1000),
      nbf: Math.floor(baseInput.notBefore.getTime() / 1000),
      exp: Math.floor(baseInput.expiresAt.getTime() / 1000),
      jti: "jti_abc123",
      intent_id: "intent_abc123",
      resource_id: "resource:demo",
      policy_id: "policy_abc123",
      payment_ref: baseInput.paymentRef,
      grant_type: "single_redemption",
      max_redemptions: 1,
    });
  });

  it("converts Date fields to whole seconds using Math.floor", () => {
    const input: AccessReceiptSignInput = {
      ...baseInput,
      issuedAt: new Date("2026-01-01T00:00:00.999Z"),
      notBefore: new Date("2026-01-01T00:00:05.500Z"),
      expiresAt: new Date("2026-01-01T01:00:00.001Z"),
    };

    const claims = buildAccessReceiptClaims(input);

    expect(claims.iat).toBe(Math.floor(input.issuedAt.getTime() / 1000));
    expect(claims.nbf).toBe(Math.floor(input.notBefore.getTime() / 1000));
    expect(claims.exp).toBe(Math.floor(input.expiresAt.getTime() / 1000));
  });

  it("keeps payment_ref as null when paymentRef is null", () => {
    const input: AccessReceiptSignInput = {
      ...baseInput,
      paymentRef: null,
    };

    expect(buildAccessReceiptClaims(input).payment_ref).toBeNull();
  });

  it("preserves grant_type and max_redemptions verbatim", () => {
    const input: AccessReceiptSignInput = {
      ...baseInput,
      grantType: "multi_redemption",
      maxRedemptions: 5,
    };

    const claims = buildAccessReceiptClaims(input);

    expect(claims.grant_type).toBe("multi_redemption");
    expect(claims.max_redemptions).toBe(5);
  });
});
