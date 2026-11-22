// src/routes/live-tv.tsx
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import React, { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react';
import {
  fetchLiveCategories,
  fetchChannelsByCategory,
  fetchAllChannels,
  refreshLiveHealth,
  probeStreamWithLatency,
  isSafeStreamUrl,
  isChannelKidsSafe,
  getHiddenLiveChannelIds,
  hideLiveChannel,
  clearHiddenLiveChannels,
  getCustomLiveChannels,
  addCustomLiveChannel,
  removeCustomLiveChannel,
  importM3uPlaylist,
  exportChannelsAsM3u,
  getChannelReliabilityScore,
  isChannelQuarantined,
  LIVE_CATALOG_UPDATED_EVENT,
  type LiveChannel,
  type LiveFeedService,
} from '../lib/live-feed-service';
import {
  AppTheme,
  PosterShape,
  getSavedTheme,
  getHardwareLimits,
  getLargeButtons,
  getReducedMotion,
  getGlowIntensity,
  getPosterShape,
  getClockFormat,
  formatAppTime,
  getFavoriteChannelIds,
  toggleFavoriteChannel,
  MAX_FAVORITE_CHANNELS,
  getKidsModeLocked,
  getSavedUserAge,
  purgeOldTmdbCaches,
} from '@/lib/settings';
import { ScrollPillBar } from '@/components/scroll-pill-bar';
import { getChannelDescription } from '@/lib/channel-descriptions';
import { channelCategories } from '@/lib/channel-categories';
import { AppWallpaper } from '@/components/AppWallpaper';
import { recordWatchHistory } from '@/lib/watch-history';
import { bgAudio } from '@/lib/background-audio';

const BUTTON_WRAPPER_URL =
  'https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/buttonwrapper.png';

const BACK_TO_HOME_BTN_URL =
  'https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/Backtohome.png';

/**
 * Viewport-locked layout rules for Live TV top utility wrapper, Back to Home
 * artwork button, and buttonwrapper-backed section headers across portrait
 * phones, landscape phones, tablets, desktops, TVs, and projectors.
 */
const LIVETV_VIEWPORT_STYLES = `
  /* Uses shared global .rabtv-dual-wrapper & .rabtv-section-banner from __root.tsx */
`;

export const Route = createFileRoute('/live-tv')({
  component: LiveTvComponent,
});

export type ExtendedHealthStatus = 'online' | 'timeout' | 'offline' | 'checking';
export type HealthFilterOption = 'all' | 'online' | 'timeout' | 'offline';
export type LiveSortOption = 'status' | 'reliability' | 'channelNumber' | 'az';
export type LiveDensityOption = 'comfort' | 'compact';

const FAST_HEALTH_CACHE_KEY = 'rabtv_fast_live_health_v2';
const FAST_HEALTH_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const MAX_CACHED_HEALTH_ENTRIES = 450;
const PROBE_TIMEOUT_MS = 2600;

const categoryMapping: Record<string, string> = {
  Nz: 'Atlantic Canada',
  Sydney: 'Toronto',
  Melbourne: 'Vancouver',
  Brisbane: 'Montreal',
  Perth: 'Calgary',
  Adelaide: 'Ottawa',
  Canberra: 'National',
  Darwin: 'Northern',
  Hobart: 'Pacific',
  Au: 'Canada Feeds',
  World: 'International',
};

const reverseCategoryMapping: Record<string, string> = Object.fromEntries(
  Object.entries(categoryMapping).map(([orig, disp]) => [disp, orig])
);

function isSafeHttpUrl(raw: string | undefined | null): boolean {
  return Boolean(raw && isSafeStreamUrl(raw, { allowLocalLan: true }));
}

interface CachedHealthMap {
  timestamp: number;
  statuses: Record<string, ExtendedHealthStatus>;
}

function loadCachedHealthMap(): Record<string, ExtendedHealthStatus> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(FAST_HEALTH_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as CachedHealthMap;
    if (!parsed || Date.now() - parsed.timestamp > FAST_HEALTH_CACHE_TTL_MS) {
      return {};
    }
    return parsed.statuses && typeof parsed.statuses === 'object'
      ? parsed.statuses
      : {};
  } catch {
    return {};
  }
}

function saveCachedHealthMap(statuses: Record<string, ExtendedHealthStatus>): void {
  if (typeof window === 'undefined') return;
  const entries = Object.entries(statuses).slice(0, MAX_CACHED_HEALTH_ENTRIES);
  const payload: CachedHealthMap = {
    timestamp: Date.now(),
    statuses: Object.fromEntries(entries),
  };
  const serialized = JSON.stringify(payload);
  try {
    localStorage.setItem(FAST_HEALTH_CACHE_KEY, serialized);
  } catch {
    try {
      purgeOldTmdbCaches();
      localStorage.setItem(FAST_HEALTH_CACHE_KEY, serialized);
    } catch {
      // Ignore if device storage is critically full
    }
  }
}

function getChannelKey(channel: LiveChannel): string {
  return String(
    channel.channelId || channel.streamUrl || channel.url || channel.title
  );
}

