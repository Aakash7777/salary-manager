# Prompts used with Claude Code

How I work: one prompt per stage. Every prompt makes the agent **stop after writing failing tests** so I can review them before any implementation. Then I reply `go`, review the diff and commit.
After each stage, I add any AI mistakes or corrections to `AI_USAGE.md`.

---

## P0 — Kick-off (start of every session)
```
Read CLAUDE.md, REQUIREMENTS.md, docs/ARCHITECTURE.md and docs/PLAN.md.
Summarise in 5 bullets what we're building and the product rules. Then tell me which PLAN.md step is next, based on git log.
Don't write any code yet.
```

## P1 — Scaffold (PLAN step 2)
```
Set up the monorepo described in docs/ARCHITECTURE.md:
- npm workspaces: apps/api (NestJS), apps/web (React + Vite + Mantine + TanStack Query), packages/shared
- TypeScript strict everywhere, ESLint + Prettier, Vitest in all three packages
- Root scripts: `npm test`, `npm run lint`, `npm run typecheck`, `npm run dev` (api + web together)
- GitHub Actions workflow: install, lint, typecheck, test on push and PR
- One trivial passing test per package to prove the wiring works
List every dependency you add, with a one-line reason. Do not build any features.
When `npm test` and `npm run lint` pass, show me the file tree and stop. I'll commit.
```

## P2 — Shared: countries, currency, FX (step 3)
```
In packages/shared, build the country config. Start with these 5: IN/INR, US/USD, GB/GBP, DE/EUR, SG/SGD.
Each entry: code, name, currency, minorUnits (2 for all of these), fxToUsd (fixed indicative rate), plus an FX_TABLE_VERSION constant.
Functions: getCountry(code) (throws on unknown), currencyFor(code), toUsdMinor(amountMinor, currency).
TDD: write the failing tests first. Cover unknown country, each currency mapping, USD conversion rounding (round half up to the nearest cent), and conversion of 0.
STOP after the tests are written and failing. Show me the test file.
```

## P3 — Shared: money helpers (step 4)
```
In packages/shared add money helpers. Money is always { amountMinor: integer, currency }.
- toMinor(major: number | string, currency): integer. Reject NaN, negatives, more than 2 decimals.
- formatMoney(amountMinor, currency): uses Intl.NumberFormat. INR must show Indian grouping (32,40,000).
- Never use floats for arithmetic on minor units.
TDD: failing tests first, including "0.1 + 0.2"-style precision cases, INR grouping, and invalid inputs.
STOP after the tests are written and failing.
```

## P4 — Shared: employee schemas (step 5)
```
In packages/shared create zod schemas + inferred types:
- CreateEmployeeInput: fullName, email, jobTitle, department, countryCode, salaryMajor (> 0), employmentType (FULL_TIME | PART_TIME | CONTRACTOR), hireDate (ISO date, not in the future). Currency is NOT an input.
- UpdateEmployeeDetailsInput: same fields minus salary, all optional. If countryCode changes, newSalaryMajor + reason become required (use a refinement).
- ChangeSalaryInput: newSalaryMajor (> 0), effectiveDate (not in the future), reason (3–500 chars).
- ListEmployeesQuery: search, country, department, jobTitle, sort (name|salary|hireDate), order (asc|desc), page (>=1), pageSize (1–100, default 25).
Inject "today" as a parameter or clock function, so tests are deterministic.
TDD: failing tests first for valid input plus each rule's failure message. STOP after the tests are written.
```

## P5 — DB schema + test helper (step 6)
```
In apps/api, set up Drizzle with better-sqlite3 using the data model in docs/ARCHITECTURE.md (employees + salary_changes, with the listed indexes).
Add migrations and a test helper createTestDb() that returns a fresh in-memory DB with migrations applied.
Add a Clock provider (interface with now()) so services never call new Date() directly.
Write one test proving createTestDb() gives an empty, isolated DB each time. Stop when it's green.
```

