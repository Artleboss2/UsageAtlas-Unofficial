import { CloudAccount, type KnownProfileStatus } from "./cloud-account";
import { ProviderCredentialStore, configureProviderCredentials } from "./provider-credentials";
import { isQuotaProvider, validateProviderCredential } from "../shared/quota-providers";
import type { DashboardSnapshot } from "@usageatlas/contracts";
import { existsSync, mkdtempSync, statSync, writeFileSync } from "node:fs";
import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  nativeTheme,
  net,
  Notification,
  protocol,
  screen,
  session,
  shell,
  Tray,
  type IpcMainInvokeEvent,
  type MenuItemConstructorOptions
} from "electron";
import squirrelStartup from "electron-squirrel-startup";
import path from "node:path";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { isLimitKey } from "../shared/capacity-model";
import { DashboardSession } from "./dashboard-session";
import type { AppMark, AppRoute, DesktopPreferences } from "../shared/desktop-api";
import {
  IPC,
  isAccentTint,
  isAppearanceFont,
  isAppearanceSurface,
  isAppMark,
  isBackgroundImagePreference,
  isNumberStyle,
  isUpdateChannel,
  isUpdateRepository,
  sanitizeTokenAlerts
} from "../shared/desktop-api";
import { isLanguage } from "../shared/languages";
import { isUsageAlertPreferences } from "../shared/usage-alerts";
import { isGrowthEvent } from "../shared/growth-events";
import { EngineManager } from "./engine-manager";
import { PreferenceStore } from "./preferences";
import { PublicLeaderboard } from "./public-leaderboard";
import { DesktopTelemetry } from "./telemetry";
import { trayLimitLabels } from "./tray-limits";
import { configureAutoUpdates, type DesktopUpdater } from "./updates";
import { resolveUpdateSource } from "./update-feed";
import {
  createTokenAlertNotification,
  createUsageAlertNotification,
  TokenAlertEvaluator,
  UsageAlertDeliveryLog,
  UsageAlertEvaluator,
  type TriggeredTokenAlert,
  type TriggeredUsageAlert
} from "./usage-alerts";
import { UtilityEngineTransport } from "./utility-engine-transport";
import { WINDOW_ASPECT_RATIO, windowSizeForWorkArea } from "./window-sizing";

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true }
  }
]);
app.enableSandbox();
app.setName("UsageAtlas");
if (process.env.USAGEATLAS_SMOKE_TEST === "1") {
  const directory = mkdtempSync(path.join(tmpdir(), "usageatlas-smoke-"));
  app.setPath("userData", directory);
  writeFileSync(path.join(directory, "desktop-preferences.json"), JSON.stringify({
    launchAtLogin: false,
    anonymousAnalytics: false,
    providerEnabled: { codex: false, claude: false, cursor: false, opencode: false, antigravity: false, pi: false, muse: false,
      freebuff: false, warp: false, kimi: false, kilo: false, copilot: false, factory: false, amp: false, qoder: false, zai: false }
  }));
}
/** The id Squirrel registers the Start Menu shortcut and toasts under. */
const APP_USER_MODEL_ID = "com.squirrel.UsageAtlas.UsageAtlas";

/**
 * The id Windows uses to group windows, shortcuts and toasts. A development run
 * registers its own shortcut, so it gets UsageAtlas artwork instead of Electron's.
 */
const APP_DEV_USER_MODEL_ID = "com.usageatlas.desktop.dev";
const appUserModelId = app.isPackaged ? APP_USER_MODEL_ID : APP_DEV_USER_MODEL_ID;
if (process.platform === "win32") app.setAppUserModelId(appUserModelId);

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let lastTraySnapshot: DashboardSnapshot | null = null;
let usageCheckTimer: NodeJS.Timeout | null = null;
let profileCheckTimer: NodeJS.Timeout | null = null;
let profileStatusReported = false;
let isQuitting = false;
let installPendingUpdate: (() => void) | null = null;
let engine: EngineManager;
let cloudAccount: CloudAccount;
const leaderboard = new PublicLeaderboard();
let providerCredentials: ProviderCredentialStore;
let preferences: PreferenceStore;
let telemetry: DesktopTelemetry;
let dashboard: DashboardSession;
let updates: DesktopUpdater;

const activeUsageNotifications = new Set<Notification>();
let usageAlertEvaluator = new UsageAlertEvaluator();
const tokenAlertEvaluator = new TokenAlertEvaluator();
const usageAlertDeliveryLog = new UsageAlertDeliveryLog();
/** Includes the X and Bluesky composers for sharing a recap. */
const allowedExternalHosts = new Set(["usageatlas.com", "github.com", "x.com", "bsky.app"]);
const MAX_SHARE_IMAGE_LENGTH = 16 * 1024 * 1024;
const PNG_DATA_URL = "data:image/png;base64,";
const MAX_BACKGROUND_FILE_SIZE = 25 * 1024 * 1024;
const runtimeIconDirectory = app.isPackaged
  ? path.join(process.resourcesPath, "icons")
  : path.join(app.getAppPath(), "resources", "icons");

