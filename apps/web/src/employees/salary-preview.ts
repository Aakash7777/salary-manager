import { formatMoney } from '@salary-manager/shared';

/**
 * The change from one amount to another as text with one decimal place, such as "+8.0%" or
 * "-3.2%". Both amounts are integer minor units in the same currency.
 */
export function percentChangeText(oldMinor: number, newMinor: number): string {
  const tenthsOfPercent = Math.round(((newMinor - oldMinor) * 1000) / oldMinor);
  // The sign follows the amounts, so a rise too small to show still reads "+0.0%".
  const sign = newMinor > oldMinor ? '+' : newMinor < oldMinor ? '-' : '';
  return `${sign}${(Math.abs(tenthsOfPercent) / 10).toFixed(1)}%`;
}

/** The live preview under "New annual salary". */
export function describeSalaryChange(
  currentMinor: number,
  newMinor: number,
  currency: string,
): string {
  if (newMinor === currentMinor) {
    return 'No change from the current salary';
  }
  const direction = newMinor > currentMinor ? 'Increase' : 'Decrease';
  const difference = formatMoney(Math.abs(newMinor - currentMinor), currency);
  return `${percentChangeText(currentMinor, newMinor)} · ${direction} of ${difference} per year`;
}
