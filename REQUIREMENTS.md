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
