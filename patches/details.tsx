// src/routes/details.tsx
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import React, { useState, useEffect, useRef, useMemo, useCallback, memo } from "react";
import {
  AppTheme,
  CardSize,
  PosterAppearanceClasses,
  getSavedTheme,
  getSavedCardSize,
  getSavedUserAge,
  isAllowedForAge,
  getPosterAppearanceClasses,
  getOptimalTmdbImageWidth,
  getHardwareLimits,
  getReducedMotion,
  getLargeButtons,
  getGlowIntensity,
  getClockFormat,
  formatAppTime,
  getKidsModeLocked,
  purgeOldTmdbCaches,
} from "@/lib/settings";
import { reportBrokenLink, isTitleBroken } from "@/lib/broken-links";
import { MediaCard } from "@/routes/index";
import type { MediaItem } from "@/lib/tmdb-scraper";
import {
  saveWatchProgress,
  getRawWatchHistory,
  isTitleDisliked,
} from "@/lib/watch-history";
import { AppWallpaper } from "@/components/AppWallpaper";
import { TitleCommunitySection } from "@/components/TitleCommunitySection";
import { bgAudio } from "@/lib/background-audio";
import {
  getCustomShelves,
  createCustomShelf,
  toggleItemInShelf,
  getShelfIdsForItem,
  CUSTOM_SHELVES_EVENT,
  SHELF_ICON_PRESETS,
  SHELF_TEMPLATE_SUGGESTIONS,
  type CustomShelf,
} from "@/lib/custom-shelves";
import {
  getCachedEpisodeAlerts,
  EPISODE_RADAR_UPDATED_EVENT,
  type EpisodeRadarAlert,
} from "@/lib/episode-radar";

const MY_LIST_STORAGE_KEY = "rabtv_my_list";
const FAVORITES_STORAGE_KEY = "rabtv_favorites";
const RABBIT_TV_BUTTON_WRAPPER_URL =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-button-wrapper-background.jpg";

const RABBIT_TV_PILL_TRACK_URL =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-pill-track-background.jpg";

const RABBIT_TV_PILL_INACTIVE_URL =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-pill-inactive-dark.jpg";

const RABBIT_TV_PILL_ACTIVE_URL =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-pill-active-crimson.jpg";

const RABBIT_TV_PLAY_PRIMARY_URL =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-button-play-primary.jpg";

const RABBIT_TV_ACTION_SECONDARY_URL =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-button-action-secondary.jpg";

const RABBIT_TV_DETAILS_PANEL_URL =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-details-panel-background.jpg";

const RABBIT_TV_TRAILER_BADGE_URL =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-badge-trailer-square.jpg";

const RABBIT_TV_STAT_CARD_URL =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-stat-card-background.jpg";

const BACK_TO_HOME_BTN_URL =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/Backtohome.png";

/**
 * Viewport-locked layout rules for Details top utility wrapper, Back to Home
 * artwork button, and buttonwrapper-backed section headers across portrait
 * phones, landscape phones, tablets, desktops, TVs, and projectors.
 */
const DETAILS_VIEWPORT_STYLES = `
  /* 6-Theme Hue-Shift Tokens Synced 1:1 with index.tsx for Crimson (#C4282A) / #0C0A09 Plates */
  :root,
  html[data-theme="violet"] {
    --rabtv-dtl-plate-filter: hue-rotate(-78deg) saturate(1.12) brightness(1.02);
    --rabtv-dtl-play-filter: hue-rotate(-74deg) saturate(1.16) brightness(1.05);
  }

  html[data-theme="red"] {
    --rabtv-dtl-plate-filter: hue-rotate(0deg) saturate(1.08) brightness(1.0);
    --rabtv-dtl-play-filter: hue-rotate(0deg) saturate(1.14) brightness(1.04);
  }

  html[data-theme="midnight"] {
    --rabtv-dtl-plate-filter: hue-rotate(-132deg) saturate(1.14) brightness(1.04);
    --rabtv-dtl-play-filter: hue-rotate(-128deg) saturate(1.18) brightness(1.06);
  }

  html[data-theme="emerald"] {
    --rabtv-dtl-plate-filter: hue-rotate(154deg) saturate(1.10) brightness(1.02);
    --rabtv-dtl-play-filter: hue-rotate(150deg) saturate(1.15) brightness(1.04);
  }

  html[data-theme="amber"] {
    --rabtv-dtl-plate-filter: hue-rotate(28deg) saturate(1.14) brightness(1.04);
    --rabtv-dtl-play-filter: hue-rotate(24deg) saturate(1.18) brightness(1.06);
  }

  html[data-theme="cyan"] {
    --rabtv-dtl-plate-filter: hue-rotate(-154deg) saturate(1.12) brightness(1.04);
    --rabtv-dtl-play-filter: hue-rotate(-150deg) saturate(1.16) brightness(1.06);
  }

  /* Top Dual-Wrapper & Section Banners (rabbit-tv-button-wrapper-background.jpg) */
  .rabtv-dtl-action-plate .rabtv-art-bg,
  .rabtv-dtl-banner-plate .rabtv-art-bg {
    background-size: 100% 100%;
    opacity: 0.84;
    filter: var(--rabtv-dtl-plate-filter);
    -webkit-mask-image: radial-gradient(
      ellipse 86% 78% at 50% 50%,
      rgba(12, 10, 9, 1) 66%,
      rgba(12, 10, 9, 0.78) 88%,
      rgba(12, 10, 9, 0.32) 100%
    );
    mask-image: radial-gradient(
      ellipse 86% 78% at 50% 50%,
      rgba(12, 10, 9, 1) 66%,
      rgba(12, 10, 9, 0.78) 88%,
      rgba(12, 10, 9, 0.32) 100%
    );
  }

  /* Main Details Panel, Franchise Shelf & Custom Shelf Modal (rabbit-tv-details-panel-background.jpg) */
  .rabtv-dtl-panel {
    position: relative;
    overflow: hidden;
    background-color: #0c0a09;
    contain: layout paint;
  }

  .rabtv-dtl-panel-bg {
    position: absolute;
    inset: 0;
    background-size: 100% 100%;
    background-position: center center;
    background-repeat: no-repeat;
    opacity: 0.78;
    filter: var(--rabtv-dtl-plate-filter);
    -webkit-mask-image: radial-gradient(
      ellipse 96% 94% at 50% 50%,
      rgba(12, 10, 9, 1) 74%,
      rgba(12, 10, 9, 0.74) 92%,
      rgba(12, 10, 9, 0.34) 100%
    );
    mask-image: radial-gradient(
      ellipse 96% 94% at 50% 50%,
      rgba(12, 10, 9, 1) 74%,
      rgba(12, 10, 9, 0.74) 92%,
      rgba(12, 10, 9, 0.34) 100%
    );
    pointer-events: none;
    z-index: 0;
  }

  .rabtv-dtl-panel-scrim {
    position: absolute;
    inset: 0;
    background: radial-gradient(
      ellipse 82% 80% at 50% 48%,
      rgba(12, 10, 9, 0.54) 0%,
      rgba(12, 10, 9, 0.38) 70%,
      rgba(12, 10, 9, 0.56) 100%
    );
    pointer-events: none;
    z-index: 1;
  }

  /* Floating 1:1 Click-for-Trailer Square Badge (rabbit-tv-badge-trailer-square.jpg) */
  .rabtv-dtl-trailer-badge {
    position: relative;
    overflow: hidden;
    width: 78px;
    height: 78px;
    border-radius: 18px;
    border: 0 !important;
    background-color: #0c0a09;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.85);
    contain: layout paint;
  }

  @media (min-width: 640px) {
    .rabtv-dtl-trailer-badge {
      width: 88px;
      height: 88px;
      border-radius: 20px;
    }
  }

  .rabtv-dtl-trailer-badge-bg {
    position: absolute;
    inset: 0;
    background-size: 100% 100%;
    background-position: center center;
    background-repeat: no-repeat;
    opacity: 0.96;
    filter: var(--rabtv-dtl-play-filter);
    -webkit-mask-image: radial-gradient(
      ellipse 92% 92% at 50% 50%,
      rgba(12, 10, 9, 1) 74%,
      rgba(12, 10, 9, 0.65) 95%,
      transparent 100%
    );
    mask-image: radial-gradient(
      ellipse 92% 92% at 50% 50%,
      rgba(12, 10, 9, 1) 74%,
      rgba(12, 10, 9, 0.65) 95%,
      transparent 100%
    );
    pointer-events: none;
    z-index: 0;
  }

  .rabtv-dtl-trailer-badge-scrim {
    position: absolute;
    inset: 0;
    background: radial-gradient(circle at 50% 50%, rgba(12, 10, 9, 0.44) 0%, rgba(12, 10, 9, 0.14) 100%);
    pointer-events: none;
    z-index: 1;
  }

  /* Primary & Secondary Armored Action Buttons (play-primary & action-secondary) */
  .rabtv-dtl-play-cta,
  .rabtv-dtl-sec-cta {
    position: relative;
    overflow: hidden;
    background-color: #0c0a09;
    border: 0 !important;
    box-shadow: none !important;
    contain: layout paint;
  }

  .rabtv-dtl-play-cta-art {
    position: absolute;
    inset: 0;
    background-size: 100% 100%;
    background-position: center center;
    background-repeat: no-repeat;
    opacity: 0.96;
    filter: var(--rabtv-dtl-play-filter);
    -webkit-mask-image: radial-gradient(
      ellipse 92% 82% at 50% 50%,
      rgba(12, 10, 9, 1) 72%,
      rgba(12, 10, 9, 0.62) 94%,
      transparent 100%
    );
    mask-image: radial-gradient(
      ellipse 92% 82% at 50% 50%,
      rgba(12, 10, 9, 1) 72%,
      rgba(12, 10, 9, 0.62) 94%,
      transparent 100%
    );
    pointer-events: none;
    z-index: 0;
    transition: transform 160ms ease, filter 180ms ease;
  }

  .rabtv-dtl-play-cta:hover .rabtv-dtl-play-cta-art {
    filter: var(--rabtv-dtl-play-filter) brightness(1.12);
    transform: scale(1.03);
  }

  .rabtv-dtl-sec-cta-art {
    position: absolute;
    inset: 0;
    background-size: 100% 100%;
    background-position: center center;
    background-repeat: no-repeat;
    opacity: 0.90;
    filter: var(--rabtv-dtl-plate-filter) brightness(0.96);
    -webkit-mask-image: radial-gradient(
      ellipse 92% 82% at 50% 50%,
      rgba(12, 10, 9, 1) 70%,
      rgba(12, 10, 9, 0.58) 93%,
      transparent 100%
    );
    mask-image: radial-gradient(
      ellipse 92% 82% at 50% 50%,
      rgba(12, 10, 9, 1) 70%,
      rgba(12, 10, 9, 0.58) 93%,
      transparent 100%
    );
    pointer-events: none;
    z-index: 0;
    transition: transform 160ms ease, filter 180ms ease, opacity 160ms ease;
  }

  .rabtv-dtl-sec-cta:hover .rabtv-dtl-sec-cta-art {
    opacity: 1;
    filter: var(--rabtv-dtl-plate-filter) brightness(1.10);
    transform: scale(1.03);
  }

  .rabtv-dtl-play-cta-scrim {
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse 76% 68% at 50% 50%, rgba(12, 10, 9, 0.42) 0%, rgba(12, 10, 9, 0.14) 100%);
    pointer-events: none;
    z-index: 1;
  }

  .rabtv-dtl-sec-cta-scrim {
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse 76% 68% at 50% 50%, rgba(12, 10, 9, 0.48) 0%, rgba(12, 10, 9, 0.18) 100%);
    pointer-events: none;
    z-index: 1;
  }

  .rabtv-dtl-cta-content {
    position: relative;
    z-index: 2;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-width: 0;
    max-width: 100%;
    text-shadow: 0 1px 4px rgba(12, 10, 9, 0.96), 0 0 10px rgba(12, 10, 9, 0.85);
  }

  /* TV Season / Episode Selector Recessed Track & Pill Triggers */
  .rabtv-dtl-pill-track {
    position: relative;
    background-color: #0c0a09;
    overflow: visible;
  }

  .rabtv-dtl-pill-track-bg {
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background-size: 100% 100%;
    background-position: center center;
    background-repeat: no-repeat;
    opacity: 0.78;
    filter: var(--rabtv-dtl-plate-filter);
    pointer-events: none;
    z-index: 0;
  }

  .rabtv-dtl-pill-track-scrim {
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: linear-gradient(180deg, rgba(12, 10, 9, 0.36) 0%, rgba(12, 10, 9, 0.52) 100%);
    pointer-events: none;
    z-index: 1;
  }

  .rabtv-dtl-pill-trigger {
    position: relative;
    overflow: hidden;
    background-color: #0c0a09;
    border: 0 !important;
    contain: layout paint;
  }

  /* Budget / Production / Language Stat Cards (rabbit-tv-stat-card-background.jpg) */
  .rabtv-dtl-stat-card {
    position: relative;
    overflow: hidden;
    background-color: #0c0a09;
    border: 0 !important;
    contain: layout paint;
  }

  .rabtv-dtl-stat-card-bg {
    position: absolute;
    inset: 0;
    background-size: 100% 100%;
    background-position: center center;
    background-repeat: no-repeat;
    opacity: 0.92;
    filter: var(--rabtv-dtl-plate-filter);
    -webkit-mask-image: radial-gradient(
      ellipse 94% 88% at 50% 50%,
      rgba(12, 10, 9, 1) 74%,
      rgba(12, 10, 9, 0.70) 93%,
      rgba(12, 10, 9, 0.34) 100%
    );
    mask-image: radial-gradient(
      ellipse 94% 88% at 50% 50%,
      rgba(12, 10, 9, 1) 74%,
      rgba(12, 10, 9, 0.70) 93%,
      rgba(12, 10, 9, 0.34) 100%
    );
    pointer-events: none;
    z-index: 0;
  }

  .rabtv-dtl-stat-card-scrim {
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, rgba(12, 10, 9, 0.42) 0%, rgba(12, 10, 9, 0.30) 76%, rgba(12, 10, 9, 0.12) 100%);
    pointer-events: none;
    z-index: 1;
  }
`;

