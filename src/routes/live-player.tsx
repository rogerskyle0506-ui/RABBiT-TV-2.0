// src/routes/live-player.tsx
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import {
  AppTheme,
  StreamQuality,
  getSavedTheme,
  getHardwareLimits,
  getDefaultPlayerVolume,
  getSavedStreamQuality,
  getLargeButtons,
  getReducedMotion,
  getGlowIntensity,
  getClockFormat,
  formatAppTime,
  getSleepTimerMinutes,
  isFavoriteChannel,
  toggleFavoriteChannel,
  MAX_FAVORITE_CHANNELS,
} from '@/lib/settings';
import {
  fetchAllChannels,
  type LiveChannel,
} from '@/lib/live-feed-service';
import { logLiveChannelWatch } from '@/lib/watch-history';
import { getChannelDescription } from '@/lib/channel-descriptions';
import { AppWallpaper } from '@/components/AppWallpaper';
import { bgAudio } from '@/lib/background-audio';

export const Route = createFileRoute('/live-player')({
  component: LivePlayerComponent,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      url: (search.url as string) || '',
      title: (search.title as string) || 'Live Stream',
      logo: (search.logo as string) || '',
      channelId: (search.channelId as string) || '',
    };
  },
});

interface QualityLevel {
  index: number;
  label: string;
  height?: number;
}

type StreamStatus = 'checking' | 'live' | 'offline';
type AspectMode = 'contain' | 'cover' | 'fill';

// 1x1 transparent GIF prevents Android WebView / Android TV 14 from rendering the giant default play icon poster
const TRANSPARENT_POSTER =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

interface LivePlayerThemeTokens {
  bg: string;
  baseText: string;
  mutedText: string;
  subMutedText: string;
  accentText: string;
  accentBar: string;
  badge: string;
  subtleBadge: string;
  ambient: string;
  playerFrame: string;
  playerGlow: string;
  surfacePanel: string;
  surfaceCard: string;
  logoStage: string;
  backCapsule: string;
  backBadge: string;
  btnSecondary: string;
  btnPinned: string;
  hudDock: string;
  hudBtn: string;
  hudSelectBox: string;
  optionBg: string;
  hudAccentIcon: string;
  sliderTrack: string;
  feedbackBanner: string;
  laserLine: string;
  primaryBtn: string;
  borderHover: string;
  focusRing: string;
}

