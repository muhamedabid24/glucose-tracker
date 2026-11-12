# Glucon final-corrections verification

Verification date: 12 November 2026 (client context, Asia/Kolkata). This document records executed checks and limitations; it is not a browser QA certificate or a Kenpath submission.

## Changes in this correction series

1. Server-authoritative reporting configuration now refreshes near configured midnight, at minute-capped intervals after completed requests, on window focus, visible-tab resume and reconnect. Browser time only schedules requests. Existing selected report and reading-form state are not reset or remounted by this change.
2. README and capture instructions now describe Glucon, the implemented MTD SVG chart, service-specific commands, environment setup, Notes and pending publication accurately.
3. Persistent regression tests, this evidence record, and a timed real-recording storyboard strengthen final submission preparation.

Backend application code, API routes, report calculations, authentication implementation, PostgreSQL pool/schema, CSS, environment files and existing application rows are unchanged by this series. Backend tests use only their generated fixture schema.

## Executed checks

| Check                                                              | Result                                                                                                                                     |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm test` in `server` (`npm --prefix server test` from root)      | PASS: one Jest/Supertest suite, 29 tests against real PostgreSQL; final run 6.008 seconds                                                  |
| `npm test` in `client` (`npm --prefix client test` from root)      | PASS: 12 Node test-runner date-refresh tests                                                                                               |
| `npm run build` in `client`                                        | PASS: Vite production build                                                                                                                |
| Cached Prettier check on changed source/tests and README/checklist | PASS; formatting is not linting                                                                                                            |
| `node --check` on tracked backend JavaScript                       | PASS: 13 files                                                                                                                             |
| Environment-example coverage                                       | PASS: every statically referenced server/client configuration variable is present in root `.env.example`; examples retain placeholders     |
| Lockfile/manifest dependency comparison                            | PASS: client/server declarations match their lockfiles; no dependency added                                                                |
| Direct Express and Vite startup                                    | PASS: temporary ports 5061 and 5181; verification listeners stopped afterward                                                              |
| Raw-HTTP smoke requests                                            | PASS: health, served Glucon title, date watcher initial/focus loads against real config API, existing demo login and authenticated history |
| Existing redesign/branding ancestry                                | PASS: commits `16d7f1a` and `3650005` remain ancestors                                                                                     |
| Remote read-only check                                             | `origin/main` observed at `611d262476c23fef299b7dd4c6a6144f950697f8`; final corrections remain local, no push performed                    |
| Staged-file/secret checks                                          | Per-commit allowlists and checks for current configured DB password/JWT secret; no real secret values printed or staged                    |

An initial Vite build caught a leftover line during effect replacement. It was corrected before the first correction commit; subsequent builds pass.

Initial fetch-based startup probes failed in this execution environment. A raw Node HTTP diagnostic reached the listening servers successfully, and the raw-HTTP smoke checks above passed. No application fetch implementation was changed to mask this difference. Browser fetch/CORS and complete user interactions remain manual verification items.

## Regression coverage added

Frontend: Kolkata midnight scheduling, authoritative server-date rollover, focus/visibility/reconnect, failed refresh recovery, overlapping-request races, cleanup, December/January, leap-day transitions, configured non-default timezone and invalid refresh configuration.

Backend: exact invalid values including 108.5/negative/nonnumeric/empty on create and update, accepted 40/108/600 with create-update-GET-SQL-delete persistence, unauthenticated mutations, independent users sharing a date/slot, duplicate After lunch/fifth-reading rejection, and the October 2026 report-range example. Existing authentication, ownership, future-date, report-statistics and empty-report tests remain intact.

## Skipped or unverified

- Browser automation: unavailable in this session; no browser package was installed.
- Complete UI registration/login/logout/CRUD, all form validations, browser fetch/CORS, responsive layout, keyboard focus and browser draft preservation: NOT VERIFIED by this correction series. See `screenshots/README.md`.
- Lint: neither package defines a lint script; no lint pass is claimed and no unrelated lint dependencies were added.
- Actual screenshots and screen recording: NOT CAPTURED. `screenshots/DEMO_SCRIPT.md` supplies a 2:45 storyboard and the screenshot README supplies the real-capture checklist.
- Fresh clone/clean dependency installation: not performed; lockfile consistency and existing installation were verified.
- Public GitHub access: NOT CONFIRMED. Verify the intended URL in a signed-out browser; do not equate authenticated Git access with public access.
- External publication/submission: not performed. Git push, visibility changes, video uploads and Kenpath submission require owner approval.

## Final manual actions

1. Complete the browser checklist on disposable fixtures, including midnight/focus behavior with an unfinished new/edit form.
2. Capture and review genuine screenshots and a 2-3 minute video.
3. Review local commits and approve publication; push the intended branch only after approval.
4. Confirm GitHub contains the latest commit and is accessible to the evaluator; verify any video permissions.
5. Submit the approved repository/demo links through Kenpath's requested channel.

Status: **INSUFFICIENT VERIFICATION** until browser QA and real media are completed. The implemented correction, automated regression checks and local build are complete; publication is intentionally pending approval.
