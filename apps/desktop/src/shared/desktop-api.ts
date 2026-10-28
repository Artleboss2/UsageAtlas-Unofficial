import type { DashboardSnapshot } from "@usageatlas/contracts";
import type { GrowthEvent, GrowthEventProperties } from "./growth-events";
import type { ProviderCredential, ProviderCredentialStatus, QuotaProviderId } from "./quota-providers";
import type { ReportPlan } from "./report-plans";
import type { Language } from "./languages";

export type AppRoute = "day" | "trends" | "insights" | "limits" | "alerts" | "profile" | "attribution" | "settings" | "diagnostics";
export type EngineStatus = "starting" | "ready" | "degraded" | "stopped";

export interface DesktopUpdateState {
  status: "idle" | "checking" | "current" | "downloading" | "ready" | "available" | "error" | "unavailable";
  currentVersion: string;
  availableVersion: string | null;
  error: string | null;
}

export interface UsageAlertRule {
  enabled: boolean;
  thresholdPercent: number;
}

export type UsageAlertPreferences = Record<string, Record<string, UsageAlertRule>>;

/**
 * The typography choices offered in Settings → Appearance. Every family ships as a
 * bundled variable font, so a choice never depends on what the machine has installed.
 */
export const APPEARANCE_FONTS = ["system", "inter", "manrope", "figtree", "jakarta", "geist"] as const;
export type AppearanceFont = (typeof APPEARANCE_FONTS)[number];

/** Application marks the title bar and the window icon can use. */
export const APP_MARKS = ["datamosh", "classic", "duotone"] as const;
export type AppMark = (typeof APP_MARKS)[number];

/**
 * A daily token alert: once a source passes the threshold, the app says exactly
 * how many tokens it used. Unlike capacity rules it needs no provider quota
 * window, so it works for every local history reader.
 */
export interface TokenAlertPreferences {
  enabled: boolean;
  thresholdTokens: number;
}

export const DEFAULT_TOKEN_ALERTS: TokenAlertPreferences = {
  enabled: true,
  thresholdTokens: 100_000
};

export function sanitizeTokenAlerts(value: unknown): TokenAlertPreferences {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ...DEFAULT_TOKEN_ALERTS };
  const record = value as Record<string, unknown>;
  const threshold = typeof record.thresholdTokens === "number" && Number.isFinite(record.thresholdTokens)
    ? Math.min(1_000_000_000, Math.max(1_000, Math.round(record.thresholdTokens)))
    : DEFAULT_TOKEN_ALERTS.thresholdTokens;
  return {
    enabled: typeof record.enabled === "boolean" ? record.enabled : DEFAULT_TOKEN_ALERTS.enabled,
    thresholdTokens: threshold
  };
}

/**
 * How big figures are spelled in the interface. `exact` prints every digit
 * (`1,284,930`); `compact` shortens them to a unit (`1.3M`), which is the only
 * honest choice for dense chart axes.
 */
export const NUMBER_STYLES = ["exact", "compact"] as const;
export type NumberStyle = (typeof NUMBER_STYLES)[number];

/** Accent tints offered in Settings → Appearance. `system` keeps the theme's own. */
export const ACCENT_TINTS = ["system", "ink", "cobalt", "violet", "rose", "forest", "amber"] as const;
export type AccentTint = (typeof ACCENT_TINTS)[number];

/** Glass keeps the translucent material; solid paints every card with the surface. */
export const APPEARANCE_SURFACES = ["glass", "solid"] as const;
export type AppearanceSurface = (typeof APPEARANCE_SURFACES)[number];

export interface AppearancePreferences {
  font: AppearanceFont;
  /** Root type scale, 0.85–1.3. */
  fontScale: number;
  /** A `#rrggbb` ink colour, or null for the theme's own text colour. */
  textColor: string | null;
  mark: AppMark;
  numberStyle: NumberStyle;
  accent: AccentTint;
  surface: AppearanceSurface;
  /** Page slides, rail highlight and hover motion. */
  animate: boolean;
}

export const DEFAULT_APPEARANCE: AppearancePreferences = {
  font: "system",
  fontScale: 1,
  textColor: null,
  mark: "datamosh",
  // Full figures by default: a token count is a measurement, not a headline.
  numberStyle: "exact",
  accent: "system",
  surface: "glass",
  animate: true
};
const appearanceFontSet = new Set<string>(APPEARANCE_FONTS);
const appMarkSet = new Set<string>(APP_MARKS);
const numberStyleSet = new Set<string>(NUMBER_STYLES);
const accentTintSet = new Set<string>(ACCENT_TINTS);
const appearanceSurfaceSet = new Set<string>(APPEARANCE_SURFACES);

