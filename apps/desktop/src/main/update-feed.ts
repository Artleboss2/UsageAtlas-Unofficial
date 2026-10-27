import type { UpdateChannel } from "../shared/desktop-api";

/** The project's own update mirror, which serves upstream builds. */
export const OFFICIAL_FEED_URL = "https://updates.usageatlas.com";
export const LATEST_RELEASE_URL = `${OFFICIAL_FEED_URL}/latest.json`;
export const DOWNLOAD_PAGE_URL = "https://usageatlas.com/#download";

/** This build's releases live on the fork; upstream keeps publishing its own. */
export const FORK_REPOSITORY = "Artleboss2/UsageAtlas";
export const UPSTREAM_REPOSITORY = "SRX9/UsageAtlas";

export function releaseRepository(channel: UpdateChannel): string {
  return channel === "upstream" ? UPSTREAM_REPOSITORY : FORK_REPOSITORY;
}

/**
 * Where a GitHub-hosted channel is read from. GitHub answers
 * `latest/download/<asset>` with the newest release that carries the asset, which
 * is exactly the two requests Squirrel.Windows makes: `<feed>/RELEASES` and then
 * `<feed>/<package>.nupkg`.
 */
export function githubFeedURL(channel: UpdateChannel): string {
  return `https://github.com/${releaseRepository(channel)}/releases/latest/download`;
}

export function latestReleaseAPIURL(channel: UpdateChannel): string {
  return `https://api.github.com/repos/${releaseRepository(channel)}/releases/latest`;
}

/** Where a version without an in-place installer is downloaded from. */
export function downloadPageURL(channel: UpdateChannel): string {
  return channel === "upstream" ? DOWNLOAD_PAGE_URL : `https://github.com/${FORK_REPOSITORY}/releases/latest`;
}

/** Release summary to poll on platforms without a Squirrel feed. */
export function updateCheckURL(channel: UpdateChannel): string {
  return channel === "upstream" ? LATEST_RELEASE_URL : latestReleaseAPIURL(channel);
}

/**
 * Squirrel requires a feed it can build both requests from. Windows gets one on
 * either channel; macOS keeps the mirror, whose versioned path lets the edge
 * answer 204 when there is nothing newer — GitHub cannot express that, so the
 * fork falls back to a version check and the releases page.
 */
export function squirrelFeedURL(
  platform: string,
  architecture: string,
  version: string,
  channel: UpdateChannel = "upstream"
): string | null {
  if (platform === "win32") {
    return channel === "upstream" ? `${OFFICIAL_FEED_URL}/win32/${architecture}` : githubFeedURL(channel);
  }
  if (platform === "darwin" && channel === "upstream") {
    return `${OFFICIAL_FEED_URL}/darwin/${architecture}/${encodeURIComponent(version)}`;
  }
  return null;
}

export function compareVersions(left: string, right: string): number {
  const parse = (value: string): { core: number[]; prerelease: string[] } => {
    const separator = value.indexOf("-");
    const core = (separator === -1 ? value : value.slice(0, separator))
      .split(".")
      .map((part) => Number.parseInt(part, 10) || 0);
    return { core, prerelease: separator === -1 ? [] : value.slice(separator + 1).split(".") };
  };
  const first = parse(left);
  const second = parse(right);
  for (let index = 0; index < 3; index += 1) {
    const difference = (first.core[index] ?? 0) - (second.core[index] ?? 0);
    if (difference !== 0) return difference < 0 ? -1 : 1;
  }
  // A final build outranks any prerelease sharing its core version.
  if (first.prerelease.length === 0 || second.prerelease.length === 0) {
    if (first.prerelease.length === second.prerelease.length) return 0;
    return first.prerelease.length === 0 ? 1 : -1;
  }
  for (let index = 0; index < Math.max(first.prerelease.length, second.prerelease.length); index += 1) {
    const a = first.prerelease[index];
    const b = second.prerelease[index];
    if (a === undefined) return -1;
    if (b === undefined) return 1;
    const numeric = /^\d+$/u.test(a) && /^\d+$/u.test(b);
    const comparison = numeric ? Number(a) - Number(b) : a.localeCompare(b);
    if (comparison !== 0) return comparison < 0 ? -1 : 1;
  }
  return 0;
}

export function isNewerVersion(candidate: string, installed: string): boolean {
  return compareVersions(candidate, installed) > 0;
}

/** Reads a version out of a release tag such as `desktop-v0.3.1`, `v0.3.1` or `0.3.1`. */
export function versionFromReleaseTag(value: string): string | null {
  const match = /(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/u.exec(value.trim());
  return match ? match[1] : null;
}

/**
 * Reads the published version out of a release summary: the mirror serves
 * `{ "version": ... }` and the GitHub API names the tag.
 */
export function latestPublishedVersion(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const listed = (payload as { version?: unknown }).version;
  const tag = (payload as { tag_name?: unknown }).tag_name;
  const version = typeof listed === "string" ? listed : typeof tag === "string" ? tag : null;
  return version === null ? null : versionFromReleaseTag(version);
}

/** Update endpoints can carry release paths; keep them out of local logs. */
export function redactUpdateError(message: string): string {
  return message.replace(/https?:\/\/[^\s]+/gu, "[update-url]").slice(0, 300);
}
