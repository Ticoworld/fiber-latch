import {
  decodeProtectedHeader,
  errors as joseErrors,
  jwtVerify,
} from "jose";

import {
  AccessReceiptConfigurationError,
  AccessReceiptValidationError,
  AccessReceiptVerificationError,
} from "./errors.js";
import { buildAccessReceiptClaims } from "./receipt-claims.js";
import {
  importTrustedPublicKey,
  rejectUnsupportedConfiguration,
  requireConfigurationRecord,
  type AccessReceiptVerifierConfiguration,
} from "./ed25519-jwk.js";
import type { AccessReceiptClaims, BuildAccessReceiptClaimsInput } from "./receipt-claims.js";
import type { CryptoKey } from "jose";

export type AccessReceiptVerifier = (token: string) => Promise<AccessReceiptClaims>;

// A measured canonical 13-claim receipt was 655 bytes; 4 KiB leaves room for
// normal identifier growth while keeping pre-verification input bounded.
const DEFAULT_MAX_TOKEN_SIZE = 4_096;
const MIN_MAX_TOKEN_SIZE = 256;
const MAX_MAX_TOKEN_SIZE = 16_384;
const MAX_CLOCK_TOLERANCE = 60;
const APPROVED_HEADER_KEYS = new Set(["alg", "typ", "kid"]);
const REQUIRED_CLAIMS = [
  "iss",
  "sub",
  "aud",
  "iat",
  "nbf",
  "exp",
  "jti",
  "intent_id",
  "resource_id",
  "policy_id",
  "payment_ref",
  "grant_type",
  "max_redemptions",
] as const;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/u;

type InternalVerificationReason =
  | "malformed_token"
  | "token_too_large"
  | "unsupported_header"
  | "unknown_key"
  | "invalid_signature"
  | "issuer_mismatch"
  | "audience_mismatch"
  | "not_yet_valid"
  | "expired"
  | "invalid_claims";

interface VerifierState {
  readonly keys: ReadonlyMap<string, CryptoKey>;
  readonly issuer: string;
  readonly audience: string;
  readonly clockTolerance: number;
  readonly maxTokenSize: number;
}

function deny(_reason: InternalVerificationReason): AccessReceiptVerificationError {
  return new AccessReceiptVerificationError();
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isBase64UrlSegment(value: string): boolean {
  return value.length > 0 && value.length % 4 !== 1 && BASE64URL_PATTERN.test(value);
}

function validateNumberOption(
  value: unknown,
  name: string,
  minimum: number,
  maximum: number,
  integer: boolean,
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < minimum ||
    value > maximum ||
    (integer && !Number.isInteger(value))
  ) {
    throw new Error(`${name} is invalid`);
  }

  return value;
}

function parseVerifierOptions(record: Record<string, unknown>): {
  issuer: string;
  audience: string;
  clockTolerance: number;
  maxTokenSize: number;
} {
  const issues: { readonly path: readonly string[]; readonly reason: string }[] = [];

  if (!isNonEmptyString(record.issuer)) {
    issues.push({ path: ["issuer"], reason: "must be a non-empty string" });
  }

  if (!isNonEmptyString(record.audience)) {
    issues.push({ path: ["audience"], reason: "must be a non-empty string" });
  }

  let clockTolerance = 0;
  if (hasOwn(record, "clockTolerance")) {
    try {
      clockTolerance = validateNumberOption(
        record.clockTolerance,
        "clockTolerance",
        0,
        MAX_CLOCK_TOLERANCE,
        false,
      );
    } catch {
      issues.push({ path: ["clockTolerance"], reason: "must be a bounded non-negative number" });
    }
  }

  let maxTokenSize = DEFAULT_MAX_TOKEN_SIZE;
  if (hasOwn(record, "maxTokenSize")) {
    try {
      maxTokenSize = validateNumberOption(
        record.maxTokenSize,
        "maxTokenSize",
        MIN_MAX_TOKEN_SIZE,
        MAX_MAX_TOKEN_SIZE,
        true,
      );
    } catch {
      issues.push({ path: ["maxTokenSize"], reason: "must be a bounded positive integer" });
    }
  }

  if (issues.length > 0) {
    throw new AccessReceiptConfigurationError(issues);
  }

  return {
    issuer: record.issuer as string,
    audience: record.audience as string,
    clockTolerance,
    maxTokenSize,
  };
}

function hasOwn(record: Record<string, unknown>, property: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, property);
}

function tokenByteLength(token: string): number {
  return new TextEncoder().encode(token).byteLength;
}

