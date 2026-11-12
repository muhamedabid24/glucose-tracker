# Screenshots, manual QA and 2?3 minute demo

Run Express and Vite as described in the root README. Use the seeded demo account, never a real user's data. This folder intentionally contains capture instructions rather than fabricated screenshots.

## Manual checks before submission

1. Register a fresh account, log in, log out, and verify protected data disappears. Try an incorrect password.
2. Add all four daily slots. Try a duplicate, a future date, 39, 601, a decimal and an empty value; confirm clear errors. Confirm 40 and 600 are accepted.
3. Edit a reading, change its date/slot, and verify reports refresh. Cancel a delete, then confirm a delete.
4. Change report date; inspect daily slots, MTD and the previous month. Check an empty period. The seed includes previous-month data.
5. Check the layout on a desktop and at 390px viewport width, scroll the history table, and navigate forms with the keyboard.
6. Stop the API temporarily and verify a readable connection error; restart and retry.

## Screenshots

Use your browser/OS screenshot feature and save PNG files here:

- `01-login.png` ? login or registration page.
- `02-dashboard.png` ? populated daily report and add form.
- `03-history-edit.png` ? history and editing state.
- `04-validation.png` ? a duplicate or invalid reading message.
- `05-mobile.png` ? dashboard at a narrow mobile viewport.

Keep passwords, browser autofill, tokens, network authorization headers and local .env files out of captures.

## Suggested demo recording

- 0:00?0:25: introduce the stack, register or log in with the demo account.
- 0:25?1:05: add a reading and demonstrate duplicate/value/date validation.
- 1:05?1:45: edit/delete a reading and show daily, MTD and previous-month reports.
- 1:45?2:15: demonstrate mobile layout and logout.
- 2:15?2:45: show passing backend tests, project structure and README setup instructions.

Upload or share only after reviewing the recording and choosing the assignment's requested destination.
