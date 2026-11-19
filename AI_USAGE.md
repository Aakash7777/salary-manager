# How I used AI

## Tools
- Claude Code (agentic: implementation, tests, refactors), guided by `CLAUDE.md`
- Claude chat (requirements and architecture drafting, review)

## Workflow
1. I wrote and owned the requirements and architecture. AI drafted, I edited and cut scope.
2. For each feature: I state the behaviour and test cases → the agent writes failing tests → I review them → the agent implements → I review the diff before committing.
3. The agent never commits without a green suite. I check every money and stats calculation by hand.

## Log (keep adding as you go — be honest; corrections are the valuable part)
| # | Task | Prompt (short) | What I kept | What I rejected / fixed, and why |
|---|---|---|---|---|
| 1 | Requirements draft | "Draft a one-page requirements doc for…" | Scope structure | |
| 2 | Monorepo scaffold (PLAN step 2) | "Set up the monorepo described in docs/ARCHITECTURE.md…" | npm workspaces, strict TS, ESLint + Prettier, Vitest in all three packages, CI. Agent's calls: Node 26 LTS (local Node 20 was too old for current Vitest/jsdom), Nest 12 as native ESM, TypeScript pinned to 6.0.x because typescript-eslint and the Nest CLI don't support 7 yet, `shared` consumed from source in tests/typecheck and from `dist` at runtime. | Agent first planned an SWC plugin for Nest decorators under Vitest, then dropped it after checking the official Nest 12 template and proving type-based DI works with Vite 8 alone. Agent's first lint run failed on a stray `.remember/` file; fixed by ignoring it. |
| 3 | Country + FX config (PLAN step 3) | "In packages/shared, build the country config… TDD, STOP after the tests" | Tests first, reviewed before any implementation. `fxToUsd` stays a plain number but `toUsdMinor` scales it to an integer and rounds half up in BigInt, so no float touches a money amount. Rates and `FX_TABLE_VERSION` are pinned by tests. | Agent proposed two tests beyond my list (unknown currency, payroll-sized total); I kept both. I added two it had only suggested: reject non-integer and negative `amountMinor`. |