export const Route = createFileRoute("/details")({
  component: DetailsPage,
  validateSearch: (search: Record<string, unknown>) => ({
    id: search.id != null ? String(search.id) : "",
    type: search.type != null ? String(search.type).toLowerCase() : "movie",
  }),
});

interface DetailsThemeTokens {
  pageBg: string;
  baseText: string;
  mutedText: string;
  subMutedText: string;
  text: string;
  textLight: string;
  bg: string;
  border: string;
  ring: string;
  accentBar: string;
  badge: string;
  subtleBadge: string;
  surfacePanel: string;
  subPanel: string;
  dropdownMenu: string;
  selectBtn: string;
  dividerBorder: string;
  backCapsule: string;
  backBadge: string;
  posterShadow: string;
  trailerBtn: string;
  trailerPlayDot: string;
  trailerBackBg: string;
  playBtn: string;
  btnSecondary: string;
  btnActive: string;
  statCard: string;
  avatarFrame: string;
  avatarRing: string;
  avatarGlow: string;
  ambient: string;
  laserLine: string;
  arrow: string;
}

function getDetailsThemeTokens(theme: AppTheme): DetailsThemeTokens {
  switch (theme) {
    case "red":
      return {
        pageBg: "bg-gradient-to-br from-zinc-950/65 via-red-950/30 to-black/75",
        baseText: "text-zinc-100",
        mutedText: "text-zinc-300",
        subMutedText: "text-zinc-400",
        text: "text-red-400",
        textLight: "text-red-200",
        bg: "bg-red-600",
        border: "border-red-500",
        ring: "focus:ring-red-500",
        accentBar: "bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.95)]",
        badge: "text-red-200 border-red-500/35 bg-red-950/75",
        subtleBadge: "text-zinc-200 border-red-500/25 bg-black/75",
        surfacePanel:
          "bg-zinc-950/68 border-red-500/30 shadow-[0_16px_50px_rgba(239,68,68,0.18)]",
        subPanel: "bg-black/70 border-red-500/25",
        dropdownMenu: "bg-zinc-950/98 border-red-500/35 shadow-2xl",
        selectBtn:
          "border-red-500/30 bg-black/75 text-white hover:border-red-400/60",
        dividerBorder: "border-red-500/20",
        backCapsule:
          "bg-zinc-950/88 hover:bg-red-950/80 border-red-500/35 hover:border-red-400 text-zinc-100 hover:text-white",
        backBadge:
          "bg-gradient-to-tr from-red-600/60 via-rose-500/50 to-orange-500/50 border-red-400/50 text-white",
        posterShadow:
          "border-red-500/35 shadow-[0_20px_50px_rgba(0,0,0,0.9),0_0_26px_rgba(239,68,68,0.25)]",
        trailerBtn:
          "bg-zinc-950/85 hover:bg-red-950/90 border-red-400/55 hover:border-red-300 text-red-100 shadow-[0_0_20px_rgba(239,68,68,0.4)]",
        trailerPlayDot:
          "border-red-300/75 bg-gradient-to-tr from-red-600/70 to-orange-500/60 text-white",
        trailerBackBg: "from-zinc-950/95 via-red-950/40 to-black/95",
        playBtn:
          "bg-gradient-to-r from-red-600 via-rose-600 to-orange-600 text-white shadow-[0_0_25px_rgba(239,68,68,0.45)] hover:shadow-[0_0_35px_rgba(239,68,68,0.7)]",
        btnSecondary:
          "bg-zinc-950/85 hover:bg-red-950/70 border-red-500/35 hover:border-red-400 text-red-100 hover:text-white",
        btnActive:
          "bg-red-600/35 border-red-400 text-white shadow-[0_0_22px_rgba(239,68,68,0.45)]",
        statCard:
          "bg-zinc-950/85 border-red-500/25 hover:border-red-400/60 shadow-[0_10px_28px_rgba(0,0,0,0.65)]",
        avatarFrame: "bg-zinc-950 border-zinc-950",
        avatarRing: "from-red-500 via-rose-400 to-orange-400",
        avatarGlow:
          "shadow-[0_0_16px_rgba(239,68,68,0.3)] group-hover:shadow-[0_0_24px_rgba(239,68,68,0.55)]",
        ambient: "from-red-600/18 via-transparent to-transparent",
        laserLine: "from-transparent via-red-500 to-rose-400",
        arrow: "text-red-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.85)]",
      };
    case "midnight":
      return {
        pageBg:
          "bg-gradient-to-br from-slate-950/65 via-blue-950/30 to-black/75",
        baseText: "text-slate-100",
        mutedText: "text-slate-300",
        subMutedText: "text-slate-400",
        text: "text-sky-300",
        textLight: "text-sky-100",
        bg: "bg-blue-600",
        border: "border-blue-500",
        ring: "focus:ring-sky-400",
        accentBar: "bg-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.95)]",
        badge: "text-sky-200 border-blue-500/35 bg-blue-950/75",
        subtleBadge: "text-slate-200 border-blue-500/25 bg-black/75",
        surfacePanel:
          "bg-slate-950/68 border-blue-500/30 shadow-[0_16px_50px_rgba(59,130,246,0.18)]",
        subPanel: "bg-black/70 border-blue-500/25",
        dropdownMenu: "bg-slate-950/98 border-blue-500/35 shadow-2xl",
        selectBtn:
          "border-blue-500/30 bg-black/75 text-white hover:border-sky-400/60",
        dividerBorder: "border-blue-500/20",
        backCapsule:
          "bg-slate-950/88 hover:bg-blue-950/80 border-blue-500/35 hover:border-sky-400 text-slate-100 hover:text-white",
        backBadge:
          "bg-gradient-to-tr from-blue-600/60 via-sky-500/50 to-cyan-400/50 border-sky-400/50 text-white",
        posterShadow:
          "border-blue-500/35 shadow-[0_20px_50px_rgba(0,0,0,0.9),0_0_26px_rgba(59,130,246,0.25)]",
        trailerBtn:
          "bg-slate-950/85 hover:bg-blue-950/90 border-sky-400/55 hover:border-sky-300 text-sky-100 shadow-[0_0_20px_rgba(56,189,248,0.4)]",
        trailerPlayDot:
          "border-sky-300/75 bg-gradient-to-tr from-blue-600/70 to-cyan-500/60 text-white",
        trailerBackBg: "from-slate-950/95 via-blue-950/40 to-black/95",
        playBtn:
          "bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-500 text-white shadow-[0_0_25px_rgba(56,189,248,0.45)] hover:shadow-[0_0_35px_rgba(56,189,248,0.7)]",
        btnSecondary:
          "bg-slate-950/85 hover:bg-blue-950/70 border-blue-500/35 hover:border-sky-400 text-blue-100 hover:text-white",
        btnActive:
          "bg-blue-600/35 border-sky-400 text-white shadow-[0_0_22px_rgba(56,189,248,0.45)]",
        statCard:
          "bg-slate-950/85 border-blue-500/25 hover:border-sky-400/60 shadow-[0_10px_28px_rgba(0,0,0,0.65)]",
        avatarFrame: "bg-slate-950 border-slate-950",
        avatarRing: "from-cyan-400 via-sky-500 to-blue-500",
        avatarGlow:
          "shadow-[0_0_16px_rgba(59,130,246,0.3)] group-hover:shadow-[0_0_24px_rgba(56,189,248,0.55)]",
        ambient: "from-blue-600/18 via-transparent to-transparent",
        laserLine: "from-transparent via-sky-400 to-blue-500",
        arrow: "text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.85)]",
      };
    case "emerald":
      return {
        pageBg:
          "bg-gradient-to-br from-neutral-950/65 via-emerald-950/30 to-black/75",
        baseText: "text-neutral-100",
        mutedText: "text-neutral-300",
        subMutedText: "text-neutral-400",
        text: "text-emerald-300",
        textLight: "text-emerald-100",
        bg: "bg-emerald-600",
        border: "border-emerald-500",
        ring: "focus:ring-emerald-400",
        accentBar: "bg-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.95)]",
        badge: "text-emerald-200 border-emerald-500/35 bg-emerald-950/75",
        subtleBadge: "text-neutral-200 border-emerald-500/25 bg-black/75",
        surfacePanel:
          "bg-neutral-950/68 border-emerald-500/30 shadow-[0_16px_50px_rgba(16,185,129,0.18)]",
        subPanel: "bg-black/70 border-emerald-500/25",
        dropdownMenu: "bg-neutral-950/98 border-emerald-500/35 shadow-2xl",
        selectBtn:
          "border-emerald-500/30 bg-black/75 text-white hover:border-emerald-400/60",
        dividerBorder: "border-emerald-500/20",
        backCapsule:
          "bg-neutral-950/88 hover:bg-emerald-950/80 border-emerald-500/35 hover:border-emerald-400 text-neutral-100 hover:text-white",
        backBadge:
          "bg-gradient-to-tr from-emerald-600/60 via-teal-500/50 to-green-400/50 border-emerald-400/50 text-white",
        posterShadow:
          "border-emerald-500/35 shadow-[0_20px_50px_rgba(0,0,0,0.9),0_0_26px_rgba(16,185,129,0.25)]",
        trailerBtn:
          "bg-neutral-950/85 hover:bg-emerald-950/90 border-emerald-400/55 hover:border-emerald-300 text-emerald-100 shadow-[0_0_20px_rgba(16,185,129,0.4)]",
        trailerPlayDot:
          "border-emerald-300/75 bg-gradient-to-tr from-emerald-600/70 to-teal-500/60 text-white",
        trailerBackBg: "from-neutral-950/95 via-emerald-950/40 to-black/95",
        playBtn:
          "bg-gradient-to-r from-emerald-600 via-teal-600 to-green-600 text-white shadow-[0_0_25px_rgba(52,211,153,0.45)] hover:shadow-[0_0_35px_rgba(52,211,153,0.7)]",
        btnSecondary:
          "bg-neutral-950/85 hover:bg-emerald-950/70 border-emerald-500/35 hover:border-emerald-400 text-emerald-100 hover:text-white",
        btnActive:
          "bg-emerald-600/35 border-emerald-400 text-white shadow-[0_0_22px_rgba(52,211,153,0.45)]",
        statCard:
          "bg-neutral-950/85 border-emerald-500/25 hover:border-emerald-400/60 shadow-[0_10px_28px_rgba(0,0,0,0.65)]",
        avatarFrame: "bg-neutral-950 border-neutral-950",
        avatarRing: "from-emerald-400 via-teal-400 to-green-500",
        avatarGlow:
          "shadow-[0_0_16px_rgba(16,185,129,0.3)] group-hover:shadow-[0_0_24px_rgba(52,211,153,0.55)]",
        ambient: "from-emerald-600/18 via-transparent to-transparent",
        laserLine: "from-transparent via-emerald-400 to-teal-400",
        arrow: "text-emerald-300 drop-shadow-[0_0_8px_rgba(110,231,183,0.85)]",
      };
    case "amber":
      return {
        pageBg:
          "bg-gradient-to-br from-stone-950/65 via-yellow-950/30 to-black/75",
        baseText: "text-stone-100",
        mutedText: "text-stone-300",
        subMutedText: "text-stone-400",
        text: "text-amber-300",
        textLight: "text-amber-100",
        bg: "bg-amber-600",
        border: "border-amber-500",
        ring: "focus:ring-amber-400",
        accentBar: "bg-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.95)]",
        badge: "text-amber-200 border-amber-500/35 bg-amber-950/75",
        subtleBadge: "text-stone-200 border-amber-500/25 bg-black/75",
        surfacePanel:
          "bg-stone-950/68 border-amber-500/30 shadow-[0_16px_50px_rgba(245,158,11,0.18)]",
        subPanel: "bg-black/70 border-amber-500/25",
        dropdownMenu: "bg-stone-950/98 border-amber-500/35 shadow-2xl",
        selectBtn:
          "border-amber-500/30 bg-black/75 text-white hover:border-amber-400/60",
        dividerBorder: "border-amber-500/20",
        backCapsule:
          "bg-stone-950/88 hover:bg-amber-950/80 border-amber-500/35 hover:border-amber-400 text-stone-100 hover:text-white",
        backBadge:
          "bg-gradient-to-tr from-amber-600/60 via-yellow-500/50 to-orange-500/50 border-amber-400/50 text-white",
        posterShadow:
          "border-amber-500/35 shadow-[0_20px_50px_rgba(0,0,0,0.9),0_0_26px_rgba(245,158,11,0.25)]",
        trailerBtn:
          "bg-stone-950/85 hover:bg-amber-950/90 border-amber-400/55 hover:border-amber-300 text-amber-100 shadow-[0_0_20px_rgba(245,158,11,0.4)]",
        trailerPlayDot:
          "border-amber-300/75 bg-gradient-to-tr from-amber-600/70 to-orange-500/60 text-white",
        trailerBackBg: "from-stone-950/95 via-amber-950/40 to-black/95",
        playBtn:
          "bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 text-white shadow-[0_0_25px_rgba(245,158,11,0.45)] hover:shadow-[0_0_35px_rgba(245,158,11,0.7)]",
        btnSecondary:
          "bg-stone-950/85 hover:bg-amber-950/70 border-amber-500/35 hover:border-amber-400 text-amber-100 hover:text-white",
        btnActive:
          "bg-amber-600/35 border-amber-400 text-white shadow-[0_0_22px_rgba(245,158,11,0.45)]",
        statCard:
          "bg-stone-950/85 border-amber-500/25 hover:border-amber-400/60 shadow-[0_10px_28px_rgba(0,0,0,0.65)]",
        avatarFrame: "bg-stone-950 border-stone-950",
        avatarRing: "from-amber-400 via-yellow-400 to-orange-500",
        avatarGlow:
          "shadow-[0_0_16px_rgba(245,158,11,0.3)] group-hover:shadow-[0_0_24px_rgba(245,158,11,0.55)]",
        ambient: "from-amber-600/18 via-transparent to-transparent",
        laserLine: "from-transparent via-amber-400 to-orange-500",
        arrow: "text-amber-300 drop-shadow-[0_0_8px_rgba(252,211,77,0.85)]",
      };
    case "cyan":
      return {
        pageBg:
          "bg-gradient-to-br from-slate-950/65 via-cyan-950/30 to-black/75",
        baseText: "text-slate-100",
        mutedText: "text-slate-300",
        subMutedText: "text-slate-400",
        text: "text-cyan-300",
        textLight: "text-cyan-100",
        bg: "bg-cyan-600",
        border: "border-cyan-500",
        ring: "focus:ring-cyan-400",
        accentBar: "bg-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.95)]",
        badge: "text-cyan-200 border-cyan-500/35 bg-cyan-950/75",
        subtleBadge: "text-slate-200 border-cyan-500/25 bg-black/75",
        surfacePanel:
          "bg-slate-950/68 border-cyan-500/30 shadow-[0_16px_50px_rgba(6,182,212,0.18)]",
        subPanel: "bg-black/70 border-cyan-500/25",
        dropdownMenu: "bg-slate-950/98 border-cyan-500/35 shadow-2xl",
        selectBtn:
          "border-cyan-500/30 bg-black/75 text-white hover:border-cyan-400/60",
        dividerBorder: "border-cyan-500/20",
        backCapsule:
          "bg-slate-950/88 hover:bg-cyan-950/80 border-cyan-500/35 hover:border-cyan-400 text-slate-100 hover:text-white",
        backBadge:
          "bg-gradient-to-tr from-cyan-600/60 via-teal-500/50 to-sky-400/50 border-cyan-400/50 text-white",
        posterShadow:
          "border-cyan-500/35 shadow-[0_20px_50px_rgba(0,0,0,0.9),0_0_26px_rgba(6,182,212,0.25)]",
        trailerBtn:
          "bg-slate-950/85 hover:bg-cyan-950/90 border-cyan-400/55 hover:border-cyan-300 text-cyan-100 shadow-[0_0_20px_rgba(6,182,212,0.4)]",
        trailerPlayDot:
          "border-cyan-300/75 bg-gradient-to-tr from-cyan-600/70 to-teal-500/60 text-white",
        trailerBackBg: "from-slate-950/95 via-cyan-950/40 to-black/95",
        playBtn:
          "bg-gradient-to-r from-cyan-600 via-teal-600 to-blue-600 text-white shadow-[0_0_25px_rgba(34,211,238,0.45)] hover:shadow-[0_0_35px_rgba(34,211,238,0.7)]",
        btnSecondary:
          "bg-slate-950/85 hover:bg-cyan-950/70 border-cyan-500/35 hover:border-cyan-400 text-cyan-100 hover:text-white",
        btnActive:
          "bg-cyan-600/35 border-cyan-400 text-white shadow-[0_0_22px_rgba(34,211,238,0.45)]",
        statCard:
          "bg-slate-950/85 border-cyan-500/25 hover:border-cyan-400/60 shadow-[0_10px_28px_rgba(0,0,0,0.65)]",
        avatarFrame: "bg-slate-950 border-slate-950",
        avatarRing: "from-cyan-400 via-teal-400 to-sky-500",
        avatarGlow:
          "shadow-[0_0_16px_rgba(6,182,212,0.3)] group-hover:shadow-[0_0_24px_rgba(34,211,238,0.55)]",
        ambient: "from-cyan-600/18 via-transparent to-transparent",
        laserLine: "from-transparent via-cyan-400 to-teal-400",
        arrow: "text-cyan-300 drop-shadow-[0_0_8px_rgba(103,232,249,0.85)]",
      };
    case "violet":
    default:
      return {
        pageBg:
          "bg-gradient-to-br from-slate-950/65 via-purple-950/30 to-black/75",
        baseText: "text-slate-100",
        mutedText: "text-slate-300",
        subMutedText: "text-slate-400",
        text: "text-violet-300",
        textLight: "text-violet-100",
        bg: "bg-violet-600",
        border: "border-violet-500",
        ring: "focus:ring-violet-400",
        accentBar: "bg-violet-500 shadow-[0_0_15px_rgba(139,92,246,0.95)]",
        badge: "text-violet-200 border-violet-500/35 bg-purple-950/75",
        subtleBadge: "text-slate-200 border-violet-500/25 bg-black/75",
        surfacePanel:
          "bg-slate-950/68 border-violet-500/30 shadow-[0_16px_50px_rgba(139,92,246,0.18)]",
        subPanel: "bg-black/70 border-violet-500/25",
        dropdownMenu: "bg-slate-950/98 border-violet-500/35 shadow-2xl",
        selectBtn:
          "border-violet-500/30 bg-black/75 text-white hover:border-violet-400/60",
        dividerBorder: "border-violet-500/20",
        backCapsule:
          "bg-slate-950/88 hover:bg-purple-950/80 border-violet-500/35 hover:border-violet-400 text-slate-100 hover:text-white",
        backBadge:
          "bg-gradient-to-tr from-violet-600/60 via-purple-500/50 to-indigo-500/50 border-violet-400/50 text-white",
        posterShadow:
          "border-violet-500/35 shadow-[0_20px_50px_rgba(0,0,0,0.9),0_0_26px_rgba(139,92,246,0.25)]",
        trailerBtn:
          "bg-slate-950/85 hover:bg-purple-950/90 border-violet-400/55 hover:border-violet-300 text-violet-100 shadow-[0_0_20px_rgba(139,92,246,0.4)]",
        trailerPlayDot:
          "border-violet-300/75 bg-gradient-to-tr from-violet-600/70 to-indigo-500/60 text-white",
        trailerBackBg: "from-slate-950/95 via-purple-950/40 to-black/95",
        playBtn:
          "bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 text-white shadow-[0_0_25px_rgba(139,92,246,0.45)] hover:shadow-[0_0_35px_rgba(139,92,246,0.7)]",
        btnSecondary:
          "bg-slate-950/85 hover:bg-purple-950/70 border-violet-500/35 hover:border-violet-400 text-purple-100 hover:text-white",
        btnActive:
          "bg-violet-600/35 border-violet-400 text-white shadow-[0_0_22px_rgba(139,92,246,0.45)]",
        statCard:
          "bg-slate-950/85 border-violet-500/25 hover:border-violet-400/60 shadow-[0_10px_28px_rgba(0,0,0,0.65)]",
        avatarFrame: "bg-slate-950 border-slate-950",
        avatarRing: "from-violet-400 via-purple-500 to-indigo-500",
        avatarGlow:
          "shadow-[0_0_16px_rgba(139,92,246,0.3)] group-hover:shadow-[0_0_24px_rgba(139,92,246,0.55)]",
        ambient: "from-violet-600/18 via-transparent to-transparent",
        laserLine: "from-transparent via-purple-500 to-violet-400",
        arrow: "text-purple-400 drop-shadow-[0_0_8px_rgba(192,132,252,0.85)]",
      };
  }
}

