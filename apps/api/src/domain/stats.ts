export interface Summary {
  count: number;
  min: number | null;
  median: number | null;
  avg: number | null;
  max: number | null;
}

const EMPTY_SUMMARY: Summary = { count: 0, min: null, median: null, avg: null, max: null };

// BigInt keeps sums of many large minor-unit amounts exact, where floats would drift.
function divideRoundingHalfUp(dividend: bigint, divisor: bigint): number {
  return Number((2n * dividend + divisor) / (2n * divisor));
}

/** Summarizes non-negative integer amounts in minor units. Every result is an integer. */
export function summarize(amounts: number[]): Summary {
  const sorted = [...amounts].sort((a, b) => a - b);
  const count = sorted.length;
  const min = sorted[0];
  const max = sorted[count - 1];
  const upperMiddle = sorted[Math.floor(count / 2)];
  if (min === undefined || max === undefined || upperMiddle === undefined) {
    return { ...EMPTY_SUMMARY };
  }

  const lowerMiddle = sorted[Math.floor(count / 2) - 1] ?? upperMiddle;
  const median =
    count % 2 === 1
      ? upperMiddle
      : divideRoundingHalfUp(BigInt(lowerMiddle) + BigInt(upperMiddle), 2n);
  const sum = sorted.reduce((total, amount) => total + BigInt(amount), 0n);

  return { count, min, median, avg: divideRoundingHalfUp(sum, BigInt(count)), max };
}
