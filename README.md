# ACME Salary Manager

One web app for HR to keep salary data correct and answer "how do we pay people?" without exporting to Excel. See [REQUIREMENTS.md](REQUIREMENTS.md) for scope and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for design decisions. The decisions with real trade-offs each have a one-page record in [docs/adr](docs/adr/README.md).

- `apps/api`: NestJS + Drizzle + SQLite (better-sqlite3)
- `apps/web`: React (Vite) + Mantine + TanStack Query
- `packages/shared`: zod schemas, money helpers, country and FX config

## Run it locally

Requires **Node 24.15 or newer** (developed on Node 26).

```bash
npm install
npm run dev
```

- Web app: http://localhost:5173 (proxies `/api` to the API)
- API: http://localhost:3000

On first start the API creates `apps/api/salary-manager.db`, applies migrations and seeds 10,000 employees because the database is empty. To reseed from scratch at any time:

```bash
npm run seed -- --reset
```

## Checks

```bash
npm test          # all packages
npm run lint      # ESLint + Prettier
npm run typecheck
```

The API also has `npm run test:unit -w @salary-manager/api` and `npm run test:int -w @salary-manager/api`.

`npm audit` reports 4 moderate findings, all in esbuild as pulled in by drizzle-kit, the dev-only tool that generates migrations. `npm audit --omit=dev` reports none, and the Docker image is installed with `--omit=dev`, so none of it ships.

### Coverage

```bash
npm run coverage  # the same tests, plus a per-file coverage table for each package
```

CI runs this instead of `npm test`, so the tables are in every run's log. No threshold is enforced: the numbers are reported, not chased.

| Package | Tests | Statements | Branches | Functions | Lines |
|---|---|---|---|---|---|
| `apps/api` | 468 | 93.33% | 80.17% | 98.17% | 93.01% |
| `apps/web` | 302 | 97.09% | 93.20% | 97.73% | 97.16% |
| `packages/shared` | 253 | 99.18% | 98.50% | 100% | 99.15% |

1,023 tests in all. Measured on 2026-11-20, on the finished code, with V8 coverage. Every source file counts, including files no test loads; only test files and test helpers are excluded. What is not covered:

- **The entry points, at 0%:** `apps/api/src/main.ts`, `apps/api/src/seed/seed-cli.ts` and `apps/web/src/main.tsx`. They wire things together and were checked by running the app and the Docker image, not by tests.
- **Branches in the API (80%):** mostly defensive fallbacks that the tests cannot reach with valid data, such as the `?? 0` defaults for an empty group in `insights.service.ts` and the "should never happen" guards in the repository and `employees.service.ts`.

## Load test

```bash
npm run load-test   # builds the API, starts it on a throwaway seeded database, runs autocannon
```

The script is `scripts/load-test.js`. It is not part of `npm test`: the numbers depend on the machine, so they are recorded here instead of asserted. `LOAD_TEST_CONNECTIONS` and `LOAD_TEST_DURATION` (seconds) change the load.

Measured on 2026-11-20: 10 concurrent connections for 10 seconds per endpoint, 10,000 employees in a SQLite file, API and load generator on the same laptop (Node 26.13.1, Windows 11, 12 logical CPUs). No request failed.

| Endpoint | Requests/s | p50 (ms) | p95 (ms) | p99 (ms) | Max (ms) |
|---|---|---|---|---|---|
| Directory: default page | 2638 | 3.6 | 4.8 | 5.6 | 8.9 |
| Directory: search + country + salary sort | 290 | 34.0 | 37.5 | 41.1 | 69.2 |
| Directory: last page (page 400) | 1826 | 5.3 | 6.6 | 7.8 | 15.2 |
| Directory: 100 rows per page | 1885 | 5.1 | 6.4 | 7.6 | 15.5 |
| Insights: summary | 118 | 84.2 | 90.2 | 93.0 | 172.4 |
| Insights: countries | 112 | 87.8 | 96.8 | 115.0 | 182.7 |
| Insights: India job titles + outliers | 176 | 56.6 | 60.0 | 62.7 | 117.7 |

