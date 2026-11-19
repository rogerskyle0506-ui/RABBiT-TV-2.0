// src/routes/search.tsx
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import type { MediaItem } from "@/lib/tmdb-scraper";
import {
  CardSize,
  AppTheme,
  PosterAppearanceClasses,
  getSavedCardSize,
  getSavedTheme,
  getSavedUserAge,
  isAllowedForAge,
  getPosterAppearanceClasses,
  getOptimalTmdbImageWidth,
  getHardwareLimits,
  getReducedMotion,
  getLargeButtons,
  getGlowIntensity,
  getKidsModeLocked,
} from "@/lib/settings";
import { MediaCard } from "@/routes/index";
import { ScrollPillBar } from "@/components/scroll-pill-bar";
import { AppWallpaper } from "@/components/AppWallpaper";
import { isTitleDisliked, recordWatchHistory } from "@/lib/watch-history";
import { isTitleBroken } from "@/lib/broken-links";
import { searchLiveChannels, type LiveChannel } from "@/lib/live-feed-service";

const TMDB_API_KEY =
  ((import.meta as any).env?.VITE_TMDB_API_KEY as string) || "";
const TMDB_BASE_URL = "https://api.themoviedb.org/3/";
const RECENT_SEARCHES_KEY = "rabtv_recent_searches_v1";
const FETCH_TIMEOUT_MS = 8500;

interface PersonMatch {
  id: number;
  name: string;
  profilePath: string | null;
  department: string;
}

type SortOption =
  | "popularity.desc"
  | "vote_average.desc"
  | "release_date.desc"
  | "vote_count.desc";

type ProviderOption = "all" | "8" | "119" | "337";

// Accurate Movie + TV TMDB genre IDs so TV filtering works reliably
const GENRE_ID_PAIRS: Record<string, { movie?: number; tv?: number }> = {
  Action: { movie: 28, tv: 10759 },
  Adventure: { movie: 12, tv: 10759 },
  Animation: { movie: 16, tv: 16 },
  Comedy: { movie: 35, tv: 35 },
  Crime: { movie: 80, tv: 80 },
  Documentary: { movie: 99, tv: 99 },
  Drama: { movie: 18, tv: 18 },
  Family: { movie: 10751, tv: 10751 },
  Fantasy: { movie: 14, tv: 10765 },
  History: { movie: 36, tv: 99 },
  Horror: { movie: 27, tv: 9648 },
  Kids: { movie: 10751, tv: 10762 },
  Music: { movie: 10402, tv: 99 },
  Mystery: { movie: 9648, tv: 9648 },
  Reality: { movie: 99, tv: 10764 },
  Romance: { movie: 10749, tv: 18 },
  "Sci-Fi": { movie: 878, tv: 10765 },
  Thriller: { movie: 53, tv: 80 },
  War: { movie: 10752, tv: 10768 },
  Western: { movie: 37, tv: 37 },
};

const languageFilters = [
  { label: "🌐 All Languages", lang: "", country: "" },
  { label: "🇨🇦 Canada", lang: "", country: "CA" },
  { label: "🇬🇧 British / UK", lang: "en", country: "GB" },
  { label: "🇺🇸 English (Global)", lang: "en", country: "" },
  { label: "🇩🇪 German", lang: "de", country: "DE" },
  { label: "🇺🇦 Ukrainian", lang: "uk", country: "UA" },
  { label: "🇷🇺 Russian", lang: "ru", country: "RU" },
  { label: "🇭🇺 Hungarian", lang: "hu", country: "HU" },
  { label: "🇸🇦 Arabic", lang: "ar", country: "" },
];

const providerFilters: { id: ProviderOption; label: string }[] = [
  { id: "all", label: "✨ All Services" },
  { id: "8", label: "Netflix" },
  { id: "119", label: "Prime Video" },
  { id: "337", label: "Disney+" },
];

const sortOptions: { id: SortOption; label: string }[] = [
  { id: "popularity.desc", label: "🔥 Most Popular" },
  { id: "vote_average.desc", label: "⭐ Top Rated" },
  { id: "release_date.desc", label: "🆕 Newest First" },
  { id: "vote_count.desc", label: "🏆 Most Voted" },
];

const MATURE_LIVE_KEYWORDS = [
  "adult",
  "crime",
  "deadly",
  "murder",
  "cops",
  "48 hours",
  "csi",
  "thriller",
  "paranormal",
  "haunt",
  "ghost",
  "botched",
  "prisoner",
  "hell",
  "ridiculousness",
];

function sanitizeQuery(raw: string): string {
  return String(raw || "")
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, 80);
}

function loadRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed
          .filter((x) => typeof x === "string" && x.trim().length > 0)
          .slice(0, 8)
      : [];
  } catch {
    return [];
  }
}

function saveRecentSearch(term: string): string[] {
  const clean = sanitizeQuery(term);
  const current = loadRecentSearches();
  if (clean.length < 2) return current;
  const updated = [
    clean,
    ...current.filter((x) => x.toLowerCase() !== clean.toLowerCase()),
  ].slice(0, 8);
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    } catch {
      // ignore storage quota errors
    }
  }
  return updated;
}

function removeRecentSearch(term: string): string[] {
  const updated = loadRecentSearches().filter((x) => x !== term);
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }
  }
  return updated;
}

function clearAllRecentSearches(): string[] {
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(RECENT_SEARCHES_KEY);
    } catch {
      // ignore
    }
  }
  return [];
}

