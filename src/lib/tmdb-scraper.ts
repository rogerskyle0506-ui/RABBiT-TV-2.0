// src/lib/tmdb-scraper.ts
import {
  getOptimalTmdbImageWidth,
  getSavedUserAge,
  getKidsModeLocked,
  purgeOldTmdbCaches,
} from "./settings";

export type MediaItem = {
  id: string;
  title: string;
  description: string;
  image: string;
  href: string;
  genre?: string;
  year?: string;
  rating?: string;
  mediaType?: "movie" | "tv";
  releaseDate?: string;
  genreIds?: number[];
  certification?: string;
};

export type ScrapeResult = {
  source: string;
  items: MediaItem[];
  fetchedAt: string;
  message?: string;
  page?: number;
  totalPages?: number;
};

const TMDB_API_KEY =
  ((import.meta as any).env?.VITE_TMDB_API_KEY as string) || "";

const TMDB_BASE_URL = "https://api.themoviedb.org/3/";
// Uses rabtv_cache_ prefix so settings.ts purgeOldTmdbCaches() automatically cleans it
const STORAGE_PREFIX = "rabtv_cache_catalog_v20_";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6-hour freshness window
const FETCH_TIMEOUT_MS = 8000; // Prevent UI hangs on slow TV Wi-Fi
const ITEMS_PER_PAGE = 20;
const MAX_CACHED_ITEMS_PER_KEY = 100;

interface CachedCatalogEntry {
  items: MediaItem[];
  maxApiPageReached: number;
  totalAvailablePages: number;
  isFullyLoaded: boolean;
  cachedAt: number;
}

// Fast in-memory session cache (avoids repeated JSON.parse on 1-2GB sticks)
const memoryCatalogCache = new Map<string, CachedCatalogEntry>();

let lastRequestTimestamp = 0;
const MIN_REQUEST_INTERVAL_MS = 180;

async function throttleRequest() {
  const now = Date.now();
  const timeSinceLast = now - lastRequestTimestamp;
  if (timeSinceLast < MIN_REQUEST_INTERVAL_MS) {
    await new Promise((resolve) =>
      setTimeout(resolve, MIN_REQUEST_INTERVAL_MS - timeSinceLast)
    );
  }
  lastRequestTimestamp = Date.now();
}

const genreMap: Record<number, string> = {
  28: "Action",
  12: "Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Family",
  14: "Fantasy",
  36: "History",
  27: "Horror",
  10402: "Music",
  9648: "Mystery",
  10749: "Romance",
  878: "Sci-Fi",
  10770: "TV Movie",
  53: "Thriller",
  10752: "War",
  37: "Western",
  10759: "Action & Adventure",
  10762: "Kids",
  10763: "News",
  10764: "Reality-TV",
  10765: "Sci-Fi & Fantasy",
  10766: "Soap",
  10767: "Talk-Show",
  10768: "War & Politics",
};

interface GenreQuerySpec {
  movieGenres?: string;
  tvGenres?: string;
  movieKeywords?: string;
  tvKeywords?: string;
  movieExtra?: Record<string, string>;
  tvExtra?: Record<string, string>;
  preferTvOnly?: boolean;
  preferMovieOnly?: boolean;
  requireAdultAge?: boolean;
}

