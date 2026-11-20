# 001. SQLite and a single deployable

Status: Accepted (2026-11-19)

## Context

The app replaces spreadsheets for one HR team: about 10,000 employees, a handful of people writing, and no authentication in v1. It has to be deployed, demoed and reviewed by people who should not need to run a database server to try it. The read side matters more than the write side: the directory must stay fast at 10,000 rows (p95 under 300 ms) and the insights need a median, which SQLite cannot compute in SQL.

## Decision

Store everything in **one SQLite file**, opened through `better-sqlite3` and Drizzle, and ship the whole product as **one Docker image**.

- `openDatabase` (`apps/api/src/db/database.ts`) opens a single connection per process, turns foreign keys on, and applies pending migrations before the app serves a request. `DATABASE_PATH` says where the file lives; the image defaults it to `/data/salary-manager.db`, a mounted volume.
- The driver is synchronous, so repositories and services are plain synchronous functions and a transaction is one callback (`EmployeesRepository.inTransaction`).
- The same Nest process serves the API under `/api`, the health check at `/health`, and the built React app at `/` with an `index.html` fallback for deep links (`serve-web-app.ts`). The web app calls the API on its own origin.
- On boot the app seeds the demo data only when the employees table is empty.
- Statistics are computed in memory: the insights endpoints read one slim row per employee and pass the salaries to the pure `summarize` function.

## Consequences

**What we get**

- Nothing to provision: `npm run dev` or `docker run` gives a working app with data. No CORS, no second deploy, one URL.
- Tests run the real schema and real SQL on `:memory:` in milliseconds (see ADR 003).
- At this size it is fast with no tuning: 3 to 10 ms per request on the 10,000-employee seed (`docs/ARCHITECTURE.md`, performance notes).

**What it costs**

- **One instance, one writer.** The volume attaches to one container, so there are no replicas and a redeploy has a few seconds of downtime. Web and API cannot scale separately.
- **Queries block the event loop.** A synchronous driver means a slow query stalls every other request. Today the slowest is the full CSV export, which is read in batches of 1,000 for that reason.
- **Insights read every employee on each request.** Fine at 10,000 rows; it grows linearly.
- **No backups are configured.** The data is one file on one volume. The journal mode is SQLite's default (no WAL), which is enough for a single connection.
- **Some code is SQLite-specific:** `COLLATE NOCASE` for name sorting, `LIKE ... ESCAPE`, ASCII-only case-insensitive search, detecting a duplicate email from the driver's error text, and resetting `sqlite_sequence` on reseed.

**When this would change**

- Real salaries go in. That needs authentication, backups and point-in-time recovery, and at that point a managed Postgres is the cheaper way to get them.
- More than one app instance is needed (availability, zero-downtime deploys) or several teams write at once.
- Around a million rows, or once an insights request shows up in latency: move the aggregates into SQL (window functions) or precompute them.

Moving to Postgres is contained but not free: queries live only in the two repositories, but every service method would become `async`, and the SQLite-specific items above need Postgres equivalents. Splitting the web app onto a CDN is the easier half: it is already a static build that only needs the API's address and CORS.
