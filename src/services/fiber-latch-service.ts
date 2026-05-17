import { randomUUID } from "node:crypto";
import type { AccessIntentStatus, AccessReceiptStatus, PrismaClient } from "@prisma/client";
import type { FiberClient } from "../integrations/fiber/fiber-client";
import type {
  AccessReceiptClaims,
  AccessReceiptSigner,
  AccessReceiptSignInput,
} from "../integrations/receipts/access-receipt-signer";
import {
  createAccessIntent as createAccessIntentRecord,
  getAccessIntentById,
  markAccessIntentVerified,
  type AccessIntentWithRelations,
} from "../repositories/access-intent-repository";
import {
  createAccessReceipt,
  getAccessReceiptByJti,
  redeemAccessReceiptAtomically,
  setReceiptExpired,
  type AccessReceiptWithRelations,
} from "../repositories/access-receipt-repository";
import { appendEventLog } from "../repositories/event-log-repository";
import { ensureResourcePolicy } from "../repositories/resource-policy-repository";
import type { DbClient } from "../repositories/types";
import { sha256Hex } from "../lib/hash";
import type { FiberLatchRuntimeConfig } from "../config/runtime";
import { isIsoDateExpired } from "../domain/access-state";

export interface CreateAccessIntentInput {
  resource: {
    key: string;
    type: "CONTENT" | "FILE" | "API";
  };
  subject: {
    type: "END_USER" | "SERVICE_ACCOUNT";
    id: string;
  };
  paymentRef?: string | undefined;
}

export interface AccessReceiptView {
  id: string;
  jti: string;
  status: AccessReceiptStatus;
  receiptToken: string | null;
  active: boolean;
  redemptionCount: number;
  maxRedemptions: number;
  issuedAt: string;
  nbf: string;
  exp: string;
  redeemedAt: string | null;
  exhaustedAt: string | null;
  revokedAt: string | null;
}

export interface AccessIntentView {
  id: string;
  policyId: string;
  status: AccessIntentStatus;
  resource: {
    key: string;
    type: "CONTENT" | "FILE" | "API";
  };
  subject: {
    type: "END_USER" | "SERVICE_ACCOUNT";
    id: string;
  };
  paymentRef: string | null;
  verifiedAt: string | null;
  receiptIssuedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  accessReceipt: AccessReceiptView | null;
}

export interface ReceiptVerificationView {
  verified: boolean;
  accessReceiptId: string | null;
  accessIntentId: string | null;
  jti: string | null;
  receiptStatus: AccessReceiptStatus | null;
  resource: {
    key: string;
    type: "CONTENT" | "FILE" | "API";
  } | null;
  subject: {
    type: "END_USER" | "SERVICE_ACCOUNT";
    id: string;
  } | null;
  issuedAt: string | null;
  exp: string | null;
  verifiedAt: string;
  reason: string | null;
}

export interface RedemptionView {
  status: "GRANTED" | "DENIED";
  accessGranted: boolean;
  accessReceiptId: string | null;
  accessIntentId: string | null;
  jti: string | null;
  receiptStatus: AccessReceiptStatus | null;
  resource: {
    key: string;
    type: "CONTENT" | "FILE" | "API";
  };
  subject: {
    type: "END_USER" | "SERVICE_ACCOUNT";
    id: string;
  };
  redemptionCount: number;
  maxRedemptions: number;
  redeemedAt: string;
  reason: string | null;
}

export class FiberLatchService {
  constructor(
    private readonly db: PrismaClient,
    private readonly fiberClient: FiberClient,
    private readonly receiptSigner: AccessReceiptSigner,
    private readonly runtime: FiberLatchRuntimeConfig,
  ) {}

