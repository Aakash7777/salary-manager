import type { InputIssue } from '../domain/input-issue.js';

export class InvalidInputError extends Error {
  constructor(readonly issues: InputIssue[]) {
    super('The input is invalid');
    this.name = 'InvalidInputError';
  }
}

/** The error for input that failed a zod schema, with each issue's path joined by dots. */
export function invalidInputFrom(
  issues: { path: PropertyKey[]; message: string }[],
): InvalidInputError {
  return new InvalidInputError(
    issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
  );
}

export class EmailAlreadyInUseError extends Error {
  constructor(readonly email: string) {
    super(`An employee with the email ${email} already exists`);
    this.name = 'EmailAlreadyInUseError';
  }
}

export class EmployeeNotFoundError extends Error {
  constructor(readonly employeeId: number) {
    super(`Employee ${employeeId} was not found`);
    this.name = 'EmployeeNotFoundError';
  }
}
