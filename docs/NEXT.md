# What I would build next

The first section, "Before real use", is what blocks real salary data going in.

Each section is in priority order. `REQUIREMENTS.md` lists what was left out on purpose; the decision records in `docs/adr/` say when each design choice would change.

## Before real use

**1. SSO and role-based access.**
There is no authentication: anyone with the URL can read and change every salary. This is the one blocker before real salary data goes in. It needs sign-in through ACME's identity provider, at least two roles (read-only and HR editor), and the user recorded on every salary change. It also changes the storage decision: backups and recovery become mandatory (ADR 001).

**2. Bulk Excel/CSV import with a validation report.**
This is how 10,000 people actually get in; nobody will type them. Every row goes through the same shared schemas as the forms, and the result is a report: rows accepted, rows rejected and why, duplicates by email. It should be a dry run first and all-or-nothing on commit, so a half-imported file never exists.


## Known gaps

**1. A country change can be dated tomorrow for users east of UTC.**
Cause: the server's "today" is the date at UTC+14, so that nobody is told their own date is in the future (ADR 005), and a country change is stamped with that date. Who sees it: anyone whose local date is behind UTC+14 at that moment, which is India after 15:30, the UK after 10:00 in winter, and the US for most of the day. Their history shows the change dated the next day, and a salary change entered afterwards with today's date sorts below it. Fix: the web form sends the user's local date as `effectiveDate` with a country change, checked by the same not-in-the-future rule, and the server falls back to its own date only when none is sent; this was timeboxed out rather than missed, because the fix touches the shared schema, the service, the form and the OpenAPI docs.

**2. Mark leavers instead of hard-deleting them.**
Remove is a hard delete that takes the salary history with it. A real system keeps leavers with an end date, excludes them from the directory and the statistics by default, and never loses their history.

**3. Search is case-insensitive for ASCII only.**
SQLite's `LIKE` folds case for A to Z and nothing else, so "özil" does not match "Özil" although "ozil" matches "Ozil". With German names in the data this is a real miss. Fix: store a normalised search column (lower-cased, optionally with accents folded) and search that, or use SQLite's ICU extension.

**4. Sorting by salary compares raw amounts across currencies.**
With no country filter, INR 1,800,000 sorts above USD 165,000. The UI says so, and filtering by country makes the sort meaningful. The real fix is an indicative USD amount to sort by, labelled as such, which means storing or computing a converted amount per row.

**5. Editing a hire date can leave history rows dated before it.**
Moving the hire date later is accepted even when existing salary changes, including "Starting salary", are dated earlier. Either reject a hire date later than the earliest history row, or move the starting row with it; the first is simpler and loses nothing.

**6. Insights and statistics are returned as numbers.**
Sums run in BigInt, but each result is converted to a JSON number at the end, so a total past 2^53 minor units (about 90 trillion in major units) would silently lose its last digits. Nothing checks for it. Fix: return such totals as strings, or fail loudly when a result is not a safe integer.


## Improvements

**1. Scheduled (future-dated) salary changes.**
Left out deliberately: it needs a pending state, a job that applies changes on the day, and a way to cancel. It also ends the tolerance in "A country change can be dated tomorrow" above, because "has this date arrived?" would decide when pay changes, so it needs a real timezone per employee.

**2. Move "not before the hire date" and "must differ from the current salary" into the shared schemas.**
These two rules live only in the API (`domain/salary-change.ts`), because they need the stored employee. The date picker blocks days before the hire date, but a typed date or an unchanged salary is only caught by the server. The schema factory already takes context (`today`), so it can take the hire date and current salary too, and the form would report both before sending.

**3. The search + salary-sort query is the slowest directory request.**
After the name index fix it is the slowest thing in the load test: 290 requests per second with a p95 of 38 ms at 10 connections, against 2,638 for the default page. Its query plan has not been examined. A `LIKE '%text%'` cannot use an index, so the likely answer is a full-text index (SQLite FTS5), which would also be the place to fix the ASCII-only search above.

**4. The web bundle is one 830 kB chunk with no code splitting.**
The whole app ships as one JavaScript file (830 kB, 250 kB gzipped) plus 286 kB of CSS, and Vite warns about it on every build. Splitting by route would keep Insights and the simulator out of the first load of the directory. Fine on an office network; worth doing before anyone uses it on a slow one.


## Product direction

**1. Pay equity analysis.**
The obvious next question after "who is an outlier?" is whether pay differs by gender or other protected characteristics for the same role. It needs data this app does not hold, and that data needs a privacy and legal review per country before it is collected, so it comes after access control and is a product decision, not a feature to slip in.
