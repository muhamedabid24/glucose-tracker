# Glucon - Blood Glucose Tracker

Glucon is a personal glucose journal for the Kenpath technical assignment. It uses React and Vite (JavaScript), Node.js, Express and PostgreSQL. The original assignment name was Sweety; legacy database, package, storage and demo-account identifiers remain unchanged to preserve existing installations and data.

## Implemented features

- Registration and login with bcrypt password hashing and one-day JWT authentication.
- User-isolated glucose reading create, read, update and delete operations.
- Four slots: Morning (fasting), After breakfast, After lunch, After dinner.
- Integer values from 40 to 600 mg/dL; required value, allowed-slot and future-date validation on create and update.
- Database-enforced unique user/date/slot entries, which also limit a user to four readings per day.
- Daily report with individual slots, month-to-date statistics and the entire previous-calendar-month report.
- Highest, lowest, reading count and average displayed to one decimal place; friendly empty states.
- Glucon dashboard with an MTD SVG trend chart based on saved entries, responsive styles, loading/error states and edit/delete controls.
- Server-authoritative reporting date refreshed near midnight, at least once per minute after completed requests, on window focus, visible-tab resume and reconnect. Date limits update without resetting the selected report date or unfinished form state.

The chart is implemented without a chart dependency. It shows saved entries in date/slot order within the selected MTD range. Entries are equally spaced; missing readings are not estimated and no clinical or AI interpretation is provided.

## Requirements

- Node.js 20.19+ (20.x), 22.13+ (22.x), or 24+; development verification used Node 24.13.0 and npm 11.6.2.
- PostgreSQL with an existing or newly created database named `sweety_db`.
- A database role allowed to create tables/indexes. Backend integration tests additionally require CREATE SCHEMA permission.

## Installation and environment setup

Run these commands from the project root, where `server` and `client` are located:

```powershell
npm --prefix server ci
npm --prefix client ci
```

Both services have committed lockfiles. `npm install` is an alternative during development when intentionally changing dependencies. A clean-clone installation still needs independent verification; installing into the existing workspace is not proof of that scenario.

**Do not overwrite an existing environment file.** On a fresh clone only, copy `server/.env.example` to `server/.env` and enter your own local PostgreSQL settings and a long random JWT secret. Express explicitly loads `server/.env`; the root `.env.example` is a reference, not its runtime configuration.

The client defaults to `http://localhost:5000/api`. Only if necessary, copy `client/.env.example` to `client/.env` and set `VITE_API_URL`. Vite variables are public: never put database passwords, JWT secrets or API credentials in them.

| Variable      | Purpose                                                       |
| ------------- | ------------------------------------------------------------- |
| PORT          | Express port; default 5000                                    |
| DB_HOST       | PostgreSQL host                                               |
| DB_PORT       | PostgreSQL port; default 5432                                 |
| DB_USER       | Local PostgreSQL role                                         |
| DB_PASSWORD   | Local role password; server only                              |
| DB_NAME       | Database name; use existing `sweety_db`                       |
| JWT_SECRET    | Server-only signing secret; use a long random value           |
| APP_TIMEZONE  | Reporting timezone; default Asia/Kolkata                      |
| CLIENT_ORIGIN | Allowed frontend origin; default http://localhost:5173        |
| VITE_API_URL  | Public client API base URL; default http://localhost:5000/api |

Environment examples contain placeholders only. Actual `.env` files, dependency folders and build output are ignored by Git.

## PostgreSQL setup and demo seed

Create the database only if it is absent, using pgAdmin or:

```powershell
createdb -U postgres sweety_db
```

With `server/.env` configured, run from the project root:

```powershell
npm --prefix server run db:setup
npm --prefix server run seed
```

`server/src/db/schema.sql` creates missing tables, constraints and indexes idempotently. It preserves existing rows. Conflicting existing data causes a schema operation to fail rather than being silently deleted or repaired. Back up important data before database administration.

The existing pool in `server/src/db/pool.js` is reused. Readings use PostgreSQL DATE, a user foreign key, slot/value checks, and unique `(user_id, reading_date, slot)`. Core fields are NOT NULL. The API validates future dates using the reporting timezone on both create and update.

The seed creates a demo account and four readings on each distinct sample date: today, the first of this month, and the first of the previous month.

- Demo email: `demo@sweety.example`
- Demo password: `SweetyDemo123!`

These are intentionally public sample credentials, not a real user's secret. Their legacy names are retained. If the email already exists, the seed leaves the account/password/readings unchanged. A repeat seed does not refresh sample dates or reset that account. Use a separate demo database for destructive manual QA.

## Start backend and frontend

