import type { DashboardProvider, DashboardSnapshot } from "@usageatlas/contracts";
import { useEffect, useRef, useState } from "react";
import type { DesktopPreferences } from "../shared/desktop-api";
import { DEFAULT_ADVANCED_PREFERENCES, DEFAULT_WIDGET_PREFERENCES } from "../shared/desktop-api";
import { applyAppearance } from "./appearance";
import { ProviderLogo } from "./components/ProviderLogo";
import { I18nProvider, useI18n } from "./i18n";
import { formatCompactNumber, formatCost, setCostDisplay } from "./number-format";

/**
 * The floating mini window's own renderer. It shares the preload bridge with the
 * main window, so it reads the same snapshot and preferences without a second
 * collection path.
 */
export function CompactWidget(): React.JSX.Element {
  const [preferences, setPreferences] = useState<DesktopPreferences | null>(null);
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);

  useEffect(() => {
    let active = true;
    const remove = window.usageAtlas.onSnapshot((state) => {
      if (active) setSnapshot(state.snapshot);
    });
    void Promise.all([window.usageAtlas.getPreferences(), window.usageAtlas.getSnapshot()])
      .then(([nextPreferences, state]) => {
        if (!active) return;
        setPreferences(nextPreferences);
        setSnapshot(state.snapshot);
      })
      .catch(() => undefined);
    // A cheap re-read keeps the burn rate and countdown current even when no
    // provider refresh completed; the engine serves its cached snapshot.
    const timer = setInterval(() => {
      void window.usageAtlas.getSnapshot().then((state) => {
        if (active) setSnapshot(state.snapshot);
      }).catch(() => undefined);
    }, 30_000);
    return () => {
      active = false;
      remove();
      clearInterval(timer);
    };
  }, []);

  const appearance = preferences?.appearance;
  useEffect(() => {
    if (appearance) applyAppearance(appearance);
  }, [appearance]);

  const advanced = preferences?.advanced;
  useEffect(() => {
    if (!advanced) return;
    setCostDisplay({
      currency: advanced.currency,
      rate: advanced.currencyRate,
      taxPercent: advanced.taxPercent
    });
  }, [advanced]);

  return (
    <I18nProvider language={preferences?.language ?? "system"}>
      <WidgetBody
        preferences={preferences}
        snapshot={snapshot}
        widget={preferences?.widget ?? DEFAULT_WIDGET_PREFERENCES}
      />
    </I18nProvider>
  );
}

function WidgetBody({
  preferences,
  snapshot,
  widget
}: {
  preferences: DesktopPreferences | null;
  snapshot: DashboardSnapshot | null;
  widget: DesktopPreferences["widget"];
}): React.JSX.Element {
  const { t } = useI18n();
  const advanced = preferences?.advanced ?? DEFAULT_ADVANCED_PREFERENCES;
  const providers = snapshot?.providers.filter((provider) => provider.enabled) ?? [];
  const primary = chooseProvider(providers);
  const today = totalsFor(providers);
  const model = primary?.analytics?.models[0]?.label ?? null;
  const quotaWindow = primary ? preferredWindow(primary) : null;
  const remainingPercent = quotaWindow ? clamp(quotaWindow.remainingPercent, 0, 100) : null;
  const budgetPercent = monthlyBudgetPercent(providers, snapshot, advanced.monthlyBudgetUSD);
  const reset = quotaWindow?.resetAt ? countdown(quotaWindow.resetAt) : null;
  const burnRate = useBurnRate(today.totalTokens);
  const sessionCost = useSessionCost(today.estimatedCostUSD);

  useAutoHide(widget.autoHideSeconds);

  return (
    <div className="atlas-widget" data-empty={primary ? undefined : "true"}>
      <header
        className="atlas-widget__header"
        onDoubleClick={() => void window.usageAtlas.expandWidget()}
        title={t("widget.expandHint")}
      >
        <div className="atlas-widget__identity">
          {primary ? (
            <ProviderLogo compact providerID={primary.id} providerName={primary.name} />
          ) : (
            <span aria-hidden="true" className="atlas-widget__emptyMark">UA</span>
          )}
          <div className="atlas-widget__titles">
            <strong>{primary?.name ?? t("widget.noProvider")}</strong>
            <span>{model ?? t("widget.noModel")}</span>
          </div>
        </div>
        <div className="atlas-widget__actions">
          <button
            aria-label={t("widget.expand")}
            className="atlas-widget__button"
            onClick={() => void window.usageAtlas.expandWidget()}
            type="button"
          >
            <svg aria-hidden="true" viewBox="0 0 14 14">
              <path d="M5 2H2v3M9 12h3V9M2 9v3h3M12 5V2H9" />
            </svg>
          </button>
          <button
            aria-label={t("widget.hide")}
            className="atlas-widget__button atlas-widget__button--close"
            onClick={() => void window.usageAtlas.hideWidget()}
            type="button"
          >
            <svg aria-hidden="true" viewBox="0 0 14 14">
              <path d="M3.5 3.5l7 7M10.5 3.5l-7 7" />
            </svg>
          </button>
        </div>
      </header>

      <div className="atlas-widget__gauges">
        <Gauge
          caption={t("widget.quota")}
          label={remainingPercent === null ? "—" : `${Math.round(remainingPercent)}%`}
          tone={toneFor(remainingPercent)}
          value={remainingPercent ?? 0}
        />
        <Gauge
          caption={t("widget.budget")}
          // The caption already says what the ring is; a long "not set" label
          // cannot fit inside a 46px ring.
          label={budgetPercent === null ? "—" : `${Math.round(budgetPercent)}%`}
          tone={budgetPercent === null ? "neutral" : toneFor(100 - budgetPercent)}
          value={budgetPercent ?? 0}
        />
      </div>

      <div className="atlas-widget__stats">
        <div>
          <span>{t("widget.burnRate")}</span>
          <strong>{burnRate === null ? "—" : `${formatCompactNumber(burnRate)}/min`}</strong>
        </div>
        <div>
          <span>{t("widget.sessionCost")}</span>
          <strong>{formatCost(sessionCost)}</strong>
        </div>
        <div>
          <span>{t("widget.reset")}</span>
          <strong>{reset ?? "—"}</strong>
        </div>
      </div>
    </div>
  );
}

