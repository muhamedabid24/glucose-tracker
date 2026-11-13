# Glucon reliability and submission verification

Verification date: 13 November 2026, Asia/Kolkata. Work remains on `glucon-final-v2`. This is an evidence record, not a browser QA certificate or an external submission.

## Profile API investigation

The running API at port 5000 currently returns 401 for unauthenticated GET `/api/profile` and 200 for the existing demo account's authenticated GET. The returned registered name and optional fields match PostgreSQL; only id, name, age and weight are returned. The frontend API base resolves to localhost:5000/api; GET/PATCH paths and Express registration agree. The process started after the profile route source was added. Nullable age/weight columns already exist, so no additional migration was required in this pass.

The reported 404 is not reproducible against the current running backend. A previously running backend without the new route is a plausible explanation, but the original failing process/request cannot be conclusively reconstructed. No duplicate endpoint was added. A 404 now produces an actionable restart/retry message in the modal, preserving its draft. README documents checking the running server and using the existing nodemon development command. The actual running endpoint was verified before claiming it works.

## Implemented improvements

- Previous Day, Today and Next Day controls use server-configured today and calendar-date arithmetic, preserving the reporting timezone and existing report calculations. Future navigation and dates before 1900-01-01 are blocked.
- Existing action feedback is reused as persistent dismissible live-region notifications, with errors retained inline where appropriate. Profile errors remain in the active modal; success is announced after closing it.
- Reading submission and confirmed deletion have synchronous in-flight guards. Existing delete confirmation is reused.
- Responsive safeguards allow navigation/header wrapping, KPI unit wrapping, bounded notifications, table-contained scrolling and smaller statistic text only on very narrow viewports. Backgrounds, widget colors and existing forms/charts remain intact.
- Tests cover real React components in jsdom and backend persistence in isolated PostgreSQL schemas. No dependency was added in this pass.

## Final executed checks

| Command/check                                        | Result                                                                                                                                                 |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm --prefix server test`                           | PASS: 46 Jest/Supertest tests, one suite, final run 6.182 seconds                                                                                      |
| `npm --prefix client test`                           | PASS: 54 Node/DOM tests, zero failures or skipped tests                                                                                                |
| `npm --prefix client run build`                      | PASS: Vite production build, 31 transformed modules                                                                                                    |
| Cached Prettier checks                               | PASS on changed source/tests/docs; formatting is not linting                                                                                           |
| Backend profile-route/migration-script syntax checks | PASS                                                                                                                                                   |
| Live API/DB read-only checks                         | PASS: expected unauthenticated 401, demo login, authenticated profile 200, PostgreSQL field match and sensitive-field exclusion                        |
| Migration check                                      | Existing nullable age/weight fields found; no new migration/data rewrite performed                                                                     |
| Source and environment checks                        | No configured real secret values or common credential patterns found in inspected source; actual environment files and generated paths are not tracked |
| Dependency manifests/lockfiles                       | Match; lint scripts are absent in both packages                                                                                                        |
| Branch/history                                       | Still glucon-final-v2; existing history preserved; no commits, pushes or visibility changes performed                                                  |

Initial extended DOM tests encountered missing jsdom scrolling and browser FormData behavior. The test harness was corrected with explicit shims; app validation/authentication code was not weakened, and the final exact frontend command passes. jsdom still has no layout engine or native modal top layer.

## What the tests support

The real-database backend suite verifies registration/login, bcrypt hashing, JWT failures, user isolation, reading CRUD, integer boundaries/invalid values, duplicates/four slots, future dates, daily/MTD/previous-month statistics, empty reports, profile validation, scoped profile access, and persistence across a renewed login session. It does not delete/reset existing application records.

Frontend tests execute the real React app with mocked API responses. They verify signup/login/logout transitions, click-only profile opening, cancellation/save/reopen behavior, updated header name, profile retention after logout/login, actionable stale-server messages, success/error feedback, reading create/edit boundaries and future-date rejection, duplicate-submit protection, delete confirmation, report refresh/date navigation, unfinished draft preservation and date-rollover handling. Those are DOM-level tests, not real-browser or end-to-end network proof.

## GitHub and submission artifacts

Origin: https://github.com/muhamedabid24/glucose-tracker

Read-only Git access found remote `glucon-final-v2` at `8e727951c05f39a5dec25da545ed926b5a3efbe2`, matching committed local HEAD. The working-tree profile/reliability changes are not yet committed or published. Anonymous repository and branch API checks returned 404; public evaluator access is NOT VERIFIED and must be checked signed out. Do not equate authenticated Git access with public access.

`screenshots/` contains checklist and demo-script Markdown files, not actual screenshots or video. Media capture remains pending. No fake artifacts were generated.

## Remaining verification and actions

- Real browser authentication/CRUD/profile/report navigation and browser fetch/CORS: NOT VERIFIED in this pass; no browser automation tool is available.
- Desktop/tablet/mobile visual rendering, native dialog focus/inert behavior, and actual scrolling: NOT VERIFIED. CSS safeguards and DOM tests are not substitutes for viewport QA.
- Clean-clone installation and seed creation: not rerun in this existing workspace. The current demo login works; seed/setup instructions and package declarations were inspected.
- Lint: no configured scripts; no lint pass claimed.
- Actual screenshots/demo recording: PENDING.
- Review/stage/commit/push the intended files only after owner review; confirm signed-out branch access and then submit through Kenpath's requested channel.
- Optional search/filtering, CSV export, chart changes and an About section were not implemented.

Status: **INSUFFICIENT VERIFICATION** for final submission until real-browser QA, real media, publication review and evaluator access checks are completed. Automated checks and live read-only profile verification pass.
