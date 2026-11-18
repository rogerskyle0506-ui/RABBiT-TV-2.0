// src/routes/live-tv.tsx
import { createFileRoute, Link } from '@tanstack/react-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchLiveCategories,
  fetchChannelsByCategory,
  fetchAllChannels,
  getCatalogHealthStats,
  refreshLiveHealth,
  type LiveChannel,
  type CatalogHealthStats,
} from '../lib/live-feed-service';
import { AppTheme, getSavedTheme } from '@/lib/settings';
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

const FAST_HEALTH_CACHE_KEY = 'rabtv_fast_live_health_v2';
const FAST_HEALTH_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const CHANNELS_PER_PAGE = 36; // Memory cap for 1GB-2GB RAM streaming sticks
const PROBE_CONCURRENCY = 12;
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
  return String(channel.channelId || channel.streamUrl || channel.url || channel.title);
}

/**
 * Fast, lightweight stream probe with a strict 2.6s timeout.
 * Distinguishes:
 *  - 'online': HTTP 200..299 with valid response
 *  - 'timeout': AbortError (slow stream) or CORS opaque fallback (questionable / possibly online)
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
      // Token/Geo/Referer protected streams often still play inside the native/HLS video element
      return 'timeout';
    }
    return 'offline';
  } catch (err: any) {
    window.clearTimeout(timer);

    // If aborted due to timeout, classify as questionable/timeout
    if (err?.name === 'AbortError') {
      return 'timeout';
    }

    // Secondary no-cors ping to check if the server is alive behind strict CORS headers
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
        className="inline-flex items-center gap-1.5 rounded-full bg-emerald-950/90 border border-emerald-400/50 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.5)] backdrop-blur-md"
      >
        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
        <span>Live</span>
      </span>
    );
  }

  if (status === 'timeout') {
    return (
      <span
        title="Questionable / Timeout — Stream responded slowly or has CORS restrictions, but may still play"
        className="inline-flex items-center gap-1.5 rounded-full bg-amber-950/90 border border-amber-400/50 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.4)] backdrop-blur-md"
      >
        <span className="h-2 w-2 rounded-full bg-amber-400" />
        <span>Timeout ?</span>
      </span>
    );
  }

  if (status === 'offline') {
    return (
      <span
        title="Stream Offline"
        className="inline-flex items-center gap-1.5 rounded-full bg-red-950/90 border border-red-500/50 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-red-300 shadow-md backdrop-blur-md"
      >
        <span className="h-2 w-2 rounded-full bg-red-500" />
        <span>Offline</span>
      </span>
    );
  }

  return (
    <span
      title="Checking stream health..."
      className="inline-flex items-center gap-1.5 rounded-full bg-slate-900/90 border border-white/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-300 backdrop-blur-md"
    >
      <span className="h-2 w-2 rounded-full bg-sky-400 animate-ping" />
      <span>Checking</span>
    </span>
  );
}

const ChannelCard = React.memo(function ChannelCard({
  channel,
  status,
  laserLineClass,
  playBtnClass,
  borderHoverClass,
}: {
  channel: LiveChannel;
  status: ExtendedHealthStatus;
  laserLineClass: string;
  playBtnClass: string;
  borderHoverClass: string;
}) {
  const streamTarget = channel.streamUrl || channel.url;
  const description = useMemo(
    () => getChannelDescription(channel.title),
    [channel.title]
  );

  return (
    <Link
      to="/live-player"
      search={{
        url: streamTarget,
        title: channel.title,
        logo: channel.logo || '',
      }}
      onClick={() => {
        recordWatchHistory({
          id: channel.channelId || streamTarget,
          title: channel.title,
          posterPath: channel.logo || '',
          type: 'livetv',
        });
      }}
      className={`group relative flex flex-col justify-between rounded-3xl bg-slate-950/85 backdrop-blur-xl border border-white/15 ${borderHoverClass} p-3.5 sm:p-4 shadow-[0_12px_35px_rgba(0,0,0,0.75)] hover:shadow-[0_16px_45px_rgba(0,0,0,0.95)] hover:-translate-y-1.5 transition-all duration-300 text-center overflow-hidden focus:outline-none focus:ring-4 focus:ring-purple-500/60`}
    >
      {/* Top Status Bar */}
      <div className="flex items-center justify-between gap-1.5 mb-2.5 z-10">
        <span className="rounded-full bg-white/[0.06] border border-white/10 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-slate-300 truncate max-w-[50%]">
          {(channel as any).category
            ? categoryMapping[(channel as any).category] || (channel as any).category
            : 'TV'}
        </span>
        <StatusBadge status={status} />
      </div>

      {/* Upfront High-Contrast Logo Showcase Stage */}
      <div className="relative w-full h-32 sm:h-36 rounded-2xl bg-gradient-to-b from-slate-900/90 via-black to-slate-950 border border-white/10 group-hover:border-white/25 mb-3.5 overflow-hidden flex items-center justify-center p-4 shadow-inner">
        {/* Radial Spotlight so both dark and white transparent PNG logos pop */}
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
            <span className="text-2xl">📺</span>
            <span className="text-xs font-black tracking-widest uppercase text-slate-300">
              {channel.title.slice(0, 12)}
            </span>
          </div>
        )}
      </div>

      {/* Channel Info & Watch Action */}
      <div className="flex flex-col flex-1 justify-between space-y-2.5 z-10">
        <div>
          <h4 className="text-sm sm:text-base font-black text-white tracking-tight line-clamp-1 group-hover:text-white">
            {channel.title}
          </h4>
          <p className="text-[11px] text-slate-400 font-medium line-clamp-2 mt-1 leading-snug min-h-[2.25rem]">
            {description}
          </p>
        </div>

        <div
          className={`w-full py-2 px-3 rounded-xl text-[11px] font-extrabold uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-1.5 ${playBtnClass}`}
        >
          <span>▶</span>
          <span>Watch Live</span>
        </div>
      </div>

      {/* Neon Bottom Laser Highlight */}
      <div
        className={`absolute inset-x-4 bottom-0 h-[2px] bg-gradient-to-r ${laserLineClass} opacity-75 group-hover:opacity-100`}
      />
    </Link>
  );
});