const windowChrome = {
  light: { backgroundColor: "#f5f5f7", symbolColor: "#1d1d1f" },
  dark: { backgroundColor: "#1c1c1e", symbolColor: "#f5f5f7" }
} as const;
/** Which artwork each selectable mark ships as, under the packaged icons directory. */
const appMarkFiles: Record<AppMark, { png: string; ico: string }> = {
  datamosh: { png: "usageatlas.png", ico: "usageatlas.ico" },
  classic: { png: path.join("marks", "mark-classic.png"), ico: path.join("marks", "mark-classic.ico") },
  duotone: { png: path.join("marks", "mark-duotone.png"), ico: path.join("marks", "mark-duotone.ico") }
};

/**
 * Windows draws the window, taskbar and tray artwork from an ICO with the sizes
 * the shell asks for, so the chosen mark reaches the taskbar as well as the title
 * bar. The renderer still gets the PNG, which every platform can preview.
 */
function appMarkPath(mark: AppMark, format: "png" | "ico" = "png"): string {
  return path.join(runtimeIconDirectory, appMarkFiles[mark][format]);
}

function loadAppMark(mark: AppMark, format: "png" | "ico" = "png"): Electron.NativeImage {
  const image = nativeImage.createFromPath(appMarkPath(mark, format));
  if (image.isEmpty()) throw new Error("UsageAtlas application mark could not be loaded");
  return image;
}

function trayImage(image: Electron.NativeImage): Electron.NativeImage {
  const size = process.platform === "darwin" ? 18 : 22;
  return image.resize({ width: size, height: size, quality: "best" });
}

/**
 * The shortcut Squirrel installs for this app. Windows draws the Start Menu, the
 * taskbar pin and the toast identity from it, so its icon has to follow the picker
 * as well as the window's own icon.
 */
function startMenuShortcutPath(): string {
  return path.join(app.getPath("appData"), "Microsoft", "Windows", "Start Menu", "Programs", "UsageAtlas.lnk");
}

function devShortcutPath(): string {
  return path.join(app.getPath("appData"), "Microsoft", "Windows", "Start Menu", "Programs", "UsageAtlas Dev.lnk");
}

/**
 * Windows takes the taskbar button and toast identity from a Start Menu shortcut
 * matching the process's AppUserModelID. An installed build already has one; a
 * development run creates its own, otherwise Explorer falls back to electron.exe
 * and every icon in the shell stays the stock atom. The shortcut is rewritten on
 * every launch, so a mark chosen in Settings is already right when the window
 * appears, and a restart is never needed for the shell to catch up.
 */
function applyShortcutMark(mark: AppMark): void {
  if (process.platform !== "win32" || process.env.USAGEATLAS_SMOKE_TEST === "1") return;
  const shortcut = app.isPackaged ? startMenuShortcutPath() : devShortcutPath();
  const stub = path.resolve(process.execPath, "..", "..", "UsageAtlas.exe");
  const target = app.isPackaged && existsSync(stub) ? stub : process.execPath;
  try {
    shell.writeShortcutLink(shortcut, existsSync(shortcut) ? "update" : "create", {
      target,
      cwd: path.dirname(process.execPath),
      // A development shortcut must relaunch the same app, not an empty Electron.
      args: app.isPackaged ? undefined : app.getAppPath(),
      icon: appMarkPath(mark, "ico"),
      iconIndex: 0,
      appUserModelId: app.isPackaged ? APP_USER_MODEL_ID : APP_DEV_USER_MODEL_ID,
      description: "UsageAtlas"
    });
  } catch {
    // A locked Start Menu still leaves the window, taskbar button and tray updated.
  }
  // Explorer keeps the old icon in its cache; this asks it to re-read shortcuts.
  try {
    spawn("ie4uinit.exe", ["-show"], { detached: true, stdio: "ignore", windowsHide: true }).unref();
  } catch {
    // Refreshing is cosmetic; the shortcut itself already carries the new icon.
  }
}

/** Swaps the window, taskbar, shortcut, dock and tray artwork without restarting. */
function applyAppMark(mark: AppMark): void {
  const image = loadAppMark(mark, process.platform === "win32" ? "ico" : "png");
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setIcon(image);
    if (process.platform === "win32") {
      const stub = path.resolve(process.execPath, "..", "..", "UsageAtlas.exe");
      try {
        // The taskbar button of an AppUserModelID app follows these details, not
        // only setIcon; this is what makes the picker visible in the taskbar.
        mainWindow.setAppDetails({
          appId: appUserModelId,
          appIconPath: appMarkPath(mark, "ico"),
          appIconIndex: 0,
          relaunchCommand: `"${existsSync(stub) ? stub : process.execPath}"`,
          relaunchDisplayName: "UsageAtlas"
        });
      } catch {
        // setIcon above already changed the window artwork.
      }
    }
  }
  if (process.platform === "darwin") app.dock?.setIcon(image);
  if (tray && !tray.isDestroyed()) tray.setImage(trayImage(image));
  applyShortcutMark(mark);
}

function customBackgroundPath(): string {
  return path.join(app.getPath("userData"), "custom-background.jpg");
}

