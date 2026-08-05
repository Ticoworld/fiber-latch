import { z } from "zod";

import { AccessReceiptValidationError } from "./errors.js";

export type AccessReceiptGrantType = "single_redemption" | "multi_redemption";

export interface BuildAccessReceiptClaimsInput {
  readonly iss: string;
  readonly sub: string;
  readonly aud: string;
  readonly iat: number;
  readonly nbf: number;
  readonly exp: number;
  readonly jti: string;
  readonly intent_id: string;
  readonly resource_id: string;
  readonly policy_id: string;
  readonly payment_ref: string | null;
  readonly grant_type: AccessReceiptGrantType;
  readonly max_redemptions: number;
}

export interface AccessReceiptClaims {
  readonly iss: string;
  readonly sub: string;
  readonly aud: string;
  readonly iat: number;
  readonly nbf: number;
  readonly exp: number;
  readonly jti: string;
  readonly intent_id: string;
  readonly resource_id: string;
  readonly policy_id: string;
  readonly payment_ref: string | null;
  readonly grant_type: AccessReceiptGrantType;
  readonly max_redemptions: number;
}

const accessReceiptClaimsSchema = z
  .object({
    iss: z.string().min(1),
    sub: z.string().min(1),
    aud: z.string().min(1),
    iat: z.number().int(),
    nbf: z.number().int(),
    exp: z.number().int(),
    jti: z.string().min(1),
    intent_id: z.string().min(1),
    resource_id: z.string().min(1),
    policy_id: z.string().min(1),
    payment_ref: z.string().nullable(),
    grant_type: z.enum(["single_redemption", "multi_redemption"]),
    max_redemptions: z.number().int().positive(),
  })
  .strip()
  .superRefine((claims, context) => {
    if (claims.grant_type === "single_redemption" && claims.max_redemptions !== 1) {
      context.addIssue({
        code: "custom",
        path: ["grant_type"],
        message: "grant type is inconsistent with redemption limit",
      });
    }

    if (claims.grant_type === "multi_redemption" && claims.max_redemptions <= 1) {
      context.addIssue({
        code: "custom",
        path: ["grant_type"],
        message: "grant type is inconsistent with redemption limit",
      });
    }

    if (claims.iat > claims.nbf) {
      context.addIssue({
        code: "custom",
        path: ["nbf"],
        message: "not-before time precedes issuance time",
      });
    }

    if (claims.nbf >= claims.exp) {
      context.addIssue({
        code: "custom",
        path: ["exp"],
        message: "expiration time must be after not-before time",
      });
    }
  });

function summariseIssue(issue: z.ZodIssue): { path: readonly string[]; reason: string } {
  const reason =
    issue.code === "invalid_type"
      ? "invalid type"
      : issue.code === "too_small"
        ? "value is too small"
        : issue.code === "custom"
          ? "invalid claim relationship"
          : "invalid value";

  return {
    path: issue.path.map((segment) => String(segment)),
    reason,
  };
}

export function buildAccessReceiptClaims(input: BuildAccessReceiptClaimsInput): AccessReceiptClaims {
  const result = accessReceiptClaimsSchema.safeParse(input);

  if (!result.success) {
    throw new AccessReceiptValidationError(result.error.issues.map(summariseIssue));
  }

  return result.data;
}