function LiveTvComponent() {
  const [categories, setCategories] = useState<string[]>(['All']);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const genreOptions = useMemo(
    () => ['All Genres', ...Object.keys(channelCategories)],
    []
  );
  const [selectedGenre, setSelectedGenre] = useState<string>('All Genres');
  const [statusFilter, setStatusFilter] = useState<HealthFilterOption>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [rawChannels, setRawChannels] = useState<LiveChannel[]>([]);
  const [healthMap, setHealthMap] = useState<Record<string, ExtendedHealthStatus>>(
    () => loadCachedHealthMap()
  );

  const [loading, setLoading] = useState<boolean>(true);
  const [probing, setProbing] = useState<boolean>(false);
  const [probeProgress, setProbeProgress] = useState<{ done: number; total: number }>({
    done: 0,
    total: 0,
  });

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [appTheme, setAppTheme] = useState<AppTheme>('violet');

  const probeRunIdRef = useRef<number>(0);
  const healthMapRef = useRef<Record<string, ExtendedHealthStatus>>(healthMap);

  useEffect(() => {
    healthMapRef.current = healthMap;
  }, [healthMap]);

  useEffect(() => {
    setAppTheme(getSavedTheme());
    const handleSettingsUpdate = () => setAppTheme(getSavedTheme());
    window.addEventListener('rabtv_settings_updated', handleSettingsUpdate);
    return () =>
      window.removeEventListener('rabtv_settings_updated', handleSettingsUpdate);
  }, []);

  // Deduplicate categories so "All" never appears twice side-by-side
  useEffect(() => {
    let active = true;
    fetchLiveCategories()
      .then((cats) => {
        if (!active) return;
        const mapped = cats
          .map((cat) => ( categoryMapping[cat] || cat ).trim())
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
   * Updates channel statuses in smooth batches without blocking the UI.
   */
  const runFastBackgroundProbe = useCallback(
    async (channelsToProbe: LiveChannel[], forceRefresh = false) => {
      const runId = ++probeRunIdRef.current;
      const existingCache = forceRefresh ? {} : loadCachedHealthMap();

      const pending: LiveChannel[] = [];
      for (const ch of channelsToProbe) {
        const key = getChannelKey(ch);
        if (!forceRefresh && existingCache[key] && existingCache[key] !== 'checking') {
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

      // Mark uncached channels as checking initially
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

          // Batch React state updates every 350ms or on completion to protect 1-2GB RAM sticks
          const now = Date.now();
          if (now - lastFlushTime >= 350 || completed === pending.length) {
            lastFlushTime = now;
            setHealthMap({ ...workingMap });
            setProbeProgress({ done: completed, total: pending.length });
          }
        }
      };

      const workerCount = Math.min(PROBE_CONCURRENCY, pending.length);
      await Promise.all(Array.from({ length: workerCount }, () => worker()));

      if (probeRunIdRef.current === runId) {
        setHealthMap({ ...workingMap });
        saveCachedHealthMap(workingMap);
        setProbing(false);
      }
    },
    []
  );

  /**
   * Loads channels immediately without waiting for slow network health probes.
   */
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

        // Deduplicate channels by channelId/streamUrl
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

        // Kick off non-blocking background health verification
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
      // Cancel in-flight probe batch on category change or unmount
      probeRunIdRef.current++;
    };
  }, [loadChannelsInstantly]);

  // Reset pagination whenever any filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory, selectedGenre, statusFilter, searchQuery]);

  const handleRefreshHealth = async () => {
    try {
      localStorage.removeItem(FAST_HEALTH_CACHE_KEY);
    } catch {
      // ignore
    }
    void refreshLiveHealth().catch(() => {});
    await loadChannelsInstantly({ forceProbe: true });
  };

  // Resolve effective status for every channel
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

  // Filter by Genre & Search Query first (so Status counts reflect the active Region + Genre)
  const genreAndSearchFiltered = useMemo(() => {
    let list = rawChannels;

    if (selectedGenre !== 'All Genres') {
      const allowedNames = channelCategories[selectedGenre] || [];
      const allowedSet = new Set(allowedNames.map((n) => n.toLowerCase()));
      list = list.filter((c) => allowedSet.has(c.title.toLowerCase()));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((c) => c.title.toLowerCase().includes(q));
    }

    return list;
  }, [rawChannels, selectedGenre, searchQuery]);

  // Live Status Counts for the current Region + Genre view
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

  // Final filtered & sorted channels according to selected status tab
  const finalFilteredChannels = useMemo(() => {
    const filtered = genreAndSearchFiltered.filter((ch) => {
      if (statusFilter === 'all') return true;
      const st = resolveChannelStatus(ch);
      if (statusFilter === 'timeout') {
        // Include questionable/timeout and still-checking streams
        return st === 'timeout' || st === 'checking';
      }
      return st === statusFilter;
    });

    // Sort online first, then questionable/timeout, then offline
    const rank: Record<ExtendedHealthStatus, number> = {
      online: 1,
      checking: 2,
      timeout: 3,
      offline: 4,
    };

    return [...filtered].sort((a, b) => {
      const rA = rank[resolveChannelStatus(a)] || 3;
      const rB = rank[resolveChannelStatus(b)] || 3;
      if (rA !== rB) return rA - rB;
      return a.title.localeCompare(b.title);
    });
  }, [genreAndSearchFiltered, statusFilter, resolveChannelStatus]);

  // Pagination slice for 1GB-2GB RAM device performance
  const totalPages = Math.max(
    1,
    Math.ceil(finalFilteredChannels.length / CHANNELS_PER_PAGE)
  );
  const paginatedChannels = useMemo(() => {
    const start = (currentPage - 1) * CHANNELS_PER_PAGE;
    return finalFilteredChannels.slice(start, start + CHANNELS_PER_PAGE);
  }, [finalFilteredChannels, currentPage]);

  // Toggle selection helper: clicking an active non-All filter unselects it back to 'All'
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
          borderGlow: 'border-emerald-500/30 shadow-[0_16px_50px_rgba(16,185,129,0.2)]',
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
          borderGlow: 'border-amber-500/30 shadow-[0_16px_50px_rgba(245,158,11,0.2)]',
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
          borderGlow: 'border-cyan-500/30 shadow-[0_16px_50px_rgba(6,182,212,0.2)]',
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
          borderGlow: 'border-violet-500/30 shadow-[0_16px_50px_rgba(139,92,246,0.2)]',
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
    searchQuery.trim() !== '';

  const resetAllFilters = () => {
    setSelectedCategory('All');
    setSelectedGenre('All Genres');
    setStatusFilter('all');
    setSearchQuery('');
  };

  return (
    <main
      className={`min-h-screen ${themeStyles.bg} text-slate-100 transition-colors duration-300 pb-20 px-3 sm:px-6 w-full max-w-full overflow-x-hidden box-border relative rounded-3xl`}
    >
      <AppWallpaper />
      <div
        className={`absolute inset-x-0 -top-12 h-96 bg-gradient-to-b ${themeStyles.ambient} blur-3xl z-0 pointer-events-none rounded-t-3xl`}
      />

      <header className="py-5 max-w-7xl mx-auto space-y-4 box-border relative z-10">
        {/* Top Row: Neon Glass Back to Home Capsule + Fast Filter Reset */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <Link
            to="/"
            className="group inline-flex items-center gap-3 rounded-full bg-slate-900/80 hover:bg-slate-900/95 backdrop-blur-xl pl-4 pr-2 py-1.5 border border-white/15 hover:border-purple-400/60 shadow-[0_4px_20px_rgba(0,0,0,0.6)] hover:shadow-[0_0_20px_rgba(168,85,247,0.35)] transition-all duration-300 transform active:scale-95 focus:outline-none focus:ring-4 focus:ring-purple-500/50"
          >
            <span className="text-slate-400 group-hover:text-white group-hover:-translate-x-0.5 transition-all text-xs font-bold">
              ‹
            </span>
            <span className="text-xs sm:text-sm font-semibold tracking-wide text-slate-100 group-hover:text-white">
              Back to Home
            </span>
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-tr from-purple-600/50 via-pink-500/40 to-cyan-400/50 border border-purple-300/50 text-[11px] text-white shadow-[0_0_12px_rgba(217,70,239,0.7)]">
              ⟲
            </span>
          </Link>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetAllFilters}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 px-3.5 py-1.5 text-xs font-bold text-white shadow transition cursor-pointer"
            >
              <span>✕ Reset All Filters</span>
            </button>
          )}
        </div>

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
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                  Live TV & Sports
                </h1>
                <p className="text-xs sm:text-sm text-slate-400">
                  Instant broadcast feeds with real-time background health radar
                </p>
              </div>
            </div>

            {/* Quick Channel Search + Non-Blocking Health Refresh Button */}
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 w-full md:w-auto">
              <div className="relative flex-1 sm:w-56">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">
                  🔍
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter channel name..."
                  className="w-full h-10 rounded-xl border border-white/15 bg-black/70 pl-8 pr-7 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
                  >
                    ✕
                  </button>
                )}
              </div>

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
                    ? `Scanning (${probeProgress.done}/${probeProgress.total})`
                    : 'Refresh Health'}
                </span>
              </button>
            </div>
          </div>

          {/* 1. STREAM HEALTH STATUS FILTER BAR (All / Online / Questionable Timeout / Offline) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-1">
              <p className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest">
                1. Filter by Stream Status (Tap active to reset to All)
              </p>
              {probing && (
                <span className="text-[11px] font-bold text-amber-300 animate-pulse">
                  ⚡ Fast background check running…
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-0.5">
              {/* All Statuses Button */}
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

              {/* Online Only Button */}
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

              {/* Questionable / Timeout Button */}
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
                  <span>Timeout / ?</span>
                </span>
                <span className="rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-black text-amber-200">
                  {statusCounts.timeout + statusCounts.checking}
                </span>
              </button>

              {/* Offline Only Button */}
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

          {/* 2. REGIONS & FEEDS BAR (Deduplicated with single "All" option) */}
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
            />
          </div>

          {/* 3. CATEGORIES & GENRES BAR (With "All Genres" option) */}
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
            />
          </div>
        </div>
      </header>

      {/* Main Channels Section */}
      <div className="max-w-7xl mx-auto box-border relative z-10 space-y-5">
        {/* Section Title & Live Telemetry Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-1">
          <div className="flex items-center gap-2.5">
            <span className={`w-1.5 h-6 rounded-full ${themeStyles.accentBar}`} />
            <h3 className="text-lg sm:text-xl font-black tracking-tight text-white">
              {selectedGenre !== 'All Genres' ? selectedGenre : selectedCategory}{' '}
              {statusFilter === 'online'
                ? '• Online Feeds'
                : statusFilter === 'timeout'
                  ? '• Questionable / Timeout Feeds'
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
              <span>{statusCounts.timeout + statusCounts.checking} timeout/?</span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-950/70 border border-red-500/30 px-3 py-1 text-red-300">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              <span>{statusCounts.offline} offline</span>
            </span>
            <span
              className={`rounded-full bg-white/[0.06] border border-white/10 px-3 py-1 ${themeStyles.accentText}`}
            >
              {finalFilteredChannels.length} matching
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
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5 sm:gap-4">
              {paginatedChannels.map((channel) => {
                const key = getChannelKey(channel);
                return (
                  <ChannelCard
                    key={key}
                    channel={channel}
                    status={resolveChannelStatus(channel)}
                    laserLineClass={themeStyles.laserLine}
                    playBtnClass={themeStyles.playBtn}
                    borderHoverClass={themeStyles.borderHover}
                  />
                );
              })}
            </div>

            {/* Pagination Deck for 1GB-2GB RAM Optimization */}
            {totalPages > 1 && (
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3 rounded-2xl bg-slate-950/85 border border-white/15 backdrop-blur-xl p-3.5 mx-auto w-full max-w-md shadow-2xl">
                <button
                  type="button"
                  onClick={() => {
                    setCurrentPage((p) => Math.max(1, p - 1));
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  disabled={currentPage <= 1}
                  className="rounded-xl bg-white/10 hover:bg-white/20 px-4 py-2 text-xs font-extrabold text-white transition disabled:opacity-40 cursor-pointer"
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
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  disabled={currentPage >= totalPages}
                  className={`rounded-xl px-4 py-2 text-xs font-extrabold shadow transition disabled:opacity-40 cursor-pointer ${getPrimaryBgColor(
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
              No channels match this exact status or filter combination.
            </p>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Try switching the Stream Status filter to{' '}
              <strong className="text-white">All Channels</strong> or{' '}
              <strong className="text-amber-300">Timeout / ?</strong>, or reset your
              region and genre filters.
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
      </div>
    </main>
  );
}
