# 004. Validation in the service with shared zod schemas

Status: Accepted (2026-11-19)

## Context

Input must be validated on both client and server, and the two must not drift. The usual NestJS answer is a validation pipe or DTO classes on the controller. Three things here do not fit that:

- Some rules need context a pipe does not have. "Not in the future" needs today's date from the injected clock. The edit schema needs the employee's **current** country, to tell a real country change (which requires a new salary and a reason) from a form resending the same country.
- The product rules must hold for every caller of the service, not only for HTTP requests.
- The web forms need exactly the same rules and messages.

## Decision

**Controllers pass bodies and queries to the service as `unknown`. The service parses them with zod schemas from `packages/shared`.**

- `packages/shared` exports schema **factories** that take their context as arguments: `createEmployeeInputSchema(today)`, `changeSalaryInputSchema(today)`, `updateEmployeeDetailsInputSchema({ today, currentCountryCode })`, plus `listEmployeesQuerySchema`.
- Each service method starts with `safeParse`. A failure becomes an `InvalidInputError` carrying `{ path, message }` issues, and the one global exception filter turns it into a 400 with `{ error: { code, message, fields } }`.
- The object schemas are strict. An unknown key is an error, and that is how "currency is not an input" and "salary is not editable in Edit details" are enforced.
- Rules that need stored state come after the parse, as pure functions in `domain/` (`salaryChangeIssue`: not before the hire date, must differ from the current salary), and report through the same error type. A duplicate email is left to the database's unique constraint.
- The web forms call the same factories with the user's local date, and the OpenAPI request schemas at `/api/docs` are generated from the same zod objects.
- One exception: the `:id` path parameter is parsed in the controller (`parseEmployeeId`), because it is addressing, not input.

## Consequences

**What we get**

- One definition of every rule and message, used by the forms, the API and the docs.
- The service cannot be called with unvalidated data. Service tests exercise validation without HTTP, and a future caller (a bulk import, a job) gets the rules for free.
- Controllers are a few lines each, with no DTO classes to keep in sync.

**What it costs**

- **Service signatures take `unknown`**, so a wrong call from inside the codebase fails at run time rather than at compile time.
- It is not idiomatic Nest. Someone looking for a `ValidationPipe` or DTOs will not find them, and `@nestjs/swagger` decorators are unavailable, so response shapes in the OpenAPI document are written by hand.
- **Lookup happens before validation** where a schema needs the stored employee, so a bad body sent to a missing id returns 404, not 400.
- Validation is in two layers (schema, then domain function). The parse cannot see stored state, and one invariant is therefore stated twice: the service throws if a country change arrives without a salary and reason, which the schema should already have rejected.
- The web bundle and the API are coupled to one package and one zod major version.
- The client and the server use different values of "today" on purpose (ADR 005), so "same schema" does not mean "same verdict" for a date within a day of now.

**When this would change**

- A second transport or a public API with its own versioned contract: validate the wire format at the edge and pass typed input inward, keeping the state-dependent rules in the service.
- The API and the web app stop living in one repository: the shared package would need publishing and versioning, or the web app would generate its types from the OpenAPI document instead.
- Internal callers multiply and the `unknown` signatures start hiding mistakes: split each method into a parsing entry point and a typed inner function.
