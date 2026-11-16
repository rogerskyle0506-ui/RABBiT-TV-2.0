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

export function PlayerPage() {
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
    const formattedTime = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
        return "bg-gradient-to-br from-zinc-950/70 via-red-950/35 to-black/80";
      case "midnight":
        return "bg-gradient-to-br from-slate-950/70 via-blue-950/35 to-slate-950/80";
      case "emerald":
        return "bg-gradient-to-br from-slate-950/70 via-emerald-950/35 to-slate-950/80";
      case "amber":
        return "bg-gradient-to-br from-stone-950/70 via-yellow-950/35 to-neutral-950/80";
      case "cyan":
        return "bg-gradient-to-br from-slate-950/70 via-cyan-950/35 to-slate-950/80";
      case "violet":
      default:
        return "bg-gradient-to-br from-slate-950/70 via-purple-950/35 to-slate-950/80";
    }
  };

  const getCardBackground = (theme: AppTheme) => {
    switch (theme) {
      case "red":
        return "bg-[#160404]/90 border-red-500/20";
      case "midnight":
        return "bg-[#03091e]/90 border-blue-500/20";
      case "emerald":
        return "bg-[#031b13]/90 border-emerald-500/20";
      case "amber":
        return "bg-[#221507]/90 border-amber-500/20";
      case "cyan":
        return "bg-[#031d20]/90 border-cyan-500/20";
      case "violet":
      default:
        return "bg-[#090e1f]/90 border-violet-500/20";
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
        };
      case "midnight":
        return {
          text: "text-blue-400",
          bg: "bg-blue-600",
          hoverBg: "hover:bg-blue-500",
          border: "border-blue-500",
          ring: "focus:ring-blue-400",
          shadow: "shadow-blue-600/30",
        };
      case "emerald":
        return {
          text: "text-emerald-400",
          bg: "bg-emerald-600",
          hoverBg: "hover:bg-emerald-500",
          border: "border-emerald-500",
          ring: "focus:ring-emerald-400",
          shadow: "shadow-emerald-600/30",
        };
      case "amber":
        return {
          text: "text-amber-400",
          bg: "bg-amber-600",
          hoverBg: "hover:bg-amber-500",
          border: "border-amber-500",
          ring: "focus:ring-amber-400",
          shadow: "shadow-amber-600/30",
        };
      case "cyan":
        return {
          text: "text-cyan-400",
          bg: "bg-cyan-600",
          hoverBg: "hover:bg-cyan-500",
          border: "border-cyan-500",
          ring: "focus:ring-cyan-400",
          shadow: "shadow-cyan-600/30",
        };
      case "violet":
      default:
        return {
          text: "text-violet-400",
          bg: "bg-violet-600",
          hoverBg: "hover:bg-violet-500",
          border: "border-violet-500",
          ring: "focus:ring-violet-400",
          shadow: "shadow-violet-600/30",
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
      return "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 justify-items-center";
    }
    if (cardSize === "medium") {
      return "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 justify-items-center";
    }
    return "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 justify-items-center";
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
        className={`flex min-h-screen items-center justify-center ${getPageBackground(appTheme)} text-white relative`}
      >
        <AppWallpaper />
        <p className={`text-xl font-medium animate-pulse ${activeTheme.text} relative z-10`}>
          Loading player...
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
      className={`player-view-wrapper min-h-screen w-full ${getPageBackground(appTheme)} py-6 px-4 text-white md:py-10 overflow-y-auto scroll-smooth transition-colors duration-300 pb-20 relative`}
    >
      <AppWallpaper backdropUrl={backdropUrl} />

      <div className="relative z-10 flex flex-col gap-6">
        <div className="w-[80vw] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative flex items-center justify-center py-1.5 px-3 overflow-hidden rounded-2xl shadow-xl w-full sm:w-auto">
            <div
              className="absolute pointer-events-none rounded-2xl border border-white/10 shadow-2xl"
              style={{
                width: "108%",
                height: "280%",
                backgroundImage: `url(${RABBIT_HEADER_PILL})`,
                backgroundSize: "112% 380%",
                backgroundRepeat: "no-repeat",
                backgroundPosition: "center center",
              }}
            />
            <div className="absolute inset-0 bg-black/40 pointer-events-none rounded-2xl z-0" />
            <div className="relative z-10 py-1">
              <Link
                className={`inline-flex items-center gap-2 text-xs sm:text-sm font-bold ${activeTheme.text} transition hover:opacity-80 hover:underline focus:outline-none focus:ring-4 ${activeTheme.ring} focus:rounded-lg px-3 py-1`}
                to="/"
              >
                ← Back to Home
              </Link>
            </div>
          </div>

          <div className="relative flex items-center justify-center py-1.5 px-3 overflow-hidden rounded-2xl shadow-xl w-full sm:w-auto">
            <div
              className="absolute pointer-events-none rounded-2xl border border-white/10 shadow-2xl"
              style={{
                width: "105%",
                height: "300%",
                backgroundImage: `url(${RABBIT_HEADER_PILL})`,
                backgroundSize: "100% 330%",
                backgroundRepeat: "no-repeat",
                backgroundPosition: "center center",
              }}
            />
            <div className="absolute inset-0 bg-black/40 pointer-events-none rounded-2xl z-0" />
            <div className="relative z-10 py-1">
              <button
                type="button"
                onClick={handleReturnToDetails}
                className={`inline-flex items-center gap-2 text-xs sm:text-sm font-bold ${activeTheme.text} transition hover:opacity-80 hover:underline focus:outline-none focus:ring-4 ${activeTheme.ring} focus:rounded-lg px-3 py-1 cursor-pointer`}
              >
                ← Return to {inferredMediaType === "tv" ? "TV details" : "movie details"}
              </button>
            </div>
          </div>
        </div>

        {inferredMediaType === "tv" && (
          <div
            className={`w-[80vw] mx-auto flex flex-wrap items-center justify-between gap-4 rounded-2xl border ${getCardBackground(appTheme)} p-4 backdrop-blur relative z-30`}
          >
            <div className="flex flex-wrap items-center gap-4 text-sm font-semibold relative">
              <div className="relative" ref={seasonRef}>
                <span className="block text-xs text-slate-400 mb-1">Season</span>
                <button
                  type="button"
                  onClick={() => setIsSeasonOpen(!isSeasonOpen)}
                  className={`flex items-center justify-between gap-3 rounded-xl border border-white/10 ${getCardBackground(appTheme)} px-4 py-2 text-white font-medium focus:outline-none focus:ring-4 ${activeTheme.ring}`}
                >
                  <span>
                    {currentSeasonObj
                      ? currentSeasonObj.name
                      : `Season ${season}`}
                  </span>
                  <span>▾</span>
                </button>
                {isSeasonOpen && (
                  <div
                    className={`absolute left-0 mt-2 z-[999] max-h-60 w-56 overflow-y-auto rounded-xl border border-white/20 ${getCardBackground(appTheme)} shadow-2xl backdrop-blur p-1`}
                  >
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
                          className={`w-full text-left px-3 py-2 text-sm rounded-lg transition ${
                            season === s.season_number
                              ? `${activeTheme.bg} text-white font-bold`
                              : "text-slate-200 hover:bg-white/10"
                          }`}
                        >
                          {s.name} ({s.episode_count} Eps)
                        </button>
                      ))}
                  </div>
                )}
              </div>

              <div className="relative" ref={episodeRef}>
                <span className="block text-xs text-slate-400 mb-1">
                  Episode
                </span>
                <button
                  type="button"
                  onClick={() => setIsEpisodeOpen(!isEpisodeOpen)}
                  className={`flex items-center justify-between gap-3 rounded-xl border border-white/10 ${getCardBackground(appTheme)} px-4 py-2 text-white font-medium focus:outline-none focus:ring-4 ${activeTheme.ring}`}
                >
                  <span>
                    {currentEpisodeObj
                      ? `Ep ${currentEpisodeObj.episode_number}: ${currentEpisodeObj.name}`
                      : `Episode ${episode}`}
                  </span>
                  <span>▾</span>
                </button>
                {isEpisodeOpen && (
                  <div
                    className={`absolute left-0 mt-2 z-[999] max-h-60 w-72 overflow-y-auto rounded-xl border border-white/20 ${getCardBackground(appTheme)} shadow-2xl backdrop-blur p-1`}
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
                          className={`w-full text-left px-3 py-2 text-sm rounded-lg transition ${
                            episode === ep.episode_number
                              ? `${activeTheme.bg} text-white font-bold`
                              : "text-slate-200 hover:bg-white/10"
                          }`}
                        >
                          Ep {ep.episode_number}: {ep.name}
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-sm text-slate-400">
                        Loading episodes...
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setEpisode((prev) => Math.max(1, prev - 1))}
                disabled={episode <= 1}
                className={`rounded-xl border border-white/10 bg-slate-800 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-700 disabled:opacity-40 focus:outline-none focus:ring-4 ${activeTheme.ring}`}
              >
                ◀ Previous
              </button>
              <button
                type="button"
                onClick={() => setEpisode((prev) => prev + 1)}
                className={`rounded-xl ${activeTheme.bg} px-4 py-2 text-xs font-semibold text-white shadow transition ${activeTheme.hoverBg} focus:outline-none focus:ring-4 ${activeTheme.ring}`}
              >
                Next Episode ▶
              </button>
              <label className="ml-2 flex items-center gap-2 text-xs font-medium text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoPlayNext}
                  onChange={(e) => setAutoPlayNext(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-700 bg-slate-800 text-violet-600 focus:ring-violet-500 focus:outline-none"
                />
                Autoplay Next
              </label>
            </div>
          </div>
        )}

        <div className="video-player-container relative w-[80vw] mx-auto aspect-video overflow-hidden rounded-2xl bg-black shadow-2xl shadow-black/50 border border-white/10 z-10">
          <iframe
            key={`stable-player-${mediaId}-${season}-${episode}`}
            src={embedUrl}
            className="h-full w-full border-0"
            allowFullScreen
            allow="autoplay; encrypted-media; picture-in-picture; accelerometer; gyroscope"
          ></iframe>
        </div>

        {/* Title & Metadata Pill Box */}
        <div className="relative w-[80vw] mx-auto overflow-hidden rounded-2xl shadow-xl border border-white/15 p-4 flex flex-col items-center justify-center text-center space-y-2">
          <div
            className="absolute inset-0 pointer-events-none z-0"
            style={{
              backgroundImage: `url(${RABBIT_HEADER_PILL})`,
              backgroundSize: "113% 380%",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "center center",
            }}
          />
          <div className="absolute inset-0 bg-black/50 pointer-events-none z-0" />

          <div className="relative z-10 flex flex-col items-center justify-center space-y-1.5 w-full">
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
              {title} {inferredMediaType === "tv" && `(S${season} E${episode})`}
            </h1>

            <div className="flex flex-wrap items-center justify-center gap-2.5 text-xs font-semibold">
              {rating !== "N/A" && (
                <span className="flex items-center gap-1 text-yellow-300 font-bold drop-shadow">
                  ⭐ {rating}
                </span>
              )}
              {releaseYear && (
                <span className="text-slate-300 bg-black/40 px-2 py-0.5 rounded-md border border-white/15">
                  {releaseYear}
                </span>
              )}
              <span className={`uppercase tracking-wider ${activeTheme.text} font-extrabold drop-shadow`}>
                {genres}
              </span>
              <span className="flex items-center gap-1.5 text-slate-300 bg-black/40 px-2 py-0.5 rounded-md border border-white/15">
                <span>⏱️ Finish:</span>
                <span className="font-bold text-white">{estimatedCompletion}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Overview Pill Box (Slightly larger font) */}
        <div className="relative w-[80vw] mx-auto overflow-hidden rounded-2xl shadow-xl border border-white/15 p-5 flex flex-col items-center justify-center text-center space-y-1.5">
          <div
            className="absolute inset-0 pointer-events-none z-0"
            style={{
              backgroundImage: `url(${RABBIT_HEADER_PILL})`,
              backgroundSize: "113% 380%",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "center center",
            }}
          />
          <div className="absolute inset-0 bg-black/50 pointer-events-none z-0" />

          <div className="relative z-10 flex flex-col items-center justify-center space-y-1.5 w-full max-w-3xl">
            <h3 className="text-[10px] uppercase tracking-widest text-slate-300 font-bold">Overview</h3>
            <p className="text-sm sm:text-base leading-relaxed text-slate-200 text-center">
              {overview}
            </p>
          </div>
        </div>

        {mappedRecommendations.length > 0 && (
          <div className="w-[80vw] mx-auto mt-8 pt-4 border-t border-white/10 space-y-4">
            <div className="relative flex items-center justify-center py-1.5 px-3 my-2 max-w-sm mx-auto overflow-hidden rounded-2xl shadow-xl">
              <div
                className="absolute pointer-events-none rounded-2xl border border-white/10 shadow-2xl"
                style={{
                  width: "111%",
                  height: "300%",
                  backgroundImage: `url(${RABBIT_HEADER_PILL})`,
                  backgroundSize: "112% 340%",
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "center center",
                }}
              />
              <div className="absolute inset-0 bg-black/40 pointer-events-none rounded-2xl z-0" />
              <div className="relative z-10 py-1">
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>✨ Similar Recommended Titles</span>
                </h2>
              </div>
            </div>
            <div className={gridColsClass}>
              {mappedRecommendations.slice(0, 10).map((item) => (
                <MediaCard item={item} key={item.id} />
              ))}
            </div>
          </div>
        )}

        <div className="w-[80vw] mx-auto mt-8 pb-8 text-center border-t border-white/10 pt-6">
          <a
            href={imdbLink}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 font-bold text-sm transition hover:bg-amber-500/20 hover:scale-105 focus:outline-none focus:ring-4 focus:ring-amber-400`}
          >
            <span>⭐ View Official IMDb Listing</span>
          </a>
        </div>

      </div>
    </div>
  );
}
