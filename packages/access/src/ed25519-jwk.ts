import { base64url, importJWK } from "jose";
import type { CryptoKey, JWK } from "jose";

import {
  AccessReceiptConfigurationError,
  type AccessReceiptConfigurationIssue,
} from "./errors.js";

export type AccessReceiptJwk = Readonly<Record<string, unknown>>;

export interface AccessReceiptSignerConfiguration {
  readonly privateKey: AccessReceiptJwk;
}

export interface AccessReceiptVerifierConfiguration {
  readonly publicKeys: readonly AccessReceiptJwk[];
  readonly issuer: string;
  readonly audience: string;
  readonly clockTolerance?: number;
  readonly maxTokenSize?: number;
}

export interface ImportedEd25519Key {
  readonly kid: string;
  readonly key: CryptoKey;
}

type KeyKind = "private" | "public";

const ED25519_BYTES = 32;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/u;

function hasOwn(record: Record<string, unknown>, property: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, property);
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }

  return value as Record<string, unknown>;
}

function issue(path: readonly string[], reason: string): AccessReceiptConfigurationIssue {
  return { path, reason };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isBase64Url32(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0 || !BASE64URL_PATTERN.test(value)) {
    return false;
  }

  try {
    return base64url.decode(value).byteLength === ED25519_BYTES;
  } catch {
    return false;
  }
}

function validateKeyOperations(
  record: Record<string, unknown>,
  kind: KeyKind,
  path: readonly string[],
): AccessReceiptConfigurationIssue[] {
  if (!hasOwn(record, "key_ops")) {
    return [];
  }

  const keyOps = record.key_ops;
  const requiredOperation = kind === "private" ? "sign" : "verify";
  const allowedOperations = kind === "private" ? ["sign", "verify"] : ["verify"];

  if (
    !Array.isArray(keyOps) ||
    keyOps.some((operation) => typeof operation !== "string") ||
    !keyOps.includes(requiredOperation) ||
    keyOps.some((operation) => !allowedOperations.includes(operation))
  ) {
    return [issue([...path, "key_ops"], "unsupported key operations")];
  }

  return [];
}

function validateJwk(
  value: unknown,
  kind: KeyKind,
  path: readonly string[],
): { record: Record<string, unknown>; issues: AccessReceiptConfigurationIssue[] } {
  const record = asRecord(value);
  if (!record) {
    return { record: {}, issues: [issue(path, "must be an object")] };
  }

  const issues: AccessReceiptConfigurationIssue[] = [];

  if (record.kty !== "OKP") {
    issues.push(issue([...path, "kty"], "must be OKP"));
  }

  if (record.crv !== "Ed25519") {
    issues.push(issue([...path, "crv"], "must be Ed25519"));
  }

  if (!isNonEmptyString(record.kid)) {
    issues.push(issue([...path, "kid"], "must be a non-empty string"));
  }

  if (!isBase64Url32(record.x)) {
    issues.push(issue([...path, "x"], "must be a valid Ed25519 public value"));
  }

  if (kind === "private") {
    if (!isBase64Url32(record.d)) {
      issues.push(issue([...path, "d"], "must be a valid Ed25519 private value"));
    }
  } else if (hasOwn(record, "d")) {
    issues.push(issue([...path, "d"], "private material is not permitted"));
  }

  if (hasOwn(record, "alg") && record.alg !== "EdDSA") {
    issues.push(issue([...path, "alg"], "must be EdDSA"));
  }

  if (hasOwn(record, "use") && record.use !== "sig") {
    issues.push(issue([...path, "use"], "must be sig"));
  }

  issues.push(...validateKeyOperations(record, kind, path));

  return { record, issues };
}

function copyForImport(record: Record<string, unknown>): JWK {
  return {
    ...record,
    ...(Array.isArray(record.key_ops) ? { key_ops: [...record.key_ops] } : {}),
  } as unknown as JWK;
}

async function importKey(
  value: unknown,
  kind: KeyKind,
  path: readonly string[],
): Promise<ImportedEd25519Key> {
  const validation = validateJwk(value, kind, path);
  if (validation.issues.length > 0) {
    throw new AccessReceiptConfigurationError(validation.issues);
  }

  const kid = validation.record.kid as string;

  try {
    const imported = await importJWK(copyForImport(validation.record), "EdDSA", {
      extractable: false,
    });

    if (imported instanceof Uint8Array) {
      throw new Error("Expected an asymmetric key.");
    }

    return { kid, key: imported };
  } catch {
    throw new AccessReceiptConfigurationError([
      issue(path, "key could not be imported for EdDSA"),
    ]);
  }
}

export function requireConfigurationRecord(value: unknown): Record<string, unknown> {
  const record = asRecord(value);
  if (!record) {
    throw new AccessReceiptConfigurationError([
      issue(["config"], "must be an object"),
    ]);
  }

  return record;
}

export function rejectUnsupportedConfiguration(
  record: Record<string, unknown>,
  properties: readonly string[],
): void {
  const issues = properties
    .filter((property) => hasOwn(record, property))
    .map((property) => issue([property], "unsupported configuration"));

  if (issues.length > 0) {
    throw new AccessReceiptConfigurationError(issues);
  }
}

export function importTrustedPrivateKey(value: unknown): Promise<ImportedEd25519Key> {
  return importKey(value, "private", ["privateKey"]);
}

export function importTrustedPublicKey(
  value: unknown,
  index: number,
): Promise<ImportedEd25519Key> {
  return importKey(value, "public", ["publicKeys", String(index)]);
}