  async createAccessIntent(input: CreateAccessIntentInput): Promise<AccessIntentView> {
    return this.db.$transaction(async (tx) => {
      const policy = await ensureResourcePolicy(tx, {
        resourceKey: input.resource.key,
        resourceType: input.resource.type,
        receiptTtlSeconds: this.runtime.receiptTtlSeconds,
        maxRedemptions: this.runtime.defaultMaxRedemptions,
      });

      const paymentRef = input.paymentRef?.trim() ?? null;
      const verifiedAt = paymentRef ? new Date() : null;
      const fiberVerification = paymentRef
        ? await this.fiberClient.verifyPayment({ paymentReference: paymentRef })
        : null;

      const isPaid = fiberVerification?.verified ?? false;
      const intentExpiresAt = new Date(Date.now() + policy.receiptTtlSeconds * 1000);

      const intent = await createAccessIntentRecord(tx, {
        resourcePolicyId: policy.id,
        resourceKey: input.resource.key,
        resourceType: input.resource.type,
        subjectType: input.subject.type,
        subjectId: input.subject.id,
        paymentRef,
        status: isPaid ? "VERIFIED" : "PENDING_VERIFICATION",
        verifiedAt: isPaid ? verifiedAt : null,
        receiptIssuedAt: null,
        expiresAt: intentExpiresAt,
      });

      await appendEventLog(tx, {
        eventType: "ACCESS_INTENT_CREATED",
        resourcePolicyId: policy.id,
        resourceKey: input.resource.key,
        resourceType: input.resource.type,
        accessIntentId: intent.id,
        subjectType: input.subject.type,
        subjectId: input.subject.id,
        payload: {
          paymentRef,
          invoiceStatus: fiberVerification?.invoiceStatus ?? "UNKNOWN",
          transactionHash: fiberVerification?.transactionHash ?? null,
        },
      });

      if (!isPaid) {
        return this.toAccessIntentView(intent, null);
      }

      const issuedAt = fiberVerification?.settledAt ? new Date(fiberVerification.settledAt) : new Date();
      const notBefore = issuedAt;
      const expiresAt = new Date(issuedAt.getTime() + policy.receiptTtlSeconds * 1000);
      const jti = randomUUID();
      const grantType = policy.maxRedemptions === 1 ? "single_redemption" : "multi_redemption";
      const signed = await this.receiptSigner.sign({
        subjectId: input.subject.id,
        audience: this.runtime.audience,
        issuer: this.runtime.issuer,
        issuedAt,
        notBefore,
        expiresAt,
        jti,
        intentId: intent.id,
        resourceId: policy.resourceKey,
        policyId: policy.id,
        paymentRef,
        grantType,
        maxRedemptions: policy.maxRedemptions,
      } satisfies AccessReceiptSignInput);

      const receipt = await createAccessReceipt(tx, {
        resourcePolicyId: policy.id,
        accessIntentId: intent.id,
        jti,
        receiptTokenHash: sha256Hex(signed.token),
        resourceKey: input.resource.key,
        resourceType: input.resource.type,
        subjectType: input.subject.type,
        subjectId: input.subject.id,
        status: "ISSUED",
        active: true,
        maxRedemptions: policy.maxRedemptions,
        redemptionCount: 0,
        issuedAt,
        nbf: notBefore,
        exp: expiresAt,
      });

      const updatedIntent = await markAccessIntentVerified(tx, intent.id, issuedAt, issuedAt);

      await appendEventLog(tx, {
        eventType: "ACCESS_INTENT_VERIFIED",
        resourcePolicyId: policy.id,
        resourceKey: input.resource.key,
        resourceType: input.resource.type,
        accessIntentId: intent.id,
        accessReceiptId: receipt.id,
        subjectType: input.subject.type,
        subjectId: input.subject.id,
        payload: {
          paymentRef,
          jti,
        },
      });

      await appendEventLog(tx, {
        eventType: "ACCESS_RECEIPT_ISSUED",
        resourcePolicyId: policy.id,
        resourceKey: input.resource.key,
        resourceType: input.resource.type,
        accessIntentId: intent.id,
        accessReceiptId: receipt.id,
        subjectType: input.subject.type,
        subjectId: input.subject.id,
        payload: {
          paymentRef,
          jti,
          maxRedemptions: policy.maxRedemptions,
        },
      });

      const intentWithReceipt = await getAccessIntentById(tx, updatedIntent.id);
      return this.toAccessIntentView(intentWithReceipt ?? updatedIntent, signed.token, receipt);
    });
  }

  async getAccessIntent(id: string): Promise<AccessIntentView | null> {
    const intent = await getAccessIntentById(this.db, id);

    if (!intent) {
      return null;
    }

    return this.toAccessIntentView(intent, null, intent.accessReceipt ?? null);
  }

