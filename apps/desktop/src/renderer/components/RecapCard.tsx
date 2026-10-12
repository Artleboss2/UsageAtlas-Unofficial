import type { CSSProperties, Ref } from "react";
import { formatCompactNumber } from "../number-format";
import { RECAP_PERIODS, recapBusiestDay, recapChange, recapDateRange, type RecapData, type RecapTheme } from "../recap";
import { ProviderLogo } from "./ProviderLogo";
import "../recap.css";

const WEEKDAY = new Intl.DateTimeFormat("en-US", { weekday: "short" });
const SHORT_DATE = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const atNoon = (day: string) => new Date(`${day}T12:00:00`);

/**
 * The shareable recap at its real 1200 x 675 size. It carries its own colors and font,
 * so the image looks the same whatever the app's theme.
 */
export function RecapCard({ linkLabel, recap, ref, theme }: {
  linkLabel: string;
  recap: RecapData;
  ref?: Ref<HTMLDivElement>;
  theme: RecapTheme;
}): React.JSX.Element {
  const busiest = Math.max(0, ...recap.days.map((day) => day.tokens));
  const change = recapChange(recap);
  const direction = !recap.change ? "flat" : recap.change > 0 ? "up" : "down";
  return (
    <div className="atlas-recap" data-period={recap.period} data-theme={theme} ref={ref}>
      <header className="atlas-recap__header">
        <span className="atlas-recap__brand"><img alt="" height={40} src="./usageatlas.png" width={40} />UsageAtlas</span>
        <span className="atlas-recap__link">{linkLabel}</span>
      </header>
      <div className="atlas-recap__main">
        <div className="atlas-recap__summary">
          <p className="atlas-recap__title">{RECAP_PERIODS[recap.period].title}</p>
          <p className="atlas-recap__dates">{recapDateRange(recap)}</p>
          <p className="atlas-recap__total"><strong>{formatCompactNumber(recap.totalTokens)}</strong> tokens</p>
          {change ? <p className="atlas-recap__change" data-direction={direction}>{change}</p> : null}
          <dl className="atlas-recap__stats">
            <div><dt>Active days</dt><dd>{recap.activeDays} of {recap.days.length}</dd></div>
            <div><dt>Streak</dt><dd>{recap.streak} {recap.streak === 1 ? "day" : "days"}</dd></div>
            {recap.busiest ? <div><dt>Busiest day</dt><dd>{recapBusiestDay(recap)}</dd></div> : null}
          </dl>
        </div>
        <div className="atlas-recap__detail">
          <div className="atlas-recap__chart">
            {recap.days.map((day) => (
              <span data-empty={day.tokens <= 0 || undefined} key={day.date} style={{ "--size": busiest ? day.tokens / busiest : 0 } as CSSProperties} />
            ))}
          </div>
          <div className="atlas-recap__axis">
            {recap.period === "week"
              ? recap.days.map((day) => <span key={day.date}>{WEEKDAY.format(atNoon(day.date))}</span>)
              : <><span>{SHORT_DATE.format(atNoon(recap.startDay))}</span><span>{SHORT_DATE.format(atNoon(recap.endDay))}</span></>}
          </div>
          {recap.models.length ? (
            <ul className="atlas-recap__models">
              {recap.models.map((model) => (
                <li key={model.label}>
                  <span className="atlas-recap__model">{model.label}</span>
                  <span className="atlas-recap__share">{Math.round(model.share * 100)}%</span>
                  <span className="atlas-recap__bar" style={{ "--share": model.share } as CSSProperties} />
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
      {recap.tools.length ? (
        <footer className="atlas-recap__tools">
          <span>Built with</span>
          {recap.tools.map((tool) => (
            <span className="atlas-recap__tool" key={tool.id}>
              <ProviderLogo mini providerID={tool.id} providerName={tool.name} />
              {tool.name}
            </span>
          ))}
        </footer>
      ) : null}
    </div>
  );
}
