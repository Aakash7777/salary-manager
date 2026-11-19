import { Inject, Module, type OnModuleDestroy } from '@nestjs/common';
import { resolveDatabasePath } from './database-path.js';
import { type AppDatabase, openDatabase } from './database.js';

export const DATABASE = Symbol('DATABASE');

@Module({
  providers: [
    {
      provide: DATABASE,
      useFactory: (): AppDatabase => openDatabase(resolveDatabasePath(process.env)),
    },
  ],
  exports: [DATABASE],
})
export class DatabaseModule implements OnModuleDestroy {
  constructor(@Inject(DATABASE) private readonly db: AppDatabase) {}

  onModuleDestroy(): void {
    this.db.$client.close();
  }
}
