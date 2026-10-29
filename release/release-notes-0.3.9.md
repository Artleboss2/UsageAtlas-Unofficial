UsageAtlas 0.3.9 — Windows x64.

This is an **unofficial fork**, not affiliated with, endorsed by, or supported by UsageAtlas. It is
based on [SRX9/UsageAtlas](https://github.com/SRX9/UsageAtlas) and adds private provider readers and
an attribution layer that lets their usage be reported as official providers.

0.3.9 is the **last release before 0.4.0**. Code for the 0.4.0 goals lands on `main` as it is written,
but no 0.4.0 build ships until every acceptance test in the README is met.

## Fixed

- **Cloud save no longer looks stuck on sources the server refuses.** The page counted every pending
  observation, including Cline and Roo, which the hosted service does not model and no attribution
  rule renames. They can never upload, so the counter stayed above zero and *Save to cloud* appeared
  to do nothing. It now counts only what a save can send, reports the held-back sources with their own
  total, and says *Everything the server accepts is saved to cloud* when nothing uploadable is left.
  The hourly timer also ignores held-back rows instead of waking for them.
- **One copy of the app runs at a time.** Squirrel leaves the previous build running after an update;
  several versions shared this profile, competed for `history.sqlite`, and the taskbar group kept the
  first build's icon. A single-instance lock focuses the open window instead of starting another copy.
- **Windows gets the ICO, not the PNG.** The window is created with the selected mark's ICO, so the
  taskbar button draws the app's artwork instead of the Electron atom.

## Changed

- **The local archive is bounded.** `usage_record_history` was written on every collection pass and
  read by nothing, growing to 4.2 MB of an 8 MB database in two days. It keeps the newest 20 versions
  per record, on write and on open, then vacuums the freed pages. On a copy of a real profile the file
  went from **7.91 MiB to 3.99 MiB**.
- **README gained the 0.4.0 storage budget.** It explains the one-document-per-provider-and-day format,
  its additive merge rules, idempotence and trade-offs, with a fake-data comparison: 31,050 current
  observations (30.1 MB) become 150 day documents (0.29 MB), 1.0 % of the payload and 207× fewer rows.
  A provider table lists the tools the discovery work targets and where their token counts live.

## Verified

- 678 desktop tests pass, including new coverage for the held-back counter, the timer staying idle for
  unmapped sources, and the archive bound on open and on write; typecheck and lint are clean.
- A smoke start of the packaged build initializes the window, the preload API and the renderer.

## Notes

- The build is unsigned: Windows SmartScreen may warn on first run.
- Requires Windows 10 or newer, x64. Settings, history and route caches are kept on upgrade.
- Usage the server cannot store without an attribution rule stays on this computer; add a rule on the
  Attribution page to report it as an official provider.
