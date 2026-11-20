/** A bigint is how a total too large for a safe integer is passed around without losing units. */
export function assertMinorAmount(amountMinor: number | bigint): void {
  if (typeof amountMinor === 'number' && !Number.isInteger(amountMinor)) {
    throw new Error(`amountMinor must be an integer number of minor units: ${amountMinor}`);
  }
  if (amountMinor < 0) {
    throw new Error(`amountMinor must not be negative: ${amountMinor}`);
  }
}