function normalizeMatchText(text: string): string {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Delegates to live-feed-service's hardened single-flight prober (includes
 * #EXTM3U HTML error-page detection & AbortSignal support).
 */
async function probeSingleChannelFast(
  url: string,
  parentSignal?: AbortSignal
): Promise<ExtendedHealthStatus> {
  if (!isSafeHttpUrl(url) || parentSignal?.aborted) return 'offline';
  const res = await probeStreamWithLatency(url, parentSignal);
  if (parentSignal?.aborted || res.health === 'checking') return 'checking';
  if (res.health === 'online') return 'online';
  if (res.health === 'unknown') return 'timeout';
  return 'offline';
}

interface LiveTvThemeTokens {
  bg: string;
  baseText: string;
  mutedText: string;
  subMutedText: string;
  accentText: string;
  accentBar: string;
  surfacePanel: string;
  surfaceCard: string;
  surfaceCardPinned: string;
  logoStage: string;
  dividerBorder: string;
  backCapsule: string;
  backBadge: string;
  headerIconBox: string;
  badge: string;
  subtleBadge: string;
  scanBadge: string;
  scanDot: string;
  btnActive: string;
  btnSecondary: string;
  btnPinned: string;
  btnIdle: string;
  pinActive: string;
  pinIdle: string;
  playBtn: string;
  inputClass: string;
  optionBg: string;
  toastBanner: string;
  borderHover: string;
  focusRing: string;
  laserLine: string;
  ambient: string;
}

function getLiveTvThemeTokens(theme: AppTheme): LiveTvThemeTokens {
  switch (theme) {
    case 'red':
      return {
        bg: 'bg-gradient-to-br from-zinc-950/65 via-red-950/30 to-black/75',
        baseText: 'text-zinc-100',
        mutedText: 'text-zinc-300',
        subMutedText: 'text-zinc-400',
        accentText: 'text-red-300',
        accentBar: 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.95)]',
        surfacePanel:
          'bg-zinc-950/66 border-red-500/30 shadow-[0_14px_42px_rgba(239,68,68,0.16)]',
        surfaceCard:
          'bg-zinc-950/72 border-red-500/25 shadow-[0_10px_28px_rgba(0,0,0,0.75)]',
        surfaceCardPinned:
          'bg-zinc-950/86 border-red-400/70 shadow-[0_10px_28px_rgba(239,68,68,0.22)]',
        logoStage:
          'bg-gradient-to-b from-zinc-900/90 via-black to-zinc-950 border-red-500/20 group-hover:border-red-400/45',
        dividerBorder: 'border-red-500/20',
        backCapsule:
          'bg-zinc-950/85 hover:bg-red-950/80 border-red-500/35 hover:border-red-400 text-zinc-100 hover:text-white',
        backBadge:
          'bg-gradient-to-tr from-red-600/65 via-rose-500/55 to-orange-500/55 border-red-400/50 text-white',
        headerIconBox:
          'bg-gradient-to-br from-red-950 via-rose-900/70 to-black border-red-500/40 shadow-[0_0_22px_rgba(239,68,68,0.28)]',
        badge: 'bg-red-950/75 border-red-500/35 text-red-200',
        subtleBadge: 'bg-black/70 border-red-500/25 text-zinc-200',
        scanBadge: 'bg-zinc-950/90 border-red-500/30 text-zinc-300',
        scanDot: 'bg-red-400',
        btnActive:
          'bg-gradient-to-r from-red-600 via-rose-600 to-orange-600 text-white shadow-lg shadow-red-600/30',
        btnSecondary:
          'bg-red-950/55 hover:bg-red-900/80 border-red-500/35 text-red-100 hover:text-white',
        btnPinned:
          'bg-red-600/35 border-red-400/75 text-white shadow-[0_0_16px_rgba(239,68,68,0.35)]',
        btnIdle:
          'bg-black/60 hover:bg-red-950/55 border-red-500/20 text-zinc-300 hover:text-white',
        pinActive:
          'bg-red-600/30 border-red-400/75 text-red-200 shadow-[0_0_10px_rgba(239,68,68,0.45)]',
        pinIdle:
          'bg-black/65 border-red-500/25 text-zinc-400 hover:text-red-200 hover:border-red-400/60',
        playBtn:
          'bg-red-950/45 group-hover:bg-gradient-to-r group-hover:from-red-600 group-hover:to-rose-600 text-zinc-100 group-hover:text-white border border-red-500/25 group-hover:border-red-400/60',
        inputClass:
          'border-red-500/30 bg-black/75 text-white placeholder-zinc-400 focus:ring-2 focus:ring-red-500 focus:border-red-400',
        optionBg: 'bg-zinc-950 text-white',
        toastBanner: 'bg-zinc-950/92 border-red-400/55 text-red-100',
        borderHover: 'hover:border-red-400/70',
        focusRing: 'focus:ring-red-500',
        laserLine: 'from-transparent via-red-500 to-rose-400',
        ambient: 'from-red-600/15 via-transparent to-transparent',
      };
    case 'midnight':
      return {
        bg: 'bg-gradient-to-br from-slate-950/65 via-blue-950/30 to-black/75',
        baseText: 'text-slate-100',
        mutedText: 'text-slate-300',
        subMutedText: 'text-slate-400',
        accentText: 'text-sky-300',
        accentBar: 'bg-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.95)]',
        surfacePanel:
          'bg-slate-950/66 border-blue-500/30 shadow-[0_14px_42px_rgba(59,130,246,0.16)]',
        surfaceCard:
          'bg-slate-950/72 border-blue-500/25 shadow-[0_10px_28px_rgba(0,0,0,0.75)]',
        surfaceCardPinned:
          'bg-slate-950/86 border-sky-400/70 shadow-[0_10px_28px_rgba(56,189,248,0.22)]',
        logoStage:
          'bg-gradient-to-b from-slate-900/90 via-black to-slate-950 border-blue-500/20 group-hover:border-sky-400/45',
        dividerBorder: 'border-blue-500/20',
        backCapsule:
          'bg-slate-950/85 hover:bg-blue-950/80 border-blue-500/35 hover:border-sky-400 text-slate-100 hover:text-white',
        backBadge:
          'bg-gradient-to-tr from-blue-600/65 via-sky-500/55 to-cyan-400/55 border-sky-400/50 text-white',
        headerIconBox:
          'bg-gradient-to-br from-blue-950 via-sky-900/70 to-black border-blue-500/40 shadow-[0_0_22px_rgba(59,130,246,0.28)]',
        badge: 'bg-blue-950/75 border-blue-500/35 text-sky-200',
        subtleBadge: 'bg-black/70 border-blue-500/25 text-slate-200',
        scanBadge: 'bg-slate-950/90 border-blue-500/30 text-slate-300',
        scanDot: 'bg-sky-400',
        btnActive:
          'bg-gradient-to-r from-blue-600 via-cyan-600 to-sky-600 text-white shadow-lg shadow-blue-600/30',
        btnSecondary:
          'bg-blue-950/55 hover:bg-blue-900/80 border-blue-500/35 text-blue-100 hover:text-white',
        btnPinned:
          'bg-blue-600/35 border-sky-400/75 text-white shadow-[0_0_16px_rgba(56,189,248,0.35)]',
        btnIdle:
          'bg-black/60 hover:bg-blue-950/55 border-blue-500/20 text-slate-300 hover:text-white',
        pinActive:
          'bg-blue-600/30 border-sky-400/75 text-sky-200 shadow-[0_0_10px_rgba(56,189,248,0.45)]',
        pinIdle:
          'bg-black/65 border-blue-500/25 text-slate-400 hover:text-sky-200 hover:border-sky-400/60',
        playBtn:
          'bg-blue-950/45 group-hover:bg-gradient-to-r group-hover:from-blue-600 group-hover:to-sky-500 text-slate-100 group-hover:text-white border border-blue-500/25 group-hover:border-sky-400/60',
        inputClass:
          'border-blue-500/30 bg-black/75 text-white placeholder-slate-400 focus:ring-2 focus:ring-sky-400 focus:border-sky-400',
        optionBg: 'bg-slate-950 text-white',
        toastBanner: 'bg-slate-950/92 border-sky-400/55 text-sky-100',
        borderHover: 'hover:border-sky-400/70',
        focusRing: 'focus:ring-sky-400',
        laserLine: 'from-transparent via-sky-400 to-blue-500',
        ambient: 'from-blue-600/15 via-transparent to-transparent',
      };
    case 'emerald':
      return {
        bg: 'bg-gradient-to-br from-neutral-950/65 via-emerald-950/30 to-black/75',
        baseText: 'text-neutral-100',
        mutedText: 'text-neutral-300',
        subMutedText: 'text-neutral-400',
        accentText: 'text-emerald-300',
        accentBar: 'bg-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.95)]',
        surfacePanel:
          'bg-neutral-950/66 border-emerald-500/30 shadow-[0_14px_42px_rgba(16,185,129,0.16)]',
        surfaceCard:
          'bg-neutral-950/72 border-emerald-500/25 shadow-[0_10px_28px_rgba(0,0,0,0.75)]',
        surfaceCardPinned:
          'bg-neutral-950/86 border-emerald-400/70 shadow-[0_10px_28px_rgba(16,185,129,0.22)]',
        logoStage:
          'bg-gradient-to-b from-neutral-900/90 via-black to-neutral-950 border-emerald-500/20 group-hover:border-emerald-400/45',
        dividerBorder: 'border-emerald-500/20',
        backCapsule:
          'bg-neutral-950/85 hover:bg-emerald-950/80 border-emerald-500/35 hover:border-emerald-400 text-neutral-100 hover:text-white',
        backBadge:
          'bg-gradient-to-tr from-emerald-600/65 via-teal-500/55 to-green-400/55 border-emerald-400/50 text-white',
        headerIconBox:
          'bg-gradient-to-br from-emerald-950 via-teal-900/70 to-black border-emerald-500/40 shadow-[0_0_22px_rgba(16,185,129,0.28)]',
        badge: 'bg-emerald-950/75 border-emerald-500/35 text-emerald-200',
        subtleBadge: 'bg-black/70 border-emerald-500/25 text-neutral-200',
        scanBadge: 'bg-neutral-950/90 border-emerald-500/30 text-neutral-300',
        scanDot: 'bg-emerald-400',
        btnActive:
          'bg-gradient-to-r from-emerald-600 via-teal-600 to-green-600 text-white shadow-lg shadow-emerald-600/30',
        btnSecondary:
          'bg-emerald-950/55 hover:bg-emerald-900/80 border-emerald-500/35 text-emerald-100 hover:text-white',
        btnPinned:
          'bg-emerald-600/35 border-emerald-400/75 text-white shadow-[0_0_16px_rgba(16,185,129,0.35)]',
        btnIdle:
          'bg-black/60 hover:bg-emerald-950/55 border-emerald-500/20 text-neutral-300 hover:text-white',
        pinActive:
          'bg-emerald-600/30 border-emerald-400/75 text-emerald-200 shadow-[0_0_10px_rgba(16,185,129,0.45)]',
        pinIdle:
          'bg-black/65 border-emerald-500/25 text-neutral-400 hover:text-emerald-200 hover:border-emerald-400/60',
        playBtn:
          'bg-emerald-950/45 group-hover:bg-gradient-to-r group-hover:from-emerald-600 group-hover:to-teal-600 text-neutral-100 group-hover:text-white border border-emerald-500/25 group-hover:border-emerald-400/60',
        inputClass:
          'border-emerald-500/30 bg-black/75 text-white placeholder-neutral-400 focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400',
        optionBg: 'bg-neutral-950 text-white',
        toastBanner: 'bg-neutral-950/92 border-emerald-400/55 text-emerald-100',
        borderHover: 'hover:border-emerald-400/70',
        focusRing: 'focus:ring-emerald-400',
        laserLine: 'from-transparent via-emerald-400 to-teal-400',
        ambient: 'from-emerald-600/15 via-transparent to-transparent',
      };
    case 'amber':
      return {
        bg: 'bg-gradient-to-br from-stone-950/65 via-yellow-950/30 to-black/75',
        baseText: 'text-stone-100',
        mutedText: 'text-stone-300',
        subMutedText: 'text-stone-400',
        accentText: 'text-amber-300',
        accentBar: 'bg-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.95)]',
        surfacePanel:
          'bg-stone-950/66 border-amber-500/30 shadow-[0_14px_42px_rgba(245,158,11,0.16)]',
        surfaceCard:
          'bg-stone-950/72 border-amber-500/25 shadow-[0_10px_28px_rgba(0,0,0,0.75)]',
        surfaceCardPinned:
          'bg-stone-950/86 border-amber-400/70 shadow-[0_10px_28px_rgba(245,158,11,0.22)]',
        logoStage:
          'bg-gradient-to-b from-stone-900/90 via-black to-stone-950 border-amber-500/20 group-hover:border-amber-400/45',
        dividerBorder: 'border-amber-500/20',
        backCapsule:
          'bg-stone-950/85 hover:bg-amber-950/80 border-amber-500/35 hover:border-amber-400 text-stone-100 hover:text-white',
        backBadge:
          'bg-gradient-to-tr from-amber-600/65 via-yellow-500/55 to-orange-500/55 border-amber-400/50 text-white',
        headerIconBox:
          'bg-gradient-to-br from-amber-950 via-yellow-900/70 to-black border-amber-500/40 shadow-[0_0_22px_rgba(245,158,11,0.28)]',
        badge: 'bg-amber-950/75 border-amber-500/35 text-amber-200',
        subtleBadge: 'bg-black/70 border-amber-500/25 text-stone-200',
        scanBadge: 'bg-stone-950/90 border-amber-500/30 text-stone-300',
        scanDot: 'bg-amber-400',
        btnActive:
          'bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 text-white shadow-lg shadow-amber-600/30',
        btnSecondary:
          'bg-amber-950/55 hover:bg-amber-900/80 border-amber-500/35 text-amber-100 hover:text-white',
        btnPinned:
          'bg-amber-600/35 border-amber-400/75 text-white shadow-[0_0_16px_rgba(245,158,11,0.35)]',
        btnIdle:
          'bg-black/60 hover:bg-amber-950/55 border-amber-500/20 text-stone-300 hover:text-white',
        pinActive:
          'bg-amber-600/30 border-amber-400/75 text-amber-200 shadow-[0_0_10px_rgba(245,158,11,0.45)]',
        pinIdle:
          'bg-black/65 border-amber-500/25 text-stone-400 hover:text-amber-200 hover:border-amber-400/60',
        playBtn:
          'bg-amber-950/45 group-hover:bg-gradient-to-r group-hover:from-amber-500 group-hover:to-orange-600 text-stone-100 group-hover:text-white border border-amber-500/25 group-hover:border-amber-400/60',
        inputClass:
          'border-amber-500/30 bg-black/75 text-white placeholder-stone-400 focus:ring-2 focus:ring-amber-400 focus:border-amber-400',
        optionBg: 'bg-stone-950 text-white',
        toastBanner: 'bg-stone-950/92 border-amber-400/55 text-amber-100',
        borderHover: 'hover:border-amber-400/70',
        focusRing: 'focus:ring-amber-400',
        laserLine: 'from-transparent via-amber-400 to-orange-500',
        ambient: 'from-amber-600/15 via-transparent to-transparent',
      };
    case 'cyan':
      return {
        bg: 'bg-gradient-to-br from-slate-950/65 via-cyan-950/30 to-black/75',
        baseText: 'text-slate-100',
        mutedText: 'text-slate-300',
        subMutedText: 'text-slate-400',
        accentText: 'text-cyan-300',
        accentBar: 'bg-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.95)]',
        surfacePanel:
          'bg-slate-950/66 border-cyan-500/30 shadow-[0_14px_42px_rgba(6,182,212,0.16)]',
        surfaceCard:
          'bg-slate-950/72 border-cyan-500/25 shadow-[0_10px_28px_rgba(0,0,0,0.75)]',
        surfaceCardPinned:
          'bg-slate-950/86 border-cyan-400/70 shadow-[0_10px_28px_rgba(6,182,212,0.22)]',
        logoStage:
          'bg-gradient-to-b from-slate-900/90 via-black to-slate-950 border-cyan-500/20 group-hover:border-cyan-400/45',
        dividerBorder: 'border-cyan-500/20',
        backCapsule:
          'bg-slate-950/85 hover:bg-cyan-950/80 border-cyan-500/35 hover:border-cyan-400 text-slate-100 hover:text-white',
        backBadge:
          'bg-gradient-to-tr from-cyan-600/65 via-teal-500/55 to-sky-400/55 border-cyan-400/50 text-white',
        headerIconBox:
          'bg-gradient-to-br from-cyan-950 via-teal-900/70 to-black border-cyan-500/40 shadow-[0_0_22px_rgba(6,182,212,0.28)]',
        badge: 'bg-cyan-950/75 border-cyan-500/35 text-cyan-200',
        subtleBadge: 'bg-black/70 border-cyan-500/25 text-slate-200',
        scanBadge: 'bg-slate-950/90 border-cyan-500/30 text-slate-300',
        scanDot: 'bg-cyan-400',
        btnActive:
          'bg-gradient-to-r from-cyan-600 via-teal-600 to-blue-600 text-white shadow-lg shadow-cyan-600/30',
        btnSecondary:
          'bg-cyan-950/55 hover:bg-cyan-900/80 border-cyan-500/35 text-cyan-100 hover:text-white',
        btnPinned:
          'bg-cyan-600/35 border-cyan-400/75 text-white shadow-[0_0_16px_rgba(6,182,212,0.35)]',
        btnIdle:
          'bg-black/60 hover:bg-cyan-950/55 border-cyan-500/20 text-slate-300 hover:text-white',
        pinActive:
          'bg-cyan-600/30 border-cyan-400/75 text-cyan-200 shadow-[0_0_10px_rgba(6,182,212,0.45)]',
        pinIdle:
          'bg-black/65 border-cyan-500/25 text-slate-400 hover:text-cyan-200 hover:border-cyan-400/60',
        playBtn:
          'bg-cyan-950/45 group-hover:bg-gradient-to-r group-hover:from-cyan-600 group-hover:to-blue-600 text-slate-100 group-hover:text-white border border-cyan-500/25 group-hover:border-cyan-400/60',
        inputClass:
          'border-cyan-500/30 bg-black/75 text-white placeholder-slate-400 focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400',
        optionBg: 'bg-slate-950 text-white',
        toastBanner: 'bg-slate-950/92 border-cyan-400/55 text-cyan-100',
        borderHover: 'hover:border-cyan-400/70',
        focusRing: 'focus:ring-cyan-400',
        laserLine: 'from-transparent via-cyan-400 to-teal-400',
        ambient: 'from-cyan-600/15 via-transparent to-transparent',
      };
    case 'violet':
    default:
      return {
        bg: 'bg-gradient-to-br from-slate-950/65 via-purple-950/30 to-black/75',
        baseText: 'text-slate-100',
        mutedText: 'text-slate-300',
        subMutedText: 'text-slate-400',
        accentText: 'text-violet-300',
        accentBar: 'bg-violet-500 shadow-[0_0_15px_rgba(139,92,246,0.95)]',
        surfacePanel:
          'bg-slate-950/66 border-violet-500/30 shadow-[0_14px_42px_rgba(139,92,246,0.16)]',
        surfaceCard:
          'bg-slate-950/72 border-violet-500/25 shadow-[0_10px_28px_rgba(0,0,0,0.75)]',
        surfaceCardPinned:
          'bg-slate-950/86 border-violet-400/70 shadow-[0_10px_28px_rgba(139,92,246,0.22)]',
        logoStage:
          'bg-gradient-to-b from-slate-900/90 via-black to-slate-950 border-violet-500/20 group-hover:border-violet-400/45',
        dividerBorder: 'border-violet-500/20',
        backCapsule:
          'bg-slate-950/85 hover:bg-purple-950/80 border-violet-500/35 hover:border-violet-400 text-slate-100 hover:text-white',
        backBadge:
          'bg-gradient-to-tr from-violet-600/65 via-purple-500/55 to-indigo-500/55 border-violet-400/50 text-white',
        headerIconBox:
          'bg-gradient-to-br from-purple-950 via-violet-900/70 to-black border-violet-500/40 shadow-[0_0_22px_rgba(139,92,246,0.28)]',
        badge: 'bg-purple-950/75 border-violet-500/35 text-violet-200',
        subtleBadge: 'bg-black/70 border-violet-500/25 text-slate-200',
        scanBadge: 'bg-slate-950/90 border-violet-500/30 text-slate-300',
        scanDot: 'bg-violet-400',
        btnActive:
          'bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 text-white shadow-lg shadow-violet-600/30',
        btnSecondary:
          'bg-purple-950/55 hover:bg-purple-900/80 border-violet-500/35 text-purple-100 hover:text-white',
        btnPinned:
          'bg-violet-600/35 border-violet-400/75 text-white shadow-[0_0_16px_rgba(139,92,246,0.35)]',
        btnIdle:
          'bg-black/60 hover:bg-purple-950/55 border-violet-500/20 text-slate-300 hover:text-white',
        pinActive:
          'bg-violet-600/30 border-violet-400/75 text-violet-200 shadow-[0_0_10px_rgba(139,92,246,0.45)]',
        pinIdle:
          'bg-black/65 border-violet-500/25 text-slate-400 hover:text-violet-200 hover:border-violet-400/60',
        playBtn:
          'bg-purple-950/45 group-hover:bg-gradient-to-r group-hover:from-violet-600 group-hover:to-purple-600 text-slate-100 group-hover:text-white border border-violet-500/25 group-hover:border-violet-400/60',
        inputClass:
          'border-violet-500/30 bg-black/75 text-white placeholder-slate-400 focus:ring-2 focus:ring-violet-400 focus:border-violet-400',
        optionBg: 'bg-slate-950 text-white',
        toastBanner: 'bg-slate-950/92 border-violet-400/55 text-violet-100',
        borderHover: 'hover:border-violet-400/70',
        focusRing: 'focus:ring-violet-400',
        laserLine: 'from-transparent via-purple-500 to-violet-400',
        ambient: 'from-violet-600/15 via-transparent to-transparent',
      };
  }
}

