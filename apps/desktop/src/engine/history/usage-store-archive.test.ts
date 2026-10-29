import { afterEach, describe, expect, it } from "vitest";
import { openWritableSqlite } from "../platform/sqlite";
import { UsageStore } from "./usage-store";
import { validateUsageRecord, type UsageDay } from "@usageatlas/contracts/usage";
import fixtures from "@usageatlas/contracts/fixtures/usage-record-v1.json";

const opened: { close(): Promise<void> }[] = [];
afterEach(async () => {
  for (const database of opened.splice(0)) await database.close();
});

function database() {
  const db = openWritableSqlite(":memory:");
  opened.push(db);
  return db;
}

function archive(db: ReturnType<typeof database>, id: string, from: number, count: number): void {
  for (let index = from; index < from + count; index += 1) {
    db.run("INSERT INTO usage_record_history VALUES (?,?,?,?,?,?)", [
      "", id, `fingerprint-${index}`, "{}", null,
      new Date(Date.UTC(2026, 8, 1, 0, index)).toISOString()
    ]);
  }
}

function day(tokens: number): UsageDay {
  const record = structuredClone(fixtures[0]) as UsageDay;
  record.hourly = null;
  record.models = null;
  record.totals = {
    inputTokens: tokens,
    cachedInputTokens: 0,
    cacheCreationInputTokens: 0,
    outputTokens: 0,
    totalTokens: tokens,
    requests: 1,
    estimatedCostMicrosUSD: null,
    unpricedTokens: tokens
  };
  return validateUsageRecord(record) as UsageDay;
}

describe("local archive bounds", () => {
  it("keeps the newest archived versions per record when the store opens", () => {
    const db = database();
    new UsageStore(db);
    archive(db, "record-1", 0, 25);
    archive(db, "record-2", 100, 3);

    new UsageStore(db);

    const kept = db.all("SELECT id, fingerprint FROM usage_record_history ORDER BY id, archived_at");
    expect(kept.filter(row => row.id === "record-1")).toHaveLength(20);
    expect(kept.filter(row => row.id === "record-2")).toHaveLength(3);
    // The oldest five are gone and the newest version is still there.
    expect(kept.find(row => row.id === "record-1")?.fingerprint).toBe("fingerprint-5");
    expect(kept.filter(row => row.id === "record-1").at(-1)?.fingerprint).toBe("fingerprint-24");
  });

  it("bounds the archive while the app keeps writing, not only on the next launch", () => {
    const db = database();
    const store = new UsageStore(db);
    for (let tokens = 1; tokens <= 25; tokens += 1) store.put(day(tokens));

    expect(db.get("SELECT COUNT(*) AS count FROM usage_record_history")?.count).toBe(20);
  });
});