Open two terminals at `C:\Users\Admin\Documents\Project_kenpath` (or your clone's root):

```powershell
# Terminal 1: Express API
npm --prefix server start
# Development alternative: npm --prefix server run dev
```

```powershell
# Terminal 2: React/Vite
npm --prefix client run dev -- --strictPort
```

Visit **http://localhost:5173**. The API defaults to **http://localhost:5000/api**. Keep both terminals running. There is no root `package.json`; plain `npm start` from the root or Documents directory will fail. Use the commands above or change into the relevant service folder first.

If a port is occupied, stop your conflicting development process or update the service configuration and matching client API URL/origin. Do not disable CORS to work around a configuration mismatch.

For a production build and local preview:

```powershell
npm --prefix client run build
npm --prefix client run preview
```

Preview normally uses port 4173. Set `CLIENT_ORIGIN=http://localhost:4173` in your own local server configuration when testing that origin, then restart Express. Do not commit that environment file.

## Automated checks

Run from the project root:

```powershell
npm --prefix server test
npm --prefix client test
npm --prefix client run build
```

Backend tests use Jest, Supertest and real PostgreSQL. Each run creates a uniquely named `sweety_test_*` schema, applies the schema twice, exercises authentication/readings/reports and drops only its generated schema. Application tables are not cleared. If PostgreSQL is unavailable or schema creation is denied, report the blocker rather than treating the tests as passing. A forcibly interrupted test can leave its generated schema behind for inspection.

Frontend date-refresh regression tests use Node's built-in test runner with fake time/events; they require no new dependencies. They cover timezone scheduling, midnight refresh, focus/resume/reconnect, failure recovery, request races and cleanup. These are not browser tests.

Neither package currently defines a lint script. Backend syntax checks and the Vite build are useful checks but must not be described as linting. Browser interactions, mobile/keyboard behavior, draft preservation in the browser, and real screenshots require the checklist in `screenshots/README.md`. A build or server-side render does not prove those interactions.

## API overview

Requests/responses use JSON. Protected routes require `Authorization: Bearer <token>` from login. Errors include a readable `message` with appropriate 400, 401, 404, 409 or 500 statuses. Responses exclude password hashes.

| Method | Endpoint                                  | Purpose                                        |
| ------ | ----------------------------------------- | ---------------------------------------------- |
| GET    | /api/health                               | API liveness; not a database-health guarantee  |
| GET    | /api/config                               | Current reporting date and timezone            |
| POST   | /api/auth/register                        | `{name, email, password}`                      |
| POST   | /api/auth/login                           | `{email, password}`; returns user and JWT      |
| GET    | /api/readings                             | Current user's history, newest date first      |
| GET    | /api/readings?date=YYYY-MM-DD             | Current user's readings on one date            |
| POST   | /api/readings                             | Create `{date, slot, value}`                   |
| PUT    | /api/readings/:id                         | Update an owned reading's date, slot and value |
| DELETE | /api/readings/:id                         | Delete an owned reading                        |
| GET    | /api/reports?type=daily&date=YYYY-MM-DD   | Selected-day statistics and slots              |
| GET    | /api/reports?type=mtd&date=YYYY-MM-DD     | First of selected month through selected date  |
| GET    | /api/reports?type=monthly&date=YYYY-MM-DD | Entire previous calendar month                 |

```json
{ "date": "2026-10-15", "slot": "Morning (fasting)", "value": 108 }
```

Selecting 15 October 2026 produces daily 15 October, MTD 1-15 October, and previous month 1-30 September. Boundaries are inclusive. Date values use YYYY-MM-DD without timestamp conversion. Reports return `start`, `end`, `highest`, `lowest`, `average`, `count`, and daily `readings`. Empty statistics are null with count zero. JSON averages are numeric; the UI formats them to exactly one decimal.

## Project layout

```text
client/
  src/main.jsx                       Authentication and reading workflows
  src/api.js                         Fetch wrapper and API URL
  src/reportingDate.js               Server-authoritative date refresh lifecycle
  src/components/JournalPanels.jsx   KPIs, reports, trend chart and delete dialog
  src/components/ProfileModal.jsx    Click-only authenticated profile modal
  src/components/ReportDateNavigation.jsx  Calendar navigation controls
  src/components/ActionNotice.jsx    Shared accessible action notifications
  src/styles.css                     Existing responsive Glucon design
  tests/                             Date, profile and dashboard DOM regression tests
server/
  index.js                           Environment and server lifecycle
  src/app.js                         Express app and error handling
  src/controllers/                   Authentication controller
  src/middleware/                    JWT verification
  src/routes/                        Auth, readings and reports
  src/db/pool.js                     Existing PostgreSQL connection pool
  src/db/schema.sql                  Idempotent database setup
  src/utils/dates.js                 Backend calendar validation/report ranges
  scripts/                           Schema setup and safe demo seed
  tests/                             PostgreSQL integration suite
screenshots/                         Manual QA, capture and demo instructions
```

## Notes: assumptions and improvements with more time

- Asia/Kolkata is the default shared reporting timezone; the configured server timezone remains authoritative. Browser time schedules revalidation but does not replace server date/calculation logic. Refreshing config changes date limits, not a user's selected report or unfinished reading draft. Offline sessions retain the last successful configuration; the backend remains the final validation authority.
- Dates before 1900-01-01 and future report selections are unsupported. Daily slots represent categories, not measured timestamps.
- JWTs expire after one day and are held in sessionStorage. Logout removes the local token; server-side revocation is not implemented.
- Passwords require at least eight characters and at most 72 UTF-8 bytes. Registration normalizes emails; a normalized unique index prevents case-insensitive duplicates.
- History currently loads all user readings. Reports aggregate one user-scoped query in application code. With more time, add pagination and SQL-side aggregation for larger datasets.
- The MTD chart is implemented. Pagination, Docker Compose, Redis, BullMQ and doctor accounts are not implemented; they are optional extensions, not prerequisites for the core assignment.
- Add browser/React form regression coverage, CI and lint configuration with more time. Review development-dependency advisories through targeted updates and regression testing.
- Before production, add authentication rate limits, HTTPS, security headers, password recovery, a stronger session lifecycle, backups and monitoring.
- Fonts load from Google Fonts with local fallbacks. The journal provides no medical advice, clinical classification or AI insights.

## GitHub and Kenpath submission

Configured origin: `https://github.com/muhamedabid24/glucose-tracker`. Public accessibility is **not confirmed**; verify the repository in a signed-out/incognito browser and follow the assignment's access requirements.

Existing redesign and branding commits are preserved. Final corrections are committed locally; publication requires the owner's approval. Do not assume the remote contains local commits. Inspect `git status`, `git branch -vv` and `git log --oneline origin/main..HEAD`; the tracking ref reflects the last remote observation.

Before submission, rerun automated checks, complete manual QA, capture real screenshots or a 2-3 minute demonstration, inspect staged/tracked files for secrets and confirm the intended branch. After explicit approval, publish the current submission branch using `git push -u origin glucon-final-v2`. Recheck signed-out access and that GitHub shows the intended latest commit. Then submit the repository/demo links through Kenpath's requested channel. No automatic push, visibility change, email or submission is performed.

## My Profile popup

The authenticated header has a My Profile button immediately before Log out. The form is not mounted or fetched until that button is clicked; opening it does not navigate or change the URL. Cancel, X, Escape and an outside click discard unsaved changes. Dismissal is blocked while saving. A successful save updates the header name and closes the dialog. Reopening fetches the latest saved profile.

The native modal dialog blocks background interaction, manages focus, supports Tab wrapping and restores focus to its trigger. Native browser top-layer behavior and responsive appearance still require browser QA; DOM tests emulate only dialog open/close methods.

`GET /api/profile` and `PATCH /api/profile` require the existing Bearer token and use only the authenticated user ID. PATCH permits only name, age and weight; account identifiers, email and credentials cannot be changed through it. Name is required (1-100 trimmed characters). Age is optional, a whole number from 0 to 130 years. Weight is optional, above 0 and up to 500 kg with at most two decimal places. Blank optional fields are stored as SQL NULL.

For an existing database, apply the additive migration with `npm --prefix server run db:profile`, then restart Express to load the new route. Full `db:setup` also applies it. The idempotent migration adds missing nullable columns and constraints without updating existing user data or readings. Profile values persist in PostgreSQL only after Save Changes.

Frontend DOM regression tests use jsdom as a development-only dependency and Vite's JSX transformer. Run `npm --prefix client test`; backend integration coverage runs with `npm --prefix server test`. No browser screenshots or native accessibility pass is claimed from those tests alone.

## Reliability and report-date navigation

Previous Day, Today and Next Day use the current reporting date returned by `/api/config`, not the browser's local timezone. Next Day is disabled at today; the minimum supported date remains 1900-01-01. Changing the selected date refreshes all three report requests without resetting an unfinished reading draft or changing report-range/calculation logic.

Reading add/edit/delete and profile-save success messages reuse a persistent, dismissible live-region notification. Request errors are shown through the existing field/modal errors and action feedback. Delete still requires its existing confirmation dialog. Synchronous in-flight guards prevent duplicate reading submissions and repeated confirmed deletion while requests are pending.

If My Profile reports `Endpoint not found.`, first check the running process, not only the source files. The expected endpoints are GET and PATCH `http://localhost:5000/api/profile`. An unauthenticated GET must return 401, while 404 indicates the contacted server does not expose that route. Stop the old backend terminal with Ctrl+C and run `npm --prefix server run dev` from this project root (or restart `npm --prefix server start`). Nodemon is already installed and watches server code in development. Keep only one backend on the configured port. If profile columns are missing, run the documented `db:profile` migration; a database-column error is not the same as an endpoint 404. The modal now provides a restart/retry message for a stale server while preserving unsaved input.

The current automated suite also mounts the actual React app in jsdom with mocked API responses to test signup/login/logout transitions, profile reopen after login, notifications, duplicate-submit prevention, delete confirmation and report navigation. PostgreSQL-backed backend tests separately verify real persistence and isolation. jsdom shims FormData, native-dialog methods and scrolling where needed; it has no browser layout engine. Do not interpret those tests as a browser, mobile, visual or native-accessibility pass.
