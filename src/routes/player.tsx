// src/routes/player.tsx
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef, useMemo } from "react";
import { AppTheme, getSavedTheme, CardSize, getSavedCardSize } from "@/lib/settings";
import { isTitleBroken } from "@/lib/broken-links";
import { MediaCard } from "@/routes/index";
import type { MediaItem } from "@/lib/tmdb-scraper";
import { saveWatchProgress } from "@/lib/watch-history";
import { AppWallpaper } from "@/components/AppWallpaper";
import { bgAudio } from "@/lib/background-audio";
import { initAdBlockerGlobalInterceptors } from "@/lib/adblocker";

const RABBIT_HEADER_PILL = "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/main/assets/rabbit-header-pill.jpg";

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

export function PlayerPage() {
  useEffect(() => {
    if (typeof document === "undefined") return;

    // 1. Tag all legitimate React root elements (<header>, <main>, wallpaper, sideblade, modals)
    // with "rabtv-vidsrc-protected" BEFORE starting the adblocker so its body-child sweeper
    // never removes the root <header> or React portals.
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

    // 2. Register a pre-observer so if the user opens the Profile Side Blade or a Modal
    // while on the player page, it is immediately tagged as protected before the adblocker inspects it.
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

    // 3. Activate adblocker interceptors, DOM watchers, and cleanup rules
    const cleanup = initAdBlockerGlobalInterceptors();

    return () => {
      shieldObserver.disconnect();
      cleanup();
    };
  }, []);

  const search = Route.useSearch();
  const navigate = useNavigate();

  const rawId = String(search.id || "").trim();
  const inferredType: "tv" | "movie" | null = rawId.toLowerCase().startsWith("tv-")
    ? "tv"
    : rawId.toLowerCase().startsWith("movie-")
    ? "movie"
    : null;

  const mediaId = rawId.replace(/^(movie|tv)-/i, "").trim();
  const urlType: "movie" | "tv" =
    inferredType || (search.type === "tv" ? "tv" : "movie");

  const [mediaType, setMediaType] = useState<"movie" | "tv">(urlType);
  const [mediaDetails, setMediaDetails] = useState<any>(null);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [appTheme, setAppTheme] = useState<AppTheme>("violet");
  const [cardSize, setCardSize] = useState<CardSize>("large");

  const [season, setSeason] = useState<number>(search.season > 0 ? search.season : 1);
  const [episode, setEpisode] = useState<number>(search.episode > 0 ? search.episode : 1);
  const [seasonEpisodes, setSeasonEpisodes] = useState<any[]>([]);
  const [autoPlayNext, setAutoPlayNext] = useState(true);

  const [playerLoadTime] = useState<number>(() => Date.now());
  const [estimatedCompletion, setEstimatedCompletion] = useState<string>("--:--");

  const [isSeasonOpen, setIsSeasonOpen] = useState(false);
  const [isEpisodeOpen, setIsEpisodeOpen] = useState(false);

  const seasonRef = useRef<HTMLDivElement>(null);
  const episodeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bgAudio.pause();
  }, [mediaId, season, episode]);

  useEffect(() => {
    setMediaType(urlType);
    setSeason(search.season > 0 ? search.season : 1);
    setEpisode(search.episode > 0 ? search.episode : 1);
    setMediaDetails(null);
    setRecommendations([]);
    setLoading(true);
  }, [mediaId, urlType, search.season, search.episode]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (seasonRef.current && !seasonRef.current.contains(event.target as Node)) {
        setIsSeasonOpen(false);
      }
      if (episodeRef.current && !episodeRef.current.contains(event.target as Node)) {
        setIsEpisodeOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const loadSettings = () => {
      setAppTheme(getSavedTheme());
      setCardSize(getSavedCardSize());
    };
    loadSettings();
    window.addEventListener("storage", loadSettings);
    window.addEventListener("rabtv_settings_updated" as any, loadSettings);
    return () => {
      window.removeEventListener("storage", loadSettings);
      window.removeEventListener("rabtv_settings_updated" as any, loadSettings);
    };
  }, []);

  useEffect(() => {
    async function fetchSeasonEpisodes() {
      if (mediaType !== "tv" || !mediaId) return;
      try {
        const apiKey = import.meta.env.VITE_TMDB_API_KEY as string;
        const res = await fetch(
          `https://api.themoviedb.org/3/tv/${mediaId}/season/${season}?api_key=${apiKey}`
        );
        const data = await res.json();
        setSeasonEpisodes(data.episodes || []);
      } catch (err) {
        console.error("Failed to load season episodes", err);
        setSeasonEpisodes([]);
      }
    }
    fetchSeasonEpisodes();
  }, [season, mediaId, mediaType]);

  useEffect(() => {
    let cancelled = false;

    async function fetchPlayerDetailsWithCache() {
      if (!mediaId) {
        setLoading(false);
        setMediaDetails(null);
        return;
      }

      const apiKey = import.meta.env.VITE_TMDB_API_KEY as string;
      let activeFetchType: "movie" | "tv" = urlType;

      try {
        const cacheKey = `rabtv_cache_${activeFetchType}_${mediaId}`;
        const cachedItem = localStorage.getItem(cacheKey);
        if (cachedItem) {
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
        }

        let res = await fetch(
          `https://api.themoviedb.org/3/${activeFetchType}/${mediaId}?api_key=${apiKey}&append_to_response=credits,external_ids`
        );
        let data = await res.json();

        if (!data || data.success === false || data.status_code) {
          const otherType: "movie" | "tv" =
            activeFetchType === "movie" ? "tv" : "movie";
          res = await fetch(
            `https://api.themoviedb.org/3/${otherType}/${mediaId}?api_key=${apiKey}&append_to_response=credits,external_ids`
          );
          data = await res.json();
          if (data && data.success !== false && !data.status_code) {
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
          localStorage.setItem(
            `rabtv_cache_${activeFetchType}_${mediaId}`,
            JSON.stringify({ data, timestamp: Date.now() })
          );
          setMediaDetails(data);

          try {
            saveWatchProgress({
              id: `${resolvedType}-${mediaId}`,
              mediaId: String(mediaId),
              title: data.title || data.name || "Untitled",
              mediaType: resolvedType,
              posterPath: data.poster_path || null,
              backdropPath: data.backdrop_path || null,
              progressPercent: 0,
              seasonNumber: resolvedType === "tv" ? season : undefined,
              episodeNumber: resolvedType === "tv" ? episode : undefined,
              genreIds: data?.genres?.map((g: any) => g.id) || [],
            });
          } catch (err) {
            console.error("Could not save to watch history", err);
          }
        } else {
          setMediaDetails(null);
        }

        let recRes = await fetch(
          `https://api.themoviedb.org/3/${activeFetchType}/${mediaId}/recommendations?api_key=${apiKey}&language=en-US&page=1`
        );
        let recData = await recRes.json();

        if (!recData?.results || recData.results.length === 0) {
          const popularRes = await fetch(
            `https://api.themoviedb.org/3/${activeFetchType}/popular?api_key=${apiKey}&language=en-US&page=1`
          );
          const popularData = await popularRes.json();
          recData = popularData;
        }

        if (!cancelled && recData?.results) {
          setRecommendations(
            recData.results.filter(
              (item: any) =>
                !isTitleBroken(String(item.id)) &&
                !isTitleBroken(`${activeFetchType}-${item.id}`)
            )
          );
        }
      } catch (err) {
        console.error("Failed to load player details and recommendations", err);
        if (!cancelled) setMediaDetails(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchPlayerDetailsWithCache();
    return () => {
      cancelled = true;
    };
  }, [mediaId, urlType]);

  useEffect(() => {
    if (!mediaDetails) return;
    const runtimeMinutes =
      mediaType === "movie"
        ? mediaDetails.runtime || 120
        : mediaDetails.episode_run_time?.[0] || 45;

    const completionTimestamp = playerLoadTime + runtimeMinutes * 60 * 1000;
    const dateObj = new Date(completionTimestamp);
    const formattedTime = dateObj.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    setEstimatedCompletion(formattedTime);
  }, [mediaDetails, playerLoadTime, mediaType, episode]);

  useEffect(() => {
    if (!mediaDetails || !mediaId) return;
    const resolvedType: "tv" | "movie" =
      mediaDetails?.seasons ||
      mediaDetails?.number_of_seasons ||
      mediaType === "tv"
        ? "tv"
        : "movie";

    try {
      saveWatchProgress({
        id: `${resolvedType}-${mediaId}`,
        mediaId: String(mediaId),
        title: mediaDetails.title || mediaDetails.name || "Untitled",
        mediaType: resolvedType,
        posterPath: mediaDetails.poster_path || null,
        backdropPath: mediaDetails.backdrop_path || null,
        progressPercent: 0,
        seasonNumber: resolvedType === "tv" ? season : undefined,
        episodeNumber: resolvedType === "tv" ? episode : undefined,
        genreIds: mediaDetails?.genres?.map((g: any) => g.id) || [],
      });
    } catch (err) {
      console.error("Could not update watch history", err);
    }
  }, [season, episode, mediaDetails, mediaId, mediaType]);

  const getPageBackground = (theme: AppTheme) => {
    switch (theme) {
      case "red":
        return "bg-gradient-to-br from-zinc-950/85 via-red-950/45 to-black/95";
      case "midnight":
        return "bg-gradient-to-br from-slate-950/85 via-blue-950/45 to-slate-950/95";
      case "emerald":
        return "bg-gradient-to-br from-slate-950/85 via-emerald-950/45 to-slate-950/95";
      case "amber":
        return "bg-gradient-to-br from-stone-950/85 via-yellow-950/45 to-neutral-950/95";
      case "cyan":
        return "bg-gradient-to-br from-slate-950/85 via-cyan-950/45 to-slate-950/95";
      case "violet":
      default:
        return "bg-gradient-to-br from-slate-950/85 via-purple-950/45 to-slate-950/95";
    }
  };

  const getCardBackground = (theme: AppTheme) => {
    switch (theme) {
      case "red":
        return "bg-zinc-950/90 border-red-500/25";
      case "midnight":
        return "bg-slate-950/90 border-blue-500/25";
      case "emerald":
        return "bg-slate-950/90 border-emerald-500/25";
      case "amber":
        return "bg-stone-950/90 border-amber-500/25";
      case "cyan":
        return "bg-slate-950/90 border-cyan-500/25";
      case "violet":
      default:
        return "bg-slate-950/90 border-violet-500/25";
    }
  };

  const getThemeClasses = (theme: AppTheme) => {
    switch (theme) {
      case "red":
        return {
          text: "text-red-400",
          bg: "bg-red-600",
          hoverBg: "hover:bg-red-500",
          border: "border-red-500",
          ring: "focus:ring-red-400",
          shadow: "shadow-red-600/30",
          accentBar: "bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.95)]",
          badge: "text-red-200 border-red-500/30 bg-red-950/60",
          ambient: "from-red-600/20 via-rose-600/5 to-transparent",
          playerGlow: "shadow-[0_25px_70px_rgba(0,0,0,0.95),0_0_40px_rgba(239,68,68,0.22)]",
          laserLine: "from-transparent via-red-500 to-amber-400",
          nextBtn:
            "bg-gradient-to-r from-red-500 via-rose-500 to-amber-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.45)]",
        };
      case "midnight":
        return {
          text: "text-sky-300",
          bg: "bg-blue-600",
          hoverBg: "hover:bg-blue-500",
          border: "border-blue-500",
          ring: "focus:ring-blue-400",
          shadow: "shadow-blue-600/30",
          accentBar: "bg-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.95)]",
          badge: "text-sky-200 border-blue-500/30 bg-blue-950/60",
          ambient: "from-blue-600/20 via-sky-500/5 to-transparent",
          playerGlow: "shadow-[0_25px_70px_rgba(0,0,0,0.95),0_0_40px_rgba(56,189,248,0.22)]",
          laserLine: "from-transparent via-sky-400 to-blue-500",
          nextBtn:
            "bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500 text-slate-950 shadow-[0_0_20px_rgba(56,189,248,0.45)]",
        };
      case "emerald":
        return {
          text: "text-emerald-300",
          bg: "bg-emerald-600",
          hoverBg: "hover:bg-emerald-500",
          border: "border-emerald-500",
          ring: "focus:ring-emerald-400",
          shadow: "shadow-emerald-600/30",
          accentBar: "bg-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.95)]",
          badge: "text-emerald-200 border-emerald-500/30 bg-emerald-950/60",
          ambient: "from-emerald-600/20 via-teal-500/5 to-transparent",
          playerGlow: "shadow-[0_25px_70px_rgba(0,0,0,0.95),0_0_40px_rgba(52,211,153,0.22)]",
          laserLine: "from-transparent via-emerald-400 to-cyan-400",
          nextBtn:
            "bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 text-slate-950 shadow-[0_0_20px_rgba(52,211,153,0.45)]",
        };
      case "amber":
        return {
          text: "text-amber-300",
          bg: "bg-amber-600",
          hoverBg: "hover:bg-amber-500",
          border: "border-amber-500",
          ring: "focus:ring-amber-400",
          shadow: "shadow-amber-600/30",
          accentBar: "bg-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.95)]",
          badge: "text-amber-200 border-amber-500/30 bg-amber-950/60",
          ambient: "from-amber-600/20 via-yellow-500/5 to-transparent",
          playerGlow: "shadow-[0_25px_70px_rgba(0,0,0,0.95),0_0_40px_rgba(245,158,11,0.22)]",
          laserLine: "from-transparent via-amber-400 to-orange-500",
          nextBtn:
            "bg-gradient-to-r from-amber-400 via-yellow-400 to-orange-500 text-slate-950 shadow-[0_0_20px_rgba(245,158,11,0.45)]",
        };
      case "cyan":
        return {
          text: "text-cyan-300",
          bg: "bg-cyan-600",
          hoverBg: "hover:bg-cyan-500",
          border: "border-cyan-500",
          ring: "focus:ring-cyan-400",
          shadow: "shadow-cyan-600/30",
          accentBar: "bg-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.95)]",
          badge: "text-cyan-200 border-cyan-500/30 bg-cyan-950/60",
          ambient: "from-cyan-600/20 via-sky-500/5 to-transparent",
          playerGlow: "shadow-[0_25px_70px_rgba(0,0,0,0.95),0_0_40px_rgba(34,211,238,0.22)]",
          laserLine: "from-transparent via-cyan-400 to-sky-500",
          nextBtn:
            "bg-gradient-to-r from-cyan-400 via-teal-300 to-sky-400 text-slate-950 shadow-[0_0_20px_rgba(34,211,238,0.45)]",
        };
      case "violet":
      default:
        return {
          text: "text-violet-300",
          bg: "bg-violet-600",
          hoverBg: "hover:bg-violet-500",
          border: "border-violet-500",
          ring: "focus:ring-violet-400",
          shadow: "shadow-violet-600/30",
          accentBar: "bg-violet-500 shadow-[0_0_15px_rgba(139,92,246,0.95)]",
          badge: "text-slate-200 border-white/15 bg-white/[0.06]",
          ambient: "from-violet-600/20 via-fuchsia-500/5 to-transparent",
          playerGlow: "shadow-[0_25px_70px_rgba(0,0,0,0.95),0_0_40px_rgba(168,85,247,0.25)]",
          laserLine: "from-transparent via-pink-500 to-cyan-400",
          nextBtn:
            "bg-gradient-to-r from-cyan-400 via-sky-400 to-purple-500 text-slate-950 shadow-[0_0_20px_rgba(56,189,248,0.45)]",
        };
    }
  };

  const activeTheme = getThemeClasses(appTheme);

  const inferredMediaType: "tv" | "movie" =
    mediaDetails?.seasons ||
    mediaDetails?.number_of_seasons ||
    mediaType === "tv"
      ? "tv"
      : "movie";

  const gridColsClass = useMemo(() => {
    if (cardSize === "small") {
      return "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3.5 sm:gap-4 justify-items-center";
    }
    if (cardSize === "medium") {
      return "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-5 justify-items-center";
    }
    return "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 justify-items-center";
  }, [cardSize]);

  const mappedRecommendations: MediaItem[] = useMemo(() => {
    return recommendations.map((rec: any) => {
      const recId = String(rec.id);
      const recTitle = rec.title || rec.name || "Untitled";
      const recPoster = rec.poster_path
        ? `https://image.tmdb.org/t/p/w500${rec.poster_path}`
        : "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=900&q=80";
      const recType: "movie" | "tv" =
        rec.media_type === "tv" || rec.name || !rec.title ? "tv" : "movie";
      const releaseDate = rec.release_date || rec.first_air_date || "";
      const year = releaseDate.split("-")[0];
      const rating = rec.vote_average
        ? rec.vote_average.toFixed(1)
        : undefined;

      return {
        id: `${recType}-${recId}`,
        title: recTitle,
        description: rec.overview || "",
        image: recPoster,
        href: `/details?id=${recId}&type=${recType}`,
        genre: recType === "tv" ? "TV SHOW" : "MOVIE",
        year: year || undefined,
        rating,
        mediaType: recType,
      };
    });
  }, [recommendations]);

  if (loading) {
    return (
      <div
        className={`flex min-h-screen items-center justify-center ${getPageBackground(appTheme)} text-white relative rounded-3xl`}
      >
        <AppWallpaper />
        <p className={`text-xl font-medium animate-pulse ${activeTheme.text} relative z-10`}>
          Loading cinema player...
        </p>
      </div>
    );
  }

  const title = mediaDetails?.title || mediaDetails?.name || "Sample Content";
  const overview =
    mediaDetails?.overview || "No description available for this title.";
  const backdropUrl = mediaDetails?.backdrop_path
    ? `https://image.tmdb.org/t/p/original${mediaDetails.backdrop_path}`
    : null;
  const releaseYear = (
    mediaDetails?.release_date ||
    mediaDetails?.first_air_date ||
    ""
  ).split("-")[0];
  const rating = mediaDetails?.vote_average
    ? mediaDetails.vote_average.toFixed(1)
    : "N/A";
  const genres =
    mediaDetails?.genres?.map((g: any) => g.name).join(", ") || "Entertainment";

  const imdbId =
    mediaDetails?.external_ids?.imdb_id ||
    mediaDetails?.imdb_id ||
    null;
  const imdbLink = imdbId
    ? `https://www.imdb.com/title/${imdbId}/`
    : `https://www.imdb.com/find?q=${encodeURIComponent(title)}`;

  const embedUrl =
    inferredMediaType === "tv"
      ? `https://vidsrc.to/embed/tv/${mediaId}/${season}/${episode}`
      : `https://vidsrc.to/embed/movie/${mediaId}`;

  const currentSeasonObj = mediaDetails?.seasons?.find(
    (s: any) => s.season_number === season
  );
  const currentEpisodeObj = seasonEpisodes?.find(
    (e: any) => e.episode_number === episode
  );

  const handleReturnToDetails = () => {
    navigate({
      to: "/details",
      search: {
        id: mediaId,
        type: inferredMediaType,
      },
    });
  };

  return (
    <div
      className={`player-view-wrapper min-h-screen w-full ${getPageBackground(appTheme)} py-4 sm:py-6 px-3 sm:px-6 md:px-10 text-white overflow-y-auto scroll-smooth transition-colors duration-300 pb-20 relative rounded-3xl`}
    >
      <AppWallpaper backdropUrl={backdropUrl} />
      <div
        className={`absolute inset-x-0 -top-10 h-[32rem] bg-gradient-to-b ${activeTheme.ambient} blur-3xl z-0 pointer-events-none rounded-t-3xl`}
      />

      <div className="relative z-10 max-w-6xl mx-auto flex flex-col gap-5">
        {/* Top Navigation Row: Sleek Side-by-Side Neon Glass Capsule Pills */}
        <div className="w-full flex flex-wrap items-center justify-between gap-2.5">
          <Link
            to="/"
            className="group inline-flex items-center gap-2.5 rounded-full bg-slate-900/80 hover:bg-slate-900/95 backdrop-blur-xl pl-3.5 pr-2 py-1.5 border border-white/15 hover:border-purple-400/60 shadow-[0_4px_20px_rgba(0,0,0,0.6)] hover:shadow-[0_0_20px_rgba(168,85,247,0.35)] transition-all duration-300 transform active:scale-95 focus:outline-none focus:ring-4 focus:ring-purple-500/50"
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

          <button
            type="button"
            onClick={handleReturnToDetails}
            className="group inline-flex items-center gap-2.5 rounded-full bg-slate-900/80 hover:bg-slate-900/95 backdrop-blur-xl pl-3.5 pr-2 py-1.5 border border-white/15 hover:border-cyan-400/60 shadow-[0_4px_20px_rgba(0,0,0,0.6)] hover:shadow-[0_0_20px_rgba(56,189,248,0.35)] transition-all duration-300 transform active:scale-95 cursor-pointer focus:outline-none focus:ring-4 focus:ring-cyan-500/50"
          >
            <span className="text-slate-400 group-hover:text-white group-hover:-translate-x-0.5 transition-all text-xs font-bold">
              ‹
            </span>
            <span className="text-xs sm:text-sm font-semibold tracking-wide text-slate-100 group-hover:text-white">
              Return to {inferredMediaType === "tv" ? "TV Details" : "Movie Details"}
            </span>
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-tr from-cyan-500/50 to-blue-500/50 border border-cyan-300/50 text-[11px] font-bold text-white shadow-[0_0_12px_rgba(56,189,248,0.7)]">
              ⓘ
            </span>
          </button>
        </div>

        {/* TV Season & Episode Control Deck */}
        {inferredMediaType === "tv" && (
          <div
            className={`w-full flex flex-wrap items-center justify-between gap-4 rounded-3xl border ${getCardBackground(appTheme)} bg-slate-950/85 p-4 sm:p-5 backdrop-blur-2xl shadow-2xl relative z-30`}
          >
            <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-sm font-semibold relative flex-1 min-w-[260px]">
              {/* Season Selector */}
              <div className="relative flex-1 min-w-[140px]" ref={seasonRef}>
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 pl-1">
                  Season
                </span>
                <button
                  type="button"
                  onClick={() => setIsSeasonOpen(!isSeasonOpen)}
                  className={`flex items-center justify-between w-full gap-3 rounded-xl border border-white/15 bg-black/60 px-3.5 py-2.5 text-xs sm:text-sm text-white font-bold shadow-lg focus:outline-none focus:ring-4 ${activeTheme.ring} transition`}
                >
                  <span className="truncate">
                    {currentSeasonObj ? currentSeasonObj.name : `Season ${season}`}
                  </span>
                  <span>▾</span>
                </button>
                {isSeasonOpen && (
                  <div className="absolute left-0 right-0 mt-2 z-[999] max-h-60 min-w-[200px] overflow-y-auto rounded-2xl border border-white/15 bg-slate-950/95 shadow-2xl backdrop-blur-xl p-1">
                    {mediaDetails?.seasons
                      ?.filter((s: any) => s.season_number > 0)
                      .map((s: any) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            setSeason(s.season_number);
                            setEpisode(1);
                            setIsSeasonOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-xl transition ${
                            season === s.season_number
                              ? `${activeTheme.bg} text-white font-black`
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
              <div className="relative flex-[1.5] min-w-[180px]" ref={episodeRef}>
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 pl-1">
                  Episode
                </span>
                <button
                  type="button"
                  onClick={() => setIsEpisodeOpen(!isEpisodeOpen)}
                  className={`flex items-center justify-between w-full gap-3 rounded-xl border border-white/15 bg-black/60 px-3.5 py-2.5 text-xs sm:text-sm text-white font-bold shadow-lg focus:outline-none focus:ring-4 ${activeTheme.ring} transition`}
                >
                  <span className="truncate">
                    {currentEpisodeObj
                      ? `Ep ${currentEpisodeObj.episode_number}: ${currentEpisodeObj.name}`
                      : `Episode ${episode}`}
                  </span>
                  <span>▾</span>
                </button>
                {isEpisodeOpen && (
                  <div className="absolute left-0 right-0 mt-2 z-[999] max-h-60 min-w-[240px] overflow-y-auto rounded-2xl border border-white/15 bg-slate-950/95 shadow-2xl backdrop-blur-xl p-1">
                    {seasonEpisodes.length > 0 ? (
                      seasonEpisodes.map((ep: any) => (
                        <button
                          key={ep.id}
                          type="button"
                          onClick={() => {
                            setEpisode(ep.episode_number);
                            setIsEpisodeOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-xl transition ${
                            episode === ep.episode_number
                              ? `${activeTheme.bg} text-white font-black`
                              : "text-slate-200 hover:bg-white/10"
                          }`}
                        >
                          Ep {ep.episode_number}: {ep.name}
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-xs text-slate-400 font-bold">
                        Loading episodes...
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Next / Prev Episode & Autoplay Controls */}
            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 pt-1 sm:pt-4">
              <button
                type="button"
                onClick={() => setEpisode((prev) => Math.max(1, prev - 1))}
                disabled={episode <= 1}
                className={`rounded-xl border border-white/15 bg-slate-900/90 hover:bg-slate-800 px-3.5 py-2.5 text-xs font-bold text-white transition disabled:opacity-40 cursor-pointer focus:outline-none focus:ring-4 ${activeTheme.ring}`}
              >
                ◀ Prev
              </button>
              <button
                type="button"
                onClick={() => setEpisode((prev) => prev + 1)}
                className={`rounded-xl px-4 py-2.5 text-xs font-extrabold tracking-wide transition transform hover:-translate-y-0.5 active:scale-95 cursor-pointer focus:outline-none focus:ring-4 ${activeTheme.ring} ${activeTheme.nextBtn}`}
              >
                Next Episode ▶
              </button>
              <label className="ml-1 inline-flex items-center gap-2 rounded-xl bg-white/[0.04] border border-white/10 px-3 py-2 text-xs font-semibold text-slate-200 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoPlayNext}
                  onChange={(e) => setAutoPlayNext(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-700 bg-slate-800 text-violet-500 focus:ring-violet-500 focus:outline-none"
                />
                <span>Autoplay</span>
              </label>
            </div>
          </div>
        )}

        {/* Theater-Grade Video Player Container (100% Untouched vidsrc Iframe) */}
        <div
          className={`video-player-container relative w-full mx-auto aspect-video overflow-hidden rounded-2xl sm:rounded-3xl bg-black border border-white/20 z-10 ${activeTheme.playerGlow}`}
        >
          <iframe
            key={`stable-player-${mediaId}-${season}-${episode}`}
            src={embedUrl}
            className="h-full w-full border-0"
            allowFullScreen
            allow="autoplay; encrypted-media; picture-in-picture; accelerometer; gyroscope"
          ></iframe>
        </div>

        {/* Unified High-End Cinema Metadata, Finish Time & Overview Panel */}
        <div className="relative overflow-hidden w-full rounded-3xl border border-white/15 bg-slate-950/85 backdrop-blur-2xl p-5 sm:p-7 shadow-[0_16px_50px_rgba(0,0,0,0.75)] flex flex-col gap-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div className="space-y-2 text-left">
              <div className="flex items-center flex-wrap gap-2">
                <span
                  className={`rounded-full border px-3 py-0.5 text-[10px] font-bold uppercase tracking-widest ${activeTheme.badge}`}
                >
                  {genres}
                </span>
                {inferredMediaType === "tv" && (
                  <span className="rounded-full bg-cyan-500/15 border border-cyan-400/30 px-3 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-cyan-300">
                    Season {season} • Episode {episode}
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
          <div
            className={`absolute inset-x-6 bottom-0 h-[2px] bg-gradient-to-r ${activeTheme.laserLine} opacity-85 shadow-[0_0_15px_rgba(236,72,153,0.9)]`}
          />
        </div>

        {/* Similar Recommended Titles */}
        {mappedRecommendations.length > 0 && (
          <div className="w-full mt-4 pt-6 border-t border-white/10 space-y-4">
            <div className="mb-3 flex items-center justify-between px-1 text-left w-full">
              <div className="flex items-center gap-2.5">
                <span className={`w-1.5 h-6 rounded-full ${activeTheme.accentBar}`} />
                <h2 className="text-base sm:text-xl font-black tracking-tight text-white flex items-center gap-2">
                  <span>✨ Similar Recommended Titles</span>
                </h2>
              </div>
              <span
                className={`text-xs font-semibold px-3 py-1 rounded-full bg-white/[0.04] border border-white/10 ${activeTheme.text}`}
              >
                {mappedRecommendations.length} matches
              </span>
            </div>

            <div className={gridColsClass}>
              {mappedRecommendations.slice(0, 10).map((item) => (
                <MediaCard
                  item={item}
                  cardSize={cardSize}
                  appTheme={appTheme}
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
