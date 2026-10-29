import { describe, expect, it } from "vitest";
import type { ReportPlan } from "../../shared/report-plans";
import { spinTarget } from "./report-wheel";
import { previewPlan } from "../../shared/report-wheel";

const wheel: ReportPlan = {
  source: "freebuff" as ReportPlan["source"],
  targets: [
    { reportAs: "codex", model: "gpt-5.3-codex", weight: 30 },
    { reportAs: "claude", model: "claude-sonnet-4-6", weight: 20 },
    { reportAs: "cursor", model: "composer-2.5", weight: 50 }
  ]
};

/** One thousand draws, the way a day of requests arrives. */
function draws(): Record<string, number> {
  const counts: Record<string, number> = { codex: 0, claude: 0, cursor: 0 };
  for (let index = 0; index < 1_000; index += 1) {
    const target = spinTarget(wheel, `request-${index}`);
    counts[target!.reportAs] += 1;
  }
  return counts;
}

describe("report wheel", () => {
  it("lands on each target about as often as its weight says", () => {
    const counts = draws();

    for (const [provider, weight] of [["codex", 30], ["claude", 20], ["cursor", 50]] as const) {
      expect(Math.abs(counts[provider] - weight * 10), provider).toBeLessThanOrEqual(60);
    }
    expect(counts.codex + counts.claude + counts.cursor).toBe(1_000);
  });

  it("repeats a target instead of taking turns", () => {
    const picks = Array.from({ length: 40 }, (_value, index) => spinTarget(wheel, `request-${index}`)!.reportAs);
    const repeats = picks.filter((provider, index) => index > 0 && provider === picks[index - 1]);

    expect(repeats.length).toBeGreaterThan(0);
  });

  it("gives one request the same target every time it is saved again", () => {
    const first = spinTarget(wheel, "request-7");
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(spinTarget(wheel, "request-7")).toEqual(first);
    }
  });

  it("uses the whole wheel when a source is not the only one spinning", () => {
    const other: ReportPlan = { ...wheel, source: "zai" as ReportPlan["source"] };
    const here = Array.from({ length: 200 }, (_value, index) => spinTarget(wheel, `request-${index}`)!.reportAs);
    const there = Array.from({ length: 200 }, (_value, index) => spinTarget(other, `request-${index}`)!.reportAs);

    // Different sources are independent wheels: one is not a rotation of the other.
    expect(here).not.toEqual(there);
  });

  it("previews the shares a save will produce within two points", () => {
    const preview = previewPlan(wheel, 1_000);
    expect(preview.targets.reduce((sum, target) => sum + target.requests, 0)).toBe(1_000);
    expect(preview.driftPoints).toBeLessThanOrEqual(2);
    // The preview is the upload: the first sampled request takes the same label.
    expect(previewPlan(wheel, 1).targets.find(target => target.requests === 1)).toBeDefined();
  });

  it("reports nothing without a plan or with no weight", () => {
    expect(spinTarget(null, "request-1")).toBeNull();
    expect(spinTarget({ source: "freebuff" as ReportPlan["source"], targets: [] }, "request-1")).toBeNull();
    expect(spinTarget({ source: "freebuff" as ReportPlan["source"], targets: [{ reportAs: "codex", model: "gpt-5.5", weight: 0 }] }, "request-1")).toBeNull();
  });
});
