// src/routes/live-tv.tsx
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchLiveCategories,
  fetchChannelsByCategory,
  fetchAllChannels,
  refreshLiveHealth,
  type LiveChannel,
} from '../lib/live-feed-service';
import {
  AppTheme,
  PosterShape,
  getSavedTheme,
  getHardwareLimits,
  getLargeButtons,
  getReducedMotion,
  getGlowIntensity,
  getPosterShape,
  getClockFormat,
  formatAppTime,
  getFavoriteChannelIds,
  toggleFavoriteChannel,
  MAX_FAVORITE_CHANNELS,
  getKidsModeLocked,
  getSavedUserAge,
} from '@/lib/settings';
import { ScrollPillBar } from '@/components/scroll-pill-bar';
import { getChannelDescription } from '@/lib/channel-descriptions';
import { channelCategories } from '@/lib/channel-categories';
import { AppWallpaper } from '@/components/AppWallpaper';
import { recordWatchHistory } from '@/lib/watch-history';

export const Route = createFileRoute('/live-tv')({
  component: LiveTvComponent,
});

export type ExtendedHealthStatus = 'online' | 'timeout' | 'offline' | 'checking';
export type HealthFilterOption = 'all' | 'online' | 'timeout' | 'offline';
export type LiveSortOption = 'status' | 'channelNumber' | 'az';
export type LiveDensityOption = 'comfort' | 'compact';

const FAST_HEALTH_CACHE_KEY = 'rabtv_fast_live_health_v2';
const FAST_HEALTH_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const PROBE_TIMEOUT_MS = 2600;

const categoryMapping: Record<string, string> = {
  Nz: 'Atlantic Canada',
  Sydney: 'Toronto',
  Melbourne: 'Vancouver',
  Brisbane: 'Montreal',
  Perth: 'Calgary',
  Adelaide: 'Ottawa',
  Canberra: 'National',
  Darwin: 'Northern',
  Hobart: 'Pacific',
  Au: 'Canada Feeds',
  World: 'International',
};

const reverseCategoryMapping: Record<string, string> = Object.fromEntries(
  Object.entries(categoryMapping).map(([orig, disp]) => [disp, orig])
);

// Keywords filtered out from Live TV when Kids Safe Mode Lock is actively engaged
const MATURE_LIVE_KEYWORDS = [
  'adult',
  'crime',
  'deadly',
  'murder',
  'cops',
  '48 hours',
  'csi',
  'thriller',
  'paranormal',
  'haunt',
  'ghost',
  'botched',
  'prisoner',
  'hell',
  'ridiculousness',
  'embarrassing bodies',
  'surveillance',
  'emergency',
  'a&e',
  'warfare',
];

function isChannelKidsSafe(title: string): boolean {
  const lower = (title || '').toLowerCase();
  return !MATURE_LIVE_KEYWORDS.some((kw) => lower.includes(kw));
}

interface CachedHealthMap {
  timestamp: number;
  statuses: Record<string, ExtendedHealthStatus>;
}

function loadCachedHealthMap(): Record<string, ExtendedHealthStatus> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(FAST_HEALTH_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as CachedHealthMap;
    if (!parsed || Date.now() - parsed.timestamp > FAST_HEALTH_CACHE_TTL_MS) {
      return {};
    }
    return parsed.statuses || {};
  } catch {
    return {};
  }
}

function saveCachedHealthMap(statuses: Record<string, ExtendedHealthStatus>): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: CachedHealthMap = {
      timestamp: Date.now(),
      statuses,
    };
    localStorage.setItem(FAST_HEALTH_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage quota errors on low-storage sticks
  }
}

function getChannelKey(channel: LiveChannel): string {
  return String(
    channel.channelId || channel.streamUrl || channel.url || channel.title
  );
}

function normalizeMatchText(text: string): string {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Fast, lightweight stream probe with a strict 2.6s timeout.
 * Distinguishes:
 *  - 'online': HTTP 200..299 with valid response
 *  - 'timeout': AbortError (slow stream) or CORS opaque fallback (may still play)
 *  - 'offline': Hard HTTP 4xx/5xx error or dead host
 */
async function probeSingleChannelFast(url: string): Promise<ExtendedHealthStatus> {
  if (!url || !url.startsWith('http')) return 'offline';

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        Range: 'bytes=0-512',
      },
    });
    window.clearTimeout(timer);

    if (response.ok || response.status === 206) {
      return 'online';
    }
    if (response.status === 401 || response.status === 403) {
      return 'timeout';
    }
    return 'offline';
  } catch (err: any) {
    window.clearTimeout(timer);

    if (err?.name === 'AbortError') {
      return 'timeout';
    }

    const fallbackController = new AbortController();
    const fallbackTimer = window.setTimeout(
      () => fallbackController.abort(),
      1800
    );
    try {
      const opaqueRes = await fetch(url, {
        method: 'HEAD',
        mode: 'no-cors',
        signal: fallbackController.signal,
      });
      window.clearTimeout(fallbackTimer);
      if (opaqueRes.type === 'opaque') {
        return 'timeout';
      }
      return opaqueRes.ok ? 'online' : 'offline';
    } catch {
      window.clearTimeout(fallbackTimer);
      return 'offline';
    }
  }
}

function StatusBadge({ status }: { status: ExtendedHealthStatus }) {
  if (status === 'online') {
    return (
      <span
        title="Verified Online"
        className="inline-flex items-center gap-1 rounded-full bg-emerald-950/90 border border-emerald-400/50 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.45)]"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
        <span>Live</span>
      </span>
    );
  }

  if (status === 'timeout') {
    return (
      <span
        title="Questionable / Timeout — May still play inside the video player"
        className="inline-flex items-center gap-1 rounded-full bg-amber-950/90 border border-amber-400/50 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-amber-300"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
        <span>Slow ?</span>
      </span>
    );
  }

  if (status === 'offline') {
    return (
      <span
        title="Stream Offline"
        className="inline-flex items-center gap-1 rounded-full bg-red-950/90 border border-red-500/50 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-red-300"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
        <span>Offline</span>
      </span>
    );
  }

  return (
    <span
      title="Checking stream health..."
      className="inline-flex items-center gap-1 rounded-full bg-slate-900/90 border border-white/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-300"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-sky-400 animate-ping" />
      <span>Scan</span>
    </span>
  );
}

