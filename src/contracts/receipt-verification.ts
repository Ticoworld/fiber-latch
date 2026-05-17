import { z } from "zod";
import { ACCESS_RECEIPT_STATUSES } from "../domain/access-state";
import { ResourceSchema, SubjectSchema } from "./common";

export const VerifyAccessReceiptRequestSchema = z.object({
  receiptToken: z.string().min(1),
});

export const VerifyAccessReceiptResponseSchema = z.object({
  receiptVerification: z.object({
    verified: z.boolean(),
    accessReceiptId: z.string().nullable(),
    accessIntentId: z.string().nullable(),
    jti: z.string().nullable(),
    receiptStatus: z.enum(ACCESS_RECEIPT_STATUSES).nullable(),
    resource: ResourceSchema.nullable(),
    subject: SubjectSchema.nullable(),
    issuedAt: z.string().datetime().nullable(),
    exp: z.string().datetime().nullable(),
    verifiedAt: z.string().datetime(),
    reason: z.string().nullable(),
  }),
});

export type VerifyAccessReceiptRequest = z.infer<typeof VerifyAccessReceiptRequestSchema>;
export type VerifyAccessReceiptResponse = z.infer<typeof VerifyAccessReceiptResponseSchema>;
