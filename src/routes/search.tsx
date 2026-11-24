// src/routes/search.tsx
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import React, {
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
  memo,
} from "react";
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
import { AppWallpaper } from "@/components/AppWallpaper";
import { isTitleDisliked, recordWatchHistory } from "@/lib/watch-history";
import { isTitleBroken } from "@/lib/broken-links";
import { searchLiveChannels, type LiveChannel } from "@/lib/live-feed-service";

const TMDB_API_KEY =
  ((import.meta as any).env?.VITE_TMDB_API_KEY as string) || "";
const TMDB_BASE_URL = "https://api.themoviedb.org/3/";
const RECENT_SEARCHES_KEY = "rabtv_recent_searches_v1";
const SMART_BEHAVIOR_KEY = "rabtv_search_behavior_v1";
const FETCH_TIMEOUT_MS = 8500;
const PREDICTIVE_DEBOUNCE_MS = 280;

// =============================================================================
// NEW PHASE-1 COMMITTED SEARCH PAGE IMAGE ASSETS (10 ISOLATED FILES)
// =============================================================================
const IMG_DECK_PANEL_BG =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-search-deck-panel-background.jpg";
const IMG_CATALOG_BANNER_BG =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-search-catalog-banner-background.jpg";
const IMG_INPUT_BAR_BG =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-search-input-bar-background.jpg";
const IMG_BTN_HOME =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-search-button-home-primary.jpg";
const IMG_BTN_SUBMIT =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-search-button-submit-primary.jpg";
const IMG_BTN_FILTER_IDLE =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-search-button-filter-idle.jpg";
const IMG_BTN_FILTER_ACTIVE =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-search-button-filter-active.jpg";
const IMG_BTN_CLEAR_DANGER =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-search-button-clear-danger.jpg";
const IMG_DROPDOWN_TRIGGER =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-search-dropdown-trigger-idle.jpg";
const IMG_DROPDOWN_MENU_PANEL =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-search-dropdown-menu-panel.jpg";

/**
 * 6-Theme Hue-Shift Tokens & Armored UI Plate Geometry
 * Synced 1:1 with Index, Details, and Player pages.
 */
const SEARCH_PAGE_STYLES = `
  :root,
  html[data-theme="violet"] {
    --rabtv-srch-plate-filter: hue-rotate(-78deg) saturate(1.12) brightness(1.02);
    --rabtv-srch-play-filter: hue-rotate(-74deg) saturate(1.16) brightness(1.05);
    --rabtv-srch-ambient-ring: rgba(168, 85, 247, 0.34);
  }

  html[data-theme="red"] {
    --rabtv-srch-plate-filter: hue-rotate(0deg) saturate(1.08) brightness(1.0);
    --rabtv-srch-play-filter: hue-rotate(0deg) saturate(1.14) brightness(1.04);
    --rabtv-srch-ambient-ring: rgba(196, 40, 42, 0.38);
  }

  html[data-theme="midnight"] {
    --rabtv-srch-plate-filter: hue-rotate(-132deg) saturate(1.14) brightness(1.04);
    --rabtv-srch-play-filter: hue-rotate(-128deg) saturate(1.18) brightness(1.06);
    --rabtv-srch-ambient-ring: rgba(56, 189, 248, 0.34);
  }

  html[data-theme="emerald"] {
    --rabtv-srch-plate-filter: hue-rotate(154deg) saturate(1.10) brightness(1.02);
    --rabtv-srch-play-filter: hue-rotate(150deg) saturate(1.15) brightness(1.04);
    --rabtv-srch-ambient-ring: rgba(16, 185, 129, 0.34);
  }

  html[data-theme="amber"] {
    --rabtv-srch-plate-filter: hue-rotate(28deg) saturate(1.14) brightness(1.04);
    --rabtv-srch-play-filter: hue-rotate(24deg) saturate(1.18) brightness(1.06);
    --rabtv-srch-ambient-ring: rgba(245, 158, 11, 0.34);
  }

  html[data-theme="cyan"] {
    --rabtv-srch-plate-filter: hue-rotate(-154deg) saturate(1.12) brightness(1.04);
    --rabtv-srch-play-filter: hue-rotate(-150deg) saturate(1.16) brightness(1.06);
    --rabtv-srch-ambient-ring: rgba(34, 211, 238, 0.36);
  }

  /* Main Search Control Deck (Female Rabbit Detective in Bottom-Right) */
  .rabtv-srch-deck {
    position: relative;
    background-color: #0c0a09;
    overflow: visible;
    transition: box-shadow 260ms ease;
  }

  .rabtv-srch-deck--engaged {
    box-shadow: 0 0 0 1px rgba(34, 211, 238, 0.32), 0 0 36px var(--rabtv-srch-ambient-ring);
  }

  .rabtv-srch-deck-bg {
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background-size: 100% 100%;
    background-position: center center;
    background-repeat: no-repeat;
    opacity: 0.84;
    filter: var(--rabtv-srch-plate-filter);
    -webkit-mask-image: radial-gradient(
      ellipse 96% 94% at 50% 50%,
      rgba(12, 10, 9, 1) 74%,
      rgba(12, 10, 9, 0.74) 93%,
      rgba(12, 10, 9, 0.34) 100%
    );
    mask-image: radial-gradient(
      ellipse 96% 94% at 50% 50%,
      rgba(12, 10, 9, 1) 74%,
      rgba(12, 10, 9, 0.74) 93%,
      rgba(12, 10, 9, 0.34) 100%
    );
    pointer-events: none;
    z-index: 0;
  }

  .rabtv-srch-deck-scrim {
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: radial-gradient(
      ellipse 78% 76% at 38% 36%,
      rgba(12, 10, 9, 0.62) 0%,
      rgba(12, 10, 9, 0.42) 66%,
      rgba(12, 10, 9, 0.24) 100%
    );
    pointer-events: none;
    z-index: 1;
  }

  /* Search Input Bar Housing (rabbit-tv-search-input-bar-background.jpg) */
  .rabtv-srch-input-shell {
    position: relative;
    background-color: #0c0a09;
    overflow: hidden;
    contain: layout paint;
  }

  .rabtv-srch-input-bg {
    position: absolute;
    inset: 0;
    background-size: 100% 100%;
    background-position: center center;
    background-repeat: no-repeat;
    opacity: 0.94;
    filter: var(--rabtv-srch-plate-filter);
    pointer-events: none;
    z-index: 0;
  }

  .rabtv-srch-input-scrim {
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, rgba(12, 10, 9, 0.34) 0%, rgba(12, 10, 9, 0.52) 100%);
    pointer-events: none;
    z-index: 1;
  }

  /* Universal Image-Backed Armored Button */
  .rabtv-srch-img-btn {
    position: relative;
    overflow: hidden;
    background-color: #0c0a09;
    border: 0 !important;
    box-shadow: none !important;
    contain: layout paint;
    transition: transform 150ms ease, opacity 150ms ease;
  }

  .rabtv-srch-img-btn:hover:not(:disabled) {
    transform: scale(1.03);
  }

  .rabtv-srch-img-btn:active:not(:disabled) {
    transform: scale(0.97);
  }

  .rabtv-srch-img-btn-art {
    position: absolute;
    inset: 0;
    background-size: 100% 100%;
    background-position: center center;
    background-repeat: no-repeat;
    pointer-events: none;
    z-index: 0;
    transition: filter 160ms ease, transform 160ms ease;
    -webkit-mask-image: radial-gradient(
      ellipse 92% 84% at 50% 50%,
      rgba(12, 10, 9, 1) 72%,
      rgba(12, 10, 9, 0.62) 94%,
      transparent 100%
    );
    mask-image: radial-gradient(
      ellipse 92% 84% at 50% 50%,
      rgba(12, 10, 9, 1) 72%,
      rgba(12, 10, 9, 0.62) 94%,
      transparent 100%
    );
  }

  .rabtv-srch-img-btn-art--idle {
    opacity: 0.92;
    filter: var(--rabtv-srch-plate-filter) brightness(0.96);
  }

  .rabtv-srch-img-btn-art--active {
    opacity: 0.98;
    filter: saturate(1.08) brightness(1.05);
  }

  .rabtv-srch-img-btn-art--primary {
    opacity: 0.96;
    filter: var(--rabtv-srch-play-filter);
  }

  .rabtv-srch-img-btn-art--danger {
    opacity: 0.96;
    filter: saturate(1.12) brightness(1.02);
  }

  .rabtv-srch-img-btn:hover:not(:disabled) .rabtv-srch-img-btn-art {
    filter: brightness(1.12) saturate(1.12);
    transform: scale(1.02);
  }

  .rabtv-srch-img-btn-scrim {
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse 76% 68% at 50% 50%, rgba(12, 10, 9, 0.44) 0%, rgba(12, 10, 9, 0.16) 100%);
    pointer-events: none;
    z-index: 1;
  }

  .rabtv-srch-img-btn-label {
    position: relative;
    z-index: 2;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    min-width: 0;
    max-width: 100%;
    text-shadow: 0 1px 4px rgba(12, 10, 9, 0.96), 0 0 10px rgba(12, 10, 9, 0.85);
  }

  /* Custom Image-Backed Dropdown Trigger & Popover Menu Panel */
  .rabtv-srch-dd-trigger {
    position: relative;
    overflow: hidden;
    background-color: #0c0a09;
    border: 0 !important;
    contain: layout paint;
  }

  .rabtv-srch-dd-trigger-bg {
    position: absolute;
    inset: 0;
    background-size: 100% 100%;
    background-position: center center;
    background-repeat: no-repeat;
    opacity: 0.94;
    filter: var(--rabtv-srch-plate-filter);
    pointer-events: none;
    z-index: 0;
  }

  .rabtv-srch-dd-menu {
    position: absolute;
    left: 0;
    right: 0;
    top: calc(100% + 6px);
    z-index: 60;
    border-radius: 18px;
    overflow: hidden;
    background-color: #0c0a09;
    box-shadow: 0 18px 46px rgba(0, 0, 0, 0.92), 0 0 22px var(--rabtv-srch-ambient-ring);
  }

  .rabtv-srch-dd-menu-bg {
    position: absolute;
    inset: 0;
    background-size: 100% 100%;
    background-position: center center;
    background-repeat: no-repeat;
    opacity: 0.95;
    filter: var(--rabtv-srch-plate-filter);
    pointer-events: none;
    z-index: 0;
  }

  /* Panoramic Catalog & Section Banner (Male Rabbit at Computer Terminal on Right Flank) */
  .rabtv-srch-banner {
    position: relative;
    width: 100%;
    min-height: clamp(58px, 16vw, 88px);
    padding: 10px clamp(84px, 24%, 210px) 10px clamp(18px, 5%, 36px);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    border-radius: 20px;
    overflow: hidden;
    background-color: #0c0a09;
    contain: layout paint;
  }

  .rabtv-srch-banner-bg {
    position: absolute;
    inset: 0;
    background-size: 100% 100%;
    background-position: center center;
    background-repeat: no-repeat;
    opacity: 0.92;
    filter: var(--rabtv-srch-plate-filter);
    -webkit-mask-image: radial-gradient(
      ellipse 96% 90% at 50% 50%,
      rgba(12, 10, 9, 1) 74%,
      rgba(12, 10, 9, 0.72) 93%,
      rgba(12, 10, 9, 0.32) 100%
    );
    mask-image: radial-gradient(
      ellipse 96% 90% at 50% 50%,
      rgba(12, 10, 9, 1) 74%,
      rgba(12, 10, 9, 0.72) 93%,
      rgba(12, 10, 9, 0.32) 100%
    );
    pointer-events: none;
    z-index: 0;
  }

  .rabtv-srch-banner-scrim {
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, rgba(12, 10, 9, 0.54) 0%, rgba(12, 10, 9, 0.34) 64%, rgba(12, 10, 9, 0.08) 100%);
    pointer-events: none;
    z-index: 1;
  }
`;

