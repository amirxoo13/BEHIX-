/**
 * Studio (Piper / mic) lip timing, keyed by the clip's blob URL in `useStudio().audioUrls`.
 * Keying by URL keeps it in step with the store without changing it: a replaced or revoked clip has a new URL,
 * so a stale timeline is simply never looked up. In-memory only, like the blob URLs themselves.
 */
import type { VisemeTimeline } from "./v2/viseme-timeline.ts";

const byUrl = new Map<string, VisemeTimeline>();
const MAX = 500;

export function setUrlTimeline(url: string, t: VisemeTimeline): void {
  byUrl.delete(url);
  byUrl.set(url, t);
  if (byUrl.size > MAX) byUrl.delete(byUrl.keys().next().value as string);
}

export const timelineForUrl = (url: string | undefined): VisemeTimeline | undefined => (url ? byUrl.get(url) : undefined);

export const forgetUrlTimeline = (url: string) => byUrl.delete(url);
