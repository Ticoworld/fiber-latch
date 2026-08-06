import {
  AccessReceiptValidationError,
} from "./errors.js";
import {
  buildAccessReceiptClaims,
  type AccessReceiptClaims,
  type BuildAccessReceiptClaimsInput,
} from "./receipt-claims.js";

export interface AccessReceiptExpectedBindings {
  readonly sub: string;
  readonly resource_id: string;
  readonly policy_id: string;
  readonly intent_id: string;
  readonly max_redemptions?: number;
}

export type AccessReceiptBindingResult =
  | {
      readonly status: "matched";
    }
  | {
      readonly status: "binding_denied";
      readonly phase: "binding";
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(record: Record<string, unknown>, property: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, property);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isValidExpectedBindings(value: unknown): value is AccessReceiptExpectedBindings {
  if (!isRecord(value)) {
    return false;
  }

  for (const property of ["sub", "resource_id", "policy_id", "intent_id"] as const) {
    if (!hasOwn(value, property) || !isNonEmptyString(value[property])) {
      return false;
    }
  }

  if (hasOwn(value, "max_redemptions")) {
    const maxRedemptions = value.max_redemptions;
    if (
      typeof maxRedemptions !== "number" ||
      !Number.isSafeInteger(maxRedemptions) ||
      maxRedemptions <= 0
    ) {
      return false;
    }
  }

  return true;
}

function matched(): AccessReceiptBindingResult {
  return Object.freeze({ status: "matched" as const });
}

function bindingDenied(): AccessReceiptBindingResult {
  return Object.freeze({
    status: "binding_denied" as const,
    phase: "binding" as const,
  });
}

export function evaluateAccessReceiptBindings(
  claims: AccessReceiptClaims,
  expected: AccessReceiptExpectedBindings,
): AccessReceiptBindingResult {
  if (!isValidExpectedBindings(expected)) {
    return bindingDenied();
  }

  let canonicalClaims: AccessReceiptClaims;
  try {
    canonicalClaims = buildAccessReceiptClaims(
      claims as unknown as BuildAccessReceiptClaimsInput,
    );
  } catch (error) {
    if (error instanceof AccessReceiptValidationError) {
      return bindingDenied();
    }

    throw error;
  }

  if (
    canonicalClaims.sub !== expected.sub ||
    canonicalClaims.resource_id !== expected.resource_id ||
    canonicalClaims.policy_id !== expected.policy_id ||
    canonicalClaims.intent_id !== expected.intent_id
  ) {
    return bindingDenied();
  }

  if (
    expected.max_redemptions !== undefined &&
    canonicalClaims.max_redemptions !== expected.max_redemptions
  ) {
    return bindingDenied();
  }

  return matched();
}
