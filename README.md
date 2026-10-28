<p align="center">
  <img src="branding/usageatlas-logo.png" width="144" height="144" alt="UsageAtlas app icon">
</p>

<h1 align="center">UsageAtlas — Unofficial fork</h1>

<p align="center">
  The UsageAtlas desktop app plus private provider readers,<br>
  so the tools the hosted service does not model yet can still be counted there.
</p>

> **This fork is not affiliated with UsageAtlas.** It is a personal fork of
> [SRX9/UsageAtlas](https://github.com/SRX9/UsageAtlas) and is not endorsed by, supported by, or
> connected to UsageAtlas or its authors. The name only says what it was forked from, and the
> UsageAtlas name and logo remain the original project's (see [TRADEMARKS.md](TRADEMARKS.md)).
> Everything below describes this fork's additions; for the base app — installation on macOS and
> Linux, the full provider list, the design — read the
> [original repository](https://github.com/SRX9/UsageAtlas).

## What this fork changes

- **Private provider readers.** Freebuff reads the Desktop app's per-project `desktop-v2.db`
  (`messages.metrics_json`) for provider-reported input, cached and output tokens per turn, and the
  CLI's chat transcripts for per-message credits as a fallback. Its location is found by scanning,
  verified, cached, and re-planned whenever Freebuff moves or replaces it. The model behind its
  opaque `m-<digest>` id is resolved offline, so Freebuff turns are named and priced at API rates
  instead of reading as free. z.ai / GLM reads the Coding Plan's five-hour and weekly windows from
  the quota API. Neither is part of the original app. See [docs/FREEBUFF.md](docs/FREEBUFF.md) and
  [docs/QUOTA_PROVIDERS.md](docs/QUOTA_PROVIDERS.md).
- **Four more local readers.** Gemini CLI, Qwen Code, Cline and Roo Code keep their own transcripts;
  this fork reads the token objects those files already contain. The survey of how each AI tool
  records usage — including what was researched and deliberately left out — is in
  [docs/PROVIDER_USAGE_SOURCES.md](docs/PROVIDER_USAGE_SOURCES.md).
- **Appearance, in Settings.** A dedicated Appearance tab chooses the font (System, Inter, Manrope,
  Figtree, Jakarta, Geist — all bundled variable fonts), the type scale, the ink colour, the accent
  tint used by buttons and focus rings (theme, ink, cobalt, violet, rose, forest, amber), glass or
  solid card surfaces, whether the interface animates, the app  mark (datamosh, classic or duotone,
  applied to the title bar, window, taskbar and Start Menu shortcut) and the background. Figures print every digit by
  default — `1,284,930`, not `1.3M` — and Settings can switch back to short units; chart axes stay
  short either way because labels would otherwise collide. Pages glide in from the side they were
  reached from, the rail highlight slides between pages, and the home selectors grow under the
  pointer.
- **A daily token alert that works for every source.** Usage alerts now include a token threshold:
  once a source passes it in a local day, a desktop notification says exactly
  `You used 128,400 tokens on Freebuff today.` A test button sends a real notification, and every
  alert is mirrored as an in-app banner, so Focus assist or a per-app Windows switch cannot hide it.
- **Cloud attribution, with a wheel.** The hosted service refuses a provider it does not model, so a
  cloud save containing Freebuff or z.ai usage is rejected. The **Attribution** page maps such a
  source to one or more official providers, each with a share — 30 % Codex, 20 % ChatGPT, 50 %
  Claude, say — and every request spins that wheel, so the uploaded traffic arrives as a realistic
  mix rather than one relabelled tool. The draw is a hash of the request's own identity, so shares
  hold over time, four Codex requests in a row are possible, and a retried or interrupted save never
  renames a request. The uploaded copy is relabelled and renumbered, so the tokens land on the
  account and show up on the dashboard; a source without a rule is kept on this computer and named in
  Settings rather than failing the whole save. Model keys the server publishes are offered per
  provider, and Freebuff's opaque `m-<digest>` ids are shown as the real models behind them.
- **Provider marks.** The unofficial sources carry their own logos — Freebuff's published mark,
  z.ai's, plus the Warp and Factory marks the app already shipped. Provenance and hashes are in
  [apps/desktop/src/renderer/assets/providers/README.md](apps/desktop/src/renderer/assets/providers/README.md).
- **Publisher choice for updates.** Settings → App updates switches between *Unofficial fork*
  (these GitHub releases), *Official app* (the original project's mirror) and *Another repository*
  (any GitHub `owner/name` you name), without a restart.
- **A glitched icon.** The app icon is the original artwork deliberately datamoshed — channel split,
  displaced bands, torn scanlines — so an install of this fork is never mistaken for the official
  build. The mark is applied by the icon pipeline itself (`node tooling/generate-desktop-icons.mjs`),
  which keeps the branding and web copies untouched and regenerates the same bytes on every run.
  Windows and Linux draw their own minimize, maximize and close buttons in the title bar, the way
  Freebuff does; macOS keeps its traffic lights.

## Timeline

![Timeline: every 0.3 release from the Freebuff reader to the 0.3.8 cloud-save and notification fixes, followed by the seven 0.4.0 goals](docs/timeline.svg)

Each shipped card is detailed in [CHANGELOG.md](CHANGELOG.md); the 0.4.0 cards below carry the
acceptance test each one has to meet before it counts as done.

## What 0.4.0 aims for

Concrete, checkable goals for the next minor release. Each one is done only when its acceptance
criterion is met in a build this fork publishes.

- [ ] **Find usage stores for providers nobody mapped yet.** Ship a catalog of at least 250 AI
  providers (name, CLI or app, expected config roots) and, for a provider with no reader, generate
  candidate file names and folders, probe them offline, and propose the store that actually holds
  token counts with a confidence score. Acceptance: an unknown provider added by name is either
  located with a passing schema probe or reported as "no local store found" in under two seconds,
  without network access, and the result survives a move of the config directory.
- [ ] **Compact cloud saves.** Adopt the storage sample the upstream author shares, encode repeated
  model and provider names once per save, and migrate existing saves without losing a request.
  Acceptance: a save that currently uploads 1 MB uploads at most 500 KB with identical restored
  totals, and the migration runs once per account with a rollback path.
- [ ] **Appearance that goes further.** A free accent colour picker, per-section density
  (comfortable / compact), adjustable background dimming, and theme import/export as a small JSON
  file. Acceptance: a theme exported on one computer reproduces the same font, scale, ink, accent,
  surfaces and background on another, and no setting needs a restart.
- [ ] **Attribution per model, with a preview.** Extend the wheel from provider shares to optional
  model shares, and show the distribution a save will produce before it leaves the machine.
  Acceptance: a rule with 30 % Codex / 20 % ChatGPT / 50 % Claude over 1,000 requests lands within
  two percentage points of each share, and the preview matches the uploaded payload exactly.
- [ ] **Updates you can trust.** Background download with a persistent "restart to 0.4.0" badge, a
  one-click rollback to the previously installed build, and a check that never reports "latest" for
  a window older than the build on disk. Acceptance: installing a release while an older window is
  open shows the restart prompt within one check, and rollback returns to the previous version with
  local history intact.
- [ ] **Complete translation.** Every user-facing string in the five catalogs (English, French,
  Spanish, Chinese, Hindi), including cloud, attribution and diagnostics screens. Acceptance: a test
  fails when a catalog key is missing, and a string sweep finds no hard-coded English left in the
  renderer outside diagnostics output.
- [ ] **Cheaper idle.** Acceptance: cold start to first paint under 400 ms on the reference machine
  (Windows 11, 8 cores), under 250 MB resident after one hour idle, and no long task above 50 ms
  when switching pages.

## Why the cloud still works, and what that means

Cloud save talks to the **hosted UsageAtlas service** at `usageatlas.com`. That service is not part
of this repository and this fork has no control over it: an account there, its
[privacy policy](https://usageatlas.com/privacy) and its
[terms](https://usageatlas.com/terms) still apply, and saved history lives under that account.

Attribution is the bridge. Locally nothing is rewritten: Freebuff stays Freebuff in your history,
charts, alerts and totals, with its own models and projects. Only the copy sent to the server is
relabelled, because the server only accepts providers and models it knows. That is deliberately
one-way — the numbers are yours, the label is for the server — and a copy restored on another
computer keeps this computer's real provider and model breakdown.

If you do not want a relabelled copy to leave the machine, stay signed out: local tracking works
without an account, as it always did — and a source with no rule never leaves it either.

## Install

Windows builds are produced from this fork:

1. Open the [latest release](https://github.com/Artleboss2/UsageAtlas-Unofficial/releases/latest).
2. Download `UsageAtlas-<version>.Setup.exe` (per-user install, no administrator prompt) or the
   portable `UsageAtlas-win32-x64-<version>.zip`.
3. Run it. Builds are not Authenticode-signed, so SmartScreen asks for **More info → Run anyway**.

macOS and Linux are not built from this fork. Use the original project's releases, or build the
fork yourself with the commands below; nothing in the additions is Windows-specific.

Every release also carries `SHA256SUMS`, and the Windows ones carry the Squirrel `RELEASES` feed and
`-full.nupkg` next to the installer — that pair is what the in-app updater reads.

## Updates

Settings → App updates chooses the publisher:

- **This fork** reads `github.com/Artleboss2/UsageAtlas-Unofficial/releases/latest/download`. Windows
  installs update in place; on other platforms the release page opens for a manual download.
- **Upstream** restores the original mirror, which only ever serves the official builds.
- **Another repository** reads the GitHub releases of any `owner/name` you type, so a build published
  somewhere else updates in place too. While the field is empty it keeps reading this fork's releases.

Installing an upstream build replaces this fork's renderer, so the private providers disappear until
you reinstall a fork release.

Squirrel keeps each applied build in its own `app-<version>` folder. If an update lands while an
older window is still open, that window's updater would otherwise ask the shared `Update.exe` and
hear "up to date" for the newer package. The app now reads the installed folders, reports the newer
version, and its **Update and restart** button relaunches through the Squirrel stub at the install
root — so the window you keep using is the one actually installed.

## Build from source

Requirements: Bun 1.3.14 and Node.js 22.13+.

```bash
git clone https://github.com/Artleboss2/UsageAtlas-Unofficial.git
cd UsageAtlas-Unofficial
bun ci
bun run desktop:start
```

`bun run check` runs lint, typecheck, tests and the renderer build. `bun run desktop:make` builds
installers for the current platform with Electron Forge; unsigned builds need no credentials.
`bun run desktop:make -- --platform=win32 --arch=x64 --targets squirrel zip` produces the Windows
installer, the update feed and the portable zip, which is how this fork's releases are made.

The repository is a Bun + Turborepo workspace: the Electron app in `apps/desktop`, shared schemas and
fixtures in `packages/contracts`, build helpers in `tooling`.

## Privacy

Provider data is read from local files and provider APIs. Completed days and capacity snapshots go
into a local SQLite history database in the app data directory. Nothing leaves the computer unless
you sign in and save to the cloud, and then only the fields the base app already sends: totals,
estimated costs, hourly activity, model breakdowns, limits, per-request timestamps, model
identifiers, collection metadata and opaque project and session IDs. Project paths, prompts,
responses, transcripts and tool credentials are never included.

## Credits and licence

The base application is MIT-licensed, © 2026 SRX9 and UsageAtlas contributors; this fork's changes
ship under the same [licence](LICENSE) and keep that notice. The UsageAtlas name and logo are not
covered by it — see [TRADEMARKS.md](TRADEMARKS.md). Inspired by
[CodexBar](https://github.com/steipete/codexbar) by Peter Steinberger; charts are vendored from
[Dither Kit](https://tripwire.sh).

Found a bug in an addition described here? Open an issue in
[this repository](https://github.com/Artleboss2/UsageAtlas-Unofficial/issues), not upstream — the
original authors did not write this code.
