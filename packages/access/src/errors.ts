export interface AccessReceiptValidationIssue {
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
