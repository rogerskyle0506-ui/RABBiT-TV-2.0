// src/lib/episode-radar.ts
import { getHardwareLimits, purgeOldTmdbCaches } from "@/lib/settings";

export const EPISODE_RADAR_CACHE_KEY = "rabtv_episode_radar_cache_v1";
export const EPISODE_RADAR_UPDATED_EVENT = "rabtv_episode_radar_updated";

const RADAR_CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const FRESH_WINDOW_DAYS = 14; // Episodes aired within last 14 days count as "New"
const REQUEST_TIMEOUT_MS = 6500;
const MAX_CONCURRENCY = 3;
const MAX_CACHED_SHOWS = 60;

export interface EpisodeRadarAlert {
  showId: string;
  showTitle: string;
  seasonNumber: number;
  episodeNumber: number;
  episodeName: string;
  airDate: string; // YYYY-MM-DD
  daysAgo: number; // 0 = today, 1 = yesterday, ...
  badgeLabel: string;
  nextAirDate?: string | null;
  checkedAt: number;
}

interface RadarCacheEntry {
  checkedAt: number;
  alert: EpisodeRadarAlert | null;
}

function cleanNumericShowId(raw: string): string {
  const cleaned = String(raw || "")
    .trim()
    .replace(/^(tv|movie)-/i, "");
  return /^\d+$/.test(cleaned) ? cleaned : "";
}

function computeDaysAgo(isoDate: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null;
  const parts = isoDate.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => isNaN(n))) return null;

  const airMidnight = new Date(parts[0], parts[1] - 1, parts[2]).getTime();
  const now = new Date();
  const todayMidnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).getTime();

  return Math.floor((todayMidnight - airMidnight) / (24 * 60 * 60 * 1000));
}

function buildBadgeLabel(
  seasonNumber: number,
  episodeNumber: number,
  daysAgo: number
): string {
  if (daysAgo === 0) return `🆕 New S${seasonNumber}E${episodeNumber} Today!`;
  if (daysAgo === 1) return `🆕 New S${seasonNumber}E${episodeNumber} • 1d`;
  return `🆕 New S${seasonNumber}E${episodeNumber} • ${daysAgo}d`;
}