// =============================================================================
// TYPES & CONFIGURATION
// =============================================================================
interface PersonMatch {
  id: number;
  name: string;
  profilePath: string | null;
  department: string;
}

interface PredictiveMatch {
  id: string;
  title: string;
  mediaType: "movie" | "tv" | "person";
  year?: string;
  rating?: string;
  posterUrl?: string;
}

type SortOption =
  | "popularity.desc"
  | "vote_average.desc"
  | "release_date.desc"
  | "vote_count.desc";

type ProviderOption = "all" | "8" | "119" | "337";

type PresetId =
  | "trending"
  | "masterpieces"
  | "new"
  | "90s"
  | "family"
  | "hiddenGems";

type MoodId =
  | "adrenaline"
  | "mindbender"
  | "chill"
  | "latenight"
  | "emotional"
  | "escapism";

interface MoodConfig {
  id: MoodId;
  label: string;
  genres: string[];
  minRating: number;
  sortBy: SortOption;
}

const MOOD_VIBES: MoodConfig[] = [
  {
    id: "adrenaline",
    label: "⚡ Adrenaline",
    genres: ["Action", "Thriller"],
    minRating: 6.8,
    sortBy: "popularity.desc",
  },
  {
    id: "mindbender",
    label: "🧠 Mind-Bender",
    genres: ["Sci-Fi", "Mystery"],
    minRating: 7.4,
    sortBy: "vote_average.desc",
  },
  {
    id: "chill",
    label: "😂 Chill & Laugh",
    genres: ["Comedy"],
    minRating: 6.5,
    sortBy: "popularity.desc",
  },
  {
    id: "latenight",
    label: "🌙 Late Night",
    genres: ["Horror", "Crime"],
    minRating: 6.5,
    sortBy: "popularity.desc",
  },
  {
    id: "emotional",
    label: "💔 Deep Drama",
    genres: ["Drama"],
    minRating: 7.6,
    sortBy: "vote_average.desc",
  },
  {
    id: "escapism",
    label: "🚀 Pure Escapism",
    genres: ["Fantasy", "Adventure"],
    minRating: 7.0,
    sortBy: "popularity.desc",
  },
];

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

const ratingOptions = [
  { value: "0", label: "⭐ Any Rating" },
  { value: "6", label: "⭐ 6.0 & Above" },
  { value: "7", label: "⭐ 7.0 & Above" },
  { value: "7.5", label: "⭐ 7.5 & Above" },
  { value: "8", label: "⭐ 8.0 & Above" },
  { value: "8.5", label: "⭐ 8.5 & Above" },
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

// =============================================================================
// SAFE STORAGE & BEHAVIOR HELPERS
// =============================================================================
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
      // ignore quota errors
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

function recordGenreAffinity(genre: string): Record<string, number> {
  if (typeof window === "undefined" || !genre || genre === "All") return {};
  try {
    const current: Record<string, number> = JSON.parse(
      localStorage.getItem(SMART_BEHAVIOR_KEY) || "{}"
    );
    current[genre] = (current[genre] || 0) + 1;
    localStorage.setItem(SMART_BEHAVIOR_KEY, JSON.stringify(current));
    return current;
  } catch {
    return {};
  }
}

function loadGenreAffinity(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(SMART_BEHAVIOR_KEY) || "{}");
  } catch {
    return {};
  }
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

// =============================================================================
// REUSABLE IMAGE-BACKED UI COMPONENTS
// =============================================================================
type ArmoredBtnVariant = "idle" | "active" | "primary" | "danger" | "home";

