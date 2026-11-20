import { Injectable } from '@nestjs/common';
import { FX_TABLE_VERSION, simulateRaiseInputSchema } from '@salary-manager/shared';
import { type RaiseSimulation, simulateRaise } from '../domain/raise-simulation.js';
import { EmployeesRepository } from '../employees/employees.repository.js';
import { invalidInputFrom } from '../employees/errors.js';

export interface RaiseSimulationResult extends RaiseSimulation {
  /** How many employees the filters matched. */
  headcount: number;
  fxTableVersion: string;
}

@Injectable()
export class SimulationsService {
  constructor(private readonly employees: EmployeesRepository) {}

  /** Read-only: it reads the matching salaries and calculates. Nothing is written. */
  simulateRaise(input: unknown): RaiseSimulationResult {
    const parsed = simulateRaiseInputSchema.safeParse(input);
    if (!parsed.success) {
      throw invalidInputFrom(parsed.error.issues);
    }

    const matching = this.employees.findPayMatching(parsed.data.filters);
    return {
      headcount: matching.length,
      ...simulateRaise(matching, parsed.data.pct),
      fxTableVersion: FX_TABLE_VERSION,
    };
  }
}
