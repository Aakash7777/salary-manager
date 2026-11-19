import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { EmployeesModule } from './employees/employees.module.js';
import { HealthModule } from './health/health.module.js';
import { ApiExceptionFilter } from './http/api-exception.filter.js';
import { InsightsModule } from './insights/insights.module.js';

@Module({
  imports: [EmployeesModule, InsightsModule, HealthModule],
  providers: [{ provide: APP_FILTER, useClass: ApiExceptionFilter }],
})
export class AppModule {}