## P6 — Create + get employee (step 7)
```
Build EmployeesService.create and getById, with a repository on Drizzle.
Rules:
- currency comes from countryCode via the shared config
- salary is stored as salary_minor
- create also inserts a salary_changes row: old = null, new = salary, reason "Starting salary", effective date = hireDate, all in ONE transaction
- duplicate email → a domain error the controller will map to 409
- getById returns the employee + salary history (newest first); unknown id → NotFound error
TDD against createTestDb(), no mocks. Failing tests first; STOP for my review.
```

## P7 — List with filters (step 8)
```
Build EmployeesService.list(query) using the shared ListEmployeesQuery.
- search: case-insensitive match on full name or email
- filters: country, department, jobTitle (exact)
- sort + order with a stable tiebreaker on id
- returns { items, total, page, pageSize }
Tests: seed ~30 fixed employees in the test, then cover each filter, combined filters, sort both ways, pagination edges (last page, page beyond the end), and an empty result.
Failing tests first; STOP for review.
```

## P8 — Salary change + edit details + delete (steps 9–11)
```
Add to EmployeesService:
1. changeSalary(id, input): rejects a future effective date; updates salary and inserts a history row in ONE transaction; same salary → validation error.
2. updateDetails(id, input): never touches salary unless countryCode changes, in which case it requires newSalaryMajor + reason, updates currency and writes a history row.
3. remove(id): deletes the employee + history; unknown id → NotFound.
Include a test proving the transaction rolls back: force the history insert to fail and assert the salary did not change.
Failing tests first; STOP for review.
```

## P9 — Controllers + e2e (step 12)
```
Add NestJS controllers for every /api/employees endpoint in docs/ARCHITECTURE.md (except CSV export, which comes later).
- a ZodValidationPipe using the shared schemas
- error mapping: validation → 400 with field errors, NotFound → 404, duplicate email → 409
- consistent error body: { error: { code, message, fields? } }
Write supertest e2e tests: one happy path per endpoint plus 400/404/409 cases. Keep them few and fast, on an in-memory DB.
STOP after the tests are written.
```

## P10 — Seed script (step 13)
```
Write apps/api/src/seed.ts that creates 10,000 employees deterministically (faker with a fixed seed).
- Distribution: IN 42%, US 26.5%, GB 13.5%, DE 11%, SG 7%
- 8 departments with realistic job titles per department
- Salary bands per (country, level) so medians look realistic, with ~3% deliberate outliers
- Hire dates spread over the last 12 years; each employee gets a "Starting salary" history row; ~30% get 1–3 later raises
- Single transaction, prepared statements
- Prints the elapsed time. Must be idempotent: refuse to run on a non-empty DB unless --reset is passed
Add a test that seeds 200 employees with the same seed twice and gets identical output.
Run it on 10k and tell me the timing. I'll record it in README.
```

## P11 — Stats + outliers (steps 14–15)
```
In a pure domain module (no DB):
- summarize(amounts: number[]): { count, min, median, avg, max }. Median of an even count = mean of the two middle values, rounded half up. Empty → nulls with count 0.
- findOutliers(rows, thresholdPct = 25): flags rows whose salary is more than 25% above or below their group's median. Boundary: exactly 25% is NOT an outlier.
Table-driven tests: empty, single, odd, even, all-equal, the boundary at exactly 25%, and 25.01%.
Failing tests first; STOP for review.
```

## P12 — Insights API + role median (step 16)
```
Add InsightsService + controller:
- GET /api/insights/summary → headcount, countries, departments, job titles, payrollUsdMinor (sum of each country's total converted with toUsdMinor), fxTableVersion
- GET /api/insights/countries → per country stats in local currency, using summarize()
- GET /api/insights/countries/:code/job-titles → per title stats + outliers (largest gap first)
- add roleMedian + pctVsMedian to GET /api/employees/:id
Use SQL GROUP BY where it's natural; compute the median with summarize().
Tests on a small fixed dataset where I can verify every number by hand. Show me the dataset and the expected numbers before implementing. STOP.
```

