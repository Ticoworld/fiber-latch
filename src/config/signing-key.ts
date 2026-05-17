import {
  calculateJwkThumbprint,
  exportJWK,
  generateKeyPair,
  importJWK,
  importPKCS8,
  type JWK,
  type KeyLike,
} from "jose";

export interface ReceiptSigningKeyMaterial {
  privateKey: KeyLike;
  publicKey: KeyLike;
  publicJwk: JWK;
  kid: string;
}

export interface ReceiptSigningKeyInput {
  privateJwkJson: string | null;
}

function toPublicJwk(jwk: JWK, kid: string): JWK {
  return {
    kty: (jwk.kty ?? "OKP") as JWK["kty"],
    crv: jwk.crv as "Ed25519",
    x: jwk.x as string,
    use: "sig",
    alg: "EdDSA",
    kid,
  } as JWK;
}

function isLikelyPem(value: string): boolean {
  return value.includes("BEGIN PRIVATE KEY") || value.includes("BEGIN ENCRYPTED PRIVATE KEY");
}

export async function loadReceiptSigningKeyMaterial(
  input: ReceiptSigningKeyInput,
): Promise<ReceiptSigningKeyMaterial> {
  if (input.privateJwkJson) {
    const parsed = JSON.parse(input.privateJwkJson) as JWK;
    const privateKey = (await importJWK(parsed, "EdDSA")) as KeyLike;
    const exportedJwk = await exportJWK(privateKey);
    const kid = parsed.kid ?? (await calculateJwkThumbprint(exportedJwk));
    const publicJwk = toPublicJwk(exportedJwk, kid);
    const publicKey = (await importJWK(publicJwk, "EdDSA")) as KeyLike;

    return {
      privateKey,
      publicKey,
      publicJwk,
      kid,
    };
  }

  const keyPair = await generateKeyPair("Ed25519");
  const privateKey = keyPair.privateKey as KeyLike;
  const publicKey = keyPair.publicKey as KeyLike;
  const publicJwk = await exportJWK(keyPair.publicKey);
  const kid = await calculateJwkThumbprint(publicJwk);

  return {
    privateKey,
    publicKey,
    publicJwk: toPublicJwk(publicJwk, kid),
    kid,
  };
}

export async function importOptionalPrivateKeyPem(privateKeyPem: string): Promise<KeyLike> {
  // Unused in Phase 3, but kept as a narrow escape hatch for local config.
  if (!isLikelyPem(privateKeyPem)) {
    throw new Error("Unsupported private key format");
  }

  return importPKCS8(privateKeyPem, "EdDSA");
}
