// src/routes/index.tsx
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import React, { useEffect, useMemo, useState, memo } from "react";
import type { MediaItem } from "@/lib/tmdb-scraper";
import { scrapeCategoryContent } from "@/lib/tmdb-scraper";
import {
  CardSize,
  AppTheme,
  PosterAppearanceClasses,
  getSavedCardSize,
  getSavedTheme,
  getSavedUserAge,
  isAllowedForAge,
  getPosterDimensions,
  getPosterAppearanceClasses,
  getOptimalTmdbImageWidth,
  getHardwareLimits,
  getReducedMotion,
  getLargeButtons,
  getGreetingStyle,
  getPersonalizedGreeting,
  getProfileMascot,
  getKidsModeLocked,
} from "@/lib/settings";
import { getRawWatchHistory, isTitleDisliked } from "@/lib/watch-history";
import { isTitleBroken } from "@/lib/broken-links";

const navTabs = [
  "Home",
  "TV Shows",
  "Movies",
  "In Theaters",
  "Live TV & Sports",
  "My List",
] as const;
type NavTab = (typeof navTabs)[number];

const genreCategories = [
  "Trending",
  "Action",
  "Adult",
  "Adventure",
  "Animation",
  "Biography",
  "Comedy",
  "Crime",
  "Documentary",
  "Drama",
  "Family",
  "Fantasy",
  "Film Noir",
  "Game Show",
  "History",
  "Horror",
  "Musical",
  "Music",
  "Mystery",
  "News",
  "Reality-TV",
  "Romance",
  "Sci-Fi",
  "Short",
  "Sport",
  "Talk-Show",
  "Thriller",
  "War",
  "Western",
];

const providerCategories = [
  {
    name: "All (Default)",
    logo: "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/AllDefault.jpg",
  },
  {
    name: "Netflix",
    logo: "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/netflix-.png",
  },
  {
    name: "Prime",
    logo: "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/Prime.png",
  },
  {
    name: "Disney+",
    logo: "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/disney-plus-logo-white.png",
  },
];

const MY_LIST_STORAGE_KEY = "rabtv_my_list";
const FAVORITES_STORAGE_KEY = "rabtv_favorites";
const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY as string;
const TMDB_BASE_URL = "https://api.themoviedb.org/3/";

const RABBIT_HEADER_PILL =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/main/assets/rabbit-header-pill.jpg";

function getDetailsSearch(item: MediaItem): { id: string; type: "movie" | "tv" } {
  const cleanId = String(item.id).replace(/^(movie|tv)-/i, "");
  const type: "movie" | "tv" =
    item.mediaType === "tv" || String(item.id).toLowerCase().startsWith("tv-")
      ? "tv"
      : "movie";
  return { id: cleanId, type };
}

function optimizePosterUrl(url: string, width: "w342" | "w500"): string {
  if (!url) return url;
  if (width === "w342" && url.includes("image.tmdb.org/t/p/w500")) {
    return url.replace("image.tmdb.org/t/p/w500", "image.tmdb.org/t/p/w342");
  }
  return url;
}