// Complete mapping for all 29 categories in index.tsx (Movie + TV ID accurate)
const GENRE_SPECS: Record<string, GenreQuerySpec> = {
  action: { movieGenres: "28", tvGenres: "10759" },
  adult: {
    movieExtra: {
      certification_country: "US",
      certification: "R",
      "vote_count.gte": "50",
    },
    tvGenres: "18,80",
    tvExtra: { "vote_count.gte": "50" },
    requireAdultAge: true,
  },
  adventure: { movieGenres: "12", tvGenres: "10759" },
  animation: { movieGenres: "16", tvGenres: "16" },
  biography: {
    movieGenres: "18,36",
    movieKeywords: "9672",
    tvGenres: "99,18",
    tvKeywords: "9672",
  },
  comedy: { movieGenres: "35", tvGenres: "35" },
  crime: { movieGenres: "80", tvGenres: "80" },
  documentary: { movieGenres: "99", tvGenres: "99" },
  drama: { movieGenres: "18", tvGenres: "18" },
  family: { movieGenres: "10751", tvGenres: "10751" },
  fantasy: { movieGenres: "14", tvGenres: "10765" },
  "film noir": {
    movieGenres: "80,9648",
    movieKeywords: "10714",
    tvGenres: "80,9648",
    preferMovieOnly: true,
  },
  "game show": {
    tvGenres: "10764",
    tvKeywords: "10085",
    movieGenres: "35",
    preferTvOnly: true,
  },
  history: { movieGenres: "36", tvGenres: "99,10768" },
  horror: { movieGenres: "27", tvGenres: "9648,10765" },
  musical: {
    movieGenres: "10402",
    movieKeywords: "4344",
    tvGenres: "35,18",
    tvKeywords: "4344",
  },
  music: { movieGenres: "10402", tvGenres: "99" },
  mystery: { movieGenres: "9648", tvGenres: "9648" },
  news: { tvGenres: "10763", movieGenres: "99", preferTvOnly: true },
  "reality-tv": { tvGenres: "10764", movieGenres: "99", preferTvOnly: true },
  romance: { movieGenres: "10749", tvGenres: "18" },
  "sci-fi": { movieGenres: "878", tvGenres: "10765" },
  "sci-fi & fantasy": { movieGenres: "878,14", tvGenres: "10765" },
  short: {
    movieExtra: { "with_runtime.lte": "45", "vote_count.gte": "10" },
    tvExtra: { "with_runtime.lte": "30" },
    preferMovieOnly: true,
  },
  sport: {
    movieKeywords: "6075",
    tvKeywords: "6075",
    movieGenres: "99,18",
    tvGenres: "99",
  },
  "talk-show": { tvGenres: "10767", movieGenres: "35", preferTvOnly: true },
  thriller: { movieGenres: "53", tvGenres: "80,9648" },
  war: { movieGenres: "10752", tvGenres: "10768" },
  western: { movieGenres: "37", tvGenres: "37" },
};

// Official TMDB Watch Provider IDs for Canada (watch_region=CA)
const providerIdMap: Record<string, string> = {
  Netflix: "8",
  Prime: "119",
  "Prime Video": "119",
  "Disney+": "337",
  Disney: "337",
};

function getGenreName(genreIds: number[]): string {
  if (!genreIds || genreIds.length === 0) return "Entertainment";
  const mappedGenres = genreIds.map((id) => genreMap[id]).filter(Boolean);
  return mappedGenres.length > 0 ? mappedGenres.join(", ") : "Entertainment";
}

function mapTmdbItemToMediaItem(
  item: Record<string, unknown>,
  mediaType: "movie" | "tv",
  imageWidth: "w342" | "w500"
): MediaItem | null {
  const title = (item.title || item.name) as string | undefined;
  if (!title) return null;

  const releaseDate = (item.release_date || item.first_air_date || "") as string;

  if (releaseDate) {
    const releaseTime = new Date(releaseDate).getTime();
    const maxAllowedTime = Date.now() + 30 * 24 * 60 * 60 * 1000;
    if (!isNaN(releaseTime) && releaseTime > maxAllowedTime) {
      return null;
    }
  }

  const tmdbId = item.id;
  const uniqueId = `${mediaType}-${tmdbId}`;
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
  const genreIds = Array.isArray(item.genre_ids)
    ? (item.genre_ids as number[])
    : [];
  const genre = getGenreName(genreIds);
  const description =
    (item.overview as string) || "Discover this title on RABBiT TV";

  return {
    id: uniqueId,
    title,
    description,
    image: imagePath,
    href: `/details?id=${tmdbId}&type=${mediaType}`,
    genre,
    year: year || undefined,
    rating,
    mediaType,
    releaseDate,
    genreIds,
    certification: item.adult ? "R" : undefined,
  };
}

async function fetchTmdb(
  endpoint: string,
  page = 1,
  extraParams: Record<string, string> = {}
): Promise<Record<string, unknown>> {
  await throttleRequest();

  const url = new URL(endpoint, TMDB_BASE_URL);
  if (TMDB_API_KEY) {
    url.searchParams.set("api_key", TMDB_API_KEY);
  }
  url.searchParams.set("page", page.toString());
  url.searchParams.set("include_adult", "false");

  for (const [key, value] of Object.entries(extraParams)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  }

  const controller = new AbortController();
  const timer =
    typeof window !== "undefined"
      ? window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
      : setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url.toString(), { signal: controller.signal });
    if (!response.ok) {
      throw new Error(
        `TMDB request failed: ${response.status} ${response.statusText}`
      );
    }
    return (await response.json()) as Record<string, unknown>;
  } finally {
    if (typeof window !== "undefined") {
      window.clearTimeout(timer as number);
    } else {
      clearTimeout(timer);
    }
  }
}

