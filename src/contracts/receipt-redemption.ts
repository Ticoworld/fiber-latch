import { z } from "zod";
import { ACCESS_RECEIPT_STATUSES, REDEMPTION_STATUSES } from "../domain/access-state";
import { ResourceSchema, SubjectSchema } from "./common";

export const RedeemAccessReceiptRequestSchema = z.object({
  receiptToken: z.string().min(1),
  resource: ResourceSchema,
  subject: SubjectSchema,
});

export const RedeemAccessReceiptResponseSchema = z.object({
  redemption: z.object({
    status: z.enum(REDEMPTION_STATUSES),
    accessGranted: z.boolean(),
    accessReceiptId: z.string().nullable(),
    accessIntentId: z.string().nullable(),
    jti: z.string().nullable(),
    receiptStatus: z.enum(ACCESS_RECEIPT_STATUSES).nullable(),
    resource: ResourceSchema,
    subject: SubjectSchema,
    redemptionCount: z.number().int().nonnegative(),
    maxRedemptions: z.number().int().nonnegative(),
    redeemedAt: z.string().datetime(),
    reason: z.string().nullable(),
  }),
});

export type RedeemAccessReceiptRequest = z.infer<typeof RedeemAccessReceiptRequestSchema>;
export type RedeemAccessReceiptResponse = z.infer<typeof RedeemAccessReceiptResponseSchema>;
