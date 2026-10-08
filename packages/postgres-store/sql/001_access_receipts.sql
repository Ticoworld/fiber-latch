-- Explicit host-applied migration. Never executed by the store factory.
-- Epoch seconds and counts use the exact JavaScript safe-integer domain.
CREATE TABLE public.access_receipts (
  jti text PRIMARY KEY CHECK (length(jti) > 0),
  iss text NOT NULL CHECK (length(iss) > 0),
  sub text NOT NULL CHECK (length(sub) > 0),
  aud text NOT NULL CHECK (length(aud) > 0),
  intent_id text NOT NULL CHECK (length(intent_id) > 0),
  resource_id text NOT NULL CHECK (length(resource_id) > 0),
  policy_id text NOT NULL CHECK (length(policy_id) > 0),
  grant_type text NOT NULL,
  max_redemptions bigint NOT NULL CHECK (max_redemptions BETWEEN 1 AND 9007199254740991),
  redemption_count bigint NOT NULL DEFAULT 0,
  iat bigint NOT NULL CHECK (iat BETWEEN -9007199254740991 AND 9007199254740991),
  nbf bigint NOT NULL CHECK (nbf BETWEEN -9007199254740991 AND 9007199254740991),
  exp bigint NOT NULL CHECK (exp BETWEEN -9007199254740991 AND 9007199254740991),
  payment_ref text,
  revoked_at timestamptz,
  CONSTRAINT access_receipts_count CHECK (redemption_count BETWEEN 0 AND max_redemptions),
  CONSTRAINT access_receipts_validity CHECK (iat <= nbf AND nbf < exp),
  CONSTRAINT access_receipts_grant CHECK (
    (grant_type = 'single_redemption' AND max_redemptions = 1) OR
    (grant_type = 'multi_redemption' AND max_redemptions > 1)
  )
);
