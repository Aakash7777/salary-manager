import { Injectable } from '@nestjs/common';
import { FX_TABLE_VERSION, currencyFor, listCountries, toUsdMinor } from '@salary-manager/shared';
import { findOutliers } from '../domain/outliers.js';
import { summarize } from '../domain/stats.js';
import { InvalidInputError } from '../employees/errors.js';
import { InsightsRepository, type PayRow } from './insights.repository.js';

export interface PaySummary {
  headcount: number;
  countryCount: number;
  departmentCount: number;
  jobTitleCount: number;
  /** Indicative: each country's payroll converted at the fixed FX table, then added. */
  payrollUsdMinor: number;
  fxTableVersion: string;
}

/** Headcount and salary statistics, all in one local currency. */
export interface PayStats {
  headcount: number;
  minMinor: number;
  medianMinor: number;
  avgMinor: number;
  maxMinor: number;
}

export interface CountryRef {
  code: string;
  name: string;
  currency: string;
}

export type CountryPay = CountryRef & PayStats;
export type JobTitlePay = { jobTitle: string } & PayStats;

export interface PayOutlier {
  employeeId: number;
  fullName: string;
  jobTitle: string;
  salaryMinor: number;
  roleMedianMinor: number;
  differencePct: number;
  direction: 'above' | 'below';
}

export interface CountryJobTitles {
  country: CountryRef;
  jobTitles: JobTitlePay[];
  outliers: PayOutlier[];
}

function groupBy<T>(items: T[], keyOf: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const group = groups.get(key);
    if (group) {
      group.push(item);
    } else {
      groups.set(key, [item]);
    }
  }
  return groups;
}

function payStatsOf(rows: PayRow[]): PayStats {
  const { count, min, median, avg, max } = summarize(rows.map((row) => row.salaryMinor));
  // Every group here has at least one row, so the nulls of an empty summary cannot occur.
  return {
    headcount: count,
    minMinor: min ?? 0,
    medianMinor: median ?? 0,
    avgMinor: avg ?? 0,
    maxMinor: max ?? 0,
  };
}

function countryRefs(): CountryRef[] {
  return listCountries().map(({ code, name, currency }) => ({ code, name, currency }));
}

@Injectable()
export class InsightsService {
  constructor(private readonly repository: InsightsRepository) {}

  getSummary(): PaySummary {
    const rows = this.repository.findPayRows();
    const rowsByCountry = groupBy(rows, (row) => row.countryCode);

    // Amounts in different currencies are never added together: each country's total is
    // converted to USD on its own, and only the USD amounts are summed. Both sums run in
    // BigInt, because a total can pass Number.MAX_SAFE_INTEGER even when no salary does.
    let payrollUsdMinor = 0n;
    for (const [countryCode, countryRows] of rowsByCountry) {
      const localTotalMinor = countryRows.reduce(
        (total, row) => total + BigInt(row.salaryMinor),
        0n,
      );
      payrollUsdMinor += BigInt(toUsdMinor(localTotalMinor, currencyFor(countryCode)));
    }

    return {
      headcount: rows.length,
      countryCount: rowsByCountry.size,
      departmentCount: new Set(rows.map((row) => row.department)).size,
      jobTitleCount: new Set(rows.map((row) => row.jobTitle)).size,
      payrollUsdMinor: Number(payrollUsdMinor),
      fxTableVersion: FX_TABLE_VERSION,
    };
  }

  getCountries(): CountryPay[] {
    const rowsByCountry = groupBy(this.repository.findPayRows(), (row) => row.countryCode);

    return countryRefs()
      .flatMap((country): CountryPay[] => {
        const rows = rowsByCountry.get(country.code);
        return rows ? [{ ...country, ...payStatsOf(rows) }] : [];
      })
      .sort((a, b) => b.headcount - a.headcount || a.name.localeCompare(b.name, 'en'));
  }

  getCountryJobTitles(code: string): CountryJobTitles {
    const country = countryRefs().find((candidate) => candidate.code === code);
    if (!country) {
      throw new InvalidInputError([{ path: 'code', message: 'Select a supported country' }]);
    }
    const rows = this.repository.findPayRows(country.code);
    const rowsById = new Map(rows.map((row) => [row.id, row]));

    const jobTitles = [...groupBy(rows, (row) => row.jobTitle)]
      .map(([jobTitle, titleRows]): JobTitlePay => ({ jobTitle, ...payStatsOf(titleRows) }))
      .sort((a, b) => b.medianMinor - a.medianMinor || a.jobTitle.localeCompare(b.jobTitle, 'en'));

    const outliers = findOutliers(
      rows.map((row) => ({ id: row.id, groupKey: row.jobTitle, salaryMinor: row.salaryMinor })),
    )
      .map((outlier): PayOutlier => ({
        employeeId: outlier.id,
        fullName: rowsById.get(outlier.id)?.fullName ?? '',
        jobTitle: outlier.groupKey,
        salaryMinor: outlier.salaryMinor,
        roleMedianMinor: outlier.groupMedianMinor,
        differencePct: outlier.differencePct,
        direction: outlier.direction,
      }))
      .sort(
        (a, b) =>
          Math.abs(b.differencePct) - Math.abs(a.differencePct) || a.employeeId - b.employeeId,
      );

    return { country, jobTitles, outliers };
  }
}