function customBackgroundUrl(): string | null {
  const imagePath = customBackgroundPath();
  if (!existsSync(imagePath)) return null;
  const image = nativeImage.createFromPath(imagePath);
  return image.isEmpty() ? null : `app://usageatlas/custom-background?v=${statSync(imagePath).mtimeMs}`;
}

function systemWindowChrome(): (typeof windowChrome)[keyof typeof windowChrome] {
  return nativeTheme.shouldUseDarkColors ? windowChrome.dark : windowChrome.light;
}

function createWindow(route: AppRoute = "day"): BrowserWindow {
  const chrome = systemWindowChrome();
  const { workArea } = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const { width, height, minWidth, minHeight } = windowSizeForWorkArea(workArea);
  const window = new BrowserWindow({
    x: Math.round(workArea.x + (workArea.width - width) / 2),
    y: Math.round(workArea.y + (workArea.height - height) / 2),
    width,
    height,
    minWidth,
    minHeight,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: chrome.backgroundColor,
    // Windows draws the window and taskbar button from an ICO; handing it a PNG
    // leaves the Electron atom in place on some builds.
    icon: loadAppMark(preferences.get().appearance.mark, process.platform === "win32" ? "ico" : "png"),
    roundedCorners: true,
    // macOS keeps its traffic lights; every other platform draws its own controls
    // in the renderer's title bar, next to the window buttons the app already had.
    ...(process.platform === "darwin"
      ? { titleBarStyle: "hiddenInset" as const }
      : { titleBarStyle: "hidden" as const }),
    title: "UsageAtlas",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  });
  window.setAspectRatio(WINDOW_ASPECT_RATIO);

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternal(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, url) => {
    if (!isTrustedRendererURL(url)) event.preventDefault();
  });
  window.once("ready-to-show", () => {
    window.show();
  });
  window.on("close", (event) => {
    if (!isQuitting && preferences.get().minimizeToTray) {
      event.preventDefault();
      window.hide();
    }
  });
  window.on("closed", () => {
    if (mainWindow === window) mainWindow = null;
  });

  const syncWindowChrome = (): void => {
    window.setBackgroundColor(systemWindowChrome().backgroundColor);
  };
  nativeTheme.on("updated", syncWindowChrome);
  // The renderer draws the maximize glyph, so it is told when the state flips.
  const publishMaximized = (): void => {
    if (!window.isDestroyed()) window.webContents.send(IPC.windowMaximized, window.isMaximized());
  };
  window.on("maximize", publishMaximized);
  window.on("unmaximize", publishMaximized);
  window.once("closed", () => {
    nativeTheme.off("updated", syncWindowChrome);
    window.off("maximize", publishMaximized);
    window.off("unmaximize", publishMaximized);
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    const url = new URL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    url.hash = route;
    void window.loadURL(url.toString());
  } else {
    void window.loadURL(`app://usageatlas/index.html#${route}`);
  }
  return window;
}

function showWindow(route: AppRoute = "day"): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    mainWindow = createWindow(route);
  } else {
    mainWindow.show();
    mainWindow.focus();
    mainWindow.webContents.send(IPC.navigate, route);
  }
}

function showTokenNotification(alert: TriggeredTokenAlert): void {
  if (!Notification.isSupported()) return;
  showNotification(createTokenAlertNotification(alert), "day");
}

function showUsageNotification(alert: TriggeredUsageAlert): void {
  if (!Notification.isSupported()) return;
  if (!usageAlertDeliveryLog.allow(alert)) return;
  showNotification(createUsageAlertNotification(alert), "limits");
}

function showNotification(content: { title: string; body: string }, route: AppRoute): void {
  const notification = new Notification({
    ...content,
    // Windows shows the registered app name above the title; the title itself
    // carries the brand too, so a toast is identifiable even without a shortcut.
    title: `UsageAtlas · ${content.title}`,
    icon: loadAppMark(preferences.get().appearance.mark)
  });
  const release = (): void => {
    activeUsageNotifications.delete(notification);
  };
  notification.once("click", () => showWindow(route));
  notification.once("close", release);
  activeUsageNotifications.add(notification);
  // Windows can accept a toast and still hide it (Focus assist, per-app
  // notifications off). Mirror the alert in the window so it is never lost.
  mainWindow?.webContents.send(IPC.usageAlert, { ...content, route });
  notification.show();
}

function scheduleBackgroundUsageCheck(delayMs = 180_000): void {
  if (isQuitting) return;
  if (usageCheckTimer) clearTimeout(usageCheckTimer);
  usageCheckTimer = setTimeout(() => void runBackgroundUsageCheck(), delayMs);
  usageCheckTimer.unref();
}

async function runBackgroundUsageCheck(): Promise<void> {
  let nextDelayMs = 60_000;
  try {
    const state = await dashboard.get();
    nextDelayMs = Math.max(30, Math.min(state.snapshot?.staleAfterSeconds ?? 180, 300)) * 1_000;
  } catch {
    // The next scheduled check retries without surfacing provider details in logs.
  } finally {
    scheduleBackgroundUsageCheck(nextDelayMs);
  }
}

function createTray(): void {
  tray = new Tray(trayImage(loadAppMark(preferences.get().appearance.mark)));
  tray.setToolTip("UsageAtlas");
  updateTrayMenu();
  if (process.platform !== "darwin") {
    tray.on("click", () => showWindow("day"));
  }
}

