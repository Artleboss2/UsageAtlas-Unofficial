import type { DashboardProvider } from "@usageatlas/contracts";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { DesktopPreferences } from "../../shared/desktop-api";
import { UsageAlertsPage } from "./UsageAlertsPage";

describe("UsageAlertsPage", () => {
  it("renders each usage alert as an interactive switch", () => {
    const html = renderToStaticMarkup(
      <UsageAlertsPage
        preferences={preferences}
        providers={[provider]}
        saving={false}
        onUpdate={vi.fn()}
      />,
    );

    expect(html).toContain('data-slot="switch-content"');
    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-label="Claude 5-hour usage alert"');
  });

  it("previews the daily token notification in the exact wording it sends", () => {
    const html = renderToStaticMarkup(
      <UsageAlertsPage
        preferences={preferences}
        providers={[provider]}
        saving={false}
        onUpdate={vi.fn()}
      />,
    );

    expect(html).toContain("Daily token alert");
    expect(html).toContain("You used 100,000 tokens on Claude today.");
  });
});

const preferences: DesktopPreferences = {
  appearance: { font: "system", fontScale: 1, textColor: null, mark: "datamosh" },
  tokenAlerts: { enabled: true, thresholdTokens: 100_000 },
  reportPlans: [],
  updateChannel: "fork",
    updateRepository: "",
  anonymousAnalytics: true,
    backgroundImage: "mist",
  customBackgroundName: null,
  launchAtLogin: false,
  limitOrder: [],
  minimizeToTray: true,
  providerEnabled: {},
  trayLimits: {},
  usageAlerts: {},
};

const provider: DashboardProvider = {
  analytics: null,
  enabled: true,
  id: "claude",
  name: "Claude",
  source: "fixture",
  windows: [{
    kind: "session",
    label: "5-hour",
    remainingPercent: 75,
    usedPercent: 25,
  }],
};
