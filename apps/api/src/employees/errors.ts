export interface InputIssue {
  path: string;
  message: string;
}

export class InvalidInputError extends Error {
  constructor(readonly issues: InputIssue[]) {
    super('The input is invalid');
    this.name = 'InvalidInputError';
  }
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
