import { randomUUID } from "node:crypto";
import type { AccessIntentStatus, AccessReceiptStatus, PrismaClient } from "@prisma/client";
import type { FiberClient } from "../integrations/fiber/fiber-client";
import { mapFiberRawStatus } from "../integrations/fiber/fiber-status-mapper";
import type {
  AccessReceiptClaims,
  AccessReceiptSigner,
  AccessReceiptSignInput,
} from "../integrations/receipts/access-receipt-signer";
import {
  createAccessIntent as createAccessIntentRecord,
  getAccessIntentByIdempotencyKey,
  getAccessIntentById,
  markAccessIntentVerified,
  markAccessIntentRejected,
  markAccessIntentExpired,
  updateAccessIntentFiberResponse,
  type AccessIntentWithRelations,
  listReconcilableAccessIntents,
} from "../repositories/access-intent-repository";
import {
  createAccessReceipt,
  getAccessReceiptByAccessIntentId,
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
import { evaluatePreAtomicRedemptionDenial } from "../domain/redemption-policy";

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
  idempotencyKey?: string | undefined;
}

export interface CreateAccessIntentResult {
  accessIntent: AccessIntentView;
  created: boolean;
}

export interface ReconciliationSummary {
  inspected: number;
  verified: number;
  receiptsIssued: number;
  expired: number;
  rejected: number;
  pending: number;
}

type AccessReceiptViewSource = {
  id: string;
  jti: string;
  status: AccessReceiptStatus;
  active: boolean;
  redemptionCount: number;
  maxRedemptions: number;
  issuedAt: Date;
  nbf: Date;
  exp: Date;
  redeemedAt: Date | null;
  exhaustedAt: Date | null;
  revokedAt: Date | null;
};

