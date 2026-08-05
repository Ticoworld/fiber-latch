import * as access from "@fiberlatch/access";

const claims = access.buildAccessReceiptClaims({
  iss: "https://access.example.test",
  sub: "user_42",
  aud: "protected-api",
  iat: 1785000000,
  nbf: 1785000000,
  exp: 1785003600,
  jti: "jti_esm_01",
  intent_id: "intent_esm_01",
  resource_id: "course/module-1",
  policy_id: "policy_single_access_v1",
  payment_ref: null,
  grant_type: "single_redemption",
  max_redemptions: 1,
});

if (claims.grant_type !== "single_redemption") {
  throw new Error("Expected a single-redemption claim.");
}

if (typeof access !== "object" || access === null) {
  throw new Error("Expected the package namespace to be an object.");
}

if (Object.getPrototypeOf(access) !== null) {
  throw new Error("Expected an ESM namespace object.");
}

if ("default" in access) {
  throw new Error("Expected no default export in the package.");
}
