import type { DashboardSnapshot } from "@usageatlas/contracts";
import { Button, Card, Spinner } from "@heroui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CloudProfileStatus, CloudStatus, LeaderboardGlance } from "../../shared/desktop-api";
import { buildAchievements } from "../achievements";
import {
  buildProfilePreview,
  handleProblem,
  LEADERBOARD_URL,
  PROFILE_SITE,
  profileSetupUrl,
  publicProfileUrl,
  suggestHandle,
  wrappedSeason,
  wrappedUrl
} from "../profile-promotion";
import { trackGrowth, type CloudAccountState } from "../profile-state";
import { rememberWrapped } from "../wrapped-nudge";
import { ProfileAchievements } from "./Achievements";
import { LeaderboardStanding } from "./LeaderboardStanding";
import { ProfilePreview } from "./ProfilePreview";
import { ReadmeCards } from "./ReadmeCards";
import { RecapShare } from "./RecapShare";

export const PROFILE_PRIVACY_NOTE =
  "Your profile shows daily token totals, tools, models, and an estimated cost you can hide. Never prompts, code, or project names. It stays private until you publish.";

const REASONS = [
  { title: "One link for your AI work", body: "Real numbers from every coding tool you use, instead of screenshots." },
  { title: "Updates itself", body: "Each cloud save refreshes your page. There's nothing to maintain." },
  { title: "A place on the leaderboard", body: "Public profiles are ranked by tokens, streaks, and consistency." },
  { title: "Cards for your README", body: "Embed live usage cards on GitHub or your own site." }
];

type ClickAction = "sign-in" | "create" | "publish" | "view" | "leaderboard";

