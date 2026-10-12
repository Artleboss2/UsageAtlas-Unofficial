import { describe, expect, it } from "vitest";
import { isGrowthEvent } from "./growth-events";

describe("growth events", () => {
  it("accepts only known events with exactly their allowed properties", () => {
    expect(isGrowthEvent("profile_prompt_shown", { trigger: "best-week", surface: "modal" })).toBe(true);
    expect(isGrowthEvent("profile_page_viewed", { state: "signed-out" })).toBe(true);
    expect(isGrowthEvent("profile_prompt_shown", { trigger: "best-week" })).toBe(false);
    expect(isGrowthEvent("profile_prompt_shown", { trigger: "best-week", surface: "modal", email: "a@b.c" })).toBe(false);
    expect(isGrowthEvent("profile_prompt_dismissed", { trigger: "recap", choice: "forever" })).toBe(false);
    expect(isGrowthEvent("desktop_app_opened", {})).toBe(false);
    expect(isGrowthEvent("toString", {})).toBe(false);
    expect(isGrowthEvent("profile_page_viewed", ["signed-out"])).toBe(false);
    expect(isGrowthEvent("profile_page_viewed", null)).toBe(false);
    expect(isGrowthEvent("profile_card_copied", { card: "models", format: "markdown" })).toBe(true);
    expect(isGrowthEvent("profile_card_copied", { card: "cost", format: "markdown" })).toBe(false);
    expect(isGrowthEvent("recap_shared", { period: "month", action: "bluesky", link: "profile" })).toBe(true);
    expect(isGrowthEvent("recap_shared", { period: "year", action: "copy", link: "site" })).toBe(false);
    expect(isGrowthEvent("profile_prompt_clicked", { trigger: "page", surface: "page", action: "leaderboard" })).toBe(true);
    expect(isGrowthEvent("achievement_nudge_shown", { kind: "intro", achievement: "big-day" })).toBe(true);
    expect(isGrowthEvent("achievement_nudge_clicked", { kind: "unlock", achievement: "tools" })).toBe(true);
    expect(isGrowthEvent("achievement_nudge_shown", { kind: "unlock", achievement: "1B tokens" })).toBe(false);
    expect(isGrowthEvent("profile_prompt_shown", { trigger: "wrapped", surface: "modal" })).toBe(true);
    expect(isGrowthEvent("wrapped_nudge_shown", { month: "january" })).toBe(true);
    expect(isGrowthEvent("wrapped_nudge_shown", { month: "2026" })).toBe(false);
    expect(isGrowthEvent("wrapped_opened", { surface: "page" })).toBe(true);
    expect(isGrowthEvent("wrapped_opened", { surface: "toast", handle: "ada" })).toBe(false);
  });
});
