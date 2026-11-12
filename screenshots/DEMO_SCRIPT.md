# Glucon - 2 minute 45 second demonstration script

**Status: recording not yet captured.** This is a practical storyboard, not a claim that the browser checks passed. Complete `screenshots/README.md` before recording. Use an OS/browser screen recorder; no synthetic screenshots or generated application footage.

## Prepare before pressing Record

1. Run the backend and frontend using the root README. Use a separate demo database or a disposable account with no personal data. Do not change existing demo/user records just to match this storyboard.
2. Register that account through the UI, then prepare the following readings using the form. Set both the form date and report date deliberately; they are independent controls.

| Date       | Slot              | Value (mg/dL) |
| ---------- | ----------------- | ------------- |
| 2026-10-15 | Morning (fasting) | 108           |
| 2026-10-15 | After breakfast   | 40            |
| 2026-10-15 | After lunch       | 600           |
| 2026-10-01 | Morning (fasting) | 80            |
| 2026-09-01 | Morning (fasting) | 90            |
| 2026-09-30 | After lunch       | 150           |

These dates are historical relative to the assignment's November 2026 deadline. Use a disposable fixture account so setup does not collide with existing records. Leave After dinner on 15 October empty for the live create demonstration.

3. Log out and hide password managers, real credentials, environment files and network authorization headers. Keep two terminal tabs ready with passing `npm --prefix server test` and `npm --prefix client test` output.
4. Test desktop layout and the browser's ~390px device viewport before recording. Hide unrelated notifications.

## Timed storyboard

| Time      | Action                                                                                           | Suggested narration / expected evidence                                                                                                                                                                                                                     |
| --------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0:00-0:20 | Show Glucon login and log in to the disposable account.                                          | "Glucon uses React, Express, Node.js and PostgreSQL. Accounts use bcrypt and JWT authentication; reading queries are scoped to the signed-in user." Do not display token values.                                                                            |
| 0:20-0:45 | Select 15 October 2026. Set form date to 15 October, After dinner, value 100, then save.         | Show the new history/daily entry and refreshed KPIs. Expected daily: highest 600, lowest 40, average 212.0, count 4.                                                                                                                                        |
| 0:45-1:10 | Attempt another After lunch reading on that date, then try 108.5 and a future date.              | Show meaningful duplicate/value/date errors. Explain that the same rules run on the backend and the unique date/slot constraint enforces the four-entry limit. Do not describe unshown validation cases as demonstrated.                                    |
| 1:10-1:35 | Edit After dinner from 100 to 110. Open delete confirmation, cancel once, then confirm deletion. | Show history and report refresh after each successful operation. Edit expected daily average: 214.5. After deletion: count 3, average 249.3.                                                                                                                |
| 1:35-2:00 | Show daily slots, MTD analytics/chart and previous-month dates for the selected October date.    | Explain inclusive 1-15 October MTD and entire 1-30 September previous month. Previous-month fixture statistics: highest 150, lowest 90, average 120.0, count 2. The chart displays saved MTD entries; it does not estimate readings or give medical advice. |
| 2:00-2:20 | Switch to approximately 390px viewport and navigate a form control with the keyboard.            | Show the actual mobile layout and focus indicator. Claim only behavior observed during the recording.                                                                                                                                                       |
| 2:20-2:45 | Show passing backend/frontend test output, README setup/Notes, then log out.                     | Explain the server-authoritative date refresh on midnight/focus and that automated fake-time tests cover rollover. Do not claim a live midnight demonstration unless it was actually recorded.                                                              |

The storyboard's numbers are expected results for the listed fixtures; compare the real UI before recording. If the observations differ, investigate rather than editing footage to conceal the problem.

## Deliverables after recording

- Save a genuine `glucon-demo.mp4` (or the assignment's supported format). Prefer a linked video if the file is too large for the repository.
- Capture the six PNGs in `screenshots/README.md` from the working app.
- Record browser/version, viewport, date and observed QA results in a short manual log.
- Review footage for personal data, secrets, false pass claims and notification leaks.
- Obtain approval before any external upload, Git push, visibility change or Kenpath submission. Verify signed-out repository/video access after approved publication.
