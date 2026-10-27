import type {
  StoredTotals,
  UsageProvider,
  UsageRecord
} from "@usageatlas/contracts/usage";
import type { UsageFact } from "@usageatlas/contracts/statistics";

/**
 * Reporting aliases let a source the server does not know yet (`freebuff`,
 * `zai`, …) still show up in the cloud save: locally the usage keeps its real
 * provider, while the payload that leaves the machine is relabelled as an
 * official provider with a model the user picks.
 *
 * Only the uploaded copy is rewritten. Nothing in the local history changes,
 * and a restore still brings back whatever the server stored.
 */
export interface ReportAlias {
  /** Local provider whose usage is rewritten. */
  source: UsageProvider;
  /** Official provider the server should attribute it to. */
  reportAs: UsageProvider;
  /** Model key the server should see. */
  model: string;
}

export const OFFICIAL_PROVIDERS = [
  "codex",
  "claude",
  "cursor",
  "opencode",
  "antigravity",
  "pi",
  "muse",
  "warp",
  "kimi",
  "kilo",
  "copilot",
  "factory",
  "amp",
  "qoder"
] as const satisfies readonly UsageProvider[];

export type OfficialProvider = (typeof OFFICIAL_PROVIDERS)[number];

const ALL_PROVIDERS = new Set<string>([
  ...OFFICIAL_PROVIDERS,
  "freebuff",
  "zai"
]);

const MAX_MODEL_LENGTH = 80;

export function isOfficialProvider(value: unknown): value is OfficialProvider {
  return typeof value === "string" && (OFFICIAL_PROVIDERS as readonly string[]).includes(value);
}

/** Keeps one rule per source, drops unknown providers and blank models. */
export function validateReportAliases(value: unknown): ReportAlias[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const aliases: ReportAlias[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const record = item as Record<string, unknown>;
    const source = record.source;
    const reportAs = record.reportAs;
    const model = typeof record.model === "string" ? record.model.trim() : "";
    if (typeof source !== "string" || !ALL_PROVIDERS.has(source)) continue;
    if (!isOfficialProvider(reportAs)) continue;
    if (source === reportAs) continue;
    if (!model || model.length > MAX_MODEL_LENGTH || !/^[A-Za-z0-9._:/-]+$/u.test(model)) continue;
    if (seen.has(source)) continue;
    seen.add(source);
    aliases.push({ source: source as UsageProvider, reportAs, model });
  }
  return aliases;
}

export function aliasFor(aliases: readonly ReportAlias[], provider: string): ReportAlias | null {
  return aliases.find(alias => alias.source === provider) ?? null;
}

/** Rewrites one statistics fact for upload; the id is preserved so acknowledgements still match. */
export function aliasFact(fact: UsageFact, aliases: readonly ReportAlias[]): UsageFact {
  const alias = aliasFor(aliases, fact.providerId);
  if (!alias) return fact;
  if (fact.kind !== "usage_event") return { ...fact, providerId: alias.reportAs };
  return {
    ...fact,
    providerId: alias.reportAs,
    modelKey: alias.model,
    reportedModel: alias.model
  };
}

/**
 * Rewrites one history record for upload. Daily model breakdowns collapse onto
 * the declared model so the server does not receive an unknown model key; the
 * local record keeps its real provider and its real breakdown.
 */
export function aliasUsageRecord(record: UsageRecord, aliases: readonly ReportAlias[]): UsageRecord {
  const alias = aliasFor(aliases, record.providerId);
  if (!alias) return record;
  if (record.kind !== "usage_day" || !record.models || record.models.length === 0) {
    return { ...record, providerId: alias.reportAs };
  }
  return {
    ...record,
    providerId: alias.reportAs,
    models: [{ modelKey: alias.model, totals: sumTotals(record.models.map(row => row.totals)) }]
  };
}

/**
 * Puts a cloud copy back on the local provider it came from, so a relabelled upload
 * never renames the row counted on this computer.
 */
export function unaliasUsageRecord(record: UsageRecord, local: UsageRecord): UsageRecord {
  if (record.providerId === local.providerId) return record;
  if (record.kind === "usage_day" && local.kind === "usage_day")
    return { ...record, providerId: local.providerId, models: local.models };
  return { ...record, providerId: local.providerId };
}

function sumTotals(rows: StoredTotals[]): StoredTotals {
  const priced = rows.filter(row => row.estimatedCostMicrosUSD !== null);
  return {
    inputTokens: sum(rows, row => row.inputTokens),
    cachedInputTokens: sum(rows, row => row.cachedInputTokens),
    cacheCreationInputTokens: sum(rows, row => row.cacheCreationInputTokens),
    outputTokens: sum(rows, row => row.outputTokens),
    totalTokens: sum(rows, row => row.totalTokens),
    requests: sum(rows, row => row.requests),
    estimatedCostMicrosUSD: priced.length === 0 ? null : sum(priced, row => row.estimatedCostMicrosUSD ?? 0),
    unpricedTokens: sum(rows, row => row.unpricedTokens)
  };
}

function sum(rows: StoredTotals[], pick: (row: StoredTotals) => number): number {
  return rows.reduce((total, row) => total + pick(row), 0);
}