function updateTrayMenu(snapshot: DashboardSnapshot | null = lastTraySnapshot): void {
  if (snapshot) lastTraySnapshot = snapshot;
  if (!tray || tray.isDestroyed()) return;

  const { limitOrder, trayLimits } = preferences.get();
  const labels = snapshot ? trayLimitLabels(snapshot, limitOrder, trayLimits) : [];
  const limitRows: MenuItemConstructorOptions[] = snapshot
    ? labels.length > 0
      ? labels.map((label) => ({ label, enabled: false }))
      : [{ label: "No limits switched on", enabled: false }]
    : [{ label: "Loading available limits...", enabled: false }];

  const updateRows: MenuItemConstructorOptions[] = installPendingUpdate
    ? [
        { label: "Restart to install update", click: () => installPendingUpdate?.() },
        { type: "separator" }
      ]
    : [];

  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Available limits", enabled: false },
    ...limitRows,
    { type: "separator" },
    ...updateRows,
    { label: "Open UsageAtlas", click: () => showWindow("day") },
    { label: "View all limits", click: () => showWindow("limits") },
    {
      label: "Refresh usage",
      click: () => {
        void dashboard.refresh(true);
      }
    },
    { type: "separator" },
    { label: "Settings", click: () => showWindow("settings") },
    { label: "Diagnostics", click: () => showWindow("diagnostics") },
    { type: "separator" },
    { label: "Quit", click: () => { isQuitting = true; app.quit(); } }
  ]));
}

