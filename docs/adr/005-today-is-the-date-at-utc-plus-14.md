# 005. "Today" is the date at UTC+14

Status: Accepted (2026-11-19)

## Context

Two product rules compare a date with today: a salary change's effective date cannot be in the future, and neither can a hire date. These are calendar dates (`YYYY-MM-DD`) with no time or timezone, entered by HR users in India, the US, the UK, Germany and Singapore. The server has one clock and does not know where the user is.

If the server used its own date, or the UTC date, a user ahead of UTC would be refused their own today for part of every day: in India between midnight and 05:30, in Singapore until 08:00. Being told that today is "in the future" is the kind of error that sends people back to the spreadsheet. The opposite error, accepting a date that is a few hours early for some users, harms nothing: a salary change applies immediately whatever its date.

## Decision

**On the server, today is the calendar date at UTC+14, the latest date anywhere on Earth.**

- `Clock.today()` (`apps/api/src/clock/clock.ts`) adds 14 hours to `now()` and takes the date part. It is the only definition of today in the API; a lint rule bans `new Date()` and `Date.now()` outside `clock.ts`, and tests inject a `FixedClock`.
- The service passes `clock.today()` into the shared schema factories, which reject any date after it (ADR 004).
- The web forms pass the user's **local** date to the same schemas, so the user is held to their own calendar and the server is the outer limit that never contradicts them.
- The same value is used wherever the server needs a date of its own: the effective date of a country change, and the date in the CSV export's filename.

## Consequences

**What we get**

- No user in any timezone is told that their own current date is in the future. `clock.spec.ts` tests both sides of the boundary, including that a date in the future everywhere on Earth is still rejected.
- No timezone input, header or per-user setting; one rule that fits in one line.

**What it costs**

- **The server is lenient by up to a day.** A request that bypasses the web form can use a date one day ahead of the caller's own calendar (two, late in the evening at UTC-11 and UTC-12). In India the server accepts tomorrow from 15:30 local time; in the UK from 10:00 in winter.
- **Dates the server writes can look a day early.** A country change is stamped with the UTC+14 date, so a user in India doing it after 15:30 sees a history row dated tomorrow, and a US user sees that for most of the day. A salary change they then enter with their local date sorts below it in the history. The CSV filename has the same quirk.
- The rule is surprising. "Today" does not mean the server's date or UTC, and the web and the API can disagree about a date within a day of now. Anyone who replaces `clock.today()` with a plain date call reintroduces the original bug, which is why the lint rule exists.
- UTC+14 is a constant. It is the current maximum offset (Kiribati's Line Islands), not a law.

**When this would change**

- **Scheduled, future-dated changes are built.** Then "has this date arrived?" decides when pay changes, and a day of slack is no longer harmless. It needs a real timezone, most likely the employee's work location.
- Authentication arrives and users have a profile: validate against the user's own timezone and stamp server-written dates with it.
- An auditor needs effective dates that are exact to the day: store the instant and the timezone it was entered in, and derive the date.

The smallest improvement available today, without those, is for the web app to send its local date with a country change so the stamped date matches what the user sees.
