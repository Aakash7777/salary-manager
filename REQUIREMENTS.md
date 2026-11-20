# ACME Salary Manager — Requirements (v1)

## Goal
Replace the spreadsheets HR uses for ~10,000 employees in several countries with one web app. In it, the HR manager can **keep salary data correct** and **answer "how do we pay people?" in seconds**, without exporting to Excel.

## Persona: HR Manager
Comfortable with Excel, not technical. Typical jobs:
- "Update Priya's salary after her promotion, and keep a record of why."
- "Show me everyone in Engineering in Germany."
- "What do we pay a Senior Engineer in India compared with the US?"
- "Who is paid far outside the range for their role?"
- "What would an 8% raise for Engineering in India cost us?"

## What success looks like
- Any employee can be found with one search. The list stays fast at 10k rows (server-side pagination, p95 < 300 ms).
- Every question above is answered on one screen.
- No silent data errors: inputs are validated, money is never a float, and no total adds up different currencies.

## In scope
1. **Employee directory.** Paginated and searchable by name. Filter by country, department and job title. Sort by name, salary and hire date. Filters are kept in the URL so a view can be bookmarked or shared. Export the filtered list to CSV.
2. **Add / edit / remove an employee.** Fields: full name, email (unique), job title, department, country, currency (set by the country), annual base salary, employment type, hire date. Validated on both client and server.
3. **Salary change history.** Every salary change records the old value, new value, effective date and a required reason, in the same transaction. Shown on the employee page, along with the median for that role in that country.
4. **Salary insights**
   - Per country: headcount, min, median, average and max, in **local currency**.
   - Per job title within a country: the same stats, plus a list of employees paid more than 25% above or below their role's median.
   - Org-wide: headcount and total annual payroll in **USD**, using a fixed, versioned FX table. Labelled as indicative.
5. **Raise simulator (read-only).** Pick a group using the directory filters plus a raise of 0–50%. See the yearly cost per country in local currency and an indicative USD total. Nothing is saved.
6. **Seed script.** 10,000 realistic employees, generated deterministically (seeded), with salary bands by country and role.
7. **Deployed app, API docs (`/api/docs`), health check (`/health`) and a video demo.**

## Product rules
- A salary change's effective date **cannot be in the future**. The change applies immediately.
- Salary is **not** editable in "Edit details". It only changes through "Change salary", so every change has a reason.
- Changing an employee's **country** requires a new salary in the new currency, and that is recorded in the history.
- Creating an employee writes the first history entry ("Starting salary").

## Deliberately left out (and why)
| Left out | Why |
|---|---|
| Authentication / roles | There is one persona and the demo uses fake data. **This is the #1 blocker before real salaries go in**: it needs SSO plus role-based access, which depends on ACME's identity provider. |
| Payroll, tax, deductions, payslips | That is a different product. The ask is to manage salary *data* and understand pay, not to run payroll. |
| Bulk Excel/CSV import | This is the real migration path and the **first thing to build next**. Doing it properly (validation report, partial failures, de-duplication) is bigger than this time box. |
| Scheduled (future-dated) salary changes | Needs a job runner and "pending" states. Applying changes immediately keeps the data model simple. |
| Applying raises from the simulator | Bulk writes to salaries need approval workflows. The simulator only answers "what would it cost?" |
| Live FX rates | It adds an external dependency and makes results non-deterministic. Per-country stats never need conversion. |
| Bonus, equity, allowances, benefits | v1 covers base salary only. |
| Reporting lines, approvals, performance data, mobile UI, i18n | Not needed to answer the core pay questions. |

See `docs/NEXT.md` for the order these would be built in.

## Assumptions
- Salary means **annual gross base**, stored as integer minor units with an ISO-4217 currency. Each country has one currency.
- Cross-country comparisons only ever appear converted to USD and are labelled that way.
- Removing an employee is a hard delete with a confirmation step. A production system would mark leavers instead.

## What changed during the build (20 Nov 2026)
Everything above is the plan as it was written before the build. This section records where the finished app differs from it.

- **One question needs two screens.** "Every question is answered on one screen" is not true for comparing one role across countries: "What do we pay a Senior Engineer in India compared with the US?" needs India's job titles and the US's, on two screens. A role-across-countries view would be the fix. See `docs/NEXT.md`, Improvements, item 5.
- **The simulator reports per currency, not per country.** The two are identical today, since the five countries have five currencies, but two countries sharing a currency would merge into one row. See [ADR 002](docs/adr/002-money-as-integer-minor-units-and-no-cross-currency-sums.md).
- **"Validated on both client and server" has two exceptions**, enforced only by the server: an effective date not before the hire date, and a new salary that must differ from the current one. See `docs/NEXT.md`, Improvements, item 2.
- **"Cross-country comparisons only ever appear converted to USD" has one exception:** sorting by salary with no country filter compares raw amounts. The page says so. See `docs/NEXT.md`, Known gaps, item 4, and [ADR 002](docs/adr/002-money-as-integer-minor-units-and-no-cross-currency-sums.md).
- **"No silent data errors" has two documented holes:** editing a hire date can leave earlier history rows, and a total past 2^53 would lose digits. See `docs/NEXT.md`, Known gaps, items 5 and 6.
- **Rules added during the build that the plan did not state:** an effective date cannot be before the hire date; a new salary must differ from the current one; an edit that changes nothing writes nothing; unknown fields are rejected; a reason is 3 to 500 characters. How they are enforced is in [ADR 004](docs/adr/004-validation-in-the-service-with-shared-zod-schemas.md).
- **Scope confirmed** as five countries and three employment types; search also matches email; and "today" is the date at UTC+14 ([ADR 005](docs/adr/005-today-is-the-date-at-utc-plus-14.md)).
- **The app seeds 10,000 demo employees into an empty database on boot** unless `SEED_ON_BOOT=false`. Convenient for this demo, and something a real deployment would turn off. See `docs/DEPLOY.md` and [ADR 001](docs/adr/001-sqlite-and-single-deployable.md).
- **Dropped from the plan:** range bars on the country page, and a CI badge (`docs/PLAN.md`, steps 32 and 27).
- **Order of what comes next.** The table above calls bulk import "the first thing to build next". `docs/NEXT.md` is the authority for the order: it puts SSO and role-based access first and bulk import second, and it lists every left-out item.