export function isAppearanceFont(value: unknown): value is AppearanceFont {
  return typeof value === "string" && appearanceFontSet.has(value);
}

export function isAppMark(value: unknown): value is AppMark {
  return typeof value === "string" && appMarkSet.has(value);
}

export function isNumberStyle(value: unknown): value is NumberStyle {
  return typeof value === "string" && numberStyleSet.has(value);
}

export function isAccentTint(value: unknown): value is AccentTint {
  return typeof value === "string" && accentTintSet.has(value);
}

export function isAppearanceSurface(value: unknown): value is AppearanceSurface {
  return typeof value === "string" && appearanceSurfaceSet.has(value);
}

export function sanitizeAppearance(value: unknown): AppearancePreferences {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ...DEFAULT_APPEARANCE };
  const record = value as Record<string, unknown>;
  const scale = typeof record.fontScale === "number" && Number.isFinite(record.fontScale)
    ? Math.min(1.3, Math.max(0.85, Math.round(record.fontScale * 100) / 100))
    : DEFAULT_APPEARANCE.fontScale;
  const textColor = typeof record.textColor === "string" && /^#[0-9a-f]{6}$/iu.test(record.textColor)
    ? record.textColor.toLowerCase()
    : null;
  return {
    font: isAppearanceFont(record.font) ? record.font : DEFAULT_APPEARANCE.font,
    fontScale: scale,
    textColor,
    mark: isAppMark(record.mark) ? record.mark : DEFAULT_APPEARANCE.mark,
    numberStyle: isNumberStyle(record.numberStyle) ? record.numberStyle : DEFAULT_APPEARANCE.numberStyle,
    accent: isAccentTint(record.accent) ? record.accent : DEFAULT_APPEARANCE.accent,
    surface: isAppearanceSurface(record.surface) ? record.surface : DEFAULT_APPEARANCE.surface,
    animate: typeof record.animate === "boolean" ? record.animate : DEFAULT_APPEARANCE.animate
  };
}

export const BUILT_IN_BACKGROUND_IDS = ["mist", "valley", "anime-calm", "monterey", "big-sur"] as const;
export type BuiltInBackgroundId = (typeof BUILT_IN_BACKGROUND_IDS)[number];
export type BackgroundImagePreference = BuiltInBackgroundId | "custom";
export const DEFAULT_BACKGROUND_IMAGE: BuiltInBackgroundId = "mist";
export const BACKGROUND_DEFAULT_GENERATION = DEFAULT_BACKGROUND_IMAGE;

const builtInBackgroundIdSet = new Set<string>(BUILT_IN_BACKGROUND_IDS);

export function isBackgroundImagePreference(value: unknown): value is BackgroundImagePreference {
  return value === "custom" || (typeof value === "string" && builtInBackgroundIdSet.has(value));
}

export function sanitizeBackgroundImage(value: unknown): BackgroundImagePreference {
  return isBackgroundImagePreference(value) ? value : DEFAULT_BACKGROUND_IMAGE;
}

/** Move existing installs onto a new product default once, without replacing a custom upload. */
export function rollForwardBackgroundDefault(
  backgroundImage: BackgroundImagePreference,
  appliedGeneration: unknown
): { backgroundImage: BackgroundImagePreference; appliedGeneration: string; changed: boolean } {
  if (appliedGeneration === BACKGROUND_DEFAULT_GENERATION) {
    return { backgroundImage, appliedGeneration: BACKGROUND_DEFAULT_GENERATION, changed: false };
  }

  return {
    backgroundImage: backgroundImage === "custom" ? "custom" : DEFAULT_BACKGROUND_IMAGE,
    appliedGeneration: BACKGROUND_DEFAULT_GENERATION,
    changed: true
  };
}

/**
 * Which publisher's releases this build updates from: this fork's GitHub
 * releases, or upstream's own update mirror.
 */
export const UPDATE_CHANNELS = ["fork", "upstream", "custom"] as const;
export type UpdateChannel = (typeof UPDATE_CHANNELS)[number];
/** This build ships with the fork's features, so its releases are the default source. */
export const DEFAULT_UPDATE_CHANNEL: UpdateChannel = "fork";

const updateChannelSet = new Set<string>(UPDATE_CHANNELS);

