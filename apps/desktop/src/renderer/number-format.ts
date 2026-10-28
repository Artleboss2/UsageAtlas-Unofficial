import type { NumberStyle } from "../shared/desktop-api";

/**
 * Numbers are rendered in English on purpose: every label around them is English
 * ("1,284,930 tokens", "48.8M"), and following the operating system's locale
 * instead would put French or German separators inside English copy. Keeping the
 * locale explicit also keeps the figures identical on every machine.
 */
const NUMBER_LOCALE = "en";

/**
 * Settings → Appearance picks between every digit and a short unit. The choice
 * lives here rather than in each call site so a figure cannot disagree with the
 * one next to it; charts ask for `formatAxisNumber` and always stay compact.
 */
let numberStyle: NumberStyle = "exact";

export function setNumberStyle(style: NumberStyle): void {
  numberStyle = style;
}

const COMPACT_UNITS = [
  { threshold: 1_000_000_000_000, label: "T" },
  { threshold: 1_000_000_000, label: "B" },
  { threshold: 1_000_000, label: "M" },
  { threshold: 1_000, label: "K" }
] as const;

const decimalFormatter = new Intl.NumberFormat(NUMBER_LOCALE, {
  maximumFractionDigits: 1
});

const exactIntegerFormatter = new Intl.NumberFormat(NUMBER_LOCALE, {
  maximumFractionDigits: 0
});

const exactDecimalFormatter = new Intl.NumberFormat(NUMBER_LOCALE, {
  maximumFractionDigits: 2
});

const exactNumberFormatter = new Intl.NumberFormat(NUMBER_LOCALE, {
  maximumFractionDigits: 2
});

const currencyFormatter = new Intl.NumberFormat(NUMBER_LOCALE, {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const preciseCurrencyFormatter = new Intl.NumberFormat(NUMBER_LOCALE, {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 4,
  maximumFractionDigits: 4
});

/** Every digit, grouped — the form the interface uses unless compact is chosen. */
function formatExactValue(value: number): string {
  return (Number.isInteger(value) ? exactIntegerFormatter : exactDecimalFormatter).format(value);
}

function formatWithUnits(value: number): string {
  const unitIndex = COMPACT_UNITS.findIndex(({ threshold }) => Math.abs(value) >= threshold);
  if (unitIndex === -1) return decimalFormatter.format(value);

  let unit = COMPACT_UNITS[unitIndex];
  let scaledValue = value / unit.threshold;
  if (unitIndex > 0 && Math.abs(Math.round(scaledValue * 10) / 10) >= 1_000) {
    unit = COMPACT_UNITS[unitIndex - 1];
    scaledValue = value / unit.threshold;
  }

  return `${decimalFormatter.format(scaledValue)}${unit.label}`;
}

/** Respects the Appearance choice: exact digits, or a short unit like `1.3M`. */
export function formatCompactNumber(value: number): string {
  return numberStyle === "exact" ? formatExactValue(value) : formatWithUnits(value);
}

/**
 * Chart ticks stay compact whatever the preference says: at 1,284,930, 1,140,000
 * and 1,024,000 the axis labels would collide and leave no room for the plot.
 */
export function formatAxisNumber(value: number): string {
  return formatWithUnits(value);
}

export function formatCompactCurrency(value: number): string {
  const sign = value < 0 ? "-$" : "$";
  return `${sign}${formatCompactNumber(Math.abs(value))}`;
}

/** Chart currency ticks stay short for the same reason the numeric ones do. */
export function formatAxisCurrency(value: number): string {
  const sign = value < 0 ? "-$" : "$";
  return `${sign}${formatWithUnits(Math.abs(value))}`;
}

export function formatTokens(value: number): string {
  return `${formatCompactNumber(value)} tokens`;
}

export function formatExactTokens(value: number): string {
  return `${exactNumberFormatter.format(value)} tokens`;
}

export function formatCost(value: number | null): string {
  if (value === null) return "—";
  return value > 0 && value < 0.01 ? preciseCurrencyFormatter.format(value) : currencyFormatter.format(value);
}
