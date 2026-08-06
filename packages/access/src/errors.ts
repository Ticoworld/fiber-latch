export interface AccessReceiptValidationIssue {
  readonly path: readonly string[];
  readonly reason: string;
}

export interface AccessReceiptConfigurationIssue {
  readonly path: readonly string[];
  readonly reason: string;
}

export class AccessReceiptValidationError extends Error {
  readonly issues: readonly AccessReceiptValidationIssue[];

  constructor(issues: readonly AccessReceiptValidationIssue[]) {
    super("Invalid access receipt claims.");
    this.name = "AccessReceiptValidationError";
    this.issues = issues;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class AccessReceiptConfigurationError extends Error {
  readonly issues: readonly AccessReceiptConfigurationIssue[];

  constructor(issues: readonly AccessReceiptConfigurationIssue[]) {
    super("Invalid access receipt configuration.");
    this.name = "AccessReceiptConfigurationError";
    this.issues = issues;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class AccessReceiptVerificationError extends Error {
  readonly code = "verification_denied" as const;

  constructor() {
    super("Access receipt verification failed.");
    this.name = "AccessReceiptVerificationError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