  async verifyAccessReceipt(receiptToken: string): Promise<ReceiptVerificationView> {
    const verifiedAt = new Date().toISOString();
    const signature = await this.receiptSigner.verify(receiptToken);

    if (!signature.verified || !signature.claims) {
      const expired = signature.reason === "RECEIPT_EXPIRED";
      return {
        verified: false,
        accessReceiptId: null,
        accessIntentId: null,
        jti: null,
        receiptStatus: expired ? "EXPIRED" : null,
        resource: null,
        subject: null,
        issuedAt: null,
        exp: null,
        verifiedAt,
        reason: signature.reason ?? "INVALID_RECEIPT_TOKEN",
      };
    }

    const receipt = await getAccessReceiptByJti(this.db, signature.claims.jti);

    if (!receipt) {
      return {
        verified: false,
        accessReceiptId: null,
        accessIntentId: null,
        jti: signature.claims.jti,
        receiptStatus: null,
        resource: null,
        subject: null,
        issuedAt: null,
        exp: null,
        verifiedAt,
        reason: "RECEIPT_NOT_FOUND",
      };
    }

    if (!receipt.active || receipt.status !== "ISSUED") {
      return {
        verified: false,
        accessReceiptId: receipt.id,
        accessIntentId: receipt.accessIntentId,
        jti: receipt.jti,
        receiptStatus: receipt.status,
        resource: {
          key: receipt.resourceKey,
          type: receipt.resourceType,
        },
        subject: {
          type: receipt.subjectType,
          id: receipt.subjectId,
        },
        issuedAt: receipt.issuedAt.toISOString(),
        exp: receipt.exp.toISOString(),
        verifiedAt,
        reason: "RECEIPT_NOT_ACTIVE",
      };
    }

    if (
      signature.claims.intent_id !== receipt.accessIntentId ||
      signature.claims.resource_id !== receipt.resourceKey ||
      signature.claims.policy_id !== receipt.resourcePolicyId ||
      signature.claims.sub !== receipt.subjectId ||
      signature.claims.max_redemptions !== receipt.maxRedemptions
    ) {
      return {
        verified: false,
        accessReceiptId: receipt.id,
        accessIntentId: receipt.accessIntentId,
        jti: receipt.jti,
        receiptStatus: receipt.status,
        resource: {
          key: receipt.resourceKey,
          type: receipt.resourceType,
        },
        subject: {
          type: receipt.subjectType,
          id: receipt.subjectId,
        },
        issuedAt: receipt.issuedAt.toISOString(),
        exp: receipt.exp.toISOString(),
        verifiedAt,
        reason: "RECEIPT_CLAIMS_MISMATCH",
      };
    }

    if (isIsoDateExpired(receipt.exp.toISOString())) {
      await setReceiptExpired(this.db, receipt.id, new Date());
      return {
        verified: false,
        accessReceiptId: receipt.id,
        accessIntentId: receipt.accessIntentId,
        jti: receipt.jti,
        receiptStatus: "EXPIRED",
        resource: {
          key: receipt.resourceKey,
          type: receipt.resourceType,
        },
        subject: {
          type: receipt.subjectType,
          id: receipt.subjectId,
        },
        issuedAt: receipt.issuedAt.toISOString(),
        exp: receipt.exp.toISOString(),
        verifiedAt,
        reason: "RECEIPT_EXPIRED",
      };
    }

    await appendEventLog(this.db, {
      eventType: "ACCESS_RECEIPT_VERIFIED",
      resourcePolicyId: receipt.resourcePolicyId,
      resourceKey: receipt.resourceKey,
      resourceType: receipt.resourceType,
      accessIntentId: receipt.accessIntentId,
      accessReceiptId: receipt.id,
      subjectType: receipt.subjectType,
      subjectId: receipt.subjectId,
      payload: {
        jti: receipt.jti,
      },
    });

    return {
      verified: true,
      accessReceiptId: receipt.id,
      accessIntentId: receipt.accessIntentId,
      jti: receipt.jti,
      receiptStatus: receipt.status,
      resource: {
        key: receipt.resourceKey,
        type: receipt.resourceType,
      },
      subject: {
        type: receipt.subjectType,
        id: receipt.subjectId,
      },
      issuedAt: receipt.issuedAt.toISOString(),
      exp: receipt.exp.toISOString(),
      verifiedAt,
      reason: null,
    };
  }

