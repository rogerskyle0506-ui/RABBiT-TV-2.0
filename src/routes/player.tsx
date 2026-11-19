// src/routes/player.tsx
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import {
  AppTheme,
  CardSize,
  PosterAppearanceClasses,
  getSavedTheme,
  getSavedCardSize,
  getPosterAppearanceClasses,
  getOptimalTmdbImageWidth,
  getHardwareLimits,
  getLargeButtons,
  getReducedMotion,
  getGlowIntensity,
  getAutoPlayNext,
  setAutoPlayNext as saveAutoPlayNextSetting,
  getClockFormat,
  formatAppTime,
  getSleepTimerMinutes,
  getSavedUserAge,
  getKidsModeLocked,
  isAllowedForAge,
  purgeOldTmdbCaches,
} from "@/lib/settings";
import { isTitleBroken, reportBrokenLink } from "@/lib/broken-links";
import { MediaCard } from "@/routes/index";
import type { MediaItem } from "@/lib/tmdb-scraper";
import {
  saveWatchProgress,
  getWatchHistory,
  markEpisodeCompleted,
  isTitleDisliked,
  dislikeTitle,
} from "@/lib/watch-history";
import { isInMyList, toggleMyList } from "@/lib/storage";
import { AppWallpaper } from "@/components/AppWallpaper";
import { bgAudio } from "@/lib/background-audio";
import { initAdBlockerGlobalInterceptors } from "@/lib/adblocker";

const FETCH_TIMEOUT_MS = 8000;

export const Route = createFileRoute("/player")({
  component: PlayerPage,
  validateSearch: (search: Record<string, unknown>) => ({
    id: search.id != null ? String(search.id) : "",
    type: search.type != null ? String(search.type).toLowerCase() : "movie",
    season: search.season != null ? Number(search.season) : 1,
    episode: search.episode != null ? Number(search.episode) : 1,
  }),
});

/**
 * Checks if a DOM node was rendered by React (via internal Fiber/Props keys)
 * or is a core semantic layout container (<header>, <main>, <nav>, <footer>).
 */
function isReactOrCoreLayoutNode(node: Element): boolean {
  const tag = node.tagName.toLowerCase();
  if (
    tag === "header" ||
    tag === "main" ||
    tag === "nav" ||
    tag === "footer"
  ) {
    return true;
  }
  const keys = Object.keys(node);
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    if (
      k.startsWith("__reactFiber$") ||
      k.startsWith("__reactProps$") ||
      k.startsWith("__reactContainer$") ||
      k.startsWith("__reactInternalInstance$")
    ) {
      return true;
    }
  }
  return false;
}

function safeCacheWrite(key: string, payload: unknown): void {
  if (typeof window === "undefined") return;
  const serialized = JSON.stringify(payload);
  try {
    localStorage.setItem(key, serialized);
  } catch {
    try {
      purgeOldTmdbCaches();
      localStorage.setItem(key, serialized);
    } catch {
      // Skip caching if device storage is critically full
    }
  }
}

async function fetchJsonWithTimeout(
  url: string,
  signal?: AbortSignal,
  timeoutMs = FETCH_TIMEOUT_MS
): Promise<any> {
  const controller = new AbortController();
  const onParentAbort = () => controller.abort();
  signal?.addEventListener("abort", onParentAbort, { once: true });

  const timer =
    typeof window !== "undefined"
      ? window.setTimeout(() => controller.abort(), timeoutMs)
      : setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } finally {
    signal?.removeEventListener("abort", onParentAbort);
    if (typeof window !== "undefined") {
      window.clearTimeout(timer as number);
    } else {
      clearTimeout(timer);
    }
  }
}

