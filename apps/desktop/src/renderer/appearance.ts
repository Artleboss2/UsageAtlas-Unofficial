import type { AppMark, AppearanceFont, AppearancePreferences } from "../shared/desktop-api";

export interface FontOption {
  id: AppearanceFont;
  label: string;
  note: string;
}

/**
 * The typography offered in Settings → Appearance. Every family is a bundled
 * variable font, so a choice looks the same on a machine that has never seen it.
 */
export const FONT_OPTIONS: FontOption[] = [
  { id: "system", label: "System", note: "The platform's own UI font" },
  { id: "inter", label: "Inter", note: "Neutral, made for screens" },
  { id: "manrope", label: "Manrope", note: "Rounded and geometric" },
  { id: "figtree", label: "Figtree", note: "Soft and friendly" },
  { id: "jakarta", label: "Jakarta", note: "Wide, editorial" },
  { id: "geist", label: "Geist", note: "Tight and technical" }
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

export const MARK_OPTIONS: { id: AppMark; label: string; note: string }[] = [
  { id: "datamosh", label: "Datamosh", note: "The unofficial fork mark" },
  { id: "classic", label: "Classic", note: "The original artwork" },
  { id: "duotone", label: "Duotone", note: "Cool re-tint" }
];

/** Ink swatches. The first one clears the override and follows the theme. */
export const INK_SWATCHES: { value: string | null; label: string }[] = [
  { value: null, label: "Theme" },
  { value: "#1d1d1f", label: "Graphite" },
  { value: "#0b3d91", label: "Cobalt" },
  { value: "#5b2a86", label: "Plum" },
  { value: "#0f5b45", label: "Forest" },
  { value: "#8a3b12", label: "Ember" }
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
