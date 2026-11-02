/**
 * ============================================================
 * LIVE FEED HEALTH LAYER
 * ============================================================
 * Paste / merge into src/lib/live-feed-service.ts AFTER your
 * existing `liveFeedServices` array and type definitions.
 *
 * What it does:
 *  1. Probes each stream URL with a short timeout
 *  2. Caches results (memory + localStorage) so re-opening
 *     Live TV is fast
 *  3. Can hide offline channels from the catalog
 *  4. Exposes online/offline counts for the UI
 *  5. Shows green / red status while the user browses
 *
 * CORS note:
 *  Many CDNs block browser CORS. When the request is blocked
 *  we treat it as "unknown" (amber), not offline, so we don't
 *  falsely wipe half the catalog. True 404/timeouts = offline.
 * ============================================================
 */

export type ChannelHealth = "online" | "offline" | "checking" | "unknown";

export interface LiveFeedService {
  channelId: string;
  name: string;
  groupTitle: string;
  logo?: string;
  channelNumber?: number;
  url: string;
  userAgent?: string;
  referrer?: string;
  manifestType?: string;
  licenseType?: string;
  licenseKey?: string;
}

/** What the rest of the app imports */
export type LiveChannel = LiveFeedService & {
  streamUrl: string;
  title: string;
  health?: ChannelHealth;
  healthCheckedAt?: number;
};

// ——— Tunables ———
const PROBE_TIMEOUT_MS = 4500;
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const CONCURRENCY = 6; // parallel probes
const HEALTH_CACHE_KEY = "rabtv_live_health_v1";
const HIDE_OFFLINE_BY_DEFAULT = true; // set false to keep offline rows with a red badge

// ——— In-memory + localStorage cache ———
type HealthCacheEntry = { health: ChannelHealth; checkedAt: number };
type HealthCache = Record<string, HealthCacheEntry>;

function loadHealthCache(): HealthCache {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(HEALTH_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as HealthCache;
    const now = Date.now();
    const fresh: HealthCache = {};
    for (const [id, entry] of Object.entries(parsed)) {
      if (entry && now - entry.checkedAt < CACHE_TTL_MS) {
        fresh[id] = entry;
      }
    }
    return fresh;
  } catch {
    return {};
  }
}

function saveHealthCache(cache: HealthCache) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(HEALTH_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // quota / private mode — ignore
  }
}

let healthCache: HealthCache = loadHealthCache();

/**
 * Probe a single stream URL.
 * - online  → got a usable response (2xx) or playlist-looking body
 * - offline → timeout, 4xx/5xx, network failure that is definitive
 * - unknown → CORS / opaque response (can't confirm, don't hide)
 */
export async function probeStream(url: string): Promise<ChannelHealth> {
  if (!url || typeof url !== "string") return "offline";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

  try {
    // Prefer GET — many CDNs reject HEAD. We only need headers / first bytes.
    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      mode: "cors",
      cache: "no-store",
      // Don't send credentials cross-origin
      credentials: "omit",
    });

    clearTimeout(timer);

    if (res.ok) {
      // Optional: peek at content-type / body start for m3u8 / mpd
      const ct = (res.headers.get("content-type") || "").toLowerCase();
      if (
        ct.includes("mpegurl") ||
        ct.includes("application/dash") ||
        ct.includes("application/vnd.apple") ||
        ct.includes("video/") ||
        ct.includes("application/octet-stream") ||
        ct.includes("text/plain") ||
        ct === ""
      ) {
        return "online";
      }
      // Still 2xx — treat as online
      return "online";
    }

    // 4xx/5xx → offline
    if (res.status >= 400) return "offline";
    return "unknown";
  } catch (err: any) {
    clearTimeout(timer);

    // Abort = timeout → offline
    if (err?.name === "AbortError") return "offline";

    // TypeError often means CORS blocked in browsers.
    // Don't mark offline or we wipe the catalog incorrectly.
    if (err?.name === "TypeError") return "unknown";

    return "offline";
  }
}

/** Run probes with a concurrency limit */
async function mapPool<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function run() {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i], i);
    }
  }

  const runners = Array.from({ length: Math.min(limit, items.length) }, () =>
    run()
  );
  await Promise.all(runners);
  return results;
}

/**
 * Enrich channels with health status.
 * Uses cache when fresh; only probes stale / missing entries.
 */
