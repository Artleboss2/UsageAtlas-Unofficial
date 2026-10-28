import { afterEach, describe, expect, it } from "vitest";
import { openWritableSqlite } from "../platform/sqlite";
import { UsageStore } from "./usage-store";
import { UsageSync, type UsageCloud } from "./usage-sync";
import {
  sameUsage,
  validateUsageRecord,
  type CloudRecord,
  type PendingRecord,
  type UsageDay,
  type UsageProvider
} from "@usageatlas/contracts/usage";
import fixtures from "@usageatlas/contracts/fixtures/usage-record-v1.json";

const resources: Array<() => void> = [];
afterEach(() => {
  for (const close of resources.splice(0).reverse()) close();
});

function openStore() {
  const db = openWritableSqlite(":memory:");
  resources.push(() => db.close());
  return new UsageStore(db);
}

function day(tokens: number, providerId: UsageProvider = "freebuff"): UsageDay {
  const record = structuredClone(fixtures[0]) as UsageDay;
  record.providerId = providerId;
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

/** A day whose model breakdown carries the whole daily total, like a real local record. */
function withModel(record: UsageDay): UsageDay {
  return { ...record, models: [{ modelKey: "deepseek-v4-flash", totals: record.totals! }] };
}

function cloudWith(rows: CloudRecord[]): UsageCloud {
  return {
    async read() {
      return { records: rows, next: null };
    },
    async save(sent: PendingRecord[]) {
      return sent.map(row => ({ ...row, status: "saved" as const }));
    }
  };
}

describe("cloud copies of renamed days", () => {
  it("adopts the label and revision of a cloud copy instead of building a hybrid", async () => {
    const store = openStore();
    store.selectAccount("a");
    const local = withModel(day(200));
    store.put(local);
    // The server still holds this machine's earlier copy of the day: same record
    // id, smaller totals, and the label it was reported under.
    const remote = { record: { ...day(50, "codex"), recordId: local.recordId, models: null }, revision: 3 };
    const sync = new UsageSync(store);
    resources.push(() => sync.close());
    await sync.configure("a", cloudWith([remote]));
    sync.setAutomatic(false);
    sync.setReportPlans([{ source: "freebuff", targets: [{ reportAs: "claude", model: "claude-fable-5", weight: 100 }] }]);

    await sync.restore();

    const stored = store.get(local.recordId)!;
    // Nothing to choose: the local row is this machine's newer copy of that day.
    expect(stored.conflict).toBeNull();
    expect(stored.revision).toBe(3);
    expect(stored.record.kind === "usage_day" ? stored.record.totals : null).toMatchObject({ totalTokens: 200 });
    // The label the server already holds wins over today's wheel.
    expect(store.attribution(`record:${local.recordId}`)).toBe("codex|");
    expect(store.counts().invalid).toBe(0);
    expect(store.records()).toHaveLength(1);
  });

  it("still restores the local breakdown when the cloud copy counts the same usage", async () => {
    const store = openStore();
    store.selectAccount("a");
    const local = withModel(day(200));
    store.put(local);
    const remote = { record: { ...day(200, "codex"), recordId: local.recordId, models: null }, revision: 1 };
    const sync = new UsageSync(store);
    resources.push(() => sync.close());
    await sync.configure("a", cloudWith([remote]));
    sync.setAutomatic(false);
    sync.setReportPlans([{ source: "freebuff", targets: [{ reportAs: "codex", model: "gpt-5.3-codex", weight: 100 }] }]);

    await sync.restore();

    const stored = store.get(local.recordId);
    expect(stored?.record.providerId).toBe("freebuff");
    expect(stored?.conflict).toBeNull();
    expect(stored?.record.kind === "usage_day" ? stored.record.models : undefined).toEqual(local.models);
  });
});

describe("records an older build left invalid", () => {
  it("drops the unreadable cloud copy and makes the local record uploadable again", () => {
    const store = openStore();
    store.selectAccount("a");
    const local = day(100);
    store.put(local);
    // Exactly what the buggy merge stored: local model totals (200) on a 100-token day.
    const hybrid = { ...day(100, "codex"), recordId: local.recordId, models: withModel(day(200)).models };
    expect(() => validateUsageRecord(hybrid)).toThrow("Breakdowns exceed daily usage.");
    store.db.run("UPDATE usage_record SET conflict = ?, save_error = ? WHERE id = ?", [
      JSON.stringify({ record: hybrid, revision: 1 }),
      "Invalid local usage record",
      local.recordId
    ]);
    // Reading no longer loses the row to its unreadable cloud copy…
    expect(store.records().map(row => row.record.recordId)).toEqual([local.recordId]);
    // …but it stays out of the next save until the stale flag is cleared.
    expect(store.counts().invalid).toBe(1);
    expect(store.pending()).toEqual([]);

    const reopened = new UsageStore(store.db);

    expect(reopened.get(local.recordId)?.conflict).toBeNull();
    expect(reopened.counts().invalid).toBe(0);
    expect(reopened.records().map(row => row.record.recordId)).toEqual([local.recordId]);
    expect(reopened.pending().map(row => row.record.recordId)).toEqual([local.recordId]);
  });

  it("keeps a record whose own payload is unreadable flagged for recovery", () => {
    const store = openStore();
    store.selectAccount("a");
    const local = day(100);
    store.put(local);
    store.db.run("UPDATE usage_record SET payload = ?, save_error = ? WHERE id = ?", [
      "{not-json",
      "Invalid local usage record",
      local.recordId
    ]);

    const reopened = new UsageStore(store.db);

    expect(reopened.get(local.recordId)).toBeNull();
    expect(reopened.counts().invalid).toBe(1);
    expect(reopened.pending()).toEqual([]);
  });

  it("retries a conflict under the label the server holds instead of stalling", async () => {
    const store = openStore();
    store.selectAccount("a");
    const local = withModel(day(200));
    store.put(local);
    const remoteRecord = { ...day(50, "claude"), recordId: local.recordId, models: null };
    // Like the real server: another label for a record it already holds conflicts,
    // while the label it holds is accepted and stored as the next revision.
    let revision = 4;
    const cloud: UsageCloud = {
      async read() {
        return { records: [], next: null };
      },
      async save(sent) {
        return sent.map(row => {
          if (row.record.providerId !== remoteRecord.providerId)
            return { record: remoteRecord, revision, status: "conflict" as const };
          revision += 1;
          return { record: structuredClone(row.record), revision, status: "saved" as const };
        });
      },
      async readFacts() {
        return { facts: [], cursor: "0", more: false };
      },
      async saveFacts(facts: { id: string }[]) {
        return facts.map(fact => fact.id);
      }
    };
    const sync = new UsageSync(store);
    resources.push(() => sync.close());
    await sync.configure("a", cloud);
    sync.setAutomatic(false);
    sync.setReportPlans([{ source: "freebuff", targets: [{ reportAs: "codex", model: "gpt-5.3-codex", weight: 100 }] }]);

    await sync.save();

    expect(sync.status().error).toBeNull();
    expect(sync.status().conflicts).toEqual([]);
    expect(sync.status().pending).toBe(0);
    expect(store.records()).toHaveLength(1);
    expect(store.get(local.recordId)?.revision).toBe(5);
    expect(store.attribution(`record:${local.recordId}`)).toBe("claude|");
    expect(sameUsage(store.get(local.recordId)!.record, local)).toBe(true);
  });
});