type AccessIntentViewSource = {
  id: string;
  resourcePolicyId: string;
  resourceKey: string;
  resourceType: "CONTENT" | "FILE" | "API";
  subjectType: "END_USER" | "SERVICE_ACCOUNT";
  subjectId: string;
  paymentRef: string | null;
  status: AccessIntentStatus;
  verifiedAt: Date | null;
  receiptIssuedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  accessReceipt?: AccessReceiptViewSource | null;
};

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

  async createAccessIntent(input: CreateAccessIntentInput): Promise<CreateAccessIntentResult> {
    return this.db.$transaction(async (tx) => {
      const idempotencyKey = input.idempotencyKey?.trim() ?? null;
      if (idempotencyKey) {
        const existing = await getAccessIntentByIdempotencyKey(tx, idempotencyKey);
        if (existing) {
          return {
            accessIntent: this.toAccessIntentView(existing, null, existing.accessReceipt ?? null),
            created: false,
          };
        }
      }

      const policy = await ensureResourcePolicy(tx, {
        resourceKey: input.resource.key,
        resourceType: input.resource.type,
        receiptTtlSeconds: this.runtime.receiptTtlSeconds,
        maxRedemptions: this.runtime.defaultMaxRedemptions,
      });

      const paymentRef = input.paymentRef?.trim() ?? null;
      const fiberVerification = paymentRef
        ? await this.fiberClient.verifyPayment({ paymentHash: paymentRef })
        : null;
      const fiberMapping = mapFiberRawStatus(fiberVerification?.rawStatus ?? (fiberVerification?.verified ? "paid" : null));
      const intentExpiresAt = new Date(Date.now() + policy.receiptTtlSeconds * 1000);
      const issuedAt = fiberVerification?.settledAt ? new Date(fiberVerification.settledAt) : new Date();
      const shouldIssueImmediately = this.fiberClient.mode === "fake" && fiberMapping.shouldIssueReceipt;

      const intent = await createAccessIntentRecord(tx, {
        resourcePolicyId: policy.id,
        resourceKey: input.resource.key,
        resourceType: input.resource.type,
        subjectType: input.subject.type,
        subjectId: input.subject.id,
        paymentRef,
        idempotencyKey,
        status: shouldIssueImmediately
          ? "RECEIPT_ISSUED"
          : fiberMapping.intentStatus,
        verifiedAt:
          fiberMapping.shouldIssueReceipt || fiberMapping.intentStatus !== "PENDING_VERIFICATION"
            ? issuedAt
            : null,
        receiptIssuedAt: shouldIssueImmediately ? issuedAt : null,
        expiresAt: intentExpiresAt,
        fiberResponseJson: this.safeJsonStringify({
          paymentHash: fiberVerification?.paymentHash ?? paymentRef ?? null,
          invoiceAddress: fiberVerification?.invoiceAddress ?? null,
          rawStatus: fiberVerification?.rawStatus ?? null,
          invoiceStatus: fiberVerification?.invoiceStatus ?? null,
          settledAt: fiberVerification?.settledAt ?? null,
          createdAt: fiberVerification?.createdAt ?? null,
          lastUpdatedAt: fiberVerification?.lastUpdatedAt ?? null,
          failedError: fiberVerification?.failedError ?? null,
          fee: fiberVerification?.fee ?? null,
          rawResponse: fiberVerification?.rawResponse ?? null,
        }),
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
          idempotencyKey,
          invoiceStatus: fiberVerification?.invoiceStatus ?? "UNKNOWN",
          rawStatus: fiberVerification?.rawStatus ?? null,
        },
      });

      if (!fiberVerification || fiberMapping.normalizedState === "waiting" || fiberMapping.normalizedState === "payment_pending") {
        await appendEventLog(tx, {
          eventType: "ACCESS_INTENT_PAYMENT_PENDING",
          resourcePolicyId: policy.id,
          resourceKey: input.resource.key,
          resourceType: input.resource.type,
          accessIntentId: intent.id,
          subjectType: input.subject.type,
          subjectId: input.subject.id,
          payload: {
            paymentRef,
            rawStatus: fiberVerification?.rawStatus ?? null,
          },
        });
      }

      if (fiberMapping.normalizedState === "expired") {
        await appendEventLog(tx, {
          eventType: "ACCESS_INTENT_EXPIRED",
          resourcePolicyId: policy.id,
          resourceKey: input.resource.key,
          resourceType: input.resource.type,
          accessIntentId: intent.id,
          subjectType: input.subject.type,
          subjectId: input.subject.id,
          payload: {
            paymentRef,
            rawStatus: fiberVerification?.rawStatus ?? null,
          },
        });
        const expiredIntent = await markAccessIntentExpired(tx, intent.id);
        const hydratedExpiredIntent = (await getAccessIntentById(tx, expiredIntent.id)) ?? intent;
        return {
          accessIntent: this.toAccessIntentView(hydratedExpiredIntent, null),
          created: true,
        };
      }

      if (fiberMapping.normalizedState === "failed") {
        await appendEventLog(tx, {
          eventType: "ACCESS_INTENT_REJECTED",
          resourcePolicyId: policy.id,
          resourceKey: input.resource.key,
          resourceType: input.resource.type,
          accessIntentId: intent.id,
          subjectType: input.subject.type,
          subjectId: input.subject.id,
          payload: {
            paymentRef,
            rawStatus: fiberVerification?.rawStatus ?? null,
          },
        });
        const rejectedIntent = await markAccessIntentRejected(tx, intent.id);
        const hydratedRejectedIntent = (await getAccessIntentById(tx, rejectedIntent.id)) ?? intent;
        return {
          accessIntent: this.toAccessIntentView(hydratedRejectedIntent, null),
          created: true,
        };
      }

      if (!fiberVerification || !fiberMapping.shouldIssueReceipt || this.fiberClient.mode === "real") {
        if (fiberMapping.normalizedState === "paid_verified" && this.fiberClient.mode === "real") {
          await appendEventLog(tx, {
            eventType: "ACCESS_INTENT_VERIFIED",
            resourcePolicyId: policy.id,
            resourceKey: input.resource.key,
            resourceType: input.resource.type,
            accessIntentId: intent.id,
            subjectType: input.subject.type,
            subjectId: input.subject.id,
            payload: {
              paymentRef,
              rawStatus: fiberVerification?.rawStatus ?? null,
              verifiedAt: issuedAt.toISOString(),
            },
          });
        }

        const hydratedIntent = await getAccessIntentById(tx, intent.id);
        return {
          accessIntent: this.toAccessIntentView(hydratedIntent ?? intent, null),
          created: true,
        };
      }

      const issuance = await this.issueReceiptForIntent(tx, {
        intent: (await getAccessIntentById(tx, intent.id)) ?? intent,
        policy,
        subject: input.subject,
        paymentRef,
        issuedAt,
      });

      return {
        accessIntent: this.toAccessIntentView(issuance.intent, issuance.receiptToken, issuance.receipt),
        created: true,
      };
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
    const now = new Date();
    const signature = await this.receiptSigner.verify(receiptToken);

    const receipt =
      signature.verified && signature.claims
        ? await getAccessReceiptByJti(this.db, signature.claims.jti)
        : null;

    const preAtomicDenial = evaluatePreAtomicRedemptionDenial({
      signature,
      receipt,
      resource,
      subject,
      redeemedAt,
      now,
    });

    if (preAtomicDenial) {
      if (preAtomicDenial.reason === "RECEIPT_EXPIRED" && receipt) {
        await setReceiptExpired(this.db, receipt.id, now);
      }
      return preAtomicDenial;
    }

    if (!receipt) {
      throw new Error("evaluatePreAtomicRedemptionDenial returned null without a stored receipt");
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

  async reconcileOpenAccessIntents(): Promise<ReconciliationSummary> {
    const candidates = await listReconcilableAccessIntents(this.db);
    const summary: ReconciliationSummary = {
      inspected: 0,
      verified: 0,
      receiptsIssued: 0,
      expired: 0,
      rejected: 0,
      pending: 0,
    };

    for (const candidate of candidates) {
      summary.inspected += 1;
      const outcome = await this.reconcileSingleAccessIntent(candidate.id);

      switch (outcome) {
        case "VERIFIED":
          summary.verified += 1;
          summary.receiptsIssued += 1;
          break;
        case "EXPIRED":
          summary.expired += 1;
          break;
        case "REJECTED":
          summary.rejected += 1;
          break;
        default:
          summary.pending += 1;
          break;
      }
    }

    return summary;
  }

  async getPublicJwks() {
    return this.receiptSigner.getPublicJwks();
  }

  private async reconcileSingleAccessIntent(
    accessIntentId: string,
  ): Promise<"PENDING" | "VERIFIED" | "REJECTED" | "EXPIRED"> {
    return this.db.$transaction(async (tx) => {
      const intent = await getAccessIntentById(tx, accessIntentId);

      if (!intent) {
        return "PENDING";
      }

      if (intent.accessReceipt && intent.status === "RECEIPT_ISSUED") {
        return "VERIFIED";
      }

      const now = new Date();

      if (!intent.paymentRef) {
        if (intent.expiresAt && intent.expiresAt <= now && intent.status !== "EXPIRED") {
          await appendEventLog(tx, {
            eventType: "ACCESS_INTENT_EXPIRED",
            resourcePolicyId: intent.resourcePolicyId,
            resourceKey: intent.resourceKey,
            resourceType: intent.resourceType,
            accessIntentId: intent.id,
            subjectType: intent.subjectType,
            subjectId: intent.subjectId,
            payload: {
              reason: "NO_PAYMENT_REFERENCE",
            },
          });
          await markAccessIntentExpired(tx, intent.id);
          return "EXPIRED";
        }

        return "PENDING";
      }

      const fiberVerification = await this.fiberClient.verifyPayment({
        paymentHash: intent.paymentRef,
      });
      const fiberMapping = mapFiberRawStatus(fiberVerification.rawStatus ?? (fiberVerification.verified ? "paid" : null));

      await updateAccessIntentFiberResponse(
        tx,
        intent.id,
        this.safeJsonStringify({
          paymentHash: fiberVerification.paymentHash,
          invoiceAddress: fiberVerification.invoiceAddress,
          rawStatus: fiberVerification.rawStatus ?? null,
          invoiceStatus: fiberVerification.invoiceStatus,
          settledAt: fiberVerification.settledAt,
          createdAt: fiberVerification.createdAt,
          lastUpdatedAt: fiberVerification.lastUpdatedAt,
          failedError: fiberVerification.failedError,
          fee: fiberVerification.fee,
          rawResponse: fiberVerification.rawResponse ?? null,
        }),
      );

      if (fiberMapping.normalizedState === "paid_verified") {
        const policy = intent.resourcePolicy;
        const issuedAt = fiberVerification.settledAt ? new Date(fiberVerification.settledAt) : now;
        await this.issueReceiptForIntent(tx, {
          intent,
          policy: {
            id: policy.id,
            resourceKey: policy.resourceKey,
            maxRedemptions: policy.maxRedemptions,
            receiptTtlSeconds: policy.receiptTtlSeconds,
          },
          subject: {
            type: intent.subjectType,
            id: intent.subjectId,
          },
          paymentRef: intent.paymentRef,
          issuedAt,
        });
        return "VERIFIED";
      }

      if (fiberMapping.normalizedState === "expired") {
        if (intent.status !== "EXPIRED") {
          await appendEventLog(tx, {
            eventType: "ACCESS_INTENT_EXPIRED",
            resourcePolicyId: intent.resourcePolicyId,
            resourceKey: intent.resourceKey,
            resourceType: intent.resourceType,
            accessIntentId: intent.id,
            subjectType: intent.subjectType,
            subjectId: intent.subjectId,
            payload: {
              paymentRef: intent.paymentRef,
              rawStatus: fiberVerification.rawStatus ?? null,
            },
          });
          await markAccessIntentExpired(tx, intent.id);
        }
        return "EXPIRED";
      }

      if (fiberMapping.normalizedState === "failed") {
        if (intent.status !== "REJECTED") {
          await appendEventLog(tx, {
            eventType: "ACCESS_INTENT_REJECTED",
            resourcePolicyId: intent.resourcePolicyId,
            resourceKey: intent.resourceKey,
            resourceType: intent.resourceType,
            accessIntentId: intent.id,
            subjectType: intent.subjectType,
            subjectId: intent.subjectId,
            payload: {
              paymentRef: intent.paymentRef,
              rawStatus: fiberVerification.rawStatus ?? null,
            },
          });
          await markAccessIntentRejected(tx, intent.id);
        }
        return "REJECTED";
      }

      return "PENDING";
    });
  }

  private async issueReceiptForIntent(
    tx: DbClient,
    input: {
      intent: AccessIntentViewSource;
      policy: {
        id: string;
        resourceKey: string;
        receiptTtlSeconds: number;
        maxRedemptions: number;
      };
      subject: {
        type: "END_USER" | "SERVICE_ACCOUNT";
        id: string;
      };
      paymentRef: string | null;
      issuedAt: Date;
    },
  ): Promise<{ intent: AccessIntentViewSource; receipt: AccessReceiptViewSource; receiptToken: string | null }> {
    const existingReceipt = await getAccessReceiptByAccessIntentId(tx, input.intent.id);
    if (existingReceipt) {
      if (input.intent.status !== "RECEIPT_ISSUED") {
        await markAccessIntentVerified(tx, input.intent.id, existingReceipt.issuedAt, existingReceipt.issuedAt);
      }

      const hydratedIntent = await getAccessIntentById(tx, input.intent.id);
      return {
        intent: hydratedIntent ?? input.intent,
        receipt: existingReceipt,
        receiptToken: null,
      };
    }

    const notBefore = input.issuedAt;
    const expiresAt = new Date(input.issuedAt.getTime() + input.policy.receiptTtlSeconds * 1000);
    const jti = randomUUID();
    const grantType = input.policy.maxRedemptions === 1 ? "single_redemption" : "multi_redemption";
    const signed = await this.receiptSigner.sign({
      subjectId: input.subject.id,
      audience: this.runtime.audience,
      issuer: this.runtime.issuer,
      issuedAt: input.issuedAt,
      notBefore,
      expiresAt,
      jti,
      intentId: input.intent.id,
      resourceId: input.policy.resourceKey,
      policyId: input.policy.id,
      paymentRef: input.paymentRef,
      grantType,
      maxRedemptions: input.policy.maxRedemptions,
    } satisfies AccessReceiptSignInput);

    let receipt!: AccessReceiptViewSource;
    try {
      receipt = await createAccessReceipt(tx, {
        resourcePolicyId: input.policy.id,
        accessIntentId: input.intent.id,
        jti,
        receiptTokenHash: sha256Hex(signed.token),
        resourceKey: input.intent.resourceKey,
        resourceType: input.intent.resourceType,
        subjectType: input.subject.type,
        subjectId: input.subject.id,
        status: "ISSUED",
        active: true,
        maxRedemptions: input.policy.maxRedemptions,
        redemptionCount: 0,
        issuedAt: input.issuedAt,
        nbf: notBefore,
        exp: expiresAt,
      });
    } catch (error) {
      const code = typeof error === "object" && error !== null ? (error as { code?: string }).code : null;
      if (code !== "P2002") {
        throw error;
      }

      const existing = await getAccessReceiptByAccessIntentId(tx, input.intent.id);
      if (!existing) {
        throw error;
      }

      if (input.intent.status !== "RECEIPT_ISSUED") {
        await markAccessIntentVerified(tx, input.intent.id, existing.issuedAt, existing.issuedAt);
      }

      return {
        intent: (await getAccessIntentById(tx, input.intent.id)) ?? input.intent,
        receipt: existing,
        receiptToken: null,
      };
    }

    if (!receipt) {
      throw new Error("Failed to create access receipt");
    }

    const updatedIntent = await markAccessIntentVerified(tx, input.intent.id, input.issuedAt, input.issuedAt);

    await appendEventLog(tx, {
      eventType: "ACCESS_INTENT_VERIFIED",
      resourcePolicyId: input.policy.id,
      resourceKey: input.intent.resourceKey,
      resourceType: input.intent.resourceType,
      accessIntentId: input.intent.id,
      accessReceiptId: receipt.id,
      subjectType: input.subject.type,
      subjectId: input.subject.id,
      payload: {
        paymentRef: input.paymentRef,
        jti,
      },
    });

    await appendEventLog(tx, {
      eventType: "ACCESS_RECEIPT_ISSUED",
      resourcePolicyId: input.policy.id,
      resourceKey: input.intent.resourceKey,
      resourceType: input.intent.resourceType,
      accessIntentId: input.intent.id,
      accessReceiptId: receipt.id,
      subjectType: input.subject.type,
      subjectId: input.subject.id,
      payload: {
        paymentRef: input.paymentRef,
        jti,
        maxRedemptions: input.policy.maxRedemptions,
      },
    });

    const hydratedIntent = await getAccessIntentById(tx, updatedIntent.id);
    return {
      intent: hydratedIntent ?? input.intent,
      receipt,
      receiptToken: signed.token,
    };
  }

  private safeJsonStringify(value: unknown): string | null {
    try {
      return JSON.stringify(value);
    } catch {
      return null;
    }
  }

  private toAccessIntentView(
    intent: AccessIntentViewSource | AccessIntentWithRelations | Awaited<ReturnType<typeof createAccessIntentRecord>> | Awaited<ReturnType<typeof markAccessIntentVerified>>,
    receiptToken: string | null,
    receipt: AccessReceiptViewSource | AccessReceiptWithRelations | Awaited<ReturnType<typeof createAccessReceipt>> | null = null,
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