export function PlayerPage() {
  // 1. Protect React DOM & activate global adblocker interceptors (unchanged core shield)
  useEffect(() => {
    if (typeof document === "undefined") return;

    const protectLegitimateAppDom = () => {
      document
        .querySelectorAll("header, main, nav, footer")
        .forEach((el) => el.classList.add("rabtv-vidsrc-protected"));

      if (document.body) {
        Array.from(document.body.children).forEach((child) => {
          if (isReactOrCoreLayoutNode(child)) {
            child.classList.add("rabtv-vidsrc-protected");
          }
        });
      }
    };

    protectLegitimateAppDom();

    const shieldObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of Array.from(mutation.addedNodes)) {
          if (node instanceof HTMLElement && isReactOrCoreLayoutNode(node)) {
            node.classList.add("rabtv-vidsrc-protected");
          }
        }
      }
    });

    if (document.body) {
      shieldObserver.observe(document.body, { childList: true, subtree: false });
    }

    const cleanup = initAdBlockerGlobalInterceptors();

    return () => {
      shieldObserver.disconnect();
      cleanup();
    };
  }, []);

  const search = Route.useSearch();
  const navigate = useNavigate();

  const rawId = String(search.id || "").trim();
  const inferredType: "tv" | "movie" | null = rawId
    .toLowerCase()
    .startsWith("tv-")
    ? "tv"
    : rawId.toLowerCase().startsWith("movie-")
      ? "movie"
      : null;

  const mediaId = rawId.replace(/^(movie|tv)-/i, "").trim();
  const safeApiId = /^\d+$/.test(mediaId) ? mediaId : "";
  const urlType: "movie" | "tv" =
    inferredType || (search.type === "tv" ? "tv" : "movie");

  // Media & Episode States
  const [mediaType, setMediaType] = useState<"movie" | "tv">(urlType);
  const [mediaDetails, setMediaDetails] = useState<any>(null);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [season, setSeason] = useState<number>(
    search.season > 0 ? search.season : 1
  );
  const [episode, setEpisode] = useState<number>(
    search.episode > 0 ? search.episode : 1
  );
  const [seasonEpisodes, setSeasonEpisodes] = useState<any[]>([]);
  const [showEpisodeDrawer, setShowEpisodeDrawer] = useState<boolean>(false);

  // Synced Settings States
  const [appTheme, setAppTheme] = useState<AppTheme>(() => getSavedTheme());
  const [cardSize, setCardSize] = useState<CardSize>(() => getSavedCardSize());
  const [posterAppearance, setPosterAppearance] =
    useState<PosterAppearanceClasses>(() =>
      getPosterAppearanceClasses(getSavedTheme())
    );
  const [posterWidth, setPosterWidth] = useState<"w342" | "w500">(() =>
    getOptimalTmdbImageWidth()
  );
  const [largeButtons, setLargeButtons] = useState<boolean>(() =>
    getLargeButtons()
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
  const [autoPlayNext, setAutoPlayNext] = useState<boolean>(() =>
    getAutoPlayNext()
  );
  const [clockFormat, setClockFormat] = useState(() => getClockFormat());
  const [sleepTimerMin, setSleepTimerMin] = useState<number>(() =>
    getSleepTimerMinutes()
  );
  const [userAge, setUserAge] = useState<number>(() => getSavedUserAge());
  const [kidsLocked, setKidsLocked] = useState<boolean>(() =>
    getKidsModeLocked()
  );

  // Interactive Cinema UI States
  const [cinemaDimMode, setCinemaDimMode] = useState<boolean>(false);
  const [inMyList, setInMyList] = useState<boolean>(() =>
    isInMyList(`${urlType}-${mediaId}`)
  );
  const [watchedMapTick, setWatchedMapTick] = useState<number>(0);
  const [actionToast, setActionToast] = useState<string | null>(null);
  const [playerLoadTime, setPlayerLoadTime] = useState<number>(() =>
    Date.now()
  );
  const [estimatedCompletion, setEstimatedCompletion] =
    useState<string>("--:--");
  const [liveClock, setLiveClock] = useState<string>(() =>
    formatAppTime(new Date(), getClockFormat())
  );

  const [isSeasonOpen, setIsSeasonOpen] = useState(false);
  const [isEpisodeOpen, setIsEpisodeOpen] = useState(false);

  const seasonRef = useRef<HTMLDivElement>(null);
  const episodeRef = useRef<HTMLDivElement>(null);

  const showToast = useCallback((msg: string) => {
    setActionToast(msg);
    window.setTimeout(() => setActionToast(null), 3200);
  }, []);

  // Pause background lobby radio whenever entering or switching playback
  useEffect(() => {
    bgAudio.pause();
  }, [mediaId, season, episode]);

  // Reset state cleanly when route changes
  useEffect(() => {
    setMediaType(urlType);
    setSeason(search.season > 0 ? search.season : 1);
    setEpisode(search.episode > 0 ? search.episode : 1);
    setMediaDetails(null);
    setRecommendations([]);
    setSeasonEpisodes([]);
    setLoading(true);
    setCinemaDimMode(false);
    setPlayerLoadTime(Date.now());
  }, [mediaId, urlType, search.season, search.episode]);

  // Reset finish-time anchor whenever episode switches
  useEffect(() => {
    setPlayerLoadTime(Date.now());
  }, [season, episode]);

  // Close dropdowns on outside click & support TV/Keyboard shortcuts (Escape, L for Lights-Out)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        seasonRef.current &&
        !seasonRef.current.contains(event.target as Node)
      ) {
        setIsSeasonOpen(false);
      }
      if (
        episodeRef.current &&
        !episodeRef.current.contains(event.target as Node)
      ) {
        setIsEpisodeOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (e.key === "Escape") {
        setIsSeasonOpen(false);
        setIsEpisodeOpen(false);
        setCinemaDimMode(false);
      } else if (e.key === "l" || e.key === "L") {
        setCinemaDimMode((prev) => !prev);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Live settings sync
  useEffect(() => {
    const loadSettings = () => {
      const nextTheme = getSavedTheme();
      setAppTheme(nextTheme);
      setCardSize(getSavedCardSize());
      setPosterAppearance(getPosterAppearanceClasses(nextTheme));
      setPosterWidth(getOptimalTmdbImageWidth());
      setLargeButtons(getLargeButtons());
      setReducedMotion(getReducedMotion());
      setGlowOff(getGlowIntensity() === "off");
      setIsLowRam(getHardwareLimits().effectiveMode === "low");
      setAutoPlayNext(getAutoPlayNext());
      setClockFormat(getClockFormat());
      setSleepTimerMin(getSleepTimerMinutes());
      setUserAge(getSavedUserAge());
      setKidsLocked(getKidsModeLocked());
      setLiveClock(formatAppTime(new Date(), getClockFormat()));
    };

    const onHistoryChange = () => setWatchedMapTick((t) => t + 1);
    const onCatalogChange = () =>
      setInMyList(isInMyList(`${mediaType}-${mediaId}`));

    loadSettings();
    window.addEventListener("storage", loadSettings);
    window.addEventListener("rabtv_settings_updated", loadSettings);
    window.addEventListener("rabtv_ram_mode_updated", loadSettings);
    window.addEventListener("rabtv_watch_history_updated", onHistoryChange);
    window.addEventListener("rabtv_catalog_updated", onCatalogChange);

    const clockTimer = window.setInterval(() => {
      setLiveClock(formatAppTime(new Date(), getClockFormat()));
    }, 15000);

    return () => {
      window.removeEventListener("storage", loadSettings);
      window.removeEventListener("rabtv_settings_updated", loadSettings);
      window.removeEventListener("rabtv_ram_mode_updated", loadSettings);
      window.removeEventListener(
        "rabtv_watch_history_updated",
        onHistoryChange
      );
      window.removeEventListener("rabtv_catalog_updated", onCatalogChange);
      window.clearInterval(clockTimer);
    };
  }, [mediaId, mediaType]);

  useEffect(() => {
    setInMyList(isInMyList(`${mediaType}-${mediaId}`));
  }, [mediaId, mediaType]);

  // Fetch season episodes with AbortController & timeout
  useEffect(() => {
    if (mediaType !== "tv" || !safeApiId) return;
    const controller = new AbortController();
    let cancelled = false;

    async function fetchSeasonEpisodes() {
      try {
        const apiKey = (import.meta as any).env?.VITE_TMDB_API_KEY as string;
        if (!apiKey) return;
        const data = await fetchJsonWithTimeout(
          `https://api.themoviedb.org/3/tv/${safeApiId}/season/${season}?api_key=${apiKey}`,
          controller.signal
        );
        if (!cancelled && data) {
          setSeasonEpisodes(Array.isArray(data.episodes) ? data.episodes : []);
        }
      } catch (err: any) {
        if (!cancelled && err?.name !== "AbortError") {
          console.error("Failed to load season episodes", err);
          setSeasonEpisodes([]);
        }
      }
    }

    void fetchSeasonEpisodes();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [season, safeApiId, mediaType]);

  // Fetch player details & recommendations with cache, timeout & safe quota writes
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    async function fetchPlayerDetailsWithCache() {
      if (!safeApiId) {
        setLoading(false);
        setMediaDetails(null);
        return;
      }

      const apiKey = (import.meta as any).env?.VITE_TMDB_API_KEY as string;
      let activeFetchType: "movie" | "tv" = urlType;

      try {
        const cacheKey = `rabtv_cache_${activeFetchType}_${safeApiId}`;
        const cachedItem = localStorage.getItem(cacheKey);
        if (cachedItem) {
          try {
            const { data, timestamp } = JSON.parse(cachedItem);
            if (
              Date.now() - timestamp < 21600000 &&
              data &&
              data.success !== false
            ) {
              if (!cancelled) {
                const isTv = !!(data?.seasons || data?.number_of_seasons);
                setMediaType(isTv ? "tv" : activeFetchType);
                setMediaDetails(data);
                setLoading(false);
              }
            }
          } catch {
            // Ignore malformed cache
          }
        }

        let data = await fetchJsonWithTimeout(
          `https://api.themoviedb.org/3/${activeFetchType}/${safeApiId}?api_key=${apiKey}&append_to_response=credits,external_ids`,
          controller.signal
        );

        if (!data || data.success === false || data.status_code) {
          const otherType: "movie" | "tv" =
            activeFetchType === "movie" ? "tv" : "movie";
          const retryData = await fetchJsonWithTimeout(
            `https://api.themoviedb.org/3/${otherType}/${safeApiId}?api_key=${apiKey}&append_to_response=credits,external_ids`,
            controller.signal
          );
          if (retryData && retryData.success !== false && !retryData.status_code) {
            data = retryData;
            activeFetchType = otherType;
          }
        }

        if (cancelled) return;

        if (data && data.success !== false && !data.status_code) {
          const isTv =
            !!(data?.seasons || data?.number_of_seasons) ||
            activeFetchType === "tv";
          const resolvedType = isTv ? "tv" : "movie";
          setMediaType(resolvedType);
          safeCacheWrite(`rabtv_cache_${activeFetchType}_${safeApiId}`, {
            data,
            timestamp: Date.now(),
          });
          setMediaDetails(data);
        } else {
          setMediaDetails(null);
        }

        // Fetch recommendations in parallel-safe flow
        let recData = await fetchJsonWithTimeout(
          `https://api.themoviedb.org/3/${activeFetchType}/${safeApiId}/recommendations?api_key=${apiKey}&language=en-US&page=1`,
          controller.signal
        );

        if (!recData?.results || recData.results.length === 0) {
          recData = await fetchJsonWithTimeout(
            `https://api.themoviedb.org/3/${activeFetchType}/popular?api_key=${apiKey}&language=en-US&page=1`,
            controller.signal
          );
        }

        if (!cancelled && Array.isArray(recData?.results)) {
          setRecommendations(recData.results);
        }
      } catch (err: any) {
        if (!cancelled && err?.name !== "AbortError") {
          console.error(
            "Failed to load player details and recommendations",
            err
          );
          setMediaDetails(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchPlayerDetailsWithCache();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [safeApiId, urlType]);

  const inferredMediaType: "tv" | "movie" =
    mediaDetails?.seasons ||
    mediaDetails?.number_of_seasons ||
    mediaType === "tv"
      ? "tv"
      : "movie";

  const validSeasons = useMemo(() => {
    return (mediaDetails?.seasons || []).filter(
      (s: any) => s.season_number > 0
    );
  }, [mediaDetails]);

  const currentSeasonObj = useMemo(
    () => validSeasons.find((s: any) => s.season_number === season),
    [validSeasons, season]
  );

  const currentEpisodeObj = useMemo(
    () => seasonEpisodes.find((e: any) => e.episode_number === episode),
    [seasonEpisodes, episode]
  );

  // Accurate finish time using exact episode runtime + user 12h/24h clock format
  useEffect(() => {
    if (!mediaDetails) return;
    const runtimeMinutes =
      inferredMediaType === "movie"
        ? mediaDetails.runtime || 120
        : currentEpisodeObj?.runtime ||
          mediaDetails.episode_run_time?.[0] ||
          45;

    const completionTimestamp = playerLoadTime + runtimeMinutes * 60 * 1000;
    setEstimatedCompletion(formatAppTime(completionTimestamp, clockFormat));
  }, [
    mediaDetails,
    playerLoadTime,
    inferredMediaType,
    currentEpisodeObj,
    clockFormat,
  ]);

  // Persist accurate Watch History progress (including totalEpisodes & episodeTitle)
  useEffect(() => {
    if (!mediaDetails || !mediaId) return;

    try {
      saveWatchProgress({
        id: `${inferredMediaType}-${mediaId}`,
        mediaId: String(mediaId),
        title: mediaDetails.title || mediaDetails.name || "Untitled",
        mediaType: inferredMediaType,
        posterPath: mediaDetails.poster_path || null,
        backdropPath: mediaDetails.backdrop_path || null,
        progressPercent: 0,
        seasonNumber: inferredMediaType === "tv" ? season : undefined,
        episodeNumber: inferredMediaType === "tv" ? episode : undefined,
        episodeTitle:
          inferredMediaType === "tv" ? currentEpisodeObj?.name : undefined,
        totalEpisodes:
          inferredMediaType === "tv"
            ? mediaDetails.number_of_episodes || undefined
            : 1,
        genreIds: mediaDetails?.genres?.map((g: any) => g.id) || [],
      });
    } catch (err) {
      console.error("Could not update watch history", err);
    }
  }, [
    season,
    episode,
    mediaDetails,
    mediaId,
    inferredMediaType,
    currentEpisodeObj?.name,
  ]);

  // Lookup completed episodes for this title from Watch History
  const completedEpisodesSet = useMemo(() => {
    void watchedMapTick;
    const history = getWatchHistory();
    const showRecord = history[mediaId];
    const set = new Set<string>();
    if (showRecord?.episodes) {
      for (const ep of Object.values(showRecord.episodes)) {
        if (ep.confirmedCompleted) {
          set.add(`s${ep.seasonNumber}-e${ep.episodeNumber}`);
        }
      }
    }
    return set;
  }, [mediaId, watchedMapTick]);

  const isCurrentItemWatched =
    inferredMediaType === "movie"
      ? completedEpisodesSet.has("s1-e1")
      : completedEpisodesSet.has(`s${season}-e${episode}`);

  // Smart Prev / Next episode navigation with automatic cross-season rollover
  const currentSeasonMaxEp =
    seasonEpisodes.length || currentSeasonObj?.episode_count || 1;
  const currentSeasonIndex = validSeasons.findIndex(
    (s: any) => s.season_number === season
  );
  const nextSeasonObj =
    currentSeasonIndex >= 0 && currentSeasonIndex < validSeasons.length - 1
      ? validSeasons[currentSeasonIndex + 1]
      : null;
  const prevSeasonObj =
    currentSeasonIndex > 0 ? validSeasons[currentSeasonIndex - 1] : null;

  const canGoPrevEpisode = episode > 1 || Boolean(prevSeasonObj);
  const canGoNextEpisode =
    episode < currentSeasonMaxEp || Boolean(nextSeasonObj);

  const handlePrevEpisode = () => {
    if (episode > 1) {
      setEpisode((prev) => prev - 1);
    } else if (prevSeasonObj) {
      setSeason(prevSeasonObj.season_number);
      setEpisode(Math.max(1, prevSeasonObj.episode_count || 1));
    }
  };

  const handleNextEpisode = () => {
    if (episode < currentSeasonMaxEp) {
      setEpisode((prev) => prev + 1);
    } else if (nextSeasonObj) {
      setSeason(nextSeasonObj.season_number);
      setEpisode(1);
    }
  };

  // Top Cast extracted from already-fetched credits (0 extra network calls!)
  const topCast = useMemo(() => {
    const rawCast = mediaDetails?.credits?.cast;
    if (!Array.isArray(rawCast)) return [];
    const cap = isLowRam ? 6 : 10;
    return rawCast.slice(0, cap).map((person: any) => ({
      id: person.id,
      name: person.name || "Cast Member",
      character: person.character || "",
      profilePath: person.profile_path || null,
    }));
  }, [mediaDetails, isLowRam]);

  // Age-safe, non-broken, non-disliked recommendations sized for active RAM mode
  const mappedRecommendations: MediaItem[] = useMemo(() => {
    const cap = isLowRam ? 6 : 10;
    const filtered: MediaItem[] = [];

    for (const rec of recommendations) {
      const recId = String(rec.id);
      const recType: "movie" | "tv" =
        rec.media_type === "tv" || rec.name || !rec.title ? "tv" : "movie";
      const fullId = `${recType}-${recId}`;

      if (
        isTitleBroken(recId) ||
        isTitleBroken(fullId) ||
        isTitleDisliked(recId) ||
        isTitleDisliked(fullId)
      ) {
        continue;
      }

      const genreLabel = recType === "tv" ? "TV SHOW" : "MOVIE";
      if (!isAllowedForAge(rec.adult ? "R" : undefined, genreLabel, userAge)) {
        continue;
      }

      const recTitle = rec.title || rec.name || "Untitled";
      const recPoster = rec.poster_path
        ? `https://image.tmdb.org/t/p/${posterWidth}${rec.poster_path}`
        : "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=900&q=80";
      const releaseDate = rec.release_date || rec.first_air_date || "";
      const year = releaseDate.split("-")[0];
      const rating =
        typeof rec.vote_average === "number" && rec.vote_average > 0
          ? rec.vote_average.toFixed(1)
          : undefined;

      filtered.push({
        id: fullId,
        title: recTitle,
        description: rec.overview || "",
        image: recPoster,
        href: `/details?id=${recId}&type=${recType}`,
        genre: genreLabel,
        year: year || undefined,
        rating,
        mediaType: recType,
      });

      if (filtered.length >= cap) break;
    }

    return filtered;
  }, [recommendations, posterWidth, isLowRam, userAge, kidsLocked]);

  const gridColsClass = useMemo(() => {
    if (cardSize === "small") {
      return "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3.5 sm:gap-4 justify-items-center";
    }
    if (cardSize === "medium") {
      return "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-5 justify-items-center";
    }
    return "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 justify-items-center";
  }, [cardSize]);

  const themeTokens = useMemo(() => {
    switch (appTheme) {
      case "red":
        return {
          pageBg: "bg-gradient-to-br from-zinc-950/85 via-red-950/45 to-black/95",
          cardBg: "bg-zinc-950/90 border-red-500/25",
          text: "text-red-400",
          bg: "bg-red-600",
          ring: "focus:ring-red-400",
          accentBar: "bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.95)]",
          badge: "text-red-200 border-red-500/30 bg-red-950/60",
          ambient: "from-red-600/20 via-rose-600/5 to-transparent",
          playerGlow:
            "shadow-[0_25px_70px_rgba(0,0,0,0.95),0_0_40px_rgba(239,68,68,0.22)]",
          laserLine: "from-transparent via-red-500 to-amber-400",
          avatarRing: "from-red-500 via-rose-400 to-amber-400",
          nextBtn:
            "bg-gradient-to-r from-red-500 via-rose-500 to-amber-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.45)]",
        };
      case "midnight":
        return {
          pageBg:
            "bg-gradient-to-br from-slate-950/85 via-blue-950/45 to-slate-950/95",
          cardBg: "bg-slate-950/90 border-blue-500/25",
          text: "text-sky-300",
          bg: "bg-blue-600",
          ring: "focus:ring-blue-400",
          accentBar: "bg-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.95)]",
          badge: "text-sky-200 border-blue-500/30 bg-blue-950/60",
          ambient: "from-blue-600/20 via-sky-500/5 to-transparent",
          playerGlow:
            "shadow-[0_25px_70px_rgba(0,0,0,0.95),0_0_40px_rgba(56,189,248,0.22)]",
          laserLine: "from-transparent via-sky-400 to-blue-500",
          avatarRing: "from-cyan-400 via-sky-500 to-indigo-500",
          nextBtn:
            "bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500 text-slate-950 shadow-[0_0_20px_rgba(56,189,248,0.45)]",
        };
      case "emerald":
        return {
          pageBg:
            "bg-gradient-to-br from-slate-950/85 via-emerald-950/45 to-slate-950/95",
          cardBg: "bg-slate-950/90 border-emerald-500/25",
          text: "text-emerald-300",
          bg: "bg-emerald-600",
          ring: "focus:ring-emerald-400",
          accentBar: "bg-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.95)]",
          badge: "text-emerald-200 border-emerald-500/30 bg-emerald-950/60",
          ambient: "from-emerald-600/20 via-teal-500/5 to-transparent",
          playerGlow:
            "shadow-[0_25px_70px_rgba(0,0,0,0.95),0_0_40px_rgba(52,211,153,0.22)]",
          laserLine: "from-transparent via-emerald-400 to-cyan-400",
          avatarRing: "from-emerald-400 via-teal-400 to-cyan-500",
          nextBtn:
            "bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 text-slate-950 shadow-[0_0_20px_rgba(52,211,153,0.45)]",
        };
      case "amber":
        return {
          pageBg:
            "bg-gradient-to-br from-stone-950/85 via-yellow-950/45 to-neutral-950/95",
          cardBg: "bg-stone-950/90 border-amber-500/25",
          text: "text-amber-300",
          bg: "bg-amber-600",
          ring: "focus:ring-amber-400",
          accentBar: "bg-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.95)]",
          badge: "text-amber-200 border-amber-500/30 bg-amber-950/60",
          ambient: "from-amber-600/20 via-yellow-500/5 to-transparent",
          playerGlow:
            "shadow-[0_25px_70px_rgba(0,0,0,0.95),0_0_40px_rgba(245,158,11,0.22)]",
          laserLine: "from-transparent via-amber-400 to-orange-500",
          avatarRing: "from-amber-400 via-yellow-400 to-orange-500",
          nextBtn:
            "bg-gradient-to-r from-amber-400 via-yellow-400 to-orange-500 text-slate-950 shadow-[0_0_20px_rgba(245,158,11,0.45)]",
        };
      case "cyan":
        return {
          pageBg:
            "bg-gradient-to-br from-slate-950/85 via-cyan-950/45 to-slate-950/95",
          cardBg: "bg-slate-950/90 border-cyan-500/25",
          text: "text-cyan-300",
          bg: "bg-cyan-600",
          ring: "focus:ring-cyan-400",
          accentBar: "bg-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.95)]",
          badge: "text-cyan-200 border-cyan-500/30 bg-cyan-950/60",
          ambient: "from-cyan-600/20 via-sky-500/5 to-transparent",
          playerGlow:
            "shadow-[0_25px_70px_rgba(0,0,0,0.95),0_0_40px_rgba(34,211,238,0.22)]",
          laserLine: "from-transparent via-cyan-400 to-sky-500",
          avatarRing: "from-cyan-400 via-sky-400 to-blue-500",
          nextBtn:
            "bg-gradient-to-r from-cyan-400 via-teal-300 to-sky-400 text-slate-950 shadow-[0_0_20px_rgba(34,211,238,0.45)]",
        };
      case "violet":
      default:
        return {
          pageBg:
            "bg-gradient-to-br from-slate-950/85 via-purple-950/45 to-slate-950/95",
          cardBg: "bg-slate-950/90 border-violet-500/25",
          text: "text-violet-300",
          bg: "bg-violet-600",
          ring: "focus:ring-violet-400",
          accentBar: "bg-violet-500 shadow-[0_0_15px_rgba(139,92,246,0.95)]",
          badge: "text-slate-200 border-white/15 bg-white/[0.06]",
          ambient: "from-violet-600/20 via-fuchsia-500/5 to-transparent",
          playerGlow:
            "shadow-[0_25px_70px_rgba(0,0,0,0.95),0_0_40px_rgba(168,85,247,0.25)]",
          laserLine: "from-transparent via-pink-500 to-cyan-400",
          avatarRing: "from-cyan-400 via-purple-500 to-pink-500",
          nextBtn:
            "bg-gradient-to-r from-cyan-400 via-sky-400 to-purple-500 text-slate-950 shadow-[0_0_20px_rgba(56,189,248,0.45)]",
        };
    }
  }, [appTheme]);

  if (loading) {
    return (
      <div
        className={`flex min-h-screen items-center justify-center ${themeTokens.pageBg} text-white relative rounded-3xl`}
      >
        <AppWallpaper />
        <div className="relative z-10 flex flex-col items-center gap-3">
          <div
            className={`h-10 w-10 rounded-full border-2 border-t-transparent animate-spin ${themeTokens.text}`}
          />
          <p className={`text-lg font-extrabold ${themeTokens.text}`}>
            Loading cinema player...
          </p>
        </div>
      </div>
    );
  }

  const title = mediaDetails?.title || mediaDetails?.name || "Sample Content";
  const overview =
    mediaDetails?.overview || "No description available for this title.";

  // Hardware-aware backdrop sizing (saves multi-megabyte GPU texture RAM on 1-2GB sticks!)
  const backdropWidth = isLowRam ? "w780" : "w1280";
  const backdropUrl = mediaDetails?.backdrop_path
    ? `https://image.tmdb.org/t/p/${backdropWidth}${mediaDetails.backdrop_path}`
    : null;

  const releaseYear = (
    mediaDetails?.release_date ||
    mediaDetails?.first_air_date ||
    ""
  ).split("-")[0];
  const rating =
    typeof mediaDetails?.vote_average === "number" &&
    mediaDetails.vote_average > 0
      ? mediaDetails.vote_average.toFixed(1)
      : "N/A";
  const genres =
    mediaDetails?.genres?.map((g: any) => g.name).join(", ") || "Entertainment";
  const runtimeMinutes =
    inferredMediaType === "movie"
      ? mediaDetails?.runtime || null
      : currentEpisodeObj?.runtime || mediaDetails?.episode_run_time?.[0] || null;

  const imdbId =
    mediaDetails?.external_ids?.imdb_id || mediaDetails?.imdb_id || null;
  const imdbLink = imdbId
    ? `https://www.imdb.com/title/${imdbId}/`
    : `https://www.imdb.com/find?q=${encodeURIComponent(title)}`;

  // 100% Untouched vidsrc embedUrl formula
  const embedUrl =
    inferredMediaType === "tv"
      ? `https://vidsrc.to/embed/tv/${mediaId}/${season}/${episode}`
      : `https://vidsrc.to/embed/movie/${mediaId}`;

  const handleReturnToDetails = () => {
    navigate({
      to: "/details",
      search: {
        id: mediaId,
        type: inferredMediaType,
      },
    });
  };

  const handleToggleMyList = () => {
    const mediaPayload: MediaItem = {
      id: `${inferredMediaType}-${mediaId}`,
      title,
      description: overview,
      image: mediaDetails?.poster_path
        ? `https://image.tmdb.org/t/p/${posterWidth}${mediaDetails.poster_path}`
        : "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=900&q=80",
      href: `/details?id=${mediaId}&type=${inferredMediaType}`,
      genre: genres,
      year: releaseYear || undefined,
      rating: rating !== "N/A" ? rating : undefined,
      mediaType: inferredMediaType,
    };
    const added = toggleMyList(mediaPayload);
    setInMyList(added);
    showToast(
      added ? `🔖 Added "${title}" to My List!` : `Removed "${title}" from My List.`
    );
  };

  const handleToggleWatched = () => {
    const epId =
      inferredMediaType === "tv"
        ? `${mediaId}-s${season}-e${episode}`
        : `${mediaId}-s1-e1`;
    const nextCompleted = !isCurrentItemWatched;
    markEpisodeCompleted(mediaId, epId, nextCompleted);
    setWatchedMapTick((t) => t + 1);
    showToast(
      nextCompleted
        ? `👁️ ✓ Marked ${
            inferredMediaType === "tv" ? `S${season}E${episode}` : title
          } as Watched!`
        : "Marked as In Progress."
    );
  };

  const handleReportBrokenStream = () => {
    const result = reportBrokenLink(`${inferredMediaType}-${mediaId}`, {
      title,
      mediaType: inferredMediaType,
      reason:
        inferredMediaType === "tv"
          ? `Player issue on S${season}E${episode}`
          : "Player stream issue",
    });
    showToast(`🚩 ${result.message}`);
  };

  const handleDislikeTitle = () => {
    dislikeTitle({
      id: mediaId,
      title,
      mediaType: inferredMediaType,
      posterPath: mediaDetails?.poster_path || null,
    });
    showToast(`👎 "${title}" hidden from catalogs.`);
  };

  const handleToggleAutoPlay = (checked: boolean) => {
    setAutoPlayNext(checked);
    saveAutoPlayNextSetting(checked);
  };

  const pillBtnPadding = largeButtons ? "px-4 py-2.5 text-sm" : "px-3 py-1.5 text-xs";

  return (
    <div
      className={`player-view-wrapper min-h-screen w-full ${themeTokens.pageBg} py-4 sm:py-6 px-3 sm:px-6 md:px-10 text-white overflow-y-auto scroll-smooth transition-colors duration-300 pb-20 relative rounded-3xl`}
    >
      <AppWallpaper backdropUrl={backdropUrl} />
      {!isLowRam && !reducedMotion && !glowOff && (
        <div
          className={`absolute inset-x-0 -top-10 h-[32rem] bg-gradient-to-b ${themeTokens.ambient} blur-3xl z-0 pointer-events-none rounded-t-3xl`}
        />
      )}

      {/* Cinema Lights-Out Backdrop (Dims surroundings WITHOUT touching or remounting the iframe) */}
      {cinemaDimMode && (
        <div
          className="rabtv-vidsrc-protected fixed inset-0 bg-black/92 z-30 transition-opacity duration-300"
          onClick={() => setCinemaDimMode(false)}
          aria-hidden="true"
        />
      )}

      {cinemaDimMode && (
        <button
          type="button"
          onClick={() => setCinemaDimMode(false)}
          className="rabtv-vidsrc-protected fixed top-4 right-4 z-50 rounded-full bg-amber-500/25 hover:bg-amber-500/40 border border-amber-400/60 px-4 py-2 text-xs font-extrabold text-amber-200 shadow-2xl backdrop-blur-xl cursor-pointer transition"
        >
          💡 Turn Lights On (Esc)
        </button>
      )}

      <div className="relative z-10 max-w-6xl mx-auto flex flex-col gap-5">
        {/* Top Navigation Row: Neon Glass Capsules + Live Clock & Sleep Indicator */}
        <div className="w-full flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/"
              className={`group inline-flex items-center gap-2.5 rounded-full bg-slate-900/80 hover:bg-slate-900/95 backdrop-blur-xl pl-3.5 pr-2 ${
                largeButtons ? "py-2.5" : "py-1.5"
              } border border-white/15 hover:border-purple-400/60 shadow-[0_4px_20px_rgba(0,0,0,0.6)] transition-all duration-300 active:scale-95 focus:outline-none focus:ring-4 focus:ring-purple-500/50`}
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

            <button
              type="button"
              onClick={handleReturnToDetails}
              className={`group inline-flex items-center gap-2.5 rounded-full bg-slate-900/80 hover:bg-slate-900/95 backdrop-blur-xl pl-3.5 pr-2 ${
                largeButtons ? "py-2.5" : "py-1.5"
              } border border-white/15 hover:border-cyan-400/60 shadow-[0_4px_20px_rgba(0,0,0,0.6)] transition-all duration-300 active:scale-95 cursor-pointer focus:outline-none focus:ring-4 focus:ring-cyan-500/50`}
            >
              <span className="text-slate-400 group-hover:text-white group-hover:-translate-x-0.5 transition-all text-xs font-bold">
                ‹
              </span>
              <span className="text-xs sm:text-sm font-semibold tracking-wide text-slate-100 group-hover:text-white">
                {inferredMediaType === "tv" ? "TV Details" : "Movie Details"}
              </span>
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-tr from-cyan-500/50 to-blue-500/50 border border-cyan-300/50 text-[11px] font-bold text-white">
                ⓘ
              </span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {sleepTimerMin > 0 && (
              <span className="rounded-full bg-amber-950/80 border border-amber-400/40 px-3 py-1 text-[11px] font-extrabold text-amber-300">
                🌙 Sleep: {sleepTimerMin}m
              </span>
            )}
            <span className="rounded-full bg-slate-950/80 border border-white/15 px-3 py-1 text-[11px] font-extrabold text-slate-200">
              🕒 {liveClock}
            </span>
            <button
              type="button"
              onClick={() => setCinemaDimMode((d) => !d)}
              className={`rounded-full bg-slate-900/85 hover:bg-amber-500/20 border border-white/15 hover:border-amber-400/50 ${pillBtnPadding} font-extrabold text-amber-200 transition cursor-pointer`}
              title="Dim surroundings around the player (L)"
            >
              💡 Lights Out
            </button>
          </div>
        </div>

        {/* Inline Feedback Toast */}
        {actionToast && (
          <div className="rabtv-vidsrc-protected rounded-2xl bg-slate-950/90 border border-cyan-400/50 px-4 py-2 text-center text-xs font-extrabold text-cyan-200 shadow-xl">
            {actionToast}
          </div>
        )}

        {/* TV Season & Episode Control Deck */}
        {inferredMediaType === "tv" && (
          <div
            className={`w-full flex flex-col gap-3 rounded-3xl border ${themeTokens.cardBg} bg-slate-950/85 p-4 sm:p-5 ${
              isLowRam ? "" : "backdrop-blur-2xl"
            } shadow-2xl relative z-20`}
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-sm font-semibold relative flex-1 min-w-[260px]">
                {/* Season Selector */}
                <div className="relative flex-1 min-w-[140px]" ref={seasonRef}>
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 pl-1">
                    Season
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsSeasonOpen(!isSeasonOpen);
                      setIsEpisodeOpen(false);
                    }}
                    className={`flex items-center justify-between w-full gap-3 rounded-xl border border-white/15 bg-black/65 px-3.5 ${
                      largeButtons ? "py-3 text-sm" : "py-2.5 text-xs sm:text-sm"
                    } text-white font-bold shadow-lg focus:outline-none focus:ring-4 ${themeTokens.ring} transition cursor-pointer`}
                  >
                    <span className="truncate">
                      {currentSeasonObj
                        ? currentSeasonObj.name
                        : `Season ${season}`}
                    </span>
                    <span>▾</span>
                  </button>
                  {isSeasonOpen && (
                    <div className="rabtv-vidsrc-protected absolute left-0 right-0 mt-2 z-[999] max-h-60 min-w-[200px] overflow-y-auto rounded-2xl border border-white/15 bg-slate-950/95 shadow-2xl backdrop-blur-xl p-1">
                      {validSeasons.map((s: any) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            setSeason(s.season_number);
                            setEpisode(1);
                            setIsSeasonOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-xl transition cursor-pointer ${
                            season === s.season_number
                              ? `${themeTokens.bg} text-white font-black`
                              : "text-slate-200 hover:bg-white/10"
                          }`}
                        >
                          {s.name} ({s.episode_count} Eps)
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Episode Selector */}
                <div
                  className="relative flex-[1.5] min-w-[180px]"
                  ref={episodeRef}
                >
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 pl-1">
                    Episode
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEpisodeOpen(!isEpisodeOpen);
                      setIsSeasonOpen(false);
                    }}
                    className={`flex items-center justify-between w-full gap-3 rounded-xl border border-white/15 bg-black/65 px-3.5 ${
                      largeButtons ? "py-3 text-sm" : "py-2.5 text-xs sm:text-sm"
                    } text-white font-bold shadow-lg focus:outline-none focus:ring-4 ${themeTokens.ring} transition cursor-pointer`}
                  >
                    <span className="truncate">
                      {currentEpisodeObj
                        ? `Ep ${currentEpisodeObj.episode_number}: ${currentEpisodeObj.name}`
                        : `Episode ${episode}`}
                    </span>
                    <span>▾</span>
                  </button>
                  {isEpisodeOpen && (
                    <div className="rabtv-vidsrc-protected absolute left-0 right-0 mt-2 z-[999] max-h-60 min-w-[240px] overflow-y-auto rounded-2xl border border-white/15 bg-slate-950/95 shadow-2xl backdrop-blur-xl p-1">
                      {seasonEpisodes.length > 0 ? (
                        seasonEpisodes.map((ep: any) => {
                          const epWatched = completedEpisodesSet.has(
                            `s${season}-e${ep.episode_number}`
                          );
                          return (
                            <button
                              key={ep.id}
                              type="button"
                              onClick={() => {
                                setEpisode(ep.episode_number);
                                setIsEpisodeOpen(false);
                              }}
                              className={`w-full flex items-center justify-between gap-2 text-left px-3 py-2 text-xs font-semibold rounded-xl transition cursor-pointer ${
                                episode === ep.episode_number
                                  ? `${themeTokens.bg} text-white font-black`
                                  : "text-slate-200 hover:bg-white/10"
                              }`}
                            >
                              <span className="truncate">
                                Ep {ep.episode_number}: {ep.name}
                              </span>
                              {epWatched && (
                                <span className="text-[10px] text-emerald-300 font-black shrink-0">
                                  ✓
                                </span>
                              )}
                            </button>
                          );
                        })
                      ) : (
                        <div className="px-3 py-2 text-xs text-slate-400 font-bold">
                          Loading episodes...
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Smart Cross-Season Prev / Next Episode & Synced Autoplay Controls */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 pt-1 sm:pt-4">
                <button
                  type="button"
                  onClick={handlePrevEpisode}
                  disabled={!canGoPrevEpisode}
                  className={`rounded-xl border border-white/15 bg-slate-900/90 hover:bg-slate-800 ${
                    largeButtons ? "px-4 py-3 text-sm" : "px-3.5 py-2.5 text-xs"
                  } font-bold text-white transition disabled:opacity-40 cursor-pointer focus:outline-none focus:ring-4 ${themeTokens.ring}`}
                >
                  ◀ Prev
                </button>
                <button
                  type="button"
                  onClick={handleNextEpisode}
                  disabled={!canGoNextEpisode}
                  className={`rounded-xl ${
                    largeButtons ? "px-5 py-3 text-sm" : "px-4 py-2.5 text-xs"
                  } font-extrabold tracking-wide transition transform hover:-translate-y-0.5 active:scale-95 disabled:opacity-40 cursor-pointer focus:outline-none focus:ring-4 ${themeTokens.ring} ${themeTokens.nextBtn}`}
                >
                  {episode >= currentSeasonMaxEp && nextSeasonObj
                    ? `Season ${nextSeasonObj.season_number} Ep 1 ▶`
                    : canGoNextEpisode
                      ? "Next Episode ▶"
                      : "Season Finale"}
                </button>

                {seasonEpisodes.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowEpisodeDrawer((v) => !v)}
                    className={`rounded-xl border border-white/15 bg-white/[0.06] hover:bg-white/[0.14] ${
                      largeButtons ? "px-4 py-3 text-sm" : "px-3 py-2.5 text-xs"
                    } font-bold text-slate-100 transition cursor-pointer`}
                  >
                    📺 {showEpisodeDrawer ? "Hide Guide" : "Episodes"}
                  </button>
                )}

                <label className="inline-flex items-center gap-2 rounded-xl bg-white/[0.04] border border-white/10 px-3 py-2 text-xs font-semibold text-slate-200 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={autoPlayNext}
                    onChange={(e) => handleToggleAutoPlay(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-700 bg-slate-800 text-violet-500 focus:ring-violet-500 focus:outline-none"
                  />
                  <span>Autoplay</span>
                </label>
              </div>
            </div>

            {/* Expandable Visual Episode Guide Strip */}
            {showEpisodeDrawer && seasonEpisodes.length > 0 && (
              <div className="pt-3 border-t border-white/10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-72 overflow-y-auto pr-1 scrollbar-none">
                {seasonEpisodes.map((ep: any) => {
                  const isActive = ep.episode_number === episode;
                  const isDone = completedEpisodesSet.has(
                    `s${season}-e${ep.episode_number}`
                  );
                  return (
                    <button
                      key={ep.id}
                      type="button"
                      onClick={() => {
                        setEpisode(ep.episode_number);
                        setShowEpisodeDrawer(false);
                      }}
                      className={`flex items-center gap-2.5 rounded-2xl border p-2 text-left transition cursor-pointer ${
                        isActive
                          ? `${themeTokens.bg}/30 border-cyan-400/70 ring-1 ring-cyan-400/50`
                          : "bg-black/55 border-white/10 hover:bg-white/[0.08]"
                      }`}
                    >
                      <div className="relative h-14 w-24 shrink-0 rounded-xl overflow-hidden bg-slate-900 border border-white/10">
                        {ep.still_path ? (
                          <img
                            src={`https://image.tmdb.org/t/p/w300${ep.still_path}`}
                            alt={ep.name}
                            loading="lazy"
                            decoding="async"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[10px] font-black text-slate-400">
                            EP {ep.episode_number}
                          </div>
                        )}
                        {isDone && (
                          <span className="absolute top-1 right-1 rounded-md bg-emerald-600/95 px-1.5 py-0.5 text-[9px] font-black text-white">
                            ✓
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-extrabold text-white truncate">
                          {ep.episode_number}. {ep.name || `Episode ${ep.episode_number}`}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {ep.runtime ? `${ep.runtime}m` : ""}
                          {ep.runtime && ep.air_date ? " • " : ""}
                          {ep.air_date || ""}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Theater-Grade Video Player Container (100% Untouched vidsrc Iframe) */}
        <div
          className={`video-player-container relative w-full mx-auto aspect-video overflow-hidden rounded-2xl sm:rounded-3xl bg-black border border-white/20 ${
            cinemaDimMode ? "z-40" : "z-10"
          } ${glowOff ? "shadow-2xl" : themeTokens.playerGlow}`}
        >
          <iframe
            key={`stable-player-${mediaId}-${season}-${episode}`}
            src={embedUrl}
            className="h-full w-full border-0"
            allowFullScreen
            allow="autoplay; encrypted-media; picture-in-picture; accelerometer; gyroscope"
          ></iframe>
        </div>

        {/* Unified High-End Cinema Metadata, Quick Actions & Overview Panel */}
        <div
          className={`relative overflow-hidden w-full rounded-3xl border border-white/15 bg-slate-950/85 ${
            isLowRam ? "" : "backdrop-blur-2xl"
          } p-5 sm:p-7 shadow-[0_16px_50px_rgba(0,0,0,0.75)] flex flex-col gap-4`}
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div className="space-y-2 text-left">
              <div className="flex items-center flex-wrap gap-2">
                <span
                  className={`rounded-full border px-3 py-0.5 text-[10px] font-bold uppercase tracking-widest ${themeTokens.badge}`}
                >
                  {genres}
                </span>
                {inferredMediaType === "tv" && (
                  <span className="rounded-full bg-cyan-500/15 border border-cyan-400/30 px-3 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-cyan-300">
                    Season {season} • Episode {episode}
                  </span>
                )}
                {runtimeMinutes && (
                  <span className="rounded-full bg-white/[0.06] border border-white/10 px-2.5 py-0.5 text-[10px] font-bold text-slate-300">
                    {runtimeMinutes} min
                  </span>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tight leading-tight">
                {title}
                {inferredMediaType === "tv" && currentEpisodeObj?.name
                  ? ` — ${currentEpisodeObj.name}`
                  : ""}
              </h1>
            </div>

            {/* Right Metadata Pills & IMDb Quick Link */}
            <div className="flex items-center flex-wrap gap-2 shrink-0">
              {rating !== "N/A" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-400/30 px-3 py-1.5 text-xs font-extrabold text-amber-300">
                  ★ {rating}
                </span>
              )}
              {releaseYear && (
                <span className="rounded-full bg-white/[0.06] border border-white/10 px-3 py-1.5 text-xs font-bold text-slate-200">
                  {releaseYear}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-400/30 px-3.5 py-1.5 text-xs font-bold text-emerald-300">
                <span>⏱️ Finish:</span>
                <strong className="text-white">{estimatedCompletion}</strong>
              </span>
              <a
                href={imdbLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/40 px-3.5 py-1.5 text-xs font-extrabold text-amber-300 transition transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-amber-400"
                title="View Official IMDb Listing"
              >
                <span>⭐ IMDb</span>
              </a>
            </div>
          </div>

          {/* Cinema Quick Actions Toolbar (My List, Mark Watched, Report Broken, Dislike) */}
          <div className="flex flex-wrap items-center gap-2 pb-1">
            <button
              type="button"
              onClick={handleToggleMyList}
              className={`rounded-xl border ${pillBtnPadding} font-extrabold transition cursor-pointer ${
                inMyList
                  ? "bg-cyan-500/25 border-cyan-400/60 text-cyan-200"
                  : "bg-white/[0.06] hover:bg-white/[0.14] border-white/15 text-slate-200"
              }`}
            >
              {inMyList ? "✓ In My List" : "🔖 Add to My List"}
            </button>

            <button
              type="button"
              onClick={handleToggleWatched}
              className={`rounded-xl border ${pillBtnPadding} font-extrabold transition cursor-pointer ${
                isCurrentItemWatched
                  ? "bg-emerald-500/25 border-emerald-400/60 text-emerald-200"
                  : "bg-white/[0.06] hover:bg-white/[0.14] border-white/15 text-slate-200"
              }`}
            >
              {isCurrentItemWatched ? "👁️ ✓ Watched" : "👁️ Mark Watched"}
            </button>

            <button
              type="button"
              onClick={handleReportBrokenStream}
              className={`rounded-xl border border-red-500/35 bg-red-950/45 hover:bg-red-600/75 ${pillBtnPadding} font-extrabold text-red-200 hover:text-white transition cursor-pointer`}
              title="Report if this stream fails to load"
            >
              🚩 Report Broken Stream
            </button>

            <button
              type="button"
              onClick={handleDislikeTitle}
              className={`rounded-xl border border-amber-500/30 bg-black/55 hover:bg-amber-600/70 ${pillBtnPadding} font-bold text-amber-200 hover:text-white transition cursor-pointer`}
              title="Hide this title from catalogs"
            >
              👎 Dislike
            </button>
          </div>

          {/* Overview Paragraph */}
          <div className="space-y-1.5 text-left">
            <h3 className="text-[10px] uppercase tracking-widest text-slate-400 font-extrabold">
              Synopsis & Overview
            </h3>
            <p className="text-xs sm:text-sm md:text-base leading-relaxed text-slate-300/95 max-w-4xl">
              {inferredMediaType === "tv" && currentEpisodeObj?.overview
                ? currentEpisodeObj.overview
                : overview}
            </p>
          </div>

          {/* Neon Bottom Laser Accent Line */}
          {!glowOff && (
            <div
              className={`absolute inset-x-6 bottom-0 h-[2px] bg-gradient-to-r ${themeTokens.laserLine} opacity-85 shadow-[0_0_15px_rgba(236,72,153,0.9)]`}
            />
          )}
        </div>

        {/* Top Cast Strip (Zero Extra API Calls — Tap Any Actor for Filmography!) */}
        {topCast.length > 0 && (
          <section className="w-full space-y-3 pt-1">
            <div className="flex items-center gap-2.5 px-1">
              <span
                className={`w-1.5 h-6 rounded-full ${themeTokens.accentBar}`}
              />
              <h2 className="text-base sm:text-lg font-black tracking-tight text-white">
                🎭 Starring Cast
              </h2>
            </div>

            <div className="flex gap-4 overflow-x-auto pb-2 px-1 scrollbar-none">
              {topCast.map((actor: any) => (
                <button
                  key={actor.id}
                  type="button"
                  onClick={() =>
                    navigate({ to: "/search", search: { q: actor.name } })
                  }
                  className="group flex flex-col items-center text-center shrink-0 w-20 sm:w-24 cursor-pointer focus:outline-none"
                  title={`Search titles starring ${actor.name}`}
                >
                  <div
                    className={`p-[2px] rounded-full bg-gradient-to-tr ${themeTokens.avatarRing} shadow-lg group-hover:scale-105 transition-transform mb-1.5`}
                  >
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden bg-slate-950 border-2 border-slate-950 flex items-center justify-center">
                      {actor.profilePath ? (
                        <img
                          src={`https://image.tmdb.org/t/p/w185${actor.profilePath}`}
                          alt={actor.name}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-xl">🎭</span>
                      )}
                    </div>
                  </div>
                  <span className="text-[11px] font-bold text-white truncate w-full">
                    {actor.name}
                  </span>
                  {actor.character && (
                    <span className="text-[9px] text-slate-400 truncate w-full">
                      {actor.character}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Similar Recommended Titles */}
        {mappedRecommendations.length > 0 && (
          <div className="w-full mt-2 pt-6 border-t border-white/10 space-y-4">
            <div className="mb-3 flex items-center justify-between px-1 text-left w-full">
              <div className="flex items-center gap-2.5">
                <span
                  className={`w-1.5 h-6 rounded-full ${themeTokens.accentBar}`}
                />
                <h2 className="text-base sm:text-xl font-black tracking-tight text-white flex items-center gap-2">
                  <span>✨ Similar Recommended Titles</span>
                </h2>
              </div>
              <span
                className={`text-xs font-semibold px-3 py-1 rounded-full bg-white/[0.04] border border-white/10 ${themeTokens.text}`}
              >
                {mappedRecommendations.length} matches
              </span>
            </div>

            <div className={gridColsClass}>
              {mappedRecommendations.map((item) => (
                <MediaCard
                  item={item}
                  cardSize={cardSize}
                  appTheme={appTheme}
                  posterAppearance={posterAppearance}
                  posterWidth={posterWidth}
                  largeButtons={largeButtons}
                  key={item.id}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
