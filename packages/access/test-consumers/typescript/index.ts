import * as access from "@fiberlatch/access";

const input: access.BuildAccessReceiptClaimsInput = {
  iss: "https://access.example.test",
  sub: "user_42",
  aud: "protected-api",
  iat: 1785000000,
  nbf: 1785000000,
  exp: 1785003600,
  jti: "jti_typescript_01",
  intent_id: "intent_typescript_01",
  resource_id: "course/module-1",
  policy_id: "policy_single_access_v1",
  payment_ref: null,
  grant_type: "single_redemption",
  max_redemptions: 1,
};

const claims: access.AccessReceiptClaims = access.buildAccessReceiptClaims(input);
void claims;
