// Load test for the directory list and the insights endpoints on the 10,000-employee seed.
//
//   npm run load-test
//
// It starts the built API on a throwaway database (seeded on boot), runs autocannon against
// each endpoint in turn, prints a table, and stops the API again. Not part of `npm test`:
// the numbers depend on the machine, so they are recorded by hand, not asserted.
//
// LOAD_TEST_CONNECTIONS (default 10) and LOAD_TEST_DURATION in seconds (default 10) change the load.

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { get } from 'node:http';
import { createServer } from 'node:net';
import { cpus, tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import process from 'node:process';
import { setTimeout as sleep } from 'node:timers/promises';
import autocannon from 'autocannon';

const EXPECTED_EMPLOYEES = 10_000;
const WARM_UP_SECONDS = 1;
const STARTUP_TIMEOUT_MS = 60_000;

const TARGETS = [
  { name: 'Directory: default page', path: '/api/employees' },
  {
    name: 'Directory: search + country + salary sort',
    path: '/api/employees?search=an&country=IN&sort=salary&order=desc',
  },
  { name: 'Directory: last page (page 400)', path: '/api/employees?page=400' },
  { name: 'Directory: 100 rows per page', path: '/api/employees?pageSize=100' },
  { name: 'Insights: summary', path: '/api/insights/summary' },
  { name: 'Insights: countries', path: '/api/insights/countries' },
  {
    name: 'Insights: India job titles + outliers',
    path: '/api/insights/countries/IN/job-titles',
  },
];

const apiDirectory = join(import.meta.dirname, '../apps/api');
const apiEntryPoint = join(apiDirectory, 'dist/main.js');

function print(line = '') {
  process.stdout.write(`${line}\n`);
}

function positiveIntegerFromEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be a whole number of at least 1, got "${raw}"`);
  }
  return value;
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    get(url, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => (body += chunk));
      response.on('end', () => {
        if (response.statusCode !== 200) {
          reject(new Error(`${url} answered ${response.statusCode}`));
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', reject);
  });
}

async function waitUntilHealthy(baseUrl, api) {
  const deadline = performance.now() + STARTUP_TIMEOUT_MS;
  while (performance.now() < deadline) {
    if (api.exitCode !== null) {
      throw new Error(`The API stopped during startup with exit code ${api.exitCode}`);
    }
    try {
      await getJson(`${baseUrl}/health`);
      return;
    } catch {
      await sleep(200);
    }
  }
  throw new Error(`The API was not healthy within ${STARTUP_TIMEOUT_MS / 1000} seconds`);
}

/** Nearest-rank percentile of an ascending list. */
function percentile(sortedAscending, fraction) {
  const rank = Math.ceil(fraction * sortedAscending.length);
  return sortedAscending[Math.max(rank, 1) - 1];
}

async function measure(baseUrl, target, { connections, duration }) {
  const url = `${baseUrl}${target.path}`;
  await autocannon({ url, connections, duration: WARM_UP_SECONDS });

  // autocannon reports p50, p97.5 and p99 but not p95, so every response time is kept and
  // all three percentiles are worked out from the full list.
  const responseTimesMs = [];
  const run = autocannon({ url, connections, duration });
  run.on('response', (_client, _statusCode, _bytes, responseTimeMs) => {
    responseTimesMs.push(responseTimeMs);
  });
  const result = await run;

  const failed = result.non2xx + result.errors + result.timeouts;
  if (failed > 0) {
    throw new Error(
      `${target.name}: ${result.non2xx} non-2xx responses, ${result.errors} errors, ${result.timeouts} timeouts`,
    );
  }

  responseTimesMs.sort((a, b) => a - b);
  return {
    name: target.name,
    requests: responseTimesMs.length,
    requestsPerSecond: result.requests.average,
    p50: percentile(responseTimesMs, 0.5),
    p95: percentile(responseTimesMs, 0.95),
    p99: percentile(responseTimesMs, 0.99),
    max: responseTimesMs[responseTimesMs.length - 1],
  };
}

function printReport(rows, { connections, duration }) {
  const ms = (value) => value.toFixed(1);
  print();
  print(
    `${connections} connections, ${duration} s per endpoint, ${EXPECTED_EMPLOYEES} employees, ` +
      `Node ${process.version}, ${process.platform}, ${cpus().length} logical CPUs`,
  );
  print();
  print('| Endpoint | Requests/s | p50 (ms) | p95 (ms) | p99 (ms) | Max (ms) | Requests |');
  print('|---|---|---|---|---|---|---|');
  for (const row of rows) {
    print(
      `| ${row.name} | ${Math.round(row.requestsPerSecond)} | ${ms(row.p50)} | ${ms(row.p95)} | ` +
        `${ms(row.p99)} | ${ms(row.max)} | ${row.requests} |`,
    );
  }
}

async function main() {
  const load = {
    connections: positiveIntegerFromEnv('LOAD_TEST_CONNECTIONS', 10),
    duration: positiveIntegerFromEnv('LOAD_TEST_DURATION', 10),
  };
  if (!existsSync(apiEntryPoint)) {
    throw new Error(`No built API at ${apiEntryPoint}. Run "npm run load-test", which builds it.`);
  }

  const workDirectory = mkdtempSync(join(tmpdir(), 'salary-manager-load-test-'));
  const port = await findFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const api = spawn(process.execPath, [apiEntryPoint], {
    cwd: apiDirectory,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(port),
      DATABASE_PATH: join(workDirectory, 'load-test.db'),
      SEED_ON_BOOT: 'true',
      // Nothing is built here, so the API serves only itself.
      WEB_DIST_PATH: join(workDirectory, 'no-web-app'),
    },
    stdio: ['ignore', 'ignore', 'inherit'],
  });

  try {
    await waitUntilHealthy(baseUrl, api);
    const summary = await getJson(`${baseUrl}/api/insights/summary`);
    if (summary.headcount !== EXPECTED_EMPLOYEES) {
      throw new Error(`Expected ${EXPECTED_EMPLOYEES} employees, found ${summary.headcount}`);
    }

    const rows = [];
    for (const target of TARGETS) {
      print(`Measuring ${target.name} ...`);
      rows.push(await measure(baseUrl, target, load));
    }
    printReport(rows, load);
  } finally {
    const stopped = new Promise((resolve) => api.once('exit', resolve));
    if (api.exitCode === null && api.kill()) {
      await stopped;
    }
    // Windows can hold the database file for a moment after the process exits.
    rmSync(workDirectory, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
}

await main();