export function MediaCard({
  item,
  cardSize: propCardSize,
  appTheme: propAppTheme,
  posterAppearance: propPosterAppearance,
  posterWidth: propPosterWidth,
  largeButtons: propLargeButtons,
}: {
  item: MediaItem;
  cardSize?: CardSize;
  appTheme?: AppTheme;
  posterAppearance?: PosterAppearanceClasses;
  posterWidth?: "w342" | "w500";
  largeButtons?: boolean;
}) {
  const [internalCardSize, setInternalCardSize] = useState<CardSize>(() =>
    getSavedCardSize()
  );
  const [internalAppTheme, setInternalAppTheme] = useState<AppTheme>(() =>
    getSavedTheme()
  );
  const [internalAppearance, setInternalAppearance] =
    useState<PosterAppearanceClasses>(() =>
      getPosterAppearanceClasses(getSavedTheme())
    );
  const [internalPosterWidth, setInternalPosterWidth] = useState<
    "w342" | "w500"
  >(() => getOptimalTmdbImageWidth());
  const [internalLargeButtons, setInternalLargeButtons] = useState<boolean>(
    () => getLargeButtons()
  );

  useEffect(() => {
    // Skip per-card listeners when parent provides reactive props (protects 1-2GB sticks)
    if (
      propCardSize !== undefined &&
      propAppTheme !== undefined &&
      propPosterAppearance !== undefined
    ) {
      return;
    }

    const syncLocal = () => {
      const nextTheme = getSavedTheme();
      setInternalCardSize(getSavedCardSize());
      setInternalAppTheme(nextTheme);
      setInternalAppearance(getPosterAppearanceClasses(nextTheme));
      setInternalPosterWidth(getOptimalTmdbImageWidth());
      setInternalLargeButtons(getLargeButtons());
    };

    syncLocal();
    window.addEventListener("rabtv_settings_updated", syncLocal);
    return () =>
      window.removeEventListener("rabtv_settings_updated", syncLocal);
  }, [propCardSize, propAppTheme, propPosterAppearance]);

  const cardSize = propCardSize ?? internalCardSize;
  const appTheme = propAppTheme ?? internalAppTheme;
  const appearance = propPosterAppearance ?? internalAppearance;
  const posterWidth = propPosterWidth ?? internalPosterWidth;
  const largeButtons = propLargeButtons ?? internalLargeButtons;

  const cardThemeStyles = useMemo(() => {
    switch (appTheme) {
      case "red":
        return {
          glow: "group-hover:shadow-[0_8px_28px_rgba(239,68,68,0.28)]",
          ring: "focus-within:ring-red-400 focus:ring-red-400",
          accentBadge: "text-red-300 border-red-500/30 bg-red-950/75",
          laser: "from-transparent via-red-500 to-amber-400",
        };
      case "midnight":
        return {
          glow: "group-hover:shadow-[0_8px_28px_rgba(59,130,246,0.28)]",
          ring: "focus-within:ring-blue-400 focus:ring-blue-400",
          accentBadge: "text-sky-300 border-blue-500/30 bg-blue-950/75",
          laser: "from-transparent via-sky-400 to-blue-500",
        };
      case "emerald":
        return {
          glow: "group-hover:shadow-[0_8px_28px_rgba(16,185,129,0.28)]",
          ring: "focus-within:ring-emerald-400 focus:ring-emerald-400",
          accentBadge: "text-emerald-300 border-emerald-500/30 bg-emerald-950/75",
          laser: "from-transparent via-emerald-400 to-cyan-400",
        };
      case "amber":
        return {
          glow: "group-hover:shadow-[0_8px_28px_rgba(245,158,11,0.28)]",
          ring: "focus-within:ring-amber-400 focus:ring-amber-400",
          accentBadge: "text-amber-300 border-amber-500/30 bg-amber-950/75",
          laser: "from-transparent via-amber-400 to-orange-500",
        };
      case "cyan":
        return {
          glow: "group-hover:shadow-[0_8px_28px_rgba(6,182,212,0.28)]",
          ring: "focus-within:ring-cyan-400 focus:ring-cyan-400",
          accentBadge: "text-cyan-300 border-cyan-500/30 bg-cyan-950/75",
          laser: "from-transparent via-cyan-400 to-sky-500",
        };
      case "violet":
      default:
        return {
          glow: "group-hover:shadow-[0_8px_28px_rgba(139,92,246,0.28)]",
          ring: "focus-within:ring-violet-400 focus:ring-violet-400",
          accentBadge: "text-violet-300 border-violet-500/30 bg-purple-950/75",
          laser: "from-transparent via-pink-500 to-cyan-400",
        };
    }
  }, [appTheme]);

  const dimensions = getPosterDimensions(cardSize);
  const detailsSearch = getDetailsSearch(item);
  const optimizedImage = optimizePosterUrl(item.image, posterWidth);
  const isCollector = appearance.cardStyle === "collector-showcase";
  const layout = appearance.infoLayout;

  // SMALL CARD MODE (3-6 columns)
  if (cardSize === "small") {
    const isBelow = layout === "below-card";
    const isClean = layout === "clean-poster";
    const isHoverReveal = layout === "hover-reveal";
    const isDetailed = layout === "detailed-badges";

    return (
      <Link
        to="/details"
        search={detailsSearch}
        className={`group flex flex-col ${
          isBelow ? "w-full" : `${dimensions.card} w-full`
        } ${appearance.radiusClass} ${appearance.cardFrameClass} ${
          cardThemeStyles.glow
        } focus:outline-none focus:ring-4 ${
          cardThemeStyles.ring
        } hover:-translate-y-1 overflow-hidden relative transition-all duration-300`}
      >
        <div
          className={`relative w-full ${
            isBelow ? "aspect-[2/3]" : "flex-1 h-full"
          } overflow-hidden bg-black ${isCollector ? appearance.innerRadiusClass : ""}`}
        >
          <img
            src={optimizedImage}
            alt={item.title}
            className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
            decoding="async"
          />

          {/* Top Badges */}
          {appearance.showBadges && item.rating && (
            <div className="absolute top-1.5 right-1.5 z-10 rounded-md bg-black/80 backdrop-blur-md px-1.5 py-0.5 text-[9px] font-bold text-amber-300 border border-white/10 shadow">
              ★ {item.rating}
            </div>
          )}

          {appearance.showBadges && isDetailed && (
            <div className="absolute top-1.5 left-1.5 z-10 rounded-md bg-black/80 backdrop-blur-md px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wider text-slate-200 border border-white/10">
              {item.mediaType === "tv" ? "TV" : "MOV"}
            </div>
          )}

          {/* Overlay / Hover-Reveal / Detailed Footer inside Poster */}
          {!isBelow && !isClean && (
            <div
              className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/85 to-transparent pt-8 pb-2 px-2 text-left z-10 transition-opacity duration-200 ${
                isHoverReveal
                  ? "opacity-0 group-hover:opacity-100 group-focus:opacity-100"
                  : "opacity-100"
              }`}
            >
              <p className="text-[11px] font-bold text-white leading-tight line-clamp-1 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                {item.title}
              </p>
              {item.year && (
                <p className="text-[9px] text-slate-300 font-medium mt-0.5">
                  {item.year}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Below-Card Clean Glass Footer */}
        {isBelow && (
          <div className="px-2 py-1.5 bg-slate-950/95 border-t border-white/10 text-left">
            <p className="text-[11px] font-bold text-white leading-tight line-clamp-1">
              {item.title}
            </p>
            <div className="flex items-center justify-between gap-1 mt-0.5 text-[9px] text-slate-400 font-semibold">
              <span>{item.year || (item.mediaType === "tv" ? "Series" : "Movie")}</span>
              {appearance.showBadges && item.rating && (
                <span className="text-amber-300">★ {item.rating}</span>
              )}
            </div>
          </div>
        )}

        {/* Theater Marquee Bottom Laser Line */}
        {appearance.showLaserBar && (
          <div
            className={`absolute inset-x-2 bottom-0 h-[2px] bg-gradient-to-r ${cardThemeStyles.laser} opacity-90 z-20`}
          />
        )}
      </Link>
    );
  }

  // MEDIUM & LARGE CARD MODES
  const isBelow = layout === "below-card";
  const isClean = layout === "clean-poster";
  const isHoverReveal = layout === "hover-reveal";
  const isDetailed = layout === "detailed-badges";

  return (
    <div
      className={`group relative flex w-full flex-col overflow-hidden ${appearance.radiusClass} ${appearance.cardFrameClass} ${cardThemeStyles.glow} transition-all duration-300 hover:-translate-y-1.5 ${cardThemeStyles.ring} ${
        isBelow ? "h-auto" : dimensions.card
      }`}
    >
      <Link
        to="/details"
        search={detailsSearch}
        className={`block relative overflow-hidden focus:outline-none w-full bg-black flex items-center justify-center ${
          isBelow ? "aspect-[2/3]" : "flex-1 h-full"
        } ${isCollector ? appearance.innerRadiusClass : ""}`}
      >
        <img
          src={optimizedImage}
          alt={item.title}
          className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
          decoding="async"
        />

        {/* Top-Right Rating Badge */}
        {appearance.showBadges && item.rating && (
          <div className="absolute top-2.5 right-2.5 z-10 rounded-lg bg-black/80 backdrop-blur-md px-2 py-0.5 text-[10px] font-bold text-amber-300 border border-white/15 shadow-md">
            ⭐ {item.rating}
          </div>
        )}

        {/* Top-Left Media Type Badge (Detailed Layout) */}
        {appearance.showBadges && isDetailed && (
          <div className="absolute top-2.5 left-2.5 z-10 rounded-lg bg-black/80 backdrop-blur-md px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-white border border-white/15 shadow-md">
            {item.mediaType === "tv" ? "TV SERIES" : "MOVIE"}
          </div>
        )}

        {/* Overlay / Hover-Reveal / Detailed Bottom Scrim */}
        {!isBelow && !isClean && (
          <div
            className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/85 to-transparent pt-14 pb-3 px-3 z-10 text-left transition-all duration-300 ${
              isHoverReveal
                ? "opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 group-focus-within:opacity-100 group-focus-within:translate-y-0"
                : "opacity-100"
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <span
                className={`rounded-md px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider truncate max-w-[72%] backdrop-blur-md border ${cardThemeStyles.accentBadge}`}
              >
                {item.genre ?? "TV"}
              </span>
              {item.year ? (
                <span className="text-[10px] text-slate-300 font-semibold shrink-0">
                  {item.year}
                </span>
              ) : null}
            </div>
            <h4
              className={`font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)] truncate ${dimensions.text}`}
            >
              {item.title}
            </h4>
          </div>
        )}
      </Link>

      {/* Below-Poster Clean Unobstructed Info Panel */}
      {isBelow && (
        <div className="p-3 bg-slate-950/95 border-t border-white/10 text-left space-y-1.5 z-20">
          <h4 className={`font-bold text-white truncate ${dimensions.text}`}>
            {item.title}
          </h4>
          <div className="flex items-center justify-between gap-2 text-[10px] font-semibold text-slate-300">
            <span
              className={`rounded-md px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider truncate max-w-[68%] border ${cardThemeStyles.accentBadge}`}
            >
              {item.genre ?? (item.mediaType === "tv" ? "TV SHOW" : "MOVIE")}
            </span>
            {item.year && <span className="shrink-0">{item.year}</span>}
          </div>
          <Link
            to="/details"
            search={detailsSearch}
            className={`mt-1 block w-full text-center rounded-xl bg-white/[0.07] hover:bg-white/[0.16] border border-white/15 ${
              largeButtons ? "py-2.5 text-xs" : "py-1.5 text-[10px]"
            } font-bold tracking-wider uppercase text-white transition focus:outline-none focus:ring-2 ${
              cardThemeStyles.ring
            }`}
          >
            ▶ Watch Now
          </Link>
        </div>
      )}

      {/* Standard Watch Bar (hidden in Pure Poster Wall & Hover-Reveal modes for cleaner art) */}
      {!isBelow && !isClean && !isHoverReveal && (
        <div className="p-2 bg-black/95 border-t border-white/10 flex items-center justify-between z-20">
          <Link
            to="/details"
            search={detailsSearch}
            className={`w-full text-center rounded-xl bg-white/[0.06] hover:bg-white/[0.15] border border-white/10 ${
              largeButtons ? "py-2.5 text-xs" : "py-1.5 text-[10px]"
            } font-bold tracking-wider uppercase text-white transition focus:outline-none focus:ring-2 ${
              cardThemeStyles.ring
            }`}
          >
            ▶ Watch Now
          </Link>
        </div>
      )}

      {/* Theater Marquee Bottom Laser Highlight */}
      {appearance.showLaserBar && (
        <div
          className={`absolute inset-x-3 bottom-0 h-[2px] bg-gradient-to-r ${cardThemeStyles.laser} opacity-90 z-30`}
        />
      )}
    </div>
  );
}

const MemoizedMediaCard = memo(
  function MemoizedMediaCard({
    item,
    cardSize,
    appTheme,
    posterAppearance,
    posterWidth,
    largeButtons,
  }: {
    item: MediaItem;
    cardSize: CardSize;
    appTheme: AppTheme;
    posterAppearance: PosterAppearanceClasses;
    posterWidth: "w342" | "w500";
    largeButtons: boolean;
  }) {
    return (
      <MediaCard
        item={item}
        cardSize={cardSize}
        appTheme={appTheme}
        posterAppearance={posterAppearance}
        posterWidth={posterWidth}
        largeButtons={largeButtons}
      />
    );
  },
  (prevProps, nextProps) =>
    prevProps.item.id === nextProps.item.id &&
    prevProps.cardSize === nextProps.cardSize &&
    prevProps.appTheme === nextProps.appTheme &&
    prevProps.posterWidth === nextProps.posterWidth &&
    prevProps.largeButtons === nextProps.largeButtons &&
    prevProps.posterAppearance.shape === nextProps.posterAppearance.shape &&
    prevProps.posterAppearance.cardStyle ===
      nextProps.posterAppearance.cardStyle &&
    prevProps.posterAppearance.infoLayout ===
      nextProps.posterAppearance.infoLayout &&
    prevProps.posterAppearance.showBadges ===
      nextProps.posterAppearance.showBadges
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
      el.scrollBy({
        left: direction === "left" ? -240 : 240,
        behavior: "smooth",
      });
    }
  };

  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [appTheme, setAppTheme] = useState<AppTheme>(() => getSavedTheme());
  const [cardSize, setCardSize] = useState<CardSize>(() => getSavedCardSize());
  const [userAge, setUserAge] = useState<number>(() => getSavedUserAge());
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
  const [kidsLocked, setKidsLocked] = useState<boolean>(() =>
    getKidsModeLocked()
  );
  const [greetingText, setGreetingText] = useState<string>("");
  const [profileMascot, setProfileMascot] = useState<string>(() =>
    getProfileMascot()
  );
  const [isLowRam, setIsLowRam] = useState<boolean>(
    () => getHardwareLimits().effectiveMode === "low"
  );

  const [myListSubTab, setMyListSubTab] = useState<
    "all" | "in_progress" | "mylist" | "favorites"
  >("all");
  const [savedMyList, setSavedMyList] = useState<MediaItem[]>([]);
  const [savedFavorites, setSavedFavorites] = useState<MediaItem[]>([]);
  const [historyItems, setHistoryItems] = useState<MediaItem[]>([]);
  const [suggestedItems, setSuggestedItems] = useState<MediaItem[]>([]);

  const [currentHeroIndex, setCurrentHeroIndex] = useState(0);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
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

  const loadSavedListsAndTheme = () => {
    try {
      const listData = JSON.parse(
        localStorage.getItem(MY_LIST_STORAGE_KEY) || "[]"
      );
      const favData = JSON.parse(
        localStorage.getItem(FAVORITES_STORAGE_KEY) || "[]"
      );

      const nextPosterWidth = getOptimalTmdbImageWidth();
      const rawHistory = getRawWatchHistory();
      const mappedHistory: MediaItem[] = rawHistory.map((h) => {
        const type =
          h.mediaType ??
          h.media_type ??
          (String(h.id).startsWith("tv-") ? "tv" : "movie");
        const cleanId = String(h.mediaId ?? h.id).replace(/^(movie|tv)-/, "");
        const imagePath = h.posterPath ?? h.poster_path ?? h.image;
        const imageUrl = imagePath?.startsWith("http")
          ? optimizePosterUrl(imagePath, nextPosterWidth)
          : imagePath
            ? `https://image.tmdb.org/t/p/${nextPosterWidth}${imagePath}`
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

      const nextTheme = getSavedTheme();
      const savedName = localStorage.getItem("rabtv_profile_name") || "";

      setSavedMyList(Array.isArray(listData) ? listData : []);
      setSavedFavorites(Array.isArray(favData) ? favData : []);
      setHistoryItems(mappedHistory);
      setAppTheme(nextTheme);
      setCardSize(getSavedCardSize());
      setUserAge(getSavedUserAge());
      setPosterAppearance(getPosterAppearanceClasses(nextTheme));
      setPosterWidth(nextPosterWidth);
      setReducedMotion(getReducedMotion());
      setLargeButtons(getLargeButtons());
      setKidsLocked(getKidsModeLocked());
      setProfileMascot(getProfileMascot());
      setIsLowRam(getHardwareLimits().effectiveMode === "low");
      setGreetingText(
        savedName ? getPersonalizedGreeting(savedName, getGreetingStyle()) : ""
      );
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
    window.addEventListener(
      "rabtv_watch_history_updated",
      loadSavedListsAndTheme
    );
    window.addEventListener("rabtv_settings_updated", handleSettingsUpdate);
    window.addEventListener(
      "rabtv_global_feed_updated",
      handleGlobalFeedUpdate as EventListener
    );
    window.addEventListener(
      "rabtv_broken_links_updated",
      loadSavedListsAndTheme
    );

    return () => {
      window.removeEventListener(
        "rabtv_catalog_updated",
        loadSavedListsAndTheme
      );
      window.removeEventListener(
        "rabtv_watch_history_updated",
        loadSavedListsAndTheme
      );
      window.removeEventListener(
        "rabtv_settings_updated",
        handleSettingsUpdate
      );
      window.removeEventListener(
        "rabtv_global_feed_updated",
        handleGlobalFeedUpdate as EventListener
      );
      window.removeEventListener(
        "rabtv_broken_links_updated",
        loadSavedListsAndTheme
      );
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
        globalFeedOverride && globalFeedOverride !== "All (Default)"
          ? globalFeedOverride
          : undefined;

      const effectiveSubFeed =
        providerFilter && providerFilter !== "All (Default)"
          ? providerFilter
          : activeGlobalFeed;

      try {
        const result = await scrapeCategoryContent(
          scraperCategory,
          page,
          selectedGenre,
          effectiveSubFeed
        );
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
        setError(
          caught instanceof Error ? caught.message : "Failed to load media"
        );
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
          ...historyItems.filter(
            (h: any) => h.confirmedCompleted || (h.progressPercent ?? 0) > 20
          ),
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
          ) {
            continue;
          }

          pool.push({
            id: `movie-${tmdbId}`,
            title,
            description: item.overview || "",
            image: `https://image.tmdb.org/t/p/${posterWidth}${item.poster_path}`,
            href: `/details?id=${tmdbId}&type=movie`,
            genre: "SUGGESTED FOR YOU",
            year: (item.release_date || "").split("-")[0],
            rating: item.vote_average
              ? item.vote_average.toFixed(1)
              : undefined,
            mediaType: "movie",
            releaseDate: item.release_date || item.first_air_date,
          });
        }

        if (!active) return;

        const watchedIds = new Set([
          ...historyItems.map((h) => String(h.id).replace(/^(movie|tv)-/, "")),
          ...savedFavorites.map((f) =>
            String(f.id).replace(/^(movie|tv)-/, "")
          ),
          ...savedMyList.map((m) => String(m.id).replace(/^(movie|tv)-/, "")),
        ]);

        const uniqueSuggestions = new Map<string, MediaItem>();
        for (const candidate of pool) {
          const cleanId = String(candidate.id).replace(/^(movie|tv)-/, "");
          if (watchedIds.has(cleanId)) continue;
          if (
            !isAllowedForAge(
              (candidate as any).certification,
              candidate.genre,
              userAge
            )
          ) {
            continue;
          }
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
  }, [
    activeTab,
    savedFavorites,
    savedMyList,
    historyItems,
    userAge,
    kidsLocked,
    posterWidth,
  ]);

  const inProgressHistory = useMemo(
    () =>
      historyItems.filter(
        (i: any) => !i.confirmedCompleted && (i.progressPercent ?? 0) < 100
      ),
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
      if (!isAllowedForAge((item as any).certification, item.genre, userAge)) {
        continue;
      }

      const releaseDateStr =
        (item as any).releaseDate ||
        (item as any).release_date ||
        (item as any).first_air_date;
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
  }, [
    myListSubTab,
    savedMyList,
    savedFavorites,
    inProgressHistory,
    userAge,
    kidsLocked,
  ]);

  const filteredItems = useMemo(() => {
    const baseList = activeTab === "My List" ? savedCatalogItems : items;
    const now = Date.now();
    const oneWeekMs = 7 * 24 * 60 * 60 * 1000;

    return baseList.filter((item) => {
      if (isTitleDisliked(item.id) || isTitleBroken(item.id)) return false;
      if (!isAllowedForAge((item as any).certification, item.genre, userAge)) {
        return false;
      }

      const releaseDateStr =
        (item as any).releaseDate ||
        (item as any).release_date ||
        (item as any).first_air_date;
      if (releaseDateStr) {
        const releaseTime = new Date(releaseDateStr).getTime();
        if (!isNaN(releaseTime) && releaseTime > now + oneWeekMs) {
          return false;
        }
      }

      return true;
    });
  }, [items, activeTab, savedCatalogItems, userAge, kidsLocked]);

  const heroSourceList = useMemo(() => {
    if (activeTab === "My List") {
      return suggestedItems.length > 0 ? suggestedItems : savedCatalogItems;
    }
    return items;
  }, [activeTab, suggestedItems, savedCatalogItems, items]);

  const heroItems = useMemo(() => {
    const watchedIds = new Set(
      historyItems.map((h) =>
        String((h as any).mediaId ?? h.id).replace(/^(movie|tv)-/i, "")
      )
    );
    const now = Date.now();
    const oneWeekMs = 7 * 24 * 60 * 60 * 1000;

    return heroSourceList.filter((item) => {
      const cleanId = String(item.id).replace(/^(movie|tv)-/i, "");
      if (watchedIds.has(cleanId)) return false;
      if (isTitleDisliked(item.id) || isTitleDisliked(cleanId)) return false;
      if (isTitleBroken(item.id) || isTitleBroken(cleanId)) return false;
      if (!isAllowedForAge((item as any).certification, item.genre, userAge)) {
        return false;
      }

      const releaseDateStr =
        (item as any).releaseDate ||
        (item as any).release_date ||
        (item as any).first_air_date;
      if (releaseDateStr) {
        const releaseTime = new Date(releaseDateStr).getTime();
        if (!isNaN(releaseTime) && releaseTime > now + oneWeekMs) {
          return false;
        }
      }

      return true;
    });
  }, [heroSourceList, historyItems, userAge, kidsLocked]);

  useEffect(() => {
    setCurrentHeroIndex(0);
  }, [heroItems]);

  // Auto-rotate Hero billboard (paused automatically when Reduced Motion is active)
  useEffect(() => {
    if (heroItems.length <= 1 || reducedMotion) return;

    const interval = window.setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      setCurrentHeroIndex((prevIndex) => (prevIndex + 1) % heroItems.length);
    }, 5500);

    return () => window.clearInterval(interval);
  }, [heroItems.length, reducedMotion]);

  const handleSurpriseMe = () => {
    const pool = filteredItems.length > 0 ? filteredItems : heroItems;
    if (!pool.length) return;
    const picked = pool[Math.floor(Math.random() * pool.length)];
    navigate({ to: "/details", search: getDetailsSearch(picked) });
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

  const themeStyles =
    {
      violet: {
        bg: "bg-gradient-to-br from-slate-950/70 via-purple-950/35 to-slate-950/80",
        cardGradient: "from-purple-950/80 via-slate-900 to-indigo-950/80",
        btnActive:
          "bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 text-white shadow-lg shadow-violet-600/30",
        accentText: "text-violet-300",
        accentBar: "bg-violet-500 shadow-[0_0_12px_rgba(139,92,246,0.9)]",
        borderGlow: "border-violet-500/30",
        activeTile:
          "bg-gradient-to-b from-violet-900/50 via-purple-950/70 to-slate-950/90 border-2 border-violet-400 shadow-[0_0_25px_rgba(139,92,246,0.45)] scale-[1.03]",
        inactiveTile:
          "bg-gradient-to-b from-white/[0.07] to-black/70 hover:from-white/[0.12] hover:to-black/80 border border-white/10 hover:border-white/25",
      },
      red: {
        bg: "bg-gradient-to-br from-zinc-950/70 via-red-950/35 to-black/80",
        cardGradient: "from-red-950/80 via-zinc-900 to-neutral-950",
        btnActive:
          "bg-gradient-to-r from-red-600 via-rose-600 to-orange-600 text-white shadow-lg shadow-red-600/30",
        accentText: "text-red-400",
        accentBar: "bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.9)]",
        borderGlow: "border-red-500/30",
        activeTile:
          "bg-gradient-to-b from-red-900/50 via-red-950/70 to-zinc-950/90 border-2 border-red-400 shadow-[0_0_25px_rgba(239,68,68,0.45)] scale-[1.03]",
        inactiveTile:
          "bg-gradient-to-b from-white/[0.07] to-black/70 hover:from-white/[0.12] hover:to-black/80 border border-white/10 hover:border-white/25",
      },
      midnight: {
        bg: "bg-gradient-to-br from-slate-950/70 via-blue-950/35 to-slate-950/80",
        cardGradient: "from-blue-950/80 via-slate-900 to-sky-950/80",
        btnActive:
          "bg-gradient-to-r from-blue-600 via-cyan-600 to-sky-600 text-white shadow-lg shadow-blue-600/30",
        accentText: "text-sky-300",
        accentBar: "bg-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.9)]",
        borderGlow: "border-sky-500/30",
        activeTile:
          "bg-gradient-to-b from-blue-900/50 via-sky-950/70 to-slate-950/90 border-2 border-sky-400 shadow-[0_0_25px_rgba(56,189,248,0.45)] scale-[1.03]",
        inactiveTile:
          "bg-gradient-to-b from-white/[0.07] to-black/70 hover:from-white/[0.12] hover:to-black/80 border border-white/10 hover:border-white/25",
      },
      emerald: {
        bg: "bg-gradient-to-br from-slate-950/70 via-emerald-950/35 to-slate-950/80",
        cardGradient: "from-emerald-950/80 via-slate-900 to-teal-950/80",
        btnActive:
          "bg-gradient-to-r from-emerald-600 via-teal-600 to-green-600 text-white shadow-lg shadow-emerald-600/30",
        accentText: "text-emerald-300",
        accentBar: "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.9)]",
        borderGlow: "border-emerald-500/30",
        activeTile:
          "bg-gradient-to-b from-emerald-900/50 via-emerald-950/70 to-slate-950/90 border-2 border-emerald-400 shadow-[0_0_25px_rgba(52,211,153,0.45)] scale-[1.03]",
        inactiveTile:
          "bg-gradient-to-b from-white/[0.07] to-black/70 hover:from-white/[0.12] hover:to-black/80 border border-white/10 hover:border-white/25",
      },
      amber: {
        bg: "bg-gradient-to-br from-stone-950/70 via-yellow-950/35 to-neutral-950/80",
        cardGradient: "from-yellow-950/80 via-stone-900 to-amber-950/80",
        btnActive:
          "bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 text-white shadow-lg shadow-amber-600/30",
        accentText: "text-amber-300",
        accentBar: "bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.9)]",
        borderGlow: "border-amber-500/30",
        activeTile:
          "bg-gradient-to-b from-amber-900/50 via-amber-950/70 to-stone-950/90 border-2 border-amber-400 shadow-[0_0_25px_rgba(251,191,36,0.45)] scale-[1.03]",
        inactiveTile:
          "bg-gradient-to-b from-white/[0.07] to-black/70 hover:from-white/[0.12] hover:to-black/80 border border-white/10 hover:border-white/25",
      },
      cyan: {
        bg: "bg-gradient-to-br from-slate-950/70 via-cyan-950/35 to-slate-950/80",
        cardGradient: "from-cyan-950/80 via-slate-900 to-blue-950/80",
        btnActive:
          "bg-gradient-to-r from-cyan-600 via-teal-600 to-blue-600 text-white shadow-lg shadow-cyan-600/30",
        accentText: "text-cyan-300",
        accentBar: "bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.9)]",
        borderGlow: "border-cyan-500/30",
        activeTile:
          "bg-gradient-to-b from-cyan-900/50 via-cyan-950/70 to-slate-950/90 border-2 border-cyan-400 shadow-[0_0_25px_rgba(34,211,238,0.45)] scale-[1.03]",
        inactiveTile:
          "bg-gradient-to-b from-white/[0.07] to-black/70 hover:from-white/[0.12] hover:to-black/80 border border-white/10 hover:border-white/25",
      },
    }[appTheme] ?? {
      bg: "bg-gradient-to-br from-slate-950/70 via-purple-950/35 to-slate-950/80",
      cardGradient: "from-purple-950/80 via-slate-900 to-indigo-950/80",
      btnActive:
        "bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 text-white shadow-lg shadow-violet-600/30",
      accentText: "text-violet-300",
      accentBar: "bg-violet-500 shadow-[0_0_12px_rgba(139,92,246,0.9)]",
      borderGlow: "border-violet-500/30",
      activeTile:
        "bg-gradient-to-b from-violet-900/50 via-purple-950/70 to-slate-950/90 border-2 border-violet-400 shadow-[0_0_25px_rgba(139,92,246,0.45)] scale-[1.03]",
      inactiveTile:
        "bg-gradient-to-b from-white/[0.07] to-black/70 hover:from-white/[0.12] hover:to-black/80 border border-white/10 hover:border-white/25",
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

  const activeHeroItem =
    heroItems.length > 0 ? heroItems[currentHeroIndex] : null;
  const heroDetailsSearch = activeHeroItem
    ? getDetailsSearch(activeHeroItem)
    : null;

  return (
    <main
      className={`min-h-screen ${themeStyles.bg} text-slate-100 transition-colors duration-300 pb-20 relative rounded-3xl`}
    >
      <div className="relative z-10">
        {/* Signature Neon Rabbit Top Navigation Bar */}
        <div className="sticky top-0 z-30 mb-4 mt-1 px-2 sm:px-4 py-2 flex justify-center">
          <div
            className="relative max-w-6xl w-full flex items-center justify-center rounded-2xl shadow-2xl overflow-hidden border border-white/10"
            style={{
              backgroundImage: `url(${RABBIT_HEADER_PILL})`,
              backgroundSize: "112% 380%",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "center center",
              maskImage:
                "linear-gradient(to right, transparent 0%, black 4%, black 96%, transparent 100%)",
              WebkitMaskImage:
                "linear-gradient(to right, transparent 0%, black 4%, black 96%, transparent 100%)",
            }}
          >
            <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] pointer-events-none rounded-2xl z-0" />
            <button
              type="button"
              onClick={() => scrollPill("nav-tabs-pill", "left")}
              className="absolute left-1.5 z-20 w-7 h-7 bg-black/75 hover:bg-black text-amber-300 rounded-full flex items-center justify-center text-xs font-bold shadow-md border border-white/10 transition cursor-pointer"
              title="Scroll Left"
              aria-label="Scroll navigation left"
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
                      className={`${
                        largeButtons ? "px-5 py-2.5 text-sm" : "px-4 py-2 text-xs"
                      } rounded-xl font-bold tracking-wide transition-all duration-200 cursor-pointer shrink-0 ${
                        isActive
                          ? `${getPrimaryBgColor(
                              appTheme
                            )} text-white shadow-lg scale-105`
                          : "bg-black/45 hover:bg-white/10 text-slate-200 border border-white/5"
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
              className="absolute right-1.5 z-20 w-7 h-7 bg-black/75 hover:bg-black text-amber-300 rounded-full flex items-center justify-center text-xs font-bold shadow-md border border-white/10 transition cursor-pointer"
              title="Scroll Right"
              aria-label="Scroll navigation right"
            >
              ›
            </button>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-2 sm:px-6 overflow-x-hidden flex flex-col items-center">
          {/* Personalized Greeting & Quick "Surprise Me" Bar */}
          {(greetingText || filteredItems.length > 0) && (
            <div className="mb-4 w-full max-w-6xl flex flex-wrap items-center justify-between gap-2.5 px-1">
              <div className="flex items-center gap-2 min-w-0">
                {greetingText && (
                  <p className="text-sm sm:text-base font-black tracking-wide text-white truncate">
                    <span className="mr-1.5">{profileMascot}</span>
                    <span>{greetingText}</span>
                  </p>
                )}
                {kidsLocked && (
                  <span className="rounded-full bg-emerald-500/20 border border-emerald-400/40 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-emerald-300 shrink-0">
                    🧒 Kids Safe Mode
                  </span>
                )}
              </div>

              {(filteredItems.length > 0 || heroItems.length > 0) && (
                <button
                  type="button"
                  onClick={handleSurpriseMe}
                  className={`inline-flex items-center gap-1.5 rounded-xl bg-black/55 hover:bg-white/15 border border-white/15 px-3.5 ${
                    largeButtons ? "py-2 text-xs" : "py-1.5 text-[11px]"
                  } font-extrabold text-amber-300 hover:text-white shadow transition hover:scale-105 active:scale-95 cursor-pointer shrink-0`}
                  title="Pick a random title for me"
                >
                  <span>🎲 Surprise Me</span>
                </button>
              )}
            </div>
          )}

          {/* Cinematic Netflix / Disney+ Hero Billboard */}
          {activeHeroItem && heroDetailsSearch ? (
            <div className="mb-6 w-full max-w-6xl relative group">
              <Link
                to="/details"
                search={heroDetailsSearch}
                className="w-full overflow-hidden rounded-[28px] bg-black border border-white/15 shadow-[0_20px_50px_rgba(0,0,0,0.8)] relative h-[350px] sm:h-[420px] md:h-[460px] flex flex-col focus:outline-none focus:ring-4"
              >
                <div className="absolute inset-0 w-full h-full overflow-hidden bg-black">
                  <img
                    src={optimizePosterUrl(
                      activeHeroItem.image,
                      isLowRam ? "w342" : "w500"
                    )}
                    alt={activeHeroItem.title}
                    decoding="async"
                    className="absolute inset-0 h-full w-full object-cover object-top opacity-90 transition-transform duration-700 ease-out group-hover:scale-105"
                  />
                  {/* Deep Cinema Bottom & Left Vignette Gradients */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#050b16] via-[#050b16]/55 to-transparent" />
                  <div className="absolute inset-0 bg-gradient-to-r from-[#050b16]/90 via-[#050b16]/30 to-transparent" />
                </div>

                <div className="relative z-10 mt-auto p-5 sm:p-8 flex flex-col items-start text-left max-w-2xl space-y-2.5">
                  <div className="flex items-center flex-wrap gap-2">
                    <span
                      className={`rounded-full bg-white/10 backdrop-blur-md border border-white/15 px-3 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.2em] ${themeStyles.accentText}`}
                    >
                      {activeHeroItem.genre ?? "Featured"}
                    </span>
                    {activeHeroItem.rating && (
                      <span className="rounded-full bg-amber-500/20 backdrop-blur-md border border-amber-400/30 px-2.5 py-0.5 text-amber-300 text-[11px] font-bold">
                        ⭐ {activeHeroItem.rating}
                      </span>
                    )}
                    {activeHeroItem.year && (
                      <span className="rounded-full bg-black/50 backdrop-blur-md border border-white/10 px-2.5 py-0.5 text-[11px] text-slate-200 font-semibold">
                        {activeHeroItem.year}
                      </span>
                    )}
                  </div>

                  <h2 className="text-2xl sm:text-4xl md:text-5xl font-black text-white tracking-tight leading-none drop-shadow-[0_4px_12px_rgba(0,0,0,0.95)] line-clamp-2">
                    {activeHeroItem.title}
                  </h2>

                  {activeHeroItem.description && (
                    <p className="text-xs sm:text-sm leading-relaxed text-slate-200/90 line-clamp-2 max-w-xl drop-shadow">
                      {activeHeroItem.description}
                    </p>
                  )}

                  <div className="pt-1 flex items-center gap-3">
                    <span
                      className={`inline-flex items-center gap-2 ${
                        largeButtons
                          ? "px-6 py-3 text-sm"
                          : "px-5 py-2 text-xs"
                      } rounded-xl font-bold uppercase tracking-wider ${getPrimaryBgColor(
                        appTheme
                      )} transition group-hover:scale-105`}
                    >
                      ▶ Watch Now
                    </span>
                    <span
                      className={`inline-flex items-center gap-1.5 ${
                        largeButtons
                          ? "px-5 py-3 text-sm"
                          : "px-4 py-2 text-xs"
                      } rounded-xl font-bold text-white bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/15 transition`}
                    >
                      ⓘ Details
                    </span>
                  </div>
                </div>
              </Link>

              {/* Hero Manual Controls + Indicator Dots (Great for TV Remotes & Steady Screen) */}
              {heroItems.length > 1 && (
                <div className="absolute bottom-4 right-4 sm:right-5 z-20 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentHeroIndex(
                        (prev) =>
                          (prev - 1 + heroItems.length) % heroItems.length
                      )
                    }
                    className="h-7 w-7 rounded-full bg-black/70 hover:bg-black border border-white/20 text-white text-xs font-bold flex items-center justify-center transition cursor-pointer"
                    aria-label="Previous featured title"
                  >
                    ‹
                  </button>

                  <div className="hidden sm:flex items-center gap-1.5">
                    {heroItems.slice(0, 8).map((hItem, idx) => (
                      <button
                        key={hItem.id}
                        type="button"
                        onClick={() => setCurrentHeroIndex(idx)}
                        aria-label={`Show featured title ${idx + 1}`}
                        className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                          idx === currentHeroIndex % 8
                            ? `w-6 ${themeStyles.accentBar}`
                            : "w-1.5 bg-white/30 hover:bg-white/60"
                        }`}
                      />
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setCurrentHeroIndex((prev) => (prev + 1) % heroItems.length)
                    }
                    className="h-7 w-7 rounded-full bg-black/70 hover:bg-black border border-white/20 text-white text-xs font-bold flex items-center justify-center transition cursor-pointer"
                    aria-label="Next featured title"
                  >
                    ›
                  </button>
                </div>
              )}
            </div>
          ) : (
            <section
              className={`mb-6 w-full max-w-6xl overflow-hidden rounded-[28px] bg-gradient-to-br ${themeStyles.cardGradient} border border-white/10 shadow-2xl relative h-[320px] sm:h-[380px] flex flex-col items-center justify-center`}
            >
              <div className="text-slate-300 text-center px-4">
                {loading
                  ? `Loading ${activeTab}...`
                  : error ?? "No media found in this section."}
              </div>
            </section>
          )}

          {activeTab !== "My List" && (
            <section className="mb-6 space-y-4 flex flex-col items-center justify-center text-center w-full max-w-6xl">
              {/* Disney+ Style Brand Hub Tiles (Netflix, Prime, Disney+, All) */}
              <div className="w-full px-1">
                <div className="grid grid-cols-4 gap-2.5 sm:gap-4 w-full">
                  {providerCategories.map((prov) => {
                    const isActive = providerFilter === prov.name;
                    const isDefault = prov.name === "All (Default)";
                    return (
                      <button
                        key={prov.name}
                        type="button"
                        onClick={() => handleProviderSelect(prov.name)}
                        className={`relative group h-14 sm:h-20 rounded-2xl p-2 sm:p-3 transition-all duration-300 cursor-pointer flex items-center justify-center overflow-hidden backdrop-blur-xl ${
                          isActive
                            ? themeStyles.activeTile
                            : themeStyles.inactiveTile
                        }`}
                        title={prov.name}
                      >
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.12),transparent_70%)] opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                        <img
                          src={prov.logo}
                          alt={prov.name}
                          loading="lazy"
                          decoding="async"
                          className={`relative z-10 transition-transform duration-300 group-hover:scale-110 ${
                            isDefault
                              ? "h-full w-full object-cover rounded-xl opacity-90"
                              : "max-h-7 sm:max-h-11 w-auto object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]"
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Sleek Frameless Glass Genre Ribbon */}
              <div className="flex justify-center w-full px-1">
                <div className="relative w-full flex items-center justify-center rounded-2xl bg-slate-950/65 backdrop-blur-xl border border-white/10 shadow-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => scrollPill("genre-pill", "left")}
                    className="absolute left-1.5 z-20 w-7 h-7 bg-black/80 hover:bg-black text-amber-300 rounded-full flex items-center justify-center text-xs font-bold border border-white/10 shadow-md transition cursor-pointer"
                    title="Scroll Left"
                    aria-label="Scroll genres left"
                  >
                    ‹
                  </button>
                  <div
                    id="genre-pill"
                    className="relative z-10 w-full overflow-x-auto scrollbar-none px-10 sm:px-12 py-2.5 flex items-center justify-start gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-max mx-auto">
                      {genreCategories.map((genre) => {
                        const isActive = selectedGenre === genre;
                        return (
                          <button
                            key={genre}
                            type="button"
                            onClick={() => setSelectedGenre(genre)}
                            className={`${
                              largeButtons
                                ? "px-4 py-2 text-sm"
                                : "px-3.5 py-1.5 text-xs"
                            } rounded-xl font-bold tracking-wide transition-all duration-200 cursor-pointer shrink-0 ${
                              isActive
                                ? `${getPrimaryBgColor(
                                    appTheme
                                  )} text-white shadow-md scale-105`
                                : "bg-white/[0.05] hover:bg-white/[0.12] text-slate-300 border border-white/5"
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
                    className="absolute right-1.5 z-20 w-7 h-7 bg-black/80 hover:bg-black text-amber-300 rounded-full flex items-center justify-center text-xs font-bold border border-white/10 shadow-md transition cursor-pointer"
                    title="Scroll Right"
                    aria-label="Scroll genres right"
                  >
                    ›
                  </button>
                </div>
              </div>
            </section>
          )}

          {activeTab === "My List" && (
            <section className="mb-6 flex justify-center w-full max-w-4xl px-1">
              <div className="relative w-full flex items-center justify-center rounded-2xl bg-slate-950/65 backdrop-blur-xl border border-white/10 shadow-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => scrollPill("mylist-pill", "left")}
                  className="absolute left-1.5 z-20 w-7 h-7 bg-black/80 hover:bg-black text-amber-300 rounded-full flex items-center justify-center text-xs font-bold border border-white/10 shadow-md transition cursor-pointer"
                  title="Scroll Left"
                  aria-label="Scroll list tabs left"
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
                          ? `${getPrimaryBgColor(
                              appTheme
                            )} text-white shadow-md scale-105`
                          : "bg-white/[0.05] hover:bg-white/[0.12] text-slate-200 border border-white/5"
                      }`}
                    >
                      All Saved (
                      {savedMyList.length +
                        savedFavorites.length +
                        inProgressHistory.length}
                      )
                    </button>

                    <button
                      type="button"
                      onClick={() => setMyListSubTab("in_progress")}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                        myListSubTab === "in_progress"
                          ? `${getPrimaryBgColor(
                              appTheme
                            )} text-white shadow-md scale-105`
                          : "bg-white/[0.05] hover:bg-white/[0.12] text-slate-200 border border-white/5"
                      }`}
                    >
                      ⏳ In Progress ({inProgressHistory.length})
                    </button>

                    <button
                      type="button"
                      onClick={() => setMyListSubTab("mylist")}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                        myListSubTab === "mylist"
                          ? `${getPrimaryBgColor(
                              appTheme
                            )} text-white shadow-md scale-105`
                          : "bg-white/[0.05] hover:bg-white/[0.12] text-slate-200 border border-white/5"
                      }`}
                    >
                      🔖 Watch Later ({savedMyList.length})
                    </button>

                    <button
                      type="button"
                      onClick={() => setMyListSubTab("favorites")}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                        myListSubTab === "favorites"
                          ? `${getPrimaryBgColor(
                              appTheme
                            )} text-white shadow-md scale-105`
                          : "bg-white/[0.05] hover:bg-white/[0.12] text-slate-200 border border-white/5"
                      }`}
                    >
                      ⭐ Favorites ({savedFavorites.length})
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => scrollPill("mylist-pill", "right")}
                  className="absolute right-1.5 z-20 w-7 h-7 bg-black/80 hover:bg-black text-amber-300 rounded-full flex items-center justify-center text-xs font-bold border border-white/10 shadow-md transition cursor-pointer"
                  title="Scroll Right"
                  aria-label="Scroll list tabs right"
                >
                  ›
                </button>
              </div>
            </section>
          )}

          {/* Main Catalog Section */}
          <section className="mb-8 px-1 w-full max-w-6xl">
            <div className="mb-4 flex items-center justify-between px-1">
              <div className="flex items-center gap-2.5">
                <span
                  className={`w-1.5 h-6 rounded-full ${themeStyles.accentBar}`}
                />
                <h3 className="text-lg sm:text-xl font-black tracking-tight text-white">
                  {activeTab === "My List"
                    ? "Saved Catalog"
                    : `${activeTab} Catalog`}
                </h3>
              </div>
              <span
                className={`text-xs font-semibold px-3 py-1 rounded-full bg-white/[0.05] border border-white/10 ${themeStyles.accentText}`}
              >
                {filteredItems.length} titles available
              </span>
            </div>

            {filteredItems.length > 0 ? (
              <div className={gridColsClass}>
                {filteredItems.map((item) => (
                  <MemoizedMediaCard
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
            ) : (
              <div className="rounded-2xl bg-slate-950/70 border border-white/10 backdrop-blur-xl p-8 text-center mx-1">
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
                  50% { opacity: 0; }
                  75% { opacity: 1; }
                  100% { opacity: 0; }
                }
                .animate-flash-twice {
                  animation: flashTwice 8s ease-in-out forwards;
                }
              `}</style>
              <div className="flex flex-col items-center gap-0.5 bg-black/30 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 shadow-2xl">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white opacity-100">
                  More Content Below
                </span>
                <span
                  className={`text-xl font-black animate-slow-glow ${getThemeArrowColor(
                    appTheme
                  )} opacity-100`}
                >
                  ⌄
                </span>
              </div>
            </div>
          )}

          {activeTab === "My List" && suggestedItems.length > 0 && (
            <section className="mb-8 px-1 pt-6 border-t border-white/10 w-full max-w-6xl">
              <div className="mb-4 flex items-center justify-between px-1">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`w-1.5 h-6 rounded-full ${themeStyles.accentBar}`}
                  />
                  <h3 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
                    <span>✨ Suggested For You</span>
                  </h3>
                </div>
                <span className={`text-xs font-medium ${themeStyles.accentText}`}>
                  Curated from your favorites & watch history
                </span>
              </div>
              <div className={gridColsClass}>
                {suggestedItems.map((item) => (
                  <MemoizedMediaCard
                    item={item}
                    cardSize={cardSize}
                    appTheme={appTheme}
                    posterAppearance={posterAppearance}
                    posterWidth={posterWidth}
                    largeButtons={largeButtons}
                    key={`suggested-${item.id}`}
                  />
                ))}
              </div>
            </section>
          )}

          {activeTab !== "My List" && totalPages > 1 && (
            <div className="mb-6 flex items-center justify-center gap-4 rounded-2xl bg-slate-950/75 border border-white/10 backdrop-blur-xl p-3 mx-2 w-full max-w-sm shadow-xl">
              <button
                type="button"
                onClick={() => {
                  setPage((prev) => Math.max(1, prev - 1));
                  window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
                }}
                disabled={page <= 1 || loading}
                className={`rounded-xl bg-white/10 ${
                  largeButtons ? "px-5 py-3 text-sm" : "px-4 py-2 text-xs"
                } font-bold text-white transition hover:bg-white/20 disabled:opacity-40 focus:outline-none focus:ring-4 cursor-pointer`}
              >
                ◀ Prev
              </button>

              <span className={`text-xs font-bold ${themeStyles.accentText}`}>
                Page {page} of {totalPages}
              </span>

              <button
                type="button"
                onClick={() => {
                  setPage((prev) => Math.min(totalPages, prev + 1));
                  window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
                }}
                disabled={page >= totalPages || loading}
                className={`rounded-xl ${themeStyles.btnActive} ${
                  largeButtons ? "px-5 py-3 text-sm" : "px-4 py-2 text-xs"
                } font-bold shadow transition disabled:opacity-40 focus:outline-none focus:ring-4 cursor-pointer`}
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
