/**
 * The profile funnel events the renderer may report. Main checks every event against
 * this list, so a renderer bug or injected script cannot send arbitrary analytics.
 */
const PROFILE_STATES = ["signed-out", "unknown", "missing", "private", "public"] as const;
const TRIGGERS = ["page", "milestone-tokens", "milestone-streak", "best-week", "recap", "wrapped"] as const;
const SURFACES = ["modal", "page"] as const;
const ACHIEVEMENT_NUDGE = { kind: ["intro", "unlock"], achievement: ["tokens", "streak", "active-days", "big-day", "tools"] } as const;

export const GROWTH_EVENTS = {
  profile_page_viewed: { state: PROFILE_STATES },
  profile_prompt_shown: { trigger: TRIGGERS, surface: SURFACES },
  profile_prompt_clicked: { trigger: TRIGGERS, surface: SURFACES, action: ["sign-in", "create", "publish", "view", "leaderboard"] },
  profile_prompt_dismissed: { trigger: TRIGGERS, choice: ["later", "never"] },
  profile_card_copied: { card: ["heatmap", "tokens", "models", "providers"], format: ["markdown", "url"] },
  recap_shared: { period: ["week", "month"], action: ["copy", "save", "x", "bluesky"], link: ["profile", "site"] },
  achievement_nudge_shown: ACHIEVEMENT_NUDGE,
  achievement_nudge_clicked: ACHIEVEMENT_NUDGE,
  wrapped_nudge_shown: { month: ["december", "january"] },
  wrapped_opened: { surface: ["toast", "page"] }
} as const satisfies Record<string, Record<string, readonly string[]>>;

export type GrowthEvent = keyof typeof GROWTH_EVENTS;
export type GrowthEventProperties<E extends GrowthEvent> = {
  [K in keyof (typeof GROWTH_EVENTS)[E]]: (typeof GROWTH_EVENTS)[E][K] extends readonly (infer V)[] ? V : never;
};
export type PromptTriggerKind = (typeof TRIGGERS)[number];

export function isGrowthEvent(event: unknown, properties: unknown): event is GrowthEvent {
  if (typeof event !== "string" || !Object.hasOwn(GROWTH_EVENTS, event)) return false;
  if (!properties || typeof properties !== "object" || Array.isArray(properties)) return false;
  const schema: Record<string, readonly string[]> = GROWTH_EVENTS[event as GrowthEvent];
  const keys = Object.keys(properties);
  return keys.length === Object.keys(schema).length
    && keys.every((key) => Object.hasOwn(schema, key)
      && schema[key].includes((properties as Record<string, unknown>)[key] as string));
}
