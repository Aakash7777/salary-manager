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
| GET | `/health` | Health check |
| GET | `/api/docs` | Interactive API documentation (Swagger UI); the OpenAPI 3.1 document is at `/api/docs/openapi.json` |