function registerIPC(): void {
  ipcMain.handle(IPC.getProviderCredentials, event => {
    assertTrustedSender(event);
    return providerCredentials.statuses();
  });
  ipcMain.handle(IPC.setProviderCredential, async (event, id: unknown, raw: unknown) => {
    assertTrustedSender(event);
    if (!isQuotaProvider(id)) throw new Error("Unsupported provider connection.");
    const credential = validateProviderCredential(id, raw);
    const state = await dashboard.setProviderEnabled(id, credential !== null, async () => {
      providerCredentials.save(id, credential);
      await engine.updateConfig({ provider: id, credential: credential ? { ...credential } : null });
      preferences.update({ providerEnabled: { ...preferences.get().providerEnabled, [id]: credential !== null } });
    });
    if (state.error) throw new Error(state.error);
    return providerCredentials.statuses();
  });
  ipcMain.handle(IPC.getUpdateState, (event) => {
    assertTrustedSender(event);
    return updates.getState();
  });
  ipcMain.handle(IPC.checkForUpdates, (event) => {
    assertTrustedSender(event);
    return updates.check();
  });
  ipcMain.handle(IPC.rollbackUpdate, (event) => {
    assertTrustedSender(event);
    return updates.rollback();
  });
  ipcMain.handle(IPC.installUpdate, async (event) => {
    assertTrustedSender(event);
    if (updates.getState().status === "ready" && installPendingUpdate) installPendingUpdate();
    else if (updates.getState().status === "available") await shell.openExternal(updates.downloadPageURL());
    else throw new Error("No update is ready to install.");
  });
  ipcMain.handle(IPC.cloudStatus, (event) => {
    assertTrustedSender(event);
    return cloudAccount.status();
  });
  ipcMain.handle(IPC.cloudAction, async (event, action: unknown, options: unknown) => {
    assertTrustedSender(event);
    if (action === "sign-in") await cloudAccount.signIn();
    else if (action === "sign-out") await cloudAccount.signOut();
    else if (action === "save" || action === "restore") await cloudAccount.operation(action);
    else if (action === "refresh-profile") await cloudAccount.refreshProfile();
    else if (action === "automatic" && options && typeof options === "object" && "enabled" in options && typeof options.enabled === "boolean") {
      await cloudAccount.operation(action, { enabled: options.enabled });
    } else if (action === "resolve" && options && typeof options === "object" && "recordId" in options && typeof options.recordId === "string" && "choice" in options && (options.choice === "local" || options.choice === "cloud")) {
      await cloudAccount.operation(action, { recordId: options.recordId, choice: options.choice });
    } else throw new Error("Invalid cloud action.");
    return cloudAccount.status();
  });
  ipcMain.handle(IPC.checkHandle, (event, handle: unknown) => {
    assertTrustedSender(event);
    if (typeof handle !== "string") throw new Error("Invalid handle.");
    return cloudAccount.handleAvailable(handle);
  });
  ipcMain.handle(IPC.getLeaderboard, (event) => {
    assertTrustedSender(event);
    return leaderboard.glance();
  });
  // The window refuses every permission, including the web clipboard.
  ipcMain.handle(IPC.copyText, (event, text: unknown) => {
    assertTrustedSender(event);
    if (typeof text !== "string" || !text || text.length > 4096) throw new Error("Invalid text.");
    clipboard.writeText(text);
  });
  ipcMain.handle(IPC.copyImage, (event, png: unknown) => {
    assertTrustedSender(event);
    clipboard.writeImage(sharedImage(png));
  });
  ipcMain.handle(IPC.saveImage, async (event, png: unknown, fileName: unknown) => {
    assertTrustedSender(event);
    const image = sharedImage(png);
    if (typeof fileName !== "string" || !/^[a-z0-9-]{1,80}\.png$/u.test(fileName)) throw new Error("Invalid file name.");
    const owner = BrowserWindow.fromWebContents(event.sender);
    const options: Electron.SaveDialogOptions = {
      title: "Save image",
      defaultPath: path.join(app.getPath("downloads"), fileName),
      filters: [{ name: "PNG image", extensions: ["png"] }]
    };
    const result = owner ? await dialog.showSaveDialog(owner, options) : await dialog.showSaveDialog(options);
    if (result.canceled || !result.filePath) return false;
    writeFileSync(result.filePath, image.toPNG());
    return true;
  });
  ipcMain.handle(IPC.trackGrowthEvent, (event, name: unknown, properties: unknown) => {
    assertTrustedSender(event);
    if (!isGrowthEvent(name, properties)) throw new Error("Invalid analytics event.");
    telemetry.capture(name, properties as Record<string, string>);
  });
  ipcMain.handle(IPC.snapshot, (event) => {
    assertTrustedSender(event);
    return dashboard.get();
  });
  ipcMain.handle(IPC.refreshAll, (event) => {
    assertTrustedSender(event);
    return dashboard.refresh(true);
  });
  ipcMain.handle(IPC.setProviderEnabled, async (event, providerID: unknown, enabled: unknown) => {
    assertTrustedSender(event);
    if (typeof providerID !== "string" || !/^[a-z0-9-]{1,64}$/u.test(providerID)) {
      throw new Error("Invalid provider identifier");
    }
    if (typeof enabled !== "boolean") throw new Error("Invalid provider state");
    const current = preferences.get().providerEnabled;
    preferences.update({ providerEnabled: { ...current, [providerID]: enabled } });
    return dashboard.setProviderEnabled(providerID, enabled);
  });
  ipcMain.handle(IPC.setReportPlans, async (event) => {
    assertTrustedSender(event);
    // Cloud saves report the provider that actually produced the usage. The old
    // relabelling rules are cleared so no stored rule survives an upgrade.
    const next = preferences.update({ reportPlans: [] });
    await engine.setReportPlans([]);
    return next;
  });
  ipcMain.handle(IPC.minimizeWindow, (event) => {
    assertTrustedSender(event);
    BrowserWindow.fromWebContents(event.sender)?.minimize();
  });
  ipcMain.handle(IPC.toggleMaximizeWindow, (event) => {
    assertTrustedSender(event);
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return false;
    if (window.isMaximized()) window.unmaximize();
    else window.maximize();
    return window.isMaximized();
  });
  ipcMain.handle(IPC.closeWindow, (event) => {
    assertTrustedSender(event);
    // Goes through the window's own close handler, so minimize-to-tray still applies.
    BrowserWindow.fromWebContents(event.sender)?.close();
  });
  ipcMain.handle(IPC.getWindowState, (event) => {
    assertTrustedSender(event);
    return BrowserWindow.fromWebContents(event.sender)?.isMaximized() ?? false;
  });
  ipcMain.handle(IPC.getPreferences, (event) => {
    assertTrustedSender(event);
    return preferences.get();
  });
  ipcMain.handle(IPC.updatePreferences, (event, patch: unknown) => {
    assertTrustedSender(event);
    if (!isPreferencePatch(patch)) throw new Error("Invalid preferences update");
    const previous = preferences.get();
    const nextPreferences = preferences.update(patch);
    if (previous.anonymousAnalytics !== nextPreferences.anonymousAnalytics) {
      telemetry.setEnabled(nextPreferences.anonymousAnalytics);
    }
    // A different publisher, or a different repository on the custom channel, is
    // checked against the new feed right away.
    if (previous.updateChannel !== nextPreferences.updateChannel || previous.updateRepository !== nextPreferences.updateRepository) {
      void updates.check().catch(() => undefined);
    }
    if (previous.appearance.mark !== nextPreferences.appearance.mark) {
      applyAppMark(nextPreferences.appearance.mark);
    }
    updateTrayMenu();
    return nextPreferences;
  });
  ipcMain.handle(IPC.getAppMarks, (event) => {
    assertTrustedSender(event);
    return Object.fromEntries(Object.keys(appMarkFiles).map(mark => [mark, loadAppMark(mark as AppMark).toDataURL()])) as Record<AppMark, string>;
  });
  ipcMain.handle(IPC.sendTestAlert, (event, tokens: unknown, providerName: unknown) => {
    assertTrustedSender(event);
    const safeTokens = typeof tokens === "number" && Number.isFinite(tokens) ? Math.max(0, Math.round(tokens)) : 12_400;
    const safeName = typeof providerName === "string" && providerName.trim().length > 0 && providerName.length <= 80
      ? providerName.trim() : "a source";
    if (!Notification.isSupported()) return false;
    showNotification(createTokenAlertNotification({ providerID: "test", providerName: safeName, tokens: safeTokens }), "alerts");
    return true;
  });
  ipcMain.handle(IPC.getCustomBackground, (event) => {
    assertTrustedSender(event);
    return customBackgroundUrl();
  });
  ipcMain.handle(IPC.chooseCustomBackground, async (event) => {
    assertTrustedSender(event);
    const owner = BrowserWindow.fromWebContents(event.sender);
    const options: Electron.OpenDialogOptions = {
      title: "Choose a background image",
      properties: ["openFile"],
      filters: [{ name: "Images", extensions: ["jpg", "jpeg", "png", "webp"] }]
    };
    const result = owner
      ? await dialog.showOpenDialog(owner, options)
      : await dialog.showOpenDialog(options);
    if (result.canceled || !result.filePaths[0]) return null;

    const sourcePath = result.filePaths[0];
    if (statSync(sourcePath).size > MAX_BACKGROUND_FILE_SIZE) {
      throw new Error("Choose an image smaller than 25 MB.");
    }
    const image = nativeImage.createFromPath(sourcePath);
    if (image.isEmpty()) throw new Error("The selected file is not a supported image.");

    const encodedImage = image.toJPEG(90);
    writeFileSync(customBackgroundPath(), encodedImage, { mode: 0o600 });
    const nextPreferences = preferences.update({
      backgroundImage: "custom",
      customBackgroundName: path.basename(sourcePath)
    });
    const imageUrl = customBackgroundUrl();
    if (!imageUrl) throw new Error("The background image could not be saved.");
    return { preferences: nextPreferences, imageUrl };
  });
  ipcMain.handle(IPC.getDiagnostics, (event) => {
    assertTrustedSender(event);
    return engine.getDiagnostics();
  });
  ipcMain.handle(IPC.openExternal, (event, url: unknown) => {
    assertTrustedSender(event);
    if (typeof url !== "string" || !isAllowedExternal(url)) return false;
    return shell.openExternal(url).then(() => true);
  });
}