export async function enrichChannelsWithHealth(
  channels: LiveChannel[],
  options?: { force?: boolean }
): Promise<LiveChannel[]> {
  const now = Date.now();
  const force = options?.force === true;

  const needsProbe = channels.filter((ch) => {
    if (force) return true;
    const cached = healthCache[ch.channelId];
    return !cached || now - cached.checkedAt >= CACHE_TTL_MS;
  });

  if (needsProbe.length > 0) {
    await mapPool(needsProbe, CONCURRENCY, async (ch) => {
      const health = await probeStream(ch.url || ch.streamUrl);
      healthCache[ch.channelId] = { health, checkedAt: Date.now() };
      return health;
    });
    saveHealthCache(healthCache);
  }

  return channels.map((ch) => {
    const entry = healthCache[ch.channelId];
    return {
      ...ch,
      health: entry?.health ?? "unknown",
      healthCheckedAt: entry?.checkedAt,
    };
  });
}

/** Drop offline channels (keeps online + unknown) */
export function filterHealthyChannels(
  channels: LiveChannel[],
  hideOffline = HIDE_OFFLINE_BY_DEFAULT
): LiveChannel[] {
  if (!hideOffline) return channels;
  return channels.filter((ch) => ch.health !== "offline");
}

export interface CatalogHealthStats {
  total: number;
  online: number;
  offline: number;
  unknown: number;
  checking: number;
}

export function getCatalogHealthStats(
  channels: LiveChannel[]
): CatalogHealthStats {
  const stats: CatalogHealthStats = {
    total: channels.length,
    online: 0,
    offline: 0,
    unknown: 0,
    checking: 0,
  };
  for (const ch of channels) {
    switch (ch.health) {
      case "online":
        stats.online++;
        break;
      case "offline":
        stats.offline++;
        break;
      case "checking":
        stats.checking++;
        break;
      default:
        stats.unknown++;
    }
  }
  return stats;
}

// ——— Catalog API (replaces / extends your existing exports) ———
// Assumes `liveFeedServices: LiveFeedService[]` is already defined above.

export async function fetchLiveCategories(): Promise<string[]> {
  const categories = new Set<string>();
  for (const service of liveFeedServices) {
    if (service.groupTitle) categories.add(service.groupTitle);
  }
  return Array.from(categories).sort((a, b) => a.localeCompare(b));
}

function toLiveChannel(s: LiveFeedService): LiveChannel {
  return {
    ...s,
    streamUrl: s.url,
    title: s.name,
    health: "checking",
  };
}

/**
 * Fetch channels for a category, probe health, optionally hide offline.
 * Pass `{ probe: false }` for instant list without network checks.
 */
export async function fetchChannelsByCategory(
  category: string,
  options?: { probe?: boolean; hideOffline?: boolean; forceProbe?: boolean }
): Promise<LiveChannel[]> {
  const probe = options?.probe !== false; // default on
  const hideOffline = options?.hideOffline ?? HIDE_OFFLINE_BY_DEFAULT;

  const filtered = liveFeedServices.filter(
    (service) =>
      service.groupTitle.toLowerCase() === category.toLowerCase()
  );

  let channels = filtered.map(toLiveChannel);

  if (probe) {
    channels = await enrichChannelsWithHealth(channels, {
      force: options?.forceProbe,
    });
    channels = filterHealthyChannels(channels, hideOffline);
  }

  // Stable sort: channel number then name
  channels.sort((a, b) => {
    const na = a.channelNumber ?? 9999;
    const nb = b.channelNumber ?? 9999;
    if (na !== nb) return na - nb;
    return a.name.localeCompare(b.name);
  });

  return channels;
}

/** All channels across groups, with health */
export async function fetchAllChannels(options?: {
  probe?: boolean;
  hideOffline?: boolean;
  forceProbe?: boolean;
}): Promise<LiveChannel[]> {
  const probe = options?.probe !== false;
  const hideOffline = options?.hideOffline ?? HIDE_OFFLINE_BY_DEFAULT;

  let channels = liveFeedServices.map(toLiveChannel);
  if (probe) {
    channels = await enrichChannelsWithHealth(channels, {
      force: options?.forceProbe,
    });
    channels = filterHealthyChannels(channels, hideOffline);
  }
  return channels;
}

/** Force a full re-probe (e.g. pull-to-refresh on Live TV page) */
export async function refreshLiveHealth(): Promise<LiveChannel[]> {
  return fetchAllChannels({ probe: true, forceProbe: true, hideOffline: false });
}

export function clearLiveHealthCache() {
  healthCache = {};
  if (typeof window !== "undefined") {
    localStorage.removeItem(HEALTH_CACHE_KEY);
  }
}
