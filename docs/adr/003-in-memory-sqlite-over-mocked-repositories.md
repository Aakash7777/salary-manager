# 003. In-memory SQLite over mocked repositories

Status: Accepted (2026-11-19)

## Context

Most of what can go wrong in this API lives in the database interaction: a salary change and its history row must commit or roll back together, a duplicate email must be caught, search must treat `%` and `_` as plain text, sorting must be stable across pages, deleting an employee must take their history with it. A test that replaces the repository with a mock checks that the service called a function, not that any of those things are true. Tests also have to be deterministic and fast enough to run on every change.

## Decision

**Service and end-to-end tests run against a real SQLite database in memory. Repositories are never mocked.**

- `createTestDb()` is `openDatabase(':memory:')`: the same function production uses, so each test gets a fresh database built by the real migrations with foreign keys on.
- Service tests construct the real repository on that database and a `FixedClock`. The e2e tests start the real Nest app with supertest, point `DATABASE_PATH` at `:memory:`, and override only the clock.
- Pure rules (stats, outliers, salary-change rules, CSV escaping, money, schemas) are unit tests with no I/O. The two kinds are separated by file suffix and script: `*.spec.ts` with `test:unit`, `*.int.spec.ts` with `test:int`.
- Failures are produced by the database, not simulated: the transaction tests add a SQL trigger that makes the history insert fail and then assert that no employee row, salary or currency change survived.
- The web app follows the same idea one layer up: tests render the real routed app and replace only the network, with MSW.

## Consequences

**What we get**

- The tests prove behaviour that only real SQL can show: rollback, the unique constraint, cascade delete, `LIKE` escaping, case-insensitive sort, pagination tiebreaks.
- Refactoring the repository or the queries does not break tests, because no test knows which repository methods exist.
- It is still fast: the whole API suite (468 tests, unit and integration) runs in about 4 seconds, and it is deterministic because every test starts from an empty database and a fixed clock.

**What it costs**

- **The tests are tied to SQLite.** They are not a spec that a different database could be checked against without also running that database.
- **`:memory:` is not the production setup.** It skips the file system, so file concerns need their own tests (`open-database.int.spec.ts` uses a real temporary path), and nothing exercises two connections or a locked file.
- A service test that fails does not say whether the service or the query is wrong; the unit tests on the pure functions narrow that down.
- Integration tests need data set up through the real code paths or fixtures (`pay-fixture.ts`, the 31-employee list fixture), which is more setup than a stubbed return value.
- Errors that SQLite will not produce on demand are harder to reach. So far a trigger has been enough.

**When this would change**

- **The database moves to Postgres** (ADR 001). Keep the principle, change the tool: run the integration suite against a real Postgres (a container per run, a schema or transaction per test) and accept that it gets slower. Do not switch to mocks to keep the speed.
- A dependency appears that cannot run in-process: a payroll API, an identity provider, an FX feed. That gets a fake at the network boundary, as MSW does for the web app, while the repositories stay real.
- The suite becomes slow enough to discourage running it. Then share one migrated database per file and isolate tests with transactions, before considering anything else.
