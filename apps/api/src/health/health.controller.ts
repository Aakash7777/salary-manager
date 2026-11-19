import { Controller, Get, HttpStatus, Inject, Logger, Res } from '@nestjs/common';
import type { AppDatabase } from '../db/database.js';
import { DATABASE } from '../db/database.module.js';

export interface HealthReport {
  status: 'ok' | 'error';
  db: 'ok' | 'error';
}

interface StatusSetter {
  status(code: number): unknown;
}

// Outside /api on purpose: it is for the platform's health checker, not for the web app.
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(@Inject(DATABASE) private readonly db: AppDatabase) {}

  @Get()
  check(@Res({ passthrough: true }) response: StatusSetter): HealthReport {
    try {
      // A real round trip to SQLite, so "ok" means the database file can be read.
      this.db.$client.prepare('SELECT 1').get();
      return { status: 'ok', db: 'ok' };
    } catch (error) {
      this.logger.error(error instanceof Error ? error.stack : String(error));
      response.status(HttpStatus.SERVICE_UNAVAILABLE);
      return { status: 'error', db: 'error' };
    }
  }
}
