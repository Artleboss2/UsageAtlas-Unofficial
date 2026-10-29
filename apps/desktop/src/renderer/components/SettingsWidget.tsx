import { Button, Card } from "@heroui/react";
import type { CSSProperties } from "react";
import type { DesktopPreferences } from "../../shared/desktop-api";
import { useI18n } from "../i18n";
import { SettingRow } from "./Settings";

interface SettingsWidgetProps {
  preferences: DesktopPreferences;
  saving: boolean;
  onUpdate(patch: Partial<DesktopPreferences>): Promise<void>;
  onShow(): Promise<void>;
  onHide(): Promise<void>;
}

const AUTO_HIDE_CHOICES = [0, 15, 30, 60, 120, 300] as const;

/**
 * Settings → Widget. The mini window is a native always-on-top window; this page
 * only shapes what it shows and how quickly it gets out of the way.
 */
export function SettingsWidget({
  preferences,
  saving,
  onUpdate,
  onShow,
  onHide
}: SettingsWidgetProps): React.JSX.Element {
  const { t } = useI18n();
  const widget = preferences.widget;

  const updateWidget = (patch: Partial<DesktopPreferences["widget"]>): Promise<void> =>
    onUpdate({ widget: { ...widget, ...patch } });

  return (
    <div className="grid gap-5">
      <Card variant="transparent">
        <Card.Header>
          <Card.Title>{t("settings.widget.title")}</Card.Title>
          <Card.Description>{t("settings.widget.description")}</Card.Description>
        </Card.Header>
        <Card.Content className="atlas-settings-list mt-2">
          <SettingRow
            checked={widget.enabled}
            description={t("settings.widget.enableDescription")}
            label={t("settings.widget.enable")}
            onChange={(enabled) => updateWidget({ enabled })}
          />
          <div className="flex flex-wrap items-center gap-2 px-3 py-3">
            <Button isDisabled={saving} onPress={() => void onShow()} variant="secondary">
              {t("settings.widget.show")}
            </Button>
            <Button isDisabled={saving} onPress={() => void onHide()} variant="outline">
              {t("settings.widget.hide")}
            </Button>
            <span className="text-xs text-muted">{t("settings.widget.hotkeyHint")}</span>
          </div>
        </Card.Content>
      </Card>

      {widget.enabled ? (
        <>
          <Card variant="transparent">
            <Card.Header>
              <Card.Title>{t("settings.widget.behaviorTitle")}</Card.Title>
              <Card.Description>{t("settings.widget.behaviorDescription")}</Card.Description>
            </Card.Header>
            <Card.Content className="atlas-settings-list mt-2">
              <label className="atlas-setting-row flex min-h-20 flex-wrap items-center gap-4 p-3">
                <span className="min-w-0 flex-1">
                  <strong className="text-sm font-medium text-foreground">{t("settings.widget.autoHide")}</strong>
                  <span className="mt-1 block text-xs text-muted">{t("settings.widget.autoHideDescription")}</span>
                </span>
                <select
                  aria-label={t("settings.widget.autoHide")}
                  className="atlas-select"
                  onChange={(event) => void updateWidget({ autoHideSeconds: Number(event.target.value) })}
                  value={widget.autoHideSeconds}
                >
                  {AUTO_HIDE_CHOICES.map((seconds) => (
                    <option key={seconds} value={seconds}>
                      {seconds === 0 ? t("settings.widget.never") : `${seconds}s`}
                    </option>
                  ))}
                </select>
              </label>
              <div className="atlas-setting-row flex min-h-24 flex-col gap-3 p-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <strong className="text-sm font-medium text-foreground">{t("settings.widget.opacity")}</strong>
                    <p className="mt-1 text-xs text-muted">{t("settings.widget.opacityDescription")}</p>
                  </div>
                  <output className="text-sm tabular-nums text-muted">{Math.round(widget.opacity * 100)}%</output>
                </div>
                <input
                  aria-label={t("settings.widget.opacity")}
                  className="atlas-slider"
                  max={100}
                  min={70}
                  onChange={(event) => void updateWidget({ opacity: Number(event.target.value) / 100 })}
                  step={1}
                  type="range"
                  value={Math.round(widget.opacity * 100)}
                />
              </div>
              <SettingRow
                checked={widget.snapToEdges}
                description={t("settings.widget.snapDescription")}
                label={t("settings.widget.snap")}
                onChange={(snapToEdges) => updateWidget({ snapToEdges })}
              />
            </Card.Content>
          </Card>

          <Card variant="transparent">
            <Card.Header>
              <Card.Title>{t("settings.widget.previewTitle")}</Card.Title>
              <Card.Description>{t("settings.widget.previewDescription")}</Card.Description>
            </Card.Header>
            <Card.Content className="mt-2">
              <div aria-hidden="true" className="atlas-widget-preview">
                <div className="atlas-widget-preview__header">
                  <span className="atlas-widget-preview__mark">UA</span>
                  <div className="atlas-widget-preview__titles">
                    <strong>{t("settings.widget.previewProvider")}</strong>
                    <span>claude-sonnet-5</span>
                  </div>
                </div>
                <div className="atlas-widget-preview__gauges">
                  <div className="atlas-widget-preview__gauge">
                    <span
                      className="atlas-widget-preview__ring"
                      data-tone="good"
                      style={{ "--progress": "62%" } as CSSProperties}
                    >
                      <span>62%</span>
                    </span>
                    <span className="atlas-widget-preview__caption">{t("widget.quota")}</span>
                  </div>
                  <div className="atlas-widget-preview__gauge">
                    <span
                      className="atlas-widget-preview__ring"
                      data-tone="warn"
                      style={{ "--progress": "18%" } as CSSProperties}
                    >
                      <span>18%</span>
                    </span>
                    <span className="atlas-widget-preview__caption">{t("widget.budget")}</span>
                  </div>
                </div>
                <div className="atlas-widget-preview__stats">
                  <div>
                    <span>{t("widget.burnRate")}</span>
                    <strong>{t("settings.widget.previewBurn")}</strong>
                  </div>
                  <div>
                    <span>{t("widget.sessionCost")}</span>
                    <strong>$0.42</strong>
                  </div>
                  <div>
                    <span>{t("widget.reset")}</span>
                    <strong>2h 14m</strong>
                  </div>
                </div>
              </div>
            </Card.Content>
          </Card>
        </>
      ) : null}
    </div>
  );
}
