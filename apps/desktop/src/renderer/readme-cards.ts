import { PROFILE_SITE } from "./profile-promotion";

/**
 * The website's embed cards (`cloud/apps/web/lib/embed-cards.ts`) that every public
 * profile has. The cost card, accent colors, and pie charts stay on the website, which
 * knows whether the cost is hidden.
 */
export const README_CARDS = {
  heatmap: { title: "AI Coding Activity", label: "Activity", description: "A year of daily AI coding token usage." },
  tokens: { title: "AI Coding Token Usage", label: "Tokens", description: "Tokens used across your synced AI coding tools." },
  models: { title: "Top AI Models Usage", label: "Top models", description: "Your five most used AI models for coding, ranked by tokens." },
  providers: { title: "Top AI Tools Usage", label: "Top tools", description: "Your five most used AI coding tools, ranked by tokens." }
} as const;

export const README_PERIODS = { all: "All time", "7d": "Last 7 days", "30d": "Last 30 days", "90d": "Last 90 days" } as const;

export type ReadmeCard = keyof typeof README_CARDS;
export type ReadmePeriod = keyof typeof README_PERIODS;
export type ReadmeTheme = "light" | "dark";

export const EMBEDS_URL = `${PROFILE_SITE}/account/embeds`;

export function readmeCardSize(card: ReadmeCard): { width: number; height: number } {
  return { width: card === "heatmap" ? 720 : 460, height: card === "heatmap" ? 220 : card === "tokens" ? 244 : 368 };
}

/** The activity card always covers the last year, so it takes no period. */
export function readmeCardUrl(handle: string, card: ReadmeCard, period: ReadmePeriod, theme: ReadmeTheme): string {
  const params = new URLSearchParams({ ...(card === "heatmap" ? {} : { period }), theme });
  return `${PROFILE_SITE}/api/cards/${encodeURIComponent(handle)}/${card}.svg?${params}`;
}

/** The same Markdown as the website's builder: the card links to the profile. */
export function readmeCardMarkdown(handle: string, card: ReadmeCard, period: ReadmePeriod, theme: ReadmeTheme): string {
  return `[![${README_CARDS[card].title} on UsageAtlas](${readmeCardUrl(handle, card, period, theme)})](${PROFILE_SITE}/@${handle})`;
}
