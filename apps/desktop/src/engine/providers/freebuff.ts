import { lstat, readdir, readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { ProviderAdapter } from "../provider";
import { ProviderError } from "../provider";
import { metric, reading } from "./quota-shared";

const CHAT_FILE = "chat-messages.json";
const DESKTOP_DATABASE = "desktop-v2.db";
const MAX_ENTRIES = 20_000;
const MAX_FILES = 200;
const MAX_DATABASES = 64;
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_BYTES = 32 * 1024 * 1024;
const MAX_METRIC_ROWS = 100_000;
const RECENT_DAYS = 3;

export interface FreebuffOptions {
  environment?: NodeJS.ProcessEnv;
  homeDirectory?: string;
  maxFiles?: number;
  maxDatabases?: number;
  maxBytes?: number;
}

interface TokenTotals {
  input: number;
  output: number;
  total: number;
}

/**
 * Freebuff Desktop stores provider-reported token usage in a per-project SQLite
 * database: `~/.config/freebuff-desktop/projects/<slug>-<projectId>/desktop-v2.db`.
 * Each assistant row in `messages` carries `metrics_json`, and its `usage`
 * object is the delta for that turn:
 *
 *   {"usage":{"inputTokens":100,"cachedInputTokens":40,"outputTokens":20,
 *             "reasoningOutputTokens":0,"totalTokens":120}}
 *
 * `cachedInputTokens` is a subset of `inputTokens`; `reasoningOutputTokens` is a
 * subset of `outputTokens`. The CLI has no such database: its
 * `chat-messages.json` only records per-message `credits`, so that remains the
 * fallback when no Desktop database exists.
 */
export function createFreebuffAdapter(options: FreebuffOptions = {}): ProviderAdapter {
  const environment = options.environment ?? process.env;
  const home = options.homeDirectory ?? homedir();
  return {
    id: "freebuff",
    name: "Freebuff",
    isAvailable: async () => {
      const [databases, chats] = await Promise.all([
        listDesktopDatabases(environment, home, options).catch(() => []),
        listChatFiles(environment, home, options).catch(() => [])
      ]);
      return databases.length > 0 || chats.length > 0;
    },
    async refresh(context) {
      const timeZone = context.reportingTimeZoneForAccount?.("local");
      const today = localDay(context.now.toISOString(), timeZone);
      const cutoff = context.now.valueOf() - RECENT_DAYS * 86_400_000;
      const tokens = await readDesktopTokens(environment, home, options, context.signal, today, timeZone, cutoff);
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
      const files = await listChatFiles(environment, home, options, cutoff);
      let credits = 0;
      let readBytes = 0;
      for (const file of files.slice(0, options.maxFiles ?? MAX_FILES)) {
        context.signal.throwIfAborted();
        let size: number;
        try { size = (await stat(file)).size; } catch { continue; }
        if (size > MAX_FILE_BYTES || readBytes + size > (options.maxBytes ?? MAX_TOTAL_BYTES)) continue;
        readBytes += size;
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

/** Config roots used by the Freebuff Desktop app and the CLI. */
export function freebuffDataRoots(environment: NodeJS.ProcessEnv, home: string): string[] {
  const configured = environment.FREEBUFF_CONFIG_DIR?.trim();
  if (configured) {
    if (!path.isAbsolute(configured))
      throw new ProviderError("config_invalid", "FREEBUFF_CONFIG_DIR must be an absolute path.");
    return [path.normalize(configured)];
  }
  const roots = [
    path.join(home, ".config", "freebuff-desktop"),
    path.join(home, ".config", "manicode"),
    path.join(home, ".config", "manicode-dev"),
    path.join(home, ".config", "Freebuff"),
    path.join(home, ".local", "share", "freebuff"),
    path.join(home, "Library", "Application Support", "freebuff-desktop"),
    path.join(home, "Library", "Application Support", "manicode"),
    path.join(home, "Library", "Application Support", "Freebuff")
  ];
  if (environment.XDG_CONFIG_HOME) roots.push(
    path.join(environment.XDG_CONFIG_HOME, "freebuff-desktop"),
    path.join(environment.XDG_CONFIG_HOME, "manicode"),
    path.join(environment.XDG_CONFIG_HOME, "Freebuff")
  );
  if (environment.APPDATA) roots.push(
    path.join(environment.APPDATA, "freebuff-desktop"),
    path.join(environment.APPDATA, "manicode"),
    path.join(environment.APPDATA, "Freebuff"),
    path.join(environment.APPDATA, "freebuff")
  );
  return [...new Set(roots.map(root => path.normalize(root)))];
}

async function readDesktopTokens(
  environment: NodeJS.ProcessEnv,
  home: string,
  options: FreebuffOptions,
  signal: AbortSignal,
  today: string | null,
  timeZone: string | undefined,
  cutoff: number
): Promise<TokenTotals | null> {
  if (!today) return null;
  const databases = await listDesktopDatabases(environment, home, options);
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

/** Project databases live exactly one level below `<config>/projects`. */
async function listDesktopDatabases(environment: NodeJS.ProcessEnv, home: string, options: FreebuffOptions): Promise<string[]> {
  const files: string[] = [];
  for (const root of freebuffDataRoots(environment, home)) {
    let projects;
    try { projects = await readdir(path.join(root, "projects"), { withFileTypes: true }); } catch { continue; }
    for (const project of projects) {
      if (!project.isDirectory()) continue;
      const database = path.join(root, "projects", project.name, DESKTOP_DATABASE);
      try {
        const info = await lstat(database);
        if (info.isFile() && info.size > 0) files.push(database);
      } catch { continue; }
      if (files.length >= (options.maxDatabases ?? MAX_DATABASES)) return files;
    }
  }
  return files;
}

/**
 * Bounded discovery of CLI chat transcripts. Symlinks are skipped so a link
 * cannot pull an unrelated directory into the scan.
 */
async function listChatFiles(environment: NodeJS.ProcessEnv, home: string, options: FreebuffOptions, modifiedAfter?: number): Promise<string[]> {
  const files: string[] = [];
  let entries = 0;
  const pending = freebuffDataRoots(environment, home).map(root => ({ directory: root, depth: 0 }));
  while (pending.length && files.length < (options.maxFiles ?? MAX_FILES) && entries < MAX_ENTRIES) {
    const { directory, depth } = pending.shift()!;
    let children;
    try { children = await readdir(directory, { withFileTypes: true }); } catch { continue; }
    entries += children.length;
    for (const child of children) {
      if (child.isSymbolicLink()) continue;
      const location = path.join(directory, child.name);
      if (child.isDirectory()) {
        if (depth < 5) pending.push({ directory: location, depth: depth + 1 });
      } else if (child.isFile() && child.name === CHAT_FILE) {
        if (modifiedAfter !== undefined) {
          try { if ((await stat(location)).mtimeMs < modifiedAfter) continue; } catch { continue; }
        }
        files.push(location);
        if (files.length >= (options.maxFiles ?? MAX_FILES)) break;
      }
    }
  }
  return files;
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
