# ACME Salary Manager

One web app that replaces the spreadsheets HR uses for about 10,000 employees in five countries. It is for an HR manager who is comfortable with Excel and not technical: it keeps salary data correct, records why every salary changed, and answers "how do we pay people?" on one screen, without an export.

- **Live app:** https://salary-manager-production.up.railway.app
- **Demo video (3–5 min):** https://www.loom.com/share/de081b023b2640f7a8e0f3960d01b05d
- **API docs:** `/api/docs` on the running app

## Quick start

Requires **Node 24.15 or newer** (developed on Node 26).

```bash
npm install
npm run dev       # web app on http://localhost:5173, API on http://localhost:3000
```

On first start the API creates its SQLite file, applies the migrations and seeds 10,000 realistic employees, so there is nothing else to set up.

```bash
npm run seed -- --reset   # reseed from scratch; same seed, same 10,000 employees every time
npm test                  # all 1,023 tests
npm run lint              # ESLint + Prettier
npm run typecheck
npm run coverage          # the tests again, with a coverage table per package
npm run load-test         # autocannon against the 10,000-employee seed
```

To run it as one Docker image or deploy it, see [docs/DEPLOY.md](docs/DEPLOY.md).

## The four questions it answers

| Question | Where |
|---|---|
| "Show me everyone in Engineering in Germany." | **Employees**: search, filter by country, department and job title, sort, and export the result to CSV. The filters live in the URL, so a view can be bookmarked or shared. |
| "What do we pay a Senior Engineer in India compared with the US?" | **Insights**: headcount, min, median, average and max per country and per job title, each in its own currency. |
| "Who is paid far outside the range for their role?" | **Insights → a country → Outliers**: everyone more than 25% above or below the median for their job title in that country. |
| "What would an 8% raise for Engineering in India cost us?" | **Raise simulator**: pick a group and a percentage, see the yearly cost per currency and an indicative USD total. Nothing is saved. |

And the everyday job, "update Priya's salary after her promotion, and keep a record of why": **an employee's page → Change salary**, which requires a reason and writes the history entry in the same transaction.

## Architecture

A small monorepo: `apps/api` (NestJS, Drizzle, SQLite), `apps/web` (React, Vite, Mantine, TanStack Query) and `packages/shared` (the zod schemas, money helpers and country and FX config that both sides use). It ships as **one Docker image**: the API serves the built web app, so there is one URL and no CORS. Business rules are pure functions under `apps/api/src/domain/`; services validate with the shared schemas and own the transactions; controllers are a few lines each. Money is always an integer in minor units plus a currency that is derived from the country, and amounts in different currencies are never added together.

More in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). The five decisions with real trade-offs each have a one-page record in [docs/adr](docs/adr/README.md).

## Product rules

Each rule has at least one test named after it.

- A salary change's effective date **cannot be in the future**. The change applies immediately.
- Salary is **not editable in "Edit details"**. It only changes through "Change salary", so every change has a reason.
- Changing an employee's **country requires a new salary** in the new currency, and that is recorded in the history.
- Creating an employee writes the first history entry, **"Starting salary"**.

## What is deliberately left out

There is **no authentication**, which is the one blocker before real salary data goes in. Also out of scope: payroll and tax, bulk import, scheduled salary changes, applying raises from the simulator, live FX rates, and anything beyond base salary. The reasons are in [REQUIREMENTS.md](REQUIREMENTS.md); what I would build next, and the known gaps, are in [docs/NEXT.md](docs/NEXT.md).

## Testing

Built test-first: failing tests were written and reviewed before each feature was implemented.

| Package | Tests | What they are | Statements | Branches |
|---|---|---|---|---|
| `apps/api` | 468 | 183 unit tests of the pure domain functions; 285 integration tests of the services on in-memory SQLite and of every endpoint with supertest | 93.33% | 80.17% |
| `apps/web` | 302 | The real routed app with only the network replaced (MSW): every form, the filters, and each page's loading, empty and error states | 97.09% | 93.20% |
| `packages/shared` | 253 | Schemas, money and FX conversion | 99.18% | 98.50% |

- **Nothing is mocked that can be real.** Database tests run the real migrations and real SQL; no repository is mocked, and no component is.
- **Deterministic.** The clock is injected, the seed is seeded, and every test starts from an empty database.
- **Coverage is reported, not chased.** No threshold is enforced. Every source file counts; the three entry points (`main.ts`, `seed-cli.ts`, `main.tsx`) are at 0% and were checked by running the app.
- CI runs lint, typecheck and `npm run coverage` on every push. `npm audit` reports 4 moderate findings, all in a dev-only tool (esbuild via drizzle-kit); `npm audit --omit=dev` reports none.

## Performance

Measured on the 10,000-employee seed (one laptop, Node 26, 2026-11-20). The requirement is a directory p95 under 300 ms.

| | Result |
|---|---|
| Directory, default page, 10 concurrent connections | **p95 4.8 ms**, 2,638 requests per second |
| Directory, slowest case measured (search + country + salary sort) | p95 37.5 ms, 290 requests per second |
| A single request: directory page / employee page / insights | about 1 ms / 1 ms / 9 ms |
| CSV export of all 10,000 employees | 26 ms |
| Seeding 10,000 employees | 0.2 s |

The first load test run found a real problem, a name index that did not match the case-insensitive sort; fixing it took the last page of the directory from 85 to 1,826 requests per second. The full tables, the method and what the numbers mean are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#performance-notes-measured).

## How AI was used

I wrote and owned the requirements, the architecture and every product decision. Claude Code did the implementation under the rules in [CLAUDE.md](CLAUDE.md): for each feature I stated the behaviour, it wrote failing tests and stopped, I reviewed them, and only then did it implement. I reviewed each change before committing it. [AI_USAGE.md](AI_USAGE.md) logs each step: the prompt, what I kept, and what I rejected or corrected.

## Where everything is

| Document | What it is |
|---|---|
| [REQUIREMENTS.md](REQUIREMENTS.md) | Goal, persona, scope, product rules, and what was left out and why |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Shape, key decisions, data model, API table, testing strategy, measured performance |
| [docs/adr/](docs/adr/README.md) | Five decision records: SQLite and one deployable, money, test strategy, validation, "today" |
| [docs/NEXT.md](docs/NEXT.md) | What I would build next, and the known gaps |
| [docs/DEPLOY.md](docs/DEPLOY.md) | Docker image, Railway deployment, environment variables |
| [docs/PLAN.md](docs/PLAN.md) | The build plan, roughly one line per commit |
| [AI_USAGE.md](AI_USAGE.md) | How AI was used, step by step, including corrections |
| [CLAUDE.md](CLAUDE.md) | The working agreement the AI agent followed |
| [docs/prompts/PROMPTS.md](docs/prompts/PROMPTS.md) | The prompt for each stage of the build |
| [docs/design.md](docs/design.md) and [docs/prompts/design-prompt.md](docs/prompts/design-prompt.md) | The UI designs, the prompt that produced them, and what changed after review |
| `/api/docs` on the running app | Interactive API documentation; the request schemas are generated from the shared zod schemas |
