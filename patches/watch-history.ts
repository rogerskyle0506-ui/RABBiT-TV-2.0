// patches/watch-history.ts (copied to src/lib/watch-history.ts during build)
import { getHardwareLimits, purgeOldTmdbCaches } from "./settings";

export interface WatchHistoryItem {
  id: string | number;
  mediaId: string | number;
  title?: string;
  name?: string;
  mediaType?: "movie" | "tv";
  media_type?: "movie" | "tv";
  posterPath?: string | null;
  poster_path?: string | null;
  backdropPath?: string | null;
  backdrop_path?: string | null;
  image?: string | null;
  progressPercent?: number;
  progress?: number;
  lastWatchedAt?: string;
  updatedAt?: number;
  seasonNumber?: number;
  season?: number;
  episodeNumber?: number;
  episode?: number;
  episodeTitle?: string;
  confirmedCompleted?: boolean;
  completed?: boolean;
  totalEpisodes?: number;
  /** TMDB genre IDs – used by hero / suggestions to curate "FOR YOU" */
  genreIds?: number[];
}

export interface EpisodeWatchRecord {
  episodeId: string;
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  confirmedCompleted: boolean;
  progressPercent: number;
  updatedAt: number;
}

export interface ShowWatchHistory {
  showId: string;
  title: string;
  mediaType: "movie" | "tv";
  posterPath?: string | null;
  backdropPath?: string | null;
  totalEpisodes: number;
  lastWatchedAt: number;
  episodes: Record<string, EpisodeWatchRecord>;
}

export interface DislikedTitle {
  id: number | string;
  title?: string;
  name?: string;
  mediaType?: string;
  posterPath?: string | null;
  dislikedAt?: number;
}

export interface RecentLiveChannel {
  channelId: string;
  title: string;
  logo: string;
  streamUrl: string;
  watchedAt: number;
}

export interface WatchActivityStats {
  totalTrackedMedia: number;
  inProgressMovies: number;
  completedMovies: number;
  inProgressShows: number;
  completedShows: number;
  totalCompleted: number;
  completionRatePct: number;
  recentLiveCount: number;
  dislikedCount: number;
  topGenreName: string | null;
}

export type ClearHistoryScope =
  | "all"
  | "media"
  | "completed"
  | "live"
  | "disliked";

const WATCH_HISTORY_KEY = "rabtv_watch_history";
const DISLIKED_TITLES_KEY = "rabbit_tv_disliked_titles";
const RECENT_LIVE_CHANNELS_KEY = "rabtv_recent_live_channels";
const MAX_DISLIKED_ITEMS = 150;

const TMDB_GENRE_NAMES: Record<number, string> = {
  28: "Action",
  12: "Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Family",
  14: "Fantasy",
  36: "History",
  27: "Horror",
  10402: "Music",
  9648: "Mystery",
  10749: "Romance",
  878: "Sci-Fi",
  53: "Thriller",
  10752: "War",
  37: "Western",
  10759: "Action & Adventure",
  10762: "Kids",
  10764: "Reality",
  10765: "Sci-Fi & Fantasy",
};

// In-memory cache layer to eliminate redundant JSON parsing on every route check
let rawHistoryCache: WatchHistoryItem[] | null = null;
let watchHistoryMapCache: Record<string, ShowWatchHistory> | null = null;
let dislikedCache: DislikedTitle[] | null = null;
let recentLiveCache: RecentLiveChannel[] | null = null;

function invalidateCaches() {
  rawHistoryCache = null;
  watchHistoryMapCache = null;
  dislikedCache = null;
  recentLiveCache = null;
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (
      !e.key ||
      e.key === WATCH_HISTORY_KEY ||
      e.key === DISLIKED_TITLES_KEY ||
      e.key === RECENT_LIVE_CHANNELS_KEY
    ) {
      invalidateCaches();
    }
  });
}

function cleanMediaId(raw: string | number | undefined): string {
  return String(raw ?? "")
    .replace(/^(movie|tv)-/i, "")
    .replace(/-s\d+-e\d+$/i, "")
    .trim();
}

