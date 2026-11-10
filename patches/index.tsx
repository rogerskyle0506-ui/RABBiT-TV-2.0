// src/routes/index.tsx
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, memo } from "react";
import type { MediaItem } from "@/lib/tmdb-scraper";
import { scrapeCategoryContent } from "@/lib/tmdb-scraper";
import {
  CardSize,
  AppTheme,
  getSavedCardSize,
  getSavedTheme,
  getSavedUserAge,
  isAllowedForAge,
  getPosterDimensions,
} from "@/lib/settings";
import { getRawWatchHistory, isTitleDisliked } from "@/lib/watch-history";
import { isTitleBroken } from "@/lib/broken-links";
import { AppWallpaper } from "@/components/AppWallpaper";
import React from "react";

const navTabs = ["Home", "TV Shows", "Movies", "In Theaters", "Live TV & Sports", "My List"] as const;
type NavTab = (typeof navTabs)[number];

const genreCategories = [
  "Trending",
  "Action",
  "Drama",
  "Comedy",
  "Sci-Fi",
  "Horror",
];

const providerCategories = [
  { name: "All (Default)", logo: "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/AllDefault.jpg" },
  { name: "Netflix", logo: "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/netflix-.png" },
  { name: "Prime", logo: "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/Prime.png" },
  { name: "Disney+", logo: "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/disney-plus-logo-white.png" },
];

const MY_LIST_STORAGE_KEY = "rabtv_my_list";
const FAVORITES_STORAGE_KEY = "rabtv_favorites";
const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY as string;
const TMDB_BASE_URL = "https://api.themoviedb.org/3/";

// Background asset matching the console pill bar and side menu style
const RABBIT_HEADER_PILL = "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/main/assets/rabbit-header-pill.jpg";
const RABBIT_PANEL       = "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/main/assets/rabbit-panel.jpg";
const RABBIT_PANEL_ALT   = "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/main/assets/rabbit-panel-alt.jpg";
const RABBIT_DIVIDER     = "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/main/assets/rabbit-divider.jpg";

function getDetailsSearch(item: MediaItem): { id: string; type: "movie" | "tv" } {
  const cleanId = String(item.id).replace(/^(movie|tv)-/i, "");
  const type: "movie" | "tv" =
    item.mediaType === "tv" || String(item.id).toLowerCase().startsWith("tv-")
      ? "tv"
      : "movie";
  return { id: cleanId, type };
}

export function MediaCard({ item }: { item: MediaItem }) {
  const [cardSize, setCardSize] = useState<CardSize>("large");
  const [appTheme, setAppTheme] = useState<AppTheme>("violet");

  useEffect(() => {
    setCardSize(getSavedCardSize());
    setAppTheme(getSavedTheme());

    const handleSettingsUpdate = () => {
      setCardSize(getSavedCardSize());
      setAppTheme(getSavedTheme());
    };

    window.addEventListener("rabtv_settings_updated", handleSettingsUpdate);
    return () =>
      window.removeEventListener("rabtv_settings_updated", handleSettingsUpdate);
  }, []);

  const cardThemeStyles = useMemo(() => {
    switch (appTheme) {
      case "red":
        return {
          bg: "bg-gradient-to-b from-red-950/70 via-zinc-900 to-black",
          border: "border-red-500/30",
          ring: "focus-within:ring-red-400 focus:ring-red-400",
        };
      case "midnight":
        return {
          bg: "bg-gradient-to-b from-blue-950/70 via-slate-900 to-slate-950",
          border: "border-blue-500/30",
          ring: "focus-within:ring-blue-400 focus:ring-blue-400",
        };
      case "emerald":
        return {
          bg: "bg-gradient-to-b from-emerald-950/70 via-slate-900 to-slate-950",
          border: "border-emerald-500/30",
          ring: "focus-within:ring-emerald-400 focus:ring-emerald-400",
        };
      case "amber":
        return {
          bg: "bg-gradient-to-b from-yellow-950/70 via-stone-900 to-stone-950",
          border: "border-amber-500/30",
          ring: "focus-within:ring-amber-400 focus:ring-amber-400",
        };
      case "cyan":
        return {
          bg: "bg-gradient-to-b from-cyan-950/70 via-slate-900 to-slate-950",
          border: "border-cyan-500/30",
          ring: "focus-within:ring-cyan-400 focus:ring-cyan-400",
        };
      case "violet":
      default:
        return {
          bg: "bg-gradient-to-b from-purple-950/70 via-slate-900 to-slate-950",
          border: "border-violet-500/30",
          ring: "focus-within:ring-violet-400 focus:ring-violet-400",
        };
    }
  }, [appTheme]);

  const dimensions = getPosterDimensions(cardSize);
  const detailsSearch = getDetailsSearch(item);

  if (cardSize === "small") {
    return (
      <Link
        to="/details"
        search={detailsSearch}
        className={`group flex ${dimensions.card} ${cardThemeStyles.bg} border ${cardThemeStyles.border} focus:outline-none focus:ring-4 ${cardThemeStyles.ring} hover:scale-105 overflow-hidden relative rounded-xl transition w-full shadow-lg bg-black`}
      >
        <img
          src={item.image}
          alt={item.title}
          className="absolute inset-0 h-full w-full object-cover object-center"
          loading="lazy"
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent p-1.5 text-center z-10">
          <p className="text-[10px] font-bold text-white truncate px-1 rounded bg-black/60 backdrop-blur-sm border border-white/10">
            {item.title}
          </p>
        </div>
      </Link>
    );
  }

  return (
    <div
      className={`group relative flex w-full flex-col overflow-hidden rounded-2xl ${cardThemeStyles.bg} border ${cardThemeStyles.border} shadow-xl transition hover:-translate-y-1 ${cardThemeStyles.ring} ${dimensions.card}`}
    >
      <Link
        to="/details"
        search={detailsSearch}
        className="block relative overflow-hidden flex-1 focus:outline-none w-full h-full bg-black flex items-center justify-center"
      >
        <img
          src={item.image}
          alt={item.title}
          className="absolute inset-0 h-full w-full object-cover object-center transition group-hover:scale-105"
          loading="lazy"
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent p-2.5 z-10">
          <div className="flex items-center justify-between mb-1">
            <span className="rounded-full bg-black/60 px-2 py-0.5 text-[9px] uppercase tracking-[0.18em] text-slate-200 truncate max-w-[70%] backdrop-blur-sm border border-white/10">
              {item.genre ?? "TV"}
            </span>
            {item.year ? (
              <span className="text-[10px] text-slate-300 font-medium">{item.year}</span>
            ) : null}
          </div>
          <h4 className={`font-bold text-white drop-shadow truncate ${dimensions.text}`}>
            {item.title}
          </h4>
          {item.rating && (
            <p className="mt-0.5 text-xs text-yellow-300 font-semibold drop-shadow">⭐ {item.rating}</p>
          )}
        </div>
      </Link>

      <div className="p-2 bg-black/90 border-t border-white/10 flex items-center justify-between z-20">
        <Link
          to="/details"
          search={detailsSearch}
          className={`w-full text-center rounded-full bg-gradient-to-r from-black/80 via-black to-black/80 border border-white/10 py-1 text-[10px] font-bold text-white shadow-inner hover:bg-white/20 transition focus:outline-none focus:ring-2 ${cardThemeStyles.ring}`}
        >
          WATCH →
        </Link>
      </div>
    </div>
  );
}

