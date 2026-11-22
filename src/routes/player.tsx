// src/routes/player.tsx
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import {
  AppTheme,
  CardSize,
  PosterAppearanceClasses,
  getSavedTheme,
  getSavedCardSize,
  getPosterAppearanceClasses,
  getOptimalTmdbImageWidth,
  getHardwareLimits,
  getLargeButtons,
  getReducedMotion,
  getGlowIntensity,
  getAutoPlayNext,
  setAutoPlayNext as saveAutoPlayNextSetting,
  getClockFormat,
  formatAppTime,
  getSleepTimerMinutes,
  getSavedUserAge,
  getKidsModeLocked,
  isAllowedForAge,
  purgeOldTmdbCaches,
} from "@/lib/settings";
import { isTitleBroken, reportBrokenLink } from "@/lib/broken-links";
import { MediaCard } from "@/routes/index";
import type { MediaItem } from "@/lib/tmdb-scraper";
import {
  saveWatchProgress,
  getWatchHistory,
  markEpisodeCompleted,
  isTitleDisliked,
  dislikeTitle,
} from "@/lib/watch-history";
import { isInMyList, toggleMyList } from "@/lib/storage";
import { AppWallpaper } from "@/components/AppWallpaper";
import { bgAudio } from "@/lib/background-audio";
import { initAdBlockerGlobalInterceptors } from "@/lib/adblocker";

const FETCH_TIMEOUT_MS = 8000;
const PLAYER_SERVER_STORAGE_KEY = "rabtv_preferred_player_server_v2";
const FAILOVER_PROBE_TIMEOUT_MS = 6000;
const FAILOVER_IFRAME_TIMEOUT_MS = 9500;

type PlayerServerId =
  | "rabbittv.pro"
  | "rabbittv.cc"
  | "rabbittv.net"
  | "rabbittv.icu"
  | "rabbittv.to";

interface PlayerServerOption {
  id: PlayerServerId;
  label: string;
  tag: string;
}

const PLAYER_SERVERS: PlayerServerOption[] = [
  { id: "rabbittv.pro", label: "rabbittv.pro", tag: "Primary HD" },
  { id: "rabbittv.cc", label: "rabbittv.cc", tag: "Mirror 2" },
  { id: "rabbittv.net", label: "rabbittv.net", tag: "Mirror 3" },
  { id: "rabbittv.icu", label: "rabbittv.icu", tag: "Mirror 4" },
  { id: "rabbittv.to", label: "rabbittv.to", tag: "Mirror 5" },
];

const THEME_HEX_ACCENT: Record<AppTheme, string> = {
  red: "ef4444",
  midnight: "38bdf8",
  emerald: "10b981",
  amber: "f59e0b",
  cyan: "06b6d4",
  violet: "8b5cf6",
};

function getSavedPlayerServer(): PlayerServerId {
  if (typeof window === "undefined") return "rabbittv.pro";
  const saved = localStorage.getItem(
    PLAYER_SERVER_STORAGE_KEY
  ) as PlayerServerId | null;
  if (saved && PLAYER_SERVERS.some((s) => s.id === saved)) {
    return saved;
  }
  return "rabbittv.pro";
}

function getNextFailoverServer(
  current: PlayerServerId,
  tried: Set<PlayerServerId>
): PlayerServerId | null {
  const startIdx = PLAYER_SERVERS.findIndex((s) => s.id === current);
  const total = PLAYER_SERVERS.length;
  for (let offset = 1; offset < total; offset++) {
    const candidate = PLAYER_SERVERS[(Math.max(0, startIdx) + offset) % total];
    if (candidate && !tried.has(candidate.id)) {
      return candidate.id;
    }
  }
  return null;
}

function buildEmbedUrl(
  serverId: PlayerServerId,
  mediaType: "movie" | "tv",
  mediaId: string,
  season: number,
  episode: number,
  appTheme: AppTheme
): string {
  const accentHex = THEME_HEX_ACCENT[appTheme] || "8b5cf6";
  switch (serverId) {
    case "rabbittv.pro":
      return mediaType === "tv"
        ? `https://vidlink.pro/tv/${mediaId}/${season}/${episode}?primaryColor=${accentHex}&autoplay=true&nextbutton=true`
        : `https://vidlink.pro/movie/${mediaId}?primaryColor=${accentHex}&autoplay=true`;
    case "rabbittv.cc":
      return mediaType === "tv"
        ? `https://vidsrc.cc/v2/embed/tv/${mediaId}/${season}/${episode}`
        : `https://vidsrc.cc/v2/embed/movie/${mediaId}`;
    case "rabbittv.net":
      return mediaType === "tv"
        ? `https://player.videasy.net/tv/${mediaId}/${season}/${episode}?color=${accentHex}`
        : `https://player.videasy.net/movie/${mediaId}?color=${accentHex}`;
    case "rabbittv.icu":
      return mediaType === "tv"
        ? `https://vidsrc.icu/embed/tv/${mediaId}/${season}/${episode}`
        : `https://vidsrc.icu/embed/movie/${mediaId}`;
    case "rabbittv.to":
    default:
      return mediaType === "tv"
        ? `https://vidsrc.to/embed/tv/${mediaId}/${season}/${episode}`
        : `https://vidsrc.to/embed/movie/${mediaId}`;
  }
}

const BUTTON_WRAPPER_URL =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/buttonwrapper.png";

const BACK_TO_HOME_BTN_URL =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/Backtohome.png";

const TV_DETAILS_BTN_URL =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/TvDetails.png";

/**
 * Viewport-locked layout rules for Player top utility wrapper (single
 * buttonwrapper.png holding BOTH Back to Home + TV/Movie Details side-by-side)
 * and recommended catalog header across portrait, landscape, tablet, desktop & TV.
 */
const PLAYER_VIEWPORT_STYLES = `
  /* Self-contained, adblocker-safe (no "banner" keyword) heading ribbon for /player */
  .rabtv-plr-heading-ribbon {
    position: relative;
    width: 100%;
    height: clamp(38px, 10vw, 48px);
    padding: 0 clamp(22px, 5.5vw, 44px);
    display: flex;
    flex-wrap: nowrap;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    border-radius: 9999px;
    overflow: hidden;
    contain: layout paint;
  }

  .rabtv-plr-heading-bg {
    position: absolute;
    inset: 0;
    background-size: 110% 188%;
    background-repeat: no-repeat;
    background-position: center center;
    filter: var(--rabtv-wrap-filter, hue-rotate(-14deg) saturate(1.06));
    pointer-events: none;
    z-index: 0;
  }

  .rabtv-plr-heading-title {
    position: relative;
    z-index: 6;
    font-size: clamp(12.5px, 3.4vw, 18.5px);
    line-height: 1.1;
    text-align: center;
  }

  @media (min-width: 640px) {
    .rabtv-plr-heading-ribbon {
      height: clamp(44px, 4.4vw, 56px);
      padding: 0 clamp(32px, 4vw, 56px);
    }

    .rabtv-plr-heading-title {
      font-size: clamp(15px, 1.6vw, 20.5px);
    }
  }

  @media (min-width: 640px) and (max-height: 500px) {
    .rabtv-plr-heading-ribbon {
      height: 38px;
      padding: 0 28px;
    }
  }

  @media (min-width: 1280px) {
    .rabtv-plr-heading-ribbon {
      height: clamp(50px, 3.8vw, 60px);
    }
  }
`;

export const Route = createFileRoute("/player")({
  component: PlayerPage,
  validateSearch: (search: Record<string, unknown>) => ({
    id: search.id != null ? String(search.id) : "",
    type: search.type != null ? String(search.type).toLowerCase() : "movie",
    season: search.season != null ? Number(search.season) : 1,
    episode: search.episode != null ? Number(search.episode) : 1,
  }),
});

/**
 * Checks if a DOM node was rendered by React (via internal Fiber/Props keys)
 * or is a core semantic layout container (<header>, <main>, <nav>, <footer>).
 */
function isReactOrCoreLayoutNode(node: Element): boolean {
  const tag = node.tagName.toLowerCase();
  if (
    tag === "header" ||
    tag === "main" ||
    tag === "nav" ||
    tag === "footer"
  ) {
    return true;
  }
  const keys = Object.keys(node);
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    if (
      k.startsWith("__reactFiber$") ||
      k.startsWith("__reactProps$") ||
      k.startsWith("__reactContainer$") ||
      k.startsWith("__reactInternalInstance$")
    ) {
      return true;
    }
  }
  return false;
}

function safeCacheWrite(key: string, payload: unknown): void {
  if (typeof window === "undefined") return;
  const serialized = JSON.stringify(payload);
  try {
    localStorage.setItem(key, serialized);
  } catch {
    try {
      purgeOldTmdbCaches();
      localStorage.setItem(key, serialized);
    } catch {
      // Skip caching if device storage is critically full
    }
  }
}

async function fetchJsonWithTimeout(
  url: string,
  signal?: AbortSignal,
  timeoutMs = FETCH_TIMEOUT_MS
): Promise<any> {
  const controller = new AbortController();
  const onParentAbort = () => controller.abort();
  signal?.addEventListener("abort", onParentAbort, { once: true });

  const timer =
    typeof window !== "undefined"
      ? window.setTimeout(() => controller.abort(), timeoutMs)
      : setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } finally {
    signal?.removeEventListener("abort", onParentAbort);
    if (typeof window !== "undefined") {
      window.clearTimeout(timer as number);
    } else {
      clearTimeout(timer);
    }
  }
}

