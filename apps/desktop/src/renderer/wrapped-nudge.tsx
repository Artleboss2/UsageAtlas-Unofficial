import { toast } from "@heroui/react";
import { useEffect, useState } from "react";
import type { CloudProfileStatus } from "../shared/desktop-api";
import { GiftIcon } from "./icons";
import { wrappedNudge, wrappedUrl, type ProfilePreviewData } from "./profile-promotion";
import { markGrowthToast, trackGrowth, whenInFront } from "./profile-state";

/** The same moment as the achievement toast, which stands aside while this one is due. */
const NUDGE_DELAY_MS = 6_000;
const NUDGE_TIMEOUT_MS = 12_000;
const WRAPPED_SEEN_KEY = "usageatlas.wrapped.v1";

/** The last year whose Wrapped was announced or opened here. */
function readSeenWrapped(): number | null {
  const year = Number(localStorage.getItem(WRAPPED_SEEN_KEY));
  return Number.isSafeInteger(year) && year > 0 ? year : null;
}

export function rememberWrapped(year: number): void {
  localStorage.setItem(WRAPPED_SEEN_KEY, String(year));
}

/**
 * Tells a public profile, once a year in December or January, that its Wrapped is ready.
 * Shown in a toast on usage pages once the window has been in front for a few seconds.
 * Returns whether the toast is still due, so other toasts can stand aside.
 */
export function useWrappedNudge({ enabled, onOpenExternal, preview, profile }: {
  enabled: boolean;
  onOpenExternal(url: string): Promise<void>;
  preview: ProfilePreviewData | null;
  profile: CloudProfileStatus | null;
}): boolean {
  const [seen, setSeen] = useState(readSeenWrapped);
  const nudge = profile && preview ? wrappedNudge(profile, preview, seen, new Date()) : null;
  const handle = nudge?.handle;
  const year = nudge?.year;

  useEffect(() => {
    if (!enabled || handle === undefined || year === undefined) return;
    return whenInFront(NUDGE_DELAY_MS, () => {
      setSeen(year);
      // Opened from the Profile page since this rendered.
      if (readSeenWrapped() === year) return;
      rememberWrapped(year);
      markGrowthToast();
      const key = toast(`Your ${year} Wrapped is ready`, {
        description: "Your year in AI coding, on one page to share: streaks, the biggest day, and top tools and models.",
        indicator: <GiftIcon height={18} width={18} />,
        actionProps: {
          children: "Open Wrapped",
          onPress: () => {
            trackGrowth("wrapped_opened", { surface: "toast" });
            toast.close(key);
            void onOpenExternal(wrappedUrl(handle, year));
          },
          size: "sm",
          variant: "secondary"
        },
        timeout: NUDGE_TIMEOUT_MS
      });
      trackGrowth("wrapped_nudge_shown", { month: new Date().getUTCMonth() === 11 ? "december" : "january" });
    });
  }, [enabled, handle, onOpenExternal, year]);

  return nudge !== null;
}
