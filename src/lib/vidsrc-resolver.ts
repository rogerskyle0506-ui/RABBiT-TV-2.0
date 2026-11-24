// src/lib/vidsrc-resolver.ts
import { purgeOldTmdbCaches } from "@/lib/settings";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const VIDSRC_DIRECT_ORIGIN = "https://vidsrc.sh";
const VIDSRC_DIRECT_EMBED_BASE = `${VIDSRC_DIRECT_ORIGIN}/embed`;
const VIDSRC_DIRECT_INFO_BASE = `${VIDSRC_DIRECT_ORIGIN}/info`;

const DEFAULT_TMDB_TIMEOUT_MS = 8000;
const INFO_PROBE_TIMEOUT_MS = 3500;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const MEMORY_CACHE_MAX_ENTRIES = 32;

export type DirectIdMode = "tmdb" | "imdb";

export interface ResolvedDirectMedia {
  tmdbId: string;
  imdbId: string | null;
  mediaType: "movie" | "tv";
  details: any;
  directUrl: string;
  imdbDirectUrl: string | null;
  fromCache: boolean;
}

export interface DirectStreamProbeResult {
  status: "verified" | "unverified" | "unavailable";
  quality: string | null;
  checkedIdMode: DirectIdMode;
}

export interface NormalizedPlayerEvent {
  origin: string;
  status: "playing" | "paused" | "ended" | "buffering" | "timeupdate" | "unknown";
  currentTime: number | null;
  duration: number | null;
  progressPercent: number | null;
  season: number | null;
  episode: number | null;
}

// Strict allowlist of trusted embed origins for postMessage telemetry
const TRUSTED_EMBED_ORIGINS = new Set<string>([
  "https://vidsrc.sh",
  "https://vidlink.pro",
  "https://vidsrc.cc",
  "https://player.videasy.net",
  "https://vidsrc.icu",
]);

// Lightweight bounded in-memory LRU cache to protect 1-2GB RAM TV sticks
const memoryTmdbCache = new Map<string, { data: any; timestamp: number }>();

function readMemoryCache(key: string): any | null {
  const hit = memoryTmdbCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.timestamp > CACHE_TTL_MS) {
    memoryTmdbCache.delete(key);
    return null;
  }
  // Refresh LRU order
  memoryTmdbCache.delete(key);
  memoryTmdbCache.set(key, hit);
  return hit.data;
}

function writeMemoryCache(key: string, data: any): void {
  if (memoryTmdbCache.has(key)) {
    memoryTmdbCache.delete(key);
  } else if (memoryTmdbCache.size >= MEMORY_CACHE_MAX_ENTRIES) {
    const oldestKey = memoryTmdbCache.keys().next().value;
    if (oldestKey) memoryTmdbCache.delete(oldestKey);
  }
  memoryTmdbCache.set(key, { data, timestamp: Date.now() });
}

function safeWriteLocalCache(key: string, data: any): void {
  if (typeof window === "undefined") return;
  const serialized = JSON.stringify({ data, timestamp: Date.now() });
  try {
    localStorage.setItem(key, serialized);
  } catch {
    try {
      purgeOldTmdbCaches();
      localStorage.setItem(key, serialized);
    } catch {
      // Skip localStorage write if storage quota is critically full
    }
  }
}

function safeReadLocalCache(key: string): any | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.timestamp === "number" &&
      Date.now() - parsed.timestamp < CACHE_TTL_MS &&
      parsed.data &&
      parsed.data.success !== false &&
      !parsed.data.status_code
    ) {
      return parsed.data;
    }
  } catch {
    // Ignore corrupted cache entry
  }
  return null;
}

/**
 * Strictly validates a numeric TMDB ID to prevent path traversal or injection.
 */
export function sanitizeTmdbId(raw: unknown): string {
  const cleaned = String(raw ?? "")
    .replace(/^(movie|tv)-/i, "")
    .trim();
  return /^\d{1,12}$/.test(cleaned) ? cleaned : "";
}

/**
 * Strictly validates an IMDb title ID (e.g. tt0944947).
 */
export function sanitizeImdbId(raw: unknown): string | null {
  const cleaned = String(raw ?? "").trim();
  return /^tt\d{6,10}$/i.test(cleaned) ? cleaned.toLowerCase() : null;
}

/**
 * Clamps season/episode indices to safe positive integers.
 */
export function sanitizePositiveInt(raw: unknown, fallback = 1): number {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(n, 999);
}

