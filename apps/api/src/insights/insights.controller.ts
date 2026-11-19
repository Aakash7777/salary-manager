import { Controller, Get, Param } from '@nestjs/common';
import {
  type CountryJobTitles,
  type CountryPay,
  InsightsService,
  type PaySummary,
} from './insights.service.js';

@Controller('api/insights')
export class InsightsController {
  constructor(private readonly insights: InsightsService) {}

  @Get('summary')
  getSummary(): PaySummary {
    return this.insights.getSummary();
  }

  @Get('countries')
  getCountries(): CountryPay[] {
    return this.insights.getCountries();
  }

  @Get('countries/:code/job-titles')
  getCountryJobTitles(@Param('code') code: string): CountryJobTitles {
    return this.insights.getCountryJobTitles(code);
  }
}