export function ProfilePage({ cloud, leaderboard, onOpenExternal, onOpenSettings, snapshot, today }: {
  cloud: CloudAccountState;
  leaderboard: LeaderboardGlance | null;
  onOpenExternal(url: string): Promise<void>;
  onOpenSettings(): void;
  snapshot: DashboardSnapshot | null;
  today: string;
}): React.JSX.Element {
  const { status } = cloud;
  const profile = status?.profile;
  const preview = useMemo(() => snapshot ? buildProfilePreview(snapshot, today) : null, [snapshot, today]);
  const achievements = useMemo(() => snapshot ? buildAchievements(snapshot, today) : null, [snapshot, today]);
  const [handle, setHandle] = useState("");
  // The handle a signed-out user chose before signing in; its form opens once the account is known.
  const [pendingClaim, setPendingClaim] = useState<string | null>(null);
  const viewed = useRef(false);
  const profileHandle = profile && "handle" in profile ? profile.handle : null;
  const shownHandle = profileHandle ?? (handle && !handleProblem(handle) ? handle : "yourname");
  const claiming = profile?.state === "signed-out" || profile?.state === "missing"
    || (pendingClaim !== null && profile?.state === "unknown");
  const signingIn = Boolean(status?.account || status?.loginCode) || cloud.pending === "sign-in";
  // Drop the claim when sign-in is cancelled or fails, or the account already has a profile.
  if (pendingClaim !== null && status && (!signingIn || (status.account && profile?.state !== "unknown" && profile?.state !== "missing"))) {
    setPendingClaim(null);
  }
  const claimReady = pendingClaim !== null && status?.account && profile?.state === "missing" ? pendingClaim : null;

  useEffect(() => {
    if (!claimReady) return;
    trackGrowth("profile_prompt_clicked", { trigger: "page", surface: "page", action: "create" });
    void onOpenExternal(profileSetupUrl({ state: "missing" }, claimReady)).finally(() => setPendingClaim(null));
  }, [claimReady, onOpenExternal]);

  useEffect(() => {
    if (!profile || viewed.current) return;
    viewed.current = true;
    trackGrowth("profile_page_viewed", { state: profile.state });
  }, [profile]);

  function open(action: ClickAction, url: string): void {
    trackGrowth("profile_prompt_clicked", { trigger: "page", surface: "page", action });
    void onOpenExternal(url);
  }

  const live = profile?.state === "public";
  const season = wrappedSeason(new Date());
  const wrappedYear = season !== null && preview?.yearTokens[season] && profile && profile.state !== "unknown" ? season : null;
  const standing = leaderboard && preview ? (
    <LeaderboardStanding
      glance={leaderboard}
      onOpen={live ? undefined : () => open("leaderboard", LEADERBOARD_URL)}
      ownHandle={live ? profileHandle : null}
      tokens={preview.recentTokens}
    />
  ) : null;

  return (
    <div className="atlas-page atlas-profile-page">
      <div className="atlas-profile-page__hero">
        <header className="atlas-page-header">
          <p className="atlas-kicker">Public profile</p>
          {!status || !profile ? (
            <div className="mt-6 flex items-center gap-2 text-sm text-muted" role="status">
              <Spinner size="sm" /> Checking your profile...
            </div>
          ) : claiming ? (
            <>
              <h1 className="atlas-page-title">Show what you build with AI</h1>
              <p className="atlas-hero-description">
                Claim a public page for your AI coding: tokens, streaks, tools, and models, kept up to date from this app.
              </p>
              {standing}
              <HandleClaim
                cloud={cloud}
                handle={handle}
                onClaim={(action, url) => open(action, url)}
                onHandleChange={setHandle}
                onOpenSettings={onOpenSettings}
                onSignIn={() => {
                  setPendingClaim(handle);
                  trackGrowth("profile_prompt_clicked", { trigger: "page", surface: "page", action: "sign-in" });
                  void cloud.act("sign-in");
                }}
                onCancelSignIn={() => {
                  setPendingClaim(null);
                  void cloud.act("sign-out");
                }}
                opening={pendingClaim !== null && status.account !== null}
                status={status}
              />
              <p className="atlas-profile-page__privacy">{PROFILE_PRIVACY_NOTE}</p>
            </>
          ) : profile.state === "public" ? (
            <>
              <h1 className="atlas-page-title">Your profile is live</h1>
              <p className="atlas-hero-description">
                Anyone with the link can see usageatlas.com/@{profile.handle}. It updates each time UsageAtlas saves your usage.
              </p>
              {standing}
              <div className="atlas-profile-page__actions">
                <Button onPress={() => open("view", publicProfileUrl(profile.handle))}>View profile</Button>
                <Button onPress={() => open("leaderboard", LEADERBOARD_URL)} variant="outline">See the leaderboard</Button>
                <Button onPress={() => void onOpenExternal(`${PROFILE_SITE}/account/profile`)} variant="ghost">Manage on usageatlas.com</Button>
              </div>
            </>
          ) : profile.state === "private" ? (
            <>
              <h1 className="atlas-page-title">Your profile is ready to publish</h1>
              <p className="atlas-hero-description">
                @{profile.handle} is saved, but only you can see it. Publish it on usageatlas.com to share your link.
              </p>
              {standing}
              <div className="atlas-profile-page__actions">
                <Button onPress={() => open("publish", profileSetupUrl(profile, profile.handle))}>Publish on usageatlas.com</Button>
              </div>
              <p className="atlas-profile-page__privacy">{PROFILE_PRIVACY_NOTE}</p>
            </>
          ) : (
            <>
              <h1 className="atlas-page-title">We couldn't check your profile</h1>
              <p className="atlas-hero-description">UsageAtlas couldn't reach usageatlas.com. Your usage on this computer is safe.</p>
              <div className="atlas-profile-page__actions">
                <Button isPending={cloud.pending === "refresh-profile"} onPress={() => void cloud.act("refresh-profile")}>Try again</Button>
                <Button onPress={() => void onOpenExternal(`${PROFILE_SITE}/account/profile`)} variant="outline">Open profile settings</Button>
              </div>
            </>
          )}
        </header>
        <div className="atlas-profile-page__preview">
          {preview ? (
            <ProfilePreview handle={shownHandle} preview={preview} />
          ) : (
            <p className="text-sm text-muted">Your preview appears once UsageAtlas has read your usage.</p>
          )}
        </div>
      </div>

      {wrappedYear !== null && profile ? (
        <WrappedCallout
          onOpen={profileHandle && live ? () => {
            trackGrowth("wrapped_opened", { surface: "page" });
            rememberWrapped(wrappedYear);
            void onOpenExternal(wrappedUrl(profileHandle, wrappedYear));
          } : null}
          state={profile.state}
          year={wrappedYear}
        />
      ) : null}

      {achievements && profile ? <ProfileAchievements live={live} progress={achievements} /> : null}

      {snapshot && profile ? (
        <section aria-labelledby="share-recap" className="atlas-section">
          <div className="atlas-section-heading">
            <div>
              <p className="atlas-kicker">Recap</p>
              <h2 id="share-recap">Share your week or month</h2>
            </div>
          </div>
          <RecapShare onOpenExternal={onOpenExternal} profileHandle={live ? profileHandle : null} snapshot={snapshot} today={today} />
        </section>
      ) : null}

      {status && profile?.state === "public" ? (
        <ReadmeCards cloudSaveOff={!status.automatic} handle={profile.handle} onOpenExternal={onOpenExternal} />
      ) : null}

      {profile && profile.state !== "public" ? (
        <section aria-labelledby="profile-reasons" className="atlas-section">
          <div className="atlas-section-heading">
            <div>
              <p className="atlas-kicker">Why publish</p>
              <h2 id="profile-reasons">A profile that keeps itself current</h2>
            </div>
          </div>
          <div className="atlas-profile-page__reasons">
            {REASONS.map((reason) => (
              <Card key={reason.title} variant="transparent">
                <Card.Content>
                  <h3>{reason.title}</h3>
                  <p>{reason.body}</p>
                </Card.Content>
              </Card>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

/** In December and January, the year's Wrapped: open for a public profile, a reason to publish for anyone else. */
function WrappedCallout({ onOpen, state, year }: {
  onOpen: (() => void) | null;
  state: CloudProfileStatus["state"];
  year: number;
}): React.JSX.Element {
  return (
    <section aria-labelledby="profile-wrapped" className="atlas-section atlas-wrapped-callout">
      <div className="atlas-wrapped-callout__copy">
        <p className="atlas-wrapped-callout__kicker">AI Coding Wrapped · {year}</p>
        <h2 id="profile-wrapped">{onOpen ? `Your ${year} Wrapped is ready` : `Get your ${year} Wrapped`}</h2>
        <p>
          {onOpen
            ? `Tokens, streaks, your biggest day, and top tools and models from ${year}, on one page to share.`
            : `Public profiles get a Wrapped: your ${year} in AI coding on one page to share. ${state === "private" ? "Publish your profile" : "Claim a handle"} to get yours.`}
        </p>
      </div>
      {onOpen ? <Button className="atlas-wrapped-callout__button" onPress={onOpen}>Open your Wrapped</Button> : null}
    </section>
  );
}

type HandleCheck = { handle: string; state: "checking" | "available" | "taken" | "error" };

/** Checks a handle as the user types, before the website form asks for it. */
function HandleClaim({ cloud, handle, onCancelSignIn, onClaim, onHandleChange, onOpenSettings, onSignIn, opening, status }: {
  cloud: CloudAccountState;
  handle: string;
  onCancelSignIn(): void;
  onClaim(action: "create", url: string): void;
  onHandleChange(handle: string): void;
  onOpenSettings(): void;
  onSignIn(): void;
  /** Signed in with a claim pending: the form opens as soon as the profile check answers. */
  opening: boolean;
  status: CloudStatus;
}): React.JSX.Element {
  const signedIn = status.account !== null;
  const [check, setCheck] = useState<HandleCheck | null>(null);
  const suggested = useRef(false);
  const problem = handle ? handleProblem(handle) : null;
  const result = check?.handle === handle ? check.state : null;
  const waiting = cloud.pending === "sign-in" || Boolean(status.loginCode) || opening;
  const canClaim = handle !== "" && !problem && (result === "available" || result === "error");
  const email = status.account?.email;

  useEffect(() => {
    if (suggested.current || handle || !email) return;
    suggested.current = true;
    onHandleChange(suggestHandle(email));
  }, [email, handle, onHandleChange]);

  useEffect(() => {
    if (!handle || handleProblem(handle)) return;
    let active = true;
    const timer = setTimeout(() => {
      setCheck({ handle, state: "checking" });
      window.usageAtlas.checkHandle(handle).then(
        (available) => { if (active) setCheck({ handle, state: available ? "available" : "taken" }); },
        () => { if (active) setCheck({ handle, state: "error" }); }
      );
    }, 400);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [handle]);

  const message = !handle
    ? { tone: "muted", text: "Your link will be usageatlas.com/@yourname." }
    : problem
      ? { tone: "danger", text: problem }
      : result === "available"
        ? { tone: "success", text: `@${handle} is available.` }
        : result === "taken"
          ? { tone: "danger", text: `@${handle} is taken. Try another.` }
          : result === "error"
            ? { tone: "muted", text: "Couldn't check right now. You can still continue." }
            : { tone: "muted", text: "Checking..." };
  const named = handle && !problem ? `@${handle}` : "";

  return (
    <div className="atlas-handle-claim">
      <label className="atlas-handle-claim__label" htmlFor="profile-handle">Choose your handle</label>
      <div className="atlas-handle-claim__field">
        <span aria-hidden="true">usageatlas.com/@</span>
        <input
          aria-describedby="profile-handle-status"
          aria-invalid={problem !== null || result === "taken"}
          autoCapitalize="none"
          autoComplete="off"
          disabled={waiting}
          id="profile-handle"
          maxLength={30}
          onChange={(event) => onHandleChange(event.target.value.trim().toLowerCase())}
          placeholder="yourname"
          spellCheck={false}
          value={handle}
        />
      </div>
      <p aria-live="polite" className="atlas-handle-claim__status" data-tone={message.tone} id="profile-handle-status">{message.text}</p>
      <div className="atlas-profile-page__actions mt-1">
        {signedIn && !opening ? (
          <Button isDisabled={!canClaim} onPress={() => onClaim("create", profileSetupUrl(status.profile, handle))}>
            {named ? `Claim ${named} on usageatlas.com` : "Claim on usageatlas.com"}
          </Button>
        ) : (
          <Button isDisabled={!canClaim || waiting} isPending={waiting} onPress={onSignIn}>
            {waiting ? <Spinner size="sm" /> : null}
            {opening ? "Opening your profile form..." : waiting ? "Waiting for approval..." : named ? `Sign in to claim ${named}` : "Sign in to claim"}
          </Button>
        )}
      </div>
      {status.loginCode ? (
        <div className="mt-3 border-t border-separator pt-3" role="status">
          <p className="text-xs text-muted">Match this code in your browser, then approve sign-in. Your profile form opens next.</p>
          <p className="atlas-handle-claim__code">{status.loginCode}</p>
          <Button onPress={onCancelSignIn} size="sm" variant="ghost">Cancel sign-in</Button>
        </div>
      ) : null}
      {signedIn ? (
        <p className="text-xs text-muted">
          Signed in as {email}.
          {!status.automatic ? (
            <> Cloud save is off, so your profile would stay empty. <button className="underline" onClick={onOpenSettings} type="button">Turn it on in Settings</button>.</>
          ) : null}
        </p>
      ) : (
        <p className="text-xs text-muted">Signing in creates a free account if you don't have one. Cloud save fills your profile.</p>
      )}
      {cloud.error || status.error ? <p className="text-sm text-danger" role="alert">{cloud.error ?? status.error}</p> : null}
    </div>
  );
}
