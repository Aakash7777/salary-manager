# Agent working agreement

Read REQUIREMENTS.md and docs/ARCHITECTURE.md before any change. Never go beyond their scope without asking.

## How we work
- **TDD.** Write a failing test, make it pass with the simplest code, then refactor.
- **When a prompt says STOP after the tests, stop.** Show the tests and wait for "go" before implementing.
- **Small commits** using Conventional Commits: `test:`, `feat:`, `refactor:`, `chore:`, `docs:`, `perf:`. One idea per commit. I commit, unless I ask you to.
- Never add Co-Authored-By or any AI attribution trailers to commits.
- Run `npm test`, `npm run lint` and `npm run typecheck` before saying a step is done.
- Ask before adding a dependency, and give one line on why.

## Code rules
- Money is always an integer in minor units plus an ISO-4217 currency. Never use floats for money arithmetic.
- The currency is derived from the country and is never user input.
- Never sum amounts in different currencies. Convert to USD with toUsdMinor first, and label the result as indicative.
- Business logic lives in pure functions under `domain/`. Controllers stay thin.
- Validate with the zod schemas in `packages/shared`. Never duplicate validation rules.
- Tests must be deterministic: inject the clock, no network, seeded randomness only.
- Database tests use createTestDb() (in-memory SQLite). Don't mock repositories.
- Prefer clear names over comments. Comment only the *why*.

## Product rules (must hold, must be tested)
- A salary change's effective date cannot be in the future.
- Salary changes only through changeSalary (or a country change), always with a reason and a history row in the same transaction.
- Creating an employee writes a "Starting salary" history row.

## Testing rules
- Backend must have BOTH unit tests (pure domain functions, no I/O) and integration tests (services on in-memory SQLite via createTestDb(), plus supertest e2e for every endpoint). Keep them in separate folders or file suffixes (*.spec.ts for unit, *.int.spec.ts for integration) with separate npm scripts: test:unit, test:int.
- Frontend must have component tests (Vitest + Testing Library) for every form, the directory filters, and each page's loading, empty and error states. Mock the network with MSW, never the components.
- Every test must assert real behaviour. No snapshot-only tests, no tests that only check a component renders, no tests written just to raise coverage.
- Each product rule in REQUIREMENTS.md needs at least one test named after the rule.
- Test names read as sentences describing behaviour, e.g. "rejects a salary change dated in the future".
- A feature is not done until its tests exist and pass.

## Done means
Tests are green, types check, lint is clean, the README is updated if behaviour changed, and an AI_USAGE.md entry is added if you made a notable decision or I corrected you.