  async redeemAccessReceipt(
    receiptToken: string,
    resource: {
      key: string;
      type: "CONTENT" | "FILE" | "API";
    },
    subject: {
      type: "END_USER" | "SERVICE_ACCOUNT";
      id: string;
    },
  ): Promise<RedemptionView> {
    const redeemedAt = new Date().toISOString();
    const signature = await this.receiptSigner.verify(receiptToken);

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

    const receipt = await getAccessReceiptByJti(this.db, signature.claims.jti);

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

    if (isIsoDateExpired(receipt.exp.toISOString())) {
      await setReceiptExpired(this.db, receipt.id, new Date());
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

    const redemption = await redeemAccessReceiptAtomically(this.db, receipt.id, new Date());

    if (!redemption.updated || !redemption.receipt) {
      const current = await getAccessReceiptByJti(this.db, receipt.jti);
      return {
        status: "DENIED",
        accessGranted: false,
        accessReceiptId: current?.id ?? receipt.id,
        accessIntentId: current?.accessIntentId ?? receipt.accessIntentId,
        jti: receipt.jti,
        receiptStatus: current?.status ?? receipt.status,
        resource,
        subject,
        redemptionCount: current?.redemptionCount ?? receipt.redemptionCount,
        maxRedemptions: current?.maxRedemptions ?? receipt.maxRedemptions,
        redeemedAt,
        reason: "RECEIPT_NOT_ACTIVE",
      };
    }

    const updated = redemption.receipt;
    await appendEventLog(this.db, {
      eventType: "ACCESS_RECEIPT_REDEEMED",
      resourcePolicyId: updated.resourcePolicyId,
      resourceKey: updated.resourceKey,
      resourceType: updated.resourceType,
      accessIntentId: updated.accessIntentId,
      accessReceiptId: updated.id,
      subjectType: updated.subjectType,
      subjectId: updated.subjectId,
      payload: {
        redemptionCount: updated.redemptionCount,
        maxRedemptions: updated.maxRedemptions,
      },
    });

    if (updated.status === "EXHAUSTED") {
      await appendEventLog(this.db, {
        eventType: "ACCESS_RECEIPT_REDEMPTION_REJECTED",
        resourcePolicyId: updated.resourcePolicyId,
        resourceKey: updated.resourceKey,
        resourceType: updated.resourceType,
        accessIntentId: updated.accessIntentId,
        accessReceiptId: updated.id,
        subjectType: updated.subjectType,
        subjectId: updated.subjectId,
        payload: {
          reason: "MAX_REDEMPTIONS_REACHED",
        },
      });
    }

    return {
      status: "GRANTED",
      accessGranted: true,
      accessReceiptId: updated.id,
      accessIntentId: updated.accessIntentId,
      jti: updated.jti,
      receiptStatus: updated.status,
      resource,
      subject,
      redemptionCount: updated.redemptionCount,
      maxRedemptions: updated.maxRedemptions,
      redeemedAt,
      reason: null,
    };
  }

  async getPublicJwks() {
    return this.receiptSigner.getPublicJwks();
  }

  private toAccessIntentView(
    intent: AccessIntentWithRelations | Awaited<ReturnType<typeof createAccessIntentRecord>> | Awaited<ReturnType<typeof markAccessIntentVerified>>,
    receiptToken: string | null,
    receipt: AccessReceiptWithRelations | Awaited<ReturnType<typeof createAccessReceipt>> | null = null,
  ): AccessIntentView {
    return {
      id: intent.id,
      policyId: intent.resourcePolicyId,
      status: intent.status,
      resource: {
        key: intent.resourceKey,
        type: intent.resourceType,
      },
      subject: {
        type: intent.subjectType,
        id: intent.subjectId,
      },
      paymentRef: intent.paymentRef ?? null,
      verifiedAt: intent.verifiedAt?.toISOString() ?? null,
      receiptIssuedAt: intent.receiptIssuedAt?.toISOString() ?? null,
      expiresAt: intent.expiresAt?.toISOString() ?? null,
      createdAt: intent.createdAt.toISOString(),
      updatedAt: intent.updatedAt.toISOString(),
      accessReceipt: receipt
        ? {
            id: receipt.id,
            jti: receipt.jti,
            status: receipt.status,
            receiptToken,
            active: receipt.active,
            redemptionCount: receipt.redemptionCount,
            maxRedemptions: receipt.maxRedemptions,
            issuedAt: receipt.issuedAt.toISOString(),
            nbf: receipt.nbf.toISOString(),
            exp: receipt.exp.toISOString(),
            redeemedAt: receipt.redeemedAt?.toISOString() ?? null,
            exhaustedAt: receipt.exhaustedAt?.toISOString() ?? null,
            revokedAt: receipt.revokedAt?.toISOString() ?? null,
          }
        : null,
    };
  }
}
