# Build plan (commit-by-commit)

Each line is roughly one commit. "T" means a failing-test commit comes first.
**Rule: the core must be deployed and green by the end of Day 2. Day 3 never starts while a core feature is broken.**
The prompt for each stage is in `docs/prompts/PROMPTS.md`.

## Day 1: foundation and core API
1. `docs:` requirements, architecture, plan, agent instructions, prompts
2. `chore:` npm workspaces, TypeScript, ESLint/Prettier, Vitest, CI (GitHub Actions: lint + test)
3. `feat(shared):` country → currency + FX config (T)
4. `feat(shared):` money helpers: toMinor / format (T)
5. `feat(shared):` employee zod schemas (T)
6. `feat(api):` Drizzle schema + migrations + in-memory DB test helper
7. `feat(api):` create (with "Starting salary" history) / get employee (T)
8. `feat(api):` list with search, filters, sort, pagination (T)
9. `feat(api):` salary change + history in one transaction; reject future dates (T)
10. `feat(api):` edit details (no salary), country change needs new salary (T)
11. `feat(api):` delete + 404 handling (T)
12. `feat(api):` controllers + zod pipe + e2e tests
13. `feat(api):` deterministic 10k seed script; record timing

## Day 2: insights, UI, ship
14. `feat(domain):` stats min/median/avg/max (T)
15. `feat(domain):` outlier rule ±25% of peer median (T)
16. `feat(api):` insights endpoints + role median on employee detail (T)
17. `feat(api):` CSV export (T: escaping commas and quotes)
18. `feat(web):` app shell + directory table with server pagination and filters
19. `feat(web):` employee form (create/edit) with shared schema + tests
20. `feat(web):` employee detail + salary history + change salary modal
21. `feat(web):` insights pages (country table → role drill-down with outliers)
22. `chore:` Dockerfile (single image), deploy to Railway/Fly with a volume, seed on first boot
23. `docs:` README (run, test, deploy, live link)

## Day 3: polish and standout
24. `feat(web):` sync directory filters to the URL
25. `feat(api):` Swagger at /api/docs, /health, consistent error format
26. `docs:` ADRs in docs/adr/
27. `chore:` coverage report + CI badge
28. `perf:` autocannon load test; record numbers in README
29. `feat(domain):` raise cost calculation, per currency + USD (T)
30. `feat(api):` POST /api/simulations/raise, read-only (T)
31. `feat(web):` raise simulator page
32. `feat(web):` range bars on country page (drop if short on time)
33. `docs:` NEXT.md roadmap, AI_USAGE.md final pass
34. Record a 3–5 min demo, then reply to the email with the repo link
