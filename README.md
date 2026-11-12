# Sweety ? Blood Glucose Tracker

A personal glucose journal built for the Kenpath technical assignment with React (JavaScript), Vite, Node.js, Express and PostgreSQL. It supports accounts, private reading CRUD, and daily, month-to-date and previous-month reports.

## Requirements

- Node.js 20.19+ or 22.12+ (verified locally with Node 24.13.0), npm and PostgreSQL.
- A local PostgreSQL database named `sweety_db` and a role with table/index creation permissions. Automated tests also need CREATE SCHEMA permission.

## Install and configure

```powershell
cd server
npm install
cd ../client
npm install
cd ..
```

**Preserve existing configuration.** This project already has a local `server/.env`; do not replace it. On a fresh clone only, copy `server/.env.example` to `server/.env` and fill in your local PostgreSQL settings and a long random JWT secret. No real secret belongs in Git. The root `.env.example` is a reference; the server explicitly loads `server/.env`.

The client works with `http://localhost:5000/api` by default. If needed, copy `client/.env.example` to `client/.env` and change `VITE_API_URL`. Every VITE variable is public: never put a password or JWT secret there.

| Variable                                        | Purpose                                                              |
| ----------------------------------------------- | -------------------------------------------------------------------- |
| PORT                                            | Express port, default 5000                                           |
| DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME | Existing PostgreSQL connection settings; DB_NAME should be sweety_db |
| JWT_SECRET                                      | Server-only JWT signing secret                                       |
| APP_TIMEZONE                                    | Calendar timezone, default Asia/Kolkata                              |
| CLIENT_ORIGIN                                   | Allowed browser origin, default http://localhost:5173                |
| VITE_API_URL                                    | Client API base URL, default http://localhost:5000/api               |

## PostgreSQL setup

Create the database only if absent, using pgAdmin or `createdb -U postgres sweety_db`. Then:

```powershell
cd server
npm run db:setup
npm run seed
```

`src/db/schema.sql` is an idempotent schema using the existing `users` and `readings` columns and pool. Setup creates missing tables, checks and indexes; it never truncates tables or deletes existing rows. Existing rows that conflict with a new constraint cause setup to fail rather than being silently modified. Back up valuable data before applying schema changes.

The schema enforces unique `(user_id, reading_date, slot)`, allowed slots, integer glucose values from 40 through 600, required fields, and a user foreign key. Four valid slots plus the unique constraint enforce at most four readings per user/day. Future-date checks are applied on both create and update in the API.

The seed creates **demo@sweety.example / SweetyDemo123!** with sample readings for today, the first of this month, and the first of the previous month. These are intentionally public demo credentials. If the email already exists, the seed leaves that account and its data unchanged; it does not reset a password. Use a separate demo database when publishing a demonstration.

## Run the application

Open two terminals from the repository root:

```powershell
# Terminal 1
cd server
npm start
# Development alternative: npm run dev
```

```powershell
# Terminal 2
cd client
npm run dev
```

Visit **http://localhost:5173**. The API defaults to **http://localhost:5000/api**. If a port is occupied, stop the conflicting process or configure a different port and matching API URL/origin. Vite may choose another port unless you use `npm run dev -- --strictPort`; update CLIENT_ORIGIN if necessary.

```powershell
cd client
npm run build
npm run preview
```

Preview serves the production build, normally on port 4173. Set CLIENT_ORIGIN accordingly before using it with Express. Build output is ignored by Git.

## Tests and verified checks

```powershell
cd server
npm test
# Equivalent explicit integration selection:
npm run test:integration
```

The 18 Jest/Supertest tests use **real PostgreSQL**, not an in-memory SQL substitute. Each run creates a uniquely named `sweety_test_*` schema, applies the schema twice to verify idempotency, and drops only that generated schema afterward. Application tables and data are not cleared. Keep the configured database reachable; unavailable PostgreSQL is a genuine test blocker. A forcibly interrupted run may leave its test schema for manual inspection/removal.

Coverage includes registration, hashing, duplicate emails, successful/incorrect login, missing/invalid/expired JWTs, ownership isolation, 40/600 boundaries, invalid/missing/decimal values, duplicates and database uniqueness, future/impossible dates, create/update validation, edit/delete ownership, inclusive report statistics, leap-year/year boundaries, timezone boundaries, and empty reports.

Verified during implementation:

- All 18 backend tests passed against local PostgreSQL.
- Idempotent schema setup completed on `sweety_db`.
- `npm run build` completed for React.
- Express and Vite both started and responded over HTTP in temporary test processes.
- The seeded account logged in over HTTP and its daily report returned four readings.

Browser interaction, visual layout and keyboard/mobile behavior still need the manual checks in `screenshots/README.md`. A successful build and HTTP response do not establish browser behavior. Temporary verification servers were stopped after checking.

