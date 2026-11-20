import { raisePctSchema, toUsdMinor } from '@salary-manager/shared';

export interface PaidEmployee {
  currency: string;
  salaryMinor: number;
}

/** What a raise costs for the people paid in one currency. Every amount is in that currency. */
export interface CurrencyRaise {
  currency: string;
  headcount: number;
  currentTotalMinor: number;
  increaseMinor: number;
  newTotalMinor: number;
}

export interface RaiseSimulation {
  /** One row per currency, in order of currency code. */
  byCurrency: CurrencyRaise[];
  /** Indicative: each currency's increase converted at the fixed FX table, then added. */
  increaseUsdMinor: number;
}

/** The percentage as a whole number of tenths, so no float takes part in the money maths. */
function tenthsOfPercent(pct: number): bigint {
  const parsed = raisePctSchema.safeParse(pct);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Enter a valid raise percentage');
  }
  return BigInt(Math.round(parsed.data * 10));
}

/**
 * The yearly cost of giving everyone in `employees` a raise of `pct` percent (0 to 50, at most
 * one decimal). Each person's increase is rounded half up to the minor unit before anything is
 * added, so the totals are what people would actually be paid.
 */
export function simulateRaise(employees: PaidEmployee[], pct: number): RaiseSimulation {
  const tenths = tenthsOfPercent(pct);

  const totals = new Map<string, { headcount: number; current: bigint; increase: bigint }>();
  for (const { currency, salaryMinor } of employees) {
    const salary = BigInt(salaryMinor);
    const total = totals.get(currency) ?? { headcount: 0, current: 0n, increase: 0n };
    total.headcount += 1;
    total.current += salary;
    // salary x tenths / 1000, rounded half up.
    total.increase += (salary * tenths + 500n) / 1000n;
    totals.set(currency, total);
  }

  const sortedTotals = [...totals].sort(([a], [b]) => a.localeCompare(b, 'en'));

  // Amounts in different currencies are never added together: each currency's increase is
  // converted to USD on its own, and only the USD amounts are summed.
  let increaseUsdMinor = 0n;
  for (const [currency, total] of sortedTotals) {
    increaseUsdMinor += BigInt(toUsdMinor(total.increase, currency));
  }

  return {
    byCurrency: sortedTotals.map(([currency, total]) => ({
      currency,
      headcount: total.headcount,
      currentTotalMinor: Number(total.current),
      increaseMinor: Number(total.increase),
      newTotalMinor: Number(total.current + total.increase),
    })),
    increaseUsdMinor: Number(increaseUsdMinor),
  };
}
