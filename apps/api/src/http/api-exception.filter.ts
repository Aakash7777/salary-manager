import { type ArgumentsHost, Catch, type ExceptionFilter, Logger } from '@nestjs/common';
import { toErrorResponse } from './error-response.js';

interface JsonResponse {
  status(code: number): { json(body: unknown): void };
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const { status, error } = toErrorResponse(exception);
    if (status >= 500) {
      // The caller gets a generic message, so the real error has to be kept here.
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    }
    host.switchToHttp().getResponse<JsonResponse>().status(status).json({ error });
  }
}