## P13 — CSV export (step 17)
```
Add GET /api/employees/export.csv using the same filters as list (no pagination).
Columns: name, email, job title, department, country, currency, annual salary (major units), employment type, hire date.
Escape commas, quotes and newlines properly; stream the response.
Tests: an escaping case with a name containing a comma and a quote; filters are respected. Failing tests first.
```

## P14 — Web: shell + directory (step 18)
```
Build the React app following the designs (link in docs/design.md). Mantine AppShell with sidebar: Employees, Insights. No user avatar, no global search.
Directory page: filter bar (search debounced 300 ms, country/department/job title as searchable Selects fed by GET /api/meta), table, sortable headers, server pagination, Export CSV button, Add employee button.
Loading skeleton and an empty state with "Clear filters".
API client in one module; TanStack Query for fetching.
Component tests: changing a filter calls the API with the right query; the empty state renders.
```

## P15 — Web: form, detail, change salary (steps 19–20)
```
1. Add/Edit employee drawer using the shared zod schemas (via mantine-form + zod resolver). Currency is read-only and shown from the country. Edit mode has no salary field; changing country reveals "New salary" + "Reason".
2. Employee detail page: header, current salary card with "median for this role" line, details list, salary history timeline, Edit and Remove (confirm modal).
3. Change salary modal: live % change preview, effective date (max = today), required reason.
Show server field errors inline (409 email → on the email field).
Tests: form validation messages; the % preview calculation.
```

## P16 — Web: insights (step 21)
```
Insights page: 4 stat cards (USD payroll labelled "≈, indicative"), and a pay-by-country table that links to the drill-down.
Country page: pay by job title table, plus an outliers table with % vs median badges and links to profiles.
Show a footnote that country rows use different currencies and aren't comparable.
```

## P17 — Deploy (step 22)
```
Create a multi-stage Dockerfile: build web + api; at runtime Nest serves the web build at / and the API at /api.
SQLite path comes from the DATABASE_PATH env var (a mounted volume). On boot: run migrations, and seed 10k only if the DB is empty.
Add a fly.toml (or railway.json) and step-by-step deploy instructions in the README. Give me the exact commands to run; don't run deploy yourself.
```

## P18 — Polish (steps 24–28)
```
1. Sync directory filters, sort and page to URL search params (back button works; links are shareable).
2. Swagger at /api/docs from the zod schemas; GET /health returns { status, db: "ok" }.
3. Write ADRs in docs/adr/: 001-sqlite, 002-money-as-integer-minor-units, 003-single-deployable, 004-in-memory-db-over-mocks. Use the format: context, decision, consequences. Max 1 page each.
4. Coverage via vitest --coverage, with a summary in CI and a badge in the README.
5. An autocannon script hitting list + insights on a seeded DB. Print p50/p95/p99 and I'll paste them into the README.
One commit per item.
```

## P19 — Raise simulator (steps 29–31)
```
Build a read-only raise simulator.
Domain (pure): simulateRaise(employees, pct) → per currency { headcount, currentTotalMinor, increaseMinor } + increaseUsdMinor total. pct between 0 and 50 with up to 1 decimal. Round each employee's increase half up to the minor unit BEFORE summing.
API: POST /api/simulations/raise { filters (same as list), pct } → the result above. It must not write anything: add a test asserting the DB is unchanged after the call.
Web: "Raise simulator" page with the directory filters, a % input with a slider, and a results table per country + an indicative USD total.
Failing tests first for the domain + API; STOP for review.
```

## P20 — Wrap-up (steps 32–34)
```
1. (If time allows) range bars per job title on the country page: a min–max bar with a median marker.
2. docs/NEXT.md: the roadmap in the order from REQUIREMENTS.md, with a 2–3 line why for each.
3. README final pass: what it is, live link, demo video link, run/test/seed/deploy commands, architecture summary, performance numbers, trade-offs, links to all docs.
4. Review the whole repo against REQUIREMENTS.md and list anything promised but not delivered.
```