## API overview

All request and response bodies use JSON. Protected routes require `Authorization: Bearer <token>` from login. Errors return `{ "message": "..." }` with meaningful 400, 401, 404, 409 or 500 statuses. Passwords and hashes are never returned.

| Method | Endpoint                                  | Purpose                                              |
| ------ | ----------------------------------------- | ---------------------------------------------------- |
| GET    | /api/health                               | API liveness (does not imply database health)        |
| GET    | /api/config                               | Reporting timezone and current calendar date         |
| POST   | /api/auth/register                        | `{name, email, password}`; creates an account        |
| POST   | /api/auth/login                           | `{email, password}`; returns JWT and user            |
| GET    | /api/readings                             | All authenticated user's readings, newest date first |
| GET    | /api/readings?date=YYYY-MM-DD             | Readings for one date                                |
| POST   | /api/readings                             | Create `{date, slot, value}`                         |
| PUT    | /api/readings/:id                         | Replace reading date, slot and value                 |
| DELETE | /api/readings/:id                         | Delete an owned reading                              |
| GET    | /api/reports?type=daily&date=YYYY-MM-DD   | Selected day and individual slots                    |
| GET    | /api/reports?type=mtd&date=YYYY-MM-DD     | First of selected month through selected date        |
| GET    | /api/reports?type=monthly&date=YYYY-MM-DD | Entire previous calendar month                       |

Reading example:

```json
{ "date": "2024-03-15", "slot": "Morning (fasting)", "value": 108 }
```

Allowed slots are `Morning (fasting)`, `After breakfast`, `After lunch`, `After dinner`. Values must be JSON integers from 40 to 600, inclusive. Dates use YYYY-MM-DD. GET reading responses return `{readings: [...]}` with `id`, `date`, `slot`, `value`. Reports return `type`, `start`, `end`, `highest`, `lowest`, `average`, `count`, and `readings` (daily only). Empty reports have count 0, null statistics and an empty readings array.

Example: selecting 2024-03-15 yields daily 2024-03-15, MTD 2024-03-01 through 2024-03-15, and monthly 2024-02-01 through 2024-02-29. Averages are numeric, rounded to one decimal; the UI always displays one decimal.

## Project layout

```text
client/src/
  api.js                 Fetch wrapper and configurable API URL
  main.jsx               Authentication, dashboard, forms, history and reports
  styles.css             Responsive visual design
server/
  index.js               Environment loading and server lifecycle
  scripts/               Non-destructive schema setup and demo seed
  src/
    app.js               Express app, routing and central errors
    controllers/         Existing authentication implementation
    middleware/auth.js   JWT verification
    routes/              Auth, reading and report endpoints
    db/pool.js           Preserved PostgreSQL pool
    db/schema.sql        Reproducible schema
    utils/dates.js       Calendar validation, timezone and report ranges
  tests/                 Real PostgreSQL integration suite
screenshots/             Manual QA and demo capture instructions
```

## Notes: assumptions, limitations and improvements

- One configured reporting timezone (default Asia/Kolkata) defines today for all users. PostgreSQL DATE values are returned as text, and date arithmetic uses UTC solely for calendar calculations, avoiding timestamp conversion shifts. Supported dates start at 1900-01-01. Report selection cannot be in the future.
- JWTs expire after one day. The browser stores its token in sessionStorage, clears it on logout/401, and fetches protected data only through the API. Logout clears the local session; server-side token revocation is not implemented.
- Passwords require at least eight characters and at most 72 UTF-8 bytes to avoid bcrypt truncation. Registration normalizes email to lowercase. A normalized unique email index additionally protects case-insensitive duplicates.
- Reports calculate statistics in application code from one user-scoped SQL result, ensuring details and summary share a snapshot. For large datasets, move aggregation to SQL and add pagination. History currently loads all readings.
- No chart, pagination, Redis, queues, Docker or doctor role is included. Required assignment functionality took priority over bonuses.
- Fonts use Google Fonts with local sans-serif fallbacks. The app remains functional if fonts cannot load.
- Before production: add rate limiting, HTTPS, password recovery, a stronger session strategy, deployment-specific CORS, monitoring, backups and a migration/versioning process. Split the React components into separate files as the interface grows.
- This is a tracking journal and supplies no clinical interpretation or treatment advice.

## GitHub and Kenpath submission

Local milestone commits are present; nothing has been pushed or submitted. Review `git status`, run tests/build again, and verify `.env` and `node_modules` are ignored. Capture the screenshots/demo described in `screenshots/README.md`. Create your GitHub repository, add its remote, and push only after reviewing the staged files. Follow the assignment's submission instructions to send the repository and demo links yourself. No submission or email is sent automatically.