function buildRegionParams(cleanSubFeed?: string): Record<string, string> {
  const params: Record<string, string> = {};
  if (!cleanSubFeed || providerIdMap[cleanSubFeed]) return params;

  if (cleanSubFeed === "Russian") {
    params.with_original_language = "ru";
  } else if (cleanSubFeed === "English") {
    params.with_original_language = "en";
  } else if (cleanSubFeed === "British") {
    params.with_original_language = "en";
    params.with_origin_country = "GB";
  } else if (cleanSubFeed === "Hungarian") {
    params.with_original_language = "hu";
  } else if (cleanSubFeed === "German") {
    params.with_original_language = "de";
    params.with_origin_country = "DE";
  } else if (cleanSubFeed === "Arabic / Islamic") {
    params.with_original_language = "ar";
  } else if (cleanSubFeed === "Ukrainian") {
    params.with_original_language = "uk";
  } else if (
    cleanSubFeed === "Canada (All)" ||
    cleanSubFeed === "Ontario / Toronto" ||
    cleanSubFeed === "Atlantic Canada" ||
    cleanSubFeed === "Western Canada"
  ) {
    params.with_origin_country = "CA";
  }
  return params;
}

function readCatalogCache(storageKey: string): CachedCatalogEntry | null {
  const mem = memoryCatalogCache.get(storageKey);
  if (mem && Date.now() - mem.cachedAt < CACHE_TTL_MS) {
    return mem;
  }

  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedCatalogEntry;
    if (
      parsed &&
      Array.isArray(parsed.items) &&
      typeof parsed.cachedAt === "number" &&
      Date.now() - parsed.cachedAt < CACHE_TTL_MS
    ) {
      memoryCatalogCache.set(storageKey, parsed);
      return parsed;
    }
  } catch {
    // ignore corrupt cache
  }
  return null;
}

function writeCatalogCache(
  storageKey: string,
  entry: CachedCatalogEntry
): void {
  const capped: CachedCatalogEntry = {
    ...entry,
    items: entry.items.slice(0, MAX_CACHED_ITEMS_PER_KEY),
  };
  memoryCatalogCache.set(storageKey, capped);

  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKey, JSON.stringify(capped));
  } catch {
    // Quota full on 1-2GB stick: purge stale caches and retry once
    try {
      purgeOldTmdbCaches();
      localStorage.setItem(storageKey, JSON.stringify(capped));
    } catch {
      // Fall back to in-memory cache only
    }
  }
}

export async function scrapeTrendingContent(page = 1): Promise<ScrapeResult> {
  return scrapeCategoryContent("Home", page, "Trending");
}

