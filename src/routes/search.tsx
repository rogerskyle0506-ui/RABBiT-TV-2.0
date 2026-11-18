// src/routes/search.tsx
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import type { MediaItem } from "@/lib/tmdb-scraper";
import {
  CardSize,
  AppTheme,
  getSavedCardSize,
  getSavedTheme,
  getSavedUserAge,
  isAllowedForAge,
} from "@/lib/settings";
import { MediaCard } from "@/routes/index";
import { ScrollPillBar } from "@/components/scroll-pill-bar";
import { AppWallpaper } from "@/components/AppWallpaper";
import React from "react";

const TMDB_API_KEY = (import.meta as any).env?.VITE_TMDB_API_KEY as string || "";
const TMDB_BASE_URL = "https://api.themoviedb.org/3/";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";

const genreMap: Record<string, number> = {
  Action: 28,
  Adventure: 12,
  Animation: 16,
  Comedy: 35,
  Crime: 80,
  Documentary: 99,
  Drama: 18,
  Family: 10751,
  Fantasy: 14,
  History: 36,
  Horror: 27,
  Music: 10402,
  Mystery: 9648,
  Romance: 10749,
  "Sci-Fi": 878,
  Thriller: 53,
  War: 10752,
  Western: 37,
};

const languageFilters = [
  { label: "🌐 All Languages", lang: "", country: "" },
  { label: "🇬🇧 British / English", lang: "en", country: "GB" },
  { label: "🇺🇸 English (US/Global)", lang: "en", country: "" },
  { label: "🇷🇺 Russian", lang: "ru", country: "RU" },
  { label: "🇭🇺 Hungarian", lang: "hu", country: "HU" },
  { label: "🇩🇪 German", lang: "de", country: "DE" },
];

export const Route = createFileRoute("/search")({
  component: SearchPage,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      q: (search.q as string) || "",
    };
  },
});