function sanitizeLabel(raw: string | undefined, fallback: string): string {
  const cleaned = String(raw || "")
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, 120);
  return cleaned || fallback;
}

function sanitizeAssetUrl(raw?: string | null): string | null {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // Allow relative TMDB poster paths (/abc.jpg) or safe http(s) URLs only
  if (trimmed.startsWith("/")) return trimmed;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      return trimmed;
    }
  } catch {
    return null;
  }
  return null;
}

function getHistoryCap(): number {
  try {
    return Math.max(25, getHardwareLimits().maxCachedHistoryItems || 50);
  } catch {
    return 50;
  }
}

function getLiveHistoryCap(): number {
  try {
    return getHardwareLimits().effectiveMode === "low" ? 6 : 10;
  } catch {
    return 6;
  }
}

function safeWriteJson(key: string, payload: unknown): boolean {
  if (typeof window === "undefined") return false;
  const serialized = JSON.stringify(payload);
  try {
    localStorage.setItem(key, serialized);
    return true;
  } catch {
    // Low-RAM stick storage full: purge temporary TMDB caches and retry once
    try {
      purgeOldTmdbCaches();
      localStorage.setItem(key, serialized);
      return true;
    } catch (err) {
      console.error(`Failed to persist ${key} after cache purge:`, err);
      return false;
    }
  }
}

function parseEpisodeFromId(
  episodeId: string
): { seasonNumber: number; episodeNumber: number } | null {
  const match = String(episodeId || "").match(/-s(\d+)-e(\d+)$/i);
  if (!match) return null;
  return {
    seasonNumber: Math.max(1, parseInt(match[1], 10) || 1),
    episodeNumber: Math.max(1, parseInt(match[2], 10) || 1),
  };
}

export function getRawWatchHistory(): WatchHistoryItem[] {
  if (typeof window === "undefined") return [];
  if (rawHistoryCache) return rawHistoryCache;

  try {
    const raw = localStorage.getItem(WATCH_HISTORY_KEY);
    if (!raw) {
      rawHistoryCache = [];
      return [];
    }
    const items = JSON.parse(raw);
    if (!Array.isArray(items)) {
      rawHistoryCache = [];
      return [];
    }

    rawHistoryCache = items
      .filter((item: any) => item && (item.mediaId !== undefined || item.id !== undefined))
      .map((item: any) => {
        const resolvedId = String(item.id ?? item.mediaId ?? "");
        const cleanId = cleanMediaId(item.mediaId ?? item.id);
        const rawType = item.mediaType ?? item.media_type;
        const mediaType: "movie" | "tv" =
          rawType === "tv" || String(item.id).toLowerCase().startsWith("tv-")
            ? "tv"
            : "movie";
        const safePoster = sanitizeAssetUrl(
          item.posterPath ?? item.poster_path ?? item.image
        );
        const safeBackdrop = sanitizeAssetUrl(
          item.backdropPath ?? item.backdrop_path
        );
        const ts =
          typeof item.updatedAt === "number" && item.updatedAt > 0
            ? item.updatedAt
            : item.lastWatchedAt
              ? new Date(item.lastWatchedAt).getTime() || Date.now()
              : Date.now();
        const seasonNum =
          mediaType === "tv"
            ? Math.max(1, Number(item.seasonNumber ?? item.season ?? 1) || 1)
            : undefined;
        const episodeNum =
          mediaType === "tv"
            ? Math.max(1, Number(item.episodeNumber ?? item.episode ?? 1) || 1)
            : undefined;

        return {
          ...item,
          id: resolvedId,
          mediaId: cleanId,
          title: sanitizeLabel(item.title ?? item.name, "Unknown Title"),
          mediaType,
          media_type: mediaType,
          posterPath: safePoster,
          poster_path: safePoster,
          backdropPath: safeBackdrop,
          backdrop_path: safeBackdrop,
          image: safePoster,
          progressPercent: Math.max(
            0,
            Math.min(100, Number(item.progressPercent ?? item.progress ?? 0) || 0)
          ),
          confirmedCompleted: Boolean(
            item.confirmedCompleted ?? item.completed ?? false
          ),
          seasonNumber: seasonNum,
          episodeNumber: episodeNum,
          updatedAt: ts,
          lastWatchedAt: item.lastWatchedAt || new Date(ts).toISOString(),
          genreIds: Array.isArray(item.genreIds)
            ? item.genreIds.filter((g: any) => typeof g === "number")
            : [],
        };
      });
    return rawHistoryCache;
  } catch {
    return [];
  }
}