/** Reports the share of installs with a public profile once per launch, and each publish seen. */
function reportProfile(accountId: string, profile: KnownProfileStatus): void {
  const previous = preferences.recordProfileState(accountId, profile.state);
  if (!profileStatusReported) {
    profileStatusReported = true;
    telemetry.capture("profile_status_checked", { state: profile.state });
  }
  if (profile.state === "public" && previous !== null && previous !== "public")
    telemetry.capture("profile_published", { previous_state: previous });
}

function assertTrustedSender(event: IpcMainInvokeEvent): void {
  const frame = event.senderFrame;
  if (!frame || frame !== frame.top || !isTrustedRendererURL(frame.url)) {
    throw new Error("Untrusted IPC sender");
  }
}

function isTrustedRendererURL(value: string): boolean {
  try {
    const candidate = new URL(value);
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      return candidate.origin === new URL(MAIN_WINDOW_VITE_DEV_SERVER_URL).origin;
    }
    return candidate.protocol === "app:" && candidate.hostname === "usageatlas";
  } catch {
    return false;
  }
}

/** A PNG the renderer drew, decoded and re-encoded before it reaches the clipboard or disk. */
function sharedImage(value: unknown): Electron.NativeImage {
  if (typeof value !== "string" || !value.startsWith(PNG_DATA_URL) || value.length > MAX_SHARE_IMAGE_LENGTH) throw new Error("Invalid image.");
  const image = nativeImage.createFromBuffer(Buffer.from(value.slice(PNG_DATA_URL.length), "base64"));
  if (image.isEmpty()) throw new Error("Invalid image.");
  return image;
}

function isAllowedExternal(value: string): boolean {
  try {
    const candidate = new URL(value);
    return candidate.protocol === "https:" && allowedExternalHosts.has(candidate.hostname);
  } catch {
    return false;
  }
}

function isPreferencePatch(value: unknown): value is Partial<DesktopPreferences> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const patch = value as Record<string, unknown>;
  if (Object.keys(patch).some((key) => !["launchAtLogin", "minimizeToTray", "anonymousAnalytics", "backgroundImage", "usageAlerts", "tokenAlerts", "appearance", "language", "limitOrder", "trayLimits", "updateChannel", "updateRepository"].includes(key))) {
    return false;
  }
  return (patch.launchAtLogin === undefined || typeof patch.launchAtLogin === "boolean")
    && (patch.language === undefined || isLanguage(patch.language))
    && (patch.appearance === undefined || isAppearancePatch(patch.appearance))
    && (patch.tokenAlerts === undefined || isTokenAlertPatch(patch.tokenAlerts))
    && (patch.minimizeToTray === undefined || typeof patch.minimizeToTray === "boolean")
    && (patch.anonymousAnalytics === undefined || typeof patch.anonymousAnalytics === "boolean")
    && (patch.backgroundImage === undefined || isBackgroundImagePreference(patch.backgroundImage))
    && (patch.limitOrder === undefined || (
      Array.isArray(patch.limitOrder)
      && patch.limitOrder.length <= 128
      && patch.limitOrder.every(isLimitKey)
    ))
    && (patch.trayLimits === undefined || isTrayLimitPatch(patch.trayLimits))
    && (patch.updateChannel === undefined || isUpdateChannel(patch.updateChannel))
    && (patch.updateRepository === undefined || isUpdateRepository(patch.updateRepository))
    && (patch.usageAlerts === undefined || isUsageAlertPreferences(patch.usageAlerts));
}

