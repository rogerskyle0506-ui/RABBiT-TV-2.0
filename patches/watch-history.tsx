// patches/watch-history.tsx (copied to src/routes/watch-history.tsx during build)
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  AppTheme,
  CardSize,
  HistoryScale,
  PosterAppearanceClasses,
  getSavedTheme,
  getSavedCardSize,
  getHistoryOverscale,
  getLargeButtons,
  getPosterAppearanceClasses,
  getOptimalTmdbImageWidth,
  getHardwareLimits,
  getReducedMotion,
  getGlowIntensity,
  getClockFormat,
  formatAppTime,
  isFavoriteChannel,
  toggleFavoriteChannel,
  MAX_FAVORITE_CHANNELS,
} from "@/lib/settings";
import {
  getWatchHistory,
  markEpisodeCompleted,
  markEntireShowCompleted,
  removeFromWatchHistory,
  calculateSeriesProgress,
  getNextUnwatchedEpisode,
  getDislikedTitles,
  removeDislikedTitle,
  dislikeTitle,
  getRecentLiveChannels,
  removeRecentLiveChannel,
  getWatchActivityStats,
  clearWatchHistoryScope,
  exportWatchHistorySnapshot,
  type ShowWatchHistory,
  type DislikedTitle,
  type RecentLiveChannel,
  type WatchActivityStats,
  type ClearHistoryScope,
} from "@/lib/watch-history";
import { AppWallpaper } from "@/components/AppWallpaper";

export const Route = createFileRoute("/watch-history")({
  component: WatchHistoryComponent,
});

type ActivityTab =
  | "all"
  | "in_progress"
  | "movies"
  | "tv"
  | "live"
  | "completed"
  | "disliked";

type ActivitySort = "recent" | "progress" | "az";

function resolvePosterSrc(
  path: string | null | undefined,
  width: "w342" | "w500"
): string | null {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return width === "w342"
      ? path.replace("image.tmdb.org/t/p/w500", "image.tmdb.org/t/p/w342")
      : path;
  }
  return `https://image.tmdb.org/t/p/${width}${path}`;
}