- **The requirement is met at this load:** the directory's p95 is 4.8 ms for the default page and 37.5 ms for the slowest case measured (search + country + salary sort), against a target of 300 ms.
- **The first run found a real problem, now fixed.** The last page in name order managed 85 requests per second with a p95 of 130 ms, because the name index did not match the case-insensitive sort and SQLite sorted all 10,000 rows on every request. With the index on `full_name COLLATE NOCASE` it is 1,826 requests per second with a p95 of 6.6 ms, and the default page went from 787 to 2,638 requests per second.
- **Latency here is mostly queueing.** The database driver is synchronous, so the API handles one request at a time: with 10 connections each request waits for about nine others. More connections would add waiting, not throughput. See [ADR 001](docs/adr/001-sqlite-and-single-deployable.md).
- This is one laptop talking to itself, not the deployed app: there is no network in it, and the load generator competes with the API for CPU.

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | Port the server listens on. |
| `DATABASE_PATH` | `salary-manager.db` (in the API's working directory); `/data/salary-manager.db` in the Docker image | Where the SQLite file lives. Put it on a persistent volume in production. |
| `SEED_ON_BOOT` | on | On boot the app seeds 10,000 demo employees **only if the employees table is empty**. Set to `false` to never seed. |
| `WEB_DIST_PATH` | `apps/web/dist` | Where the built web app is served from. No need to set it in the Docker image. |

## Run it as one Docker image

The image contains the API and the built web app. Nest serves the web app at `/` and the API under `/api`; `/health` reports `{ "status": "ok", "db": "ok" }`.

```bash
npm run docker:build   # docker build -t salary-manager .
npm run docker:run     # docker run --rm -p 3000:3000 -v salary-manager-data:/data salary-manager
```

Then open http://localhost:3000. The SQLite file is kept in the `salary-manager-data` Docker volume, mounted at `/data`, so it survives restarts. To start again from an empty database, remove the volume: `docker volume rm salary-manager-data`.

## Deploy to Railway

The repo has a `Dockerfile` and a `railway.json` (Dockerfile build, health check on `/health`, restart on failure). Railway provides `PORT` itself.

### First deploy

```bash
npm install -g @railway/cli
railway login
railway init                 # create a project; run from the repo root
railway up                   # build the Dockerfile and deploy; creates the service
```

Then give the service a persistent disk and tell the app to use it:

1. **Add a volume mounted at `/data`.** In the Railway dashboard: open the service, then **Settings → Volumes → Add volume**, mount path `/data`. (`railway volume add` does the same from the CLI and asks for the mount path.) A volume cannot be declared in `railway.json`.
2. **Set the database path:**

   ```bash
   railway variable set DATABASE_PATH=/data/salary-manager.db
   ```

3. **Redeploy and get a public URL:**

   ```bash
   railway up
   railway domain
   ```

On the first boot with the volume attached the logs show `Seeded 10000 employees …: the database was empty`. Every later boot shows `Seed skipped: the database already has 10000 employees`. Check them with `railway logs`.

### Redeploy

```bash
railway up          # deploy the current directory
railway logs        # watch it start
```

or connect the GitHub repo in the dashboard so every push to `main` deploys. The data stays on the volume across deploys.

### Things to know about Railway

- **Without the volume, every deploy starts from an empty database** and reseeds the demo data.
- **A redeploy has a few seconds of downtime**, because a volume can only be attached to one running deployment at a time.
- **One instance only.** Railway does not allow replicas on a service with a volume, and SQLite has a single writer anyway.
- **The image runs as root** so it can write to the volume, which Railway mounts as root. If you change the image to a non-root user, set `RAILWAY_RUN_UID=0` on the service.
- **The Dockerfile has no `VOLUME` instruction** on purpose: Railway rejects Dockerfiles that declare one.
- **`railway.json` may need migrating to `.railway/railway.ts` before 1 December 2026.** Railway has deprecated Config as Code (`railway.json`) in favour of Infrastructure as Code. Its docs say existing files keep working for existing services until 2026-12-01 and that new services cannot opt in, so a service created now may ignore `railway.json`: if it does, set the Dockerfile builder and the `/health` check in the dashboard, or migrate the file. Not verified against a live deploy.
- **To wipe the demo data**, delete the volume in the dashboard and add a new one, or run `npm run seed -- --reset` against the database file.

## API

Full, interactive documentation is served by the app at **`/api/docs`** (http://localhost:3000/api/docs when running locally). The request schemas in it are generated from the shared zod schemas, so they cannot drift from the real validation rules.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/employees` | Directory: search, filters, sort, pagination |
| GET | `/api/employees/export.csv` | CSV export with the same filters |
| GET | `/api/employees/:id` | Detail, salary history, role median |
| POST | `/api/employees` | Create |
| PATCH | `/api/employees/:id` | Update details |
| POST | `/api/employees/:id/salary-changes` | Change salary |
| DELETE | `/api/employees/:id` | Remove |
| GET | `/api/meta` | Countries, departments, job titles |
| GET | `/api/insights/summary` | Headcount and indicative USD payroll |
| GET | `/api/insights/countries` | Pay statistics per country |
| GET | `/api/insights/countries/:code/job-titles` | Pay per job title, and outliers |
| POST | `/api/simulations/raise` | Raise simulator: what a raise of 0 to 50% would cost for a filtered group, per currency, plus an indicative USD total. Read-only, nothing is saved |
| GET | `/health` | Health check |
| GET | `/api/docs` | Interactive API documentation (Swagger UI); the OpenAPI 3.1 document is at `/api/docs/openapi.json` |
