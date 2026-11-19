export function assertMinorAmount(amountMinor: number): void {
  if (!Number.isInteger(amountMinor)) {
    throw new Error(`amountMinor must be an integer number of minor units: ${amountMinor}`);
  }
  if (amountMinor < 0) {
    throw new Error(`amountMinor must not be negative: ${amountMinor}`);
  }
}
