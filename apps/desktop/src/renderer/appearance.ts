import type { AppMark, AppearanceFont, AppearancePreferences } from "../shared/desktop-api";

export interface FontOption {
  id: AppearanceFont;
  label: string;
}

/**
 * The typography offered in Settings → Appearance. Every family is a bundled
 * variable font, so a choice looks the same on a machine that has never seen it.
 */
export const FONT_OPTIONS: FontOption[] = [
  { id: "system", label: "System" },
  { id: "inter", label: "Inter" },
  { id: "manrope", label: "Manrope" },
  { id: "figtree", label: "Figtree" },
  { id: "jakarta", label: "Jakarta" },
  { id: "geist", label: "Geist" }
];

/** CSS stacks for the preview tiles, matching the selectors in globals.css. */
export const FONT_STACKS: Record<AppearanceFont, string> = {
  system: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  inter: "'Inter Variable', Inter, sans-serif",
  manrope: "'Manrope Variable', Manrope, sans-serif",
  figtree: "'Figtree Variable', Figtree, sans-serif",
  jakarta: "'Plus Jakarta Sans Variable', 'Plus Jakarta Sans', sans-serif",
  geist: "'Geist Variable', Geist, sans-serif"
};

export const MARK_OPTIONS: { id: AppMark; label: string }[] = [
  { id: "datamosh", label: "Datamosh" },
  { id: "classic", label: "Classic" },
  { id: "duotone", label: "Duotone" }
];

export type InkSwatchId = "theme" | "graphite" | "cobalt" | "plum" | "forest" | "ember";

/** Ink swatches. The first one clears the override and follows the theme. */
export const INK_SWATCHES: { id: InkSwatchId; value: string | null }[] = [
  { id: "theme", value: null },
  { id: "graphite", value: "#1d1d1f" },
  { id: "cobalt", value: "#0b3d91" },
  { id: "plum", value: "#5b2a86" },
  { id: "forest", value: "#0f5b45" },
  { id: "ember", value: "#8a3b12" }
];

/**
 * Applies typography, type scale and ink colour to the document. Kept out of the
 * component so the same function serves the first render and every change.
 */
export function applyAppearance(appearance: AppearancePreferences): void {
  const root = document.documentElement;
  root.dataset.appearanceFont = appearance.font;
  root.style.setProperty("--atlas-font-scale", String(appearance.fontScale));
  if (appearance.textColor) root.style.setProperty("--foreground", appearance.textColor);
  else root.style.removeProperty("--foreground");
}