export function getWatchHistory(): Record<string, ShowWatchHistory> {
  if (watchHistoryMapCache) return watchHistoryMapCache;

  const rawItems = getRawWatchHistory();
  const map: Record<string, ShowWatchHistory> = {};

  for (const item of rawItems) {
    const showId = cleanMediaId(item.mediaId ?? item.id) || "unknown";
    const title = sanitizeLabel(item.title ?? item.name, "Unknown Title");
    const mediaType: "movie" | "tv" =
      (item.mediaType ?? item.media_type) === "tv" ? "tv" : "movie";
    const posterPath = item.posterPath ?? item.poster_path ?? item.image;
    const seasonNum = Math.max(
      1,
      Number(item.seasonNumber ?? item.season ?? 1) || 1
    );
    const episodeNum = Math.max(
      1,
      Number(item.episodeNumber ?? item.episode ?? 1) || 1
    );
    const epKey =
      mediaType === "movie"
        ? `${showId}-s1-e1`
        : `${showId}-s${seasonNum}-e${episodeNum}`;
    const itemTs =
      item.updatedAt ||
      (item.lastWatchedAt ? new Date(item.lastWatchedAt).getTime() : 0) ||
      Date.now();

    if (!map[showId]) {
      map[showId] = {
        showId,
        title:
          title === "Episode" || title === "Title" ? "Unknown Title" : title,
        mediaType,
        posterPath,
        backdropPath: item.backdropPath ?? item.backdrop_path,
        totalEpisodes:
          mediaType === "movie"
            ? 1
            : item.totalEpisodes && item.totalEpisodes > 1
              ? item.totalEpisodes
              : 12,
        lastWatchedAt: itemTs,
        episodes: {},
      };
    } else {
      if (itemTs > map[showId].lastWatchedAt) {
        map[showId].lastWatchedAt = itemTs;
      }
      if (
        (map[showId].title === "Unknown Title" ||
          map[showId].title === "Episode") &&
        title &&
        title !== "Episode" &&
        title !== "Title"
      ) {
        map[showId].title = title;
      }
      if (!map[showId].posterPath && posterPath) {
        map[showId].posterPath = posterPath;
      }
      if (!map[showId].backdropPath && item.backdropPath) {
        map[showId].backdropPath = item.backdropPath;
      }
    }

    if (
      mediaType === "tv" &&
      item.totalEpisodes &&
      item.totalEpisodes > map[showId].totalEpisodes
    ) {
      map[showId].totalEpisodes = item.totalEpisodes;
    }

    const existingEp = map[showId].episodes[epKey];
    const isCompleted = Boolean(item.confirmedCompleted);
    const pct = isCompleted ? 100 : item.progressPercent ?? 0;

    if (!existingEp || itemTs >= existingEp.updatedAt) {
      map[showId].episodes[epKey] = {
        episodeId: epKey,
        seasonNumber: seasonNum,
        episodeNumber: episodeNum,
        title:
          item.episodeTitle ||
          (mediaType === "movie"
            ? map[showId].title
            : `S${seasonNum}E${episodeNum}`),
        confirmedCompleted: isCompleted || Boolean(existingEp?.confirmedCompleted),
        progressPercent: Math.max(pct, existingEp?.progressPercent ?? 0),
        updatedAt: Math.max(itemTs, existingEp?.updatedAt ?? 0),
      };
    }
  }

  // Ensure TV totalEpisodes is never smaller than the number of tracked episodes
  for (const show of Object.values(map)) {
    if (show.mediaType === "tv") {
      const epCount = Object.keys(show.episodes).length;
      if (epCount > show.totalEpisodes) {
        show.totalEpisodes = epCount;
      }
    }
  }

  watchHistoryMapCache = map;
  return map;
}

