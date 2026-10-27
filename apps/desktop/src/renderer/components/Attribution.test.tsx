import type { DashboardProvider } from "@usageatlas/contracts";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { DesktopPreferences } from "../../shared/desktop-api";
import type { ReportAlias } from "../../shared/report-aliases";
import { Attribution } from "./Attribution";

describe("Attribution rules", () => {
  it("shows a source relabelled under an official provider", () => {
    const html = render(
      [provider({ id: "freebuff", name: "Freebuff" }), provider()],
      [{ source: "freebuff", reportAs: "codex", model: "gpt-5.3-codex" }]
    );

    expect(html).toContain("Freebuff");
    expect(html).toContain('value="freebuff"');
    expect(html).toContain('value="codex"');
    expect(html).toContain('value="gpt-5.3-codex"');
    expect(html).toContain("Save rules");
    expect(html).toContain('aria-label="Remove the rule for freebuff"');
  });

  it("says nothing is relabelled until a rule exists", () => {
    const html = render([provider({ id: "freebuff", name: "Freebuff" })]);

    expect(html).toContain("No rule yet. Every source is saved under its own name.");
    expect(html).toContain("Add rule");
    expect(html).not.toContain('value="gpt-5.3-codex"');
  });

  it("offers no more rules once every source has one", () => {
    const html = render(
      [provider({ id: "freebuff", name: "Freebuff" }), provider({ id: "zai", name: "z.ai" })],
      [
        { source: "freebuff", reportAs: "codex", model: "gpt-5.3-codex" },
        { source: "zai", reportAs: "claude", model: "claude-sonnet-4-5" }
      ]
    );

    expect(html).toContain('aria-label="Remove the rule for freebuff"');
    expect(html).toContain('aria-label="Remove the rule for zai"');
    expect(html).toContain('disabled=""');
  });

  it("explains the round trip the rule makes", () => {
    const html = render([]);

    expect(html).toContain("this computer keeps counting Freebuff tokens");
    expect(html).toContain("the uploaded usage arrives as Codex");
  });
});

function render(providers: DashboardProvider[], reportAliases: ReportAlias[] = []): string {
  return renderToStaticMarkup(
    <Attribution
      onSave={vi.fn()}
      preferences={preferences(reportAliases)}
      providers={providers}
      saving={false}
    />
  );
}

function provider(overrides: Partial<DashboardProvider> = {}): DashboardProvider {
  return {
    id: "codex",
    name: "Codex",
    enabled: true,
    source: "oauth",
    windows: [],
    identity: null,
    credits: null,
    analytics: null,
    error: null,
    updatedAt: "2026-08-15T00:00:00.000Z",
    ...overrides
  };
}

function preferences(reportAliases: ReportAlias[]): DesktopPreferences {
  return {
    reportAliases,
    backgroundImage: "mist",
    customBackgroundName: null,
    launchAtLogin: false,
    minimizeToTray: true,
    anonymousAnalytics: true,
    providerEnabled: {},
    limitOrder: [],
    trayLimits: {},
    usageAlerts: {}
  };
}
