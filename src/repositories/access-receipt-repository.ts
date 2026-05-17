import type {
  AccessReceipt as AccessReceiptModel,
  AccessReceiptStatus,
  Prisma,
  ResourceType,
  SubjectType,
} from "@prisma/client";
import type { DbClient } from "./types";

export type AccessReceiptWithRelations = Prisma.AccessReceiptGetPayload<{
  include: {
    accessIntent: true;
    resourcePolicy: true;
  };
}>;

export interface CreateAccessReceiptInput {
  resourcePolicyId: string;
  accessIntentId: string;
  jti: string;
  receiptTokenHash: string;
  resourceKey: string;
  resourceType: ResourceType;
  subjectType: SubjectType;
  subjectId: string;
  status: AccessReceiptStatus;
  active: boolean;
  maxRedemptions: number;
  redemptionCount: number;
  issuedAt: Date;
  nbf: Date;
  exp: Date;
}

export async function createAccessReceipt(
  db: DbClient,
  input: CreateAccessReceiptInput,
): Promise<AccessReceiptModel> {
  return db.accessReceipt.create({
    data: {
      resourcePolicyId: input.resourcePolicyId,
      accessIntentId: input.accessIntentId,
      jti: input.jti,
      receiptTokenHash: input.receiptTokenHash,
      resourceKey: input.resourceKey,
      resourceType: input.resourceType,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      status: input.status,
      active: input.active,
      maxRedemptions: input.maxRedemptions,
      redemptionCount: input.redemptionCount,
      issuedAt: input.issuedAt,
      nbf: input.nbf,
      exp: input.exp,
    },
  });
}

export async function getAccessReceiptByJti(
  db: DbClient,
  jti: string,
): Promise<AccessReceiptWithRelations | null> {
  return db.accessReceipt.findUnique({
    where: { jti },
    include: {
      accessIntent: true,
      resourcePolicy: true,
    },
  });
}

export async function getAccessReceiptByAccessIntentId(
  db: DbClient,
  accessIntentId: string,
): Promise<AccessReceiptWithRelations | null> {
  return db.accessReceipt.findUnique({
    where: { accessIntentId },
    include: {
      accessIntent: true,
      resourcePolicy: true,
    },
  });
}

export interface RedeemAccessReceiptResult {
  updated: boolean;
  receipt: AccessReceiptWithRelations | null;
}

export async function redeemAccessReceiptAtomically(
  db: DbClient,
  receiptId: string,
  now: Date,
): Promise<RedeemAccessReceiptResult> {
  const receipt = await db.accessReceipt.findUnique({
    where: { id: receiptId },
  });

  if (!receipt) {
    return { updated: false, receipt: null };
  }

  const nextRedemptionCount = receipt.redemptionCount + 1;
  const exhausted = nextRedemptionCount >= receipt.maxRedemptions;

  const updateResult = await db.accessReceipt.updateMany({
    where: {
      id: receipt.id,
      active: true,
      status: "ISSUED",
      redemptionCount: receipt.redemptionCount,
      exp: {
        gt: now,
      },
    },
    data: {
      redemptionCount: {
        increment: 1,
      },
      active: !exhausted,
      status: exhausted ? "EXHAUSTED" : "ISSUED",
      redeemedAt: now,
      exhaustedAt: exhausted ? now : null,
    },
  });

  if (updateResult.count !== 1) {
    return { updated: false, receipt: null };
  }

  const updated = await db.accessReceipt.findUnique({
    where: { id: receipt.id },
    include: {
      accessIntent: true,
      resourcePolicy: true,
    },
  });

  return {
    updated: true,
    receipt: updated,
  };
}

export async function setReceiptExpired(
  db: DbClient,
  receiptId: string,
  now: Date,
): Promise<AccessReceiptModel | null> {
  return db.accessReceipt.update({
    where: { id: receiptId },
    data: {
      status: "EXPIRED",
      active: false,
    },
  });
}
