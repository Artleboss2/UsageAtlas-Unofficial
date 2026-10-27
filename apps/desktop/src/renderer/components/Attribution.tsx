import { useState } from "react";
import type { DashboardProvider } from "@usageatlas/contracts";
import { Button, Card } from "@heroui/react";
import type { DesktopPreferences } from "../../shared/desktop-api";
import { OFFICIAL_PROVIDERS, type ReportAlias } from "../../shared/report-aliases";

interface AttributionProps {
  providers: DashboardProvider[];
  preferences: DesktopPreferences | null;
  saving: boolean;
  onSave(aliases: ReportAlias[]): Promise<void>;
}

/**
 * Cloud attribution: a source the server does not model yet can still be saved
 * under an official provider. The local history is never rewritten — only the
 * copy sent to the server is relabelled.
 */
export function Attribution({ providers, preferences, saving, onSave }: AttributionProps): React.JSX.Element {
  // The page follows saved preferences until the first edit here, so a rule written
  // on another page (or a reload) never discards a half-typed model.
  const [edited, setEdited] = useState<ReportAlias[] | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const draft = edited ?? preferences?.reportAliases ?? [];

  const sources = providers.map(provider => ({ id: provider.id, name: provider.name }));
  const used = new Set<string>(draft.map(alias => alias.source));
  const available = sources.filter(source => !used.has(source.id));
  const invalid = draft.some(alias => !alias.model.trim() || alias.source === alias.reportAs);

  function patch(index: number, value: Partial<ReportAlias>): void {
    setEdited(draft.map((alias, position) => (position === index ? { ...alias, ...value } : alias)));
    setStatus(null);
  }

  function add(): void {
    const source = available[0];
    if (!source) return;
    setEdited([...draft, { source: source.id as ReportAlias["source"], reportAs: OFFICIAL_PROVIDERS[0], model: "" }]);
    setStatus(null);
  }

  function remove(index: number): void {
    setEdited(draft.filter((_row, position) => position !== index));
    setStatus(null);
  }

  async function save(): Promise<void> {
    setError(null);
    setStatus(null);
    try {
      await onSave(draft.map(alias => ({ ...alias, model: alias.model.trim() })));
      // The saved rules are the validated ones, so the page goes back to them.
      setEdited(null);
      setStatus("Rules saved. The next cloud save uses them.");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "The rules could not be saved.");
    }
  }

  return (
    <div className="atlas-page atlas-page--narrow">
      <header className="atlas-page-header">
        <p className="atlas-kicker">Cloud</p>
        <h1 className="atlas-page-title">Attribution</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Choose how a source is reported to your account. Every source stays counted under its
          real name on this computer; only the copy saved to the cloud is relabelled.
        </p>
      </header>

      <Card className="mt-6" variant="transparent">
        <Card.Header>
          <Card.Title>Report as</Card.Title>
          <Card.Description>
            A source the server does not know yet can be saved under an official provider, with the
            model you actually used. Local totals, charts and detection are untouched.
          </Card.Description>
        </Card.Header>
        <Card.Content className="mt-3 space-y-3">
          {draft.length === 0 ? (
            <p className="text-sm text-muted">No rule yet. Every source is saved under its own name.</p>
          ) : (
            draft.map((alias, index) => (
              <div className="atlas-alias-row" key={`${alias.source}-${index}`}>
                <label className="atlas-alias-field">
                  <span>Local source</span>
                  <select
                    aria-label="Local source"
                    onChange={(event) => patch(index, { source: event.target.value as ReportAlias["source"] })}
                    value={alias.source}
                  >
                    {[...sources.filter(source => source.id === alias.source), ...available].map(source => (
                      <option key={source.id} value={source.id}>{source.name}</option>
                    ))}
                  </select>
                </label>
                <label className="atlas-alias-field">
                  <span>Reported as</span>
                  <select
                    aria-label="Reported provider"
                    onChange={(event) => patch(index, { reportAs: event.target.value as ReportAlias["reportAs"] })}
                    value={alias.reportAs}
                  >
                    {OFFICIAL_PROVIDERS.map(provider => (
                      <option key={provider} value={provider}>{provider}</option>
                    ))}
                  </select>
                </label>
                <label className="atlas-alias-field atlas-alias-field--model">
                  <span>Model</span>
                  <input
                    aria-label="Reported model"
                    maxLength={80}
                    onChange={(event) => patch(index, { model: event.target.value })}
                    placeholder="gpt-5.3-codex"
                    type="text"
                    value={alias.model}
                  />
                </label>
                <Button
                  aria-label={`Remove the rule for ${alias.source}`}
                  onPress={() => remove(index)}
                  size="sm"
                  variant="ghost"
                >
                  Remove
                </Button>
              </div>
            ))
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button isDisabled={available.length === 0} onPress={add} size="sm" variant="outline">
              Add rule
            </Button>
            <Button isDisabled={saving || invalid || draft.length === 0} isPending={saving} onPress={() => void save()}>
              Save rules
            </Button>
            <span aria-live="polite" className="text-xs text-muted" role="status">
              {saving ? "Saving…" : status ?? ""}
            </span>
          </div>
          {invalid ? (
            <p className="text-xs text-danger" role="alert">
              Each rule needs a source, a different official provider, and a model.
            </p>
          ) : null}
          {error ? (
            <p className="text-xs text-danger" role="alert">{error}</p>
          ) : null}
        </Card.Content>
      </Card>

      <Card className="mt-4" variant="transparent">
        <Card.Header>
          <Card.Title>What the server receives</Card.Title>
        </Card.Header>
        <Card.Content className="mt-2 space-y-2 text-sm text-muted">
          <p>
            With a rule <strong>Freebuff → codex</strong> and model <strong>gpt-5.3-codex</strong>,
            this computer keeps counting Freebuff tokens, while the uploaded usage arrives as Codex
            usage on that model.
          </p>
          <p>
            Restoring that account on another computer brings back what the server stored, so the
            relabelled copies reappear there. Unlabelled local history is never overwritten.
          </p>
        </Card.Content>
      </Card>
    </div>
  );
}
