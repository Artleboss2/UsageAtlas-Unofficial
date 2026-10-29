import type { UsageFact } from "@usageatlas/contracts/statistics";
import {
  USAGE_BATCH_SIZE,
  USAGE_MAX_BYTES,
  sameUsage,
  validateUsageRecord,
  type CloudRecord,
  type PendingRecord,
  type SaveResult
} from "@usageatlas/contracts/usage";
import type { CloudProgress } from "../../shared/desktop-api";
import { UsageStore } from "./usage-store";

/** Providers the hosted service models. Everything else stays on this computer. */
const CLOUD_PROVIDERS = [
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
] as const;

/**
 * The hosted service stores at most this many observations per request. Sending
 * the store's own 250-fact page made it acknowledge only the first 40 and the
 * client treated the rest as a failed save, so one save drained 40 at a time.
 */
const STATISTICS_SAVE_BATCH = 40;

export interface UsageCloud {
  readFacts?(after: string): Promise<{ facts: UsageFact[]; cursor: string; more: boolean }>;
  saveFacts?(facts: UsageFact[]): Promise<string[]>;
  read(after: string | null): Promise<{ records: CloudRecord[]; next: string | null }>;
  save(records: PendingRecord[]): Promise<SaveResult[]>;
}
const AUTOMATIC_SAVE_INTERVAL_MS = 60 * 60 * 1_000;

