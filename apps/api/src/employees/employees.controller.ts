import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import type { EmployeeRow } from '../db/schema.js';
import { parseEmployeeId } from './employee-id.js';
import {
  type EmployeeListPage,
  type EmployeeWithSalaryHistory,
  EmployeesService,
} from './employees.service.js';

// Bodies and queries go to the service as they arrive; the service validates them.
@Controller('api/employees')
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @Get()
  list(@Query() query: unknown): EmployeeListPage {
    return this.employees.list(query);
  }

  @Get(':id')
  getById(@Param('id') id: string): EmployeeWithSalaryHistory {
    return this.employees.getById(parseEmployeeId(id));
  }

  @Post()
  create(@Body() body: unknown): EmployeeRow {
    return this.employees.create(body);
  }

  @Patch(':id')
  updateDetails(@Param('id') id: string, @Body() body: unknown): EmployeeRow {
    return this.employees.updateDetails(parseEmployeeId(id), body);
  }

  @Post(':id/salary-changes')
  changeSalary(@Param('id') id: string, @Body() body: unknown): EmployeeRow {
    return this.employees.changeSalary(parseEmployeeId(id), body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string): void {
    this.employees.remove(parseEmployeeId(id));
  }
}
