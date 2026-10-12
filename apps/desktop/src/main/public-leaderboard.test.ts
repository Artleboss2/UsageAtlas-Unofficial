import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PublicLeaderboard } from "./public-leaderboard";

const BASE = "https://usageatlas.test";
const uploaded = `/api/avatars/${"a".repeat(64)}/${"b".repeat(64)}.png`;
const png = new Uint8Array([137, 80, 78, 71]);

let fetchMock: ReturnType<typeof vi.fn>;
let clock: number;

const entry = (handle: string, rank: number, tokens: number, avatarUrl = "") =>
  ({ rank, handle, displayName: handle.toUpperCase(), avatarUrl, tokens, activeDays: 3, streak: 2 });
const board = (entries: ReturnType<typeof entry>[], extra: Record<string, unknown> = {}) =>
  ({ query: {}, entries, ranked: entries.length, profiles: entries.length + 1, models: [], updatedAt: "", ...extra });

function serve(body: unknown, images: Record<string, Response> = {}) {
  fetchMock.mockImplementation(async (input: string | URL) => {
    const url = String(input);
    if (url === `${BASE}/api/leaderboard`) return Response.json(body);
    return images[url] ?? new Response(png, { headers: { "Content-Type": "image/png" } });
  });
}

beforeEach(() => {
  clock = 0;
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const leaderboard = () => new PublicLeaderboard(BASE, () => clock);
const requested = () => fetchMock.mock.calls.map(([input]) => String(input));

describe("public leaderboard", () => {
  it("keeps ranks and tokens, and turns sign-in pictures into data URLs", async () => {
    serve(board([
      entry("ada", 1, 9_000, uploaded),
      entry("grace", 2, 800, "https://avatars.githubusercontent.com/u/1?v=4"),
      entry("linus", 2, 800, "https://lh3.googleusercontent.com/a/photo=s96-c"),
      entry("ken", 4, 10)
    ], { profiles: 9 }));

    const glance = await leaderboard().glance();

    expect(glance).toEqual({
      profiles: 9,
      ranked: 4,
      entries: [
        { handle: "ada", rank: 1, tokens: 9_000 },
        { handle: "grace", rank: 2, tokens: 800 },
        { handle: "linus", rank: 2, tokens: 800 },
        { handle: "ken", rank: 4, tokens: 10 }
      ],
      faces: [
        { handle: "ada", name: "ADA", avatar: "data:image/png;base64,iVBORw==" },
        { handle: "grace", name: "GRACE", avatar: "data:image/png;base64,iVBORw==" },
        { handle: "linus", name: "LINUS", avatar: "data:image/png;base64,iVBORw==" },
        { handle: "ken", name: "KEN", avatar: null }
      ]
    });
    expect(requested()).toEqual([
      `${BASE}/api/leaderboard`,
      `${BASE}${uploaded}`,
      "https://avatars.githubusercontent.com/u/1?v=4&s=96",
      "https://lh3.googleusercontent.com/a/photo=s96-c"
    ]);
    expect(fetchMock.mock.calls.every(([, init]) => init.redirect === "error")).toBe(true);
  });

  it("never contacts avatar hosts chosen by profile owners", async () => {
    serve(board([
      entry("ada", 1, 900, "https://tracker.example/pixel.png"),
      entry("grace", 2, 800, "http://avatars.githubusercontent.com/u/1"),
      entry("linus", 3, 700, "https://avatars.githubusercontent.com.evil.example/u/1"),
      entry("ken", 4, 600, `${uploaded}?track=1`)
    ]));

    const glance = await leaderboard().glance();

    expect(glance.faces.map((face) => face.avatar)).toEqual([null, null, null, null]);
    expect(requested()).toEqual([`${BASE}/api/leaderboard`]);
  });

  it("prefers faces with pictures, then keeps board order", async () => {
    serve(board([
      entry("ada", 1, 900),
      entry("bob", 2, 800),
      ...["cat", "dan", "eve", "fay", "gus"].map((handle, index) => entry(handle, index + 3, 700 - index, uploaded))
    ]));

    const glance = await leaderboard().glance();

    expect(glance.faces.map((face) => face.handle)).toEqual(["cat", "dan", "eve", "fay", "gus"]);
  });

  it("falls back to initials for pictures that aren't small images", async () => {
    const github = "https://avatars.githubusercontent.com/u/";
    serve(board([entry("ada", 1, 900, `${github}1`), entry("bob", 2, 800, `${github}2`), entry("cat", 3, 700, `${github}3`)]), {
      [`${github}1?s=96`]: new Response("<svg/>", { headers: { "Content-Type": "image/svg+xml" } }),
      [`${github}2?s=96`]: new Response(new Uint8Array(300 * 1024), { headers: { "Content-Type": "image/png" } }),
      [`${github}3?s=96`]: new Response(png, { status: 404, headers: { "Content-Type": "image/png" } })
    });

    const glance = await leaderboard().glance();

    expect(glance.faces.map((face) => face.avatar)).toEqual([null, null, null]);
  });

  it("asks once per ten minutes and retries after a failure", async () => {
    serve(board([entry("ada", 1, 900)]));
    const cache = leaderboard();

    const [first, second] = await Promise.all([cache.glance(), cache.glance()]);
    expect(second).toBe(first);
    clock = 9 * 60_000;
    expect(await cache.glance()).toBe(first);
    expect(requested()).toEqual([`${BASE}/api/leaderboard`]);

    clock = 10 * 60_000;
    fetchMock.mockRejectedValueOnce(new TypeError("offline"));
    await expect(cache.glance()).rejects.toThrow("Could not reach UsageAtlas.");
    expect((await cache.glance()).entries).toHaveLength(1);
    expect(requested()).toHaveLength(3);
  });

  it("trims odd text instead of dropping the board", async () => {
    serve(board([{ ...entry("ada", 1, 900), displayName: "A".repeat(200), avatarUrl: `https://avatars.githubusercontent.com/${"x".repeat(3000)}` }]));

    const glance = await leaderboard().glance();

    expect(glance.faces).toEqual([{ handle: "ada", name: "A".repeat(80), avatar: null }]);
    expect(requested()).toEqual([`${BASE}/api/leaderboard`]);
  });

  it("rejects answers that don't look like the leaderboard", async () => {
    for (const body of [
      board([{ ...entry("ada", 1, 900), handle: "<script>" }]),
      board([{ ...entry("ada", 1, 900), tokens: -1 }]),
      board([{ ...entry("ada", 1, 900), rank: 0 }]),
      board([entry("ada", 1, 900)], { profiles: "lots" }),
      board(Array.from({ length: 101 }, (_, index) => entry(`user_${index}`, index + 1, 1)))
    ]) {
      serve(body);
      await expect(leaderboard().glance()).rejects.toThrow("Invalid leaderboard response.");
    }
    fetchMock.mockResolvedValueOnce(Response.json({ error: "Leaderboard unavailable. Try again." }, { status: 503 }));
    await expect(leaderboard().glance()).rejects.toThrow("Leaderboard unavailable.");
    fetchMock.mockResolvedValueOnce(new Response(new Uint8Array(600 * 1024)));
    await expect(leaderboard().glance()).rejects.toThrow("Invalid leaderboard response.");
  });
});
