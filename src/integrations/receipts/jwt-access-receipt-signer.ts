import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";
import type {
  AccessReceiptClaims,
  AccessReceiptSignInput,
  AccessReceiptSigner,
  JwksDocument,
  SignedAccessReceipt,
  VerifiedAccessReceipt,
} from "./access-receipt-signer";
import type { ReceiptSigningKeyMaterial } from "../../config/signing-key";

const ClaimsSchema = z.object({
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
  grant_type: z.string().min(1),
  max_redemptions: z.number().int().positive(),
});

function toClaims(input: AccessReceiptSignInput): AccessReceiptClaims {
  return {
    iss: input.issuer,
    sub: input.subjectId,
    aud: input.audience,
    iat: Math.floor(input.issuedAt.getTime() / 1000),
    nbf: Math.floor(input.notBefore.getTime() / 1000),
    exp: Math.floor(input.expiresAt.getTime() / 1000),
    jti: input.jti,
    intent_id: input.intentId,
    resource_id: input.resourceId,
    policy_id: input.policyId,
    payment_ref: input.paymentRef,
    grant_type: input.grantType,
    max_redemptions: input.maxRedemptions,
  };
}

export function createJwtAccessReceiptSigner(
  keyMaterial: ReceiptSigningKeyMaterial,
  expectedIssuer: string,
  expectedAudience: string,
): AccessReceiptSigner {
  return {
    async sign(input: AccessReceiptSignInput): Promise<SignedAccessReceipt> {
      const claims = toClaims(input);
      const token = await new SignJWT({
        intent_id: claims.intent_id,
        resource_id: claims.resource_id,
        policy_id: claims.policy_id,
        payment_ref: claims.payment_ref,
        grant_type: claims.grant_type,
        max_redemptions: claims.max_redemptions,
      })
        .setProtectedHeader({
          alg: "EdDSA",
          kid: keyMaterial.kid,
          typ: "JWT",
        })
        .setIssuer(claims.iss)
        .setSubject(claims.sub)
        .setAudience(claims.aud)
        .setIssuedAt(claims.iat)
        .setNotBefore(claims.nbf)
        .setExpirationTime(claims.exp)
        .setJti(claims.jti)
        .sign(keyMaterial.privateKey);

      return {
        token,
        claims,
      };
    },

    async verify(token: string): Promise<VerifiedAccessReceipt> {
      try {
        const { payload } = await jwtVerify(token, keyMaterial.publicKey, {
          algorithms: ["EdDSA"],
          issuer: expectedIssuer,
          audience: expectedAudience,
          clockTolerance: 0,
        });

        const claims = ClaimsSchema.parse({
          ...payload,
          payment_ref: payload.payment_ref ?? null,
        });

        return {
          verified: true,
          claims,
          reason: null,
        };
      } catch (error) {
        const reason =
          error instanceof Error && error.name === "JWTExpired"
            ? "RECEIPT_EXPIRED"
            : error instanceof Error && error.name === "JWTClaimValidationFailed"
              ? "RECEIPT_CLAIMS_INVALID"
              : "INVALID_RECEIPT_TOKEN";
        return {
          verified: false,
          claims: null,
          reason,
        };
      }
    },

    async getPublicJwks(): Promise<JwksDocument> {
      return {
        keys: [
          {
            ...keyMaterial.publicJwk,
          },
        ],
      };
    },
  };
}
