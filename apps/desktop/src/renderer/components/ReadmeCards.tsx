import { Button, Label, ListBox, Select, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { useEffect, useState, type CSSProperties } from "react";
import { trackGrowth } from "../profile-state";
import {
  EMBEDS_URL,
  README_CARDS,
  README_PERIODS,
  readmeCardMarkdown,
  readmeCardSize,
  readmeCardUrl,
  type ReadmeCard,
  type ReadmePeriod,
  type ReadmeTheme
} from "../readme-cards";

type CopyFormat = "markdown" | "url";

/** Live usage cards for a GitHub README, ready to paste. Cards need a public profile. */
export function ReadmeCards({ cloudSaveOff, handle, onOpenExternal }: {
  cloudSaveOff: boolean;
  handle: string;
  onOpenExternal(url: string): Promise<void>;
}): React.JSX.Element {
  const [card, setCard] = useState<ReadmeCard>("heatmap");
  const [period, setPeriod] = useState<ReadmePeriod>("all");
  const [theme, setTheme] = useState<ReadmeTheme>("light");
  const [copied, setCopied] = useState<CopyFormat | null>(null);
  const [error, setError] = useState<string | null>(null);
  const imageUrl = readmeCardUrl(handle, card, period, theme);
  const markdown = readmeCardMarkdown(handle, card, period, theme);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(null), 2_000);
    return () => clearTimeout(timer);
  }, [copied]);

  function choose(update: () => void): void {
    update();
    setCopied(null);
    setError(null);
  }

  async function copy(format: CopyFormat): Promise<void> {
    setError(null);
    try {
      await window.usageAtlas.copyText(format === "markdown" ? markdown : imageUrl);
      setCopied(format);
      trackGrowth("profile_card_copied", { card, format });
    } catch {
      setError("Couldn't copy. Select the Markdown and copy it instead.");
    }
  }

  return (
    <section aria-labelledby="readme-cards" className="atlas-section">
      <div className="atlas-section-heading">
        <div>
          <p className="atlas-kicker">README cards</p>
          <h2 id="readme-cards">Put your usage in your README</h2>
        </div>
      </div>
      <div className="atlas-readme-cards">
        <div className="atlas-readme-cards__controls">
          <div className="atlas-readme-cards__field">
            <span className="atlas-readme-cards__label" id="readme-card-label">Card</span>
            <ToggleButtonGroup
              aria-labelledby="readme-card-label"
              disallowEmptySelection
              onSelectionChange={(keys) => {
                const [key] = [...keys];
                if (key) choose(() => setCard(String(key) as ReadmeCard));
              }}
              selectedKeys={[card]}
              selectionMode="single"
              size="sm"
            >
              {(Object.keys(README_CARDS) as ReadmeCard[]).map((id) => (
                <ToggleButton id={id} key={id}>{README_CARDS[id].label}</ToggleButton>
              ))}
            </ToggleButtonGroup>
            <p className="atlas-readme-cards__hint">{README_CARDS[card].description}</p>
          </div>
          <div className="atlas-readme-cards__row">
            <Select
              className="atlas-readme-cards__field"
              isDisabled={card === "heatmap"}
              onSelectionChange={(key) => {
                if (key !== null) choose(() => setPeriod(String(key) as ReadmePeriod));
              }}
              selectedKey={card === "heatmap" ? "year" : period}
              variant="secondary"
            >
              <Label>Date range</Label>
              <Select.Trigger className="atlas-readme-cards__select">
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox aria-label="Date range">
                  {card === "heatmap" ? (
                    <ListBox.Item id="year" textValue="Last 365 days">Last 365 days</ListBox.Item>
                  ) : (Object.keys(README_PERIODS) as ReadmePeriod[]).map((id) => (
                    <ListBox.Item id={id} key={id} textValue={README_PERIODS[id]}>
                      {README_PERIODS[id]}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
            <div className="atlas-readme-cards__field">
              <span className="atlas-readme-cards__label" id="readme-theme-label">Appearance</span>
              <ToggleButtonGroup
                aria-labelledby="readme-theme-label"
                disallowEmptySelection
                onSelectionChange={(keys) => {
                  const [key] = [...keys];
                  if (key) choose(() => setTheme(String(key) as ReadmeTheme));
                }}
                selectedKeys={[theme]}
                selectionMode="single"
                size="sm"
              >
                <ToggleButton id="light">Light</ToggleButton>
                <ToggleButton id="dark">Dark</ToggleButton>
              </ToggleButtonGroup>
            </div>
          </div>
          <div className="atlas-readme-cards__field">
            <label className="atlas-readme-cards__label" htmlFor="readme-markdown">Markdown</label>
            <textarea
              className="atlas-readme-cards__markdown"
              id="readme-markdown"
              onFocus={(event) => event.currentTarget.select()}
              readOnly
              rows={3}
              spellCheck={false}
              value={markdown}
            />
          </div>
          <div className="atlas-profile-page__actions mt-0">
            <Button onPress={() => void copy("markdown")}>{copied === "markdown" ? "Copied Markdown" : "Copy Markdown"}</Button>
            <Button onPress={() => void copy("url")} variant="outline">{copied === "url" ? "Copied image link" : "Copy image link"}</Button>
            <Button onPress={() => void onOpenExternal(EMBEDS_URL)} variant="ghost">More styles on usageatlas.com</Button>
          </div>
          <p aria-live="polite" className={error ? "text-sm text-danger" : "sr-only"}>
            {error ?? (copied ? "Copied to the clipboard." : "")}
          </p>
          <p className="atlas-readme-cards__hint">
            Clicking the card opens your profile. It refreshes with each cloud save.
            {cloudSaveOff ? " Cloud save is off, so cards only show usage saved earlier." : ""}
          </p>
        </div>
        <CardPreview key={imageUrl} card={card} theme={theme} url={imageUrl} />
      </div>
    </section>
  );
}

/** The card as GitHub would show it, on a matching page color. */
function CardPreview({ card, theme, url }: { card: ReadmeCard; theme: ReadmeTheme; url: string }): React.JSX.Element {
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const size = readmeCardSize(card);
  return (
    <figure className="atlas-readme-cards__preview" data-theme={theme}>
      <div className="atlas-readme-cards__image" data-state={state} style={{ aspectRatio: `${size.width} / ${size.height}`, maxWidth: size.width } as CSSProperties}>
        <img
          alt={`${README_CARDS[card].title} preview`}
          height={size.height}
          onError={() => setState("failed")}
          onLoad={() => setState("ready")}
          referrerPolicy="no-referrer"
          src={url}
          width={size.width}
        />
      </div>
      <figcaption className="atlas-readme-cards__hint">
        {state === "failed" ? "The preview didn't load. Check your connection; the Markdown still works." : "Preview"}
      </figcaption>
    </figure>
  );
}