export function saveWatchProgress(
  item: Omit<WatchHistoryItem, "lastWatchedAt">
): void {
  if (typeof window === "undefined") return;
  const history = [...getRawWatchHistory()];
  const cleanId = cleanMediaId(item.mediaId ?? item.id);
  const rawType = item.mediaType ?? item.media_type;
  const resolvedType: "movie" | "tv" =
    rawType === "tv" || String(item.id).toLowerCase().startsWith("tv-")
      ? "tv"
      : "movie";

  const seasonNum =
    resolvedType === "tv"
      ? Math.max(1, Number(item.seasonNumber ?? item.season ?? 1) || 1)
      : undefined;
  const episodeNum =
    resolvedType === "tv"
      ? Math.max(1, Number(item.episodeNumber ?? item.episode ?? 1) || 1)
      : undefined;

  // For TV shows, match the EXACT episode so watching S1E2 never erases S1E1!
  const existingIndex = history.findIndex((h) => {
    const hClean = cleanMediaId(h.mediaId ?? h.id);
    if (hClean !== cleanId) return false;
    if (resolvedType === "tv") {
      const hSeason = Math.max(1, Number(h.seasonNumber ?? h.season ?? 1) || 1);
      const hEp = Math.max(1, Number(h.episodeNumber ?? h.episode ?? 1) || 1);
      return hSeason === seasonNum && hEp === episodeNum;
    }
    return true;
  });

  const progressVal = Math.max(
    0,
    Math.min(100, Number(item.progressPercent ?? item.progress ?? 0) || 0)
  );
  const existingItem = existingIndex >= 0 ? history[existingIndex] : null;
  const existingConfirmed = existingItem?.confirmedCompleted ?? false;
  const existingGenreIds = existingItem?.genreIds || [];

  const canonicalId =
    resolvedType === "tv"
      ? `tv-${cleanId}-s${seasonNum}-e${episodeNum}`
      : `movie-${cleanId}`;

  const safePoster = sanitizeAssetUrl(
    item.posterPath ??
      item.poster_path ??
      item.image ??
      existingItem?.posterPath
  );
  const safeBackdrop = sanitizeAssetUrl(
    item.backdropPath ?? item.backdrop_path ?? existingItem?.backdropPath
  );

  const updatedItem: WatchHistoryItem = {
    ...existingItem,
    ...item,
    id: canonicalId,
    mediaId: cleanId,
    title: sanitizeLabel(
      item.title ?? item.name ?? existingItem?.title,
      "Unknown Title"
    ),
    mediaType: resolvedType,
    media_type: resolvedType,
    posterPath: safePoster,
    poster_path: safePoster,
    backdropPath: safeBackdrop,
    backdrop_path: safeBackdrop,
    image: safePoster,
    seasonNumber: seasonNum,
    episodeNumber: episodeNum,
    progressPercent: Math.max(progressVal, existingItem?.progressPercent ?? 0),
    lastWatchedAt: new Date().toISOString(),
    updatedAt: Date.now(),
    confirmedCompleted: progressVal >= 95 ? true : existingConfirmed,
    completed: progressVal >= 95 ? true : existingConfirmed,
    genreIds:
      Array.isArray(item.genreIds) && item.genreIds.length > 0
        ? item.genreIds
        : existingGenreIds,
  };

  if (existingIndex >= 0) {
    history.splice(existingIndex, 1);
  }
  history.unshift(updatedItem);

  const cappedHistory = history.slice(0, getHistoryCap());
  safeWriteJson(WATCH_HISTORY_KEY, cappedHistory);
  invalidateCaches();
  window.dispatchEvent(new Event("rabtv_watch_history_updated"));
}

/**
 * Compatibility bridge function to satisfy direct `recordWatchHistory` imports across routes.
 */
