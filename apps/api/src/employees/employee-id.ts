import { InvalidInputError } from './errors.js';

const WHOLE_NUMBER = /^\d+$/;

export function parseEmployeeId(raw: string): number {
  const id = WHOLE_NUMBER.test(raw) ? Number(raw) : NaN;
  if (!Number.isSafeInteger(id)) {
    throw new InvalidInputError([{ path: 'id', message: 'Employee id must be a whole number' }]);
  }
  return id;
}