interface PlayerThemeTokens {
  pageBg: string;
  baseText: string;
  mutedText: string;
  subMutedText: string;
  surfacePanel: string;
  dropdownMenu: string;
  selectBtn: string;
  dividerBorder: string;
  backCapsule: string;
  backBadge: string;
  btnSecondary: string;
  btnActivePill: string;
  text: string;
  bg: string;
  ring: string;
  accentBar: string;
  badge: string;
  subtleBadge: string;
  episodeActive: string;
  episodeIdle: string;
  episodeThumb: string;
  toastBanner: string;
  lightsOnBtn: string;
  playerFrame: string;
  ambient: string;
  playerGlow: string;
  laserLine: string;
  avatarFrame: string;
  avatarRing: string;
  nextBtn: string;
}

function getPlayerThemeTokens(theme: AppTheme): PlayerThemeTokens {
  switch (theme) {
    case "red":
      return {
        pageBg: "bg-gradient-to-br from-zinc-950/65 via-red-950/30 to-black/75",
        baseText: "text-zinc-100",
        mutedText: "text-zinc-300",
        subMutedText: "text-zinc-400",
        surfacePanel:
          "bg-zinc-950/68 border-red-500/30 shadow-[0_16px_50px_rgba(0,0,0,0.8)]",
        dropdownMenu:
          "bg-zinc-950/98 border-red-500/35 shadow-2xl",
        selectBtn:
          "border-red-500/30 bg-black/75 text-white hover:border-red-400/60",
        dividerBorder: "border-red-500/20",
        backCapsule:
          "bg-zinc-950/88 hover:bg-red-950/80 border-red-500/35 hover:border-red-400 text-zinc-100 hover:text-white",
        backBadge:
          "bg-gradient-to-tr from-red-600/60 via-rose-500/50 to-orange-500/50 border-red-400/50 text-white",
        btnSecondary:
          "bg-red-950/55 hover:bg-red-900/80 border-red-500/30 text-red-100 hover:text-white",
        btnActivePill:
          "bg-red-600/35 border-red-400/75 text-red-100",
        text: "text-red-400",
        bg: "bg-red-600",
        ring: "focus:ring-red-500",
        accentBar: "bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.95)]",
        badge: "text-red-200 border-red-500/35 bg-red-950/75",
        subtleBadge: "text-zinc-200 border-red-500/25 bg-black/75",
        episodeActive: "bg-red-950/80 border-red-400/75 ring-1 ring-red-400/50",
        episodeIdle: "bg-black/65 border-red-500/20 hover:bg-red-950/45",
        episodeThumb: "bg-zinc-900 border-red-500/25",
        toastBanner: "bg-zinc-950/95 border-red-400/55 text-red-100",
        lightsOnBtn:
          "bg-red-950/90 hover:bg-red-900 border-red-400/65 text-red-100",
        playerFrame: "border-red-500/35",
        ambient: "from-red-600/20 via-rose-600/5 to-transparent",
        playerGlow:
          "shadow-[0_25px_70px_rgba(0,0,0,0.95),0_0_38px_rgba(239,68,68,0.24)]",
        laserLine: "from-transparent via-red-500 to-rose-400",
        avatarFrame: "bg-zinc-950 border-zinc-950",
        avatarRing: "from-red-500 via-rose-400 to-orange-400",
        nextBtn:
          "bg-gradient-to-r from-red-600 via-rose-600 to-orange-600 text-white shadow-[0_0_20px_rgba(239,68,68,0.45)]",
      };
    case "midnight":
      return {
        pageBg:
          "bg-gradient-to-br from-slate-950/65 via-blue-950/30 to-black/75",
        baseText: "text-slate-100",
        mutedText: "text-slate-300",
        subMutedText: "text-slate-400",
        surfacePanel:
          "bg-slate-950/68 border-blue-500/30 shadow-[0_16px_50px_rgba(0,0,0,0.8)]",
        dropdownMenu:
          "bg-slate-950/98 border-blue-500/35 shadow-2xl",
        selectBtn:
          "border-blue-500/30 bg-black/75 text-white hover:border-sky-400/60",
        dividerBorder: "border-blue-500/20",
        backCapsule:
          "bg-slate-950/88 hover:bg-blue-950/80 border-blue-500/35 hover:border-sky-400 text-slate-100 hover:text-white",
        backBadge:
          "bg-gradient-to-tr from-blue-600/60 via-sky-500/50 to-cyan-400/50 border-sky-400/50 text-white",
        btnSecondary:
          "bg-blue-950/55 hover:bg-blue-900/80 border-blue-500/30 text-blue-100 hover:text-white",
        btnActivePill:
          "bg-blue-600/35 border-sky-400/75 text-sky-100",
        text: "text-sky-300",
        bg: "bg-blue-600",
        ring: "focus:ring-sky-400",
        accentBar: "bg-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.95)]",
        badge: "text-sky-200 border-blue-500/35 bg-blue-950/75",
        subtleBadge: "text-slate-200 border-blue-500/25 bg-black/75",
        episodeActive: "bg-blue-950/80 border-sky-400/75 ring-1 ring-sky-400/50",
        episodeIdle: "bg-black/65 border-blue-500/20 hover:bg-blue-950/45",
        episodeThumb: "bg-slate-900 border-blue-500/25",
        toastBanner: "bg-slate-950/95 border-sky-400/55 text-sky-100",
        lightsOnBtn:
          "bg-blue-950/90 hover:bg-blue-900 border-sky-400/65 text-sky-100",
        playerFrame: "border-blue-500/35",
        ambient: "from-blue-600/20 via-sky-500/5 to-transparent",
        playerGlow:
          "shadow-[0_25px_70px_rgba(0,0,0,0.95),0_0_38px_rgba(56,189,248,0.24)]",
        laserLine: "from-transparent via-sky-400 to-blue-500",
        avatarFrame: "bg-slate-950 border-slate-950",
        avatarRing: "from-cyan-400 via-sky-500 to-blue-500",
        nextBtn:
          "bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-500 text-white shadow-[0_0_20px_rgba(56,189,248,0.45)]",
      };
    case "emerald":
      return {
        pageBg:
          "bg-gradient-to-br from-neutral-950/65 via-emerald-950/30 to-black/75",
        baseText: "text-neutral-100",
        mutedText: "text-neutral-300",
        subMutedText: "text-neutral-400",
        surfacePanel:
          "bg-neutral-950/68 border-emerald-500/30 shadow-[0_16px_50px_rgba(0,0,0,0.8)]",
        dropdownMenu:
          "bg-neutral-950/98 border-emerald-500/35 shadow-2xl",
        selectBtn:
          "border-emerald-500/30 bg-black/75 text-white hover:border-emerald-400/60",
        dividerBorder: "border-emerald-500/20",
        backCapsule:
          "bg-neutral-950/88 hover:bg-emerald-950/80 border-emerald-500/35 hover:border-emerald-400 text-neutral-100 hover:text-white",
        backBadge:
          "bg-gradient-to-tr from-emerald-600/60 via-teal-500/50 to-green-400/50 border-emerald-400/50 text-white",
        btnSecondary:
          "bg-emerald-950/55 hover:bg-emerald-900/80 border-emerald-500/30 text-emerald-100 hover:text-white",
        btnActivePill:
          "bg-emerald-600/35 border-emerald-400/75 text-emerald-100",
        text: "text-emerald-300",
        bg: "bg-emerald-600",
        ring: "focus:ring-emerald-400",
        accentBar: "bg-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.95)]",
        badge: "text-emerald-200 border-emerald-500/35 bg-emerald-950/75",
        subtleBadge: "text-neutral-200 border-emerald-500/25 bg-black/75",
        episodeActive:
          "bg-emerald-950/80 border-emerald-400/75 ring-1 ring-emerald-400/50",
        episodeIdle: "bg-black/65 border-emerald-500/20 hover:bg-emerald-950/45",
        episodeThumb: "bg-neutral-900 border-emerald-500/25",
        toastBanner: "bg-neutral-950/95 border-emerald-400/55 text-emerald-100",
        lightsOnBtn:
          "bg-emerald-950/90 hover:bg-emerald-900 border-emerald-400/65 text-emerald-100",
        playerFrame: "border-emerald-500/35",
        ambient: "from-emerald-600/20 via-teal-500/5 to-transparent",
        playerGlow:
          "shadow-[0_25px_70px_rgba(0,0,0,0.95),0_0_38px_rgba(52,211,153,0.24)]",
        laserLine: "from-transparent via-emerald-400 to-teal-400",
        avatarFrame: "bg-neutral-950 border-neutral-950",
        avatarRing: "from-emerald-400 via-teal-400 to-green-500",
        nextBtn:
          "bg-gradient-to-r from-emerald-600 via-teal-600 to-green-600 text-white shadow-[0_0_20px_rgba(52,211,153,0.45)]",
      };
    case "amber":
      return {
        pageBg:
          "bg-gradient-to-br from-stone-950/65 via-yellow-950/30 to-black/75",
        baseText: "text-stone-100",
        mutedText: "text-stone-300",
        subMutedText: "text-stone-400",
        surfacePanel:
          "bg-stone-950/68 border-amber-500/30 shadow-[0_16px_50px_rgba(0,0,0,0.8)]",
        dropdownMenu:
          "bg-stone-950/98 border-amber-500/35 shadow-2xl",
        selectBtn:
          "border-amber-500/30 bg-black/75 text-white hover:border-amber-400/60",
        dividerBorder: "border-amber-500/20",
        backCapsule:
          "bg-stone-950/88 hover:bg-amber-950/80 border-amber-500/35 hover:border-amber-400 text-stone-100 hover:text-white",
        backBadge:
          "bg-gradient-to-tr from-amber-600/60 via-yellow-500/50 to-orange-500/50 border-amber-400/50 text-white",
        btnSecondary:
          "bg-amber-950/55 hover:bg-amber-900/80 border-amber-500/30 text-amber-100 hover:text-white",
        btnActivePill:
          "bg-amber-600/35 border-amber-400/75 text-amber-100",
        text: "text-amber-300",
        bg: "bg-amber-600",
        ring: "focus:ring-amber-400",
        accentBar: "bg-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.95)]",
        badge: "text-amber-200 border-amber-500/35 bg-amber-950/75",
        subtleBadge: "text-stone-200 border-amber-500/25 bg-black/75",
        episodeActive:
          "bg-amber-950/80 border-amber-400/75 ring-1 ring-amber-400/50",
        episodeIdle: "bg-black/65 border-amber-500/20 hover:bg-amber-950/45",
        episodeThumb: "bg-stone-900 border-amber-500/25",
        toastBanner: "bg-stone-950/95 border-amber-400/55 text-amber-100",
        lightsOnBtn:
          "bg-amber-950/90 hover:bg-amber-900 border-amber-400/65 text-amber-100",
        playerFrame: "border-amber-500/35",
        ambient: "from-amber-600/20 via-yellow-500/5 to-transparent",
        playerGlow:
          "shadow-[0_25px_70px_rgba(0,0,0,0.95),0_0_38px_rgba(245,158,11,0.24)]",
        laserLine: "from-transparent via-amber-400 to-orange-500",
        avatarFrame: "bg-stone-950 border-stone-950",
        avatarRing: "from-amber-400 via-yellow-400 to-orange-500",
        nextBtn:
          "bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 text-white shadow-[0_0_20px_rgba(245,158,11,0.45)]",
      };
    case "cyan":
      return {
        pageBg:
          "bg-gradient-to-br from-slate-950/65 via-cyan-950/30 to-black/75",
        baseText: "text-slate-100",
        mutedText: "text-slate-300",
        subMutedText: "text-slate-400",
        surfacePanel:
          "bg-slate-950/68 border-cyan-500/30 shadow-[0_16px_50px_rgba(0,0,0,0.8)]",
        dropdownMenu:
          "bg-slate-950/98 border-cyan-500/35 shadow-2xl",
        selectBtn:
          "border-cyan-500/30 bg-black/75 text-white hover:border-cyan-400/60",
        dividerBorder: "border-cyan-500/20",
        backCapsule:
          "bg-slate-950/88 hover:bg-cyan-950/80 border-cyan-500/35 hover:border-cyan-400 text-slate-100 hover:text-white",
        backBadge:
          "bg-gradient-to-tr from-cyan-600/60 via-teal-500/50 to-sky-400/50 border-cyan-400/50 text-white",
        btnSecondary:
          "bg-cyan-950/55 hover:bg-cyan-900/80 border-cyan-500/30 text-cyan-100 hover:text-white",
        btnActivePill:
          "bg-cyan-600/35 border-cyan-400/75 text-cyan-100",
        text: "text-cyan-300",
        bg: "bg-cyan-600",
        ring: "focus:ring-cyan-400",
        accentBar: "bg-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.95)]",
        badge: "text-cyan-200 border-cyan-500/35 bg-cyan-950/75",
        subtleBadge: "text-slate-200 border-cyan-500/25 bg-black/75",
        episodeActive:
          "bg-cyan-950/80 border-cyan-400/75 ring-1 ring-cyan-400/50",
        episodeIdle: "bg-black/65 border-cyan-500/20 hover:bg-cyan-950/45",
        episodeThumb: "bg-slate-900 border-cyan-500/25",
        toastBanner: "bg-slate-950/95 border-cyan-400/55 text-cyan-100",
        lightsOnBtn:
          "bg-cyan-950/90 hover:bg-cyan-900 border-cyan-400/65 text-cyan-100",
        playerFrame: "border-cyan-500/35",
        ambient: "from-cyan-600/20 via-sky-500/5 to-transparent",
        playerGlow:
          "shadow-[0_25px_70px_rgba(0,0,0,0.95),0_0_38px_rgba(34,211,238,0.24)]",
        laserLine: "from-transparent via-cyan-400 to-teal-400",
        avatarFrame: "bg-slate-950 border-slate-950",
        avatarRing: "from-cyan-400 via-teal-400 to-sky-500",
        nextBtn:
          "bg-gradient-to-r from-cyan-600 via-teal-600 to-blue-600 text-white shadow-[0_0_20px_rgba(34,211,238,0.45)]",
      };
    case "violet":
    default:
      return {
        pageBg:
          "bg-gradient-to-br from-slate-950/65 via-purple-950/30 to-black/75",
        baseText: "text-slate-100",
        mutedText: "text-slate-300",
        subMutedText: "text-slate-400",
        surfacePanel:
          "bg-slate-950/68 border-violet-500/30 shadow-[0_16px_50px_rgba(0,0,0,0.8)]",
        dropdownMenu:
          "bg-slate-950/98 border-violet-500/35 shadow-2xl",
        selectBtn:
          "border-violet-500/30 bg-black/75 text-white hover:border-violet-400/60",
        dividerBorder: "border-violet-500/20",
        backCapsule:
          "bg-slate-950/88 hover:bg-purple-950/80 border-violet-500/35 hover:border-violet-400 text-slate-100 hover:text-white",
        backBadge:
          "bg-gradient-to-tr from-violet-600/60 via-purple-500/50 to-indigo-500/50 border-violet-400/50 text-white",
        btnSecondary:
          "bg-purple-950/55 hover:bg-purple-900/80 border-violet-500/30 text-purple-100 hover:text-white",
        btnActivePill:
          "bg-violet-600/35 border-violet-400/75 text-violet-100",
        text: "text-violet-300",
        bg: "bg-violet-600",
        ring: "focus:ring-violet-400",
        accentBar: "bg-violet-500 shadow-[0_0_15px_rgba(139,92,246,0.95)]",
        badge: "text-violet-200 border-violet-500/35 bg-purple-950/75",
        subtleBadge: "text-slate-200 border-violet-500/25 bg-black/75",
        episodeActive:
          "bg-purple-950/80 border-violet-400/75 ring-1 ring-violet-400/50",
        episodeIdle: "bg-black/65 border-violet-500/20 hover:bg-purple-950/45",
        episodeThumb: "bg-slate-900 border-violet-500/25",
        toastBanner: "bg-slate-950/95 border-violet-400/55 text-violet-100",
        lightsOnBtn:
          "bg-purple-950/90 hover:bg-purple-900 border-violet-400/65 text-violet-100",
        playerFrame: "border-violet-500/35",
        ambient: "from-violet-600/20 via-purple-500/5 to-transparent",
        playerGlow:
          "shadow-[0_25px_70px_rgba(0,0,0,0.95),0_0_38px_rgba(168,85,247,0.24)]",
        laserLine: "from-transparent via-purple-500 to-violet-400",
        avatarFrame: "bg-slate-950 border-slate-950",
        avatarRing: "from-violet-400 via-purple-500 to-indigo-500",
        nextBtn:
          "bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 text-white shadow-[0_0_20px_rgba(139,92,246,0.45)]",
      };
  }
}