export function recordWatchHistory(item: {
  id: string | number;
  title: string;
  posterPath?: string | null;
  type?: "movie" | "tv" | "livetv";
  mediaType?: "movie" | "tv" | "livetv";
  seasonNumber?: number;
  episodeNumber?: number;
  episodeTitle?: string;
}): void {
  const type = item.type || item.mediaType || "movie";
  if (type === "livetv") {
    logLiveChannelWatch({
      channelId: String(item.id),
      title: item.title,
      logo: item.posterPath || "",
      streamUrl: String(item.id),
    });
  } else {
    saveWatchProgress({
      id: item.id,
      mediaId: item.id,
      title: item.title,
      mediaType: type as "movie" | "tv",
      posterPath: item.posterPath,
      seasonNumber: item.seasonNumber,
      episodeNumber: item.episodeNumber,
      episodeTitle: item.episodeTitle,
    });
  }
}

export function markAsConfirmedCompleted(
  id: string,
  completed: boolean
): void {
  if (typeof window === "undefined") return;
  const history = [...getRawWatchHistory()];
  const cleanTarget = cleanMediaId(id);
  let changed = false;

  for (const item of history) {
    if (
      String(item.id) === String(id) ||
      cleanMediaId(item.mediaId ?? item.id) === cleanTarget
    ) {
      item.confirmedCompleted = completed;
      item.completed = completed;
      item.progressPercent = completed ? 100 : 0;
      item.updatedAt = Date.now();
      changed = true;
    }
  }

  if (changed) {
    safeWriteJson(WATCH_HISTORY_KEY, history.slice(0, getHistoryCap()));
    invalidateCaches();
    window.dispatchEvent(new Event("rabtv_watch_history_updated"));
  }
}

export function markEpisodeCompleted(
  showId: string,
  episodeId: string,
  completed: boolean
): void {
  if (typeof window === "undefined") return;
  const history = [...getRawWatchHistory()];
  const cleanShowId = cleanMediaId(showId);
  const parsedEp = parseEpisodeFromId(episodeId);

  let updated = false;

  for (const item of history) {
    const itemCleanId = cleanMediaId(item.mediaId ?? item.id);
    if (itemCleanId !== cleanShowId) continue;

    if (item.mediaType === "tv" && parsedEp) {
      const itemSeason = Math.max(
        1,
        Number(item.seasonNumber ?? item.season ?? 1) || 1
      );
      const itemEp = Math.max(
        1,
        Number(item.episodeNumber ?? item.episode ?? 1) || 1
      );
      if (
        itemSeason === parsedEp.seasonNumber &&
        itemEp === parsedEp.episodeNumber
      ) {
        item.confirmedCompleted = completed;
        item.completed = completed;
        item.progressPercent = completed ? 100 : 0;
        item.updatedAt = Date.now();
        updated = true;
      }
    } else if (
      item.mediaType === "movie" ||
      String(item.id) === String(episodeId)
    ) {
      item.confirmedCompleted = completed;
      item.completed = completed;
      item.progressPercent = completed ? 100 : 0;
      item.updatedAt = Date.now();
      updated = true;
    }
  }

  if (!updated) {
    history.unshift({
      id: episodeId || cleanShowId,
      mediaId: cleanShowId,
      mediaType: parsedEp ? "tv" : "movie",
      seasonNumber: parsedEp?.seasonNumber,
      episodeNumber: parsedEp?.episodeNumber,
      title: "Unknown Title",
      progressPercent: completed ? 100 : 0,
      confirmedCompleted: completed,
      completed,
      lastWatchedAt: new Date().toISOString(),
      updatedAt: Date.now(),
      genreIds: [],
    });
  }

  safeWriteJson(WATCH_HISTORY_KEY, history.slice(0, getHistoryCap()));
  invalidateCaches();
  window.dispatchEvent(new Event("rabtv_watch_history_updated"));
}

/**
 * One-tap toggle to mark an entire TV series (all tracked episodes) or movie completed/incomplete.
 */
export function markEntireShowCompleted(
  showId: string,
  completed: boolean
): void {
  markAsConfirmedCompleted(showId, completed);
}

