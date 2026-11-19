import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import {
  EmailAlreadyInUseError,
  EmployeeNotFoundError,
  InvalidInputError,
} from '../employees/errors.js';
import { toErrorResponse } from './error-response.js';

describe('toErrorResponse', () => {
  it('maps InvalidInputError to 400 with the field problems', () => {
    const error = new InvalidInputError([
      { path: 'email', message: 'Enter a valid email address' },
    ]);

    expect(toErrorResponse(error)).toEqual({
      status: 400,
      error: {
        code: 'INVALID_INPUT',
        message: 'The input is invalid',
        fields: [{ path: 'email', message: 'Enter a valid email address' }],
      },
    });
  });

  it('maps EmployeeNotFoundError to 404, without a fields list', () => {
    expect(toErrorResponse(new EmployeeNotFoundError(999))).toEqual({
      status: 404,
      error: { code: 'EMPLOYEE_NOT_FOUND', message: 'Employee 999 was not found' },
    });
  });

  it('maps EmailAlreadyInUseError to 409', () => {
    expect(toErrorResponse(new EmailAlreadyInUseError('priya.sharma@acme.test'))).toEqual({
      status: 409,
      error: {
        code: 'EMAIL_ALREADY_IN_USE',
        message: 'An employee with the email priya.sharma@acme.test already exists',
      },
    });
  });

  it.each([
    { exception: new NotFoundException('Cannot GET /api/nope'), status: 404, code: 'NOT_FOUND' },
    { exception: new BadRequestException('Unexpected token'), status: 400, code: 'BAD_REQUEST' },
  ])('keeps the status and message of a framework $code error', ({ exception, status, code }) => {
    expect(toErrorResponse(exception)).toEqual({
      status,
      error: { code, message: exception.message },
    });
  });

  it('hides the message of a framework 5xx error', () => {
    const exception = new ServiceUnavailableException('database pool exhausted on host db-7');

    expect(toErrorResponse(exception)).toEqual({
      status: 503,
      error: { code: 'SERVICE_UNAVAILABLE', message: 'Something went wrong. Please try again.' },
    });
  });

  it.each([
    { thrown: new Error('SQLITE_CONSTRAINT: salary_changes'), description: 'an unexpected Error' },
    { thrown: 'a string', description: 'a thrown string' },
    { thrown: undefined, description: 'undefined' },
  ])('maps $description to a 500 that leaks nothing', ({ thrown }) => {
    expect(toErrorResponse(thrown)).toEqual({
      status: 500,
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' },
    });
  });
});
