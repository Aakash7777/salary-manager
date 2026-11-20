# Architecture & Design Decisions

## Shape
```
salary-manager/
├─ apps/api      NestJS + Drizzle ORM + better-sqlite3
├─ apps/web      React (Vite) + TanStack Query + Mantine
└─ packages/shared  zod schemas, types, country→currency + FX config
```
The whole app ships as **one Docker image**: Nest serves the built React app under `/` and the API under `/api`. The SQLite file sits on a persistent volume (Railway or Fly.io).

```mermaid
flowchart LR
  UI[React SPA] -->|JSON /api| C[Controllers<br/>thin, pass input through]
  C --> S[Services<br/>zod validation, use cases, transactions]
  S --> D[Domain<br/>pure fns: stats, money, FX]
  S --> R[Repositories<br/>Drizzle]
  R --> DB[(SQLite)]
```

## Key decisions
| Decision | Why | Trade-off |
|---|---|---|
| **SQLite** | 10k rows is tiny. There's no server to run, and tests can use `:memory:` with real SQL. | Only one writer at a time. Fine for one HR team. Move to Postgres if there are many concurrent writers. |
| **Drizzle + better-sqlite3** | Typed SQL with no codegen step, and a synchronous driver that keeps tests fast and simple. | Smaller ecosystem than Prisma. |
| **Shared zod schemas** | One place defines validation, used by the API's services and the React forms. The services validate, not a controller pipe, because some rules need the clock and the stored employee ([ADR 004](adr/004-validation-in-the-service-with-shared-zod-schemas.md)). | Couples the two apps to one package (acceptable in a monorepo). |
| **Money as integer minor units + currency** | Floating-point money causes rounding bugs. The currency comes from the country, so it can't be entered inconsistently. | Values must be formatted at the edges. |
| **Countries and FX as versioned config, not a table** | Small, rarely changes, and reviewed in a PR. | Changing it needs a deploy. |
| **Median computed in a pure function** | SQLite has no MEDIAN. Sorting 10k integers takes milliseconds and the function is easy to unit-test. | At around 1M rows: precompute or use window functions. |
| **Salary change + history in one transaction** | History must never drift from the current salary. | None worth noting. |
| **Single deployable** | One URL, no CORS, cheapest to host. | Web and API can't scale separately (not needed). |

## Data model
- `employees(id, full_name, email UNIQUE, job_title, department, country_code, currency, salary_minor INT, employment_type, hire_date, created_at, updated_at)`
- `salary_changes(id, employee_id FK ON DELETE CASCADE, old_salary_minor INT NULL, old_currency NULL, new_salary_minor INT, currency, effective_date, reason, created_at)`
  - `old_salary_minor` and `old_currency` are null on the "Starting salary" row. On a normal change `old_currency` equals `currency`. On a country change it is the previous currency, so the old value is never read in the wrong currency.
- Indexes on `employees`: `(country_code, job_title)`, `(department)`, `(full_name COLLATE NOCASE)`, `(email)` unique. The name index carries the collation because the directory sorts names ignoring case, and SQLite only uses an index whose collation matches the ORDER BY.
- Index on `salary_changes`: `(employee_id)`, for the history lookup on the employee page.