export function isUpdateChannel(value: unknown): value is UpdateChannel {
  return typeof value === "string" && updateChannelSet.has(value);
}

export function sanitizeUpdateChannel(value: unknown): UpdateChannel {
  return isUpdateChannel(value) ? value : DEFAULT_UPDATE_CHANNEL;
}

/** `owner/name` of a GitHub repository, as typed in Settings. */
const UPDATE_REPOSITORY = /^[A-Za-z0-9][A-Za-z0-9._-]{0,38}\/[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/u;

export function isUpdateRepository(value: unknown): value is string {
  return typeof value === "string" && UPDATE_REPOSITORY.test(value.trim());
}

/** Anything that is not a repository name reads as “not set”. */
export function sanitizeUpdateRepository(value: unknown): string {
  return isUpdateRepository(value) ? value.trim() : "";
}

export interface DesktopPreferences {
  /** Interface language, or `system` to follow the OS. */
  language: Language;
  /** Typography, ink colour and app mark. */
  appearance: AppearancePreferences;
  backgroundImage: BackgroundImagePreference;
  /** Publisher whose releases the app updates from. */
  updateChannel: UpdateChannel;
  /** GitHub repository read on the `custom` channel, as `owner/name`. */
  updateRepository: string;
  customBackgroundName: string | null;
  launchAtLogin: boolean;
  minimizeToTray: boolean;
  anonymousAnalytics: boolean;
  providerEnabled: Record<string, boolean>;
  /** Ranked `provider:window` limit keys, most important first. */
  limitOrder: string[];
  /** Limit keys switched off for the tray menu. Missing keys stay in the menu. */
  trayLimits: Record<string, boolean>;
  usageAlerts: UsageAlertPreferences;
  /** Daily per-source token warning, independent of provider quota windows. */
  tokenAlerts: TokenAlertPreferences;
  /** Local provider → the official providers and models its cloud save is reported as. */
  reportPlans: ReportPlan[];
}

export interface BackgroundImageSelection {
  preferences: DesktopPreferences;
  imageUrl: string;
}

export interface EngineDiagnostics {
  status: EngineStatus;
  restartCount: number;
  messages: string[];
}

export interface RefreshProgress {
  completed: number;
  total: number;
  providerID: string | null;
  providerName: string | null;
  status: "started" | "completed";
}

export interface LocalImportProgress {
  completed: number;
  total: number;
  error: string | null;
}

export interface DashboardState {
  localImport?: LocalImportProgress | null;
  revision: number;
  snapshot: DashboardSnapshot | null;
  refreshing: boolean;
  progress: RefreshProgress | null;
  error: string | null;
}

export interface UsageAtlasDesktopAPI {
  /** Renderer-side platform check: macOS keeps its own traffic lights. */
  readonly platform: string;
  /** PNG data URLs for every application mark, keyed by id. */
  getAppMarks(): Promise<Record<AppMark, string>>;
  /** Shows a desktop notification now, to check that alerts arrive. */
  sendTestAlert(tokens: number, providerName: string): Promise<boolean>;
  minimizeWindow(): Promise<void>;
  /** Returns the state the window is in after the toggle. */
  toggleMaximizeWindow(): Promise<boolean>;
  closeWindow(): Promise<void>;
  getWindowState(): Promise<boolean>;
  onWindowMaximized(listener: (maximized: boolean) => void): () => void;
  getProviderCredentials(): Promise<Record<string, ProviderCredentialStatus>>;
  setProviderCredential(provider: QuotaProviderId, credential: ProviderCredential | null): Promise<Record<string, ProviderCredentialStatus>>;
  getUpdateState(): Promise<DesktopUpdateState>;
  checkForUpdates(): Promise<DesktopUpdateState>;
  installUpdate(): Promise<void>;
  onUpdateState(listener: (state: DesktopUpdateState) => void): () => void;
  getCloudStatus(): Promise<CloudStatus>;
  cloudAction(action: CloudAction, options?: CloudActionOptions): Promise<CloudStatus>;
  checkHandle(handle: string): Promise<boolean>;
  getLeaderboard(): Promise<LeaderboardGlance>;
  copyText(text: string): Promise<void>;
  /** A PNG data URL. */
  copyImage(png: string): Promise<void>;
  /** Asks where to save the PNG; false when the user cancels. */
  saveImage(png: string, fileName: string): Promise<boolean>;
  trackGrowthEvent<E extends GrowthEvent>(event: E, properties: GrowthEventProperties<E>): Promise<void>;
  getCustomBackground(): Promise<string | null>;
  chooseCustomBackground(): Promise<BackgroundImageSelection | null>;
  getSnapshot(): Promise<DashboardState>;
  refreshAll(): Promise<DashboardState>;
  setProviderEnabled(providerID: string, enabled: boolean): Promise<DashboardState>;
  setReportPlans(plans: ReportPlan[]): Promise<DesktopPreferences>;
  getPreferences(): Promise<DesktopPreferences>;
  updatePreferences(patch: Partial<DesktopPreferences>): Promise<DesktopPreferences>;
  getDiagnostics(): Promise<EngineDiagnostics>;
  openExternal(url: string): Promise<boolean>;
  onEngineStatus(listener: (status: EngineStatus) => void): () => void;
  onNavigate(listener: (route: AppRoute) => void): () => void;
  onSnapshot(listener: (state: DashboardState) => void): () => void;
}

export const IPC = {
  getAppMarks: "app:marks",
  sendTestAlert: "alerts:test",
  getProviderCredentials: "providers:credentials-status",
  setProviderCredential: "providers:set-credential",
  getUpdateState: "updates:get",
  checkForUpdates: "updates:check",
  installUpdate: "updates:install",
  updateStateChanged: "updates:changed",
  cloudStatus: "cloud:status",
  cloudAction: "cloud:action",
  checkHandle: "profile:check-handle",
  getLeaderboard: "profile:leaderboard",
  copyText: "clipboard:write-text",
  copyImage: "clipboard:write-image",
  saveImage: "image:save",
  trackGrowthEvent: "telemetry:growth-event",
  getCustomBackground: 'background:get-custom',
  chooseCustomBackground: 'background:choose-custom',
  snapshot: "dashboard:snapshot",
  refreshAll: "dashboard:refresh-all",
  setProviderEnabled: "dashboard:set-provider-enabled",
  setReportPlans: "settings:set-report-plans",
  getPreferences: "preferences:get",
  updatePreferences: "preferences:update",
  getDiagnostics: "engine:diagnostics",
  engineStatus: "engine:status",
  navigate: "shell:navigate",
  snapshotUpdated: "dashboard:updated",
  openExternal: "shell:open-external",
  minimizeWindow: "window:minimize",
  toggleMaximizeWindow: "window:toggle-maximize",
  closeWindow: "window:close",
  getWindowState: "window:state",
  windowMaximized: "window:maximized"
} as const;

export interface CloudProgress {
  operation: "save" | "restore";
  phase: "reading" | "saving";
  completed: number;
  total: number | null;
}

export interface UsageCloudState {
  accountId: string | null;
  automatic: boolean;
  pending: number;
  busy: boolean;
  progress: CloudProgress | null;
  lastCompleted: "save" | "restore" | null;
  error: string | null;
  /**
   * Sources with usage waiting on this computer that the server does not model,
   * and that no Attribution rule renames. Capitalized display names.
   */
  heldBack: string[];
  conflicts: { recordId: string; provider: string; day: string | null; localTokens: number | null; cloudTokens: number | null }[];
}
/**
 * What the signed-in account has published on usageatlas.com. `unknown` until a
 * check succeeds, so a failed check never reads as "no profile".
 */
export type CloudProfileStatus =
  | { state: "signed-out" }
  | { state: "unknown" }
  | { state: "missing" }
  | { state: "private" | "public"; handle: string };
/**
 * The public 30-day token leaderboard on usageatlas.com, trimmed to what the profile
 * page and prompt show. Fetched without an account.
 */
export interface LeaderboardGlance {
  /** Every public profile, with or without recent usage. */
  profiles: number;
  /** Profiles with tokens in the last 30 days. `entries` holds the top of them. */
  ranked: number;
  /** Highest first. Equal token totals share a rank. */
  entries: { handle: string; rank: number; tokens: number }[];
  /** A few top profiles to show as faces. `avatar` is a data URL, or null for initials. */
  faces: { handle: string; name: string; avatar: string | null }[];
}
export interface CloudStatus extends UsageCloudState {
  account: { id: string; email: string } | null;
  loginCode: string | null;
  profile: CloudProfileStatus;
}
export type CloudAction = "sign-in" | "sign-out" | "save" | "restore" | "automatic" | "resolve" | "refresh-profile";
export interface CloudActionOptions { enabled?: boolean; recordId?: string; choice?: "local" | "cloud" }