function formatWatchedAgo(timestamp: number, clockFormat: "12h" | "24h"): string {
  if (!timestamp) return "Recently";
  const diffMin = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago • ${formatAppTime(timestamp, clockFormat)}`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(timestamp).toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
}

function WatchHistoryComponent() {
  const [historyMap, setHistoryMap] = useState<
    Record<string, ShowWatchHistory>
  >({});
  const [recentLiveChannels, setRecentLiveChannels] = useState<
    RecentLiveChannel[]
  >([]);
  const [dislikedTitles, setDislikedTitles] = useState<DislikedTitle[]>([]);
  const [stats, setStats] = useState<WatchActivityStats>(() =>
    getWatchActivityStats()
  );

  // Interactive Filters & Management UI State
  const [activeTab, setActiveTab] = useState<ActivityTab>("all");
  const [sortBy, setSortBy] = useState<ActivitySort>("recent");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  const [verifyingTarget, setVerifyingTarget] = useState<{
    showId: string;
    episodeId: string;
    title: string;
  } | null>(null);

  const [confirmClearScope, setConfirmClearScope] = useState<{
    scope: ClearHistoryScope;
    label: string;
  } | null>(null);

  // Live Settings from settings.ts
  const [appTheme, setAppTheme] = useState<AppTheme>(() => getSavedTheme());
  const [cardSize, setCardSize] = useState<CardSize>(() => getSavedCardSize());
  const [historyOverscale, setHistoryOverscale] = useState<HistoryScale>(() =>
    getHistoryOverscale()
  );
  const [largeButtons, setLargeButtons] = useState<boolean>(() =>
    getLargeButtons()
  );
  const [posterAppearance, setPosterAppearance] =
    useState<PosterAppearanceClasses>(() =>
      getPosterAppearanceClasses(getSavedTheme())
    );
  const [posterWidth, setPosterWidth] = useState<"w342" | "w500">(() =>
    getOptimalTmdbImageWidth()
  );
  const [reducedMotion, setReducedMotion] = useState<boolean>(() =>
    getReducedMotion()
  );
  const [glowOff, setGlowOff] = useState<boolean>(
    () => getGlowIntensity() === "off"
  );
  const [isLowRam, setIsLowRam] = useState<boolean>(
    () => getHardwareLimits().effectiveMode === "low"
  );
  const [clockFormat, setClockFormat] = useState(() => getClockFormat());

  const [canScrollDown, setCanScrollDown] = useState(false);
  const [showScrollReminder, setShowScrollReminder] = useState(false);

  const tickingRef = useRef(false);

  const showTempBanner = useCallback((msg: string) => {
    setStatusBanner(msg);
    window.setTimeout(() => setStatusBanner(null), 3000);
  }, []);

  const refreshData = useCallback(() => {
    const nextTheme = getSavedTheme();
    setHistoryMap({ ...getWatchHistory() });
    setRecentLiveChannels([...getRecentLiveChannels()]);
    setDislikedTitles([...getDislikedTitles()]);
    setStats(getWatchActivityStats());
    setAppTheme(nextTheme);
    setCardSize(getSavedCardSize());
    setHistoryOverscale(getHistoryOverscale());
    setLargeButtons(getLargeButtons());
    setPosterAppearance(getPosterAppearanceClasses(nextTheme));
    setPosterWidth(getOptimalTmdbImageWidth());
    setReducedMotion(getReducedMotion());
    setGlowOff(getGlowIntensity() === "off");
    setIsLowRam(getHardwareLimits().effectiveMode === "low");
    setClockFormat(getClockFormat());
  }, []);

  useEffect(() => {
    refreshData();
    window.addEventListener("rabtv_watch_history_updated", refreshData);
    window.addEventListener("rabtv_disliked_updated", refreshData);
    window.addEventListener("rabtv_settings_updated", refreshData);
    window.addEventListener("rabtv_ram_mode_updated", refreshData);
    return () => {
      window.removeEventListener("rabtv_watch_history_updated", refreshData);
      window.removeEventListener("rabtv_disliked_updated", refreshData);
      window.removeEventListener("rabtv_settings_updated", refreshData);
      window.removeEventListener("rabtv_ram_mode_updated", refreshData);
    };
  }, [refreshData]);

  // Escape closes confirmation modals cleanly on TV remotes / keyboards
  useEffect(() => {
    if (!verifyingTarget && !confirmClearScope) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setVerifyingTarget(null);
        setConfirmClearScope(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [verifyingTarget, confirmClearScope]);

  useEffect(() => {
    const checkVerticalScroll = () => {
      if (!tickingRef.current) {
        window.requestAnimationFrame(() => {
          const scrollTop =
            window.scrollY || document.documentElement.scrollTop;
          const scrollHeight = document.documentElement.scrollHeight;
          const clientHeight = window.innerHeight;
          setCanScrollDown(scrollTop + clientHeight < scrollHeight - 80);
          tickingRef.current = false;
        });
        tickingRef.current = true;
      }
    };

    checkVerticalScroll();
    window.addEventListener("scroll", checkVerticalScroll, { passive: true });
    window.addEventListener("resize", checkVerticalScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", checkVerticalScroll);
      window.removeEventListener("resize", checkVerticalScroll);
    };
  }, [historyMap, recentLiveChannels, dislikedTitles, activeTab]);

  useEffect(() => {
    let inactivityTimer: ReturnType<typeof setTimeout>;
    const resetInactivityTimer = () => {
      clearTimeout(inactivityTimer);
      setShowScrollReminder(false);
      if (canScrollDown && !reducedMotion) {
        inactivityTimer = setTimeout(() => {
          setShowScrollReminder(true);
        }, 30000);
      }
    };

    resetInactivityTimer();
    window.addEventListener("scroll", resetInactivityTimer, { passive: true });
    window.addEventListener("click", resetInactivityTimer);
    window.addEventListener("keydown", resetInactivityTimer);
    window.addEventListener("touchstart", resetInactivityTimer, {
      passive: true,
    });
    return () => {
      clearTimeout(inactivityTimer);
      window.removeEventListener("scroll", resetInactivityTimer);
      window.removeEventListener("click", resetInactivityTimer);
      window.removeEventListener("keydown", resetInactivityTimer);
      window.removeEventListener("touchstart", resetInactivityTimer);
    };
  }, [canScrollDown, reducedMotion]);

  const handleEyeballClick = useCallback(
    (
      showId: string,
      episodeId: string,
      episodeTitle: string,
      isCompleted: boolean
    ) => {
      if (!isCompleted) {
        setVerifyingTarget({ showId, episodeId, title: episodeTitle });
      } else {
        markEpisodeCompleted(showId, episodeId, false);
        refreshData();
      }
    },
    [refreshData]
  );

  const handleConfirmModal = (completed: boolean) => {
    if (verifyingTarget) {
      markEpisodeCompleted(
        verifyingTarget.showId,
        verifyingTarget.episodeId,
        completed
      );
      setVerifyingTarget(null);
      refreshData();
    }
  };

  const handleExecuteClearScope = () => {
    if (!confirmClearScope) return;
    clearWatchHistoryScope(confirmClearScope.scope);
    showTempBanner(`✓ ${confirmClearScope.label} completed.`);
    setConfirmClearScope(null);
    refreshData();
  };

  const handleExportActivity = () => {
    const snapshot = exportWatchHistorySnapshot();
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rabtv_watch_history_${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showTempBanner("💾 Watch history backup exported!");
  };

  const handlePinLiveChannel = (channel: RecentLiveChannel) => {
    const res = toggleFavoriteChannel(channel.channelId);
    if (res.limitReached) {
      showTempBanner(
        `Max ${MAX_FAVORITE_CHANNELS} pinned channels reached — unpin one first.`
      );
    } else {
      showTempBanner(
        res.added
          ? `⭐ Pinned "${channel.title}" to Live TV Favorites!`
          : `Removed "${channel.title}" from Favorites.`
      );
    }
    refreshData();
  };

  const themeTokens = useMemo(() => {
    switch (appTheme) {
      case "red":
        return {
          pageBg: "bg-gradient-to-br from-zinc-950/85 via-red-950/40 to-black/95",
          accentText: "text-red-400",
          accentBar: "bg-red-500 shadow-[0_0_14px_rgba(239,68,68,0.95)]",
          badgeBg: "bg-red-950/70 border-red-500/30 text-red-300",
          ambient: "from-red-600/12 via-transparent to-transparent",
          glowBorder:
            "border-red-500/30 shadow-[0_12px_36px_rgba(239,68,68,0.18)]",
          btnActive:
            "bg-gradient-to-r from-red-600 via-rose-600 to-orange-600 text-white shadow-lg",
          laser: "from-transparent via-red-500 to-amber-400",
          arrow: "text-red-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.8)]",
        };
      case "midnight":
        return {
          pageBg:
            "bg-gradient-to-br from-slate-950/85 via-blue-950/40 to-slate-950/95",
          accentText: "text-sky-300",
          accentBar: "bg-sky-400 shadow-[0_0_14px_rgba(56,189,248,0.95)]",
          badgeBg: "bg-blue-950/70 border-blue-500/30 text-sky-300",
          ambient: "from-blue-600/12 via-transparent to-transparent",
          glowBorder:
            "border-blue-500/30 shadow-[0_12px_36px_rgba(59,130,246,0.18)]",
          btnActive:
            "bg-gradient-to-r from-blue-600 via-cyan-600 to-sky-600 text-white shadow-lg",
          laser: "from-transparent via-sky-400 to-blue-500",
          arrow: "text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.8)]",
        };
      case "emerald":
        return {
          pageBg:
            "bg-gradient-to-br from-slate-950/85 via-emerald-950/40 to-slate-950/95",
          accentText: "text-emerald-300",
          accentBar: "bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.95)]",
          badgeBg: "bg-emerald-950/70 border-emerald-500/30 text-emerald-300",
          ambient: "from-emerald-600/12 via-transparent to-transparent",
          glowBorder:
            "border-emerald-500/30 shadow-[0_12px_36px_rgba(16,185,129,0.18)]",
          btnActive:
            "bg-gradient-to-r from-emerald-600 via-teal-600 to-green-600 text-white shadow-lg",
          laser: "from-transparent via-emerald-400 to-cyan-400",
          arrow: "text-emerald-300 drop-shadow-[0_0_8px_rgba(110,231,183,0.8)]",
        };
      case "amber":
        return {
          pageBg:
            "bg-gradient-to-br from-stone-950/85 via-yellow-950/40 to-neutral-950/95",
          accentText: "text-amber-300",
          accentBar: "bg-amber-400 shadow-[0_0_14px_rgba(251,191,36,0.95)]",
          badgeBg: "bg-amber-950/70 border-amber-500/30 text-amber-300",
          ambient: "from-amber-600/12 via-transparent to-transparent",
          glowBorder:
            "border-amber-500/30 shadow-[0_12px_36px_rgba(245,158,11,0.18)]",
          btnActive:
            "bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 text-white shadow-lg",
          laser: "from-transparent via-amber-400 to-orange-500",
          arrow: "text-amber-300 drop-shadow-[0_0_8px_rgba(252,211,77,0.8)]",
        };
      case "cyan":
        return {
          pageBg:
            "bg-gradient-to-br from-slate-950/85 via-cyan-950/40 to-slate-950/95",
          accentText: "text-cyan-300",
          accentBar: "bg-cyan-400 shadow-[0_0_14px_rgba(34,211,238,0.95)]",
          badgeBg: "bg-cyan-950/70 border-cyan-500/30 text-cyan-300",
          ambient: "from-cyan-600/12 via-transparent to-transparent",
          glowBorder:
            "border-cyan-500/30 shadow-[0_12px_36px_rgba(6,182,212,0.18)]",
          btnActive:
            "bg-gradient-to-r from-cyan-600 via-teal-600 to-blue-600 text-white shadow-lg",
          laser: "from-transparent via-cyan-400 to-sky-500",
          arrow: "text-cyan-300 drop-shadow-[0_0_8px_rgba(103,232,249,0.8)]",
        };
      case "violet":
      default:
        return {
          pageBg:
            "bg-gradient-to-br from-slate-950/85 via-purple-950/40 to-slate-950/95",
          accentText: "text-violet-300",
          accentBar: "bg-violet-500 shadow-[0_0_14px_rgba(139,92,246,0.95)]",
          badgeBg: "bg-purple-950/70 border-violet-500/30 text-violet-300",
          ambient: "from-violet-600/12 via-transparent to-transparent",
          glowBorder:
            "border-violet-500/30 shadow-[0_12px_36px_rgba(139,92,246,0.18)]",
          btnActive:
            "bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 text-white shadow-lg",
          laser: "from-transparent via-pink-500 to-cyan-400",
          arrow: "text-purple-400 drop-shadow-[0_0_8px_rgba(192,132,252,0.8)]",
        };
    }
  }, [appTheme]);

  const gridColsClass = useMemo(() => {
    let reductionOffset = 0;
    if (historyOverscale === "20%") reductionOffset = 1;
    if (historyOverscale === "50%") reductionOffset = 2;
    if (historyOverscale === "80%") reductionOffset = 3;

    switch (cardSize) {
      case "small":
        return reductionOffset >= 3
          ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
          : reductionOffset >= 2
            ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6"
            : "grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7";
      case "medium":
        return reductionOffset >= 2
          ? "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
          : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6";
      case "large":
      default:
        return reductionOffset >= 2
          ? "grid-cols-1 sm:grid-cols-2 md:grid-cols-3"
          : "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5";
    }
  }, [cardSize, historyOverscale]);

  // Filter + sort entries according to active search & sort controls
  const {
    allEntries,
    inProgressMovies,
    completedMovies,
    inProgressShows,
    completedShows,
    filteredLive,
    filteredDisliked,
  } = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const sortEntries = (list: ShowWatchHistory[]) =>
      [...list].sort((a, b) => {
        if (sortBy === "az") return a.title.localeCompare(b.title);
        if (sortBy === "progress") {
          return calculateSeriesProgress(b) - calculateSeriesProgress(a);
        }
        return (b.lastWatchedAt || 0) - (a.lastWatchedAt || 0);
      });

    const entries = sortEntries(
      Object.values(historyMap).filter((item) =>
        q ? item.title.toLowerCase().includes(q) : true
      )
    );

    const shows = entries.filter((item) => item.mediaType === "tv");
    const movs = entries.filter((item) => item.mediaType === "movie");

    const live = recentLiveChannels.filter((c) =>
      q ? c.title.toLowerCase().includes(q) : true
    );
    const disliked = dislikedTitles.filter((d) =>
      q ? (d.title || "").toLowerCase().includes(q) : true
    );

    return {
      allEntries: entries,
      inProgressMovies: movs.filter((m) => calculateSeriesProgress(m) < 100),
      completedMovies: movs.filter((m) => calculateSeriesProgress(m) >= 100),
      inProgressShows: shows.filter((s) => calculateSeriesProgress(s) < 100),
      completedShows: shows.filter((s) => calculateSeriesProgress(s) >= 100),
      filteredLive: live,
      filteredDisliked: disliked,
    };
  }, [historyMap, recentLiveChannels, dislikedTitles, searchQuery, sortBy]);

  const showLiveSection =
    (activeTab === "all" || activeTab === "live") && filteredLive.length > 0;
  const showInProgressMovies =
    (activeTab === "all" ||
      activeTab === "in_progress" ||
      activeTab === "movies") &&
    inProgressMovies.length > 0;
  const showInProgressShows =
    (activeTab === "all" ||
      activeTab === "in_progress" ||
      activeTab === "tv") &&
    inProgressShows.length > 0;
  const showCompletedSection =
    (activeTab === "all" ||
      activeTab === "completed" ||
      activeTab === "movies" ||
      activeTab === "tv") &&
    ((activeTab !== "tv" && completedMovies.length > 0) ||
      (activeTab !== "movies" && completedShows.length > 0));
  const showDislikedSection =
    (activeTab === "all" || activeTab === "disliked") &&
    filteredDisliked.length > 0;

  const hasVisibleContent =
    showLiveSection ||
    showInProgressMovies ||
    showInProgressShows ||
    showCompletedSection ||
    showDislikedSection;

  const iconBtnClass = largeButtons ? "h-8 w-8 text-xs" : "h-6 w-6 text-[11px]";

  return (
    <div
      className={`min-h-screen w-full ${themeTokens.pageBg} p-3 sm:p-6 md:p-10 text-white space-y-6 transition-colors duration-300 pb-20 overflow-x-hidden relative rounded-3xl`}
    >
      <AppWallpaper />
      {!isLowRam && !reducedMotion && !glowOff && (
        <div
          className={`absolute inset-x-0 -top-12 h-96 bg-gradient-to-b ${themeTokens.ambient} blur-3xl z-0 pointer-events-none rounded-t-3xl`}
        />
      )}

      <div className="relative z-10 max-w-7xl mx-auto space-y-6">
        {/* Top Capsule Row: Back to Home + Quick Shortcuts */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/"
              className={`group inline-flex items-center gap-2.5 rounded-full bg-slate-900/80 hover:bg-slate-900/95 backdrop-blur-xl pl-3.5 pr-2 ${
                largeButtons ? "py-2.5" : "py-1.5"
              } border border-white/15 hover:border-purple-400/60 shadow-[0_4px_20px_rgba(0,0,0,0.6)] transition-all duration-300 active:scale-95`}
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

            <Link
              to="/"
              search={{ tab: "My List" }}
              className="inline-flex items-center gap-1.5 rounded-full bg-slate-900/70 hover:bg-slate-800 border border-white/15 px-3.5 py-1.5 text-xs font-bold text-slate-200 hover:text-white transition"
            >
              <span>🔖 My List</span>
            </Link>

            <Link
              to="/live-tv"
              className="inline-flex items-center gap-1.5 rounded-full bg-slate-900/70 hover:bg-slate-800 border border-white/15 px-3.5 py-1.5 text-xs font-bold text-slate-200 hover:text-white transition"
            >
              <span>📡 Live TV</span>
            </Link>
          </div>

          <button
            type="button"
            onClick={handleExportActivity}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 px-3.5 py-1.5 text-xs font-extrabold text-amber-300 hover:text-white transition cursor-pointer"
          >
            <span>💾 Export History JSON</span>
          </button>
        </div>

        {/* Status Feedback Toast */}
        {statusBanner && (
          <div className="rounded-2xl bg-emerald-950/85 border border-emerald-400/50 px-4 py-2 text-center text-xs font-extrabold text-emerald-200 shadow-lg">
            {statusBanner}
          </div>
        )}

        {/* Executive Watch Activity Dashboard & Filter Control Deck */}
        <div
          className={`rounded-3xl border bg-slate-950/85 ${
            isLowRam ? "" : "backdrop-blur-2xl"
          } p-4 sm:p-6 space-y-5 ${themeTokens.glowBorder}`}
        >
          {/* Header + Stats Pills */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div className="flex items-center gap-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-red-950 via-purple-900 to-black border border-white/20 shadow-[0_0_20px_rgba(168,85,247,0.35)] text-2xl">
                🕒
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                  Watch History & Activity Hub
                </h1>
                <p className="text-xs text-slate-400 font-medium">
                  Resume shows, track episodes, pin live channels & manage hidden titles
                  {stats.topGenreName && (
                    <>
                      {" "}
                      • Top Vibe:{" "}
                      <strong className={themeTokens.accentText}>
                        {stats.topGenreName}
                      </strong>
                    </>
                  )}
                </p>
              </div>
            </div>

            {/* Search + Sort Controls */}
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full md:w-auto">
              <div className="relative flex-1 sm:w-52">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">
                  🔍
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter history..."
                  className="w-full h-10 rounded-xl border border-white/15 bg-black/75 pl-8 pr-7 text-xs font-bold text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as ActivitySort)}
                aria-label="Sort watch history"
                className="h-10 rounded-xl border border-white/15 bg-black/75 px-3 text-xs font-bold text-white focus:outline-none cursor-pointer"
              >
                <option value="recent">🕒 Most Recent</option>
                <option value="progress">📊 Progress %</option>
                <option value="az">🔤 Title A–Z</option>
              </select>
            </div>
          </div>

          {/* 4-Card KPI Activity Telemetry Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            <div className="rounded-2xl bg-black/60 border border-white/10 p-3 space-y-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                ⏳ In Progress
              </span>
              <p className="text-lg sm:text-xl font-black text-amber-300">
                {stats.inProgressMovies + stats.inProgressShows}
              </p>
              <span className="text-[10px] text-slate-400">
                {stats.inProgressMovies} movies • {stats.inProgressShows} shows
              </span>
            </div>

            <div className="rounded-2xl bg-black/60 border border-white/10 p-3 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  ✓ Completed
                </span>
                <span className="text-[10px] font-black text-emerald-400">
                  {stats.completionRatePct}%
                </span>
              </div>
              <p className="text-lg sm:text-xl font-black text-emerald-300">
                {stats.totalCompleted}
              </p>
              <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-all duration-300"
                  style={{ width: `${Math.max(4, stats.completionRatePct)}%` }}
                />
              </div>
            </div>

            <div className="rounded-2xl bg-black/60 border border-white/10 p-3 space-y-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                🔴 Recent Live TV
              </span>
              <p className="text-lg sm:text-xl font-black text-red-400">
                {stats.recentLiveCount}
              </p>
              <span className="text-[10px] text-slate-400">
                Quick-resume channels
              </span>
            </div>

            <div className="rounded-2xl bg-black/60 border border-white/10 p-3 space-y-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                👎 Hidden / Disliked
              </span>
              <p className="text-lg sm:text-xl font-black text-slate-200">
                {stats.dislikedCount}
              </p>
              <span className="text-[10px] text-slate-400">
                Excluded from catalogs
              </span>
            </div>
          </div>

          {/* Interactive Activity Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
            {(
              [
                {
                  id: "all",
                  label: `✨ All (${
                    allEntries.length +
                    filteredLive.length +
                    filteredDisliked.length
                  })`,
                },
                {
                  id: "in_progress",
                  label: `⏳ In Progress (${
                    inProgressMovies.length + inProgressShows.length
                  })`,
                },
                {
                  id: "movies",
                  label: `🎬 Movies (${
                    inProgressMovies.length + completedMovies.length
                  })`,
                },
                {
                  id: "tv",
                  label: `📺 TV Shows (${
                    inProgressShows.length + completedShows.length
                  })`,
                },
                { id: "live", label: `🔴 Live TV (${filteredLive.length})` },
                {
                  id: "completed",
                  label: `✓ Completed (${
                    completedMovies.length + completedShows.length
                  })`,
                },
                {
                  id: "disliked",
                  label: `👎 Disliked (${filteredDisliked.length})`,
                },
              ] as { id: ActivityTab; label: string }[]
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`shrink-0 rounded-xl ${
                  largeButtons ? "px-4 py-2.5 text-xs" : "px-3 py-1.5 text-[11px]"
                } font-extrabold whitespace-nowrap transition cursor-pointer ${
                  activeTab === tab.id
                    ? themeTokens.btnActive
                    : "bg-black/65 border border-white/10 text-slate-300 hover:bg-white/10"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Quick Guide + Safe Bulk Cleanup Toolbar */}
          <div className="pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2.5 text-[11px] text-slate-300">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 bg-white/[0.04] border border-white/10 rounded-lg px-2 py-0.5">
                <strong>👁️</strong> Mark Watched
              </span>
              <span className="inline-flex items-center gap-1 bg-white/[0.04] border border-white/10 rounded-lg px-2 py-0.5">
                <strong className="text-amber-300">👎</strong> Hide Globally
              </span>
              <span className="inline-flex items-center gap-1 bg-white/[0.04] border border-white/10 rounded-lg px-2 py-0.5">
                <strong className="text-red-400">✕</strong> Remove
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {stats.totalCompleted > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setConfirmClearScope({
                      scope: "completed",
                      label: "Clear all completed titles",
                    })
                  }
                  className="rounded-lg bg-black/70 hover:bg-white/15 border border-white/15 px-2.5 py-1 text-[10px] font-bold text-emerald-300 transition cursor-pointer"
                >
                  🧹 Clear Completed
                </button>
              )}
              {stats.dislikedCount > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setConfirmClearScope({
                      scope: "disliked",
                      label: "Restore all disliked titles back to catalogs",
                    })
                  }
                  className="rounded-lg bg-black/70 hover:bg-white/15 border border-white/15 px-2.5 py-1 text-[10px] font-bold text-amber-300 transition cursor-pointer"
                >
                  ↺ Restore Disliked
                </button>
              )}
              {stats.totalTrackedMedia + stats.recentLiveCount > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setConfirmClearScope({
                      scope: "all",
                      label: "Wipe all watch history & activity",
                    })
                  }
                  className="rounded-lg bg-red-950/75 hover:bg-red-700 border border-red-500/40 px-2.5 py-1 text-[10px] font-extrabold text-red-200 hover:text-white transition cursor-pointer"
                >
                  🗑️ Clear All
                </button>
              )}
            </div>
          </div>
        </div>

        {/* MAIN ACTIVITY CONTENT */}
        {!hasVisibleContent ? (
          <div className="rounded-3xl border border-white/10 bg-slate-950/75 p-12 text-center text-slate-400 backdrop-blur-xl shadow-2xl space-y-2.5">
            <div className="text-3xl mb-1">🎬</div>
            <p className="text-base font-bold text-white">
              {searchQuery.trim()
                ? `No activity matches "${searchQuery.trim()}".`
                : "Nothing recorded in this section yet."}
            </p>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Start watching movies, shows, or live broadcasts and your progress
              will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="space-y-10">
            {/* 1. RECENTLY WATCHED LIVE TV */}
            {showLiveSection && (
              <section className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2.5">
                    <span className="w-1.5 h-6 rounded-full bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.9)]" />
                    <h2 className="text-base sm:text-lg font-black tracking-tight text-white uppercase">
                      🔴 Recently Watched Live TV
                    </h2>
                  </div>
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-red-950/60 border border-red-500/30 text-red-300">
                    Last {filteredLive.length}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 sm:gap-4 pt-1 items-start">
                  {filteredLive.map((channel) => {
                    const pinned = isFavoriteChannel(channel.channelId);
                    return (
                      <div
                        key={channel.channelId}
                        className={`group relative ${posterAppearance.radiusClass} border ${
                          pinned
                            ? "border-amber-400/50"
                            : "border-white/15 hover:border-red-500/60"
                        } bg-slate-950/88 backdrop-blur-xl p-3 shadow-xl hover:-translate-y-1 transition-all duration-300 text-center flex flex-col items-center justify-between overflow-hidden`}
                      >
                        <div className="w-full flex items-center justify-between gap-1 mb-2 z-10">
                          <button
                            type="button"
                            onClick={() => handlePinLiveChannel(channel)}
                            className={`flex items-center justify-center rounded-lg border transition font-bold shadow-md cursor-pointer ${iconBtnClass} ${
                              pinned
                                ? "bg-amber-500/25 border-amber-400/60 text-amber-300"
                                : "bg-black/80 border-white/15 text-slate-400 hover:text-amber-300"
                            }`}
                            title={
                              pinned
                                ? "Unpin from Favorites"
                                : "Pin to Live TV Favorites"
                            }
                          >
                            {pinned ? "★" : "☆"}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              removeRecentLiveChannel(channel.channelId);
                              refreshData();
                            }}
                            className={`flex items-center justify-center rounded-lg bg-black/80 text-red-300 border border-red-500/30 transition hover:bg-red-600 hover:text-white font-bold shadow-md cursor-pointer ${iconBtnClass}`}
                            title="Remove from history"
                          >
                            ✕
                          </button>
                        </div>

                        <Link
                          to="/live-player"
                          search={{
                            url: channel.streamUrl,
                            title: channel.title,
                            logo: channel.logo || "",
                            channelId: channel.channelId,
                          }}
                          className="w-full flex flex-col items-center"
                        >
                          <div className="w-full h-20 bg-black/70 rounded-xl mb-2 overflow-hidden flex items-center justify-center border border-white/10 p-2.5">
                            {channel.logo ? (
                              <img
                                src={channel.logo}
                                alt={channel.title}
                                className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                                loading="lazy"
                                decoding="async"
                              />
                            ) : (
                              <span className="text-xs font-black text-red-400 tracking-widest">
                                ● LIVE
                              </span>
                            )}
                          </div>
                          <span className="text-xs font-black line-clamp-1 text-white">
                            {channel.title}
                          </span>
                          <span className="text-[10px] text-slate-400 mt-0.5">
                            {formatWatchedAgo(channel.watchedAt, clockFormat)}
                          </span>
                          <span
                            className={`mt-2 w-full ${
                              largeButtons ? "py-2 text-xs" : "py-1.5 text-[10px]"
                            } font-extrabold uppercase tracking-wider rounded-xl bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-lg group-hover:brightness-110 transition`}
                          >
                            ▶ Resume Live
                          </span>
                        </Link>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* 2. MOVIES - IN PROGRESS */}
            {showInProgressMovies && (
              <section className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-1.5 h-6 rounded-full ${themeTokens.accentBar}`}
                    />
                    <h2 className="text-base sm:text-lg font-black tracking-tight text-white uppercase">
                      🎬 Movies — In Progress
                    </h2>
                  </div>
                  <span
                    className={`text-xs font-bold px-3 py-1 rounded-full border ${themeTokens.badgeBg}`}
                  >
                    {inProgressMovies.length}
                  </span>
                </div>

                <div
                  className={`grid ${gridColsClass} gap-3.5 sm:gap-5 pt-1 items-start`}
                >
                  {inProgressMovies.map((movie) => (
                    <MovieCard
                      key={movie.showId}
                      movie={movie}
                      posterAppearance={posterAppearance}
                      posterWidth={posterWidth}
                      largeButtons={largeButtons}
                      clockFormat={clockFormat}
                      laserClass={themeTokens.laser}
                      glowOff={glowOff}
                      onEyeballClick={handleEyeballClick}
                      onRemove={() => {
                        removeFromWatchHistory(movie.showId);
                        refreshData();
                      }}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* 3. TV SHOWS - IN PROGRESS */}
            {showInProgressShows && (
              <section className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2.5">
                    <span className="w-1.5 h-6 rounded-full bg-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.9)]" />
                    <h2 className="text-base sm:text-lg font-black tracking-tight text-white uppercase">
                      📺 TV Shows — In Progress
                    </h2>
                  </div>
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-blue-950/70 border border-blue-500/30 text-sky-300">
                    {inProgressShows.length}
                  </span>
                </div>

                <div
                  className={`grid ${gridColsClass} gap-3.5 sm:gap-5 pt-1 items-start`}
                >
                  {inProgressShows.map((show) => (
                    <TvShowCard
                      key={show.showId}
                      show={show}
                      posterAppearance={posterAppearance}
                      posterWidth={posterWidth}
                      largeButtons={largeButtons}
                      clockFormat={clockFormat}
                      laserClass={themeTokens.laser}
                      glowOff={glowOff}
                      onEyeballClick={handleEyeballClick}
                      onMarkAllDone={() => {
                        markEntireShowCompleted(show.showId, true);
                        showTempBanner(`✓ Marked "${show.title}" completed!`);
                        refreshData();
                      }}
                      onRemove={() => {
                        removeFromWatchHistory(show.showId);
                        refreshData();
                      }}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* 4. COMPLETED */}
            {showCompletedSection && (
              <section className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2.5">
                    <span className="w-1.5 h-6 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.9)]" />
                    <h2 className="text-base sm:text-lg font-black tracking-tight text-white uppercase">
                      ✓ Completed
                    </h2>
                  </div>
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-950/70 border border-emerald-500/30 text-emerald-300">
                    {(activeTab !== "tv" ? completedMovies.length : 0) +
                      (activeTab !== "movies" ? completedShows.length : 0)}
                  </span>
                </div>

                <div
                  className={`grid ${gridColsClass} gap-3.5 sm:gap-5 pt-1 items-start`}
                >
                  {activeTab !== "tv" &&
                    completedMovies.map((movie) => (
                      <MovieCard
                        key={movie.showId}
                        movie={movie}
                        posterAppearance={posterAppearance}
                        posterWidth={posterWidth}
                        largeButtons={largeButtons}
                        clockFormat={clockFormat}
                        laserClass={themeTokens.laser}
                        glowOff={glowOff}
                        onEyeballClick={handleEyeballClick}
                        onRemove={() => {
                          removeFromWatchHistory(movie.showId);
                          refreshData();
                        }}
                      />
                    ))}
                  {activeTab !== "movies" &&
                    completedShows.map((show) => (
                      <TvShowCard
                        key={show.showId}
                        show={show}
                        posterAppearance={posterAppearance}
                        posterWidth={posterWidth}
                        largeButtons={largeButtons}
                        clockFormat={clockFormat}
                        laserClass={themeTokens.laser}
                        glowOff={glowOff}
                        onEyeballClick={handleEyeballClick}
                        onMarkAllDone={() => {
                          markEntireShowCompleted(show.showId, false);
                          refreshData();
                        }}
                        onRemove={() => {
                          removeFromWatchHistory(show.showId);
                          refreshData();
                        }}
                      />
                    ))}
                </div>
              </section>
            )}

            {/* 5. DISLIKED / REMOVED */}
            {showDislikedSection && (
              <section className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2.5">
                    <span className="w-1.5 h-6 rounded-full bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.9)]" />
                    <h2 className="text-base sm:text-lg font-black tracking-tight text-white uppercase">
                      👎 Disliked / Hidden Globally
                    </h2>
                  </div>
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-red-950/60 border border-red-500/30 text-red-300">
                    {filteredDisliked.length}
                  </span>
                </div>

                <div
                  className={`grid ${gridColsClass} gap-3.5 sm:gap-4 pt-1 items-start`}
                >
                  {filteredDisliked.map((item) => (
                    <div
                      key={item.id}
                      className={`group relative ${posterAppearance.radiusClass} border border-red-500/25 bg-slate-950/85 backdrop-blur-xl overflow-hidden shadow-lg flex flex-col justify-between p-3.5 hover:border-red-500/50 transition`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-extrabold text-red-300 bg-red-950/70 border border-red-500/30 px-2 py-0.5 rounded-md uppercase">
                            {item.mediaType || "Media"}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              removeDislikedTitle(item.id);
                              showTempBanner(
                                `↺ Restored "${item.title || "Title"}" to catalogs.`
                              );
                              refreshData();
                            }}
                            className="inline-flex items-center gap-1 rounded-lg bg-white/10 hover:bg-emerald-600 text-slate-200 hover:text-white font-bold text-[10px] px-2.5 py-1 transition cursor-pointer"
                            title="Restore to Catalog"
                          >
                            <span>↺ Restore</span>
                          </button>
                        </div>
                        <h3
                          className="text-xs font-bold text-white truncate pt-0.5"
                          title={item.title}
                        >
                          {item.title}
                        </h3>
                      </div>
                      <span className="text-[9px] text-slate-400 pt-2 font-medium">
                        Hidden from recommendations & feeds
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {canScrollDown && showScrollReminder && (
          <div
            className="fixed bottom-4 left-0 right-0 z-50 flex items-center justify-center pointer-events-none animate-flash-twice"
            onAnimationEnd={() => setShowScrollReminder(false)}
          >
            <style>{`
              @keyframes flashTwice {
                0% { opacity: 0; }
                25% { opacity: 1; }
                50% { opacity: 0; }
                75% { opacity: 1; }
                100% { opacity: 0; }
              }
              .animate-flash-twice {
                animation: flashTwice 8s ease-in-out forwards;
              }
            `}</style>
            <div className="flex flex-col items-center gap-0.5 bg-black/35 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 shadow-2xl">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white">
                More History Below
              </span>
              <span
                className={`text-xl font-black animate-slow-glow ${themeTokens.arrow}`}
              >
                ⌄
              </span>
            </div>
          </div>
        )}

        {/* VERIFY COMPLETION MODAL */}
        {verifyingTarget && (
          <div className="rabtv-vidsrc-protected fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
            <div
              className={`w-full max-w-sm space-y-4 rounded-3xl border bg-slate-950/95 p-6 shadow-2xl text-center ${themeTokens.glowBorder}`}
            >
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 border border-white/10 text-3xl shadow-inner">
                👁️
              </div>
              <h3 className="text-lg font-black text-white">
                Verify Completion
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Did you finish watching{" "}
                <strong className={themeTokens.accentText}>
                  {verifyingTarget.title}
                </strong>
                ?
              </p>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => handleConfirmModal(true)}
                  className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 py-2.5 text-xs font-bold text-white shadow-lg transition cursor-pointer"
                >
                  Yes, Completed (✓)
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirmModal(false)}
                  className="rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 py-2.5 text-xs font-bold text-slate-200 transition cursor-pointer"
                >
                  Not Yet (?)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TV-SAFE BULK CLEAR CONFIRMATION MODAL */}
        {confirmClearScope && (
          <div className="rabtv-vidsrc-protected fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
            <div className="w-full max-w-sm space-y-4 rounded-3xl border-2 border-red-500/45 bg-slate-950/95 p-6 shadow-2xl text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-600/20 border border-red-400/40 text-3xl">
                🧹
              </div>
              <h3 className="text-lg font-black text-white">Confirm Action</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Are you sure you want to{" "}
                <strong className="text-amber-300">
                  {confirmClearScope.label}
                </strong>
                ? Your license, PIN, and saved My List will stay untouched.
              </p>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleExecuteClearScope}
                  className="rounded-xl bg-gradient-to-r from-red-600 to-orange-600 py-2.5 text-xs font-black text-white shadow-lg cursor-pointer"
                >
                  ✓ Confirm
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClearScope(null)}
                  className="rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 py-2.5 text-xs font-bold text-slate-200 cursor-pointer"
                >
                  ✕ Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const MovieCard = React.memo(function MovieCard({
  movie,
  posterAppearance,
  posterWidth,
  largeButtons,
  clockFormat,
  laserClass,
  glowOff,
  onEyeballClick,
  onRemove,
}: {
  movie: ShowWatchHistory;
  posterAppearance: PosterAppearanceClasses;
  posterWidth: "w342" | "w500";
  largeButtons: boolean;
  clockFormat: "12h" | "24h";
  laserClass: string;
  glowOff: boolean;
  onEyeballClick: (
    showId: string,
    episodeId: string,
    episodeTitle: string,
    isCompleted: boolean
  ) => void;
  onRemove: () => void;
}) {
  const navigate = useNavigate();
  const singleEp = Object.values(movie.episodes)[0] || {
    episodeId: `${movie.showId}-s1-e1`,
    title: movie.title,
    confirmedCompleted: false,
    progressPercent: 0,
    updatedAt: movie.lastWatchedAt,
  };
  const isCompleted = singleEp.confirmedCompleted;
  const posterUrl = resolvePosterSrc(movie.posterPath, posterWidth);

  const pillBtnClass = largeButtons
    ? "h-8 px-2.5 text-xs"
    : "h-6 px-1.5 text-[10px]";
  const iconBtnClass = largeButtons ? "h-8 w-8 text-xs" : "h-6 w-6 text-[10px]";

  return (
    <div className="w-full">
      <div
        className={`group relative ${posterAppearance.radiusClass} ${posterAppearance.cardFrameClass} overflow-hidden shadow-xl flex flex-col justify-between transition-all duration-300 hover:-translate-y-1.5`}
      >
        <div
          onClick={() =>
            navigate({
              to: "/details",
              search: { id: movie.showId, type: "movie" },
            })
          }
          className="relative aspect-[2/3] w-full overflow-hidden bg-black shrink-0 cursor-pointer"
        >
          {posterUrl ? (
            <img
              src={posterUrl}
              alt={movie.title}
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center p-2 text-center text-slate-500 text-xs font-bold">
              {movie.title}
            </div>
          )}

          <div className="absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-black/80 via-black/30 to-transparent pointer-events-none" />

          {/* Top-Left: Completion Toggle Pill */}
          <div
            className="absolute top-2 left-2 z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() =>
                onEyeballClick(
                  movie.showId,
                  singleEp.episodeId,
                  movie.title,
                  isCompleted
                )
              }
              className={`inline-flex items-center justify-center whitespace-nowrap rounded-lg backdrop-blur-md border transition hover:scale-105 focus:outline-none font-bold shadow-md cursor-pointer ${pillBtnClass} ${
                isCompleted
                  ? "bg-emerald-950/90 text-emerald-300 border-emerald-400/40"
                  : "bg-black/80 text-white border-white/20"
              }`}
              title="Toggle Watched Status"
            >
              {isCompleted ? "👁️ ✓" : "👁️ ?"}
            </button>
          </div>

          {/* Top-Right: Dislike & Remove Controls */}
          <div
            className="absolute top-2 right-2 flex items-center gap-1 z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() =>
                dislikeTitle({
                  id: movie.showId,
                  title: movie.title,
                  mediaType: "movie",
                  posterPath: movie.posterPath,
                })
              }
              className={`flex items-center justify-center rounded-lg bg-black/80 text-amber-300 backdrop-blur-md border border-amber-500/30 transition hover:bg-amber-600 hover:text-white font-bold shadow-md cursor-pointer ${iconBtnClass}`}
              title="Dislike & Hide Globally"
            >
              👎
            </button>
            <button
              type="button"
              onClick={onRemove}
              className={`flex items-center justify-center rounded-lg bg-black/80 text-red-300 backdrop-blur-md border border-red-500/30 transition hover:bg-red-600 hover:text-white font-bold shadow-md cursor-pointer ${iconBtnClass}`}
              title="Remove from history"
            >
              ✕
            </button>
          </div>

          {/* Bottom Poster Gradient Overlay */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/85 to-transparent pt-10 pb-2.5 px-3 z-10">
            <h3
              className="text-xs sm:text-sm font-bold truncate text-white drop-shadow"
              title={movie.title}
            >
              {movie.title}
            </h3>
            <div className="flex items-center justify-between gap-1 mt-0.5 text-[10px]">
              <span className="text-slate-300 font-semibold truncate">
                {formatWatchedAgo(movie.lastWatchedAt, clockFormat)}
              </span>
              <span
                className={`font-bold shrink-0 ${
                  isCompleted ? "text-emerald-400" : "text-amber-300"
                }`}
              >
                {isCompleted ? "✓ Done" : "In Progress"}
              </span>
            </div>
          </div>
        </div>

        {/* Direct Resume Playback Action Bar */}
        <div className="p-2 bg-slate-950/95 border-t border-white/10">
          <button
            type="button"
            onClick={() =>
              navigate({
                to: "/player",
                search: {
                  id: movie.showId,
                  type: "movie",
                  season: 1,
                  episode: 1,
                },
              })
            }
            className={`w-full rounded-xl bg-white/[0.07] hover:bg-white/[0.16] border border-white/10 ${
              largeButtons ? "py-2.5 text-xs" : "py-1.5 text-[10px]"
            } font-extrabold uppercase tracking-wider text-white transition cursor-pointer`}
          >
            {isCompleted ? "↻ Watch Again" : "▶ Resume Movie"}
          </button>
        </div>

        {posterAppearance.showLaserBar && !glowOff && (
          <div
            className={`absolute inset-x-3 bottom-0 h-[2px] bg-gradient-to-r ${laserClass} opacity-90 pointer-events-none`}
          />
        )}
      </div>
    </div>
  );
});

const TvShowCard = React.memo(function TvShowCard({
  show,
  posterAppearance,
  posterWidth,
  largeButtons,
  clockFormat,
  laserClass,
  glowOff,
  onEyeballClick,
  onMarkAllDone,
  onRemove,
}: {
  show: ShowWatchHistory;
  posterAppearance: PosterAppearanceClasses;
  posterWidth: "w342" | "w500";
  largeButtons: boolean;
  clockFormat: "12h" | "24h";
  laserClass: string;
  glowOff: boolean;
  onEyeballClick: (
    showId: string,
    episodeId: string,
    episodeTitle: string,
    isCompleted: boolean
  ) => void;
  onMarkAllDone: () => void;
  onRemove: () => void;
}) {
  const navigate = useNavigate();
  const progress = calculateSeriesProgress(show);
  const nextEp = useMemo(() => getNextUnwatchedEpisode(show), [show]);
  const episodesList = useMemo(
    () =>
      Object.values(show.episodes).sort((a, b) =>
        a.seasonNumber !== b.seasonNumber
          ? a.seasonNumber - b.seasonNumber
          : a.episodeNumber - b.episodeNumber
      ),
    [show.episodes]
  );
  const posterUrl = resolvePosterSrc(show.posterPath, posterWidth);
  const iconBtnClass = largeButtons ? "h-8 w-8 text-xs" : "h-6 w-6 text-[10px]";

  return (
    <div className="w-full">
      <div
        className={`group relative ${posterAppearance.radiusClass} ${posterAppearance.cardFrameClass} overflow-hidden shadow-xl flex flex-col justify-between transition-all duration-300 hover:-translate-y-1.5`}
      >
        <div
          onClick={() =>
            navigate({
              to: "/details",
              search: { id: show.showId, type: "tv" },
            })
          }
          className="relative aspect-[2/3] w-full overflow-hidden bg-black shrink-0 cursor-pointer"
        >
          {posterUrl ? (
            <img
              src={posterUrl}
              alt={show.title}
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center p-2 text-center text-slate-500 text-xs font-bold">
              {show.title}
            </div>
          )}

          <div className="absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-black/80 via-black/30 to-transparent pointer-events-none" />

          {/* Top-Left Series Badge */}
          <div className="absolute top-2 left-2 z-10 pointer-events-none">
            <span className="rounded-lg bg-black/80 backdrop-blur-md border border-white/15 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-sky-300">
              Series
            </span>
          </div>

          {/* Top-Right Dislike & Remove Controls */}
          <div
            className="absolute top-2 right-2 flex items-center gap-1 z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() =>
                dislikeTitle({
                  id: show.showId,
                  title: show.title,
                  mediaType: "tv",
                  posterPath: show.posterPath,
                })
              }
              className={`flex items-center justify-center rounded-lg bg-black/80 text-amber-300 backdrop-blur-md border border-amber-500/30 transition hover:bg-amber-600 hover:text-white font-bold shadow-md cursor-pointer ${iconBtnClass}`}
              title="Dislike & Hide Globally"
            >
              👎
            </button>
            <button
              type="button"
              onClick={onRemove}
              className={`flex items-center justify-center rounded-lg bg-black/80 text-red-300 backdrop-blur-md border border-red-500/30 transition hover:bg-red-600 hover:text-white font-bold shadow-md cursor-pointer ${iconBtnClass}`}
              title="Remove from history"
            >
              ✕
            </button>
          </div>

          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/80 to-transparent pt-10 pb-2 px-3 z-10">
            <h3
              className="text-xs sm:text-sm font-bold truncate text-white drop-shadow"
              title={show.title}
            >
              {show.title}
            </h3>
            <span className="block text-[9px] text-slate-300 font-semibold mt-0.5">
              {formatWatchedAgo(show.lastWatchedAt, clockFormat)}
            </span>
          </div>
        </div>

        <div className="p-2.5 sm:p-3 space-y-2.5 bg-slate-950/95 border-t border-white/10 shrink-0">
          {/* Smart Direct Resume / Next Episode Launcher */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() =>
                navigate({
                  to: "/player",
                  search: {
                    id: show.showId,
                    type: "tv",
                    season: nextEp.seasonNumber,
                    episode: nextEp.episodeNumber,
                  },
                })
              }
              className={`flex-1 rounded-xl bg-white/[0.08] hover:bg-white/[0.18] border border-white/15 ${
                largeButtons ? "py-2 text-xs" : "py-1.5 text-[10px]"
              } font-extrabold uppercase tracking-wider text-white transition cursor-pointer truncate px-2`}
            >
              ▶ Play {nextEp.label}
            </button>

            <button
              type="button"
              onClick={onMarkAllDone}
              className={`shrink-0 rounded-xl border px-2 ${
                largeButtons ? "py-2 text-xs" : "py-1.5 text-[10px]"
              } font-extrabold transition cursor-pointer ${
                progress >= 100
                  ? "bg-emerald-950/80 border-emerald-400/40 text-emerald-300"
                  : "bg-black/70 border-white/15 text-slate-300 hover:text-emerald-300"
              }`}
              title={
                progress >= 100
                  ? "Reset show progress"
                  : "Mark all tracked episodes completed"
              }
            >
              {progress >= 100 ? "↺" : "✓ All"}
            </button>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] font-bold text-slate-300">
              <span className="truncate">
                Progress ({episodesList.length} ep
                {episodesList.length === 1 ? "" : "s"})
              </span>
              <span
                className={
                  progress >= 100 ? "text-emerald-400" : "text-amber-300"
                }
              >
                {progress}%
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden border border-white/5">
              <div
                className={`h-full transition-all duration-300 ${
                  progress >= 100
                    ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"
                    : "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]"
                }`}
                style={{ width: `${Math.max(4, progress)}%` }}
              />
            </div>
          </div>

          <div className="space-y-1 max-h-28 overflow-y-auto scrollbar-none">
            {episodesList.map((ep) => (
              <EpisodeRow
                key={ep.episodeId}
                episode={ep}
                largeButtons={largeButtons}
                onPlayEpisode={() =>
                  navigate({
                    to: "/player",
                    search: {
                      id: show.showId,
                      type: "tv",
                      season: ep.seasonNumber,
                      episode: ep.episodeNumber,
                    },
                  })
                }
                onEyeballClick={() =>
                  onEyeballClick(
                    show.showId,
                    ep.episodeId,
                    `${show.title} • S${ep.seasonNumber}E${ep.episodeNumber}`,
                    ep.confirmedCompleted
                  )
                }
              />
            ))}
          </div>
        </div>

        {posterAppearance.showLaserBar && !glowOff && (
          <div
            className={`absolute inset-x-3 bottom-0 h-[2px] bg-gradient-to-r ${laserClass} opacity-90 pointer-events-none`}
          />
        )}
      </div>
    </div>
  );
});

const EpisodeRow = React.memo(function EpisodeRow({
  episode,
  largeButtons,
  onPlayEpisode,
  onEyeballClick,
}: {
  episode: {
    episodeId: string;
    seasonNumber: number;
    episodeNumber: number;
    title: string;
    confirmedCompleted: boolean;
  };
  largeButtons: boolean;
  onPlayEpisode: () => void;
  onEyeballClick: () => void;
}) {
  const rowBtnClass = largeButtons
    ? "h-6 px-2 text-[10px]"
    : "h-5 px-1.5 text-[9px]";

  return (
    <div className="flex items-center justify-between gap-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.09] px-2 py-1 border border-white/10 text-[11px] transition">
      <button
        type="button"
        onClick={onPlayEpisode}
        className="font-bold text-slate-200 hover:text-cyan-300 whitespace-nowrap truncate text-left cursor-pointer"
        title={`Play S${episode.seasonNumber}E${episode.episodeNumber}`}
      >
        ▶ S{episode.seasonNumber}E{episode.episodeNumber}
      </button>

      <button
        type="button"
        onClick={onEyeballClick}
        className={`shrink-0 inline-flex items-center justify-center whitespace-nowrap rounded-md border transition hover:scale-105 focus:outline-none font-bold cursor-pointer ${rowBtnClass} ${
          episode.confirmedCompleted
            ? "bg-emerald-950/90 text-emerald-300 border-emerald-400/40"
            : "bg-black/80 text-white border-white/20"
        }`}
        title={
          episode.confirmedCompleted
            ? "Marked Completed (Click to unmark)"
            : "Mark Episode Completed"
        }
        aria-label="Toggle Episode Status"
      >
        {episode.confirmedCompleted ? "👁️ ✓" : "👁️ ?"}
      </button>
    </div>
  );
});
