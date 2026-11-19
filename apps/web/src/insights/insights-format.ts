import { formatCount } from '../employees/format';

const COMPACT = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumSignificantDigits: 3,
});

/**
 * A USD amount shortened for a headline, such as "USD 663M". It is deliberately approximate:
 * the figure it shows is itself only indicative.
 */
export function compactUsd(usdMinor: number): string {
  // Rounded to whole dollars with integer maths before shortening.
  const wholeDollars = Number((BigInt(usdMinor) + 50n) / 100n);
  return `USD ${COMPACT.format(wholeDollars)}`;
}

/** "58.7% above" or "31.0% below", from a signed percentage against the role median. */
export function gapFromMedianLabel(differencePct: number): string {
  return `${Math.abs(differencePct).toFixed(1)}% ${differencePct >= 0 ? 'above' : 'below'}`;
}

export function pluralise(count: number, singular: string, plural: string): string {
  return `${formatCount(count)} ${count === 1 ? singular : plural}`;
}