export function PlayerPage() {
  // 1. Protect React DOM & activate global adblocker interceptors (unchanged core shield)
  useEffect(() => {
    if (typeof document === "undefined") return;

    const protectLegitimateAppDom = () => {
      document
        .querySelectorAll("header, main, nav, footer")
        .forEach((el) => el.classList.add("rabtv-vidsrc-protected"));

      if (document.body) {
        Array.from(document.body.children).forEach((child) => {
          if (isReactOrCoreLayoutNode(child)) {
            child.classList.add("rabtv-vidsrc-protected");
          }
        });
      }
    };

    protectLegitimateAppDom();

    const shieldObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of Array.from(mutation.addedNodes)) {
          if (node instanceof HTMLElement && isReactOrCoreLayoutNode(node)) {
            node.classList.add("rabtv-vidsrc-protected");
          }
        }
      }
    });

    if (document.body) {
      shieldObserver.observe(document.body, { childList: true, subtree: false });
    }

    const cleanup = initAdBlockerGlobalInterceptors();

    return () => {
      shieldObserver.disconnect();
      cleanup();
    };
  }, []);

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
  const safeApiId = /^\d+$/.test(mediaId) ? mediaId : "";
  const urlType: "movie" | "tv" =
    inferredType || (search.type === "tv" ? "tv" : "movie");

  // Media & Episode States
  const [mediaType, setMediaType] = useState<"movie" | "tv">(urlType);
  const [mediaDetails, setMediaDetails] = useState<any>(null);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [season, setSeason] = useState<number>(
    search.season > 0 ? search.season : 1
  );
  const [episode, setEpisode] = useState<number>(
    search.episode > 0 ? search.episode : 1
  );
  const [seasonEpisodes, setSeasonEpisodes] = useState<any[]>([]);
  const [showEpisodeDrawer, setShowEpisodeDrawer] = useState<boolean>(false);

  // Synced Settings States
  const [appTheme, setAppTheme] = useState<AppTheme>(() => getSavedTheme());
  const [cardSize, setCardSize] = useState<CardSize>(() => getSavedCardSize());
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
  const [autoPlayNext, setAutoPlayNext] = useState<boolean>(() =>
    getAutoPlayNext()
  );
  const [clockFormat, setClockFormat] = useState(() => getClockFormat());
  const [sleepTimerMin, setSleepTimerMin] = useState<number>(() =>
    getSleepTimerMinutes()
  );
  const [userAge, setUserAge] = useState<number>(() => getSavedUserAge());
  const [kidsLocked, setKidsLocked] = useState<boolean>(() =>
    getKidsModeLocked()
  );

  // Interactive Cinema UI States
  const [cinemaDimMode, setCinemaDimMode] = useState<boolean>(false);
  const [activeServer, setActiveServer] = useState<PlayerServerId>(() =>
    getSavedPlayerServer()
  );
  const [serverStatus, setServerStatus] = useState<
    "connecting" | "ready" | "switching"
  >("connecting");
  const [playerReloadNonce, setPlayerReloadNonce] = useState<number>(0);
  const [isServerMenuOpen, setIsServerMenuOpen] = useState<boolean>(false);
  const triedServersRef = useRef<Set<PlayerServerId>>(new Set());
  const iframeLoadedRef = useRef<boolean>(false);
  const serverMenuRef = useRef<HTMLDivElement>(null);
  const [inMyList, setInMyList] = useState<boolean>(() =>
    isInMyList(`${urlType}-${mediaId}`)
  );
  const [watchedMapTick, setWatchedMapTick] = useState<number>(0);
  const [actionToast, setActionToast] = useState<string | null>(null);
  const [playerLoadTime, setPlayerLoadTime] = useState<number>(() =>
    Date.now()
  );
  const [estimatedCompletion, setEstimatedCompletion] =
    useState<string>("--:--");
  const [liveClock, setLiveClock] = useState<string>(() =>
    formatAppTime(new Date(), getClockFormat())
  );

  const [isSeasonOpen, setIsSeasonOpen] = useState(false);
  const [isEpisodeOpen, setIsEpisodeOpen] = useState(false);

  const seasonRef = useRef<HTMLDivElement>(null);
  const episodeRef = useRef<HTMLDivElement>(null);

  const showToast = useCallback((msg: string) => {
    setActionToast(msg);
    window.setTimeout(() => setActionToast(null), 3200);
  }, []);

  // Pause background lobby radio whenever entering or switching playback
  useEffect(() => {
    bgAudio.pause();
  }, [mediaId, season, episode]);

  // Reset state cleanly when route changes
  useEffect(() => {
    setMediaType(urlType);
    setSeason(search.season > 0 ? search.season : 1);
    setEpisode(search.episode > 0 ? search.episode : 1);
    setMediaDetails(null);
    setRecommendations([]);
    setSeasonEpisodes([]);
    setLoading(true);
    setCinemaDimMode(false);
    setPlayerLoadTime(Date.now());
  }, [mediaId, urlType, search.season, search.episode]);

  // Reset finish-time anchor & failover history whenever media/episode switches
  useEffect(() => {
    setPlayerLoadTime(Date.now());
    triedServersRef.current = new Set([activeServer]);
    iframeLoadedRef.current = false;
    setServerStatus("connecting");
  }, [mediaId, season, episode]);

  // Close dropdowns on outside click & support TV/Keyboard shortcuts (Escape, L for Lights-Out)
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
      if (
        serverMenuRef.current &&
        !serverMenuRef.current.contains(event.target as Node)
      ) {
        setIsServerMenuOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (e.key === "Escape") {
        setIsSeasonOpen(false);
        setIsEpisodeOpen(false);
        setIsServerMenuOpen(false);
        setCinemaDimMode(false);
      } else if (e.key === "l" || e.key === "L") {
        setCinemaDimMode((prev) => !prev);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Live settings sync
  useEffect(() => {
    const loadSettings = () => {
      const nextTheme = getSavedTheme();
      setAppTheme(nextTheme);
      setCardSize(getSavedCardSize());
      setPosterAppearance(getPosterAppearanceClasses(nextTheme));
      setPosterWidth(getOptimalTmdbImageWidth());
      setLargeButtons(getLargeButtons());
      setReducedMotion(getReducedMotion());
      setGlowOff(getGlowIntensity() === "off");
      setIsLowRam(getHardwareLimits().effectiveMode === "low");
      setAutoPlayNext(getAutoPlayNext());
      setClockFormat(getClockFormat());
      setSleepTimerMin(getSleepTimerMinutes());
      setUserAge(getSavedUserAge());
      setKidsLocked(getKidsModeLocked());
      setLiveClock(formatAppTime(new Date(), getClockFormat()));
    };

    const onHistoryChange = () => setWatchedMapTick((t) => t + 1);
    const onCatalogChange = () =>
      setInMyList(isInMyList(`${mediaType}-${mediaId}`));

    loadSettings();
    window.addEventListener("storage", loadSettings);
    window.addEventListener("rabtv_settings_updated", loadSettings);
    window.addEventListener("rabtv_ram_mode_updated", loadSettings);
    window.addEventListener("rabtv_watch_history_updated", onHistoryChange);
    window.addEventListener("rabtv_catalog_updated", onCatalogChange);

    const clockTimer = window.setInterval(() => {
      setLiveClock(formatAppTime(new Date(), getClockFormat()));
    }, 15000);

    return () => {
      window.removeEventListener("storage", loadSettings);
      window.removeEventListener("rabtv_settings_updated", loadSettings);
      window.removeEventListener("rabtv_ram_mode_updated", loadSettings);
      window.removeEventListener(
        "rabtv_watch_history_updated",
        onHistoryChange
      );
      window.removeEventListener("rabtv_catalog_updated", onCatalogChange);
      window.clearInterval(clockTimer);
    };
  }, [mediaId, mediaType]);

  useEffect(() => {
    setInMyList(isInMyList(`${mediaType}-${mediaId}`));
  }, [mediaId, mediaType]);

  // Fetch season episodes with AbortController & timeout
  useEffect(() => {
    if (mediaType !== "tv" || !safeApiId) return;
    const controller = new AbortController();
    let cancelled = false;

    async function fetchSeasonEpisodes() {
      try {
        const apiKey = (import.meta as any).env?.VITE_TMDB_API_KEY as string;
        if (!apiKey) return;
        const data = await fetchJsonWithTimeout(
          `https://api.themoviedb.org/3/tv/${safeApiId}/season/${season}?api_key=${apiKey}`,
          controller.signal
        );
        if (!cancelled && data) {
          setSeasonEpisodes(Array.isArray(data.episodes) ? data.episodes : []);
        }
      } catch (err: any) {
        if (!cancelled && err?.name !== "AbortError") {
          console.error("Failed to load season episodes", err);
          setSeasonEpisodes([]);
        }
      }
    }

    void fetchSeasonEpisodes();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [season, safeApiId, mediaType]);

  // Fetch player details & recommendations with cache, timeout & safe quota writes
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    async function fetchPlayerDetailsWithCache() {
      if (!safeApiId) {
        setLoading(false);
        setMediaDetails(null);
        return;
      }

      const apiKey = (import.meta as any).env?.VITE_TMDB_API_KEY as string;
      let activeFetchType: "movie" | "tv" = urlType;

      try {
        const cacheKey = `rabtv_cache_${activeFetchType}_${safeApiId}`;
        const cachedItem = localStorage.getItem(cacheKey);
        if (cachedItem) {
          try {
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
          } catch {
            // Ignore malformed cache
          }
        }

        let data = await fetchJsonWithTimeout(
          `https://api.themoviedb.org/3/${activeFetchType}/${safeApiId}?api_key=${apiKey}&append_to_response=credits,external_ids`,
          controller.signal
        );

        if (!data || data.success === false || data.status_code) {
          const otherType: "movie" | "tv" =
            activeFetchType === "movie" ? "tv" : "movie";
          const retryData = await fetchJsonWithTimeout(
            `https://api.themoviedb.org/3/${otherType}/${safeApiId}?api_key=${apiKey}&append_to_response=credits,external_ids`,
            controller.signal
          );
          if (retryData && retryData.success !== false && !retryData.status_code) {
            data = retryData;
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
          safeCacheWrite(`rabtv_cache_${activeFetchType}_${safeApiId}`, {
            data,
            timestamp: Date.now(),
          });
          setMediaDetails(data);
        } else {
          setMediaDetails(null);
        }

        let recData = await fetchJsonWithTimeout(
          `https://api.themoviedb.org/3/${activeFetchType}/${safeApiId}/recommendations?api_key=${apiKey}&language=en-US&page=1`,
          controller.signal
        );

        if (!recData?.results || recData.results.length === 0) {
          recData = await fetchJsonWithTimeout(
            `https://api.themoviedb.org/3/${activeFetchType}/popular?api_key=${apiKey}&language=en-US&page=1`,
            controller.signal
          );
        }

        if (!cancelled && Array.isArray(recData?.results)) {
          setRecommendations(recData.results);
        }
      } catch (err: any) {
        if (!cancelled && err?.name !== "AbortError") {
          console.error(
            "Failed to load player details and recommendations",
            err
          );
          setMediaDetails(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchPlayerDetailsWithCache();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [safeApiId, urlType]);

  const inferredMediaType: "tv" | "movie" =
    mediaDetails?.seasons ||
    mediaDetails?.number_of_seasons ||
    mediaType === "tv"
      ? "tv"
      : "movie";

  const validSeasons = useMemo(() => {
    return (mediaDetails?.seasons || []).filter(
      (s: any) => s.season_number > 0
    );
  }, [mediaDetails]);

  const currentSeasonObj = useMemo(
    () => validSeasons.find((s: any) => s.season_number === season),
    [validSeasons, season]
  );

  const currentEpisodeObj = useMemo(
    () => seasonEpisodes.find((e: any) => e.episode_number === episode),
    [seasonEpisodes, episode]
  );

  // Accurate finish time using exact episode runtime + user 12h/24h clock format
  useEffect(() => {
    if (!mediaDetails) return;
    const runtimeMinutes =
      inferredMediaType === "movie"
        ? mediaDetails.runtime || 120
        : currentEpisodeObj?.runtime ||
          mediaDetails.episode_run_time?.[0] ||
          45;

    const completionTimestamp = playerLoadTime + runtimeMinutes * 60 * 1000;
    setEstimatedCompletion(formatAppTime(completionTimestamp, clockFormat));
  }, [
    mediaDetails,
    playerLoadTime,
    inferredMediaType,
    currentEpisodeObj,
    clockFormat,
  ]);

  // Persist accurate Watch History progress (including totalEpisodes & episodeTitle)
  useEffect(() => {
    if (!mediaDetails || !mediaId) return;

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
        episodeTitle:
          inferredMediaType === "tv" ? currentEpisodeObj?.name : undefined,
        totalEpisodes:
          inferredMediaType === "tv"
            ? mediaDetails.number_of_episodes || undefined
            : 1,
        genreIds: mediaDetails?.genres?.map((g: any) => g.id) || [],
      });
    } catch (err) {
      console.error("Could not update watch history", err);
    }
  }, [
    season,
    episode,
    mediaDetails,
    mediaId,
    inferredMediaType,
    currentEpisodeObj?.name,
  ]);

  // Lookup completed episodes for this title from Watch History
  const completedEpisodesSet = useMemo(() => {
    void watchedMapTick;
    const history = getWatchHistory();
    const showRecord = history[mediaId];
    const set = new Set<string>();
    if (showRecord?.episodes) {
      for (const ep of Object.values(showRecord.episodes)) {
        if (ep.confirmedCompleted) {
          set.add(`s${ep.seasonNumber}-e${ep.episodeNumber}`);
        }
      }
    }
    return set;
  }, [mediaId, watchedMapTick]);

  const isCurrentItemWatched =
    inferredMediaType === "movie"
      ? completedEpisodesSet.has("s1-e1")
      : completedEpisodesSet.has(`s${season}-e${episode}`);

  // Smart Prev / Next episode navigation with automatic cross-season rollover
  const currentSeasonMaxEp =
    seasonEpisodes.length || currentSeasonObj?.episode_count || 1;
  const currentSeasonIndex = validSeasons.findIndex(
    (s: any) => s.season_number === season
  );
  const nextSeasonObj =
    currentSeasonIndex >= 0 && currentSeasonIndex < validSeasons.length - 1
      ? validSeasons[currentSeasonIndex + 1]
      : null;
  const prevSeasonObj =
    currentSeasonIndex > 0 ? validSeasons[currentSeasonIndex - 1] : null;

  const canGoPrevEpisode = episode > 1 || Boolean(prevSeasonObj);
  const canGoNextEpisode =
    episode < currentSeasonMaxEp || Boolean(nextSeasonObj);

  const handlePrevEpisode = () => {
    if (episode > 1) {
      setEpisode((prev) => prev - 1);
    } else if (prevSeasonObj) {
      setSeason(prevSeasonObj.season_number);
      setEpisode(Math.max(1, prevSeasonObj.episode_count || 1));
    }
  };

  const handleNextEpisode = () => {
    if (episode < currentSeasonMaxEp) {
      setEpisode((prev) => prev + 1);
    } else if (nextSeasonObj) {
      setSeason(nextSeasonObj.season_number);
      setEpisode(1);
    }
  };

  // Top Cast extracted from already-fetched credits (0 extra network calls!)
  const topCast = useMemo(() => {
    const rawCast = mediaDetails?.credits?.cast;
    if (!Array.isArray(rawCast)) return [];
    const cap = isLowRam ? 6 : 10;
    return rawCast.slice(0, cap).map((person: any) => ({
      id: person.id,
      name: person.name || "Cast Member",
      character: person.character || "",
      profilePath: person.profile_path || null,
    }));
  }, [mediaDetails, isLowRam]);

  // Age-safe, non-broken, non-disliked recommendations sized for active RAM mode
  const mappedRecommendations: MediaItem[] = useMemo(() => {
    const cap = isLowRam ? 6 : 10;
    const filtered: MediaItem[] = [];

    for (const rec of recommendations) {
      const recId = String(rec.id);
      const recType: "movie" | "tv" =
        rec.media_type === "tv" || rec.name || !rec.title ? "tv" : "movie";
      const fullId = `${recType}-${recId}`;

      if (
        isTitleBroken(recId) ||
        isTitleBroken(fullId) ||
        isTitleDisliked(recId) ||
        isTitleDisliked(fullId)
      ) {
        continue;
      }

      const genreLabel = recType === "tv" ? "TV SHOW" : "MOVIE";
      if (!isAllowedForAge(rec.adult ? "R" : undefined, genreLabel, userAge)) {
        continue;
      }

      const recTitle = rec.title || rec.name || "Untitled";
      const recPoster = rec.poster_path
        ? `https://image.tmdb.org/t/p/${posterWidth}${rec.poster_path}`
        : "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=900&q=80";
      const releaseDate = rec.release_date || rec.first_air_date || "";
      const year = releaseDate.split("-")[0];
      const rating =
        typeof rec.vote_average === "number" && rec.vote_average > 0
          ? rec.vote_average.toFixed(1)
          : undefined;

      filtered.push({
        id: fullId,
        title: recTitle,
        description: rec.overview || "",
        image: recPoster,
        href: `/details?id=${recId}&type=${recType}`,
        genre: genreLabel,
        year: year || undefined,
        rating,
        mediaType: recType,
      });

      if (filtered.length >= cap) break;
    }

    return filtered;
  }, [recommendations, posterWidth, isLowRam, userAge, kidsLocked]);

  const gridColsClass = useMemo(() => {
    if (cardSize === "small") {
      return "grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 sm:gap-4 justify-items-center";
    }
    if (cardSize === "medium") {
      return "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 sm:gap-5 justify-items-center";
    }
    return "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5 justify-items-center";
  }, [cardSize]);

  const themeTokens = useMemo(() => getPlayerThemeTokens(appTheme), [appTheme]);

  const embedUrl = buildEmbedUrl(
    activeServer,
    inferredMediaType,
    mediaId,
    season,
    episode,
    appTheme
  );

  const triggerBackgroundFailover = useCallback(
    (reason: string) => {
      triedServersRef.current.add(activeServer);
      const nextId = getNextFailoverServer(activeServer, triedServersRef.current);
      if (!nextId) {
        setServerStatus("ready");
        return;
      }
      triedServersRef.current.add(nextId);
      iframeLoadedRef.current = false;
      setServerStatus("switching");
      setActiveServer(nextId);
      showToast(`⚡ ${reason} — auto-switched to ${nextId}`);
    },
    [activeServer, showToast]
  );

  // Silent background failover watchdog: verifies mirror reachability + iframe load
  useEffect(() => {
    if (!mediaId || loading) return;
    let cancelled = false;
    iframeLoadedRef.current = false;
    setServerStatus("connecting");
    triedServersRef.current.add(activeServer);

    const probeController = new AbortController();
    const probeTimer = window.setTimeout(
      () => probeController.abort(),
      FAILOVER_PROBE_TIMEOUT_MS
    );

    // 1. Background reachability ping (no-cors opaque succeeds when host answers, rejects on DNS/refused/timeout)
    void fetch(embedUrl, {
      method: "GET",
      mode: "no-cors",
      cache: "no-store",
      signal: probeController.signal,
    })
      .then(() => {
        window.clearTimeout(probeTimer);
      })
      .catch(() => {
        window.clearTimeout(probeTimer);
        if (!cancelled && !iframeLoadedRef.current) {
          triggerBackgroundFailover(`${activeServer} unreachable`);
        }
      });

    // 2. Fallback iframe load watchdog in case host hangs silently
    const iframeWatchdog = window.setTimeout(() => {
      if (!cancelled && !iframeLoadedRef.current) {
        triggerBackgroundFailover(`${activeServer} timed out`);
      }
    }, FAILOVER_IFRAME_TIMEOUT_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(probeTimer);
      window.clearTimeout(iframeWatchdog);
      probeController.abort();
    };
  }, [embedUrl, activeServer, mediaId, loading, playerReloadNonce, triggerBackgroundFailover]);

  if (loading) {
    return (
      <div
        className={`flex min-h-screen items-center justify-center ${themeTokens.pageBg} text-white relative rounded-3xl`}
      >
        <AppWallpaper />
        <div className="relative z-10 flex flex-col items-center gap-3">
          <div
            className={`h-10 w-10 rounded-full border-2 border-t-transparent animate-spin ${themeTokens.text}`}
          />
          <p className={`text-lg font-extrabold ${themeTokens.text}`}>
            Loading cinema player...
          </p>
        </div>
      </div>
    );
  }

  const title = mediaDetails?.title || mediaDetails?.name || "Sample Content";
  const overview =
    mediaDetails?.overview || "No description available for this title.";

  const backdropWidth = isLowRam ? "w780" : "w1280";
  const backdropUrl = mediaDetails?.backdrop_path
    ? `https://image.tmdb.org/t/p/${backdropWidth}${mediaDetails.backdrop_path}`
    : null;

  const releaseYear = (
    mediaDetails?.release_date ||
    mediaDetails?.first_air_date ||
    ""
  ).split("-")[0];
  const rating =
    typeof mediaDetails?.vote_average === "number" &&
    mediaDetails.vote_average > 0
      ? mediaDetails.vote_average.toFixed(1)
      : "N/A";
  const genres =
    mediaDetails?.genres?.map((g: any) => g.name).join(", ") || "Entertainment";
  const runtimeMinutes =
    inferredMediaType === "movie"
      ? mediaDetails?.runtime || null
      : currentEpisodeObj?.runtime || mediaDetails?.episode_run_time?.[0] || null;

  const imdbId =
    mediaDetails?.external_ids?.imdb_id || mediaDetails?.imdb_id || null;
  const imdbLink = imdbId
    ? `https://www.imdb.com/title/${imdbId}/`
    : `https://www.imdb.com/find?q=${encodeURIComponent(title)}`;

  const handleSelectServer = (nextServer: PlayerServerId) => {
    triedServersRef.current = new Set([nextServer]);
    iframeLoadedRef.current = false;
    setServerStatus("connecting");
    setActiveServer(nextServer);
    setIsServerMenuOpen(false);
    try {
      localStorage.setItem(PLAYER_SERVER_STORAGE_KEY, nextServer);
    } catch {
      // ignore storage errors
    }
    showToast(`Switched stream to ${nextServer}`);
  };

  const handleReturnToDetails = () => {
    navigate({
      to: "/details",
      search: {
        id: mediaId,
        type: inferredMediaType,
      },
    });
  };

  const handleToggleMyList = () => {
    const mediaPayload: MediaItem = {
      id: `${inferredMediaType}-${mediaId}`,
      title,
      description: overview,
      image: mediaDetails?.poster_path
        ? `https://image.tmdb.org/t/p/${posterWidth}${mediaDetails.poster_path}`
        : "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=900&q=80",
      href: `/details?id=${mediaId}&type=${inferredMediaType}`,
      genre: genres,
      year: releaseYear || undefined,
      rating: rating !== "N/A" ? rating : undefined,
      mediaType: inferredMediaType,
    };
    const added = toggleMyList(mediaPayload);
    setInMyList(added);
    showToast(
      added ? `🔖 Added "${title}" to My List!` : `Removed "${title}" from My List.`
    );
  };

  const handleToggleWatched = () => {
    const epId =
      inferredMediaType === "tv"
        ? `${mediaId}-s${season}-e${episode}`
        : `${mediaId}-s1-e1`;
    const nextCompleted = !isCurrentItemWatched;
    markEpisodeCompleted(mediaId, epId, nextCompleted);
    setWatchedMapTick((t) => t + 1);
    showToast(
      nextCompleted
        ? `👁️ ✓ Marked ${
            inferredMediaType === "tv" ? `S${season}E${episode}` : title
          } as Watched!`
        : "Marked as In Progress."
    );
  };

  const handleReportBrokenStream = () => {
    const result = reportBrokenLink(`${inferredMediaType}-${mediaId}`, {
      title,
      mediaType: inferredMediaType,
      reason:
        inferredMediaType === "tv"
          ? `Player issue on S${season}E${episode}`
          : "Player stream issue",
    });
    showToast(`🚩 ${result.message}`);
  };

  const handleDislikeTitle = () => {
    dislikeTitle({
      id: mediaId,
      title,
      mediaType: inferredMediaType,
      posterPath: mediaDetails?.poster_path || null,
    });
    showToast(`👎 "${title}" hidden from catalogs.`);
  };

  const handleToggleAutoPlay = (checked: boolean) => {
    setAutoPlayNext(checked);
    saveAutoPlayNextSetting(checked);
  };

  const pillBtnPadding = largeButtons ? "px-4 py-2.5 text-sm" : "px-3 py-1.5 text-xs";

  return (
    <div
      className={`player-view-wrapper min-h-screen w-full max-w-full ${themeTokens.pageBg} ${themeTokens.baseText} py-3 sm:py-6 px-2.5 sm:px-6 md:px-10 overflow-x-clip scroll-smooth transition-colors duration-300 pb-16 relative rounded-3xl`}
    >
      <style>{PLAYER_VIEWPORT_STYLES}</style>
      <AppWallpaper backdropUrl={backdropUrl} />
      {!isLowRam && !reducedMotion && !glowOff && (
        <div
          className={`absolute inset-x-0 -top-10 h-[32rem] bg-gradient-to-b ${themeTokens.ambient} blur-3xl z-0 pointer-events-none rounded-t-3xl`}
        />
      )}

      {/* Cinema Lights-Out Backdrop (Dims surroundings WITHOUT touching or remounting the iframe) */}
      {cinemaDimMode && (
        <div
          className="rabtv-vidsrc-protected fixed inset-0 bg-black/92 z-30 transition-opacity duration-300"
          onClick={() => setCinemaDimMode(false)}
          aria-hidden="true"
        />
      )}

      {cinemaDimMode && (
        <button
          type="button"
          onClick={() => setCinemaDimMode(false)}
          className={`rabtv-vidsrc-protected fixed top-4 right-4 z-50 rounded-full border px-4 py-2 text-xs font-extrabold shadow-2xl backdrop-blur-xl cursor-pointer transition ${themeTokens.lightsOnBtn}`}
        >
          💡 Turn Lights On (Esc)
        </button>
      )}

      <div className="relative z-10 max-w-6xl mx-auto flex flex-col gap-4 sm:gap-5 min-w-0">
        {/* Top Navigation Row: Compact Theme-Tuned Wrapper — Back to Home Left, Details Right */}
        <div className="rabtv-vidsrc-protected rabtv-page-top-bar">
          <div className="rabtv-vidsrc-protected rabtv-dual-wrapper">
            <div
              className="rabtv-art-bg"
              aria-hidden="true"
              style={{
                backgroundImage: `url(${BUTTON_WRAPPER_URL})`,
              }}
            />
            <Link
              to="/"
              data-tour="back-to-home"
              aria-label="Back to Home"
              title="Back to Home"
              className={`rabtv-wrap-art-btn rabtv-wrap-art-btn--left rabtv-wrap-art-btn--home rounded-full hover:scale-[1.04] active:scale-95 focus:outline-none focus:ring-2 ${themeTokens.ring}`}
            >
              <img
                src={BACK_TO_HOME_BTN_URL}
                alt="Back to Home"
                decoding="async"
              />
            </Link>

            {inferredMediaType === "tv" ? (
              <button
                type="button"
                onClick={handleReturnToDetails}
                aria-label="Back to TV Details"
                title="Back to TV Details"
                className={`rabtv-wrap-art-btn rabtv-wrap-art-btn--right rabtv-wrap-art-btn--tvdetails rounded-full hover:scale-[1.04] active:scale-95 focus:outline-none focus:ring-2 ${themeTokens.ring}`}
              >
                <img
                  src={TV_DETAILS_BTN_URL}
                  alt="TV Details"
                  decoding="async"
                />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleReturnToDetails}
                aria-label="Back to Movie Details"
                title="Back to Movie Details"
                className={`rabtv-wrap-pill-btn border backdrop-blur-md font-extrabold text-white transition hover:scale-[1.03] active:scale-95 cursor-pointer focus:outline-none focus:ring-2 ${themeTokens.backCapsule} ${themeTokens.ring}`}
              >
                <span className="truncate drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]">
                  Movie Details
                </span>
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2 w-full">
            {sleepTimerMin > 0 && (
              <span
                className={`rounded-full border px-3 py-1.5 text-[11px] font-extrabold backdrop-blur-md ${themeTokens.badge}`}
              >
                🌙 Sleep: {sleepTimerMin}m
              </span>
            )}
            <span
              className={`rounded-full border px-3 py-1.5 text-[11px] font-extrabold backdrop-blur-md ${themeTokens.subtleBadge}`}
            >
              🕒 {liveClock}
            </span>
            <button
              type="button"
              onClick={() => setCinemaDimMode((d) => !d)}
              className={`rounded-full border backdrop-blur-md ${pillBtnPadding} font-extrabold transition cursor-pointer focus:outline-none focus:ring-2 ${themeTokens.btnSecondary} ${themeTokens.ring}`}
              title="Dim surroundings around the player (L)"
            >
              💡 Lights Out
            </button>
          </div>
        </div>

        {/* Inline Feedback Toast */}
        {actionToast && (
          <div
            className={`rabtv-vidsrc-protected rounded-2xl border px-4 py-2 text-center text-xs font-extrabold shadow-xl ${themeTokens.toastBanner}`}
          >
            {actionToast}
          </div>
        )}

        {/* TV Season & Episode Control Deck */}
        {inferredMediaType === "tv" && (
          <div
            data-tour="player-controls"
            className={`w-full flex flex-col gap-3 rounded-3xl border p-3.5 sm:p-5 ${
              isLowRam ? "" : "backdrop-blur-md"
            } relative z-20 ${themeTokens.surfacePanel}`}
          >
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm font-semibold relative flex-1 min-w-0">
                {/* Season Selector */}
                <div
                  className="relative min-w-0"
                  ref={seasonRef}
                  data-tour="season-selector"
                >
                  <span
                    className={`block text-[10px] font-bold uppercase tracking-wider mb-1 pl-1 ${themeTokens.subMutedText}`}
                  >
                    Season
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsSeasonOpen(!isSeasonOpen);
                      setIsEpisodeOpen(false);
                    }}
                    className={`flex items-center justify-between w-full gap-3 rounded-xl border px-3.5 ${
                      largeButtons ? "py-3 text-sm" : "py-2.5 text-xs sm:text-sm"
                    } font-bold shadow-lg focus:outline-none focus:ring-4 ${
                      themeTokens.selectBtn
                    } ${themeTokens.ring} transition cursor-pointer`}
                  >
                    <span className="truncate">
                      {currentSeasonObj
                        ? currentSeasonObj.name
                        : `Season ${season}`}
                    </span>
                    <span className="shrink-0">▾</span>
                  </button>
                  {isSeasonOpen && (
                    <div
                      className={`rabtv-vidsrc-protected absolute left-0 right-0 mt-2 z-[999] max-h-60 overflow-y-auto rounded-2xl border backdrop-blur-xl p-1 ${themeTokens.dropdownMenu}`}
                    >
                      {validSeasons.map((s: any) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            setSeason(s.season_number);
                            setEpisode(1);
                            setIsSeasonOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-xl transition cursor-pointer ${
                            season === s.season_number
                              ? `${themeTokens.bg} text-white font-black`
                              : `${themeTokens.mutedText} hover:bg-white/10 hover:text-white`
                          }`}
                        >
                          {s.name} ({s.episode_count} Eps)
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Episode Selector */}
                <div className="relative min-w-0" ref={episodeRef}>
                  <span
                    className={`block text-[10px] font-bold uppercase tracking-wider mb-1 pl-1 ${themeTokens.subMutedText}`}
                  >
                    Episode
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEpisodeOpen(!isEpisodeOpen);
                      setIsSeasonOpen(false);
                    }}
                    className={`flex items-center justify-between w-full gap-3 rounded-xl border px-3.5 ${
                      largeButtons ? "py-3 text-sm" : "py-2.5 text-xs sm:text-sm"
                    } font-bold shadow-lg focus:outline-none focus:ring-4 ${
                      themeTokens.selectBtn
                    } ${themeTokens.ring} transition cursor-pointer`}
                  >
                    <span className="truncate">
                      {currentEpisodeObj
                        ? `Ep ${currentEpisodeObj.episode_number}: ${currentEpisodeObj.name}`
                        : `Episode ${episode}`}
                    </span>
                    <span className="shrink-0">▾</span>
                  </button>
                  {isEpisodeOpen && (
                    <div
                      className={`rabtv-vidsrc-protected absolute left-0 right-0 mt-2 z-[999] max-h-60 overflow-y-auto rounded-2xl border backdrop-blur-xl p-1 ${themeTokens.dropdownMenu}`}
                    >
                      {seasonEpisodes.length > 0 ? (
                        seasonEpisodes.map((ep: any) => {
                          const epWatched = completedEpisodesSet.has(
                            `s${season}-e${ep.episode_number}`
                          );
                          return (
                            <button
                              key={ep.id}
                              type="button"
                              onClick={() => {
                                setEpisode(ep.episode_number);
                                setIsEpisodeOpen(false);
                              }}
                              className={`w-full flex items-center justify-between gap-2 text-left px-3 py-2 text-xs font-semibold rounded-xl transition cursor-pointer ${
                                episode === ep.episode_number
                                  ? `${themeTokens.bg} text-white font-black`
                                  : `${themeTokens.mutedText} hover:bg-white/10 hover:text-white`
                              }`}
                            >
                              <span className="truncate">
                                Ep {ep.episode_number}: {ep.name}
                              </span>
                              {epWatched && (
                                <span className="text-[10px] text-emerald-300 font-black shrink-0">
                                  ✓
                                </span>
                              )}
                            </button>
                          );
                        })
                      ) : (
                        <div
                          className={`px-3 py-2 text-xs font-bold ${themeTokens.subMutedText}`}
                        >
                          Loading episodes...
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Smart Cross-Season Prev / Next Episode & Synced Autoplay Controls */}
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handlePrevEpisode}
                  disabled={!canGoPrevEpisode}
                  className={`rounded-xl border ${
                    largeButtons ? "px-4 py-3 text-sm" : "px-3.5 py-2.5 text-xs"
                  } font-bold transition disabled:opacity-40 cursor-pointer focus:outline-none focus:ring-2 ${
                    themeTokens.btnSecondary
                  } ${themeTokens.ring}`}
                >
                  ◀ Prev
                </button>
                <button
                  type="button"
                  data-tour="player-next-episode"
                  onClick={handleNextEpisode}
                  disabled={!canGoNextEpisode}
                  className={`rounded-xl ${
                    largeButtons ? "px-5 py-3 text-sm" : "px-4 py-2.5 text-xs"
                  } font-extrabold tracking-wide transition transform hover:-translate-y-0.5 active:scale-95 disabled:opacity-40 cursor-pointer focus:outline-none focus:ring-2 ${
                    themeTokens.nextBtn
                  } ${themeTokens.ring}`}
                >
                  {episode >= currentSeasonMaxEp && nextSeasonObj
                    ? `Season ${nextSeasonObj.season_number} Ep 1 ▶`
                    : canGoNextEpisode
                      ? "Next Episode ▶"
                      : "Season Finale"}
                </button>

                {seasonEpisodes.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowEpisodeDrawer((v) => !v)}
                    className={`rounded-xl border ${
                      largeButtons ? "px-4 py-3 text-sm" : "px-3 py-2.5 text-xs"
                    } font-bold transition cursor-pointer focus:outline-none focus:ring-2 ${
                      themeTokens.btnSecondary
                    } ${themeTokens.ring}`}
                  >
                    📺 {showEpisodeDrawer ? "Hide Guide" : "Episodes"}
                  </button>
                )}

                <label
                  data-tour="player-autoplay"
                  className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold cursor-pointer select-none ${themeStylesAutoplay(
                    themeTokens
                  )}`}
                >
                  <input
                    type="checkbox"
                    checked={autoPlayNext}
                    onChange={(e) => handleToggleAutoPlay(e.target.checked)}
                    className="h-4 w-4 rounded focus:outline-none"
                  />
                  <span>Autoplay</span>
                </label>
              </div>
            </div>

            {/* Expandable Visual Episode Guide Strip */}
            {showEpisodeDrawer && seasonEpisodes.length > 0 && (
              <div
                className={`pt-3 border-t grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-72 overflow-y-auto pr-1 scrollbar-none ${themeTokens.dividerBorder}`}
              >
                {seasonEpisodes.map((ep: any) => {
                  const isActive = ep.episode_number === episode;
                  const isDone = completedEpisodesSet.has(
                    `s${season}-e${ep.episode_number}`
                  );
                  return (
                    <button
                      key={ep.id}
                      type="button"
                      onClick={() => {
                        setEpisode(ep.episode_number);
                        setShowEpisodeDrawer(false);
                      }}
                      className={`flex items-center gap-2.5 rounded-2xl border p-2 text-left transition cursor-pointer ${
                        isActive
                          ? themeTokens.episodeActive
                          : themeTokens.episodeIdle
                      }`}
                    >
                      <div
                        className={`relative h-14 w-24 shrink-0 rounded-xl overflow-hidden border ${themeTokens.episodeThumb}`}
                      >
                        {ep.still_path ? (
                          <img
                            src={`https://image.tmdb.org/t/p/w300${ep.still_path}`}
                            alt={ep.name}
                            loading="lazy"
                            decoding="async"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div
                            className={`flex h-full w-full items-center justify-center text-[10px] font-black ${themeTokens.subMutedText}`}
                          >
                            EP {ep.episode_number}
                          </div>
                        )}
                        {isDone && (
                          <span className="absolute top-1 right-1 rounded-md bg-emerald-600/95 px-1.5 py-0.5 text-[9px] font-black text-white">
                            ✓
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-extrabold text-white truncate">
                          {ep.episode_number}. {ep.name || `Episode ${ep.episode_number}`}
                        </p>
                        <p
                          className={`text-[10px] mt-0.5 ${themeTokens.subMutedText}`}
                        >
                          {ep.runtime ? `${ep.runtime}m` : ""}
                          {ep.runtime && ep.air_date ? " • " : ""}
                          {ep.air_date || ""}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Background Auto-Failover Stream Mirror Bar + Manual Dropdown Menu */}
        <div
          data-tour="server-switcher"
          className={`relative z-30 w-full rounded-2xl border px-3 py-2 flex flex-wrap items-center justify-between gap-2 ${
            isLowRam ? "" : "backdrop-blur-xl"
          } ${themeTokens.surfacePanel}`}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span
              className={`h-2 w-2 rounded-full shrink-0 ${
                serverStatus === "ready"
                  ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]"
                  : "bg-amber-400 animate-pulse shadow-[0_0_8px_rgba(251,191,36,0.9)]"
              }`}
              aria-hidden="true"
            />
            <span
              className={`text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider shrink-0 ${themeTokens.subMutedText}`}
            >
              Auto-Mirror:
            </span>

            {/* Manual Server Dropdown Menu (RABBiT TV Branded Mirrors Only) */}
            <div ref={serverMenuRef} className="relative min-w-0 flex-1 sm:flex-initial sm:w-52">
              <button
                type="button"
                onClick={() => {
                  setIsServerMenuOpen((open) => !open);
                  setIsSeasonOpen(false);
                  setIsEpisodeOpen(false);
                }}
                className={`w-full flex items-center justify-between gap-2 rounded-xl border px-3 ${
                  largeButtons ? "py-2.5 text-xs" : "py-1.5 text-[11px] sm:text-xs"
                } font-extrabold transition cursor-pointer focus:outline-none focus:ring-2 ${themeTokens.selectBtn} ${themeTokens.ring}`}
                aria-haspopup="listbox"
                aria-expanded={isServerMenuOpen}
                title="Switch RABBiT TV Stream Mirror"
              >
                <span className="truncate font-mono text-white">
                  {activeServer}
                </span>
                <span className="shrink-0 opacity-80">▾</span>
              </button>

              {isServerMenuOpen && (
                <div
                  role="listbox"
                  className={`rabtv-vidsrc-protected absolute left-0 right-0 mt-1.5 z-[999] rounded-2xl border backdrop-blur-xl p-1.5 space-y-1 ${themeTokens.dropdownMenu}`}
                >
                  {PLAYER_SERVERS.map((srv) => {
                    const isSelected = activeServer === srv.id;
                    return (
                      <button
                        key={srv.id}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => handleSelectServer(srv.id)}
                        className={`w-full flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold transition cursor-pointer ${
                          isSelected
                            ? `${themeTokens.bg} text-white font-black`
                            : `${themeTokens.mutedText} hover:bg-white/10 hover:text-white`
                        }`}
                      >
                        <span className="font-mono truncate">{srv.label}</span>
                        <span className="text-[10px] opacity-80 shrink-0">
                          {isSelected ? "✓ Active" : srv.tag}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              iframeLoadedRef.current = false;
              setServerStatus("connecting");
              setPlayerReloadNonce((n) => n + 1);
              showToast(`↻ Reloading ${activeServer}...`);
            }}
            className={`shrink-0 rounded-xl border ${
              largeButtons ? "px-3.5 py-2 text-xs" : "px-3 py-1.5 text-[11px]"
            } font-bold whitespace-nowrap transition cursor-pointer focus:outline-none focus:ring-2 ${themeTokens.btnSecondary} ${themeTokens.ring}`}
            title="Reload current stream"
          >
            ↻ Reload
          </button>
        </div>

        {/* Theater-Grade Video Player Container */}
        <div
          data-tour="video-player"
          className={`video-player-container relative w-full mx-auto aspect-video max-h-[75dvh] overflow-hidden rounded-2xl sm:rounded-3xl bg-black border ${
            themeTokens.playerFrame
          } ${cinemaDimMode ? "z-40" : "z-10"} ${
            glowOff ? "shadow-2xl" : themeTokens.playerGlow
          }`}
        >
          <iframe
            key={`stable-player-${activeServer}-${mediaId}-${season}-${episode}-${playerReloadNonce}`}
            src={embedUrl}
            referrerPolicy="origin"
            onLoad={() => {
              iframeLoadedRef.current = true;
              setServerStatus("ready");
            }}
            onError={() => {
              if (!iframeLoadedRef.current) {
                triggerBackgroundFailover(`${activeServer} failed`);
              }
            }}
            className="h-full w-full border-0"
            allowFullScreen
            allow="autoplay; encrypted-media; picture-in-picture; accelerometer; gyroscope"
          ></iframe>
        </div>

        {/* Unified High-End Cinema Metadata, Quick Actions & Overview Panel */}
        <div
          data-tour="details-metadata"
          className={`relative overflow-hidden w-full rounded-3xl border ${
            isLowRam ? "" : "backdrop-blur-md"
          } p-4 sm:p-7 flex flex-col gap-4 ${themeTokens.surfacePanel}`}
        >
          <div
            className={`flex flex-col md:flex-row md:items-center justify-between gap-3 border-b pb-4 ${themeTokens.dividerBorder}`}
          >
            <div className="space-y-2 text-left min-w-0">
              <div className="flex items-center flex-wrap gap-2">
                <span
                  className={`rounded-full border px-3 py-0.5 text-[10px] font-bold uppercase tracking-widest ${themeTokens.badge}`}
                >
                  {genres}
                </span>
                {inferredMediaType === "tv" && (
                  <span
                    className={`rounded-full border px-3 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${themeTokens.badge}`}
                  >
                    Season {season} • Episode {episode}
                  </span>
                )}
                {runtimeMinutes && (
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${themeTokens.subtleBadge}`}
                  >
                    {runtimeMinutes} min
                  </span>
                )}
              </div>

              <h1 className="text-xl sm:text-3xl md:text-4xl font-black text-white tracking-tight leading-tight">
                {title}
                {inferredMediaType === "tv" && currentEpisodeObj?.name
                  ? ` — ${currentEpisodeObj.name}`
                  : ""}
              </h1>
            </div>

            {/* Right Metadata Pills & IMDb Quick Link */}
            <div className="flex items-center flex-wrap gap-2 shrink-0">
              {rating !== "N/A" && (
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-extrabold ${themeTokens.badge}`}
                >
                  ★ {rating}
                </span>
              )}
              {releaseYear && (
                <span
                  className={`rounded-full border px-3 py-1.5 text-xs font-bold ${themeTokens.subtleBadge}`}
                >
                  {releaseYear}
                </span>
              )}
              <span
                data-tour="finish-time"
                className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-bold ${themeTokens.badge}`}
              >
                <span>⏱️ Finish:</span>
                <strong className="text-white">{estimatedCompletion}</strong>
              </span>
              <a
                href={imdbLink}
                target="_blank"
                rel="noopener noreferrer"
                data-tour="imdb-link"
                className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-extrabold transition transform hover:scale-105 focus:outline-none focus:ring-2 ${themeTokens.btnSecondary} ${themeTokens.ring}`}
                title="View Official IMDb Listing"
              >
                <span>⭐ IMDb</span>
              </a>
            </div>
          </div>

          {/* Cinema Quick Actions Toolbar (My List, Mark Watched, Report Broken, Dislike) */}
          <div className="flex flex-wrap items-center gap-2 pb-1">
            <button
              type="button"
              onClick={handleToggleMyList}
              className={`rounded-xl border ${pillBtnPadding} font-extrabold transition cursor-pointer focus:outline-none focus:ring-2 ${
                inMyList ? themeTokens.btnActivePill : themeTokens.btnSecondary
              } ${themeTokens.ring}`}
            >
              {inMyList ? "✓ In My List" : "🔖 Add to My List"}
            </button>

            <button
              type="button"
              onClick={handleToggleWatched}
              className={`rounded-xl border ${pillBtnPadding} font-extrabold transition cursor-pointer focus:outline-none focus:ring-2 ${
                isCurrentItemWatched
                  ? "bg-emerald-500/25 border-emerald-400/60 text-emerald-200"
                  : themeTokens.btnSecondary
              } ${themeTokens.ring}`}
            >
              {isCurrentItemWatched ? "👁️ ✓ Watched" : "👁️ Mark Watched"}
            </button>

            <button
              type="button"
              data-tour="report-broken"
              onClick={handleReportBrokenStream}
              className={`rounded-xl border ${pillBtnPadding} font-extrabold transition cursor-pointer focus:outline-none focus:ring-2 ${themeTokens.btnSecondary} ${themeTokens.ring}`}
              title="Report if this stream fails to load"
            >
              🚩 Report Broken Stream
            </button>

            <button
              type="button"
              onClick={handleDislikeTitle}
              className={`rounded-xl border ${pillBtnPadding} font-bold transition cursor-pointer focus:outline-none focus:ring-2 ${themeTokens.btnSecondary} ${themeTokens.ring}`}
              title="Hide this title from catalogs"
            >
              👎 Dislike
            </button>
          </div>

          {/* Overview Paragraph */}
          <div className="space-y-1.5 text-left">
            <h3
              className={`text-[10px] uppercase tracking-widest font-extrabold ${themeTokens.subMutedText}`}
            >
              Synopsis & Overview
            </h3>
            <p
              className={`text-xs sm:text-sm md:text-base leading-relaxed max-w-4xl ${themeTokens.mutedText}`}
            >
              {inferredMediaType === "tv" && currentEpisodeObj?.overview
                ? currentEpisodeObj.overview
                : overview}
            </p>
          </div>

          {/* Neon Bottom Laser Accent Line */}
          {!glowOff && (
            <div
              className={`absolute inset-x-6 bottom-0 h-[2px] bg-gradient-to-r ${themeTokens.laserLine} opacity-85`}
            />
          )}
        </div>

        {/* Top Cast Strip (Zero Extra API Calls — Tap Any Actor for Filmography!) */}
        {topCast.length > 0 && (
          <section className="w-full space-y-3 pt-1">
            <div className="flex items-center gap-2.5 px-1">
              <span
                className={`w-1.5 h-6 rounded-full shrink-0 ${themeTokens.accentBar}`}
              />
              <h2 className="text-base sm:text-lg font-black tracking-tight text-white">
                🎭 Starring Cast
              </h2>
            </div>

            <div className="flex gap-4 overflow-x-auto pb-2 px-1 scrollbar-none">
              {topCast.map((actor: any) => (
                <button
                  key={actor.id}
                  type="button"
                  onClick={() =>
                    navigate({ to: "/search", search: { q: actor.name } })
                  }
                  className="group flex flex-col items-center text-center shrink-0 w-20 sm:w-24 cursor-pointer focus:outline-none"
                  title={`Search titles starring ${actor.name}`}
                >
                  <div
                    className={`p-[2px] rounded-full bg-gradient-to-tr ${themeTokens.avatarRing} shadow-lg group-hover:scale-105 transition-transform mb-1.5`}
                  >
                    <div
                      className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden border-2 flex items-center justify-center ${themeTokens.avatarFrame}`}
                    >
                      {actor.profilePath ? (
                        <img
                          src={`https://image.tmdb.org/t/p/w185${actor.profilePath}`}
                          alt={actor.name}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-xl">🎭</span>
                      )}
                    </div>
                  </div>
                  <span className="text-[11px] font-bold text-white truncate w-full">
                    {actor.name}
                  </span>
                  {actor.character && (
                    <span
                      className={`text-[9px] truncate w-full ${themeTokens.subMutedText}`}
                    >
                      {actor.character}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Similar Recommended Titles */}
        {mappedRecommendations.length > 0 && (
          <div
            className={`rabtv-vidsrc-protected w-full mt-2 pt-6 border-t space-y-4 ${themeTokens.dividerBorder}`}
          >
            <div className="rabtv-vidsrc-protected rabtv-plr-heading-ribbon mb-3">
              <div
                className="rabtv-vidsrc-protected rabtv-plr-heading-bg"
                aria-hidden="true"
                style={{
                  backgroundImage: `url(${BUTTON_WRAPPER_URL})`,
                }}
              />
              <h2 className="rabtv-vidsrc-protected rabtv-plr-heading-title font-black tracking-tight text-white truncate drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)]">
                ✨ Similar Recommended Titles
              </h2>
            </div>

            <div className={gridColsClass}>
              {mappedRecommendations.map((item) => (
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
    </div>
  );
}

function themeStylesAutoplay(tokens: PlayerThemeTokens): string {
  return `${tokens.subtleBadge}`;
}