import type {
  AccessReceiptConsumeCommand,
  AccessReceiptConsumeResult,
  AccessReceiptStore,
} from "@fiberlatch/access";

/** One parameterized statement on a host-owned pool or transaction client. */
export type PostgresQueryExecutor = (
  sql: string,
  parameters: readonly (string | number | null)[],
) => Promise<{ readonly rows: readonly unknown[] }>;

// MATERIALIZED forces the row lock before the decision's wall-clock checks.
// The lock and guarded update belong to ONE statement/host transaction.
const consumeSql = `
WITH locked AS MATERIALIZED (
  SELECT * FROM public.access_receipts WHERE jti = $1::text FOR UPDATE
), decision AS MATERIALIZED (
  SELECT jti, CASE
    WHEN iss <> $2::text OR sub <> $3::text OR aud <> $4::text
      OR intent_id <> $5::text OR resource_id <> $6::text OR policy_id <> $7::text
      OR grant_type <> $8::text OR max_redemptions <> $9::bigint OR exp <> $10::bigint
      OR ($12::bigint IS NOT NULL AND max_redemptions <> $12::bigint)
      THEN 'authority_mismatch'
    WHEN revoked_at IS NOT NULL THEN 'receipt_revoked'
    WHEN exp <= $11::bigint OR exp <= floor(extract(epoch FROM clock_timestamp()))
      THEN 'receipt_expired'
    WHEN nbf > $11::bigint OR nbf > floor(extract(epoch FROM clock_timestamp()))
      THEN 'authority_mismatch'
    WHEN redemption_count >= max_redemptions THEN 'receipt_exhausted'
    ELSE 'admit'
  END AS outcome FROM locked
), consumed AS (
  UPDATE public.access_receipts AS receipt
  SET redemption_count = receipt.redemption_count + 1
  FROM decision
  WHERE receipt.jti = decision.jti AND decision.outcome = 'admit'
    AND receipt.redemption_count < receipt.max_redemptions
  RETURNING receipt.redemption_count = receipt.max_redemptions AS exhausted
)
SELECT CASE
  WHEN consumed.exhausted IS NOT NULL THEN 'consumed'
  WHEN decision.outcome = 'admit' THEN 'concurrency_conflict'
  ELSE coalesce(decision.outcome, 'receipt_missing')
END AS outcome, consumed.exhausted
FROM (SELECT 1) AS singleton
LEFT JOIN decision ON true
LEFT JOIN consumed ON true
`;

function validCommand(command: AccessReceiptConsumeCommand): boolean {
  const strings = [command.jti, command.iss, command.sub, command.aud,
    command.intent_id, command.resource_id, command.policy_id];
  return strings.every((value) => typeof value === "string" && value.length > 0)
    && Number.isSafeInteger(command.max_redemptions) && command.max_redemptions > 0
    && Number.isSafeInteger(command.exp)
    && Number.isSafeInteger(command.current_time) && command.current_time >= 0
    && (command.expected_max_redemptions === undefined
      || (Number.isSafeInteger(command.expected_max_redemptions) && command.expected_max_redemptions > 0))
    && ((command.grant_type === "single_redemption" && command.max_redemptions === 1)
      || (command.grant_type === "multi_redemption" && command.max_redemptions > 1));
}

/** No connections, migrations, transaction control, lifecycle operations or retries. */
export function createPostgresAccessReceiptStore(query: PostgresQueryExecutor): AccessReceiptStore {
  return {
    async consume(command): Promise<AccessReceiptConsumeResult> {
      try {
        if (!validCommand(command)) return { outcome: "system_failure" };
        const { rows } = await query(consumeSql, [
          command.jti, command.iss, command.sub, command.aud,
          command.intent_id, command.resource_id, command.policy_id, command.grant_type,
          command.max_redemptions, command.exp, command.current_time,
          command.expected_max_redemptions ?? null,
        ]);
        if (rows.length !== 1) return { outcome: "system_failure" };
        const row = rows[0];
        if (typeof row !== "object" || row === null) return { outcome: "system_failure" };
        const result = row as Record<string, unknown>;
        if (result.outcome === "consumed" && typeof result.exhausted === "boolean") {
          return { outcome: "consumed", exhausted: result.exhausted };
        }
        if (result.exhausted !== null) return { outcome: "system_failure" };
        switch (result.outcome) {
          case "receipt_missing":
          case "authority_mismatch":
          case "receipt_revoked":
          case "receipt_expired":
          case "receipt_exhausted":
          case "concurrency_conflict":
            return { outcome: result.outcome };
          default:
            return { outcome: "system_failure" };
        }
      } catch {
        // An error may follow an already-committed transition: never retry.
        return { outcome: "system_failure" };
      }
    },
  };
}
