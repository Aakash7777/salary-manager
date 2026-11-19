import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';
import { AppModule } from './app.module.js';
import { Clock, SystemClock } from './clock/clock.js';

describe('AppModule', () => {
  it('provides the system clock wherever a Clock is injected', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    expect(moduleRef.get(Clock, { strict: false })).toBeInstanceOf(SystemClock);
  });
});
