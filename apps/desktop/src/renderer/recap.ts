import type { DashboardSnapshot } from "@usageatlas/contracts";
import { formatCompactNumber } from "./number-format";
import { buildPeriodUsage, periodBounds, shiftDay } from "./personal-analytics";
import { currentStreak, isActiveDay, listNames, PROFILE_SITE, publicProfileUrl } from "./profile-promotion";
import { buildModelMix } from "./usage-insights";

export type RecapPeriod = "week" | "month";
export type RecapTheme = "light" | "dark";

export const RECAP_PERIODS = {
  week: { days: 7, label: "Last 7 days", title: "My week in AI coding", before: "the week before" },
  month: { days: 30, label: "Last 30 days", title: "My month in AI coding", before: "the 30 days before" }
} as const;

/** The size X shows without cropping. The PNG is drawn at twice this for sharp text. */
export const RECAP_SIZE = { width: 1200, height: 675 } as const;

export interface RecapData {
  period: RecapPeriod;
  startDay: string;
  endDay: string;
  /** Every day of the period, oldest first. */
  days: { date: string; tokens: number }[];
  totalTokens: number;
  /** Percent against the same number of days before, when all of them were recorded. */
  change: number | null;
  activeDays: number;
  streak: number;
  busiest: { date: string; tokens: number } | null;
  models: { label: string; share: number }[];
  tools: { id: string; name: string; share: number }[];
}

/** The last 7 or 30 days on this computer, today included. */
export function buildRecap(snapshot: DashboardSnapshot, today: string, period: RecapPeriod): RecapData {
  const length = RECAP_PERIODS[period].days;
  const startDay = shiftDay(today, 1 - length);
  const usage = buildPeriodUsage(snapshot, "all", startDay, today);
  const history = buildPeriodUsage(snapshot, "all", periodBounds(snapshot, "all", today, "all").startDay, today);
  const byDay = new Map(history.days.map((day) => [day.date, day]));
  const totalTokens = usage.totals.totalTokens;

  let previous: number | null = 0;
  for (let offset = 1; offset <= length && previous !== null; offset += 1) {
    const day = byDay.get(shiftDay(startDay, -offset));
    previous = day?.covered ? previous + day.totalTokens : null;
  }
  const change = previous === null || previous <= 0 ? null : Math.round(((totalTokens - previous) / previous) * 100);

  const days = usage.days.map((day) => ({ date: day.date, tokens: day.covered ? day.totalTokens : 0 }));
  const busiest = days.reduce<RecapData["busiest"]>((top, day) => day.tokens > (top?.tokens ?? 0) ? day : top, null);
  const tools = usage.providerRows.filter((row) => row.totals.totalTokens > 0).slice(0, 3)
    .map((row) => ({ id: row.id, name: row.name, share: row.totals.totalTokens / totalTokens }));
  const mix = buildModelMix(snapshot, "all", { startDay, endDay: today });
  const models = mix.models.filter((model) => model.id !== "other" && model.totalTokens > 0).slice(0, 3)
    .map((model) => ({ label: model.label, share: model.totalTokens / mix.totalModelTokens }));

  return {
    period,
    startDay,
    endDay: today,
    days,
    totalTokens,
    change,
    activeDays: usage.days.filter(isActiveDay).length,
    streak: currentStreak(byDay, today),
    busiest,
    models,
    tools
  };
}

const atNoon = (day: string) => new Date(`${day}T12:00:00`);

export function recapDateRange(recap: RecapData): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" })
    .formatRange(atNoon(recap.startDay), atNoon(recap.endDay));
}

export function recapChange(recap: RecapData): string | null {
  if (recap.change === null) return null;
  const sign = recap.change > 0 ? "+" : recap.change < 0 ? "−" : "";
  return `${sign}${Math.abs(recap.change).toLocaleString("en-US")}% vs ${RECAP_PERIODS[recap.period].before}`;
}

export function recapBusiestDay(recap: RecapData): string | null {
  if (!recap.busiest) return null;
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(atNoon(recap.busiest.date));
}

/** The profile when it's public, otherwise the website. */
export function recapLink(profileHandle: string | null): { url: string; label: string } {
  const url = profileHandle ? publicProfileUrl(profileHandle) : PROFILE_SITE;
  return { url, label: url.replace(/^https:\/\//u, "") };
}

export function recapPostText(recap: RecapData): string {
  const tools = recap.tools.map((tool) => tool.name);
  const streak = recap.streak >= 3 ? ` ${recap.streak} days in a row and counting.` : "";
  return `${RECAP_PERIODS[recap.period].title}: ${formatCompactNumber(recap.totalTokens)} tokens${tools.length ? ` across ${listNames(tools)}` : ""}.${streak}`;
}

export function xPostUrl(recap: RecapData, link: string): string {
  return `https://x.com/intent/post?text=${encodeURIComponent(recapPostText(recap))}&url=${encodeURIComponent(link)}`;
}

/** Bluesky takes only text and turns the link inside it into a link card. */
export function blueskyPostUrl(recap: RecapData, link: string): string {
  return `https://bsky.app/intent/compose?text=${encodeURIComponent(`${recapPostText(recap)}\n${link}`)}`;
}

export function recapFileName(recap: RecapData): string {
  return `usageatlas-${recap.period}-${recap.endDay}.png`;
}
