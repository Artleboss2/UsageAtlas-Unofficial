import { readFile, stat } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import type { ProviderAdapter, ProviderContext } from "../provider";
import { metric, reading } from "./quota-shared";
import { resolveFreebuffSources, type FreebuffPathOptions, type FreebuffSources } from "./freebuff-paths";

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_BYTES = 32 * 1024 * 1024;
const MAX_METRIC_ROWS = 100_000;
const RECENT_DAYS = 3;

export interface FreebuffOptions extends FreebuffPathOptions {
  maxBytes?: number;
}

interface TokenTotals {
  input: number;
  output: number;
  total: number;
}

/**
 * Freebuff Desktop stores provider-reported token usage in a per-project SQLite
 * database (`messages.metrics_json`), and the CLI stores per-message `credits`
 * in chat transcripts. Which folders hold them, and whether they moved or
 * changed, is decided by the dynamic route planner in `freebuff-paths`:
 * a working route is saved and reused, and re-planned as soon as it stops
 * verifying.
 *
 * Inside the database, each assistant row carries the delta for that turn:
 *
 *   {"usage":{"inputTokens":100,"cachedInputTokens":40,"outputTokens":20,
 *             "reasoningOutputTokens":0,"totalTokens":120}}
 *
 * `cachedInputTokens` is a subset of `inputTokens`; `reasoningOutputTokens` is a
 * subset of `outputTokens`. The CLI has no such database: it only records
 * `credits`, so tokens are reported when the Desktop database exists and
 * credits otherwise.
 */
export function createFreebuffAdapter(options: FreebuffOptions = {}): ProviderAdapter {
  const pathOptions: FreebuffPathOptions = {
    environment: options.environment,
    homeDirectory: options.homeDirectory,
    cacheFile: options.cacheFile,
    maxDatabases: options.maxDatabases,
    maxChatFiles: options.maxChatFiles
  };
  const locate = (now: Date, signal?: AbortSignal, force = false): Promise<FreebuffSources> =>
    resolveFreebuffSources(pathOptions, now, signal, force);
  return {
    id: "freebuff",
    name: "Freebuff",
    isAvailable: async () =>
      locate(new Date()).then(sources => sources.databases.length > 0 || sources.chats.length > 0, () => false),
    async refresh(context) {
      const timeZone = context.reportingTimeZoneForAccount?.("local");
      const today = localDay(context.now.toISOString(), timeZone);
      const cutoff = context.now.valueOf() - RECENT_DAYS * 86_400_000;

      let sources = await locate(context.now, context.signal);
      let tokens = await readDesktopTokens(sources.databases, context.signal, today, timeZone, cutoff);
      if (!tokens && sources.route === "cached") {
        // The saved route verified a moment ago but no longer opens (moved,
        // replaced, or locked). Plan a new route and try that one once.
        sources = await locate(context.now, context.signal, true);
        tokens = await readDesktopTokens(sources.databases, context.signal, today, timeZone, cutoff);
      }
      if (tokens) {
        const metrics = [
          metric("tokens_today", "Tokens used today", "tokens", tokens.total, null, null, null),
          metric("input_tokens_today", "Input tokens today", "tokens", tokens.input, null, null, null),
          metric("output_tokens_today", "Output tokens today", "tokens", tokens.output, null, null, null)
        ];
        return {
          ...reading("Freebuff", metrics),
          accountKey: "local",
          source: "local_sessions",
          analytics: null,
          error: null,
          updatedAt: context.now.toISOString()
        };
      }

      // CLI fallback: `credits` is 0 in free mode, so this counter can legitimately
      // report zero until Desktop writes a token-bearing database.
      const credits = await readChatCredits(sources.chats, context, options, today, timeZone, cutoff);
      const todayCredits = metric("credits_today", "Credits used today", "credits", credits, null, null, null);
      return {
        ...reading("Freebuff", [todayCredits]),
        accountKey: "local",
        source: "local_sessions",
        analytics: null,
        error: null,
        updatedAt: context.now.toISOString()
      };
    }
  };
}

