import { Module } from '@nestjs/common';
import { EmployeesModule } from '../employees/employees.module.js';
import { SimulationsController } from './simulations.controller.js';
import { SimulationsService } from './simulations.service.js';

@Module({
  imports: [EmployeesModule],
  controllers: [SimulationsController],
  providers: [SimulationsService],
})
export class SimulationsModule {}