const ArmoredButton = memo(function ArmoredButton({
  variant = "idle",
  className = "",
  children,
  onClick,
  type = "button",
  disabled = false,
  title,
  ariaLabel,
  ariaPressed,
}: {
  variant?: ArmoredBtnVariant;
  className?: string;
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  type?: "button" | "submit";
  disabled?: boolean;
  title?: string;
  ariaLabel?: string;
  ariaPressed?: boolean;
}) {
  const bgUrl =
    variant === "home"
      ? IMG_BTN_HOME
      : variant === "primary"
        ? IMG_BTN_SUBMIT
        : variant === "active"
          ? IMG_BTN_FILTER_ACTIVE
          : variant === "danger"
            ? IMG_BTN_CLEAR_DANGER
            : IMG_BTN_FILTER_IDLE;

  const artMod =
    variant === "primary"
      ? "rabtv-srch-img-btn-art--primary"
      : variant === "active"
        ? "rabtv-srch-img-btn-art--active"
        : variant === "danger"
          ? "rabtv-srch-img-btn-art--danger"
          : "rabtv-srch-img-btn-art--idle";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      aria-pressed={ariaPressed}
      className={`rabtv-srch-img-btn rounded-xl text-white font-extrabold cursor-pointer disabled:opacity-40 disabled:pointer-events-none focus:outline-none focus:ring-2 focus:ring-cyan-400 ${className}`}
    >
      <span
        className={`rabtv-srch-img-btn-art ${artMod}`}
        aria-hidden="true"
        style={{ backgroundImage: `url(${bgUrl})` }}
      />
      <span className="rabtv-srch-img-btn-scrim" aria-hidden="true" />
      <span className="rabtv-srch-img-btn-label">{children}</span>
    </button>
  );
});

interface DropdownOption {
  value: string;
  label: string;
}

