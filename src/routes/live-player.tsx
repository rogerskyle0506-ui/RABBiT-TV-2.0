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
import { LiveMiniGuide, type MiniGuideMode } from '@/components/LiveMiniGuide';

function isSafeHttpUrl(raw: string): boolean {
  if (!raw) return false;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

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

  // Slide-Over Mini-Guide & Split-Screen Sports Mode state
  const [miniGuideOpen, setMiniGuideOpen] = useState(false);
  const [miniGuideMode, setMiniGuideMode] = useState<MiniGuideMode>('tune');
  const [splitChannel, setSplitChannel] = useState<LiveChannel | null>(null);
  const [splitStatus, setSplitStatus] = useState<StreamStatus>('checking');
  const [activeAudioPane, setActiveAudioPane] = useState<'primary' | 'secondary'>('primary');

  const videoRef = useRef<HTMLVideoElement>(null);
  const secondaryVideoRef = useRef<HTMLVideoElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<any>(null);
  const secondaryHlsRef = useRef<any>(null);
  const controlsTimeoutRef = useRef<number | null>(null);

  const safePrimaryUrl = useMemo(
    () => (isSafeHttpUrl(streamUrl) ? streamUrl : ''),
    [streamUrl]
  );
  const splitStreamUrl = useMemo(() => {
    const raw = (splitChannel?.streamUrl || splitChannel?.url || '').trim();
    return isSafeHttpUrl(raw) ? raw : '';
  }, [splitChannel]);
  const isSplitActive = Boolean(splitChannel && splitStreamUrl && !isLowRam);

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

  // Auto-disable Split-Screen if 1-2GB Low RAM mode is turned on
  useEffect(() => {
    if (isLowRam && splitChannel) {
      setSplitChannel(null);
      setActiveAudioPane('primary');
    }
  }, [isLowRam, splitChannel]);

  // Route active audio cleanly between Screen 1 and Screen 2 in Split-Screen Mode
  useEffect(() => {
    const primaryVol =
      isMuted || (isSplitActive && activeAudioPane !== 'primary') ? 0 : volume;
    const secondaryVol =
      isMuted || !isSplitActive || activeAudioPane !== 'secondary' ? 0 : volume;

    if (videoRef.current) {
      videoRef.current.volume = primaryVol;
      videoRef.current.muted = primaryVol === 0;
    }
    if (secondaryVideoRef.current) {
      secondaryVideoRef.current.volume = secondaryVol;
      secondaryVideoRef.current.muted = secondaryVol === 0;
    }
  }, [volume, isMuted, isSplitActive, activeAudioPane]);

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
      } else if (e.key === 'g' || e.key === 'G') {
        e.preventDefault();
        setMiniGuideMode('tune');
        setMiniGuideOpen((prev) => !prev);
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

  const destroySecondaryHls = useCallback(() => {
    if (secondaryHlsRef.current) {
      try {
        secondaryHlsRef.current.stopLoad();
        secondaryHlsRef.current.detachMedia();
        secondaryHlsRef.current.destroy();
      } catch {
        // Ignore teardown errors
      }
      secondaryHlsRef.current = null;
    }
  }, []);

  // Secondary Split-Screen HLS Lifecycle (Capped buffers + instant cleanup on close)
  useEffect(() => {
    const video = secondaryVideoRef.current;
    if (!isSplitActive || !video || !splitStreamUrl) {
      destroySecondaryHls();
      return;
    }

    let cancelled = false;
    let timeoutId: number | null = null;
    let recoveryAttempts = 0;

    setSplitStatus('checking');
    destroySecondaryHls();
    video.pause();
    video.removeAttribute('src');
    video.load();

    const onPlaying = () => {
      if (!cancelled) setSplitStatus('live');
    };
    const onError = () => {
      if (!cancelled && !secondaryHlsRef.current) setSplitStatus('offline');
    };

    video.addEventListener('playing', onPlaying);
    video.addEventListener('error', onError);

    timeoutId = window.setTimeout(() => {
      if (!cancelled && video.paused && video.readyState < 2) {
        setSplitStatus('offline');
      }
    }, 10000);

    const startSecondary = () => {
      if (cancelled) return;
      const HlsClass = (window as any).Hls;
      const limits = getHardwareLimits();

      if (HlsClass && HlsClass.isSupported() && splitStreamUrl.includes('.m3u8')) {
        const hls2 = new HlsClass({
          enableWorker: true,
          lowLatencyMode: false,
          liveSyncDurationCount: 3,
          liveMaxLatencyDurationCount: 5,
          maxBufferLength: Math.min(12, limits.hlsMaxBufferLengthSec),
          maxMaxBufferLength: Math.min(20, limits.hlsMaxBufferLengthSec * 2),
          backBufferLength: 6,
          maxBufferSize: Math.min(18 * 1024 * 1024, limits.hlsMaxBufferSizeBytes),
          capLevelToPlayerSize: true,
          startLevel: -1,
        });

        secondaryHlsRef.current = hls2;
        hls2.loadSource(splitStreamUrl);
        hls2.attachMedia(video);

        hls2.on(HlsClass.Events.MANIFEST_PARSED, () => {
          if (cancelled) return;
          video
            .play()
            .then(() => {
              if (!cancelled) setSplitStatus('live');
            })
            .catch(() => {});
        });

        hls2.on(HlsClass.Events.ERROR, (_ev: any, data: any) => {
          if (!data.fatal || cancelled) return;
          if (data.type === HlsClass.ErrorTypes.NETWORK_ERROR) {
            hls2.startLoad();
          } else if (
            data.type === HlsClass.ErrorTypes.MEDIA_ERROR &&
            recoveryAttempts < 2
          ) {
            recoveryAttempts++;
            hls2.recoverMediaError();
          } else {
            setSplitStatus('offline');
            destroySecondaryHls();
          }
        });
        return;
      }

      if (
        video.canPlayType('application/vnd.apple.mpegurl') ||
        !splitStreamUrl.includes('.m3u8')
      ) {
        video.src = splitStreamUrl;
        video
          .play()
          .then(() => !cancelled && setSplitStatus('live'))
          .catch(() => !cancelled && setSplitStatus('offline'));
        return;
      }

      setSplitStatus('offline');
    };

    if (splitStreamUrl.includes('.m3u8') && !(window as any).Hls) {
      const existing = document.querySelector(
        'script[data-hls-js]'
      ) as HTMLScriptElement | null;
      if (existing) {
        existing.addEventListener('load', startSecondary, { once: true });
      } else {
        const script = document.createElement('script');
        script.src =
          'https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js';
        script.async = true;
        script.dataset.hlsJs = 'true';
        script.onload = startSecondary;
        script.onerror = () => !cancelled && setSplitStatus('offline');
        document.head.appendChild(script);
      }
    } else {
      startSecondary();
    }

    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('error', onError);
      destroySecondaryHls();
      video.pause();
      video.removeAttribute('src');
      video.load();
    };
  }, [isSplitActive, splitStreamUrl, retryNonce, destroySecondaryHls]);

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
    if (!video || !safePrimaryUrl) {
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

  const openTuneMiniGuide = useCallback(() => {
    setMiniGuideMode('tune');
    setMiniGuideOpen(true);
  }, []);

  const openSplitMiniGuide = useCallback(() => {
    if (isLowRam) return;
    setMiniGuideMode('split');
    setMiniGuideOpen(true);
  }, [isLowRam]);

  const handleMiniGuideSelect = useCallback(
    (ch: LiveChannel) => {
      if (miniGuideMode === 'split') {
        setSplitChannel(ch);
        setActiveAudioPane('secondary');
        logLiveChannelWatch({
          title: ch.title || 'Live Channel',
          logo: ch.logo || '',
          streamUrl: ch.streamUrl || ch.url,
          channelId: ch.channelId || ch.streamUrl || ch.url,
        });
        return;
      }
      surfToChannel(ch);
    },
    [miniGuideMode, surfToChannel]
  );

  const handleCloseSplitScreen = useCallback(() => {
    destroySecondaryHls();
    setSplitChannel(null);
    setActiveAudioPane('primary');
  }, [destroySecondaryHls]);

  const handleSwapSplitScreens = useCallback(() => {
    if (!splitChannel) return;
    const oldPrimary: LiveChannel = {
      channelId: resolvedChannelId,
      title: title || 'Live Channel',
      logo: logo || '',
      url: streamUrl,
      streamUrl,
    };
    const nextPrimary = splitChannel;
    setSplitChannel(oldPrimary);
    setActiveAudioPane((prev) => (prev === 'primary' ? 'secondary' : 'primary'));
    surfToChannel(nextPrimary);
  }, [splitChannel, resolvedChannelId, title, logo, streamUrl, surfToChannel]);

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

  const hudBtnSize = largeButtons ? 'h-10 w-10 sm:h-11 sm:w-11' : 'h-8 w-8 sm:h-9 sm:w-9';
  const canUsePiP =
    typeof document !== 'undefined' &&
    Boolean((document as any).pictureInPictureEnabled);

  /**
   * Collision-proof cinema transport dock (works cleanly in portrait, portrait fullscreen,
   * landscape, tablet, desktop, and TV without any overlapping selects or clipped buttons).
   */
  const renderControlsBar = (isFloatingOverlay: boolean) => (
    <div
      data-tour="player-controls"
      className={`w-full max-w-full box-border overflow-hidden flex flex-wrap items-center justify-between gap-2 rounded-xl border px-2 sm:px-3.5 py-2 ${
        isLowRam ? '' : 'backdrop-blur-2xl'
      } ${themeStyles.hudDock}`}
    >
      {/* Left: Transport Controls (Prev / Play-Pause / Next) */}
      <div className="flex items-center gap-1.5 shrink-0">
        {prevChannel && (
          <button
            type="button"
            onClick={() => surfToChannel(prevChannel)}
            className={`flex ${hudBtnSize} shrink-0 items-center justify-center rounded-lg border transition cursor-pointer focus:outline-none focus:ring-2 ${themeStyles.hudBtn} ${themeStyles.focusRing}`}
            title={`Previous: ${prevChannel.title}`}
            aria-label="Previous Channel"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 sm:w-4 sm:h-4">
              <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
            </svg>
          </button>
        )}

        <button
          type="button"
          data-tour="player-play-pause"
          onClick={togglePlayPause}
          className={`flex ${hudBtnSize} shrink-0 items-center justify-center rounded-lg transition active:scale-95 cursor-pointer focus:outline-none focus:ring-2 ${themeStyles.primaryBtn} ${themeStyles.focusRing}`}
          title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 sm:w-4 sm:h-4">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 sm:w-4 sm:h-4 ml-0.5">
              <path d="M6 4.75a1.25 1.25 0 0 1 1.9-.1l11.25 7.25a1.25 1.25 0 0 1 0 2.1L7.9 21.25A1.25 1.25 0 0 1 6 20.2V4.75Z" />
            </svg>
          )}
        </button>

        {nextChannel && (
          <button
            type="button"
            onClick={() => surfToChannel(nextChannel)}
            className={`flex ${hudBtnSize} shrink-0 items-center justify-center rounded-lg border transition cursor-pointer focus:outline-none focus:ring-2 ${themeStyles.hudBtn} ${themeStyles.focusRing}`}
            title={`Next: ${nextChannel.title}`}
            aria-label="Next Channel"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 sm:w-4 sm:h-4">
              <path d="M16 6h2v12h-2zM6 18l8.5-6L6 6z" />
            </svg>
          </button>
        )}
      </div>

      {/* Right: Quality + Aspect + Volume + PiP + Fullscreen (Strict Zero-Overlap Wrapping) */}
      <div className="flex flex-wrap items-center justify-end gap-1.5 min-w-0 max-w-full">
        {qualityLevels.length > 0 && (
          <div
            data-tour="player-quality"
            className={`flex items-center rounded-lg border px-1.5 sm:px-2 ${
              largeButtons ? 'h-10 sm:h-11' : 'h-8 sm:h-9'
            } max-w-[92px] sm:max-w-[132px] overflow-hidden shrink-0 ${themeStyles.hudSelectBox}`}
          >
            <select
              value={selectedQuality}
              onChange={handleQualityChange}
              aria-label="Stream Quality"
              className="w-full min-w-0 truncate bg-transparent text-[10px] sm:text-[11px] font-bold text-white focus:outline-none cursor-pointer"
            >
              <option value={-1} className={themeStyles.optionBg}>
                Auto
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

        <button
          type="button"
          onClick={cycleAspectMode}
          className={`inline-flex items-center justify-center rounded-lg border px-2 ${
            largeButtons ? 'h-10 sm:h-11' : 'h-8 sm:h-9'
          } text-[10px] font-bold uppercase tracking-wider whitespace-nowrap shrink-0 transition cursor-pointer focus:outline-none focus:ring-2 ${themeStyles.hudBtn} ${themeStyles.focusRing}`}
          title="Aspect Ratio: Fit / Fill / Stretch (A)"
        >
          {aspectLabel}
        </button>

        <div
          data-tour="player-volume"
          className={`relative flex items-center gap-1.5 rounded-lg border px-1 ${
            largeButtons ? 'h-10 sm:h-11' : 'h-8 sm:h-9'
          } shrink-0 ${themeStyles.hudSelectBox}`}
          onMouseEnter={() => setShowVolumeSlider(true)}
          onMouseLeave={() => setShowVolumeSlider(false)}
        >
          <button
            type="button"
            onClick={toggleMute}
            className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-md hover:bg-white/10 transition cursor-pointer focus:outline-none"
            title={isMuted || volume === 0 ? 'Unmute (M)' : 'Mute (M)'}
            aria-label="Toggle Mute"
          >
            {isMuted || volume === 0 ? (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-400"
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
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${themeStyles.hudAccentIcon}`}
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
            className={`hidden sm:inline-block w-16 md:w-20 h-1 rounded-lg appearance-none cursor-pointer transition-all ${
              themeStyles.sliderTrack
            }`}
            aria-label="Volume"
          />
        </div>

        {canUsePiP && (
          <button
            type="button"
            onClick={() => void handleTogglePiP()}
            className={`hidden md:flex ${hudBtnSize} shrink-0 items-center justify-center rounded-lg border transition cursor-pointer focus:outline-none focus:ring-2 ${themeStyles.hudBtn} ${themeStyles.focusRing}`}
            title="Picture-in-Picture"
            aria-label="Picture-in-Picture"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-4 h-4"
            >
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <rect x="12" y="11" width="7" height="6" rx="1" fill="currentColor" />
            </svg>
          </button>
        )}

        <button
          type="button"
          data-tour="player-fullscreen"
          onClick={toggleFullscreen}
          className={`flex ${hudBtnSize} shrink-0 items-center justify-center rounded-lg border transition cursor-pointer focus:outline-none focus:ring-2 ${themeStyles.hudBtn} ${themeStyles.focusRing}`}
          title={isFullscreen ? 'Exit Fullscreen (F)' : 'Fullscreen (F)'}
          aria-label="Fullscreen Toggle"
        >
          {isFullscreen ? (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-3.5 h-3.5 sm:w-4 sm:h-4"
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
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-3.5 h-3.5 sm:w-4 sm:h-4"
            >
              <path d="M15 3h6v6" />
              <path d="M9 21H3v-6" />
              <path d="M21 3l-7 7" />
              <path d="M3 21l7-7" />
            </svg>
          )}
        </button>

        {isFloatingOverlay && (
          <button
            type="button"
            onClick={() => {
              if (document.fullscreenElement) {
                document.exitFullscreen().catch(() => {});
              }
              setShowControls(false);
            }}
            className={`flex ${hudBtnSize} shrink-0 items-center justify-center rounded-lg border transition cursor-pointer focus:outline-none focus:ring-2 ${themeStyles.hudBtn} ${themeStyles.focusRing}`}
            title="Hide Controls"
            aria-label="Hide Controls"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-3.5 h-3.5 sm:w-4 sm:h-4"
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
      className={`min-h-screen ${themeStyles.bg} ${themeStyles.baseText} transition-colors duration-300 pb-14 py-2 sm:py-5 px-2 sm:px-6 md:px-10 w-full max-w-full overflow-x-clip box-border relative rounded-3xl`}
    >
      <style>{`
        video::-webkit-media-controls,
        video::-webkit-media-controls-start-playback-button {
          display: none !important;
          -webkit-appearance: none !important;
        }
      `}</style>

      <AppWallpaper />
      {!isLowRam && !reducedMotion && !glowOff && (
        <div
          className={`absolute inset-x-0 -top-10 h-[24rem] bg-gradient-to-b ${themeStyles.ambient} blur-3xl z-0 pointer-events-none rounded-t-3xl`}
        />
      )}

      <div className="w-full max-w-6xl mx-auto space-y-3 sm:space-y-4 box-border relative z-10">
        {/* Constrained Top Action Bar (Zero Wrapping Glitches, Zero Right-Edge Clipping) */}
        <div className="w-full max-w-full flex flex-wrap items-center justify-between gap-1.5 sm:gap-2 min-w-0">
          <Link
            to="/live-tv"
            className={`inline-flex items-center gap-1 rounded-lg border px-2.5 sm:px-3 h-8 sm:h-9 text-[11px] sm:text-xs font-bold whitespace-nowrap shrink-0 transition cursor-pointer focus:outline-none focus:ring-2 ${themeStyles.btnSecondary} ${themeStyles.focusRing}`}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-3.5 h-3.5 shrink-0"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
            <span>Live TV</span>
          </Link>

          <div className="flex flex-wrap items-center justify-end gap-1.5 min-w-0">
            <button
              type="button"
              onClick={openTuneMiniGuide}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 sm:px-3 h-8 sm:h-9 text-[11px] sm:text-xs font-bold whitespace-nowrap shrink-0 transition cursor-pointer focus:outline-none focus:ring-2 ${themeStyles.btnSecondary} ${themeStyles.focusRing}`}
              title="Open Slide-Over Channel Guide (G)"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-3.5 h-3.5 shrink-0"
              >
                <line x1="4" y1="6" x2="20" y2="6" />
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="18" x2="14" y2="18" />
              </svg>
              <span>Channels</span>
            </button>

            {!isLowRam && (
              <button
                type="button"
                onClick={isSplitActive ? handleCloseSplitScreen : openSplitMiniGuide}
                className={`hidden md:inline-flex items-center gap-1.5 rounded-lg border px-3 h-9 text-xs font-bold whitespace-nowrap shrink-0 transition cursor-pointer focus:outline-none focus:ring-2 ${
                  isSplitActive ? themeStyles.btnPinned : themeStyles.btnSecondary
                } ${themeStyles.focusRing}`}
                title={
                  isSplitActive
                    ? 'Exit Split-Screen Mode'
                    : 'Watch 2 Live Channels Side-by-Side'
                }
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-3.5 h-3.5 shrink-0"
                >
                  <rect x="3" y="4" width="18" height="16" rx="2" />
                  <line x1="12" y1="4" x2="12" y2="20" />
                </svg>
                <span>{isSplitActive ? 'Single View' : 'Split-Screen'}</span>
              </button>
            )}

            <button
              type="button"
              data-tour="channel-pin"
              onClick={handleTogglePin}
              className={`flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-lg border transition cursor-pointer focus:outline-none focus:ring-2 ${
                isPinned ? themeStyles.btnPinned : themeStyles.btnSecondary
              } ${themeStyles.focusRing}`}
              title={isPinned ? 'Unpin Favorite' : 'Pin to Favorites'}
              aria-label={isPinned ? 'Unpin Favorite' : 'Pin to Favorites'}
            >
              <svg
                viewBox="0 0 24 24"
                fill={isPinned ? 'currentColor' : 'none'}
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-3.5 h-3.5"
              >
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </button>

            <button
              type="button"
              onClick={handleResyncStream}
              className={`flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-lg border transition cursor-pointer focus:outline-none focus:ring-2 ${themeStyles.btnSecondary} ${themeStyles.focusRing}`}
              title="Resync Stream (R)"
              aria-label="Resync Stream"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-3.5 h-3.5"
              >
                <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                <polyline points="21 3 21 9 15 9" />
              </svg>
            </button>

            {/* Minimal Signal Indicator */}
            <div
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2 sm:px-2.5 h-8 sm:h-9 text-[10px] font-extrabold uppercase tracking-wider whitespace-nowrap shrink-0 ${themeStyles.subtleBadge}`}
            >
              {streamStatus === 'live' ? (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                  <span className="text-emerald-300">Live</span>
                </>
              ) : streamStatus === 'offline' ? (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
                  <span className="text-red-400">Off</span>
                </>
              ) : (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping shrink-0" />
                  <span className="text-amber-300">Sync</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Pin Feedback Toast */}
        {pinFeedback && (
          <div
            className={`rounded-xl border px-3.5 py-2 text-center text-xs font-bold ${themeStyles.feedbackBanner}`}
          >
            {pinFeedback}
          </div>
        )}

        {/* Active Split-Screen Control Strip */}
        {isSplitActive && splitChannel && (
          <div
            className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3.5 py-2 ${themeStyles.hudDock}`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className={`text-xs font-extrabold ${themeStyles.accentText}`}>
                Split-Screen
              </span>
              <span className={`text-[11px] truncate ${themeStyles.mutedText}`}>
                Tap either screen to switch audio
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={openSplitMiniGuide}
                className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold transition cursor-pointer ${themeStyles.hudBtn}`}
              >
                Change Screen 2
              </button>
              <button
                type="button"
                onClick={handleSwapSplitScreens}
                className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold transition cursor-pointer ${themeStyles.hudBtn}`}
              >
                Swap
              </button>
              <button
                type="button"
                onClick={handleCloseSplitScreen}
                className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold transition cursor-pointer ${themeStyles.hudBtn}`}
              >
                Close Split
              </button>
            </div>
          </div>
        )}

        {/* Theater-Grade Video Player Stage */}
        <div className="w-full space-y-2">
          <div
            ref={playerContainerRef}
            data-tour="video-player"
            onMouseMove={revealControlsTemporarily}
            onTouchStart={revealControlsTemporarily}
            className={`w-full relative flex items-center justify-center rounded-2xl overflow-hidden bg-black border ${
              isSplitActive
                ? 'min-h-[300px] sm:min-h-[380px] md:aspect-[21/9]'
                : 'aspect-video'
            } max-h-[76dvh] box-border group select-none ${
              themeStyles.playerFrame
            } ${glowOff ? 'shadow-xl' : themeStyles.playerGlow}`}
          >
            {safePrimaryUrl ? (
              <div
                className={
                  isSplitActive
                    ? 'grid grid-cols-1 md:grid-cols-2 w-full h-full bg-black gap-1 p-1'
                    : 'w-full h-full'
                }
              >
                {/* Screen 1 (Primary — Never unmounts when toggling Split-Screen) */}
                <div
                  onClick={
                    isSplitActive
                      ? () => setActiveAudioPane('primary')
                      : undefined
                  }
                  className={
                    isSplitActive
                      ? `relative w-full h-full min-h-[180px] rounded-xl overflow-hidden bg-black border-2 cursor-pointer transition ${
                          activeAudioPane === 'primary'
                            ? themeStyles.btnPinned
                            : 'border-white/10 opacity-90 hover:opacity-100'
                        }`
                      : 'relative w-full h-full'
                  }
                >
                  <video
                    ref={videoRef}
                    poster={TRANSPARENT_POSTER}
                    autoPlay
                    playsInline
                    controls={false}
                    onClick={isSplitActive ? undefined : togglePlayPause}
                    className={`w-full h-full ${videoFitClass} bg-black cursor-pointer`}
                  />

                  {isSplitActive && (
                    <div className="pointer-events-none absolute top-2 left-2 right-2 flex items-center justify-between gap-2 z-10">
                      <span
                        className={`rounded-md border px-2 py-0.5 text-[10px] font-bold truncate max-w-[65%] backdrop-blur-md ${themeStyles.hudDock} text-white`}
                      >
                        1. {title}
                      </span>
                      <span
                        className={`rounded-md border px-2 py-0.5 text-[10px] font-bold shrink-0 backdrop-blur-md ${
                          activeAudioPane === 'primary'
                            ? themeStyles.badge
                            : themeStyles.subtleBadge
                        }`}
                      >
                        {activeAudioPane === 'primary' ? 'Audio On' : 'Tap Audio'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Screen 2 (Secondary Broadcast — Mounted only while Split-Screen is active) */}
                {isSplitActive && splitChannel && (
                  <div
                    onClick={() => setActiveAudioPane('secondary')}
                    className={`relative w-full h-full min-h-[180px] rounded-xl overflow-hidden bg-black border-2 cursor-pointer transition ${
                      activeAudioPane === 'secondary'
                        ? themeStyles.btnPinned
                        : 'border-white/10 opacity-90 hover:opacity-100'
                    }`}
                  >
                    <video
                      ref={secondaryVideoRef}
                      poster={TRANSPARENT_POSTER}
                      autoPlay
                      playsInline
                      controls={false}
                      className={`w-full h-full ${videoFitClass} bg-black`}
                    />

                    <div className="pointer-events-none absolute top-2 left-2 right-2 flex items-center justify-between gap-2 z-10">
                      <span
                        className={`rounded-md border px-2 py-0.5 text-[10px] font-bold truncate max-w-[65%] backdrop-blur-md ${themeStyles.hudDock} text-white`}
                      >
                        2. {splitChannel.title}
                      </span>
                      <span
                        className={`rounded-md border px-2 py-0.5 text-[10px] font-bold shrink-0 backdrop-blur-md ${
                          activeAudioPane === 'secondary'
                            ? themeStyles.badge
                            : themeStyles.subtleBadge
                        }`}
                      >
                        {activeAudioPane === 'secondary' ? 'Audio On' : 'Tap Audio'}
                      </span>
                    </div>

                    {splitStatus === 'checking' && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 gap-2 pointer-events-none">
                        <div
                          className={`h-6 w-6 rounded-full border-2 border-t-transparent animate-spin ${themeStyles.accentText}`}
                        />
                        <span
                          className={`text-[10px] font-bold uppercase tracking-widest ${themeStyles.mutedText}`}
                        >
                          Tuning Screen 2
                        </span>
                      </div>
                    )}

                    {splitStatus === 'offline' && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 gap-2 p-4 text-center">
                        <span className="text-xs font-bold text-red-400">
                          Screen 2 Feed Offline
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openSplitMiniGuide();
                          }}
                          className={`rounded-lg border px-3 py-1.5 text-[10px] font-bold cursor-pointer ${themeStyles.btnSecondary}`}
                        >
                          Pick Another Channel
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center p-6">
                <p className={`text-xs sm:text-sm font-bold ${themeStyles.mutedText}`}>
                  Invalid or missing stream URL.
                </p>
              </div>
            )}

            {/* Minimal Top Watermark Overlay (Desktop / Fullscreen Live Only) */}
            {streamStatus === 'live' && !isSplitActive && (
              <div
                className={`absolute inset-x-3 top-3 z-20 flex items-center justify-between gap-2 pointer-events-none transition-opacity duration-300 ${
                  showControls ? 'opacity-100' : 'opacity-0'
                }`}
              >
                <div className="flex items-center gap-2 rounded-lg bg-black/65 backdrop-blur-md border border-white/10 px-2.5 py-1 min-w-0 max-w-[65%] overflow-hidden">
                  {logo && (
                    <img
                      src={logo}
                      alt=""
                      className="h-4 sm:h-5 w-auto max-w-[48px] object-contain shrink-0"
                    />
                  )}
                  <span className="text-[11px] font-bold text-white truncate">
                    {title}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {sleepTimerMin > 0 && (
                    <span className="rounded-lg bg-black/65 backdrop-blur-md border border-white/10 px-2 py-1 text-[10px] font-bold text-white">
                      Sleep {sleepTimerMin}m
                    </span>
                  )}
                  <span className="rounded-lg bg-black/65 backdrop-blur-md border border-white/10 px-2 py-1 text-[10px] font-bold text-white">
                    {hudClock}
                  </span>
                </div>
              </div>
            )}

            {/* Minimalist Tuning / Buffering Overlay */}
            {streamStatus === 'checking' && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/80 pointer-events-none gap-3 p-4 text-center">
                {logo && (
                  <img
                    src={logo}
                    alt={title}
                    className="h-9 sm:h-12 w-auto max-w-[150px] object-contain opacity-90"
                  />
                )}
                <div
                  className={`h-6 w-6 rounded-full border-2 border-t-transparent animate-spin ${themeStyles.accentText}`}
                />
                <span className={`text-[10px] font-bold tracking-[0.22em] uppercase ${themeStyles.subMutedText}`}>
                  Connecting
                </span>
              </div>
            )}

            {/* Floating Bottom HUD (Fullscreen or lg+ screens) */}
            <div
              className={`${
                isFullscreen ? 'block' : 'hidden lg:block'
              } absolute inset-x-0 bottom-0 z-20 pt-10 pb-3 px-3 sm:px-4 bg-gradient-to-t from-black/95 via-black/60 to-transparent transition-opacity duration-300 ${
                showControls
                  ? 'opacity-100 pointer-events-auto'
                  : 'opacity-0 pointer-events-none'
              }`}
            >
              {renderControlsBar(true)}
            </div>

            {/* Clean Offline Recovery Overlay */}
            {streamStatus === 'offline' && (
              <div className="absolute inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-5 text-center z-30">
                <p className="text-sm sm:text-base font-black text-white">
                  Broadcast Feed Unavailable
                </p>
                <p className={`mt-1 text-xs max-w-xs ${themeStyles.subMutedText}`}>
                  This stream timed out or is temporarily off-air.
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={handleResyncStream}
                    className={`rounded-lg px-4 py-2 text-xs font-bold transition cursor-pointer ${themeStyles.primaryBtn}`}
                  >
                    Retry Stream
                  </button>
                  {nextChannel && (
                    <button
                      type="button"
                      onClick={() => surfToChannel(nextChannel)}
                      className={`rounded-lg border px-4 py-2 text-xs font-bold transition cursor-pointer ${themeStyles.btnSecondary}`}
                    >
                      Next Channel
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sleek Docked Controls on Phones & Tablets (< lg, non-fullscreen) */}
          {!isFullscreen && (
            <div className="lg:hidden w-full">
              {renderControlsBar(false)}
            </div>
          )}
        </div>

        {/* Compact Horizontal Broadcast Info Bar (Strictly Constrained) */}
        <div
          className={`w-full max-w-full overflow-hidden box-border rounded-2xl border ${
            isLowRam ? '' : 'backdrop-blur-xl'
          } p-3 sm:p-4 flex items-center gap-3 sm:gap-4 ${themeStyles.surfacePanel}`}
        >
          <div
            className={`w-16 h-12 sm:w-20 sm:h-14 shrink-0 rounded-xl border flex items-center justify-center p-2 overflow-hidden ${themeStyles.logoStage}`}
          >
            {logo ? (
              <img
                src={logo}
                alt={title}
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <span className={`text-[10px] font-black uppercase ${themeStyles.accentText}`}>
                LIVE
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0 space-y-0.5 text-left">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base sm:text-xl font-black tracking-tight text-white truncate">
                {title || 'Live Channel'}
              </h1>
              <span className={`text-[11px] font-bold ${themeStyles.subMutedText}`}>
                {streamStatus === 'offline'
                  ? 'Off-Air'
                  : `${qualityLabel} • ${isLowRam ? 'Lite' : 'HD Buffer'}`}
              </span>
            </div>
            <p className={`text-xs leading-relaxed line-clamp-2 ${themeStyles.mutedText}`}>
              {channelDescription}
            </p>
          </div>
        </div>

        {/* Up Next / More Live Channels (Clean Minimal Cards) */}
        <div className="w-full pt-1 space-y-3">
          <div className="flex items-center justify-between gap-2 px-0.5">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`w-1 h-5 rounded-full shrink-0 ${themeStyles.accentBar}`}
              />
              <h2 className="text-sm sm:text-base font-black tracking-tight text-white">
                More Live Channels
              </h2>
            </div>

            <button
              type="button"
              onClick={() => navigate({ to: '/live-tv' })}
              className={`text-xs font-bold hover:underline cursor-pointer shrink-0 ${themeStyles.accentText}`}
            >
              View All →
            </button>
          </div>

          {loadingSuggestions ? (
            <div
              className={`flex items-center justify-center rounded-2xl border py-8 text-xs font-bold ${themeStyles.surfacePanel} ${themeStyles.subMutedText}`}
            >
              Loading channels…
            </div>
          ) : suggestedChannels.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
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
                    className={`group flex flex-col w-full min-w-0 box-border rounded-2xl border ${themeStyles.surfaceCard} ${themeStyles.borderHover} p-2.5 transition-all duration-200 hover:-translate-y-0.5 overflow-hidden text-left focus:outline-none focus:ring-2 ${themeStyles.focusRing}`}
                  >
                    <div
                      className={`w-full h-16 sm:h-20 rounded-xl border mb-2 p-2.5 flex items-center justify-center overflow-hidden ${themeStyles.logoStage}`}
                    >
                      {channel.logo ? (
                        <img
                          src={channel.logo}
                          alt={channel.title}
                          className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <span
                          className={`text-[10px] font-black ${themeStyles.accentText}`}
                        >
                          LIVE
                        </span>
                      )}
                    </div>

                    <span className="block text-xs font-extrabold line-clamp-1 text-white">
                      {channel.title}
                    </span>
                    <p
                      className={`text-[10px] line-clamp-1 mt-0.5 ${themeStyles.subMutedText}`}
                    >
                      {getChannelDescription(channel.title)}
                    </p>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div
              className={`rounded-2xl border p-6 text-center ${themeStyles.surfacePanel}`}
            >
              <p className={`text-xs font-bold ${themeStyles.mutedText}`}>
                No additional channels available right now.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Slide-Over Transparent Live TV Mini-Guide */}
      <LiveMiniGuide
        isOpen={miniGuideOpen}
        mode={miniGuideMode}
        appTheme={appTheme}
        channels={allChannels}
        currentStreamUrl={safePrimaryUrl}
        secondaryStreamUrl={splitStreamUrl}
        isLowRam={isLowRam}
        largeButtons={largeButtons}
        onSelectChannel={handleMiniGuideSelect}
        onClose={() => setMiniGuideOpen(false)}
      />
    </div>
  );
}

export default LivePlayerComponent;