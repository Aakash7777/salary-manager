import { Module } from '@nestjs/common';
import { ClockModule } from '../clock/clock.module.js';
import { DatabaseModule } from '../db/database.module.js';
import { EmployeesRepository } from './employees.repository.js';
import { EmployeesService } from './employees.service.js';

@Module({
  imports: [DatabaseModule, ClockModule],
  providers: [EmployeesRepository, EmployeesService],
  exports: [EmployeesService],
})
export class EmployeesModule {}
