import { z } from "zod";
import { ACCESS_RECEIPT_STATUSES } from "../domain/access-state";
import { ResourceSchema, SubjectSchema } from "./common";

const AccessReceiptSummarySchema = z.object({
  id: z.string().min(1),
  jti: z.string().min(1),
  status: z.enum(ACCESS_RECEIPT_STATUSES),
  receiptToken: z.string().nullable(),
  active: z.boolean(),
  redemptionCount: z.number().int().nonnegative(),
  maxRedemptions: z.number().int().positive(),
  issuedAt: z.string().datetime(),
  nbf: z.string().datetime(),
  exp: z.string().datetime(),
  redeemedAt: z.string().datetime().nullable(),
  exhaustedAt: z.string().datetime().nullable(),
  revokedAt: z.string().datetime().nullable(),
});

const AccessIntentSchema = z.object({
  id: z.string().min(1),
  policyId: z.string().min(1),
  status: z.enum([
    "PENDING_VERIFICATION",
    "VERIFIED",
    "RECEIPT_ISSUED",
    "REJECTED",
    "EXPIRED",
  ]),
  resource: ResourceSchema,
  subject: SubjectSchema,
  paymentRef: z.string().nullable(),
  verifiedAt: z.string().datetime().nullable(),
  receiptIssuedAt: z.string().datetime().nullable(),
  expiresAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  accessReceipt: AccessReceiptSummarySchema.nullable(),
});

export const CreateAccessIntentRequestSchema = z.object({
  resource: ResourceSchema,
  subject: SubjectSchema,
  paymentRef: z.string().min(1).optional(),
  idempotencyKey: z.string().min(1).max(128).optional(),
});

export const CreateAccessIntentResponseSchema = z.object({
  accessIntent: AccessIntentSchema,
});

export const GetAccessIntentResponseSchema = z.object({
  accessIntent: AccessIntentSchema,
});

export type CreateAccessIntentRequest = z.infer<typeof CreateAccessIntentRequestSchema>;
export type CreateAccessIntentResponse = z.infer<typeof CreateAccessIntentResponseSchema>;
export type GetAccessIntentResponse = z.infer<typeof GetAccessIntentResponseSchema>;
