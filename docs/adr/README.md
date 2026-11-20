# Architecture decision records

One page per decision, in the format Context / Decision / Consequences. Each record describes what the code does today, what it costs, and what would make us change it. `docs/ARCHITECTURE.md` has the overview; these are the decisions worth arguing about.

| # | Decision | In one line |
|---|---|---|
| [001](001-sqlite-and-single-deployable.md) | SQLite and a single deployable | One process, one SQLite file on a volume, one Docker image serving both the API and the web app. |
| [002](002-money-as-integer-minor-units-and-no-cross-currency-sums.md) | Money as integer minor units, and no cross-currency sums | Amounts are integers plus an ISO-4217 currency; the two cross-country figures (org-wide payroll and the raise simulator's total increase) are converted to USD per currency, then summed, and labelled indicative. |
| [003](003-in-memory-sqlite-over-mocked-repositories.md) | In-memory SQLite over mocked repositories | Service and e2e tests run the real migrations and real SQL on `:memory:`; no repository is mocked. |
| [004](004-validation-in-the-service-with-shared-zod-schemas.md) | Validation in the service with shared zod schemas | Controllers pass input through untouched; the service parses it with the schemas the web forms also use. |
| [005](005-today-is-the-date-at-utc-plus-14.md) | "Today" is the date at UTC+14 | The server's "not in the future" check uses the latest calendar date anywhere on Earth. |

## Adding a record

Copy the headings of an existing record, take the next number, and add a row above. A record is not edited once its decision is replaced: write a new one and mark the old one "Superseded by NNN".
