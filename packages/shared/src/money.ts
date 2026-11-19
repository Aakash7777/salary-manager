import { assertMinorAmount } from './assert-minor-amount.js';
import { minorUnitsFor } from './countries.js';

export interface Money {
  amountMinor: number;
  currency: string;
}

const UNSIGNED_DECIMAL = /^(-?)(\d+)(?:\.(\d+))?$/;
const NON_BREAKING_SPACES = /[\u00a0\u202f]/g;

export function toMinor(major: number | string, currency: string): number {
  const minorUnits = minorUnitsFor(currency);

  // Parsing the decimal text, not multiplying, is what keeps 1.15 from becoming 114.
  const match = UNSIGNED_DECIMAL.exec(String(major));
  if (!match) {
    throw new Error(`Invalid amount: ${major}`);
  }
  const [, sign, whole = '', fraction = ''] = match;
  if (sign === '-') {
    throw new Error(`Amount must not be negative: ${major}`);
  }
  if (fraction.length > minorUnits) {
    throw new Error(`Amount has more than ${minorUnits} decimal places: ${major}`);
  }

  const amountMinor = BigInt(whole + fraction.padEnd(minorUnits, '0'));
  if (amountMinor > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(`Amount is too large: ${major}`);
  }
  return Number(amountMinor);
}

export function formatMoney(amountMinor: number, currency: string): string {
  assertMinorAmount(amountMinor);
  const minorUnits = minorUnitsFor(currency);

  const digits = String(amountMinor).padStart(minorUnits + 1, '0');
  const whole = digits.slice(0, digits.length - minorUnits);
  const fraction = digits.slice(digits.length - minorUnits);
  const fractionDigits = /^0*$/.test(fraction) ? 0 : minorUnits;

  // Intl gets the exact decimal text: dividing by 100 would lose cents on very large amounts.
  const formatted = new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
    style: 'currency',
    currency,
    currencyDisplay: 'code',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(`${whole}.${fraction}` as Intl.StringNumericLiteral);

  return formatted.replace(NON_BREAKING_SPACES, ' ');
}
