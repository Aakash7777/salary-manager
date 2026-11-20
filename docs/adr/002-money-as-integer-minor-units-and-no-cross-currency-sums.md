# 002. Money as integer minor units, and no cross-currency sums

Status: Accepted (2026-11-19)

## Context

The requirements promise "no silent data errors: money is never a float, and no total adds up different currencies". Salaries are held in five currencies (INR, USD, GBP, EUR, SGD). Two kinds of mistake are easy to make and hard to notice: binary floats losing a cent (`1.15 * 100` is `114.99999999999999`), and a total or average that quietly mixes rupees with dollars.

## Decision

**An amount is an integer count of minor units plus an ISO-4217 currency code, and the currency is derived from the country.**

- The database stores `salary_minor INTEGER` and `currency`. The currency is never accepted as input: `currencyFor(countryCode)` sets it, and the strict zod schemas reject an unknown `currency` key.
- `toMinor` converts by parsing the decimal text, not by multiplying. It rejects negatives, more decimals than the currency has, and anything above `Number.MAX_SAFE_INTEGER`.
- `formatMoney` builds the decimal string itself and hands that to `Intl`, so nothing is divided by 100.
- Sums and averages in `summarize` run in `BigInt` and round half up. Every statistic is an integer.

**Amounts in different currencies are never added.**

- Per-country and per-job-title statistics, the role median on the employee page, and the outlier rule all work inside one country, so inside one currency.
- The only cross-country figure is the org-wide payroll. `InsightsService.getSummary` totals each country in its own currency, converts each total with `toUsdMinor`, and only then adds the USD amounts. The response carries `fxTableVersion`, and the UI labels the figure indicative.
- FX rates are fixed, versioned config in `packages/shared` (`FX_TABLE_VERSION`). `toUsdMinor` scales the rate to an integer (6 decimal places) and does the arithmetic in `BigInt`.
- A country change stores `old_currency` beside `old_salary_minor`, so a history row is never read in the wrong currency.

## Consequences

**What we get**

- Arithmetic is exact and reproducible, and the tests can assert exact numbers.
- A currency cannot disagree with its country.
- Every number on screen is either in one local currency or explicitly an approximate USD figure with a rate version.

**What it costs**

- Every edge must convert: the API takes `salaryMajor` and returns `salaryMinor` plus `currency`, and the UI formats.
- **The input is still a JSON number.** `salaryMajor` arrives as a float and is validated to at most 2 decimal places from its text form before `toMinor` parses it. That is safe up to the schema's maximum (about 90 trillion), but it is a float at the boundary; a string field would be stricter.
- **All five currencies have 2 minor units, and the code leans on that** (the 2-decimal check, the maximum salary, and `toUsdMinor` not rescaling). Adding JPY or KWD means touching those three places.
- **Sorting the directory by salary compares raw minor units across currencies**, so INR 1,800,000 sorts above USD 165,000. This is deliberate; the UI says so, and filtering by country makes the sort meaningful.
- The USD payroll is only as good as a hand-maintained rate table, and converting totals instead of each salary gives a slightly different rounding than a per-row conversion would.
- The per-country total inside `getSummary` is a plain number sum. It is exact while a country's payroll stays under 2^53 minor units (about 90 trillion in major units); `summarize` already uses `BigInt` and this sum could do the same.

**When this would change**

- A currency without 2 minor units is added: generalise the rescaling first.
- Finance needs the USD figure to be more than indicative: rates need an effective date and a source, and that is a table, not config.
- A country pays in more than one currency: the currency becomes data on the employee again, with its own validation.