/**
 * Builds the direct Rabbit TV Direct (vidsrc.sh) embed URL from a verified
 * TMDB ID or IMDb ID. Both resolve to the exact same title on vidsrc.sh.
 */
export function buildRabbitTvDirectUrl(options: {
  mediaType: "movie" | "tv";
  tmdbId: string;
  imdbId?: string | null;
  idMode?: DirectIdMode;
  season?: number;
  episode?: number;
  autoPlayNext?: boolean;
  defaultSubLang?: string;
}): string {
  const safeTmdb = sanitizeTmdbId(options.tmdbId);
  const safeImdb = sanitizeImdbId(options.imdbId);
  const useImdb = options.idMode === "imdb" && Boolean(safeImdb);
  const resolvedId = useImdb ? (safeImdb as string) : safeTmdb;

  if (!resolvedId) return "about:blank";

  const params = new URLSearchParams();
  if (options.mediaType === "tv" && options.autoPlayNext) {
    params.set("autonext", "1");
  }
  if (options.defaultSubLang && /^[a-z]{2,3}$/i.test(options.defaultSubLang)) {
    params.set("ds_lang", options.defaultSubLang.toLowerCase());
  }
  const qs = params.toString();
  const suffix = qs ? `?${qs}` : "";

  if (options.mediaType === "tv") {
    const safeSeason = sanitizePositiveInt(options.season, 1);
    const safeEpisode = sanitizePositiveInt(options.episode, 1);
    return `${VIDSRC_DIRECT_EMBED_BASE}/tv/${resolvedId}/${safeSeason}/${safeEpisode}${suffix}`;
  }

  return `${VIDSRC_DIRECT_EMBED_BASE}/movie/${resolvedId}${suffix}`;
}

/**
 * Internal fetch helper with linked AbortController + hard timeout.
 */
async function fetchJsonSafely(
  url: string,
  parentSignal?: AbortSignal,
  timeoutMs = DEFAULT_TMDB_TIMEOUT_MS
): Promise<any | null> {
  const controller = new AbortController();
  const onParentAbort = () => controller.abort();
  if (parentSignal?.aborted) {
    controller.abort();
  } else {
    parentSignal?.addEventListener("abort", onParentAbort, { once: true });
  }

  const timer =
    typeof window !== "undefined"
      ? window.setTimeout(() => controller.abort(), timeoutMs)
      : setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    parentSignal?.removeEventListener("abort", onParentAbort);
    if (typeof window !== "undefined") {
      window.clearTimeout(timer as number);
    } else {
      clearTimeout(timer);
    }
  }
}

/**
 * Scrubs TMDB for full title details (cover art, backdrop, cast, seasons,
 * external IMDb ID) with automatic movie <-> tv verification, and resolves
 * the exact Rabbit TV Direct (vidsrc.sh) embed links.
 */