interface FranchisePart {
  id: string;
  title: string;
  posterPath: string | null;
  releaseDate: string;
  year: string;
  rating?: string;
  adult?: boolean;
}

interface FranchiseCollection {
  id: number;
  name: string;
  parts: FranchisePart[];
}

const COLLECTION_CACHE_TTL_MS = 12 * 60 * 60 * 1000;

function safeSaveCollectionCache(key: string, payload: unknown): void {
  if (typeof window === "undefined") return;
  const serialized = JSON.stringify(payload);
  try {
    localStorage.setItem(key, serialized);
  } catch {
    try {
      purgeOldTmdbCaches();
      localStorage.setItem(key, serialized);
    } catch {
      // ignore if critically full
    }
  }
}

/**
 * Isolated uncontrolled form for creating a new custom shelf inside the picker
 * so Android WebView never flips typed characters.
 */
const CreateShelfInlineForm = memo(function CreateShelfInlineForm({
  activeTheme,
  onCreate,
}: {
  activeTheme: DetailsThemeTokens;
  onCreate: (name: string, icon: string) => { ok: boolean; error?: string };
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedIcon, setSelectedIcon] = useState<string>("🎬");
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const rawName = inputRef.current?.value || "";
    const res = onCreate(rawName, selectedIcon);
    if (!res.ok) {
      setErrMsg(res.error || "Could not create shelf.");
      return;
    }
    setErrMsg(null);
    if (inputRef.current) {
      inputRef.current.value = "";
      inputRef.current.blur();
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={`rounded-2xl border p-3 space-y-2.5 ${activeTheme.subPanel}`}
    >
      <span
        className={`block text-[10px] font-extrabold uppercase tracking-wider ${activeTheme.subMutedText}`}
      >
        + Create New Custom Shelf
      </span>

      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
        {SHELF_ICON_PRESETS.map((ic) => (
          <button
            key={ic}
            type="button"
            onClick={() => setSelectedIcon(ic)}
            className={`h-8 w-8 shrink-0 rounded-xl border text-sm flex items-center justify-center transition cursor-pointer ${
              selectedIcon === ic
                ? `${activeTheme.btnActive} scale-105`
                : activeTheme.btnSecondary
            }`}
            aria-label={`Choose ${ic} icon`}
          >
            {ic}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          dir="ltr"
          maxLength={36}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="e.g. Halloween Marathon"
          style={{ direction: "ltr", unicodeBidi: "plaintext", textAlign: "left" }}
          className={`flex-1 min-w-0 h-10 rounded-xl border px-3 text-xs font-bold focus:outline-none focus:ring-2 ${activeTheme.selectBtn} ${activeTheme.ring}`}
        />
        <button
          type="submit"
          className={`rabtv-dtl-play-cta h-10 px-4 rounded-xl text-xs font-extrabold text-white shrink-0 transition hover:scale-[1.03] active:scale-95 cursor-pointer focus:outline-none focus:ring-2 ${activeTheme.ring}`}
        >
          <span
            className="rabtv-dtl-play-cta-art"
            aria-hidden="true"
            style={{ backgroundImage: `url(${RABBIT_TV_PLAY_PRIMARY_URL})` }}
          />
          <span className="rabtv-dtl-play-cta-scrim" aria-hidden="true" />
          <span className="rabtv-dtl-cta-content">Create & Add</span>
        </button>
      </div>

      {errMsg && (
        <p className="text-[11px] font-bold text-red-400">{errMsg}</p>
      )}
    </form>
  );
});

export function DetailsPage() {
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
  const urlType: "movie" | "tv" =
    inferredType || (search.type === "tv" ? "tv" : "movie");

  const [mediaType, setMediaType] = useState<"movie" | "tv">(urlType);
  const [mediaDetails, setMediaDetails] = useState<any>(null);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
  const [reducedMotion, setReducedMotion] = useState<boolean>(() =>
    getReducedMotion()
  );
  const [largeButtons, setLargeButtons] = useState<boolean>(() =>
    getLargeButtons()
  );
  const [glowOff, setGlowOff] = useState<boolean>(
    () => getGlowIntensity() === "off"
  );
  const [isLowRam, setIsLowRam] = useState<boolean>(
    () => getHardwareLimits().effectiveMode === "low"
  );
  const [clockFormat, setClockFormat] = useState(() => getClockFormat());

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

  // Franchise Collection, Custom Shelves & New Episode Radar state
  const [franchiseCollection, setFranchiseCollection] =
    useState<FranchiseCollection | null>(null);
  const [customShelves, setCustomShelves] = useState<CustomShelf[]>(() =>
    getCustomShelves()
  );
  const [itemShelfIds, setItemShelfIds] = useState<string[]>([]);
  const [showShelfModal, setShowShelfModal] = useState(false);
  const [tvRadarAlert, setTvRadarAlert] = useState<EpisodeRadarAlert | null>(
    null
  );

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
    setFranchiseCollection(null);
    setShowShelfModal(false);
  }, [mediaId, urlType]);

  // Allow Escape key to exit trailer flip or custom shelf modal on TV remotes / keyboards
  useEffect(() => {
    if (!isFlipped && !showShelfModal) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsFlipped(false);
        setShowShelfModal(false);
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isFlipped, showShelfModal]);

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
      if (
        wasAudioPlayingRef.current &&
        typeof (bgAudio as any)?.play === "function"
      ) {
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
        behavior: reducedMotion ? "auto" : "smooth",
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
    let inactivityTimer: ReturnType<typeof setTimeout>;
    const resetInactivityTimer = () => {
      clearTimeout(inactivityTimer);
      setShowScrollReminder(false);
      if (canScrollDown && !reducedMotion) {
        inactivityTimer = setTimeout(() => setShowScrollReminder(true), 30000);
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
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const loadSettings = () => {
      const nextTheme = getSavedTheme();
      setAppTheme(nextTheme);
      setCardSize(getSavedCardSize());
      setUserAge(getSavedUserAge());
      setKidsLocked(getKidsModeLocked());
      setPosterAppearance(getPosterAppearanceClasses(nextTheme));
      setPosterWidth(getOptimalTmdbImageWidth());
      setReducedMotion(getReducedMotion());
      setLargeButtons(getLargeButtons());
      setGlowOff(getGlowIntensity() === "off");
      setIsLowRam(getHardwareLimits().effectiveMode === "low");
      setClockFormat(getClockFormat());
    };
    loadSettings();
    window.addEventListener("storage", loadSettings);
    window.addEventListener("rabtv_settings_updated", loadSettings);
    window.addEventListener("rabtv_ram_mode_updated", loadSettings);
    return () => {
      window.removeEventListener("storage", loadSettings);
      window.removeEventListener("rabtv_settings_updated", loadSettings);
      window.removeEventListener("rabtv_ram_mode_updated", loadSettings);
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
          videos.find(
            (v: any) => v.type === "Trailer" && v.site === "YouTube"
          ) ||
          videos.find((v: any) => v.site === "YouTube") ||
          videos[0];

        if (trailer && trailer.key) {
          setTrailerKey(trailer.key);
        }
      } catch (err) {
        console.error("Failed to fetch trailer from TMDB", err);
      }
    }
    void fetchTrailer();
    return () => {
      active = false;
    };
  }, [mediaId, mediaType]);

  useEffect(() => {
    let active = true;
    async function fetchSeasonEpisodes() {
      if (mediaType !== "tv" || !mediaId) return;
      try {
        const apiKey = import.meta.env.VITE_TMDB_API_KEY as string;
        const res = await fetch(
          `https://api.themoviedb.org/3/tv/${mediaId}/season/${season}?api_key=${apiKey}`
        );
        const data = await res.json();
        if (active) {
          setSeasonEpisodes(data.episodes || []);
        }
      } catch (err) {
        console.error("Failed to load season episodes", err);
        if (active) setSeasonEpisodes([]);
      }
    }
    void fetchSeasonEpisodes();
    return () => {
      active = false;
    };
  }, [season, mediaId, mediaType]);

  const activeTheme = useMemo(
    () => getDetailsThemeTokens(appTheme),
    [appTheme]
  );
  const prefixedId = `${mediaType}-${mediaId}`;

  const mediaStatusBadge = useMemo(() => {
    if (!mediaId) return null;
    const cleanId = String(mediaId);
    const prefId = `${mediaType}-${cleanId}`;

    if (isTitleBroken(cleanId) || isTitleBroken(prefId)) {
      return (
        <span className="absolute top-3.5 left-3.5 z-20 rounded-xl bg-red-600/90 backdrop-blur-md px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-widest text-white border border-red-400/40 shadow-lg">
          ⚠️ Reported Broken
        </span>
      );
    }

    if (isTitleDisliked(cleanId) || isTitleDisliked(prefId)) {
      return (
        <span className="absolute top-3.5 left-3.5 z-20 rounded-xl bg-black/85 backdrop-blur-md px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-widest text-white border border-white/20 shadow-lg">
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
            <span className="absolute top-3.5 left-3.5 z-20 rounded-xl bg-emerald-600/90 backdrop-blur-md px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-widest text-white border border-emerald-400/40 shadow-lg">
              ✓ Completed
            </span>
          );
        }
        if ((match.progressPercent ?? 0) > 0) {
          return (
            <span
              className={`absolute top-3.5 left-3.5 z-20 rounded-xl backdrop-blur-md px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-widest border shadow-lg animate-pulse ${activeTheme.badge}`}
            >
              ⏳ In Progress ({match.progressPercent}%)
            </span>
          );
        }
      }
    } catch (e) {
      console.error("Failed to read watch history badge status", e);
    }

    return null;
  }, [mediaId, mediaType, activeTheme.badge]);

  useEffect(() => {
    if (!mediaId || !mediaDetails) return;
    try {
      const myList = JSON.parse(
        localStorage.getItem(MY_LIST_STORAGE_KEY) || "[]"
      );
      setInMyList(
        Array.isArray(myList) &&
          myList.some(
            (item: any) =>
              item.id === prefixedId || String(item.mediaId) === mediaId
          )
      );
      const favs = JSON.parse(
        localStorage.getItem(FAVORITES_STORAGE_KEY) || "[]"
      );
      setInFavorites(
        Array.isArray(favs) &&
          favs.some(
            (item: any) =>
              item.id === prefixedId || String(item.mediaId) === mediaId
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
          setMediaType(isTv ? "tv" : "movie");
          try {
            localStorage.setItem(
              `rabtv_cache_${activeFetchType}_${mediaId}`,
              JSON.stringify({ data, timestamp: Date.now() })
            );
          } catch {
            // Ignore storage quota errors on 1-2GB sticks
          }
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
                !isTitleBroken(`${activeFetchType}-${item.id}`) &&
                !isTitleDisliked(String(item.id)) &&
                !isTitleDisliked(`${activeFetchType}-${item.id}`)
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

    void fetchDetailsWithCache();
    return () => {
      cancelled = true;
    };
  }, [mediaId, urlType]);

  // Sync Custom Watchlist Shelves & TV New Episode Radar badge
  useEffect(() => {
    const syncShelvesAndRadar = () => {
      setCustomShelves(getCustomShelves());
      setItemShelfIds(getShelfIdsForItem(mediaId, mediaType));
      const alerts = getCachedEpisodeAlerts();
      setTvRadarAlert(mediaType === "tv" ? alerts[mediaId] || null : null);
    };

    syncShelvesAndRadar();
    window.addEventListener(CUSTOM_SHELVES_EVENT, syncShelvesAndRadar);
    window.addEventListener(EPISODE_RADAR_UPDATED_EVENT, syncShelvesAndRadar);
    return () => {
      window.removeEventListener(CUSTOM_SHELVES_EVENT, syncShelvesAndRadar);
      window.removeEventListener(
        EPISODE_RADAR_UPDATED_EVENT,
        syncShelvesAndRadar
      );
    };
  }, [mediaId, mediaType]);

  // Fetch Franchise & Movie Collection from TMDB when movie belongs to a collection
  useEffect(() => {
    const collectionId = Number(mediaDetails?.belongs_to_collection?.id || 0);
    if (
      !collectionId ||
      !Number.isInteger(collectionId) ||
      collectionId <= 0 ||
      mediaType === "tv"
    ) {
      setFranchiseCollection(null);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 7000);
    let cancelled = false;

    async function loadCollection() {
      const cacheKey = `rabtv_collection_${collectionId}`;
      try {
        const cachedRaw = localStorage.getItem(cacheKey);
        if (cachedRaw) {
          const parsed = JSON.parse(cachedRaw);
          if (
            parsed?.collection &&
            Date.now() - (parsed.timestamp || 0) < COLLECTION_CACHE_TTL_MS
          ) {
            if (!cancelled) setFranchiseCollection(parsed.collection);
            return;
          }
        }
      } catch {
        // ignore malformed cache
      }

      try {
        const apiKey = import.meta.env.VITE_TMDB_API_KEY as string;
        if (!apiKey) return;
        const res = await fetch(
          `https://api.themoviedb.org/3/collection/${collectionId}?api_key=${encodeURIComponent(
            apiKey
          )}&language=en-US`,
          { signal: controller.signal }
        );
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled || !data || !Array.isArray(data.parts)) return;

        const parts: FranchisePart[] = data.parts
          .filter((p: any) => p && p.id && (p.title || p.name))
          .map((p: any) => {
            const rel = String(p.release_date || "");
            return {
              id: String(p.id),
              title: String(p.title || p.name),
              posterPath: p.poster_path ? String(p.poster_path) : null,
              releaseDate: rel,
              year: rel ? rel.split("-")[0] : "TBA",
              rating:
                typeof p.vote_average === "number" && p.vote_average > 0
                  ? p.vote_average.toFixed(1)
                  : undefined,
              adult: Boolean(p.adult),
            };
          })
          .sort((a: FranchisePart, b: FranchisePart) => {
            if (!a.releaseDate && !b.releaseDate) return 0;
            if (!a.releaseDate) return 1;
            if (!b.releaseDate) return -1;
            return a.releaseDate.localeCompare(b.releaseDate);
          });

        if (parts.length > 1) {
          const collection: FranchiseCollection = {
            id: collectionId,
            name: String(
              data.name ||
                mediaDetails?.belongs_to_collection?.name ||
                "Movie Collection"
            ),
            parts,
          };
          safeSaveCollectionCache(cacheKey, {
            collection,
            timestamp: Date.now(),
          });
          if (!cancelled) setFranchiseCollection(collection);
        }
      } catch {
        // ignore timeout/abort
      } finally {
        window.clearTimeout(timer);
      }
    }

    void loadCollection();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [mediaDetails?.belongs_to_collection?.id, mediaDetails?.belongs_to_collection?.name, mediaType]);

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

  const runtimeSummary = useMemo(() => {
    const mins =
      inferredMediaType === "movie"
        ? mediaDetails?.runtime
        : mediaDetails?.episode_run_time?.[0];
    if (!mins || typeof mins !== "number" || mins <= 0) return null;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const durationText = h > 0 ? `${h}h ${m}m` : `${m}m`;
    const endsAtText = formatAppTime(Date.now() + mins * 60 * 1000, clockFormat);
    return { durationText, endsAtText };
  }, [mediaDetails, inferredMediaType, clockFormat]);

  const gridColsClass = useMemo(() => {
    if (cardSize === "small") {
      return "grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 sm:gap-4 justify-items-center";
    }
    if (cardSize === "medium") {
      return "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 sm:gap-5 justify-items-center";
    }
    return "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5 justify-items-center";
  }, [cardSize]);

  const mappedRecommendations: MediaItem[] = useMemo(() => {
    return recommendations
      .filter((rec: any) =>
        isAllowedForAge(
          rec.adult ? "R" : undefined,
          rec.media_type === "tv" ? "TV SHOW" : "MOVIE",
          userAge
        )
      )
      .map((rec: any) => {
        const recId = String(rec.id);
        const recTitle = rec.title || rec.name || "Untitled";
        const recPoster = rec.poster_path
          ? `https://image.tmdb.org/t/p/${posterWidth}${rec.poster_path}`
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
  }, [recommendations, posterWidth, userAge, kidsLocked]);

  const buildCatalogItem = () => ({
    id: `${inferredMediaType}-${mediaId}`,
    mediaId: String(mediaId),
    title: mediaDetails?.title || mediaDetails?.name || "Untitled",
    description: mediaDetails?.overview || "",
    image: mediaDetails?.poster_path
      ? `https://image.tmdb.org/t/p/${posterWidth}${mediaDetails.poster_path}`
      : "",
    href: `/details?id=${mediaId}&type=${inferredMediaType}`,
    year: (
      mediaDetails?.release_date ||
      mediaDetails?.first_air_date ||
      ""
    ).split("-")[0],
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
      const myList = JSON.parse(
        localStorage.getItem(MY_LIST_STORAGE_KEY) || "[]"
      );
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
      const favs = JSON.parse(
        localStorage.getItem(FAVORITES_STORAGE_KEY) || "[]"
      );
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
    window.setTimeout(() => {
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

  // Compute chronological franchise progress against Watch History
  const franchiseShelfData = useMemo(() => {
    if (!franchiseCollection || !franchiseCollection.parts.length) return null;

    const history = getRawWatchHistory();
    const completedIds = new Set<string>();
    for (const h of history) {
      if (h.confirmedCompleted || (h.progressPercent ?? 0) >= 100) {
        completedIds.add(
          String(h.mediaId ?? h.id).replace(/^(movie|tv)-/i, "")
        );
      }
    }

    const filteredParts = franchiseCollection.parts
      .filter((p) => {
        if (
          isTitleBroken(p.id) ||
          isTitleBroken(`movie-${p.id}`) ||
          isTitleDisliked(p.id) ||
          isTitleDisliked(`movie-${p.id}`)
        ) {
          return false;
        }
        return isAllowedForAge(p.adult ? "R" : undefined, "MOVIE", userAge);
      })
      .map((p, idx) => ({
        ...p,
        orderNumber: idx + 1,
        isCurrent: p.id === mediaId,
        isWatched: completedIds.has(p.id),
      }));

    if (filteredParts.length <= 1) return null;

    const watchedCount = filteredParts.filter((p) => p.isWatched).length;
    const progressPct = Math.round((watchedCount / filteredParts.length) * 100);

    return {
      name: franchiseCollection.name,
      parts: filteredParts,
      watchedCount,
      totalCount: filteredParts.length,
      progressPct,
    };
  }, [franchiseCollection, mediaId, userAge, kidsLocked]);

  // Also detect freshly aired TV episode directly from already-fetched TMDB details (0 extra API calls!)
  const liveTvFreshBadge = useMemo(() => {
    if (inferredMediaType !== "tv") return null;
    if (tvRadarAlert) return tvRadarAlert;

    const lastEp = mediaDetails?.last_episode_to_air;
    if (!lastEp?.air_date) return null;
    const parts = String(lastEp.air_date).split("-").map(Number);
    if (parts.length !== 3 || parts.some((n) => isNaN(n))) return null;
    const airTs = new Date(parts[0], parts[1] - 1, parts[2]).getTime();
    const now = new Date();
    const todayTs = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    ).getTime();
    const daysAgo = Math.floor((todayTs - airTs) / (24 * 60 * 60 * 1000));
    if (daysAgo < 0 || daysAgo > 14) return null;
    const sNum = Number(lastEp.season_number || 0);
    const eNum = Number(lastEp.episode_number || 0);
    if (sNum <= 0 || eNum <= 0) return null;

    return {
      showId: mediaId,
      showTitle: mediaDetails?.name || "TV Show",
      seasonNumber: sNum,
      episodeNumber: eNum,
      episodeName: String(lastEp.name || `Episode ${eNum}`),
      airDate: String(lastEp.air_date),
      daysAgo,
      badgeLabel:
        daysAgo === 0
          ? `🆕 New S${sNum}E${eNum} Today!`
          : `🆕 New S${sNum}E${eNum} • ${daysAgo}d`,
      checkedAt: Date.now(),
    } as EpisodeRadarAlert;
  }, [inferredMediaType, tvRadarAlert, mediaDetails, mediaId]);

  const handleToggleCustomShelf = useCallback(
    (shelfId: string, shelfName: string) => {
      if (!mediaDetails) return;
      const item = buildCatalogItem();
      const res = toggleItemInShelf(shelfId, {
        id: item.id,
        mediaId: item.mediaId,
        title: item.title,
        description: item.description,
        image: item.image,
        href: item.href,
        genre:
          mediaDetails?.genres?.map((g: any) => g.name).join(", ") ||
          "Entertainment",
        year: item.year,
        rating: item.rating,
        mediaType: inferredMediaType,
      });
      if (res.error) {
        triggerFeedback(res.error);
      } else {
        triggerFeedback(
          res.added
            ? `📚 Added to "${shelfName}"!`
            : `Removed from "${shelfName}".`
        );
      }
      setCustomShelves(getCustomShelves());
      setItemShelfIds(getShelfIdsForItem(mediaId, inferredMediaType));
    },
    [mediaDetails, mediaId, inferredMediaType]
  );

  const handleCreateAndAddShelf = useCallback(
    (name: string, icon: string): { ok: boolean; error?: string } => {
      const created = createCustomShelf(name, icon);
      if (!created.ok || !created.shelf) {
        return { ok: false, error: created.error };
      }
      if (mediaDetails) {
        const item = buildCatalogItem();
        toggleItemInShelf(created.shelf.id, {
          id: item.id,
          mediaId: item.mediaId,
          title: item.title,
          description: item.description,
          image: item.image,
          href: item.href,
          genre: mediaDetails?.genres?.map((g: any) => g.name).join(", ") || "Entertainment",
          year: item.year,
          rating: item.rating,
          mediaType: inferredMediaType,
        });
      }
      setCustomShelves(getCustomShelves());
      setItemShelfIds(getShelfIdsForItem(mediaId, inferredMediaType));
      triggerFeedback(`📚 Created "${created.shelf.name}" & saved title!`);
      return { ok: true };
    },
    [mediaDetails, mediaId, inferredMediaType]
  );

  if (loading) {
    return (
      <div
        className={`flex min-h-screen items-center justify-center ${activeTheme.pageBg} ${activeTheme.baseText} relative rounded-3xl`}
      >
        <AppWallpaper />
        <p
          className={`text-xl font-medium animate-pulse ${activeTheme.text} relative z-10`}
        >
          Loading title details...
        </p>
      </div>
    );
  }

  const title = mediaDetails?.title || mediaDetails?.name || "Sample Content";
  const overview =
    mediaDetails?.overview || "No description available for this title.";
  const poster = mediaDetails?.poster_path
    ? `https://image.tmdb.org/t/p/${posterWidth}${mediaDetails.poster_path}`
    : "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=900&q=80";
  const backdropUrl = mediaDetails?.backdrop_path
    ? `https://image.tmdb.org/t/p/${isLowRam ? "w780" : "original"}${
        mediaDetails.backdrop_path
      }`
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
    mediaDetails?.external_ids?.imdb_id || mediaDetails?.imdb_id || null;
  const imdbLink = imdbId
    ? `https://www.imdb.com/title/${imdbId}/`
    : `https://www.imdb.com/find?q=${encodeURIComponent(title)}`;

  const castList = mediaDetails?.credits?.cast || [];
  const budget =
    mediaDetails?.budget && mediaDetails.budget > 0
      ? `$${mediaDetails.budget.toLocaleString()}`
      : "N/A";
  const productionCompanies =
    mediaDetails?.production_companies?.map((c: any) => c.name).join(", ") ||
    "N/A";

  const currentSeasonObj = mediaDetails?.seasons?.find(
    (s: any) => s.season_number === season
  );
  const currentEpisodeObj = seasonEpisodes?.find(
    (e: any) => e.episode_number === episode
  );

  const heroPosterRadius = posterAppearance.radiusClass;
  const actionBtnHeight = largeButtons ? "h-14 sm:h-16" : "h-12 sm:h-14";

  return (
    <div
      className={`min-h-screen w-full max-w-full ${activeTheme.pageBg} ${activeTheme.baseText} p-2.5 sm:p-6 md:p-10 overflow-x-clip scroll-smooth transition-colors duration-300 pb-16 relative rounded-3xl`}
    >
      <style>{`${DETAILS_VIEWPORT_STYLES}
        @keyframes heartbeatSlow {
          0%, 100% { opacity: 0.85; transform: scale(0.98); }
          50% { opacity: 1; transform: scale(1.03); }
        }
        .animate-heartbeat-slow {
          animation: heartbeatSlow 3s ease-in-out infinite;
        }
        @keyframes ambientPulse {
          0%, 100% { opacity: 0.18; filter: blur(45px) saturate(1.3); }
          50% { opacity: 0.32; filter: blur(60px) saturate(1.7); }
        }
        .animate-ambient-pulse {
          animation: ambientPulse 8s ease-in-out infinite;
        }
      `}</style>

      {/* Layered cinematic glass overlays for Ambient backdrop depths */}
      <AppWallpaper backdropUrl={backdropUrl} />
      {!isLowRam && !reducedMotion && !glowOff && (
        <div
          className={`absolute inset-x-0 -top-12 h-[34rem] bg-gradient-to-b ${activeTheme.ambient} animate-ambient-pulse z-0 pointer-events-none rounded-t-3xl`}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/20 pointer-events-none z-0" />

      <div className="relative z-10 max-w-5xl mx-auto min-w-0">
        {/* Top Utility Bar: Compact Theme-Tuned Wrapper — Back to Home Left, IMDb Right */}
        <div className="rabtv-page-top-bar mb-4">
          <div className="rabtv-dual-wrapper rabtv-dtl-action-plate">
            <div
              className="rabtv-art-bg"
              aria-hidden="true"
              style={{
                backgroundImage: `url(${RABBIT_TV_BUTTON_WRAPPER_URL})`,
              }}
            />
            <Link
              to="/"
              data-tour="back-to-home"
              aria-label="Back to Home"
              title="Back to Home"
              className={`rabtv-wrap-art-btn rabtv-wrap-art-btn--left rabtv-wrap-art-btn--home rounded-full hover:scale-[1.04] active:scale-95 focus:outline-none focus:ring-2 ${activeTheme.ring}`}
            >
              <img
                src={BACK_TO_HOME_BTN_URL}
                alt="Back to Home"
                decoding="async"
              />
            </Link>

            <a
              href={imdbLink}
              target="_blank"
              rel="noopener noreferrer"
              data-tour="imdb-link"
              className={`rabtv-wrap-pill-btn rabtv-dtl-sec-cta font-extrabold text-white transition hover:scale-[1.03] active:scale-95 focus:outline-none focus:ring-2 ${activeTheme.ring}`}
              title="View Official IMDb Listing"
            >
              <span
                className="rabtv-dtl-sec-cta-art"
                aria-hidden="true"
                style={{ backgroundImage: `url(${RABBIT_TV_ACTION_SECONDARY_URL})` }}
              />
              <span className="rabtv-dtl-sec-cta-scrim" aria-hidden="true" />
              <span className="rabtv-dtl-cta-content truncate">
                ⭐ IMDb ↗
              </span>
            </a>
          </div>
        </div>

        <div className="mx-auto flex flex-col items-center gap-5 sm:gap-6">
          {/* 3D Spin / Flip Cover Art -> Trailer Reveal (Proportional across all viewports) */}
          <div
            data-tour="card-flip"
            className="relative w-full max-w-[380px] sm:max-w-[430px] aspect-[2/3] max-h-[72dvh] cursor-pointer select-none"
            style={{ perspective: "1500px" }}
            onClick={() => !isFlipped && setIsFlipped(true)}
          >
            <div
              className={`relative h-full w-full ${heroPosterRadius} transition-all duration-700 ease-out`}
              style={{
                transformStyle: "preserve-3d",
                transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
              }}
            >
              {/* Front: Cover Art with Floating Bottom Metadata Pill & Theme-Matched Trailer Badge */}
              <div
                className={`absolute inset-0 h-full w-full ${heroPosterRadius} overflow-hidden border bg-black ${
                  glowOff ? "shadow-2xl" : activeTheme.posterShadow
                }`}
                style={{ backfaceVisibility: "hidden" }}
              >
                <img
                  src={poster}
                  alt={title}
                  decoding="async"
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/15 to-transparent pointer-events-none" />
                {mediaStatusBadge}

                {/* Bottom Overlay Bar: Metadata Pill on Left + Theme-Matched Trailer Badge on Right */}
                <div className="absolute inset-x-3 bottom-3 z-20 flex items-end justify-between gap-2 pointer-events-none">
                  {/* Left: Floating Dark Glass Metadata Pill */}
                  <div
                    className={`inline-flex items-center flex-wrap gap-1.5 rounded-full backdrop-blur-xl border px-3 py-1.5 text-[10px] sm:text-[11px] font-bold shadow-xl min-w-0 ${activeTheme.subtleBadge}`}
                  >
                    {rating !== "N/A" && (
                      <>
                        <span className={`font-extrabold ${activeTheme.text}`}>
                          ★ {rating}
                        </span>
                        <span className="opacity-30">|</span>
                      </>
                    )}
                    {releaseYear && (
                      <>
                        <span>{releaseYear}</span>
                        <span className="opacity-30">|</span>
                      </>
                    )}
                    <span className="truncate max-w-[75px] sm:max-w-none">
                      {originalLanguageName || "English"}
                    </span>
                    <span className="opacity-30">|</span>
                    <span className="uppercase tracking-wider text-white">
                      {inferredMediaType}
                    </span>
                  </div>

                  {/* Right: Armored 1:1 "Click for Trailer" Square Badge */}
                  <button
                    type="button"
                    data-tour="details-trailer"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsFlipped(true);
                    }}
                    className={`pointer-events-auto rabtv-dtl-trailer-badge group flex flex-col items-center justify-center gap-1 px-2 py-2 text-white transition-all duration-300 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 shrink-0 ${
                      activeTheme.ring
                    } ${reducedMotion ? "" : "animate-heartbeat-slow"}`}
                  >
                    <span
                      className="rabtv-dtl-trailer-badge-bg"
                      aria-hidden="true"
                      style={{ backgroundImage: `url(${RABBIT_TV_TRAILER_BADGE_URL})` }}
                    />
                    <span className="rabtv-dtl-trailer-badge-scrim" aria-hidden="true" />
                    <span
                      className={`relative z-10 flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full border text-[10px] group-hover:scale-110 transition-transform shadow-md ${activeTheme.trailerPlayDot}`}
                    >
                      ▶
                    </span>
                    <span className="relative z-10 text-[9px] sm:text-[10px] font-extrabold leading-tight text-center drop-shadow-[0_1px_4px_rgba(0,0,0,0.96)]">
                      Click for
                      <br />
                      Trailer
                    </span>
                  </button>
                </div>
              </div>

              {/* Back: Trailer Player inside Transparent Rabbit Alternate Panel Wrapper */}
              <div
                className={`absolute inset-0 h-full w-full ${heroPosterRadius} overflow-hidden flex flex-col border ${activeTheme.border}/40 bg-black/95 shadow-2xl`}
                style={{
                  backfaceVisibility: "hidden",
                  transform: "rotateY(180deg)",
                }}
              >
                <div
                  className="rabtv-dtl-panel-bg"
                  aria-hidden="true"
                  style={{
                    backgroundImage: `url(${RABBIT_TV_DETAILS_PANEL_URL})`,
                    opacity: 0.62,
                  }}
                />
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${activeTheme.trailerBackBg} opacity-50 pointer-events-none z-0`}
                />

                {/* Header / Close bar */}
                <div
                  className={`relative z-10 flex items-center justify-between gap-2 p-3 border-b bg-black/75 backdrop-blur-md ${activeTheme.dividerBorder}`}
                >
                  <span
                    className={`text-xs font-bold truncate ${activeTheme.text}`}
                  >
                    Official Trailer • {title}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsFlipped(false);
                    }}
                    className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-xs font-bold border hover:scale-105 active:scale-95 transition cursor-pointer shadow-md ${activeTheme.btnSecondary}`}
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
                      <div
                        className={`w-8 h-8 rounded-full border-2 border-t-transparent ${activeTheme.border} animate-spin`}
                      />
                      <span className={`text-xs ${activeTheme.subMutedText}`}>
                        Loading official trailer from TMDB...
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Media Details Card (rabbit-tv-details-panel-background.jpg) */}
          <div
            data-tour="details-metadata"
            className={`rabtv-dtl-panel w-full rounded-3xl border p-4 sm:p-7 md:p-8 transition-colors duration-300 ${activeTheme.surfacePanel}`}
          >
            <div
              className="rabtv-dtl-panel-bg"
              aria-hidden="true"
              style={{ backgroundImage: `url(${RABBIT_TV_DETAILS_PANEL_URL})` }}
            />
            <div className="rabtv-dtl-panel-scrim" aria-hidden="true" />
            <div className="relative z-10 flex flex-col items-start text-left gap-4 w-full">
            {/* Genre Capsule + Optional New Episode Radar Pill */}
            <div className="flex items-center flex-wrap gap-2">
              <span
                className={`w-fit rounded-full border px-3.5 py-1 text-[10px] sm:text-[11px] font-bold uppercase tracking-widest ${activeTheme.badge}`}
              >
                {genres}
              </span>
              {liveTvFreshBadge && (
                <button
                  type="button"
                  onClick={() => {
                    bgAudio.pause();
                    navigate({
                      to: "/player",
                      search: {
                        id: mediaId,
                        type: "tv",
                        season: liveTvFreshBadge.seasonNumber,
                        episode: liveTvFreshBadge.episodeNumber,
                      },
                    });
                  }}
                  className={`rabtv-dtl-play-cta inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-white transition hover:scale-105 cursor-pointer focus:outline-none focus:ring-2 ${activeTheme.ring}`}
                  title={`Play ${liveTvFreshBadge.episodeName} (Aired ${liveTvFreshBadge.airDate})`}
                >
                  <span
                    className="rabtv-dtl-play-cta-art"
                    aria-hidden="true"
                    style={{ backgroundImage: `url(${RABBIT_TV_PLAY_PRIMARY_URL})` }}
                  />
                  <span className="rabtv-dtl-play-cta-scrim" aria-hidden="true" />
                  <span className="rabtv-dtl-cta-content">
                    <span>{liveTvFreshBadge.badgeLabel}</span>
                    <span>▶</span>
                  </span>
                </button>
              )}
            </div>

            {/* Crisp High-Contrast Title */}
            <h1 className="text-2xl sm:text-4xl md:text-5xl font-black tracking-tight text-white leading-tight">
              {title}
            </h1>

            {/* Single-Line Metadata Subtitle + Live Finish Time */}
            <div
              className={`flex items-center flex-wrap gap-2 text-xs sm:text-sm font-medium ${activeTheme.mutedText}`}
            >
              <span>Content {releaseYear || "2026"}</span>
              <span className="opacity-30">|</span>
              <span>{originalLanguageName || "English"}</span>
              <span className="opacity-30">•</span>
              {rating !== "N/A" && (
                <span className={`font-bold ${activeTheme.text}`}>
                  ★ {rating}
                </span>
              )}
              <span className="uppercase font-bold tracking-wider text-white">
                {inferredMediaType}
              </span>
              {runtimeSummary && (
                <>
                  <span className="opacity-30">•</span>
                  <span className="text-white font-semibold">
                    {runtimeSummary.durationText}
                  </span>
                  <span
                    data-tour="finish-time"
                    className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${activeTheme.badge}`}
                  >
                    ⏱️ Ends {runtimeSummary.endsAtText}
                  </span>
                </>
              )}
            </div>

            {/* Overview Paragraph */}
            <p
              className={`max-w-3xl text-xs sm:text-sm md:text-base leading-relaxed ${activeTheme.mutedText}`}
            >
              {overview}
            </p>

            {/* TV Season & Episode Selector Dropdowns (Reused Pill Track & Pill States) */}
            {inferredMediaType === "tv" && mediaDetails?.seasons && (
              <div
                className={`rabtv-dtl-pill-track grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 rounded-2xl border p-3.5 sm:p-4 shadow-xl my-1 w-full ${activeTheme.subPanel}`}
              >
                <div
                  className="rabtv-dtl-pill-track-bg"
                  aria-hidden="true"
                  style={{ backgroundImage: `url(${RABBIT_TV_PILL_TRACK_URL})` }}
                />
                <div className="rabtv-dtl-pill-track-scrim" aria-hidden="true" />
                <div
                  className="relative z-10 min-w-0"
                  ref={seasonRef}
                  data-tour="season-selector"
                >
                  <label
                    className={`block text-left text-[10px] font-bold uppercase tracking-wider mb-1.5 pl-1 ${activeTheme.subMutedText}`}
                  >
                    Select Season
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsSeasonOpen(!isSeasonOpen);
                      setIsEpisodeOpen(false);
                    }}
                    className={`rabtv-dtl-pill-trigger flex items-center justify-between w-full gap-3 rounded-xl px-3.5 text-white ${
                      largeButtons ? "py-3.5 text-sm" : "py-2.5 text-xs sm:text-sm"
                    } font-bold shadow-lg focus:outline-none focus:ring-4 ${
                      activeTheme.ring
                    } transition cursor-pointer`}
                  >
                    <span
                      className={isSeasonOpen ? "rabtv-dtl-play-cta-art" : "rabtv-dtl-sec-cta-art"}
                      aria-hidden="true"
                      style={{
                        backgroundImage: `url(${
                          isSeasonOpen
                            ? RABBIT_TV_PILL_ACTIVE_URL
                            : RABBIT_TV_PILL_INACTIVE_URL
                        })`,
                      }}
                    />
                    <span className="rabtv-dtl-sec-cta-scrim" aria-hidden="true" />
                    <span className="relative z-10 truncate drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]">
                      {currentSeasonObj
                        ? `${currentSeasonObj.name} (${currentSeasonObj.episode_count} Eps)`
                        : `Season ${season}`}
                    </span>
                    <span className="relative z-10 shrink-0">▾</span>
                  </button>
                  {isSeasonOpen && (
                    <div
                      className={`absolute left-0 right-0 mt-2 z-50 max-h-60 overflow-y-auto rounded-2xl border backdrop-blur-xl p-1 w-full box-border ${activeTheme.dropdownMenu}`}
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
                            className={`w-full text-left px-3.5 py-2.5 text-xs font-semibold rounded-xl transition cursor-pointer ${
                              season === s.season_number
                                ? `${activeTheme.bg} text-white font-black`
                                : `${activeTheme.mutedText} hover:bg-white/10 hover:text-white`
                            }`}
                          >
                            {s.name} ({s.episode_count} Episodes)
                          </button>
                        ))}
                    </div>
                  )}
                </div>

                <div className="relative z-10 min-w-0" ref={episodeRef}>
                  <label
                    className={`block text-left text-[10px] font-bold uppercase tracking-wider mb-1.5 pl-1 ${activeTheme.subMutedText}`}
                  >
                    Select Episode
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEpisodeOpen(!isEpisodeOpen);
                      setIsSeasonOpen(false);
                    }}
                    className={`rabtv-dtl-pill-trigger flex items-center justify-between w-full gap-3 rounded-xl px-3.5 text-white ${
                      largeButtons ? "py-3.5 text-sm" : "py-2.5 text-xs sm:text-sm"
                    } font-bold shadow-lg focus:outline-none focus:ring-4 ${
                      activeTheme.ring
                    } transition cursor-pointer`}
                  >
                    <span
                      className={isEpisodeOpen ? "rabtv-dtl-play-cta-art" : "rabtv-dtl-sec-cta-art"}
                      aria-hidden="true"
                      style={{
                        backgroundImage: `url(${
                          isEpisodeOpen
                            ? RABBIT_TV_PILL_ACTIVE_URL
                            : RABBIT_TV_PILL_INACTIVE_URL
                        })`,
                      }}
                    />
                    <span className="rabtv-dtl-sec-cta-scrim" aria-hidden="true" />
                    <span className="relative z-10 truncate drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]">
                      {currentEpisodeObj
                        ? `Ep ${currentEpisodeObj.episode_number}: ${currentEpisodeObj.name}`
                        : `Episode ${episode}`}
                    </span>
                    <span className="relative z-10 shrink-0">▾</span>
                  </button>
                  {isEpisodeOpen && (
                    <div
                      className={`absolute left-0 right-0 mt-2 z-50 max-h-60 overflow-y-auto rounded-2xl border backdrop-blur-xl p-1 w-full box-border ${activeTheme.dropdownMenu}`}
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
                            className={`w-full text-left px-3.5 py-2.5 text-xs font-semibold rounded-xl transition cursor-pointer ${
                              episode === ep.episode_number
                                ? `${activeTheme.bg} text-white font-black`
                                : `${activeTheme.mutedText} hover:bg-white/10 hover:text-white`
                            }`}
                          >
                            Ep {ep.episode_number}: {ep.name}
                          </button>
                        ))
                      ) : (
                        <div
                          className={`px-3.5 py-2.5 text-xs font-bold ${activeTheme.subMutedText}`}
                        >
                          Loading episodes...
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 2x2 Armored Action Buttons Grid (Play Primary + Secondary Twins) */}
            <div className="mt-2 grid grid-cols-2 gap-2.5 sm:gap-4 w-full">
              {/* 1. Play Button */}
              <button
                type="button"
                data-tour="details-play"
                onClick={handlePlay}
                className={`rabtv-dtl-play-cta group flex items-center justify-center px-3 ${actionBtnHeight} rounded-2xl font-extrabold text-xs sm:text-base tracking-wide text-white transition-all duration-300 transform hover:-translate-y-0.5 active:scale-95 cursor-pointer focus:outline-none focus:ring-4 ${activeTheme.ring}`}
              >
                <span
                  className="rabtv-dtl-play-cta-art"
                  aria-hidden="true"
                  style={{ backgroundImage: `url(${RABBIT_TV_PLAY_PRIMARY_URL})` }}
                />
                <span className="rabtv-dtl-play-cta-scrim" aria-hidden="true" />
                <span className="rabtv-dtl-cta-content">
                  <span className="text-sm sm:text-lg shrink-0">▶</span>
                  <span className="truncate">
                    {inferredMediaType === "tv"
                      ? `Play S${season}:E${episode}`
                      : "Play"}
                  </span>
                </span>
              </button>

              {/* 2. Report Broken Button */}
              <button
                type="button"
                data-tour="report-broken"
                onClick={handleReportBroken}
                className={`rabtv-dtl-sec-cta group flex items-center justify-center px-2.5 sm:px-3 ${actionBtnHeight} rounded-2xl font-bold text-xs sm:text-sm tracking-wide text-white transition-all duration-300 transform hover:-translate-y-0.5 active:scale-95 cursor-pointer focus:outline-none focus:ring-4 ${activeTheme.ring}`}
                title="Report link as broken and hide globally"
              >
                <span
                  className="rabtv-dtl-sec-cta-art"
                  aria-hidden="true"
                  style={{ backgroundImage: `url(${RABBIT_TV_ACTION_SECONDARY_URL})` }}
                />
                <span className="rabtv-dtl-sec-cta-scrim" aria-hidden="true" />
                <span className="rabtv-dtl-cta-content">
                  <span className="text-sm sm:text-base shrink-0">🚩</span>
                  <span className="truncate">Report Broken</span>
                </span>
              </button>

              {/* 3. My Favs Button */}
              <button
                type="button"
                data-tour="details-favorite"
                onClick={toggleFavorites}
                className={`${
                  inFavorites ? "rabtv-dtl-play-cta" : "rabtv-dtl-sec-cta"
                } group flex items-center justify-center px-2.5 sm:px-3 ${actionBtnHeight} rounded-2xl font-bold text-xs sm:text-sm tracking-wide text-white transition-all duration-300 transform hover:-translate-y-0.5 active:scale-95 cursor-pointer focus:outline-none focus:ring-4 ${activeTheme.ring}`}
              >
                <span
                  className={
                    inFavorites ? "rabtv-dtl-play-cta-art" : "rabtv-dtl-sec-cta-art"
                  }
                  aria-hidden="true"
                  style={{
                    backgroundImage: `url(${
                      inFavorites
                        ? RABBIT_TV_PLAY_PRIMARY_URL
                        : RABBIT_TV_ACTION_SECONDARY_URL
                    })`,
                  }}
                />
                <span
                  className={
                    inFavorites ? "rabtv-dtl-play-cta-scrim" : "rabtv-dtl-sec-cta-scrim"
                  }
                  aria-hidden="true"
                />
                <span className="rabtv-dtl-cta-content">
                  <span className="text-sm sm:text-base transition-transform group-hover:scale-110 shrink-0">
                    {inFavorites ? "♥" : "♡"}
                  </span>
                  <span className="truncate">
                    {inFavorites ? "Favorited" : "My Favs"}
                  </span>
                </span>
              </button>

              {/* 4. Save for Later Button */}
              <button
                type="button"
                onClick={toggleMyList}
                className={`${
                  inMyList ? "rabtv-dtl-play-cta" : "rabtv-dtl-sec-cta"
                } group flex items-center justify-center px-2.5 sm:px-3 ${actionBtnHeight} rounded-2xl font-bold text-xs sm:text-sm tracking-wide text-white transition-all duration-300 transform hover:-translate-y-0.5 active:scale-95 cursor-pointer focus:outline-none focus:ring-4 ${activeTheme.ring}`}
              >
                <span
                  className={
                    inMyList ? "rabtv-dtl-play-cta-art" : "rabtv-dtl-sec-cta-art"
                  }
                  aria-hidden="true"
                  style={{
                    backgroundImage: `url(${
                      inMyList
                        ? RABBIT_TV_PLAY_PRIMARY_URL
                        : RABBIT_TV_ACTION_SECONDARY_URL
                    })`,
                  }}
                />
                <span
                  className={
                    inMyList ? "rabtv-dtl-play-cta-scrim" : "rabtv-dtl-sec-cta-scrim"
                  }
                  aria-hidden="true"
                />
                <span className="rabtv-dtl-cta-content">
                  <span className="text-sm sm:text-base transition-transform group-hover:scale-110 shrink-0">
                    {inMyList ? "✓" : "🔖"}
                  </span>
                  <span className="truncate">
                    {inMyList ? "Saved" : "Save for Later"}
                  </span>
                </span>
              </button>
            </div>

            {/* Custom Watchlist Shelf Launcher */}
            <button
              type="button"
              data-tour="details-custom-shelf"
              onClick={() => setShowShelfModal(true)}
              className={`${
                itemShelfIds.length > 0 ? "rabtv-dtl-play-cta" : "rabtv-dtl-sec-cta"
              } w-full flex items-center justify-between gap-2 px-4 ${
                largeButtons ? "py-3.5 text-sm" : "py-2.5 text-xs sm:text-sm"
              } rounded-2xl font-bold tracking-wide text-white transition-all duration-300 hover:-translate-y-0.5 active:scale-[0.99] cursor-pointer focus:outline-none focus:ring-4 ${activeTheme.ring}`}
            >
              <span
                className={
                  itemShelfIds.length > 0
                    ? "rabtv-dtl-play-cta-art"
                    : "rabtv-dtl-sec-cta-art"
                }
                aria-hidden="true"
                style={{
                  backgroundImage: `url(${
                    itemShelfIds.length > 0
                      ? RABBIT_TV_PLAY_PRIMARY_URL
                      : RABBIT_TV_ACTION_SECONDARY_URL
                  })`,
                }}
              />
              <span
                className={
                  itemShelfIds.length > 0
                    ? "rabtv-dtl-play-cta-scrim"
                    : "rabtv-dtl-sec-cta-scrim"
                }
                aria-hidden="true"
              />
              <span className="relative z-10 flex items-center gap-2 truncate drop-shadow-[0_1px_4px_rgba(0,0,0,0.95)]">
                <span className="text-base shrink-0">📚</span>
                <span className="truncate">
                  {itemShelfIds.length > 0
                    ? `Saved in ${itemShelfIds.length} Custom ${
                        itemShelfIds.length === 1 ? "Shelf" : "Shelves"
                      }`
                    : "Add to Custom Shelf (e.g. Comfort Shows, Marathons)"}
                </span>
              </span>
              <span className="relative z-10 text-[11px] font-extrabold shrink-0 opacity-90 drop-shadow-[0_1px_4px_rgba(0,0,0,0.95)]">
                Manage ▸
              </span>
            </button>

            {actionFeedback && (
              <p
                className={`text-xs font-bold ${activeTheme.text} transition mt-1`}
              >
                {actionFeedback}
              </p>
            )}
            </div>
          </div>

          {/* Cast Section (Tap any actor to search their filmography) */}
          {castList.length > 0 && (
            <div className="mt-1 pt-2 pb-1 w-full space-y-3.5">
              <div className="flex items-center justify-between gap-2 px-1">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`w-1.5 h-5 rounded-full shrink-0 ${activeTheme.accentBar}`}
                  />
                  <h2 className="text-xs sm:text-sm font-extrabold uppercase tracking-widest text-white">
                    Cast
                  </h2>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => scrollCast("left")}
                    className={`${
                      largeButtons ? "w-9 h-9 text-sm" : "w-7 h-7 text-xs"
                    } rounded-lg border flex items-center justify-center font-bold shadow-md transition cursor-pointer focus:outline-none focus:ring-2 ${activeTheme.btnSecondary} ${activeTheme.ring}`}
                    aria-label="Scroll cast left"
                  >
                    ◀
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollCast("right")}
                    className={`${
                      largeButtons ? "w-9 h-9 text-sm" : "w-7 h-7 text-xs"
                    } rounded-lg border flex items-center justify-center font-bold shadow-md transition cursor-pointer focus:outline-none focus:ring-2 ${activeTheme.btnSecondary} ${activeTheme.ring}`}
                    aria-label="Scroll cast right"
                  >
                    ▶
                  </button>
                </div>
              </div>

              <div
                ref={castScrollRef}
                className="flex gap-4 sm:gap-5 overflow-x-auto pb-2 pt-1 px-1 scrollbar-none scroll-smooth w-full"
              >
                {castList.slice(0, 15).map((actor: any) => (
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
                      className={`p-[2.5px] rounded-full bg-gradient-to-tr ${activeTheme.avatarRing} ${
                        glowOff ? "shadow-md" : activeTheme.avatarGlow
                      } transition-all duration-300 mb-2 group-hover:scale-105`}
                    >
                      <div
                        className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden border-2 ${activeTheme.avatarFrame}`}
                      >
                        <img
                          src={
                            actor.profile_path
                              ? `https://image.tmdb.org/t/p/w200${actor.profile_path}`
                              : "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80"
                          }
                          alt={actor.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          decoding="async"
                        />
                      </div>
                    </div>
                    <h3 className="text-[11px] sm:text-xs font-bold text-white truncate w-full px-0.5">
                      {actor.name}
                    </h3>
                    <p
                      className={`text-[10px] font-medium truncate w-full px-0.5 ${activeTheme.subMutedText}`}
                    >
                      {actor.character || "Character"}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Budget, Production, & Language Stat Plates (rabbit-tv-stat-card-background.jpg) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4 mt-1 w-full">
            <div className="rabtv-dtl-stat-card rounded-2xl px-4 py-3.5 sm:px-5 sm:py-4 text-left shadow-xl transition duration-300">
              <div
                className="rabtv-dtl-stat-card-bg"
                aria-hidden="true"
                style={{ backgroundImage: `url(${RABBIT_TV_STAT_CARD_URL})` }}
              />
              <div className="rabtv-dtl-stat-card-scrim" aria-hidden="true" />
              <div className="relative z-10">
                <span
                  className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${activeTheme.subMutedText}`}
                >
                  Budget
                </span>
                <span className="text-sm sm:text-lg font-black text-white truncate block drop-shadow-[0_1px_4px_rgba(0,0,0,0.95)]">
                  {budget}
                </span>
              </div>
            </div>

            <div className="rabtv-dtl-stat-card rounded-2xl px-4 py-3.5 sm:px-5 sm:py-4 text-left shadow-xl transition duration-300">
              <div
                className="rabtv-dtl-stat-card-bg"
                aria-hidden="true"
                style={{ backgroundImage: `url(${RABBIT_TV_STAT_CARD_URL})` }}
              />
              <div className="rabtv-dtl-stat-card-scrim" aria-hidden="true" />
              <div className="relative z-10">
                <span
                  className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${activeTheme.subMutedText}`}
                >
                  Production
                </span>
                <span
                  className="text-sm sm:text-lg font-black text-white truncate block drop-shadow-[0_1px_4px_rgba(0,0,0,0.95)]"
                  title={productionCompanies}
                >
                  {productionCompanies}
                </span>
              </div>
            </div>

            <div className="rabtv-dtl-stat-card rounded-2xl px-4 py-3.5 sm:px-5 sm:py-4 text-left shadow-xl transition duration-300">
              <div
                className="rabtv-dtl-stat-card-bg"
                aria-hidden="true"
                style={{ backgroundImage: `url(${RABBIT_TV_STAT_CARD_URL})` }}
              />
              <div className="rabtv-dtl-stat-card-scrim" aria-hidden="true" />
              <div className="relative z-10">
                <span
                  className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${activeTheme.subMutedText}`}
                >
                  Language
                </span>
                <span className="text-sm sm:text-lg font-black text-white truncate block drop-shadow-[0_1px_4px_rgba(0,0,0,0.95)]">
                  {originalLanguageName || "English"}
                </span>
              </div>
            </div>
          </div>

          {/* Franchise & Movie Collections Shelf (Chronological Order + Completion Tracker) */}
          {franchiseShelfData && (
            <section
              data-tour="franchise-collection"
              className={`rabtv-dtl-panel mt-4 w-full rounded-3xl border p-4 sm:p-6 ${activeTheme.surfacePanel}`}
            >
              <div
                className="rabtv-dtl-panel-bg"
                aria-hidden="true"
                style={{ backgroundImage: `url(${RABBIT_TV_DETAILS_PANEL_URL})` }}
              />
              <div className="rabtv-dtl-panel-scrim" aria-hidden="true" />
              <div className="relative z-10 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`w-1.5 h-6 rounded-full shrink-0 ${activeTheme.accentBar}`}
                  />
                  <div className="min-w-0">
                    <span
                      className={`block text-[10px] font-extrabold uppercase tracking-widest ${activeTheme.subMutedText}`}
                    >
                      🎞️ Part of Franchise Collection
                    </span>
                    <h3 className="text-base sm:text-xl font-black tracking-tight text-white truncate">
                      {franchiseShelfData.name}
                    </h3>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-extrabold ${
                      franchiseShelfData.watchedCount ===
                      franchiseShelfData.totalCount
                        ? "bg-emerald-950/80 border-emerald-400/45 text-emerald-300"
                        : activeTheme.badge
                    }`}
                  >
                    ✓ {franchiseShelfData.watchedCount} of{" "}
                    {franchiseShelfData.totalCount} Watched
                  </span>
                </div>
              </div>

              {/* Franchise Completion Progress Bar */}
              <div
                className={`h-1.5 w-full rounded-full overflow-hidden border bg-black/60 ${activeTheme.dividerBorder}`}
              >
                <div
                  className={`h-full transition-all duration-500 ${
                    franchiseShelfData.watchedCount ===
                    franchiseShelfData.totalCount
                      ? "bg-emerald-500"
                      : activeTheme.playBtn
                  }`}
                  style={{
                    width: `${Math.max(
                      franchiseShelfData.watchedCount > 0 ? 8 : 0,
                      franchiseShelfData.progressPct
                    )}%`,
                  }}
                />
              </div>

              {/* Chronological Franchise Movie Cards */}
              <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-2 pt-1 scrollbar-none">
                {franchiseShelfData.parts.map((part) => {
                  const partPoster = part.posterPath
                    ? `https://image.tmdb.org/t/p/${posterWidth}${part.posterPath}`
                    : "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=900&q=80";

                  return (
                    <Link
                      key={part.id}
                      to="/details"
                      search={{ id: part.id, type: "movie" }}
                      className={`group shrink-0 w-32 sm:w-40 flex flex-col overflow-hidden ${posterAppearance.radiusClass} border transition-all duration-300 hover:-translate-y-1 focus:outline-none focus:ring-2 ${
                        activeTheme.ring
                      } ${
                        part.isCurrent
                          ? `${activeTheme.btnActive} ring-2 ring-white/40`
                          : activeTheme.statCard
                      }`}
                    >
                      <div className="relative aspect-[2/3] w-full bg-black overflow-hidden">
                        <img
                          src={partPoster}
                          alt={part.title}
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        <span
                          className={`absolute top-2 left-2 rounded-lg border px-1.5 py-0.5 text-[9px] font-black backdrop-blur-md ${activeTheme.subtleBadge}`}
                        >
                          #{part.orderNumber}
                        </span>
                        {part.isWatched && (
                          <span className="absolute top-2 right-2 rounded-lg bg-emerald-600/95 border border-emerald-300/40 px-1.5 py-0.5 text-[9px] font-black text-white shadow">
                            ✓
                          </span>
                        )}
                        {part.isCurrent && (
                          <span
                            className={`absolute inset-x-1.5 bottom-1.5 rounded-lg py-0.5 text-center text-[9px] font-black uppercase tracking-wider ${activeTheme.playBtn}`}
                          >
                            Now Viewing
                          </span>
                        )}
                      </div>

                      <div className="p-2.5 text-left space-y-0.5">
                        <p className="text-xs font-bold text-white line-clamp-1">
                          {part.title}
                        </p>
                        <div
                          className={`flex items-center justify-between text-[10px] font-semibold ${activeTheme.subMutedText}`}
                        >
                          <span>{part.year}</span>
                          {part.rating && (
                            <span className={activeTheme.text}>
                              ★ {part.rating}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
              </div>
            </section>
          )}

          {/* RABBiT TV Community Ratings, Moderated Reviews & Watch Buddies */}
          <TitleCommunitySection
            mediaId={mediaId}
            mediaType={inferredMediaType}
            title={title}
            posterPath={mediaDetails?.poster_path || null}
            appTheme={appTheme}
            isLowRam={isLowRam}
          />

          {/* Similar Recommended Titles */}
          {mappedRecommendations.length > 0 && (
            <div
              className={`mt-5 pt-5 border-t space-y-4 w-full ${activeTheme.dividerBorder}`}
            >
              <div className="rabtv-section-banner rabtv-dtl-banner-plate mb-3">
                <div
                  className="rabtv-art-bg"
                  aria-hidden="true"
                  style={{
                    backgroundImage: `url(${RABBIT_TV_BUTTON_WRAPPER_URL})`,
                  }}
                />
                <h3 className="rabtv-section-banner-title font-black tracking-tight text-white truncate drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)]">
                  ✨ Similar Recommended Titles
                </h3>
              </div>
              <div className={gridColsClass}>
                {mappedRecommendations.slice(0, 10).map((item) => (
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
              className={`flex flex-col items-center gap-0.5 backdrop-blur-md px-4 py-2 rounded-xl border shadow-2xl ${activeTheme.surfacePanel}`}
            >
              <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-white">
                More Content Details
              </span>
              <span
                className={`text-xl font-black animate-slow-glow ${activeTheme.arrow}`}
              >
                ⌄
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Custom Watchlist Shelves Picker Modal */}
      {showShelfModal && (
        <div
          className="rabtv-vidsrc-protected fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
          onClick={() => setShowShelfModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`rabtv-dtl-panel w-full max-w-md max-h-[85dvh] overflow-y-auto rounded-3xl border p-5 sm:p-6 scrollbar-none ${activeTheme.surfacePanel}`}
          >
            <div
              className="rabtv-dtl-panel-bg"
              aria-hidden="true"
              style={{ backgroundImage: `url(${RABBIT_TV_DETAILS_PANEL_URL})` }}
            />
            <div className="rabtv-dtl-panel-scrim" aria-hidden="true" />
            <div className="relative z-10 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-base sm:text-lg font-black text-white truncate">
                  📚 Save to Custom Shelf
                </h3>
                <p
                  className={`text-[11px] font-medium truncate ${activeTheme.subMutedText}`}
                >
                  {title}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowShelfModal(false)}
                className={`h-8 w-8 shrink-0 rounded-full border text-xs font-bold flex items-center justify-center cursor-pointer ${activeTheme.btnSecondary}`}
                aria-label="Close Custom Shelf Picker"
              >
                ✕
              </button>
            </div>

            {/* Existing Custom Shelves */}
            {customShelves.length > 0 ? (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-0.5 scrollbar-none">
                {customShelves.map((shelf) => {
                  const isAdded = itemShelfIds.includes(shelf.id);
                  return (
                    <button
                      key={shelf.id}
                      type="button"
                      onClick={() =>
                        handleToggleCustomShelf(shelf.id, shelf.name)
                      }
                      className={`${
                        isAdded ? "rabtv-dtl-play-cta" : "rabtv-dtl-sec-cta"
                      } w-full flex items-center justify-between gap-3 rounded-2xl px-3.5 py-2.5 text-left text-white transition cursor-pointer focus:outline-none focus:ring-2 ${
                        activeTheme.ring
                      }`}
                    >
                      <span
                        className={
                          isAdded ? "rabtv-dtl-play-cta-art" : "rabtv-dtl-sec-cta-art"
                        }
                        aria-hidden="true"
                        style={{
                          backgroundImage: `url(${
                            isAdded
                              ? RABBIT_TV_PLAY_PRIMARY_URL
                              : RABBIT_TV_ACTION_SECONDARY_URL
                          })`,
                        }}
                      />
                      <span
                        className={
                          isAdded ? "rabtv-dtl-play-cta-scrim" : "rabtv-dtl-sec-cta-scrim"
                        }
                        aria-hidden="true"
                      />
                      <div className="relative z-10 flex items-center gap-2.5 min-w-0">
                        <span className="text-lg shrink-0">{shelf.icon}</span>
                        <div className="min-w-0">
                          <span className="block text-xs font-extrabold text-white truncate drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]">
                            {shelf.name}
                          </span>
                          <span
                            className={`block text-[10px] ${activeTheme.subMutedText}`}
                          >
                            {shelf.items.length}{" "}
                            {shelf.items.length === 1 ? "title" : "titles"}
                          </span>
                        </div>
                      </div>
                      <span
                        className={`relative z-10 shrink-0 rounded-lg border px-2.5 py-1 text-[10px] font-black uppercase ${
                          isAdded
                            ? "bg-emerald-950/85 border-emerald-400/45 text-emerald-300"
                            : activeTheme.subtleBadge
                        }`}
                      >
                        {isAdded ? "✓ Added" : "+ Add"}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div
                className={`rounded-2xl border p-3.5 text-center space-y-2.5 ${activeTheme.subPanel}`}
              >
                <p className={`text-xs font-semibold ${activeTheme.mutedText}`}>
                  No custom shelves yet! Tap a quick starter below or make your
                  own:
                </p>
                <div className="flex flex-wrap items-center justify-center gap-1.5">
                  {SHELF_TEMPLATE_SUGGESTIONS.map((tpl) => (
                    <button
                      key={tpl.name}
                      type="button"
                      onClick={() =>
                        handleCreateAndAddShelf(tpl.name, tpl.icon)
                      }
                      className={`rounded-full border px-3 py-1 text-[11px] font-bold transition cursor-pointer hover:scale-105 ${activeTheme.btnSecondary}`}
                    >
                      {tpl.icon} {tpl.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Create New Shelf Inline Form */}
            <CreateShelfInlineForm
              activeTheme={activeTheme}
              onCreate={handleCreateAndAddShelf}
            />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}