export class UsageSync {
  private progress: CloudProgress | null = null;
  private lastCompleted: "save" | "restore" | null = null;
  private running: Promise<void> | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private cloud: UsageCloud | null = null;
  private error: string | null = null;
  private closed = false;
  private stopping = false;
  private controller: AbortController | null = null;
  private preparedAccount: string | null = null;
  /** Sources the server does not model, kept on this computer. */
  private heldBack: string[] = [];
  constructor(
    private readonly store: UsageStore,
    private readonly changed: (reason: "account" | "history") => void = () => {},
    private readonly beforeSave?: (signal: AbortSignal) => Promise<void>
  ) {
    store.onChange = () => this.schedule();
  }
  status() {
    const conflicts = this.store.conflicts();
    const counts = this.store.counts();
    return {
      accountId: this.store.owner || null,
      automatic: this.automatic,
      pending: counts.pending,
      busy: this.running !== null,
      progress: this.progress ? { ...this.progress } : null,
      lastCompleted: this.lastCompleted,
      heldBack: [...this.heldBack],
      heldBackCount: this.heldBackPending(),
      error: this.error ?? (counts.invalid
        ? `${counts.invalid} invalid local usage ${counts.invalid === 1 ? "record was" : "records were"} skipped. Other records can still be saved. Refresh usage to retry.`
        : null),
      conflicts: conflicts.flatMap((row) =>
        row.conflict
          ? [
              {
                recordId: row.record.recordId,
                provider: row.record.providerId,
                day: row.record.kind === "usage_day" ? row.record.localDay : null,
                localTokens:
                  row.record.kind === "usage_day" ? (row.record.totals?.totalTokens ?? null) : null,
                cloudTokens:
                  row.conflict.record.kind === "usage_day"
                    ? (row.conflict.record.totals?.totalTokens ?? null)
                    : null
              }
            ]
          : []
      )
    };
  }
  get automatic(): boolean {
    return Boolean(this.store.owner) && this.store.setting(`automatic:${this.store.owner}`) !== "0";
  }
  async configure(account: string, cloud: UsageCloud | null): Promise<void> {
    this.clearTimer();
    // Finish only the in-flight request under its original account. A large history
    // must not keep uploading pages after sign-out or delay an account switch.
    if (this.store.owner !== account) {
      this.stopping = true;
      this.controller?.abort();
    }
    if (this.running) await this.running.catch(() => undefined);
    this.stopping = false;
    // Completion can schedule a retry for the previous account.
    this.clearTimer();
    const switched = this.store.owner !== account;
    this.preparedAccount = null;
    this.lastCompleted = null;
    this.store.selectAccount(account);
    this.cloud = cloud;
    this.error = null;
    this.schedule();
    if (switched) this.changed("account");
  }
  /** Providers this server accepts. Anything else stays local. */
  private uploadableProviders(): string[] {
    return [...CLOUD_PROVIDERS];
  }
  /** Sources with pending usage that the server would reject as-is. */
  private unsupportedProviders(providers: readonly string[]): string[] {
    const pending = [
      ...this.store.statistics.pendingProviders(),
      ...this.store.pendingProviders()
    ];
    return [...new Set(pending)].filter(provider => !providers.includes(provider)).sort();
  }
  /** Records the local sources with pending usage the server would reject as-is. */
  private reportHeldBack(providers: readonly string[]): void {
    this.heldBack = [...providers];
  }
  /**
   * Usage that no save can upload because the server models no such source. It is
   * counted apart from `pending` so it never reads as a save that keeps failing.
   */
  private heldBackPending(): number {
    const held = this.unsupportedProviders(this.uploadableProviders());
    if (!held.length) return 0;
    return this.store.pendingCount(held) + this.store.statistics.pendingCount(held);
  }
  /** Rows a save would send right now, counting the server's own sources only. */
  private uploadablePending(): number {
    const providers = this.uploadableProviders();
    return this.store.uploadableCount(providers) + this.store.statistics.pendingCount(providers);
  }
  setAutomatic(enabled: boolean): void {
    if (!this.cloud) throw new Error("Sign in before enabling automatic save.");
    this.store.setSetting(`automatic:${this.store.owner}`, enabled ? "1" : "0");
    this.clearTimer();
    if (enabled) this.schedule();
  }
  save(): Promise<void> {
    return this.run(true);
  }
  restore(): Promise<void> {
    return this.run(false);
  }
  resolve(id: string, choice: "local" | "cloud"): void {
    this.store.resolve(id, choice);
    this.changed("history");
  }
  close(): void {
    this.closed = true;
    this.controller?.abort();
    this.cloud = null;
    this.clearTimer();
    this.store.onChange = undefined;
  }
  private run(upload: boolean): Promise<void> {
    if (this.running) return this.running;
    if (!this.cloud || !this.store.owner) return Promise.reject(new Error("Sign in to your account first."));
    this.clearTimer();
    const cloud = this.cloud;
    const controller = new AbortController();
    this.controller = controller;
    this.progress = { operation: upload ? "save" : "restore", phase: "reading", completed: 0, total: null };
    this.lastCompleted = null;
    this.running = (async () => {
      this.error = null;
      const providers = this.uploadableProviders();
      if (!upload) this.heldBack = [];
      if (upload) {
        if (this.beforeSave) await this.beforeSave(controller.signal);
        if (this.closed || this.stopping) return;
        const owner = this.store.owner;
        while (this.store.statistics.hasLocal()) {
          await this.store.statistics.claimLocalBatch(owner);
          await new Promise<void>(resolve => setImmediate(resolve));
          if (this.closed || this.stopping) return;
        }
        this.store.claimLocal();
        // Pruning only shrinks the upload. A stopped history writer must not keep pending facts from saving.
        await this.store.statistics.dropRepricedCopies(() => this.closed || this.stopping).catch(() => undefined);
        if (this.closed || this.stopping) return;
      }
      // Observations are not restored. The server already holds them, the local
      // day records carry the same totals, and re-reading them used to copy the
      // whole cloud ledger into this database on every restore.
      if (upload) {
        this.progress = { operation: "save", phase: "saving", completed: 0, total: this.store.statistics.pendingCount() };
        for (;;) {
          const outgoing = this.store.statistics.pending(providers).slice(0, STATISTICS_SAVE_BATCH);
          if (!outgoing.length) break;
          if (!cloud.saveFacts) throw new Error("This server does not support saving usage observations. Update before saving.");
          const saved = await cloud.saveFacts(outgoing);
          if (this.closed || this.stopping) return;
          if (saved.length !== outgoing.length || new Set(saved).size !== outgoing.length
            || saved.some(id => !outgoing.some(fact => fact.id === id))) throw new Error("Incomplete statistics acknowledgement.");
          this.store.transaction(() => this.store.statistics.acknowledge(saved));
          this.progress!.completed += saved.length;
        }
      }
      if (!upload || this.preparedAccount !== this.store.owner) {
        this.progress = { operation: upload ? "save" : "restore", phase: "reading", completed: 0, total: null };
        let after: string | null = null;
        do {
          const page = await cloud.read(after);
          if (this.closed || this.stopping) return;
          for (const record of page.records) this.store.merge(record);
          if (page.next !== null && ((after !== null && page.next <= after) || page.records.length === 0)) {
            throw new Error("Invalid cloud page.");
          }
          this.progress!.completed += page.records.length;
          after = page.next;
        } while (after !== null);
        this.preparedAccount = this.store.owner;
      }
      if (upload) {
        let pending = this.store.pending(providers);
        const counts = this.store.counts();
        this.progress = { operation: "save", phase: "saving", completed: 0, total: counts.pending - counts.conflicts - counts.invalid };
        while (pending.length) {
          const outgoing = pending;
          const before = new Map(outgoing.map(row => [row.record.recordId, this.stateOf(row)]));
          const results = await cloud.save(outgoing);
          if (this.closed || this.stopping) return;
          if (
            results.length !== pending.length ||
            new Set(results.map((row) => row.record.recordId)).size !== pending.length
          )
            throw new Error("Incomplete cloud save response.");
          for (const result of results) {
            const sent = outgoing.find((row) => row.record.recordId === result.record.recordId);
            const local = pending.find((row) => row.record.recordId === result.record.recordId);
            if (!sent || !local) throw new Error("Unexpected cloud save response.");
            if (result.status === "saved") {
              if (!sameUsage(sent.record, result.record) || result.revision < sent.revision)
                throw new Error("Cloud acknowledgement does not match the sent record.");
              this.store.acknowledge(local, result);
              this.progress.completed += 1;
            } else this.store.merge(result);
          }
          // Only the rows this pass sent count as progress: a source the server
          // refuses to accept stays pending and is reported instead of retried.
          const next = this.store.pending(providers);
          // A row the server keeps answering about must change something — its own
          // version or its revision — or the save would spin forever.
          if (next.some((row) => before.get(row.record.recordId) === this.stateOf(row)))
            throw new Error("Cloud save made no progress. Restore from cloud, then try again.");
          pending = next;
          const remaining = this.store.counts();
          this.progress.total = this.progress.completed + remaining.pending - remaining.conflicts - remaining.invalid;
        }
      }
      if (upload) this.reportHeldBack(this.unsupportedProviders(providers));
      this.lastCompleted = upload ? "save" : "restore";
    })()
      .catch((error: unknown) => {
        if (this.closed || this.stopping) return;
        this.error = error instanceof Error ? error.message : "Cloud save failed. Your local usage is safe.";
        throw error;
      })
      .finally(() => {
        this.running = null;
        this.controller = null;
        this.progress = null;
        if (this.closed || this.stopping) return;
        this.changed("history");
        this.schedule();
      });
    return this.running;
  }
  /** What one pending row looks like to the server, for progress checks. */
  private stateOf(row: PendingRecord): string {
    return [row.localVersion, row.revision].join("\u0000");
  }
  private schedule(): void {
    if (!this.automatic || !this.cloud || this.closed || this.stopping || this.timer || this.running) return;
    // A source the server refuses must not keep an hourly save running forever:
    // only what a save can actually upload wakes the timer.
    if (this.uploadablePending() === 0) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.save().catch(() => undefined);
    }, AUTOMATIC_SAVE_INTERVAL_MS);
    this.timer.unref?.();
  }
  private clearTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}