const ArmoredDropdown = memo(function ArmoredDropdown({
  label,
  value,
  options,
  onChange,
  disabled = false,
  isOpen,
  onToggle,
  onClose,
}: {
  label: string;
  value: string;
  options: DropdownOption[];
  onChange: (val: string) => void;
  disabled?: boolean;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value) || options[0];

  useEffect(() => {
    if (!isOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDocClick);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [isOpen, onClose]);

  return (
    <div ref={containerRef} className="relative min-w-0">
      <button
        type="button"
        disabled={disabled}
        onClick={onToggle}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className="rabtv-srch-dd-trigger w-full rounded-xl px-3 py-2 text-left flex items-center justify-between gap-2 cursor-pointer disabled:opacity-45 disabled:pointer-events-none focus:outline-none focus:ring-2 focus:ring-cyan-400 transition hover:brightness-110"
      >
        <span
          className="rabtv-srch-dd-trigger-bg"
          aria-hidden="true"
          style={{ backgroundImage: `url(${IMG_DROPDOWN_TRIGGER})` }}
        />
        <span className="relative z-10 flex flex-col min-w-0 pr-2">
          <span className="text-[9px] font-extrabold uppercase tracking-widest text-zinc-400 leading-none mb-0.5">
            {label}
          </span>
          <span className="text-xs font-extrabold text-white truncate drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]">
            {current?.label || ""}
          </span>
        </span>
        <span
          className={`relative z-10 w-6 text-center text-xs font-black text-cyan-300 shrink-0 transition-transform duration-150 ${
            isOpen ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        >
          ▾
        </span>
      </button>

      {isOpen && (
        <div role="listbox" className="rabtv-srch-dd-menu p-2">
          <div
            className="rabtv-srch-dd-menu-bg"
            aria-hidden="true"
            style={{ backgroundImage: `url(${IMG_DROPDOWN_MENU_PANEL})` }}
          />
          <div className="relative z-10 max-h-60 overflow-y-auto scrollbar-none space-y-1 p-1">
            {options.map((opt) => {
              const selected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onChange(opt.value);
                    onClose();
                  }}
                  className="rabtv-srch-img-btn w-full rounded-lg px-3 py-2 text-left text-xs font-bold text-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-400"
                >
                  <span
                    className={`rabtv-srch-img-btn-art ${
                      selected
                        ? "rabtv-srch-img-btn-art--active"
                        : "rabtv-srch-img-btn-art--idle"
                    }`}
                    aria-hidden="true"
                    style={{
                      backgroundImage: `url(${
                        selected ? IMG_BTN_FILTER_ACTIVE : IMG_BTN_FILTER_IDLE
                      })`,
                    }}
                  />
                  <span className="rabtv-srch-img-btn-scrim" aria-hidden="true" />
                  <span className="relative z-10 flex items-center justify-between gap-2 w-full">
                    <span className="truncate">{opt.label}</span>
                    {selected && (
                      <span className="text-[10px] font-black text-cyan-300 shrink-0">
                        ✓
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});

/**
 * Isolated Uncontrolled Search Input with:
 * - Android WebView IME caret protection
 * - Predictive Instant Suggestions dropdown (ArrowUp / ArrowDown / Enter / Esc)
 * - Voice Search (Web Speech API ready) + Visual Search readiness trigger
 * - `/` keyboard shortcut to focus
 */
const SearchInputDeck = memo(function SearchInputDeck({
  syncedQuery,
  largeButtons,
  onSubmitQuery,
  onClearQuery,
  onSelectPrediction,
  onFocusChange,
  onNotice,
}: {
  syncedQuery: string;
  largeButtons: boolean;
  onSubmitQuery: (raw: string) => void;
  onClearQuery: () => void;
  onSelectPrediction: (match: PredictiveMatch) => void;
  onFocusChange: (engaged: boolean) => void;
  onNotice: (msg: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [hasValue, setHasValue] = useState<boolean>(Boolean(syncedQuery));
  const [liveTerm, setLiveTerm] = useState<string>(syncedQuery);
  const [predictions, setPredictions] = useState<PredictiveMatch[]>([]);
  const [showPredictions, setShowPredictions] = useState<boolean>(false);
  const [highlightIdx, setHighlightIdx] = useState<number>(-1);
  const [isListening, setIsListening] = useState<boolean>(false);

  useEffect(() => {
    const el = inputRef.current;
    if (el && el.value !== syncedQuery && document.activeElement !== el) {
      el.value = syncedQuery;
    }
    setHasValue(Boolean(syncedQuery));
    setLiveTerm(syncedQuery);
  }, [syncedQuery]);

  // Global `/` shortcut to jump directly into search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (
        e.key === "/" &&
        tag !== "input" &&
        tag !== "textarea" &&
        tag !== "select"
      ) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Debounced Predictive Search (TMDB multi-search)
  useEffect(() => {
    const clean = sanitizeQuery(liveTerm);
    if (clean.length < 2 || !TMDB_API_KEY) {
      setPredictions([]);
      setHighlightIdx(-1);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `${TMDB_BASE_URL}search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(
            clean
          )}&include_adult=false&page=1`,
          { signal: controller.signal }
        );
        if (!res.ok) return;
        const data = await res.json();
        const items = (data.results || []).slice(0, 6).map((r: any) => ({
          id: String(r.id),
          title: String(r.title || r.name || ""),
          mediaType:
            r.media_type === "tv" || r.media_type === "person"
              ? r.media_type
              : "movie",
          year: String(r.release_date || r.first_air_date || "").split("-")[0],
          rating:
            typeof r.vote_average === "number" && r.vote_average > 0
              ? r.vote_average.toFixed(1)
              : undefined,
          posterUrl: r.poster_path
            ? `https://image.tmdb.org/t/p/w92${r.poster_path}`
            : r.profile_path
              ? `https://image.tmdb.org/t/p/w92${r.profile_path}`
              : undefined,
        }));
        setPredictions(items.filter((x: PredictiveMatch) => Boolean(x.title)));
        setHighlightIdx(-1);
      } catch {
        // ignore aborts
      }
    }, PREDICTIVE_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [liveTerm]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = inputRef.current?.value || "";
    setShowPredictions(false);
    onSubmitQuery(raw);
    inputRef.current?.blur();
  };

  const handleClear = () => {
    if (inputRef.current) {
      inputRef.current.value = "";
      inputRef.current.focus();
    }
    setHasValue(false);
    setLiveTerm("");
    setPredictions([]);
    setShowPredictions(false);
    onClearQuery();
  };

  const handleVoiceSearch = () => {
    const SpeechRec =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      onNotice("🎙️ Voice search ready — browser speech API unavailable on this device.");
      return;
    }
    try {
      const recognition = new SpeechRec();
      recognition.lang = "en-US";
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      setIsListening(true);
      recognition.onresult = (event: any) => {
        const transcript = sanitizeQuery(
          event?.results?.[0]?.[0]?.transcript || ""
        );
        setIsListening(false);
        if (transcript) {
          if (inputRef.current) inputRef.current.value = transcript;
          setHasValue(true);
          setLiveTerm(transcript);
          onSubmitQuery(transcript);
        }
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);
      recognition.start();
    } catch {
      setIsListening(false);
      onNotice("🎙️ Voice search could not start — check microphone permissions.");
    }
  };

  const handleVisualSearchReady = () => {
    onNotice("📷 Visual poster & scene scanner ready — camera input module coming soon.");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showPredictions || predictions.length === 0) {
      if (e.key === "Escape") inputRef.current?.blur();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIdx((i) => (i + 1) % predictions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx((i) => (i <= 0 ? predictions.length - 1 : i - 1));
    } else if (e.key === "Enter" && highlightIdx >= 0) {
      e.preventDefault();
      const chosen = predictions[highlightIdx];
      setShowPredictions(false);
      onSelectPrediction(chosen);
    } else if (e.key === "Escape") {
      setShowPredictions(false);
      inputRef.current?.blur();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="relative w-full space-y-2.5">
      <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center w-full">
        {/* Armored Search Input Bar */}
        <div className="rabtv-srch-input-shell relative flex-1 min-w-0 rounded-2xl">
          <div
            className="rabtv-srch-input-bg"
            aria-hidden="true"
            style={{ backgroundImage: `url(${IMG_INPUT_BAR_BG})` }}
          />
          <div className="rabtv-srch-input-scrim" aria-hidden="true" />

          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 z-10 text-xs sm:text-sm pointer-events-none text-cyan-300">
            🔍
          </span>

          <input
            ref={inputRef}
            type="search"
            dir="ltr"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="search"
            defaultValue={syncedQuery}
            data-tour="global-search-input"
            onFocus={() => {
              onFocusChange(true);
              if (predictions.length > 0) setShowPredictions(true);
            }}
            onBlur={() => {
              onFocusChange(false);
              window.setTimeout(() => setShowPredictions(false), 180);
            }}
            onKeyDown={handleKeyDown}
            onInput={(e) => {
              const val = (e.target as HTMLInputElement).value;
              setHasValue(Boolean(val));
              setLiveTerm(val);
              setShowPredictions(val.trim().length >= 2);
            }}
            placeholder="Search movies, TV, actors... (Press /)"
            style={{
              direction: "ltr",
              unicodeBidi: "plaintext",
              textAlign: "left",
            }}
            className="relative z-10 w-full bg-transparent pl-10 pr-24 py-3.5 text-xs sm:text-sm font-bold text-white placeholder-zinc-400 focus:outline-none"
          />

          {/* Inline Voice + Visual Search + Clear Triggers */}
          <div className="absolute right-2 top-1/2 -translate-y-1/2 z-20 flex items-center gap-1">
            {hasValue && (
              <ArmoredButton
                variant="danger"
                onClick={handleClear}
                ariaLabel="Clear search"
                title="Clear search"
                className="h-7 w-7 rounded-lg text-[10px]"
              >
                ✕
              </ArmoredButton>
            )}
            <ArmoredButton
              variant={isListening ? "active" : "idle"}
              onClick={handleVoiceSearch}
              ariaLabel="Voice search"
              title="Voice Search"
              className="h-7 w-7 rounded-lg text-xs"
            >
              🎙️
            </ArmoredButton>
            <ArmoredButton
              variant="idle"
              onClick={handleVisualSearchReady}
              ariaLabel="Visual search"
              title="Visual Search (Ready)"
              className="h-7 w-7 rounded-lg text-xs"
            >
              📷
            </ArmoredButton>
          </div>
        </div>

        {/* Primary Search Submit Image Button */}
        <ArmoredButton
          type="submit"
          variant="primary"
          ariaLabel="Search and Filter"
          title="Search & Filter"
          className={`self-center sm:self-stretch px-7 ${
            largeButtons ? "py-3.5 text-sm" : "py-3 text-xs sm:text-sm"
          } uppercase tracking-wider shrink-0`}
        >
          <span>Search</span>
        </ArmoredButton>
      </div>

      {/* Predictive Instant Suggestions Popover */}
      {showPredictions && predictions.length > 0 && (
        <div className="rabtv-srch-dd-menu p-2">
          <div
            className="rabtv-srch-dd-menu-bg"
            aria-hidden="true"
            style={{ backgroundImage: `url(${IMG_DROPDOWN_MENU_PANEL})` }}
          />
          <div className="relative z-10 space-y-1 p-1">
            <div className="px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-widest text-cyan-300/90">
              ⚡ Instant Matches
            </div>
            {predictions.map((p, idx) => (
              <button
                key={`${p.mediaType}-${p.id}`}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setShowPredictions(false);
                  onSelectPrediction(p);
                }}
                className="rabtv-srch-img-btn w-full rounded-xl px-2.5 py-2 text-left text-white cursor-pointer"
              >
                <span
                  className={`rabtv-srch-img-btn-art ${
                    idx === highlightIdx
                      ? "rabtv-srch-img-btn-art--active"
                      : "rabtv-srch-img-btn-art--idle"
                  }`}
                  aria-hidden="true"
                  style={{
                    backgroundImage: `url(${
                      idx === highlightIdx
                        ? IMG_BTN_FILTER_ACTIVE
                        : IMG_BTN_FILTER_IDLE
                    })`,
                  }}
                />
                <span className="rabtv-srch-img-btn-scrim" aria-hidden="true" />
                <span className="relative z-10 flex items-center justify-between gap-2 w-full">
                  <span className="flex items-center gap-2 min-w-0">
                    {p.posterUrl ? (
                      <img
                        src={p.posterUrl}
                        alt=""
                        loading="lazy"
                        className="h-8 w-6 rounded object-cover shrink-0 border border-white/15"
                      />
                    ) : (
                      <span className="text-sm shrink-0">
                        {p.mediaType === "person" ? "🎭" : "🎬"}
                      </span>
                    )}
                    <span className="text-xs font-extrabold truncate">
                      {p.title}
                    </span>
                  </span>
                  <span className="text-[10px] font-bold text-zinc-300 shrink-0">
                    {p.mediaType.toUpperCase()}
                    {p.year ? ` • ${p.year}` : ""}
                    {p.rating ? ` • ★${p.rating}` : ""}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </form>
  );
});

// =============================================================================
// ROUTE & MAIN SEARCH PAGE
// =============================================================================
export const Route = createFileRoute("/search")({
  component: SearchPage,
  validateSearch: (search: Record<string, unknown>) => ({
    q: (search.q as string) || "",
  }),
});

function SearchPage() {
  const navigate = useNavigate();
  const searchParams = Route.useSearch();
  const genreScrollRef = useRef<HTMLDivElement>(null);

  // Filter States (Multi-Select Genres + Mood + Presets + 5 Custom Dropdowns)
  const activeUrlQuery = sanitizeQuery(searchParams.q || "");
  const [mediaType, setMediaType] = useState<"all" | "movie" | "tv">("all");
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [minRating, setMinRating] = useState<number>(0);
  const [selectedLangIndex, setSelectedLangIndex] = useState<number>(0);
  const [selectedProvider, setSelectedProvider] = useState<ProviderOption>("all");
  const [sortBy, setSortBy] = useState<SortOption>("popularity.desc");
  const [hiddenGemsMode, setHiddenGemsMode] = useState<boolean>(false);
  const [activePreset, setActivePreset] = useState<PresetId | null>("trending");
  const [activeMood, setActiveMood] = useState<MoodId | null>(null);
  const [selectedPerson, setSelectedPerson] = useState<PersonMatch | null>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [isEngaged, setIsEngaged] = useState<boolean>(false);
  const [toastNotice, setToastNotice] = useState<string | null>(null);

  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [recentSearches, setRecentSearches] = useState<string[]>(() =>
    loadRecentSearches()
  );
  const [genreAffinity, setGenreAffinity] = useState<Record<string, number>>(
    () => loadGenreAffinity()
  );
  const [retryTick, setRetryTick] = useState<number>(0);

  // Results States
  const [results, setResults] = useState<MediaItem[]>([]);
  const [matchedPeople, setMatchedPeople] = useState<PersonMatch[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Live Settings
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

  const showNotice = useCallback((msg: string) => {
    setToastNotice(msg);
    window.setTimeout(() => setToastNotice(null), 3200);
  }, []);

  useEffect(() => {
    if (activeUrlQuery.length >= 2) {
      setRecentSearches(saveRecentSearch(activeUrlQuery));
    }
    setSelectedPerson(null);
    setPage(1);
  }, [activeUrlQuery]);

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

  useEffect(() => {
    setPage(1);
  }, [
    mediaType,
    selectedGenres,
    selectedYear,
    minRating,
    selectedLangIndex,
    selectedProvider,
    sortBy,
    hiddenGemsMode,
    selectedPerson,
  ]);

  // Cross-search Live TV channels
  const matchingLiveChannels = useMemo<LiveChannel[]>(() => {
    if (activeUrlQuery.length < 2 || selectedPerson) return [];
    const found = searchLiveChannels(activeUrlQuery);
    const kidsActive = kidsLocked || userAge < 13;
    return found
      .filter((ch) => {
        if (!kidsActive) return true;
        const lower = ch.title.toLowerCase();
        return !MATURE_LIVE_KEYWORDS.some((kw) => lower.includes(kw));
      })
      .slice(0, 6);
  }, [activeUrlQuery, selectedPerson, kidsLocked, userAge]);

  // Auto-built Smart Collection based on user's top explored genres
  const smartTopGenres = useMemo(() => {
    return Object.entries(genreAffinity)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([g]) => g);
  }, [genreAffinity]);

  // Main TMDB Search / Person Credits / Discover Fetcher
  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(
      () => controller.abort(),
      FETCH_TIMEOUT_MS
    );
    let active = true;

    async function fetchJson(url: string) {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`TMDB returned HTTP ${res.status}`);
      return res.json();
    }

    async function fetchFilteredCatalog() {
      setLoading(true);
      setError(null);

      try {
        const activeLangConfig = languageFilters[selectedLangIndex];

        // 1. PERSON FILMOGRAPHY MODE
        if (selectedPerson) {
          const url = new URL(
            `person/${selectedPerson.id}/combined_credits`,
            TMDB_BASE_URL
          );
          if (TMDB_API_KEY) url.searchParams.set("api_key", TMDB_API_KEY);
          const data = await fetchJson(url.toString());
          if (!active) return;

          const mergedRaw = [
            ...(Array.isArray(data.cast) ? data.cast : []),
            ...(Array.isArray(data.crew) ? data.crew : []),
          ] as Record<string, unknown>[];

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

          credits.sort((a, b) =>
            sortBy === "release_date.desc"
              ? (b.year || "").localeCompare(a.year || "")
              : Number(b.rating || 0) - Number(a.rating || 0)
          );

          setResults(credits.slice(0, 60));
          setTotalPages(1);
          setLoading(false);
          return;
        }

        // 2. KEYWORD SEARCH MODE
        if (activeUrlQuery) {
          const endpoint =
            mediaType === "movie"
              ? "search/movie"
              : mediaType === "tv"
                ? "search/tv"
                : "search/multi";

          const urlParams = new URLSearchParams();
          if (TMDB_API_KEY) urlParams.set("api_key", TMDB_API_KEY);
          urlParams.set("query", activeUrlQuery);
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
            if (selectedGenres.length > 0) {
              const targetIds = selectedGenres
                .map((g) =>
                  itemObj.mediaType === "tv"
                    ? GENRE_ID_PAIRS[g]?.tv
                    : GENRE_ID_PAIRS[g]?.movie
                )
                .filter((id): id is number => Boolean(id));
              if (
                targetIds.length > 0 &&
                !targetIds.some((id) => (itemObj.genreIds || []).includes(id))
              ) {
                continue;
              }
            }

            mapped.push(itemObj);
          }

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

        // 3. PURE DISCOVER FILTER MODE (Supports Multi-Select Genres!)
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

          if (hiddenGemsMode) {
            p.set("vote_count.gte", "80");
            p.set("vote_count.lte", "1800");
            p.set("vote_average.gte", String(Math.max(minRating, 7.4)));
          } else if (sortBy === "vote_average.desc") {
            p.set("vote_count.gte", "150");
          }

          if (selectedGenres.length > 0) {
            const ids = Array.from(
              new Set(
                selectedGenres
                  .map((g) =>
                    targetType === "tv"
                      ? GENRE_ID_PAIRS[g]?.tv
                      : GENRE_ID_PAIRS[g]?.movie
                  )
                  .filter((id): id is number => Boolean(id))
              )
            );
            if (ids.length > 0) {
              p.set("with_genres", ids.join(","));
            }
          }

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
          const data = await fetchJson(
            `${TMDB_BASE_URL}discover/${mediaType}?${buildDiscoverParams(
              mediaType
            ).toString()}`
          );
          if (!active) return;

          const mapped = ((data.results || []) as Record<string, unknown>[])
            .map((item) => mapRawItem(item, mediaType, posterWidth))
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
    activeUrlQuery,
    mediaType,
    selectedGenres,
    selectedYear,
    minRating,
    selectedLangIndex,
    selectedProvider,
    sortBy,
    hiddenGemsMode,
    selectedPerson,
    page,
    posterWidth,
    retryTick,
  ]);

  const filteredResults = useMemo(() => {
    return results.filter((item) => {
      if (isTitleDisliked(item.id) || isTitleBroken(item.id)) return false;
      return isAllowedForAge(item.certification, item.genre, userAge);
    });
  }, [results, userAge, kidsLocked]);

  const handleSearchSubmitQuery = useCallback(
    (raw: string) => {
      const clean = sanitizeQuery(raw);
      setSelectedPerson(null);
      if (clean) {
        setActivePreset(null);
        setActiveMood(null);
      }
      if (clean.length >= 2) {
        setRecentSearches(saveRecentSearch(clean));
      }
      navigate({ to: "/search", search: { q: clean } });
    },
    [navigate]
  );

  const handleClearSearchQuery = useCallback(() => {
    setSelectedPerson(null);
    navigate({ to: "/search", search: { q: "" } });
  }, [navigate]);

  const handleSelectPrediction = useCallback(
    (match: PredictiveMatch) => {
      if (match.mediaType === "person") {
        setSelectedPerson({
          id: Number(match.id),
          name: match.title,
          profilePath: null,
          department: "Talent",
        });
        return;
      }
      navigate({
        to: "/details",
        search: { id: match.id, type: match.mediaType },
      });
    },
    [navigate]
  );

  const applyDiscoveryPreset = useCallback(
    (preset: PresetId) => {
      setSelectedPerson(null);
      setActivePreset(preset);
      setActiveMood(null);
      navigate({ to: "/search", search: { q: "" } });
      setSelectedLangIndex(0);
      setSelectedProvider("all");
      setMediaType("all");
      setHiddenGemsMode(false);

      if (preset === "trending") {
        setSelectedGenres([]);
        setSelectedYear("");
        setMinRating(0);
        setSortBy("popularity.desc");
      } else if (preset === "masterpieces") {
        setSelectedGenres([]);
        setSelectedYear("");
        setMinRating(8);
        setSortBy("vote_average.desc");
      } else if (preset === "new") {
        setSelectedGenres([]);
        setSelectedYear("recent-2yr");
        setMinRating(6);
        setSortBy("popularity.desc");
      } else if (preset === "90s") {
        setSelectedGenres([]);
        setSelectedYear("decade:1990");
        setMinRating(7);
        setSortBy("vote_average.desc");
      } else if (preset === "family") {
        setSelectedGenres(["Family"]);
        setSelectedYear("");
        setMinRating(6.5);
        setSortBy("popularity.desc");
      } else if (preset === "hiddenGems") {
        setSelectedGenres([]);
        setSelectedYear("");
        setMinRating(7.5);
        setSortBy("vote_average.desc");
        setHiddenGemsMode(true);
      }
    },
    [navigate]
  );

  const applyMoodVibe = useCallback(
    (mood: MoodConfig) => {
      setSelectedPerson(null);
      setActivePreset(null);
      setActiveMood(mood.id);
      setHiddenGemsMode(false);
      navigate({ to: "/search", search: { q: "" } });
      setSelectedGenres(mood.genres);
      setMinRating(mood.minRating);
      setSortBy(mood.sortBy);
      mood.genres.forEach((g) => setGenreAffinity(recordGenreAffinity(g)));
    },
    [navigate]
  );

  const toggleGenre = useCallback((genre: string) => {
    setHiddenGemsMode(false);
    setActivePreset(null);
    setActiveMood(null);
    if (genre === "All") {
      setSelectedGenres([]);
      return;
    }
    setGenreAffinity(recordGenreAffinity(genre));
    setSelectedGenres((prev) =>
      prev.includes(genre)
        ? prev.filter((g) => g !== genre)
        : [...prev, genre].slice(-3)
    );
  }, []);

  const hasActiveFilters =
    Boolean(activeUrlQuery) ||
    mediaType !== "all" ||
    selectedGenres.length > 0 ||
    selectedYear !== "" ||
    minRating > 0 ||
    selectedLangIndex !== 0 ||
    selectedProvider !== "all" ||
    sortBy !== "popularity.desc" ||
    hiddenGemsMode ||
    Boolean(selectedPerson);

  const resetAllFilters = () => {
    setMediaType("all");
    setSelectedGenres([]);
    setSelectedYear("");
    setMinRating(0);
    setSelectedLangIndex(0);
    setSelectedProvider("all");
    setSortBy("popularity.desc");
    setHiddenGemsMode(false);
    setActivePreset("trending");
    setActiveMood(null);
    setSelectedPerson(null);
    setPage(1);
    navigate({ to: "/search", search: { q: "" } });
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

  const yearOptions = useMemo<DropdownOption[]>(() => {
    const opts: DropdownOption[] = [
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

  const languageDropdownOptions = useMemo<DropdownOption[]>(
    () => languageFilters.map((lf, idx) => ({ value: String(idx), label: lf.label })),
    []
  );

  const providerDropdownOptions = useMemo<DropdownOption[]>(
    () => providerFilters.map((pf) => ({ value: pf.id, label: pf.label })),
    []
  );

  const sortDropdownOptions = useMemo<DropdownOption[]>(
    () => sortOptions.map((o) => ({ value: o.id, label: o.label })),
    []
  );

  return (
    <main
      data-tour="search-page"
      className="min-h-screen bg-gradient-to-br from-[#0c0a09]/85 via-black/75 to-[#0c0a09]/90 text-zinc-100 px-2.5 sm:px-6 py-4 sm:py-5 pb-16 flex flex-col items-center relative rounded-3xl overflow-x-clip"
    >
      <style>{SEARCH_PAGE_STYLES}</style>
      <AppWallpaper />

      <div className="mx-auto max-w-7xl w-full space-y-5 sm:space-y-6 relative z-10 min-w-0">
        {/* TOP UTILITY ROW: Back to Home Only (Surprise Me Removed) + Reset All Filters */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 w-full">
          <Link to="/" data-tour="back-to-home" className="inline-block">
            <ArmoredButton
              variant="home"
              ariaLabel="Back to Home"
              title="Back to Home"
              className="px-5 py-2.5 text-xs sm:text-sm uppercase tracking-wider"
            >
              <span>← Back to Home</span>
            </ArmoredButton>
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            {kidsLocked && (
              <span className="rounded-full bg-emerald-500/20 border border-emerald-400/40 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-emerald-300">
                🧒 Kids Safe Mode
              </span>
            )}
            {hasActiveFilters && (
              <ArmoredButton
                variant="danger"
                onClick={resetAllFilters}
                className="px-4 py-2 text-xs uppercase tracking-wider"
              >
                <span>✕ Reset All Filters</span>
              </ArmoredButton>
            )}
          </div>
        </div>

        {toastNotice && (
          <div className="rounded-2xl border border-cyan-400/40 bg-black/85 px-4 py-2 text-center text-xs font-extrabold text-cyan-200 shadow-lg">
            {toastNotice}
          </div>
        )}

        {/* MAIN SEARCH & DISCOVERY CONTROL DECK (Female Rabbit Detective in Bottom-Right) */}
        <div
          className={`rabtv-srch-deck rounded-3xl border border-white/10 p-4 sm:p-6 ${
            isEngaged && !glowOff ? "rabtv-srch-deck--engaged" : ""
          }`}
        >
          <div
            className="rabtv-srch-deck-bg"
            aria-hidden="true"
            style={{ backgroundImage: `url(${IMG_DECK_PANEL_BG})` }}
          />
          <div className="rabtv-srch-deck-scrim" aria-hidden="true" />

          <div className="relative z-10 space-y-4">
            {/* Search Input Bar + Predictive Suggestions + Voice/Visual Readiness */}
            <SearchInputDeck
              syncedQuery={activeUrlQuery}
              largeButtons={largeButtons}
              onSubmitQuery={handleSearchSubmitQuery}
              onClearQuery={handleClearSearchQuery}
              onSelectPrediction={handleSelectPrediction}
              onFocusChange={setIsEngaged}
              onNotice={showNotice}
            />

            {/* 6 Curated Discovery Presets (Every Preset Uses Image Plates) */}
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-0.5">
              {(
                [
                  { id: "trending", label: "🔥 Trending Hits" },
                  {
                    id: "masterpieces",
                    label: `⭐ ${
                      activePreset === "masterpieces" && minRating > 0
                        ? minRating
                        : 8
                    }+ Masterpieces`,
                  },
                  { id: "new", label: "🆕 2025–2026 New" },
                  { id: "90s", label: "📼 90s Classics" },
                  { id: "family", label: "👨‍👩‍👧 Family Night" },
                  { id: "hiddenGems", label: "💎 Hidden Gems" },
                ] as const
              ).map((preset) => (
                <ArmoredButton
                  key={preset.id}
                  variant={activePreset === preset.id ? "active" : "idle"}
                  ariaPressed={activePreset === preset.id}
                  onClick={() => applyDiscoveryPreset(preset.id)}
                  className="shrink-0 px-3.5 py-2 text-[11px] whitespace-nowrap"
                >
                  {preset.label}
                </ArmoredButton>
              ))}
            </div>

            {/* Contextual Mood / Vibe Selector + Auto-Built Smart Collection */}
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-400 shrink-0 mr-1">
                Vibe:
              </span>
              {MOOD_VIBES.map((mood) => (
                <ArmoredButton
                  key={mood.id}
                  variant={activeMood === mood.id ? "active" : "idle"}
                  ariaPressed={activeMood === mood.id}
                  onClick={() => applyMoodVibe(mood)}
                  className="shrink-0 px-3 py-1.5 text-[11px] whitespace-nowrap"
                >
                  {mood.label}
                </ArmoredButton>
              ))}
              {smartTopGenres.length > 0 && (
                <ArmoredButton
                  variant="active"
                  onClick={() => {
                    setSelectedGenres(smartTopGenres);
                    setActivePreset(null);
                    setActiveMood(null);
                  }}
                  className="shrink-0 px-3 py-1.5 text-[11px] whitespace-nowrap"
                  title="Auto-built from your search history"
                >
                  ✨ For You: {smartTopGenres.join(" + ")}
                </ArmoredButton>
              )}
            </div>

            {/* Recent Search History Chips */}
            {recentSearches.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 mr-1">
                  🕒 Recent:
                </span>
                {recentSearches.map((term) => (
                  <div key={term} className="inline-flex items-center gap-1">
                    <ArmoredButton
                      variant="idle"
                      onClick={() => handleSearchSubmitQuery(term)}
                      className="px-3 py-1 text-[11px]"
                    >
                      {term}
                    </ArmoredButton>
                    <ArmoredButton
                      variant="danger"
                      onClick={() =>
                        setRecentSearches(removeRecentSearch(term))
                      }
                      ariaLabel={`Remove ${term}`}
                      className="h-6 w-6 text-[10px]"
                    >
                      ✕
                    </ArmoredButton>
                  </div>
                ))}
                <ArmoredButton
                  variant="danger"
                  onClick={() => setRecentSearches(clearAllRecentSearches())}
                  className="px-2.5 py-1 text-[10px] ml-1"
                >
                  Clear
                </ArmoredButton>
              </div>
            )}

            {/* Active Person Filmography Banner */}
            {selectedPerson && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-cyan-400/35 bg-black/70 px-3.5 py-2">
                <span className="text-xs font-extrabold truncate">
                  🎭 Viewing full filmography for{" "}
                  <strong className="text-cyan-300">{selectedPerson.name}</strong>
                </span>
                <ArmoredButton
                  variant="danger"
                  onClick={() => setSelectedPerson(null)}
                  className="px-3 py-1 text-[10px]"
                >
                  ✕ Back to Search
                </ArmoredButton>
              </div>
            )}

            {/* 6-SLOT PRECISION FILTER MATRIX (Media Type Tabs + 5 Image-Based Custom Dropdowns) */}
            <div
              data-tour="search-filters"
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-3 border-t border-white/10"
            >
              {/* 1. Media Type Segmented Tabs (ALL / MOVIES / TV) */}
              <div
                data-tour="search-tabs"
                className="grid grid-cols-3 gap-1.5 items-center"
              >
                {(["all", "movie", "tv"] as const).map((t) => (
                  <ArmoredButton
                    key={t}
                    variant={mediaType === t ? "active" : "idle"}
                    ariaPressed={mediaType === t}
                    onClick={() => setMediaType(t)}
                    className="py-2.5 text-xs uppercase tracking-wider"
                  >
                    {t === "all" ? "All" : t === "movie" ? "Movies" : "TV"}
                  </ArmoredButton>
                ))}
              </div>

              {/* 2. Sort By Dropdown */}
              <ArmoredDropdown
                label="Sort By"
                value={sortBy}
                options={sortDropdownOptions}
                onChange={(v) => {
                  setSortBy(v as SortOption);
                  setActivePreset(null);
                }}
                isOpen={openDropdown === "sort"}
                onToggle={() =>
                  setOpenDropdown((d) => (d === "sort" ? null : "sort"))
                }
                onClose={() => setOpenDropdown(null)}
              />

              {/* 3. Streaming Service Dropdown */}
              <ArmoredDropdown
                label="Streaming Service"
                value={selectedProvider}
                options={providerDropdownOptions}
                disabled={Boolean(activeUrlQuery) || Boolean(selectedPerson)}
                onChange={(v) => setSelectedProvider(v as ProviderOption)}
                isOpen={openDropdown === "provider"}
                onToggle={() =>
                  setOpenDropdown((d) => (d === "provider" ? null : "provider"))
                }
                onClose={() => setOpenDropdown(null)}
              />

              {/* 4. Language / Region Dropdown */}
              <ArmoredDropdown
                label="Language / Region"
                value={String(selectedLangIndex)}
                options={languageDropdownOptions}
                onChange={(v) => setSelectedLangIndex(Number(v))}
                isOpen={openDropdown === "lang"}
                onToggle={() =>
                  setOpenDropdown((d) => (d === "lang" ? null : "lang"))
                }
                onClose={() => setOpenDropdown(null)}
              />

              {/* 5. Year / Era Dropdown */}
              <ArmoredDropdown
                label="Year / Era"
                value={selectedYear}
                options={yearOptions}
                onChange={(v) => {
                  setSelectedYear(v);
                  setActivePreset(null);
                }}
                isOpen={openDropdown === "year"}
                onToggle={() =>
                  setOpenDropdown((d) => (d === "year" ? null : "year"))
                }
                onClose={() => setOpenDropdown(null)}
              />

              {/* 6. Minimum Rating Dropdown */}
              <ArmoredDropdown
                label="Minimum Rating"
                value={String(minRating)}
                options={ratingOptions}
                onChange={(v) => {
                  const num = Number(v);
                  setMinRating(num);
                  if (num < 7) setActivePreset(null);
                }}
                isOpen={openDropdown === "rating"}
                onToggle={() =>
                  setOpenDropdown((d) => (d === "rating" ? null : "rating"))
                }
                onClose={() => setOpenDropdown(null)}
              />
            </div>

            {/* MULTI-SELECT GENRE FILTER BAR (Every Genre Pill Is an Image Button) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2 px-1">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-400">
                  Genre Filter (Multi-Select up to 3):
                </span>
                {!loading && filteredResults.length > 0 && (
                  <span className="rounded-full bg-black/75 border border-cyan-400/35 px-2.5 py-0.5 text-[10px] font-extrabold text-cyan-200">
                    {filteredResults.length} matches
                    {totalPages > 1 && !selectedPerson
                      ? ` • Pg ${page}/${totalPages}`
                      : ""}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <ArmoredButton
                  variant="idle"
                  ariaLabel="Scroll genres left"
                  onClick={() =>
                    genreScrollRef.current?.scrollBy({
                      left: -220,
                      behavior: reducedMotion ? "auto" : "smooth",
                    })
                  }
                  className="h-8 w-8 shrink-0 text-xs"
                >
                  ‹
                </ArmoredButton>

                <div
                  ref={genreScrollRef}
                  className="flex-1 min-w-0 flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5"
                >
                  <ArmoredButton
                    variant={selectedGenres.length === 0 ? "active" : "idle"}
                    ariaPressed={selectedGenres.length === 0}
                    onClick={() => toggleGenre("All")}
                    className="shrink-0 px-3.5 py-1.5 text-xs whitespace-nowrap"
                  >
                    ✨ All Genres
                  </ArmoredButton>
                  {Object.keys(GENRE_ID_PAIRS).map((g) => {
                    const active = selectedGenres.includes(g);
                    return (
                      <ArmoredButton
                        key={g}
                        variant={active ? "active" : "idle"}
                        ariaPressed={active}
                        onClick={() => toggleGenre(g)}
                        className="shrink-0 px-3.5 py-1.5 text-xs whitespace-nowrap"
                      >
                        {g}
                      </ArmoredButton>
                    );
                  })}
                </div>

                <ArmoredButton
                  variant="idle"
                  ariaLabel="Scroll genres right"
                  onClick={() =>
                    genreScrollRef.current?.scrollBy({
                      left: 220,
                      behavior: reducedMotion ? "auto" : "smooth",
                    })
                  }
                  className="h-8 w-8 shrink-0 text-xs"
                >
                  ›
                </ArmoredButton>
              </div>
            </div>

            {/* QUICK-CLEAR ACTIVE FILTER CHIPS */}
            {hasActiveFilters && (
              <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-white/10">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 mr-1">
                  Active:
                </span>
                {mediaType !== "all" && (
                  <ArmoredButton
                    variant="danger"
                    onClick={() => setMediaType("all")}
                    className="px-2.5 py-1 text-[10px]"
                  >
                    {mediaType === "movie" ? "🎬 Movies" : "📺 TV"} ✕
                  </ArmoredButton>
                )}
                {selectedGenres.map((g) => (
                  <ArmoredButton
                    key={g}
                    variant="danger"
                    onClick={() => toggleGenre(g)}
                    className="px-2.5 py-1 text-[10px]"
                  >
                    {g} ✕
                  </ArmoredButton>
                ))}
                {selectedYear !== "" && (
                  <ArmoredButton
                    variant="danger"
                    onClick={() => setSelectedYear("")}
                    className="px-2.5 py-1 text-[10px]"
                  >
                    {selectedYear.replace("decade:", "")} ✕
                  </ArmoredButton>
                )}
                {minRating > 0 && (
                  <ArmoredButton
                    variant="danger"
                    onClick={() => setMinRating(0)}
                    className="px-2.5 py-1 text-[10px]"
                  >
                    ★ {minRating}+ ✕
                  </ArmoredButton>
                )}
                {selectedLangIndex !== 0 && (
                  <ArmoredButton
                    variant="danger"
                    onClick={() => setSelectedLangIndex(0)}
                    className="px-2.5 py-1 text-[10px]"
                  >
                    {languageFilters[selectedLangIndex]?.label} ✕
                  </ArmoredButton>
                )}
                {selectedProvider !== "all" && (
                  <ArmoredButton
                    variant="danger"
                    onClick={() => setSelectedProvider("all")}
                    className="px-2.5 py-1 text-[10px]"
                  >
                    {
                      providerFilters.find((p) => p.id === selectedProvider)
                        ?.label
                    }{" "}
                    ✕
                  </ArmoredButton>
                )}
              </div>
            )}
          </div>
        </div>

        {/* MATCHING LIVE TV CHANNELS SHELF */}
        {matchingLiveChannels.length > 0 && (
          <section className="space-y-3">
            <div className="rabtv-srch-banner">
              <div
                className="rabtv-srch-banner-bg"
                aria-hidden="true"
                style={{ backgroundImage: `url(${IMG_CATALOG_BANNER_BG})` }}
              />
              <div className="rabtv-srch-banner-scrim" aria-hidden="true" />
              <h3 className="relative z-10 text-base sm:text-xl font-black tracking-tight text-white truncate drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)]">
                📡 Matching Live TV
              </h3>
              <Link to="/live-tv" className="relative z-10 shrink-0">
                <ArmoredButton
                  variant="idle"
                  className="px-3 py-1.5 text-[11px]"
                >
                  Guide →
                </ArmoredButton>
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {matchingLiveChannels.map((ch) => (
                <Link
                  key={ch.channelId}
                  to="/live-player"
                  search={{
                    url: ch.streamUrl || ch.url,
                    title: ch.title,
                    logo: ch.logo || "",
                    channelId: ch.channelId,
                  }}
                  onClick={() =>
                    recordWatchHistory({
                      id: ch.channelId,
                      title: ch.title,
                      posterPath: ch.logo || "",
                      type: "livetv",
                    })
                  }
                  className="group rounded-2xl border border-white/15 bg-black/80 p-3 text-center flex flex-col items-center justify-between gap-2 transition hover:-translate-y-1"
                >
                  <div className="w-full h-16 rounded-xl bg-black/75 border border-white/10 p-2 flex items-center justify-center">
                    {ch.logo ? (
                      <img
                        src={ch.logo}
                        alt={ch.title}
                        loading="lazy"
                        decoding="async"
                        className="max-h-full max-w-full object-contain group-hover:scale-110 transition-transform"
                      />
                    ) : (
                      <span className="text-xs font-black text-cyan-300">
                        ● LIVE
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-black text-white line-clamp-1">
                    {ch.title}
                  </span>
                  <span className="rabtv-srch-img-btn w-full rounded-lg py-1.5 text-[10px] font-extrabold uppercase text-white">
                    <span
                      className="rabtv-srch-img-btn-art rabtv-srch-img-btn-art--primary"
                      aria-hidden="true"
                      style={{ backgroundImage: `url(${IMG_BTN_SUBMIT})` }}
                    />
                    <span className="rabtv-srch-img-btn-scrim" aria-hidden="true" />
                    <span className="rabtv-srch-img-btn-label">▶ Watch Live</span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* MATCHING ACTORS / CREATORS STRIP */}
        {matchedPeople.length > 0 && !selectedPerson && (
          <section className="space-y-3">
            <div className="rabtv-srch-banner">
              <div
                className="rabtv-srch-banner-bg"
                aria-hidden="true"
                style={{ backgroundImage: `url(${IMG_CATALOG_BANNER_BG})` }}
              />
              <div className="rabtv-srch-banner-scrim" aria-hidden="true" />
              <h3 className="relative z-10 text-base sm:text-xl font-black tracking-tight text-white truncate drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)]">
                🎭 Matching Cast & Crew
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
                  <div className="p-[2.5px] rounded-full bg-gradient-to-tr from-red-500 via-rose-500 to-cyan-400 shadow-lg group-hover:scale-105 transition-transform mb-1.5">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden border-2 border-black bg-zinc-950 flex items-center justify-center">
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
                  <span className="text-[10px] truncate w-full text-zinc-400">
                    {person.department}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* RESULTS HEADER BANNER (Male Punk Rabbit Searching at Computer Terminal on Right Flank) */}
        <div className="rabtv-srch-banner">
          <div
            className="rabtv-srch-banner-bg"
            aria-hidden="true"
            style={{ backgroundImage: `url(${IMG_CATALOG_BANNER_BG})` }}
          />
          <div className="rabtv-srch-banner-scrim" aria-hidden="true" />
          <h2 className="relative z-10 text-base sm:text-2xl font-black tracking-tight text-white truncate drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)]">
            {selectedPerson
              ? `🎭 ${selectedPerson.name} — Credits`
              : activeUrlQuery
                ? `🔍 Results: "${activeUrlQuery}"`
                : hiddenGemsMode
                  ? "💎 Hidden Gems"
                  : activeMood
                    ? `${
                        MOOD_VIBES.find((m) => m.id === activeMood)?.label ||
                        "Filtered"
                      } Catalog`
                    : "Filtered Catalog"}
          </h2>
        </div>

        {/* RESULTS GRID / LOADING / ERROR / EMPTY STATES */}
        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center gap-3 font-bold text-zinc-300">
            <div className="h-9 w-9 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
            <span>Scanning Rabbit TV archive…</span>
          </div>
        ) : error ? (
          <div className="rounded-3xl border border-red-500/35 bg-black/80 p-8 text-center space-y-3">
            <p className="text-sm font-bold text-red-300">⚠️ {error}</p>
            <ArmoredButton
              variant="danger"
              onClick={() => setRetryTick((t) => t + 1)}
              className="px-5 py-2 text-xs"
            >
              ↻ Retry Search
            </ArmoredButton>
          </div>
        ) : filteredResults.length > 0 ? (
          <>
            <div
              data-tour="search-results"
              className={`${gridColsClass} w-full`}
            >
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
              <div className="mt-4 flex items-center justify-between gap-4 rounded-2xl border border-white/15 bg-black/80 p-3 mx-auto w-full max-w-sm">
                <ArmoredButton
                  variant="idle"
                  disabled={page <= 1 || loading}
                  onClick={() => {
                    setPage((p) => Math.max(1, p - 1));
                    window.scrollTo({
                      top: 0,
                      behavior: reducedMotion ? "auto" : "smooth",
                    });
                  }}
                  className={
                    largeButtons ? "px-5 py-3 text-sm" : "px-4 py-2 text-xs"
                  }
                >
                  ◀ Prev
                </ArmoredButton>

                <span className="text-xs font-black text-cyan-300">
                  Page {page} of {totalPages}
                </span>

                <ArmoredButton
                  variant="primary"
                  disabled={page >= totalPages || loading}
                  onClick={() => {
                    setPage((p) => Math.min(totalPages, p + 1));
                    window.scrollTo({
                      top: 0,
                      behavior: reducedMotion ? "auto" : "smooth",
                    });
                  }}
                  className={
                    largeButtons ? "px-5 py-3 text-sm" : "px-4 py-2 text-xs"
                  }
                >
                  Next ▶
                </ArmoredButton>
              </div>
            )}
          </>
        ) : (
          <div className="rounded-3xl border border-white/10 bg-black/80 p-10 sm:p-12 text-center space-y-3">
            <div className="text-3xl">🔍</div>
            <p className="text-base font-bold text-white">
              No titles found matching that exact combination of filters.
            </p>
            <p className="text-xs max-w-md mx-auto text-zinc-400">
              Try relaxing your year, rating, streaming service, or multi-genre
              selection—or tap a Vibe or Preset above.
            </p>
            {hasActiveFilters && (
              <ArmoredButton
                variant="danger"
                onClick={resetAllFilters}
                className="px-5 py-2.5 text-xs uppercase tracking-wider"
              >
                ↺ Reset All Filters
              </ArmoredButton>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
