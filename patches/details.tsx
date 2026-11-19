// src/routes/details.tsx
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef, useMemo } from "react";
import {
  AppTheme,
  CardSize,
  PosterAppearanceClasses,
  getSavedTheme,
  getSavedCardSize,
  getSavedUserAge,
  isAllowedForAge,
  getPosterAppearanceClasses,
  getOptimalTmdbImageWidth,
  getHardwareLimits,
  getReducedMotion,
  getLargeButtons,
  getClockFormat,
  formatAppTime,
  getKidsModeLocked,
} from "@/lib/settings";
import { reportBrokenLink, isTitleBroken } from "@/lib/broken-links";
import { MediaCard } from "@/routes/index";
import type { MediaItem } from "@/lib/tmdb-scraper";
import {
  saveWatchProgress,
  getRawWatchHistory,
  isTitleDisliked,
} from "@/lib/watch-history";
import { AppWallpaper } from "@/components/AppWallpaper";
import { bgAudio } from "@/lib/background-audio";

const MY_LIST_STORAGE_KEY = "rabtv_my_list";
const FAVORITES_STORAGE_KEY = "rabtv_favorites";
const RABBIT_PANEL_ALT =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/main/assets/rabbit-panel-alt.jpg";

export const Route = createFileRoute("/details")({
  component: DetailsPage,
  validateSearch: (search: Record<string, unknown>) => ({
    id: search.id != null ? String(search.id) : "",
    type: search.type != null ? String(search.type).toLowerCase() : "movie",
  }),
});

