import type { CSSProperties } from "react";
import { formatCompactNumber } from "../number-format";
import { initials, type ProfilePreviewData } from "../profile-promotion";
import "../profile-promotion.css";

/**
 * A tilted mock of the public profile page, drawn from history on this computer. It
 * mirrors the website's layout closely enough that the real page feels familiar.
 */
export function ProfilePreview({ handle, preview }: { handle: string; preview: ProfilePreviewData }): React.JSX.Element {
  const name = handle === "yourname" ? "Your name" : handle.charAt(0).toUpperCase() + handle.slice(1).replace(/_/gu, " ");
  return (
    <figure aria-label={`Preview of usageatlas.com/@${handle} with your usage`} className="atlas-profile-preview">
      <div className="atlas-profile-preview__frame">
        <div aria-hidden="true" className="atlas-profile-preview__chrome">
          <span className="atlas-profile-preview__dots"><i /><i /><i /></span>
          <span className="atlas-profile-preview__url">usageatlas.com/@{handle}</span>
        </div>
        <div className="atlas-profile-preview__body">
          <div className="atlas-profile-preview__identity">
            <span aria-hidden="true" className="atlas-profile-preview__avatar">{initials(name)}</span>
            <div>
              <strong>{name}</strong>
              <span>@{handle}</span>
            </div>
          </div>
          {preview.tools.length ? (
            <p className="atlas-profile-preview__tools">Builds with {preview.tools.map((tool) => tool.name).join(" · ")}</p>
          ) : null}
          <dl className="atlas-profile-preview__stats">
            <div><dt>Tokens</dt><dd>{formatCompactNumber(preview.totalTokens)}</dd></div>
            <div><dt>Per day</dt><dd>{preview.dailyAverage === null ? "—" : formatCompactNumber(preview.dailyAverage)}</dd></div>
            <div><dt>Longest streak</dt><dd>{preview.longestStreak}d</dd></div>
          </dl>
          <div
            aria-label={`${preview.activeDays} active ${preview.activeDays === 1 ? "day" : "days"}`}
            className="atlas-profile-preview__heat"
            role="img"
          >
            {preview.days.map((day) => <span data-level={day.level} key={day.date} />)}
          </div>
          {preview.models.length ? (
            <ul aria-label="Top models" className="atlas-profile-preview__models">
              {preview.models.map((model) => (
                <li key={model.label}>
                  <span className="atlas-profile-preview__model">{model.label}</span>
                  <span aria-hidden="true" className="atlas-profile-preview__bar" style={{ "--share": model.share } as CSSProperties} />
                  <span className="atlas-profile-preview__share">{Math.round(model.share * 100)}%</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </figure>
  );
}
