import { UpdateSettings } from "./UpdateControls";
import { CloudSettings } from "./CloudSettings";
import type { DashboardProvider } from "@usageatlas/contracts";
import { Button, Card, Label, Radio, RadioGroup, Skeleton, Spinner, Switch } from "@heroui/react";
import { useEffect, useRef, useState } from "react";
import type {
  AppMark,
  BackgroundImagePreference,
  BuiltInBackgroundId,
  DesktopPreferences,
  DesktopUpdateState
} from "../../shared/desktop-api";
import {
  DEFAULT_APPEARANCE,
  DEFAULT_BACKGROUND_IMAGE,
  isBackgroundImagePreference
} from "../../shared/desktop-api";
import { FORK_HOME_URL } from "../../shared/fork";
import { DESKTOP_VERSION } from "../../shared/version";
import { CheckIcon, ExternalIcon, RefreshIcon } from "../icons";
import { applyAppearance, FONT_OPTIONS, FONT_STACKS, INK_SWATCHES, MARK_OPTIONS } from "../appearance";
import { providerConnection, type ProviderConnection } from "../provider-connection";
import { BUILT_IN_WALLPAPERS } from "../wallpapers";
import { ProviderLogo } from "./ProviderLogo";
import { ProviderCredentialForm } from "./ProviderCredentialForm";
import { isQuotaProvider } from "../../shared/quota-providers";
import { LANGUAGES, LANGUAGE_LABELS } from "../../shared/languages";

interface SettingsProps {
  updateState: DesktopUpdateState | null;
  onCheckForUpdates(): Promise<void>;
  onInstallUpdate(): Promise<void>;
  preferences: DesktopPreferences | null;
  backgroundError: string | null;
  customBackgroundUrl: string | null;
  saving: boolean;
  onUpdate(patch: Partial<DesktopPreferences>): Promise<void>;
  onChooseCustomBackground(): Promise<void>;
  onOpenExternal(url: string): Promise<void>;
  onRefresh(): Promise<void>;
  providers: DashboardProvider[];
  providerSaving: string | null;
  refreshing: boolean;
  onSetProviderEnabled(providerID: string, enabled: boolean): Promise<void>;
  /** PNG data URLs for the app marks, so the picker shows what the OS will show. */
  markUrls?: Record<AppMark, string> | null;
}

type SettingsTab = "general" | "appearance";

