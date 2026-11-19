import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { EmployeesModule } from './employees/employees.module.js';
import { ApiExceptionFilter } from './http/api-exception.filter.js';

@Module({
  imports: [EmployeesModule],
  providers: [{ provide: APP_FILTER, useClass: ApiExceptionFilter }],
})
export class AppModule {}
