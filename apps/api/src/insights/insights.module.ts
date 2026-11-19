import { Module } from '@nestjs/common';
import { DatabaseModule } from '../db/database.module.js';
import { InsightsController } from './insights.controller.js';
import { InsightsRepository } from './insights.repository.js';
import { InsightsService } from './insights.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [InsightsController],
  providers: [InsightsRepository, InsightsService],
})
export class InsightsModule {}