export function Settings({
  updateState,
  onCheckForUpdates,
  onInstallUpdate,
  preferences,
  backgroundError,
  customBackgroundUrl,
  saving,
  onUpdate,
  onChooseCustomBackground,
  onOpenExternal,
  onRefresh,
  providers,
  providerSaving,
  refreshing,
  onSetProviderEnabled,
  markUrls = null,
}: SettingsProps): React.JSX.Element {
  const [tab, setTab] = useState<SettingsTab>("general");
  const sources = providers.map((provider) => ({
    provider,
    connection: providerConnection(provider),
  }));
  const needsReconnect = sources.some(
    ({ connection }) => connection.needsAttention,
  );
  const appearance = preferences?.appearance ?? DEFAULT_APPEARANCE;
  // The slider previews live, so the type scale is applied to the document at once
  // while the saved preference only follows once the drag settles. The draft holds
  // only the value being dragged, so a saved change always shows through.
  const [scaleDraft, setScaleDraft] = useState<number | null>(null);
  const scale = scaleDraft ?? appearance.fontScale;
  const scaleCommit = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (scaleCommit.current) clearTimeout(scaleCommit.current);
  }, []);

  function previewScale(next: number): void {
    setScaleDraft(next);
    applyAppearance({ ...appearance, fontScale: next });
    if (scaleCommit.current) clearTimeout(scaleCommit.current);
    scaleCommit.current = setTimeout(() => {
      scaleCommit.current = null;
      void onUpdate({ appearance: { ...appearance, fontScale: next } })
        .finally(() => setScaleDraft(null));
    }, 240);
  }

  function setAppearance(patch: Partial<typeof appearance>): void {
    const next = { ...appearance, ...patch };
    applyAppearance(next);
    void onUpdate({ appearance: next });
  }

  return (
    <div className="atlas-page atlas-page--narrow">
      <header className="atlas-page-header flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="atlas-kicker">Preferences</p>
          <h1 className="atlas-page-title">Settings</h1>
          <p className="atlas-hero-description">
            Control startup, privacy, connected sources and how the app looks.
          </p>
        </div>
        <span
          aria-live="polite"
          className="flex min-h-5 items-center gap-2 text-sm text-muted"
          role="status"
        >
          {saving ? (
            <>
              <Spinner size="sm" />
              <span>Saving…</span>
            </>
          ) : null}
        </span>
      </header>

      <div className="atlas-settings-tabs" role="tablist" aria-label="Settings sections">
        <button
          aria-selected={tab === "general"}
          className="atlas-settings-tabs__tab"
          onClick={() => setTab("general")}
          role="tab"
          type="button"
        >
          General
        </button>
        <button
          aria-selected={tab === "appearance"}
          className="atlas-settings-tabs__tab"
          onClick={() => setTab("appearance")}
          role="tab"
          type="button"
        >
          Appearance
        </button>
      </div>

      {!preferences ? (
        <Card className="mt-8" variant="transparent">
          <Skeleton className="h-44 rounded-2xl" />
        </Card>
      ) : (
        <>
          <div className="mt-8 grid gap-5" hidden={tab !== "general"}>
            <CloudSettings />
            <Card variant="transparent">
              <Card.Header>
                <Card.Title>General</Card.Title>
                <Card.Description>
                  How UsageAtlas behaves on this computer.
                </Card.Description>
              </Card.Header>
              <Card.Content className="atlas-settings-list mt-2">
                <SettingRow
                  checked={preferences.launchAtLogin}
                  description="Start quietly when you sign in."
                  label="Launch at login"
                  onChange={(launchAtLogin) => onUpdate({ launchAtLogin })}
                />
                <SettingRow
                  checked={preferences.minimizeToTray}
                  description="Keep usage checks running when the window closes."
                  label="Keep running in the tray"
                  onChange={(minimizeToTray) => onUpdate({ minimizeToTray })}
                />
              </Card.Content>
            </Card>

            <Card variant="transparent">
              <Card.Header>
                <Card.Title>Sources</Card.Title>
                <Card.Description>
                  Choose which AI tools appear in your analytics. A tool that needs
                  a new sign-in is flagged here until you reconnect it.
                </Card.Description>
              </Card.Header>
              <Card.Content className="atlas-settings-list mt-2">
                {sources.length ? (
                  sources.map(({ provider, connection }) => (
                    <div key={provider.id}>
                    <SettingRow
                      checked={provider.enabled}
                      description={<ConnectionCopy connection={connection} />}
                      disabled={providerSaving === provider.id}
                      key={provider.id}
                      label={provider.name}
                      leading={
                        <ProviderLogo
                          compact
                          providerID={provider.id}
                          providerName={provider.name}
                        />
                      }
                      onChange={(enabled) =>
                        onSetProviderEnabled(provider.id, enabled)
                      }
                      status={
                        connection.needsAttention || connection.state === "checking" ? (
                          <span
                            className="atlas-source-pill"
                            data-connection={connection.state}
                          >
                            {connection.label}
                          </span>
                        ) : null
                      }
                    />
                    {isQuotaProvider(provider.id) ? <ProviderCredentialForm provider={provider.id} /> : null}
                    </div>
                  ))
                ) : (
                  <p className="px-3 py-5 text-sm text-muted" role="status">
                    {refreshing ? "Checking your connected sources…" : "No supported sources were detected yet."}
                  </p>
                )}
                {needsReconnect ? (
                  <div className="atlas-source-recheck">
                    <Button
                      isPending={refreshing}
                      onPress={() => void onRefresh()}
                      variant="outline"
                    >
                      <span>Check sources again</span>
                      <RefreshIcon
                        className={`size-4${refreshing ? " animate-spin" : ""}`}
                      />
                    </Button>
                  </div>
                ) : null}
              </Card.Content>
            </Card>

            <Card variant="transparent">
              <Card.Header>
                <Card.Title>Language</Card.Title>
                <Card.Description>
                  Choose the interface language. Numbers and dates keep their English formatting.
                </Card.Description>
              </Card.Header>
              <Card.Content className="mt-2">
                <div aria-label="Interface language" className="atlas-language-options" role="radiogroup">
                  {LANGUAGES.map((language) => (
                    <button
                      aria-checked={preferences.language === language}
                      className="atlas-language-option"
                      key={language}
                      onClick={() => void onUpdate({ language })}
                      role="radio"
                      type="button"
                    >
                      <span>{LANGUAGE_LABELS[language]}</span>
                      {preferences.language === language ? (
                        <span aria-hidden="true" className="atlas-language-option__check">
                          <CheckIcon />
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              </Card.Content>
            </Card>

            <Card variant="transparent">
              <Card.Header>
                <Card.Title>Usage count</Card.Title>
                <Card.Description>
                  A general headcount of how many people use UsageAtlas.
                </Card.Description>
              </Card.Header>
              <Card.Content className="atlas-settings-list mt-2">
                <SettingRow
                  checked={preferences.anonymousAnalytics}
                  description="Completely anonymous. It only counts this general app analytics so we know how many people are using the app. Cloud usage saves are controlled separately above."
                  label="Allow General App analytics in the count"
                  onChange={(anonymousAnalytics) =>
                    onUpdate({ anonymousAnalytics })
                  }
                />
              </Card.Content>
            </Card>

            <UpdateSettings
              channel={preferences.updateChannel}
              onChangeChannel={(updateChannel) => onUpdate({ updateChannel })}
              onChangeRepository={(updateRepository) => onUpdate({ updateRepository })}
              repository={preferences.updateRepository}
              onCheck={onCheckForUpdates}
              onInstall={onInstallUpdate}
              state={updateState}
            />

            <footer className="flex flex-col items-start gap-4 px-1 py-3 sm:flex-row sm:items-center">
              <div>
                <strong className="text-sm font-medium">UsageAtlas — unofficial fork</strong>
                <p className="mt-1 text-xs text-muted">
                  Version {DESKTOP_VERSION} · Local-first desktop app · Not affiliated with, endorsed by,
                  or supported by UsageAtlas
                </p>
              </div>
              <Button
                className="sm:ms-auto"
                onPress={() => void onOpenExternal(FORK_HOME_URL)}
                variant="ghost"
              >
                <span>Open fork documentation</span>
                <ExternalIcon className="size-4" />
              </Button>
            </footer>
          </div>

          <div className="mt-8 grid gap-5" hidden={tab !== "appearance"}>
            <Card variant="transparent">
              <Card.Header>
                <Card.Title>Preview</Card.Title>
                <Card.Description>
                  Exactly how usage numbers and labels will read.
                </Card.Description>
              </Card.Header>
              <Card.Content className="mt-2">
                <div
                  className="atlas-appearance-preview"
                  style={{
                    fontFamily: FONT_STACKS[appearance.font],
                    color: appearance.textColor ?? undefined
                  }}
                >
                  <p className="atlas-appearance-preview__kicker">Today · All tools</p>
                  <p className="atlas-appearance-preview__value">1,284,930 tokens</p>
                  <p className="atlas-appearance-preview__meta">
                    Across 42 models and 8 connected sources
                  </p>
                </div>
              </Card.Content>
            </Card>

            <Card variant="transparent">
              <Card.Header>
                <Card.Title>Font</Card.Title>
                <Card.Description>
                  Every family ships with the app, so a choice looks the same on any computer.
                </Card.Description>
              </Card.Header>
              <Card.Content className="mt-2">
                <div className="atlas-font-grid" role="radiogroup" aria-label="Interface font">
                  {FONT_OPTIONS.map((option) => (
                    <button
                      aria-checked={appearance.font === option.id}
                      className="atlas-font-tile"
                      key={option.id}
                      onClick={() => setAppearance({ font: option.id })}
                      role="radio"
                      type="button"
                    >
                      <span
                        aria-hidden="true"
                        className="atlas-font-tile__sample"
                        style={{ fontFamily: FONT_STACKS[option.id] }}
                      >
                        Aa
                      </span>
                      <span className="atlas-font-tile__label">{option.label}</span>
                      <span className="atlas-font-tile__note">{option.note}</span>
                      {appearance.font === option.id ? (
                        <span aria-hidden="true" className="atlas-font-tile__check">
                          <CheckIcon />
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              </Card.Content>
            </Card>

            <Card variant="transparent">
              <Card.Header>
                <Card.Title>Text size</Card.Title>
                <Card.Description>
                  Scales every label and number in the app.
                </Card.Description>
              </Card.Header>
              <Card.Content className="mt-2">
                <div className="atlas-appearance-scale">
                  <span aria-hidden="true" className="atlas-appearance-scale__edge">A</span>
                  <input
                    aria-label="Interface text size"
                    className="atlas-slider"
                    max={130}
                    min={85}
                    onChange={(event) => previewScale(Number(event.target.value) / 100)}
                    step={1}
                    type="range"
                    value={Math.round(scale * 100)}
                  />
                  <span aria-hidden="true" className="atlas-appearance-scale__edge atlas-appearance-scale__edge--large">A</span>
                  <output className="atlas-appearance-scale__value">{Math.round(scale * 100)}%</output>
                </div>
              </Card.Content>
            </Card>

            <Card variant="transparent">
              <Card.Header>
                <Card.Title>Text colour</Card.Title>
                <Card.Description>
                  Tints the interface ink, or keep the theme's own colour.
                </Card.Description>
              </Card.Header>
              <Card.Content className="mt-2">
                <div className="atlas-ink-swatches">
                  {INK_SWATCHES.map((swatch) => (
                    <button
                      aria-label={swatch.label}
                      aria-pressed={appearance.textColor === swatch.value}
                      className="atlas-ink-swatch"
                      data-theme={swatch.value === null ? "true" : undefined}
                      key={swatch.label}
                      onClick={() => setAppearance({ textColor: swatch.value })}
                      style={swatch.value ? { background: swatch.value } : undefined}
                      title={swatch.label}
                      type="button"
                    >
                      {appearance.textColor === swatch.value ? <CheckIcon /> : null}
                    </button>
                  ))}
                  <label className="atlas-ink-custom">
                    <span>Custom</span>
                    <input
                      aria-label="Custom text colour"
                      onChange={(event) => setAppearance({ textColor: event.target.value })}
                      type="color"
                      value={appearance.textColor ?? "#1d1d1f"}
                    />
                  </label>
                </div>
              </Card.Content>
            </Card>

            <Card variant="transparent">
              <Card.Header>
                <Card.Title>App icon</Card.Title>
                <Card.Description>
                  Used by the title bar, the window and the tray. The installed app's own
                  file icon keeps the fork's datamoshed artwork.
                </Card.Description>
              </Card.Header>
              <Card.Content className="mt-2">
                <div className="atlas-mark-grid" role="radiogroup" aria-label="Application icon">
                  {MARK_OPTIONS.map((option) => (
                    <button
                      aria-checked={appearance.mark === option.id}
                      className="atlas-mark-tile"
                      key={option.id}
                      onClick={() => setAppearance({ mark: option.id })}
                      role="radio"
                      type="button"
                    >
                      <span aria-hidden="true" className="atlas-mark-tile__preview">
                        {markUrls?.[option.id] ? (
                          <img alt="" src={markUrls[option.id]} />
                        ) : null}
                      </span>
                      <span className="atlas-mark-tile__label">{option.label}</span>
                      <span className="atlas-mark-tile__note">{option.note}</span>
                    </button>
                  ))}
                </div>
              </Card.Content>
            </Card>

            <Card variant="transparent">
              <Card.Header>
                <Card.Title>Background</Card.Title>
                <Card.Description>
                  Choose the image shown behind your dashboard.
                </Card.Description>
              </Card.Header>
              <Card.Content className="mt-2">
                <div className="atlas-wallpaper-setting">
                  <RadioGroup
                    className="atlas-wallpaper-options"
                    isDisabled={saving}
                    name="background-image"
                    onChange={(value) => {
                      if (isBackgroundImagePreference(value)) {
                        void onUpdate({ backgroundImage: value });
                      }
                    }}
                    orientation="horizontal"
                    value={
                      preferences.backgroundImage === "custom" && !customBackgroundUrl
                        ? DEFAULT_BACKGROUND_IMAGE
                        : preferences.backgroundImage
                    }
                    variant="secondary"
                  >
                    <Label>Background image</Label>
                    {BUILT_IN_WALLPAPERS.map((wallpaper) => (
                      <WallpaperOption
                        key={wallpaper.id}
                        label={wallpaper.label}
                        value={wallpaper.id}
                        wallpaper={wallpaper.id}
                      />
                    ))}
                    {customBackgroundUrl ? (
                      <WallpaperOption
                        label={preferences.customBackgroundName ?? "Custom"}
                        src={customBackgroundUrl}
                        value="custom"
                      />
                    ) : null}
                  </RadioGroup>
                  <p className="atlas-wallpaper-hint text-xs text-muted">
                    JPG, PNG, or WebP up to 25 MB.
                  </p>
                  <p
                    className="atlas-wallpaper-error mt-1 text-xs"
                    role="alert"
                  >
                    {backgroundError ?? ""}
                  </p>
                  <div className="atlas-wallpaper-actions">
                    <Button
                      isDisabled={saving}
                      onPress={() => void onChooseCustomBackground()}
                      variant="outline"
                    >
                      {customBackgroundUrl ? "Change image" : "Choose image"}
                    </Button>
                  </div>
                </div>
              </Card.Content>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function WallpaperOption({
  label,
  src,
  value,
  wallpaper
}: {
  label: string;
  src?: string;
  value: BackgroundImagePreference;
  wallpaper?: BuiltInBackgroundId;
}): React.JSX.Element {
  return (
    <Radio className="atlas-wallpaper-option" value={value}>
      <Radio.Content>
        <Radio.Control className="sr-only">
          <Radio.Indicator />
        </Radio.Control>
        <span
          aria-hidden="true"
          className="atlas-wallpaper-option__preview"
          data-wallpaper={wallpaper}
          style={src ? { backgroundImage: `url("${src}")` } : undefined}
        />
        <span className="atlas-wallpaper-option__label">{label}</span>
      </Radio.Content>
    </Radio>
  );
}

function SettingRow({
  label,
  description,
  checked,
  disabled = false,
  leading,
  status,
  onChange,
}: {
  label: string;
  description: React.ReactNode;
  checked: boolean;
  disabled?: boolean;
  leading?: React.ReactNode;
  status?: React.ReactNode;
  onChange(value: boolean): Promise<void>;
}): React.JSX.Element {
  return (
    <div className="atlas-setting-row flex min-h-20 items-center gap-4 p-3">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {leading}
        <div className="min-w-0">
          <span className="atlas-setting-row__heading">
            <strong className="text-sm font-medium text-foreground">
              {label}
            </strong>
            {status}
          </span>
          <p className="mt-1 text-xs text-muted">{description}</p>
        </div>
      </div>
      <Switch
        aria-label={label}
        isDisabled={disabled}
        isSelected={checked}
        onChange={(value) => void onChange(value)}
      >
        <Switch.Content>
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
        </Switch.Content>
      </Switch>
    </div>
  );
}

/** The state of a source in one line, with the reconnect step when there is one. */
function ConnectionCopy({
  connection,
}: {
  connection: ProviderConnection;
}): React.JSX.Element {
  return (
    <>
      {connection.summary}
      {connection.action ? (
        <span className="atlas-source-action"> {connection.action}</span>
      ) : null}
      {connection.command ? (
        <code className="atlas-command">{connection.command}</code>
      ) : null}
    </>
  );
}
