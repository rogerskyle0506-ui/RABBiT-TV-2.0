// src/routes/watch-history.tsx
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  AppTheme,
  CardSize,
  HistoryScale,
  getSavedTheme,
  getSavedCardSize,
  getHistoryOverscale,
  getLargeButtons,
} from "@/lib/settings";
import {
  getWatchHistory,
  markEpisodeCompleted,
  removeFromWatchHistory,
  calculateSeriesProgress,
  getDislikedTitles,
  removeDislikedTitle,
  dislikeTitle,
  getRecentLiveChannels,
  removeRecentLiveChannel,
  ShowWatchHistory,
  DislikedTitle,
  RecentLiveChannel,
} from "@/lib/watch-history";
import { AppWallpaper } from "@/components/AppWallpaper";

export const Route = createFileRoute("/watch-history")({
  component: WatchHistoryComponent,
});

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";
const BACK_TO_HOME =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/BackToHome.png";

function WatchHistoryComponent() {
  const [historyMap, setHistoryMap] = useState<Record<string, ShowWatchHistory>>({});
  const [recentLiveChannels, setRecentLiveChannels] = useState<RecentLiveChannel[]>([]);
  const [dislikedTitles, setDislikedTitles] = useState<DislikedTitle[]>([]);
  const [verifyingTarget, setVerifyingTarget] = useState<{
    showId: string;
    episodeId: string;
    title: string;
  } | null>(null);
  const [appTheme, setAppTheme] = useState<AppTheme>("violet");
  const [cardSize, setCardSize] = useState<CardSize>("large");
  const [historyOverscale, setHistoryOverscale] = useState<HistoryScale>("off");
  const [largeButtons, setLargeButtons] = useState<boolean>(true);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const [showScrollReminder, setShowScrollReminder] = useState(false);

  const tickingRef = useRef(false);

  useEffect(() => {
    const checkVerticalScroll = () => {
      if (!tickingRef.current) {
        window.requestAnimationFrame(() => {
          const scrollTop = window.scrollY || document.documentElement.scrollTop;
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
  }, [historyMap, recentLiveChannels, dislikedTitles]);

  useEffect(() => {
    let inactivityTimer: NodeJS.Timeout;

    const resetInactivityTimer = () => {
      clearTimeout(inactivityTimer);
      setShowScrollReminder(false);

      if (canScrollDown) {
        inactivityTimer = setTimeout(() => {
          setShowScrollReminder(true);
        }, 30000);
      }
    };

    resetInactivityTimer();

    window.addEventListener("scroll", resetInactivityTimer, { passive: true });
    window.addEventListener("click", resetInactivityTimer);
    window.addEventListener("keydown", resetInactivityTimer);
    window.addEventListener("touchstart", resetInactivityTimer, { passive: true });

    return () => {
      clearTimeout(inactivityTimer);
      window.removeEventListener("scroll", resetInactivityTimer);
      window.removeEventListener("click", resetInactivityTimer);
      window.removeEventListener("keydown", resetInactivityTimer);
      window.removeEventListener("touchstart", resetInactivityTimer);
    };
  }, [canScrollDown]);

  const refreshData = useCallback(() => {
    setHistoryMap({ ...getWatchHistory() });
    setRecentLiveChannels([...getRecentLiveChannels()]);
    setDislikedTitles([...getDislikedTitles()]);
    setAppTheme(getSavedTheme());
    setCardSize(getSavedCardSize());
    setHistoryOverscale(getHistoryOverscale());
    setLargeButtons(getLargeButtons());
  }, []);

  useEffect(() => {
    refreshData();
    window.addEventListener("rabtv_watch_history_updated", refreshData);
    window.addEventListener("rabtv_disliked_updated", refreshData);
    window.addEventListener("rabtv_settings_updated", refreshData as any);
    return () => {
      window.removeEventListener("rabtv_watch_history_updated", refreshData);
      window.removeEventListener("rabtv_disliked_updated", refreshData);
      window.removeEventListener("rabtv_settings_updated", refreshData as any);
    };
  }, [refreshData]);

  const handleEyeballClick = useCallback(
    (showId: string, episodeId: string, episodeTitle: string, isCompleted: boolean) => {
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
      markEpisodeCompleted(verifyingTarget.showId, verifyingTarget.episodeId, completed);
      setVerifyingTarget(null);
      refreshData();
    }
  };

  const getPageBackground = (theme: AppTheme) => {
    switch (theme) {
      case "red":
        return "bg-gradient-to-br from-zinc-950/85 via-red-950/40 to-black/95";
      case "midnight":
        return "bg-gradient-to-br from-slate-950/85 via-blue-950/40 to-slate-950/95";
      case "emerald":
        return "bg-gradient-to-br from-slate-950/85 via-emerald-950/40 to-slate-950/95";
      case "amber":
        return "bg-gradient-to-br from-stone-950/85 via-yellow-950/40 to-neutral-950/95";
      case "cyan":
        return "bg-gradient-to-br from-slate-950/85 via-cyan-950/40 to-slate-950/95";
      case "violet":
      default:
        return "bg-gradient-to-br from-slate-950/85 via-purple-950/40 to-slate-950/95";
    }
  };

  const getThemeTokens = (theme: AppTheme) => {
    switch (theme) {
      case "red":
        return {
          accentText: "text-red-400",
          accentBar: "bg-red-500 shadow-[0_0_14px_rgba(239,68,68,0.95)]",
          badgeBg: "bg-red-950/70 border-red-500/30 text-red-300",
          ambient: "from-red-600/12 via-transparent to-transparent",
          glowBorder: "border-red-500/25 shadow-[0_12px_36px_rgba(239,68,68,0.15)]",
        };
      case "midnight":
        return {
          accentText: "text-sky-300",
          accentBar: "bg-sky-400 shadow-[0_0_14px_rgba(56,189,248,0.95)]",
          badgeBg: "bg-blue-950/70 border-blue-500/30 text-sky-300",
          ambient: "from-blue-600/12 via-transparent to-transparent",
          glowBorder: "border-blue-500/25 shadow-[0_12px_36px_rgba(59,130,246,0.15)]",
        };
      case "emerald":
        return {
          accentText: "text-emerald-300",
          accentBar: "bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.95)]",
          badgeBg: "bg-emerald-950/70 border-emerald-500/30 text-emerald-300",
          ambient: "from-emerald-600/12 via-transparent to-transparent",
          glowBorder: "border-emerald-500/25 shadow-[0_12px_36px_rgba(16,185,129,0.15)]",
        };
      case "amber":
        return {
          accentText: "text-amber-300",
          accentBar: "bg-amber-400 shadow-[0_0_14px_rgba(251,191,36,0.95)]",
          badgeBg: "bg-amber-950/70 border-amber-500/30 text-amber-300",
          ambient: "from-amber-600/12 via-transparent to-transparent",
          glowBorder: "border-amber-500/25 shadow-[0_12px_36px_rgba(245,158,11,0.15)]",
        };
      case "cyan":
        return {
          accentText: "text-cyan-300",
          accentBar: "bg-cyan-400 shadow-[0_0_14px_rgba(34,211,238,0.95)]",
          badgeBg: "bg-cyan-950/70 border-cyan-500/30 text-cyan-300",
          ambient: "from-cyan-600/12 via-transparent to-transparent",
          glowBorder: "border-cyan-500/25 shadow-[0_12px_36px_rgba(6,182,212,0.15)]",
        };
      case "violet":
      default:
        return {
          accentText: "text-violet-300",
          accentBar: "bg-violet-500 shadow-[0_0_14px_rgba(139,92,246,0.95)]",
          badgeBg: "bg-purple-950/70 border-violet-500/30 text-violet-300",
          ambient: "from-violet-600/12 via-transparent to-transparent",
          glowBorder: "border-violet-500/25 shadow-[0_12px_36px_rgba(139,92,246,0.15)]",
        };
    }
  };

  const getThemeArrowColor = (theme: AppTheme) => {
    switch (theme) {
      case "red":
        return "text-red-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.8)]";
      case "midnight":
        return "text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.8)]";
      case "emerald":
        return "text-emerald-300 drop-shadow-[0_0_8px_rgba(110,231,183,0.8)]";
      case "amber":
        return "text-amber-300 drop-shadow-[0_0_8px_rgba(252,211,77,0.8)]";
      case "cyan":
        return "text-cyan-300 drop-shadow-[0_0_8px_rgba(103,232,249,0.8)]";
      case "violet":
      default:
        return "text-purple-400 drop-shadow-[0_0_8px_rgba(192,132,252,0.8)]";
    }
  };

  const getGridColsClass = (size: CardSize, overscale: HistoryScale) => {
    let reductionOffset = 0;
    if (overscale === "20%") reductionOffset = 1;
    if (overscale === "50%") reductionOffset = 2;
    if (overscale === "80%") reductionOffset = 3;

    switch (size) {
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
  };

  const activeTokens = getThemeTokens(appTheme);
  const gridColsClass = useMemo(
    () => getGridColsClass(cardSize, historyOverscale),
    [cardSize, historyOverscale]
  );

  const {
    allEntries,
    inProgressMovies,
    completedMovies,
    inProgressShows,
    completedShows,
  } = useMemo(() => {
    const entries = Object.values(historyMap);
    const shows = entries.filter((item) => item.mediaType === "tv");
    const movs = entries.filter((item) => item.mediaType === "movie");

    return {
      allEntries: entries,
      inProgressMovies: movs.filter((m) => calculateSeriesProgress(m) < 100),
      completedMovies: movs.filter((m) => calculateSeriesProgress(m) === 100),
      inProgressShows: shows.filter((s) => calculateSeriesProgress(s) < 100),
      completedShows: shows.filter((s) => calculateSeriesProgress(s) === 100),
    };
  }, [historyMap]);

  const iconBtnClass = largeButtons ? "h-7 w-7 text-xs" : "h-6 w-6 text-[11px]";

  return (
    <div
      className={`min-h-screen w-full ${getPageBackground(appTheme)} p-4 sm:p-6 md:p-10 text-white space-y-6 transition-colors duration-300 pb-20 overflow-x-hidden relative rounded-3xl`}
    >
      <AppWallpaper />
      <div
        className={`absolute inset-x-0 -top-12 h-96 bg-gradient-to-b ${activeTokens.ambient} blur-3xl z-0 pointer-events-none rounded-t-3xl`}
      />

      <div className="relative z-10 max-w-7xl mx-auto space-y-6">
        {/* Top Navigation Row: Back to Home + Page Header */}
        <div className="flex flex-col gap-3">
          <div>
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 focus:outline-none focus:ring-4 focus:ring-indigo-500 rounded-2xl overflow-hidden cursor-pointer bg-white/[0.03] hover:bg-white/[0.08] backdrop-blur-md px-3 py-1.5 border border-white/10 hover:border-white/20 shadow-md transition duration-300 transform active:scale-95 group"
            >
              <img
                src={BACK_TO_HOME}
                alt="Back to Home"
                className="w-16 sm:w-20 object-contain opacity-65 group-hover:opacity-100 transition duration-300"
                style={{
                  maskImage:
                    "radial-gradient(ellipse at center, rgba(0,0,0,1) 40%, rgba(0,0,0,0) 90%)",
                  WebkitMaskImage:
                    "radial-gradient(ellipse at center, rgba(0,0,0,1) 40%, rgba(0,0,0,0) 90%)",
                }}
              />
            </Link>
          </div>

          <div
            className={`flex flex-wrap items-center justify-between gap-3 rounded-3xl border bg-slate-950/75 backdrop-blur-2xl px-5 py-4 ${activeTokens.glowBorder}`}
          >
            <div className="flex items-center gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-red-950 via-red-900 to-black border border-red-500/40 shadow-[0_0_20px_rgba(239,68,68,0.3)] text-xl">
                🐰
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                  Watch History & Activity
                </h1>
                <p className="text-[11px] text-slate-400 font-medium">
                  Manage your playback progress, completed titles & catalog filters
                </p>
              </div>
            </div>

            <span
              className={`text-xs font-bold px-3.5 py-1.5 rounded-full border backdrop-blur-md ${activeTokens.badgeBg}`}
            >
              {allEntries.length + recentLiveChannels.length} Tracked Items
            </span>
          </div>
        </div>

        {/* High-End Glass Guide Legend Bar */}
        <div className="rounded-2xl border border-white/10 bg-slate-950/65 px-4 py-3.5 shadow-xl backdrop-blur-xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 text-xs text-slate-300">
          <div className="flex items-center gap-2.5 sm:gap-4 flex-wrap">
            <span className={`text-xs font-extrabold uppercase tracking-wider ${activeTokens.accentText}`}>
              💡 Quick Guide:
            </span>
            <span className="inline-flex items-center gap-1.5 bg-white/[0.04] border border-white/10 rounded-lg px-2.5 py-1">
              <strong className="text-white">👁️</strong> Confirms you have watched it
            </span>
            <span className="inline-flex items-center gap-1.5 bg-white/[0.04] border border-white/10 rounded-lg px-2.5 py-1">
              <strong className="text-amber-300">👎</strong> Dislikes & removes from catalogs
            </span>
            <span className="inline-flex items-center gap-1.5 bg-white/[0.04] border border-white/10 rounded-lg px-2.5 py-1">
              <strong className="text-red-400">✕</strong> Removes from watch history
            </span>
          </div>
          <div className={`font-semibold shrink-0 ${activeTokens.accentText}`}>
            ✨ Also check your{" "}
            <Link
              to="/"
              search={{ tab: "My List" }}
              className="text-white underline hover:opacity-80 transition font-extrabold"
            >
              My List
            </Link>{" "}
            tab!
          </div>
        </div>

        {allEntries.length === 0 &&
        recentLiveChannels.length === 0 &&
        dislikedTitles.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-10 text-center text-slate-400 backdrop-blur-xl shadow-2xl space-y-2">
            <div className="text-3xl mb-2">🎬</div>
            <p className="text-base font-bold text-white">No watch history recorded yet.</p>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Start watching movies, shows, or live streams to automatically populate your activity timeline.
            </p>
          </div>
        ) : (
          <div className="space-y-10">
            {/* 1. RECENTLY WATCHED LIVE TV */}
            {recentLiveChannels.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2.5">
                    <span className="w-1.5 h-6 rounded-full bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.9)]" />
                    <h2 className="text-base sm:text-lg font-black tracking-tight text-white uppercase flex items-center gap-2">
                      <span>🔴 Recently Watched Live TV</span>
                    </h2>
                  </div>
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-red-950/60 border border-red-500/30 text-red-300">
                    Last {recentLiveChannels.length}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 sm:gap-4 pt-1 items-start">
                  {recentLiveChannels.map((channel) => (
                    <div
                      key={channel.channelId}
                      className="group relative rounded-2xl border border-white/10 hover:border-red-500/50 bg-slate-950/85 backdrop-blur-xl p-3 shadow-xl hover:-translate-y-1.5 transition-all duration-300 text-center flex flex-col items-center justify-between overflow-hidden"
                    >
                      <div className="absolute top-2 right-2 z-10">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeRecentLiveChannel(channel.channelId);
                            refreshData();
                          }}
                          className={`flex items-center justify-center rounded-lg bg-black/80 text-red-300 backdrop-blur-md border border-red-500/30 transition hover:bg-red-600 hover:text-white focus:outline-none font-bold shadow-md ${iconBtnClass}`}
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
                        }}
                        className="w-full flex flex-col items-center"
                      >
                        <div className="w-full h-20 bg-black/60 rounded-xl mb-2.5 overflow-hidden flex items-center justify-center border border-white/10 p-2.5">
                          {channel.logo ? (
                            <img
                              src={channel.logo}
                              alt={channel.title}
                              className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                              loading="lazy"
                            />
                          ) : (
                            <span className="text-xs font-black text-red-400 tracking-widest">
                              ● LIVE
                            </span>
                          )}
                        </div>
                        <span className="text-xs font-bold line-clamp-1 text-white group-hover:text-red-200">
                          {channel.title}
                        </span>
                        <span className="mt-2.5 w-full py-1.5 text-[10px] font-extrabold uppercase tracking-wider rounded-xl bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-lg shadow-red-600/25 group-hover:brightness-110 transition">
                          ▶ Resume Stream
                        </span>
                      </Link>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 2. MOVIES - IN PROGRESS */}
            {inProgressMovies.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2.5">
                    <span className={`w-1.5 h-6 rounded-full ${activeTokens.accentBar}`} />
                    <h2 className="text-base sm:text-lg font-black tracking-tight text-white uppercase">
                      Movies - In Progress
                    </h2>
                  </div>
                  <span
                    className={`text-xs font-bold px-3 py-1 rounded-full border ${activeTokens.badgeBg}`}
                  >
                    {inProgressMovies.length}
                  </span>
                </div>

                <div className={`grid ${gridColsClass} gap-3.5 sm:gap-5 pt-1 items-start`}>
                  {inProgressMovies.map((movie) => (
                    <MovieCard
                      key={movie.showId}
                      movie={movie}
                      appTheme={appTheme}
                      historyOverscale={historyOverscale}
                      largeButtons={largeButtons}
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
            {inProgressShows.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2.5">
                    <span className="w-1.5 h-6 rounded-full bg-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.9)]" />
                    <h2 className="text-base sm:text-lg font-black tracking-tight text-white uppercase">
                      TV Shows - In Progress
                    </h2>
                  </div>
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-blue-950/70 border border-blue-500/30 text-sky-300">
                    {inProgressShows.length}
                  </span>
                </div>

                <div className={`grid ${gridColsClass} gap-3.5 sm:gap-5 pt-1 items-start`}>
                  {inProgressShows.map((show) => (
                    <TvShowCard
                      key={show.showId}
                      show={show}
                      appTheme={appTheme}
                      historyOverscale={historyOverscale}
                      largeButtons={largeButtons}
                      onEyeballClick={handleEyeballClick}
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
            {(completedMovies.length > 0 || completedShows.length > 0) && (
              <section className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2.5">
                    <span className="w-1.5 h-6 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.9)]" />
                    <h2 className="text-base sm:text-lg font-black tracking-tight text-white uppercase">
                      Completed
                    </h2>
                  </div>
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-950/70 border border-emerald-500/30 text-emerald-300">
                    {completedMovies.length + completedShows.length}
                  </span>
                </div>

                <div className={`grid ${gridColsClass} gap-3.5 sm:gap-5 pt-1 items-start`}>
                  {completedMovies.map((movie) => (
                    <MovieCard
                      key={movie.showId}
                      movie={movie}
                      appTheme={appTheme}
                      historyOverscale={historyOverscale}
                      largeButtons={largeButtons}
                      onEyeballClick={handleEyeballClick}
                      onRemove={() => {
                        removeFromWatchHistory(movie.showId);
                        refreshData();
                      }}
                    />
                  ))}
                  {completedShows.map((show) => (
                    <TvShowCard
                      key={show.showId}
                      show={show}
                      appTheme={appTheme}
                      historyOverscale={historyOverscale}
                      largeButtons={largeButtons}
                      onEyeballClick={handleEyeballClick}
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
            {dislikedTitles.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2.5">
                    <span className="w-1.5 h-6 rounded-full bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.9)]" />
                    <h2 className="text-base sm:text-lg font-black tracking-tight text-white uppercase">
                      Disliked / Removed
                    </h2>
                  </div>
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-red-950/60 border border-red-500/30 text-red-300">
                    {dislikedTitles.length}
                  </span>
                </div>

                <div className={`grid ${gridColsClass} gap-3.5 sm:gap-4 pt-1 items-start`}>
                  {dislikedTitles.map((item) => (
                    <div
                      key={item.id}
                      className="group relative rounded-2xl border border-red-500/25 bg-slate-950/80 backdrop-blur-xl overflow-hidden shadow-lg flex flex-col justify-between p-3.5 hover:border-red-500/50 transition"
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
                              refreshData();
                            }}
                            className="inline-flex items-center gap-1 rounded-lg bg-white/10 hover:bg-emerald-600 text-slate-200 hover:text-white font-bold text-[10px] px-2 py-1 transition cursor-pointer"
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
                      <span className="text-[9px] text-slate-500 pt-2 font-medium">
                        Excluded from catalog recommendations
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
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white opacity-100">
                More History Below
              </span>
              <span
                className={`text-xl font-black animate-slow-glow ${getThemeArrowColor(appTheme)} opacity-100`}
              >
                ⌄
              </span>
            </div>
          </div>
        )}

        {/* VERIFY COMPLETION MODAL */}
        {verifyingTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
            <div
              className={`w-full max-w-sm space-y-4 rounded-3xl border bg-slate-950/95 p-6 shadow-2xl text-center ${activeTokens.glowBorder}`}
            >
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 border border-white/10 text-3xl shadow-inner">
                👁️
              </div>
              <h3 className="text-lg font-black text-white">Verify Completion</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Did you finish watching{" "}
                <strong className={activeTokens.accentText}>{verifyingTarget.title}</strong>?
              </p>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => handleConfirmModal(true)}
                  className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-600/30 transition cursor-pointer"
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
      </div>
    </div>
  );
}

const MovieCard = React.memo(function MovieCard({
  movie,
  appTheme,
  historyOverscale,
  largeButtons,
  onEyeballClick,
  onRemove,
}: {
  movie: ShowWatchHistory;
  appTheme: AppTheme;
  historyOverscale: HistoryScale | boolean;
  largeButtons: boolean;
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
  };
  const isCompleted = singleEp.confirmedCompleted;

  const getCardThemeStyles = (theme: AppTheme) => {
    switch (theme) {
      case "red":
        return "bg-zinc-950/90 border-white/10 hover:border-red-500/70 hover:shadow-[0_10px_28px_rgba(239,68,68,0.25)]";
      case "midnight":
        return "bg-slate-950/90 border-white/10 hover:border-blue-400/70 hover:shadow-[0_10px_28px_rgba(59,130,246,0.25)]";
      case "emerald":
        return "bg-slate-950/90 border-white/10 hover:border-emerald-400/70 hover:shadow-[0_10px_28px_rgba(16,185,129,0.25)]";
      case "amber":
        return "bg-stone-950/90 border-white/10 hover:border-amber-400/70 hover:shadow-[0_10px_28px_rgba(245,158,11,0.25)]";
      case "cyan":
        return "bg-slate-950/90 border-white/10 hover:border-cyan-400/70 hover:shadow-[0_10px_28px_rgba(6,182,212,0.25)]";
      case "violet":
      default:
        return "bg-slate-950/90 border-white/10 hover:border-violet-400/70 hover:shadow-[0_10px_28px_rgba(139,92,246,0.25)]";
    }
  };

  const pillBtnClass = largeButtons
    ? "h-7 px-2 text-[11px]"
    : "h-6 px-1.5 text-[10px]";
  const iconBtnClass = largeButtons ? "h-7 w-7 text-xs" : "h-6 w-6 text-[10px]";

  return (
    <div className="w-full">
      <div
        onClick={() =>
          navigate({ to: "/details", search: { id: movie.showId, type: "movie" } })
        }
        className={`group relative rounded-2xl border overflow-hidden shadow-xl flex flex-col justify-between transition-all duration-300 hover:-translate-y-1.5 cursor-pointer ${getCardThemeStyles(
          appTheme
        )}`}
      >
        <div className="relative aspect-[2/3] w-full overflow-hidden bg-black shrink-0">
          {movie.posterPath ? (
            <img
              src={`${TMDB_IMAGE_BASE}${movie.posterPath}`}
              alt={movie.title}
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center p-2 text-center text-slate-500 text-xs font-bold">
              {movie.title}
            </div>
          )}

          {/* Top Gradient Scrim so top buttons are always legible */}
          <div className="absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-black/80 via-black/30 to-transparent pointer-events-none" />

          {/* Top-Left: Completion Toggle Pill (Separated so buttons never wrap over the poster) */}
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
              className={`inline-flex items-center justify-center whitespace-nowrap rounded-lg backdrop-blur-md border transition hover:scale-105 focus:outline-none font-bold shadow-md ${pillBtnClass} ${
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
              className={`flex items-center justify-center rounded-lg bg-black/80 text-amber-300 backdrop-blur-md border border-amber-500/30 transition hover:bg-amber-600 hover:text-white focus:outline-none font-bold shadow-md ${iconBtnClass}`}
              title="Dislike & Hide Globally"
            >
              👎
            </button>
            <button
              type="button"
              onClick={onRemove}
              className={`flex items-center justify-center rounded-lg bg-black/80 text-red-300 backdrop-blur-md border border-red-500/30 transition hover:bg-red-600 hover:text-white focus:outline-none font-bold shadow-md ${iconBtnClass}`}
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
            <div className="flex items-center justify-between mt-0.5">
              <span className="text-[10px] text-slate-300 font-semibold uppercase tracking-wider">
                Movie
              </span>
              <span
                className={`text-[10px] font-bold ${
                  isCompleted ? "text-emerald-400" : "text-amber-300"
                }`}
              >
                {isCompleted ? "Completed" : "In Progress"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

const TvShowCard = React.memo(function TvShowCard({
  show,
  appTheme,
  historyOverscale,
  largeButtons,
  onEyeballClick,
  onRemove,
}: {
  show: ShowWatchHistory;
  appTheme: AppTheme;
  historyOverscale: HistoryScale | boolean;
  largeButtons: boolean;
  onEyeballClick: (
    showId: string,
    episodeId: string,
    episodeTitle: string,
    isCompleted: boolean
  ) => void;
  onRemove: () => void;
}) {
  const navigate = useNavigate();
  const progress = calculateSeriesProgress(show);
  const episodesList = Object.values(show.episodes);

  const getCardThemeStyles = (theme: AppTheme) => {
    switch (theme) {
      case "red":
        return "bg-zinc-950/90 border-white/10 hover:border-red-500/70 hover:shadow-[0_10px_28px_rgba(239,68,68,0.25)]";
      case "midnight":
        return "bg-slate-950/90 border-white/10 hover:border-blue-400/70 hover:shadow-[0_10px_28px_rgba(59,130,246,0.25)]";
      case "emerald":
        return "bg-slate-950/90 border-white/10 hover:border-emerald-400/70 hover:shadow-[0_10px_28px_rgba(16,185,129,0.25)]";
      case "amber":
        return "bg-stone-950/90 border-white/10 hover:border-amber-400/70 hover:shadow-[0_10px_28px_rgba(245,158,11,0.25)]";
      case "cyan":
        return "bg-slate-950/90 border-white/10 hover:border-cyan-400/70 hover:shadow-[0_10px_28px_rgba(6,182,212,0.25)]";
      case "violet":
      default:
        return "bg-slate-950/90 border-white/10 hover:border-violet-400/70 hover:shadow-[0_10px_28px_rgba(139,92,246,0.25)]";
    }
  };

  const iconBtnClass = largeButtons ? "h-7 w-7 text-xs" : "h-6 w-6 text-[10px]";

  return (
    <div className="w-full">
      <div
        onClick={() =>
          navigate({ to: "/details", search: { id: show.showId, type: "tv" } })
        }
        className={`group relative rounded-2xl border overflow-hidden shadow-xl flex flex-col justify-between transition-all duration-300 hover:-translate-y-1.5 cursor-pointer ${getCardThemeStyles(
          appTheme
        )}`}
      >
        <div className="relative aspect-[2/3] w-full overflow-hidden bg-black shrink-0">
          {show.posterPath ? (
            <img
              src={`${TMDB_IMAGE_BASE}${show.posterPath}`}
              alt={show.title}
              loading="lazy"
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
              className={`flex items-center justify-center rounded-lg bg-black/80 text-amber-300 backdrop-blur-md border border-amber-500/30 transition hover:bg-amber-600 hover:text-white focus:outline-none font-bold shadow-md ${iconBtnClass}`}
              title="Dislike & Hide Globally"
            >
              👎
            </button>
            <button
              type="button"
              onClick={onRemove}
              className={`flex items-center justify-center rounded-lg bg-black/80 text-red-300 backdrop-blur-md border border-red-500/30 transition hover:bg-red-600 hover:text-white focus:outline-none font-bold shadow-md ${iconBtnClass}`}
              title="Remove from history"
            >
              ✕
            </button>
          </div>

          {/* Title inside bottom poster gradient so the footer has room for episodes */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/80 to-transparent pt-10 pb-2 px-3 z-10">
            <h3
              className="text-xs sm:text-sm font-bold truncate text-white drop-shadow"
              title={show.title}
            >
              {show.title}
            </h3>
          </div>
        </div>

        <div className="p-2.5 sm:p-3 space-y-2.5 bg-slate-950/95 border-t border-white/10 shrink-0">
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] font-bold text-slate-300">
              <span className="truncate">Progress</span>
              <span className={progress === 100 ? "text-emerald-400" : "text-amber-300"}>
                {progress}%
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden border border-white/5">
              <div
                className={`h-full transition-all duration-300 ${
                  progress === 100
                    ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"
                    : "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]"
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div
            className="space-y-1 max-h-28 overflow-y-auto scrollbar-none"
            onClick={(e) => e.stopPropagation()}
          >
            {episodesList.map((ep) => (
              <EpisodeRow
                key={ep.episodeId}
                episode={ep}
                largeButtons={largeButtons}
                onEyeballClick={() =>
                  onEyewayClickWrapper(
                    show.showId,
                    ep.episodeId,
                    ep.title,
                    ep.confirmedCompleted,
                    onEyeballClick
                  )
                }
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});

function onEyewayClickWrapper(
  showId: string,
  episodeId: string,
  title: string,
  isCompleted: boolean,
  onEyeballClick: (sId: string, eId: string, t: string, comp: boolean) => void
) {
  onEyeballClick(showId, episodeId, title, isCompleted);
}

const EpisodeRow = React.memo(function EpisodeRow({
  episode,
  largeButtons,
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
  onEyeballClick: () => void;
}) {
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);
  const rowBtnClass = largeButtons
    ? "h-6 px-2 text-[10px]"
    : "h-5 px-1.5 text-[9px]";

  return (
    <div className="flex items-center justify-between gap-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] px-2 py-1 border border-white/10 text-[11px] transition">
      <span className="font-bold text-slate-200 whitespace-nowrap">
        S{episode.seasonNumber}E{episode.episodeNumber}
      </span>

      <div className="relative shrink-0">
        <button
          type="button"
          onClick={onEyeballClick}
          onMouseEnter={() => setIsTooltipOpen(true)}
          onMouseLeave={() => setIsTooltipOpen(false)}
          onFocus={() => setIsTooltipOpen(true)}
          onBlur={() => setIsTooltipOpen(false)}
          className={`inline-flex items-center justify-center whitespace-nowrap rounded-md border transition hover:scale-105 focus:outline-none font-bold cursor-pointer ${rowBtnClass} ${
            episode.confirmedCompleted
              ? "bg-emerald-950/90 text-emerald-300 border-emerald-400/40"
              : "bg-black/80 text-white border-white/20"
          }`}
          aria-label="Toggle Status"
        >
          {episode.confirmedCompleted ? "👁️ ✓" : "👁️ ?"}
        </button>

        {isTooltipOpen && (
          <div className="absolute right-0 bottom-7 whitespace-nowrap rounded-lg bg-slate-950 px-2 py-1 text-[9px] font-bold text-white shadow-xl border border-white/20 z-20 pointer-events-none">
            {episode.confirmedCompleted ? "Completed" : "Unconfirmed"}
          </div>
        )}
      </div>
    </div>
  );
});