/**
 * Isolated uncontrolled search input with strict LTR flow so Android WebView
 * never reverses typed characters while filtering live channels.
 */
const LiveSearchInput = memo(function LiveSearchInput({
  tokens,
  resetSignal,
  onQueryChange,
}: {
  tokens: LiveTvThemeTokens;
  resetSignal: number;
  onQueryChange: (q: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [hasText, setHasText] = useState(false);

  useEffect(() => {
    if (resetSignal > 0 && inputRef.current) {
      inputRef.current.value = '';
      setHasText(false);
    }
  }, [resetSignal]);

  const handleClear = () => {
    if (inputRef.current) {
      inputRef.current.value = '';
      inputRef.current.focus();
    }
    setHasText(false);
    onQueryChange('');
  };

  return (
    <div className="relative flex-1 min-w-0 w-full sm:w-52">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none ${tokens.accentText}`}
      >
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
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
        placeholder="Search channel or CH #..."
        style={{ direction: 'ltr', unicodeBidi: 'plaintext', textAlign: 'left' }}
        className={`w-full h-10 rounded-xl border pl-9 pr-8 text-xs font-bold focus:outline-none transition ${tokens.inputClass}`}
      />
      {hasText && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Clear channel search"
          className={`absolute right-2.5 top-1/2 -translate-y-1/2 text-xs hover:text-white cursor-pointer ${tokens.subMutedText}`}
        >
          ✕
        </button>
      )}
    </div>
  );
});

function StatusBadge({
  status,
  tokens,
}: {
  status: ExtendedHealthStatus;
  tokens: LiveTvThemeTokens;
}) {
  if (status === 'online') {
    return (
      <span
        title="Verified Online"
        className="inline-flex items-center gap-1 rounded-full bg-emerald-950/90 border border-emerald-400/50 px-1.5 sm:px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-emerald-300 shrink-0"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
        <span>Live</span>
      </span>
    );
  }

  if (status === 'timeout') {
    return (
      <span
        title="Slow response — may still play inside the video player"
        className="inline-flex items-center gap-1 rounded-full bg-amber-950/90 border border-amber-400/50 px-1.5 sm:px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-amber-300 shrink-0"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
        <span>Slow</span>
      </span>
    );
  }

  if (status === 'offline') {
    return (
      <span
        title="Stream Offline"
        className="inline-flex items-center gap-1 rounded-full bg-red-950/90 border border-red-500/50 px-1.5 sm:px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-red-300 shrink-0"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
        <span>Off</span>
      </span>
    );
  }

  return (
    <span
      title="Checking stream health..."
      className={`inline-flex items-center gap-1 rounded-full border px-1.5 sm:px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider shrink-0 ${tokens.scanBadge}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full animate-ping shrink-0 ${tokens.scanDot}`}
      />
      <span>Scan</span>
    </span>
  );
}

const ChannelCard = memo(function ChannelCard({
  channel,
  status,
  isPinned,
  onTogglePin,
  onHideChannel,
  tokens,
  radiusClass,
  largeButtons,
  compact,
  glowOff,
  isLowRam,
}: {
  channel: LiveChannel;
  status: ExtendedHealthStatus;
  isPinned: boolean;
  onTogglePin: (channelId: string, channelTitle: string) => void;
  onHideChannel: (channelId: string, channelTitle: string) => void;
  tokens: LiveTvThemeTokens;
  radiusClass: string;
  largeButtons: boolean;
  compact: boolean;
  glowOff: boolean;
  isLowRam: boolean;
}) {
  const [logoFailed, setLogoFailed] = useState(false);

  const rawStream = channel.streamUrl || channel.url || '';
  const safeStream = isSafeHttpUrl(rawStream) ? rawStream.trim() : '';
  const safeLogo = isSafeHttpUrl(channel.logo) ? channel.logo!.trim() : '';
  const channelId = getChannelKey(channel);
  const rawGroup = channel.groupTitle || (channel as any).category || '';
  const displayRegion = rawGroup
    ? categoryMapping[rawGroup] || rawGroup
    : 'TV';
  const description = useMemo(
    () => getChannelDescription(channel.title),
    [channel.title]
  );

  return (
    <div
      className={`group relative flex flex-col justify-between w-full min-w-0 box-border ${radiusClass} ${
        isLowRam ? '' : 'backdrop-blur-sm'
      } border ${
        isPinned
          ? tokens.surfaceCardPinned
          : `${tokens.surfaceCard} ${tokens.borderHover}`
      } ${
        compact ? 'p-2.5' : 'p-3 sm:p-3.5'
      } hover:-translate-y-0.5 transition-all duration-200 text-center overflow-hidden`}
    >
      {/* Top Bar: Constrained Region / CH # + Status + Pin Button */}
      <div className="flex items-center justify-between gap-1 mb-2 z-20 min-w-0">
        <div className="flex items-center gap-1 min-w-0 flex-1 overflow-hidden">
          {channel.channelNumber !== undefined && (
            <span
              className={`rounded-md border px-1.5 py-0.5 text-[9px] font-black shrink-0 ${tokens.badge}`}
            >
              #{channel.channelNumber}
            </span>
          )}
          <span
            className={`hidden sm:inline-block rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider truncate min-w-0 ${tokens.subtleBadge}`}
          >
            {displayRegion}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <StatusBadge status={status} tokens={tokens} />
          <button
            type="button"
            onClick={() => onTogglePin(channelId, channel.title)}
            aria-label={
              isPinned
                ? `Unpin ${channel.title} from Favorites`
                : `Pin ${channel.title} to Favorites`
            }
            title={isPinned ? 'Unpin from Favorites' : 'Pin to Top Favorites'}
            className={`flex ${
              largeButtons ? 'h-8 w-8' : 'h-6 w-6'
            } shrink-0 items-center justify-center rounded-full border transition cursor-pointer focus:outline-none focus:ring-2 ${
              tokens.focusRing
            } ${isPinned ? tokens.pinActive : tokens.pinIdle}`}
          >
            <svg
              viewBox="0 0 24 24"
              fill={isPinned ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-3 h-3"
            >
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => onHideChannel(channelId, channel.title)}
            aria-label={`Hide ${channel.title}`}
            title="Hide channel from guide"
            className={`flex ${
              largeButtons ? 'h-8 w-8' : 'h-6 w-6'
            } shrink-0 items-center justify-center rounded-full border transition cursor-pointer focus:outline-none focus:ring-2 ${
              tokens.focusRing
            } ${tokens.pinIdle}`}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-2.5 h-2.5"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Main Clickable Watch Card Link */}
      <Link
        to="/live-player"
        search={{
          url: safeStream,
          title: channel.title,
          logo: safeLogo,
          channelId,
        }}
        onClick={() => {
          bgAudio.pause();
          recordWatchHistory({
            id: channelId,
            title: channel.title,
            posterPath: safeLogo,
            type: 'livetv',
          });
        }}
        className={`flex flex-col flex-1 justify-between min-w-0 focus:outline-none focus:ring-2 ${tokens.focusRing} rounded-2xl`}
      >
        {/* High-Contrast Logo Showcase Stage */}
        <div
          className={`relative w-full ${
            compact ? 'h-16 sm:h-20 p-2 mb-2' : 'h-24 sm:h-28 p-3 mb-2.5'
          } rounded-2xl border overflow-hidden flex items-center justify-center shadow-inner ${
            tokens.logoStage
          }`}
        >
          <div
            className="absolute inset-0 pointer-events-none opacity-70 group-hover:opacity-100 transition-opacity duration-300"
            style={{
              background:
                'radial-gradient(circle at center, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.03) 48%, transparent 74%)',
            }}
          />

          {safeLogo && !logoFailed ? (
            <img
              src={safeLogo}
              alt={channel.title}
              loading="lazy"
              decoding="async"
              onError={() => setLogoFailed(true)}
              className="relative z-10 max-h-full max-w-full w-auto h-auto object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.85)] transform group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="relative z-10 flex flex-col items-center justify-center gap-1 px-2">
              <span
                className={`text-[11px] font-black tracking-widest uppercase line-clamp-2 ${tokens.accentText}`}
              >
                {channel.title}
              </span>
            </div>
          )}
        </div>

        {/* Channel Info & Watch Action */}
        <div className="flex flex-col flex-1 justify-between space-y-2 z-10 min-w-0">
          <div className="min-w-0">
            <h4
              className={`${
                compact ? 'text-xs' : 'text-xs sm:text-sm'
              } font-black text-white tracking-tight line-clamp-1`}
            >
              {channel.title}
            </h4>
            {!compact && (
              <p
                className={`text-[10px] sm:text-[11px] font-medium line-clamp-2 mt-0.5 leading-snug min-h-[2rem] ${tokens.subMutedText}`}
              >
                {description}
              </p>
            )}
          </div>

          <div
            className={`w-full ${
              largeButtons
                ? 'py-2 text-xs'
                : compact
                  ? 'py-1.5 text-[10px]'
                  : 'py-1.5 sm:py-2 text-[10px] sm:text-[11px]'
            } px-2.5 rounded-xl font-extrabold uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-1.5 ${
              tokens.playBtn
            }`}
          >
            <span>▶</span>
            <span>Watch</span>
          </div>
        </div>
      </Link>

      {/* Active-Theme Bottom Laser Highlight */}
      {!glowOff && (
        <div
          className={`absolute inset-x-4 bottom-0 h-[2px] bg-gradient-to-r ${tokens.laserLine} opacity-75 group-hover:opacity-100 pointer-events-none`}
        />
      )}
    </div>
  );
});


/**
 * Isolated Custom Channels & M3U Playlist Manager Modal (uses uncontrolled refs
 * so Android WebView never flips typed characters on phones, tablets, or TVs).
 */
const CustomChannelManagerModal = memo(function CustomChannelManagerModal({
  isOpen,
  tokens,
  onClose,
  onChanged,
}: {
  isOpen: boolean;
  tokens: LiveTvThemeTokens;
  onClose: () => void;
  onChanged: (toastMsg: string) => void;
}) {
  const [tab, setTab] = useState<'single' | 'm3u'>('single');
  const [customList, setCustomList] = useState<LiveFeedService[]>(() =>
    getCustomLiveChannels()
  );
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(
    null
  );

  const nameRef = useRef<HTMLInputElement>(null);
  const urlRef = useRef<HTMLInputElement>(null);
  const groupRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const m3uTextRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setCustomList(getCustomLiveChannels());
    setFeedback(null);

    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleAddSingle = (e: React.FormEvent) => {
    e.preventDefault();
    const res = addCustomLiveChannel({
      name: nameRef.current?.value || '',
      url: urlRef.current?.value || '',
      groupTitle: groupRef.current?.value || 'Custom',
      logo: logoRef.current?.value || undefined,
    });
    if (!res.ok) {
      setFeedback({ ok: false, text: res.error || 'Could not add channel.' });
      return;
    }
    if (nameRef.current) nameRef.current.value = '';
    if (urlRef.current) urlRef.current.value = '';
    if (groupRef.current) groupRef.current.value = '';
    if (logoRef.current) logoRef.current.value = '';
    setCustomList(getCustomLiveChannels());
    setFeedback({ ok: true, text: `✓ Added "${res.channel?.name}" to Live TV!` });
    onChanged(`✓ Added custom channel "${res.channel?.name}"`);
  };

  const handleImportM3uText = () => {
    const raw = m3uTextRef.current?.value || '';
    const res = importM3uPlaylist(raw);
    if (!res.ok) {
      setFeedback({ ok: false, text: res.error || 'Import failed.' });
      return;
    }
    if (m3uTextRef.current) m3uTextRef.current.value = '';
    setCustomList(getCustomLiveChannels());
    const msg = `✓ Imported ${res.added} channel${res.added === 1 ? '' : 's'}${
      res.skipped ? ` • ${res.skipped} skipped` : ''
    }${res.blocked ? ` • ${res.blocked} unsafe blocked` : ''}`;
    setFeedback({ ok: true, text: msg });
    onChanged(msg);
  };

  const handleImportM3uFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const res = importM3uPlaylist(text);
      if (!res.ok) {
        setFeedback({ ok: false, text: res.error || 'Could not parse M3U file.' });
        return;
      }
      setCustomList(getCustomLiveChannels());
      const msg = `✓ Loaded ${res.added} from ${file.name}${
        res.blocked ? ` (${res.blocked} unsafe blocked)` : ''
      }`;
      setFeedback({ ok: true, text: msg });
      onChanged(msg);
    } catch {
      setFeedback({ ok: false, text: 'Could not read selected file.' });
    }
  };

  const handleExportCustom = () => {
    const m3u = exportChannelsAsM3u('custom');
    const blob = new Blob([m3u], { type: 'audio/x-mpegurl' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rabbittv_custom_channels_${new Date().toISOString().slice(0, 10)}.m3u`;
    a.click();
    URL.revokeObjectURL(url);
    setFeedback({ ok: true, text: '💾 Exported custom channels M3U backup!' });
  };

  const handleDeleteCustom = (chId: string, chName: string) => {
    if (removeCustomLiveChannel(chId)) {
      setCustomList(getCustomLiveChannels());
      onChanged(`Removed custom channel "${chName}"`);
    }
  };

  return (
    <div
      className="rabtv-vidsrc-protected fixed inset-0 z-50 flex items-center justify-center bg-black/82 p-3 sm:p-5 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-lg max-h-[88dvh] overflow-y-auto scrollbar-none rounded-3xl border p-4 sm:p-6 space-y-4 ${tokens.surfacePanel}`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-base sm:text-lg font-black text-white truncate">
              📡 Custom Channels & M3U Manager
            </h3>
            <p className={`text-[11px] ${tokens.subMutedText}`}>
              Add your own HLS streams or import a safe #EXTM3U playlist
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Custom Channels Manager"
            className={`h-8 w-8 shrink-0 rounded-full border text-xs font-bold flex items-center justify-center cursor-pointer ${tokens.btnSecondary}`}
          >
            ✕
          </button>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setTab('single')}
            className={`rounded-xl border py-2 text-xs font-extrabold transition cursor-pointer ${
              tab === 'single'
                ? `${tokens.btnActive} border-transparent`
                : tokens.btnIdle
            }`}
          >
            + Add Single Stream
          </button>
          <button
            type="button"
            onClick={() => setTab('m3u')}
            className={`rounded-xl border py-2 text-xs font-extrabold transition cursor-pointer ${
              tab === 'm3u'
                ? `${tokens.btnActive} border-transparent`
                : tokens.btnIdle
            }`}
          >
            📄 Import / Export M3U
          </button>
        </div>

        {feedback && (
          <div
            className={`rounded-xl border px-3 py-2 text-xs font-bold text-center ${
              feedback.ok
                ? 'bg-emerald-950/80 border-emerald-400/45 text-emerald-200'
                : 'bg-red-950/80 border-red-400/45 text-red-200'
            }`}
          >
            {feedback.text}
          </div>
        )}

        {tab === 'single' ? (
          <form onSubmit={handleAddSingle} className="space-y-2.5">
            <input
              ref={nameRef}
              type="text"
              dir="ltr"
              maxLength={50}
              autoComplete="off"
              placeholder="Channel Name (e.g. Local Sports HD)"
              style={{ direction: 'ltr', unicodeBidi: 'plaintext', textAlign: 'left' }}
              className={`w-full h-10 rounded-xl border px-3 text-xs font-bold focus:outline-none ${tokens.inputClass}`}
            />
            <input
              ref={urlRef}
              type="url"
              dir="ltr"
              autoComplete="off"
              placeholder="Stream URL (https://.../stream.m3u8)"
              style={{ direction: 'ltr', unicodeBidi: 'plaintext', textAlign: 'left' }}
              className={`w-full h-10 rounded-xl border px-3 text-xs font-bold focus:outline-none ${tokens.inputClass}`}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                ref={groupRef}
                type="text"
                dir="ltr"
                maxLength={25}
                autoComplete="off"
                placeholder="Region / Group (default: Custom)"
                style={{ direction: 'ltr', unicodeBidi: 'plaintext', textAlign: 'left' }}
                className={`w-full h-10 rounded-xl border px-3 text-xs font-bold focus:outline-none ${tokens.inputClass}`}
              />
              <input
                ref={logoRef}
                type="url"
                dir="ltr"
                autoComplete="off"
                placeholder="Optional Logo URL (https://...)"
                style={{ direction: 'ltr', unicodeBidi: 'plaintext', textAlign: 'left' }}
                className={`w-full h-10 rounded-xl border px-3 text-xs font-bold focus:outline-none ${tokens.inputClass}`}
              />
            </div>
            <button
              type="submit"
              className={`w-full h-10 rounded-xl text-xs font-extrabold uppercase tracking-wider cursor-pointer transition ${tokens.btnActive}`}
            >
              + Save Custom Channel
            </button>
          </form>
        ) : (
          <div className="space-y-2.5">
            <textarea
              ref={m3uTextRef}
              dir="ltr"
              rows={4}
              placeholder={'#EXTM3U\n#EXTINF:-1 group-title="Custom",My Channel\nhttps://example.com/live.m3u8'}
              style={{ direction: 'ltr', unicodeBidi: 'plaintext', textAlign: 'left' }}
              className={`w-full rounded-xl border p-3 text-xs font-mono focus:outline-none ${tokens.inputClass}`}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleImportM3uText}
                className={`h-10 rounded-xl text-xs font-extrabold cursor-pointer transition ${tokens.btnActive}`}
              >
                📥 Import Pasted M3U
              </button>
              <label
                className={`h-10 rounded-xl border text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer transition ${tokens.btnSecondary}`}
              >
                <span>📂 Load .m3u File</span>
                <input
                  type="file"
                  accept=".m3u,.m3u8,text/plain"
                  onChange={(e) => void handleImportM3uFile(e)}
                  className="hidden"
                />
              </label>
            </div>
            {customList.length > 0 && (
              <button
                type="button"
                onClick={handleExportCustom}
                className={`w-full h-9 rounded-xl border text-[11px] font-bold cursor-pointer transition ${tokens.btnIdle}`}
              >
                💾 Export My Custom Channels ({customList.length}) as .m3u
              </button>
            )}
          </div>
        )}

        {/* Saved Custom Channels List */}
        {customList.length > 0 && (
          <div className={`pt-3 border-t space-y-2 ${tokens.dividerBorder}`}>
            <span
              className={`block text-[10px] font-extrabold uppercase tracking-wider ${tokens.subMutedText}`}
            >
              Your Custom Channels ({customList.length}/50)
            </span>
            <div className="space-y-1.5 max-h-44 overflow-y-auto scrollbar-none pr-0.5">
              {customList.map((ch) => (
                <div
                  key={ch.channelId}
                  className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 ${tokens.surfaceCard}`}
                >
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold text-white truncate">
                      {ch.name}
                    </p>
                    <p className={`text-[10px] truncate ${tokens.subMutedText}`}>
                      {ch.groupTitle} • {ch.url}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteCustom(ch.channelId, ch.name)}
                    aria-label={`Delete ${ch.name}`}
                    className="h-7 w-7 shrink-0 rounded-lg bg-red-950/75 hover:bg-red-700 border border-red-500/40 text-red-200 hover:text-white text-xs font-bold cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

function LiveTvComponent() {
  const navigate = useNavigate();

  const [categories, setCategories] = useState<string[]>(['All']);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const genreOptions = useMemo(
    () => ['All Genres', ...Object.keys(channelCategories)],
    []
  );
  const [selectedGenre, setSelectedGenre] = useState<string>('All Genres');
  const [statusFilter, setStatusFilter] = useState<HealthFilterOption>('all');
  const [sortBy, setSortBy] = useState<LiveSortOption>('status');
  const [density, setDensity] = useState<LiveDensityOption>('comfort');
  const [pinnedOnly, setPinnedOnly] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResetNonce, setSearchResetNonce] = useState<number>(0);

  const [rawChannels, setRawChannels] = useState<LiveChannel[]>([]);
  const [healthMap, setHealthMap] = useState<Record<string, ExtendedHealthStatus>>(
    () => loadCachedHealthMap()
  );
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() =>
    getFavoriteChannelIds()
  );
  const [hiddenCount, setHiddenCount] = useState<number>(
    () => getHiddenLiveChannelIds().length
  );
  const [customModalOpen, setCustomModalOpen] = useState<boolean>(false);
  const [catalogRevision, setCatalogRevision] = useState<number>(0);
  const [pinToast, setPinToast] = useState<string | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [probing, setProbing] = useState<boolean>(false);
  const [probeProgress, setProbeProgress] = useState<{ done: number; total: number }>({
    done: 0,
    total: 0,
  });

  const [currentPage, setCurrentPage] = useState<number>(1);

  // Live settings wired from settings.ts
  const [appTheme, setAppTheme] = useState<AppTheme>(() => getSavedTheme());
  const [posterShape, setPosterShapeState] = useState<PosterShape>(() =>
    getPosterShape()
  );
  const [largeButtons, setLargeButtons] = useState<boolean>(() =>
    getLargeButtons()
  );
  const [reducedMotion, setReducedMotion] = useState<boolean>(() =>
    getReducedMotion()
  );
  const [glowOff, setGlowOff] = useState<boolean>(
    () => getGlowIntensity() === 'off'
  );
  const [isLowRam, setIsLowRam] = useState<boolean>(
    () => getHardwareLimits().effectiveMode === 'low'
  );
  const [channelsPerPage, setChannelsPerPage] = useState<number>(
    () => getHardwareLimits().liveChannelsPerPage
  );
  const [kidsSafeActive, setKidsSafeActive] = useState<boolean>(
    () => getKidsModeLocked() || getSavedUserAge() < 13
  );
  const [guideClock, setGuideClock] = useState<string>(() =>
    formatAppTime(new Date(), getClockFormat())
  );

  const probeRunIdRef = useRef<number>(0);
  const probeAbortRef = useRef<AbortController | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  // Sync live settings whenever Sidebar changes anything
  useEffect(() => {
    const syncSettings = () => {
      const limits = getHardwareLimits();
      setAppTheme(getSavedTheme());
      setPosterShapeState(getPosterShape());
      setLargeButtons(getLargeButtons());
      setReducedMotion(getReducedMotion());
      setGlowOff(getGlowIntensity() === 'off');
      setIsLowRam(limits.effectiveMode === 'low');
      setChannelsPerPage(limits.liveChannelsPerPage);
      setFavoriteIds(getFavoriteChannelIds());
      setKidsSafeActive(getKidsModeLocked() || getSavedUserAge() < 13);
      setGuideClock(formatAppTime(new Date(), getClockFormat()));
    };

    syncSettings();
    window.addEventListener('rabtv_settings_updated', syncSettings);
    window.addEventListener('rabtv_ram_mode_updated', syncSettings);
    return () => {
      window.removeEventListener('rabtv_settings_updated', syncSettings);
      window.removeEventListener('rabtv_ram_mode_updated', syncSettings);
    };
  }, []);

  // Keep live guide clock updated every 15s
  useEffect(() => {
    const interval = window.setInterval(() => {
      setGuideClock(formatAppTime(new Date(), getClockFormat()));
    }, 15000);
    return () => window.clearInterval(interval);
  }, []);

  // Cleanup timers & active probes on unmount
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      probeAbortRef.current?.abort();
    };
  }, []);

  // Listen to catalog updates (custom channels, M3U imports, hide/unhide, OTA sync)
  useEffect(() => {
    const onCatalogChange = () => {
      setHiddenCount(getHiddenLiveChannelIds().length);
      setCatalogRevision((r) => r + 1);
    };
    window.addEventListener(LIVE_CATALOG_UPDATED_EVENT, onCatalogChange);
    return () =>
      window.removeEventListener(LIVE_CATALOG_UPDATED_EVENT, onCatalogChange);
  }, []);

  // Deduplicate categories so "All" never appears twice
  useEffect(() => {
    let active = true;
    fetchLiveCategories()
      .then((cats) => {
        if (!active) return;
        const mapped = cats
          .map((cat) => (categoryMapping[cat] || cat).trim())
          .filter((cat) => cat.length > 0 && cat.toLowerCase() !== 'all');
        const uniqueCats = Array.from(new Set(['All', ...mapped]));
        setCategories(uniqueCats);
      })
      .catch((err) => {
        console.error('Failed to fetch live categories:', err);
      });
    return () => {
      active = false;
    };
  }, [catalogRevision]);

  /**
   * High-speed concurrent background health prober with full AbortController teardown.
   * Adapts concurrency (5 on 1-2GB sticks, 10 on 4GB+ devices) so low-RAM TVs stay responsive.
   */
  const runFastBackgroundProbe = useCallback(
    async (channelsToProbe: LiveChannel[], forceRefresh = false) => {
      probeAbortRef.current?.abort();
      const runController = new AbortController();
      probeAbortRef.current = runController;

      const runId = ++probeRunIdRef.current;
      const existingCache = forceRefresh ? {} : loadCachedHealthMap();

      const pending: LiveChannel[] = [];
      for (const ch of channelsToProbe) {
        const key = getChannelKey(ch);
        if (
          !forceRefresh &&
          existingCache[key] &&
          existingCache[key] !== 'checking'
        ) {
          continue;
        }
        pending.push(ch);
      }

      if (pending.length === 0) {
        setProbing(false);
        return;
      }

      setProbing(true);
      setProbeProgress({ done: 0, total: pending.length });

      const workingMap: Record<string, ExtendedHealthStatus> = {
        ...existingCache,
      };

      for (const ch of pending) {
        const key = getChannelKey(ch);
        if (!workingMap[key]) {
          workingMap[key] = 'checking';
        }
      }
      setHealthMap({ ...workingMap });

      let completed = 0;
      let cursor = 0;
      let lastFlushTime = Date.now();
      const concurrency = getHardwareLimits().effectiveMode === 'low' ? 5 : 10;

      const worker = async () => {
        while (cursor < pending.length) {
          if (
            probeRunIdRef.current !== runId ||
            runController.signal.aborted
          ) {
            return;
          }
          const currentIndex = cursor++;
          const channel = pending[currentIndex];
          if (!channel) continue;

          const key = getChannelKey(channel);
          const targetUrl = channel.streamUrl || channel.url;
          const result = await probeSingleChannelFast(
            targetUrl,
            runController.signal
          );

          if (
            probeRunIdRef.current !== runId ||
            runController.signal.aborted
          ) {
            return;
          }

          workingMap[key] = result;
          completed++;

          const now = Date.now();
          if (now - lastFlushTime >= 1200 || completed === pending.length) {
            lastFlushTime = now;
            setHealthMap({ ...workingMap });
            setProbeProgress({ done: completed, total: pending.length });
          }
        }
      };

      const workerCount = Math.min(concurrency, pending.length);
      await Promise.all(Array.from({ length: workerCount }, () => worker()));

      if (probeRunIdRef.current === runId && !runController.signal.aborted) {
        setHealthMap({ ...workingMap });
        saveCachedHealthMap(workingMap);
        setProbing(false);
      }
    },
    []
  );

  const loadChannelsInstantly = useCallback(
    async (opts?: { forceProbe?: boolean }) => {
      setLoading(true);
      try {
        let fetched: LiveChannel[] = [];

        if (selectedCategory === 'All') {
          fetched = await fetchAllChannels({
            probe: false,
            hideOffline: false,
          });
        } else {
          const originalCategory =
            reverseCategoryMapping[selectedCategory] || selectedCategory;
          fetched = await fetchChannelsByCategory(originalCategory, {
            probe: false,
            hideOffline: false,
          });
        }

        const seen = new Set<string>();
        const uniqueChannels: LiveChannel[] = [];
        for (const ch of fetched) {
          const streamTarget = ch.streamUrl || ch.url;
          if (!isSafeHttpUrl(streamTarget)) continue;
          const key = getChannelKey(ch);
          if (!seen.has(key)) {
            seen.add(key);
            uniqueChannels.push(ch);
          }
        }

        setRawChannels(uniqueChannels);
        setLoading(false);

        void runFastBackgroundProbe(uniqueChannels, opts?.forceProbe);
      } catch (err) {
        console.error('Failed to load live channels:', err);
        setLoading(false);
      }
    },
    [selectedCategory, runFastBackgroundProbe]
  );

  useEffect(() => {
    void loadChannelsInstantly();
    return () => {
      probeRunIdRef.current++;
      probeAbortRef.current?.abort();
    };
  }, [loadChannelsInstantly, catalogRevision]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory, selectedGenre, statusFilter, searchQuery, pinnedOnly, sortBy]);

  const handleRefreshHealth = async () => {
    try {
      localStorage.removeItem(FAST_HEALTH_CACHE_KEY);
    } catch {
      // ignore
    }
    void refreshLiveHealth().catch(() => {});
    await loadChannelsInstantly({ forceProbe: true });
  };

  const showLiveToast = useCallback((msg: string) => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    setPinToast(msg);
    toastTimerRef.current = window.setTimeout(() => setPinToast(null), 2800);
  }, []);

  const handleHideChannel = useCallback(
    (channelId: string, channelTitle: string) => {
      hideLiveChannel(channelId);
      setHiddenCount(getHiddenLiveChannelIds().length);
      showLiveToast(`🚫 Hid "${channelTitle}" — tap Restore Hidden anytime.`);
    },
    [showLiveToast]
  );

  const handleRestoreHidden = useCallback(() => {
    clearHiddenLiveChannels();
    setHiddenCount(0);
    showLiveToast('↺ Restored all hidden Live TV channels.');
  }, [showLiveToast]);

  const handleTogglePin = useCallback((channelId: string, channelTitle: string) => {
    const res = toggleFavoriteChannel(channelId);
    setFavoriteIds(res.favorites);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    if (res.limitReached) {
      setPinToast(
        `Max ${MAX_FAVORITE_CHANNELS} pinned channels reached — unpin one first.`
      );
    } else {
      setPinToast(
        res.added
          ? `Pinned "${channelTitle}" to your top Favorites.`
          : `Removed "${channelTitle}" from Favorites.`
      );
    }
    toastTimerRef.current = window.setTimeout(() => setPinToast(null), 2800);
  }, []);

  const favoriteIdSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);

  const resolveChannelStatus = useCallback(
    (channel: LiveChannel): ExtendedHealthStatus => {
      const key = getChannelKey(channel);
      if (isChannelQuarantined(key)) return 'offline';
      const cached = healthMap[key];
      if (cached) return cached;
      if (channel.health === 'online') return 'online';
      if (channel.health === 'offline') return 'offline';
      if (channel.health === 'checking') return 'checking';
      return probing ? 'checking' : 'timeout';
    },
    [healthMap, probing]
  );

  // Apply Kids Safe Mode Lock first
  const ageSafeChannels = useMemo(() => {
    if (!kidsSafeActive) return rawChannels;
    return rawChannels.filter((ch) => isChannelKidsSafe(ch.title));
  }, [rawChannels, kidsSafeActive]);

  // Pinned Favorites shelf matching current loaded channels
  const pinnedChannels = useMemo(() => {
    if (favoriteIds.length === 0) return [];
    const lookup = new Map<string, LiveChannel>();
    for (const ch of ageSafeChannels) {
      lookup.set(getChannelKey(ch), ch);
    }
    return favoriteIds
      .map((id) => lookup.get(id))
      .filter((ch): ch is LiveChannel => Boolean(ch));
  }, [ageSafeChannels, favoriteIds]);

  // Filter by Genre, Pinned-only, and Search Query
  const genreAndSearchFiltered = useMemo(() => {
    let list = ageSafeChannels;

    if (pinnedOnly) {
      list = list.filter((c) => favoriteIdSet.has(getChannelKey(c)));
    }

    if (selectedGenre !== 'All Genres') {
      const allowedNames = channelCategories[selectedGenre] || [];
      const allowedSet = new Set(allowedNames.map(normalizeMatchText));
      list = list.filter((c) => allowedSet.has(normalizeMatchText(c.title)));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          String(c.channelNumber || '').includes(q)
      );
    }

    return list;
  }, [ageSafeChannels, pinnedOnly, favoriteIdSet, selectedGenre, searchQuery]);

  const statusCounts = useMemo(() => {
    const counts = {
      all: genreAndSearchFiltered.length,
      online: 0,
      timeout: 0,
      offline: 0,
      checking: 0,
    };

    for (const ch of genreAndSearchFiltered) {
      const st = resolveChannelStatus(ch);
      if (st === 'online') counts.online++;
      else if (st === 'timeout') counts.timeout++;
      else if (st === 'offline') counts.offline++;
      else counts.checking++;
    }

    return counts;
  }, [genreAndSearchFiltered, resolveChannelStatus]);

  const finalFilteredChannels = useMemo(() => {
    const filtered = genreAndSearchFiltered.filter((ch) => {
      if (statusFilter === 'all') return true;
      const st = resolveChannelStatus(ch);
      if (statusFilter === 'timeout') {
        return st === 'timeout' || st === 'checking';
      }
      return st === statusFilter;
    });

    const rank: Record<ExtendedHealthStatus, number> = {
      online: 1,
      checking: 2,
      timeout: 3,
      offline: 4,
    };

    return [...filtered].sort((a, b) => {
      if (sortBy === 'status') {
        const pinA = favoriteIdSet.has(getChannelKey(a)) ? 0 : 1;
        const pinB = favoriteIdSet.has(getChannelKey(b)) ? 0 : 1;
        if (pinA !== pinB) return pinA - pinB;
        const rA = rank[resolveChannelStatus(a)] || 3;
        const rB = rank[resolveChannelStatus(b)] || 3;
        if (rA !== rB) return rA - rB;
        return a.title.localeCompare(b.title);
      }
      if (sortBy === 'reliability') {
        const scoreA = getChannelReliabilityScore(getChannelKey(a));
        const scoreB = getChannelReliabilityScore(getChannelKey(b));
        if (scoreA !== scoreB) return scoreB - scoreA;
        return a.title.localeCompare(b.title);
      }
      if (sortBy === 'channelNumber') {
        const na = a.channelNumber ?? 9999;
        const nb = b.channelNumber ?? 9999;
        if (na !== nb) return na - nb;
        return a.title.localeCompare(b.title);
      }
      return a.title.localeCompare(b.title);
    });
  }, [
    genreAndSearchFiltered,
    statusFilter,
    resolveChannelStatus,
    sortBy,
    favoriteIdSet,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(finalFilteredChannels.length / channelsPerPage)
  );

  // Clamp currentPage safely if channelsPerPage or filters shrink totalPages
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedChannels = useMemo(() => {
    const start = (currentPage - 1) * channelsPerPage;
    return finalFilteredChannels.slice(start, start + channelsPerPage);
  }, [finalFilteredChannels, currentPage, channelsPerPage]);

  const handleSurpriseChannel = () => {
    const onlinePool = finalFilteredChannels.filter(
      (ch) => resolveChannelStatus(ch) === 'online'
    );
    const pool = onlinePool.length > 0 ? onlinePool : finalFilteredChannels;
    if (!pool.length) return;
    const picked = pool[Math.floor(Math.random() * pool.length)];
    const targetUrl = picked.streamUrl || picked.url;
    if (!isSafeHttpUrl(targetUrl)) return;
    const chId = getChannelKey(picked);
    const safeLogo = isSafeHttpUrl(picked.logo) ? picked.logo!.trim() : '';

    bgAudio.pause();
    recordWatchHistory({
      id: chId,
      title: picked.title,
      posterPath: safeLogo,
      type: 'livetv',
    });
    navigate({
      to: '/live-player',
      search: {
        url: targetUrl,
        title: picked.title,
        logo: safeLogo,
        channelId: chId,
      },
    });
  };

  const handleCategorySelect = (id: string) => {
    setSelectedCategory((prev) => (prev === id && id !== 'All' ? 'All' : id));
  };

  const handleGenreSelect = (id: string) => {
    setSelectedGenre((prev) =>
      prev === id && id !== 'All Genres' ? 'All Genres' : id
    );
  };

  const handleStatusSelect = (id: HealthFilterOption) => {
    setStatusFilter((prev) => (prev === id && id !== 'all' ? 'all' : id));
  };

  const cardRadiusClass =
    posterShape === 'sharp'
      ? 'rounded-lg'
      : posterShape === 'extra'
        ? 'rounded-[28px]'
        : 'rounded-2xl sm:rounded-3xl';

  const isCompactMode = density === 'compact' && !largeButtons;

  // Responsive viewport grid tuned for portrait phones, landscape phones, tablets, desktops & TVs
  const gridClass = isCompactMode
    ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-2.5 sm:gap-3'
    : largeButtons
      ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-4'
      : 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4';

  const tokens = useMemo(() => getLiveTvThemeTokens(appTheme), [appTheme]);

  const getPrimaryBgColor = useCallback(
    (theme: AppTheme) => getLiveTvThemeTokens(theme).btnActive,
    []
  );

  const hasActiveFilters =
    selectedCategory !== 'All' ||
    selectedGenre !== 'All Genres' ||
    statusFilter !== 'all' ||
    pinnedOnly ||
    searchQuery.trim() !== '';

  const resetAllFilters = () => {
    setSelectedCategory('All');
    setSelectedGenre('All Genres');
    setStatusFilter('all');
    setPinnedOnly(false);
    setSearchQuery('');
    setSearchResetNonce((n) => n + 1);
  };

  return (
    <main
      className={`min-h-screen ${tokens.bg} ${tokens.baseText} transition-colors duration-300 pb-16 px-2.5 sm:px-6 w-full max-w-full overflow-x-clip box-border relative rounded-3xl`}
    >
      <style>{LIVETV_VIEWPORT_STYLES}</style>
      <AppWallpaper />
      {!isLowRam && !reducedMotion && !glowOff && (
        <div
          className={`absolute inset-x-0 -top-12 h-80 bg-gradient-to-b ${tokens.ambient} blur-3xl z-0 pointer-events-none rounded-t-3xl`}
        />
      )}

      <header className="py-3.5 sm:py-5 max-w-7xl mx-auto space-y-3.5 sm:space-y-4 box-border relative z-10">
        {/* Top Row: Compact Theme-Tuned Wrapper — Back to Home Left, Channel Surf Right */}
        <div className="rabtv-page-top-bar">
          <div className={finalFilteredChannels.length > 0 ? "rabtv-dual-wrapper" : "rabtv-single-wrapper"}>
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
              className={`rabtv-wrap-art-btn ${finalFilteredChannels.length > 0 ? "rabtv-wrap-art-btn--left" : ""} rabtv-wrap-art-btn--home rounded-full hover:scale-[1.04] active:scale-95 focus:outline-none focus:ring-2 ${tokens.focusRing}`}
            >
              <img
                src={BACK_TO_HOME_BTN_URL}
                alt="Back to Home"
                decoding="async"
              />
            </Link>

            {finalFilteredChannels.length > 0 && (
              <button
                type="button"
                onClick={handleSurpriseChannel}
                className={`rabtv-wrap-pill-btn border font-extrabold backdrop-blur-md shadow transition hover:scale-[1.03] active:scale-95 cursor-pointer focus:outline-none focus:ring-2 ${tokens.btnSecondary} ${tokens.focusRing}`}
                title="Jump into a random live broadcast"
              >
                <span className="truncate drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]">
                  🎲 Channel Surf
                </span>
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between sm:justify-end gap-1.5 sm:gap-2 w-full">
            <span
              className={`rounded-full border px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-extrabold whitespace-nowrap ${tokens.subtleBadge}`}
            >
              🕒 {guideClock}
            </span>

            {hiddenCount > 0 && (
              <button
                type="button"
                onClick={handleRestoreHidden}
                className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[11px] sm:text-xs font-bold whitespace-nowrap shadow transition cursor-pointer focus:outline-none focus:ring-2 ${tokens.btnSecondary} ${tokens.focusRing}`}
                title="Restore all hidden channels back to the guide"
              >
                <span>↺ Restore Hidden ({hiddenCount})</span>
              </button>
            )}

            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetAllFilters}
                className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[11px] sm:text-xs font-bold whitespace-nowrap shadow transition cursor-pointer focus:outline-none focus:ring-2 ${tokens.btnIdle} ${tokens.focusRing}`}
              >
                <span>✕ Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Theme-Matched Pin Toast */}
        {pinToast && (
          <div
            className={`rounded-2xl border px-4 py-2 text-center text-xs font-extrabold shadow-xl ${tokens.toastBanner}`}
          >
            {pinToast}
          </div>
        )}

        {/* Theme-Matched Translucent Broadcast Console Control Deck */}
        <div
          className={`w-full max-w-full box-border overflow-hidden rounded-3xl border ${
            isLowRam ? '' : 'backdrop-blur-md'
          } p-3.5 sm:p-6 space-y-4 sm:space-y-5 ${tokens.surfacePanel}`}
        >
          {/* Console Header + Responsive Search / Sort / Density / Refresh */}
          <div
            className={`flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3.5 border-b pb-4 ${tokens.dividerBorder}`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-2xl border ${tokens.headerIconBox}`}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`w-5 h-5 sm:w-6 sm:h-6 ${tokens.accentText}`}
                >
                  <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9" />
                  <path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5" />
                  <circle cx="12" cy="12" r="2" fill="currentColor" />
                  <path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5" />
                  <path d="M19.1 4.9C23 8.8 23 15.1 19.1 19" />
                </svg>
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-white">
                    Live TV & Sports
                  </h1>
                  {kidsSafeActive && (
                    <span className="rounded-full bg-emerald-500/20 border border-emerald-400/40 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-emerald-300 shrink-0">
                      🧒 Kids Safe
                    </span>
                  )}
                </div>
                <p className={`text-xs leading-snug ${tokens.subMutedText}`}>
                  Instant broadcast feeds with pinned favorites & real-time health radar
                </p>
              </div>
            </div>

            {/* Portrait & Landscape Safe Toolbar */}
            <div className="flex flex-col sm:flex-row sm:flex-wrap lg:flex-nowrap items-stretch sm:items-center gap-2 w-full lg:w-auto min-w-0">
              <LiveSearchInput
                tokens={tokens}
                resetSignal={searchResetNonce}
                onQueryChange={setSearchQuery}
              />

              <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 min-w-0">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as LiveSortOption)}
                  aria-label="Sort Live Channels"
                  className={`w-full sm:w-auto sm:min-w-[146px] h-10 rounded-xl border px-2.5 text-xs font-bold focus:outline-none cursor-pointer ${tokens.inputClass}`}
                >
                  <option value="status" className={tokens.optionBg}>
                    Sort: Live First
                  </option>
                  <option value="reliability" className={tokens.optionBg}>
                    Sort: Most Reliable
                  </option>
                  <option value="channelNumber" className={tokens.optionBg}>
                    Sort: Channel #
                  </option>
                  <option value="az" className={tokens.optionBg}>
                    Sort: A–Z
                  </option>
                </select>

                {!largeButtons && (
                  <button
                    type="button"
                    onClick={() =>
                      setDensity((d) =>
                        d === 'comfort' ? 'compact' : 'comfort'
                      )
                    }
                    className={`h-10 px-3 rounded-xl border text-xs font-bold whitespace-nowrap shrink-0 transition cursor-pointer focus:outline-none focus:ring-2 ${tokens.btnIdle} ${tokens.focusRing}`}
                    title="Switch Card Layout Density"
                  >
                    {density === 'comfort' ? '▦ Compact' : '▢ Comfort'}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setCustomModalOpen(true)}
                  className={`h-10 px-3 rounded-xl border text-xs font-extrabold whitespace-nowrap shrink-0 transition cursor-pointer focus:outline-none focus:ring-2 ${tokens.btnSecondary} ${tokens.focusRing}`}
                  title="Add Custom Stream or Import/Export M3U Playlist"
                >
                  + Add / M3U
                </button>

                <button
                  type="button"
                  onClick={() => void handleRefreshHealth()}
                  disabled={probing}
                  className={`w-full sm:w-auto h-10 px-3.5 rounded-xl text-xs font-extrabold tracking-wide whitespace-nowrap transition flex items-center justify-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-60 focus:outline-none focus:ring-2 ${tokens.btnActive} ${tokens.focusRing}`}
                >
                  <span className={probing ? 'animate-spin inline-block' : ''}>
                    ↻
                  </span>
                  <span>
                    {probing
                      ? `Scan (${probeProgress.done}/${probeProgress.total})`
                      : 'Refresh'}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* 1. STREAM HEALTH STATUS & PINNED FILTER BAR */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <p
                  className={`text-[10px] sm:text-[11px] font-extrabold uppercase tracking-widest ${tokens.subMutedText}`}
                >
                  1. Stream Status & Favorites
                </p>
                {probing && (
                  <span
                    className={`text-[10px] sm:text-[11px] font-bold animate-pulse whitespace-nowrap ${tokens.accentText}`}
                  >
                    • Scanning feeds…
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => setPinnedOnly((p) => !p)}
                className={`rounded-full px-3 py-1 text-[11px] font-extrabold border whitespace-nowrap shrink-0 transition cursor-pointer focus:outline-none focus:ring-2 ${
                  tokens.focusRing
                } ${pinnedOnly ? `${tokens.btnActive} border-transparent` : tokens.btnSecondary}`}
              >
                ★ Pinned ({favoriteIds.length}/{MAX_FAVORITE_CHANNELS})
              </button>
            </div>

            {/* 4 Collision-Proof Status Filter Pills (Never Clipping on Narrow Portrait Phones) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-0.5">
              <button
                type="button"
                onClick={() => handleStatusSelect('all')}
                className={`flex items-center justify-between gap-1.5 px-2.5 sm:px-3.5 py-2 sm:py-2.5 rounded-2xl border text-[11px] sm:text-xs font-extrabold transition-all cursor-pointer min-w-0 overflow-hidden focus:outline-none focus:ring-2 ${
                  tokens.focusRing
                } ${
                  statusFilter === 'all'
                    ? `${tokens.btnActive} border-white/30`
                    : tokens.btnIdle
                }`}
              >
                <span className="flex items-center gap-1.5 min-w-0 truncate">
                  <span className="sm:hidden truncate">All</span>
                  <span className="hidden sm:inline truncate">All Channels</span>
                </span>
                <span className="rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-black text-white shrink-0">
                  {statusCounts.all}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleStatusSelect('online')}
                className={`flex items-center justify-between gap-1.5 px-2.5 sm:px-3.5 py-2 sm:py-2.5 rounded-2xl border text-[11px] sm:text-xs font-extrabold transition-all cursor-pointer min-w-0 overflow-hidden focus:outline-none focus:ring-2 focus:ring-emerald-400 ${
                  statusFilter === 'online'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white border-emerald-300 shadow-[0_0_18px_rgba(16,185,129,0.4)]'
                    : 'bg-emerald-950/35 hover:bg-emerald-950/60 border-emerald-500/30 text-emerald-300'
                }`}
              >
                <span className="flex items-center gap-1.5 min-w-0 truncate">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 shrink-0 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
                  <span className="truncate">Online</span>
                </span>
                <span className="rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-black text-emerald-200 shrink-0">
                  {statusCounts.online}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleStatusSelect('timeout')}
                className={`flex items-center justify-between gap-1.5 px-2.5 sm:px-3.5 py-2 sm:py-2.5 rounded-2xl border text-[11px] sm:text-xs font-extrabold transition-all cursor-pointer min-w-0 overflow-hidden focus:outline-none focus:ring-2 focus:ring-amber-400 ${
                  statusFilter === 'timeout'
                    ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white border-amber-300 shadow-[0_0_18px_rgba(245,158,11,0.4)]'
                    : 'bg-amber-950/35 hover:bg-amber-950/60 border-amber-500/30 text-amber-300'
                }`}
              >
                <span className="flex items-center gap-1.5 min-w-0 truncate">
                  <span className="h-2 w-2 rounded-full bg-amber-400 shrink-0 shadow-[0_0_8px_rgba(251,191,36,0.9)]" />
                  <span className="truncate">Slow / ?</span>
                </span>
                <span className="rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-black text-amber-200 shrink-0">
                  {statusCounts.timeout + statusCounts.checking}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleStatusSelect('offline')}
                className={`flex items-center justify-between gap-1.5 px-2.5 sm:px-3.5 py-2 sm:py-2.5 rounded-2xl border text-[11px] sm:text-xs font-extrabold transition-all cursor-pointer min-w-0 overflow-hidden focus:outline-none focus:ring-2 focus:ring-red-400 ${
                  statusFilter === 'offline'
                    ? 'bg-gradient-to-r from-red-600 to-rose-700 text-white border-red-300 shadow-[0_0_18px_rgba(239,68,68,0.4)]'
                    : 'bg-red-950/35 hover:bg-red-950/60 border-red-500/30 text-red-300'
                }`}
              >
                <span className="flex items-center gap-1.5 min-w-0 truncate">
                  <span className="h-2 w-2 rounded-full bg-red-500 shrink-0 shadow-[0_0_8px_rgba(239,68,68,0.9)]" />
                  <span className="truncate">Offline</span>
                </span>
                <span className="rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-black text-red-200 shrink-0">
                  {statusCounts.offline}
                </span>
              </button>
            </div>
          </div>

          {/* 2. REGIONS & FEEDS BAR */}
          <div className="w-full space-y-1.5">
            <div className="flex items-center justify-between gap-2 px-0.5">
              <p
                className={`text-[10px] sm:text-[11px] font-extrabold uppercase tracking-widest ${tokens.subMutedText}`}
              >
                2. Regions & Feeds
              </p>
              {selectedCategory !== 'All' && (
                <button
                  type="button"
                  onClick={() => setSelectedCategory('All')}
                  className={`text-[11px] font-bold hover:underline cursor-pointer shrink-0 ${tokens.accentText}`}
                >
                  Show All Regions
                </button>
              )}
            </div>
            <ScrollPillBar
              options={categories.map((cat) => ({
                id: cat,
                label: cat === 'All' ? 'All Regions' : cat,
              }))}
              activeId={selectedCategory}
              onSelect={handleCategorySelect}
              appTheme={appTheme}
              getPrimaryBgColor={getPrimaryBgColor}
              ariaLabel="Live TV regions"
            />
          </div>

          {/* 3. CATEGORIES & GENRES BAR */}
          <div className="w-full space-y-1.5">
            <div className="flex items-center justify-between gap-2 px-0.5">
              <p
                className={`text-[10px] sm:text-[11px] font-extrabold uppercase tracking-widest ${tokens.subMutedText}`}
              >
                3. Categories & Genres
              </p>
              {selectedGenre !== 'All Genres' && (
                <button
                  type="button"
                  onClick={() => setSelectedGenre('All Genres')}
                  className={`text-[11px] font-bold hover:underline cursor-pointer shrink-0 ${tokens.accentText}`}
                >
                  Show All Genres
                </button>
              )}
            </div>
            <ScrollPillBar
              options={genreOptions.map((genre) => ({
                id: genre,
                label: genre === 'All Genres' ? 'All Genres' : genre,
              }))}
              activeId={selectedGenre}
              onSelect={handleGenreSelect}
              appTheme={appTheme}
              getPrimaryBgColor={getPrimaryBgColor}
              ariaLabel="Live TV genres"
            />
          </div>
        </div>
      </header>

      {/* Main Content Wrapper */}
      <div className="max-w-7xl mx-auto box-border relative z-10 space-y-6 sm:space-y-7">
        {/* DEDICATED PINNED FAVORITE CHANNELS SHELF (100% Theme-Matched) */}
        {pinnedChannels.length > 0 && !pinnedOnly && !searchQuery.trim() && (
          <section className="space-y-3">
            <div className="rabtv-section-banner">
              <div
                className="rabtv-art-bg"
                aria-hidden="true"
                style={{
                  backgroundImage: `url(${BUTTON_WRAPPER_URL})`,
                }}
              />
              <h2
                className={`rabtv-section-banner-title font-black tracking-tight truncate drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)] ${tokens.accentText}`}
              >
                ★ Pinned Favorites
              </h2>
            </div>

            <div className={gridClass}>
              {pinnedChannels.map((channel) => {
                const key = getChannelKey(channel);
                return (
                  <ChannelCard
                    key={`pinned-${key}`}
                    channel={channel}
                    status={resolveChannelStatus(channel)}
                    isPinned={true}
                    onTogglePin={handleTogglePin}
                    onHideChannel={handleHideChannel}
                    tokens={tokens}
                    radiusClass={cardRadiusClass}
                    largeButtons={largeButtons}
                    compact={isCompactMode}
                    glowOff={glowOff}
                    isLowRam={isLowRam}
                  />
                );
              })}
            </div>
          </section>
        )}

        {/* MAIN CHANNELS GRID SECTION */}
        <section className="space-y-3.5 sm:space-y-4">
          <div className="space-y-2.5">
            <div className="rabtv-section-banner">
              <div
                className="rabtv-art-bg"
                aria-hidden="true"
                style={{
                  backgroundImage: `url(${BUTTON_WRAPPER_URL})`,
                }}
              />
              <h3 className="rabtv-section-banner-title font-black tracking-tight text-white truncate drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)]">
                {pinnedOnly
                  ? '★ My Pinned Channels'
                  : selectedGenre !== 'All Genres'
                    ? selectedGenre
                    : selectedCategory}{' '}
                {statusFilter === 'online'
                  ? '• Online'
                  : statusFilter === 'timeout'
                    ? '• Slow / ?'
                    : statusFilter === 'offline'
                      ? '• Offline'
                      : '• All Feeds'}
              </h3>
            </div>

            <div className="flex flex-wrap items-center justify-center sm:justify-end gap-1.5 sm:gap-2 px-1 text-[11px] sm:text-xs font-bold">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-950/80 border border-emerald-500/30 px-2.5 py-1 text-emerald-300 whitespace-nowrap">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span>{statusCounts.online} online</span>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-950/80 border border-amber-500/30 px-2.5 py-1 text-amber-300 whitespace-nowrap">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                <span>{statusCounts.timeout + statusCounts.checking} slow</span>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-950/80 border border-red-500/30 px-2.5 py-1 text-red-300 whitespace-nowrap">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                <span>{statusCounts.offline} offline</span>
              </span>
            </div>
          </div>

          {loading ? (
            <div
              className={`rounded-3xl border ${
                isLowRam ? '' : 'backdrop-blur-sm'
              } p-10 sm:p-12 flex flex-col justify-center items-center gap-3 text-center ${
                tokens.surfacePanel
              }`}
            >
              <div
                className={`animate-spin rounded-full h-9 w-9 border-2 border-t-transparent ${tokens.accentText}`}
              />
              <p className="text-sm font-bold text-white">
                Loading broadcast channels…
              </p>
            </div>
          ) : paginatedChannels.length > 0 ? (
            <>
              <div className={gridClass}>
                {paginatedChannels.map((channel) => {
                  const key = getChannelKey(channel);
                  return (
                    <ChannelCard
                      key={key}
                      channel={channel}
                      status={resolveChannelStatus(channel)}
                      isPinned={favoriteIdSet.has(key)}
                      onTogglePin={handleTogglePin}
                      onHideChannel={handleHideChannel}
                      tokens={tokens}
                      radiusClass={cardRadiusClass}
                      largeButtons={largeButtons}
                      compact={isCompactMode}
                      glowOff={glowOff}
                      isLowRam={isLowRam}
                    />
                  );
                })}
              </div>

              {/* Pagination Deck */}
              {totalPages > 1 && (
                <div
                  className={`mt-6 flex flex-wrap items-center justify-center gap-3 rounded-2xl border ${
                    isLowRam ? '' : 'backdrop-blur-sm'
                  } p-3 mx-auto w-full max-w-md shadow-2xl ${tokens.surfacePanel}`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentPage((p) => Math.max(1, p - 1));
                      window.scrollTo({
                        top: 0,
                        behavior: reducedMotion ? 'auto' : 'smooth',
                      });
                    }}
                    disabled={currentPage <= 1}
                    className={`rounded-xl border ${
                      largeButtons ? 'px-5 py-3 text-sm' : 'px-4 py-2 text-xs'
                    } font-extrabold transition disabled:opacity-40 cursor-pointer focus:outline-none focus:ring-2 ${
                      tokens.btnSecondary
                    } ${tokens.focusRing}`}
                  >
                    ◀ Prev
                  </button>

                  <span className={`text-xs font-black ${tokens.accentText}`}>
                    Page {currentPage} of {totalPages}
                  </span>

                  <button
                    type="button"
                    onClick={() => {
                      setCurrentPage((p) => Math.min(totalPages, p + 1));
                      window.scrollTo({
                        top: 0,
                        behavior: reducedMotion ? 'auto' : 'smooth',
                      });
                    }}
                    disabled={currentPage >= totalPages}
                    className={`rounded-xl ${
                      largeButtons ? 'px-5 py-3 text-sm' : 'px-4 py-2 text-xs'
                    } font-extrabold shadow transition disabled:opacity-40 cursor-pointer focus:outline-none focus:ring-2 ${
                      tokens.btnActive
                    } ${tokens.focusRing}`}
                  >
                    Next ▶
                  </button>
                </div>
              )}
            </>
          ) : (
            <div
              className={`rounded-3xl border ${
                isLowRam ? '' : 'backdrop-blur-sm'
              } p-8 sm:p-10 text-center space-y-3 shadow-2xl ${tokens.surfacePanel}`}
            >
              <p className="text-base font-black text-white">
                {pinnedOnly
                  ? 'You have no pinned favorite channels yet.'
                  : 'No channels match this exact status or filter combination.'}
              </p>
              <p className={`text-xs max-w-md mx-auto ${tokens.subMutedText}`}>
                {pinnedOnly
                  ? `Tap the star on any channel card (or inside the Live Player) to pin up to ${MAX_FAVORITE_CHANNELS} favorites here.`
                  : 'Try switching the Stream Status filter to All Channels or Slow / ?, or reset your region and genre filters.'}
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetAllFilters}
                  className={`mt-2 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-extrabold text-white shadow-lg transition cursor-pointer focus:outline-none focus:ring-2 ${tokens.btnActive} ${tokens.focusRing}`}
                >
                  <span>Show All Channels</span>
                </button>
              )}
            </div>
          )}
        </section>
      </div>

      <CustomChannelManagerModal
        isOpen={customModalOpen}
        tokens={tokens}
        onClose={() => setCustomModalOpen(false)}
        onChanged={(msg) => showLiveToast(msg)}
      />
    </main>
  );
}