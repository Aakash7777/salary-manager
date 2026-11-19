import { changeSalaryInputSchema } from '@salary-manager/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FixedClock, SystemClock } from './clock.js';

describe('Clock.today', () => {
  it.each([
    {
      now: '2026-11-19T09:59:59.999Z',
      expected: '2026-11-19',
      why: 'one millisecond before UTC+14 reaches midnight',
    },
    {
      now: '2026-11-19T10:00:00.000Z',
      expected: '2026-11-20',
      why: 'UTC+14 has just reached midnight, although UTC is still on the 19th',
    },
    {
      now: '2026-11-19T23:59:59.999Z',
      expected: '2026-11-20',
      why: 'one millisecond before the UTC date changes',
    },
    {
      now: '2026-11-20T00:00:00.000Z',
      expected: '2026-11-20',
      why: 'the UTC date has just changed and now matches UTC+14',
    },
    {
      now: '2026-12-31T10:00:00.000Z',
      expected: '2027-01-01',
      why: 'UTC+14 crosses into the new year first',
    },
    {
      now: '2028-02-28T10:00:00.000Z',
      expected: '2028-02-29',
      why: 'UTC+14 reaches the leap day first',
    },
  ])('is $expected at $now ($why)', ({ now, expected }) => {
    expect(new FixedClock(now).today()).toBe(expected);
  });

  it('never tells a user at UTC+14 that their own local date is in the future', () => {
    // 10:30 UTC on the 19th is already 00:30 on the 20th at UTC+14.
    const clock = new FixedClock('2026-11-19T10:30:00.000Z');

    const result = changeSalaryInputSchema(clock.today()).safeParse({
      newSalaryMajor: 85_000,
      effectiveDate: '2026-11-20',
      reason: 'Promotion to Staff Engineer',
    });

    expect(result.success).toBe(true);
  });

  it('still rejects a date that is in the future everywhere on Earth', () => {
    const clock = new FixedClock('2026-11-19T10:30:00.000Z');

    const result = changeSalaryInputSchema(clock.today()).safeParse({
      newSalaryMajor: 85_000,
      effectiveDate: '2026-11-21',
      reason: 'Promotion to Staff Engineer',
    });

    expect(result.error?.issues.map((issue) => issue.message)).toEqual([
      'Effective date cannot be in the future',
    ]);
  });
});

describe('FixedClock', () => {
  it('returns the instant it was given, every time', () => {
    const clock = new FixedClock('2026-11-19T10:30:00.000Z');

    expect(clock.now().toISOString()).toBe('2026-11-19T10:30:00.000Z');
    expect(clock.now().toISOString()).toBe('2026-11-19T10:30:00.000Z');
  });

  it('is not changed by a caller mutating the date it handed out', () => {
    const clock = new FixedClock('2026-11-19T10:30:00.000Z');

    clock.now().setUTCFullYear(1999);

    expect(clock.now().toISOString()).toBe('2026-11-19T10:30:00.000Z');
  });
});

describe('SystemClock', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reads now() from the system time', () => {
    vi.useFakeTimers({ now: new Date('2026-11-19T09:59:59.999Z') });

    expect(new SystemClock().now().toISOString()).toBe('2026-11-19T09:59:59.999Z');
  });

  it('derives today() from the system time using the UTC+14 rule', () => {
    vi.useFakeTimers({ now: new Date('2026-11-19T10:00:00.000Z') });

    expect(new SystemClock().today()).toBe('2026-11-20');
  });
});
