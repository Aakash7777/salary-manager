import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  // Lets DatabaseModule close the SQLite connection cleanly when the process is stopped.
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000);
}

await bootstrap();
