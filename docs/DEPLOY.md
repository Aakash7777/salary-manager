# Running and deploying

How to run the app as one Docker image, deploy it to Railway, and configure it. For running it from source, see the quick start in the [README](../README.md).

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

1. **Add a volume mounted at `/data`, in the dashboard.** Open the service, then **Settings → Volumes → Add volume**, mount path `/data`. This has to be done in the Railway dashboard: a volume cannot be declared in `railway.json`. Do it before the next step, so the path the variable names is on the volume.
2. **Set the database path:**

   ```bash
   railway variables --set "DATABASE_PATH=/data/salary-manager.db"
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
- **`railway.json` may need migrating to `.railway/railway.ts` before 1 December 2026.** Railway has deprecated Config as Code (`railway.json`) in favour of Infrastructure as Code. Its docs say existing files keep working for existing services until 2026-12-01 and that new services cannot opt in, so a service created now may ignore `railway.json`: if it does, set the Dockerfile builder and the `/health` check in the dashboard, or migrate the file. What happened on the live deploy: Railway auto-detected the `Dockerfile`, so the build worked regardless of whether `railway.json` was read; the volume had to be added in the dashboard, not via config; and `DATABASE_PATH` was set with `railway variables --set`.
- **To wipe the demo data**, delete the volume in the dashboard and add a new one, or run `npm run seed -- --reset` against the database file.