export function removeFromWatchHistory(id: string): void {
  if (typeof window === "undefined") return;
  const cleanTarget = cleanMediaId(id);
  const history = getRawWatchHistory().filter(
    (h) =>
      String(h.id) !== String(id) &&
      cleanMediaId(h.mediaId ?? h.id) !== cleanTarget
  );
  safeWriteJson(WATCH_HISTORY_KEY, history.slice(0, getHistoryCap()));
  invalidateCaches();
  window.dispatchEvent(new Event("rabtv_watch_history_updated"));
}

/**
 * Determines the smartest next episode to launch for a TV show.
 */
export function getNextUnwatchedEpisode(show: ShowWatchHistory): {
  seasonNumber: number;
  episodeNumber: number;
  label: string;
} {
  const eps = Object.values(show.episodes).sort((a, b) =>
    a.seasonNumber !== b.seasonNumber
      ? a.seasonNumber - b.seasonNumber
      : a.episodeNumber - b.episodeNumber
  );

  if (eps.length === 0) {
    return { seasonNumber: 1, episodeNumber: 1, label: "S1E1" };
  }

  // First unfinished tracked episode
  const unfinished = eps.find((e) => !e.confirmedCompleted);
  if (unfinished) {
    return {
      seasonNumber: unfinished.seasonNumber,
      episodeNumber: unfinished.episodeNumber,
      label: `S${unfinished.seasonNumber}E${unfinished.episodeNumber}`,
    };
  }

  // Otherwise advance 1 episode past the highest completed episode
  const latest = eps[eps.length - 1];
  const nextEp = latest.episodeNumber + 1;
  return {
    seasonNumber: latest.seasonNumber,
    episodeNumber: nextEp,
    label: `S${latest.seasonNumber}E${nextEp}`,
  };
}

export function calculateSeriesProgress(
  show: ShowWatchHistory | string | number
): number {
  if (typeof show === "object" && show !== null && "episodes" in show) {
    if (show.mediaType === "movie") {
      const singleEp = Object.values(show.episodes)[0];
      if (!singleEp) return 0;
      return singleEp.confirmedCompleted
        ? 100
        : singleEp.progressPercent || 0;
    }
    const eps = Object.values(show.episodes);
    if (eps.length === 0) return 0;

    const completedCount = eps.filter((e) => e.confirmedCompleted).length;
    // If every tracked episode is marked completed and user explicitly checked them all, show 100%
    if (completedCount === eps.length && eps.length >= 1) {
      const denom = Math.max(eps.length, show.totalEpisodes || eps.length);
      if (completedCount >= denom) return 100;
    }
    const denom = Math.max(1, show.totalEpisodes || eps.length);
    const percentage = Math.round((completedCount / denom) * 100);
    return Math.min(100, percentage);
  }

  const history = getRawWatchHistory();
  const cleanId = cleanMediaId(show);
  const item = history.find(
    (h) =>
      String(h.id) === String(show) ||
      cleanMediaId(h.mediaId ?? h.id) === cleanId
  );
  if (!item) return 0;
  return item.progressPercent ?? (item.confirmedCompleted ? 100 : 0);
}

// ==========================================
// DISLIKED TITLES HELPERS
// ==========================================

export function getDislikedTitles(): DislikedTitle[] {
  if (typeof window === "undefined") return [];
  if (dislikedCache) return dislikedCache;

  try {
    const data = localStorage.getItem(DISLIKED_TITLES_KEY);
    const parsed = data ? JSON.parse(data) : [];
    dislikedCache = Array.isArray(parsed) ? parsed : [];
    return dislikedCache;
  } catch (e) {
    console.error("Failed to get disliked titles:", e);
    return [];
  }
}

export function isTitleDisliked(id: string | number): boolean {
  if (!id) return false;
  const cleanId = cleanMediaId(id);
  const disliked = getDislikedTitles();
  return disliked.some((item) => cleanMediaId(item.id) === cleanId);
}