async function readDesktopTokens(
  databases: string[],
  signal: AbortSignal,
  today: string | null,
  timeZone: string | undefined,
  cutoff: number
): Promise<TokenTotals | null> {
  if (!today) return null;
  let opened = false;
  const totals: TokenTotals = { input: 0, output: 0, total: 0 };
  for (const file of databases) {
    signal.throwIfAborted();
    let database: DatabaseSync;
    try {
      database = new DatabaseSync(file, { readOnly: true, timeout: 1_000 });
    } catch {
      continue;
    }
    opened = true;
    try {
      const rows = database
        .prepare("SELECT ts, metrics_json FROM messages WHERE role = 'assistant' AND ts >= ? LIMIT ?")
        .all(cutoff, MAX_METRIC_ROWS) as Array<{ ts?: unknown; metrics_json?: unknown }>;
      for (const row of rows) {
        if (typeof row.ts !== "number" || typeof row.metrics_json !== "string") continue;
        if (localDay(new Date(row.ts).toISOString(), timeZone) !== today) continue;
        const usage = tokenUsage(row.metrics_json);
        if (!usage) continue;
        totals.input = Math.min(totals.input + usage.input, Number.MAX_SAFE_INTEGER);
        totals.output = Math.min(totals.output + usage.output, Number.MAX_SAFE_INTEGER);
        totals.total = Math.min(totals.total + usage.total, Number.MAX_SAFE_INTEGER);
      }
    } catch {
      // A locked or malformed database is skipped; other projects still count.
    } finally {
      try { database.close(); } catch { /* already closed */ }
    }
  }
  return opened ? totals : null;
}

async function readChatCredits(
  chats: string[],
  context: ProviderContext,
  options: FreebuffOptions,
  today: string | null,
  timeZone: string | undefined,
  cutoff: number
): Promise<number> {
  if (!today) return 0;
  let credits = 0;
  let readBytes = 0;
  for (const file of chats) {
    context.signal.throwIfAborted();
    let info;
    try { info = await stat(file); } catch { continue; }
    if (!info.isFile() || info.size > MAX_FILE_BYTES) continue;
    if (info.mtimeMs < cutoff) continue;
    if (readBytes + info.size > (options.maxBytes ?? MAX_TOTAL_BYTES)) continue;
    readBytes += info.size;
    let messages: unknown;
    try { messages = JSON.parse(await readFile(file, "utf8")) as unknown; } catch { continue; }
    if (!Array.isArray(messages)) continue;
    for (const value of messages) {
      if (!value || typeof value !== "object" || Array.isArray(value)) continue;
      const message = value as Record<string, unknown>;
      const charged = message.credits;
      if (typeof charged !== "number" || !Number.isFinite(charged) || charged < 0) continue;
      if (typeof message.timestamp !== "string" || localDay(message.timestamp, timeZone) !== today) continue;
      credits = Math.min(credits + charged, Number.MAX_SAFE_INTEGER);
    }
  }
  return credits;
}

function tokenUsage(json: string): TokenTotals | null {
  let metrics: unknown;
  try { metrics = JSON.parse(json) as unknown; } catch { return null; }
  if (!metrics || typeof metrics !== "object" || Array.isArray(metrics)) return null;
  const usage = (metrics as Record<string, unknown>).usage;
  if (!usage || typeof usage !== "object" || Array.isArray(usage)) return null;
  const record = usage as Record<string, unknown>;
  const input = tokenCount(record.inputTokens);
  const output = tokenCount(record.outputTokens);
  const reported = tokenCount(record.totalTokens);
  const total = reported > 0 ? reported : Math.min(input + output, Number.MAX_SAFE_INTEGER);
  if (input === 0 && output === 0 && total === 0) return null;
  return { input, output, total };
}

function tokenCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 && value <= Number.MAX_SAFE_INTEGER
    ? Math.floor(value)
    : 0;
}

function localDay(timestamp: string, timeZone?: string): string | null {
  const time = Date.parse(timestamp);
  if (!Number.isFinite(time)) return null;
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone, year: "numeric", month: "2-digit", day: "2-digit"
    }).format(time);
  } catch {
    return null;
  }
}
