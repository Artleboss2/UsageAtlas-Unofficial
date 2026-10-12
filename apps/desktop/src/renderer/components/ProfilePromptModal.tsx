import { Button, Modal } from "@heroui/react";
import type { CloudProfileStatus, LeaderboardGlance } from "../../shared/desktop-api";
import { profileSetupUrl, promptCopy } from "../profile-promotion";
import { trackGrowth, type ProfilePrompt } from "../profile-state";
import { LeaderboardStanding } from "./LeaderboardStanding";
import { PROFILE_PRIVACY_NOTE } from "./ProfilePage";
import { ProfilePreview } from "./ProfilePreview";

/**
 * The occasional invitation to publish a profile, timed to a milestone, a streak, or a
 * personal best. A private profile only needs publishing; everyone else claims a handle
 * on the Profile page first.
 */
export function ProfilePromptModal({ leaderboard, onClose, onDismiss, onOpenExternal, onOpenProfile, profile, prompt }: {
  leaderboard: LeaderboardGlance | null;
  onClose(): void;
  onDismiss(choice: "later" | "never"): void;
  onOpenExternal(url: string): Promise<void>;
  onOpenProfile(): void;
  profile: CloudProfileStatus;
  prompt: ProfilePrompt;
}): React.JSX.Element {
  const copy = promptCopy(prompt.trigger, prompt.preview);
  const handle = profile.state === "private" ? profile.handle : "yourname";

  function accept(): void {
    if (profile.state === "private") {
      trackGrowth("profile_prompt_clicked", { trigger: prompt.trigger.kind, surface: "modal", action: "publish" });
      void onOpenExternal(profileSetupUrl(profile, profile.handle));
    } else {
      trackGrowth("profile_prompt_clicked", { trigger: prompt.trigger.kind, surface: "modal", action: "create" });
      onOpenProfile();
    }
    onClose();
  }

  return (
    <Modal.Backdrop isOpen onOpenChange={(open) => { if (!open) onDismiss("later"); }} variant="blur">
      <Modal.Container placement="center" size="lg">
        <Modal.Dialog aria-label={copy.title} className="atlas-profile-modal">
          <Modal.CloseTrigger aria-label="Not now" />
          <div className="atlas-profile-modal__layout">
            <div className="atlas-profile-modal__copy">
              <p className="atlas-kicker">{copy.kicker}</p>
              <Modal.Heading>{copy.title}</Modal.Heading>
              <p>{copy.body}</p>
              {leaderboard ? <LeaderboardStanding glance={leaderboard} ownHandle={null} tokens={prompt.preview.recentTokens} /> : null}
              <p className="atlas-profile-modal__privacy">{PROFILE_PRIVACY_NOTE}</p>
              <div className="atlas-profile-modal__actions">
                <Button onPress={accept}>{profile.state === "private" ? "Publish my profile" : "Claim my handle"}</Button>
                <Button onPress={() => onDismiss("later")} variant="ghost">Not now</Button>
              </div>
              <button className="w-fit text-xs text-muted underline" onClick={() => onDismiss("never")} type="button">
                Don't show this again
              </button>
            </div>
            <div aria-hidden="true" className="atlas-profile-modal__art">
              <ProfilePreview handle={handle} preview={prompt.preview} />
            </div>
          </div>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