export function dislikeTitle(item: {
  id: string | number;
  title?: string;
  name?: string;
  mediaType?: string;
  posterPath?: string | null;
}): void {
  if (typeof window === "undefined") return;

  const cleanId = cleanMediaId(item.id);
  removeFromWatchHistory(cleanId);

  const disliked = [...getDislikedTitles()];
  const exists = disliked.some((d) => cleanMediaId(d.id) === cleanId);

  if (!exists) {
    disliked.unshift({
      id: cleanId,
      title: sanitizeLabel(item.title ?? item.name, "Unknown Title"),
      mediaType: item.mediaType ?? "movie",
      posterPath: sanitizeAssetUrl(item.posterPath),
      dislikedAt: Date.now(),
    });
    safeWriteJson(DISLIKED_TITLES_KEY, disliked.slice(0, MAX_DISLIKED_ITEMS));
    invalidateCaches();
  }

  window.dispatchEvent(new Event("rabtv_watch_history_updated"));
  window.dispatchEvent(new Event("rabtv_disliked_updated"));
}

export function removeDislikedTitle(id: number | string): void {
  if (typeof window === "undefined") return;
  try {
    const cleanId = cleanMediaId(id);
    const disliked = getDislikedTitles().filter(
      (item) => cleanMediaId(item.id) !== cleanId
    );
    safeWriteJson(DISLIKED_TITLES_KEY, disliked);
    invalidateCaches();

    window.dispatchEvent(new Event("rabtv_watch_history_updated"));
    window.dispatchEvent(new Event("rabtv_disliked_updated"));
  } catch (e) {
    console.error("Failed to remove disliked title:", e);
  }
}

// ==========================================
// LIVE CHANNELS WATCH HISTORY HELPERS
// ==========================================

