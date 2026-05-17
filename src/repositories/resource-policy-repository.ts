import type { ResourcePolicy, ResourceType } from "@prisma/client";
import type { DbClient } from "./types";

export interface EnsureResourcePolicyInput {
  resourceKey: string;
  resourceType: ResourceType;
  receiptTtlSeconds: number;
  maxRedemptions: number;
}

export async function ensureResourcePolicy(
  db: DbClient,
  input: EnsureResourcePolicyInput,
): Promise<ResourcePolicy> {
  const existing = await db.resourcePolicy.findUnique({
    where: {
      resourceKey_resourceType: {
        resourceKey: input.resourceKey,
        resourceType: input.resourceType,
      },
    },
  });

  if (existing) {
    return existing;
  }

  return db.resourcePolicy.create({
    data: {
      resourceKey: input.resourceKey,
      resourceType: input.resourceType,
      receiptTtlSeconds: input.receiptTtlSeconds,
      maxRedemptions: input.maxRedemptions,
      active: true,
    },
  });
}

export async function getResourcePolicyById(
  db: DbClient,
  id: string,
): Promise<ResourcePolicy | null> {
  return db.resourcePolicy.findUnique({
    where: { id },
  });
}
