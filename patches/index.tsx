// src/routes/index.tsx
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import React, { useEffect, useMemo, useState, useRef, memo } from "react";
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
  getKidsModeLocked,
} from "@/lib/settings";
import {
  getRawWatchHistory,
  getWatchHistory,
  calculateSeriesProgress,
  getNextUnwatchedEpisode,
  isTitleDisliked,
  type ShowWatchHistory,
} from "@/lib/watch-history";
import { isTitleBroken } from "@/lib/broken-links";
import { bgAudio } from "@/lib/background-audio";
import {
  getCustomShelves,
  createCustomShelf,
  deleteCustomShelf,
  CUSTOM_SHELVES_EVENT,
  SHELF_ICON_PRESETS,
  type CustomShelf,
} from "@/lib/custom-shelves";
import {
  getCachedEpisodeAlerts,
  scanTrackedShowsForNewEpisodes,
  isAlertUnseenByUser,
  EPISODE_RADAR_UPDATED_EVENT,
  type EpisodeRadarAlert,
} from "@/lib/episode-radar";
import { MovieNightMatcher } from "@/components/MovieNightMatcher";
import { MascotAvatar } from "@/components/MascotAvatar";
import {
  getActiveMascotBadge,
  MASCOT_UPDATED_EVENT,
} from "@/lib/mascots";

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

const GREETING_WRAPPER_BG_URL =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/fontwrapper.png";

const BUTTON_WRAPPER_URL =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/buttonwrapper.png";

const MOVIE_NIGHT_BTN_URL =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/surpriseme.png";

const REAL_SURPRISE_ME_BTN_URL =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/real_surprisemmebutton.png";

/**
 * Viewport-locked layout rules for Home greeting card, dual-button wrapper,
 * bigger mascot badge, and buttonwrapper-backed section headers across
 * portrait phones, landscape phones, tablets, desktops, TVs, and projectors.
 */
const HOME_VIEWPORT_STYLES = `
  .rabtv-home-greet-card {
    --greet-u: clamp(44px, 11.5vw, 62px);
    position: relative;
    width: 100%;
    max-width: 72rem;
    min-height: clamp(164px, 34vw, 214px);
    border-radius: 26px;
    padding: clamp(16px, 3.6vw, 26px) clamp(12px, 3.4vw, 32px);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: clamp(10px, 2.4vw, 16px);
    overflow: hidden;
    box-sizing: border-box;
  }

  /* Smooth feathered edges so fontwrapper.png melts naturally into the app wallpaper */
  .rabtv-home-greet-bg {
    position: absolute;
    inset: 0;
    pointer-events: none;
    opacity: 0.78;
    background-size: 112% 185%;
    background-repeat: no-repeat;
    background-position: center center;
    -webkit-mask-image:
      linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.88) 16%, rgba(0,0,0,1) 50%, rgba(0,0,0,0.88) 84%, transparent 100%),
      linear-gradient(to right, transparent 0%, rgba(0,0,0,0.92) 8%, rgba(0,0,0,1) 50%, rgba(0,0,0,0.92) 92%, transparent 100%);
    -webkit-mask-composite: source-in;
    mask-image:
      linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.88) 16%, rgba(0,0,0,1) 50%, rgba(0,0,0,0.88) 84%, transparent 100%),
      linear-gradient(to right, transparent 0%, rgba(0,0,0,0.92) 8%, rgba(0,0,0,1) 50%, rgba(0,0,0,0.92) 92%, transparent 100%);
    mask-composite: intersect;
  }

  .rabtv-home-greet-vignette {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: radial-gradient(
      ellipse at center,
      rgba(0, 0, 0, 0.12) 38%,
      rgba(0, 0, 0, 0.52) 100%
    );
  }

  .rabtv-home-greet-mascot {
    width: clamp(46px, 12vw, 68px) !important;
    height: clamp(46px, 12vw, 68px) !important;
    flex-shrink: 0;
    filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.9));
  }

  .rabtv-home-greet-title {
    font-size: clamp(16px, 4.4vw, 26px);
    line-height: 1.15;
  }

  /* Single wide buttonwrapper.png bay holding BOTH Movie Night and Surprise Me side-by-side */
  .rabtv-home-dual-wrap {
    position: relative;
    width: min(100%, clamp(304px, 90vw, 560px));
    min-height: clamp(62px, 16vw, 88px);
    padding: clamp(9px, 2.2vw, 14px) clamp(18px, 5.2vw, 42px);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: clamp(8px, 2.4vw, 20px);
    box-sizing: border-box;
    background-size: 100% 100%;
    background-repeat: no-repeat;
    background-position: center center;
  }

  .rabtv-home-art-btn {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 1 1 0;
    min-width: 0;
    max-width: 48%;
    height: clamp(40px, 10.6vw, 56px);
    background: transparent;
    border: 0;
    padding: 0;
    cursor: pointer;
    transition: transform 160ms ease, filter 160ms ease;
  }

  .rabtv-home-art-btn img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
    filter: drop-shadow(0 3px 10px rgba(0, 0, 0, 0.85));
  }

  /* Section header banner backed cleanly by buttonwrapper.png */
  .rabtv-section-banner-wrap {
    position: relative;
    width: 100%;
    min-height: clamp(54px, 12vw, 72px);
    padding: clamp(10px, 2.2vw, 14px) clamp(20px, 5vw, 40px);
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: clamp(6px, 1.5vw, 12px);
    box-sizing: border-box;
    border-radius: 9999px;
    background-size: 100% 100%;
    background-repeat: no-repeat;
    background-position: center center;
    overflow: hidden;
  }

  @media (min-width: 640px) {
    .rabtv-home-greet-card {
      min-height: clamp(168px, 18vw, 224px);
      padding: clamp(18px, 2.2vw, 28px) clamp(24px, 3vw, 40px);
      gap: clamp(12px, 1.6vw, 18px);
    }

    .rabtv-home-greet-mascot {
      width: clamp(54px, 5.2vw, 74px) !important;
      height: clamp(54px, 5.2vw, 74px) !important;
    }

    .rabtv-home-greet-title {
      font-size: clamp(20px, 2.2vw, 28px);
    }

    .rabtv-home-dual-wrap {
      width: min(100%, clamp(440px, 56vw, 620px));
      min-height: clamp(72px, 7.6vw, 94px);
      padding: clamp(10px, 1.2vw, 15px) clamp(28px, 3.6vw, 48px);
      gap: clamp(14px, 2vw, 24px);
    }

    .rabtv-home-art-btn {
      height: clamp(46px, 4.9vw, 60px);
    }

    .rabtv-section-banner-wrap {
      min-height: clamp(58px, 5.8vw, 76px);
      padding: clamp(10px, 1.2vw, 15px) clamp(28px, 3.8vw, 48px);
    }
  }

  @media (min-width: 640px) and (max-height: 480px) {
    .rabtv-home-greet-card {
      min-height: 138px;
      padding: 12px 20px;
      gap: 8px;
    }

    .rabtv-home-greet-mascot {
      width: 46px !important;
      height: 46px !important;
    }

    .rabtv-home-dual-wrap {
      min-height: 60px;
      padding: 8px 26px;
    }

    .rabtv-home-art-btn {
      height: 40px;
    }
  }
`;

function getDetailsSearch(item: MediaItem): { id: string; type: "movie" | "tv" } {
  const cleanId = String(item.id).replace(/^(movie|tv)-/i, "");
  const type: "movie" | "tv" =
    item.mediaType === "tv" || String(item.id).toLowerCase().startsWith("tv-")
      ? "tv"
      : "movie";
  return { id: cleanId, type };
}