const ChannelCard = React.memo(function ChannelCard({
  channel,
  status,
  isPinned,
  onTogglePin,
  laserLineClass,
  playBtnClass,
  borderHoverClass,
  radiusClass,
  largeButtons,
  compact,
  glowOff,
}: {
  channel: LiveChannel;
  status: ExtendedHealthStatus;
  isPinned: boolean;
  onTogglePin: (channelId: string, channelTitle: string) => void;
  laserLineClass: string;
  playBtnClass: string;
  borderHoverClass: string;
  radiusClass: string;
  largeButtons: boolean;
  compact: boolean;
  glowOff: boolean;
}) {
  const streamTarget = channel.streamUrl || channel.url;
  const channelId = getChannelKey(channel);
  const rawGroup = channel.groupTitle || (channel as any).category || '';
  const displayRegion = rawGroup
    ? categoryMapping[rawGroup] || rawGroup
    : 'TV';
  const description = useMemo(
    () => getChannelDescription(channel.title),
    [channel.title]
  );

  return (
    <div
      className={`group relative flex flex-col justify-between ${radiusClass} bg-slate-950/88 backdrop-blur-xl border ${
        isPinned
          ? 'border-amber-400/50 shadow-[0_12px_32px_rgba(245,158,11,0.18)]'
          : `border-white/15 ${borderHoverClass} shadow-[0_12px_32px_rgba(0,0,0,0.75)]`
      } ${
        compact ? 'p-2.5 sm:p-3' : 'p-3.5 sm:p-4'
      } hover:-translate-y-1 transition-all duration-300 text-center overflow-hidden`}
    >
      {/* Top Bar: Region + Channel Number + Health + Pin Button (kept outside Link for valid HTML & TV D-Pad) */}
      <div className="flex items-center justify-between gap-1 mb-2 z-20">
        <div className="flex items-center gap-1 min-w-0">
          {channel.channelNumber !== undefined && (
            <span className="rounded-md bg-white/10 border border-white/15 px-1.5 py-0.5 text-[9px] font-black text-cyan-300 shrink-0">
              CH {channel.channelNumber}
            </span>
          )}
          <span className="rounded-full bg-white/[0.06] border border-white/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-300 truncate">
            {displayRegion}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <StatusBadge status={status} />
          <button
            type="button"
            onClick={() => onTogglePin(channelId, channel.title)}
            aria-label={
              isPinned
                ? `Unpin ${channel.title} from Favorites`
                : `Pin ${channel.title} to Favorites`
            }
            title={isPinned ? 'Unpin from Favorites' : 'Pin to Top Favorites'}
            className={`flex ${
              largeButtons ? 'h-8 w-8 text-sm' : 'h-6 w-6 text-xs'
            } items-center justify-center rounded-full border transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-400 ${
              isPinned
                ? 'bg-amber-500/25 border-amber-400/70 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.5)]'
                : 'bg-black/65 border-white/15 text-slate-400 hover:text-amber-300 hover:border-amber-400/50'
            }`}
          >
            {isPinned ? '★' : '☆'}
          </button>
        </div>
      </div>

      {/* Main Clickable Watch Card Link */}
      <Link
        to="/live-player"
        search={{
          url: streamTarget,
          title: channel.title,
          logo: channel.logo || '',
          channelId,
        }}
        onClick={() => {
          recordWatchHistory({
            id: channelId,
            title: channel.title,
            posterPath: channel.logo || '',
            type: 'livetv',
          });
        }}
        className="flex flex-col flex-1 justify-between focus:outline-none focus:ring-4 focus:ring-purple-500/60 rounded-2xl"
      >
        {/* Upfront High-Contrast Logo Showcase Stage */}
        <div
          className={`relative w-full ${
            compact ? 'h-20 sm:h-24 p-2.5 mb-2' : 'h-28 sm:h-34 p-3.5 mb-3'
          } rounded-2xl bg-gradient-to-b from-slate-900/90 via-black to-slate-950 border border-white/10 group-hover:border-white/25 overflow-hidden flex items-center justify-center shadow-inner`}
        >
          <div
            className="absolute inset-0 pointer-events-none opacity-75 group-hover:opacity-100 transition-opacity duration-300"
            style={{
              background:
                'radial-gradient(circle at center, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.04) 45%, transparent 75%)',
            }}
          />

          {channel.logo ? (
            <img
              src={channel.logo}
              alt={channel.title}
              loading="lazy"
              decoding="async"
              className="relative z-10 max-h-full max-w-full w-auto h-auto object-contain drop-shadow-[0_4px_14px_rgba(0,0,0,0.85)] transform group-hover:scale-110 transition-transform duration-300"
            />
          ) : (
            <div className="relative z-10 flex flex-col items-center justify-center gap-1">
              <span className="text-xl">📺</span>
              <span className="text-[10px] font-black tracking-widest uppercase text-slate-300">
                {channel.title.slice(0, 12)}
              </span>
            </div>
          )}
        </div>

        {/* Channel Info & Watch Action */}
        <div className="flex flex-col flex-1 justify-between space-y-2 z-10">
          <div>
            <h4
              className={`${
                compact ? 'text-xs sm:text-sm' : 'text-sm sm:text-base'
              } font-black text-white tracking-tight line-clamp-1`}
            >
              {channel.title}
            </h4>
            {!compact && (
              <p className="text-[11px] text-slate-400 font-medium line-clamp-2 mt-1 leading-snug min-h-[2.25rem]">
                {description}
              </p>
            )}
          </div>

          <div
            className={`w-full ${
              largeButtons
                ? 'py-2.5 text-xs'
                : compact
                  ? 'py-1.5 text-[10px]'
                  : 'py-2 text-[11px]'
            } px-3 rounded-xl font-extrabold uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-1.5 ${playBtnClass}`}
          >
            <span>▶</span>
            <span>Watch Live</span>
          </div>
        </div>
      </Link>

      {/* Neon Bottom Laser Highlight */}
      {!glowOff && (
        <div
          className={`absolute inset-x-4 bottom-0 h-[2px] bg-gradient-to-r ${laserLineClass} opacity-75 group-hover:opacity-100 pointer-events-none`}
        />
      )}
    </div>
  );
});

