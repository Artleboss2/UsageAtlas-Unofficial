import { describe, expect, it } from "vitest";
import { readmeCardMarkdown, readmeCardSize, readmeCardUrl } from "./readme-cards";

describe("README cards", () => {
  it("builds the website's card links", () => {
    expect(readmeCardUrl("ada_l", "heatmap", "30d", "light")).toBe("https://usageatlas.com/api/cards/ada_l/heatmap.svg?theme=light");
    expect(readmeCardUrl("ada_l", "models", "90d", "dark")).toBe("https://usageatlas.com/api/cards/ada_l/models.svg?period=90d&theme=dark");
  });

  it("writes the same Markdown as the website's builder", () => {
    expect(readmeCardMarkdown("ada_l", "tokens", "all", "light")).toBe(
      "[![AI Coding Token Usage on UsageAtlas](https://usageatlas.com/api/cards/ada_l/tokens.svg?period=all&theme=light)](https://usageatlas.com/@ada_l)"
    );
  });

  it("reserves each card's size before it loads", () => {
    expect(readmeCardSize("heatmap")).toEqual({ width: 720, height: 220 });
    expect(readmeCardSize("tokens")).toEqual({ width: 460, height: 244 });
    expect(readmeCardSize("providers")).toEqual({ width: 460, height: 368 });
  });
});
