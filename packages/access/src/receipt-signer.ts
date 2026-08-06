import { SignJWT } from "jose";
import type { JWTPayload } from "jose";

import {
  buildAccessReceiptClaims,
  type AccessReceiptClaims,
  type BuildAccessReceiptClaimsInput,
} from "./receipt-claims.js";
import {
  importTrustedPrivateKey,
  rejectUnsupportedConfiguration,
  requireConfigurationRecord,
  type AccessReceiptSignerConfiguration,
} from "./ed25519-jwk.js";

export type AccessReceiptSigner = (
  claims: AccessReceiptClaims
) => Promise<string>;

export async function createAccessReceiptSigner(
  config: AccessReceiptSignerConfiguration,
): Promise<AccessReceiptSigner> {
  const record = requireConfigurationRecord(config);
  rejectUnsupportedConfiguration(record, [
    "algorithm",
    "algorithms",
    "alg",
    "protectedHeader",
    "header",
  ]);

  const imported = await importTrustedPrivateKey(record.privateKey);

  return async (claims) => {
    const canonicalClaims = buildAccessReceiptClaims(
      claims as unknown as BuildAccessReceiptClaimsInput,
    );

    return new SignJWT(canonicalClaims as unknown as JWTPayload)
      .setProtectedHeader({ alg: "EdDSA", typ: "JWT", kid: imported.kid })
      .sign(imported.key);
  };
}
