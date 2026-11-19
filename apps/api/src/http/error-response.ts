import { HttpException, HttpStatus } from '@nestjs/common';
import type { InputIssue } from '../domain/input-issue.js';
import {
  EmailAlreadyInUseError,
  EmployeeNotFoundError,
  InvalidInputError,
} from '../employees/errors.js';

export interface ErrorBody {
  code: string;
  message: string;
  fields?: InputIssue[];
}

export interface ErrorResponse {
  status: number;
  error: ErrorBody;
}

const GENERIC_MESSAGE = 'Something went wrong. Please try again.';

export function toErrorResponse(exception: unknown): ErrorResponse {
  if (exception instanceof InvalidInputError) {
    return {
      status: HttpStatus.BAD_REQUEST,
      error: { code: 'INVALID_INPUT', message: exception.message, fields: exception.issues },
    };
  }
  if (exception instanceof EmployeeNotFoundError) {
    return {
      status: HttpStatus.NOT_FOUND,
      error: { code: 'EMPLOYEE_NOT_FOUND', message: exception.message },
    };
  }
  if (exception instanceof EmailAlreadyInUseError) {
    return {
      status: HttpStatus.CONFLICT,
      error: { code: 'EMAIL_ALREADY_IN_USE', message: exception.message },
    };
  }
  if (exception instanceof HttpException) {
    // Errors Nest raises itself, such as an unknown route or a malformed JSON body.
    const status = exception.getStatus();
    return {
      status,
      error: {
        code: HttpStatus[status] ?? 'HTTP_ERROR',
        // A 4xx message describes the caller's request; a 5xx one may describe our internals.
        message: status < 500 ? exception.message : GENERIC_MESSAGE,
      },
    };
  }
  return {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    error: { code: 'INTERNAL_ERROR', message: GENERIC_MESSAGE },
  };
}
