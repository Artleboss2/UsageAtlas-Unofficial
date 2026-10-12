import type { LeaderboardGlance } from "../../shared/desktop-api";
import { initials, leaderboardStanding, standingCopy } from "../profile-promotion";

/**
 * Faces from the public leaderboard beside where this user stands, or would stand with
 * a public profile. `ownHandle` is set once the profile is live.
 */
export function LeaderboardStanding({ glance, onOpen, ownHandle, tokens }: {
  glance: LeaderboardGlance;
  onOpen?(): void;
  ownHandle: string | null;
  tokens: number;
}): React.JSX.Element | null {
  const live = ownHandle !== null;
  const copy = standingCopy(leaderboardStanding(glance, tokens, ownHandle), glance, tokens, live);
  if (!copy) return null;
  return (
    <div className="atlas-leaderboard-standing">
      {glance.faces.length ? (
        <span aria-hidden="true" className="atlas-leaderboard-standing__faces">
          {glance.faces.map((face) => face.avatar
            ? <img alt="" key={face.handle} src={face.avatar} />
            : <span key={face.handle}>{initials(face.name || face.handle)}</span>)}
        </span>
      ) : null}
      <div className="atlas-leaderboard-standing__text">
        <strong>{copy.title}</strong>
        <span>
          {copy.detail}
          {onOpen ? <> <button onClick={onOpen} type="button">See the leaderboard</button></> : null}
        </span>
      </div>
    </div>
  );
}