function getLivePlayerThemeTokens(theme: AppTheme): LivePlayerThemeTokens {
  switch (theme) {
    case 'red':
      return {
        bg: 'bg-gradient-to-br from-zinc-950/90 via-red-950/40 to-black/95',
        baseText: 'text-zinc-100',
        mutedText: 'text-zinc-300',
        subMutedText: 'text-zinc-400',
        accentText: 'text-red-400',
        accentBar: 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.95)]',
        badge: 'text-red-200 border-red-500/35 bg-red-950/75',
        subtleBadge: 'text-zinc-200 border-red-500/25 bg-black/75',
        ambient: 'from-red-600/20 via-rose-600/5 to-transparent',
        playerFrame: 'border-red-500/35',
        playerGlow:
          'shadow-[0_25px_70px_rgba(0,0,0,0.95),0_0_38px_rgba(239,68,68,0.24)]',
        surfacePanel:
          'bg-zinc-950/90 border-red-500/30 shadow-[0_16px_50px_rgba(0,0,0,0.8)]',
        surfaceCard:
          'bg-zinc-950/90 border-red-500/25 shadow-xl',
        logoStage:
          'bg-gradient-to-b from-zinc-900 via-black to-zinc-950 border-red-500/25',
        backCapsule:
          'bg-zinc-950/88 hover:bg-red-950/80 border-red-500/35 hover:border-red-400 text-zinc-100 hover:text-white',
        backBadge:
          'bg-gradient-to-tr from-red-600/60 via-rose-500/50 to-orange-500/50 border-red-400/50 text-white',
        btnSecondary:
          'bg-red-950/60 hover:bg-red-900/80 border-red-500/35 text-red-100 hover:text-white',
        btnPinned:
          'bg-red-600/35 border-red-400/75 text-red-100 shadow-[0_0_14px_rgba(239,68,68,0.35)]',
        hudDock:
          'bg-zinc-950/92 border-red-500/35 shadow-[0_10px_30px_rgba(0,0,0,0.85)]',
        hudBtn:
          'bg-red-950/45 hover:bg-red-900/75 border-red-500/30 text-red-100 hover:text-white',
        hudSelectBox:
          'bg-red-950/45 hover:bg-red-950/75 border-red-500/30',
        optionBg: 'bg-zinc-950 text-white',
        hudAccentIcon: 'text-red-300',
        sliderTrack: 'bg-zinc-800 accent-red-500',
        feedbackBanner:
          'bg-red-950/85 border-red-400/50 text-red-100',
        laserLine: 'from-transparent via-red-500 to-rose-400',
        primaryBtn:
          'bg-gradient-to-r from-red-600 via-rose-600 to-orange-600 text-white shadow-[0_0_20px_rgba(239,68,68,0.45)]',
        borderHover: 'hover:border-red-400/75',
        focusRing: 'focus:ring-red-500',
      };
    case 'midnight':
      return {
        bg: 'bg-gradient-to-br from-slate-950/90 via-blue-950/40 to-black/95',
        baseText: 'text-slate-100',
        mutedText: 'text-slate-300',
        subMutedText: 'text-slate-400',
        accentText: 'text-sky-300',
        accentBar: 'bg-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.95)]',
        badge: 'text-sky-200 border-blue-500/35 bg-blue-950/75',
        subtleBadge: 'text-slate-200 border-blue-500/25 bg-black/75',
        ambient: 'from-blue-600/20 via-sky-500/5 to-transparent',
        playerFrame: 'border-blue-500/35',
        playerGlow:
          'shadow-[0_25px_70px_rgba(0,0,0,0.95),0_0_38px_rgba(56,189,248,0.24)]',
        surfacePanel:
          'bg-slate-950/90 border-blue-500/30 shadow-[0_16px_50px_rgba(0,0,0,0.8)]',
        surfaceCard:
          'bg-slate-950/90 border-blue-500/25 shadow-xl',
        logoStage:
          'bg-gradient-to-b from-slate-900 via-black to-slate-950 border-blue-500/25',
        backCapsule:
          'bg-slate-950/88 hover:bg-blue-950/80 border-blue-500/35 hover:border-sky-400 text-slate-100 hover:text-white',
        backBadge:
          'bg-gradient-to-tr from-blue-600/60 via-sky-500/50 to-cyan-400/50 border-sky-400/50 text-white',
        btnSecondary:
          'bg-blue-950/60 hover:bg-blue-900/80 border-blue-500/35 text-blue-100 hover:text-white',
        btnPinned:
          'bg-blue-600/35 border-sky-400/75 text-sky-100 shadow-[0_0_14px_rgba(56,189,248,0.35)]',
        hudDock:
          'bg-slate-950/92 border-blue-500/35 shadow-[0_10px_30px_rgba(0,0,0,0.85)]',
        hudBtn:
          'bg-blue-950/45 hover:bg-blue-900/75 border-blue-500/30 text-sky-100 hover:text-white',
        hudSelectBox:
          'bg-blue-950/45 hover:bg-blue-950/75 border-blue-500/30',
        optionBg: 'bg-slate-950 text-white',
        hudAccentIcon: 'text-sky-300',
        sliderTrack: 'bg-slate-800 accent-sky-400',
        feedbackBanner:
          'bg-blue-950/85 border-sky-400/50 text-sky-100',
        laserLine: 'from-transparent via-sky-400 to-blue-500',
        primaryBtn:
          'bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-500 text-white shadow-[0_0_20px_rgba(56,189,248,0.45)]',
        borderHover: 'hover:border-sky-400/75',
        focusRing: 'focus:ring-sky-400',
      };
    case 'emerald':
      return {
        bg: 'bg-gradient-to-br from-neutral-950/90 via-emerald-950/40 to-black/95',
        baseText: 'text-neutral-100',
        mutedText: 'text-neutral-300',
        subMutedText: 'text-neutral-400',
        accentText: 'text-emerald-300',
        accentBar: 'bg-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.95)]',
        badge: 'text-emerald-200 border-emerald-500/35 bg-emerald-950/75',
        subtleBadge: 'text-neutral-200 border-emerald-500/25 bg-black/75',
        ambient: 'from-emerald-600/20 via-teal-500/5 to-transparent',
        playerFrame: 'border-emerald-500/35',
        playerGlow:
          'shadow-[0_25px_70px_rgba(0,0,0,0.95),0_0_38px_rgba(52,211,153,0.24)]',
        surfacePanel:
          'bg-neutral-950/90 border-emerald-500/30 shadow-[0_16px_50px_rgba(0,0,0,0.8)]',
        surfaceCard:
          'bg-neutral-950/90 border-emerald-500/25 shadow-xl',
        logoStage:
          'bg-gradient-to-b from-neutral-900 via-black to-neutral-950 border-emerald-500/25',
        backCapsule:
          'bg-neutral-950/88 hover:bg-emerald-950/80 border-emerald-500/35 hover:border-emerald-400 text-neutral-100 hover:text-white',
        backBadge:
          'bg-gradient-to-tr from-emerald-600/60 via-teal-500/50 to-green-400/50 border-emerald-400/50 text-white',
        btnSecondary:
          'bg-emerald-950/60 hover:bg-emerald-900/80 border-emerald-500/35 text-emerald-100 hover:text-white',
        btnPinned:
          'bg-emerald-600/35 border-emerald-400/75 text-emerald-100 shadow-[0_0_14px_rgba(52,211,153,0.35)]',
        hudDock:
          'bg-neutral-950/92 border-emerald-500/35 shadow-[0_10px_30px_rgba(0,0,0,0.85)]',
        hudBtn:
          'bg-emerald-950/45 hover:bg-emerald-900/75 border-emerald-500/30 text-emerald-100 hover:text-white',
        hudSelectBox:
          'bg-emerald-950/45 hover:bg-emerald-950/75 border-emerald-500/30',
        optionBg: 'bg-neutral-950 text-white',
        hudAccentIcon: 'text-emerald-300',
        sliderTrack: 'bg-neutral-800 accent-emerald-400',
        feedbackBanner:
          'bg-emerald-950/85 border-emerald-400/50 text-emerald-100',
        laserLine: 'from-transparent via-emerald-400 to-teal-400',
        primaryBtn:
          'bg-gradient-to-r from-emerald-600 via-teal-600 to-green-600 text-white shadow-[0_0_20px_rgba(52,211,153,0.45)]',
        borderHover: 'hover:border-emerald-400/75',
        focusRing: 'focus:ring-emerald-400',
      };
    case 'amber':
      return {
        bg: 'bg-gradient-to-br from-stone-950/90 via-yellow-950/40 to-black/95',
        baseText: 'text-stone-100',
        mutedText: 'text-stone-300',
        subMutedText: 'text-stone-400',
        accentText: 'text-amber-300',
        accentBar: 'bg-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.95)]',
        badge: 'text-amber-200 border-amber-500/35 bg-amber-950/75',
        subtleBadge: 'text-stone-200 border-amber-500/25 bg-black/75',
        ambient: 'from-amber-600/20 via-yellow-500/5 to-transparent',
        playerFrame: 'border-amber-500/35',
        playerGlow:
          'shadow-[0_25px_70px_rgba(0,0,0,0.95),0_0_38px_rgba(245,158,11,0.24)]',
        surfacePanel:
          'bg-stone-950/90 border-amber-500/30 shadow-[0_16px_50px_rgba(0,0,0,0.8)]',
        surfaceCard:
          'bg-stone-950/90 border-amber-500/25 shadow-xl',
        logoStage:
          'bg-gradient-to-b from-stone-900 via-black to-stone-950 border-amber-500/25',
        backCapsule:
          'bg-stone-950/88 hover:bg-amber-950/80 border-amber-500/35 hover:border-amber-400 text-stone-100 hover:text-white',
        backBadge:
          'bg-gradient-to-tr from-amber-600/60 via-yellow-500/50 to-orange-500/50 border-amber-400/50 text-white',
        btnSecondary:
          'bg-amber-950/60 hover:bg-amber-900/80 border-amber-500/35 text-amber-100 hover:text-white',
        btnPinned:
          'bg-amber-600/35 border-amber-400/75 text-amber-100 shadow-[0_0_14px_rgba(245,158,11,0.35)]',
        hudDock:
          'bg-stone-950/92 border-amber-500/35 shadow-[0_10px_30px_rgba(0,0,0,0.85)]',
        hudBtn:
          'bg-amber-950/45 hover:bg-amber-900/75 border-amber-500/30 text-amber-100 hover:text-white',
        hudSelectBox:
          'bg-amber-950/45 hover:bg-amber-950/75 border-amber-500/30',
        optionBg: 'bg-stone-950 text-white',
        hudAccentIcon: 'text-amber-300',
        sliderTrack: 'bg-stone-800 accent-amber-400',
        feedbackBanner:
          'bg-amber-950/85 border-amber-400/50 text-amber-100',
        laserLine: 'from-transparent via-amber-400 to-orange-500',
        primaryBtn:
          'bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 text-white shadow-[0_0_20px_rgba(245,158,11,0.45)]',
        borderHover: 'hover:border-amber-400/75',
        focusRing: 'focus:ring-amber-400',
      };
    case 'cyan':
      return {
        bg: 'bg-gradient-to-br from-slate-950/90 via-cyan-950/40 to-black/95',
        baseText: 'text-slate-100',
        mutedText: 'text-slate-300',
        subMutedText: 'text-slate-400',
        accentText: 'text-cyan-300',
        accentBar: 'bg-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.95)]',
        badge: 'text-cyan-200 border-cyan-500/35 bg-cyan-950/75',
        subtleBadge: 'text-slate-200 border-cyan-500/25 bg-black/75',
        ambient: 'from-cyan-600/20 via-sky-500/5 to-transparent',
        playerFrame: 'border-cyan-500/35',
        playerGlow:
          'shadow-[0_25px_70px_rgba(0,0,0,0.95),0_0_38px_rgba(34,211,238,0.24)]',
        surfacePanel:
          'bg-slate-950/90 border-cyan-500/30 shadow-[0_16px_50px_rgba(0,0,0,0.8)]',
        surfaceCard:
          'bg-slate-950/90 border-cyan-500/25 shadow-xl',
        logoStage:
          'bg-gradient-to-b from-slate-900 via-black to-slate-950 border-cyan-500/25',
        backCapsule:
          'bg-slate-950/88 hover:bg-cyan-950/80 border-cyan-500/35 hover:border-cyan-400 text-slate-100 hover:text-white',
        backBadge:
          'bg-gradient-to-tr from-cyan-600/60 via-teal-500/50 to-sky-400/50 border-cyan-400/50 text-white',
        btnSecondary:
          'bg-cyan-950/60 hover:bg-cyan-900/80 border-cyan-500/35 text-cyan-100 hover:text-white',
        btnPinned:
          'bg-cyan-600/35 border-cyan-400/75 text-cyan-100 shadow-[0_0_14px_rgba(34,211,238,0.35)]',
        hudDock:
          'bg-slate-950/92 border-cyan-500/35 shadow-[0_10px_30px_rgba(0,0,0,0.85)]',
        hudBtn:
          'bg-cyan-950/45 hover:bg-cyan-900/75 border-cyan-500/30 text-cyan-100 hover:text-white',
        hudSelectBox:
          'bg-cyan-950/45 hover:bg-cyan-950/75 border-cyan-500/30',
        optionBg: 'bg-slate-950 text-white',
        hudAccentIcon: 'text-cyan-300',
        sliderTrack: 'bg-slate-800 accent-cyan-400',
        feedbackBanner:
          'bg-cyan-950/85 border-cyan-400/50 text-cyan-100',
        laserLine: 'from-transparent via-cyan-400 to-teal-400',
        primaryBtn:
          'bg-gradient-to-r from-cyan-600 via-teal-600 to-blue-600 text-white shadow-[0_0_20px_rgba(34,211,238,0.45)]',
        borderHover: 'hover:border-cyan-400/75',
        focusRing: 'focus:ring-cyan-400',
      };
    case 'violet':
    default:
      return {
        bg: 'bg-gradient-to-br from-slate-950/90 via-purple-950/40 to-black/95',
        baseText: 'text-slate-100',
        mutedText: 'text-slate-300',
        subMutedText: 'text-slate-400',
        accentText: 'text-violet-300',
        accentBar: 'bg-violet-500 shadow-[0_0_15px_rgba(139,92,246,0.95)]',
        badge: 'text-violet-200 border-violet-500/35 bg-purple-950/75',
        subtleBadge: 'text-slate-200 border-violet-500/25 bg-black/75',
        ambient: 'from-violet-600/20 via-purple-500/5 to-transparent',
        playerFrame: 'border-violet-500/35',
        playerGlow:
          'shadow-[0_25px_70px_rgba(0,0,0,0.95),0_0_38px_rgba(168,85,247,0.24)]',
        surfacePanel:
          'bg-slate-950/90 border-violet-500/30 shadow-[0_16px_50px_rgba(0,0,0,0.8)]',
        surfaceCard:
          'bg-slate-950/90 border-violet-500/25 shadow-xl',
        logoStage:
          'bg-gradient-to-b from-slate-900 via-black to-slate-950 border-violet-500/25',
        backCapsule:
          'bg-slate-950/88 hover:bg-purple-950/80 border-violet-500/35 hover:border-violet-400 text-slate-100 hover:text-white',
        backBadge:
          'bg-gradient-to-tr from-violet-600/60 via-purple-500/50 to-indigo-500/50 border-violet-400/50 text-white',
        btnSecondary:
          'bg-purple-950/60 hover:bg-purple-900/80 border-violet-500/35 text-purple-100 hover:text-white',
        btnPinned:
          'bg-violet-600/35 border-violet-400/75 text-violet-100 shadow-[0_0_14px_rgba(139,92,246,0.35)]',
        hudDock:
          'bg-slate-950/92 border-violet-500/35 shadow-[0_10px_30px_rgba(0,0,0,0.85)]',
        hudBtn:
          'bg-purple-950/45 hover:bg-purple-900/75 border-violet-500/30 text-purple-100 hover:text-white',
        hudSelectBox:
          'bg-purple-950/45 hover:bg-purple-950/75 border-violet-500/30',
        optionBg: 'bg-slate-950 text-white',
        hudAccentIcon: 'text-violet-300',
        sliderTrack: 'bg-slate-800 accent-violet-400',
        feedbackBanner:
          'bg-purple-950/85 border-violet-400/50 text-violet-100',
        laserLine: 'from-transparent via-purple-500 to-violet-400',
        primaryBtn:
          'bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 text-white shadow-[0_0_20px_rgba(139,92,246,0.45)]',
        borderHover: 'hover:border-violet-400/75',
        focusRing: 'focus:ring-violet-400',
      };
  }
}

