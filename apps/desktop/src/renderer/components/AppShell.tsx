import type { AppRoute, EngineStatus } from "../../shared/desktop-api";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AttributionIcon, BellIcon, DayIcon, InsightsIcon, ProfileIcon, PulseIcon, SettingsIcon, TrendsIcon } from "../icons";

interface AppShellProps {
  route: AppRoute;
  engineStatus: EngineStatus;
  /** Open health notices — the rail dot is the only place they interrupt anything. */
  noticeCount: number;
  onNavigate(route: AppRoute): void;
  /** A quiet dot on Profile until the page has been opened once. */
  profileBadge?: boolean;
  activityControl?: React.ReactNode;
  updateControl?: React.ReactNode;
  children: React.ReactNode;
}

const primaryNavigation: Array<{
  route: AppRoute;
  label: string;
  icon: (props: React.SVGProps<SVGSVGElement>) => React.JSX.Element;
}> = [
  { route: "day", label: "Today", icon: DayIcon },
  { route: "trends", label: "History", icon: TrendsIcon },
  { route: "insights", label: "Insights", icon: InsightsIcon },
  { route: "alerts", label: "Usage alerts", icon: BellIcon },
  { route: "profile", label: "Public profile", icon: ProfileIcon }
];

const routeTitles: Record<AppRoute, string> = {
  day: "Today",
  trends: "History",
  insights: "Insights",
  limits: "Limits",
  alerts: "Usage alerts",
  profile: "Public profile",
  attribution: "Attribution",
  diagnostics: "Diagnostics",
  settings: "Settings"
};

export function AppShell({ route, engineStatus, noticeCount, onNavigate, profileBadge = false, activityControl, updateControl, children }: AppShellProps): React.JSX.Element {
  const workspaceRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    workspace.scrollTop = 0;
    workspace.scrollLeft = 0;
    workspace.removeAttribute("data-scrolled");
  }, [route]);

  return (
    <div className="atlas-app-shell">
      <header aria-label="UsageAtlas" className="atlas-app-shell__titlebar drag-region">
        <div className="atlas-app-shell__brand">
          <span aria-hidden="true" className="atlas-app-shell__brand-mark">
            <img alt="" src="./usageatlas.png" />
          </span>
          <span className="atlas-app-shell__brand-name">UsageAtlas</span>
          {updateControl}
          <span aria-hidden="true" className="atlas-app-shell__brand-divider" />
          <span className="atlas-app-shell__route-name">{routeTitles[route]}</span>
          {activityControl}
        </div>
        <WindowControls />
      </header>

      <aside aria-label="Primary navigation" className="atlas-app-shell__rail no-drag">
        <nav aria-label="Main navigation" className="atlas-app-shell__navigation">
          {primaryNavigation.map((item) => (
            <RailButton
              icon={item.icon}
              badge={item.route === "profile" && profileBadge}
              isCurrent={route === item.route}
              key={item.route}
              label={item.label}
              onPress={() => onNavigate(item.route)}
            />
          ))}
        </nav>

        <nav aria-label="App controls" className="atlas-app-shell__navigation atlas-app-shell__navigation--footer">
          <RailButton
            icon={PulseIcon}
            isCurrent={route === "diagnostics"}
            label="Diagnostics"
            noticeCount={noticeCount}
            onPress={() => onNavigate("diagnostics")}
            status={engineStatus}
          />
          <RailButton
            icon={AttributionIcon}
            isCurrent={route === "attribution"}
            label="Attribution"
            onPress={() => onNavigate("attribution")}
          />
          <RailButton
            icon={SettingsIcon}
            isCurrent={route === "settings"}
            label="Settings"
            onPress={() => onNavigate("settings")}
          />
        </nav>
      </aside>

      <main className="atlas-app-shell__workspace no-drag" onScroll={handleWorkspaceScroll} ref={workspaceRef}>
        {children}
      </main>
    </div>
  );
}

/**
 * Minimize, maximize and close, drawn by the app on every platform that has no
 * native title bar of its own — the same three controls Freebuff puts in the same
 * corner. macOS keeps its traffic lights, so nothing is rendered there.
 */
