import type { DashboardSnapshot } from "@usageatlas/contracts";
import interLatin from "@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url";
import { Button, Modal, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { domToPng } from "modern-screenshot";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { trackGrowth } from "../profile-state";
import {
  blueskyPostUrl,
  buildRecap,
  RECAP_PERIODS,
  RECAP_SIZE,
  recapFileName,
  recapLink,
  xPostUrl,
  type RecapPeriod,
  type RecapTheme
} from "../recap";
import { RecapCard } from "./RecapCard";

type ShareAction = "copy" | "save" | "x" | "bluesky";

let recapFont: Promise<string> | null = null;

/**
 * Inter for the image, as a data URL: an image can't load fonts by URL, and the CSP
 * keeps the library from reading the app's own stylesheets to find them.
 */
function recapFontCss(): Promise<string> {
  recapFont ??= fetch(interLatin)
    .then((response) => response.blob())
    .then((blob) => new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(`@font-face { font-family: "Inter Variable"; font-weight: 100 900; src: url(${String(reader.result)}) format("woff2"); }`);
      reader.onerror = () => reject(reader.error ?? new Error("The font could not be read."));
      reader.readAsDataURL(blob);
    }));
  recapFont.catch(() => { recapFont = null; });
  return recapFont;
}

interface RecapShareProps {
  initialPeriod?: RecapPeriod;
  /** Shown without a public profile, to get one. */
  onGetProfile?(): void;
  onOpenExternal(url: string): Promise<void>;
  profileHandle: string | null;
  snapshot: DashboardSnapshot;
  today: string;
}