function LivePlayerComponent() {
  const {
    url: streamUrl,
    title,
    logo,
    channelId: searchChannelId,
  } = Route.useSearch();
  const navigate = useNavigate();

  // Live settings from settings.ts
  const [appTheme, setAppTheme] = useState<AppTheme>(() => getSavedTheme());
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
  const [preferredQuality, setPreferredQuality] = useState<StreamQuality>(() =>
    getSavedStreamQuality()
  );
  const [sleepTimerMin, setSleepTimerMin] = useState<number>(() =>
    getSleepTimerMinutes()
  );
  const [hudClock, setHudClock] = useState<string>(() =>
    formatAppTime(new Date(), getClockFormat())
  );

  // Channel list for Prev/Next surfing & suggestions
  const [allChannels, setAllChannels] = useState<LiveChannel[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);

  // Playback & HUD state
  const [qualityLevels, setQualityLevels] = useState<QualityLevel[]>([]);
  const [selectedQuality, setSelectedQuality] = useState<number>(-1);
  const [streamStatus, setStreamStatus] = useState<StreamStatus>('checking');
  const [retryNonce, setRetryNonce] = useState<number>(0);
  const [aspectMode, setAspectMode] = useState<AspectMode>('contain');

  const [volume, setVolume] = useState<number>(() => getDefaultPlayerVolume());
  const [isMuted, setIsMuted] = useState(false);
  const [previousVolume, setPreviousVolume] = useState<number>(() =>
    getDefaultPlayerVolume() > 0 ? getDefaultPlayerVolume() : 0.85
  );
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

  const [isPlaying, setIsPlaying] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [pinFeedback, setPinFeedback] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<any>(null);
  const controlsTimeoutRef = useRef<number | null>(null);

  // Resolve canonical channelId (supports both new and legacy links)
  const resolvedChannelId = useMemo(() => {
    if (searchChannelId) return searchChannelId;
    const match = allChannels.find(
      (c) => (c.streamUrl || c.url) === streamUrl
    );
    return match?.channelId || streamUrl || title;
  }, [searchChannelId, allChannels, streamUrl, title]);

  const [isPinned, setIsPinned] = useState<boolean>(() =>
    isFavoriteChannel(searchChannelId || streamUrl || title)
  );

  useEffect(() => {
    setIsPinned(isFavoriteChannel(resolvedChannelId));
  }, [resolvedChannelId]);

  // Halt background radio audio to prevent clashing audio and free audio decoder RAM
  useEffect(() => {
    bgAudio.pause();
  }, [streamUrl]);

  // Log channel to Watch History when opened
  useEffect(() => {
    if (!streamUrl) return;
    logLiveChannelWatch({
      title: title || 'Live Channel',
      logo: logo || '',
      streamUrl,
      channelId: resolvedChannelId || streamUrl,
    });
  }, [streamUrl, title, logo, resolvedChannelId]);

  // Sync live settings updates
  useEffect(() => {
    const syncSettings = () => {
      setAppTheme(getSavedTheme());
      setLargeButtons(getLargeButtons());
      setReducedMotion(getReducedMotion());
      setGlowOff(getGlowIntensity() === 'off');
      setIsLowRam(getHardwareLimits().effectiveMode === 'low');
      setPreferredQuality(getSavedStreamQuality());
      setSleepTimerMin(getSleepTimerMinutes());
      setHudClock(formatAppTime(new Date(), getClockFormat()));
      setIsPinned(isFavoriteChannel(resolvedChannelId));
    };

    syncSettings();
    window.addEventListener('rabtv_settings_updated', syncSettings);
    window.addEventListener('rabtv_ram_mode_updated', syncSettings);
    return () => {
      window.removeEventListener('rabtv_settings_updated', syncSettings);
      window.removeEventListener('rabtv_ram_mode_updated', syncSettings);
    };
  }, [resolvedChannelId]);

  // Keep HUD clock updated every 15s
  useEffect(() => {
    const timer = window.setInterval(() => {
      setHudClock(formatAppTime(new Date(), getClockFormat()));
    }, 15000);
    return () => window.clearInterval(timer);
  }, []);

  // Load deduplicated channel list without probing (fast & RAM-safe)
  useEffect(() => {
    let cancelled = false;
    setLoadingSuggestions(true);

    const loadChannels = async () => {
      try {
        const rawList = await fetchAllChannels({
          probe: false,
          hideOffline: false,
        });
        if (cancelled) return;

        const seenUrls = new Set<string>();
        const unique: LiveChannel[] = [];
        for (const ch of rawList) {
          const u = (ch.streamUrl || ch.url || '').trim();
          if (!u || seenUrls.has(u)) continue;
          seenUrls.add(u);
          unique.push(ch);
        }
        setAllChannels(unique);
      } catch {
        if (!cancelled) setAllChannels([]);
      } finally {
        if (!cancelled) setLoadingSuggestions(false);
      }
    };

    void loadChannels();
    return () => {
      cancelled = true;
    };
  }, []);

  // Compute Prev/Next channels for instant cable-box surfing + 6 suggestions
  const { prevChannel, nextChannel, suggestedChannels } = useMemo(() => {
    if (!allChannels.length) {
      return {
        prevChannel: null as LiveChannel | null,
        nextChannel: null as LiveChannel | null,
        suggestedChannels: [] as LiveChannel[],
      };
    }

    const currentIdx = allChannels.findIndex(
      (c) => (c.streamUrl || c.url) === streamUrl
    );
    const prev =
      currentIdx >= 0
        ? allChannels[(currentIdx - 1 + allChannels.length) % allChannels.length]
        : allChannels[allChannels.length - 1];
    const next =
      currentIdx >= 0
        ? allChannels[(currentIdx + 1) % allChannels.length]
        : allChannels[0];

    const suggestions: LiveChannel[] = [];
    const seenTitles = new Set<string>([(title || '').trim().toLowerCase()]);
    const startIdx = currentIdx >= 0 ? currentIdx + 1 : 0;

    for (let offset = 0; offset < allChannels.length; offset++) {
      const ch = allChannels[(startIdx + offset) % allChannels.length];
      const u = (ch.streamUrl || ch.url || '').trim();
      const normTitle = (ch.title || '').trim().toLowerCase();
      if (!u || u === streamUrl || seenTitles.has(normTitle)) continue;
      seenTitles.add(normTitle);
      suggestions.push(ch);
      if (suggestions.length >= 6) break;
    }

    return { prevChannel: prev, nextChannel: next, suggestedChannels: suggestions };
  }, [allChannels, streamUrl, title]);

  const surfToChannel = useCallback(
    (ch: LiveChannel | null) => {
      if (!ch) return;
      navigate({
        to: '/live-player',
        search: {
          url: ch.streamUrl || ch.url,
          title: ch.title,
          logo: ch.logo || '',
          channelId: ch.channelId || '',
        },
      });
    },
    [navigate]
  );

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  const revealControlsTemporarily = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      window.clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = window.setTimeout(() => {
      setShowControls(false);
      setShowVolumeSlider(false);
    }, 4500);
  }, []);

  useEffect(() => {
    revealControlsTemporarily();
    return () => {
      if (controlsTimeoutRef.current) {
        window.clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [revealControlsTemporarily]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () =>
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!playerContainerRef.current) return;
    if (!document.fullscreenElement) {
      playerContainerRef.current.requestFullscreen().catch((err) => {
        console.error('Error attempting to enable fullscreen:', err);
      });
    } else {
      document.exitFullscreen().catch((err) => {
        console.error('Error attempting to exit fullscreen:', err);
      });
    }
  }, []);

  const togglePlayPause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    revealControlsTemporarily();
    if (video.paused) {
      video
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => {});
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, [revealControlsTemporarily]);

  const toggleMute = useCallback(() => {
    revealControlsTemporarily();
    if (isMuted) {
      setVolume(previousVolume || 0.8);
      setIsMuted(false);
    } else {
      setPreviousVolume(volume > 0 ? volume : 0.8);
      setVolume(0);
      setIsMuted(true);
    }
  }, [isMuted, previousVolume, volume, revealControlsTemporarily]);

  const cycleAspectMode = useCallback(() => {
    revealControlsTemporarily();
    setAspectMode((prev) =>
      prev === 'contain' ? 'cover' : prev === 'cover' ? 'fill' : 'contain'
    );
  }, [revealControlsTemporarily]);

  const handleTogglePiP = useCallback(async () => {
    const video = videoRef.current as any;
    if (!video || !document.pictureInPictureEnabled) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (typeof video.requestPictureInPicture === 'function') {
        await video.requestPictureInPicture();
      }
    } catch {
      // Ignore PiP errors on unsupported TV WebViews
    }
  }, []);

  const handleTogglePin = () => {
    const result = toggleFavoriteChannel(resolvedChannelId);
    setIsPinned(result.added);
    if (result.limitReached) {
      setPinFeedback(
        `Max ${MAX_FAVORITE_CHANNELS} pinned channels reached — unpin one first.`
      );
    } else {
      setPinFeedback(
        result.added
          ? `⭐ Pinned "${title}" to your Live TV Favorites!`
          : `Removed "${title}" from Pinned Favorites.`
      );
    }
    window.setTimeout(() => setPinFeedback(null), 3000);
  };

  // TV Remote & Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      if (e.key === ' ') {
        e.preventDefault();
        togglePlayPause();
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        toggleMute();
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        setRetryNonce((n) => n + 1);
      } else if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        cycleAspectMode();
      } else if (e.key === 'PageUp' && nextChannel) {
        e.preventDefault();
        surfToChannel(nextChannel);
      } else if (e.key === 'PageDown' && prevChannel) {
        e.preventDefault();
        surfToChannel(prevChannel);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    togglePlayPause,
    toggleMute,
    toggleFullscreen,
    cycleAspectMode,
    nextChannel,
    prevChannel,
    surfToChannel,
  ]);

  const destroyHls = useCallback(() => {
    if (hlsRef.current) {
      try {
        hlsRef.current.stopLoad();
        hlsRef.current.detachMedia();
        hlsRef.current.destroy();
      } catch {
        // Ignore teardown errors
      }
      hlsRef.current = null;
    }
  }, []);

  /**
   * Honors the user's Preferred Stream Resolution from settings.ts
   * while still protecting 1-2GB sticks from 4K MSE buffer exhaustion.
   */
  const pickPreferredQualityIndex = useCallback(
    (levels: QualityLevel[]) => {
      if (!levels.length || preferredQuality === 'auto') return -1;

      const targetHeight =
        preferredQuality === '1080p'
          ? 1080
          : preferredQuality === '720p'
            ? 720
            : 480;

      const order =
        targetHeight === 1080
          ? [1080, 720, 480, 360]
          : targetHeight === 720
            ? [720, 480, 1080, 360]
            : [480, 360, 720, 1080];

      for (const target of order) {
        const match = levels.find(
          (level) =>
            level.height === target ||
            (level.label && level.label.replace(/\D+/g, '') === String(target))
        );
        if (match) return match.index;
      }
      return -1;
    },
    [preferredQuality]
  );

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !streamUrl) {
      setStreamStatus('offline');
      return;
    }

    let cancelled = false;
    let timeoutId: number | null = null;
    let mediaRecoveryAttempts = 0;

    setStreamStatus('checking');
    setQualityLevels([]);
    setSelectedQuality(-1);
    destroyHls();
    video.pause();
    video.removeAttribute('src');
    video.load();

    const onPlaying = () => {
      if (!cancelled) {
        setStreamStatus('live');
        setIsPlaying(true);
      }
    };
    const onPause = () => {
      if (!cancelled) setIsPlaying(false);
    };
    const onError = () => {
      if (!cancelled && !hlsRef.current) {
        setStreamStatus('offline');
      }
    };
    const onStalled = () => {
      if (
        video.networkState === HTMLVideoElement.NETWORK_NO_SOURCE &&
        !cancelled
      ) {
        setStreamStatus('offline');
      }
    };

    video.addEventListener('playing', onPlaying);
    video.addEventListener('pause', onPause);
    video.addEventListener('error', onError);
    video.addEventListener('stalled', onStalled);

    timeoutId = window.setTimeout(() => {
      if (!cancelled && video.paused && video.readyState < 2) {
        setStreamStatus('offline');
      }
    }, 10000);

    const startPlayback = () => {
      if (cancelled) return;

      const HlsClass = (window as any).Hls;
      const limits = getHardwareLimits();

      if (HlsClass && HlsClass.isSupported() && streamUrl.includes('.m3u8')) {
        const hlsInstance = new HlsClass({
          enableWorker: true,
          lowLatencyMode: false,
          liveSyncDurationCount: 3,
          liveMaxLatencyDurationCount: 5,
          maxBufferLength: limits.hlsMaxBufferLengthSec,
          maxMaxBufferLength: limits.hlsMaxBufferLengthSec * 2,
          backBufferLength: limits.hlsBackBufferLengthSec,
          maxBufferSize: limits.hlsMaxBufferSizeBytes,
          capLevelToPlayerSize: true,
          startLevel: -1,
        });

        hlsRef.current = hlsInstance;
        hlsInstance.loadSource(streamUrl);
        hlsInstance.attachMedia(video);

        hlsInstance.on(HlsClass.Events.MANIFEST_PARSED, () => {
          if (cancelled) return;

          const levels: QualityLevel[] = hlsInstance.levels.map(
            (lvl: any, idx: number) => {
              let label = 'Auto';
              if (lvl.height) {
                if (lvl.height >= 2160) label = '4K UHD';
                else if (lvl.height >= 1080) label = '1080p HD';
                else if (lvl.height >= 720) label = '720p HD';
                else if (lvl.height >= 480) label = '480p';
                else if (lvl.height >= 360) label = '360p';
                else label = `${lvl.height}p`;
              } else if (lvl.bitrate) {
                label = `${Math.round(lvl.bitrate / 1000)} kbps`;
              }

              return { index: idx, label, height: lvl.height ?? 0 };
            }
          );

          setQualityLevels(levels);

          const preferredIndex = pickPreferredQualityIndex(levels);
          if (preferredIndex >= 0) {
            setSelectedQuality(preferredIndex);
            hlsInstance.currentLevel = preferredIndex;
          } else {
            setSelectedQuality(-1);
            hlsInstance.currentLevel = -1;
          }

          video
            .play()
            .then(() => {
              if (!cancelled) {
                setStreamStatus('live');
                setIsPlaying(true);
              }
            })
            .catch(() => {
              if (!cancelled) {
                setIsPlaying(false);
                setShowControls(true);
              }
            });
        });

        hlsInstance.on(HlsClass.Events.ERROR, (_event: any, data: any) => {
          if (!data.fatal || cancelled) return;

          if (data.type === HlsClass.ErrorTypes.NETWORK_ERROR) {
            hlsInstance.startLoad();
          } else if (
            data.type === HlsClass.ErrorTypes.MEDIA_ERROR &&
            mediaRecoveryAttempts < 2
          ) {
            mediaRecoveryAttempts++;
            hlsInstance.recoverMediaError();
          } else {
            setStreamStatus('offline');
            destroyHls();
          }
        });
        return;
      }

      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = streamUrl;
        video
          .play()
          .then(() => {
            if (!cancelled) {
              setStreamStatus('live');
              setIsPlaying(true);
            }
          })
          .catch(() => !cancelled && setStreamStatus('offline'));
        return;
      }

      setStreamStatus('offline');
    };

    if (streamUrl.includes('.m3u8')) {
      if ((window as any).Hls) {
        startPlayback();
      } else {
        const existing = document.querySelector(
          'script[data-hls-js]'
        ) as HTMLScriptElement | null;
        if (existing) {
          if ((window as any).Hls) {
            startPlayback();
          } else {
            existing.addEventListener('load', startPlayback, { once: true });
          }
        } else {
          const script = document.createElement('script');
          script.src =
            'https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js';
          script.async = true;
          script.dataset.hlsJs = 'true';
          script.onload = startPlayback;
          script.onerror = () => !cancelled && setStreamStatus('offline');
          document.head.appendChild(script);
        }
      }
    } else {
      video.src = streamUrl;
      video
        .play()
        .then(() => {
          if (!cancelled) {
            setStreamStatus('live');
            setIsPlaying(true);
          }
        })
        .catch(() => !cancelled && setStreamStatus('offline'));
    }

    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('error', onError);
      video.removeEventListener('stalled', onStalled);
      destroyHls();
      video.pause();
      video.removeAttribute('src');
      video.load();
    };
  }, [streamUrl, retryNonce, destroyHls, pickPreferredQualityIndex]);

  const handleQualityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const levelIndex = Number(e.target.value);
    setSelectedQuality(levelIndex);
    if (hlsRef.current) {
      hlsRef.current.currentLevel = levelIndex;
    }
  };

  const handleResyncStream = () => {
    setRetryNonce((n) => n + 1);
  };

  const themeStyles = useMemo(
    () => getLivePlayerThemeTokens(appTheme),
    [appTheme]
  );

  const qualityLabel =
    qualityLevels.find((level) => level.index === selectedQuality)?.label ??
    (selectedQuality === -1 ? 'Auto HD' : 'Auto');

  const aspectLabel =
    aspectMode === 'contain' ? 'Fit' : aspectMode === 'cover' ? 'Fill' : 'Stretch';

  const videoFitClass =
    aspectMode === 'cover'
      ? 'object-cover'
      : aspectMode === 'fill'
        ? 'object-fill'
        : 'object-contain';

  const channelDescription = useMemo(
    () =>
      getChannelDescription(title || 'Live Channel') ||
      'Live broadcast feed streaming in real time.',
    [title]
  );

  const hudBtnSize = largeButtons ? 'h-11 w-11' : 'h-9 w-9 sm:h-10 sm:w-10';
  const canUsePiP =
    typeof document !== 'undefined' &&
    Boolean((document as any).pictureInPictureEnabled);

  /**
   * Reusable control bar:
   * - On portrait / compact mobile (non-fullscreen), docked cleanly BELOW the video frame
   *   so controls NEVER cover the video, channel logo, or "Tuning Live Broadcast" overlay.
   * - In fullscreen or on wide screens (lg+), floats cleanly along the bottom of the video
   *   as a slim, single-row bar that auto-fades out while watching.
   */
  const renderControlsBar = (isFloatingOverlay: boolean) => (
    <div
      data-tour="player-controls"
      className={`flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-2.5 sm:px-4 py-2 ${
        isLowRam ? '' : 'backdrop-blur-2xl'
      } ${themeStyles.hudDock}`}
    >
      {/* Left Controls: Prev / Play-Pause / Next + Quality */}
      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
        {prevChannel && (
          <button
            type="button"
            onClick={() => surfToChannel(prevChannel)}
            className={`flex ${hudBtnSize} shrink-0 items-center justify-center rounded-xl border text-xs font-black transition cursor-pointer focus:outline-none focus:ring-2 ${themeStyles.hudBtn} ${themeStyles.focusRing}`}
            title={`Previous Channel: ${prevChannel.title}`}
            aria-label="Previous Channel"
          >
            ⏮
          </button>
        )}

        <button
          type="button"
          data-tour="player-play-pause"
          onClick={togglePlayPause}
          className={`flex ${hudBtnSize} shrink-0 items-center justify-center rounded-xl transition transform active:scale-95 cursor-pointer focus:outline-none focus:ring-2 ${themeStyles.primaryBtn} ${themeStyles.focusRing}`}
          title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 sm:w-5 sm:h-5">
              <rect x="6" y="5" width="4" height="14" rx="1.2" />
              <rect x="14" y="5" width="4" height="14" rx="1.2" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 sm:w-5 sm:h-5 ml-0.5">
              <path d="M6 4.75a1.25 1.25 0 0 1 1.9-.1l11.25 7.25a1.25 1.25 0 0 1 0 2.1L7.9 21.25A1.25 1.25 0 0 1 6 20.2V4.75Z" />
            </svg>
          )}
        </button>

        {nextChannel && (
          <button
            type="button"
            onClick={() => surfToChannel(nextChannel)}
            className={`flex ${hudBtnSize} shrink-0 items-center justify-center rounded-xl border text-xs font-black transition cursor-pointer focus:outline-none focus:ring-2 ${themeStyles.hudBtn} ${themeStyles.focusRing}`}
            title={`Next Channel: ${nextChannel.title}`}
            aria-label="Next Channel"
          >
            ⏭
          </button>
        )}

        {/* Quality Selector Pill */}
        {qualityLevels.length > 0 && (
          <div
            data-tour="player-quality"
            className={`flex items-center gap-1 rounded-xl border px-2 py-1.5 sm:px-2.5 sm:py-2 transition min-w-0 ${themeStyles.hudSelectBox}`}
          >
            <span
              className={`hidden md:inline text-[10px] font-extrabold uppercase tracking-widest ${themeStyles.subMutedText}`}
            >
              HD:
            </span>
            <select
              value={selectedQuality}
              onChange={handleQualityChange}
              aria-label="Stream Quality"
              className="bg-transparent text-[11px] sm:text-xs font-extrabold text-white focus:outline-none cursor-pointer max-w-[115px] sm:max-w-none"
            >
              <option value={-1} className={themeStyles.optionBg}>
                Auto ({qualityLabel})
              </option>
              {qualityLevels.map((lvl) => (
                <option
                  key={lvl.index}
                  value={lvl.index}
                  className={themeStyles.optionBg}
                >
                  {lvl.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Right Controls: Aspect Ratio + Volume + PiP + Fullscreen + Optional Hide HUD */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        <button
          type="button"
          onClick={cycleAspectMode}
          className={`inline-flex items-center gap-1 rounded-xl border px-2 py-1.5 sm:px-2.5 sm:py-2 text-[10px] font-extrabold uppercase tracking-wider transition cursor-pointer focus:outline-none focus:ring-2 ${themeStyles.hudBtn} ${themeStyles.focusRing}`}
          title="Cycle Aspect Ratio: Fit / Fill / Stretch (A)"
        >
          <span>⛶ {aspectLabel}</span>
        </button>

        {/* Volume Control Group */}
        <div
          data-tour="player-volume"
          className={`relative flex items-center gap-1.5 rounded-xl border px-1.5 sm:px-2 py-1 ${themeStyles.hudSelectBox}`}
          onMouseEnter={() => setShowVolumeSlider(true)}
          onMouseLeave={() => setShowVolumeSlider(false)}
        >
          <button
            type="button"
            onClick={toggleMute}
            className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-white/10 transition cursor-pointer focus:outline-none"
            title={isMuted || volume === 0 ? 'Unmute (M)' : 'Mute (M)'}
            aria-label="Toggle Mute"
          >
            {isMuted || volume === 0 ? (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-4 h-4 text-red-400"
              >
                <path d="M11 5 6 9H2v6h4l5 4V5Z" />
                <line x1="22" y1="9" x2="16" y2="15" />
                <line x1="16" y1="9" x2="22" y2="15" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`w-4 h-4 ${themeStyles.hudAccentIcon}`}
              >
                <path d="M11 5 6 9H2v6h4l5 4V5Z" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                {volume > 0.5 && (
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                )}
              </svg>
            )}
          </button>

          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={isMuted ? 0 : volume}
            onChange={(e) => {
              const newVol = parseFloat(e.target.value);
              setVolume(newVol);
              setIsMuted(newVol === 0);
              if (newVol > 0) setPreviousVolume(newVol);
            }}
            className={`w-16 sm:w-24 h-1.5 rounded-lg appearance-none cursor-pointer transition-all ${
              themeStyles.sliderTrack
            } ${showVolumeSlider ? 'inline-block' : 'hidden sm:inline-block'}`}
            aria-label="Volume"
          />
        </div>

        {/* Picture-in-Picture Button */}
        {canUsePiP && (
          <button
            type="button"
            onClick={() => void handleTogglePiP()}
            className={`hidden md:flex ${hudBtnSize} shrink-0 items-center justify-center rounded-xl border text-xs font-bold transition cursor-pointer focus:outline-none focus:ring-2 ${themeStyles.hudBtn} ${themeStyles.focusRing}`}
            title="Picture-in-Picture"
            aria-label="Picture-in-Picture"
          >
            ⧉
          </button>
        )}

        {/* Fullscreen Vector Button */}
        <button
          type="button"
          data-tour="player-fullscreen"
          onClick={toggleFullscreen}
          className={`flex ${hudBtnSize} shrink-0 items-center justify-center rounded-xl border transition cursor-pointer focus:outline-none focus:ring-2 ${themeStyles.hudBtn} ${themeStyles.focusRing}`}
          title={isFullscreen ? 'Exit Fullscreen (F)' : 'Enter Fullscreen (F)'}
          aria-label="Fullscreen Toggle"
        >
          {isFullscreen ? (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-4 h-4"
            >
              <path d="M8 3v3a2 2 0 0 1-2 2H3" />
              <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
              <path d="M3 16h3a2 2 0 0 1 2 2v3" />
              <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
            </svg>
          ) : (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-4 h-4"
            >
              <path d="M15 3h6v6" />
              <path d="M9 21H3v-6" />
              <path d="M21 3l-7 7" />
              <path d="M3 21l7-7" />
            </svg>
          )}
        </button>

        {/* Hide Floating HUD Button (shown only when floating over video) */}
        {isFloatingOverlay && (
          <button
            type="button"
            onClick={() => {
              if (document.fullscreenElement) {
                document.exitFullscreen().catch(() => {});
              }
              setShowControls(false);
            }}
            className={`flex ${hudBtnSize} shrink-0 items-center justify-center rounded-xl border transition cursor-pointer focus:outline-none focus:ring-2 ${themeStyles.hudBtn} ${themeStyles.focusRing}`}
            title="Hide Controls"
            aria-label="Hide Controls"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-4 h-4"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div
      className={`min-h-screen ${themeStyles.bg} ${themeStyles.baseText} transition-colors duration-300 pb-16 py-3 sm:py-6 px-2.5 sm:px-6 md:px-10 w-full max-w-full overflow-x-clip box-border relative rounded-3xl`}
    >
      {/* Hide Android WebView's giant ugly default play overlay graphic */}
      <style>{`
        video::-webkit-media-controls {
          display: none !important;
        }
        video::-webkit-media-controls-start-playback-button {
          display: none !important;
          -webkit-appearance: none !important;
        }
      `}</style>

      <AppWallpaper />
      {!isLowRam && !reducedMotion && !glowOff && (
        <div
          className={`absolute inset-x-0 -top-10 h-[28rem] bg-gradient-to-b ${themeStyles.ambient} blur-3xl z-0 pointer-events-none rounded-t-3xl`}
        />
      )}

      <div className="w-full max-w-6xl mx-auto space-y-4 sm:space-y-5 box-border relative z-10">
        {/* Top Navigation Row: Theme-Matched Capsules + Channel Surfing + Pin Favorite */}
        <div className="w-full flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/live-tv"
              className={`group inline-flex items-center gap-2 rounded-full backdrop-blur-xl pl-3 pr-2 ${
                largeButtons ? 'py-2.5' : 'py-1.5'
              } border shadow-[0_4px_20px_rgba(0,0,0,0.6)] transition-all duration-300 active:scale-95 focus:outline-none focus:ring-2 ${
                themeStyles.backCapsule
              } ${themeStyles.focusRing}`}
            >
              <span className="opacity-70 group-hover:opacity-100 group-hover:-translate-x-0.5 transition-all text-xs font-bold">
                ‹
              </span>
              <span className="text-xs sm:text-sm font-semibold tracking-wide">
                Live TV Guide
              </span>
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full border text-[11px] ${themeStyles.backBadge}`}
              >
                📡
              </span>
            </Link>

            <Link
              to="/"
              className={`inline-flex items-center gap-1.5 rounded-full backdrop-blur-xl px-3.5 ${
                largeButtons ? 'py-2.5 text-sm' : 'py-1.5 text-xs'
              } border font-semibold transition focus:outline-none focus:ring-2 ${
                themeStyles.btnSecondary
              } ${themeStyles.focusRing}`}
            >
              <span>⌂ Home</span>
            </Link>
          </div>

          {/* Right Live Telemetry & Quick Channel Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-tour="channel-pin"
              onClick={handleTogglePin}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 ${
                largeButtons ? 'py-2 text-sm' : 'py-1.5 text-xs'
              } font-extrabold shadow transition cursor-pointer focus:outline-none focus:ring-2 ${
                isPinned ? themeStyles.btnPinned : themeStyles.btnSecondary
              } ${themeStyles.focusRing}`}
              title={isPinned ? 'Unpin from Favorites' : 'Pin to Live TV Favorites'}
            >
              <span>{isPinned ? '★ Pinned' : '☆ Pin'}</span>
            </button>

            <button
              type="button"
              onClick={handleResyncStream}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 ${
                largeButtons ? 'py-2 text-sm' : 'py-1.5 text-xs'
              } font-bold shadow transition cursor-pointer focus:outline-none focus:ring-2 ${
                themeStyles.btnSecondary
              } ${themeStyles.focusRing}`}
              title="Reload & Resync Live Stream (R)"
            >
              <span>↻ Resync</span>
            </button>

            {/* Semantic Broadcast Signal Status Pill */}
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-xl border shadow-lg ${themeStyles.subtleBadge}`}
            >
              {streamStatus === 'live' ? (
                <>
                  <span className="inline-block w-2 h-2 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_10px_rgba(52,211,153,0.95)]" />
                  <span className="text-[11px] sm:text-xs font-extrabold text-emerald-300 tracking-wider uppercase">
                    On Air • {qualityLabel}
                  </span>
                </>
              ) : streamStatus === 'offline' ? (
                <>
                  <span className="inline-block w-2 h-2 bg-red-500 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.9)]" />
                  <span className="text-[11px] sm:text-xs font-extrabold text-red-400 tracking-wider uppercase">
                    Off-Air
                  </span>
                </>
              ) : (
                <>
                  <span className="inline-block w-2 h-2 bg-amber-400 rounded-full animate-ping" />
                  <span className="text-[11px] sm:text-xs font-extrabold text-amber-300 tracking-wider uppercase">
                    Connecting…
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Pin Feedback Banner */}
        {pinFeedback && (
          <div
            className={`rounded-2xl border px-4 py-2 text-center text-xs font-extrabold shadow-lg ${themeStyles.feedbackBanner}`}
          >
            {pinFeedback}
          </div>
        )}

        {/* Theater-Grade Live Video Player Stage + Non-Overlapping Mobile Controls Dock */}
        <div className="w-full space-y-2.5">
          <div
            ref={playerContainerRef}
            data-tour="video-player"
            onMouseMove={revealControlsTemporarily}
            onTouchStart={revealControlsTemporarily}
            className={`w-full relative flex items-center justify-center rounded-2xl sm:rounded-3xl overflow-hidden bg-black border aspect-video max-h-[75dvh] box-border group select-none ${
              themeStyles.playerFrame
            } ${glowOff ? 'shadow-2xl' : themeStyles.playerGlow}`}
          >
            {streamUrl ? (
              <video
                ref={videoRef}
                poster={TRANSPARENT_POSTER}
                autoPlay
                playsInline
                controls={false}
                onClick={togglePlayPause}
                className={`w-full h-full ${videoFitClass} bg-black cursor-pointer`}
              />
            ) : (
              <div
                className={`text-center p-6 rounded-2xl border ${themeStyles.surfacePanel}`}
              >
                <p className={`text-xs sm:text-sm font-bold ${themeStyles.mutedText}`}>
                  Invalid or missing stream URL.
                </p>
              </div>
            )}

            {/* Top HUD Overlay: Hidden during Connecting/Offline so it never collides with center splash */}
            {streamStatus === 'live' && (
              <div
                className={`absolute inset-x-2.5 sm:inset-x-3.5 top-2.5 sm:top-3.5 z-20 flex items-center justify-between gap-2 pointer-events-none transition-opacity duration-300 ${
                  showControls ? 'opacity-100' : 'opacity-0'
                }`}
              >
                <div
                  className={`flex items-center gap-2 rounded-xl sm:rounded-2xl backdrop-blur-xl border px-2.5 py-1 sm:px-3 sm:py-1.5 shadow-xl min-w-0 ${themeStyles.hudDock}`}
                >
                  {logo && (
                    <img
                      src={logo}
                      alt=""
                      className="h-5 sm:h-6 w-auto max-w-[60px] object-contain drop-shadow shrink-0"
                    />
                  )}
                  <span className="text-[11px] sm:text-xs font-extrabold text-white tracking-wide truncate max-w-[140px] sm:max-w-xs">
                    {title}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {sleepTimerMin > 0 && (
                    <span
                      className={`rounded-xl border px-2 py-1 text-[10px] font-extrabold shadow ${themeStyles.badge}`}
                    >
                      🌙 {sleepTimerMin}m
                    </span>
                  )}
                  <span
                    className={`rounded-xl border px-2.5 py-1 text-[10px] sm:text-[11px] font-extrabold shadow ${themeStyles.subtleBadge}`}
                  >
                    🕒 {hudClock}
                  </span>
                </div>
              </div>
            )}

            {/* Connecting / Buffering Shimmer Overlay (100% Unobstructed Center) */}
            {streamStatus === 'checking' && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm pointer-events-none gap-2.5 p-4 text-center">
                {logo && (
                  <img
                    src={logo}
                    alt={title}
                    className="h-10 sm:h-16 w-auto max-w-[140px] object-contain opacity-95 drop-shadow-[0_4px_20px_rgba(255,255,255,0.18)]"
                  />
                )}
                <div
                  className={`h-8 w-8 sm:h-9 sm:w-9 rounded-full border-2 border-t-transparent animate-spin ${themeStyles.accentText}`}
                />
                <span className={`text-[11px] sm:text-xs font-extrabold tracking-widest uppercase ${themeStyles.mutedText}`}>
                  Tuning Live Broadcast…
                </span>
              </div>
            )}

            {/* Floating Bottom HUD: Shown ONLY in Fullscreen or on Large Screens (lg+) */}
            <div
              className={`${
                isFullscreen ? 'block' : 'hidden lg:block'
              } absolute inset-x-0 bottom-0 z-20 pt-10 pb-3 px-3 sm:px-5 bg-gradient-to-t from-black/95 via-black/65 to-transparent transition-opacity duration-300 ${
                showControls
                  ? 'opacity-100 pointer-events-auto'
                  : 'opacity-0 pointer-events-none'
              }`}
            >
              {renderControlsBar(true)}
            </div>

            {/* Offline / Recovery Overlay */}
            {streamStatus === 'offline' && (
              <div className="absolute inset-0 bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-4 sm:p-6 text-center z-30 overflow-y-auto">
                <div
                  className={`mb-2 sm:mb-3 flex h-11 w-11 sm:h-14 sm:w-14 items-center justify-center rounded-2xl border text-xl sm:text-2xl ${themeStyles.badge}`}
                >
                  📡
                </div>
                <p className="text-sm sm:text-lg font-black text-white">
                  Broadcast Feed Unavailable
                </p>
                <p
                  className={`mt-1 text-[11px] sm:text-xs max-w-sm leading-relaxed ${themeStyles.subMutedText}`}
                >
                  This live stream timed out, is temporarily off-air, or requires a
                  stream resync.
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
                  <button
                    type="button"
                    onClick={handleResyncStream}
                    className={`rounded-xl px-4 py-2 text-xs font-extrabold tracking-wide transition cursor-pointer ${themeStyles.primaryBtn}`}
                  >
                    ↻ Retry Stream
                  </button>
                  {nextChannel && (
                    <button
                      type="button"
                      onClick={() => surfToChannel(nextChannel)}
                      className={`rounded-xl border px-4 py-2 text-xs font-bold transition cursor-pointer ${themeStyles.btnSecondary}`}
                    >
                      ⏭ Next Channel
                    </button>
                  )}
                  <Link
                    to="/live-tv"
                    className={`rounded-xl border px-4 py-2 text-xs font-bold transition ${themeStyles.btnSecondary}`}
                  >
                    Live TV Guide
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Dedicated Below-Video Control Dock on Phones & Tablets (< lg, non-fullscreen) */}
          {!isFullscreen && (
            <div className="lg:hidden w-full">
              {renderControlsBar(false)}
            </div>
          )}
        </div>

        {/* Unified Cinema Broadcast Deck */}
        <div
          className={`relative overflow-hidden w-full rounded-3xl border ${
            isLowRam ? '' : 'backdrop-blur-2xl'
          } p-4 sm:p-7 flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-5 text-center sm:text-left ${
            themeStyles.surfacePanel
          }`}
        >
          <div
            className={`relative w-28 h-20 sm:w-40 sm:h-28 shrink-0 rounded-2xl border flex items-center justify-center p-3 shadow-inner overflow-hidden ${themeStyles.logoStage}`}
          >
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  'radial-gradient(circle at center, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.03) 50%, transparent 75%)',
              }}
            />
            {logo ? (
              <img
                src={logo}
                alt={title}
                className="relative z-10 max-h-full max-w-full object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.85)]"
              />
            ) : (
              <span className="relative z-10 text-sm sm:text-base font-black text-white uppercase tracking-wider">
                {title}
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0 space-y-2.5 w-full">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <span
                className={`rounded-full border px-3 py-0.5 text-[10px] font-extrabold uppercase tracking-widest ${
                  streamStatus === 'offline'
                    ? 'bg-red-950/75 border-red-500/45 text-red-300'
                    : 'bg-emerald-950/75 border-emerald-400/45 text-emerald-300'
                }`}
              >
                {streamStatus === 'offline'
                  ? '○ Off-Air / Standby'
                  : '● Live Broadcast'}
              </span>
              <span
                className={`rounded-full border px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider ${themeStyles.badge}`}
              >
                {streamStatus === 'offline'
                  ? 'Feed Unavailable'
                  : `Quality: ${qualityLabel}`}
              </span>
              <span
                className={`rounded-full border px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider ${themeStyles.subtleBadge}`}
              >
                {isLowRam ? '📟 15MB Stick Cap' : '🚀 35MB High RAM'}
              </span>
            </div>

            <h1 className="text-xl sm:text-3xl font-black tracking-tight text-white truncate">
              {title || 'Live Channel'}
            </h1>

            <p
              className={`text-xs sm:text-sm max-w-3xl leading-relaxed ${themeStyles.mutedText}`}
            >
              {channelDescription}
            </p>
          </div>

          {!glowOff && (
            <div
              className={`absolute inset-x-6 bottom-0 h-[2px] bg-gradient-to-r ${themeStyles.laserLine} opacity-85`}
            />
          )}
        </div>

        {/* More Live Channels Section */}
        <div className="w-full pt-2 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className={`w-1.5 h-6 rounded-full shrink-0 ${themeStyles.accentBar}`}
              />
              <h2 className="text-base sm:text-xl font-black tracking-tight text-white">
                More Live Channels
              </h2>
            </div>

            <button
              type="button"
              onClick={() => navigate({ to: '/live-tv' })}
              className={`rounded-full border px-4 py-1.5 text-xs font-bold transition cursor-pointer shrink-0 focus:outline-none focus:ring-2 ${themeStyles.btnSecondary} ${themeStyles.focusRing}`}
            >
              Browse All Channels →
            </button>
          </div>

          {loadingSuggestions ? (
            <div
              className={`flex items-center justify-center rounded-3xl border py-10 text-xs font-bold ${themeStyles.surfacePanel} ${themeStyles.subMutedText}`}
            >
              Loading live channels…
            </div>
          ) : suggestedChannels.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
              {suggestedChannels.map((channel) => {
                const targetUrl = channel.streamUrl || channel.url;
                return (
                  <Link
                    key={channel.channelId || targetUrl || channel.title}
                    to="/live-player"
                    search={{
                      url: targetUrl,
                      title: channel.title,
                      logo: channel.logo || '',
                      channelId: channel.channelId || '',
                    }}
                    className={`group relative flex flex-col justify-between rounded-3xl border ${themeStyles.surfaceCard} ${themeStyles.borderHover} ${
                      isLowRam ? '' : 'backdrop-blur-xl'
                    } p-3 sm:p-3.5 transition-all duration-300 hover:-translate-y-1.5 overflow-hidden text-center focus:outline-none focus:ring-2 ${
                      themeStyles.focusRing
                    }`}
                  >
                    <div
                      className={`relative w-full h-20 sm:h-28 rounded-2xl border mb-2.5 p-2.5 sm:p-3 flex items-center justify-center overflow-hidden ${themeStyles.logoStage}`}
                    >
                      <div
                        className="absolute inset-0 pointer-events-none"
                        style={{
                          background:
                            'radial-gradient(circle at center, rgba(255,255,255,0.14) 0%, transparent 72%)',
                        }}
                      />
                      {channel.logo ? (
                        <img
                          src={channel.logo}
                          alt={channel.title}
                          className="relative z-10 max-h-full max-w-full object-contain group-hover:scale-110 transition-transform duration-300 drop-shadow"
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <span
                          className={`relative z-10 text-xs font-black ${themeStyles.accentText}`}
                        >
                          LIVE
                        </span>
                      )}
                    </div>

                    <div className="space-y-1">
                      <span className="block text-xs sm:text-sm font-black line-clamp-1 text-white">
                        {channel.title}
                      </span>
                      <p
                        className={`text-[10px] line-clamp-2 leading-snug min-h-[2rem] ${themeStyles.subMutedText}`}
                      >
                        {getChannelDescription(channel.title)}
                      </p>
                    </div>

                    <span
                      className={`mt-2.5 inline-flex w-full items-center justify-center gap-1 py-1.5 text-[10px] font-extrabold uppercase tracking-wider rounded-xl border transition ${themeStyles.btnSecondary}`}
                    >
                      <span>▶ Watch Live</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div
              className={`rounded-3xl border p-8 text-center ${themeStyles.surfacePanel}`}
            >
              <p className={`text-xs font-bold ${themeStyles.mutedText}`}>
                No additional channels are available right now.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default LivePlayerComponent;