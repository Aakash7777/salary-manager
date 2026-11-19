import 'reflect-metadata';
import { join } from 'node:path';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import type { AppDatabase } from './db/database.js';
import { DATABASE } from './db/database.module.js';
import { serveWebApp } from './http/serve-web-app.js';
import { DEFAULT_SEED_OPTIONS, seedIfEmpty } from './seed/run-seed.js';

// apps/web/dist, seen from apps/api/dist (the built app) or apps/api/src (dev).
const DEFAULT_WEB_DIST_PATH = join(import.meta.dirname, '../../web/dist');

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  // Creating the app opens the database, which applies any pending migrations.
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Lets DatabaseModule close the SQLite connection cleanly when the process is stopped.
  app.enableShutdownHooks();

  if (process.env.SEED_ON_BOOT === 'false') {
    logger.log('Seed skipped: SEED_ON_BOOT is false');
  } else {
    const outcome = seedIfEmpty(app.get<AppDatabase>(DATABASE), DEFAULT_SEED_OPTIONS);
    logger.log(
      outcome.seeded
        ? `Seeded ${outcome.employees} employees and ${outcome.salaryChanges} salary changes: the database was empty`
        : `Seed skipped: the database already has ${outcome.employees} employees`,
    );
  }

  const webDistPath = process.env.WEB_DIST_PATH ?? DEFAULT_WEB_DIST_PATH;
  logger.log(
    serveWebApp(app, webDistPath)
      ? `Serving the web app from ${webDistPath}`
      : `No built web app at ${webDistPath}: serving the API only`,
  );

  const port = Number(process.env.PORT ?? 3000);
  // All interfaces, so the container's published port reaches it.
  await app.listen(port, '0.0.0.0');
  logger.log(`Listening on port ${port}`);
}

await bootstrap();