const MemoizedMediaCard = memo(
  function MemoizedMediaCard({ item }: { item: MediaItem }) {
    return <MediaCard item={item} />;
  },
  (prevProps, nextProps) => prevProps.item.id === nextProps.item.id
);

MemoizedMediaCard.displayName = "MemoizedMediaCard";

export const Route = createFileRoute("/")({
  component: Home,
  validateSearch: (search: Record<string, unknown>): { tab?: string } => {
    return {
      tab: (search.tab as string) || undefined,
    };
  },
});

function Home() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [activeTab, setActiveTab] = useState<NavTab>(() => {
    if (search.tab && navTabs.includes(search.tab as NavTab)) {
      return search.tab as NavTab;
    }
    return "Home";
  });

  useEffect(() => {
    if (search.tab && navTabs.includes(search.tab as NavTab)) {
      setActiveTab(search.tab as NavTab);
    }
  }, [search.tab]);

  const [selectedGenre, setSelectedGenre] = useState<string>("Trending");
  
  const [providerFilter, setProviderFilter] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("rabtv_provider_filter") || "All (Default)";
    }
    return "All (Default)";
  });

  const [globalFeedOverride, setGlobalFeedOverride] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("rabtv_global_feed") || "All (Default)";
    }
    return "All (Default)";
  });

  const handleTabSelect = (tab: NavTab) => {
    if (tab === "Live TV & Sports") {
      navigate({ to: "/live-tv" });
      return;
    }
    setActiveTab(tab);
  };

  const handleProviderSelect = (provider: string) => {
    setProviderFilter(provider);
    if (typeof window !== "undefined") {
      localStorage.setItem("rabtv_provider_filter", provider);
    }
  };

  const scrollPill = (elementId: string, direction: "left" | "right") => {
    const el = document.getElementById(elementId);
    if (el) {
      el.scrollBy({ left: direction === "left" ? -220 : 220, behavior: "smooth" });
    }
  };

  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [appTheme, setAppTheme] = useState<AppTheme>("violet");
  const [userAge, setUserAge] = useState<number>(18);
  const [myListSubTab, setMyListSubTab] = useState<"all" | "in_progress" | "mylist" | "favorites">("all");
  const [savedMyList, setSavedMyList] = useState<MediaItem[]>([]);
  const [savedFavorites, setSavedFavorites] = useState<MediaItem[]>([]);
  const [historyItems, setHistoryItems] = useState<MediaItem[]>([]);
  const [suggestedItems, setSuggestedItems] = useState<MediaItem[]>([]);

  const [currentHeroIndex, setCurrentHeroIndex] = useState(0);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [cardSize, setCardSize] = useState<CardSize>("large");
  const [canScrollDown, setCanScrollDown] = useState(false);
  const [showScrollReminder, setShowScrollReminder] = useState(false);

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
  }, [items, loading]);

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

  const loadSavedListsAndTheme = () => {
    try {
      const listData = JSON.parse(localStorage.getItem(MY_LIST_STORAGE_KEY) || "[]");
      const favData = JSON.parse(localStorage.getItem(FAVORITES_STORAGE_KEY) || "[]");

      const rawHistory = getRawWatchHistory();
      const mappedHistory: MediaItem[] = rawHistory.map((h) => {
        const type = h.mediaType ?? h.media_type ?? (String(h.id).startsWith("tv-") ? "tv" : "movie");
        const cleanId = String(h.mediaId ?? h.id).replace(/^(movie|tv)-/, "");
        const imagePath = h.posterPath ?? h.poster_path ?? h.image;
        const imageUrl = imagePath?.startsWith("http")
          ? imagePath
          : imagePath
          ? `https://image.tmdb.org/t/p/w500${imagePath}`
          : "/placeholder.png";

        return {
          id: String(h.id),
          title: h.title ?? "Unknown Title",
          image: imageUrl,
          href: `/details?id=${cleanId}&type=${type}`,
          genre: type.toUpperCase(),
          mediaType: type as "movie" | "tv",
          progressPercent: h.progressPercent ?? (h.confirmedCompleted ? 100 : 0),
          confirmedCompleted: h.confirmedCompleted ?? false,
          genreIds: (h as any).genreIds || [],
        } as MediaItem & {
          progressPercent?: number;
          confirmedCompleted?: boolean;
          mediaType?: "movie" | "tv";
          genreIds?: number[];
        };
      });

      setSavedMyList(listData);
      setSavedFavorites(favData);
      setHistoryItems(mappedHistory);
      setAppTheme(getSavedTheme());
      setCardSize(getSavedCardSize());
      setUserAge(getSavedUserAge());
    } catch (err) {
      console.error("Error reading saved lists/theme/age", err);
    }
  };

  useEffect(() => {
    loadSavedListsAndTheme();
    const handleSettingsUpdate = () => {
      loadSavedListsAndTheme();
    };

    const handleGlobalFeedUpdate = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        setGlobalFeedOverride(customEvent.detail);
      }
    };

    window.addEventListener("rabtv_catalog_updated", loadSavedListsAndTheme);
    window.addEventListener("rabtv_watch_history_updated", loadSavedListsAndTheme);
    window.addEventListener("rabtv_settings_updated", handleSettingsUpdate);
    window.addEventListener("rabtv_global_feed_updated", handleGlobalFeedUpdate as EventListener);
    window.addEventListener("rabtv_broken_links_updated", loadSavedListsAndTheme);

    return () => {
      window.removeEventListener("rabtv_catalog_updated", loadSavedListsAndTheme);
      window.removeEventListener("rabtv_watch_history_updated", loadSavedListsAndTheme);
      window.removeEventListener("rabtv_settings_updated", handleSettingsUpdate);
      window.removeEventListener("rabtv_global_feed_updated", handleGlobalFeedUpdate as EventListener);
      window.removeEventListener("rabtv_broken_links_updated", loadSavedListsAndTheme);
    };
  }, []);

  useEffect(() => {
    setPage(1);
  }, [activeTab, selectedGenre, globalFeedOverride, providerFilter]);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);

      if (activeTab === "My List") {
        if (active) {
          setTotalPages(1);
          setLoading(false);
        }
        return;
      }

      const scraperCategory = activeTab === "TV Shows" ? "Series" : activeTab;
      const activeGlobalFeed =
        globalFeedOverride && globalFeedOverride !== "All (Default)" ? globalFeedOverride : undefined;
      
      const effectiveSubFeed =
        providerFilter && providerFilter !== "All (Default)" ? providerFilter : activeGlobalFeed;

      try {
        const result = await scrapeCategoryContent(scraperCategory, page, selectedGenre, effectiveSubFeed);
        if (!active) return;

        if (result?.items?.length) {
          setItems(result.items);
          setTotalPages(result.totalPages || 1);
        } else {
          setItems([]);
          if (result?.message) setError(result.message);
        }
      } catch (caught) {
        if (!active) return;
        setError(caught instanceof Error ? caught.message : "Failed to load media");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [activeTab, page, selectedGenre, globalFeedOverride, providerFilter]);

  useEffect(() => {
    let active = true;
    async function fetchSmartSuggestions() {
      if (activeTab !== "My List") return;
      try {
        const apiKey = TMDB_API_KEY;
        const seedItems = [
          ...savedFavorites,
          ...savedMyList,
          ...historyItems.filter((h: any) => h.confirmedCompleted || (h.progressPercent ?? 0) > 20),
        ];

        const genreCounts: Record<number, number> = {};
        let totalGenresLogged = 0;

        for (const item of seedItems) {
          const ids = (item as any).genreIds || [];
          for (const gid of ids) {
            if (typeof gid === "number") {
              genreCounts[gid] = (genreCounts[gid] || 0) + 1;
              totalGenresLogged++;
            }
          }
        }

        let targetGenreIds: number[] = [28, 12];
        if (totalGenresLogged > 0) {
          const sortedGenres = Object.entries(genreCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([id]) => Number(id));
          targetGenreIds = sortedGenres.slice(0, 3);
        }

        const genreQueryParam = targetGenreIds.join(",");
        const res = await fetch(
          `${TMDB_BASE_URL}discover/movie?api_key=${apiKey}&with_genres=${genreQueryParam}&sort_by=popularity.desc&vote_average.gte=6.0&page=1`
        );
        const data = await res.json();
        const pool: MediaItem[] = [];

        for (const item of data.results || []) {
          const tmdbId = String(item.id);
          const title = item.title || item.name;
          if (!title || !item.poster_path) continue;

          if (
            isTitleDisliked(tmdbId) ||
            isTitleDisliked(`movie-${tmdbId}`) ||
            isTitleBroken(tmdbId) ||
            isTitleBroken(`movie-${tmdbId}`)
          )
            continue;

          pool.push({
            id: `movie-${tmdbId}`,
            title,
            description: item.overview || "",
            image: `https://image.tmdb.org/t/p/w500${item.poster_path}`,
            href: `/details?id=${tmdbId}&type=movie`,
            genre: "SUGGESTED FOR YOU",
            year: (item.release_date || "").split("-")[0],
            rating: item.vote_average ? item.vote_average.toFixed(1) : undefined,
            mediaType: "movie",
            releaseDate: item.release_date || item.first_air_date,
          });
        }

        if (!active) return;

        const watchedIds = new Set([
          ...historyItems.map((h) => String(h.id).replace(/^(movie|tv)-/, "")),
          ...savedFavorites.map((f) => String(f.id).replace(/^(movie|tv)-/, "")),
          ...savedMyList.map((m) => String(m.id).replace(/^(movie|tv)-/, "")),
        ]);

        const uniqueSuggestions = new Map<string, MediaItem>();
        for (const candidate of pool) {
          const cleanId = String(candidate.id).replace(/^(movie|tv)-/, "");
          if (watchedIds.has(cleanId)) continue;
          if (!isAllowedForAge((candidate as any).certification, candidate.genre, userAge)) continue;
          uniqueSuggestions.set(cleanId, candidate);
        }

        setSuggestedItems(Array.from(uniqueSuggestions.values()).slice(0, 15));
      } catch (e) {
        console.error("Failed to load smart genre suggestions", e);
      }
    }

    void fetchSmartSuggestions();
    return () => {
      active = false;
    };
  }, [activeTab, savedFavorites, savedMyList, historyItems, userAge]);

  const inProgressHistory = useMemo(
    () => historyItems.filter((i: any) => !i.confirmedCompleted && (i.progressPercent ?? 0) < 100),
    [historyItems]
  );

  const savedCatalogItems = useMemo(() => {
    let rawList: MediaItem[] = [];
    if (myListSubTab === "mylist") rawList = savedMyList;
    else if (myListSubTab === "favorites") rawList = savedFavorites;
    else if (myListSubTab === "in_progress") rawList = inProgressHistory;
    else {
      rawList = [...savedFavorites, ...savedMyList, ...inProgressHistory];
    }

    const map = new Map<string, MediaItem>();
    const now = Date.now();
    const oneWeekMs = 7 * 24 * 60 * 60 * 1000;

    for (const item of rawList) {
      if (isTitleDisliked(item.id) || isTitleBroken(item.id)) continue;
      if (!isAllowedForAge((item as any).certification, item.genre, userAge)) continue;

      const releaseDateStr = (item as any).releaseDate || (item as any).release_date || (item as any).first_air_date;
      if (releaseDateStr) {
        const releaseTime = new Date(releaseDateStr).getTime();
        if (!isNaN(releaseTime) && releaseTime > now + oneWeekMs) {
          continue;
        }
      }

      const normalizedTitle = (item.title ?? "").trim().toLowerCase();
      const uniqueKey = normalizedTitle || String(item.id);

      if (!map.has(uniqueKey)) {
        map.set(uniqueKey, item);
      }
    }
    return Array.from(map.values());
  }, [myListSubTab, savedMyList, savedFavorites, inProgressHistory, userAge]);

  const filteredItems = useMemo(() => {
    const baseList = activeTab === "My List" ? savedCatalogItems : items;
    const now = Date.now();
    const oneWeekMs = 7 * 24 * 60 * 60 * 1000;

    return baseList.filter((item) => {
      if (isTitleDisliked(item.id) || isTitleBroken(item.id)) return false;
      if (!isAllowedForAge((item as any).certification, item.genre, userAge)) return false;

      const releaseDateStr = (item as any).releaseDate || (item as any).release_date || (item as any).first_air_date;
      if (releaseDateStr) {
        const releaseTime = new Date(releaseDateStr).getTime();
        if (!isNaN(releaseTime) && releaseTime > now + oneWeekMs) {
          return false;
        }
      }

      return true;
    });
  }, [items, activeTab, savedCatalogItems, userAge]);

  const heroSourceList = useMemo(() => {
    if (activeTab === "My List") {
      return suggestedItems.length > 0 ? suggestedItems : savedCatalogItems;
    }
    return items;
  }, [activeTab, suggestedItems, savedCatalogItems, items]);

  const heroItems = useMemo(() => {
    const watchedIds = new Set(
      historyItems.map((h) => String(h.mediaId ?? h.id).replace(/^(movie|tv)-/i, ""))
    );
    const now = Date.now();
    const oneWeekMs = 7 * 24 * 60 * 60 * 1000;

    return heroSourceList.filter((item) => {
      const cleanId = String(item.id).replace(/^(movie|tv)-/i, "");
      if (watchedIds.has(cleanId)) return false;
      if (isTitleDisliked(item.id) || isTitleDisliked(cleanId)) return false;

      const releaseDateStr = (item as any).releaseDate || (item as any).release_date || (item as any).first_air_date;
      if (releaseDateStr) {
        const releaseTime = new Date(releaseDateStr).getTime();
        if (!isNaN(releaseTime) && releaseTime > now + oneWeekMs) {
          return false;
        }
      }

      return true;
    });
  }, [heroSourceList, historyItems]);

  useEffect(() => {
    setCurrentHeroIndex(0);
  }, [heroItems]);

  useEffect(() => {
    if (heroItems.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentHeroIndex((prevIndex) => (prevIndex + 1) % heroItems.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [heroItems.length]);

  const gridColsClass = useMemo(() => {
    if (cardSize === "small") {
      return "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 justify-items-center";
    }
    if (cardSize === "medium") {
      return "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 justify-items-center";
    }
    return "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 justify-items-center";
  }, [cardSize]);

  const themeStyles =
    {
      violet: {
        bg: "bg-gradient-to-br from-slate-950/70 via-purple-950/35 to-slate-950/80",
        cardGradient: "from-purple-950/80 via-slate-900 to-indigo-950/80",
        btnActive:
          "bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 text-white shadow-lg shadow-violet-600/30",
        accentText: "text-violet-300",
        borderGlow: "border-violet-500/30",
        activeGlow: "bg-violet-950/80 text-white shadow-lg shadow-violet-500/50 border-2 border-violet-400 scale-105",
        inactiveGlow: "bg-black/50 hover:bg-black/80 text-slate-300 border border-white/10",
      },
      red: {
        bg: "bg-gradient-to-br from-zinc-950/70 via-red-950/35 to-black/80",
        cardGradient: "from-red-950/80 via-zinc-900 to-neutral-950",
        btnActive:
          "bg-gradient-to-r from-red-600 via-rose-600 to-orange-600 text-white shadow-lg shadow-red-600/30",
        accentText: "text-red-400",
        borderGlow: "border-red-500/30",
        activeGlow: "bg-red-950/80 text-white shadow-lg shadow-red-500/50 border-2 border-red-400 scale-105",
        inactiveGlow: "bg-black/50 hover:bg-black/80 text-slate-300 border border-white/10",
      },
      midnight: {
        bg: "bg-gradient-to-br from-slate-950/70 via-blue-950/35 to-slate-950/80",
        cardGradient: "from-blue-950/80 via-slate-900 to-sky-950/80",
        btnActive:
          "bg-gradient-to-r from-blue-600 via-cyan-600 to-sky-600 text-white shadow-lg shadow-blue-600/30",
        accentText: "text-sky-300",
        borderGlow: "border-sky-500/30",
        activeGlow: "bg-sky-950/80 text-white shadow-lg shadow-sky-500/50 border-2 border-sky-400 scale-105",
        inactiveGlow: "bg-black/50 hover:bg-black/80 text-slate-300 border border-white/10",
      },
      emerald: {
        bg: "bg-gradient-to-br from-slate-950/70 via-emerald-950/35 to-slate-950/80",
        cardGradient: "from-emerald-950/80 via-slate-900 to-teal-950/80",
        btnActive:
          "bg-gradient-to-r from-emerald-600 via-teal-600 to-green-600 text-white shadow-lg shadow-emerald-600/30",
        accentText: "text-emerald-300",
        borderGlow: "border-emerald-500/30",
        activeGlow: "bg-emerald-950/80 text-white shadow-lg shadow-emerald-500/50 border-2 border-emerald-400 scale-105",
        inactiveGlow: "bg-black/50 hover:bg-black/80 text-slate-300 border border-white/10",
      },
      amber: {
        bg: "bg-gradient-to-br from-stone-950/70 via-yellow-950/35 to-neutral-950/80",
        cardGradient: "from-yellow-950/80 via-stone-900 to-amber-950/80",
        btnActive:
          "bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 text-white shadow-lg shadow-amber-600/30",
        accentText: "text-amber-300",
        borderGlow: "border-amber-500/30",
        activeGlow: "bg-amber-950/80 text-white shadow-lg shadow-amber-500/50 border-2 border-amber-400 scale-105",
        inactiveGlow: "bg-black/50 hover:bg-black/80 text-slate-300 border border-white/10",
      },
      cyan: {
        bg: "bg-gradient-to-br from-slate-950/70 via-cyan-950/35 to-slate-950/80",
        cardGradient: "from-cyan-950/80 via-slate-900 to-blue-950/80",
        btnActive:
          "bg-gradient-to-r from-cyan-600 via-teal-600 to-blue-600 text-white shadow-lg shadow-cyan-600/30",
        accentText: "text-cyan-300",
        borderGlow: "border-cyan-500/30",
        activeGlow: "bg-cyan-950/80 text-white shadow-lg shadow-cyan-500/50 border-2 border-cyan-400 scale-105",
        inactiveGlow: "bg-black/50 hover:bg-black/80 text-slate-300 border border-white/10",
      },
    }[appTheme] ?? {
      bg: "bg-gradient-to-br from-slate-950/70 via-purple-950/35 to-slate-950/80",
      cardGradient: "from-purple-950/80 via-slate-900 to-indigo-950/80",
      btnActive:
        "bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 text-white shadow-lg shadow-violet-600/30",
      accentText: "text-violet-300",
      borderGlow: "border-violet-500/30",
      activeGlow: "bg-violet-950/80 text-white shadow-lg shadow-violet-500/50 border-2 border-violet-400 scale-105",
      inactiveGlow: "bg-black/50 hover:bg-black/80 text-slate-300 border border-white/10",
    };

  const getPrimaryBgColor = (theme: AppTheme) => {
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

  const activeHeroItem = heroItems.length > 0 ? heroItems[currentHeroIndex] : null;
  const heroDetailsSearch = activeHeroItem ? getDetailsSearch(activeHeroItem) : null;

  return (
    <main className={`min-h-screen ${themeStyles.bg} text-slate-100 transition-colors duration-300 pb-20 relative`}>
      <AppWallpaper />
      <div className="relative z-10">
        {/* Navigation Tabs Pill Bar Container */}
        <div className="sticky top-0 z-30 mb-4 mt-2 px-3 py-2.5 flex justify-center">
          <div
            className="relative max-w-7xl w-full flex items-center justify-center rounded-2xl shadow-xl overflow-hidden"
            style={{
              backgroundImage: `url(${RABBIT_HEADER_PILL})`,
              backgroundSize: "117% 380%",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "center center",
              maskImage: "linear-gradient(to right, transparent 0%, black 6%, black 94%, transparent 100%)",
              WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 6%, black 94%, transparent 100%)",
            }}
          >
            <div className="absolute inset-0 bg-black/40 pointer-events-none rounded-2xl z-0" />
            <button
              type="button"
              onClick={() => scrollPill("nav-tabs-pill", "left")}
              className="absolute left-1 z-20 w-7 h-7 bg-black/70 hover:bg-black/90 text-amber-300 rounded-full flex items-center justify-center text-xs font-bold shadow-md transition cursor-pointer"
              title="Scroll Left"
            >
              ‹
            </button>
            <div
              id="nav-tabs-pill"
              className="relative z-10 w-full overflow-x-auto scrollbar-none px-10 sm:px-14 py-2.5 flex items-center justify-start sm:justify-center gap-2"
            >
              <div className="flex items-center gap-2 min-w-max mx-auto">
                {navTabs.map((tab) => {
                  const isActive = activeTab === tab;
                  return (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => handleTabSelect(tab)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                        isActive
                          ? `${getPrimaryBgColor(appTheme)} text-white shadow-md scale-105`
                          : "bg-black/40 hover:bg-black/60 text-slate-200"
                      }`}
                    >
                      {tab}
                    </button>
                  );
                })}
              </div>
            </div>
            <button
              type="button"
              onClick={() => scrollPill("nav-tabs-pill", "right")}
              className="absolute right-1 z-20 w-7 h-7 bg-black/70 hover:bg-black/90 text-amber-300 rounded-full flex items-center justify-center text-xs font-bold shadow-md transition cursor-pointer"
              title="Scroll Right"
            >
              ›
            </button>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 overflow-x-hidden flex flex-col items-center">
          {activeHeroItem && heroDetailsSearch ? (
            <Link
              to="/details"
              search={heroDetailsSearch}
              className={`mb-4 w-full max-w-5xl overflow-hidden rounded-[24px] bg-gradient-to-br ${themeStyles.cardGradient} shadow-2xl relative h-[320px] sm:h-[360px] flex flex-col group focus:outline-none focus:ring-4`}
            >
              <div className="absolute inset-0 w-full h-full overflow-hidden bg-black">
                <img
                  src={activeHeroItem.image}
                  alt={activeHeroItem.title}
                  className="absolute inset-0 h-full w-full object-fill object-center opacity-95 transition duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#050b16]/90 via-black/30 to-transparent"></div>
              </div>

              <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4 flex flex-col justify-end z-10">
                <div className="bg-black/60 backdrop-blur-md p-3 sm:p-3.5 rounded-2xl flex flex-col space-y-1 shadow-2xl text-left">
                  <div
                    className={`flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] ${themeStyles.accentText}`}
                  >
                    <span className="truncate max-w-[200px]">
                      {activeHeroItem.genre ?? "Entertainment"}
                    </span>
                  </div>

                  <div className="flex items-center flex-wrap gap-2 min-w-0">
                    <h2 className="text-base sm:text-lg font-black text-white leading-snug truncate max-w-full">
                      {activeHeroItem.title}
                    </h2>
                    {activeHeroItem.rating && (
                      <span className="rounded-full bg-gradient-to-r from-amber-500/20 to-yellow-500/10 px-2 py-0.5 uppercase tracking-[0.2em] text-yellow-200 text-[10px] font-semibold shrink-0">
                        ⭐ {activeHeroItem.rating}
                      </span>
                    )}
                    {activeHeroItem.year && (
                      <span className="text-[11px] text-slate-300 font-medium shrink-0">
                        {activeHeroItem.year}
                      </span>
                    )}
                  </div>

                  <p className="text-xs leading-relaxed text-slate-300 line-clamp-1">
                    {activeHeroItem.description}
                  </p>
                </div>
              </div>
            </Link>
          ) : (
            <section
              className={`mb-4 w-full max-w-5xl overflow-hidden rounded-[24px] bg-gradient-to-br ${themeStyles.cardGradient} shadow-2xl relative h-[320px] sm:h-[360px] flex flex-col items-center justify-center`}
            >
              <div className="text-slate-300 text-center px-4">
                {loading ? `Loading ${activeTab}...` : error ?? "No media found in this section."}
              </div>
            </section>
          )}

          {activeTab !== "My List" && (
            <section className="mb-4 space-y-2.5 flex flex-col items-center justify-center text-center w-full">
              {/* Genre Categories Pill Bar Container */}
              <div className="flex justify-center w-full px-3">
                <div
                  className="relative max-w-3xl w-full flex items-center justify-center rounded-2xl shadow-xl overflow-hidden"
                  style={{
                    backgroundImage: `url(${RABBIT_HEADER_PILL})`,
                    backgroundSize: "117% 380%",
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "center center",
                    maskImage: "linear-gradient(to right, transparent 0%, black 6%, black 94%, transparent 100%)",
                    WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 6%, black 94%, transparent 100%)",
                  }}
                >
                  <div className="absolute inset-0 bg-black/40 pointer-events-none rounded-2xl z-0" />
                  <button
                    type="button"
                    onClick={() => scrollPill("genre-pill", "left")}
                    className="absolute left-1 z-20 w-7 h-7 bg-black/70 hover:bg-black/90 text-amber-300 rounded-full flex items-center justify-center text-xs font-bold shadow-md transition cursor-pointer"
                    title="Scroll Left"
                  >
                    ‹
                  </button>
                  <div
                    id="genre-pill"
                    className="relative z-10 w-full overflow-x-auto scrollbar-none px-10 sm:px-14 py-2 flex items-center justify-start sm:justify-center gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-max mx-auto">
                      {genreCategories.map((genre) => {
                        const isActive = selectedGenre === genre;
                        return (
                          <button
                            key={genre}
                            type="button"
                            onClick={() => setSelectedGenre(genre)}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                              isActive
                                ? `${getPrimaryBgColor(appTheme)} text-white shadow-md scale-105`
                                : "bg-black/40 hover:bg-black/60 text-slate-200"
                            }`}
                          >
                            {genre}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => scrollPill("genre-pill", "right")}
                    className="absolute right-1 z-20 w-7 h-7 bg-black/70 hover:bg-black/90 text-amber-300 rounded-full flex items-center justify-center text-xs font-bold shadow-md transition cursor-pointer"
                    title="Scroll Right"
                  >
                    ›
                  </button>
                </div>
              </div>

              {/* Provider Categories Logo Pill Bar Container (Restored background size to 117% and shifted position to center 25%) */}
              <div className="flex justify-center w-full px-3">
                <div
                  className="relative max-w-3xl w-full flex items-center justify-center rounded-2xl shadow-xl overflow-hidden"
                  style={{
                    backgroundImage: `url(${RABBIT_HEADER_PILL})`,
                    backgroundSize: "117% 175%",
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "center",
                    maskImage: "linear-gradient(to right, transparent 0%, black 45%, black 94%, transparent 100%)",
                    WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 6%, black 94%, transparent 100%)",
                  }}
                >
                  <div className="absolute inset-0 bg-black/20 pointer-events-none rounded-2xl z-0" />
                  <button
                    type="button"
                    onClick={() => scrollPill("provider-pill", "left")}
                    className="absolute left-1 z-20 w-8 h-8 bg-black/70 hover:bg-black/90 text-amber-300 rounded-full flex items-center justify-center text-xs font-bold shadow-md transition cursor-pointer"
                    title="Scroll Left"
                  >
                    ‹
                  </button>
                  <div
                    id="provider-pill"
                    className="relative z-10 w-full overflow-x-auto scrollbar-none px-12 sm:px-16 py-6 sm:py-7 flex items-center justify-start sm:justify-center gap-6"
                  >
                    <div className="flex items-center gap-6 min-w-max mx-auto">
                      {providerCategories.map((prov) => {
                        const isActive = providerFilter === prov.name;
                        const isDefault = prov.name === "All (Default)";
                        return (
                          <button
                            key={prov.name}
                            type="button"
                            onClick={() => handleProviderSelect(prov.name)}
                            className={`relative group rounded-xl p-3 transition-all cursor-pointer shrink-0 flex items-center justify-center ${
                              isActive ? themeStyles.activeGlow : themeStyles.inactiveGlow
                            }`}
                            title={prov.name}
                          >
                            <img
                              src={prov.logo}
                              alt={prov.name}
                              className={`h-[84px] transition-transform group-hover:scale-105 ${
                                isDefault ? "w-[120px] sm:w-[150px] object-contain" : "w-auto object-contain"
                              }`}
                            />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => scrollPill("provider-pill", "right")}
                    className="absolute right-1 z-20 w-8 h-8 bg-black/70 hover:bg-black/90 text-amber-300 rounded-full flex items-center justify-center text-xs font-bold shadow-md transition cursor-pointer"
                    title="Scroll Right"
                  >
                    ›
                  </button>
                </div>
              </div>
            </section>
          )}

          {activeTab === "My List" && (
            <section className="mb-4 flex justify-center w-full px-3">
              <div
                className="relative max-w-4xl w-full flex items-center justify-center rounded-2xl shadow-xl overflow-hidden"
                style={{
                  backgroundImage: `url(${RABBIT_HEADER_PILL})`,
                  backgroundSize: "117% 380%",
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "center center",
                  maskImage: "linear-gradient(to right, transparent 0%, black 6%, black 94%, transparent 100%)",
                  WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 6%, black 94%, transparent 100%)",
                }}
              >
                <div className="absolute inset-0 bg-black/40 pointer-events-none rounded-2xl z-0" />
                <button
                  type="button"
                  onClick={() => scrollPill("mylist-pill", "left")}
                  className="absolute left-1 z-20 w-7 h-7 bg-black/70 hover:bg-black/90 text-amber-300 rounded-full flex items-center justify-center text-xs font-bold shadow-md transition cursor-pointer"
                  title="Scroll Left"
                >
                  ‹
                </button>
                <div
                  id="mylist-pill"
                  className="relative z-10 w-full overflow-x-auto scrollbar-none px-10 sm:px-14 py-2.5 flex items-center justify-start sm:justify-center gap-2"
                >
                  <div className="flex items-center gap-2 min-w-max mx-auto">
                    <button
                      type="button"
                      onClick={() => setMyListSubTab("all")}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                        myListSubTab === "all"
                          ? `${getPrimaryBgColor(appTheme)} text-white shadow-md scale-105`
                          : "bg-black/40 hover:bg-black/60 text-slate-200"
                      }`}
                    >
                      All Saved ({savedMyList.length + savedFavorites.length + inProgressHistory.length})
                    </button>

                    <button
                      type="button"
                      onClick={() => setMyListSubTab("in_progress")}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                        myListSubTab === "in_progress"
                          ? `${getPrimaryBgColor(appTheme)} text-white shadow-md scale-105`
                          : "bg-black/40 hover:bg-black/60 text-slate-200"
                      }`}
                    >
                      ⏳ In Progress ({inProgressHistory.length})
                    </button>

                    <button
                      type="button"
                      onClick={() => setMyListSubTab("mylist")}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                        myListSubTab === "mylist"
                          ? `${getPrimaryBgColor(appTheme)} text-white shadow-md scale-105`
                          : "bg-black/40 hover:bg-black/60 text-slate-200"
                      }`}
                    >
                      🔖 Watch Later ({savedMyList.length})
                    </button>

                    <button
                      type="button"
                      onClick={() => setMyListSubTab("favorites")}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                        myListSubTab === "favorites"
                          ? `${getPrimaryBgColor(appTheme)} text-white shadow-md scale-105`
                          : "bg-black/40 hover:bg-black/60 text-slate-200"
                      }`}
                    >
                      ⭐ Favorites ({savedFavorites.length})
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => scrollPill("mylist-pill", "right")}
                  className="absolute right-1 z-20 w-7 h-7 bg-black/70 hover:bg-black/90 text-amber-300 rounded-full flex items-center justify-center text-xs font-bold shadow-md transition cursor-pointer"
                  title="Scroll Right"
                >
                  ›
                </button>
              </div>
            </section>
          )}

          <section className="mb-6 px-1 w-full max-w-7xl">
            <div className="mb-3 flex items-center justify-between px-2">
              <h3 className="text-lg font-bold text-white">
                {activeTab === "My List" ? "Saved Catalog" : `${activeTab} Catalog`}
              </h3>
              <span className={`text-xs font-medium ${themeStyles.accentText}`}>
                {filteredItems.length} titles available
              </span>
            </div>

            {filteredItems.length > 0 ? (
              <div className={gridColsClass}>
                {filteredItems.map((item) => (
                  <MemoizedMediaCard item={item} key={item.id} />
                ))}
              </div>
            ) : (
              <div
                className={`rounded-[20px] bg-gradient-to-r ${themeStyles.cardGradient} p-6 text-center mx-2`}
              >
                <p className="text-sm text-slate-300">
                  {activeTab === "My List"
                    ? "No saved titles in this section yet. Open any movie or show to save it!"
                    : loading
                    ? `Loading ${activeTab} content...`
                    : error ?? "No titles available in this view."}
                </p>
              </div>
            )}
          </section>

          {canScrollDown && showScrollReminder && (
            <div
              className="fixed bottom-4 left-0 right-0 z-50 flex items-center justify-center pointer-events-none animate-flash-twice"
              onAnimationEnd={() => setShowScrollReminder(false)}
            >
              <style>{`
                @keyframes flashTwice {
                  0% { opacity: 0; }
                  25% { opacity: 1; }
                  50% { opacity: 1; }
                  75% { opacity: 1; }
                  100% { opacity: 0; }
                }
                .animate-flash-twice {
                  animation: flashTwice 8s ease-in-out forwards;
                }
              `}</style>
              <div className="flex flex-col items-center gap-0.5 bg-black/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 shadow-2xl">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white opacity-100">
                  More Content Below
                </span>
                <span className={`text-xl font-black animate-slow-glow ${getThemeArrowColor(appTheme)} opacity-100`}>
                  ⌄
                </span>
              </div>
            </div>
          )}

          {activeTab === "My List" && suggestedItems.length > 0 && (
            <section className="mb-8 px-1 pt-4 border-t border-white/10 w-full max-w-7xl">
              <div className="mb-3 flex items-center justify-between px-2">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>✨ Suggested For You</span>
                </h3>
                <span className={`text-xs font-medium ${themeStyles.accentText}`}>
                  Curated based on your favorites & history genres
                </span>
              </div>
              <div className={gridColsClass}>
                {suggestedItems.map((item) => (
                  <MemoizedMediaCard item={item} key={`suggested-${item.id}`} />
                ))}
              </div>
            </section>
          )}

          {activeTab !== "My List" && totalPages > 1 && (
            <div
              className={`mb-6 flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-r ${themeStyles.cardGradient} p-3 mx-2 w-full max-w-md`}
            >
              <button
                type="button"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page <= 1 || loading}
                className="rounded-xl bg-slate-800 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-700 disabled:opacity-40 focus:outline-none focus:ring-4"
              >
                ◀ Previous
              </button>

              <span className={`text-xs font-bold ${themeStyles.accentText}`}>
                Page {page} of {totalPages}
              </span>

              <button
                type="button"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={page >= totalPages || loading}
                className={`rounded-xl ${themeStyles.btnActive} px-3 py-2 text-xs font-semibold shadow transition disabled:opacity-40 focus:outline-none focus:ring-4`}
              >
                Next ▶
              </button>
            </div>
          )}

          <div className="mt-8 mb-4 text-center">
            <p className="text-[10px] text-slate-500">
              Data provided by{" "}
              <a
                href="https://www.themoviedb.org"
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-slate-400"
              >
                TMDB
              </a>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
