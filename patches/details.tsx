// src/routes/details.tsx
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef, useMemo } from "react";
import { AppTheme, getSavedTheme, CardSize, getSavedCardSize } from "@/lib/settings";
import { reportBrokenLink, isTitleBroken } from "@/lib/broken-links";
import { MediaCard } from "@/routes/index";
import type { MediaItem } from "@/lib/tmdb-scraper";
import { saveWatchProgress, getRawWatchHistory, isTitleDisliked } from "@/lib/watch-history";
import { AppWallpaper } from "@/components/AppWallpaper";
import { bgAudio } from "@/lib/background-audio";

const MY_LIST_STORAGE_KEY = "rabtv_my_list";
const FAVORITES_STORAGE_KEY = "rabtv_favorites";
const RABBIT_HEADER_PILL = "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/main/assets/rabbit-header-pill.jpg";
const RABBIT_PANEL_ALT = "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/main/assets/rabbit-panel-alt.jpg";
const PLAY = "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/play.png";
const MYFAV = "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/MyFav.png";
const SAVEFORLATER = "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/SaveForLater.png";
const REPORTBROKEN = "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/ReportBroken.png";
const BACK_TO_HOME = "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/BackToHome.png";
const CLICK_FOR_TRAILER = "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/ClickForTrailer.png";

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
      if (wasAudioPlayingRef.current && typeof (bgAudio as any)?.play === "function") {
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
        behavior: "smooth",
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
    let inactivityTimer: NodeJS.Timeout;
    const resetInactivityTimer = () => {
      clearTimeout(inactivityTimer);
      setShowScrollReminder(false);
      if (canScrollDown) {
        inactivityTimer = setTimeout(() => setShowScrollReminder(true), 30000);
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
          videos.find((v: any) => v.type === "Trailer" && v.site === "YouTube") ||
          videos.find((v: any) => v.site === "YouTube") ||
          videos[0];

        if (trailer && trailer.key) {
          setTrailerKey(trailer.key);
        }
      } catch (err) {
        console.error("Failed to fetch trailer from TMDB", err);
      }
    }
    fetchTrailer();
    return () => {
      active = false;
    };
  }, [mediaId, mediaType]);

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
        return "bg-slate-950/90 border-red-500/25 shadow-[0_16px_50px_rgba(239,68,68,0.22)]";
      case "midnight":
        return "bg-slate-950/90 border-blue-500/25 shadow-[0_16px_50px_rgba(59,130,246,0.22)]";
      case "emerald":
        return "bg-slate-950/90 border-emerald-500/25 shadow-[0_16px_50px_rgba(16,185,129,0.22)]";
      case "amber":
        return "bg-stone-950/90 border-amber-500/25 shadow-[0_16px_50px_rgba(245,158,11,0.22)]";
      case "cyan":
        return "bg-slate-950/90 border-cyan-500/25 shadow-[0_16px_50px_rgba(6,182,212,0.22)]";
      case "violet":
      default:
        return "bg-slate-950/90 border-violet-500/25 shadow-[0_16px_50px_rgba(139,92,246,0.22)]";
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
          badge: "text-red-300 border-red-500/30 bg-red-950/70",
          ambient: "from-red-600/10 via-transparent to-transparent",
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
          badge: "text-sky-300 border-blue-500/30 bg-blue-950/70",
          ambient: "from-blue-600/10 via-transparent to-transparent",
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
          badge: "text-emerald-300 border-emerald-500/30 bg-emerald-950/70",
          ambient: "from-emerald-600/10 via-transparent to-transparent",
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
          badge: "text-amber-300 border-amber-500/30 bg-amber-950/70",
          ambient: "from-amber-600/10 via-transparent to-transparent",
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
          badge: "text-cyan-300 border-cyan-500/30 bg-cyan-950/70",
          ambient: "from-cyan-600/10 via-transparent to-transparent",
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
          badge: "text-violet-300 border-violet-500/30 bg-purple-950/70",
          ambient: "from-violet-600/10 via-transparent to-transparent",
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
      const myList = JSON.parse(localStorage.getItem(MY_LIST_STORAGE_KEY) || "[]");
      setInMyList(
        myList.some(
          (item: any) => item.id === prefixedId || String(item.mediaId) === mediaId
        )
      );
      const favs = JSON.parse(localStorage.getItem(FAVORITES_STORAGE_KEY) || "[]");
      setInFavorites(
        favs.some(
          (item: any) => item.id === prefixedId || String(item.mediaId) === mediaId
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
          localStorage.setItem(
            `rabtv_cache_${activeFetchType}_${mediaId}`,
            JSON.stringify({ data, timestamp: Date.now() })
          );
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
                !isTitleBroken(`${activeFetchType}-${item.id}`)
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

    fetchDetailsWithCache();
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

  const buildCatalogItem = () => ({
    id: `${inferredMediaType}-${mediaId}`,
    mediaId: String(mediaId),
    title: mediaDetails?.title || mediaDetails?.name || "Untitled",
    description: mediaDetails?.overview || "",
    image: mediaDetails?.poster_path
      ? `https://image.tmdb.org/t/p/w500${mediaDetails.poster_path}`
      : "",
    href: `/details?id=${mediaId}&type=${inferredMediaType}`,
    year: (mediaDetails?.release_date || mediaDetails?.first_air_date || "").split(
      "-"
    )[0],
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
      const myList = JSON.parse(localStorage.getItem(MY_LIST_STORAGE_KEY) || "[]");
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
      const favs = JSON.parse(localStorage.getItem(FAVORITES_STORAGE_KEY) || "[]");
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
    setTimeout(() => {
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
        className={`flex min-h-screen items-center justify-center ${getPageBackground(appTheme)} text-white relative`}
      >
        <AppWallpaper />
        <p className={`text-xl font-medium animate-pulse ${activeTheme.text} relative z-10`}>
          Loading title details...
        </p>
      </div>
    );
  }

  const title = mediaDetails?.title || mediaDetails?.name || "Sample Content";
  const overview =
    mediaDetails?.overview || "No description available for this title.";
  const poster = mediaDetails?.poster_path
    ? `https://image.tmdb.org/t/p/w500${mediaDetails.poster_path}`
    : "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=900&q=80";
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

  const castList = mediaDetails?.credits?.cast || [];
  const budget = mediaDetails?.budget && mediaDetails.budget > 0 ? `$${mediaDetails.budget.toLocaleString()}` : "N/A";
  const productionCompanies = mediaDetails?.production_companies?.map((c: any) => c.name).join(", ") || "N/A";

  const currentSeasonObj = mediaDetails?.seasons?.find(
    (s: any) => s.season_number === season
  );
  const currentEpisodeObj = seasonEpisodes?.find(
    (e: any) => e.episode_number === episode
  );

  return (
    <div
      className={`min-h-screen w-full ${getPageBackground(appTheme)} p-4 sm:p-8 text-white md:p-12 overflow-y-auto scroll-smooth transition-colors duration-300 pb-20 relative rounded-3xl`}
    >
      <style>{`
        @keyframes heartbeatSlow {
          0%, 100% { opacity: 0.42; transform: scale(0.97); }
          18% { opacity: 1; transform: scale(1.04); }
          34% { opacity: 0.65; transform: scale(0.99); }
          50% { opacity: 1; transform: scale(1.03); }
          75% { opacity: 0.5; transform: scale(0.98); }
        }
        .animate-heartbeat-slow {
          animation: heartbeatSlow 3.4s ease-in-out infinite;
        }
        @keyframes ambientPulse {
          0%, 100% { opacity: 0.15; filter: blur(40px) saturate(1.2); }
          50% { opacity: 0.28; filter: blur(55px) saturate(1.6); }
        }
        .animate-ambient-pulse {
          animation: ambientPulse 8s ease-in-out infinite;
        }
      `}</style>

      {/* Layered cinematic glass overlays for Ambient backdrop depths */}
      <AppWallpaper backdropUrl={backdropUrl} />
      <div className={`absolute inset-x-0 -top-12 h-[34rem] bg-gradient-to-b ${activeTheme.ambient} animate-ambient-pulse z-0 pointer-events-none rounded-t-3xl`} />
      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/15 pointer-events-none z-0" />

      <div className="relative z-10 max-w-5xl mx-auto">
        {/* Back to Home Button in Top Left with matching radial edge blending */}
        <div className="mb-4">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 focus:outline-none focus:ring-4 focus:ring-indigo-500 rounded-2xl overflow-hidden cursor-pointer bg-white/[0.03] hover:bg-white/[0.08] backdrop-blur-md px-3 py-1.5 border border-white/10 hover:border-white/20 shadow-md transition duration-300 transform active:scale-95 group"
          >
            <img
              src={BACK_TO_HOME}
              alt="Back to Home"
              className="w-16 sm:w-20 object-contain opacity-60 group-hover:opacity-100 transition duration-300"
              style={{
                maskImage: "radial-gradient(ellipse at center, rgba(0,0,0,1) 40%, rgba(0,0,0,0) 90%)",
                WebkitMaskImage: "radial-gradient(ellipse at center, rgba(0,0,0,1) 40%, rgba(0,0,0,0) 90%)",
              }}
            />
          </Link>
        </div>

        <div className="mx-auto flex flex-col items-center gap-6 text-center">
          
          {/* 3D Spin / Flip Cover Art → Trailer Reveal Component */}
          <div
            className="relative w-[calc(100vw-24px)] sm:w-[420px] md:w-[460px] h-[480px] sm:h-[620px] cursor-pointer select-none my-1"
            style={{ perspective: "1500px" }}
            onClick={() => !isFlipped && setIsFlipped(true)}
          >
            <div
              className={`relative h-full w-full rounded-3xl transition-all duration-700 ease-out hover:shadow-[0_20px_50px_rgba(0,0,0,0.95)]`}
              style={{
                transformStyle: "preserve-3d",
                transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
              }}
            >
              {/* Front: Cover Art with ClickForTrailer Button in Bottom Right */}
              <div
                className="absolute inset-0 h-full w-full rounded-3xl overflow-hidden border border-white/15 bg-black shadow-2xl"
                style={{ backfaceVisibility: "hidden" }}
              >
                <img
                  src={poster}
                  alt={title}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/10 pointer-events-none" />
                {mediaStatusBadge}

                {/* Click For Trailer Button in Bottom Right Corner with pulsing and glowing edge outline */}
                <div className="absolute bottom-4 right-4 z-20 pointer-events-auto transition-transform hover:scale-105 active:scale-95 duration-200">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsFlipped(true);
                    }}
                    className="w-32 sm:w-38 focus:outline-none focus:ring-4 focus:ring-indigo-400 rounded-xl overflow-hidden cursor-pointer bg-black/35 hover:bg-black/45 border border-white/10 hover:border-white/20 backdrop-blur-md px-1.5 py-1 shadow-2xl animate-heartbeat-slow"
                  >
                    <img
                      src={CLICK_FOR_TRAILER}
                      alt="Click for Trailer"
                      className="w-full h-full object-contain opacity-75 hover:opacity-100 transition duration-300"
                      style={{
                        maskImage: "radial-gradient(ellipse at center, rgba(0,0,0,1) 40%, rgba(0,0,0,0) 90%)",
                        WebkitMaskImage: "radial-gradient(ellipse at center, rgba(0,0,0,1) 40%, rgba(0,0,0,0) 90%)",
                      }}
                    />
                  </button>
                </div>
              </div>

              {/* Back: Trailer Player inside Transparent Rabbit Alternate Panel Wrapper */}
              <div
                className={`absolute inset-0 h-full w-full rounded-3xl overflow-hidden flex flex-col border ${activeTheme.border}/40 bg-black/90 shadow-2xl`}
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
                  className={`absolute inset-0 bg-gradient-to-br ${getCardBackground(appTheme)} opacity-40 pointer-events-none z-0`}
                />

                {/* Header / Close bar */}
                <div className="relative z-10 flex items-center justify-between p-3.5 border-b border-white/10 bg-black/75 backdrop-blur-md">
                  <span className={`text-xs font-bold truncate max-w-[200px] sm:max-w-[280px] ${activeTheme.text}`}>
                    Official Trailer • {title}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsFlipped(false);
                    }}
                    className={`w-7 h-7 rounded-full bg-black/80 hover:bg-black text-white flex items-center justify-center text-xs font-bold border ${activeTheme.border}/50 hover:scale-105 active:scale-95 transition cursor-pointer shadow-md`}
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
                      <div className={`w-8 h-8 rounded-full border-2 border-t-transparent ${activeTheme.border} animate-spin`} />
                      <span className="text-xs text-slate-400">
                        Loading official trailer from TMDB...
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Media Details Section */}
          <div
            className={`flex flex-col items-center justify-center gap-5 w-full rounded-3xl border p-6 md:p-8 backdrop-blur-2xl transition-colors duration-300 ${getSmokeWrapperStyle(appTheme)}`}
          >
            <span
              className={`w-fit rounded-full border px-3.5 py-1 text-xs font-semibold uppercase tracking-wider ${activeTheme.badge}`}
            >
              {genres}
            </span>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-white leading-tight">
              {title}
            </h1>

            <div className="flex items-center justify-center flex-wrap gap-2.5 text-xs font-bold text-slate-300">
              {rating !== "N/A" && (
                <span className="flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-400/30 px-3 py-1.5 text-amber-300">
                  ⭐ {rating}
                </span>
              )}
              {releaseYear && (
                <span className="rounded-full bg-white/[0.05] border border-white/10 px-3 py-1.5">
                  {releaseYear}
                </span>
              )}
              {originalLanguageName && (
                <span className="rounded-full bg-white/[0.05] border border-white/10 px-3 py-1.5">
                  {originalLanguageName}
                </span>
              )}
              <span className="uppercase rounded-full bg-slate-950/80 border border-white/10 px-3 py-1.5">
                {inferredMediaType}
              </span>
            </div>

            <p className="max-w-2xl text-sm sm:text-base leading-relaxed text-slate-300 font-medium">
              {overview}
            </p>

            {inferredMediaType === "tv" && mediaDetails?.seasons && (
              <div
                className={`flex flex-wrap items-center justify-center gap-4 rounded-3xl border ${getCardBackground(appTheme)} p-4.5 backdrop-blur-md shadow-xl my-2 w-full max-w-xl`}
              >
                <div className="relative flex-1 min-w-[200px]" ref={seasonRef}>
                  <label className="block text-left text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 pl-1.5">
                    Select Season
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsSeasonOpen(!isSeasonOpen)}
                    className={`flex items-center justify-between w-full gap-6 rounded-2xl border border-white/15 bg-black/60 px-4.5 py-3 text-sm font-bold text-white shadow-lg focus:outline-none focus:ring-4 ${activeTheme.ring} transition`}
                  >
                    <span className="truncate">
                      {currentSeasonObj
                        ? `${currentSeasonObj.name} (${currentSeasonObj.episode_count} Episodes)`
                        : `Season ${season}`}
                    </span>
                    <span>▾</span>
                  </button>
                  {isSeasonOpen && (
                    <div
                      className={`absolute left-0 right-0 mt-2 z-50 max-h-60 overflow-y-auto rounded-2xl border border-white/15 bg-slate-950/95 shadow-2xl backdrop-blur-xl p-1 w-full box-border`}
                    >
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
                            className={`w-full text-left px-3.5 py-2.5 text-xs font-semibold rounded-xl transition ${
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

                <div className="relative flex-1 min-w-[200px]" ref={episodeRef}>
                  <label className="block text-left text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 pl-1.5">
                    Select Episode
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsEpisodeOpen(!isEpisodeOpen)}
                    className={`flex items-center justify-between w-full gap-6 rounded-2xl border border-white/15 bg-black/60 px-4.5 py-3 text-sm font-bold text-white shadow-lg focus:outline-none focus:ring-4 ${activeTheme.ring} transition`}
                  >
                    <span className="truncate">
                      {currentEpisodeObj
                        ? `Ep ${currentEpisodeObj.episode_number}: ${currentEpisodeObj.name}`
                        : `Episode ${episode}`}
                    </span>
                    <span>▾</span>
                  </button>
                  {isEpisodeOpen && (
                    <div
                      className={`absolute left-0 right-0 mt-2 z-50 max-h-60 overflow-y-auto rounded-2xl border border-white/15 bg-slate-950/95 shadow-2xl backdrop-blur-xl p-1 w-full box-border`}
                    >
                      {seasonEpisodes.length > 0 ? (
                        seasonEpisodes.map((ep: any) => (
                          <button
                            key={ep.id}
                            type="button"
                            onClick={() => {
                              setEpisode(ep.episode_number);
                              setIsEpisodeOpen(false);
                            }}
                            className={`w-full text-left px-3.5 py-2.5 text-xs font-semibold rounded-xl transition ${
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

            {/* Action Buttons Grid */}
            <div className="mt-2 grid grid-cols-2 gap-3.5 sm:gap-4 w-full max-w-lg mx-auto">
              <button
                type="button"
                onClick={handlePlay}
                className="relative group p-0 bg-transparent border-0 shadow-none focus:outline-none focus:ring-4 focus:ring-red-500 rounded-2xl overflow-hidden cursor-pointer aspect-[21/9] sm:aspect-[3/1] transform hover:-translate-y-1 hover:shadow-xl hover:shadow-red-500/10 active:translate-y-0.5 duration-300"
              >
                <div className="absolute inset-0 bg-red-600/5 hover:bg-red-600/0 z-0 rounded-2xl" />
                <img
                  src={PLAY}
                  alt="Play"
                  className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition duration-300 rounded-2xl relative z-10"
                />
              </button>

              <button
                type="button"
                onClick={handleReportBroken}
                className="relative group p-0 bg-transparent border-0 shadow-none focus:outline-none focus:ring-4 focus:ring-red-500 rounded-2xl overflow-hidden cursor-pointer aspect-[21/9] sm:aspect-[3/1] transform hover:-translate-y-1 hover:shadow-xl active:translate-y-0.5 duration-300"
                title="Report link as broken and hide globally"
              >
                <div className="absolute inset-0 bg-white/5 hover:bg-white/0 z-0 rounded-2xl" />
                <img
                  src={REPORTBROKEN}
                  alt="Report Broken"
                  className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition duration-300 rounded-2xl relative z-10"
                />
              </button>
             
              <button
                type="button"
                onClick={toggleFavorites}
                className="relative group p-0 bg-transparent border-0 shadow-none focus:outline-none focus:ring-4 focus:ring-amber-400 rounded-2xl overflow-hidden cursor-pointer aspect-[21/9] sm:aspect-[3/1] transform hover:-translate-y-1 hover:shadow-xl hover:shadow-amber-500/10 active:translate-y-0.5 duration-300"
              >
                <div className="absolute inset-0 bg-amber-600/5 hover:bg-amber-600/0 z-0 rounded-2xl" />
                <img
                  src={MYFAV}
                  alt="Favorites"
                  className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition duration-300 rounded-2xl relative z-10"
                />
              </button>

              <button
                type="button"
                onClick={toggleMyList}
                className="relative group p-0 bg-transparent border-0 shadow-none focus:outline-none focus:ring-4 focus:ring-indigo-400 rounded-2xl overflow-hidden cursor-pointer aspect-[21/9] sm:aspect-[3/1] transform hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-500/10 active:translate-y-0.5 duration-300"
              >
                <div className="absolute inset-0 bg-indigo-600/5 hover:bg-indigo-600/0 z-0 rounded-2xl" />
                <img
                  src={SAVEFORLATER}
                  alt="Save for Later"
                  className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition duration-300 rounded-2xl relative z-10"
                />
              </button>
            </div>

            {actionFeedback && (
              <p
                className={`text-xs font-bold ${activeTheme.text} transition animate-fade-in mt-1.5`}
              >
                {actionFeedback}
              </p>
            )}
          </div>

          {/* Cast Section */}
          {castList.length > 0 && (
            <div className={`mt-4 pt-4.5 pb-4 px-4.5 w-full rounded-3xl border ${getCardBackground(appTheme)} bg-slate-950/50 backdrop-blur shadow-2xl space-y-3`}>
              <div className="flex items-center justify-between px-1">
                <h2 className="text-xs font-extrabold uppercase tracking-widest text-slate-200">
                  Cast & Crew
                </h2>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => scrollCast("left")}
                    className="w-7 h-7 rounded-lg bg-black/60 hover:bg-black border border-white/10 flex items-center justify-center text-xs font-bold text-white shadow-md transition cursor-pointer"
                    aria-label="Scroll left"
                  >
                    ◀
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollCast("right")}
                    className="w-7 h-7 rounded-lg bg-black/60 hover:bg-black border border-white/10 flex items-center justify-center text-xs font-bold text-white shadow-md transition cursor-pointer"
                    aria-label="Scroll right"
                  >
                    ▶
                  </button>
                </div>
              </div>
              <div ref={castScrollRef} className="flex gap-4 overflow-x-auto pb-1.5 scrollbar-none scroll-smooth w-full">
                {castList.slice(0, 15).map((actor: any) => (
                  <div
                    key={actor.id}
                    className="flex flex-col items-center text-center shrink-0 w-22"
                  >
                    <div className="w-15 h-15 rounded-full overflow-hidden mb-2 border-2 border-white/10 hover:border-white/25 shadow-md bg-black transition duration-200">
                      <img
                        src={
                          actor.profile_path
                            ? `https://image.tmdb.org/t/p/w200${actor.profile_path}`
                            : "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80"
                        }
                        alt={actor.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    <h3 className="text-[10px] font-extrabold text-white truncate w-full px-0.5">
                      {actor.name}
                    </h3>
                    <p className="text-[9px] text-slate-400 font-semibold truncate w-full px-0.5">
                      {actor.character}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Budget, Production, & Language Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-3 w-full">
            <div className={`rounded-2xl border ${getCardBackground(appTheme)} bg-slate-950/40 p-4 backdrop-blur shadow-lg text-left sm:text-center group ${activeTheme.borderHover} transition duration-300`}>
              <span className="block text-[9px] font-extrabold uppercase tracking-widest text-slate-400 mb-1">
                Budget
              </span>
              <span className="text-sm sm:text-base font-black text-white">{budget}</span>
            </div>
            <div className={`rounded-2xl border ${getCardBackground(appTheme)} bg-slate-950/40 p-4 backdrop-blur shadow-lg text-left sm:text-center group ${activeTheme.borderHover} transition duration-300`}>
              <span className="block text-[9px] font-extrabold uppercase tracking-widest text-slate-400 mb-1">
                Production
              </span>
              <span className="text-sm sm:text-base font-black text-white truncate block" title={productionCompanies}>
                {productionCompanies}
              </span>
            </div>
            <div className={`rounded-2xl border ${getCardBackground(appTheme)} bg-slate-950/40 p-4 backdrop-blur shadow-lg text-left sm:text-center group ${activeTheme.borderHover} transition duration-300`}>
              <span className="block text-[9px] font-extrabold uppercase tracking-widest text-slate-400 mb-1">
                Language
              </span>
              <span className="text-sm sm:text-base font-black text-white">
                {originalLanguageName || "English"}
              </span>
            </div>
          </div>

          {mappedRecommendations.length > 0 && (
            <div className="mt-8 pt-6 border-t border-white/10 space-y-4 w-full">
              {/* Premium header block with Neon Accent Marker */}
              <div className="mb-4 flex items-center justify-between px-1 text-left w-full">
                <div className="flex items-center gap-2.5">
                  <span className={`w-1.5 h-6 rounded-full ${activeTheme.accentBar}`} />
                  <h3 className="text-lg sm:text-xl font-black tracking-tight text-white flex items-center gap-2">
                    <span>✨ Similar Recommended Titles</span>
                  </h3>
                </div>
                <span className={`text-xs font-semibold px-3 py-1 rounded-full bg-white/[0.04] border border-white/10 ${activeTheme.text}`}>
                  {mappedRecommendations.length} matches found
                </span>
              </div>
              <div className={gridColsClass}>
                {mappedRecommendations.slice(0, 10).map((item) => (
                  <MediaCard item={item} cardSize={cardSize} appTheme={appTheme} key={item.id} />
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
                className={`text-xl font-black animate-slow-glow ${getThemeArrowColor(appTheme)}`}
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