function parseHeader(token: string, maxTokenSize: number): Record<string, unknown> {
  if (token.length === 0) {
    throw deny("malformed_token");
  }

  if (tokenByteLength(token) > maxTokenSize) {
    throw deny("token_too_large");
  }

  const segments = token.split(".");
  if (
    segments.length !== 3 ||
    segments.some((segment) => !isBase64UrlSegment(segment))
  ) {
    throw deny("malformed_token");
  }

  let header: unknown;
  try {
    header = decodeProtectedHeader(token);
  } catch (error) {
    if (error instanceof TypeError || error instanceof joseErrors.JOSEError) {
      throw deny("malformed_token");
    }

    throw error;
  }

  if (typeof header !== "object" || header === null || Array.isArray(header)) {
    throw deny("malformed_token");
  }

  const record = header as Record<string, unknown>;
  if (Object.keys(record).some((property) => !APPROVED_HEADER_KEYS.has(property))) {
    throw deny("unsupported_header");
  }

  if (record.alg !== "EdDSA" || record.typ !== "JWT") {
    throw deny("unsupported_header");
  }

  if (!isNonEmptyString(record.kid)) {
    throw deny("unknown_key");
  }

  return record;
}

function isExpectedJoseFailure(error: unknown): boolean {
  return (
    error instanceof joseErrors.JWTClaimValidationFailed ||
    error instanceof joseErrors.JWTExpired ||
    error instanceof joseErrors.JWTInvalid ||
    error instanceof joseErrors.JWSInvalid ||
    error instanceof joseErrors.JWSSignatureVerificationFailed ||
    error instanceof joseErrors.JOSEAlgNotAllowed ||
    error instanceof joseErrors.JOSENotSupported ||
    error instanceof joseErrors.JWKInvalid
  );
}

function joseFailureReason(error: unknown): InternalVerificationReason {
  if (error instanceof joseErrors.JWTExpired) {
    return "expired";
  }

  if (error instanceof joseErrors.JWTClaimValidationFailed) {
    if (error.claim === "iss") return "issuer_mismatch";
    if (error.claim === "aud") return "audience_mismatch";
    if (error.claim === "nbf") return "not_yet_valid";
    if (error.claim === "exp") return "expired";
    return "invalid_claims";
  }

  if (error instanceof joseErrors.JWSSignatureVerificationFailed) {
    return "invalid_signature";
  }

  if (error instanceof joseErrors.JOSEAlgNotAllowed || error instanceof joseErrors.JOSENotSupported) {
    return "unsupported_header";
  }

  return "malformed_token";
}

async function verifyToken(token: unknown, state: VerifierState): Promise<AccessReceiptClaims> {
  if (typeof token !== "string") {
    throw deny("malformed_token");
  }

  const header = parseHeader(token, state.maxTokenSize);
  const key = state.keys.get(header.kid as string);
  if (!key) {
    throw deny("unknown_key");
  }

  let payload: unknown;
  try {
    const result = await jwtVerify<BuildAccessReceiptClaimsInput>(token, key, {
      algorithms: ["EdDSA"],
      issuer: state.issuer,
      audience: state.audience,
      typ: "JWT",
      clockTolerance: state.clockTolerance,
      requiredClaims: [...REQUIRED_CLAIMS],
    });
    payload = result.payload;
  } catch (error) {
    if (isExpectedJoseFailure(error)) {
      throw deny(joseFailureReason(error));
    }

    throw error;
  }

  try {
    return buildAccessReceiptClaims(payload as BuildAccessReceiptClaimsInput);
  } catch (error) {
    if (error instanceof AccessReceiptValidationError) {
      throw deny("invalid_claims");
    }

    throw error;
  }
}

export async function createAccessReceiptVerifier(
  config: AccessReceiptVerifierConfiguration,
): Promise<AccessReceiptVerifier> {
  const record = requireConfigurationRecord(config);
  rejectUnsupportedConfiguration(record, [
    "algorithm",
    "algorithms",
    "keyResolver",
    "getKey",
    "jwks",
    "jwksUri",
    "remoteJwks",
  ]);

  let options: ReturnType<typeof parseVerifierOptions>;
  options = parseVerifierOptions(record);

  if (!hasOwn(record, "publicKeys") || !Array.isArray(record.publicKeys) || record.publicKeys.length === 0) {
    throw new AccessReceiptConfigurationError([
      { path: ["publicKeys"], reason: "must be a non-empty array" },
    ]);
  }

  const keys = new Map<string, CryptoKey>();
  for (const [index, value] of record.publicKeys.entries()) {
    const imported = await importTrustedPublicKey(value, index);
    if (keys.has(imported.kid)) {
      throw new AccessReceiptConfigurationError([
        { path: ["publicKeys", String(index), "kid"], reason: "must be unique" },
      ]);
    }
    keys.set(imported.kid, imported.key);
  }

  const state: VerifierState = {
    keys,
    issuer: options.issuer,
    audience: options.audience,
    clockTolerance: options.clockTolerance,
    maxTokenSize: options.maxTokenSize,
  };

  return (token) => verifyToken(token, state);
}