function Gauge({
  caption,
  label,
  tone,
  value
}: {
  caption: string;
  label: string;
  tone: "good" | "warn" | "bad" | "neutral";
  value: number;
}): React.JSX.Element {
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const filled = circumference * (clamp(value, 0, 100) / 100);
  return (
    <div className="atlas-widget__gauge" data-tone={tone}>
      <div className="atlas-widget__gaugeRing">
        <svg aria-hidden="true" viewBox="0 0 52 52">
          <circle className="atlas-widget__gaugeTrack" cx="26" cy="26" r={radius} />
          <circle
            className="atlas-widget__gaugeValue"
            cx="26"
            cy="26"
            r={radius}
            strokeDasharray={`${filled} ${circumference - filled}`}
            transform="rotate(-90 26 26)"
          />
        </svg>
        <span>{label}</span>
      </div>
      <span className="atlas-widget__gaugeCaption">{caption}</span>
    </div>
  );
}

function chooseProvider(providers: DashboardProvider[]): DashboardProvider | null {
  return providers.reduce<DashboardProvider | null>((best, provider) => {
    const tokens = provider.analytics?.today.totalTokens ?? 0;
    const bestTokens = best?.analytics?.today.totalTokens ?? -1;
    return tokens > bestTokens ? provider : best;
  }, null);
}

function preferredWindow(provider: DashboardProvider): DashboardProvider["windows"][number] | null {
  return provider.windows.find((window) => window.kind === "session")
    ?? provider.windows[0]
    ?? null;
}

function totalsFor(providers: DashboardProvider[]): { totalTokens: number; estimatedCostUSD: number | null } {
  let totalTokens = 0;
  let cost: number | null = null;
  for (const provider of providers) {
    const today = provider.analytics?.today;
    if (!today) continue;
    totalTokens += today.totalTokens;
    if (today.estimatedCostUSD !== null && today.estimatedCostUSD !== undefined) {
      cost = (cost ?? 0) + today.estimatedCostUSD;
    }
  }
  return { totalTokens, estimatedCostUSD: cost };
}

function monthlyBudgetPercent(
  providers: DashboardProvider[],
  snapshot: DashboardSnapshot | null,
  budget: number
): number | null {
  if (!snapshot || budget <= 0) return null;
  const today = snapshot.generatedAt.slice(0, 7);
  let spent = 0;
  for (const provider of providers) {
    for (const day of provider.analytics?.daily ?? []) {
      if (!day.date.startsWith(today) || day.estimatedCostUSD === null) continue;
      spent += day.estimatedCostUSD;
    }
  }
  return clamp((spent / budget) * 100, 0, 999);
}

/** Tokens per minute across the last two samples, or the current hour's average. */
function useBurnRate(tokens: number): number | null {
  const previous = useRef<{ tokens: number; at: number } | null>(null);
  const [rate, setRate] = useState<number | null>(null);
  useEffect(() => {
    const now = Date.now();
    const last = previous.current;
    previous.current = { tokens, at: now };
    if (!last || now - last.at < 4_000) return;
    const minutes = (now - last.at) / 60_000;
    const delta = Math.max(0, tokens - last.tokens);
    setRate(delta / minutes);
  }, [tokens]);
  return rate;
}

/** Estimated spend since this mini window opened, so "session" means what it says. */
function useSessionCost(cost: number | null): number | null {
  // The first price seen after opening becomes zero; adjusting state while
  // rendering is the documented alternative to an effect that mirrors state.
  const [baseline, setBaseline] = useState<number | null>(null);
  if (cost !== null && baseline === null) setBaseline(cost);
  if (cost === null || baseline === null) return null;
  return Math.max(0, cost - baseline);
}

function useAutoHide(seconds: number): void {
  useEffect(() => {
    if (seconds <= 0) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const reset = (): void => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void window.usageAtlas.hideWidget(), seconds * 1_000);
    };
    reset();
    window.addEventListener("mousemove", reset);
    window.addEventListener("keydown", reset);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener("mousemove", reset);
      window.removeEventListener("keydown", reset);
    };
  }, [seconds]);
}

function countdown(value: string): string {
  const remaining = Date.parse(value) - Date.now();
  if (!Number.isFinite(remaining) || remaining <= 0) return "0m";
  const minutes = Math.ceil(remaining / 60_000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

function toneFor(value: number | null): "good" | "warn" | "bad" | "neutral" {
  if (value === null) return "neutral";
  if (value <= 20) return "bad";
  if (value <= 40) return "warn";
  return "good";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
