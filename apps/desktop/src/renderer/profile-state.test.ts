import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { growthToastShowing, markGrowthToast, whenInFront } from "./profile-state";

class FakeDocument extends EventTarget {
  front = true;
  get visibilityState(): DocumentVisibilityState {
    return this.front ? "visible" : "hidden";
  }
  hasFocus(): boolean {
    return this.front;
  }
}

describe("whenInFront", () => {
  const win = new EventTarget();
  const doc = new FakeDocument();

  beforeEach(() => {
    vi.useFakeTimers();
    doc.front = true;
    vi.stubGlobal("window", win);
    vi.stubGlobal("document", doc);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("waits for the window to come back instead of giving up", () => {
    const show = vi.fn();
    doc.front = false;
    whenInFront(4_000, show);
    vi.advanceTimersByTime(60_000);
    expect(show).not.toHaveBeenCalled();

    doc.front = true;
    win.dispatchEvent(new Event("focus"));
    vi.advanceTimersByTime(3_999);
    expect(show).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(show).toHaveBeenCalledOnce();

    win.dispatchEvent(new Event("focus"));
    vi.advanceTimersByTime(60_000);
    expect(show).toHaveBeenCalledOnce();
  });

  it("restarts the wait when the window comes back, and never shows once cleaned up", () => {
    const show = vi.fn();
    const stop = whenInFront(4_000, show);
    vi.advanceTimersByTime(3_000);
    doc.dispatchEvent(new Event("visibilitychange"));
    vi.advanceTimersByTime(3_000);
    expect(show).not.toHaveBeenCalled();
    stop();
    win.dispatchEvent(new Event("focus"));
    vi.advanceTimersByTime(60_000);
    expect(show).not.toHaveBeenCalled();
  });

  it("remembers a growth toast for as long as it stays up", () => {
    markGrowthToast();
    vi.advanceTimersByTime(11_999);
    expect(growthToastShowing(12_000)).toBe(true);
    vi.advanceTimersByTime(1);
    expect(growthToastShowing(12_000)).toBe(false);
  });
});
