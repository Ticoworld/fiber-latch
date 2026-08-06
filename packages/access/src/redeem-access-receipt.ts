import { AccessReceiptVerificationError } from "./errors.js";
import { evaluateAccessReceiptBindings, type AccessReceiptExpectedBindings } from "./receipt-bindings.js";
import type { AccessReceiptClaims } from "./receipt-claims.js";
import type {
  AccessReceiptConsumeCommand,
  AccessReceiptConsumeResult,
  AccessReceiptStore,
} from "./access-receipt-store.js";
import type { AccessReceiptVerifier } from "./receipt-verifier.js";

export interface RedeemAccessReceiptInput {
  readonly token: string;
  readonly expected: AccessReceiptExpectedBindings;
  readonly verifier: AccessReceiptVerifier;
  readonly store: AccessReceiptStore;
  readonly current_time: number;
}

export type AccessReceiptConsumptionDenialReason =
  | "receipt_missing"
  | "receipt_revoked"
  | "receipt_exhausted"
  | "receipt_expired"
  | "authority_mismatch"
  | "concurrency_conflict";

export type AccessReceiptRedemptionResult =
  | {
      readonly status: "success";
      readonly exhausted: false;
    }
  | {
      readonly status: "success";
      readonly exhausted: true;
    }
  | {
      readonly status: "verification_denied";
      readonly phase: "verification";
    }
  | {
      readonly status: "binding_denied";
      readonly phase: "binding";
    }
  | {
      readonly status: "consumption_denied";
      readonly phase: "consumption";
      readonly reason: AccessReceiptConsumptionDenialReason;
    }
  | {
      readonly status: "system_failure";
      readonly phase: "system";
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(record: Record<string, unknown>, property: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, property);
}

function isValidCurrentTime(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Number.isSafeInteger(value) &&
    value >= 0
  );
}

function systemFailure(): AccessReceiptRedemptionResult {
  return Object.freeze({ status: "system_failure" as const, phase: "system" as const });
}

function verificationDenied(): AccessReceiptRedemptionResult {
  return Object.freeze({
    status: "verification_denied" as const,
    phase: "verification" as const,
  });
}

function bindingDenied(): AccessReceiptRedemptionResult {
  return Object.freeze({ status: "binding_denied" as const, phase: "binding" as const });
}

function successful(exhausted: boolean): AccessReceiptRedemptionResult {
  return Object.freeze({ status: "success" as const, exhausted: exhausted as false | true });
}

function consumptionDenied(
  reason: AccessReceiptConsumptionDenialReason,
): AccessReceiptRedemptionResult {
  return Object.freeze({
    status: "consumption_denied" as const,
    phase: "consumption" as const,
    reason,
  });
}

function isAccessReceiptConsumeResult(value: unknown): value is AccessReceiptConsumeResult {
  if (!isRecord(value) || typeof value.outcome !== "string") {
    return false;
  }

  if (value.outcome === "consumed") {
    return typeof value.exhausted === "boolean";
  }

  return (
    value.outcome === "receipt_missing" ||
    value.outcome === "receipt_revoked" ||
    value.outcome === "receipt_exhausted" ||
    value.outcome === "receipt_expired" ||
    value.outcome === "authority_mismatch" ||
    value.outcome === "concurrency_conflict" ||
    value.outcome === "system_failure"
  );
}

function buildConsumeCommand(
  claims: AccessReceiptClaims,
  expected: AccessReceiptExpectedBindings,
  currentTime: number,
): AccessReceiptConsumeCommand {
  const baseCommand = {
    jti: claims.jti,
    iss: claims.iss,
    sub: claims.sub,
    aud: claims.aud,
    intent_id: claims.intent_id,
    resource_id: claims.resource_id,
    policy_id: claims.policy_id,
    grant_type: claims.grant_type,
    max_redemptions: claims.max_redemptions,
    exp: claims.exp,
    current_time: currentTime,
  };

  const expectedRecord = expected as unknown as Record<string, unknown>;
  if (hasOwn(expectedRecord, "max_redemptions")) {
    const expectedMaxRedemptions = expected.max_redemptions;
    if (expectedMaxRedemptions !== undefined) {
      return {
        ...baseCommand,
        expected_max_redemptions: expectedMaxRedemptions,
      };
    }
  }

  return baseCommand;
}

function mapConsumeResult(result: AccessReceiptConsumeResult): AccessReceiptRedemptionResult {
  if (result.outcome === "consumed") {
    return successful(result.exhausted);
  }

  if (result.outcome === "system_failure") {
    return systemFailure();
  }

  return consumptionDenied(result.outcome);
}

export async function redeemAccessReceipt(
  input: RedeemAccessReceiptInput,
): Promise<AccessReceiptRedemptionResult> {
  try {
    if (!isRecord(input)) {
      return systemFailure();
    }

    const verifier = input.verifier;
    const store = input.store;
    const currentTime = input.current_time;

    if (
      typeof verifier !== "function" ||
      !isRecord(store) ||
      typeof store.consume !== "function" ||
      !isValidCurrentTime(currentTime)
    ) {
      return systemFailure();
    }

    let claims: AccessReceiptClaims;
    try {
      claims = await verifier(input.token);
    } catch (error) {
      if (error instanceof AccessReceiptVerificationError) {
        return verificationDenied();
      }

      return systemFailure();
    }

    let bindingResult;
    try {
      bindingResult = evaluateAccessReceiptBindings(claims, input.expected);
    } catch {
      return systemFailure();
    }

    if (bindingResult.status === "binding_denied") {
      return bindingDenied();
    }

    if (bindingResult.status !== "matched") {
      return systemFailure();
    }

    const command = buildConsumeCommand(claims, input.expected, currentTime);
    let consumeResult: unknown;
    try {
      consumeResult = await store.consume(command);
    } catch {
      return systemFailure();
    }

    if (!isAccessReceiptConsumeResult(consumeResult)) {
      return systemFailure();
    }

    return mapConsumeResult(consumeResult);
  } catch {
    return systemFailure();
  }
}
