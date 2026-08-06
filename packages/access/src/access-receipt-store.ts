import type { AccessReceiptGrantType } from "./receipt-claims.js";

export interface AccessReceiptConsumeCommand {
  /** Stable receipt identity used by the host's authoritative state. */
  readonly jti: string;

  /** Verified signed authority that the host must compare with persisted authority. */
  readonly iss: string;
  readonly sub: string;
  readonly aud: string;
  readonly intent_id: string;
  readonly resource_id: string;
  readonly policy_id: string;
  readonly grant_type: AccessReceiptGrantType;
  readonly max_redemptions: number;
  readonly exp: number;

  /** Trusted host execution time used for the authoritative expiry decision. */
  readonly current_time: number;

  /** Optional trusted host-policy limit; it must never increase persisted authority. */
  readonly expected_max_redemptions?: number;
}

export type AccessReceiptConsumeResult =
  /** Atomic consumption succeeded and capacity remains. */
  | {
      readonly outcome: "consumed";
      readonly exhausted: false;
    }
  /** Atomic consumption succeeded and reached the authoritative limit. */
  | {
      readonly outcome: "consumed";
      readonly exhausted: true;
    }
  /** No authoritative persisted receipt exists. */
  | {
      readonly outcome: "receipt_missing";
    }
  /** Authoritative receipt state is revoked. */
  | {
      readonly outcome: "receipt_revoked";
    }
  /** The receipt was exhausted before this attempt. */
  | {
      readonly outcome: "receipt_exhausted";
    }
  /** The authoritative operation denies use at or after expiry. */
  | {
      readonly outcome: "receipt_expired";
    }
  /** Signed, trusted host, or persisted authority does not match. */
  | {
      readonly outcome: "authority_mismatch";
    }
  /** Authoritative state changed and this attempt did not consume access. */
  | {
      readonly outcome: "concurrency_conflict";
    }
  /** The store could not complete or confidently determine the transition. */
  | {
      readonly outcome: "system_failure";
    };

/**
 * Host-owned contract for one authoritative atomic consumption transition.
 *
 * The package defines the semantic boundary but does not prescribe a database
 * primitive, transaction object, schema, or production persistence adapter.
 */
export interface AccessReceiptStore {
  readonly consume: (
    command: AccessReceiptConsumeCommand,
  ) => Promise<AccessReceiptConsumeResult>;
}