export async function fetchTmdbAndResolveDirect(options: {
  tmdbId: string;
  mediaType: "movie" | "tv";
  season?: number;
  episode?: number;
  apiKey: string;
  autoPlayNext?: boolean;
  signal?: AbortSignal;
  onCacheHit?: (resolved: ResolvedDirectMedia) => void;
}): Promise<ResolvedDirectMedia | null> {
  const safeId = sanitizeTmdbId(options.tmdbId);
  const apiKey = String(options.apiKey || "").trim();
  if (!safeId || !apiKey) return null;

  const season = sanitizePositiveInt(options.season, 1);
  const episode = sanitizePositiveInt(options.episode, 1);
  let activeType: "movie" | "tv" = options.mediaType === "tv" ? "tv" : "movie";

  const makeResolved = (
    data: any,
    typeHint: "movie" | "tv",
    fromCache: boolean
  ): ResolvedDirectMedia => {
    const resolvedType: "movie" | "tv" =
      data?.seasons || data?.number_of_seasons || typeHint === "tv"
        ? "tv"
        : "movie";
    const imdbId = sanitizeImdbId(data?.external_ids?.imdb_id || data?.imdb_id);

    return {
      tmdbId: safeId,
      imdbId,
      mediaType: resolvedType,
      details: data,
      directUrl: buildRabbitTvDirectUrl({
        mediaType: resolvedType,
        tmdbId: safeId,
        imdbId,
        idMode: "tmdb",
        season,
        episode,
        autoPlayNext: options.autoPlayNext,
      }),
      imdbDirectUrl: imdbId
        ? buildRabbitTvDirectUrl({
            mediaType: resolvedType,
            tmdbId: safeId,
            imdbId,
            idMode: "imdb",
            season,
            episode,
            autoPlayNext: options.autoPlayNext,
          })
        : null,
      fromCache,
    };
  };

  // 1. Fast cache hit (memory first, then localStorage) for instant render
  const cacheKey = `rabtv_cache_${activeType}_${safeId}`;
  const cachedData = readMemoryCache(cacheKey) || safeReadLocalCache(cacheKey);
  if (cachedData) {
    writeMemoryCache(cacheKey, cachedData);
    options.onCacheHit?.(makeResolved(cachedData, activeType, true));
  }

  // 2. Live TMDB scrub for fresh metadata, cast, cover art, and external IMDb ID
  const buildTmdbUrl = (type: "movie" | "tv") =>
    `${TMDB_BASE_URL}/${type}/${safeId}?api_key=${encodeURIComponent(
      apiKey
    )}&append_to_response=credits,external_ids`;

  let data = await fetchJsonSafely(
    buildTmdbUrl(activeType),
    options.signal,
    DEFAULT_TMDB_TIMEOUT_MS
  );

  // Automatic movie <-> tv fallback if the route type didn't match TMDB
  if (!data || data.success === false || data.status_code) {
    if (options.signal?.aborted) return null;
    const altType: "movie" | "tv" = activeType === "movie" ? "tv" : "movie";
    const retryData = await fetchJsonSafely(
      buildTmdbUrl(altType),
      options.signal,
      DEFAULT_TMDB_TIMEOUT_MS
    );
    if (retryData && retryData.success !== false && !retryData.status_code) {
      data = retryData;
      activeType = altType;
    }
  }

  if (options.signal?.aborted) return null;

  if (data && data.success !== false && !data.status_code) {
    const finalKey = `rabtv_cache_${activeType}_${safeId}`;
    writeMemoryCache(finalKey, data);
    safeWriteLocalCache(finalKey, data);
    return makeResolved(data, activeType, false);
  }

  // Fall back to cache if offline
  if (cachedData) {
    return makeResolved(cachedData, activeType, true);
  }

  return null;
}

/**
 * Lightweight pre-flight quality & availability check against vidsrc.sh's
 * `/info/...json` endpoint. Degrades cleanly to "unverified" on CORS/network
 * block so playback is NEVER delayed or prevented.
 */
export async function probeVidsrcDirectInfo(options: {
  mediaType: "movie" | "tv";
  tmdbId: string;
  imdbId?: string | null;
  idMode?: DirectIdMode;
  season?: number;
  episode?: number;
  signal?: AbortSignal;
}): Promise<DirectStreamProbeResult> {
  const safeTmdb = sanitizeTmdbId(options.tmdbId);
  const safeImdb = sanitizeImdbId(options.imdbId);
  const mode: DirectIdMode =
    options.idMode === "imdb" && safeImdb ? "imdb" : "tmdb";
  const targetId = mode === "imdb" ? (safeImdb as string) : safeTmdb;

  if (!targetId) {
    return { status: "unverified", quality: null, checkedIdMode: mode };
  }

  const infoUrl =
    options.mediaType === "tv"
      ? `${VIDSRC_DIRECT_INFO_BASE}/tv/${targetId}/${sanitizePositiveInt(
          options.season,
          1
        )}/${sanitizePositiveInt(options.episode, 1)}.json`
      : `${VIDSRC_DIRECT_INFO_BASE}/movie/${targetId}.json`;

  const controller = new AbortController();
  const onParentAbort = () => controller.abort();
  options.signal?.addEventListener("abort", onParentAbort, { once: true });
  const timer =
    typeof window !== "undefined"
      ? window.setTimeout(() => controller.abort(), INFO_PROBE_TIMEOUT_MS)
      : setTimeout(() => controller.abort(), INFO_PROBE_TIMEOUT_MS);

  try {
    const res = await fetch(infoUrl, {
      method: "GET",
      mode: "cors",
      cache: "no-store",
      signal: controller.signal,
    });

    if (res.status === 404) {
      return { status: "unavailable", quality: null, checkedIdMode: mode };
    }
    if (!res.ok) {
      return { status: "unverified", quality: null, checkedIdMode: mode };
    }

    const json = await res.json().catch(() => null);
    if (!json || typeof json !== "object") {
      return { status: "unverified", quality: null, checkedIdMode: mode };
    }

    const rawQuality =
      (typeof json.quality === "string" && json.quality) ||
      (typeof json.result?.quality === "string" && json.result.quality) ||
      (Array.isArray(json.result) &&
        typeof json.result[0]?.quality === "string" &&
        json.result[0].quality) ||
      null;

    const cleanQuality = rawQuality
      ? rawQuality.replace(/[^a-z0-9+.\- ]/gi, "").trim().slice(0, 14)
      : null;

    return {
      status: "verified",
      quality: cleanQuality || "HD",
      checkedIdMode: mode,
    };
  } catch {
    // Expected if WebView CORS policy blocks cross-origin JSON read
    return { status: "unverified", quality: null, checkedIdMode: mode };
  } finally {
    options.signal?.removeEventListener("abort", onParentAbort);
    if (typeof window !== "undefined") {
      window.clearTimeout(timer as number);
    } else {
      clearTimeout(timer);
    }
  }
}