function readRawRadarCache(): Record<string, RadarCacheEntry> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(EPISODE_RADAR_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeRawRadarCache(cache: Record<string, RadarCacheEntry>): void {
  if (typeof window === "undefined") return;
  // Prune oldest entries if cache grows beyond cap
  const entries = Object.entries(cache);
  let trimmed = cache;
  if (entries.length > MAX_CACHED_SHOWS) {
    entries.sort((a, b) => (b[1]?.checkedAt || 0) - (a[1]?.checkedAt || 0));
    trimmed = Object.fromEntries(entries.slice(0, MAX_CACHED_SHOWS));
  }

  const serialized = JSON.stringify(trimmed);
  try {
    localStorage.setItem(EPISODE_RADAR_CACHE_KEY, serialized);
  } catch {
    try {
      purgeOldTmdbCaches();
      localStorage.setItem(EPISODE_RADAR_CACHE_KEY, serialized);
    } catch {
      // Ignore if device storage is critically full
    }
  }
}

/**
 * Instantly returns all valid (non-expired, within 14-day fresh window)
 * cached episode alerts for zero-flicker rendering.
 */
export function getCachedEpisodeAlerts(): Record<string, EpisodeRadarAlert> {
  const cache = readRawRadarCache();
  const result: Record<string, EpisodeRadarAlert> = {};

  for (const [showId, entry] of Object.entries(cache)) {
    if (!entry?.alert) continue;
    const daysAgo = computeDaysAgo(entry.alert.airDate);
    if (daysAgo === null || daysAgo < 0 || daysAgo > FRESH_WINDOW_DAYS) {
      continue;
    }
    result[showId] = {
      ...entry.alert,
      daysAgo,
      badgeLabel: buildBadgeLabel(
        entry.alert.seasonNumber,
        entry.alert.episodeNumber,
        daysAgo
      ),
    };
  }

  return result;
}

/**
 * Returns false if the user has already marked that specific newly-aired
 * episode as completed in Watch History.
 */
export function isAlertUnseenByUser(
  alert: EpisodeRadarAlert | undefined,
  completedEpisodes?: Record<
    string,
    { seasonNumber: number; episodeNumber: number; confirmedCompleted: boolean }
  >
): boolean {
  if (!alert) return false;
  if (!completedEpisodes) return true;

  for (const ep of Object.values(completedEpisodes)) {
    if (
      ep.confirmedCompleted &&
      ep.seasonNumber === alert.seasonNumber &&
      ep.episodeNumber === alert.episodeNumber
    ) {
      return false;
    }
  }
  return true;
}

async function fetchShowLatestEpisode(
  showId: string,
  apiKey: string,
  parentSignal?: AbortSignal
): Promise<EpisodeRadarAlert | null> {
  const controller = new AbortController();
  const onParentAbort = () => controller.abort();
  parentSignal?.addEventListener("abort", onParentAbort, { once: true });

  const timeoutId =
    typeof window !== "undefined"
      ? window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
      : setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/tv/${showId}?api_key=${encodeURIComponent(
        apiKey
      )}&language=en-US`,
      { signal: controller.signal }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || data.success === false) return null;

    const lastEp = data.last_episode_to_air;
    if (!lastEp || !lastEp.air_date) return null;

    const seasonNum = Number(lastEp.season_number || 0);
    const epNum = Number(lastEp.episode_number || 0);
    if (seasonNum <= 0 || epNum <= 0) return null;

    const daysAgo = computeDaysAgo(String(lastEp.air_date));
    if (daysAgo === null || daysAgo < 0 || daysAgo > FRESH_WINDOW_DAYS) {
      return null;
    }

    return {
      showId,
      showTitle: String(data.name || data.original_name || "TV Series"),
      seasonNumber: seasonNum,
      episodeNumber: epNum,
      episodeName: String(lastEp.name || `Episode ${epNum}`),
      airDate: String(lastEp.air_date),
      daysAgo,
      badgeLabel: buildBadgeLabel(seasonNum, epNum, daysAgo),
      nextAirDate: data.next_episode_to_air?.air_date
        ? String(data.next_episode_to_air.air_date)
        : null,
      checkedAt: Date.now(),
    };
  } catch {
    return null;
  } finally {
    parentSignal?.removeEventListener("abort", onParentAbort);
    if (typeof window !== "undefined") {
      window.clearTimeout(timeoutId as number);
    } else {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * Scans up to 12 tracked TV show IDs (6 on 1-2GB sticks) for fresh episodes,
 * using 12-hour caching and throttled concurrency so network & RAM stay light.
 */
export async function scanTrackedShowsForNewEpisodes(
  rawShowIds: string[],
  signal?: AbortSignal
): Promise<Record<string, EpisodeRadarAlert>> {
  if (typeof window === "undefined") return {};

  const cachedAlerts = getCachedEpisodeAlerts();
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return cachedAlerts;
  }

  const apiKey = ((import.meta as any).env?.VITE_TMDB_API_KEY as string) || "";
  if (!apiKey) return cachedAlerts;

  const isLowRam = getHardwareLimits().effectiveMode === "low";
  const maxShowsThisPass = isLowRam ? 6 : 12;

  // Deduplicate and sanitize numeric TMDB TV IDs
  const uniqueIds: string[] = [];
  const seen = new Set<string>();
  for (const raw of rawShowIds) {
    const clean = cleanNumericShowId(raw);
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    uniqueIds.push(clean);
    if (uniqueIds.length >= maxShowsThisPass) break;
  }

  if (!uniqueIds.length) return cachedAlerts;

  const cache = readRawRadarCache();
  const now = Date.now();
  const staleIds = uniqueIds.filter((id) => {
    const entry = cache[id];
    return !entry || now - (entry.checkedAt || 0) >= RADAR_CACHE_TTL_MS;
  });

  if (!staleIds.length) {
    return cachedAlerts;
  }

  let updatedAny = false;
  let cursor = 0;

  async function worker() {
    while (cursor < staleIds.length && !signal?.aborted) {
      const id = staleIds[cursor++];
      const alert = await fetchShowLatestEpisode(id, apiKey, signal);
      if (signal?.aborted) return;
      cache[id] = {
        checkedAt: Date.now(),
        alert,
      };
      updatedAny = true;
    }
  }

  const workerCount = Math.min(MAX_CONCURRENCY, staleIds.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  if (updatedAny && !signal?.aborted) {
    writeRawRadarCache(cache);
    window.dispatchEvent(new Event(EPISODE_RADAR_UPDATED_EVENT));
  }

  return getCachedEpisodeAlerts();
}

export function clearEpisodeRadarCache(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(EPISODE_RADAR_CACHE_KEY);
    window.dispatchEvent(new Event(EPISODE_RADAR_UPDATED_EVENT));
  } catch {
    // ignore
  }
}