export function DetailsPage() {
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
  const urlType: "movie" | "tv" =
    inferredType || (search.type === "tv" ? "tv" : "movie");

  const [mediaType, setMediaType] = useState<"movie" | "tv">(urlType);
  const [mediaDetails, setMediaDetails] = useState<any>(null);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [appTheme, setAppTheme] = useState<AppTheme>(() => getSavedTheme());
  const [cardSize, setCardSize] = useState<CardSize>(() => getSavedCardSize());
  const [userAge, setUserAge] = useState<number>(() => getSavedUserAge());
  const [kidsLocked, setKidsLocked] = useState<boolean>(() =>
    getKidsModeLocked()
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
  const [largeButtons, setLargeButtons] = useState<boolean>(() =>
    getLargeButtons()
  );
  const [isLowRam, setIsLowRam] = useState<boolean>(
    () => getHardwareLimits().effectiveMode === "low"
  );
  const [clockFormat, setClockFormat] = useState(() => getClockFormat());

  const [inMyList, setInMyList] = useState(false);
  const [inFavorites, setInFavorites] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const [season, setSeason] = useState(1);
  const [episode, setEpisode] = useState(1);
  const [seasonEpisodes, setSeasonEpisodes] = useState<any[]>([]);

  const [isSeasonOpen, setIsSeasonOpen] = useState(false);
  const [isEpisodeOpen, setIsEpisodeOpen] = useState(false);

  const [canScrollDown, setCanScrollDown] = useState(false);
  const [showScrollReminder, setShowScrollReminder] = useState(false);

  // Cover Art Flip & Trailer State
  const [isFlipped, setIsFlipped] = useState(false);
  const [trailerKey, setTrailerKey] = useState<string | null>(null);

  const wasAudioPlayingRef = useRef<boolean>(false);
  const castScrollRef = useRef<HTMLDivElement>(null);
  const seasonRef = useRef<HTMLDivElement>(null);
  const episodeRef = useRef<HTMLDivElement>(null);
  const feedbackTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    setMediaType(urlType);
    setSeason(1);
    setEpisode(1);
    setMediaDetails(null);
    setRecommendations([]);
    setLoading(true);
    setIsFlipped(false);
    setTrailerKey(null);
  }, [mediaId, urlType]);

  // Allow Escape key to exit trailer flip cleanly on TV remotes / keyboards
  useEffect(() => {
    if (!isFlipped) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsFlipped(false);
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isFlipped]);

  // Manage background audio mute/resume during trailer playback
  useEffect(() => {
    if (isFlipped) {
      const audioEl = (bgAudio as any)?.audio || (bgAudio as any)?.element;
      const currentlyPlaying =
        typeof (bgAudio as any)?.isPlaying === "function"
          ? (bgAudio as any).isPlaying()
          : Boolean((bgAudio as any)?.playing || (audioEl && !audioEl.paused));

      if (currentlyPlaying) {
        wasAudioPlayingRef.current = true;
      }

      if (typeof (bgAudio as any)?.mute === "function") {
        (bgAudio as any).mute();
      } else if (typeof (bgAudio as any)?.setMuted === "function") {
        (bgAudio as any).setMuted(true);
      } else {
        bgAudio.pause();
      }
    } else {
      if (typeof (bgAudio as any)?.unmute === "function") {
        (bgAudio as any).unmute();
      } else if (typeof (bgAudio as any)?.setMuted === "function") {
        (bgAudio as any).setMuted(false);
      }
      if (
        wasAudioPlayingRef.current &&
        typeof (bgAudio as any)?.play === "function"
      ) {
        try {
          (bgAudio as any).play();
        } catch {
          // Ignore autoplay restriction if any
        }
        wasAudioPlayingRef.current = false;
      }
    }
  }, [isFlipped]);

  const scrollCast = (direction: "left" | "right") => {
    if (castScrollRef.current) {
      castScrollRef.current.scrollBy({
        left: direction === "left" ? -350 : 350,
        behavior: reducedMotion ? "auto" : "smooth",
      });
    }
  };

  useEffect(() => {
    const checkVerticalScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight;
      const clientHeight = window.innerHeight;
      setCanScrollDown(scrollTop + clientHeight < scrollHeight - 100);
    };
    checkVerticalScroll();
    window.addEventListener("scroll", checkVerticalScroll, { passive: true });
    window.addEventListener("resize", checkVerticalScroll);
    return () => {
      window.removeEventListener("scroll", checkVerticalScroll);
      window.removeEventListener("resize", checkVerticalScroll);
    };
  }, [recommendations, loading]);

  useEffect(() => {
    let inactivityTimer: ReturnType<typeof setTimeout>;
    const resetInactivityTimer = () => {
      clearTimeout(inactivityTimer);
      setShowScrollReminder(false);
      if (canScrollDown && !reducedMotion) {
        inactivityTimer = setTimeout(() => setShowScrollReminder(true), 30000);
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
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const loadSettings = () => {
      const nextTheme = getSavedTheme();
      setAppTheme(nextTheme);
      setCardSize(getSavedCardSize());
      setUserAge(getSavedUserAge());
      setKidsLocked(getKidsModeLocked());
      setPosterAppearance(getPosterAppearanceClasses(nextTheme));
      setPosterWidth(getOptimalTmdbImageWidth());
      setReducedMotion(getReducedMotion());
      setLargeButtons(getLargeButtons());
      setIsLowRam(getHardwareLimits().effectiveMode === "low");
      setClockFormat(getClockFormat());
    };
    loadSettings();
    window.addEventListener("storage", loadSettings);
    window.addEventListener("rabtv_settings_updated", loadSettings);
    window.addEventListener("rabtv_ram_mode_updated", loadSettings);
    return () => {
      window.removeEventListener("storage", loadSettings);
      window.removeEventListener("rabtv_settings_updated", loadSettings);
      window.removeEventListener("rabtv_ram_mode_updated", loadSettings);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    };
  }, []);

  // Fetch Trailer from TMDB API
  useEffect(() => {
    let active = true;
    async function fetchTrailer() {
      if (!mediaId) return;
      try {
        const apiKey = import.meta.env.VITE_TMDB_API_KEY as string;
        const res = await fetch(
          `https://api.themoviedb.org/3/${mediaType}/${mediaId}/videos?api_key=${apiKey}&language=en-US`
        );
        const data = await res.json();
        if (!active) return;
        const videos = data.results || [];
        const trailer =
          videos.find(
            (v: any) => v.type === "Trailer" && v.site === "YouTube"
          ) ||
          videos.find((v: any) => v.site === "YouTube") ||
          videos[0];

        if (trailer && trailer.key) {
          setTrailerKey(trailer.key);
        }
      } catch (err) {
        console.error("Failed to fetch trailer from TMDB", err);
      }
    }
    void fetchTrailer();
    return () => {
      active = false;
    };
  }, [mediaId, mediaType]);

  useEffect(() => {
    let active = true;
    async function fetchSeasonEpisodes() {
      if (mediaType !== "tv" || !mediaId) return;
      try {
        const apiKey = import.meta.env.VITE_TMDB_API_KEY as string;
        const res = await fetch(
          `https://api.themoviedb.org/3/tv/${mediaId}/season/${season}?api_key=${apiKey}`
        );
        const data = await res.json();
        if (active) {
          setSeasonEpisodes(data.episodes || []);
        }
      } catch (err) {
        console.error("Failed to load season episodes", err);
        if (active) setSeasonEpisodes([]);
      }
    }
    void fetchSeasonEpisodes();
    return () => {
      active = false;
    };
  }, [season, mediaId, mediaType]);

  const getPageBackground = (theme: AppTheme) => {
    switch (theme) {
      case "red":
        return "bg-gradient-to-br from-zinc-950/85 via-red-950/45 to-black/90";
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

  const getSmokeWrapperStyle = (theme: AppTheme) => {
    switch (theme) {
      case "red":
        return "bg-slate-950/85 border-red-500/25 shadow-[0_16px_50px_rgba(239,68,68,0.22)]";
      case "midnight":
        return "bg-slate-950/85 border-blue-500/25 shadow-[0_16px_50px_rgba(59,130,246,0.22)]";
      case "emerald":
        return "bg-slate-950/85 border-emerald-500/25 shadow-[0_16px_50px_rgba(16,185,129,0.22)]";
      case "amber":
        return "bg-stone-950/85 border-amber-500/25 shadow-[0_16px_50px_rgba(245,158,11,0.22)]";
      case "cyan":
        return "bg-slate-950/85 border-cyan-500/25 shadow-[0_16px_50px_rgba(6,182,212,0.22)]";
      case "violet":
      default:
        return "bg-slate-950/85 border-violet-500/25 shadow-[0_16px_50px_rgba(139,92,246,0.22)]";
    }
  };

  const getThemeClasses = (theme: AppTheme) => {
    switch (theme) {
      case "red":
        return {
          text: "text-red-400",
          textLight: "text-red-200",
          bg: "bg-red-600",
          hoverBg: "hover:bg-red-500",
          border: "border-red-500",
          borderHover: "group-hover:border-red-500/80",
          ring: "focus:ring-red-400",
          shadow: "shadow-red-600/30",
          accentBar: "bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.95)]",
          badge: "text-red-200 border-red-500/30 bg-red-950/60",
          ambient: "from-red-600/15 via-transparent to-transparent",
          playBtn:
            "bg-gradient-to-r from-red-500 via-rose-500 to-amber-500 text-white shadow-[0_0_25px_rgba(239,68,68,0.5)] hover:shadow-[0_0_35px_rgba(239,68,68,0.75)]",
          laserLine: "from-transparent via-red-500 to-amber-400",
          avatarRing: "from-red-500 via-rose-400 to-amber-400",
        };
      case "midnight":
        return {
          text: "text-sky-300",
          textLight: "text-sky-100",
          bg: "bg-blue-600",
          hoverBg: "hover:bg-blue-500",
          border: "border-blue-500",
          borderHover: "group-hover:border-blue-400/80",
          ring: "focus:ring-blue-400",
          shadow: "shadow-blue-600/30",
          accentBar: "bg-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.95)]",
          badge: "text-sky-200 border-blue-500/30 bg-blue-950/60",
          ambient: "from-blue-600/15 via-transparent to-transparent",
          playBtn:
            "bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500 text-slate-950 shadow-[0_0_25px_rgba(56,189,248,0.5)] hover:shadow-[0_0_35px_rgba(56,189,248,0.75)]",
          laserLine: "from-transparent via-sky-400 to-blue-500",
          avatarRing: "from-cyan-400 via-sky-500 to-indigo-500",
        };
      case "emerald":
        return {
          text: "text-emerald-300",
          textLight: "text-emerald-100",
          bg: "bg-emerald-600",
          hoverBg: "hover:bg-emerald-500",
          border: "border-emerald-500",
          borderHover: "group-hover:border-emerald-400/80",
          ring: "focus:ring-emerald-400",
          shadow: "shadow-emerald-600/30",
          accentBar: "bg-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.95)]",
          badge: "text-emerald-200 border-emerald-500/30 bg-emerald-950/60",
          ambient: "from-emerald-600/15 via-transparent to-transparent",
          playBtn:
            "bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 text-slate-950 shadow-[0_0_25px_rgba(52,211,153,0.5)] hover:shadow-[0_0_35px_rgba(52,211,153,0.75)]",
          laserLine: "from-transparent via-emerald-400 to-cyan-400",
          avatarRing: "from-emerald-400 via-teal-400 to-cyan-500",
        };
      case "amber":
        return {
          text: "text-amber-300",
          textLight: "text-amber-100",
          bg: "bg-amber-600",
          hoverBg: "hover:bg-amber-500",
          border: "border-amber-500",
          borderHover: "group-hover:border-amber-400/80",
          ring: "focus:ring-amber-400",
          shadow: "shadow-amber-600/30",
          accentBar: "bg-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.95)]",
          badge: "text-amber-200 border-amber-500/30 bg-amber-950/60",
          ambient: "from-amber-600/15 via-transparent to-transparent",
          playBtn:
            "bg-gradient-to-r from-amber-400 via-yellow-400 to-orange-500 text-slate-950 shadow-[0_0_25px_rgba(245,158,11,0.5)] hover:shadow-[0_0_35px_rgba(245,158,11,0.75)]",
          laserLine: "from-transparent via-amber-400 to-orange-500",
          avatarRing: "from-amber-400 via-yellow-400 to-orange-500",
        };
      case "cyan":
        return {
          text: "text-cyan-300",
          textLight: "text-cyan-100",
          bg: "bg-cyan-600",
          hoverBg: "hover:bg-cyan-500",
          border: "border-cyan-500",
          borderHover: "group-hover:border-cyan-400/80",
          ring: "focus:ring-cyan-400",
          shadow: "shadow-cyan-600/30",
          accentBar: "bg-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.95)]",
          badge: "text-cyan-200 border-cyan-500/30 bg-cyan-950/60",
          ambient: "from-cyan-600/15 via-transparent to-transparent",
          playBtn:
            "bg-gradient-to-r from-cyan-400 via-teal-300 to-sky-400 text-slate-950 shadow-[0_0_25px_rgba(34,211,238,0.5)] hover:shadow-[0_0_35px_rgba(34,211,238,0.75)]",
          laserLine: "from-transparent via-cyan-400 to-sky-500",
          avatarRing: "from-cyan-400 via-sky-400 to-blue-500",
        };
      case "violet":
      default:
        return {
          text: "text-violet-300",
          textLight: "text-violet-100",
          bg: "bg-violet-600",
          hoverBg: "hover:bg-violet-500",
          border: "border-violet-500",
          borderHover: "group-hover:border-violet-400/80",
          ring: "focus:ring-violet-400",
          shadow: "shadow-violet-600/30",
          accentBar: "bg-violet-500 shadow-[0_0_15px_rgba(139,92,246,0.95)]",
          badge: "text-slate-200 border-white/15 bg-white/[0.06]",
          ambient: "from-violet-600/15 via-transparent to-transparent",
          playBtn:
            "bg-gradient-to-r from-cyan-400 via-sky-400 to-purple-500 text-slate-950 shadow-[0_0_25px_rgba(56,189,248,0.5)] hover:shadow-[0_0_35px_rgba(168,85,247,0.75)]",
          laserLine: "from-transparent via-pink-500 to-cyan-400",
          avatarRing: "from-cyan-400 via-purple-500 to-pink-500",
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

  const activeTheme = getThemeClasses(appTheme);
  const prefixedId = `${mediaType}-${mediaId}`;

  const mediaStatusBadge = useMemo(() => {
    if (!mediaId) return null;
    const cleanId = String(mediaId);
    const prefId = `${mediaType}-${cleanId}`;

    if (isTitleBroken(cleanId) || isTitleBroken(prefId)) {
      return (
        <span className="absolute top-4 left-4 z-20 rounded-xl bg-red-600/90 backdrop-blur-md px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-widest text-white border border-red-400/40 shadow-lg">
          ⚠️ Reported Broken
        </span>
      );
    }

    if (isTitleDisliked(cleanId) || isTitleDisliked(prefId)) {
      return (
        <span className="absolute top-4 left-4 z-20 rounded-xl bg-zinc-800/90 backdrop-blur-md px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-widest text-zinc-300 border border-zinc-600/40 shadow-lg">
          👎 Disliked
        </span>
      );
    }

    try {
      const history = getRawWatchHistory();
      const match = history.find(
        (h) =>
          String(h.id) === prefId ||
          String(h.id) === cleanId ||
          String(h.mediaId) === cleanId
      );

      if (match) {
        if (match.confirmedCompleted || (match.progressPercent ?? 0) >= 100) {
          return (
            <span className="absolute top-4 left-4 z-20 rounded-xl bg-emerald-600/90 backdrop-blur-md px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-widest text-white border border-emerald-400/40 shadow-lg">
              ✓ Completed
            </span>
          );
        }
        if ((match.progressPercent ?? 0) > 0) {
          return (
            <span className="absolute top-4 left-4 z-20 rounded-xl bg-cyan-600/90 backdrop-blur-md px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-widest text-white border border-cyan-400/40 shadow-lg animate-pulse">
              ⏳ In Progress ({match.progressPercent}%)
            </span>
          );
        }
      }
    } catch (e) {
      console.error("Failed to read watch history badge status", e);
    }

    return null;
  }, [mediaId, mediaType]);

  useEffect(() => {
    if (!mediaId || !mediaDetails) return;
    try {
      const myList = JSON.parse(
        localStorage.getItem(MY_LIST_STORAGE_KEY) || "[]"
      );
      setInMyList(
        Array.isArray(myList) &&
          myList.some(
            (item: any) =>
              item.id === prefixedId || String(item.mediaId) === mediaId
          )
      );
      const favs = JSON.parse(
        localStorage.getItem(FAVORITES_STORAGE_KEY) || "[]"
      );
      setInFavorites(
        Array.isArray(favs) &&
          favs.some(
            (item: any) =>
              item.id === prefixedId || String(item.mediaId) === mediaId
          )
      );
    } catch (err) {
      console.error("Error reading saved catalog lists", err);
    }
  }, [mediaId, mediaDetails, mediaType, prefixedId]);

  useEffect(() => {
    let cancelled = false;

    async function fetchDetailsWithCache() {
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
          `https://api.themoviedb.org/3/${activeFetchType}/${mediaId}?api_key=${apiKey}&append_to_response=credits`
        );
        let data = await res.json();

        if (!data || data.success === false || data.status_code) {
          const otherType: "movie" | "tv" =
            activeFetchType === "movie" ? "tv" : "movie";
          res = await fetch(
            `https://api.themoviedb.org/3/${otherType}/${mediaId}?api_key=${apiKey}&append_to_response=credits`
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
          setMediaType(isTv ? "tv" : "movie");
          try {
            localStorage.setItem(
              `rabtv_cache_${activeFetchType}_${mediaId}`,
              JSON.stringify({ data, timestamp: Date.now() })
            );
          } catch {
            // Ignore storage quota errors on 1-2GB sticks
          }
          setMediaDetails(data);
        } else {
          setMediaDetails(null);
        }

        const recRes = await fetch(
          `https://api.themoviedb.org/3/${activeFetchType}/${mediaId}/recommendations?api_key=${apiKey}&language=en-US&page=1`
        );
        const recData = await recRes.json();
        if (!cancelled && recData?.results) {
          setRecommendations(
            recData.results.filter(
              (item: any) =>
                !isTitleBroken(String(item.id)) &&
                !isTitleBroken(`${activeFetchType}-${item.id}`) &&
                !isTitleDisliked(String(item.id)) &&
                !isTitleDisliked(`${activeFetchType}-${item.id}`)
            )
          );
        }
      } catch (err) {
        console.error("Failed to load details and recommendations", err);
        if (!cancelled) setMediaDetails(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchDetailsWithCache();
    return () => {
      cancelled = true;
    };
  }, [mediaId, urlType]);

  const inferredMediaType: "tv" | "movie" =
    mediaDetails?.seasons ||
    mediaDetails?.number_of_seasons ||
    mediaType === "tv"
      ? "tv"
      : "movie";

  const originalLanguageName = useMemo(() => {
    if (!mediaDetails) return "";
    const spoken = mediaDetails?.spoken_languages?.[0]?.english_name;
    if (spoken) return spoken;
    const code = mediaDetails?.original_language;
    if (!code) return "";
    try {
      const displayNames = new Intl.DisplayNames(["en"], { type: "language" });
      const name = displayNames.of(code);
      return name
        ? name.charAt(0).toUpperCase() + name.slice(1)
        : code.toUpperCase();
    } catch {
      return code.toUpperCase();
    }
  }, [mediaDetails]);

  const runtimeSummary = useMemo(() => {
    const mins =
      inferredMediaType === "movie"
        ? mediaDetails?.runtime
        : mediaDetails?.episode_run_time?.[0];
    if (!mins || typeof mins !== "number" || mins <= 0) return null;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const durationText = h > 0 ? `${h}h ${m}m` : `${m}m`;
    const endsAtText = formatAppTime(Date.now() + mins * 60 * 1000, clockFormat);
    return { durationText, endsAtText };
  }, [mediaDetails, inferredMediaType, clockFormat]);

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
    return recommendations
      .filter((rec: any) =>
        isAllowedForAge(
          rec.adult ? "R" : undefined,
          rec.media_type === "tv" ? "TV SHOW" : "MOVIE",
          userAge
        )
      )
      .map((rec: any) => {
        const recId = String(rec.id);
        const recTitle = rec.title || rec.name || "Untitled";
        const recPoster = rec.poster_path
          ? `https://image.tmdb.org/t/p/${posterWidth}${rec.poster_path}`
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
  }, [recommendations, posterWidth, userAge, kidsLocked]);

  const buildCatalogItem = () => ({
    id: `${inferredMediaType}-${mediaId}`,
    mediaId: String(mediaId),
    title: mediaDetails?.title || mediaDetails?.name || "Untitled",
    description: mediaDetails?.overview || "",
    image: mediaDetails?.poster_path
      ? `https://image.tmdb.org/t/p/${posterWidth}${mediaDetails.poster_path}`
      : "",
    href: `/details?id=${mediaId}&type=${inferredMediaType}`,
    year: (
      mediaDetails?.release_date ||
      mediaDetails?.first_air_date ||
      ""
    ).split("-")[0],
    rating: mediaDetails?.vote_average
      ? mediaDetails.vote_average.toFixed(1)
      : undefined,
    mediaType: inferredMediaType,
    genreIds: mediaDetails?.genres?.map((g: any) => g.id) || [],
  });

  const handlePlay = () => {
    if (!mediaDetails || !mediaId) return;

    bgAudio.pause();

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
        genreIds: mediaDetails?.genres?.map((g: any) => g.id) || [],
      });
    } catch (err) {
      console.error("Could not save to watch history", err);
    }

    navigate({
      to: "/player",
      search: {
        id: mediaId,
        type: inferredMediaType,
        season: inferredMediaType === "tv" ? season : 1,
        episode: inferredMediaType === "tv" ? episode : 1,
      },
    });
  };

  const toggleMyList = () => {
    if (!mediaDetails) return;
    const item = buildCatalogItem();
    try {
      const myList = JSON.parse(
        localStorage.getItem(MY_LIST_STORAGE_KEY) || "[]"
      );
      let updatedList;
      if (inMyList) {
        updatedList = myList.filter(
          (i: any) => i.id !== item.id && String(i.mediaId) !== mediaId
        );
        setInMyList(false);
        triggerFeedback("Removed from My List");
      } else {
        updatedList = [
          item,
          ...myList.filter(
            (i: any) => i.id !== item.id && String(i.mediaId) !== mediaId
          ),
        ];
        setInMyList(true);
        triggerFeedback("Saved to My List!");
      }
      localStorage.setItem(MY_LIST_STORAGE_KEY, JSON.stringify(updatedList));
      window.dispatchEvent(new Event("rabtv_catalog_updated"));
    } catch (err) {
      console.error("Failed to update My List", err);
    }
  };

  const toggleFavorites = () => {
    if (!mediaDetails) return;
    const item = buildCatalogItem();
    try {
      const favs = JSON.parse(
        localStorage.getItem(FAVORITES_STORAGE_KEY) || "[]"
      );
      let updatedFavs;
      if (inFavorites) {
        updatedFavs = favs.filter(
          (i: any) => i.id !== item.id && String(i.mediaId) !== mediaId
        );
        setInFavorites(false);
        triggerFeedback("Removed from Favorites");
      } else {
        updatedFavs = [
          item,
          ...favs.filter(
            (i: any) => i.id !== item.id && String(i.mediaId) !== mediaId
          ),
        ];
        setInFavorites(true);
        triggerFeedback("Added to Favorites!");
      }
      localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(updatedFavs));
      window.dispatchEvent(new Event("rabtv_catalog_updated"));
    } catch (err) {
      console.error("Failed to update Favorites", err);
    }
  };

  const handleReportBroken = () => {
    if (!mediaId) return;
    const result = reportBrokenLink(String(mediaId));
    triggerFeedback(result.message);
    window.setTimeout(() => {
      window.location.href = "/";
    }, 1500);
  };

  const triggerFeedback = (msg: string) => {
    setActionFeedback(msg);
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    feedbackTimeoutRef.current = window.setTimeout(() => {
      setActionFeedback(null);
      feedbackTimeoutRef.current = null;
    }, 2500);
  };

  if (loading) {
    return (
      <div
        className={`flex min-h-screen items-center justify-center ${getPageBackground(
          appTheme
        )} text-white relative rounded-3xl`}
      >
        <AppWallpaper />
        <p
          className={`text-xl font-medium animate-pulse ${activeTheme.text} relative z-10`}
        >
          Loading title details...
        </p>
      </div>
    );
  }

  const title = mediaDetails?.title || mediaDetails?.name || "Sample Content";
  const overview =
    mediaDetails?.overview || "No description available for this title.";
  const poster = mediaDetails?.poster_path
    ? `https://image.tmdb.org/t/p/${posterWidth}${mediaDetails.poster_path}`
    : "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=900&q=80";
  const backdropUrl = mediaDetails?.backdrop_path
    ? `https://image.tmdb.org/t/p/${isLowRam ? "w780" : "original"}${
        mediaDetails.backdrop_path
      }`
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

  const castList = mediaDetails?.credits?.cast || [];
  const budget =
    mediaDetails?.budget && mediaDetails.budget > 0
      ? `$${mediaDetails.budget.toLocaleString()}`
      : "N/A";
  const productionCompanies =
    mediaDetails?.production_companies?.map((c: any) => c.name).join(", ") ||
    "N/A";

  const currentSeasonObj = mediaDetails?.seasons?.find(
    (s: any) => s.season_number === season
  );
  const currentEpisodeObj = seasonEpisodes?.find(
    (e: any) => e.episode_number === episode
  );

  const heroPosterRadius = posterAppearance.radiusClass;
  const actionBtnHeight = largeButtons ? "h-14 sm:h-16" : "h-12 sm:h-14";

  return (
    <div
      className={`min-h-screen w-full ${getPageBackground(
        appTheme
      )} p-3 sm:p-6 md:p-10 text-white overflow-y-auto scroll-smooth transition-colors duration-300 pb-20 relative rounded-3xl`}
    >
      <style>{`
        @keyframes heartbeatSlow {
          0%, 100% { opacity: 0.85; transform: scale(0.98); }
          50% { opacity: 1; transform: scale(1.03); }
        }
        .animate-heartbeat-slow {
          animation: heartbeatSlow 3s ease-in-out infinite;
        }
        @keyframes ambientPulse {
          0%, 100% { opacity: 0.18; filter: blur(45px) saturate(1.3); }
          50% { opacity: 0.32; filter: blur(60px) saturate(1.7); }
        }
        .animate-ambient-pulse {
          animation: ambientPulse 8s ease-in-out infinite;
        }
      `}</style>

      {/* Layered cinematic glass overlays for Ambient backdrop depths */}
      <AppWallpaper backdropUrl={backdropUrl} />
      {!isLowRam && !reducedMotion && (
        <div
          className={`absolute inset-x-0 -top-12 h-[34rem] bg-gradient-to-b ${activeTheme.ambient} animate-ambient-pulse z-0 pointer-events-none rounded-t-3xl`}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/20 pointer-events-none z-0" />

      <div className="relative z-10 max-w-5xl mx-auto">
        {/* Top-Left Neon Glass "Back to Home" Capsule Pill */}
        <div className="mb-4 flex items-center justify-start">
          <Link
            to="/"
            className={`group inline-flex items-center gap-3 rounded-full bg-slate-900/80 hover:bg-slate-900/95 backdrop-blur-xl pl-4 pr-2 ${
              largeButtons ? "py-2.5" : "py-1.5"
            } border border-white/15 hover:border-purple-400/60 shadow-[0_4px_20px_rgba(0,0,0,0.6)] hover:shadow-[0_0_20px_rgba(168,85,247,0.35)] transition-all duration-300 transform active:scale-95 focus:outline-none focus:ring-4 focus:ring-purple-500/50`}
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
        </div>

        <div className="mx-auto flex flex-col items-center gap-6">
          {/* 3D Spin / Flip Cover Art → Trailer Reveal Component */}
          <div
            className="relative w-full max-w-[440px] h-[480px] sm:h-[580px] cursor-pointer select-none"
            style={{ perspective: "1500px" }}
            onClick={() => !isFlipped && setIsFlipped(true)}
          >
            <div
              className={`relative h-full w-full ${heroPosterRadius} transition-all duration-700 ease-out`}
              style={{
                transformStyle: "preserve-3d",
                transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
              }}
            >
              {/* Front: Cover Art with Floating Bottom Metadata Pill & Neon ClickForTrailer Square Badge */}
              <div
                className={`absolute inset-0 h-full w-full ${heroPosterRadius} overflow-hidden border border-white/20 bg-black shadow-[0_20px_50px_rgba(0,0,0,0.9),0_0_25px_rgba(168,85,247,0.2)]`}
                style={{ backfaceVisibility: "hidden" }}
              >
                <img
                  src={poster}
                  alt={title}
                  decoding="async"
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/15 to-transparent pointer-events-none" />
                {mediaStatusBadge}

                {/* Bottom Overlay Bar: Metadata Pill on Left + Neon Trailer Square Badge on Right */}
                <div className="absolute inset-x-3.5 bottom-3.5 z-20 flex items-end justify-between gap-2 pointer-events-none">
                  {/* Left: Floating Dark Glass Metadata Pill */}
                  <div className="inline-flex items-center flex-wrap gap-1.5 rounded-full bg-black/75 backdrop-blur-xl border border-white/15 px-3.5 py-1.5 text-[11px] font-bold text-slate-200 shadow-xl">
                    {rating !== "N/A" && (
                      <>
                        <span className="text-amber-400 font-extrabold">
                          ★ {rating}
                        </span>
                        <span className="text-white/25">|</span>
                      </>
                    )}
                    {releaseYear && (
                      <>
                        <span>{releaseYear}</span>
                        <span className="text-white/25">|</span>
                      </>
                    )}
                    <span>{originalLanguageName || "English"}</span>
                    <span className="text-white/25">|</span>
                    <span className="uppercase tracking-wider text-white">
                      {inferredMediaType}
                    </span>
                  </div>

                  {/* Right: Neon Glass "Click for Trailer" Square Badge */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsFlipped(true);
                    }}
                    className={`pointer-events-auto group flex flex-col items-center justify-center gap-1 rounded-2xl bg-slate-950/80 hover:bg-slate-900/95 backdrop-blur-xl border border-purple-400/50 hover:border-cyan-400 px-3 py-2 shadow-[0_0_20px_rgba(168,85,247,0.45)] hover:shadow-[0_0_25px_rgba(56,189,248,0.7)] transition-all duration-300 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-4 focus:ring-purple-500/50 shrink-0 ${
                      reducedMotion ? "" : "animate-heartbeat-slow"
                    }`}
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-full border border-cyan-300/70 bg-gradient-to-tr from-purple-600/50 to-cyan-400/50 text-[10px] text-white shadow-[0_0_10px_rgba(56,189,248,0.6)] group-hover:scale-110 transition-transform">
                      ▶
                    </span>
                    <span className="text-[10px] font-bold leading-tight text-slate-100 text-center">
                      Click for
                      <br />
                      Trailer
                    </span>
                  </button>
                </div>
              </div>

              {/* Back: Trailer Player inside Transparent Rabbit Alternate Panel Wrapper */}
              <div
                className={`absolute inset-0 h-full w-full ${heroPosterRadius} overflow-hidden flex flex-col border ${activeTheme.border}/40 bg-black/95 shadow-2xl`}
                style={{
                  backfaceVisibility: "hidden",
                  transform: "rotateY(180deg)",
                }}
              >
                <div
                  className="absolute inset-0 pointer-events-none z-0"
                  style={{
                    backgroundImage: `url(${RABBIT_PANEL_ALT})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    opacity: 0.35,
                  }}
                />
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${getCardBackground(
                    appTheme
                  )} opacity-40 pointer-events-none z-0`}
                />

                {/* Header / Close bar */}
                <div className="relative z-10 flex items-center justify-between p-3.5 border-b border-white/10 bg-black/75 backdrop-blur-md">
                  <span
                    className={`text-xs font-bold truncate max-w-[200px] sm:max-w-[280px] ${activeTheme.text}`}
                  >
                    Official Trailer • {title}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsFlipped(false);
                    }}
                    className={`w-8 h-8 rounded-full bg-black/80 hover:bg-black text-white flex items-center justify-center text-xs font-bold border ${activeTheme.border}/50 hover:scale-105 active:scale-95 transition cursor-pointer shadow-md`}
                    title="Close Trailer & Return to Cover"
                    aria-label="Close Trailer"
                  >
                    ✕
                  </button>
                </div>

                {/* Trailer Player Container */}
                <div className="relative z-10 flex-1 w-full h-full flex items-center justify-center bg-black/95">
                  {trailerKey && isFlipped ? (
                    <iframe
                      src={`https://www.youtube-nocookie.com/embed/${trailerKey}?autoplay=1&controls=1&modestbranding=1&rel=0`}
                      className="w-full h-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center p-4 text-center gap-2">
                      <div
                        className={`w-8 h-8 rounded-full border-2 border-t-transparent ${activeTheme.border} animate-spin`}
                      />
                      <span className="text-xs text-slate-400">
                        Loading official trailer from TMDB...
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Media Details Card */}
          <div
            className={`flex flex-col items-start text-left gap-4 w-full rounded-3xl border p-5 sm:p-7 md:p-8 backdrop-blur-2xl transition-colors duration-300 ${getSmokeWrapperStyle(
              appTheme
            )}`}
          >
            {/* Genre Capsule */}
            <span
              className={`w-fit rounded-full border px-3.5 py-1 text-[11px] font-bold uppercase tracking-widest ${activeTheme.badge}`}
            >
              {genres}
            </span>

            {/* Crisp High-Contrast Title */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-white leading-tight">
              {title}
            </h1>

            {/* Single-Line Metadata Subtitle + Live Finish Time */}
            <div className="flex items-center flex-wrap gap-2 text-xs sm:text-sm font-medium text-slate-300">
              <span>Content {releaseYear || "2026"}</span>
              <span className="text-white/30">|</span>
              <span>{originalLanguageName || "English"}</span>
              <span className="text-white/30">•</span>
              {rating !== "N/A" && (
                <span className="text-amber-300 font-bold">★ {rating}</span>
              )}
              <span className="uppercase font-bold tracking-wider text-slate-200">
                {inferredMediaType}
              </span>
              {runtimeSummary && (
                <>
                  <span className="text-white/30">•</span>
                  <span className="text-slate-200 font-semibold">
                    {runtimeSummary.durationText}
                  </span>
                  <span className="rounded-full bg-emerald-500/15 border border-emerald-400/30 px-2.5 py-0.5 text-[11px] font-bold text-emerald-300">
                    ⏱️ Ends {runtimeSummary.endsAtText}
                  </span>
                </>
              )}
            </div>

            {/* Overview Paragraph */}
            <p className="max-w-3xl text-xs sm:text-sm md:text-base leading-relaxed text-slate-300/95">
              {overview}
            </p>

            {/* TV Season & Episode Selector Dropdowns */}
            {inferredMediaType === "tv" && mediaDetails?.seasons && (
              <div
                className={`flex flex-wrap items-center justify-between gap-4 rounded-2xl border ${getCardBackground(
                  appTheme
                )} p-4 backdrop-blur-md shadow-xl my-1 w-full`}
              >
                <div className="relative flex-1 min-w-[180px]" ref={seasonRef}>
                  <label className="block text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 pl-1">
                    Select Season
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsSeasonOpen(!isSeasonOpen)}
                    className={`flex items-center justify-between w-full gap-4 rounded-xl border border-white/15 bg-black/60 px-4 ${
                      largeButtons ? "py-3.5 text-sm" : "py-2.5 text-xs sm:text-sm"
                    } font-bold text-white shadow-lg focus:outline-none focus:ring-4 ${
                      activeTheme.ring
                    } transition cursor-pointer`}
                  >
                    <span className="truncate">
                      {currentSeasonObj
                        ? `${currentSeasonObj.name} (${currentSeasonObj.episode_count} Episodes)`
                        : `Season ${season}`}
                    </span>
                    <span>▾</span>
                  </button>
                  {isSeasonOpen && (
                    <div className="absolute left-0 right-0 mt-2 z-50 max-h-60 overflow-y-auto rounded-2xl border border-white/15 bg-slate-950/95 shadow-2xl backdrop-blur-xl p-1 w-full box-border">
                      {mediaDetails.seasons
                        .filter((s: any) => s.season_number > 0)
                        .map((s: any) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                              setSeason(s.season_number);
                              setEpisode(1);
                              setIsSeasonOpen(false);
                            }}
                            className={`w-full text-left px-3.5 py-2.5 text-xs font-semibold rounded-xl transition cursor-pointer ${
                              season === s.season_number
                                ? `${activeTheme.bg} text-white font-black`
                                : "text-slate-200 hover:bg-white/10"
                            }`}
                          >
                            {s.name} ({s.episode_count} Episodes)
                          </button>
                        ))}
                    </div>
                  )}
                </div>

                <div className="relative flex-1 min-w-[180px]" ref={episodeRef}>
                  <label className="block text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 pl-1">
                    Select Episode
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsEpisodeOpen(!isEpisodeOpen)}
                    className={`flex items-center justify-between w-full gap-4 rounded-xl border border-white/15 bg-black/60 px-4 ${
                      largeButtons ? "py-3.5 text-sm" : "py-2.5 text-xs sm:text-sm"
                    } font-bold text-white shadow-lg focus:outline-none focus:ring-4 ${
                      activeTheme.ring
                    } transition cursor-pointer`}
                  >
                    <span className="truncate">
                      {currentEpisodeObj
                        ? `Ep ${currentEpisodeObj.episode_number}: ${currentEpisodeObj.name}`
                        : `Episode ${episode}`}
                    </span>
                    <span>▾</span>
                  </button>
                  {isEpisodeOpen && (
                    <div className="absolute left-0 right-0 mt-2 z-50 max-h-60 overflow-y-auto rounded-2xl border border-white/15 bg-slate-950/95 shadow-2xl backdrop-blur-xl p-1 w-full box-border">
                      {seasonEpisodes.length > 0 ? (
                        seasonEpisodes.map((ep: any) => (
                          <button
                            key={ep.id}
                            type="button"
                            onClick={() => {
                              setEpisode(ep.episode_number);
                              setIsEpisodeOpen(false);
                            }}
                            className={`w-full text-left px-3.5 py-2.5 text-xs font-semibold rounded-xl transition cursor-pointer ${
                              episode === ep.episode_number
                                ? `${activeTheme.bg} text-white font-black`
                                : "text-slate-200 hover:bg-white/10"
                            }`}
                          >
                            Ep {ep.episode_number}: {ep.name}
                          </button>
                        ))
                      ) : (
                        <div className="px-3.5 py-2.5 text-xs text-slate-400 font-bold">
                          Loading episodes...
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 2x2 Neon Glass Action Buttons Grid */}
            <div className="mt-2 grid grid-cols-2 gap-3 sm:gap-4 w-full">
              {/* 1. Play Button */}
              <button
                type="button"
                onClick={handlePlay}
                className={`group relative flex items-center justify-center gap-2.5 ${actionBtnHeight} rounded-2xl font-extrabold text-sm sm:text-base tracking-wide transition-all duration-300 transform hover:-translate-y-0.5 active:scale-95 cursor-pointer focus:outline-none focus:ring-4 focus:ring-cyan-400 ${activeTheme.playBtn}`}
              >
                <span className="text-base sm:text-lg">▶</span>
                <span>
                  {inferredMediaType === "tv"
                    ? `Play S${season}:E${episode}`
                    : "Play"}
                </span>
              </button>

              {/* 2. Report Broken Button */}
              <button
                type="button"
                onClick={handleReportBroken}
                className={`group relative flex items-center justify-center gap-2 ${actionBtnHeight} rounded-2xl bg-slate-900/85 hover:bg-red-950/60 backdrop-blur-xl border border-white/15 hover:border-red-400/70 text-slate-200 hover:text-white font-bold text-xs sm:text-sm tracking-wide shadow-[0_4px_20px_rgba(0,0,0,0.5)] hover:shadow-[0_0_20px_rgba(239,68,68,0.35)] transition-all duration-300 transform hover:-translate-y-0.5 active:scale-95 cursor-pointer focus:outline-none focus:ring-4 focus:ring-red-500/50`}
                title="Report link as broken and hide globally"
              >
                <span className="text-sm sm:text-base text-slate-300 group-hover:text-red-400 transition-colors">
                  △
                </span>
                <span>Report Broken</span>
              </button>

              {/* 3. My Favs Button */}
              <button
                type="button"
                onClick={toggleFavorites}
                className={`group relative flex items-center justify-center gap-2 ${actionBtnHeight} rounded-2xl backdrop-blur-xl border font-bold text-xs sm:text-sm tracking-wide transition-all duration-300 transform hover:-translate-y-0.5 active:scale-95 cursor-pointer focus:outline-none focus:ring-4 focus:ring-purple-500/50 ${
                  inFavorites
                    ? "bg-purple-950/75 border-purple-400 text-white shadow-[0_0_25px_rgba(168,85,247,0.55)]"
                    : "bg-slate-900/85 hover:bg-purple-950/40 border-purple-500/45 hover:border-purple-400 text-slate-200 hover:text-white shadow-[0_0_15px_rgba(168,85,247,0.2)]"
                }`}
              >
                <span
                  className={`text-sm sm:text-base transition-transform group-hover:scale-110 ${
                    inFavorites ? "text-pink-400" : "text-purple-300"
                  }`}
                >
                  {inFavorites ? "♥" : "♡"}
                </span>
                <span>{inFavorites ? "Favorited" : "My Favs"}</span>
              </button>

              {/* 4. Save for Later Button */}
              <button
                type="button"
                onClick={toggleMyList}
                className={`group relative flex items-center justify-center gap-2 ${actionBtnHeight} rounded-2xl backdrop-blur-xl border font-bold text-xs sm:text-sm tracking-wide transition-all duration-300 transform hover:-translate-y-0.5 active:scale-95 cursor-pointer focus:outline-none focus:ring-4 focus:ring-cyan-400/50 ${
                  inMyList
                    ? "bg-cyan-950/75 border-cyan-400 text-white shadow-[0_0_25px_rgba(34,211,238,0.55)]"
                    : "bg-slate-900/85 hover:bg-cyan-950/40 border-cyan-500/45 hover:border-cyan-400 text-slate-200 hover:text-white shadow-[0_0_15px_rgba(34,211,238,0.2)]"
                }`}
              >
                <span
                  className={`text-sm sm:text-base transition-transform group-hover:scale-110 ${
                    inMyList ? "text-cyan-300" : "text-sky-300"
                  }`}
                >
                  {inMyList ? "✓" : "🔖"}
                </span>
                <span>{inMyList ? "Saved" : "Save for Later"}</span>
              </button>
            </div>

            {actionFeedback && (
              <p
                className={`text-xs font-bold ${activeTheme.text} transition animate-fade-in mt-1`}
              >
                {actionFeedback}
              </p>
            )}
          </div>

          {/* Cast Section */}
          {castList.length > 0 && (
            <div className="mt-2 pt-2 pb-1 w-full space-y-3.5">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-xs sm:text-sm font-extrabold uppercase tracking-widest text-white">
                  Cast
                </h2>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => scrollCast("left")}
                    className={`${
                      largeButtons ? "w-9 h-9 text-sm" : "w-7 h-7 text-xs"
                    } rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-white/15 flex items-center justify-center font-bold text-white shadow-md transition cursor-pointer`}
                    aria-label="Scroll cast left"
                  >
                    ◀
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollCast("right")}
                    className={`${
                      largeButtons ? "w-9 h-9 text-sm" : "w-7 h-7 text-xs"
                    } rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-white/15 flex items-center justify-center font-bold text-white shadow-md transition cursor-pointer`}
                    aria-label="Scroll cast right"
                  >
                    ▶
                  </button>
                </div>
              </div>

              <div
                ref={castScrollRef}
                className="flex gap-4 sm:gap-5 overflow-x-auto pb-2 pt-1 px-1 scrollbar-none scroll-smooth w-full"
              >
                {castList.slice(0, 15).map((actor: any) => (
                  <div
                    key={actor.id}
                    className="group flex flex-col items-center text-center shrink-0 w-20 sm:w-24"
                  >
                    <div
                      className={`p-[2.5px] rounded-full bg-gradient-to-tr ${activeTheme.avatarRing} shadow-[0_0_18px_rgba(168,85,247,0.35)] group-hover:shadow-[0_0_25px_rgba(56,189,248,0.65)] transition-all duration-300 mb-2 group-hover:scale-105`}
                    >
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden bg-slate-950 border-2 border-slate-950">
                        <img
                          src={
                            actor.profile_path
                              ? `https://image.tmdb.org/t/p/w200${actor.profile_path}`
                              : "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80"
                          }
                          alt={actor.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          decoding="async"
                        />
                      </div>
                    </div>
                    <h3 className="text-[11px] sm:text-xs font-bold text-white truncate w-full px-0.5">
                      {actor.name}
                    </h3>
                    <p className="text-[10px] text-slate-400 font-medium truncate w-full px-0.5">
                      {actor.character || "Character"}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Budget, Production, & Language Cards */}
          <div className="grid grid-cols-3 gap-2.5 sm:gap-4 mt-1 w-full">
            <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-slate-950/75 p-3 sm:p-4 backdrop-blur-xl shadow-[0_10px_30px_rgba(0,0,0,0.6)] text-left group hover:border-purple-400/50 transition duration-300">
              <span className="block text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Budget
              </span>
              <span className="text-xs sm:text-lg font-black text-white truncate block">
                {budget}
              </span>
              <div
                className={`absolute inset-x-3 bottom-0 h-[2px] bg-gradient-to-r ${activeTheme.laserLine} opacity-85 shadow-[0_0_12px_rgba(236,72,153,0.9)]`}
              />
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-slate-950/75 p-3 sm:p-4 backdrop-blur-xl shadow-[0_10px_30px_rgba(0,0,0,0.6)] text-left group hover:border-purple-400/50 transition duration-300">
              <span className="block text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Production
              </span>
              <span
                className="text-xs sm:text-lg font-black text-white truncate block"
                title={productionCompanies}
              >
                {productionCompanies}
              </span>
              <div
                className={`absolute inset-x-3 bottom-0 h-[2px] bg-gradient-to-r ${activeTheme.laserLine} opacity-85 shadow-[0_0_12px_rgba(236,72,153,0.9)]`}
              />
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-slate-950/75 p-3 sm:p-4 backdrop-blur-xl shadow-[0_10px_30px_rgba(0,0,0,0.6)] text-left group hover:border-purple-400/50 transition duration-300">
              <span className="block text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Language
              </span>
              <span className="text-xs sm:text-lg font-black text-white truncate block">
                {originalLanguageName || "English"}
              </span>
              <div
                className={`absolute inset-x-3 bottom-0 h-[2px] bg-gradient-to-r ${activeTheme.laserLine} opacity-85 shadow-[0_0_12px_rgba(236,72,153,0.9)]`}
              />
            </div>
          </div>

          {/* Similar Recommended Titles */}
          {mappedRecommendations.length > 0 && (
            <div className="mt-6 pt-5 border-t border-white/10 space-y-4 w-full">
              <div className="mb-3 flex items-center justify-between px-1 text-left w-full">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`w-1.5 h-6 rounded-full ${activeTheme.accentBar}`}
                  />
                  <h3 className="text-base sm:text-xl font-black tracking-tight text-white flex items-center gap-2">
                    <span>✨ Similar Recommended Titles</span>
                  </h3>
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
            <div className="flex flex-col items-center gap-0.5 bg-black/35 backdrop-blur-md px-4.5 py-2 rounded-xl border border-white/10 shadow-2xl">
              <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-white">
                More Content Details
              </span>
              <span
                className={`text-xl font-black animate-slow-glow ${getThemeArrowColor(
                  appTheme
                )}`}
              >
                ⌄
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
