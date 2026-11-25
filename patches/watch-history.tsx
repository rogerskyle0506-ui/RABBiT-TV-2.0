// patches/watch-history.tsx (copied to src/routes/watch-history.tsx during build)
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import React, { useState, useEffect, useRef, useMemo, useCallback, memo } from "react";
import {
  AppTheme,
  CardSize,
  HistoryScale,
  PosterAppearanceClasses,
  getSavedTheme,
  getSavedCardSize,
  getHistoryOverscale,
  getLargeButtons,
  getPosterAppearanceClasses,
  getOptimalTmdbImageWidth,
  getHardwareLimits,
  getReducedMotion,
  getGlowIntensity,
  getClockFormat,
  formatAppTime,
  isFavoriteChannel,
  toggleFavoriteChannel,
  MAX_FAVORITE_CHANNELS,
} from "@/lib/settings";
import {
  getWatchHistory,
  markEpisodeCompleted,
  markEntireShowCompleted,
  removeFromWatchHistory,
  calculateSeriesProgress,
  getNextUnwatchedEpisode,
  getDislikedTitles,
  removeDislikedTitle,
  dislikeTitle,
  getRecentLiveChannels,
  removeRecentLiveChannel,
  getWatchActivityStats,
  clearWatchHistoryScope,
  exportWatchHistorySnapshot,
  type ShowWatchHistory,
  type DislikedTitle,
  type RecentLiveChannel,
  type WatchActivityStats,
  type ClearHistoryScope,
} from "@/lib/watch-history";
import { AppWallpaper } from "@/components/AppWallpaper";
import { bgAudio } from "@/lib/background-audio";
import {
  getCachedEpisodeAlerts,
  scanTrackedShowsForNewEpisodes,
  isAlertUnseenByUser,
  EPISODE_RADAR_UPDATED_EVENT,
  type EpisodeRadarAlert,
} from "@/lib/episode-radar";

const IMG_WH_TIMEMACHINE_BG =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-history-character-panel-timemachine.jpg";
const IMG_WH_RADAR_PANEL =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-history-radar-panel.jpg";
const IMG_WH_CARD_FRAME =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-history-card-frame.jpg";
const IMG_WH_EMPTY_STATE =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-history-empty-state.jpg";

// Reused Cross-Page Assets for 1:1 Consistency
const IMG_BUTTON_WRAPPER =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-button-wrapper-background.jpg";
const IMG_BTN_HOME =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-search-button-home-primary.jpg";
const IMG_BTN_FILTER_IDLE =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-search-button-filter-idle.jpg";
const IMG_MODAL_PANEL =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-details-panel-background.jpg";

/**
 * Viewport-locked layout rules for Watch History top utility wrapper, Back to
 * Home artwork button, and buttonwrapper-backed section headers across portrait
 * phones, landscape phones, tablets, desktops, TVs, and projectors.
 */
const WATCH_HISTORY_VIEWPORT_STYLES = `
  /* 6-Theme Hue-Shift Tokens Synced 1:1 with Index, Details, Player, and Search */
  :root,
  html[data-theme="violet"] {
    --rabtv-wh-plate-filter: hue-rotate(-78deg) saturate(1.12) brightness(1.02);
    --rabtv-wh-play-filter: hue-rotate(-74deg) saturate(1.16) brightness(1.05);
  }
  html[data-theme="red"] {
    --rabtv-wh-plate-filter: hue-rotate(0deg) saturate(1.08) brightness(1.0);
    --rabtv-wh-play-filter: hue-rotate(0deg) saturate(1.14) brightness(1.04);
  }
  html[data-theme="midnight"] {
    --rabtv-wh-plate-filter: hue-rotate(-132deg) saturate(1.14) brightness(1.04);
    --rabtv-wh-play-filter: hue-rotate(-128deg) saturate(1.18) brightness(1.06);
  }
  html[data-theme="emerald"] {
    --rabtv-wh-plate-filter: hue-rotate(154deg) saturate(1.10) brightness(1.02);
    --rabtv-wh-play-filter: hue-rotate(150deg) saturate(1.15) brightness(1.04);
  }
  html[data-theme="amber"] {
    --rabtv-wh-plate-filter: hue-rotate(28deg) saturate(1.14) brightness(1.04);
    --rabtv-wh-play-filter: hue-rotate(24deg) saturate(1.18) brightness(1.06);
  }
  html[data-theme="cyan"] {
    --rabtv-wh-plate-filter: hue-rotate(-154deg) saturate(1.12) brightness(1.04);
    --rabtv-wh-play-filter: hue-rotate(-150deg) saturate(1.16) brightness(1.06);
  }

  .rabtv-wh-top-bar {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: clamp(8px, 2vw, 12px);
    box-sizing: border-box;
  }

  .rabtv-wh-dual-wrap {
    position: relative;
    width: 100%;
    height: clamp(48px, 12.6vw, 58px);
    padding: 0 4%;
    margin-inline: auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: clamp(8px, 2vw, 16px);
    box-sizing: border-box;
    border-radius: 9999px;
    overflow: hidden;
    contain: layout paint;
  }

  .rabtv-wh-art-bg {
    position: absolute;
    inset: 0;
    background-size: 100% 100%;
    background-repeat: no-repeat;
    background-position: center center;
    opacity: 0.74;
    filter: var(--rabtv-wh-plate-filter);
    -webkit-mask-image: radial-gradient(
      ellipse 88% 80% at 50% 50%,
      rgba(12, 10, 9, 1) 66%,
      rgba(12, 10, 9, 0.74) 88%,
      rgba(12, 10, 9, 0.30) 100%
    );
    mask-image: radial-gradient(
      ellipse 88% 80% at 50% 50%,
      rgba(12, 10, 9, 1) 66%,
      rgba(12, 10, 9, 0.74) 88%,
      rgba(12, 10, 9, 0.30) 100%
    );
    pointer-events: none;
    z-index: 0;
  }

  .rabtv-wh-section-ribbon {
    position: relative;
    width: 100%;
    height: clamp(44px, 11vw, 54px);
    padding: 0 clamp(24px, 8%, 56px);
    display: flex;
    flex-wrap: nowrap;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    border-radius: 9999px;
    overflow: hidden;
    contain: layout paint;
  }

  .rabtv-wh-section-title {
    position: relative;
    z-index: 6;
    font-size: clamp(12.5px, 3.4vw, 18.5px);
    line-height: 1.1;
    text-align: center;
  }

  /* Translucent Armored Panels (Time Machine, Radar, Card Frame, Empty State, Modals) */
  .rabtv-wh-plate {
    position: relative;
    overflow: hidden;
    box-sizing: border-box;
    padding: clamp(28px, 6.8vw, 44px) clamp(32px, 10%, 62px) !important;
    background-color: rgba(12, 10, 9, 0.74);
    contain: layout paint;
  }

  .rabtv-wh-plate--radar {
    padding: clamp(24px, 5.8vw, 34px) clamp(34px, 12.5%, 74px) !important;
  }

  @media (min-width: 768px) {
    .rabtv-wh-plate--radar {
      padding-right: clamp(150px, 25%, 248px) !important;
    }
  }

  .rabtv-wh-plate--card {
    padding: clamp(18px, 4.8vw, 26px) clamp(22px, 10.5%, 34px) !important;
  }

  .rabtv-wh-plate--empty {
    padding: clamp(36px, 9vw, 60px) clamp(34px, 11%, 70px) !important;
  }

  .rabtv-wh-plate-bg {
    position: absolute;
    inset: 0;
    background-size: 100% 100%;
    background-position: center center;
    background-repeat: no-repeat;
    opacity: 0.72;
    filter: var(--rabtv-wh-plate-filter);
    pointer-events: none;
    z-index: 0;
  }

  .rabtv-wh-plate-scrim {
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse 80% 78% at 38% 36%, rgba(12, 10, 9, 0.56) 0%, rgba(12, 10, 9, 0.36) 72%, rgba(12, 10, 9, 0.22) 100%);
    pointer-events: none;
    z-index: 1;
  }

  /* Armored Image Buttons */
  .rabtv-wh-img-btn {
    position: relative;
    overflow: hidden;
    background-color: #0c0a09;
    border: 0 !important;
    contain: layout paint;
    transition: transform 150ms ease;
  }

  .rabtv-wh-img-btn:hover { transform: scale(1.03); }
  .rabtv-wh-img-btn:active { transform: scale(0.97); }

  .rabtv-wh-img-btn-art {
    position: absolute;
    inset: 0;
    background-size: 100% 100%;
    background-position: center center;
    background-repeat: no-repeat;
    pointer-events: none;
    z-index: 0;
    opacity: 0.92;
  }

  .rabtv-wh-img-btn-scrim {
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse 76% 68% at 50% 50%, rgba(12, 10, 9, 0.44) 0%, rgba(12, 10, 9, 0.16) 100%);
    pointer-events: none;
    z-index: 1;
  }

  .rabtv-wh-img-btn-label {
    position: relative;
    z-index: 2;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    text-shadow: 0 1px 4px rgba(12, 10, 9, 0.96);
  }
`;

export const Route = createFileRoute("/watch-history")({
  component: WatchHistoryComponent,
});

type ActivityTab =
  | "all"
  | "in_progress"
  | "movies"
  | "tv"
  | "live"
  | "completed"
  | "disliked";

type ActivitySort = "recent" | "progress" | "az";

interface WatchHistoryThemeTokens {
  pageBg: string;
  baseText: string;
  mutedText: string;
  subMutedText: string;
  accentText: string;
  accentBar: string;
  badgeBg: string;
  subtleBadge: string;
  surfacePanel: string;
  subPanel: string;
  cardFooter: string;
  liveCard: string;
  liveCardPinned: string;
  logoStage: string;
  dividerBorder: string;
  backCapsule: string;
  backBadge: string;
  headerIconBox: string;
  btnActive: string;
  btnSecondary: string;
  btnTabIdle: string;
  iconBtn: string;
  iconBtnPinned: string;
  inputClass: string;
  optionBg: string;
  focusRing: string;
  progressTrack: string;
  progressFill: string;
  episodeRow: string;
  statusBanner: string;
  modalCard: string;
  ambient: string;
  laser: string;
  arrow: string;
}