function SearchPage() {
  const navigate = useNavigate();
  const searchParams = Route.useSearch();

  const [queryInput, setQueryInput] = useState(searchParams.q || "");
  const [mediaType, setMediaType] = useState<"all" | "movie" | "tv">("all");
  const [selectedGenre, setSelectedGenre] = useState<string>("All");
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [minRating, setMinRating] = useState<number>(0);
  const [selectedLangIndex, setSelectedLangIndex] = useState<number>(0);
  const [sortBy] = useState<string>("popularity.desc");

  const [results, setResults] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [appTheme, setAppTheme] = useState<AppTheme>("violet");
  const [cardSize, setCardSize] = useState<CardSize>("large");
  const [userAge, setUserAge] = useState<number>(18);
  const [canScrollDown, setCanScrollDown] = useState<boolean>(false);
  const [showScrollReminder, setShowScrollReminder] = useState<boolean>(false);

  useEffect(() => {
    setAppTheme(getSavedTheme());
    setCardSize(getSavedCardSize());
    setUserAge(getSavedUserAge());
  }, []);

  useEffect(() => {
    const handleScrollCheck = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight;
      const clientHeight = window.innerHeight;

      setCanScrollDown(scrollTop + clientHeight < scrollHeight - 100);
    };

    handleScrollCheck();
    window.addEventListener("scroll", handleScrollCheck, { passive: true });
    window.addEventListener("resize", handleScrollCheck);
    return () => {
      window.removeEventListener("scroll", handleScrollCheck);
      window.removeEventListener("resize", handleScrollCheck);
    };
  }, [results, loading]);

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

  useEffect(() => {
    let active = true;

    async function fetchFilteredCatalog() {
      setLoading(true);
      setError(null);

      try {
        let endpoint = "";
        const urlParams = new URLSearchParams();
        if (TMDB_API_KEY) {
          urlParams.set("api_key", TMDB_API_KEY);
        }
        urlParams.set("sort_by", sortBy);

        const activeQuery = searchParams.q?.trim();
        const activeLangConfig = languageFilters[selectedLangIndex];

        if (activeQuery) {
          endpoint = mediaType === "movie" ? "search/movie" : mediaType === "tv" ? "search/tv" : "search/multi";
          urlParams.set("query", activeQuery);
          if (activeLangConfig.lang) {
            urlParams.set("with_original_language", activeLangConfig.lang);
          }
        } else {
          endpoint = mediaType === "tv" ? "discover/tv" : "discover/movie";

          if (selectedGenre !== "All" && genreMap[selectedGenre]) {
            urlParams.set("with_genres", genreMap[selectedGenre].toString());
          }
          if (selectedYear) {
            if (mediaType === "tv") {
              urlParams.set("first_air_date_year", selectedYear);
            } else {
              urlParams.set("primary_release_year", selectedYear);
            }
          }
          if (minRating > 0) {
            urlParams.set("vote_average.gte", minRating.toString());
          }
          if (activeLangConfig.lang) {
            urlParams.set("with_original_language", activeLangConfig.lang);
          }
          if (activeLangConfig.country) {
            urlParams.set("with_origin_country", activeLangConfig.country);
          }
        }

        const res = await fetch(`${TMDB_BASE_URL}${endpoint}?${urlParams.toString()}`);
        if (!res.ok) throw new Error("Failed to fetch catalog results");
        const data = await res.json();

        if (!active) return;

        const rawItems = (data.results || []) as Record<string, unknown>[];
        const mapped: MediaItem[] = [];

        for (const item of rawItems) {
          const type = (item.media_type as string) || (mediaType === "tv" ? "tv" : mediaType === "movie" ? "movie" : item.first_air_date ? "tv" : "movie");
          const title = (item.title || item.name) as string | undefined;
          if (!title) continue;

          const releaseDate = (item.release_date || item.first_air_date || "") as string;
          const year = releaseDate.split("-")[0];
          const voteAverage = item.vote_average as number | undefined;
          const rating = voteAverage ? voteAverage.toFixed(1) : "N/A";
          const posterPath = item.poster_path as string | undefined;
          const imagePath = posterPath ? `${TMDB_IMAGE_BASE}${posterPath}` : "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=900&q=80";

          if (activeQuery && minRating > 0 && (!voteAverage || voteAverage < minRating)) continue;
          if (activeQuery && selectedYear && year !== selectedYear) continue;

          mapped.push({
            id: `${type}-${item.id}`,
            title,
            description: (item.overview as string) || "No description available.",
            image: imagePath,
            href: `/details?id=${item.id}&type=${type}`,
            genre: type.toUpperCase(),
            year: year || undefined,
            rating: rating !== "N/A" ? rating : undefined,
            mediaType: type as "movie" | "tv",
          });
        }

        setResults(mapped);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        if (active) setLoading(false);
      }
    }

    void fetchFilteredCatalog();
    return () => {
      active = false;
    };
  }, [searchParams.q, mediaType, selectedGenre, selectedYear, minRating, selectedLangIndex, sortBy]);

  const filteredResults = useMemo(() => {
    return results.filter((item) => isAllowedForAge((item as any).certification, item.genre, userAge));
  }, [results, userAge]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate({ to: "/search", search: { q: queryInput.trim() } });
  };

  const gridColsClass = useMemo(() => {
    if (cardSize === "small") {
      return "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3.5 sm:gap-4 justify-items-center";
    }
    if (cardSize === "medium") {
      return "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-5 justify-items-center";
    }
    return "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 justify-items-center";
  }, [cardSize]);

  const getThemeTokens = (theme: AppTheme) => {
    switch (theme) {
      case "red":
        return {
          bg: "bg-gradient-to-br from-zinc-950/85 via-red-950/40 to-black/95",
          accentText: "text-red-400",
          accentBar: "bg-red-500 shadow-[0_0_14px_rgba(239,68,68,0.95)]",
          borderGlow: "border-red-500/25 shadow-[0_16px_50px_rgba(239,68,68,0.22)]",
          btn: "bg-gradient-to-r from-red-600 via-rose-600 to-orange-600 text-white shadow-lg shadow-red-600/30",
          ambient: "from-red-600/15 via-transparent to-transparent",
        };
      case "midnight":
        return {
          bg: "bg-gradient-to-br from-slate-950/85 via-blue-950/40 to-slate-950/95",
          accentText: "text-sky-300",
          accentBar: "bg-sky-400 shadow-[0_0_14px_rgba(56,189,248,0.95)]",
          borderGlow: "border-blue-500/25 shadow-[0_16px_50px_rgba(59,130,246,0.22)]",
          btn: "bg-gradient-to-r from-blue-600 via-cyan-600 to-sky-600 text-white shadow-lg shadow-blue-600/30",
          ambient: "from-blue-600/15 via-transparent to-transparent",
        };
      case "emerald":
        return {
          bg: "bg-gradient-to-br from-slate-950/85 via-emerald-950/40 to-slate-950/95",
          accentText: "text-emerald-300",
          accentBar: "bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.95)]",
          borderGlow: "border-emerald-500/25 shadow-[0_16px_50px_rgba(16,185,129,0.22)]",
          btn: "bg-gradient-to-r from-emerald-600 via-teal-600 to-green-600 text-white shadow-lg shadow-emerald-600/30",
          ambient: "from-emerald-600/15 via-transparent to-transparent",
        };
      case "amber":
        return {
          bg: "bg-gradient-to-br from-stone-950/85 via-yellow-950/40 to-neutral-950/95",
          accentText: "text-amber-300",
          accentBar: "bg-amber-400 shadow-[0_0_14px_rgba(251,191,36,0.95)]",
          borderGlow: "border-amber-500/25 shadow-[0_16px_50px_rgba(245,158,11,0.22)]",
          btn: "bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 text-white shadow-lg shadow-amber-600/30",
          ambient: "from-amber-600/15 via-transparent to-transparent",
        };
      case "cyan":
        return {
          bg: "bg-gradient-to-br from-slate-950/85 via-cyan-950/40 to-slate-950/95",
          accentText: "text-cyan-300",
          accentBar: "bg-cyan-400 shadow-[0_0_14px_rgba(34,211,238,0.95)]",
          borderGlow: "border-cyan-500/25 shadow-[0_16px_50px_rgba(6,182,212,0.22)]",
          btn: "bg-gradient-to-r from-cyan-600 via-teal-600 to-blue-600 text-white shadow-lg shadow-cyan-600/30",
          ambient: "from-cyan-600/15 via-transparent to-transparent",
        };
      case "violet":
      default:
        return {
          bg: "bg-gradient-to-br from-slate-950/85 via-purple-950/40 to-slate-950/95",
          accentText: "text-violet-300",
          accentBar: "bg-violet-500 shadow-[0_0_14px_rgba(139,92,246,0.95)]",
          borderGlow: "border-violet-500/25 shadow-[0_16px_50px_rgba(139,92,246,0.22)]",
          btn: "bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 text-white shadow-lg shadow-violet-600/30",
          ambient: "from-violet-600/15 via-transparent to-transparent",
        };
    }
  };

  const themeTokens = getThemeTokens(appTheme);

  const getThemeArrowColor = (theme: AppTheme) => {
    switch (theme) {
      case "red": return "text-red-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.8)]";
      case "midnight": return "text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.8)]";
      case "emerald": return "text-emerald-300 drop-shadow-[0_0_8px_rgba(110,231,183,0.8)]";
      case "amber": return "text-amber-300 drop-shadow-[0_0_8px_rgba(252,211,77,0.8)]";
      case "cyan": return "text-cyan-300 drop-shadow-[0_0_8px_rgba(103,232,249,0.8)]";
      case "violet":
      default: return "text-purple-400 drop-shadow-[0_0_8px_rgba(192,132,252,0.8)]";
    }
  };

  const getPrimaryBgColor = (theme: AppTheme) => {
    switch (theme) {
      case "red": return "bg-gradient-to-r from-red-600 via-rose-600 to-orange-600 text-white shadow-lg shadow-red-600/30";
      case "midnight": return "bg-gradient-to-r from-blue-600 via-cyan-600 to-sky-600 text-white shadow-lg shadow-blue-600/30";
      case "emerald": return "bg-gradient-to-r from-emerald-600 via-teal-600 to-green-600 text-white shadow-lg shadow-emerald-600/30";
      case "amber": return "bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 text-white shadow-lg shadow-amber-600/30";
      case "cyan": return "bg-gradient-to-r from-cyan-600 via-teal-600 to-blue-600 text-white shadow-lg shadow-cyan-600/30";
      case "violet":
      default: return "bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 text-white shadow-lg shadow-violet-600/30";
    }
  };

  const allGenreOptions = useMemo(() => {
    return [{ id: "All", label: "All" }, ...Object.keys(genreMap).map((g) => ({ id: g, label: g }))];
  }, []);

  const yearOptions = useMemo(() => {
    const years = [{ value: "", label: "✨ Any Year" }];
    const currentYear = new Date().getFullYear();
    for (let y = currentYear; y >= 1950; y--) {
      years.push({ value: y.toString(), label: y.toString() });
    }
    return years;
  }, []);

  return (
    <main className={`min-h-screen ${themeTokens.bg} text-slate-100 px-4 py-6 pb-12 flex flex-col items-center relative rounded-3xl`}>
      <AppWallpaper />
      <div
        className={`absolute inset-x-0 -top-12 h-96 bg-gradient-to-b ${themeTokens.ambient} blur-3xl z-0 pointer-events-none rounded-t-3xl`}
      />

      <div className="mx-auto max-w-7xl w-full space-y-6 relative z-10">
        {/* High-End Glass Filter Control Deck */}
        <div className={`rounded-3xl border bg-slate-950/85 backdrop-blur-2xl p-5 sm:p-7 shadow-2xl ${themeTokens.borderGlow}`}>
          <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3 items-center">
            <div className="relative flex-1 w-full">
              <input
                type="text"
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                placeholder="Optional keyword (e.g. Matrix) or leave blank for pure filters..."
                className="w-full rounded-2xl border border-white/15 bg-black/70 px-4 py-3.5 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-purple-500/40 shadow-inner"
              />
            </div>
            <button
              type="submit"
              className={`w-full sm:w-auto px-7 py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider text-white shadow-xl transition-all duration-300 transform hover:scale-105 active:scale-95 cursor-pointer ${themeTokens.btn}`}
            >
              Apply Filters
            </button>
          </form>

          {/* Filter Dropdowns Grid */}
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-4 border-t border-white/10">
            {/* Media Type Tabs */}
            <div className="flex rounded-xl bg-black/60 border border-white/15 p-1">
              {(["all", "movie", "tv"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setMediaType(t)}
                  className={`flex-1 py-2 rounded-lg text-xs font-black uppercase transition cursor-pointer ${
                    mediaType === t ? `${getPrimaryBgColor(appTheme)} text-white shadow-md` : "text-slate-400 hover:text-white"
                  }`}
                >
                  {t === "all" ? "All" : t === "movie" ? "Movies" : "TV"}
                </button>
              ))}
            </div>

            {/* Language Selector Dropdown */}
            <div className="flex flex-col bg-black/60 border border-white/15 rounded-xl px-3 py-1.5 justify-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Language</span>
              <select
                value={selectedLangIndex}
                onChange={(e) => setSelectedLangIndex(Number(e.target.value))}
                className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer py-1"
              >
                {languageFilters.map((lf, idx) => (
                  <option key={lf.label} value={idx} className="bg-slate-950 text-white p-2">
                    {lf.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Year Selector Dropdown */}
            <div className="flex flex-col bg-black/60 border border-white/15 rounded-xl px-3 py-1.5 justify-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Release Year</span>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer py-1"
              >
                {yearOptions.map((opt) => (
                  <option key={opt.value} value={opt.value} className="bg-slate-950 text-white p-2">
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Min Rating Selector Dropdown */}
            <div className="flex flex-col bg-black/60 border border-white/15 rounded-xl px-3 py-1.5 justify-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Minimum Rating</span>
              <select
                value={minRating}
                onChange={(e) => setMinRating(Number(e.target.value))}
                className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer py-1"
              >
                <option value={0} className="bg-slate-950 text-white">⭐ Any Rating</option>
                <option value={6} className="bg-slate-950 text-white">⭐ 6.0 & Above</option>
                <option value={7} className="bg-slate-950 text-white">⭐ 7.0 & Above</option>
                <option value={8} className="bg-slate-950 text-white">⭐ 8.0 & Above</option>
                <option value={9} className="bg-slate-950 text-white">⭐ 9.0 & Above</option>
              </select>
            </div>
          </div>

          {/* Genre Pill Bar */}
          <div className="mt-4 space-y-1.5">
            <span className="text-xs text-slate-400 font-extrabold uppercase tracking-wider block px-1">Genre:</span>
            <div className="flex justify-center w-full">
              <div className="w-full max-w-4xl flex justify-center">
                <ScrollPillBar
                  options={allGenreOptions}
                  activeId={selectedGenre}
                  onSelect={(id) => setSelectedGenre(id)}
                  appTheme={appTheme}
                  getPrimaryBgColor={getPrimaryBgColor}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Results Header */}
        <div className="flex items-center justify-between px-1 w-full">
          <div className="flex items-center gap-2.5">
            <span className={`w-1.5 h-6 rounded-full ${themeTokens.accentBar}`} />
            <h2 className="text-lg sm:text-xl font-black tracking-tight text-white">
              {searchParams.q ? `Search Results for "${searchParams.q}"` : "Filtered Catalog Results"}
            </h2>
          </div>
          <span className={`text-xs font-semibold px-3 py-1 rounded-full bg-white/[0.05] border border-white/10 ${themeTokens.accentText}`}>
            {filteredResults.length} titles found
          </span>
        </div>

        {loading ? (
          <div className="py-20 text-center text-slate-400 font-bold animate-pulse">
            Loading titles matching your filters...
          </div>
        ) : error ? (
          <div className="py-20 text-center text-red-400 font-bold">Error: {error}</div>
        ) : filteredResults.length > 0 ? (
          <div className={`${gridColsClass} w-full`}>
            {filteredResults.map((item) => (
              <MediaCard item={item} key={item.id} />
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-12 text-center text-slate-400 backdrop-blur-xl shadow-xl space-y-2">
            <div className="text-3xl mb-2">🔍</div>
            <p className="text-base font-bold text-white">No titles found matching that exact combination of filters.</p>
            <p className="text-xs text-slate-400">Try relaxing your language, year, or rating filters!</p>
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
            <div className="flex flex-col items-center gap-0.5 bg-black/35 backdrop-blur-md px-4.5 py-2 rounded-xl border border-white/10 shadow-2xl">
              <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-white">
                More Content Below
              </span>
              <span className={`text-xl font-black animate-slow-glow ${getThemeArrowColor(appTheme)}`}>
                ⌄
              </span>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