export async function scrapeCategoryContent(
  category: string,
  page = 1,
  genreFilter = "Trending",
  subFeed?: string
): Promise<ScrapeResult> {
  try {
    const imageWidth = getOptimalTmdbImageWidth();
    const cleanSubFeed =
      subFeed && subFeed !== "All (Default)" ? subFeed : undefined;
    const normalizedGenre = (genreFilter || "Trending").trim().toLowerCase();
    const genreSpec =
      normalizedGenre !== "trending" ? GENRE_SPECS[normalizedGenre] : undefined;

    // Gate "Adult" category strictly behind age 16+ and unlocked Kids Mode
    if (
      genreSpec?.requireAdultAge &&
      (getKidsModeLocked() || getSavedUserAge() < 16)
    ) {
      return {
        source: "TMDB API",
        items: [],
        fetchedAt: new Date().toISOString(),
        message:
          "🔒 Mature category is restricted by your Age Lock or Kids Safe Mode.",
        page: 1,
        totalPages: 1,
      };
    }

    const feedKey = cleanSubFeed ? `_${cleanSubFeed}` : "";
    const storageKey = `${STORAGE_PREFIX}${category}${feedKey}_${normalizedGenre}_${imageWidth}`;
    const requiredItemsCount = page * ITEMS_PER_PAGE;

    let catalogItems: MediaItem[] = [];
    let maxApiPageReached = 0;
    let totalAvailablePages = 50;
    let isFullyLoaded = false;

    const cached = readCatalogCache(storageKey);
    if (cached) {
      catalogItems = [...cached.items];
      maxApiPageReached = cached.maxApiPageReached || 0;
      totalAvailablePages = cached.totalAvailablePages || 50;
      isFullyLoaded = cached.isFullyLoaded || false;
    }

    const seenIds = new Set(catalogItems.map((i) => i.id));

    if (catalogItems.length < requiredItemsCount && !isFullyLoaded) {
      let safetyLoops = 0;
      while (
        catalogItems.length < requiredItemsCount &&
        maxApiPageReached < totalAvailablePages &&
        safetyLoops < 3
      ) {
        safetyLoops++;
        const nextApiPage = maxApiPageReached + 1;
        const batch: MediaItem[] = [];

        const providerId =
          providerIdMap[category] ||
          (cleanSubFeed ? providerIdMap[cleanSubFeed] : undefined);
        const regionParams = buildRegionParams(cleanSubFeed);

        const isTvTab = category === "Series" || category === "TV Shows";
        const isMovieTab = category === "Movies";
        const isInTheaters = category === "In Theaters";
        const isHomeTrending =
          category === "Home" &&
          normalizedGenre === "trending" &&
          !providerId &&
          !cleanSubFeed;

        if (isHomeTrending) {
          // Pure Home + Trending -> weekly trending movies & TV
          const [movieData, tvData] = await Promise.all([
            fetchTmdb("trending/movie/week", nextApiPage),
            fetchTmdb("trending/tv/week", nextApiPage),
          ]);

          totalAvailablePages = Math.min(
            Math.max(
              (movieData.total_pages as number) || 1,
              (tvData.total_pages as number) || 1
            ),
            50
          );

          const movieResults =
            (movieData.results as Record<string, unknown>[]) || [];
          const tvResults = (tvData.results as Record<string, unknown>[]) || [];

          // Interleave movies and TV shows so Home feels balanced
          const maxLen = Math.max(movieResults.length, tvResults.length);
          for (let i = 0; i < maxLen; i++) {
            if (movieResults[i]) {
              const m = mapTmdbItemToMediaItem(
                movieResults[i],
                "movie",
                imageWidth
              );
              if (m) batch.push(m);
            }
            if (tvResults[i]) {
              const t = mapTmdbItemToMediaItem(tvResults[i], "tv", imageWidth);
              if (t) batch.push(t);
            }
          }
        } else if (isInTheaters) {
          // In Theaters: use discover/movie with a 45-day theatrical window when a genre is picked
          const today = new Date();
          const past45 = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
          const fmt = (d: Date) => d.toISOString().split("T")[0];

          const theaterParams: Record<string, string> = {
            sort_by: "popularity.desc",
            "primary_release_date.gte": fmt(past45),
            "primary_release_date.lte": fmt(today),
            ...regionParams,
          };

          if (genreSpec?.movieGenres) {
            theaterParams.with_genres = genreSpec.movieGenres;
          }
          if (genreSpec?.movieKeywords) {
            theaterParams.with_keywords = genreSpec.movieKeywords;
          }
          if (genreSpec?.movieExtra) {
            Object.assign(theaterParams, genreSpec.movieExtra);
          }

          const endpoint =
            genreSpec || cleanSubFeed ? "discover/movie" : "movie/now_playing";
          const data = await fetchTmdb(
            endpoint,
            nextApiPage,
            endpoint === "discover/movie" ? theaterParams : {}
          );
          const results = (data.results as Record<string, unknown>[]) || [];
          totalAvailablePages = Math.min((data.total_pages as number) || 20, 50);

          results.forEach((item) => {
            const mapped = mapTmdbItemToMediaItem(item, "movie", imageWidth);
            if (mapped) batch.push(mapped);
          });
        } else {
          // Unified Discover engine for Home+Genre, Movies, TV Shows, Providers & Regions
          const baseParams: Record<string, string> = {
            sort_by: "popularity.desc",
            ...regionParams,
          };

          if (providerId) {
            baseParams.with_watch_providers = providerId;
            baseParams.watch_region = "CA";
            baseParams.with_watch_monetization_types = "flatrate";
          }

          const shouldFetchMovies =
            isMovieTab ||
            (!isTvTab && !genreSpec?.preferTvOnly);
          const shouldFetchTv =
            isTvTab ||
            (category === "Home" && !genreSpec?.preferMovieOnly) ||
            (!isMovieTab && Boolean(genreSpec?.preferTvOnly));

          const fetchPromises: Promise<{
            type: "movie" | "tv";
            data: Record<string, unknown>;
          }>[] = [];

          if (shouldFetchMovies) {
            const movieParams: Record<string, string> = { ...baseParams };
            if (genreSpec?.movieGenres) {
              movieParams.with_genres = genreSpec.movieGenres;
            }
            if (genreSpec?.movieKeywords) {
              movieParams.with_keywords = genreSpec.movieKeywords;
            }
            if (genreSpec?.movieExtra) {
              Object.assign(movieParams, genreSpec.movieExtra);
            }

            fetchPromises.push(
              fetchTmdb("discover/movie", nextApiPage, movieParams).then(
                async (data) => {
                  const res = (data.results as Record<string, unknown>[]) || [];
                  // If strict keyword + genre combo returned 0, relax keyword and retry
                  if (res.length === 0 && movieParams.with_keywords) {
                    delete movieParams.with_keywords;
                    const retry = await fetchTmdb(
                      "discover/movie",
                      nextApiPage,
                      movieParams
                    );
                    return { type: "movie" as const, data: retry };
                  }
                  return { type: "movie" as const, data };
                }
              )
            );
          }

          if (shouldFetchTv) {
            const tvParams: Record<string, string> = { ...baseParams };
            if (genreSpec?.tvGenres) {
              tvParams.with_genres = genreSpec.tvGenres;
            }
            if (genreSpec?.tvKeywords) {
              tvParams.with_keywords = genreSpec.tvKeywords;
            }
            if (genreSpec?.tvExtra) {
              Object.assign(tvParams, genreSpec.tvExtra);
            }

            fetchPromises.push(
              fetchTmdb("discover/tv", nextApiPage, tvParams).then(
                async (data) => {
                  const res = (data.results as Record<string, unknown>[]) || [];
                  if (res.length === 0 && tvParams.with_keywords) {
                    delete tvParams.with_keywords;
                    const retry = await fetchTmdb(
                      "discover/tv",
                      nextApiPage,
                      tvParams
                    );
                    return { type: "tv" as const, data: retry };
                  }
                  return { type: "tv" as const, data };
                }
              )
            );
          }

          const settled = await Promise.all(fetchPromises);
          let maxPages = 1;
          for (const entry of settled) {
            const tp = (entry.data.total_pages as number) || 1;
            if (tp > maxPages) maxPages = tp;
            const results =
              (entry.data.results as Record<string, unknown>[]) || [];
            results.forEach((item) => {
              const mapped = mapTmdbItemToMediaItem(
                item,
                entry.type,
                imageWidth
              );
              if (mapped) batch.push(mapped);
            });
          }
          totalAvailablePages = Math.min(maxPages, 50);
        }

        maxApiPageReached = nextApiPage;

        if (batch.length === 0 || nextApiPage >= totalAvailablePages) {
          isFullyLoaded = true;
        }

        for (const item of batch) {
          if (!seenIds.has(item.id)) {
            seenIds.add(item.id);
            catalogItems.push(item);
          }
        }
      }

      writeCatalogCache(storageKey, {
        items: catalogItems,
        maxApiPageReached,
        totalAvailablePages,
        isFullyLoaded,
        cachedAt: Date.now(),
      });
    }

    const startIndex = (page - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const pageSlice = catalogItems.slice(startIndex, endIndex);

    const totalPages = Math.max(
      1,
      Math.ceil(catalogItems.length / ITEMS_PER_PAGE)
    );

    return {
      source: "TMDB API",
      items: pageSlice,
      fetchedAt: new Date().toISOString(),
      message: `Loaded ${pageSlice.length} titles for ${category}${
        cleanSubFeed ? ` (${cleanSubFeed})` : ""
      } / ${genreFilter} (Page ${page}).`,
      page,
      totalPages: isFullyLoaded ? totalPages : Math.max(totalPages, page + 1),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      source: "TMDB API",
      items: [],
      fetchedAt: new Date().toISOString(),
      message: `Could not load catalog: ${message}`,
      page: 1,
      totalPages: 1,
    };
  }
}