function getWatchHistoryThemeTokens(theme: AppTheme): WatchHistoryThemeTokens {
  switch (theme) {
    case "red":
      return {
        pageBg: "bg-gradient-to-br from-zinc-950/65 via-red-950/30 to-black/75",
        baseText: "text-zinc-100",
        mutedText: "text-zinc-300",
        subMutedText: "text-zinc-400",
        accentText: "text-red-400",
        accentBar: "bg-red-500 shadow-[0_0_14px_rgba(239,68,68,0.95)]",
        badgeBg: "bg-red-950/75 border-red-500/35 text-red-200",
        subtleBadge: "bg-black/75 border-red-500/25 text-zinc-200",
        surfacePanel:
          "bg-zinc-950/68 border-red-500/30 shadow-[0_12px_36px_rgba(239,68,68,0.16)]",
        subPanel: "bg-black/70 border-red-500/25",
        cardFooter:
          "bg-gradient-to-b from-zinc-950 to-black border-t border-red-500/25",
        liveCard:
          "bg-zinc-950/90 border-red-500/25 hover:border-red-400/75",
        liveCardPinned:
          "bg-zinc-950/92 border-red-400/70 shadow-[0_0_20px_rgba(239,68,68,0.22)]",
        logoStage:
          "bg-gradient-to-b from-zinc-900 via-black to-zinc-950 border-red-500/20",
        dividerBorder: "border-red-500/20",
        backCapsule:
          "bg-zinc-950/88 hover:bg-red-950/80 border-red-500/35 hover:border-red-400 text-zinc-100 hover:text-white",
        backBadge:
          "bg-gradient-to-tr from-red-600/60 via-rose-500/50 to-orange-500/50 border-red-400/50 text-white",
        headerIconBox:
          "bg-gradient-to-br from-red-950 via-rose-900/70 to-black border-red-500/40 shadow-[0_0_20px_rgba(239,68,68,0.3)]",
        btnActive:
          "bg-gradient-to-r from-red-600 via-rose-600 to-orange-600 text-white shadow-lg shadow-red-600/30",
        btnSecondary:
          "bg-red-950/60 hover:bg-red-900/80 border-red-500/35 text-red-100 hover:text-white",
        btnTabIdle:
          "bg-black/70 hover:bg-red-950/60 border-red-500/20 text-zinc-300 hover:text-white",
        iconBtn:
          "bg-black/80 hover:bg-red-900/80 border-red-500/30 text-zinc-200 hover:text-white",
        iconBtnPinned:
          "bg-red-600/35 border-red-400/75 text-red-100",
        inputClass:
          "border-red-500/30 bg-black/80 text-white placeholder-zinc-400 focus:ring-2 focus:ring-red-500 focus:border-red-400",
        optionBg: "bg-zinc-950 text-white",
        focusRing: "focus:ring-red-500",
        progressTrack: "bg-zinc-900 border-red-500/20",
        progressFill:
          "bg-gradient-to-r from-red-600 to-rose-400 shadow-[0_0_8px_rgba(239,68,68,0.8)]",
        episodeRow:
          "bg-red-950/30 hover:bg-red-950/60 border-red-500/20",
        statusBanner:
          "bg-zinc-950/95 border-red-400/55 text-red-100",
        modalCard:
          "bg-zinc-950/98 border-red-500/40 shadow-[0_20px_60px_rgba(0,0,0,0.9)]",
        ambient: "from-red-600/14 via-transparent to-transparent",
        laser: "from-transparent via-red-500 to-rose-400",
        arrow: "text-red-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.85)]",
      };
    case "midnight":
      return {
        pageBg:
          "bg-gradient-to-br from-slate-950/65 via-blue-950/30 to-black/75",
        baseText: "text-slate-100",
        mutedText: "text-slate-300",
        subMutedText: "text-slate-400",
        accentText: "text-sky-300",
        accentBar: "bg-sky-400 shadow-[0_0_14px_rgba(56,189,248,0.95)]",
        badgeBg: "bg-blue-950/75 border-blue-500/35 text-sky-200",
        subtleBadge: "bg-black/75 border-blue-500/25 text-slate-200",
        surfacePanel:
          "bg-slate-950/68 border-blue-500/30 shadow-[0_12px_36px_rgba(59,130,246,0.16)]",
        subPanel: "bg-black/70 border-blue-500/25",
        cardFooter:
          "bg-gradient-to-b from-slate-950 to-black border-t border-blue-500/25",
        liveCard:
          "bg-slate-950/90 border-blue-500/25 hover:border-sky-400/75",
        liveCardPinned:
          "bg-slate-950/92 border-sky-400/70 shadow-[0_0_20px_rgba(56,189,248,0.22)]",
        logoStage:
          "bg-gradient-to-b from-slate-900 via-black to-slate-950 border-blue-500/20",
        dividerBorder: "border-blue-500/20",
        backCapsule:
          "bg-slate-950/88 hover:bg-blue-950/80 border-blue-500/35 hover:border-sky-400 text-slate-100 hover:text-white",
        backBadge:
          "bg-gradient-to-tr from-blue-600/60 via-sky-500/50 to-cyan-400/50 border-sky-400/50 text-white",
        headerIconBox:
          "bg-gradient-to-br from-blue-950 via-sky-900/70 to-black border-blue-500/40 shadow-[0_0_20px_rgba(59,130,246,0.3)]",
        btnActive:
          "bg-gradient-to-r from-blue-600 via-cyan-600 to-sky-600 text-white shadow-lg shadow-blue-600/30",
        btnSecondary:
          "bg-blue-950/60 hover:bg-blue-900/80 border-blue-500/35 text-blue-100 hover:text-white",
        btnTabIdle:
          "bg-black/70 hover:bg-blue-950/60 border-blue-500/20 text-slate-300 hover:text-white",
        iconBtn:
          "bg-black/80 hover:bg-blue-900/80 border-blue-500/30 text-slate-200 hover:text-white",
        iconBtnPinned:
          "bg-blue-600/35 border-sky-400/75 text-sky-100",
        inputClass:
          "border-blue-500/30 bg-black/80 text-white placeholder-slate-400 focus:ring-2 focus:ring-sky-400 focus:border-sky-400",
        optionBg: "bg-slate-950 text-white",
        focusRing: "focus:ring-sky-400",
        progressTrack: "bg-slate-900 border-blue-500/20",
        progressFill:
          "bg-gradient-to-r from-blue-500 to-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.8)]",
        episodeRow:
          "bg-blue-950/30 hover:bg-blue-950/60 border-blue-500/20",
        statusBanner:
          "bg-slate-950/95 border-sky-400/55 text-sky-100",
        modalCard:
          "bg-slate-950/98 border-blue-500/40 shadow-[0_20px_60px_rgba(0,0,0,0.9)]",
        ambient: "from-blue-600/14 via-transparent to-transparent",
        laser: "from-transparent via-sky-400 to-blue-500",
        arrow: "text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.85)]",
      };
    case "emerald":
      return {
        pageBg:
          "bg-gradient-to-br from-neutral-950/65 via-emerald-950/30 to-black/75",
        baseText: "text-neutral-100",
        mutedText: "text-neutral-300",
        subMutedText: "text-neutral-400",
        accentText: "text-emerald-300",
        accentBar: "bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.95)]",
        badgeBg: "bg-emerald-950/75 border-emerald-500/35 text-emerald-200",
        subtleBadge: "bg-black/75 border-emerald-500/25 text-neutral-200",
        surfacePanel:
          "bg-neutral-950/68 border-emerald-500/30 shadow-[0_12px_36px_rgba(16,185,129,0.16)]",
        subPanel: "bg-black/70 border-emerald-500/25",
        cardFooter:
          "bg-gradient-to-b from-neutral-950 to-black border-t border-emerald-500/25",
        liveCard:
          "bg-neutral-950/90 border-emerald-500/25 hover:border-emerald-400/75",
        liveCardPinned:
          "bg-neutral-950/92 border-emerald-400/70 shadow-[0_0_20px_rgba(16,185,129,0.22)]",
        logoStage:
          "bg-gradient-to-b from-neutral-900 via-black to-neutral-950 border-emerald-500/20",
        dividerBorder: "border-emerald-500/20",
        backCapsule:
          "bg-neutral-950/88 hover:bg-emerald-950/80 border-emerald-500/35 hover:border-emerald-400 text-neutral-100 hover:text-white",
        backBadge:
          "bg-gradient-to-tr from-emerald-600/60 via-teal-500/50 to-green-400/50 border-emerald-400/50 text-white",
        headerIconBox:
          "bg-gradient-to-br from-emerald-950 via-teal-900/70 to-black border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.3)]",
        btnActive:
          "bg-gradient-to-r from-emerald-600 via-teal-600 to-green-600 text-white shadow-lg shadow-emerald-600/30",
        btnSecondary:
          "bg-emerald-950/60 hover:bg-emerald-900/80 border-emerald-500/35 text-emerald-100 hover:text-white",
        btnTabIdle:
          "bg-black/70 hover:bg-emerald-950/60 border-emerald-500/20 text-neutral-300 hover:text-white",
        iconBtn:
          "bg-black/80 hover:bg-emerald-900/80 border-emerald-500/30 text-neutral-200 hover:text-white",
        iconBtnPinned:
          "bg-emerald-600/35 border-emerald-400/75 text-emerald-100",
        inputClass:
          "border-emerald-500/30 bg-black/80 text-white placeholder-neutral-400 focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400",
        optionBg: "bg-neutral-950 text-white",
        focusRing: "focus:ring-emerald-400",
        progressTrack: "bg-neutral-900 border-emerald-500/20",
        progressFill:
          "bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]",
        episodeRow:
          "bg-emerald-950/30 hover:bg-emerald-950/60 border-emerald-500/20",
        statusBanner:
          "bg-neutral-950/95 border-emerald-400/55 text-emerald-100",
        modalCard:
          "bg-neutral-950/98 border-emerald-500/40 shadow-[0_20px_60px_rgba(0,0,0,0.9)]",
        ambient: "from-emerald-600/14 via-transparent to-transparent",
        laser: "from-transparent via-emerald-400 to-teal-400",
        arrow: "text-emerald-300 drop-shadow-[0_0_8px_rgba(110,231,183,0.85)]",
      };
    case "amber":
      return {
        pageBg:
          "bg-gradient-to-br from-stone-950/65 via-yellow-950/30 to-black/75",
        baseText: "text-stone-100",
        mutedText: "text-stone-300",
        subMutedText: "text-stone-400",
        accentText: "text-amber-300",
        accentBar: "bg-amber-400 shadow-[0_0_14px_rgba(251,191,36,0.95)]",
        badgeBg: "bg-amber-950/75 border-amber-500/35 text-amber-200",
        subtleBadge: "bg-black/75 border-amber-500/25 text-stone-200",
        surfacePanel:
          "bg-stone-950/68 border-amber-500/30 shadow-[0_12px_36px_rgba(245,158,11,0.16)]",
        subPanel: "bg-black/70 border-amber-500/25",
        cardFooter:
          "bg-gradient-to-b from-stone-950 to-black border-t border-amber-500/25",
        liveCard:
          "bg-stone-950/90 border-amber-500/25 hover:border-amber-400/75",
        liveCardPinned:
          "bg-stone-950/92 border-amber-400/70 shadow-[0_0_20px_rgba(245,158,11,0.22)]",
        logoStage:
          "bg-gradient-to-b from-stone-900 via-black to-stone-950 border-amber-500/20",
        dividerBorder: "border-amber-500/20",
        backCapsule:
          "bg-stone-950/88 hover:bg-amber-950/80 border-amber-500/35 hover:border-amber-400 text-stone-100 hover:text-white",
        backBadge:
          "bg-gradient-to-tr from-amber-600/60 via-yellow-500/50 to-orange-500/50 border-amber-400/50 text-white",
        headerIconBox:
          "bg-gradient-to-br from-amber-950 via-yellow-900/70 to-black border-amber-500/40 shadow-[0_0_20px_rgba(245,158,11,0.3)]",
        btnActive:
          "bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 text-white shadow-lg shadow-amber-600/30",
        btnSecondary:
          "bg-amber-950/60 hover:bg-amber-900/80 border-amber-500/35 text-amber-100 hover:text-white",
        btnTabIdle:
          "bg-black/70 hover:bg-amber-950/60 border-amber-500/20 text-stone-300 hover:text-white",
        iconBtn:
          "bg-black/80 hover:bg-amber-900/80 border-amber-500/30 text-stone-200 hover:text-white",
        iconBtnPinned:
          "bg-amber-600/35 border-amber-400/75 text-amber-100",
        inputClass:
          "border-amber-500/30 bg-black/80 text-white placeholder-stone-400 focus:ring-2 focus:ring-amber-400 focus:border-amber-400",
        optionBg: "bg-stone-950 text-white",
        focusRing: "focus:ring-amber-400",
        progressTrack: "bg-stone-900 border-amber-500/20",
        progressFill:
          "bg-gradient-to-r from-amber-500 to-yellow-400 shadow-[0_0_8px_rgba(245,158,11,0.8)]",
        episodeRow:
          "bg-amber-950/30 hover:bg-amber-950/60 border-amber-500/20",
        statusBanner:
          "bg-stone-950/95 border-amber-400/55 text-amber-100",
        modalCard:
          "bg-stone-950/98 border-amber-500/40 shadow-[0_20px_60px_rgba(0,0,0,0.9)]",
        ambient: "from-amber-600/14 via-transparent to-transparent",
        laser: "from-transparent via-amber-400 to-orange-500",
        arrow: "text-amber-300 drop-shadow-[0_0_8px_rgba(252,211,77,0.85)]",
      };
    case "cyan":
      return {
        pageBg:
          "bg-gradient-to-br from-slate-950/65 via-cyan-950/30 to-black/75",
        baseText: "text-slate-100",
        mutedText: "text-slate-300",
        subMutedText: "text-slate-400",
        accentText: "text-cyan-300",
        accentBar: "bg-cyan-400 shadow-[0_0_14px_rgba(34,211,238,0.95)]",
        badgeBg: "bg-cyan-950/75 border-cyan-500/35 text-cyan-200",
        subtleBadge: "bg-black/75 border-cyan-500/25 text-slate-200",
        surfacePanel:
          "bg-slate-950/68 border-cyan-500/30 shadow-[0_12px_36px_rgba(6,182,212,0.16)]",
        subPanel: "bg-black/70 border-cyan-500/25",
        cardFooter:
          "bg-gradient-to-b from-slate-950 to-black border-t border-cyan-500/25",
        liveCard:
          "bg-slate-950/90 border-cyan-500/25 hover:border-cyan-400/75",
        liveCardPinned:
          "bg-slate-950/92 border-cyan-400/70 shadow-[0_0_20px_rgba(6,182,212,0.22)]",
        logoStage:
          "bg-gradient-to-b from-slate-900 via-black to-slate-950 border-cyan-500/20",
        dividerBorder: "border-cyan-500/20",
        backCapsule:
          "bg-slate-950/88 hover:bg-cyan-950/80 border-cyan-500/35 hover:border-cyan-400 text-slate-100 hover:text-white",
        backBadge:
          "bg-gradient-to-tr from-cyan-600/60 via-teal-500/50 to-sky-400/50 border-cyan-400/50 text-white",
        headerIconBox:
          "bg-gradient-to-br from-cyan-950 via-teal-900/70 to-black border-cyan-500/40 shadow-[0_0_20px_rgba(6,182,212,0.3)]",
        btnActive:
          "bg-gradient-to-r from-cyan-600 via-teal-600 to-blue-600 text-white shadow-lg shadow-cyan-600/30",
        btnSecondary:
          "bg-cyan-950/60 hover:bg-cyan-900/80 border-cyan-500/35 text-cyan-100 hover:text-white",
        btnTabIdle:
          "bg-black/70 hover:bg-cyan-950/60 border-cyan-500/20 text-slate-300 hover:text-white",
        iconBtn:
          "bg-black/80 hover:bg-cyan-900/80 border-cyan-500/30 text-slate-200 hover:text-white",
        iconBtnPinned:
          "bg-cyan-600/35 border-cyan-400/75 text-cyan-100",
        inputClass:
          "border-cyan-500/30 bg-black/80 text-white placeholder-slate-400 focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400",
        optionBg: "bg-slate-950 text-white",
        focusRing: "focus:ring-cyan-400",
        progressTrack: "bg-slate-900 border-cyan-500/20",
        progressFill:
          "bg-gradient-to-r from-cyan-500 to-teal-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]",
        episodeRow:
          "bg-cyan-950/30 hover:bg-cyan-950/60 border-cyan-500/20",
        statusBanner:
          "bg-slate-950/95 border-cyan-400/55 text-cyan-100",
        modalCard:
          "bg-slate-950/98 border-cyan-500/40 shadow-[0_20px_60px_rgba(0,0,0,0.9)]",
        ambient: "from-cyan-600/14 via-transparent to-transparent",
        laser: "from-transparent via-cyan-400 to-teal-400",
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
        accentText: "text-violet-300",
        accentBar: "bg-violet-500 shadow-[0_0_14px_rgba(139,92,246,0.95)]",
        badgeBg: "bg-purple-950/75 border-violet-500/35 text-violet-200",
        subtleBadge: "bg-black/75 border-violet-500/25 text-slate-200",
        surfacePanel:
          "bg-slate-950/68 border-violet-500/30 shadow-[0_12px_36px_rgba(139,92,246,0.16)]",
        subPanel: "bg-black/70 border-violet-500/25",
        cardFooter:
          "bg-gradient-to-b from-slate-950 to-black border-t border-violet-500/25",
        liveCard:
          "bg-slate-950/90 border-violet-500/25 hover:border-violet-400/75",
        liveCardPinned:
          "bg-slate-950/92 border-violet-400/70 shadow-[0_0_20px_rgba(139,92,246,0.22)]",
        logoStage:
          "bg-gradient-to-b from-slate-900 via-black to-slate-950 border-violet-500/20",
        dividerBorder: "border-violet-500/20",
        backCapsule:
          "bg-slate-950/88 hover:bg-purple-950/80 border-violet-500/35 hover:border-violet-400 text-slate-100 hover:text-white",
        backBadge:
          "bg-gradient-to-tr from-violet-600/60 via-purple-500/50 to-indigo-500/50 border-violet-400/50 text-white",
        headerIconBox:
          "bg-gradient-to-br from-purple-950 via-violet-900/70 to-black border-violet-500/40 shadow-[0_0_20px_rgba(168,85,247,0.3)]",
        btnActive:
          "bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 text-white shadow-lg shadow-violet-600/30",
        btnSecondary:
          "bg-purple-950/60 hover:bg-purple-900/80 border-violet-500/35 text-purple-100 hover:text-white",
        btnTabIdle:
          "bg-black/70 hover:bg-purple-950/60 border-violet-500/20 text-slate-300 hover:text-white",
        iconBtn:
          "bg-black/80 hover:bg-purple-900/80 border-violet-500/30 text-slate-200 hover:text-white",
        iconBtnPinned:
          "bg-violet-600/35 border-violet-400/75 text-violet-100",
        inputClass:
          "border-violet-500/30 bg-black/80 text-white placeholder-slate-400 focus:ring-2 focus:ring-violet-400 focus:border-violet-400",
        optionBg: "bg-slate-950 text-white",
        focusRing: "focus:ring-violet-400",
        progressTrack: "bg-slate-900 border-violet-500/20",
        progressFill:
          "bg-gradient-to-r from-violet-500 to-purple-400 shadow-[0_0_8px_rgba(139,92,246,0.8)]",
        episodeRow:
          "bg-purple-950/30 hover:bg-purple-950/60 border-violet-500/20",
        statusBanner:
          "bg-slate-950/95 border-violet-400/55 text-violet-100",
        modalCard:
          "bg-slate-950/98 border-violet-500/40 shadow-[0_20px_60px_rgba(0,0,0,0.9)]",
        ambient: "from-violet-600/14 via-transparent to-transparent",
        laser: "from-transparent via-purple-500 to-violet-400",
        arrow: "text-purple-400 drop-shadow-[0_0_8px_rgba(192,132,252,0.85)]",
      };
  }
}

