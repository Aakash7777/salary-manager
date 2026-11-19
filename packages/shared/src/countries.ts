import { assertMinorAmount } from './assert-minor-amount.js';

export const FX_TABLE_VERSION = '2026-11';

export interface Country {
  code: string;
  name: string;
  currency: string;
  minorUnits: number;
  /** Fixed indicative rate: 1 unit of `currency` in USD. At most 6 decimal places. */
  fxToUsd: number;
}

const COUNTRIES: readonly Country[] = [
  { code: 'IN', name: 'India', currency: 'INR', minorUnits: 2, fxToUsd: 0.012 },
  { code: 'US', name: 'United States', currency: 'USD', minorUnits: 2, fxToUsd: 1 },
  { code: 'GB', name: 'United Kingdom', currency: 'GBP', minorUnits: 2, fxToUsd: 1.27 },
  { code: 'DE', name: 'Germany', currency: 'EUR', minorUnits: 2, fxToUsd: 1.08 },
  { code: 'SG', name: 'Singapore', currency: 'SGD', minorUnits: 2, fxToUsd: 0.74 },
];

const RATE_SCALE = 1_000_000;

export function getCountry(code: string): Country {
  const country = COUNTRIES.find((candidate) => candidate.code === code);
  if (!country) {
    throw new Error(`Unknown country code: ${code}`);
  }
  return country;
}

export function listCountries(): Country[] {
  return [...COUNTRIES].sort((a, b) => a.name.localeCompare(b.name, 'en'));
}

export function currencyFor(code: string): string {
  return getCountry(code).currency;
}

function firstCountryUsing(currency: string): Country {
  const country = COUNTRIES.find((candidate) => candidate.currency === currency);
  if (!country) {
    throw new Error(`Unknown currency: ${currency}`);
  }
  return country;
}

export function minorUnitsFor(currency: string): number {
  return firstCountryUsing(currency).minorUnits;
}

export function toUsdMinor(amountMinor: number, currency: string): number {
  assertMinorAmount(amountMinor);
  const country = firstCountryUsing(currency);

  // The rate becomes an integer and the maths runs in BigInt so no float ever touches the
  // amount. Every currency here has 2 minor units, like USD, so no unit rescaling is needed.
  const scale = BigInt(RATE_SCALE);
  const scaledRate = BigInt(Math.round(country.fxToUsd * RATE_SCALE));
  const roundedHalfUp = (BigInt(amountMinor) * scaledRate + scale / 2n) / scale;
  return Number(roundedHalfUp);
}
