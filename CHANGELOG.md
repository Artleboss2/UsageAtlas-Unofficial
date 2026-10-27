# Changelog

All notable UsageAtlas desktop changes are recorded here. This is an unofficial fork; see
[README.md](README.md) for what it adds and what it is not.

## 0.3.2 — 2026-10-27

### Changed

- The repository is now `Artleboss2/UsageAtlas-Unofficial`, and the app says so: Settings carries an unaffiliated-build notice, the documentation button and the bug-report link open this fork's repository, and the updater reads its releases from the new name. Installing an upstream build still replaces the fork's private providers.
- Packaging metadata (deb/rpm homepage, installer authors, setup icon URL) points at this fork instead of the original project's site.

## 0.3.1 — 2026-10-27

### Fixed

- Freebuff history can be stored again. Freebuff reports cached tokens inside its input count, and the stored day payloads kept them overlapping, so every generated record and observation failed the usage contract: local history reported that it could not be stored, Freebuff days were missing from the dashboard, and a cloud save hid the rows it could not read. Cached tokens are now moved out of input at the edge, so the categories add up to the day's total, and a regression test feeds the collector's own facts through the store that rejected them.

### Added

- **Publisher choice for updates.** Settings → App updates now switches between *My fork* (this build's GitHub releases) and *Upstream* (the official UsageAtlas update mirror). GitHub-hosted releases carry the Squirrel `RELEASES` feed and `.nupkg`, so Windows installs update in place from either publisher; the choice applies to the next check without a restart.
- **Model picker in Attribution.** A reporting rule now offers the models the reported provider runs (filtered against the server's reviewed public catalog) instead of a free-text field, keeps a rule's own model selectable, and picks a valid model when the provider changes.

## 0.3.0 — 2026-10-26

### Added

- Local provider readers for Freebuff and z.ai, including the dynamic path planner that finds Freebuff's `desktop-v2.db` wherever it lives.
- Cloud attribution: a source the server does not model yet can be saved under an official provider with a model of your choice, without rewriting local history.

## 0.2.2 — 2026-07-19

### Fixed

- Stopped macOS builds from reinstalling the version they are already running: the installed version is now part of the update feed path, and the update service reports that there is nothing to install.
- Downloaded updates are now actually installed. The app offers a restart when one is staged and keeps a tray entry until it happens, which is the only way Squirrel.Mac applies an update.
- Linux AppImage builds, which have no in-app installer, now report a newer published release and link to the download page.

### Changed

- Replaced the orange visual language with a graphite-first Cursor-style palette and made graphite the default appearance.
- Restored the real UsageAtlas artwork inside the custom title bar and sidebar.
- Reduced card and control corners to a 2–6 px radius scale and disabled native rounded window corners.
- Unified all interface, metric, table, and diagnostic typography on one CursorGothic-first sans stack.

## 0.2.1 — 2026-07-19

### Changed

- Rebuilt the full desktop interface around a Cursor-inspired design system with warm cream surfaces, warm ink, Cursor Orange actions, compact geometry, and hairline-only depth.
- Integrated the native window controls into a theme-aware custom title bar and synchronized its appearance with System, Light, and Dark preferences.
- Restyled the dashboard, providers, analytics, settings, diagnostics, tables, charts, loading states, and error states.

## 0.2.0 — 2026-07-18

### Added

- Cross-platform Electron application with a sandboxed React renderer and typed preload API.
- Tested Codex and Claude adapters using existing local OAuth credentials.
- Quota windows, reset times, plan details, credits, and structured provider errors.
- Local 7/30/90-day token, request, project, session, model, and estimated-cost analytics.
- Tray behavior, launch-at-login preferences, themes, diagnostics, and automatic updates.
- Signed release pipelines, packaged smoke tests, explicit Electron fuses, dependency auditing, and checksums.

### Changed

- Refined the dashboard, settings, diagnostics, empty states, and interaction feedback for the desktop launch.
- Consolidated product documentation around the maintained application and its supported providers.