function resolvePosterSrc(
  path: string | null | undefined,
  width: "w342" | "w500"
): string | null {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return width === "w342"
      ? path.replace("image.tmdb.org/t/p/w500", "image.tmdb.org/t/p/w342")
      : path;
  }
  return `https://image.tmdb.org/t/p/${width}${path}`;
}

function formatWatchedAgo(timestamp: number, clockFormat: "12h" | "24h"): string {
  if (!timestamp) return "Recently";
  const diffMin = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago • ${formatAppTime(timestamp, clockFormat)}`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(timestamp).toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
}

/**
 * Isolated uncontrolled filter input with strict LTR flow so Android WebView
 * never reverses typed characters while filtering Watch History.
 */
const HistoryFilterInput = memo(function HistoryFilterInput({
  tokens,
  onQueryChange,
}: {
  tokens: WatchHistoryThemeTokens;
  onQueryChange: (q: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [hasText, setHasText] = useState(false);

  const handleClear = () => {
    if (inputRef.current) {
      inputRef.current.value = "";
      inputRef.current.focus();
    }
    setHasText(false);
    onQueryChange("");
  };

  return (
    <div data-tour="history-search" className="relative flex-1 sm:w-52 min-w-0">
      <span
        className={`absolute left-3 top-1/2 -translate-y-1/2 text-xs pointer-events-none ${tokens.accentText}`}
      >
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
        defaultValue=""
        onInput={(e) => {
          const val = (e.target as HTMLInputElement).value;
          setHasText(Boolean(val));
          onQueryChange(val);
        }}
        placeholder="Filter history..."
        style={{ direction: "ltr", unicodeBidi: "plaintext", textAlign: "left" }}
        className={`w-full h-10 rounded-xl border pl-8 pr-8 text-xs font-bold focus:outline-none transition ${tokens.inputClass}`}
      />
      {hasText && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Clear history filter"
          className={`absolute right-2.5 top-1/2 -translate-y-1/2 text-xs hover:text-white cursor-pointer ${tokens.subMutedText}`}
        >
          ✕
        </button>
      )}
    </div>
  );
});

function WatchHistoryComponent() {
  const navigate = useNavigate();
  const [historyMap, setHistoryMap] = useState<
    Record<string, ShowWatchHistory>
  >({});
  const [episodeAlerts, setEpisodeAlerts] = useState<
    Record<string, EpisodeRadarAlert>
  >(() => getCachedEpisodeAlerts());
  const [recentLiveChannels, setRecentLiveChannels] = useState<
    RecentLiveChannel[]
  >([]);
  const [dislikedTitles, setDislikedTitles] = useState<DislikedTitle[]>([]);
  const [stats, setStats] = useState<WatchActivityStats>(() =>
    getWatchActivityStats()
  );

  // Interactive Filters & Management UI State
  const [activeTab, setActiveTab] = useState<ActivityTab>("all");
  const [sortBy, setSortBy] = useState<ActivitySort>("recent");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  const [verifyingTarget, setVerifyingTarget] = useState<{
    showId: string;
    episodeId: string;
    title: string;
  } | null>(null);

  const [confirmClearScope, setConfirmClearScope] = useState<{
    scope: ClearHistoryScope;
    label: string;
  } | null>(null);

  // Live Settings from settings.ts
  const [appTheme, setAppTheme] = useState<AppTheme>(() => getSavedTheme());
  const [cardSize, setCardSize] = useState<CardSize>(() => getSavedCardSize());
  const [historyOverscale, setHistoryOverscale] = useState<HistoryScale>(() =>
    getHistoryOverscale()
  );
  const [largeButtons, setLargeButtons] = useState<boolean>(() =>
    getLargeButtons()
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
  const [glowOff, setGlowOff] = useState<boolean>(
    () => getGlowIntensity() === "off"
  );
  const [isLowRam, setIsLowRam] = useState<boolean>(
    () => getHardwareLimits().effectiveMode === "low"
  );
  const [clockFormat, setClockFormat] = useState(() => getClockFormat());

  const [canScrollDown, setCanScrollDown] = useState(false);
  const [showScrollReminder, setShowScrollReminder] = useState(false);

  const tickingRef = useRef(false);

  const bannerTimerRef = useRef<number | null>(null);
  const showTempBanner = useCallback((msg: string) => {
    setStatusBanner(msg);
    if (bannerTimerRef.current) window.clearTimeout(bannerTimerRef.current);
    bannerTimerRef.current = window.setTimeout(() => {
      setStatusBanner(null);
      bannerTimerRef.current = null;
    }, 3000);
  }, []);

  useEffect(() => {
    return () => {
      if (bannerTimerRef.current) window.clearTimeout(bannerTimerRef.current);
    };
  }, []);

  const refreshData = useCallback(() => {
    const nextTheme = getSavedTheme();
    setHistoryMap({ ...getWatchHistory() });
    setRecentLiveChannels([...getRecentLiveChannels()]);
    setDislikedTitles([...getDislikedTitles()]);
    setStats(getWatchActivityStats());
    setAppTheme(nextTheme);
    setCardSize(getSavedCardSize());
    setHistoryOverscale(getHistoryOverscale());
    setLargeButtons(getLargeButtons());
    setPosterAppearance(getPosterAppearanceClasses(nextTheme));
    setPosterWidth(getOptimalTmdbImageWidth());
    setReducedMotion(getReducedMotion());
    setGlowOff(getGlowIntensity() === "off");
    setIsLowRam(getHardwareLimits().effectiveMode === "low");
    setClockFormat(getClockFormat());
  }, []);

  useEffect(() => {
    refreshData();
    window.addEventListener("rabtv_watch_history_updated", refreshData);
    window.addEventListener("rabtv_disliked_updated", refreshData);
    const syncRadar = () => setEpisodeAlerts(getCachedEpisodeAlerts());

    window.addEventListener("rabtv_settings_updated", refreshData);
    window.addEventListener("rabtv_ram_mode_updated", refreshData);
    window.addEventListener(EPISODE_RADAR_UPDATED_EVENT, syncRadar);
    return () => {
      window.removeEventListener("rabtv_watch_history_updated", refreshData);
      window.removeEventListener("rabtv_disliked_updated", refreshData);
      window.removeEventListener("rabtv_settings_updated", refreshData);
      window.removeEventListener("rabtv_ram_mode_updated", refreshData);
      window.removeEventListener(EPISODE_RADAR_UPDATED_EVENT, syncRadar);
    };
  }, [refreshData]);

  // Background New Episode Radar scan (12h cached, capped concurrency & RAM safe)
  const trackedTvIdsKey = useMemo(() => {
    return Object.values(historyMap)
      .filter((s) => s.mediaType === "tv")
      .sort((a, b) => (b.lastWatchedAt || 0) - (a.lastWatchedAt || 0))
      .map((s) => s.showId)
      .slice(0, 12)
      .join(",");
  }, [historyMap]);

  useEffect(() => {
    if (!trackedTvIdsKey) return;
    const ids = trackedTvIdsKey.split(",").filter(Boolean);
    const controller = new AbortController();
    let active = true;

    void scanTrackedShowsForNewEpisodes(ids, controller.signal).then(
      (alerts) => {
        if (active) setEpisodeAlerts(alerts);
      }
    );

    return () => {
      active = false;
      controller.abort();
    };
  }, [trackedTvIdsKey]);

  // Escape closes confirmation modals cleanly on TV remotes / keyboards
  useEffect(() => {
    if (!verifyingTarget && !confirmClearScope) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setVerifyingTarget(null);
        setConfirmClearScope(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [verifyingTarget, confirmClearScope]);

  useEffect(() => {
    const checkVerticalScroll = () => {
      if (!tickingRef.current) {
        window.requestAnimationFrame(() => {
          const scrollTop =
            window.scrollY || document.documentElement.scrollTop;
          const scrollHeight = document.documentElement.scrollHeight;
          const clientHeight = window.innerHeight;
          setCanScrollDown(scrollTop + clientHeight < scrollHeight - 80);
          tickingRef.current = false;
        });
        tickingRef.current = true;
      }
    };

    checkVerticalScroll();
    window.addEventListener("scroll", checkVerticalScroll, { passive: true });
    window.addEventListener("resize", checkVerticalScroll);
    return () => {
      window.removeEventListener("scroll", checkVerticalScroll);
      window.removeEventListener("resize", checkVerticalScroll);
    };
  }, [historyMap, recentLiveChannels, dislikedTitles, activeTab]);

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

  const handleEyeballClick = useCallback(
    (
      showId: string,
      episodeId: string,
      episodeTitle: string,
      isCompleted: boolean
    ) => {
      if (!isCompleted) {
        setVerifyingTarget({ showId, episodeId, title: episodeTitle });
      } else {
        markEpisodeCompleted(showId, episodeId, false);
        refreshData();
      }
    },
    [refreshData]
  );

  const handleConfirmModal = (completed: boolean) => {
    if (verifyingTarget) {
      markEpisodeCompleted(
        verifyingTarget.showId,
        verifyingTarget.episodeId,
        completed
      );
      setVerifyingTarget(null);
      refreshData();
    }
  };

  const handleExecuteClearScope = () => {
    if (!confirmClearScope) return;
    clearWatchHistoryScope(confirmClearScope.scope);
    showTempBanner(`✓ ${confirmClearScope.label} completed.`);
    setConfirmClearScope(null);
    refreshData();
  };

  const handleExportActivity = () => {
    const snapshot = exportWatchHistorySnapshot();
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rabtv_watch_history_${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showTempBanner("💾 Watch history backup exported!");
  };

  const handlePinLiveChannel = (channel: RecentLiveChannel) => {
    const res = toggleFavoriteChannel(channel.channelId);
    if (res.limitReached) {
      showTempBanner(
        `Max ${MAX_FAVORITE_CHANNELS} pinned channels reached — unpin one first.`
      );
    } else {
      showTempBanner(
        res.added
          ? `⭐ Pinned "${channel.title}" to Live TV Favorites!`
          : `Removed "${channel.title}" from Favorites.`
      );
    }
    refreshData();
  };

  const themeTokens = useMemo(
    () => getWatchHistoryThemeTokens(appTheme),
    [appTheme]
  );

  const gridColsClass = useMemo(() => {
    let reductionOffset = 0;
    if (historyOverscale === "20%") reductionOffset = 1;
    if (historyOverscale === "50%") reductionOffset = 2;
    if (historyOverscale === "80%") reductionOffset = 3;

    switch (cardSize) {
      case "small":
        return reductionOffset >= 3
          ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
          : reductionOffset >= 2
            ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6"
            : "grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7";
      case "medium":
        return reductionOffset >= 2
          ? "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
          : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6";
      case "large":
      default:
        return reductionOffset >= 2
          ? "grid-cols-1 sm:grid-cols-2 md:grid-cols-3"
          : "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5";
    }
  }, [cardSize, historyOverscale]);

  // Filter + sort entries according to active search & sort controls
  const {
    allEntries,
    inProgressMovies,
    completedMovies,
    inProgressShows,
    completedShows,
    filteredLive,
    filteredDisliked,
  } = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const sortEntries = (list: ShowWatchHistory[]) =>
      [...list].sort((a, b) => {
        if (sortBy === "az") return a.title.localeCompare(b.title);
        if (sortBy === "progress") {
          return calculateSeriesProgress(b) - calculateSeriesProgress(a);
        }
        return (b.lastWatchedAt || 0) - (a.lastWatchedAt || 0);
      });

    const entries = sortEntries(
      Object.values(historyMap).filter((item) =>
        q ? item.title.toLowerCase().includes(q) : true
      )
    );

    const shows = entries.filter((item) => item.mediaType === "tv");
    const movs = entries.filter((item) => item.mediaType === "movie");

    const live = recentLiveChannels.filter((c) =>
      q ? c.title.toLowerCase().includes(q) : true
    );
    const disliked = dislikedTitles.filter((d) =>
      q ? (d.title || "").toLowerCase().includes(q) : true
    );

    return {
      allEntries: entries,
      inProgressMovies: movs.filter((m) => calculateSeriesProgress(m) < 100),
      completedMovies: movs.filter((m) => calculateSeriesProgress(m) >= 100),
      inProgressShows: shows.filter((s) => calculateSeriesProgress(s) < 100),
      completedShows: shows.filter((s) => calculateSeriesProgress(s) >= 100),
      filteredLive: live,
      filteredDisliked: disliked,
    };
  }, [historyMap, recentLiveChannels, dislikedTitles, searchQuery, sortBy]);

  const showLiveSection =
    (activeTab === "all" || activeTab === "live") && filteredLive.length > 0;
  const showInProgressMovies =
    (activeTab === "all" ||
      activeTab === "in_progress" ||
      activeTab === "movies") &&
    inProgressMovies.length > 0;
  const showInProgressShows =
    (activeTab === "all" ||
      activeTab === "in_progress" ||
      activeTab === "tv") &&
    inProgressShows.length > 0;
  const showCompletedSection =
    (activeTab === "all" ||
      activeTab === "completed" ||
      activeTab === "movies" ||
      activeTab === "tv") &&
    ((activeTab !== "tv" && completedMovies.length > 0) ||
      (activeTab !== "movies" && completedShows.length > 0));
  const showDislikedSection =
    (activeTab === "all" || activeTab === "disliked") &&
    filteredDisliked.length > 0;

  const unseenEpisodeAlerts = useMemo(() => {
    const list: { show: ShowWatchHistory; alert: EpisodeRadarAlert }[] = [];
    for (const show of Object.values(historyMap)) {
      if (show.mediaType !== "tv") continue;
      const alert = episodeAlerts[show.showId];
      if (alert && isAlertUnseenByUser(alert, show.episodes)) {
        list.push({ show, alert });
      }
    }
    return list.sort((a, b) => a.alert.daysAgo - b.alert.daysAgo);
  }, [historyMap, episodeAlerts]);

  const hasVisibleContent =
    showLiveSection ||
    showInProgressMovies ||
    showInProgressShows ||
    showCompletedSection ||
    showDislikedSection;

  const iconBtnClass = largeButtons ? "h-8 w-8 text-xs" : "h-6 w-6 text-[11px]";

  return (
    <div
      data-tour="history-page"
      className={`min-h-screen w-full max-w-full ${themeTokens.pageBg} ${themeTokens.baseText} p-2.5 sm:p-6 md:p-10 space-y-5 sm:space-y-6 transition-colors duration-300 pb-16 overflow-x-clip relative rounded-3xl`}
    >
      <style>{WATCH_HISTORY_VIEWPORT_STYLES}</style>
      <AppWallpaper />
      {!isLowRam && !reducedMotion && !glowOff && (
        <div
          className={`absolute inset-x-0 -top-12 h-96 bg-gradient-to-b ${themeTokens.ambient} blur-3xl z-0 pointer-events-none rounded-t-3xl`}
        />
      )}

      <div className="relative z-10 max-w-7xl mx-auto space-y-5 sm:space-y-6 min-w-0">
        {/* Top Utility Row: Landscape Full-Width Wrapper — Back to Home Left, My List Right */}
        <div className="rabtv-wh-top-bar">
          <div className="rabtv-wh-dual-wrap">
            <div
              className="rabtv-wh-art-bg"
              aria-hidden="true"
              style={{
                backgroundImage: `url(${IMG_BUTTON_WRAPPER})`,
              }}
            />
            <Link
              to="/"
              data-tour="back-to-home"
              aria-label="Back to Home"
              title="Back to Home"
              className={`rabtv-wh-img-btn relative z-10 rounded-full px-4 py-2 text-xs font-extrabold text-white focus:outline-none focus:ring-2 ${themeTokens.focusRing}`}
            >
              <span
                className="rabtv-wh-img-btn-art"
                aria-hidden="true"
                style={{ backgroundImage: `url(${IMG_BTN_HOME})`, filter: "var(--rabtv-wh-plate-filter)" }}
              />
              <span className="rabtv-wh-img-btn-scrim" aria-hidden="true" />
              <span className="rabtv-wh-img-btn-label">← Back to Home</span>
            </Link>

            <Link
              to="/"
              search={{ tab: "My List" }}
              className={`rabtv-wh-img-btn relative z-10 rounded-full px-4 py-2 text-xs font-extrabold text-white focus:outline-none focus:ring-2 ${themeTokens.focusRing}`}
            >
              <span
                className="rabtv-wh-img-btn-art"
                aria-hidden="true"
                style={{ backgroundImage: `url(${IMG_BTN_FILTER_IDLE})`, filter: "var(--rabtv-wh-plate-filter)" }}
              />
              <span className="rabtv-wh-img-btn-scrim" aria-hidden="true" />
              <span className="rabtv-wh-img-btn-label">🔖 My List</span>
            </Link>
          </div>

          <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2 w-full">
            <Link
              to="/live-tv"
              className={`inline-flex items-center gap-1.5 rounded-full border backdrop-blur-sm px-3 py-1.5 text-[11px] sm:text-xs font-bold transition shrink-0 focus:outline-none focus:ring-2 ${themeTokens.btnSecondary} ${themeTokens.focusRing}`}
            >
              <span>📡 Live TV</span>
            </Link>

            <button
              type="button"
              data-tour="history-export"
              onClick={handleExportActivity}
              className={`inline-flex items-center gap-1.5 rounded-full border backdrop-blur-sm px-3 py-1.5 text-[11px] sm:text-xs font-extrabold transition cursor-pointer shrink-0 focus:outline-none focus:ring-2 ${themeTokens.btnSecondary} ${themeTokens.focusRing}`}
            >
              <span>💾 Export JSON</span>
            </button>
          </div>
        </div>

        {/* Status Feedback Toast */}
        {statusBanner && (
          <div
            className={`rounded-2xl border px-4 py-2 text-center text-xs font-extrabold shadow-lg ${themeTokens.statusBanner}`}
          >
            {statusBanner}
          </div>
        )}

        {/* Executive Watch Activity Dashboard (Time Machine Character Panel) */}
        <div
          className={`rabtv-wh-plate rounded-3xl border p-3.5 sm:p-6 ${themeTokens.surfacePanel}`}
        >
          <div
            className="rabtv-wh-plate-bg"
            aria-hidden="true"
            style={{ backgroundImage: `url(${IMG_WH_TIMEMACHINE_BG})` }}
          />
          <div className="rabtv-wh-plate-scrim" aria-hidden="true" />
          <div className="relative z-10 space-y-4 sm:space-y-5">
          {/* Header + Search & Sort Controls */}
          <div
            className={`flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4 ${themeTokens.dividerBorder}`}
          >
            <div className="min-w-0 flex-1 text-left">
              <h1 className="text-lg sm:text-2xl font-black tracking-tight text-white leading-tight">
                Watch History & Activity
              </h1>
              <p
                className={`text-[11px] sm:text-xs font-medium leading-relaxed mt-1 ${themeTokens.subMutedText}`}
              >
                Resume shows, track episodes & manage hidden titles
                {stats.topGenreName && (
                  <>
                    {" "}
                    • Vibe:{" "}
                    <strong className={themeTokens.accentText}>
                      {stats.topGenreName}
                    </strong>
                  </>
                )}
              </p>
            </div>

            {/* Portrait-Safe Search + Sort Row */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
              <HistoryFilterInput
                tokens={themeTokens}
                onQueryChange={setSearchQuery}
              />

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as ActivitySort)}
                aria-label="Sort watch history"
                className={`h-10 rounded-xl border px-3 text-xs font-bold focus:outline-none cursor-pointer shrink-0 ${themeTokens.inputClass}`}
              >
                <option value="recent" className={themeTokens.optionBg}>
                  Most Recent
                </option>
                <option value="progress" className={themeTokens.optionBg}>
                  📊 Progress %
                </option>
                <option value="az" className={themeTokens.optionBg}>
                  🔤 Title A–Z
                </option>
              </select>
            </div>
          </div>

          {/* Compact 4-Card KPI Activity Telemetry Strip (Zero Truncation on Portrait Phones) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            <div
              className={`rounded-2xl border p-3 sm:p-3.5 flex flex-col justify-between gap-1 min-w-0 ${themeTokens.subPanel}`}
            >
              <span
                className={`text-[9.5px] sm:text-[10px] font-extrabold uppercase tracking-wide whitespace-nowrap ${themeTokens.subMutedText}`}
              >
                In Progress
              </span>
              <p className={`text-lg sm:text-xl font-black leading-tight ${themeTokens.accentText}`}>
                {stats.inProgressMovies + stats.inProgressShows}
              </p>
              <span className={`text-[9.5px] sm:text-[10px] leading-snug ${themeTokens.subMutedText}`}>
                {stats.inProgressMovies} {stats.inProgressMovies === 1 ? "movie" : "movies"} •{" "}
                {stats.inProgressShows} {stats.inProgressShows === 1 ? "show" : "shows"}
              </span>
            </div>

            <div
              className={`rounded-2xl border p-3 sm:p-3.5 flex flex-col justify-between gap-1 min-w-0 ${themeTokens.subPanel}`}
            >
              <div className="flex items-center justify-between gap-1 min-w-0">
                <span
                  className={`text-[9.5px] sm:text-[10px] font-extrabold uppercase tracking-wide whitespace-nowrap ${themeTokens.subMutedText}`}
                >
                  Completed
                </span>
                <span className="text-[9.5px] sm:text-[10px] font-black text-emerald-400 shrink-0">
                  {stats.completionRatePct}%
                </span>
              </div>
              <p className="text-lg sm:text-xl font-black leading-tight text-emerald-300">
                {stats.totalCompleted}
              </p>
              <div
                className={`h-1.5 w-full rounded-full overflow-hidden border ${themeTokens.progressTrack}`}
              >
                <div
                  className={`h-full transition-all duration-300 ${themeTokens.progressFill}`}
                  style={{ width: `${Math.max(4, stats.completionRatePct)}%` }}
                />
              </div>
            </div>

            <div
              className={`rounded-2xl border p-3 sm:p-3.5 flex flex-col justify-between gap-1 min-w-0 ${themeTokens.subPanel}`}
            >
              <span
                className={`text-[9.5px] sm:text-[10px] font-extrabold uppercase tracking-wide whitespace-nowrap ${themeTokens.subMutedText}`}
              >
                Live TV
              </span>
              <p className={`text-lg sm:text-xl font-black leading-tight ${themeTokens.accentText}`}>
                {stats.recentLiveCount}
              </p>
              <span className={`text-[9.5px] sm:text-[10px] leading-snug ${themeTokens.subMutedText}`}>
                Recent channels
              </span>
            </div>

            <div
              className={`rounded-2xl border p-3 sm:p-3.5 flex flex-col justify-between gap-1 min-w-0 ${themeTokens.subPanel}`}
            >
              <span
                className={`text-[9.5px] sm:text-[10px] font-extrabold uppercase tracking-wide whitespace-nowrap ${themeTokens.subMutedText}`}
              >
                Hidden
              </span>
              <p className="text-lg sm:text-xl font-black leading-tight text-white">
                {stats.dislikedCount}
              </p>
              <span className={`text-[9.5px] sm:text-[10px] leading-snug ${themeTokens.subMutedText}`}>
                Skipped titles
              </span>
            </div>
          </div>

          {/* Interactive Activity Filter Tabs */}
          <div
            data-tour="history-filters"
            className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5"
          >
            {(
              [
                {
                  id: "all",
                  label: `✨ All (${
                    allEntries.length +
                    filteredLive.length +
                    filteredDisliked.length
                  })`,
                },
                {
                  id: "in_progress",
                  label: `⏳ In Progress (${
                    inProgressMovies.length + inProgressShows.length
                  })`,
                },
                {
                  id: "movies",
                  label: `🎬 Movies (${
                    inProgressMovies.length + completedMovies.length
                  })`,
                },
                {
                  id: "tv",
                  label: `📺 TV Shows (${
                    inProgressShows.length + completedShows.length
                  })`,
                },
                { id: "live", label: `📡 Live TV (${filteredLive.length})` },
                {
                  id: "completed",
                  label: `✓ Completed (${
                    completedMovies.length + completedShows.length
                  })`,
                },
                {
                  id: "disliked",
                  label: `👎 Disliked (${filteredDisliked.length})`,
                },
              ] as { id: ActivityTab; label: string }[]
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`shrink-0 rounded-xl border ${
                  largeButtons ? "px-4 py-2.5 text-xs" : "px-3 py-1.5 text-[11px]"
                } font-extrabold whitespace-nowrap transition cursor-pointer focus:outline-none focus:ring-2 ${
                  themeTokens.focusRing
                } ${
                  activeTab === tab.id
                    ? `${themeTokens.btnActive} border-transparent`
                    : themeTokens.btnTabIdle
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Quick Guide + Safe Bulk Cleanup Toolbar */}
          <div
            className={`pt-3 border-t flex flex-wrap items-center justify-between gap-2.5 text-[11px] ${themeTokens.dividerBorder} ${themeTokens.mutedText}`}
          >
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className={`inline-flex items-center gap-1 border rounded-lg px-2 py-0.5 ${themeTokens.subtleBadge}`}
              >
                <strong>👁️</strong> Mark Watched
              </span>
              <span
                className={`inline-flex items-center gap-1 border rounded-lg px-2 py-0.5 ${themeTokens.subtleBadge}`}
              >
                <strong className={themeTokens.accentText}>👎</strong> Hide Globally
              </span>
              <span
                className={`inline-flex items-center gap-1 border rounded-lg px-2 py-0.5 ${themeTokens.subtleBadge}`}
              >
                <strong className="text-red-400">✕</strong> Remove
              </span>
            </div>

            <div
              data-tour="history-bulk-delete"
              className="flex flex-wrap items-center gap-1.5"
            >
              {stats.totalCompleted > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setConfirmClearScope({
                      scope: "completed",
                      label: "Clear all completed titles",
                    })
                  }
                  className={`rounded-lg border px-2.5 py-1 text-[10px] font-bold transition cursor-pointer ${themeTokens.btnSecondary}`}
                >
                  🧹 Clear Completed
                </button>
              )}
              {stats.dislikedCount > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setConfirmClearScope({
                      scope: "disliked",
                      label: "Restore all disliked titles back to catalogs",
                    })
                  }
                  className={`rounded-lg border px-2.5 py-1 text-[10px] font-bold transition cursor-pointer ${themeTokens.btnSecondary}`}
                >
                  ↺ Restore Disliked
                </button>
              )}
              {stats.totalTrackedMedia + stats.recentLiveCount > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setConfirmClearScope({
                      scope: "all",
                      label: "Wipe all watch history & activity",
                    })
                  }
                  className="rounded-lg bg-red-950/75 hover:bg-red-700 border border-red-500/45 px-2.5 py-1 text-[10px] font-extrabold text-red-200 hover:text-white transition cursor-pointer"
                >
                  🗑️ Clear All
                </button>
              )}
            </div>
          </div>
          </div>
        </div>

        {/* NEW EPISODE RADAR BANNER (rabbit-tv-history-radar-panel.jpg) */}
        {unseenEpisodeAlerts.length > 0 && (
          <section
            data-tour="episode-radar-banner"
            className={`rabtv-wh-plate rabtv-wh-plate--radar rounded-3xl border ${themeTokens.surfacePanel}`}
          >
            <div
              className="rabtv-wh-plate-bg"
              aria-hidden="true"
              style={{ backgroundImage: `url(${IMG_WH_RADAR_PANEL})` }}
            />
            <div className="rabtv-wh-plate-scrim" aria-hidden="true" />
            <div className="relative z-10 space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`w-1.5 h-5 rounded-full shrink-0 ${themeTokens.accentBar}`}
                  />
                  <h2 className="text-sm sm:text-base font-black text-white truncate">
                    New Episode Radar
                  </h2>
                </div>
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-[10px] sm:text-[11px] font-extrabold shrink-0 ${themeTokens.badgeBg}`}
                >
                  {unseenEpisodeAlerts.length} New
                </span>
              </div>
              <p className={`text-[10px] sm:text-xs leading-relaxed ${themeTokens.subMutedText}`}>
                Fresh episodes aired recently for shows you watch — tap to play.
              </p>
            </div>

            <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-none">
              {unseenEpisodeAlerts.map(({ show, alert }) => (
                <button
                  key={show.showId}
                  type="button"
                  onClick={() => {
                    bgAudio.pause();
                    navigate({
                      to: "/player",
                      search: {
                        id: show.showId,
                        type: "tv",
                        season: alert.seasonNumber,
                        episode: alert.episodeNumber,
                      },
                    });
                  }}
                  className={`group shrink-0 flex items-center gap-2.5 rounded-2xl border px-3 py-2 text-left transition hover:-translate-y-0.5 cursor-pointer focus:outline-none focus:ring-2 ${themeTokens.btnSecondary} ${themeTokens.focusRing}`}
                >
                  <div className="min-w-0 max-w-[190px]">
                    <span className="block text-xs font-black text-white truncate">
                      {show.title}
                    </span>
                    <span className={`block text-[10px] font-bold truncate ${themeTokens.accentText}`}>
                      {alert.badgeLabel}
                    </span>
                  </div>
                  <span
                    className={`shrink-0 rounded-xl px-2.5 py-1 text-[10px] font-black uppercase ${themeTokens.btnActive}`}
                  >
                    ▶ Play
                  </span>
                </button>
              ))}
            </div>
            </div>
          </section>
        )}

        {/* MAIN ACTIVITY CONTENT */}
        {!hasVisibleContent ? (
          <div
            className={`rabtv-wh-plate rabtv-wh-plate--empty rounded-3xl border text-center shadow-2xl ${themeTokens.surfacePanel}`}
          >
            <div
              className="rabtv-wh-plate-bg"
              aria-hidden="true"
              style={{ backgroundImage: `url(${IMG_WH_EMPTY_STATE})` }}
            />
            <div className="rabtv-wh-plate-scrim" aria-hidden="true" />
            <div className="relative z-10 space-y-2.5 pb-8">
            <div className="text-3xl mb-1">🎬</div>
            <p className="text-base font-bold text-white">
              {searchQuery.trim()
                ? `No activity matches "${searchQuery.trim()}".`
                : "Nothing recorded in this section yet."}
            </p>
            <p
              className={`text-xs max-w-md mx-auto ${themeTokens.subMutedText}`}
            >
              Start watching movies, shows, or live broadcasts and your progress
              will appear here automatically.
            </p>
            </div>
          </div>
        ) : (
          <div data-tour="history-list" className="space-y-8 sm:space-y-10">
            {/* 1. RECENTLY WATCHED LIVE TV */}
            {showLiveSection && (
              <section className="space-y-4">
                <div className="rabtv-wh-section-ribbon">
                  <div
                    className="rabtv-wh-art-bg"
                    aria-hidden="true"
                    style={{
                      backgroundImage: `url(${IMG_BUTTON_WRAPPER})`,
                    }}
                  />
                  <h2 className="rabtv-wh-section-title font-black tracking-tight text-white uppercase truncate drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)]">
                    📡 Recent Live TV
                  </h2>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 pt-1 items-start">
                  {filteredLive.map((channel) => {
                    const pinned = isFavoriteChannel(channel.channelId);
                    return (
                      <div
                        key={channel.channelId}
                        data-tour="history-item"
                        className={`rabtv-wh-plate rabtv-wh-plate--card group relative ${posterAppearance.radiusClass} border ${
                          pinned
                            ? themeTokens.liveCardPinned
                            : themeTokens.liveCard
                        } shadow-xl hover:-translate-y-1 transition-all duration-300 text-center flex flex-col items-center justify-between overflow-hidden`}
                      >
                        <div
                          className="rabtv-wh-plate-bg"
                          aria-hidden="true"
                          style={{ backgroundImage: `url(${IMG_WH_CARD_FRAME})` }}
                        />
                        <div className="rabtv-wh-plate-scrim" aria-hidden="true" />
                        <div className="relative z-10 w-full flex items-center justify-between gap-1 mb-2">
                          <button
                            type="button"
                            onClick={() => handlePinLiveChannel(channel)}
                            className={`flex items-center justify-center rounded-lg border transition font-bold shadow-md cursor-pointer ${iconBtnClass} ${
                              pinned
                                ? themeTokens.iconBtnPinned
                                : themeTokens.iconBtn
                            }`}
                            title={
                              pinned
                                ? "Unpin from Favorites"
                                : "Pin to Live TV Favorites"
                            }
                          >
                            {pinned ? "★" : "☆"}
                          </button>

                          <button
                            type="button"
                            data-tour="history-delete"
                            onClick={() => {
                              removeRecentLiveChannel(channel.channelId);
                              refreshData();
                            }}
                            className={`flex items-center justify-center rounded-lg bg-black/80 text-red-300 border border-red-500/35 transition hover:bg-red-600 hover:text-white font-bold shadow-md cursor-pointer ${iconBtnClass}`}
                            title="Remove from history"
                          >
                            ✕
                          </button>
                        </div>

                        <Link
                          to="/live-player"
                          search={{
                            url: channel.streamUrl,
                            title: channel.title,
                            logo: channel.logo || "",
                            channelId: channel.channelId,
                          }}
                          onClick={() => bgAudio.pause()}
                          className="w-full flex flex-col items-center"
                        >
                          <div
                            className={`w-full h-20 rounded-xl mb-2 overflow-hidden flex items-center justify-center border p-2.5 ${themeTokens.logoStage}`}
                          >
                            {channel.logo ? (
                              <img
                                src={channel.logo}
                                alt={channel.title}
                                className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                                loading="lazy"
                                decoding="async"
                              />
                            ) : (
                              <span
                                className={`text-xs font-black tracking-widest ${themeTokens.accentText}`}
                              >
                                ● LIVE
                              </span>
                            )}
                          </div>
                          <span className="text-xs font-black line-clamp-1 text-white">
                            {channel.title}
                          </span>
                          <span
                            className={`text-[10px] mt-0.5 ${themeTokens.subMutedText}`}
                          >
                            {formatWatchedAgo(channel.watchedAt, clockFormat)}
                          </span>
                          <span
                            className={`mt-2 w-full ${
                              largeButtons ? "py-2 text-xs" : "py-1.5 text-[10px]"
                            } font-extrabold uppercase tracking-wider rounded-xl group-hover:brightness-110 transition ${
                              themeTokens.btnActive
                            }`}
                          >
                            ▶ Resume Live
                          </span>
                        </Link>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* 2. MOVIES - IN PROGRESS */}
            {showInProgressMovies && (
              <section className="space-y-4">
                <div className="rabtv-wh-section-ribbon">
                  <div
                    className="rabtv-wh-art-bg"
                    aria-hidden="true"
                    style={{
                      backgroundImage: `url(${IMG_BUTTON_WRAPPER})`,
                    }}
                  />
                  <h2 className="rabtv-wh-section-title font-black tracking-tight text-white uppercase truncate drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)]">
                    🎬 Movies — In Progress
                  </h2>
                </div>

                <div
                  className={`grid ${gridColsClass} gap-3.5 sm:gap-5 pt-1 items-start`}
                >
                  {inProgressMovies.map((movie) => (
                    <MovieCard
                      key={movie.showId}
                      movie={movie}
                      themeTokens={themeTokens}
                      posterAppearance={posterAppearance}
                      posterWidth={posterWidth}
                      largeButtons={largeButtons}
                      clockFormat={clockFormat}
                      glowOff={glowOff}
                      onEyeballClick={handleEyeballClick}
                      onRemove={() => {
                        removeFromWatchHistory(movie.showId);
                        refreshData();
                      }}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* 3. TV SHOWS - IN PROGRESS */}
            {showInProgressShows && (
              <section className="space-y-4">
                <div className="rabtv-wh-section-ribbon">
                  <div
                    className="rabtv-wh-art-bg"
                    aria-hidden="true"
                    style={{
                      backgroundImage: `url(${IMG_BUTTON_WRAPPER})`,
                    }}
                  />
                  <h2 className="rabtv-wh-section-title font-black tracking-tight text-white uppercase truncate drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)]">
                    📺 TV Shows — In Progress
                  </h2>
                </div>

                <div
                  className={`grid ${gridColsClass} gap-3.5 sm:gap-5 pt-1 items-start`}
                >
                  {inProgressShows.map((show) => {
                    const rawAlert = episodeAlerts[show.showId];
                    const activeAlert =
                      rawAlert && isAlertUnseenByUser(rawAlert, show.episodes)
                        ? rawAlert
                        : null;
                    return (
                    <TvShowCard
                      key={show.showId}
                      show={show}
                      newEpisodeAlert={activeAlert}
                      themeTokens={themeTokens}
                      posterAppearance={posterAppearance}
                      posterWidth={posterWidth}
                      largeButtons={largeButtons}
                      clockFormat={clockFormat}
                      glowOff={glowOff}
                      onEyeballClick={handleEyeballClick}
                      onMarkAllDone={() => {
                        markEntireShowCompleted(show.showId, true);
                        showTempBanner(`✓ Marked "${show.title}" completed!`);
                        refreshData();
                      }}
                      onRemove={() => {
                        removeFromWatchHistory(show.showId);
                        refreshData();
                      }}
                    />
                    );
                  })}
                </div>
              </section>
            )}

            {/* 4. COMPLETED */}
            {showCompletedSection && (
              <section className="space-y-4">
                <div className="rabtv-wh-section-ribbon">
                  <div
                    className="rabtv-wh-art-bg"
                    aria-hidden="true"
                    style={{
                      backgroundImage: `url(${IMG_BUTTON_WRAPPER})`,
                    }}
                  />
                  <h2 className="rabtv-wh-section-title font-black tracking-tight text-emerald-300 uppercase truncate drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)]">
                    ✓ Completed
                  </h2>
                </div>

                <div
                  className={`grid ${gridColsClass} gap-3.5 sm:gap-5 pt-1 items-start`}
                >
                  {activeTab !== "tv" &&
                    completedMovies.map((movie) => (
                      <MovieCard
                        key={movie.showId}
                        movie={movie}
                        themeTokens={themeTokens}
                        posterAppearance={posterAppearance}
                        posterWidth={posterWidth}
                        largeButtons={largeButtons}
                        clockFormat={clockFormat}
                        glowOff={glowOff}
                        onEyeballClick={handleEyeballClick}
                        onRemove={() => {
                          removeFromWatchHistory(movie.showId);
                          refreshData();
                        }}
                      />
                    ))}
                  {activeTab !== "movies" &&
                    completedShows.map((show) => {
                      const rawAlert = episodeAlerts[show.showId];
                      const activeAlert =
                        rawAlert && isAlertUnseenByUser(rawAlert, show.episodes)
                          ? rawAlert
                          : null;
                      return (
                      <TvShowCard
                        key={show.showId}
                        show={show}
                        newEpisodeAlert={activeAlert}
                        themeTokens={themeTokens}
                        posterAppearance={posterAppearance}
                        posterWidth={posterWidth}
                        largeButtons={largeButtons}
                        clockFormat={clockFormat}
                        glowOff={glowOff}
                        onEyeballClick={handleEyeballClick}
                        onMarkAllDone={() => {
                          markEntireShowCompleted(show.showId, false);
                          refreshData();
                        }}
                        onRemove={() => {
                          removeFromWatchHistory(show.showId);
                          refreshData();
                        }}
                      />
                      );
                    })}
                </div>
              </section>
            )}

            {/* 5. DISLIKED / REMOVED */}
            {showDislikedSection && (
              <section className="space-y-4">
                <div className="rabtv-wh-section-ribbon">
                  <div
                    className="rabtv-wh-art-bg"
                    aria-hidden="true"
                    style={{
                      backgroundImage: `url(${IMG_BUTTON_WRAPPER})`,
                    }}
                  />
                  <h2 className="rabtv-wh-section-title font-black tracking-tight text-white uppercase truncate drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)]">
                    👎 Disliked / Hidden
                  </h2>
                </div>

                <div
                  className={`grid ${gridColsClass} gap-3.5 sm:gap-4 pt-1 items-start`}
                >
                  {filteredDisliked.map((item) => (
                    <div
                      key={item.id}
                      className={`rabtv-wh-plate rabtv-wh-plate--card group relative ${posterAppearance.radiusClass} border overflow-hidden shadow-lg flex flex-col justify-between transition ${
                        themeTokens.surfacePanel
                      }`}
                    >
                      <div
                        className="rabtv-wh-plate-bg"
                        aria-hidden="true"
                        style={{ backgroundImage: `url(${IMG_WH_CARD_FRAME})` }}
                      />
                      <div className="rabtv-wh-plate-scrim" aria-hidden="true" />
                      <div className="relative z-10 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`text-[10px] font-extrabold border px-2 py-0.5 rounded-md uppercase ${themeTokens.badgeBg}`}
                          >
                            {item.mediaType || "Media"}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              removeDislikedTitle(item.id);
                              showTempBanner(
                                `↺ Restored "${item.title || "Title"}" to catalogs.`
                              );
                              refreshData();
                            }}
                            className={`inline-flex items-center gap-1 rounded-lg border font-bold text-[10px] px-2.5 py-1 transition cursor-pointer ${themeTokens.btnSecondary}`}
                            title="Restore to Catalog"
                          >
                            <span>↺ Restore</span>
                          </button>
                        </div>
                        <h3
                          className="text-xs font-bold text-white truncate pt-0.5"
                          title={item.title}
                        >
                          {item.title}
                        </h3>
                      </div>
                      <span
                        className={`text-[9px] pt-2 font-medium ${themeTokens.subMutedText}`}
                      >
                        Hidden from recommendations & feeds
                      </span>
                    </div>
                  ))}
                </div>
              </section>
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
            <div
              className={`flex flex-col items-center gap-0.5 backdrop-blur-md px-4 py-2 rounded-xl border shadow-2xl ${themeTokens.surfacePanel}`}
            >
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white">
                More History Below
              </span>
              <span
                className={`text-xl font-black animate-slow-glow ${themeTokens.arrow}`}
              >
                ⌄
              </span>
            </div>
          </div>
        )}

        {/* VERIFY COMPLETION MODAL */}
        {verifyingTarget && (
          <div className="rabtv-vidsrc-protected fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
            <div
              className={`rabtv-wh-plate w-full max-w-sm max-h-[90dvh] overflow-y-auto space-y-4 rounded-3xl border p-6 text-center ${themeTokens.modalCard}`} style={{ backgroundImage: `linear-gradient(rgba(12,10,9,0.78), rgba(12,10,9,0.84)), url(${IMG_MODAL_PANEL})`, backgroundSize: "100% 100%" }}
            >
              <div
                className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border text-3xl shadow-inner ${themeTokens.subPanel}`}
              >
                👁️
              </div>
              <h3 className="text-lg font-black text-white">
                Verify Completion
              </h3>
              <p className={`text-xs leading-relaxed ${themeTokens.mutedText}`}>
                Did you finish watching{" "}
                <strong className={themeTokens.accentText}>
                  {verifyingTarget.title}
                </strong>
                ?
              </p>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => handleConfirmModal(true)}
                  className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 py-2.5 text-xs font-bold text-white shadow-lg transition cursor-pointer"
                >
                  Yes, Completed (✓)
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirmModal(false)}
                  className={`rounded-xl border py-2.5 text-xs font-bold transition cursor-pointer ${themeTokens.btnSecondary}`}
                >
                  Not Yet (?)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TV-SAFE BULK CLEAR CONFIRMATION MODAL */}
        {confirmClearScope && (
          <div className="rabtv-vidsrc-protected fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
            <div
              className={`rabtv-wh-plate w-full max-w-sm max-h-[90dvh] overflow-y-auto space-y-4 rounded-3xl border-2 p-6 text-center ${themeTokens.modalCard}`} style={{ backgroundImage: `linear-gradient(rgba(12,10,9,0.78), rgba(12,10,9,0.84)), url(${IMG_MODAL_PANEL})`, backgroundSize: "100% 100%" }}
            >
              <div
                className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border text-3xl ${themeTokens.subPanel}`}
              >
                🧹
              </div>
              <h3 className="text-lg font-black text-white">Confirm Action</h3>
              <p className={`text-xs leading-relaxed ${themeTokens.mutedText}`}>
                Are you sure you want to{" "}
                <strong className={themeTokens.accentText}>
                  {confirmClearScope.label}
                </strong>
                ? Your license, PIN, and saved My List will stay untouched.
              </p>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleExecuteClearScope}
                  className="rounded-xl bg-gradient-to-r from-red-600 to-orange-600 py-2.5 text-xs font-black text-white shadow-lg cursor-pointer"
                >
                  ✓ Confirm
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClearScope(null)}
                  className={`rounded-xl border py-2.5 text-xs font-bold cursor-pointer ${themeTokens.btnSecondary}`}
                >
                  ✕ Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const MovieCard = React.memo(function MovieCard({
  movie,
  themeTokens,
  posterAppearance,
  posterWidth,
  largeButtons,
  clockFormat,
  glowOff,
  onEyeballClick,
  onRemove,
}: {
  movie: ShowWatchHistory;
  themeTokens: WatchHistoryThemeTokens;
  posterAppearance: PosterAppearanceClasses;
  posterWidth: "w342" | "w500";
  largeButtons: boolean;
  clockFormat: "12h" | "24h";
  glowOff: boolean;
  onEyeballClick: (
    showId: string,
    episodeId: string,
    episodeTitle: string,
    isCompleted: boolean
  ) => void;
  onRemove: () => void;
}) {
  const navigate = useNavigate();
  const singleEp = Object.values(movie.episodes)[0] || {
    episodeId: `${movie.showId}-s1-e1`,
    title: movie.title,
    confirmedCompleted: false,
    progressPercent: 0,
    updatedAt: movie.lastWatchedAt,
  };
  const isCompleted = singleEp.confirmedCompleted;
  const posterUrl = resolvePosterSrc(movie.posterPath, posterWidth);

  const pillBtnClass = largeButtons
    ? "h-8 px-2.5 text-xs"
    : "h-6 px-1.5 text-[10px]";
  const iconBtnClass = largeButtons ? "h-8 w-8 text-xs" : "h-6 w-6 text-[10px]";

  return (
    <div data-tour="history-item" className="w-full">
      <div
        className={`group relative ${posterAppearance.radiusClass} ${posterAppearance.cardFrameClass} overflow-hidden shadow-xl flex flex-col justify-between transition-all duration-300 hover:-translate-y-1.5`}
      >
        <div
          onClick={() =>
            navigate({
              to: "/details",
              search: { id: movie.showId, type: "movie" },
            })
          }
          className="relative aspect-[2/3] w-full overflow-hidden bg-black shrink-0 cursor-pointer"
        >
          {posterUrl ? (
            <img
              src={posterUrl}
              alt={movie.title}
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div
              className={`flex h-full w-full items-center justify-center p-2 text-center text-xs font-bold ${themeTokens.subMutedText}`}
            >
              {movie.title}
            </div>
          )}

          <div className="absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-black/80 via-black/30 to-transparent pointer-events-none" />

          {/* Top-Left: Completion Toggle Pill */}
          <div
            className="absolute top-2 left-2 z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() =>
                onEyeballClick(
                  movie.showId,
                  singleEp.episodeId,
                  movie.title,
                  isCompleted
                )
              }
              className={`inline-flex items-center justify-center whitespace-nowrap rounded-lg backdrop-blur-md border transition hover:scale-105 focus:outline-none font-bold shadow-md cursor-pointer ${pillBtnClass} ${
                isCompleted
                  ? "bg-emerald-950/90 text-emerald-300 border-emerald-400/45"
                  : themeTokens.iconBtn
              }`}
              title="Toggle Watched Status"
            >
              {isCompleted ? "👁️ ✓" : "👁️ ?"}
            </button>
          </div>

          {/* Top-Right: Dislike & Remove Controls */}
          <div
            className="absolute top-2 right-2 flex items-center gap-1 z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() =>
                dislikeTitle({
                  id: movie.showId,
                  title: movie.title,
                  mediaType: "movie",
                  posterPath: movie.posterPath,
                })
              }
              className={`flex items-center justify-center rounded-lg backdrop-blur-md border transition font-bold shadow-md cursor-pointer ${iconBtnClass} ${themeTokens.iconBtn}`}
              title="Dislike & Hide Globally"
            >
              👎
            </button>
            <button
              type="button"
              data-tour="history-delete"
              onClick={onRemove}
              className={`flex items-center justify-center rounded-lg bg-black/80 text-red-300 backdrop-blur-md border border-red-500/35 transition hover:bg-red-600 hover:text-white font-bold shadow-md cursor-pointer ${iconBtnClass}`}
              title="Remove from history"
            >
              ✕
            </button>
          </div>

          {/* Bottom Poster Gradient Overlay */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/85 to-transparent pt-10 pb-2.5 px-3 z-10">
            <h3
              className="text-xs sm:text-sm font-bold truncate text-white drop-shadow"
              title={movie.title}
            >
              {movie.title}
            </h3>
            <div className="flex items-center justify-between gap-1 mt-0.5 text-[10px]">
              <span
                className={`font-semibold truncate ${themeTokens.mutedText}`}
              >
                {formatWatchedAgo(movie.lastWatchedAt, clockFormat)}
              </span>
              <span
                className={`font-bold shrink-0 ${
                  isCompleted ? "text-emerald-400" : themeTokens.accentText
                }`}
              >
                {isCompleted ? "✓ Done" : "In Progress"}
              </span>
            </div>
          </div>
        </div>

        {/* Direct Resume Playback Action Bar */}
        <div className={`p-2 ${themeTokens.cardFooter}`}>
          <button
            type="button"
            onClick={() => {
              bgAudio.pause();
              navigate({
                to: "/player",
                search: {
                  id: movie.showId,
                  type: "movie",
                  season: 1,
                  episode: 1,
                },
              });
            }}
            className={`w-full rounded-xl border ${
              largeButtons ? "py-2.5 text-xs" : "py-1.5 text-[10px]"
            } font-extrabold uppercase tracking-wider transition cursor-pointer focus:outline-none focus:ring-2 ${
              themeTokens.btnSecondary
            } ${themeTokens.focusRing}`}
          >
            {isCompleted ? "↻ Watch Again" : "▶ Resume Movie"}
          </button>
        </div>

        {posterAppearance.showLaserBar && !glowOff && (
          <div
            className={`absolute inset-x-3 bottom-0 h-[2px] bg-gradient-to-r ${themeTokens.laser} opacity-90 pointer-events-none`}
          />
        )}
      </div>
    </div>
  );
});

const TvShowCard = React.memo(function TvShowCard({
  show,
  newEpisodeAlert,
  themeTokens,
  posterAppearance,
  posterWidth,
  largeButtons,
  clockFormat,
  glowOff,
  onEyeballClick,
  onMarkAllDone,
  onRemove,
}: {
  show: ShowWatchHistory;
  newEpisodeAlert?: EpisodeRadarAlert | null;
  themeTokens: WatchHistoryThemeTokens;
  posterAppearance: PosterAppearanceClasses;
  posterWidth: "w342" | "w500";
  largeButtons: boolean;
  clockFormat: "12h" | "24h";
  glowOff: boolean;
  onEyeballClick: (
    showId: string,
    episodeId: string,
    episodeTitle: string,
    isCompleted: boolean
  ) => void;
  onMarkAllDone: () => void;
  onRemove: () => void;
}) {
  const navigate = useNavigate();
  const progress = calculateSeriesProgress(show);
  const nextEp = useMemo(() => getNextUnwatchedEpisode(show), [show]);
  const episodesList = useMemo(
    () =>
      Object.values(show.episodes).sort((a, b) =>
        a.seasonNumber !== b.seasonNumber
          ? a.seasonNumber - b.seasonNumber
          : a.episodeNumber - b.episodeNumber
      ),
    [show.episodes]
  );
  const posterUrl = resolvePosterSrc(show.posterPath, posterWidth);
  const iconBtnClass = largeButtons ? "h-8 w-8 text-xs" : "h-6 w-6 text-[10px]";

  return (
    <div data-tour="history-item" className="w-full">
      <div
        className={`group relative ${posterAppearance.radiusClass} ${posterAppearance.cardFrameClass} overflow-hidden shadow-xl flex flex-col justify-between transition-all duration-300 hover:-translate-y-1.5`}
      >
        <div
          onClick={() =>
            navigate({
              to: "/details",
              search: { id: show.showId, type: "tv" },
            })
          }
          className="relative aspect-[2/3] w-full overflow-hidden bg-black shrink-0 cursor-pointer"
        >
          {posterUrl ? (
            <img
              src={posterUrl}
              alt={show.title}
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div
              className={`flex h-full w-full items-center justify-center p-2 text-center text-xs font-bold ${themeTokens.subMutedText}`}
            >
              {show.title}
            </div>
          )}

          <div className="absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-black/80 via-black/30 to-transparent pointer-events-none" />

          {/* Top-Left Series / New Episode Radar Badge */}
          <div className="absolute top-2 left-2 z-10 flex flex-col items-start gap-1 pointer-events-none max-w-[70%]">
            <span
              className={`rounded-lg backdrop-blur-md border px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider ${themeTokens.badgeBg}`}
            >
              Series
            </span>
            {newEpisodeAlert && (
              <span
                className={`rounded-lg px-2 py-0.5 text-[9px] font-black uppercase tracking-wider shadow-lg truncate max-w-full ${themeTokens.btnActive}`}
              >
                {newEpisodeAlert.badgeLabel}
              </span>
            )}
          </div>

          {/* Top-Right Dislike & Remove Controls */}
          <div
            className="absolute top-2 right-2 flex items-center gap-1 z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() =>
                dislikeTitle({
                  id: show.showId,
                  title: show.title,
                  mediaType: "tv",
                  posterPath: show.posterPath,
                })
              }
              className={`flex items-center justify-center rounded-lg backdrop-blur-md border transition font-bold shadow-md cursor-pointer ${iconBtnClass} ${themeTokens.iconBtn}`}
              title="Dislike & Hide Globally"
            >
              👎
            </button>
            <button
              type="button"
              data-tour="history-delete"
              onClick={onRemove}
              className={`flex items-center justify-center rounded-lg bg-black/80 text-red-300 backdrop-blur-md border border-red-500/35 transition hover:bg-red-600 hover:text-white font-bold shadow-md cursor-pointer ${iconBtnClass}`}
              title="Remove from history"
            >
              ✕
            </button>
          </div>

          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/80 to-transparent pt-10 pb-2 px-3 z-10">
            <h3
              className="text-xs sm:text-sm font-bold truncate text-white drop-shadow"
              title={show.title}
            >
              {show.title}
            </h3>
            <span
              className={`block text-[9px] font-semibold mt-0.5 ${themeTokens.mutedText}`}
            >
              {formatWatchedAgo(show.lastWatchedAt, clockFormat)}
            </span>
          </div>
        </div>

        <div className={`p-2.5 sm:p-3 space-y-2.5 shrink-0 ${themeTokens.cardFooter}`}>
          {/* Smart Direct Resume / Next Episode (or Brand-New Episode) Launcher */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                bgAudio.pause();
                const targetSeason = newEpisodeAlert
                  ? newEpisodeAlert.seasonNumber
                  : nextEp.seasonNumber;
                const targetEpisode = newEpisodeAlert
                  ? newEpisodeAlert.episodeNumber
                  : nextEp.episodeNumber;
                navigate({
                  to: "/player",
                  search: {
                    id: show.showId,
                    type: "tv",
                    season: targetSeason,
                    episode: targetEpisode,
                  },
                });
              }}
              className={`flex-1 min-w-0 rounded-xl border ${
                largeButtons ? "py-2 text-xs" : "py-1.5 text-[10px]"
              } font-extrabold uppercase tracking-wider transition cursor-pointer truncate px-2 focus:outline-none focus:ring-2 ${
                newEpisodeAlert
                  ? `${themeTokens.btnActive} border-transparent`
                  : themeTokens.btnSecondary
              } ${themeTokens.focusRing}`}
            >
              {newEpisodeAlert
                ? `▶ New S${newEpisodeAlert.seasonNumber}E${newEpisodeAlert.episodeNumber}`
                : `▶ Play ${nextEp.label}`}
            </button>

            <button
              type="button"
              onClick={onMarkAllDone}
              className={`shrink-0 rounded-xl border px-2 ${
                largeButtons ? "py-2 text-xs" : "py-1.5 text-[10px]"
              } font-extrabold transition cursor-pointer ${
                progress >= 100
                  ? "bg-emerald-950/85 border-emerald-400/45 text-emerald-300"
                  : themeTokens.btnSecondary
              }`}
              title={
                progress >= 100
                  ? "Reset show progress"
                  : "Mark all tracked episodes completed"
              }
            >
              {progress >= 100 ? "↺" : "✓ All"}
            </button>
          </div>

          <div className="space-y-1">
            <div
              className={`flex items-center justify-between text-[10px] font-bold ${themeTokens.mutedText}`}
            >
              <span className="truncate">
                Progress ({episodesList.length} ep
                {episodesList.length === 1 ? "" : "s"})
              </span>
              <span
                className={
                  progress >= 100 ? "text-emerald-400" : themeTokens.accentText
                }
              >
                {progress}%
              </span>
            </div>
            <div
              className={`h-1.5 w-full rounded-full overflow-hidden border ${themeTokens.progressTrack}`}
            >
              <div
                className={`h-full transition-all duration-300 ${
                  progress >= 100
                    ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"
                    : themeTokens.progressFill
                }`}
                style={{ width: `${Math.max(4, progress)}%` }}
              />
            </div>
          </div>

          <div className="space-y-1 max-h-28 overflow-y-auto scrollbar-none">
            {episodesList.map((ep) => (
              <EpisodeRow
                key={ep.episodeId}
                episode={ep}
                themeTokens={themeTokens}
                largeButtons={largeButtons}
                onPlayEpisode={() => {
                  bgAudio.pause();
                  navigate({
                    to: "/player",
                    search: {
                      id: show.showId,
                      type: "tv",
                      season: ep.seasonNumber,
                      episode: ep.episodeNumber,
                    },
                  });
                }}
                onEyeballClick={() =>
                  onEyeballClick(
                    show.showId,
                    ep.episodeId,
                    `${show.title} • S${ep.seasonNumber}E${ep.episodeNumber}`,
                    ep.confirmedCompleted
                  )
                }
              />
            ))}
          </div>
        </div>

        {posterAppearance.showLaserBar && !glowOff && (
          <div
            className={`absolute inset-x-3 bottom-0 h-[2px] bg-gradient-to-r ${themeTokens.laser} opacity-90 pointer-events-none`}
          />
        )}
      </div>
    </div>
  );
});

const EpisodeRow = React.memo(function EpisodeRow({
  episode,
  themeTokens,
  largeButtons,
  onPlayEpisode,
  onEyeballClick,
}: {
  episode: {
    episodeId: string;
    seasonNumber: number;
    episodeNumber: number;
    title: string;
    confirmedCompleted: boolean;
  };
  themeTokens: WatchHistoryThemeTokens;
  largeButtons: boolean;
  onPlayEpisode: () => void;
  onEyeballClick: () => void;
}) {
  const rowBtnClass = largeButtons
    ? "h-6 px-2 text-[10px]"
    : "h-5 px-1.5 text-[9px]";

  return (
    <div
      className={`flex items-center justify-between gap-1.5 rounded-lg px-2 py-1 border text-[11px] transition ${themeTokens.episodeRow}`}
    >
      <button
        type="button"
        onClick={onPlayEpisode}
        className="font-bold text-white hover:opacity-80 whitespace-nowrap truncate text-left cursor-pointer"
        title={`Play S${episode.seasonNumber}E${episode.episodeNumber}`}
      >
        ▶ S{episode.seasonNumber}E{episode.episodeNumber}
      </button>

      <button
        type="button"
        onClick={onEyeballClick}
        className={`shrink-0 inline-flex items-center justify-center whitespace-nowrap rounded-md border transition hover:scale-105 focus:outline-none font-bold cursor-pointer ${rowBtnClass} ${
          episode.confirmedCompleted
            ? "bg-emerald-950/90 text-emerald-300 border-emerald-400/45"
            : themeTokens.iconBtn
        }`}
        title={
          episode.confirmedCompleted
            ? "Marked Completed (Click to unmark)"
            : "Mark Episode Completed"
        }
        aria-label="Toggle Episode Status"
      >
        {episode.confirmedCompleted ? "👁️ ✓" : "👁️ ?"}
      </button>
    </div>
  );
});