export function getRecentLiveChannels(): RecentLiveChannel[] {
  if (typeof window === "undefined") return [];
  if (recentLiveCache) return recentLiveCache;

  try {
    const raw = localStorage.getItem(RECENT_LIVE_CHANNELS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    recentLiveCache = Array.isArray(parsed) ? parsed : [];
    return recentLiveCache;
  } catch (err) {
    console.error("Error reading recent live channels:", err);
    return [];
  }
}

export function logLiveChannelWatch(channel: {
  title: string;
  logo: string;
  streamUrl: string;
  channelId?: string;
}) {
  if (typeof window === "undefined") return;
  try {
    const currentList = getRecentLiveChannels();
    const cleanId = String(channel.channelId || channel.streamUrl || "").trim();
    if (!cleanId) return;

    const filtered = currentList.filter(
      (c) => c.channelId !== cleanId && c.streamUrl !== channel.streamUrl
    );

    const updated = [
      {
        channelId: cleanId,
        title: sanitizeLabel(channel.title, "Live Channel"),
        logo: sanitizeAssetUrl(channel.logo) || "",
        streamUrl: sanitizeAssetUrl(channel.streamUrl) || channel.streamUrl,
        watchedAt: Date.now(),
      },
      ...filtered,
    ].slice(0, getLiveHistoryCap());

    safeWriteJson(RECENT_LIVE_CHANNELS_KEY, updated);
    invalidateCaches();
    window.dispatchEvent(new Event("rabtv_watch_history_updated"));
  } catch (err) {
    console.error("Error logging live channel watch:", err);
  }
}

export function removeRecentLiveChannel(channelId: string) {
  if (typeof window === "undefined") return;
  try {
    const currentList = getRecentLiveChannels();
    const updated = currentList.filter((c) => c.channelId !== channelId);
    safeWriteJson(RECENT_LIVE_CHANNELS_KEY, updated);
    invalidateCaches();
    window.dispatchEvent(new Event("rabtv_watch_history_updated"));
  } catch (err) {
    console.error("Error removing recent live channel:", err);
  }
}

// ==========================================
// ANALYTICS, GRANULAR CLEAR & EXPORT/IMPORT
// ==========================================

export function getWatchActivityStats(): WatchActivityStats {
  const map = getWatchHistory();
  const entries = Object.values(map);
  const raw = getRawWatchHistory();
  const live = getRecentLiveChannels();
  const disliked = getDislikedTitles();

  let inProgressMovies = 0;
  let completedMovies = 0;
  let inProgressShows = 0;
  let completedShows = 0;

  for (const show of entries) {
    const pct = calculateSeriesProgress(show);
    if (show.mediaType === "movie") {
      if (pct >= 100) completedMovies++;
      else inProgressMovies++;
    } else {
      if (pct >= 100) completedShows++;
      else inProgressShows++;
    }
  }

  const genreCounts: Record<number, number> = {};
  for (const item of raw) {
    for (const gid of item.genreIds || []) {
      genreCounts[gid] = (genreCounts[gid] || 0) + 1;
    }
  }
  let topGenreId: number | null = null;
  let topCount = 0;
  for (const [gidStr, count] of Object.entries(genreCounts)) {
    if (count > topCount) {
      topCount = count;
      topGenreId = Number(gidStr);
    }
  }

  const totalCompleted = completedMovies + completedShows;
  const totalTrackedMedia = entries.length;
  const completionRatePct =
    totalTrackedMedia > 0
      ? Math.round((totalCompleted / totalTrackedMedia) * 100)
      : 0;

  return {
    totalTrackedMedia,
    inProgressMovies,
    completedMovies,
    inProgressShows,
    completedShows,
    totalCompleted,
    completionRatePct,
    recentLiveCount: live.length,
    dislikedCount: disliked.length,
    topGenreName: topGenreId ? TMDB_GENRE_NAMES[topGenreId] || null : null,
  };
}

export function clearWatchHistoryScope(scope: ClearHistoryScope): void {
  if (typeof window === "undefined") return;

  if (scope === "all" || scope === "media") {
    localStorage.removeItem(WATCH_HISTORY_KEY);
  } else if (scope === "completed") {
    const remaining = getRawWatchHistory().filter(
      (h) => !h.confirmedCompleted && (h.progressPercent ?? 0) < 100
    );
    safeWriteJson(WATCH_HISTORY_KEY, remaining);
  }

  if (scope === "all" || scope === "live") {
    localStorage.removeItem(RECENT_LIVE_CHANNELS_KEY);
  }

  if (scope === "all" || scope === "disliked") {
    localStorage.removeItem(DISLIKED_TITLES_KEY);
  }

  invalidateCaches();
  window.dispatchEvent(new Event("rabtv_watch_history_updated"));
  window.dispatchEvent(new Event("rabtv_disliked_updated"));
}

export function exportWatchHistorySnapshot(): {
  version: number;
  exportedAt: string;
  watchHistory: WatchHistoryItem[];
  recentLiveChannels: RecentLiveChannel[];
  dislikedTitles: DislikedTitle[];
} {
  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    watchHistory: getRawWatchHistory(),
    recentLiveChannels: getRecentLiveChannels(),
    dislikedTitles: getDislikedTitles(),
  };
}

export function importWatchHistorySnapshot(raw: unknown): {
  valid: boolean;
  restoredCount: number;
} {
  if (!raw || typeof raw !== "object") return { valid: false, restoredCount: 0 };
  const data = raw as Record<string, unknown>;
  let restoredCount = 0;

  if (Array.isArray(data.watchHistory)) {
    const capped = data.watchHistory.slice(0, getHistoryCap());
    safeWriteJson(WATCH_HISTORY_KEY, capped);
    restoredCount += capped.length;
  }
  if (Array.isArray(data.recentLiveChannels)) {
    const capped = data.recentLiveChannels.slice(0, getLiveHistoryCap());
    safeWriteJson(RECENT_LIVE_CHANNELS_KEY, capped);
    restoredCount += capped.length;
  }
  if (Array.isArray(data.dislikedTitles)) {
    const capped = data.dislikedTitles.slice(0, MAX_DISLIKED_ITEMS);
    safeWriteJson(DISLIKED_TITLES_KEY, capped);
    restoredCount += capped.length;
  }

  if (restoredCount > 0 && typeof window !== "undefined") {
    invalidateCaches();
    window.dispatchEvent(new Event("rabtv_watch_history_updated"));
    window.dispatchEvent(new Event("rabtv_disliked_updated"));
  }

  return { valid: restoredCount > 0, restoredCount };
}
