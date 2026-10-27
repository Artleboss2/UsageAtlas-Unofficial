import { app, autoUpdater, net } from "electron";
import type { DesktopUpdateState, UpdateChannel } from "../shared/desktop-api";
import {
  compareVersions,
  downloadPageURL,
  latestPublishedVersion,
  redactUpdateError,
  squirrelFeedURL,
  updateCheckURL
} from "./update-feed";

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1_000;
const FIRST_CHECK_DELAY_MS = 10_000;

export interface AutoUpdateHooks {
  capture?: (event: string) => void;
  /** Read on every check, so switching channel takes effect without a restart. */
  channel?: () => UpdateChannel;
  onStateChange?: (state: DesktopUpdateState) => void;
  onUpdateReady?: (install: () => void) => void;
}

export interface DesktopUpdater {
  getState(): DesktopUpdateState;
  check(): Promise<DesktopUpdateState>;
  /** Where a version this build cannot install in place is downloaded from. */
  downloadPageURL(): string;
}

export function configureAutoUpdates(hooks: AutoUpdateHooks = {}): DesktopUpdater {
  const enabled = app.isPackaged && process.env.USAGEATLAS_SMOKE_TEST !== "1";
  const currentVersion = app.getVersion();
  const channel = (): UpdateChannel => hooks.channel?.() ?? "upstream";
  const firstRunUntil = process.argv.includes("--squirrel-firstrun") ? Date.now() + FIRST_CHECK_DELAY_MS : 0;
  let state: DesktopUpdateState = {
    status: enabled ? "idle" : "unavailable",
    currentVersion,
    availableVersion: null,
    error: null
  };
  let initialTimer: NodeJS.Timeout | undefined;
  let timer: NodeJS.Timeout | undefined;

  function publish(patch: Partial<DesktopUpdateState>): void {
    state = { ...state, error: null, ...patch };
    hooks.onStateChange?.(state);
  }

  function stopChecking(): void {
    clearTimeout(initialTimer);
    clearInterval(timer);
  }

  function failed(error: unknown): void {
    console.error(`Update check failed: ${redactUpdateError(error instanceof Error ? error.message : "unknown")}`);
    publish({ status: "error", error: "Unable to update. Check your connection and try again." });
  }

  async function check(): Promise<DesktopUpdateState> {
    // A second Squirrel check would download the same update again.
    if (!enabled || state.status === "checking" || state.status === "downloading" || state.status === "ready") return state;
    if (Date.now() < firstRunUntil) {
      publish({ status: "error", error: "Finishing installation. Try checking again in a few seconds." });
      return state;
    }
    publish({ status: "checking", availableVersion: null });
    hooks.capture?.("desktop_update_checked");
    try {
      const feedURL = squirrelFeedURL(process.platform, process.arch, currentVersion, channel());
      if (feedURL) {
        autoUpdater.setFeedURL({ url: feedURL });
        autoUpdater.checkForUpdates();
      } else {
        // Platforms without a Squirrel feed (Linux packages, macOS on the fork)
        // are downloaded manually; the available state carries the version.
        const response = await net.fetch(updateCheckURL(channel()), {
          cache: "no-cache",
          headers: { accept: "application/vnd.github+json", "user-agent": "UsageAtlas-Desktop" },
          signal: AbortSignal.timeout(30_000)
        });
        if (!response.ok) throw new Error(`Release check returned ${response.status}`);
        const version = latestPublishedVersion(await response.json());
        if (!version) throw new Error("The release feed did not contain a valid version");
        const available = compareVersions(version, currentVersion) > 0;
        publish({ status: available ? "available" : "current", availableVersion: available ? version : null });
        if (available) hooks.capture?.("desktop_update_available");
      }
    } catch (error) {
      failed(error);
    }
    return state;
  }

  if (enabled) {
    if (squirrelFeedURL(process.platform, process.arch, currentVersion, channel())) {
      autoUpdater.on("update-available", () => {
        hooks.capture?.("desktop_update_available");
        publish({ status: "downloading" });
      });
      autoUpdater.on("update-not-available", () => publish({ status: "current", availableVersion: null }));
      autoUpdater.on("update-downloaded", (_event, _notes, releaseName) => {
        hooks.capture?.("desktop_update_downloaded");
        stopChecking();
        hooks.onUpdateReady?.(() => autoUpdater.quitAndInstall());
        publish({ status: "ready", availableVersion: releaseName || null });
      });
      autoUpdater.on("error", failed);
    }
    initialTimer = setTimeout(() => void check(), FIRST_CHECK_DELAY_MS);
    initialTimer.unref();
    timer = setInterval(() => void check(), CHECK_INTERVAL_MS);
    timer.unref();
    app.once("before-quit", stopChecking);
  }
  return { getState: () => state, check, downloadPageURL: () => downloadPageURL(channel()) };
}