export function httpUsageCloud(baseURL: string, token: string): UsageCloud {
  const request = async (path: string, body?: unknown): Promise<unknown> => {
    const response = await fetch(`${baseURL}${path}`, {
      method: body ? "POST" : "GET",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20_000),
      redirect: "error"
    });
    if (!response.ok)
      throw new Error(
        response.status === 401
          ? "Your session expired. Sign in again."
          : `Cloud request failed (${response.status}). Try again.`
      );
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Empty cloud response.");
    let size = 0;
    const chunks: Uint8Array[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > USAGE_MAX_BYTES) {
        await reader.cancel();
        throw new Error("Cloud response is too large.");
      }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  };
  const records = (value: unknown): CloudRecord[] => {
    if (!Array.isArray(value) || value.length > USAGE_BATCH_SIZE) throw new Error("Invalid cloud records.");
    return value.map((row) => {
      if (!row || !Number.isSafeInteger(row.revision) || row.revision < 1)
        throw new Error("Invalid cloud revision.");
      return { record: validateUsageRecord(row.record), revision: row.revision };
    });
  };
  return {
    async saveFacts(facts) {
      const result = await request("/api/usage/statistics", { facts }) as { saved: unknown };
      if (!Array.isArray(result.saved) || result.saved.some(id => typeof id !== "string")) throw new Error("Invalid statistics acknowledgement.");
      return result.saved as string[];
    },
    async read(after) {
      const value = (await request(`/api/usage${after ? `?after=${encodeURIComponent(after)}` : ""}`)) as {
        records: unknown;
        next: unknown;
      };
      if (value.next !== null && (typeof value.next !== "string" || value.next.length > 64))
        throw new Error("Invalid cloud cursor.");
      return { records: records(value.records), next: value.next as string | null };
    },
    async save(pending) {
      const value = await request("/api/usage", {
        records: pending.map(({ record, revision }) => ({ record, revision }))
      });
      const parsed = records(value);
      return parsed.map((row, index) => {
        const status = (value as { status: unknown }[])[index].status;
        if (status !== "saved" && status !== "conflict") throw new Error("Invalid save status.");
        return { ...row, status };
      });
    }
  };
}
