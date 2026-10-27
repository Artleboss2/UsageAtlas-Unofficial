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
  verified, cached, and re-planned whenever Freebuff moves or replaces it. z.ai / GLM reads the
  Coding Plan's five-hour and weekly windows from the quota API. Neither is part of the original app.
  See [docs/FREEBUFF.md](docs/FREEBUFF.md) and [docs/QUOTA_PROVIDERS.md](docs/QUOTA_PROVIDERS.md).
- **Cloud attribution.** The hosted service refuses a provider it does not model, so a cloud save
  containing Freebuff or z.ai usage is rejected. The **Attribution** page maps such a source to an
  official provider and a model that provider runs; the uploaded copy is relabelled, so the tokens
  land on the account as Codex, Claude, Kimi or whatever you chose, and show up on the dashboard.
- **Publisher choice for updates.** Settings → App updates switches between *This fork* (these
  GitHub releases) and *Upstream* (the original project's mirror), without a restart.

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
without an account, as it always did.

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

Installing an upstream build replaces this fork's renderer, so the private providers disappear until
you reinstall a fork release.

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