function getPlayerSearch(item: MediaItem): {
  id: string;
  type: "movie" | "tv";
  season: number;
  episode: number;
} {
  const details = getDetailsSearch(item);
  return {
    id: details.id,
    type: details.type,
    season: 1,
    episode: 1,
  };
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
          glow: "group-hover:shadow-[0_8px_28px_rgba(239,68,68,0.32)]",
          ring: "focus-within:ring-red-500 focus:ring-red-500",
          accentBadge: "text-red-300 border-red-500/35 bg-red-950/65",
          ratingBadge: "text-red-200 border-red-500/35 bg-black/75",
          typeBadge: "text-zinc-100 border-red-500/30 bg-black/75",
          belowPanel: "bg-gradient-to-b from-zinc-950/80 to-black/85 border-t border-red-500/25 backdrop-blur-sm",
          watchBar: "bg-black/80 border-t border-red-500/25 backdrop-blur-sm",
          watchBtn:
            "bg-red-950/45 hover:bg-red-900/75 border-red-500/30 text-white",
          mutedText: "text-zinc-300",
          subMutedText: "text-zinc-400",
          ratingText: "text-red-300",
          laser: "from-transparent via-red-500 to-rose-400",
        };
      case "midnight":
        return {
          glow: "group-hover:shadow-[0_8px_28px_rgba(59,130,246,0.32)]",
          ring: "focus-within:ring-blue-400 focus:ring-blue-400",
          accentBadge: "text-sky-300 border-blue-500/35 bg-blue-950/65",
          ratingBadge: "text-sky-200 border-blue-500/35 bg-black/75",
          typeBadge: "text-slate-100 border-blue-500/30 bg-black/75",
          belowPanel: "bg-gradient-to-b from-slate-950/80 to-black/85 border-t border-blue-500/25 backdrop-blur-sm",
          watchBar: "bg-black/80 border-t border-blue-500/25 backdrop-blur-sm",
          watchBtn:
            "bg-blue-950/45 hover:bg-blue-900/75 border-blue-500/30 text-white",
          mutedText: "text-slate-300",
          subMutedText: "text-slate-400",
          ratingText: "text-sky-300",
          laser: "from-transparent via-sky-400 to-blue-500",
        };
      case "emerald":
        return {
          glow: "group-hover:shadow-[0_8px_28px_rgba(16,185,129,0.32)]",
          ring: "focus-within:ring-emerald-400 focus:ring-emerald-400",
          accentBadge: "text-emerald-300 border-emerald-500/35 bg-emerald-950/65",
          ratingBadge: "text-emerald-200 border-emerald-500/35 bg-black/75",
          typeBadge: "text-neutral-100 border-emerald-500/30 bg-black/75",
          belowPanel: "bg-gradient-to-b from-neutral-950/80 to-black/85 border-t border-emerald-500/25 backdrop-blur-sm",
          watchBar: "bg-black/80 border-t border-emerald-500/25 backdrop-blur-sm",
          watchBtn:
            "bg-emerald-950/45 hover:bg-emerald-900/75 border-emerald-500/30 text-white",
          mutedText: "text-neutral-300",
          subMutedText: "text-neutral-400",
          ratingText: "text-emerald-300",
          laser: "from-transparent via-emerald-400 to-teal-400",
        };
      case "amber":
        return {
          glow: "group-hover:shadow-[0_8px_28px_rgba(245,158,11,0.32)]",
          ring: "focus-within:ring-amber-400 focus:ring-amber-400",
          accentBadge: "text-amber-300 border-amber-500/35 bg-amber-950/65",
          ratingBadge: "text-amber-200 border-amber-500/35 bg-black/75",
          typeBadge: "text-stone-100 border-amber-500/30 bg-black/75",
          belowPanel: "bg-gradient-to-b from-stone-950/80 to-black/85 border-t border-amber-500/25 backdrop-blur-sm",
          watchBar: "bg-black/80 border-t border-amber-500/25 backdrop-blur-sm",
          watchBtn:
            "bg-amber-950/45 hover:bg-amber-900/75 border-amber-500/30 text-white",
          mutedText: "text-stone-300",
          subMutedText: "text-stone-400",
          ratingText: "text-amber-300",
          laser: "from-transparent via-amber-400 to-orange-500",
        };
      case "cyan":
        return {
          glow: "group-hover:shadow-[0_8px_28px_rgba(6,182,212,0.32)]",
          ring: "focus-within:ring-cyan-400 focus:ring-cyan-400",
          accentBadge: "text-cyan-300 border-cyan-500/35 bg-cyan-950/65",
          ratingBadge: "text-cyan-200 border-cyan-500/35 bg-black/75",
          typeBadge: "text-slate-100 border-cyan-500/30 bg-black/75",
          belowPanel: "bg-gradient-to-b from-slate-950/80 to-black/85 border-t border-cyan-500/25 backdrop-blur-sm",
          watchBar: "bg-black/80 border-t border-cyan-500/25 backdrop-blur-sm",
          watchBtn:
            "bg-cyan-950/45 hover:bg-cyan-900/75 border-cyan-500/30 text-white",
          mutedText: "text-slate-300",
          subMutedText: "text-slate-400",
          ratingText: "text-cyan-300",
          laser: "from-transparent via-cyan-400 to-teal-400",
        };
      case "violet":
      default:
        return {
          glow: "group-hover:shadow-[0_8px_28px_rgba(139,92,246,0.32)]",
          ring: "focus-within:ring-violet-400 focus:ring-violet-400",
          accentBadge: "text-violet-300 border-violet-500/35 bg-purple-950/65",
          ratingBadge: "text-violet-200 border-violet-500/35 bg-black/75",
          typeBadge: "text-slate-100 border-violet-500/30 bg-black/75",
          belowPanel: "bg-gradient-to-b from-slate-950/80 to-black/85 border-t border-violet-500/25 backdrop-blur-sm",
          watchBar: "bg-black/80 border-t border-violet-500/25 backdrop-blur-sm",
          watchBtn:
            "bg-purple-950/45 hover:bg-purple-900/75 border-violet-500/30 text-white",
          mutedText: "text-slate-300",
          subMutedText: "text-slate-400",
          ratingText: "text-violet-300",
          laser: "from-transparent via-purple-500 to-violet-400",
        };
    }
  }, [appTheme]);

  const dimensions = getPosterDimensions(cardSize);
  const detailsSearch = getDetailsSearch(item);
  const playerSearch = getPlayerSearch(item);
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
        data-tour="media-card"
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
            <div
              className={`absolute top-1.5 right-1.5 z-10 rounded-md backdrop-blur-md px-1.5 py-0.5 text-[9px] font-bold border shadow ${cardThemeStyles.ratingBadge}`}
            >
              ★ {item.rating}
            </div>
          )}

          {appearance.showBadges && isDetailed && (
            <div
              className={`absolute top-1.5 left-1.5 z-10 rounded-md backdrop-blur-md px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wider border ${cardThemeStyles.typeBadge}`}
            >
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
                <p className={`text-[9px] font-medium mt-0.5 ${cardThemeStyles.mutedText}`}>
                  {item.year}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Below-Card Clean Theme-Matched Footer */}
        {isBelow && (
          <div className={`px-2 py-1.5 text-left ${cardThemeStyles.belowPanel}`}>
            <p className="text-[11px] font-bold text-white leading-tight line-clamp-1">
              {item.title}
            </p>
            <div
              className={`flex items-center justify-between gap-1 mt-0.5 text-[9px] font-semibold ${cardThemeStyles.subMutedText}`}
            >
              <span>{item.year || (item.mediaType === "tv" ? "Series" : "Movie")}</span>
              {appearance.showBadges && item.rating && (
                <span className={cardThemeStyles.ratingText}>★ {item.rating}</span>
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
      data-tour="media-card"
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
          <div
            className={`absolute top-2.5 right-2.5 z-10 rounded-lg backdrop-blur-md px-2 py-0.5 text-[10px] font-bold border shadow-md ${cardThemeStyles.ratingBadge}`}
          >
            ★ {item.rating}
          </div>
        )}

        {/* Top-Left Media Type Badge (Detailed Layout) */}
        {appearance.showBadges && isDetailed && (
          <div
            className={`absolute top-2.5 left-2.5 z-10 rounded-lg backdrop-blur-md px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider border shadow-md ${cardThemeStyles.typeBadge}`}
          >
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
                <span className={`text-[10px] font-semibold shrink-0 ${cardThemeStyles.mutedText}`}>
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

      {/* Below-Poster Clean Unobstructed Theme-Matched Info Panel */}
      {isBelow && (
        <div className={`p-3 text-left space-y-1.5 z-20 ${cardThemeStyles.belowPanel}`}>
          <h4 className={`font-bold text-white truncate ${dimensions.text}`}>
            {item.title}
          </h4>
          <div
            className={`flex items-center justify-between gap-2 text-[10px] font-semibold ${cardThemeStyles.mutedText}`}
          >
            <span
              className={`rounded-md px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider truncate max-w-[68%] border ${cardThemeStyles.accentBadge}`}
            >
              {item.genre ?? (item.mediaType === "tv" ? "TV SHOW" : "MOVIE")}
            </span>
            {item.year && <span className="shrink-0">{item.year}</span>}
          </div>
          <Link
            to="/player"
            search={playerSearch}
            onClick={() => bgAudio.pause()}
            className={`mt-1 block w-full text-center rounded-xl border ${cardThemeStyles.watchBtn} ${
              largeButtons ? "py-2.5 text-xs" : "py-1.5 text-[10px]"
            } font-bold tracking-wider uppercase transition focus:outline-none focus:ring-2 ${
              cardThemeStyles.ring
            }`}
          >
            ▶ Watch Now
          </Link>
        </div>
      )}

      {/* Standard Watch Bar (hidden in Pure Poster Wall & Hover-Reveal modes for cleaner art) */}
      {!isBelow && !isClean && !isHoverReveal && (
        <div className={`p-2 flex items-center justify-between z-20 ${cardThemeStyles.watchBar}`}>
          <Link
            to="/player"
            search={playerSearch}
            onClick={() => bgAudio.pause()}
            className={`w-full text-center rounded-xl border ${cardThemeStyles.watchBtn} ${
              largeButtons ? "py-2.5 text-xs" : "py-1.5 text-[10px]"
            } font-bold tracking-wider uppercase transition focus:outline-none focus:ring-2 ${
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

const NewShelfQuickBar = memo(function NewShelfQuickBar({
  btnActiveClass,
  btnSecondaryClass,
  surfaceClass,
  focusRingClass,
  subMutedClass,
  onCreated,
}: {
  btnActiveClass: string;
  btnSecondaryClass: string;
  surfaceClass: string;
  focusRingClass: string;
  subMutedClass: string;
  onCreated: (shelfId: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [icon, setIcon] = useState<string>("🎬");
  const [err, setErr] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = createCustomShelf(inputRef.current?.value || "", icon);
    if (!res.ok || !res.shelf) {
      setErr(res.error || "Could not create shelf.");
      return;
    }
    setErr(null);
    if (inputRef.current) {
      inputRef.current.value = "";
      inputRef.current.blur();
    }
    onCreated(res.shelf.id);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={`w-full max-w-4xl mx-auto rounded-2xl p-3 sm:p-4 space-y-2.5 backdrop-blur-md ${surfaceClass}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={`text-[10px] font-extrabold uppercase tracking-wider ${subMutedClass}`}
        >
          📚 Create Custom Watchlist Shelf
        </span>
      </div>
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
        {SHELF_ICON_PRESETS.map((ic) => (
          <button
            key={ic}
            type="button"
            onClick={() => setIcon(ic)}
            className={`h-8 w-8 shrink-0 rounded-xl border text-sm flex items-center justify-center transition cursor-pointer ${
              icon === ic ? `${btnActiveClass} border-transparent scale-105` : btnSecondaryClass
            }`}
            aria-label={`Choose ${ic} icon`}
          >
            {ic}
          </button>
        ))}
      </div>
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          dir="ltr"
          maxLength={36}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="Shelf name (e.g. Comfort Shows, Weekend Sci-Fi)"
          style={{ direction: "ltr", unicodeBidi: "plaintext", textAlign: "left" }}
          className={`flex-1 min-w-0 h-10 rounded-xl border border-white/15 bg-black/55 px-3 text-xs font-bold text-white placeholder-white/45 focus:outline-none focus:ring-2 ${focusRingClass}`}
        />
        <button
          type="submit"
          className={`h-10 px-4 rounded-xl text-xs font-extrabold uppercase tracking-wider shrink-0 transition cursor-pointer focus:outline-none focus:ring-2 ${btnActiveClass} ${focusRingClass}`}
        >
          + Create Shelf
        </button>
      </div>
      {err && <p className="text-[11px] font-bold text-red-400">{err}</p>}
    </form>
  );
});

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
    getActiveMascotBadge()
  );
  const [isLowRam, setIsLowRam] = useState<boolean>(
    () => getHardwareLimits().effectiveMode === "low"
  );

  const [myListSubTab, setMyListSubTab] = useState<string>("all");
  const [savedMyList, setSavedMyList] = useState<MediaItem[]>([]);
  const [savedFavorites, setSavedFavorites] = useState<MediaItem[]>([]);
  const [historyItems, setHistoryItems] = useState<MediaItem[]>([]);
  const [structuredHistory, setStructuredHistory] = useState<
    Record<string, ShowWatchHistory>
  >({});
  const [customShelves, setCustomShelves] = useState<CustomShelf[]>(() =>
    getCustomShelves()
  );
  const [showCreateShelfBar, setShowCreateShelfBar] = useState<boolean>(false);
  const [episodeAlerts, setEpisodeAlerts] = useState<
    Record<string, EpisodeRadarAlert>
  >(() => getCachedEpisodeAlerts());
  const [showMatcherModal, setShowMatcherModal] = useState<boolean>(false);
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
      setStructuredHistory({ ...getWatchHistory() });
      setCustomShelves(getCustomShelves());
      setEpisodeAlerts(getCachedEpisodeAlerts());
      setAppTheme(nextTheme);
      setCardSize(getSavedCardSize());
      setUserAge(getSavedUserAge());
      setPosterAppearance(getPosterAppearanceClasses(nextTheme));
      setPosterWidth(nextPosterWidth);
      setReducedMotion(getReducedMotion());
      setLargeButtons(getLargeButtons());
      setKidsLocked(getKidsModeLocked());
      setProfileMascot(getActiveMascotBadge());
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
    window.addEventListener(CUSTOM_SHELVES_EVENT, loadSavedListsAndTheme);
    window.addEventListener(EPISODE_RADAR_UPDATED_EVENT, loadSavedListsAndTheme);
    window.addEventListener(MASCOT_UPDATED_EVENT, loadSavedListsAndTheme);

    return () => {
      window.removeEventListener(CUSTOM_SHELVES_EVENT, loadSavedListsAndTheme);
      window.removeEventListener(
        EPISODE_RADAR_UPDATED_EVENT,
        loadSavedListsAndTheme
      );
      window.removeEventListener(MASCOT_UPDATED_EVENT, loadSavedListsAndTheme);
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

  // Background New Episode Radar scan (12h cached, RAM-safe)
  const trackedTvIdsKey = useMemo(() => {
    const tvIds: string[] = [];
    for (const s of Object.values(structuredHistory)) {
      if (s.mediaType === "tv") tvIds.push(s.showId);
    }
    for (const f of [...savedFavorites, ...savedMyList]) {
      if (f.mediaType === "tv" || String(f.id).startsWith("tv-")) {
        tvIds.push(String(f.id).replace(/^tv-/i, ""));
      }
    }
    return Array.from(new Set(tvIds)).slice(0, 12).join(",");
  }, [structuredHistory, savedFavorites, savedMyList]);

  useEffect(() => {
    if (!trackedTvIdsKey) return;
    const controller = new AbortController();
    let active = true;
    void scanTrackedShowsForNewEpisodes(
      trackedTvIdsKey.split(",").filter(Boolean),
      controller.signal
    ).then((alerts) => {
      if (active) setEpisodeAlerts(alerts);
    });
    return () => {
      active = false;
      controller.abort();
    };
  }, [trackedTvIdsKey]);

  // Structured "Continue Watching" Row items (In-Progress Movies & TV Shows)
  const continueWatchingItems = useMemo(() => {
    return Object.values(structuredHistory)
      .filter((entry) => {
        if (isTitleDisliked(entry.showId) || isTitleBroken(entry.showId)) {
          return false;
        }
        const pct = calculateSeriesProgress(entry);
        return pct < 100;
      })
      .sort((a, b) => (b.lastWatchedAt || 0) - (a.lastWatchedAt || 0))
      .slice(0, isLowRam ? 6 : 10)
      .map((entry) => {
        const pct = calculateSeriesProgress(entry);
        const nextEp =
          entry.mediaType === "tv" ? getNextUnwatchedEpisode(entry) : null;
        const rawAlert =
          entry.mediaType === "tv" ? episodeAlerts[entry.showId] : undefined;
        const freshAlert =
          rawAlert && isAlertUnseenByUser(rawAlert, entry.episodes)
            ? rawAlert
            : null;
        const posterUrl = entry.posterPath
          ? entry.posterPath.startsWith("http")
            ? optimizePosterUrl(entry.posterPath, posterWidth)
            : `https://image.tmdb.org/t/p/${posterWidth}${entry.posterPath}`
          : "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=900&q=80";

        return {
          entry,
          pct,
          nextEp,
          freshAlert,
          posterUrl,
        };
      });
  }, [structuredHistory, episodeAlerts, posterWidth, isLowRam]);

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
    else if (myListSubTab.startsWith("shelf:")) {
      const targetShelfId = myListSubTab.slice(6);
      const foundShelf = customShelves.find((s) => s.id === targetShelfId);
      rawList = (foundShelf?.items || []).map((it) => ({
        id: it.id,
        title: it.title,
        description: it.description || "",
        image: it.image,
        href: it.href,
        genre: it.genre || (it.mediaType === "tv" ? "TV SHOW" : "MOVIE"),
        year: it.year,
        rating: it.rating,
        mediaType: it.mediaType,
      }));
    } else {
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
    customShelves,
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
      return "grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 sm:gap-4 justify-items-center";
    }
    if (cardSize === "medium") {
      return "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 sm:gap-5 justify-items-center";
    }
    return "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5 justify-items-center";
  }, [cardSize]);

  // Comprehensive per-theme visual tokens with clean glass transparency
  const themeStyles =
    {
      violet: {
        bg: "bg-gradient-to-br from-slate-950/55 via-purple-950/25 to-black/65",
        baseText: "text-slate-100",
        mutedText: "text-slate-300",
        subMutedText: "text-slate-400",
        cardGradient: "from-purple-950/65 via-slate-950/70 to-indigo-950/65",
        navShell: "border-violet-500/30 shadow-[0_12px_36px_rgba(139,92,246,0.2)]",
        navOverlay: "bg-gradient-to-r from-black/45 via-purple-950/35 to-black/45",
        heroContainer:
          "bg-gradient-to-b from-slate-950/80 via-purple-950/20 to-black/85 border border-violet-500/35 shadow-[0_20px_50px_rgba(139,92,246,0.2)]",
        heroImageFade: "from-slate-950/80",
        heroPanelBg:
          "bg-gradient-to-b from-slate-950/75 via-purple-950/25 to-black/80 backdrop-blur-md border-t border-violet-500/25",
        surfacePanel:
          "bg-slate-950/55 border border-violet-500/25 shadow-[0_10px_30px_rgba(139,92,246,0.14)]",
        dividerBorder: "border-violet-500/20",
        btnActive:
          "bg-gradient-to-r from-violet-600/95 via-purple-600/95 to-indigo-600/95 text-white shadow-lg shadow-violet-600/30",
        btnSecondary:
          "bg-purple-950/40 hover:bg-purple-900/65 border border-violet-500/30 text-purple-100 hover:text-white backdrop-blur-md",
        pillInactive:
          "bg-purple-950/30 hover:bg-purple-900/55 text-purple-100 border border-violet-500/20 backdrop-blur-sm",
        scrollArrowBtn:
          "bg-black/55 hover:bg-purple-950/80 text-violet-300 hover:text-white border border-violet-500/30 backdrop-blur-sm",
        accentText: "text-violet-300",
        accentBar: "bg-violet-500 shadow-[0_0_12px_rgba(139,92,246,0.9)]",
        accentBadge: "bg-purple-950/60 border border-violet-500/35 text-violet-200 backdrop-blur-sm",
        subtleBadge: "bg-black/50 border border-violet-500/25 text-slate-200 backdrop-blur-sm",
        ratingBadge: "bg-purple-950/55 border border-violet-400/35 text-violet-200 backdrop-blur-sm",
        dotInactive: "bg-violet-300/30 hover:bg-violet-300/65",
        focusRing: "focus:ring-violet-400",
        activeTile:
          "bg-gradient-to-b from-violet-900/40 via-purple-950/55 to-slate-950/70 border-2 border-violet-400 shadow-[0_0_25px_rgba(139,92,246,0.45)] scale-[1.03]",
        inactiveTile:
          "bg-gradient-to-b from-purple-950/20 to-black/50 hover:from-purple-900/35 hover:to-black/65 border border-violet-500/20 hover:border-violet-400/45",
        scrollReminderArrow:
          "text-purple-400 drop-shadow-[0_0_8px_rgba(192,132,252,0.85)]",
      },
      red: {
        bg: "bg-gradient-to-br from-zinc-950/55 via-red-950/25 to-black/65",
        baseText: "text-zinc-100",
        mutedText: "text-zinc-300",
        subMutedText: "text-zinc-400",
        cardGradient: "from-red-950/65 via-zinc-950/70 to-black/75",
        navShell: "border-red-500/30 shadow-[0_12px_36px_rgba(239,68,68,0.2)]",
        navOverlay: "bg-gradient-to-r from-black/50 via-red-950/35 to-black/50",
        heroContainer:
          "bg-gradient-to-b from-zinc-950/80 via-red-950/20 to-black/85 border border-red-500/35 shadow-[0_20px_50px_rgba(239,68,68,0.2)]",
        heroImageFade: "from-zinc-950/80",
        heroPanelBg:
          "bg-gradient-to-b from-zinc-950/75 via-red-950/25 to-black/80 backdrop-blur-md border-t border-red-500/25",
        surfacePanel:
          "bg-zinc-950/55 border border-red-500/25 shadow-[0_10px_30px_rgba(239,68,68,0.14)]",
        dividerBorder: "border-red-500/20",
        btnActive:
          "bg-gradient-to-r from-red-600/95 via-rose-600/95 to-orange-600/95 text-white shadow-lg shadow-red-600/35",
        btnSecondary:
          "bg-red-950/40 hover:bg-red-900/65 border border-red-500/30 text-red-100 hover:text-white backdrop-blur-md",
        pillInactive:
          "bg-red-950/30 hover:bg-red-900/55 text-red-100 border border-red-500/20 backdrop-blur-sm",
        scrollArrowBtn:
          "bg-black/55 hover:bg-red-950/80 text-red-300 hover:text-white border border-red-500/30 backdrop-blur-sm",
        accentText: "text-red-400",
        accentBar: "bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.9)]",
        accentBadge: "bg-red-950/60 border border-red-500/35 text-red-200 backdrop-blur-sm",
        subtleBadge: "bg-black/50 border border-red-500/25 text-zinc-200 backdrop-blur-sm",
        ratingBadge: "bg-red-950/55 border border-red-400/35 text-red-200 backdrop-blur-sm",
        dotInactive: "bg-red-300/30 hover:bg-red-300/65",
        focusRing: "focus:ring-red-500",
        activeTile:
          "bg-gradient-to-b from-red-900/40 via-red-950/55 to-black/75 border-2 border-red-400 shadow-[0_0_25px_rgba(239,68,68,0.45)] scale-[1.03]",
        inactiveTile:
          "bg-gradient-to-b from-red-950/20 to-black/50 hover:from-red-900/35 hover:to-black/65 border border-red-500/20 hover:border-red-400/45",
        scrollReminderArrow:
          "text-red-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.85)]",
      },
      midnight: {
        bg: "bg-gradient-to-br from-slate-950/55 via-blue-950/25 to-black/65",
        baseText: "text-slate-100",
        mutedText: "text-slate-300",
        subMutedText: "text-slate-400",
        cardGradient: "from-blue-950/65 via-slate-950/70 to-sky-950/65",
        navShell: "border-blue-500/30 shadow-[0_12px_36px_rgba(59,130,246,0.2)]",
        navOverlay: "bg-gradient-to-r from-black/45 via-blue-950/35 to-black/45",
        heroContainer:
          "bg-gradient-to-b from-slate-950/80 via-blue-950/20 to-black/85 border border-blue-500/35 shadow-[0_20px_50px_rgba(59,130,246,0.2)]",
        heroImageFade: "from-slate-950/80",
        heroPanelBg:
          "bg-gradient-to-b from-slate-950/75 via-blue-950/25 to-black/80 backdrop-blur-md border-t border-blue-500/25",
        surfacePanel:
          "bg-slate-950/55 border border-blue-500/25 shadow-[0_10px_30px_rgba(59,130,246,0.14)]",
        dividerBorder: "border-blue-500/20",
        btnActive:
          "bg-gradient-to-r from-blue-600/95 via-cyan-600/95 to-sky-600/95 text-white shadow-lg shadow-blue-600/30",
        btnSecondary:
          "bg-blue-950/40 hover:bg-blue-900/65 border border-blue-500/30 text-blue-100 hover:text-white backdrop-blur-md",
        pillInactive:
          "bg-blue-950/30 hover:bg-blue-900/55 text-blue-100 border border-blue-500/20 backdrop-blur-sm",
        scrollArrowBtn:
          "bg-black/55 hover:bg-blue-950/80 text-sky-300 hover:text-white border border-blue-500/30 backdrop-blur-sm",
        accentText: "text-sky-300",
        accentBar: "bg-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.9)]",
        accentBadge: "bg-blue-950/60 border border-blue-500/35 text-sky-200 backdrop-blur-sm",
        subtleBadge: "bg-black/50 border border-blue-500/25 text-slate-200 backdrop-blur-sm",
        ratingBadge: "bg-blue-950/55 border border-sky-400/35 text-sky-200 backdrop-blur-sm",
        dotInactive: "bg-sky-300/30 hover:bg-sky-300/65",
        focusRing: "focus:ring-blue-400",
        activeTile:
          "bg-gradient-to-b from-blue-900/40 via-sky-950/55 to-slate-950/70 border-2 border-sky-400 shadow-[0_0_25px_rgba(56,189,248,0.45)] scale-[1.03]",
        inactiveTile:
          "bg-gradient-to-b from-blue-950/20 to-black/50 hover:from-blue-900/35 hover:to-black/65 border border-blue-500/20 hover:border-sky-400/45",
        scrollReminderArrow:
          "text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.85)]",
      },
      emerald: {
        bg: "bg-gradient-to-br from-neutral-950/55 via-emerald-950/25 to-black/65",
        baseText: "text-neutral-100",
        mutedText: "text-neutral-300",
        subMutedText: "text-neutral-400",
        cardGradient: "from-emerald-950/65 via-neutral-950/70 to-teal-950/65",
        navShell: "border-emerald-500/30 shadow-[0_12px_36px_rgba(16,185,129,0.2)]",
        navOverlay: "bg-gradient-to-r from-black/50 via-emerald-950/35 to-black/50",
        heroContainer:
          "bg-gradient-to-b from-neutral-950/80 via-emerald-950/20 to-black/85 border border-emerald-500/35 shadow-[0_20px_50px_rgba(16,185,129,0.2)]",
        heroImageFade: "from-neutral-950/80",
        heroPanelBg:
          "bg-gradient-to-b from-neutral-950/75 via-emerald-950/25 to-black/80 backdrop-blur-md border-t border-emerald-500/25",
        surfacePanel:
          "bg-neutral-950/55 border border-emerald-500/25 shadow-[0_10px_30px_rgba(16,185,129,0.14)]",
        dividerBorder: "border-emerald-500/20",
        btnActive:
          "bg-gradient-to-r from-emerald-600/95 via-teal-600/95 to-green-600/95 text-white shadow-lg shadow-emerald-600/30",
        btnSecondary:
          "bg-emerald-950/40 hover:bg-emerald-900/65 border border-emerald-500/30 text-emerald-100 hover:text-white backdrop-blur-md",
        pillInactive:
          "bg-emerald-950/30 hover:bg-emerald-900/55 text-emerald-100 border border-emerald-500/20 backdrop-blur-sm",
        scrollArrowBtn:
          "bg-black/55 hover:bg-emerald-950/80 text-emerald-300 hover:text-white border border-emerald-500/30 backdrop-blur-sm",
        accentText: "text-emerald-300",
        accentBar: "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.9)]",
        accentBadge:
          "bg-emerald-950/60 border border-emerald-500/35 text-emerald-200 backdrop-blur-sm",
        subtleBadge: "bg-black/50 border border-emerald-500/25 text-neutral-200 backdrop-blur-sm",
        ratingBadge:
          "bg-emerald-950/55 border border-emerald-400/35 text-emerald-200 backdrop-blur-sm",
        dotInactive: "bg-emerald-300/30 hover:bg-emerald-300/65",
        focusRing: "focus:ring-emerald-400",
        activeTile:
          "bg-gradient-to-b from-emerald-900/40 via-emerald-950/55 to-black/75 border-2 border-emerald-400 shadow-[0_0_25px_rgba(52,211,153,0.45)] scale-[1.03]",
        inactiveTile:
          "bg-gradient-to-b from-emerald-950/20 to-black/50 hover:from-emerald-900/35 hover:to-black/65 border border-emerald-500/20 hover:border-emerald-400/45",
        scrollReminderArrow:
          "text-emerald-300 drop-shadow-[0_0_8px_rgba(110,231,183,0.85)]",
      },
      amber: {
        bg: "bg-gradient-to-br from-stone-950/55 via-yellow-950/25 to-black/65",
        baseText: "text-stone-100",
        mutedText: "text-stone-300",
        subMutedText: "text-stone-400",
        cardGradient: "from-yellow-950/65 via-stone-950/70 to-amber-950/65",
        navShell: "border-amber-500/30 shadow-[0_12px_36px_rgba(245,158,11,0.2)]",
        navOverlay: "bg-gradient-to-r from-black/50 via-yellow-950/35 to-black/50",
        heroContainer:
          "bg-gradient-to-b from-stone-950/80 via-amber-950/20 to-black/85 border border-amber-500/35 shadow-[0_20px_50px_rgba(245,158,11,0.2)]",
        heroImageFade: "from-stone-950/80",
        heroPanelBg:
          "bg-gradient-to-b from-stone-950/75 via-amber-950/25 to-black/80 backdrop-blur-md border-t border-amber-500/25",
        surfacePanel:
          "bg-stone-950/55 border border-amber-500/25 shadow-[0_10px_30px_rgba(245,158,11,0.14)]",
        dividerBorder: "border-amber-500/20",
        btnActive:
          "bg-gradient-to-r from-amber-500/95 via-amber-600/95 to-yellow-600/95 text-white shadow-lg shadow-amber-600/30",
        btnSecondary:
          "bg-amber-950/40 hover:bg-amber-900/65 border border-amber-500/30 text-amber-100 hover:text-white backdrop-blur-md",
        pillInactive:
          "bg-amber-950/30 hover:bg-amber-900/55 text-amber-100 border border-amber-500/20 backdrop-blur-sm",
        scrollArrowBtn:
          "bg-black/55 hover:bg-amber-950/80 text-amber-300 hover:text-white border border-amber-500/30 backdrop-blur-sm",
        accentText: "text-amber-300",
        accentBar: "bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.9)]",
        accentBadge: "bg-amber-950/60 border border-amber-500/35 text-amber-200 backdrop-blur-sm",
        subtleBadge: "bg-black/50 border border-amber-500/25 text-stone-200 backdrop-blur-sm",
        ratingBadge: "bg-amber-950/55 border border-amber-400/35 text-amber-200 backdrop-blur-sm",
        dotInactive: "bg-amber-300/30 hover:bg-amber-300/65",
        focusRing: "focus:ring-amber-400",
        activeTile:
          "bg-gradient-to-b from-amber-900/40 via-amber-950/55 to-black/75 border-2 border-amber-400 shadow-[0_0_25px_rgba(251,191,36,0.45)] scale-[1.03]",
        inactiveTile:
          "bg-gradient-to-b from-amber-950/20 to-black/50 hover:from-amber-900/35 hover:to-black/65 border border-amber-500/20 hover:border-amber-400/45",
        scrollReminderArrow:
          "text-amber-300 drop-shadow-[0_0_8px_rgba(252,211,77,0.85)]",
      },
      cyan: {
        bg: "bg-gradient-to-br from-slate-950/55 via-cyan-950/25 to-black/65",
        baseText: "text-slate-100",
        mutedText: "text-slate-300",
        subMutedText: "text-slate-400",
        cardGradient: "from-cyan-950/65 via-slate-950/70 to-teal-950/65",
        navShell: "border-cyan-500/30 shadow-[0_12px_36px_rgba(6,182,212,0.2)]",
        navOverlay: "bg-gradient-to-r from-black/45 via-cyan-950/35 to-black/45",
        heroContainer:
          "bg-gradient-to-b from-slate-950/80 via-cyan-950/20 to-black/85 border border-cyan-500/35 shadow-[0_20px_50px_rgba(6,182,212,0.2)]",
        heroImageFade: "from-slate-950/80",
        heroPanelBg:
          "bg-gradient-to-b from-slate-950/75 via-cyan-950/25 to-black/80 backdrop-blur-md border-t border-cyan-500/25",
        surfacePanel:
          "bg-slate-950/55 border border-cyan-500/25 shadow-[0_10px_30px_rgba(6,182,212,0.14)]",
        dividerBorder: "border-cyan-500/20",
        btnActive:
          "bg-gradient-to-r from-cyan-600/95 via-teal-600/95 to-blue-600/95 text-white shadow-lg shadow-cyan-600/30",
        btnSecondary:
          "bg-cyan-950/40 hover:bg-cyan-900/65 border border-cyan-500/30 text-cyan-100 hover:text-white backdrop-blur-md",
        pillInactive:
          "bg-cyan-950/30 hover:bg-cyan-900/55 text-cyan-100 border border-cyan-500/20 backdrop-blur-sm",
        scrollArrowBtn:
          "bg-black/55 hover:bg-cyan-950/80 text-cyan-300 hover:text-white border border-cyan-500/30 backdrop-blur-sm",
        accentText: "text-cyan-300",
        accentBar: "bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.9)]",
        accentBadge: "bg-cyan-950/60 border border-cyan-500/35 text-cyan-200 backdrop-blur-sm",
        subtleBadge: "bg-black/50 border border-cyan-500/25 text-slate-200 backdrop-blur-sm",
        ratingBadge: "bg-cyan-950/55 border border-cyan-400/35 text-cyan-200 backdrop-blur-sm",
        dotInactive: "bg-cyan-300/30 hover:bg-cyan-300/65",
        focusRing: "focus:ring-cyan-400",
        activeTile:
          "bg-gradient-to-b from-cyan-900/40 via-cyan-950/55 to-slate-950/70 border-2 border-cyan-400 shadow-[0_0_25px_rgba(34,211,238,0.45)] scale-[1.03]",
        inactiveTile:
          "bg-gradient-to-b from-cyan-950/20 to-black/50 hover:from-cyan-900/35 hover:to-black/65 border border-cyan-500/20 hover:border-cyan-400/45",
        scrollReminderArrow:
          "text-cyan-300 drop-shadow-[0_0_8px_rgba(103,232,249,0.85)]",
      },
    }[appTheme] ?? {
      bg: "bg-gradient-to-br from-slate-950/55 via-purple-950/25 to-black/65",
      baseText: "text-slate-100",
      mutedText: "text-slate-300",
      subMutedText: "text-slate-400",
      cardGradient: "from-purple-950/65 via-slate-950/70 to-indigo-950/65",
      navShell: "border-violet-500/30 shadow-[0_12px_36px_rgba(139,92,246,0.2)]",
      navOverlay: "bg-gradient-to-r from-black/45 via-purple-950/35 to-black/45",
      heroContainer:
        "bg-gradient-to-b from-slate-950/80 via-purple-950/20 to-black/85 border border-violet-500/35 shadow-[0_20px_50px_rgba(139,92,246,0.2)]",
      heroImageFade: "from-slate-950/80",
      heroPanelBg:
        "bg-gradient-to-b from-slate-950/75 via-purple-950/25 to-black/80 backdrop-blur-md border-t border-violet-500/25",
      surfacePanel:
        "bg-slate-950/55 border border-violet-500/25 shadow-[0_10px_30px_rgba(139,92,246,0.14)]",
      dividerBorder: "border-violet-500/20",
      btnActive:
        "bg-gradient-to-r from-violet-600/95 via-purple-600/95 to-indigo-600/95 text-white shadow-lg shadow-violet-600/30",
      btnSecondary:
        "bg-purple-950/40 hover:bg-purple-900/65 border border-violet-500/30 text-purple-100 hover:text-white backdrop-blur-md",
      pillInactive:
        "bg-purple-950/30 hover:bg-purple-900/55 text-purple-100 border border-violet-500/20 backdrop-blur-sm",
      scrollArrowBtn:
        "bg-black/55 hover:bg-purple-950/80 text-violet-300 hover:text-white border border-violet-500/30 backdrop-blur-sm",
      accentText: "text-violet-300",
      accentBar: "bg-violet-500 shadow-[0_0_12px_rgba(139,92,246,0.9)]",
      accentBadge: "bg-purple-950/60 border border-violet-500/35 text-violet-200 backdrop-blur-sm",
      subtleBadge: "bg-black/50 border border-violet-500/25 text-slate-200 backdrop-blur-sm",
      ratingBadge: "bg-purple-950/55 border border-violet-400/35 text-violet-200 backdrop-blur-sm",
      dotInactive: "bg-violet-300/30 hover:bg-violet-300/65",
      focusRing: "focus:ring-violet-400",
      activeTile:
        "bg-gradient-to-b from-violet-900/40 via-purple-950/55 to-slate-950/70 border-2 border-violet-400 shadow-[0_0_25px_rgba(139,92,246,0.45)] scale-[1.03]",
      inactiveTile:
        "bg-gradient-to-b from-purple-950/20 to-black/50 hover:from-purple-900/35 hover:to-black/65 border border-violet-500/20 hover:border-violet-400/45",
      scrollReminderArrow:
        "text-purple-400 drop-shadow-[0_0_8px_rgba(192,132,252,0.85)]",
    };

  const activeHeroItem =
    heroItems.length > 0 ? heroItems[currentHeroIndex] : null;
  const heroDetailsSearch = activeHeroItem
    ? getDetailsSearch(activeHeroItem)
    : null;
  const heroPlayerSearch = activeHeroItem
    ? getPlayerSearch(activeHeroItem)
    : null;

  const pillTrackMaskStyle: React.CSSProperties = {
    maskImage:
      "linear-gradient(to right, transparent 0%, black 14px, black calc(100% - 14px), transparent 100%)",
    WebkitMaskImage:
      "linear-gradient(to right, transparent 0%, black 14px, black calc(100% - 14px), transparent 100%)",
  };

  return (
    <main
      className={`min-h-screen ${themeStyles.bg} ${themeStyles.baseText} transition-colors duration-300 pb-12 relative rounded-3xl`}
    >
      <style>{HOME_VIEWPORT_STYLES}</style>
      <div className="relative z-10">
        {/* Theme-Tinted Translucent Top Navigation Bar (Non-Overlapping Scroll Controls) */}
        <div className="sticky top-0 z-30 mb-4 mt-1 px-2 sm:px-4 py-2 flex justify-center">
          <div
            className={`relative max-w-6xl w-full flex items-center gap-1.5 rounded-2xl overflow-hidden border px-2 py-2 ${themeStyles.navShell}`}
            style={{
              backgroundImage: `url(${RABBIT_HEADER_PILL})`,
              backgroundSize: "112% 380%",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "center center",
            }}
          >
            <div
              className={`absolute inset-0 backdrop-blur-[3px] pointer-events-none rounded-2xl z-0 ${themeStyles.navOverlay}`}
            />
            <button
              type="button"
              onClick={() => scrollPill("nav-tabs-pill", "left")}
              className={`relative z-20 shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shadow-md transition cursor-pointer focus:outline-none focus:ring-2 ${themeStyles.scrollArrowBtn} ${themeStyles.focusRing}`}
              title="Scroll Left"
              aria-label="Scroll navigation left"
            >
              ‹
            </button>
            <div
              id="nav-tabs-pill"
              style={pillTrackMaskStyle}
              className="relative z-10 flex-1 min-w-0 overflow-x-auto scrollbar-none px-2 py-0.5 flex items-center justify-start sm:justify-center gap-2"
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
                      } rounded-xl font-bold tracking-wide transition-all duration-200 cursor-pointer shrink-0 focus:outline-none focus:ring-2 ${
                        themeStyles.focusRing
                      } ${
                        isActive
                          ? `${themeStyles.btnActive} scale-[1.03]`
                          : themeStyles.pillInactive
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
              className={`relative z-20 shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shadow-md transition cursor-pointer focus:outline-none focus:ring-2 ${themeStyles.scrollArrowBtn} ${themeStyles.focusRing}`}
              title="Scroll Right"
              aria-label="Scroll navigation right"
            >
              ›
            </button>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-2 sm:px-6 overflow-x-clip flex flex-col items-center">
          {/* Blended Greeting Card + Bigger Mascot + Single Button Wrapper Holding Movie Night & Surprise Me */}
          {(greetingText || filteredItems.length > 0) && (
            <div
              data-tour="greeting-header"
              className="rabtv-home-greet-card mb-5 bg-transparent border-0 text-center"
            >
              {/* Soft-Feathered Artwork Backdrop (Blends Smoothly Into App Wallpaper) */}
              <div
                className="rabtv-home-greet-bg"
                style={{
                  backgroundImage: `url(${GREETING_WRAPPER_BG_URL})`,
                }}
              />
              <div className="rabtv-home-greet-vignette" />

              <div className="relative z-10 flex flex-wrap items-center justify-center gap-2.5 sm:gap-3 max-w-full min-w-0">
                {greetingText && (
                  <div className="flex items-center justify-center gap-3 min-w-0 max-w-full">
                    <MascotAvatar
                      mascot={profileMascot}
                      size="lg"
                      rounded="full"
                      className={`rabtv-home-greet-mascot border-2 ${themeStyles.dividerBorder}`}
                      alt="Profile Mascot"
                    />
                    <p className="rabtv-home-greet-title font-black tracking-wide text-white truncate drop-shadow-[0_2px_8px_rgba(0,0,0,0.96)]">
                      {greetingText}
                    </p>
                  </div>
                )}
                {/* Semantic Kids Safe status indicator */}
                {kidsLocked && (
                  <span className="rounded-full bg-emerald-500/20 border border-emerald-400/40 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-emerald-300 shrink-0 backdrop-blur-sm">
                    🧒 Kids Safe Mode
                  </span>
                )}
              </div>

              {/* Single Button Wrapper Behind Both Movie Night & Real Surprise Me Buttons */}
              <div
                className="rabtv-home-dual-wrap relative z-10"
                style={{
                  backgroundImage: `url(${BUTTON_WRAPPER_URL})`,
                }}
              >
                <button
                  type="button"
                  data-tour="movie-night-matcher"
                  onClick={() => setShowMatcherModal(true)}
                  aria-label="Movie Night"
                  title="Mood picks & 5-card couch vote"
                  className={`rabtv-home-art-btn rounded-full hover:scale-[1.04] active:scale-95 focus:outline-none focus:ring-2 ${themeStyles.focusRing}`}
                >
                  <img
                    src={MOVIE_NIGHT_BTN_URL}
                    alt="Movie Night"
                    decoding="async"
                  />
                </button>

                {(filteredItems.length > 0 || heroItems.length > 0) && (
                  <button
                    type="button"
                    onClick={handleSurpriseMe}
                    aria-label="Surprise Me"
                    title="Pick a random title for me"
                    className={`rabtv-home-art-btn rounded-full hover:scale-[1.04] active:scale-95 focus:outline-none focus:ring-2 ${themeStyles.focusRing}`}
                  >
                    <img
                      src={REAL_SURPRISE_ME_BTN_URL}
                      alt="Surprise Me"
                      decoding="async"
                    />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Clean Split Hero Card: 100% Unobstructed Cover Art Above + Theme-Matched Details Panel Below */}
          {activeHeroItem && heroDetailsSearch && heroPlayerSearch ? (
            <div
              data-tour="hero-banner"
              className={`mb-6 w-full max-w-6xl overflow-hidden rounded-[28px] flex flex-col group ${themeStyles.heroContainer}`}
            >
              {/* Top: Full-Bleed Stretched Cover Art — Fills 100% of Container on All Sides, Zero Overlaid Text */}
              <Link
                to="/details"
                search={heroDetailsSearch}
                className={`relative block w-full sm:h-[360px] md:h-[460px] lg:h-[540px] overflow-hidden bg-black focus:outline-none focus:ring-4 ${themeStyles.focusRing}`}
              >
                <img
                  src={optimizePosterUrl(
                    activeHeroItem.image,
                    isLowRam ? "w342" : "w500"
                  )}
                  alt={activeHeroItem.title}
                  decoding="async"
                  className="block w-full h-auto sm:h-full object-fill transition-transform duration-700 ease-out group-hover:scale-[1.02]"
                />
              </Link>

              {/* Bottom: Clean Theme-Matched Glass Details Panel */}
              <div
                className={`p-4 sm:p-6 md:p-7 text-left space-y-3 ${themeStyles.heroPanelBg}`}
              >
                {/* Metadata Badges */}
                <div className="flex items-center flex-wrap gap-2">
                  <span
                    className={`rounded-full px-3 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.16em] leading-snug ${themeStyles.accentBadge}`}
                  >
                    {activeHeroItem.genre ?? "Featured"}
                  </span>
                  {activeHeroItem.rating && (
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${themeStyles.ratingBadge}`}
                    >
                      ★ {activeHeroItem.rating}
                    </span>
                  )}
                  {activeHeroItem.year && (
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${themeStyles.subtleBadge}`}
                    >
                      {activeHeroItem.year}
                    </span>
                  )}
                </div>

                {/* Title */}
                <Link
                  to="/details"
                  search={heroDetailsSearch}
                  className={`block rounded-lg focus:outline-none focus:ring-2 ${themeStyles.focusRing}`}
                >
                  <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tight leading-tight transition line-clamp-2">
                    {activeHeroItem.title}
                  </h2>
                </Link>

                {/* Synopsis */}
                {activeHeroItem.description && (
                  <p
                    className={`text-xs sm:text-sm leading-relaxed line-clamp-2 sm:line-clamp-3 max-w-3xl ${themeStyles.mutedText}`}
                  >
                    {activeHeroItem.description}
                  </p>
                )}

                {/* Action Buttons + Dedicated Non-Overlapping Carousel Controls */}
                <div className="pt-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center flex-wrap gap-2.5">
                    <Link
                      to="/player"
                      search={heroPlayerSearch}
                      onClick={() => bgAudio.pause()}
                      data-tour="hero-play"
                      className={`inline-flex items-center gap-2 ${
                        largeButtons
                          ? "px-6 py-3 text-sm"
                          : "px-5 py-2.5 text-xs"
                      } rounded-xl font-bold uppercase tracking-wider transition hover:scale-[1.03] active:scale-95 focus:outline-none focus:ring-2 ${
                        themeStyles.btnActive
                      } ${themeStyles.focusRing}`}
                    >
                      ▶ Watch Now
                    </Link>
                    <Link
                      to="/details"
                      search={heroDetailsSearch}
                      className={`inline-flex items-center gap-1.5 ${
                        largeButtons
                          ? "px-5 py-3 text-sm"
                          : "px-4 py-2.5 text-xs"
                      } rounded-xl font-bold transition focus:outline-none focus:ring-2 ${
                        themeStyles.btnSecondary
                      } ${themeStyles.focusRing}`}
                    >
                      ⓘ Details
                    </Link>
                  </div>

                  {heroItems.length > 1 && (
                    <div
                      className={`flex items-center justify-between sm:justify-end gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 ${themeStyles.dividerBorder}`}
                    >
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider whitespace-nowrap shrink-0 sm:hidden ${themeStyles.subMutedText}`}
                      >
                        Featured {currentHeroIndex + 1} / {heroItems.length}
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setCurrentHeroIndex(
                              (prev) =>
                                (prev - 1 + heroItems.length) % heroItems.length
                            )
                          }
                          className={`h-8 w-8 rounded-full text-sm font-bold flex items-center justify-center transition cursor-pointer focus:outline-none focus:ring-2 ${themeStyles.scrollArrowBtn} ${themeStyles.focusRing}`}
                          aria-label="Previous featured title"
                        >
                          ‹
                        </button>

                        <div className="flex items-center gap-1.5">
                          {heroItems.slice(0, 8).map((hItem, idx) => (
                            <button
                              key={hItem.id}
                              type="button"
                              onClick={() => setCurrentHeroIndex(idx)}
                              aria-label={`Show featured title ${idx + 1}`}
                              className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer focus:outline-none ${
                                idx === currentHeroIndex % 8
                                  ? `w-5 sm:w-6 ${themeStyles.accentBar}`
                                  : `w-1.5 ${themeStyles.dotInactive}`
                              }`}
                            />
                          ))}
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setCurrentHeroIndex(
                              (prev) => (prev + 1) % heroItems.length
                            )
                          }
                          className={`h-8 w-8 rounded-full text-sm font-bold flex items-center justify-center transition cursor-pointer focus:outline-none focus:ring-2 ${themeStyles.scrollArrowBtn} ${themeStyles.focusRing}`}
                          aria-label="Next featured title"
                        >
                          ›
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <section
              className={`mb-6 w-full max-w-6xl overflow-hidden rounded-[28px] bg-gradient-to-br ${themeStyles.cardGradient} border ${themeStyles.dividerBorder} shadow-2xl relative h-[280px] sm:h-[340px] flex flex-col items-center justify-center backdrop-blur-md`}
            >
              <div className={`text-center px-4 ${themeStyles.mutedText}`}>
                {loading
                  ? `Loading ${activeTab}...`
                  : error ?? "No media found in this section."}
              </div>
            </section>
          )}

          {/* CONTINUE WATCHING ROW (Home Tab — In-Progress Movies & TV Shows with Progress Bars & Episode Radar) */}
          {activeTab === "Home" && continueWatchingItems.length > 0 && (
            <section
              data-tour="continue-watching-row"
              className="mb-6 w-full max-w-6xl space-y-3 px-1"
            >
              <div
                className="rabtv-section-banner-wrap"
                style={{
                  backgroundImage: `url(${BUTTON_WRAPPER_URL})`,
                }}
              >
                <div className="flex items-center gap-2.5 min-w-0 relative z-10">
                  <span
                    className={`w-1.5 h-5 sm:h-6 rounded-full shrink-0 ${themeStyles.accentBar}`}
                  />
                  <h3 className="text-sm sm:text-lg font-black tracking-tight text-white truncate drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)]">
                    ▶ Continue Watching
                  </h3>
                </div>
                <Link
                  to="/watch-history"
                  className={`relative z-10 text-xs font-extrabold hover:underline shrink-0 drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)] ${themeStyles.accentText}`}
                >
                  Full History →
                </Link>
              </div>

              <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-2 pt-0.5 scrollbar-none">
                {continueWatchingItems.map(
                  ({ entry, pct, nextEp, freshAlert, posterUrl }) => {
                    const targetSeason = freshAlert
                      ? freshAlert.seasonNumber
                      : nextEp?.seasonNumber || 1;
                    const targetEpisode = freshAlert
                      ? freshAlert.episodeNumber
                      : nextEp?.episodeNumber || 1;

                    return (
                      <div
                        key={entry.showId}
                        className={`group shrink-0 w-40 sm:w-48 flex flex-col overflow-hidden backdrop-blur-md ${posterAppearance.radiusClass} ${themeStyles.surfacePanel} transition-all duration-300 hover:-translate-y-1`}
                      >
                        <Link
                          to="/details"
                          search={{
                            id: entry.showId,
                            type: entry.mediaType === "tv" ? "tv" : "movie",
                          }}
                          className="relative aspect-[16/10] w-full bg-black overflow-hidden block"
                        >
                          <img
                            src={posterUrl}
                            alt={entry.title}
                            loading="lazy"
                            decoding="async"
                            className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent pointer-events-none" />

                          {freshAlert && (
                            <span
                              className={`absolute top-1.5 left-1.5 rounded-lg px-2 py-0.5 text-[9px] font-black uppercase shadow-lg truncate max-w-[90%] ${themeStyles.btnActive}`}
                            >
                              {freshAlert.badgeLabel}
                            </span>
                          )}

                          <div className="absolute inset-x-2 bottom-2 space-y-1">
                            <p className="text-xs font-black text-white truncate drop-shadow">
                              {entry.title}
                            </p>
                            <div className="h-1 w-full rounded-full bg-white/20 overflow-hidden">
                              <div
                                className={`h-full ${themeStyles.btnActive}`}
                                style={{ width: `${Math.max(10, pct)}%` }}
                              />
                            </div>
                          </div>
                        </Link>

                        <div className="p-2">
                          <Link
                            to="/player"
                            search={{
                              id: entry.showId,
                              type: entry.mediaType === "tv" ? "tv" : "movie",
                              season: targetSeason,
                              episode: targetEpisode,
                            }}
                            onClick={() => bgAudio.pause()}
                            className={`block w-full text-center rounded-xl py-1.5 text-[10px] font-extrabold uppercase tracking-wider transition focus:outline-none focus:ring-2 ${
                              freshAlert
                                ? themeStyles.btnActive
                                : themeStyles.btnSecondary
                            } ${themeStyles.focusRing}`}
                          >
                            {freshAlert
                              ? `▶ New S${freshAlert.seasonNumber}E${freshAlert.episodeNumber}`
                              : entry.mediaType === "tv" && nextEp
                                ? `▶ Resume ${nextEp.label}`
                                : "▶ Resume Movie"}
                          </Link>
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            </section>
          )}

          {activeTab !== "My List" && (
            <section
              data-tour="catalog-filters"
              className="mb-6 space-y-4 flex flex-col items-center justify-center text-center w-full max-w-6xl"
            >
              {/* Disney+ Style Translucent Brand Hub Tiles (Netflix, Prime, Disney+, All) */}
              <div data-tour="provider-filter" className="w-full px-1">
                <div className="grid grid-cols-4 gap-2.5 sm:gap-4 w-full">
                  {providerCategories.map((prov) => {
                    const isActive = providerFilter === prov.name;
                    const isDefault = prov.name === "All (Default)";
                    return (
                      <button
                        key={prov.name}
                        type="button"
                        onClick={() => handleProviderSelect(prov.name)}
                        className={`relative group h-14 sm:h-20 rounded-2xl p-2 sm:p-3 transition-all duration-300 cursor-pointer flex items-center justify-center overflow-hidden backdrop-blur-md focus:outline-none focus:ring-2 ${
                          themeStyles.focusRing
                        } ${
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

              {/* Sleek Theme-Matched Glass Genre Ribbon (Non-Overlapping Scroll Controls) */}
              <div data-tour="genre-filter" className="flex justify-center w-full px-1">
                <div
                  className={`relative w-full flex items-center gap-1.5 rounded-2xl backdrop-blur-md overflow-hidden px-2 py-2 ${themeStyles.surfacePanel}`}
                >
                  <button
                    type="button"
                    onClick={() => scrollPill("genre-pill", "left")}
                    className={`relative z-20 shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shadow-md transition cursor-pointer focus:outline-none focus:ring-2 ${themeStyles.scrollArrowBtn} ${themeStyles.focusRing}`}
                    title="Scroll Left"
                    aria-label="Scroll genres left"
                  >
                    ‹
                  </button>
                  <div
                    id="genre-pill"
                    style={pillTrackMaskStyle}
                    className="relative z-10 flex-1 min-w-0 overflow-x-auto scrollbar-none px-2 py-0.5 flex items-center justify-start gap-2"
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
                            } rounded-xl font-bold tracking-wide transition-all duration-200 cursor-pointer shrink-0 focus:outline-none focus:ring-2 ${
                              themeStyles.focusRing
                            } ${
                              isActive
                                ? `${themeStyles.btnActive} scale-[1.03]`
                                : themeStyles.pillInactive
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
                    className={`relative z-20 shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shadow-md transition cursor-pointer focus:outline-none focus:ring-2 ${themeStyles.scrollArrowBtn} ${themeStyles.focusRing}`}
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
              <div
                className={`relative w-full flex items-center gap-1.5 rounded-2xl backdrop-blur-md overflow-hidden px-2 py-2 ${themeStyles.surfacePanel}`}
              >
                <button
                  type="button"
                  onClick={() => scrollPill("mylist-pill", "left")}
                  className={`relative z-20 shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shadow-md transition cursor-pointer focus:outline-none focus:ring-2 ${themeStyles.scrollArrowBtn} ${themeStyles.focusRing}`}
                  title="Scroll Left"
                  aria-label="Scroll list tabs left"
                >
                  ‹
                </button>
                <div
                  id="mylist-pill"
                  style={pillTrackMaskStyle}
                  className="relative z-10 flex-1 min-w-0 overflow-x-auto scrollbar-none px-2 py-0.5 flex items-center justify-start sm:justify-center gap-2"
                >
                  <div className="flex items-center gap-2 min-w-max mx-auto">
                    <button
                      type="button"
                      onClick={() => setMyListSubTab("all")}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 focus:outline-none focus:ring-2 ${
                        themeStyles.focusRing
                      } ${
                        myListSubTab === "all"
                          ? `${themeStyles.btnActive} scale-[1.03]`
                          : themeStyles.pillInactive
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
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 focus:outline-none focus:ring-2 ${
                        themeStyles.focusRing
                      } ${
                        myListSubTab === "in_progress"
                          ? `${themeStyles.btnActive} scale-[1.03]`
                          : themeStyles.pillInactive
                      }`}
                    >
                      ⏳ In Progress ({inProgressHistory.length})
                    </button>

                    <button
                      type="button"
                      onClick={() => setMyListSubTab("mylist")}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 focus:outline-none focus:ring-2 ${
                        themeStyles.focusRing
                      } ${
                        myListSubTab === "mylist"
                          ? `${themeStyles.btnActive} scale-[1.03]`
                          : themeStyles.pillInactive
                      }`}
                    >
                      🔖 Watch Later ({savedMyList.length})
                    </button>

                    <button
                      type="button"
                      onClick={() => setMyListSubTab("favorites")}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 focus:outline-none focus:ring-2 ${
                        themeStyles.focusRing
                      } ${
                        myListSubTab === "favorites"
                          ? `${themeStyles.btnActive} scale-[1.03]`
                          : themeStyles.pillInactive
                      }`}
                    >
                      ⭐ Favorites ({savedFavorites.length})
                    </button>

                    {customShelves.map((shelf) => {
                      const shelfKey = `shelf:${shelf.id}`;
                      const isSelected = myListSubTab === shelfKey;
                      return (
                        <button
                          key={shelf.id}
                          type="button"
                          onClick={() => setMyListSubTab(shelfKey)}
                          className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 focus:outline-none focus:ring-2 ${
                            themeStyles.focusRing
                          } ${
                            isSelected
                              ? `${themeStyles.btnActive} scale-[1.03]`
                              : themeStyles.pillInactive
                          }`}
                        >
                          {shelf.icon} {shelf.name} ({shelf.items.length})
                        </button>
                      );
                    })}

                    <button
                      type="button"
                      onClick={() => setShowCreateShelfBar((v) => !v)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition cursor-pointer shrink-0 focus:outline-none focus:ring-2 ${themeStyles.btnSecondary} ${themeStyles.focusRing}`}
                    >
                      {showCreateShelfBar ? "✕ Close" : "+ New Shelf"}
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => scrollPill("mylist-pill", "right")}
                  className={`relative z-20 shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shadow-md transition cursor-pointer focus:outline-none focus:ring-2 ${themeStyles.scrollArrowBtn} ${themeStyles.focusRing}`}
                  title="Scroll Right"
                  aria-label="Scroll list tabs right"
                >
                  ›
                </button>
              </div>
            </section>
          )}

          {activeTab === "My List" && showCreateShelfBar && (
            <div className="mb-5 w-full px-1">
              <NewShelfQuickBar
                btnActiveClass={themeStyles.btnActive}
                btnSecondaryClass={themeStyles.btnSecondary}
                surfaceClass={themeStyles.surfacePanel}
                focusRingClass={themeStyles.focusRing}
                subMutedClass={themeStyles.subMutedText}
                onCreated={(newShelfId) => {
                  setCustomShelves(getCustomShelves());
                  setMyListSubTab(`shelf:${newShelfId}`);
                  setShowCreateShelfBar(false);
                }}
              />
            </div>
          )}

          {activeTab === "My List" && myListSubTab.startsWith("shelf:") && (
            <div className="mb-4 w-full max-w-6xl px-1 flex items-center justify-end">
              <button
                type="button"
                onClick={() => {
                  const sid = myListSubTab.slice(6);
                  deleteCustomShelf(sid);
                  setCustomShelves(getCustomShelves());
                  setMyListSubTab("all");
                }}
                className="rounded-xl bg-red-950/60 hover:bg-red-700 border border-red-500/40 px-3 py-1.5 text-[11px] font-extrabold text-red-200 hover:text-white transition cursor-pointer backdrop-blur-sm"
              >
                🗑️ Delete This Custom Shelf
              </button>
            </div>
          )}

          {/* Main Catalog Section */}
          <section
            data-tour={activeTab === "My List" ? "favorites-grid" : "catalog-grid"}
            className="mb-8 px-1 w-full max-w-6xl"
          >
            <div
              className="rabtv-section-banner-wrap mb-4"
              style={{
                backgroundImage: `url(${BUTTON_WRAPPER_URL})`,
              }}
            >
              <div className="flex items-center gap-2.5 min-w-0 relative z-10">
                <span
                  className={`w-1.5 h-5 sm:h-6 rounded-full shrink-0 ${themeStyles.accentBar}`}
                />
                <h3 className="text-sm sm:text-lg md:text-xl font-black tracking-tight text-white truncate drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)]">
                  {activeTab === "My List"
                    ? "Saved Catalog"
                    : `${activeTab} Catalog`}
                </h3>
              </div>
              <span
                className={`relative z-10 text-[11px] sm:text-xs font-semibold px-3 py-1 rounded-full shrink-0 ${themeStyles.accentBadge}`}
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
              <div
                className={`rounded-2xl backdrop-blur-md p-8 text-center mx-1 ${themeStyles.surfacePanel}`}
              >
                <p className={`text-sm ${themeStyles.mutedText}`}>
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
              <div
                className={`flex flex-col items-center gap-0.5 backdrop-blur-md px-4 py-2 rounded-xl shadow-2xl ${themeStyles.surfacePanel}`}
              >
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white opacity-100">
                  More Content Below
                </span>
                <span
                  className={`text-xl font-black animate-slow-glow ${themeStyles.scrollReminderArrow} opacity-100`}
                >
                  ⌄
                </span>
              </div>
            </div>
          )}

          {activeTab === "My List" && suggestedItems.length > 0 && (
            <section
              className={`mb-8 px-1 pt-6 border-t w-full max-w-6xl ${themeStyles.dividerBorder}`}
            >
              <div
                className="rabtv-section-banner-wrap mb-4"
                style={{
                  backgroundImage: `url(${BUTTON_WRAPPER_URL})`,
                }}
              >
                <div className="flex items-center gap-2.5 min-w-0 relative z-10">
                  <span
                    className={`w-1.5 h-5 sm:h-6 rounded-full shrink-0 ${themeStyles.accentBar}`}
                  />
                  <h3 className="text-sm sm:text-lg md:text-xl font-black text-white truncate drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)]">
                    ✨ Suggested For You
                  </h3>
                </div>
                <span
                  className={`relative z-10 text-[11px] sm:text-xs font-bold shrink-0 drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)] ${themeStyles.accentText}`}
                >
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
            <div
              data-tour="load-more"
              className={`mb-4 flex items-center justify-center gap-4 rounded-2xl backdrop-blur-md p-3 mx-2 w-full max-w-sm shadow-xl ${themeStyles.surfacePanel}`}
            >
              <button
                type="button"
                onClick={() => {
                  setPage((prev) => Math.max(1, prev - 1));
                  window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
                }}
                disabled={page <= 1 || loading}
                className={`rounded-xl ${
                  largeButtons ? "px-5 py-3 text-sm" : "px-4 py-2 text-xs"
                } font-bold transition disabled:opacity-40 focus:outline-none focus:ring-4 cursor-pointer ${
                  themeStyles.btnSecondary
                } ${themeStyles.focusRing}`}
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
                } font-bold shadow transition disabled:opacity-40 focus:outline-none focus:ring-4 cursor-pointer ${
                  themeStyles.focusRing
                }`}
              >
                Next ▶
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Movie Night Matcher Modal */}
      <MovieNightMatcher
        isOpen={showMatcherModal}
        appTheme={appTheme}
        onClose={() => setShowMatcherModal(false)}
      />
    </main>
  );
}