function mapRawItem(
  item: Record<string, unknown>,
  fallbackType: "movie" | "tv",
  imageWidth: "w342" | "w500"
): MediaItem | null {
  const rawMediaType = item.media_type as string | undefined;
  if (rawMediaType === "person") return null;

  const type: "movie" | "tv" =
    rawMediaType === "tv" || rawMediaType === "movie"
      ? rawMediaType
      : item.first_air_date && !item.release_date
        ? "tv"
        : fallbackType;

  const title = (item.title || item.name) as string | undefined;
  if (!title) return null;

  const releaseDate = (item.release_date || item.first_air_date || "") as string;
  const year = releaseDate.split("-")[0];
  const voteAverage = item.vote_average as number | undefined;
  const rating =
    typeof voteAverage === "number" && voteAverage > 0
      ? voteAverage.toFixed(1)
      : undefined;
  const posterPath = item.poster_path as string | undefined;
  const imagePath = posterPath
    ? `https://image.tmdb.org/t/p/${imageWidth}${posterPath}`
    : "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=900&q=80";

  return {
    id: `${type}-${item.id}`,
    title,
    description: (item.overview as string) || "No description available.",
    image: imagePath,
    href: `/details?id=${item.id}&type=${type}`,
    genre: type === "tv" ? "TV SHOW" : "MOVIE",
    year: year || undefined,
    rating,
    mediaType: type,
    releaseDate,
    genreIds: Array.isArray(item.genre_ids) ? (item.genre_ids as number[]) : [],
    certification: item.adult ? "R" : undefined,
  };
}

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

  // Search & Filter States
  const [queryInput, setQueryInput] = useState(searchParams.q || "");
  const [mediaType, setMediaType] = useState<"all" | "movie" | "tv">("all");
  const [selectedGenre, setSelectedGenre] = useState<string>("All");
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [minRating, setMinRating] = useState<number>(0);
  const [selectedLangIndex, setSelectedLangIndex] = useState<number>(0);
  const [selectedProvider, setSelectedProvider] = useState<ProviderOption>("all");
  const [sortBy, setSortBy] = useState<SortOption>("popularity.desc");
  const [hiddenGemsMode, setHiddenGemsMode] = useState<boolean>(false);
  const [selectedPerson, setSelectedPerson] = useState<PersonMatch | null>(null);

  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [recentSearches, setRecentSearches] = useState<string[]>(() =>
    loadRecentSearches()
  );

  // Results States
  const [results, setResults] = useState<MediaItem[]>([]);
  const [matchedPeople, setMatchedPeople] = useState<PersonMatch[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Live Settings from settings.ts
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

  const [canScrollDown, setCanScrollDown] = useState<boolean>(false);
  const [showScrollReminder, setShowScrollReminder] = useState<boolean>(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Sync URL query param to input box & record recent searches
  useEffect(() => {
    const clean = sanitizeQuery(searchParams.q || "");
    setQueryInput(clean);
    if (clean.length >= 2) {
      setRecentSearches(saveRecentSearch(clean));
    }
    setSelectedPerson(null);
    setPage(1);
  }, [searchParams.q]);

  // Live settings listener
  useEffect(() => {
    const syncSettings = () => {
      const nextTheme = getSavedTheme();
      setAppTheme(nextTheme);
      setCardSize(getSavedCardSize());
      setUserAge(getSavedUserAge());
      setKidsLocked(getKidsModeLocked());
      setPosterAppearance(getPosterAppearanceClasses(nextTheme));
      setPosterWidth(getOptimalTmdbImageWidth());
      setLargeButtons(getLargeButtons());
      setReducedMotion(getReducedMotion());
      setGlowOff(getGlowIntensity() === "off");
      setIsLowRam(getHardwareLimits().effectiveMode === "low");
    };

    syncSettings();
    window.addEventListener("rabtv_settings_updated", syncSettings);
    window.addEventListener("rabtv_ram_mode_updated", syncSettings);
    return () => {
      window.removeEventListener("rabtv_settings_updated", syncSettings);
      window.removeEventListener("rabtv_ram_mode_updated", syncSettings);
    };
  }, []);

  // Reset pagination when any filter changes
  useEffect(() => {
    setPage(1);
  }, [
    mediaType,
    selectedGenre,
    selectedYear,
    minRating,
    selectedLangIndex,
    selectedProvider,
    sortBy,
    hiddenGemsMode,
    selectedPerson,
  ]);

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

  // Cross-search your 284 Live TV channels instantly whenever a keyword is active
  const matchingLiveChannels = useMemo<LiveChannel[]>(() => {
    const q = sanitizeQuery(searchParams.q || "");
    if (q.length < 2 || selectedPerson) return [];
    const found = searchLiveChannels(q);
    const kidsActive = kidsLocked || userAge < 13;
    return found
      .filter((ch) => {
        if (!kidsActive) return true;
        const lower = ch.title.toLowerCase();
        return !MATURE_LIVE_KEYWORDS.some((kw) => lower.includes(kw));
      })
      .slice(0, 6);
  }, [searchParams.q, selectedPerson, kidsLocked, userAge]);

  // Main TMDB Search / Person Credits / Discover Fetcher with AbortController & Timeout
  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(
      () => controller.abort(),
      FETCH_TIMEOUT_MS
    );
    let active = true;

    async function fetchJson(url: string) {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) {
        throw new Error(`TMDB returned HTTP ${res.status}`);
      }
      return res.json();
    }

    async function fetchFilteredCatalog() {
      setLoading(true);
      setError(null);

      try {
        const activeQuery = sanitizeQuery(searchParams.q || "");
        const activeLangConfig = languageFilters[selectedLangIndex];

        // 1. PERSON FILMOGRAPHY MODE (when user taps a matched actor/creator)
        if (selectedPerson) {
          const url = new URL(
            `person/${selectedPerson.id}/combined_credits`,
            TMDB_BASE_URL
          );
          if (TMDB_API_KEY) url.searchParams.set("api_key", TMDB_API_KEY);
          const data = await fetchJson(url.toString());
          if (!active) return;

          const castArr = Array.isArray(data.cast) ? data.cast : [];
          const crewArr = Array.isArray(data.crew) ? data.crew : [];
          const mergedRaw = [...castArr, ...crewArr] as Record<
            string,
            unknown
          >[];

          const seen = new Set<string>();
          const credits: MediaItem[] = [];
          for (const raw of mergedRaw) {
            const mapped = mapRawItem(raw, "movie", posterWidth);
            if (!mapped || seen.has(mapped.id)) continue;
            if (mediaType !== "all" && mapped.mediaType !== mediaType) continue;
            if (minRating > 0 && Number(mapped.rating || 0) < minRating) {
              continue;
            }
            seen.add(mapped.id);
            credits.push(mapped);
          }

          credits.sort((a, b) => {
            if (sortBy === "vote_average.desc") {
              return Number(b.rating || 0) - Number(a.rating || 0);
            }
            if (sortBy === "release_date.desc") {
              return (b.year || "").localeCompare(a.year || "");
            }
            return Number(b.rating || 0) - Number(a.rating || 0);
          });

          setResults(credits.slice(0, 60));
          setTotalPages(1);
          setLoading(false);
          return;
        }

        // 2. KEYWORD SEARCH MODE (Movies + TV + Actors)
        if (activeQuery) {
          const endpoint =
            mediaType === "movie"
              ? "search/movie"
              : mediaType === "tv"
                ? "search/tv"
                : "search/multi";

          const urlParams = new URLSearchParams();
          if (TMDB_API_KEY) urlParams.set("api_key", TMDB_API_KEY);
          urlParams.set("query", activeQuery);
          urlParams.set("include_adult", "false");
          urlParams.set("page", String(page));

          if (selectedYear && /^\d{4}$/.test(selectedYear)) {
            if (mediaType === "tv") {
              urlParams.set("first_air_date_year", selectedYear);
            } else if (mediaType === "movie") {
              urlParams.set("primary_release_year", selectedYear);
            }
          }

          const data = await fetchJson(
            `${TMDB_BASE_URL}${endpoint}?${urlParams.toString()}`
          );
          if (!active) return;

          const rawItems = (data.results || []) as Record<string, unknown>[];
          const people: PersonMatch[] = [];
          const mapped: MediaItem[] = [];
          const genreSpec =
            selectedGenre !== "All" ? GENRE_ID_PAIRS[selectedGenre] : undefined;

          for (const item of rawItems) {
            if (item.media_type === "person") {
              if (item.id && item.name) {
                people.push({
                  id: Number(item.id),
                  name: String(item.name),
                  profilePath: (item.profile_path as string) || null,
                  department:
                    (item.known_for_department as string) || "Talent",
                });
              }
              continue;
            }

            const itemObj = mapRawItem(
              item,
              mediaType === "tv" ? "tv" : "movie",
              posterWidth
            );
            if (!itemObj) continue;

            // Client-side filter enforcement on keyword results
            if (
              activeLangConfig.lang &&
              item.original_language &&
              String(item.original_language) !== activeLangConfig.lang
            ) {
              continue;
            }
            if (minRating > 0 && Number(itemObj.rating || 0) < minRating) {
              continue;
            }
            if (selectedYear) {
              const yr = Number(itemObj.year || 0);
              if (selectedYear.startsWith("decade:")) {
                const startYr = Number(selectedYear.split(":")[1]);
                const endYr = startYr === 1900 ? 1979 : startYr + 9;
                if (!yr || yr < startYr || yr > endYr) continue;
              } else if (itemObj.year !== selectedYear) {
                continue;
              }
            }
            if (genreSpec) {
              const targetGenreId =
                itemObj.mediaType === "tv" ? genreSpec.tv : genreSpec.movie;
              if (
                targetGenreId &&
                !(itemObj.genreIds || []).includes(targetGenreId)
              ) {
                continue;
              }
            }

            mapped.push(itemObj);
          }

          // Apply requested sort to keyword results
          if (sortBy === "vote_average.desc") {
            mapped.sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0));
          } else if (sortBy === "release_date.desc") {
            mapped.sort((a, b) =>
              (b.releaseDate || b.year || "").localeCompare(
                a.releaseDate || a.year || ""
              )
            );
          }

          setMatchedPeople(people.slice(0, 8));
          setResults(mapped);
          setTotalPages(Math.min(Number(data.total_pages) || 1, 25));
          return;
        }

        // 3. PURE DISCOVER FILTER MODE (Supports Movies, TV, or Both Interleaved!)
        setMatchedPeople([]);

        const buildDiscoverParams = (targetType: "movie" | "tv") => {
          const p = new URLSearchParams();
          if (TMDB_API_KEY) p.set("api_key", TMDB_API_KEY);
          p.set("include_adult", "false");
          p.set("page", String(page));

          const resolvedSort =
            sortBy === "release_date.desc"
              ? targetType === "tv"
                ? "first_air_date.desc"
                : "primary_release_date.desc"
              : sortBy;
          p.set("sort_by", resolvedSort);

          // Anti-junk vote threshold when sorting by Top Rated or Hidden Gems
          if (hiddenGemsMode) {
            p.set("vote_count.gte", "80");
            p.set("vote_count.lte", "1800");
            p.set("vote_average.gte", String(Math.max(minRating, 7.4)));
          } else if (sortBy === "vote_average.desc") {
            p.set("vote_count.gte", "150");
          }

          const genreSpec =
            selectedGenre !== "All" ? GENRE_ID_PAIRS[selectedGenre] : undefined;
          const genreId =
            targetType === "tv" ? genreSpec?.tv : genreSpec?.movie;
          if (genreId) {
            p.set("with_genres", String(genreId));
          }

          // Year or Decade range
          if (selectedYear) {
            const gteKey =
              targetType === "tv"
                ? "first_air_date.gte"
                : "primary_release_date.gte";
            const lteKey =
              targetType === "tv"
                ? "first_air_date.lte"
                : "primary_release_date.lte";

            if (selectedYear.startsWith("decade:")) {
              const startYr = Number(selectedYear.split(":")[1]);
              if (startYr === 1900) {
                p.set(lteKey, "1979-12-31");
              } else {
                p.set(gteKey, `${startYr}-01-01`);
                p.set(lteKey, `${startYr + 9}-12-31`);
              }
            } else if (selectedYear === "recent-2yr") {
              const currentYr = new Date().getFullYear();
              p.set(gteKey, `${currentYr - 1}-01-01`);
              p.set(lteKey, new Date().toISOString().split("T")[0]);
            } else if (/^\d{4}$/.test(selectedYear)) {
              if (targetType === "tv") {
                p.set("first_air_date_year", selectedYear);
              } else {
                p.set("primary_release_year", selectedYear);
              }
            }
          } else if (sortBy === "release_date.desc") {
            // Prevent unreleased future 2029 placeholders from flooding "Newest First"
            const todayIso = new Date().toISOString().split("T")[0];
            p.set(
              targetType === "tv"
                ? "first_air_date.lte"
                : "primary_release_date.lte",
              todayIso
            );
            p.set("vote_count.gte", "20");
          }

          if (minRating > 0 && !hiddenGemsMode) {
            p.set("vote_average.gte", String(minRating));
          }
          if (activeLangConfig.lang) {
            p.set("with_original_language", activeLangConfig.lang);
          }
          if (activeLangConfig.country) {
            p.set("with_origin_country", activeLangConfig.country);
          }
          if (selectedProvider !== "all") {
            p.set("with_watch_providers", selectedProvider);
            p.set("watch_region", "CA");
            p.set("with_watch_monetization_types", "flatrate");
          }

          return p;
        };

        if (mediaType === "all") {
          const [movieData, tvData] = await Promise.all([
            fetchJson(
              `${TMDB_BASE_URL}discover/movie?${buildDiscoverParams("movie").toString()}`
            ),
            fetchJson(
              `${TMDB_BASE_URL}discover/tv?${buildDiscoverParams("tv").toString()}`
            ),
          ]);
          if (!active) return;

          const movieRaw = (movieData.results || []) as Record<
            string,
            unknown
          >[];
          const tvRaw = (tvData.results || []) as Record<string, unknown>[];
          const interleaved: MediaItem[] = [];
          const maxLen = Math.max(movieRaw.length, tvRaw.length);

          for (let i = 0; i < maxLen; i++) {
            if (movieRaw[i]) {
              const m = mapRawItem(movieRaw[i], "movie", posterWidth);
              if (m) interleaved.push(m);
            }
            if (tvRaw[i]) {
              const t = mapRawItem(tvRaw[i], "tv", posterWidth);
              if (t) interleaved.push(t);
            }
          }

          setResults(interleaved);
          setTotalPages(
            Math.min(
              Math.max(
                Number(movieData.total_pages) || 1,
                Number(tvData.total_pages) || 1
              ),
              25
            )
          );
        } else {
          const targetType = mediaType;
          const data = await fetchJson(
            `${TMDB_BASE_URL}discover/${targetType}?${buildDiscoverParams(
              targetType
            ).toString()}`
          );
          if (!active) return;

          const rawItems = (data.results || []) as Record<string, unknown>[];
          const mapped = rawItems
            .map((item) => mapRawItem(item, targetType, posterWidth))
            .filter((x): x is MediaItem => Boolean(x));

          setResults(mapped);
          setTotalPages(Math.min(Number(data.total_pages) || 1, 25));
        }
      } catch (err: any) {
        if (!active || err?.name === "AbortError") return;
        setError(
          err instanceof Error
            ? err.message
            : "Could not load catalog results. Check your connection."
        );
      } finally {
        window.clearTimeout(timeoutId);
        if (active) setLoading(false);
      }
    }

    void fetchFilteredCatalog();
    return () => {
      active = false;
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [
    searchParams.q,
    mediaType,
    selectedGenre,
    selectedYear,
    minRating,
    selectedLangIndex,
    selectedProvider,
    sortBy,
    hiddenGemsMode,
    selectedPerson,
    page,
    posterWidth,
  ]);

  // Apply Age Lock, Kids Safe Mode, Disliked & Broken Link guards
  const filteredResults = useMemo(() => {
    return results.filter((item) => {
      if (isTitleDisliked(item.id) || isTitleBroken(item.id)) return false;
      return isAllowedForAge(item.certification, item.genre, userAge);
    });
  }, [results, userAge, kidsLocked]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = sanitizeQuery(queryInput);
    setSelectedPerson(null);
    if (clean.length >= 2) {
      setRecentSearches(saveRecentSearch(clean));
    }
    navigate({ to: "/search", search: { q: clean } });
  };

  const applyDiscoveryPreset = useCallback(
    (
      preset:
        | "trending"
        | "masterpieces"
        | "new"
        | "90s"
        | "family"
        | "hiddenGems"
    ) => {
      setSelectedPerson(null);
      setQueryInput("");
      navigate({ to: "/search", search: { q: "" } });
      setSelectedLangIndex(0);
      setSelectedProvider("all");
      setMediaType("all");
      setHiddenGemsMode(false);

      if (preset === "trending") {
        setSelectedGenre("All");
        setSelectedYear("");
        setMinRating(0);
        setSortBy("popularity.desc");
      } else if (preset === "masterpieces") {
        setSelectedGenre("All");
        setSelectedYear("");
        setMinRating(8);
        setSortBy("vote_average.desc");
      } else if (preset === "new") {
        setSelectedGenre("All");
        setSelectedYear("recent-2yr");
        setMinRating(6);
        setSortBy("popularity.desc");
      } else if (preset === "90s") {
        setSelectedGenre("All");
        setSelectedYear("decade:1990");
        setMinRating(7);
        setSortBy("vote_average.desc");
      } else if (preset === "family") {
        setSelectedGenre("Family");
        setSelectedYear("");
        setMinRating(6.5);
        setSortBy("popularity.desc");
      } else if (preset === "hiddenGems") {
        setSelectedGenre("All");
        setSelectedYear("");
        setMinRating(7.5);
        setSortBy("vote_average.desc");
        setHiddenGemsMode(true);
      }
    },
    [navigate]
  );

  const hasActiveFilters =
    Boolean(searchParams.q?.trim()) ||
    mediaType !== "all" ||
    selectedGenre !== "All" ||
    selectedYear !== "" ||
    minRating > 0 ||
    selectedLangIndex !== 0 ||
    selectedProvider !== "all" ||
    sortBy !== "popularity.desc" ||
    hiddenGemsMode ||
    Boolean(selectedPerson);

  const resetAllFilters = () => {
    setQueryInput("");
    setMediaType("all");
    setSelectedGenre("All");
    setSelectedYear("");
    setMinRating(0);
    setSelectedLangIndex(0);
    setSelectedProvider("all");
    setSortBy("popularity.desc");
    setHiddenGemsMode(false);
    setSelectedPerson(null);
    setPage(1);
    navigate({ to: "/search", search: { q: "" } });
  };

  const handleSurpriseMe = () => {
    if (!filteredResults.length) return;
    const pick =
      filteredResults[Math.floor(Math.random() * filteredResults.length)];
    const cleanId = String(pick.id).replace(/^(movie|tv)-/i, "");
    navigate({
      to: "/details",
      search: { id: cleanId, type: pick.mediaType === "tv" ? "tv" : "movie" },
    });
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

  const themeTokens = useMemo(() => {
    switch (appTheme) {
      case "red":
        return {
          bg: "bg-gradient-to-br from-zinc-950/85 via-red-950/40 to-black/95",
          accentText: "text-red-400",
          accentBar: "bg-red-500 shadow-[0_0_14px_rgba(239,68,68,0.95)]",
          borderGlow:
            "border-red-500/30 shadow-[0_16px_50px_rgba(239,68,68,0.22)]",
          btn: "bg-gradient-to-r from-red-600 via-rose-600 to-orange-600 text-white shadow-lg shadow-red-600/30",
          ambient: "from-red-600/15 via-transparent to-transparent",
          avatarRing: "from-red-500 via-rose-400 to-amber-400",
          arrow: "text-red-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.8)]",
        };
      case "midnight":
        return {
          bg: "bg-gradient-to-br from-slate-950/85 via-blue-950/40 to-slate-950/95",
          accentText: "text-sky-300",
          accentBar: "bg-sky-400 shadow-[0_0_14px_rgba(56,189,248,0.95)]",
          borderGlow:
            "border-blue-500/30 shadow-[0_16px_50px_rgba(59,130,246,0.22)]",
          btn: "bg-gradient-to-r from-blue-600 via-cyan-600 to-sky-600 text-white shadow-lg shadow-blue-600/30",
          ambient: "from-blue-600/15 via-transparent to-transparent",
          avatarRing: "from-cyan-400 via-sky-500 to-indigo-500",
          arrow: "text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.8)]",
        };
      case "emerald":
        return {
          bg: "bg-gradient-to-br from-slate-950/85 via-emerald-950/40 to-slate-950/95",
          accentText: "text-emerald-300",
          accentBar: "bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.95)]",
          borderGlow:
            "border-emerald-500/30 shadow-[0_16px_50px_rgba(16,185,129,0.22)]",
          btn: "bg-gradient-to-r from-emerald-600 via-teal-600 to-green-600 text-white shadow-lg shadow-emerald-600/30",
          ambient: "from-emerald-600/15 via-transparent to-transparent",
          avatarRing: "from-emerald-400 via-teal-400 to-cyan-500",
          arrow: "text-emerald-300 drop-shadow-[0_0_8px_rgba(110,231,183,0.8)]",
        };
      case "amber":
        return {
          bg: "bg-gradient-to-br from-stone-950/85 via-yellow-950/40 to-neutral-950/95",
          accentText: "text-amber-300",
          accentBar: "bg-amber-400 shadow-[0_0_14px_rgba(251,191,36,0.95)]",
          borderGlow:
            "border-amber-500/30 shadow-[0_16px_50px_rgba(245,158,11,0.22)]",
          btn: "bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 text-white shadow-lg shadow-amber-600/30",
          ambient: "from-amber-600/15 via-transparent to-transparent",
          avatarRing: "from-amber-400 via-yellow-400 to-orange-500",
          arrow: "text-amber-300 drop-shadow-[0_0_8px_rgba(252,211,77,0.8)]",
        };
      case "cyan":
        return {
          bg: "bg-gradient-to-br from-slate-950/85 via-cyan-950/40 to-slate-950/95",
          accentText: "text-cyan-300",
          accentBar: "bg-cyan-400 shadow-[0_0_14px_rgba(34,211,238,0.95)]",
          borderGlow:
            "border-cyan-500/30 shadow-[0_16px_50px_rgba(6,182,212,0.22)]",
          btn: "bg-gradient-to-r from-cyan-600 via-teal-600 to-blue-600 text-white shadow-lg shadow-cyan-600/30",
          ambient: "from-cyan-600/15 via-transparent to-transparent",
          avatarRing: "from-cyan-400 via-sky-400 to-blue-500",
          arrow: "text-cyan-300 drop-shadow-[0_0_8px_rgba(103,232,249,0.8)]",
        };
      case "violet":
      default:
        return {
          bg: "bg-gradient-to-br from-slate-950/85 via-purple-950/40 to-slate-950/95",
          accentText: "text-violet-300",
          accentBar: "bg-violet-500 shadow-[0_0_14px_rgba(139,92,246,0.95)]",
          borderGlow:
            "border-violet-500/30 shadow-[0_16px_50px_rgba(139,92,246,0.22)]",
          btn: "bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 text-white shadow-lg shadow-violet-600/30",
          ambient: "from-violet-600/15 via-transparent to-transparent",
          avatarRing: "from-cyan-400 via-purple-500 to-pink-500",
          arrow: "text-purple-400 drop-shadow-[0_0_8px_rgba(192,132,252,0.8)]",
        };
    }
  }, [appTheme]);

  const getPrimaryBgColor = useCallback((theme: AppTheme) => {
    switch (theme) {
      case "red":
        return "bg-gradient-to-r from-red-600 via-rose-600 to-orange-600 text-white shadow-lg shadow-red-600/30";
      case "midnight":
        return "bg-gradient-to-r from-blue-600 via-cyan-600 to-sky-600 text-white shadow-lg shadow-blue-600/30";
      case "emerald":
        return "bg-gradient-to-r from-emerald-600 via-teal-600 to-green-600 text-white shadow-lg shadow-emerald-600/30";
      case "amber":
        return "bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 text-white shadow-lg shadow-amber-600/30";
      case "cyan":
        return "bg-gradient-to-r from-cyan-600 via-teal-600 to-blue-600 text-white shadow-lg shadow-cyan-600/30";
      case "violet":
      default:
        return "bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 text-white shadow-lg shadow-violet-600/30";
    }
  }, []);

  const allGenreOptions = useMemo(() => {
    return [
      { id: "All", label: "✨ All Genres" },
      ...Object.keys(GENRE_ID_PAIRS).map((g) => ({ id: g, label: g })),
    ];
  }, []);

  const yearOptions = useMemo(() => {
    const opts = [
      { value: "", label: "✨ Any Year" },
      { value: "recent-2yr", label: "🆕 New (2025–2026)" },
      { value: "decade:2020", label: "📅 2020s" },
      { value: "decade:2010", label: "📅 2010s" },
      { value: "decade:2000", label: "📅 2000s" },
      { value: "decade:1990", label: "📼 1990s" },
      { value: "decade:1980", label: "📼 1980s" },
      { value: "decade:1900", label: "🎞️ Classic (Pre-1980)" },
    ];
    const currentYear = new Date().getFullYear();
    for (let y = currentYear; y >= 1950; y--) {
      opts.push({ value: String(y), label: String(y) });
    }
    return opts;
  }, []);

  return (
    <main
      className={`min-h-screen ${themeTokens.bg} text-slate-100 px-3 sm:px-6 py-5 pb-20 flex flex-col items-center relative rounded-3xl`}
    >
      <AppWallpaper />
      {!isLowRam && !reducedMotion && !glowOff && (
        <div
          className={`absolute inset-x-0 -top-12 h-96 bg-gradient-to-b ${themeTokens.ambient} blur-3xl z-0 pointer-events-none rounded-t-3xl`}
        />
      )}

      <div className="mx-auto max-w-7xl w-full space-y-6 relative z-10">
        {/* Top Capsule Row: Back to Home + Kids Mode Badge + Surprise Me + Reset */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
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

            {kidsLocked && (
              <span className="rounded-full bg-emerald-500/20 border border-emerald-400/40 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-emerald-300">
                🧒 Kids Safe Mode
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {filteredResults.length > 0 && (
              <button
                type="button"
                onClick={handleSurpriseMe}
                className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/50 px-3.5 py-1.5 text-xs font-extrabold text-amber-200 hover:text-white shadow transition cursor-pointer"
                title="Pick a random title from these results"
              >
                <span>🎲 Surprise Me</span>
              </button>
            )}
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
        </div>

        {/* High-End Crystal Glass Search & Discovery Control Deck */}
        <div
          className={`rounded-3xl border bg-slate-950/85 ${
            isLowRam ? "" : "backdrop-blur-2xl"
          } p-4 sm:p-6 shadow-2xl space-y-4 ${themeTokens.borderGlow}`}
        >
          {/* Main Search Form */}
          <form
            onSubmit={handleSearchSubmit}
            className="flex flex-col sm:flex-row gap-2.5 items-center"
          >
            <div className="relative flex-1 w-full">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">
                🔍
              </span>
              <input
                ref={searchInputRef}
                type="text"
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                placeholder="Search movies, TV shows, actors, or live channels..."
                className="w-full rounded-2xl border border-white/15 bg-black/75 pl-10 pr-10 py-3.5 text-sm font-bold text-white placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-purple-500/40 shadow-inner"
              />
              {queryInput && (
                <button
                  type="button"
                  onClick={() => {
                    setQueryInput("");
                    setSelectedPerson(null);
                    navigate({ to: "/search", search: { q: "" } });
                    searchInputRef.current?.focus();
                  }}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-white/10 hover:bg-white/20 text-xs font-bold text-slate-200 flex items-center justify-center cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>
            <button
              type="submit"
              className={`w-full sm:w-auto px-7 ${
                largeButtons ? "py-4 text-sm" : "py-3.5 text-xs"
              } rounded-2xl font-black uppercase tracking-wider text-white shadow-xl transition-all duration-200 hover:scale-[1.03] active:scale-95 cursor-pointer ${themeTokens.btn}`}
            >
              Search & Filter
            </button>
          </form>

          {/* One-Tap Curated Discovery Presets */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
            {(
              [
                { id: "trending", label: "🔥 Trending Hits" },
                { id: "masterpieces", label: "⭐ 8+ Masterpieces" },
                { id: "new", label: "🆕 2025–2026 New" },
                { id: "90s", label: "📼 90s Classics" },
                { id: "family", label: "👨‍👩‍👧 Family Night" },
                { id: "hiddenGems", label: "💎 Hidden Gems" },
              ] as const
            ).map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyDiscoveryPreset(preset.id)}
                className="shrink-0 rounded-full bg-white/[0.06] hover:bg-white/[0.15] border border-white/15 px-3 py-1 text-[11px] font-extrabold text-slate-200 hover:text-white transition cursor-pointer whitespace-nowrap"
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Recent Search History Pills */}
          {recentSearches.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mr-1">
                🕒 Recent:
              </span>
              {recentSearches.map((term) => (
                <div
                  key={term}
                  className="inline-flex items-center rounded-full bg-black/65 border border-white/15 overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setQueryInput(term);
                      setSelectedPerson(null);
                      navigate({ to: "/search", search: { q: term } });
                    }}
                    className="pl-2.5 pr-1.5 py-1 text-[11px] font-bold text-slate-200 hover:text-white transition cursor-pointer"
                  >
                    {term}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRecentSearches(removeRecentSearch(term))}
                    aria-label={`Remove ${term} from recent searches`}
                    className="pr-2 pl-1 py-1 text-[10px] text-slate-500 hover:text-red-400 transition cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setRecentSearches(clearAllRecentSearches())}
                className="text-[10px] font-bold text-slate-500 hover:text-red-300 underline ml-1 cursor-pointer"
              >
                Clear
              </button>
            </div>
          )}

          {/* Active Person Filmography Pill */}
          {selectedPerson && (
            <div className="flex items-center justify-between gap-2 rounded-2xl bg-cyan-950/50 border border-cyan-400/45 px-3.5 py-2">
              <span className="text-xs font-extrabold text-cyan-200 truncate">
                🎭 Viewing full filmography for{" "}
                <strong className="text-white">{selectedPerson.name}</strong>
              </span>
              <button
                type="button"
                onClick={() => setSelectedPerson(null)}
                className="shrink-0 rounded-lg bg-black/65 hover:bg-red-600/80 border border-white/15 px-2.5 py-1 text-[10px] font-extrabold text-white transition cursor-pointer"
              >
                ✕ Back to Search
              </button>
            </div>
          )}

          {/* 6-Slot Precision Filter Matrix */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-3 border-t border-white/10">
            {/* 1. Media Type Tabs */}
            <div className="flex rounded-xl bg-black/65 border border-white/15 p-1">
              {(["all", "movie", "tv"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setMediaType(t)}
                  className={`flex-1 py-2 rounded-lg text-xs font-black uppercase transition cursor-pointer ${
                    mediaType === t
                      ? `${getPrimaryBgColor(appTheme)} text-white shadow-md`
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {t === "all" ? "All" : t === "movie" ? "Movies" : "TV"}
                </button>
              ))}
            </div>

            {/* 2. Sort Selector */}
            <div className="flex flex-col bg-black/65 border border-white/15 rounded-xl px-3 py-1.5 justify-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Sort By
              </span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer py-0.5"
              >
                {sortOptions.map((opt) => (
                  <option
                    key={opt.id}
                    value={opt.id}
                    className="bg-slate-950 text-white"
                  >
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Streaming Service (Canada) */}
            <div className="flex flex-col bg-black/65 border border-white/15 rounded-xl px-3 py-1.5 justify-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Streaming Service
              </span>
              <select
                value={selectedProvider}
                onChange={(e) =>
                  setSelectedProvider(e.target.value as ProviderOption)
                }
                disabled={Boolean(searchParams.q?.trim()) || Boolean(selectedPerson)}
                className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer py-0.5 disabled:opacity-50"
              >
                {providerFilters.map((pf) => (
                  <option
                    key={pf.id}
                    value={pf.id}
                    className="bg-slate-950 text-white"
                  >
                    {pf.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 4. Language / Region */}
            <div className="flex flex-col bg-black/65 border border-white/15 rounded-xl px-3 py-1.5 justify-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Language / Region
              </span>
              <select
                value={selectedLangIndex}
                onChange={(e) => setSelectedLangIndex(Number(e.target.value))}
                className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer py-0.5"
              >
                {languageFilters.map((lf, idx) => (
                  <option
                    key={lf.label}
                    value={idx}
                    className="bg-slate-950 text-white"
                  >
                    {lf.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 5. Year / Decade */}
            <div className="flex flex-col bg-black/65 border border-white/15 rounded-xl px-3 py-1.5 justify-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Year / Era
              </span>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer py-0.5"
              >
                {yearOptions.map((opt) => (
                  <option
                    key={opt.value}
                    value={opt.value}
                    className="bg-slate-950 text-white"
                  >
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 6. Minimum Rating */}
            <div className="flex flex-col bg-black/65 border border-white/15 rounded-xl px-3 py-1.5 justify-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Minimum Rating
              </span>
              <select
                value={minRating}
                onChange={(e) => setMinRating(Number(e.target.value))}
                className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer py-0.5"
              >
                <option value={0} className="bg-slate-950 text-white">
                  ⭐ Any Rating
                </option>
                <option value={6} className="bg-slate-950 text-white">
                  ⭐ 6.0 & Above
                </option>
                <option value={7} className="bg-slate-950 text-white">
                  ⭐ 7.0 & Above
                </option>
                <option value={7.5} className="bg-slate-950 text-white">
                  ⭐ 7.5 & Above
                </option>
                <option value={8} className="bg-slate-950 text-white">
                  ⭐ 8.0 & Above
                </option>
                <option value={8.5} className="bg-slate-950 text-white">
                  ⭐ 8.5 & Above
                </option>
              </select>
            </div>
          </div>

          {/* Genre Pill Bar */}
          <div className="space-y-1.5">
            <span className="text-[11px] text-slate-400 font-extrabold uppercase tracking-wider block px-1">
              Genre Filter:
            </span>
            <ScrollPillBar
              options={allGenreOptions}
              activeId={selectedGenre}
              onSelect={(id) => {
                setSelectedGenre((prev) =>
                  prev === id && id !== "All" ? "All" : id
                );
                setHiddenGemsMode(false);
              }}
              appTheme={appTheme}
              getPrimaryBgColor={getPrimaryBgColor}
              ariaLabel="Search genres"
            />
          </div>
        </div>

        {/* MATCHING LIVE TV CHANNELS CROSS-SEARCH SHELF */}
        {matchingLiveChannels.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2.5">
                <span className="w-1.5 h-6 rounded-full bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.9)]" />
                <h3 className="text-base sm:text-lg font-black tracking-tight text-white">
                  📡 Matching Live TV Channels
                </h3>
              </div>
              <Link
                to="/live-tv"
                className="text-xs font-bold text-red-300 hover:underline"
              >
                Open Live TV Guide →
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {matchingLiveChannels.map((ch) => {
                const targetUrl = ch.streamUrl || ch.url;
                return (
                  <Link
                    key={ch.channelId}
                    to="/live-player"
                    search={{
                      url: targetUrl,
                      title: ch.title,
                      logo: ch.logo || "",
                      channelId: ch.channelId,
                    }}
                    onClick={() => {
                      recordWatchHistory({
                        id: ch.channelId,
                        title: ch.title,
                        posterPath: ch.logo || "",
                        type: "livetv",
                      });
                    }}
                    className="group rounded-2xl border border-red-500/30 hover:border-red-400 bg-slate-950/85 p-3 text-center flex flex-col items-center justify-between gap-2 shadow-xl transition hover:-translate-y-1"
                  >
                    <div className="w-full h-16 rounded-xl bg-black/70 border border-white/10 p-2 flex items-center justify-center">
                      {ch.logo ? (
                        <img
                          src={ch.logo}
                          alt={ch.title}
                          loading="lazy"
                          decoding="async"
                          className="max-h-full max-w-full object-contain group-hover:scale-110 transition-transform"
                        />
                      ) : (
                        <span className="text-xs font-black text-red-400">
                          ● LIVE
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-black text-white line-clamp-1">
                      {ch.title}
                    </span>
                    <span className="w-full py-1 rounded-lg bg-red-600/80 group-hover:bg-red-500 text-[10px] font-extrabold uppercase text-white transition">
                      ▶ Watch Live
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* MATCHING ACTORS / CREATORS STRIP */}
        {matchedPeople.length > 0 && !selectedPerson && (
          <section className="space-y-3">
            <div className="flex items-center gap-2.5 px-1">
              <span className={`w-1.5 h-6 rounded-full ${themeTokens.accentBar}`} />
              <h3 className="text-base sm:text-lg font-black tracking-tight text-white">
                🎭 Matching Actors & Creators (Tap for Filmography)
              </h3>
            </div>

            <div className="flex gap-4 overflow-x-auto pb-2 px-1 scrollbar-none">
              {matchedPeople.map((person) => (
                <button
                  key={person.id}
                  type="button"
                  onClick={() => setSelectedPerson(person)}
                  className="group flex flex-col items-center text-center shrink-0 w-24 cursor-pointer focus:outline-none"
                >
                  <div
                    className={`p-[2.5px] rounded-full bg-gradient-to-tr ${themeTokens.avatarRing} shadow-lg group-hover:scale-105 transition-transform mb-1.5`}
                  >
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden bg-slate-950 border-2 border-slate-950 flex items-center justify-center">
                      {person.profilePath ? (
                        <img
                          src={`https://image.tmdb.org/t/p/w200${person.profilePath}`}
                          alt={person.name}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-2xl">🎭</span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs font-bold text-white truncate w-full">
                    {person.name}
                  </span>
                  <span className="text-[10px] text-slate-400 truncate w-full">
                    {person.department}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* RESULTS HEADER */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-1 w-full">
          <div className="flex items-center gap-2.5">
            <span className={`w-1.5 h-6 rounded-full ${themeTokens.accentBar}`} />
            <h2 className="text-lg sm:text-xl font-black tracking-tight text-white">
              {selectedPerson
                ? `${selectedPerson.name} — Credits`
                : searchParams.q
                  ? `Search Results for "${searchParams.q}"`
                  : hiddenGemsMode
                    ? "💎 Hidden Gems Discovery"
                    : "Filtered Catalog Results"}
            </h2>
          </div>
          <span
            className={`text-xs font-semibold px-3 py-1 rounded-full bg-white/[0.05] border border-white/10 ${themeTokens.accentText}`}
          >
            {filteredResults.length} titles{" "}
            {totalPages > 1 ? `• Page ${page}/${totalPages}` : ""}
          </span>
        </div>

        {/* RESULTS GRID */}
        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-300 font-bold">
            <div className="h-9 w-9 rounded-full border-2 border-t-transparent border-cyan-400 animate-spin" />
            <span>Scanning catalog matches…</span>
          </div>
        ) : error ? (
          <div className="rounded-3xl border border-red-500/35 bg-red-950/35 p-8 text-center space-y-3">
            <p className="text-sm font-bold text-red-300">⚠️ {error}</p>
            <button
              type="button"
              onClick={() => setPage((p) => p)}
              className="rounded-xl bg-white/10 hover:bg-white/20 px-4 py-2 text-xs font-bold text-white cursor-pointer"
            >
              ↻ Retry Search
            </button>
          </div>
        ) : filteredResults.length > 0 ? (
          <>
            <div className={`${gridColsClass} w-full`}>
              {filteredResults.map((item) => (
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

            {/* Pagination Deck */}
            {totalPages > 1 && !selectedPerson && (
              <div className="pt-4 flex items-center justify-center gap-4 rounded-2xl bg-slate-950/80 border border-white/15 backdrop-blur-xl p-3 mx-auto w-full max-w-sm shadow-xl">
                <button
                  type="button"
                  onClick={() => {
                    setPage((p) => Math.max(1, p - 1));
                    window.scrollTo({
                      top: 0,
                      behavior: reducedMotion ? "auto" : "smooth",
                    });
                  }}
                  disabled={page <= 1 || loading}
                  className={`rounded-xl bg-white/10 hover:bg-white/20 ${
                    largeButtons ? "px-5 py-3 text-sm" : "px-4 py-2 text-xs"
                  } font-bold text-white transition disabled:opacity-40 cursor-pointer`}
                >
                  ◀ Prev
                </button>

                <span className={`text-xs font-black ${themeTokens.accentText}`}>
                  Page {page} of {totalPages}
                </span>

                <button
                  type="button"
                  onClick={() => {
                    setPage((p) => Math.min(totalPages, p + 1));
                    window.scrollTo({
                      top: 0,
                      behavior: reducedMotion ? "auto" : "smooth",
                    });
                  }}
                  disabled={page >= totalPages || loading}
                  className={`rounded-xl ${themeTokens.btn} ${
                    largeButtons ? "px-5 py-3 text-sm" : "px-4 py-2 text-xs"
                  } font-bold shadow transition disabled:opacity-40 cursor-pointer`}
                >
                  Next ▶
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="rounded-3xl border border-white/10 bg-slate-950/75 p-12 text-center text-slate-400 backdrop-blur-xl shadow-xl space-y-3">
            <div className="text-3xl">🔍</div>
            <p className="text-base font-bold text-white">
              No titles found matching that exact combination of filters.
            </p>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Try relaxing your year, rating, streaming service, or language
              filter—or tap one of the quick presets above!
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetAllFilters}
                className={`mt-2 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-extrabold text-white shadow-lg transition cursor-pointer ${themeTokens.btn}`}
              >
                ↺ Reset All Filters
              </button>
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
              <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-white">
                More Content Below
              </span>
              <span
                className={`text-xl font-black animate-slow-glow ${themeTokens.arrow}`}
              >
                ⌄
              </span>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
