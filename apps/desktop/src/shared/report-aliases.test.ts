import { describe, expect, it } from "vitest";
import type { CapacityFact, UsageEventFact } from "@usageatlas/contracts/statistics";
import { validateUsageRecord, type CapacitySnapshot, type UsageDay } from "@usageatlas/contracts/usage";
import fixtures from "@usageatlas/contracts/fixtures/usage-record-v1.json";
import {
  aliasFact,
  aliasUsageRecord,
  isOfficialProvider,
  unaliasUsageRecord,
  validateReportAliases
} from "./report-aliases";

function eventFact(overrides: Partial<UsageEventFact> = {}): UsageEventFact {
  return {
    schemaVersion: 1,
    id: "fact-1",
    sourceId: "source-1",
    providerId: "freebuff",
    observedAt: "2026-10-27T09:00:00.000Z",
    kind: "usage_event",
    eventId: "event-1",
    eventIdentity: "source",
    occurredAt: "2026-10-27T09:00:00.000Z",
    timeZone: "Europe/Paris",
    modelKey: "freebuffs-default",
    reportedModel: "freebuffs-default",
    modelProvider: null,
    sessionId: null,
    projectId: null,
    serviceTier: null,
    granularity: "event",
    measurement: "known",
    totals: null,
    rawTokens: {},
    reportedCostUSD: null,
    estimatedCostUSD: null,
    pricingVersion: null,
    parserVersion: "3",
    ...overrides
  };
}

function dayRecord(models: Array<{ modelKey: string; tokens: number }>): UsageDay {
  const record = structuredClone(fixtures[0]) as UsageDay;
  record.providerId = "freebuff";
  record.hourly = null;
  const tokens = models.reduce((total, row) => total + row.tokens, 0);
  record.totals = {
    inputTokens: tokens,
    cachedInputTokens: 0,
    cacheCreationInputTokens: 0,
    outputTokens: 0,
    totalTokens: tokens,
    requests: models.length,
    estimatedCostMicrosUSD: null,
    unpricedTokens: tokens
  };
  record.models = models.map(row => ({
    modelKey: row.modelKey,
    totals: {
      inputTokens: row.tokens,
      cachedInputTokens: 0,
      cacheCreationInputTokens: 0,
      outputTokens: 0,
      totalTokens: row.tokens,
      requests: 1,
      estimatedCostMicrosUSD: null,
      unpricedTokens: row.tokens
    }
  }));
  return validateUsageRecord(record) as UsageDay;
}

