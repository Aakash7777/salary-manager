import { Controller, Get } from '@nestjs/common';
import { type EmployeeMeta, EmployeesService } from './employees.service.js';

@Controller('api/meta')
export class MetaController {
  constructor(private readonly employees: EmployeesService) {}

  @Get()
  getMeta(): EmployeeMeta {
    return this.employees.getMeta();
  }
}
