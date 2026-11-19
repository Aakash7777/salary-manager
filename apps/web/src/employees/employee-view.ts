import { formatMoney, getCountry } from '@salary-manager/shared';
import { percentChangeText } from './salary-preview';

export function countryNameOf(countryCode: string): string {
  try {
    return getCountry(countryCode).name;
  } catch {
    return countryCode;
  }
}

interface RoleComparison {
  countryCode: string;
  currency: string;
  roleMedianMinor: number | null;
  pctVsRoleMedian: number | null;
}

/** The line under the current salary that compares it with the same role in the same country. */
export function roleMedianLine({
  countryCode,
  currency,
  roleMedianMinor,
  pctVsRoleMedian,
}: RoleComparison): string {
  const country = countryNameOf(countryCode);
  if (roleMedianMinor === null || pctVsRoleMedian === null) {
    return `Only person in this role in ${country}`;
  }
  const position =
    pctVsRoleMedian === 0
      ? 'at the median'
      : `${Math.abs(pctVsRoleMedian).toFixed(1)}% ${pctVsRoleMedian > 0 ? 'above' : 'below'}`;
  return `Median for this role in ${country}: ${formatMoney(roleMedianMinor, currency)} · ${position}`;
}

export interface HistoryEntryView {
  kind: 'starting' | 'countryChange' | 'increase' | 'decrease';
  /** One amount for a starting salary, otherwise "old → new". */
  amounts: string;
  /** Null where a percentage would mean nothing: no old amount, or two currencies. */
  percent: string | null;
}

interface HistoryAmounts {
  oldSalaryMinor: number | null;
  oldCurrency: string | null;
  newSalaryMinor: number;
  currency: string;
}

export function historyEntryView(entry: HistoryAmounts): HistoryEntryView {
  const newAmount = formatMoney(entry.newSalaryMinor, entry.currency);
  if (entry.oldSalaryMinor === null || entry.oldCurrency === null) {
    return { kind: 'starting', amounts: newAmount, percent: null };
  }
  const amounts = `${formatMoney(entry.oldSalaryMinor, entry.oldCurrency)} → ${newAmount}`;
  if (entry.oldCurrency !== entry.currency) {
    return { kind: 'countryChange', amounts, percent: null };
  }
  return {
    kind: entry.newSalaryMinor >= entry.oldSalaryMinor ? 'increase' : 'decrease',
    amounts,
    percent: percentChangeText(entry.oldSalaryMinor, entry.newSalaryMinor),
  };
}