describe("cloud reporting aliases", () => {
  it("keeps one rule per source and the first one wins", () => {
    expect(validateReportAliases([
      { source: "zai", reportAs: "claude", model: "claude-sonnet-4-5", extra: "ignored" },
      { source: "zai", reportAs: "codex", model: "gpt-5.3-codex" }
    ])).toEqual([{ source: "zai", reportAs: "claude", model: "claude-sonnet-4-5" }]);
  });

  it("drops rules the server could not accept", () => {
    expect(validateReportAliases([
      { source: "not-a-provider", reportAs: "codex", model: "gpt-5.3-codex" },
      { source: "freebuff", reportAs: "freebuff", model: "gpt-5.3-codex" },
      { source: "freebuff", reportAs: "not-official", model: "gpt-5.3-codex" },
      { source: "freebuff", reportAs: "codex", model: "   " },
      { source: "freebuff", reportAs: "codex", model: "gpt 5 codex" },
      { source: "freebuff", reportAs: "codex", model: "g".repeat(81) },
      null,
      "freebuff"
    ])).toEqual([]);
  });

  it("trims the model and allows a real provider mapping", () => {
    expect(validateReportAliases([{ source: "freebuff", reportAs: "codex", model: " gpt-5.3-codex " }]))
      .toEqual([{ source: "freebuff", reportAs: "codex", model: "gpt-5.3-codex" }]);
  });

  it("knows which providers the cloud models today", () => {
    expect(isOfficialProvider("codex")).toBe(true);
    expect(isOfficialProvider("freebuff")).toBe(false);
    expect(isOfficialProvider("zai")).toBe(false);
  });

  it("relabels an uploaded event without touching its identity", () => {
    const aliases = validateReportAliases([{ source: "freebuff", reportAs: "codex", model: "gpt-5.3-codex" }]);
    const fact = aliasFact(eventFact(), aliases);
    expect(fact).toMatchObject({ id: "fact-1", providerId: "codex", modelKey: "gpt-5.3-codex", reportedModel: "gpt-5.3-codex" });
  });

  it("leaves a source without a rule exactly as it was", () => {
    const aliases = validateReportAliases([{ source: "freebuff", reportAs: "codex", model: "gpt-5.3-codex" }]);
    const untouched = eventFact({ providerId: "claude" });
    expect(aliasFact(untouched, aliases)).toBe(untouched);
    expect(aliasFact(untouched, [])).toBe(untouched);
  });

  it("relabels capacity and collection facts, which carry no model", () => {
    const aliases = validateReportAliases([{ source: "freebuff", reportAs: "codex", model: "gpt-5.3-codex" }]);
    const capacity: CapacityFact = {
      schemaVersion: 1,
      id: "capacity-1",
      sourceId: "source-1",
      providerId: "freebuff",
      observedAt: "2026-10-27T09:00:00.000Z",
      kind: "capacity",
      plan: "other",
      windows: [],
      credits: null
    };
    expect(aliasFact(capacity, aliases)).toEqual({ ...capacity, providerId: "codex" });
  });

  it("collapses the uploaded daily breakdown onto the declared model", () => {
    const aliases = validateReportAliases([{ source: "freebuff", reportAs: "codex", model: "gpt-5.3-codex" }]);
    const local = dayRecord([{ modelKey: "glm-4.6", tokens: 400 }, { modelKey: "freebuffs-default", tokens: 100 }]);
    const uploaded = aliasUsageRecord(local, aliases) as UsageDay;
    expect(uploaded.providerId).toBe("codex");
    expect(uploaded.models).toEqual([{ modelKey: "gpt-5.3-codex", totals: { ...local.models![0].totals, inputTokens: 500, totalTokens: 500, requests: 2, unpricedTokens: 500 } }]);
    expect(local.models).toHaveLength(2);
    expect(local.providerId).toBe("freebuff");
  });

  it("relabels a day without a breakdown and leaves other providers alone", () => {
    const aliases = validateReportAliases([{ source: "freebuff", reportAs: "codex", model: "gpt-5.3-codex" }]);
    const withoutModels = dayRecord([{ modelKey: "glm-4.6", tokens: 10 }]);
    withoutModels.models = null;
    expect(aliasUsageRecord(withoutModels, aliases)).toEqual({ ...withoutModels, providerId: "codex" });
    const other = dayRecord([{ modelKey: "glm-4.6", tokens: 10 }]);
    other.providerId = "zai";
    expect(aliasUsageRecord(other, aliases)).toBe(other);
  });

  it("gives a restored capacity snapshot back its local provider with no invented model", () => {
    const stored: CapacitySnapshot = {
      schemaVersion: 1,
      recordId: "record-1",
      sourceId: "source-1",
      providerId: "freebuff",
      observedAt: "2026-10-27T09:00:00.000Z",
      kind: "capacity_snapshot",
      status: "available",
      planKey: null,
      windows: []
    };
    const fromCloud: CapacitySnapshot = { ...stored, providerId: "codex" };
    const restored = unaliasUsageRecord(fromCloud, stored);
    expect(restored.providerId).toBe("freebuff");
    expect("models" in restored).toBe(false);
  });

  it("gives a restored copy back its local provider and breakdown", () => {
    const aliases = validateReportAliases([{ source: "freebuff", reportAs: "codex", model: "gpt-5.3-codex" }]);
    const local = dayRecord([{ modelKey: "glm-4.6", tokens: 400 }]);
    const fromCloud = aliasUsageRecord(local, aliases);
    const restored = unaliasUsageRecord(fromCloud, local) as UsageDay;
    expect(restored.providerId).toBe("freebuff");
    expect(restored.models).toEqual(local.models);
  });
});
