import { z } from 'zod';
import { listEmployeesQuerySchema } from './employee-schemas.js';

export const MAX_RAISE_PCT = 50;

const RANGE_MESSAGE = `Raise percentage must be between 0 and ${MAX_RAISE_PCT}`;
const AT_MOST_ONE_DECIMAL = /^\d+(\.\d)?$/;

function isInRange(pct: number): boolean {
  return pct >= 0 && pct <= MAX_RAISE_PCT;
}

/** A raise in percent: 0 to 50, in steps no finer than 0.1. */
export const raisePctSchema = z
  .number({
    error: (issue) =>
      issue.input === undefined ? 'Raise percentage is required' : 'Enter a valid raise percentage',
  })
  .min(0, RANGE_MESSAGE)
  .max(MAX_RAISE_PCT, RANGE_MESSAGE)
  // An out-of-range percentage already has its own message, so it is not also judged here.
  .refine(
    (pct) => !isInRange(pct) || AT_MOST_ONE_DECIMAL.test(String(pct)),
    'Raise percentage can have at most 1 decimal place',
  );

/**
 * What the raise simulator is asked: a group, chosen like the directory's list, and a percentage.
 * The filters have the list query's shape, so its sort and paging are accepted; they change nothing.
 */
export const simulateRaiseInputSchema = z.strictObject({
  filters: listEmployeesQuerySchema.prefault({}),
  pct: raisePctSchema,
});

export type SimulateRaiseInput = z.infer<typeof simulateRaiseInputSchema>;
