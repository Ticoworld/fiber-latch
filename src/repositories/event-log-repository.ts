import type { EventLogType, ResourceType, SubjectType } from "@prisma/client";
import type { DbClient } from "./types";

export interface AppendEventLogInput {
  eventType: EventLogType;
  resourcePolicyId?: string | null;
  resourceKey?: string | null;
  resourceType?: ResourceType | null;
  accessIntentId?: string | null;
  accessReceiptId?: string | null;
  subjectType?: SubjectType | null;
  subjectId?: string | null;
  payload?: unknown;
}

export async function appendEventLog(db: DbClient, input: AppendEventLogInput): Promise<void> {
  await db.eventLog.create({
    data: {
      eventType: input.eventType,
      resourcePolicyId: input.resourcePolicyId ?? null,
      resourceKey: input.resourceKey ?? null,
      resourceType: input.resourceType ?? null,
      accessIntentId: input.accessIntentId ?? null,
      accessReceiptId: input.accessReceiptId ?? null,
      subjectType: input.subjectType ?? null,
      subjectId: input.subjectId ?? null,
      payloadJson: input.payload ? JSON.stringify(input.payload) : null,
    },
  });
}