function LiveTvComponent() {
  const navigate = useNavigate();

  const [categories, setCategories] = useState<string[]>(['All']);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const genreOptions = useMemo(
    () => ['All Genres', ...Object.keys(channelCategories)],
    []
  );
  const [selectedGenre, setSelectedGenre] = useState<string>('All Genres');
  const [statusFilter, setStatusFilter] = useState<HealthFilterOption>('all');
  const [sortBy, setSortBy] = useState<LiveSortOption>('status');
  const [density, setDensity] = useState<LiveDensityOption>('comfort');
  const [pinnedOnly, setPinnedOnly] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [rawChannels, setRawChannels] = useState<LiveChannel[]>([]);
  const [healthMap, setHealthMap] = useState<Record<string, ExtendedHealthStatus>>(
    () => loadCachedHealthMap()
  );
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() =>
    getFavoriteChannelIds()
  );
  const [pinToast, setPinToast] = useState<string | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [probing, setProbing] = useState<boolean>(false);
  const [probeProgress, setProbeProgress] = useState<{ done: number; total: number }>({
    done: 0,
    total: 0,
  });

  const [currentPage, setCurrentPage] = useState<number>(1);

  // Live settings wired from settings.ts
  const [appTheme, setAppTheme] = useState<AppTheme>(() => getSavedTheme());
  const [posterShape, setPosterShapeState] = useState<PosterShape>(() =>
    getPosterShape()
  );
  const [largeButtons, setLargeButtons] = useState<boolean>(() =>
    getLargeButtons()
  );
  const [reducedMotion, setReducedMotion] = useState<boolean>(() =>
    getReducedMotion()
  );
  const [glowOff, setGlowOff] = useState<boolean>(
    () => getGlowIntensity() === 'off'
  );
  const [isLowRam, setIsLowRam] = useState<boolean>(
    () => getHardwareLimits().effectiveMode === 'low'
  );
  const [channelsPerPage, setChannelsPerPage] = useState<number>(
    () => getHardwareLimits().liveChannelsPerPage
  );
  const [kidsSafeActive, setKidsSafeActive] = useState<boolean>(
    () => getKidsModeLocked() || getSavedUserAge() < 13
  );
  const [guideClock, setGuideClock] = useState<string>(() =>
    formatAppTime(new Date(), getClockFormat())
  );

  const probeRunIdRef = useRef<number>(0);

  // Sync live settings whenever Sidebar changes anything
  useEffect(() => {
    const syncSettings = () => {
      const limits = getHardwareLimits();
      setAppTheme(getSavedTheme());
      setPosterShapeState(getPosterShape());
      setLargeButtons(getLargeButtons());
      setReducedMotion(getReducedMotion());
      setGlowOff(getGlowIntensity() === 'off');
      setIsLowRam(limits.effectiveMode === 'low');
      setChannelsPerPage(limits.liveChannelsPerPage);
      setFavoriteIds(getFavoriteChannelIds());
      setKidsSafeActive(getKidsModeLocked() || getSavedUserAge() < 13);
      setGuideClock(formatAppTime(new Date(), getClockFormat()));
    };

    syncSettings();
    window.addEventListener('rabtv_settings_updated', syncSettings);
    window.addEventListener('rabtv_ram_mode_updated', syncSettings);
    return () => {
      window.removeEventListener('rabtv_settings_updated', syncSettings);
      window.removeEventListener('rabtv_ram_mode_updated', syncSettings);
    };
  }, []);

  // Keep live guide clock updated
  useEffect(() => {
    const interval = window.setInterval(() => {
      setGuideClock(formatAppTime(new Date(), getClockFormat()));
    }, 15000);
    return () => window.clearInterval(interval);
  }, []);

  // Deduplicate categories so "All" never appears twice
  useEffect(() => {
    let active = true;
    fetchLiveCategories()
      .then((cats) => {
        if (!active) return;
        const mapped = cats
          .map((cat) => (categoryMapping[cat] || cat).trim())
          .filter((cat) => cat.length > 0 && cat.toLowerCase() !== 'all');
        const uniqueCats = Array.from(new Set(['All', ...mapped]));
        setCategories(uniqueCats);
      })
      .catch((err) => {
        console.error('Failed to fetch live categories:', err);
      });
    return () => {
      active = false;
    };
  }, []);

  /**
   * High-speed concurrent background health prober.
   * Adapts concurrency (6 on 1-2GB sticks, 12 on 4GB+ devices) so low-RAM TVs stay snappy.
   */
  const runFastBackgroundProbe = useCallback(
    async (channelsToProbe: LiveChannel[], forceRefresh = false) => {
      const runId = ++probeRunIdRef.current;
      const existingCache = forceRefresh ? {} : loadCachedHealthMap();

      const pending: LiveChannel[] = [];
      for (const ch of channelsToProbe) {
        const key = getChannelKey(ch);
        if (
          !forceRefresh &&
          existingCache[key] &&
          existingCache[key] !== 'checking'
        ) {
          continue;
        }
        pending.push(ch);
      }

      if (pending.length === 0) {
        setProbing(false);
        return;
      }

      setProbing(true);
      setProbeProgress({ done: 0, total: pending.length });

      const workingMap: Record<string, ExtendedHealthStatus> = {
        ...existingCache,
      };

      for (const ch of pending) {
        const key = getChannelKey(ch);
        if (!workingMap[key]) {
          workingMap[key] = 'checking';
        }
      }
      setHealthMap({ ...workingMap });

      let completed = 0;
      let cursor = 0;
      let lastFlushTime = Date.now();
      const concurrency = getHardwareLimits().effectiveMode === 'low' ? 6 : 12;

      const worker = async () => {
        while (cursor < pending.length) {
          if (probeRunIdRef.current !== runId) return;
          const currentIndex = cursor++;
          const channel = pending[currentIndex];
          if (!channel) continue;

          const key = getChannelKey(channel);
          const targetUrl = channel.streamUrl || channel.url;
          const result = await probeSingleChannelFast(targetUrl);

          if (probeRunIdRef.current !== runId) return;

          workingMap[key] = result;
          completed++;

          const now = Date.now();
          if (now - lastFlushTime >= 350 || completed === pending.length) {
            lastFlushTime = now;
            setHealthMap({ ...workingMap });
            setProbeProgress({ done: completed, total: pending.length });
          }
        }
      };

      const workerCount = Math.min(concurrency, pending.length);
      await Promise.all(Array.from({ length: workerCount }, () => worker()));

      if (probeRunIdRef.current === runId) {
        setHealthMap({ ...workingMap });
        saveCachedHealthMap(workingMap);
        setProbing(false);
      }
    },
    []
  );

  const loadChannelsInstantly = useCallback(
    async (opts?: { forceProbe?: boolean }) => {
      setLoading(true);
      try {
        let fetched: LiveChannel[] = [];

        if (selectedCategory === 'All') {
          fetched = await fetchAllChannels({
            probe: false,
            hideOffline: false,
          });
        } else {
          const originalCategory =
            reverseCategoryMapping[selectedCategory] || selectedCategory;
          fetched = await fetchChannelsByCategory(originalCategory, {
            probe: false,
            hideOffline: false,
          });
        }

        const seen = new Set<string>();
        const uniqueChannels: LiveChannel[] = [];
        for (const ch of fetched) {
          const key = getChannelKey(ch);
          if (!seen.has(key)) {
            seen.add(key);
            uniqueChannels.push(ch);
          }
        }

        setRawChannels(uniqueChannels);
        setLoading(false);

        void runFastBackgroundProbe(uniqueChannels, opts?.forceProbe);
      } catch (err) {
        console.error('Failed to load live channels:', err);
        setLoading(false);
      }
    },
    [selectedCategory, runFastBackgroundProbe]
  );

  useEffect(() => {
    void loadChannelsInstantly();
    return () => {
      probeRunIdRef.current++;
    };
  }, [loadChannelsInstantly]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory, selectedGenre, statusFilter, searchQuery, pinnedOnly, sortBy]);

  const handleRefreshHealth = async () => {
    try {
      localStorage.removeItem(FAST_HEALTH_CACHE_KEY);
    } catch {
      // ignore
    }
    void refreshLiveHealth().catch(() => {});
    await loadChannelsInstantly({ forceProbe: true });
  };

  const handleTogglePin = useCallback((channelId: string, channelTitle: string) => {
    const res = toggleFavoriteChannel(channelId);
    setFavoriteIds(res.favorites);
    if (res.limitReached) {
      setPinToast(
        `Max ${MAX_FAVORITE_CHANNELS} pinned channels reached — unpin one first.`
      );
    } else {
      setPinToast(
        res.added
          ? `⭐ Pinned "${channelTitle}" to your top Favorites!`
          : `Removed "${channelTitle}" from Favorites.`
      );
    }
    window.setTimeout(() => setPinToast(null), 2800);
  }, []);

  const favoriteIdSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);

  const resolveChannelStatus = useCallback(
    (channel: LiveChannel): ExtendedHealthStatus => {
      const key = getChannelKey(channel);
      const cached = healthMap[key];
      if (cached) return cached;
      if (channel.health === 'online') return 'online';
      if (channel.health === 'offline') return 'offline';
      if (channel.health === 'checking') return 'checking';
      return probing ? 'checking' : 'timeout';
    },
    [healthMap, probing]
  );

  // Apply Kids Lock first so mature crime/adult streams are hidden when Kids Mode is active
  const ageSafeChannels = useMemo(() => {
    if (!kidsSafeActive) return rawChannels;
    return rawChannels.filter((ch) => isChannelKidsSafe(ch.title));
  }, [rawChannels, kidsSafeActive]);

  // Pinned Favorites shelf matching current loaded channels
  const pinnedChannels = useMemo(() => {
    if (favoriteIds.length === 0) return [];
    const lookup = new Map<string, LiveChannel>();
    for (const ch of ageSafeChannels) {
      lookup.set(getChannelKey(ch), ch);
    }
    return favoriteIds
      .map((id) => lookup.get(id))
      .filter((ch): ch is LiveChannel => Boolean(ch));
  }, [ageSafeChannels, favoriteIds]);

  // Filter by Genre, Pinned-only, and Search Query
  const genreAndSearchFiltered = useMemo(() => {
    let list = ageSafeChannels;

    if (pinnedOnly) {
      list = list.filter((c) => favoriteIdSet.has(getChannelKey(c)));
    }

    if (selectedGenre !== 'All Genres') {
      const allowedNames = channelCategories[selectedGenre] || [];
      const allowedSet = new Set(allowedNames.map(normalizeMatchText));
      list = list.filter((c) => allowedSet.has(normalizeMatchText(c.title)));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          String(c.channelNumber || '').includes(q)
      );
    }

    return list;
  }, [ageSafeChannels, pinnedOnly, favoriteIdSet, selectedGenre, searchQuery]);

  const statusCounts = useMemo(() => {
    const counts = {
      all: genreAndSearchFiltered.length,
      online: 0,
      timeout: 0,
      offline: 0,
      checking: 0,
    };

    for (const ch of genreAndSearchFiltered) {
      const st = resolveChannelStatus(ch);
      if (st === 'online') counts.online++;
      else if (st === 'timeout') counts.timeout++;
      else if (st === 'offline') counts.offline++;
      else counts.checking++;
    }

    return counts;
  }, [genreAndSearchFiltered, resolveChannelStatus]);

  const finalFilteredChannels = useMemo(() => {
    const filtered = genreAndSearchFiltered.filter((ch) => {
      if (statusFilter === 'all') return true;
      const st = resolveChannelStatus(ch);
      if (statusFilter === 'timeout') {
        return st === 'timeout' || st === 'checking';
      }
      return st === statusFilter;
    });

    const rank: Record<ExtendedHealthStatus, number> = {
      online: 1,
      checking: 2,
      timeout: 3,
      offline: 4,
    };

    return [...filtered].sort((a, b) => {
      // Always bubble pinned favorites up slightly in status view
      if (sortBy === 'status') {
        const pinA = favoriteIdSet.has(getChannelKey(a)) ? 0 : 1;
        const pinB = favoriteIdSet.has(getChannelKey(b)) ? 0 : 1;
        if (pinA !== pinB) return pinA - pinB;
        const rA = rank[resolveChannelStatus(a)] || 3;
        const rB = rank[resolveChannelStatus(b)] || 3;
        if (rA !== rB) return rA - rB;
        return a.title.localeCompare(b.title);
      }
      if (sortBy === 'channelNumber') {
        const na = a.channelNumber ?? 9999;
        const nb = b.channelNumber ?? 9999;
        if (na !== nb) return na - nb;
        return a.title.localeCompare(b.title);
      }
      return a.title.localeCompare(b.title);
    });
  }, [
    genreAndSearchFiltered,
    statusFilter,
    resolveChannelStatus,
    sortBy,
    favoriteIdSet,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(finalFilteredChannels.length / channelsPerPage)
  );
  const paginatedChannels = useMemo(() => {
    const start = (currentPage - 1) * channelsPerPage;
    return finalFilteredChannels.slice(start, start + channelsPerPage);
  }, [finalFilteredChannels, currentPage, channelsPerPage]);

  const handleSurpriseChannel = () => {
    const onlinePool = finalFilteredChannels.filter(
      (ch) => resolveChannelStatus(ch) === 'online'
    );
    const pool =
      onlinePool.length > 0 ? onlinePool : finalFilteredChannels;
    if (!pool.length) return;
    const picked = pool[Math.floor(Math.random() * pool.length)];
    const targetUrl = picked.streamUrl || picked.url;
    const chId = getChannelKey(picked);
    recordWatchHistory({
      id: chId,
      title: picked.title,
      posterPath: picked.logo || '',
      type: 'livetv',
    });
    navigate({
      to: '/live-player',
      search: {
        url: targetUrl,
        title: picked.title,
        logo: picked.logo || '',
        channelId: chId,
      },
    });
  };

  const handleCategorySelect = (id: string) => {
    setSelectedCategory((prev) => (prev === id && id !== 'All' ? 'All' : id));
  };

  const handleGenreSelect = (id: string) => {
    setSelectedGenre((prev) =>
      prev === id && id !== 'All Genres' ? 'All Genres' : id
    );
  };

  const handleStatusSelect = (id: HealthFilterOption) => {
    setStatusFilter((prev) => (prev === id && id !== 'all' ? 'all' : id));
  };

  const cardRadiusClass =
    posterShape === 'sharp'
      ? 'rounded-lg'
      : posterShape === 'extra'
        ? 'rounded-[30px]'
        : 'rounded-3xl';

  const isCompactMode = density === 'compact' && !largeButtons;

  const gridClass = isCompactMode
    ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-2.5 sm:gap-3'
    : largeButtons
      ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4'
      : 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5 sm:gap-4';

  const themeStyles = useMemo(() => {
    switch (appTheme) {
      case 'red':
        return {
          bg: 'bg-gradient-to-br from-zinc-950/90 via-red-950/40 to-black/95',
          accentText: 'text-red-400',
          accentBar: 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.95)]',
          borderGlow: 'border-red-500/30 shadow-[0_16px_50px_rgba(239,68,68,0.2)]',
          borderHover: 'hover:border-red-400/70',
          laserLine: 'from-transparent via-red-500 to-amber-400',
          playBtn:
            'bg-white/[0.06] group-hover:bg-gradient-to-r group-hover:from-red-600 group-hover:to-amber-600 text-slate-200 group-hover:text-white border border-white/10 group-hover:border-red-400/50',
          ambient: 'from-red-600/15 via-transparent to-transparent',
        };
      case 'midnight':
        return {
          bg: 'bg-gradient-to-br from-slate-950/90 via-blue-950/40 to-slate-950/95',
          accentText: 'text-sky-300',
          accentBar: 'bg-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.95)]',
          borderGlow: 'border-sky-500/30 shadow-[0_16px_50px_rgba(56,189,248,0.2)]',
          borderHover: 'hover:border-sky-400/70',
          laserLine: 'from-transparent via-sky-400 to-blue-500',
          playBtn:
            'bg-white/[0.06] group-hover:bg-gradient-to-r group-hover:from-sky-500 group-hover:to-blue-600 text-slate-200 group-hover:text-white border border-white/10 group-hover:border-sky-400/50',
          ambient: 'from-blue-600/15 via-transparent to-transparent',
        };
      case 'emerald':
        return {
          bg: 'bg-gradient-to-br from-slate-950/90 via-emerald-950/40 to-slate-950/95',
          accentText: 'text-emerald-300',
          accentBar: 'bg-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.95)]',
          borderGlow:
            'border-emerald-500/30 shadow-[0_16px_50px_rgba(16,185,129,0.2)]',
          borderHover: 'hover:border-emerald-400/70',
          laserLine: 'from-transparent via-emerald-400 to-cyan-400',
          playBtn:
            'bg-white/[0.06] group-hover:bg-gradient-to-r group-hover:from-emerald-500 group-hover:to-teal-600 text-slate-200 group-hover:text-white border border-white/10 group-hover:border-emerald-400/50',
          ambient: 'from-emerald-600/15 via-transparent to-transparent',
        };
      case 'amber':
        return {
          bg: 'bg-gradient-to-br from-stone-950/90 via-yellow-950/40 to-neutral-950/95',
          accentText: 'text-amber-300',
          accentBar: 'bg-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.95)]',
          borderGlow:
            'border-amber-500/30 shadow-[0_16px_50px_rgba(245,158,11,0.2)]',
          borderHover: 'hover:border-amber-400/70',
          laserLine: 'from-transparent via-amber-400 to-orange-500',
          playBtn:
            'bg-white/[0.06] group-hover:bg-gradient-to-r group-hover:from-amber-500 group-hover:to-orange-600 text-slate-200 group-hover:text-white border border-white/10 group-hover:border-amber-400/50',
          ambient: 'from-amber-600/15 via-transparent to-transparent',
        };
      case 'cyan':
        return {
          bg: 'bg-gradient-to-br from-slate-950/90 via-cyan-950/40 to-slate-950/95',
          accentText: 'text-cyan-300',
          accentBar: 'bg-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.95)]',
          borderGlow:
            'border-cyan-500/30 shadow-[0_16px_50px_rgba(6,182,212,0.2)]',
          borderHover: 'hover:border-cyan-400/70',
          laserLine: 'from-transparent via-cyan-400 to-sky-500',
          playBtn:
            'bg-white/[0.06] group-hover:bg-gradient-to-r group-hover:from-cyan-500 group-hover:to-blue-600 text-slate-200 group-hover:text-white border border-white/10 group-hover:border-cyan-400/50',
          ambient: 'from-cyan-600/15 via-transparent to-transparent',
        };
      case 'violet':
      default:
        return {
          bg: 'bg-gradient-to-br from-slate-950/90 via-purple-950/40 to-slate-950/95',
          accentText: 'text-violet-300',
          accentBar: 'bg-violet-500 shadow-[0_0_15px_rgba(139,92,246,0.95)]',
          borderGlow:
            'border-violet-500/30 shadow-[0_16px_50px_rgba(139,92,246,0.2)]',
          borderHover: 'hover:border-purple-400/70',
          laserLine: 'from-transparent via-pink-500 to-cyan-400',
          playBtn:
            'bg-white/[0.06] group-hover:bg-gradient-to-r group-hover:from-purple-600 group-hover:to-cyan-500 text-slate-200 group-hover:text-white border border-white/10 group-hover:border-purple-400/50',
          ambient: 'from-violet-600/15 via-transparent to-transparent',
        };
    }
  }, [appTheme]);

  const getPrimaryBgColor = (theme: AppTheme) => {
    switch (theme) {
      case 'red':
        return 'bg-gradient-to-r from-red-600 via-rose-600 to-orange-600 text-white shadow-lg shadow-red-600/30';
      case 'midnight':
        return 'bg-gradient-to-r from-blue-600 via-cyan-600 to-sky-600 text-white shadow-lg shadow-blue-600/30';
      case 'emerald':
        return 'bg-gradient-to-r from-emerald-600 via-teal-600 to-green-600 text-white shadow-lg shadow-emerald-600/30';
      case 'amber':
        return 'bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 text-white shadow-lg shadow-amber-600/30';
      case 'cyan':
        return 'bg-gradient-to-r from-cyan-600 via-teal-600 to-blue-600 text-white shadow-lg shadow-cyan-600/30';
      case 'violet':
      default:
        return 'bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 text-white shadow-lg shadow-violet-600/30';
    }
  };

  const hasActiveFilters =
    selectedCategory !== 'All' ||
    selectedGenre !== 'All Genres' ||
    statusFilter !== 'all' ||
    pinnedOnly ||
    searchQuery.trim() !== '';

  const resetAllFilters = () => {
    setSelectedCategory('All');
    setSelectedGenre('All Genres');
    setStatusFilter('all');
    setPinnedOnly(false);
    setSearchQuery('');
  };

  return (
    <main
      className={`min-h-screen ${themeStyles.bg} text-slate-100 transition-colors duration-300 pb-20 px-3 sm:px-6 w-full max-w-full overflow-x-hidden box-border relative rounded-3xl`}
    >
      <AppWallpaper />
      {!isLowRam && !reducedMotion && !glowOff && (
        <div
          className={`absolute inset-x-0 -top-12 h-96 bg-gradient-to-b ${themeStyles.ambient} blur-3xl z-0 pointer-events-none rounded-t-3xl`}
        />
      )}

      <header className="py-5 max-w-7xl mx-auto space-y-4 box-border relative z-10">
        {/* Top Row: Back to Home + Live Clock + Surprise Channel + Reset */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <Link
            to="/"
            className={`group inline-flex items-center gap-3 rounded-full bg-slate-900/80 hover:bg-slate-900/95 backdrop-blur-xl pl-4 pr-2 ${
              largeButtons ? 'py-2.5' : 'py-1.5'
            } border border-white/15 hover:border-purple-400/60 shadow-[0_4px_20px_rgba(0,0,0,0.6)] transition-all duration-300 transform active:scale-95 focus:outline-none focus:ring-4 focus:ring-purple-500/50`}
          >
            <span className="text-slate-400 group-hover:text-white group-hover:-translate-x-0.5 transition-all text-xs font-bold">
              ‹
            </span>
            <span className="text-xs sm:text-sm font-semibold tracking-wide text-slate-100 group-hover:text-white">
              Back to Home
            </span>
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-tr from-purple-600/50 via-pink-500/40 to-cyan-400/50 border border-purple-300/50 text-[11px] text-white">
              ⟲
            </span>
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-950/80 border border-white/15 px-3 py-1.5 text-xs font-extrabold text-slate-200">
              🕒 {guideClock}
            </span>

            {finalFilteredChannels.length > 0 && (
              <button
                type="button"
                onClick={handleSurpriseChannel}
                className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/50 px-3.5 py-1.5 text-xs font-extrabold text-amber-200 hover:text-white shadow transition cursor-pointer"
                title="Jump into a random live broadcast"
              >
                <span>🎲 Channel Surf</span>
              </button>
            )}

            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetAllFilters}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 px-3.5 py-1.5 text-xs font-bold text-white shadow transition cursor-pointer"
              >
                <span>✕ Reset Filters</span>
              </button>
            )}
          </div>
        </div>

        {/* Pin Notification Toast */}
        {pinToast && (
          <div className="rounded-2xl bg-amber-950/85 border border-amber-400/50 px-4 py-2 text-center text-xs font-extrabold text-amber-200 shadow-xl">
            {pinToast}
          </div>
        )}

        {/* Hero Console Control Deck */}
        <div
          className={`rounded-3xl border bg-slate-950/85 backdrop-blur-2xl p-4 sm:p-6 ${themeStyles.borderGlow} space-y-5`}
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-white/10 pb-4">
            <div className="flex items-center gap-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-red-600/30 via-purple-600/30 to-black border border-white/20 shadow-[0_0_25px_rgba(239,68,68,0.35)] text-2xl">
                📡
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                    Live TV & Sports
                  </h1>
                  {kidsSafeActive && (
                    <span className="rounded-full bg-emerald-500/20 border border-emerald-400/40 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-emerald-300">
                      🧒 Kids Safe
                    </span>
                  )}
                </div>
                <p className="text-xs sm:text-sm text-slate-400">
                  Instant broadcast feeds with pinned favorites & real-time health radar
                </p>
              </div>
            </div>

            {/* Quick Search + Sort + Density + Health Refresh */}
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <div className="relative flex-1 min-w-[170px] sm:w-52">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">
                  🔍
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search channel or CH #..."
                  className="w-full h-10 rounded-xl border border-white/15 bg-black/75 pl-8 pr-7 text-xs font-bold text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as LiveSortOption)}
                aria-label="Sort Live Channels"
                className="h-10 rounded-xl border border-white/15 bg-black/75 px-2.5 text-xs font-bold text-white focus:outline-none cursor-pointer"
              >
                <option value="status">Sort: Live First</option>
                <option value="channelNumber">Sort: Channel #</option>
                <option value="az">Sort: A–Z</option>
              </select>

              {!largeButtons && (
                <button
                  type="button"
                  onClick={() =>
                    setDensity((d) => (d === 'comfort' ? 'compact' : 'comfort'))
                  }
                  className="h-10 px-3 rounded-xl bg-black/70 hover:bg-white/15 border border-white/15 text-xs font-bold text-slate-200 transition cursor-pointer"
                  title="Switch Card Layout Density"
                >
                  {density === 'comfort' ? '▦ Compact' : '▢ Comfort'}
                </button>
              )}

              <button
                type="button"
                onClick={() => void handleRefreshHealth()}
                disabled={probing}
                className={`h-10 px-4 rounded-xl text-xs font-extrabold tracking-wide transition flex items-center gap-2 shrink-0 cursor-pointer disabled:opacity-60 ${getPrimaryBgColor(
                  appTheme
                )}`}
              >
                <span className={probing ? 'animate-spin inline-block' : ''}>↻</span>
                <span>
                  {probing
                    ? `Scan (${probeProgress.done}/${probeProgress.total})`
                    : 'Refresh Health'}
                </span>
              </button>
            </div>
          </div>

          {/* 1. STREAM HEALTH STATUS & PINNED FILTER BAR */}
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2 px-1">
              <p className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest">
                1. Filter by Stream Status & Favorites
              </p>
              <div className="flex items-center gap-2">
                {probing && (
                  <span className="text-[11px] font-bold text-amber-300 animate-pulse">
                    ⚡ Fast background check running…
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setPinnedOnly((p) => !p)}
                  className={`rounded-full px-3 py-0.5 text-[11px] font-extrabold border transition cursor-pointer ${
                    pinnedOnly
                      ? 'bg-amber-500 text-slate-950 border-amber-300 shadow'
                      : 'bg-amber-950/40 text-amber-300 border-amber-500/35 hover:bg-amber-900/50'
                  }`}
                >
                  ⭐ Pinned ({favoriteIds.length}/{MAX_FAVORITE_CHANNELS})
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-0.5">
              <button
                type="button"
                onClick={() => handleStatusSelect('all')}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-2xl border text-xs font-extrabold transition-all cursor-pointer ${
                  statusFilter === 'all'
                    ? `${getPrimaryBgColor(appTheme)} border-white/40 scale-[1.02]`
                    : 'bg-black/60 hover:bg-white/[0.08] border-white/10 text-slate-300'
                }`}
              >
                <span className="flex items-center gap-2 truncate">
                  <span>🌐</span>
                  <span>All Channels</span>
                </span>
                <span className="rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-black text-white">
                  {statusCounts.all}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleStatusSelect('online')}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-2xl border text-xs font-extrabold transition-all cursor-pointer ${
                  statusFilter === 'online'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white border-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.45)] scale-[1.02]'
                    : 'bg-emerald-950/35 hover:bg-emerald-950/60 border-emerald-500/30 text-emerald-300'
                }`}
              >
                <span className="flex items-center gap-2 truncate">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
                  <span>Online</span>
                </span>
                <span className="rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-black text-emerald-200">
                  {statusCounts.online}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleStatusSelect('timeout')}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-2xl border text-xs font-extrabold transition-all cursor-pointer ${
                  statusFilter === 'timeout'
                    ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white border-amber-300 shadow-[0_0_20px_rgba(245,158,11,0.45)] scale-[1.02]'
                    : 'bg-amber-950/35 hover:bg-amber-950/60 border-amber-500/30 text-amber-300'
                }`}
              >
                <span className="flex items-center gap-2 truncate">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.9)]" />
                  <span>Slow / ?</span>
                </span>
                <span className="rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-black text-amber-200">
                  {statusCounts.timeout + statusCounts.checking}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleStatusSelect('offline')}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-2xl border text-xs font-extrabold transition-all cursor-pointer ${
                  statusFilter === 'offline'
                    ? 'bg-gradient-to-r from-red-600 to-rose-700 text-white border-red-300 shadow-[0_0_20px_rgba(239,68,68,0.45)] scale-[1.02]'
                    : 'bg-red-950/35 hover:bg-red-950/60 border-red-500/30 text-red-300'
                }`}
              >
                <span className="flex items-center gap-2 truncate">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.9)]" />
                  <span>Offline</span>
                </span>
                <span className="rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-black text-red-200">
                  {statusCounts.offline}
                </span>
              </button>
            </div>
          </div>

          {/* 2. REGIONS & FEEDS BAR */}
          <div className="w-full space-y-1.5">
            <div className="flex items-center justify-between px-1">
              <p className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest">
                2. Regions & Feeds
              </p>
              {selectedCategory !== 'All' && (
                <button
                  type="button"
                  onClick={() => setSelectedCategory('All')}
                  className="text-[11px] font-bold text-amber-300 hover:underline cursor-pointer"
                >
                  Show All Regions
                </button>
              )}
            </div>
            <ScrollPillBar
              options={categories.map((cat) => ({
                id: cat,
                label: cat === 'All' ? '🌐 All Regions' : cat,
              }))}
              activeId={selectedCategory}
              onSelect={handleCategorySelect}
              appTheme={appTheme}
              getPrimaryBgColor={getPrimaryBgColor}
              ariaLabel="Live TV regions"
            />
          </div>

          {/* 3. CATEGORIES & GENRES BAR */}
          <div className="w-full space-y-1.5">
            <div className="flex items-center justify-between px-1">
              <p className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest">
                3. Categories & Genres
              </p>
              {selectedGenre !== 'All Genres' && (
                <button
                  type="button"
                  onClick={() => setSelectedGenre('All Genres')}
                  className="text-[11px] font-bold text-amber-300 hover:underline cursor-pointer"
                >
                  Show All Genres
                </button>
              )}
            </div>
            <ScrollPillBar
              options={genreOptions.map((genre) => ({
                id: genre,
                label: genre === 'All Genres' ? '✨ All Genres' : genre,
              }))}
              activeId={selectedGenre}
              onSelect={handleGenreSelect}
              appTheme={appTheme}
              getPrimaryBgColor={getPrimaryBgColor}
              ariaLabel="Live TV genres"
            />
          </div>
        </div>
      </header>

      {/* Main Content Wrapper */}
      <div className="max-w-7xl mx-auto box-border relative z-10 space-y-7">
        {/* DEDICATED PINNED FAVORITE CHANNELS SHELF */}
        {pinnedChannels.length > 0 && !pinnedOnly && !searchQuery.trim() && (
          <section className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2.5">
                <span className="w-1.5 h-6 rounded-full bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.9)]" />
                <h2 className="text-base sm:text-lg font-black tracking-tight text-amber-300">
                  ⭐ Pinned Favorite Channels
                </h2>
              </div>
              <span className="text-xs font-bold text-slate-400">
                {pinnedChannels.length} / {MAX_FAVORITE_CHANNELS} pinned
              </span>
            </div>

            <div className={gridClass}>
              {pinnedChannels.map((channel) => {
                const key = getChannelKey(channel);
                return (
                  <ChannelCard
                    key={`pinned-${key}`}
                    channel={channel}
                    status={resolveChannelStatus(channel)}
                    isPinned={true}
                    onTogglePin={handleTogglePin}
                    laserLineClass="from-transparent via-amber-400 to-orange-500"
                    playBtnClass={themeStyles.playBtn}
                    borderHoverClass="hover:border-amber-400"
                    radiusClass={cardRadiusClass}
                    largeButtons={largeButtons}
                    compact={isCompactMode}
                    glowOff={glowOff}
                  />
                );
              })}
            </div>
          </section>
        )}

        {/* MAIN CHANNELS GRID SECTION */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 px-1">
            <div className="flex items-center gap-2.5">
              <span className={`w-1.5 h-6 rounded-full ${themeStyles.accentBar}`} />
              <h3 className="text-lg sm:text-xl font-black tracking-tight text-white">
                {pinnedOnly
                  ? '⭐ My Pinned Channels'
                  : selectedGenre !== 'All Genres'
                    ? selectedGenre
                    : selectedCategory}{' '}
                {statusFilter === 'online'
                  ? '• Online Feeds'
                  : statusFilter === 'timeout'
                    ? '• Slow / ? Feeds'
                    : statusFilter === 'offline'
                      ? '• Offline Feeds'
                      : '• All Feeds'}
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-950/70 border border-emerald-500/30 px-3 py-1 text-emerald-300">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                <span>{statusCounts.online} online</span>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-950/70 border border-amber-500/30 px-3 py-1 text-amber-300">
                <span className="h-2 w-2 rounded-full bg-amber-400" />
                <span>{statusCounts.timeout + statusCounts.checking} slow/?</span>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-950/70 border border-red-500/30 px-3 py-1 text-red-300">
                <span className="h-2 w-2 rounded-full bg-red-500" />
                <span>{statusCounts.offline} offline</span>
              </span>
              <span
                className={`rounded-full bg-white/[0.06] border border-white/10 px-3 py-1 ${themeStyles.accentText}`}
              >
                {finalFilteredChannels.length} matching • {channelsPerPage}/pg
              </span>
            </div>
          </div>

          {loading ? (
            <div className="rounded-3xl border border-white/10 bg-slate-950/80 backdrop-blur-xl p-12 flex flex-col justify-center items-center gap-3 text-center">
              <div
                className={`animate-spin rounded-full h-10 w-10 border-t-2 ${themeStyles.accentText}`}
              />
              <p className="text-sm font-bold text-white">
                Loading broadcast channels…
              </p>
            </div>
          ) : paginatedChannels.length > 0 ? (
            <>
              <div className={gridClass}>
                {paginatedChannels.map((channel) => {
                  const key = getChannelKey(channel);
                  return (
                    <ChannelCard
                      key={key}
                      channel={channel}
                      status={resolveChannelStatus(channel)}
                      isPinned={favoriteIdSet.has(key)}
                      onTogglePin={handleTogglePin}
                      laserLineClass={themeStyles.laserLine}
                      playBtnClass={themeStyles.playBtn}
                      borderHoverClass={themeStyles.borderHover}
                      radiusClass={cardRadiusClass}
                      largeButtons={largeButtons}
                      compact={isCompactMode}
                      glowOff={glowOff}
                    />
                  );
                })}
              </div>

              {/* Pagination Deck */}
              {totalPages > 1 && (
                <div className="mt-8 flex flex-wrap items-center justify-center gap-3 rounded-2xl bg-slate-950/85 border border-white/15 backdrop-blur-xl p-3.5 mx-auto w-full max-w-md shadow-2xl">
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentPage((p) => Math.max(1, p - 1));
                      window.scrollTo({
                        top: 0,
                        behavior: reducedMotion ? 'auto' : 'smooth',
                      });
                    }}
                    disabled={currentPage <= 1}
                    className={`rounded-xl bg-white/10 hover:bg-white/20 ${
                      largeButtons ? 'px-5 py-3 text-sm' : 'px-4 py-2 text-xs'
                    } font-extrabold text-white transition disabled:opacity-40 cursor-pointer`}
                  >
                    ◀ Prev
                  </button>

                  <span className={`text-xs font-black ${themeStyles.accentText}`}>
                    Page {currentPage} of {totalPages}
                  </span>

                  <button
                    type="button"
                    onClick={() => {
                      setCurrentPage((p) => Math.min(totalPages, p + 1));
                      window.scrollTo({
                        top: 0,
                        behavior: reducedMotion ? 'auto' : 'smooth',
                      });
                    }}
                    disabled={currentPage >= totalPages}
                    className={`rounded-xl ${
                      largeButtons ? 'px-5 py-3 text-sm' : 'px-4 py-2 text-xs'
                    } font-extrabold shadow transition disabled:opacity-40 cursor-pointer ${getPrimaryBgColor(
                      appTheme
                    )}`}
                  >
                    Next ▶
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="rounded-3xl border border-white/15 bg-slate-950/80 backdrop-blur-xl p-10 text-center space-y-3 shadow-2xl">
              <div className="text-3xl">📡</div>
              <p className="text-base font-black text-white">
                {pinnedOnly
                  ? 'You have no pinned favorite channels yet.'
                  : 'No channels match this exact status or filter combination.'}
              </p>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                {pinnedOnly
                  ? 'Tap the ☆ star on any channel card (or inside the Live Player) to pin up to 12 favorites here.'
                  : 'Try switching the Stream Status filter to All Channels or Slow / ?, or reset your region and genre filters.'}
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetAllFilters}
                  className={`mt-2 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-extrabold text-white shadow-lg transition cursor-pointer ${getPrimaryBgColor(
                    appTheme
                  )}`}
                >
                  <span>🌐 Show All Channels</span>
                </button>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