/**
 * Strictly validates and normalizes postMessage events emitted by vidsrc.sh
 * (`PLAYER_EVENT`) or fallback embed players so we can safely sync Watch History
 * progress and trigger Auto-Play Next Episode without trusting arbitrary origins.
 */
export function parseVidsrcPlayerEvent(
  event: MessageEvent
): NormalizedPlayerEvent | null {
  if (!event || typeof event.origin !== "string") return null;
  if (!TRUSTED_EMBED_ORIGINS.has(event.origin)) return null;

  let payload: any = event.data;
  if (typeof payload === "string") {
    if (payload.length > 16384) return null; // Reject oversized payloads
    try {
      payload = JSON.parse(payload);
    } catch {
      return null;
    }
  }

  if (!payload || typeof payload !== "object") return null;

  // Format A: vidsrc.sh official PLAYER_EVENT
  if (payload.type === "PLAYER_EVENT" && payload.data && typeof payload.data === "object") {
    const d = payload.data;
    const rawStatus = String(d.player_status || d.event || "").toLowerCase();
    const status: NormalizedPlayerEvent["status"] =
      rawStatus === "playing" || rawStatus === "play"
        ? "playing"
        : rawStatus === "paused" || rawStatus === "pause"
          ? "paused"
          : rawStatus === "ended" || rawStatus === "complete" || rawStatus === "completed"
            ? "ended"
            : rawStatus === "buffering" || rawStatus === "waiting"
              ? "buffering"
              : rawStatus === "timeupdate"
                ? "timeupdate"
                : "unknown";

    const currentTime =
      typeof d.currentTime === "number" && Number.isFinite(d.currentTime) && d.currentTime >= 0
        ? d.currentTime
        : typeof d.current_time === "number" && Number.isFinite(d.current_time) && d.current_time >= 0
          ? d.current_time
          : null;

    const duration =
      typeof d.duration === "number" && Number.isFinite(d.duration) && d.duration > 0
        ? d.duration
        : null;

    const progressPercent =
      currentTime !== null && duration !== null
        ? Math.min(100, Math.max(0, Math.round((currentTime / duration) * 100)))
        : status === "ended"
          ? 100
          : null;

    const info = d.player_info && typeof d.player_info === "object" ? d.player_info : d;
    const season =
      typeof info.season === "number" && Number.isFinite(info.season) && info.season > 0
        ? Math.floor(info.season)
        : null;
    const episode =
      typeof info.episode === "number" && Number.isFinite(info.episode) && info.episode > 0
        ? Math.floor(info.episode)
        : null;

    return {
      origin: event.origin,
      status,
      currentTime,
      duration,
      progressPercent,
      season,
      episode,
    };
  }

  // Format B: VidLink MEDIA_DATA fallback
  if (payload.type === "MEDIA_DATA" && payload.data && typeof payload.data === "object") {
    const d = payload.data;
    const prog = d.progress && typeof d.progress === "object" ? d.progress : null;
    const currentTime =
      typeof prog?.watched === "number" && Number.isFinite(prog.watched)
        ? prog.watched
        : null;
    const duration =
      typeof prog?.duration === "number" && Number.isFinite(prog.duration) && prog.duration > 0
        ? prog.duration
        : null;
    const progressPercent =
      currentTime !== null && duration !== null
        ? Math.min(100, Math.max(0, Math.round((currentTime / duration) * 100)))
        : null;

    return {
      origin: event.origin,
      status: progressPercent !== null && progressPercent >= 98 ? "ended" : "timeupdate",
      currentTime,
      duration,
      progressPercent,
      season: null,
      episode: null,
    };
  }

  return null;
}
