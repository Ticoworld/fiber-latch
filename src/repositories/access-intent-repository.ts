import type {
  AccessIntent as AccessIntentModel,
  AccessIntentStatus,
  Prisma,
  ResourceType,
  SubjectType,
} from "@prisma/client";
import type { DbClient } from "./types";

export type AccessIntentWithRelations = Prisma.AccessIntentGetPayload<{
  include: {
    resourcePolicy: true;
    accessReceipt: true;
  };
}>;

export interface CreateAccessIntentInput {
  resourcePolicyId: string;
  resourceKey: string;
  resourceType: ResourceType;
  subjectType: SubjectType;
  subjectId: string;
  paymentRef: string | null;
  status: AccessIntentStatus;
  verifiedAt: Date | null;
  receiptIssuedAt: Date | null;
  expiresAt: Date | null;
}

export async function createAccessIntent(
  db: DbClient,
  input: CreateAccessIntentInput,
): Promise<AccessIntentModel> {
  return db.accessIntent.create({
    data: {
      resourcePolicyId: input.resourcePolicyId,
      resourceKey: input.resourceKey,
      resourceType: input.resourceType,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      paymentRef: input.paymentRef,
      status: input.status,
      verifiedAt: input.verifiedAt,
      receiptIssuedAt: input.receiptIssuedAt,
      expiresAt: input.expiresAt,
    },
  });
}

export async function getAccessIntentById(
  db: DbClient,
  id: string,
): Promise<AccessIntentWithRelations | null> {
  return db.accessIntent.findUnique({
    where: { id },
    include: {
      resourcePolicy: true,
      accessReceipt: true,
    },
  });
}

export async function markAccessIntentVerified(
  db: DbClient,
  id: string,
  verifiedAt: Date,
  receiptIssuedAt: Date | null,
): Promise<AccessIntentModel> {
  return db.accessIntent.update({
    where: { id },
    data: {
      status: receiptIssuedAt ? "RECEIPT_ISSUED" : "VERIFIED",
      verifiedAt,
      receiptIssuedAt,
    },
  });
}

export async function markAccessIntentRejected(
  db: DbClient,
  id: string,
): Promise<AccessIntentModel> {
  return db.accessIntent.update({
    where: { id },
    data: {
      status: "REJECTED",
    },
  });
}
