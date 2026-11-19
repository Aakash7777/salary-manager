import { Module } from '@nestjs/common';
import { ClockModule } from './clock/clock.module.js';

@Module({
  imports: [ClockModule],
})
export class AppModule {}
