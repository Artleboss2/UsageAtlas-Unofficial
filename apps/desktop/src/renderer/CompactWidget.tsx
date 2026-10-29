import type { DashboardProvider, DashboardSnapshot } from "@usageatlas/contracts";
import { useEffect, useState } from "react";
import type { DesktopPreferences } from "../shared/desktop-api";
import { DEFAULT_WIDGET_PREFERENCES } from "../shared/desktop-api";
import { applyAppearance } from "./appearance";
import { ProviderLogo } from "./components/ProviderLogo";
import { I18nProvider, useI18n } from "./i18n";
import { formatExactNumber, formatShortNumber } from "./number-format";

/**
 * The floating mini window's own renderer. It shows one number — the tokens used
 * today — and switches to a short unit when the window gets small enough that
 * every digit would no longer fit.
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
    // The engine serves its cached snapshot, so this stays cheap.
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

  return (
    <I18nProvider language={preferences?.language ?? "system"}>
      <WidgetBody
        snapshot={snapshot}
        widget={preferences?.widget ?? DEFAULT_WIDGET_PREFERENCES}
      />
    </I18nProvider>
  );
}

/** Below this width the exact figure would wrap, so it becomes `12.4M`. */
const COMPACT_WIDTH = 300;

function WidgetBody({
  snapshot,
  widget
}: {
  snapshot: DashboardSnapshot | null;
  widget: DesktopPreferences["widget"];
}): React.JSX.Element {
  const { t } = useI18n();
  const [compact, setCompact] = useState(() => window.innerWidth < COMPACT_WIDTH);
  const [narrow, setNarrow] = useState(() => window.innerWidth < 240);

  useEffect(() => {
    const resize = (): void => {
      setCompact(window.innerWidth < COMPACT_WIDTH);
      setNarrow(window.innerWidth < 240);
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  useAutoHide(widget.autoHideSeconds);

  const providers = snapshot?.providers.filter((provider) => provider.enabled) ?? [];
  const primary = chooseProvider(providers);
  const totalTokens = providers.reduce(
    (sum, provider) => sum + (provider.analytics?.today.totalTokens ?? 0),
    0
  );

  return (
    <div
      className="atlas-widget"
      data-compact={compact ? "true" : undefined}
      data-narrow={narrow ? "true" : undefined}
      data-empty={primary ? undefined : "true"}
    >
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
            {narrow ? null : <span>{t("widget.tokensToday")}</span>}
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

      <div className="atlas-widget__tokens">
        {narrow ? null : <span className="atlas-widget__caption">{t("widget.tokensToday")}</span>}
        <div className="atlas-widget__figure">
          <strong data-compact={compact ? "true" : undefined}>
            {compact ? formatShortNumber(totalTokens) : formatExactNumber(totalTokens)}
          </strong>
          <span>{t("widget.tokens")}</span>
        </div>
      </div>
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
