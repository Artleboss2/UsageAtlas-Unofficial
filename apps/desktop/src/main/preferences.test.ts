import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const electron = vi.hoisted(() => ({ directory: "" }));
vi.mock("electron", () => ({
  app: { getPath: () => electron.directory, isPackaged: false, setLoginItemSettings: vi.fn() },
}));
import { PreferenceStore } from "./preferences";

beforeEach(() => {
  electron.directory = mkdtempSync(path.join(tmpdir(), "usageatlas-preferences-test-"));
});
afterEach(() => rmSync(electron.directory, { recursive: true, force: true }));

describe("remembered profile state", () => {
  it("returns the state it replaces, per account, across restarts", () => {
    const store = new PreferenceStore();
    expect(store.recordProfileState("user-a", "missing")).toBeNull();
    expect(store.recordProfileState("user-a", "private")).toBe("missing");
    expect(new PreferenceStore().recordProfileState("user-a", "public")).toBe("private");
    expect(new PreferenceStore().recordProfileState("user-b", "missing")).toBeNull();
    expect(new PreferenceStore().recordProfileState("user-a", "public")).toBeNull();
  });

  it("ignores a damaged saved state and never exposes it as a preference", () => {
    const file = path.join(electron.directory, "desktop-preferences.json");
    writeFileSync(file, JSON.stringify({ lastProfile: { accountId: "user-a", state: "famous" } }));
    const store = new PreferenceStore();
    expect(store.recordProfileState("user-a", "public")).toBeNull();
    expect(store.get()).not.toHaveProperty("lastProfile");
    expect(JSON.parse(readFileSync(file, "utf8")).lastProfile).toEqual({ accountId: "user-a", state: "public" });
  });
});