function isAppearancePatch(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const patch = value as Record<string, unknown>;
  if (Object.keys(patch).some((key) => !["font", "fontScale", "textColor", "mark", "numberStyle", "accent", "surface", "animate"].includes(key))) return false;
  return (patch.font === undefined || isAppearanceFont(patch.font))
    && (patch.mark === undefined || isAppMark(patch.mark))
    && (patch.numberStyle === undefined || isNumberStyle(patch.numberStyle))
    && (patch.accent === undefined || isAccentTint(patch.accent))
    && (patch.surface === undefined || isAppearanceSurface(patch.surface))
    && (patch.animate === undefined || typeof patch.animate === "boolean")
    && (patch.fontScale === undefined || (
      typeof patch.fontScale === "number"
      && Number.isFinite(patch.fontScale)
      && patch.fontScale >= 0.85
      && patch.fontScale <= 1.3
    ))
    && (patch.textColor === undefined || patch.textColor === null
      || (typeof patch.textColor === "string" && /^#[0-9a-f]{6}$/iu.test(patch.textColor)));
}

function isTokenAlertPatch(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const patch = value as Record<string, unknown>;
  if (Object.keys(patch).some((key) => !["enabled", "thresholdTokens"].includes(key))) return false;
  const sanitized = sanitizeTokenAlerts(patch);
  return (patch.enabled === undefined || typeof patch.enabled === "boolean")
    && (patch.thresholdTokens === undefined || (
      typeof patch.thresholdTokens === "number"
      && Number.isSafeInteger(patch.thresholdTokens)
      && patch.thresholdTokens >= 1_000
      && patch.thresholdTokens <= 1_000_000_000
      && sanitized.thresholdTokens === patch.thresholdTokens
    ));
}

function isTrayLimitPatch(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const entries = Object.entries(value as Record<string, unknown>);
  return entries.length <= 128
    && entries.every(([key, shown]) => isLimitKey(key) && typeof shown === "boolean");
}

async function registerApplicationProtocol(): Promise<void> {
  const rendererRoot = path.resolve(__dirname, "../renderer", MAIN_WINDOW_VITE_NAME);
  protocol.handle("app", (request) => {
    const parsed = new URL(request.url);
    if (parsed.hostname !== "usageatlas") return new Response("Not found", { status: 404 });
    if (parsed.pathname === "/custom-background") {
      const imagePath = customBackgroundPath();
      return existsSync(imagePath)
        ? net.fetch(pathToFileURL(imagePath).toString())
        : new Response("Not found", { status: 404 });
    }
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) return new Response("Not found", { status: 404 });
    const relativePath = decodeURIComponent(parsed.pathname).replace(/^\/+/, "") || "index.html";
    const requestedPath = path.resolve(rendererRoot, relativePath);
    if (requestedPath !== rendererRoot && !requestedPath.startsWith(`${rendererRoot}${path.sep}`)) {
      return new Response("Not found", { status: 404 });
    }
    return net.fetch(pathToFileURL(requestedPath).toString());
  });
}

/*
 * One copy of the app per computer. Squirrel leaves the previous version running
 * after an update, and several builds sharing this profile fight over the history
 * database and keep the old build's taskbar icon in front of the new one.
 */
const hasSingleInstanceLock = squirrelStartup || app.requestSingleInstanceLock();
app.on("second-instance", () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
});