/** The recap from the History page. */
export function RecapShareModal({ onClose, ...props }: RecapShareProps & { onClose(): void }): React.JSX.Element {
  return (
    <Modal.Backdrop isOpen onOpenChange={(open) => { if (!open) onClose(); }} variant="blur">
      <Modal.Container placement="center" size="lg">
        <Modal.Dialog aria-label="Share a recap" className="atlas-recap-modal">
          <Modal.CloseTrigger aria-label="Close" />
          <Modal.Header>
            <p className="atlas-kicker">Recap</p>
            <Modal.Heading>Share your week or month</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <RecapShare {...props} />
          </Modal.Body>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

/**
 * Builds the recap image from this computer's history and hands it to the clipboard, a
 * file, or a post on X or Bluesky. With a public profile, the image and post link to it.
 */
export function RecapShare({ initialPeriod = "week", onGetProfile, onOpenExternal, profileHandle, snapshot, today }: RecapShareProps): React.JSX.Element {
  const [period, setPeriod] = useState<RecapPeriod>(initialPeriod);
  const [theme, setTheme] = useState<RecapTheme>("dark");
  const [busy, setBusy] = useState<ShareAction | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const recap = useMemo(() => buildRecap(snapshot, today, period), [snapshot, today, period]);
  const link = recapLink(profileHandle);
  const card = useRef<HTMLDivElement>(null);
  const empty = recap.totalTokens <= 0;

  async function share(action: ShareAction): Promise<void> {
    if (!card.current) return;
    setBusy(action);
    setMessage(null);
    try {
      const png = await domToPng(card.current, { ...RECAP_SIZE, scale: 2, font: { cssText: await recapFontCss() } });
      if (action === "save") {
        if (!await window.usageAtlas.saveImage(png, recapFileName(recap))) return;
        setMessage({ tone: "success", text: "Image saved." });
      } else {
        await window.usageAtlas.copyImage(png);
        if (action === "copy") {
          setMessage({ tone: "success", text: "Image copied. Paste it into a post or message." });
        } else {
          const site = action === "x" ? "X" : "Bluesky";
          const opened = await onOpenExternal(action === "x" ? xPostUrl(recap, link.url) : blueskyPostUrl(recap, link.url))
            .then(() => true, () => false);
          setMessage(opened
            ? { tone: "success", text: `Image copied. Paste it into your post on ${site}.` }
            : { tone: "danger", text: `Image copied, but ${site} couldn't be opened. Paste it into a post there.` });
        }
      }
      trackGrowth("recap_shared", { period, action, link: profileHandle ? "profile" : "site" });
    } catch {
      setMessage({ tone: "danger", text: "Couldn't create the image. Try again." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="atlas-recap-share">
      <div className="atlas-recap-share__controls">
        <div className="atlas-readme-cards__field">
          <span className="atlas-readme-cards__label" id="recap-period-label">Period</span>
          <ToggleButtonGroup
            aria-labelledby="recap-period-label"
            disallowEmptySelection
            onSelectionChange={(keys) => {
              const [key] = [...keys];
              if (key) {
                setPeriod(String(key) as RecapPeriod);
                setMessage(null);
              }
            }}
            selectedKeys={[period]}
            selectionMode="single"
            size="sm"
          >
            {(Object.keys(RECAP_PERIODS) as RecapPeriod[]).map((id) => (
              <ToggleButton id={id} key={id}>{RECAP_PERIODS[id].label}</ToggleButton>
            ))}
          </ToggleButtonGroup>
        </div>
        <div className="atlas-readme-cards__field">
          <span className="atlas-readme-cards__label" id="recap-theme-label">Appearance</span>
          <ToggleButtonGroup
            aria-labelledby="recap-theme-label"
            disallowEmptySelection
            onSelectionChange={(keys) => {
              const [key] = [...keys];
              if (key) setTheme(String(key) as RecapTheme);
            }}
            selectedKeys={[theme]}
            selectionMode="single"
            size="sm"
          >
            <ToggleButton id="dark">Dark</ToggleButton>
            <ToggleButton id="light">Light</ToggleButton>
          </ToggleButtonGroup>
        </div>
        <div className="atlas-recap-share__actions">
          <Button isDisabled={empty || busy !== null} isPending={busy === "copy"} onPress={() => void share("copy")}>Copy image</Button>
          <Button isDisabled={empty || busy !== null} isPending={busy === "save"} onPress={() => void share("save")} variant="outline">Save image</Button>
        </div>
        <div className="atlas-recap-share__actions">
          <Button isDisabled={empty || busy !== null} isPending={busy === "x"} onPress={() => void share("x")} size="sm" variant="secondary">Post on X</Button>
          <Button isDisabled={empty || busy !== null} isPending={busy === "bluesky"} onPress={() => void share("bluesky")} size="sm" variant="secondary">Post on Bluesky</Button>
        </div>
        <p aria-live="polite" className={message ? `text-sm ${message.tone === "danger" ? "text-danger" : "text-muted"}` : "sr-only"}>
          {message?.text ?? ""}
        </p>
        <p className="atlas-readme-cards__hint">
          {profileHandle ? (
            <>The image and post link to {link.label}.</>
          ) : (
            <>
              With a public profile, the image and post link to your own page.
              {onGetProfile ? <> <button className="underline" onClick={onGetProfile} type="button">Get your profile</button></> : null}
            </>
          )}
        </p>
      </div>
      {empty ? (
        <p className="atlas-recap-share__empty">No usage in the {RECAP_PERIODS[period].label.toLowerCase()} yet.</p>
      ) : (
        <RecapStage>
          <RecapCard linkLabel={link.label} recap={recap} ref={card} theme={theme} />
        </RecapStage>
      )}
    </div>
  );
}

/** Scales the full-size card down to the space it has. */
function RecapStage({ children }: { children: React.ReactNode }): React.JSX.Element {
  const frame = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);

  useLayoutEffect(() => {
    const node = frame.current;
    if (!node) return;
    const measure = () => setScale(node.clientWidth / RECAP_SIZE.width);
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    measure();
    return () => observer.disconnect();
  }, []);

  return (
    <div className="atlas-recap-share__stage" ref={frame} style={{ aspectRatio: `${RECAP_SIZE.width} / ${RECAP_SIZE.height}` }}>
      <div aria-label="Recap preview" role="img" style={{ transform: `scale(${scale})` }}>{children}</div>
    </div>
  );
}
