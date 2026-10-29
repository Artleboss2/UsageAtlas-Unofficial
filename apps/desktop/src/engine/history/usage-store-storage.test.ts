import { afterEach, describe, expect, it } from "vitest";
import { buildAnalytics, type UsageRecord } from "../analytics/local-usage";
import { openWritableSqlite } from "../platform/sqlite";
import { UsageStore } from "./usage-store";
import { identifyFact } from "./statistics-store";
import type { UsageEventFact } from "@usageatlas/contracts/statistics";

const opened: { close(): Promise<void> }[] = [];
afterEach(async () => {
  for (const database of opened.splice(0)) await database.close();
});

function database() {
  const db = openWritableSqlite(":memory:");
  opened.push(db);
  return db;
}

function event(overrides: Partial<UsageRecord> = {}): UsageRecord {
  return {
    timestamp: "2026-09-23T02:00:00Z",
    day: "2026-09-23",
    model: "gpt-5.3-codex",
    sessionID: "session",
    projectPath: "C:/project",
    projectLabel: "project",
    serviceTier: "default",
    inputTokens: 50,
    cachedInputTokens: 20,
    cacheCreationInputTokens: 10,
    outputTokens: 20,
    totalTokens: 100,
    estimatedCostUSD: 0.0001,
    eventKey: "request-1",
    ...overrides
  };
}

function analytics(updatedAt = "2026-09-23T12:00:00Z") {
  return buildAnalytics([event()], new Date(updatedAt), 90, 1, false, "local_sessions", undefined, undefined, "UTC");
}

describe("compact local ledger", () => {
  it("no longer creates the write-only archive table", () => {
    const db = database();
    new UsageStore(db);
    expect(db.all("SELECT name FROM sqlite_master WHERE name = 'usage_record_history'")).toEqual([]);
  });

  it("keeps one collection fact per source and day instead of one per scan", () => {
    const db = database();
    const store = new UsageStore(db);
    for (const hour of ["2026-09-23T10:00:00Z", "2026-09-23T11:00:00Z", "2026-09-23T12:00:00Z"]) {
      store.statistics.collect("codex", "local", "replica", analytics(hour));
    }
    const rows = db.all("SELECT kind, occurred_at FROM usage_fact WHERE kind = 'collection'");
    expect(rows).toHaveLength(1);
    expect(rows[0].occurred_at).toBe("2026-09-23T12:00:00.000Z");
  });

  it("keeps only the newest capacity snapshot per source", () => {
    const db = database();
    const store = new UsageStore(db);
    const live = {
      source: "local_sessions" as const,
      updatedAt: "2026-09-23T10:00:00Z",
      analytics: null,
      identity: { plan: "pro" },
      windows: [{ kind: "weekly" as const, label: "Weekly", usedPercent: 10, remainingPercent: 90 }],
      credits: null
    };
    store.statistics.capacity("codex", "local", "replica", live);
    store.statistics.capacity("codex", "local", "replica", { ...live, updatedAt: "2026-09-23T11:00:00Z" });
    const rows = db.all("SELECT occurred_at FROM usage_fact WHERE kind = 'capacity'");
    expect(rows).toEqual([{ occurred_at: "2026-09-23T11:00:00Z" }]);
  });

  it("drops saved events past the window but remembers their content", () => {
    const db = database();
    const store = new UsageStore(db);
    store.selectAccount("a");
    const fact = [...store.statistics.observations("codex", "local", "replica", analytics())][0] as UsageEventFact;
    store.statistics.put(fact, true);
    db.run("UPDATE usage_fact SET occurred_at = '2026-01-01T00:00:00Z' WHERE id = ?", [fact.id]);

    expect(store.statistics.compact(new Date("2026-09-23T12:00:00Z").getTime())).toBe(1);
    expect(db.all("SELECT id FROM usage_fact WHERE kind = 'usage_event'")).toEqual([]);
    expect(db.get("SELECT COUNT(*) AS count FROM usage_event_seen")?.count).toBe(1);

    // The same observation seen again is not stored or uploaded a second time.
    store.statistics.put(fact);
    expect(db.all("SELECT id FROM usage_fact WHERE kind = 'usage_event'")).toEqual([]);
    expect(store.statistics.pending()).toEqual([]);
    expect(identifyFact(fact).id).toBe(fact.id);
  });
});