if (squirrelStartup || !hasSingleInstanceLock) {
  app.quit();
} else void app.whenReady().then(async () => {
  if (process.platform === "darwin") app.dock?.setIcon(loadAppMark("datamosh"));
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  await registerApplicationProtocol();
  preferences = new PreferenceStore();
  providerCredentials = new ProviderCredentialStore(path.join(app.getPath("userData"), "provider-credentials"));
  telemetry = new DesktopTelemetry(preferences);
  engine = new EngineManager(
    () => new UtilityEngineTransport(
      path.join(__dirname, "engine-entry.js"),
      path.join(app.getPath("userData"), "history.sqlite")
    )
  );
  engine.onStatus((status) => mainWindow?.webContents.send(IPC.engineStatus, status));
  dashboard = new DashboardSession(engine, state => {
    if (isQuitting) return;
    lastTraySnapshot = state.snapshot;
    if (!state.snapshot) usageAlertEvaluator = new UsageAlertEvaluator();
    updateTrayMenu(state.snapshot);
    mainWindow?.webContents.send(IPC.snapshotUpdated, state);
  }, snapshot => {
    const alerts = usageAlertEvaluator.evaluate(snapshot, preferences.get().usageAlerts);
    for (const alert of alerts) showUsageNotification(alert);
    for (const alert of tokenAlertEvaluator.evaluate(snapshot, preferences.get().tokenAlerts)) showTokenNotification(alert);
  });
  engine.onProgress(progress => dashboard.progress(progress));
  engine.onImportProgress(message => dashboard.importProgress(message.accountId, message.progress));
  cloudAccount = new CloudAccount(engine, (accountId, configure, reconnect) =>
    dashboard.configure(accountId, configure, reconnect), reportProfile);
  engine.onHistoryChanged(() => dashboard.historyChanged());
  await cloudAccount.initialize().catch(() => undefined);
  await configureProviderCredentials(providerCredentials, engine);
  engine.onStatus(status => {
    if (status === "ready") void configureProviderCredentials(providerCredentials, engine).then(() => engine.applyProviderPreferences(preferences.get().providerEnabled))
      .then(() => engine.setReportPlans([]))
      .then(() => cloudAccount.reconnect()).catch(() => undefined);
  });
  await engine.applyProviderPreferences(preferences.get().providerEnabled);
  // No relabelling: an unsupported source stays on this computer instead of
  // being uploaded under another provider's name.
  await engine.setReportPlans([]);
  dashboard.activate();
  registerIPC();
  createTray();
  // Write the shell shortcut before the first window exists: Windows resolves a
  // taskbar button's identity when it is created, so doing this afterwards would
  // leave the first launch of a new build on the previous icon.
  applyAppMark(preferences.get().appearance.mark);
  mainWindow = createWindow();
  applyAppMark(preferences.get().appearance.mark);
  telemetry.capture("desktop_app_opened");
  if (cloudAccount.profileStatus().state === "signed-out") {
    profileStatusReported = true;
    telemetry.capture("profile_status_checked", { state: "signed-out" });
  }
  void cloudAccount.refreshProfile();
  // A profile published on the website shows up here within ten minutes.
  profileCheckTimer = setInterval(() => void cloudAccount.refreshProfile(), 10 * 60_000);
  profileCheckTimer.unref();
  updates = configureAutoUpdates({
    capture: (event) => telemetry.capture(event),
    // Read per check, so switching publisher takes effect on the next one.
    source: () => resolveUpdateSource(preferences.get().updateChannel, preferences.get().updateRepository),
    onStateChange: (state) => {
      if (state.status === "error") {
        if (installPendingUpdate) isQuitting = false;
        installPendingUpdate = null;
        updateTrayMenu();
      }
      mainWindow?.webContents.send(IPC.updateStateChanged, state);
    },
    onUpdateReady: (install) => {
      // The close handler keeps the window alive when minimize-to-tray is on,
      // which would stall the Squirrel restart.
      installPendingUpdate = () => {
        if (isQuitting) return;
        isQuitting = true;
        try { install(); } catch (error) { isQuitting = false; throw error; }
      };
      updateTrayMenu();
    }
  });
  scheduleBackgroundUsageCheck();
  if (process.env.USAGEATLAS_SMOKE_TEST === "1") void runPackagedSmokeTest(mainWindow);
  app.on("activate", () => showWindow());
});

app.on("before-quit", () => {
  isQuitting = true;
  if (usageCheckTimer) clearTimeout(usageCheckTimer);
  usageCheckTimer = null;
  if (profileCheckTimer) clearInterval(profileCheckTimer);
  profileCheckTimer = null;
  cloudAccount?.close();
  dashboard?.close();
  void engine?.shutdown();
  void telemetry?.shutdown();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin" && !preferences?.get().minimizeToTray) app.quit();
});

async function runPackagedSmokeTest(window: BrowserWindow): Promise<void> {
  try {
    if (!app.isPackaged) throw new Error("Packaged smoke mode requires a packaged application");
    await waitForRenderer(window);
    const rendererReady = await window.webContents.executeJavaScript(`(async () => {
      if (!window.usageAtlas) return false;
      for (let attempt = 0; attempt < 100 && !document.querySelector("#root")?.childElementCount; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      if (!document.querySelector("#root")?.childElementCount) return false;
      const state = await window.usageAtlas.getSnapshot();
      const preferences = await window.usageAtlas.getPreferences();
      return Number.isInteger(state.revision) && preferences.anonymousAnalytics === false;
    })()`);
    if (!rendererReady) throw new Error("Renderer or preload API did not initialize");
    await engine.getSnapshot();
    await engine.shutdown();
    tray?.destroy();
    window.destroy();
    app.exit(0);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Packaged smoke test failed");
    tray?.destroy();
    if (!window.isDestroyed()) window.destroy();
    app.exit(1);
  }
}

async function waitForRenderer(window: BrowserWindow): Promise<void> {
  if (window.webContents.getURL() && !window.webContents.isLoadingMainFrame()) return;
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Renderer smoke test timed out"));
    }, 15_000);
    timeout.unref();
    const cleanup = (): void => {
      clearTimeout(timeout);
      window.webContents.off("did-finish-load", handleLoaded);
      window.webContents.off("did-fail-load", handleFailed);
    };
    const handleLoaded = (): void => {
      cleanup();
      resolve();
    };
    const handleFailed = (
      _event: Electron.Event,
      errorCode: number,
      errorDescription: string,
      validatedURL: string,
      isMainFrame: boolean
    ): void => {
      if (!isMainFrame) return;
      cleanup();
      reject(new Error(`Renderer failed to load ${validatedURL}: ${errorCode} ${errorDescription}`));
    };
    window.webContents.once("did-finish-load", handleLoaded);
    window.webContents.on("did-fail-load", handleFailed);
  });
}
