import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { type RaiseSimulationResult, SimulationsService } from './simulations.service.js';

@Controller('api/simulations')
export class SimulationsController {
  constructor(private readonly simulations: SimulationsService) {}

  // POST because the question has a body, but 200 and not 201: nothing is created.
  @Post('raise')
  @HttpCode(HttpStatus.OK)
  simulateRaise(@Body() body: unknown): RaiseSimulationResult {
    return this.simulations.simulateRaise(body);
  }
}