function WindowControls(): React.JSX.Element | null {
  const [maximized, setMaximized] = useState(false);
  // Read once, during the first render: the shell also renders outside a browser
  // (tests, static markup) where there is no bridge and no window to draw for.
  const [platform] = useState<string | null>(() => (
    typeof window === "undefined" ? null : window.usageAtlas?.platform ?? null
  ));

  useEffect(() => {
    const api = typeof window === "undefined" ? null : window.usageAtlas;
    if (!api || api.platform === "darwin") return;
    let active = true;
    void api.getWindowState().then(value => {
      if (active) setMaximized(value);
    }, () => undefined);
    const remove = api.onWindowMaximized(setMaximized);
    return () => {
      active = false;
      remove();
    };
  }, []);

  if (!platform || platform === "darwin") return null;

  return (
    <div className="atlas-window-controls no-drag">
      <button
        aria-label="Minimize"
        className="atlas-window-controls__button"
        onClick={() => void window.usageAtlas.minimizeWindow()}
        type="button"
      >
        <svg aria-hidden="true" viewBox="0 0 12 12">
          <line x1="2" x2="10" y1="6" y2="6" />
        </svg>
      </button>
      <button
        aria-label={maximized ? "Restore" : "Maximize"}
        className="atlas-window-controls__button"
        onClick={() => void window.usageAtlas.toggleMaximizeWindow().then(setMaximized, () => undefined)}
        type="button"
      >
        {maximized ? (
          <svg aria-hidden="true" viewBox="0 0 12 12">
            <rect height="6.5" width="6.5" x="3.5" y="2.5" />
            <path d="M2.5 5.5v4h6.5" />
          </svg>
        ) : (
          <svg aria-hidden="true" viewBox="0 0 12 12">
            <rect height="7" width="7" x="2.5" y="2.5" />
          </svg>
        )}
      </button>
      <button
        aria-label="Close"
        className="atlas-window-controls__button atlas-window-controls__button--close"
        onClick={() => void window.usageAtlas.closeWindow()}
        type="button"
      >
        <svg aria-hidden="true" viewBox="0 0 12 12">
          <path d="M3 3l6 6M9 3l-6 6" />
        </svg>
      </button>
    </div>
  );
}

function handleWorkspaceScroll(event: React.UIEvent<HTMLElement>): void {
  event.currentTarget.toggleAttribute("data-scrolled", event.currentTarget.scrollTop > 12);
}

function RailButton({
  badge = false,
  icon: Icon,
  isCurrent,
  label,
  noticeCount = 0,
  onPress,
  status
}: {
  badge?: boolean;
  icon: (props: React.SVGProps<SVGSVGElement>) => React.JSX.Element;
  isCurrent: boolean;
  label: string;
  noticeCount?: number;
  onPress(): void;
  status?: EngineStatus;
}): React.JSX.Element {
  const description = status ? `${label}: ${engineLabel(status)}${noticeLabel(noticeCount)}` : badge ? `${label} · New` : label;
  return (
    <button
      aria-current={isCurrent ? "page" : undefined}
      aria-label={description}
      className="atlas-app-shell__rail-button"
      onClick={onPress}
      title={description}
      type="button"
    >
      <span className="atlas-app-shell__rail-icon">
        <Icon aria-hidden="true" />
        {status ? <StatusDot hasNotices={noticeCount > 0} status={status} /> : null}
        {badge ? <span aria-hidden="true" className="atlas-app-shell__status-dot" data-badge="true" /> : null}
      </span>
      <span className="sr-only">{description}</span>
    </button>
  );
}

function StatusDot({ hasNotices, status }: { hasNotices: boolean; status: EngineStatus }): React.JSX.Element {
  return (
    <span
      aria-hidden="true"
      className="atlas-app-shell__status-dot"
      data-notices={hasNotices ? "true" : undefined}
      data-status={status}
    />
  );
}

function noticeLabel(count: number): string {
  if (count === 0) return "";
  return ` · ${count} ${count === 1 ? "notice" : "notices"}`;
}

function engineLabel(status: EngineStatus): string {
  if (status === "ready") return "Ready";
  if (status === "starting") return "Starting";
  if (status === "degraded") return "Needs attention";
  return "Stopped";
}
