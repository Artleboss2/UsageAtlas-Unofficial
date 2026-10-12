import type { LeaderboardGlance } from "../shared/desktop-api";
import { CLOUD_URL } from "./cloud-url";

const CACHE_MS = 10 * 60_000;
const FACES = 5;
const MAX_BOARD_BYTES = 512 * 1024;
const MAX_AVATAR_BYTES = 256 * 1024;
const HANDLE = /^[a-z0-9][a-z0-9_]{2,29}$/u;
const UPLOADED_AVATAR = /^\/api\/avatars\/[a-f0-9]{64}\/[a-f0-9]{64}\.png$/u;
/**
 * Pictures from GitHub and Google sign-in. Any other avatar host was typed in by the
 * profile's owner, so the desktop never contacts it and shows initials instead.
 */
const PICTURE_HOSTS = /^(?:avatars\.githubusercontent\.com|lh[3-6]\.googleusercontent\.com)$/u;
const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

interface BoardEntry { handle: string; displayName: string; avatarUrl: string; rank: number; tokens: number }

/**
 * The public 30-day token board behind "You'd be #N" and the faces beside it. One
 * request per ten minutes at most; avatars arrive as data URLs because the window
 * only loads images from the app itself.
 */
export class PublicLeaderboard {
  private cached: { at: number; value: LeaderboardGlance } | null = null;
  private pending: Promise<LeaderboardGlance> | null = null;

  constructor(private readonly baseURL = CLOUD_URL, private readonly now = Date.now) {}

  glance(): Promise<LeaderboardGlance> {
    if (this.cached && this.now() - this.cached.at < CACHE_MS) return Promise.resolve(this.cached.value);
    this.pending ??= this.load()
      .then((value) => {
        this.cached = { at: this.now(), value };
        return value;
      })
      .finally(() => { this.pending = null; });
    return this.pending;
  }

  private async load(): Promise<LeaderboardGlance> {
    let response: Response;
    try {
      response = await fetch(`${this.baseURL}/api/leaderboard`, { signal: AbortSignal.timeout(15_000), redirect: "error" });
    } catch {
      throw new Error("Could not reach UsageAtlas.");
    }
    if (!response.ok) throw new Error("Leaderboard unavailable.");
    const body = await readLimited(response, MAX_BOARD_BYTES);
    if (!body) throw new Error("Invalid leaderboard response.");
    const board = parseBoard(JSON.parse(new TextDecoder().decode(body)));
    const loadable = board.entries.filter((entry) => this.avatarURL(entry.avatarUrl));
    const shown = [...loadable, ...board.entries.filter((entry) => !loadable.includes(entry))].slice(0, FACES)
      .sort((a, b) => board.entries.indexOf(a) - board.entries.indexOf(b));
    const faces = await Promise.all(shown.map(async (entry) => ({
      handle: entry.handle,
      name: entry.displayName,
      avatar: await this.avatar(entry.avatarUrl)
    })));
    return {
      profiles: board.profiles,
      ranked: board.ranked,
      entries: board.entries.map(({ handle, rank, tokens }) => ({ handle, rank, tokens })),
      faces
    };
  }

  private avatarURL(value: string): URL | null {
    if (!value) return null;
    try {
      const base = new URL(this.baseURL);
      const url = new URL(value, base);
      if (url.origin === base.origin && UPLOADED_AVATAR.test(url.pathname) && !url.search) return url;
      if (url.protocol !== "https:" || url.username || url.password || url.port || !PICTURE_HOSTS.test(url.hostname)) return null;
      if (url.hostname === "avatars.githubusercontent.com") url.searchParams.set("s", "96");
      return url;
    } catch {
      return null;
    }
  }

  /** A missing or unusable picture falls back to initials. */
  private async avatar(value: string): Promise<string | null> {
    const url = this.avatarURL(value);
    if (!url) return null;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(8_000), redirect: "error" });
      const type = response.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase() ?? "";
      if (!response.ok || !IMAGE_TYPES.has(type)) return null;
      const body = await readLimited(response, MAX_AVATAR_BYTES);
      return body?.byteLength ? `data:${type};base64,${Buffer.from(body).toString("base64")}` : null;
    } catch {
      return null;
    }
  }
}

/** The body, or null when it is larger than `limit`. */
async function readLimited(response: Response, limit: number): Promise<Uint8Array | null> {
  const reader = response.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

const count = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

function parseBoard(value: unknown): { profiles: number; ranked: number; entries: BoardEntry[] } {
  if (!value || typeof value !== "object") throw new Error("Invalid leaderboard response.");
  const { profiles, ranked, entries } = value as Record<string, unknown>;
  if (!count(profiles) || !count(ranked) || !Array.isArray(entries) || entries.length > 100)
    throw new Error("Invalid leaderboard response.");
  const parsed = entries.map((item: unknown): BoardEntry => {
    const entry = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    if (typeof entry.handle !== "string" || !HANDLE.test(entry.handle)
      || typeof entry.displayName !== "string" || typeof entry.avatarUrl !== "string"
      || !count(entry.rank) || (entry.rank as number) < 1
      || typeof entry.tokens !== "number" || !Number.isFinite(entry.tokens) || entry.tokens < 0)
      throw new Error("Invalid leaderboard response.");
    // Ranks depend on every row, so odd text is trimmed rather than failing the board.
    return {
      handle: entry.handle, displayName: entry.displayName.slice(0, 80),
      avatarUrl: entry.avatarUrl.length > 2048 ? "" : entry.avatarUrl,
      rank: entry.rank as number, tokens: entry.tokens
    };
  });
  return { profiles: profiles as number, ranked: Math.max(ranked as number, parsed.length), entries: parsed };
}
