# syntax=docker/dockerfile:1

# ---- Build: all workspace dependencies, then shared -> api -> web ---------------------------
FROM node:26-slim AS build
WORKDIR /app

# Manifests first, so the dependency layer is reused until a package.json or the lockfile changes.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
# Install scripts are skipped: the only one that matters, better-sqlite3's, would compile from
# source, and the package already ships a prebuilt binary for this image.
RUN npm ci --ignore-scripts

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
COPY apps/web apps/web
# The API and the web app both import the shared package, so it is built first.
RUN npm run build -w @salary-manager/shared \
 && npm run build -w @salary-manager/api \
 && npm run build -w @salary-manager/web

# ---- Runtime: production dependencies and built output only ---------------------------------
FROM node:26-slim AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    DATABASE_PATH=/data/salary-manager.db
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
# Only what the API needs to run. better-sqlite3 ships a prebuilt binary for this image
# (linux, glibc), so its compile-from-source install script is skipped and no compiler is
# installed. The last line fails the build if that binary ever stops loading.
RUN npm ci --omit=dev --ignore-scripts \
      --workspace @salary-manager/api --workspace @salary-manager/shared \
 && npm cache clean --force \
 && cd apps/api \
 && node -e "new (require('better-sqlite3'))(':memory:').prepare('select 1').get()"

COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/web/dist apps/web/dist
# The SQL migrations, applied when the app opens the database.
COPY apps/api/drizzle apps/api/drizzle

# The SQLite file lives here. Mount a volume at /data to keep it across deploys.
# (No VOLUME instruction: Railway rejects Dockerfiles that declare one.)
RUN mkdir -p /data

WORKDIR /app/apps/api
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "dist/main.js"]