## API
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/employees?search&country&department&jobTitle&sort&page&pageSize` | Directory |
| GET | `/api/employees/export.csv?…same filters` | CSV export |
| GET | `/api/employees/:id` | Detail + salary history + the median for the same job title and country |
| POST | `/api/employees` | Create |
| PATCH | `/api/employees/:id` | Update details. Never salary, unless the country changes: then `newSalaryMajor` and `reason` are required |
| POST | `/api/employees/:id/salary-changes` | Change salary (`newSalaryMajor`, `effectiveDate`, `reason`) and record it in history |
| DELETE | `/api/employees/:id` | Remove |
| GET | `/api/insights/summary` | Headcount and USD payroll |
| GET | `/api/insights/countries` | Stats per country |
| GET | `/api/insights/countries/:code/job-titles` | Stats per role, with outliers |
| GET | `/api/meta` | Countries, departments and titles for the filters |
| POST | `/api/simulations/raise` | Raise simulator. Body `{ filters?, pct }`: `filters` has the directory query's shape (its sort and paging are ignored), `pct` is 0 to 50 with at most one decimal. Answers 200 with the matched headcount, one row per currency (headcount, current total, increase, new total, in that currency) and an indicative USD total of the increase. Read-only: nothing is saved |
| GET | `/api/docs` | API docs (Swagger) |
| GET | `/health` | Health check |

## Product rules
- A salary change's effective date **cannot be in the future**. The change applies immediately.
- Salary is **not** editable in "Edit details". It only changes through "Change salary", so every change has a reason.
- Changing an employee's **country** requires a new salary in the new currency, and that is recorded in the history.
- Creating an employee writes the first history entry ("Starting salary").

## Testing strategy
- **Domain unit tests (most of the suite):** stats (median of even/odd/empty sets), money formatting, FX conversion, outlier rule, zod schemas.
- **Service tests on in-memory SQLite:** real SQL, still runs in milliseconds, nothing mocked. Mocking repositories would test the mocks rather than the queries.
- **A few API e2e tests** with supertest against the Nest app.
- **Web:** Vitest + Testing Library for the employee form validation and the filter → query wiring.
- **Determinism:** seeded faker, an injected clock, and a fresh DB for every test.

## Performance notes (measured)
- Seed: 10k inserts in one transaction with a prepared statement. Target < 1 s. **Measured: 194, 200 and 204 ms** for 10,000 employees plus 14,976 salary-history rows (three runs of the seed CLI, each to a new file on a local SSD).
- Directory query with filters and pagination: target < 50 ms server time. **Measured: 1.1 ms** for the default page, **1.1 ms** for the last page (page 400) and **4.2 ms** with search + country filter + salary sort.
- Insights: one slim query, then count/min/median/avg/max in memory with the pure `summarize` function (no SQL GROUP BY: it was not needed). Target < 100 ms. **Measured: summary 8.7 ms, countries 9.2 ms, India's job titles and outliers 6.6 ms** (the slowest single request was 13.2 ms).
- Employee detail with role median: **1.0 ms**.
- Raise simulator: **4.0 ms** for all 10,000 employees at 8%, **1.6 ms** for Engineering in India.
- CSV export of all 10,000 employees (1.13 MB, streamed in batches of 1,000): **26.4 ms** median, 29.4 ms slowest. It was 133 ms before the name index fix: the export pages through the same name-ordered query as the directory, so it was sorting all 10,000 rows once per batch.
- All timings are full HTTP round trips to the built API on localhost, one request at a time, against a fresh 10,000-employee seed in a SQLite file: the median of 15 requests after one warm-up (Node 26.13.1, Windows 11, 2026-11-20, after the name index fix). They are a single-user check; the load test is in the next section. The first set of figures here was taken with curl on 2026-11-19; these were taken with a Node script, so compare the two sets with care.

## Load test (measured)
`npm run load-test` (`scripts/load-test.js`) starts the built API on a throwaway database with the 10,000-employee seed and runs autocannon against each endpoint in turn. Measured on 2026-11-20 with 10 concurrent connections for 10 seconds per endpoint, API and load generator on the same laptop (Node 26.13.1, Windows 11, 12 logical CPUs). No request failed. p50, p95 and p99 are computed from every response time, because autocannon does not report p95.

| Endpoint | Requests/s | p50 (ms) | p95 (ms) | p99 (ms) | Max (ms) |
|---|---|---|---|---|---|
| Directory: default page | 2638 | 3.6 | 4.8 | 5.6 | 8.9 |
| Directory: search + country + salary sort | 290 | 34.0 | 37.5 | 41.1 | 69.2 |
| Directory: last page (page 400) | 1826 | 5.3 | 6.6 | 7.8 | 15.2 |
| Directory: 100 rows per page | 1885 | 5.1 | 6.4 | 7.6 | 15.5 |
| Insights: summary | 118 | 84.2 | 90.2 | 93.0 | 172.4 |
| Insights: countries | 112 | 87.8 | 96.8 | 115.0 | 182.7 |
| Insights: India job titles + outliers | 176 | 56.6 | 60.0 | 62.7 | 117.7 |

What the numbers say:
- **The directory target (p95 < 300 ms) holds under this load.** The slowest case measured is search + country + salary sort at 37.5 ms.
- **Throughput is set by how long one request takes, because requests run one at a time.** better-sqlite3 is synchronous, so a request holds the event loop from query to JSON. Requests per second is about 1 / (time for one request), and latency is about that time multiplied by the number of connections. More connections add waiting, not throughput.
- **The first run of this test found a missing index, now fixed.** The name index was on plain `full_name`, but the directory sorts with `COLLATE NOCASE`, so `EXPLAIN QUERY PLAN` showed `SCAN employees` + `USE TEMP B-TREE FOR ORDER BY`: a full sort of 10,000 rows on every request. Migration `0001_name_index_ignores_case` rebuilt the index with the collation and the plan became `SCAN employees USING INDEX employees_full_name_idx`. A test asserts that plan.

  | Last page (page 400), name order | Requests/s | p50 (ms) | p95 (ms) | p99 (ms) |
  |---|---|---|---|---|
  | Before (plain index) | 85 | 115.9 | 130.0 | 137.1 |
  | After (`COLLATE NOCASE` index) | 1826 | 5.3 | 6.6 | 7.8 |

  The default page improved too, from 787 to 2,638 requests per second, because it no longer sorts either. A deep page still walks the index to its offset (1,826 against 2,638 requests per second); keyset pagination would remove that if it ever matters.
- **Search with a filter and a salary sort is now the slowest directory request** (290 requests per second). A `LIKE '%text%'` search cannot use an index, and the matches are then sorted by salary; its query plan has not been examined yet.
- **Each insights request reads every employee and computes in memory**, about 9 ms of blocking work, so about 110 requests per second. That is far more than one HR team produces, and it is the first thing to move into SQL or precompute as the data grows.
- The cost model and the exits are in [ADR 001](adr/001-sqlite-and-single-deployable.md).
