# Freebuff token usage

Freebuff is two surfaces sharing one runtime:

- **Freebuff Desktop** writes provider-reported token counts to a per-project SQLite database.
- **The Freebuff CLI** writes chat transcripts that record charged `credits`, not tokens.

UsageAtlas reads the Desktop database first. Only when no Desktop database exists does it fall back to the CLI's per-message credits.

## Exact location (Desktop)

```
~/.config/freebuff-desktop/
  state.json                         # login/session state
  projects/
    <slug>-<projectId>/
      project.json                   # version, projectId, projectPath, database
      desktop-v2.db                  # SQLite: projects, threads, messages
```

`$FREEBUFF_CONFIG_DIR` replaces `~/.config/freebuff-desktop` when set. The reader rejects a relative path instead of scanning the working directory.

The path is per-user, not per-OS: on Windows it is `%USERPROFILE%\.config\freebuff-desktop`, and on macOS it is `~/.config/freebuff-desktop` (not `~/Library/Application Support`).

## Exact location (tokens)

Tokens live in **`desktop-v2.db`**, table **`messages`**, column **`metrics_json`**:

```sql
SELECT ts, metrics_json
FROM messages
WHERE ts >= <three days ago, epoch ms>;
```

`metrics_json` is a JSON object. Token usage is under `usage`:

```json
{
  "usage": {
    "inputTokens": 12480,
    "cachedInputTokens": 9000,
    "outputTokens": 830,
    "reasoningOutputTokens": 120,
    "totalTokens": 13310
  },
  "context": { "usedTokens": 18200, "windowTokens": 200000 },
  "compactions": []
}
```

- `usage` is the **delta for that assistant turn**, not a running total. Summing the rows gives the thread's cumulative usage.
- `cachedInputTokens` is already inside `inputTokens`; do not add it.
- `reasoningOutputTokens` is already inside `outputTokens`; do not add it.
- `totalTokens` is normally `inputTokens + outputTokens`. When it is absent or zero, UsageAtlas computes that sum.
- `context.usedTokens` is current context occupancy, not cumulative usage. It is not counted.
- `messages.ts` is epoch milliseconds. UsageAtlas buckets rows by the account's reporting time zone and only sums today's rows.

UsageAtlas reports three counters in Limits → Reported allowances and balances:

- **Tokens used today** (`usage.totalTokens`)
- **Input tokens today** (`usage.inputTokens`)
- **Output tokens today** (`usage.outputTokens`)

## CLI fallback (credits, not tokens)

The CLI keeps one JSON transcript per chat:

```
~/.config/manicode/projects/<project>/chats/<chatId>/
  chat-messages.json                 # per-message credits
  run-state.json                     # model/context/credits state
  log.jsonl
```

`chat-messages.json` records `credits` on completed assistant messages. It has **no token fields**, and `credits` is `0` in Free Mode. `run-state.json` has `sessionState.mainAgentState.contextTokenCount` (context occupancy, not cumulative tokens) and `creditsUsed`. Therefore the CLI fallback can only show "Credits used today"; it cannot produce token totals.

The reader also looks in `~/.config/manicode-dev`, `~/.config/Freebuff`, `~/.local/share/freebuff`, the `APPDATA` and `XDG_CONFIG_HOME` equivalents, and the macOS Application Support folders.

## What is not stored locally

The **Freebucks** daily allowance, wallet balance, and reset time are server-side. They come from Freebuff's authenticated session endpoint (`/api/v1/freebuff/session`), not from any app-data file. `state.json` holds the login state needed for that request, but no balance. UsageAtlas does not read `state.json` and does not display a Freebucks balance.

## Read safety and bounds

- The database is opened read-only (`DatabaseSync(..., { readOnly: true })`), so a running Desktop app is not disturbed.
- Discovery visits only `<config>/projects/<project>/desktop-v2.db`; symbolic links are skipped.
- At most 64 project databases and 100,000 metric rows per database are scanned; rows older than three days are excluded in SQL.
- A locked, malformed, or unreadable database is skipped; other projects still count.
- No Freebuff file is written, repaired, or locked.

## Verification

Automated tests cover token summing from `metrics_json`, day and time-zone bucketing, ignoring cached/reasoning duplicates, malformed or zero rows, the CLI credit fallback, source availability, the absolute config override, and the relative-path rejection. Validation against a real recorded Freebuff Desktop database remains pending: the fixtures reproduce the schema found in Freebuff Desktop 0.0.192, not a user's account history.
