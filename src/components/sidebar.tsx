// src/components/sidebar.tsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { Link } from "@tanstack/react-router";
import { AdminPanel } from "@/components/AdminPanel";
import {
  ADMIN_STORE_UPDATED_EVENT,
  getCachedBrandingConfig,
  type BrandingAndFlagsConfig,
} from "@/lib/admin-store";
import { ReferralModal } from "@/components/ReferralModal";
import {
  SIDEBAR_SECTION_EVENT,
  triggerRabbitWalkthrough,
} from "@/components/InteractiveWalkthrough";
import { triggerOpenTosModal } from "@/components/TermsOfServiceModal";
import { TIMEOUT_OPTIONS } from "@/components/Screensaver";
import { bgAudio, RADIO_STATIONS } from "@/lib/background-audio";
import {
  triggerOpenProfileSwitcher,
  snapshotActiveProfile,
} from "@/lib/profiles";
import {
  getActiveMascotBadge,
  setActiveMascotBadge,
  getAllCustomMascotBadges,
  EMOJI_MASCOT_BADGES,
  MASCOT_UPDATED_EVENT,
  syncRemoteMascotBadges,
  type MascotBadgeOption,
} from "@/lib/mascots";
import { MascotAvatar } from "@/components/MascotAvatar";
import { sendPermanentActivationAlert } from "@/lib/report";
import { checkForAppUpdates } from "@/lib/updater";
import {
  getHolidayPreviewOverride,
  setHolidayPreviewOverride,
  getAllHolidayOptions,
  type HolidayOverrideMode,
} from "@/lib/holiday-theme";
import {
  MIN_CONFIRMED_REFERRALS,
  PAYOUT_PER_EXTRA_REFERRAL_CAD,
} from "@/lib/referrals";
import {
  CardSize,
  StreamQuality,
  AppTheme,
  HistoryScale,
  RamMode,
  GlowIntensity,
  TextScale,
  CursorStyle,
  SleepTimerMinutes,
  TvOverscanPercent,
  ClockFormat,
  SubtitleSettings,
  PosterShape,
  PosterCardStyle,
  PosterInfoLayout,
  GreetingStyle,
  StartupTab,
  StorageHealthReport,
  DISCLAIMER_ACCEPTED_KEY,
  MAX_FAVORITE_CHANNELS,
  SLEEP_TIMER_OPTIONS,
  TV_OVERSCAN_OPTIONS,
  GLOW_INTENSITY_OPTIONS,
  POSTER_SHAPE_OPTIONS,
  POSTER_CARD_STYLE_OPTIONS,
  POSTER_INFO_LAYOUT_OPTIONS,
  GREETING_STYLE_OPTIONS,
  CURSOR_STYLE_OPTIONS,
  STARTUP_TAB_OPTIONS,
  saveStreamQuality,
  getSavedUserAge,
  saveUserAge,
  isValidAgeLockPin,
  verifyAgeLockPin,
  saveAgeLockPinSecure,
  getPinLockoutState,
  recordPinFailure,
  resetPinFailures,
  getKidsModeLocked,
  setKidsModeLocked,
  getRamMode,
  setRamMode,
  getDataSaverMode,
  setDataSaverMode,
  getAutoPlayNext,
  setAutoPlayNext,
  getGlowIntensity,
  setGlowIntensity,
  getDefaultPlayerVolume,
  setDefaultPlayerVolume,
  getPosterShape,
  setPosterShape,
  getPosterCardStyle,
  setPosterCardStyle,
  getPosterInfoLayout,
  setPosterInfoLayout,
  getShowPosterBadges,
  setShowPosterBadges,
  getSavedScreensaverTimeout,
  saveScreensaverTimeout,
  getSleepTimerMinutes,
  setSleepTimerMinutes,
  getClockFormat,
  setClockFormat,
  getTextScale,
  setTextScale,
  getHighContrastFocus,
  setHighContrastFocus,
  getReducedMotion,
  setReducedMotion,
  getUiClickSounds,
  setUiClickSounds,
  getCursorStyle,
  setCursorStyle,
  getTvOverscan,
  setTvOverscan,
  getSubtitleSettings,
  saveSubtitleSettings,
  getSeniorEasyMode,
  applySeniorEasyPreset,
  getGreetingStyle,
  setGreetingStyle,
  getWarmEyeCare,
  setWarmEyeCare,
  getStartupTab,
  setStartupTab,
  getShowCornerClock,
  setShowCornerClock,
  getFavoriteChannelIds,
  getStorageHealth,
  purgeOldTmdbCaches,
  resetVisualSettings,
  exportAllSettingsSnapshot,
  importSettingsSnapshot,
  getOrCreateDeviceId,
} from "@/lib/settings";

export type { RamMode };

const HEART_DANCE_DEFAULT_MIGRATED_KEY = "rabtv_heart_dance_default_v2";
const DEFAULT_RADIO_VOLUME = 0.25;

export const globalFeedOptions = [
  "All (Default)",
  "Canada (All)",
  "English",
  "German",
  "Ukrainian",
  "Arabic / Islamic",
  "Russian",
  "British",
  "Hungarian",
] as const;

export type GlobalFeedOption = (typeof globalFeedOptions)[number];

// Unified Punk-Neon Console Assets (Reused from Index & Community Overhaul — Zero New Images)
const RABBIT_PILL_ACTIVE =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-pill-active-crimson.jpg";
const RABBIT_PILL_INACTIVE =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-pill-inactive-dark.jpg";
const RABBIT_DRAWER_FRAME =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-community-card-frame.jpg";
const RABBIT_DIVIDER =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/main/assets/rabbit-divider.jpg";

/**
 * Finds "Heart Dance" inside the "2000s" category of RADIO_STATIONS.
 */
export function getDefaultHeartDanceStationUrl(): string {
  const stations2000s =
    RADIO_STATIONS["2000s"] ||
    RADIO_STATIONS["2000's"] ||
    RADIO_STATIONS["00s"] ||
    [];

  const exactIn2000s = stations2000s.find((s) => {
    const n = s.name.toLowerCase();
    return n.includes("heart dance") || n.includes("heartdance");
  });
  if (exactIn2000s?.url) return exactIn2000s.url;

  const heartIn2000s = stations2000s.find((s) =>
    s.name.toLowerCase().includes("heart")
  );
  if (heartIn2000s?.url) return heartIn2000s.url;

  for (const list of Object.values(RADIO_STATIONS)) {
    const match = list.find((s) => {
      const n = s.name.toLowerCase();
      return n.includes("heart dance") || n.includes("heartdance");
    });
    if (match?.url) return match.url;
  }

  if (stations2000s[0]?.url) return stations2000s[0].url;
  return RADIO_STATIONS["80s"]?.[0]?.url || "";
}

// Backwards-compatible alias used by __root.tsx
export const getDefaultHeartbeatStationUrl = getDefaultHeartDanceStationUrl;

export interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  appTheme: AppTheme;
  cardSize: CardSize;
  streamQuality: StreamQuality;
  helpfulMouse: boolean;
  historyOverscale: HistoryScale;
  largeButtons: boolean;
  savedProfileName: string;
  setSavedProfileName: (name: string) => void;
  userAgeInput: string;
  setUserAgeInput: (age: string) => void;
  profileNameInput: string;
  setProfileNameInput: (name: string) => void;
  isAdmin: boolean;
  isTrialActive: boolean;
  setIsTrialActive: (active: boolean) => void;
  trialDaysRemaining: number;
  bgMusicState: string;
  onBackgroundAudioToggle: (state: string) => void;
  onThemeChange: (theme: AppTheme) => void;
  onSizeChange: (size: CardSize) => void;
  onMouseToggle: (enabled: boolean) => void;
  onHistoryOverscaleChange: (scale: HistoryScale) => void;
  onLargeButtonsToggle: (enabled: boolean) => void;
  onOpenBugModal: () => void;
  onOpenBugFeedModal: () => void;
  onTriggerFirstStartModal: () => void;
  onOpenTosModal?: () => void;
  onStartWalkthrough?: () => void;
  headerIconUrl?: string;
  allThemesList: { id: AppTheme; label: string }[];
  getPrimaryBgColor: (theme: AppTheme) => string;
  getPrimaryAccentColor: (theme: AppTheme) => string;
}

type ConsolidatedSection =
  | "feedAndHistory"
  | "themesAndScale"
  | "audio"
  | "profileAndAccessibility"
  | "hardwareAndStream"
  | "screensaverAndBackup"
  | null;

interface SidebarThemeTokens {
  drawerShell: string;
  drawerOverlay: string;
  scrollBtn: string;
  headerBar: string;
  avatarFrame: string;
  subPanel: string;
  subBox: string;
  detailsBody: string;
  dividerBorder: string;
  accordionOverlay: string;
  accordionActive: string;
  accordionIdle: string;
  accordionBadge: string;
  accordionCaret: string;
  accentText: string;
  mutedText: string;
  subMutedText: string;
  toggleActive: string;
  toggleOff: string;
  subtlePill: string;
  inputClass: string;
  optionBg: string;
  sliderClass: string;
  highlightCard: string;
  referralCard: string;
  referralIcon: string;
  referralPill: string;
  secondaryBtn: string;
  focusRing: string;
}

function getSidebarThemeTokens(theme: AppTheme): SidebarThemeTokens {
  switch (theme) {
    case "red":
      return {
        drawerShell:
          "bg-zinc-950/82 border-red-500/35 shadow-[0_25px_70px_rgba(0,0,0,0.95),0_0_32px_rgba(239,68,68,0.18)]",
        drawerOverlay:
          "from-red-500/[0.08] via-zinc-950/55 to-red-950/20",
        scrollBtn:
          "bg-black/85 hover:bg-red-950 border-red-500/45 text-red-300 hover:text-white shadow-[0_0_12px_rgba(239,68,68,0.35)]",
        headerBar: "bg-black/65 border-red-500/30",
        avatarFrame:
          "border-red-400/50 bg-zinc-900 shadow-[0_0_14px_rgba(239,68,68,0.3)]",
        subPanel:
          "bg-zinc-950/92 border-red-500/30 shadow-[0_12px_35px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(239,68,68,0.08)]",
        subBox: "bg-black/75 border-red-500/25",
        detailsBody: "bg-zinc-950/85 border-red-500/20",
        dividerBorder: "border-red-500/20",
        accordionOverlay: "bg-zinc-950/50",
        accordionActive:
          "ring-2 ring-red-400/90 border-red-400/65 shadow-[0_0_24px_rgba(239,68,68,0.42)]",
        accordionIdle:
          "border-red-500/25 hover:border-red-400/55 hover:shadow-[0_10px_24px_rgba(239,68,68,0.24)] focus:ring-2 focus:ring-red-400",
        accordionBadge: "bg-black/75 border-red-500/35 text-red-300",
        accordionCaret: "text-red-300",
        accentText: "text-red-300",
        mutedText: "text-zinc-300",
        subMutedText: "text-zinc-400",
        toggleActive: "bg-red-600",
        toggleOff: "bg-zinc-700",
        subtlePill:
          "bg-red-950/50 border border-red-500/30 text-red-100 hover:bg-red-900/75",
        inputClass:
          "border-red-500/35 bg-black/85 text-white placeholder-zinc-500 focus:ring-2 focus:ring-red-500",
        optionBg: "bg-zinc-950 text-white",
        sliderClass: "bg-zinc-800 accent-red-500",
        highlightCard:
          "bg-gradient-to-r from-red-950/75 via-black/80 to-red-950/60 border-red-400/45",
        referralCard:
          "border-red-400/50 bg-gradient-to-r from-red-950/80 via-zinc-950/85 to-red-950/75 hover:from-red-900/80 hover:to-red-950/85 shadow-[0_10px_28px_rgba(239,68,68,0.22)] focus:ring-red-400",
        referralIcon: "bg-red-500/20 border-red-400/50",
        referralPill: "bg-red-500/20 border-red-400/45 text-red-200",
        secondaryBtn:
          "bg-black/70 hover:bg-red-950/70 border-red-500/30 text-zinc-200 hover:text-white",
        focusRing: "focus:ring-red-500",
      };
    case "midnight":
      return {
        drawerShell:
          "bg-slate-950/82 border-blue-500/35 shadow-[0_25px_70px_rgba(0,0,0,0.95),0_0_32px_rgba(59,130,246,0.18)]",
        drawerOverlay:
          "from-blue-500/[0.08] via-slate-950/55 to-blue-950/20",
        scrollBtn:
          "bg-black/85 hover:bg-blue-950 border-blue-500/45 text-sky-300 hover:text-white shadow-[0_0_12px_rgba(59,130,246,0.35)]",
        headerBar: "bg-black/65 border-blue-500/30",
        avatarFrame:
          "border-sky-400/50 bg-slate-900 shadow-[0_0_14px_rgba(59,130,246,0.3)]",
        subPanel:
          "bg-slate-950/92 border-blue-500/30 shadow-[0_12px_35px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(56,189,248,0.08)]",
        subBox: "bg-black/75 border-blue-500/25",
        detailsBody: "bg-slate-950/85 border-blue-500/20",
        dividerBorder: "border-blue-500/20",
        accordionOverlay: "bg-slate-950/50",
        accordionActive:
          "ring-2 ring-sky-400/90 border-sky-400/65 shadow-[0_0_24px_rgba(56,189,248,0.42)]",
        accordionIdle:
          "border-blue-500/25 hover:border-sky-400/55 hover:shadow-[0_10px_24px_rgba(56,189,248,0.24)] focus:ring-2 focus:ring-sky-400",
        accordionBadge: "bg-black/75 border-blue-500/35 text-sky-300",
        accordionCaret: "text-sky-300",
        accentText: "text-sky-300",
        mutedText: "text-slate-300",
        subMutedText: "text-slate-400",
        toggleActive: "bg-sky-500",
        toggleOff: "bg-slate-700",
        subtlePill:
          "bg-blue-950/50 border border-blue-500/30 text-blue-100 hover:bg-blue-900/75",
        inputClass:
          "border-blue-500/35 bg-black/85 text-white placeholder-slate-500 focus:ring-2 focus:ring-sky-400",
        optionBg: "bg-slate-950 text-white",
        sliderClass: "bg-slate-800 accent-sky-400",
        highlightCard:
          "bg-gradient-to-r from-blue-950/75 via-black/80 to-blue-950/60 border-sky-400/45",
        referralCard:
          "border-sky-400/50 bg-gradient-to-r from-blue-950/80 via-slate-950/85 to-blue-950/75 hover:from-blue-900/80 hover:to-blue-950/85 shadow-[0_10px_28px_rgba(59,130,246,0.22)] focus:ring-sky-400",
        referralIcon: "bg-sky-500/20 border-sky-400/50",
        referralPill: "bg-sky-500/20 border-sky-400/45 text-sky-200",
        secondaryBtn:
          "bg-black/70 hover:bg-blue-950/70 border-blue-500/30 text-slate-200 hover:text-white",
        focusRing: "focus:ring-sky-400",
      };
    case "emerald":
      return {
        drawerShell:
          "bg-neutral-950/82 border-emerald-500/35 shadow-[0_25px_70px_rgba(0,0,0,0.95),0_0_32px_rgba(16,185,129,0.18)]",
        drawerOverlay:
          "from-emerald-500/[0.08] via-neutral-950/55 to-emerald-950/20",
        scrollBtn:
          "bg-black/85 hover:bg-emerald-950 border-emerald-500/45 text-emerald-300 hover:text-white shadow-[0_0_12px_rgba(16,185,129,0.35)]",
        headerBar: "bg-black/65 border-emerald-500/30",
        avatarFrame:
          "border-emerald-400/50 bg-neutral-900 shadow-[0_0_14px_rgba(16,185,129,0.3)]",
        subPanel:
          "bg-neutral-950/92 border-emerald-500/30 shadow-[0_12px_35px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(16,185,129,0.08)]",
        subBox: "bg-black/75 border-emerald-500/25",
        detailsBody: "bg-neutral-950/85 border-emerald-500/20",
        dividerBorder: "border-emerald-500/20",
        accordionOverlay: "bg-neutral-950/50",
        accordionActive:
          "ring-2 ring-emerald-400/90 border-emerald-400/65 shadow-[0_0_24px_rgba(16,185,129,0.42)]",
        accordionIdle:
          "border-emerald-500/25 hover:border-emerald-400/55 hover:shadow-[0_10px_24px_rgba(16,185,129,0.24)] focus:ring-2 focus:ring-emerald-400",
        accordionBadge: "bg-black/75 border-emerald-500/35 text-emerald-300",
        accordionCaret: "text-emerald-300",
        accentText: "text-emerald-300",
        mutedText: "text-neutral-300",
        subMutedText: "text-neutral-400",
        toggleActive: "bg-emerald-500",
        toggleOff: "bg-neutral-700",
        subtlePill:
          "bg-emerald-950/50 border border-emerald-500/30 text-emerald-100 hover:bg-emerald-900/75",
        inputClass:
          "border-emerald-500/35 bg-black/85 text-white placeholder-neutral-500 focus:ring-2 focus:ring-emerald-400",
        optionBg: "bg-neutral-950 text-white",
        sliderClass: "bg-neutral-800 accent-emerald-400",
        highlightCard:
          "bg-gradient-to-r from-emerald-950/75 via-black/80 to-emerald-950/60 border-emerald-400/45",
        referralCard:
          "border-emerald-400/50 bg-gradient-to-r from-emerald-950/80 via-neutral-950/85 to-emerald-950/75 hover:from-emerald-900/80 hover:to-emerald-950/85 shadow-[0_10px_28px_rgba(16,185,129,0.22)] focus:ring-emerald-400",
        referralIcon: "bg-emerald-500/20 border-emerald-400/50",
        referralPill: "bg-emerald-500/20 border-emerald-400/45 text-emerald-200",
        secondaryBtn:
          "bg-black/70 hover:bg-emerald-950/70 border-emerald-500/30 text-neutral-200 hover:text-white",
        focusRing: "focus:ring-emerald-400",
      };
    case "amber":
      return {
        drawerShell:
          "bg-stone-950/82 border-amber-500/35 shadow-[0_25px_70px_rgba(0,0,0,0.95),0_0_32px_rgba(245,158,11,0.18)]",
        drawerOverlay:
          "from-amber-500/[0.08] via-stone-950/55 to-amber-950/20",
        scrollBtn:
          "bg-black/85 hover:bg-amber-950 border-amber-500/45 text-amber-300 hover:text-white shadow-[0_0_12px_rgba(245,158,11,0.35)]",
        headerBar: "bg-black/65 border-amber-500/30",
        avatarFrame:
          "border-amber-400/50 bg-stone-900 shadow-[0_0_14px_rgba(245,158,11,0.3)]",
        subPanel:
          "bg-stone-950/92 border-amber-500/30 shadow-[0_12px_35px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(245,158,11,0.08)]",
        subBox: "bg-black/75 border-amber-500/25",
        detailsBody: "bg-stone-950/85 border-amber-500/20",
        dividerBorder: "border-amber-500/20",
        accordionOverlay: "bg-stone-950/50",
        accordionActive:
          "ring-2 ring-amber-400/90 border-amber-400/65 shadow-[0_0_24px_rgba(245,158,11,0.42)]",
        accordionIdle:
          "border-amber-500/25 hover:border-amber-400/55 hover:shadow-[0_10px_24px_rgba(245,158,11,0.24)] focus:ring-2 focus:ring-amber-400",
        accordionBadge: "bg-black/75 border-amber-500/35 text-amber-300",
        accordionCaret: "text-amber-300",
        accentText: "text-amber-300",
        mutedText: "text-stone-300",
        subMutedText: "text-stone-400",
        toggleActive: "bg-amber-500",
        toggleOff: "bg-stone-700",
        subtlePill:
          "bg-amber-950/50 border border-amber-500/30 text-amber-100 hover:bg-amber-900/75",
        inputClass:
          "border-amber-500/35 bg-black/85 text-white placeholder-stone-500 focus:ring-2 focus:ring-amber-400",
        optionBg: "bg-stone-950 text-white",
        sliderClass: "bg-stone-800 accent-amber-400",
        highlightCard:
          "bg-gradient-to-r from-amber-950/75 via-black/80 to-amber-950/60 border-amber-400/45",
        referralCard:
          "border-amber-400/50 bg-gradient-to-r from-amber-950/80 via-stone-950/85 to-amber-950/75 hover:from-amber-900/80 hover:to-amber-950/85 shadow-[0_10px_28px_rgba(245,158,11,0.22)] focus:ring-amber-400",
        referralIcon: "bg-amber-500/20 border-amber-400/50",
        referralPill: "bg-amber-500/20 border-amber-400/45 text-amber-200",
        secondaryBtn:
          "bg-black/70 hover:bg-amber-950/70 border-amber-500/30 text-stone-200 hover:text-white",
        focusRing: "focus:ring-amber-400",
      };
    case "cyan":
      return {
        drawerShell:
          "bg-slate-950/82 border-cyan-500/35 shadow-[0_25px_70px_rgba(0,0,0,0.95),0_0_32px_rgba(6,182,212,0.18)]",
        drawerOverlay:
          "from-cyan-500/[0.08] via-slate-950/55 to-cyan-950/20",
        scrollBtn:
          "bg-black/85 hover:bg-cyan-950 border-cyan-500/45 text-cyan-300 hover:text-white shadow-[0_0_12px_rgba(6,182,212,0.35)]",
        headerBar: "bg-black/65 border-cyan-500/30",
        avatarFrame:
          "border-cyan-400/50 bg-slate-900 shadow-[0_0_14px_rgba(6,182,212,0.3)]",
        subPanel:
          "bg-slate-950/92 border-cyan-500/30 shadow-[0_12px_35px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(6,182,212,0.08)]",
        subBox: "bg-black/75 border-cyan-500/25",
        detailsBody: "bg-slate-950/85 border-cyan-500/20",
        dividerBorder: "border-cyan-500/20",
        accordionOverlay: "bg-slate-950/50",
        accordionActive:
          "ring-2 ring-cyan-400/90 border-cyan-400/65 shadow-[0_0_24px_rgba(6,182,212,0.42)]",
        accordionIdle:
          "border-cyan-500/25 hover:border-cyan-400/55 hover:shadow-[0_10px_24px_rgba(6,182,212,0.24)] focus:ring-2 focus:ring-cyan-400",
        accordionBadge: "bg-black/75 border-cyan-500/35 text-cyan-300",
        accordionCaret: "text-cyan-300",
        accentText: "text-cyan-300",
        mutedText: "text-slate-300",
        subMutedText: "text-slate-400",
        toggleActive: "bg-cyan-500",
        toggleOff: "bg-slate-700",
        subtlePill:
          "bg-cyan-950/50 border border-cyan-500/30 text-cyan-100 hover:bg-cyan-900/75",
        inputClass:
          "border-cyan-500/35 bg-black/85 text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-400",
        optionBg: "bg-slate-950 text-white",
        sliderClass: "bg-slate-800 accent-cyan-400",
        highlightCard:
          "bg-gradient-to-r from-cyan-950/75 via-black/80 to-cyan-950/60 border-cyan-400/45",
        referralCard:
          "border-cyan-400/50 bg-gradient-to-r from-cyan-950/80 via-slate-950/85 to-cyan-950/75 hover:from-cyan-900/80 hover:to-cyan-950/85 shadow-[0_10px_28px_rgba(6,182,212,0.22)] focus:ring-cyan-400",
        referralIcon: "bg-cyan-500/20 border-cyan-400/50",
        referralPill: "bg-cyan-500/20 border-cyan-400/45 text-cyan-200",
        secondaryBtn:
          "bg-black/70 hover:bg-cyan-950/70 border-cyan-500/30 text-slate-200 hover:text-white",
        focusRing: "focus:ring-cyan-400",
      };
    case "violet":
    default:
      return {
        drawerShell:
          "bg-slate-950/82 border-violet-500/35 shadow-[0_25px_70px_rgba(0,0,0,0.95),0_0_32px_rgba(139,92,246,0.18)]",
        drawerOverlay:
          "from-violet-500/[0.08] via-slate-950/55 to-purple-950/20",
        scrollBtn:
          "bg-black/85 hover:bg-purple-950 border-violet-500/45 text-violet-300 hover:text-white shadow-[0_0_12px_rgba(139,92,246,0.35)]",
        headerBar: "bg-black/65 border-violet-500/30",
        avatarFrame:
          "border-violet-400/50 bg-slate-900 shadow-[0_0_14px_rgba(139,92,246,0.3)]",
        subPanel:
          "bg-slate-950/92 border-violet-500/30 shadow-[0_12px_35px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(139,92,246,0.08)]",
        subBox: "bg-black/75 border-violet-500/25",
        detailsBody: "bg-slate-950/85 border-violet-500/20",
        dividerBorder: "border-violet-500/20",
        accordionOverlay: "bg-slate-950/50",
        accordionActive:
          "ring-2 ring-violet-400/90 border-violet-400/65 shadow-[0_0_24px_rgba(139,92,246,0.42)]",
        accordionIdle:
          "border-violet-500/25 hover:border-violet-400/55 hover:shadow-[0_10px_24px_rgba(139,92,246,0.24)] focus:ring-2 focus:ring-violet-400",
        accordionBadge: "bg-black/75 border-violet-500/35 text-violet-300",
        accordionCaret: "text-violet-300",
        accentText: "text-violet-300",
        mutedText: "text-slate-300",
        subMutedText: "text-slate-400",
        toggleActive: "bg-violet-600",
        toggleOff: "bg-slate-700",
        subtlePill:
          "bg-purple-950/50 border border-violet-500/30 text-purple-100 hover:bg-purple-900/75",
        inputClass:
          "border-violet-500/35 bg-black/85 text-white placeholder-slate-500 focus:ring-2 focus:ring-violet-400",
        optionBg: "bg-slate-950 text-white",
        sliderClass: "bg-slate-800 accent-violet-400",
        highlightCard:
          "bg-gradient-to-r from-purple-950/75 via-black/80 to-purple-950/60 border-violet-400/45",
        referralCard:
          "border-violet-400/50 bg-gradient-to-r from-purple-950/80 via-slate-950/85 to-purple-950/75 hover:from-purple-900/80 hover:to-purple-950/85 shadow-[0_10px_28px_rgba(139,92,246,0.22)] focus:ring-violet-400",
        referralIcon: "bg-violet-500/20 border-violet-400/50",
        referralPill: "bg-violet-500/20 border-violet-400/45 text-violet-200",
        secondaryBtn:
          "bg-black/70 hover:bg-purple-950/70 border-violet-500/30 text-slate-200 hover:text-white",
        focusRing: "focus:ring-violet-400",
      };
  }
}

export function Sidebar({
  isOpen,
  onClose,
  appTheme,
  cardSize,
  streamQuality,
  helpfulMouse,
  historyOverscale,
  largeButtons,
  savedProfileName,
  setSavedProfileName,
  userAgeInput,
  setUserAgeInput,
  profileNameInput,
  setProfileNameInput,
  isAdmin,
  isTrialActive,
  setIsTrialActive,
  trialDaysRemaining,
  bgMusicState,
  onBackgroundAudioToggle,
  onThemeChange,
  onSizeChange,
  onMouseToggle,
  onHistoryOverscaleChange,
  onLargeButtonsToggle,
  onOpenBugModal,
  onOpenBugFeedModal,
  onTriggerFirstStartModal,
  onOpenTosModal,
  onStartWalkthrough,
  allThemesList,
  getPrimaryBgColor,
  getPrimaryAccentColor,
}: SidebarProps) {
  const sidebarContentRef = useRef<HTMLDivElement>(null);
  const lastScrollYRef = useRef<number>(0);

  const [activeSection, setActiveSection] =
    useState<ConsolidatedSection>(null);
  const [isReferralModalOpen, setIsReferralModalOpen] =
    useState<boolean>(false);

  // Synced Settings States
  const [screensaverTimeoutMs, setScreensaverTimeoutMs] = useState<number>(() =>
    getSavedScreensaverTimeout()
  );
  const [sleepTimerMin, setSleepTimerMin] = useState<SleepTimerMinutes>(() =>
    getSleepTimerMinutes()
  );
  const [clockFormat, setClockFormatState] = useState<ClockFormat>(() =>
    getClockFormat()
  );
  const [showCornerClock, setShowCornerClockState] = useState<boolean>(() =>
    getShowCornerClock()
  );

  // Poster Appearance, Holiday & Layout States
  const [posterShape, setPosterShapeState] = useState<PosterShape>(() =>
    getPosterShape()
  );
  const [posterCardStyle, setPosterCardStyleState] = useState<PosterCardStyle>(
    () => getPosterCardStyle()
  );
  const [posterInfoLayout, setPosterInfoLayoutState] =
    useState<PosterInfoLayout>(() => getPosterInfoLayout());
  const [showPosterBadges, setShowPosterBadgesState] = useState<boolean>(() =>
    getShowPosterBadges()
  );
  const [glowIntensity, setGlowIntensityState] = useState<GlowIntensity>(() =>
    getGlowIntensity()
  );
  const [holidayOverride, setHolidayOverrideState] =
    useState<HolidayOverrideMode>(() => getHolidayPreviewOverride());
  const [visualResetMsg, setVisualResetMsg] = useState<string | null>(null);

  // Senior, TV & Personalization States
  const [seniorEasyMode, setSeniorEasyModeState] = useState<boolean>(() =>
    getSeniorEasyMode()
  );
  const [textScale, setTextScaleState] = useState<TextScale>(() =>
    getTextScale()
  );
  const [cursorStyle, setCursorStyleState] = useState<CursorStyle>(() =>
    getCursorStyle()
  );
  const [highContrastFocus, setHighContrastFocusState] = useState<boolean>(() =>
    getHighContrastFocus()
  );
  const [reducedMotion, setReducedMotionState] = useState<boolean>(() =>
    getReducedMotion()
  );
  const [uiClickSounds, setUiClickSoundsState] = useState<boolean>(() =>
    getUiClickSounds()
  );
  const [tvOverscan, setTvOverscanState] = useState<TvOverscanPercent>(() =>
    getTvOverscan()
  );
  const [subtitles, setSubtitlesState] = useState<SubtitleSettings>(() =>
    getSubtitleSettings()
  );
  const [profileMascot, setProfileMascotState] = useState<string>(() =>
    getActiveMascotBadge()
  );
  const [customBadges, setCustomBadges] = useState<MascotBadgeOption[]>(() =>
    getAllCustomMascotBadges()
  );
  const [mascotPickerTab, setMascotPickerTab] = useState<"custom" | "emoji">(
    () => (getAllCustomMascotBadges().length > 0 ? "custom" : "emoji")
  );
  const [greetingStyle, setGreetingStyleState] = useState<GreetingStyle>(() =>
    getGreetingStyle()
  );
  const [warmEyeCare, setWarmEyeCareState] = useState<boolean>(() =>
    getWarmEyeCare()
  );
  const [startupTab, setStartupTabState] = useState<StartupTab>(() =>
    getStartupTab()
  );
  const [favoriteChannelCount, setFavoriteChannelCount] = useState<number>(
    () => getFavoriteChannelIds().length
  );
  const [kidsLocked, setKidsLockedState] = useState<boolean>(() =>
    getKidsModeLocked()
  );
  const [kidsUnlockPin, setKidsUnlockPin] = useState<string>("");
  const [kidsLockStatus, setKidsLockStatus] = useState<string | null>(null);

  // Hardware & Stream Engine States
  const [ramMode, setRamModeState] = useState<RamMode>(() => getRamMode());
  const [dataSaverMode, setDataSaverModeState] = useState<boolean>(() =>
    getDataSaverMode()
  );
  const [activeStreamQuality, setActiveStreamQuality] =
    useState<StreamQuality>(streamQuality);
  const [autoPlayNext, setAutoPlayNextState] = useState<boolean>(() =>
    getAutoPlayNext()
  );
  const [defaultPlayerVolume, setDefaultPlayerVolumeState] = useState<number>(
    () => getDefaultPlayerVolume()
  );
  const [storageHealth, setStorageHealth] = useState<StorageHealthReport>(() =>
    getStorageHealth()
  );
  const [deviceId] = useState<string>(() => getOrCreateDeviceId());
  const [cacheClearMsg, setCacheClearMsg] = useState<string | null>(null);

  // Radio & Feed States (Default: Heart Dance in 2000s at 25% volume)
  const [bgMusicVolume, setBgMusicVolume] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const migrated = localStorage.getItem(HEART_DANCE_DEFAULT_MIGRATED_KEY);
      if (!migrated) return DEFAULT_RADIO_VOLUME;
      const saved = localStorage.getItem("rabtv_bg_volume");
      if (saved !== null) {
        const parsed = parseFloat(saved);
        if (!isNaN(parsed)) return Math.max(0, Math.min(1, parsed));
      }
    }
    return DEFAULT_RADIO_VOLUME;
  });

  const [currentStationUrl, setCurrentStationUrl] = useState<string>(() => {
    const heartDanceUrl = getDefaultHeartDanceStationUrl();
    if (typeof window !== "undefined") {
      const migrated = localStorage.getItem(HEART_DANCE_DEFAULT_MIGRATED_KEY);
      const saved = localStorage.getItem("rabtv_radio_url");
      if (!migrated && heartDanceUrl) {
        return heartDanceUrl;
      }
      if (saved) return saved;
    }
    return heartDanceUrl;
  });

  const [selectedGlobalFeed, setSelectedGlobalFeed] =
    useState<GlobalFeedOption>(() => {
      if (typeof window !== "undefined") {
        return (
          (localStorage.getItem("rabtv_global_feed") as GlobalFeedOption) ||
          "All (Default)"
        );
      }
      return "All (Default)";
    });

  // Profile / PIN / License States
  const [unifiedAgeCodeInput, setUnifiedAgeCodeInput] = useState<string>("");
  const [newPasscode, setNewPasscode] = useState<string>("");
  const [confirmNewPasscode, setConfirmNewPasscode] = useState<string>("");
  const [unifiedUpdateStatus, setUnifiedUpdateStatus] = useState<{
    text: string;
    isError: boolean;
  } | null>(null);

  const [unlockCodeInput, setUnlockCodeInput] = useState("");
  const [unlockStatusMsg, setUnlockStatusMsg] = useState<{
    text: string;
    isError: boolean;
  } | null>(null);

  const [updateChannel, setUpdateChannel] = useState<"stable" | "nightly">(
    () => {
      if (typeof window !== "undefined") {
        return (
          (localStorage.getItem("rabtv_update_channel") as
            | "stable"
            | "nightly") || "stable"
        );
      }
      return "stable";
    }
  );

  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const [remoteBranding, setRemoteBranding] = useState<BrandingAndFlagsConfig>(
    () => getCachedBrandingConfig()
  );

  const tokens = useMemo(() => getSidebarThemeTokens(appTheme), [appTheme]);

  // Sync all local sidebar controls whenever settings change
  const syncLocalControls = useCallback(() => {
    setScreensaverTimeoutMs(getSavedScreensaverTimeout());
    setSleepTimerMin(getSleepTimerMinutes());
    setClockFormatState(getClockFormat());
    setShowCornerClockState(getShowCornerClock());
    setPosterShapeState(getPosterShape());
    setPosterCardStyleState(getPosterCardStyle());
    setPosterInfoLayoutState(getPosterInfoLayout());
    setShowPosterBadgesState(getShowPosterBadges());
    setGlowIntensityState(getGlowIntensity());
    setHolidayOverrideState(getHolidayPreviewOverride());
    setSeniorEasyModeState(getSeniorEasyMode());
    setTextScaleState(getTextScale());
    setCursorStyleState(getCursorStyle());
    setHighContrastFocusState(getHighContrastFocus());
    setReducedMotionState(getReducedMotion());
    setUiClickSoundsState(getUiClickSounds());
    setTvOverscanState(getTvOverscan());
    setSubtitlesState(getSubtitleSettings());
    setProfileMascotState(getActiveMascotBadge());
    setCustomBadges(getAllCustomMascotBadges());
    setGreetingStyleState(getGreetingStyle());
    setWarmEyeCareState(getWarmEyeCare());
    setStartupTabState(getStartupTab());
    setFavoriteChannelCount(getFavoriteChannelIds().length);
    setKidsLockedState(getKidsModeLocked());
    setRamModeState(getRamMode());
    setDataSaverModeState(getDataSaverMode());
    setAutoPlayNextState(getAutoPlayNext());
    setDefaultPlayerVolumeState(getDefaultPlayerVolume());
    setStorageHealth(getStorageHealth());
    setRemoteBranding(getCachedBrandingConfig());
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    syncLocalControls();
    const controller = new AbortController();
    void syncRemoteMascotBadges(controller.signal).then((badges) => {
      if (!controller.signal.aborted) {
        setCustomBadges(badges);
        if (badges.length > 0) {
          setMascotPickerTab((prev) => (prev === "emoji" ? prev : "custom"));
        }
      }
    });
    window.addEventListener("rabtv_settings_updated", syncLocalControls);
    window.addEventListener("rabtv_holiday_updated", syncLocalControls);
    window.addEventListener(MASCOT_UPDATED_EVENT, syncLocalControls);
    window.addEventListener(ADMIN_STORE_UPDATED_EVENT, syncLocalControls);
    return () => {
      controller.abort();
      window.removeEventListener("rabtv_settings_updated", syncLocalControls);
      window.removeEventListener("rabtv_holiday_updated", syncLocalControls);
      window.removeEventListener(MASCOT_UPDATED_EVENT, syncLocalControls);
      window.removeEventListener(ADMIN_STORE_UPDATED_EVENT, syncLocalControls);
    };
  }, [isOpen, syncLocalControls]);

  useEffect(() => {
    setActiveStreamQuality(streamQuality);
  }, [streamQuality]);

  // Apply Heart Dance (2000s) + 25% Volume default cleanly on initial app boot
  useEffect(() => {
    if (typeof window === "undefined") return;
    const heartDanceUrl = getDefaultHeartDanceStationUrl();
    const migrated = localStorage.getItem(HEART_DANCE_DEFAULT_MIGRATED_KEY);
    const savedUrl = localStorage.getItem("rabtv_radio_url");
    const savedVol = localStorage.getItem("rabtv_bg_volume");

    if (!migrated) {
      localStorage.setItem(HEART_DANCE_DEFAULT_MIGRATED_KEY, "true");
      if (heartDanceUrl) {
        localStorage.setItem("rabtv_radio_url", heartDanceUrl);
        bgAudio.setStation(heartDanceUrl);
        setCurrentStationUrl(heartDanceUrl);
      }
      localStorage.setItem("rabtv_bg_volume", String(DEFAULT_RADIO_VOLUME));
      bgAudio.setVolume(DEFAULT_RADIO_VOLUME);
      setBgMusicVolume(DEFAULT_RADIO_VOLUME);
      return;
    }

    if (!savedUrl && heartDanceUrl) {
      localStorage.setItem("rabtv_radio_url", heartDanceUrl);
      bgAudio.setStation(heartDanceUrl);
      setCurrentStationUrl(heartDanceUrl);
    }

    if (savedVol === null) {
      localStorage.setItem("rabtv_bg_volume", String(DEFAULT_RADIO_VOLUME));
      bgAudio.setVolume(DEFAULT_RADIO_VOLUME);
      setBgMusicVolume(DEFAULT_RADIO_VOLUME);
    } else {
      const parsedVol = parseFloat(savedVol);
      if (!isNaN(parsedVol)) {
        bgAudio.setVolume(Math.max(0, Math.min(1, parsedVol)));
      }
    }
  }, []);

  // Close sidebar if main window scrolls significantly (paused while ReferralModal or Walkthrough is open)
  useEffect(() => {
    if (!isOpen || isReferralModalOpen || typeof window === "undefined") return;
    lastScrollYRef.current = window.scrollY;

    const handleWindowScroll = () => {
      if (document.body?.dataset?.walkthroughActive === "true") {
        lastScrollYRef.current = window.scrollY;
        return;
      }
      if (Math.abs(window.scrollY - lastScrollYRef.current) > 60) {
        setActiveSection(null);
        onClose();
      }
    };

    window.addEventListener("scroll", handleWindowScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleWindowScroll);
  }, [isOpen, isReferralModalOpen, onClose]);

  // Allow InteractiveWalkthrough to expand specific accordions & scroll them into view
  useEffect(() => {
    if (!isOpen || typeof window === "undefined") return;
    const handleTourSection = (event: Event) => {
      const custom = event as CustomEvent<{
        section?: ConsolidatedSection;
        scrollTarget?: string | null;
      }>;
      if (custom.detail && "section" in custom.detail) {
        setActiveSection(custom.detail.section ?? null);
      }
      if (custom.detail?.scrollTarget && sidebarContentRef.current) {
        const selector = `[data-tour="${custom.detail.scrollTarget}"]`;
        window.setTimeout(() => {
          const el = sidebarContentRef.current?.querySelector<HTMLElement>(selector);
          el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }, 90);
      }
    };
    window.addEventListener(SIDEBAR_SECTION_EVENT, handleTourSection);
    return () =>
      window.removeEventListener(SIDEBAR_SECTION_EVENT, handleTourSection);
  }, [isOpen]);

  // D-pad / Arrow Key navigation handler with smooth scroll-into-view
  useEffect(() => {
    if (!isOpen || isReferralModalOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!sidebarContentRef.current) return;
      const focusables = Array.from(
        sidebarContentRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, summary, [tabindex]:not([tabindex="-1"])'
        )
      ).filter(
        (el) => !el.hasAttribute("disabled") && el.offsetParent !== null
      );

      if (focusables.length === 0) return;

      const currentIndex = focusables.findIndex(
        (el) => el === document.activeElement
      );

      if (e.key === "ArrowDown") {
        e.preventDefault();
        const nextIndex =
          currentIndex < focusables.length - 1 ? currentIndex + 1 : 0;
        focusables[nextIndex]?.focus();
        focusables[nextIndex]?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const prevIndex =
          currentIndex > 0 ? currentIndex - 1 : focusables.length - 1;
        focusables[prevIndex]?.focus();
        focusables[prevIndex]?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      } else if (e.key === "Escape") {
        setActiveSection(null);
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isReferralModalOpen, onClose]);

  if (!isOpen) return null;

  const handleCloseSidebar = () => {
    setActiveSection(null);
    setIsReferralModalOpen(false);
    onClose();
  };

  const handleScrollSidebar = (direction: "up" | "down") => {
    if (sidebarContentRef.current) {
      sidebarContentRef.current.scrollBy({
        top: direction === "down" ? 200 : -200,
        behavior: "smooth",
      });
    }
  };

  const handleScreensaverTimeoutChange = (newMs: number) => {
    setScreensaverTimeoutMs(newMs);
    saveScreensaverTimeout(newMs);
  };

  const handleVolumeChange = (newVol: number) => {
    const clamped = Math.max(0, Math.min(1, newVol));
    setBgMusicVolume(clamped);
    if (typeof window !== "undefined") {
      localStorage.setItem("rabtv_bg_volume", String(clamped));
    }
    bgAudio.setVolume(clamped);
  };

  const handleStationSelect = (url: string) => {
    bgAudio.setStation(url);
    setCurrentStationUrl(url);
    if (typeof window !== "undefined") {
      localStorage.setItem("rabtv_radio_url", url);
    }
    if (bgMusicState === "playing") {
      bgAudio.play();
    }
  };

  const handleRamModeChange = (mode: RamMode) => {
    setRamModeState(mode);
    setRamMode(mode);
  };

  const handleStreamQualitySelect = (quality: StreamQuality) => {
    saveStreamQuality(quality);
    setActiveStreamQuality(quality);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("rabtv_settings_updated"));
    }
  };

  const handlePurgeVolatileCaches = () => {
    const count = purgeOldTmdbCaches();
    setStorageHealth(getStorageHealth());
    setCacheClearMsg(
      count > 0
        ? `✓ Purged ${count} cached stream & metadata buffers!`
        : "✓ Storage caches are already clean!"
    );
    window.setTimeout(() => setCacheClearMsg(null), 3500);
  };

  const handleResetVisualDefaults = () => {
    resetVisualSettings();
    setHolidayPreviewOverride("auto");
    setHolidayOverrideState("auto");
    setVisualResetMsg("✓ Visual & poster styles restored to defaults!");
    window.setTimeout(() => setVisualResetMsg(null), 3000);
  };

  const handleGlobalFeedChange = (feed: GlobalFeedOption) => {
    setSelectedGlobalFeed(feed);
    if (typeof window !== "undefined") {
      localStorage.setItem("rabtv_global_feed", feed);
      window.dispatchEvent(
        new CustomEvent("rabtv_global_feed_updated", { detail: feed })
      );
    }
  };

  const handleUpdateChannelChange = (channel: "stable" | "nightly") => {
    setUpdateChannel(channel);
    if (typeof window !== "undefined") {
      localStorage.setItem("rabtv_update_channel", channel);
    }
  };

  const handleKidsLockToggle = async () => {
    if (!kidsLocked) {
      setKidsModeLocked(true);
      setKidsLockedState(true);
      setKidsLockStatus("🧒 Kids Safe Mode locked ON (Under-13 filter active).");
      window.setTimeout(() => setKidsLockStatus(null), 3000);
      return;
    }

    const lockState = getPinLockoutState();
    if (lockState.isLocked) {
      setKidsLockStatus(
        `⏳ Too many attempts. Wait ${lockState.remainingSeconds}s.`
      );
      return;
    }

    const ok = await verifyAgeLockPin(kidsUnlockPin);
    if (!ok) {
      const next = recordPinFailure();
      setKidsUnlockPin("");
      setKidsLockStatus(
        next.isLocked
          ? `🚨 Locked for ${next.remainingSeconds}s due to failed PINs.`
          : `⚠️ Enter your 4–6 digit PIN to turn Kids Mode off (${next.attemptsLeft} tries left).`
      );
      return;
    }

    resetPinFailures();
    setKidsModeLocked(false);
    setKidsLockedState(false);
    setKidsUnlockPin("");
    setKidsLockStatus("🔓 Kids Safe Mode unlocked.");
    window.setTimeout(() => setKidsLockStatus(null), 3000);
  };

  const handleUnifiedProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    const lockState = getPinLockoutState();
    if (lockState.isLocked) {
      setUnifiedUpdateStatus({
        text: `⏳ PIN cooldown active. Wait ${lockState.remainingSeconds}s.`,
        isError: true,
      });
      return;
    }

    const validCurrent = await verifyAgeLockPin(unifiedAgeCodeInput);
    if (!validCurrent) {
      const next = recordPinFailure();
      setUnifiedUpdateStatus({
        text: next.isLocked
          ? `🚨 Too many failed PINs. Locked for ${next.remainingSeconds}s.`
          : `⚠️ Current 4–6 digit PIN is incorrect (${next.attemptsLeft} tries left).`,
        isError: true,
      });
      setUnifiedAgeCodeInput("");
      return;
    }

    resetPinFailures();

    const parsedAge = parseInt(userAgeInput, 10);
    if (isNaN(parsedAge) || parsedAge < 1 || parsedAge > 120) {
      setUnifiedUpdateStatus({
        text: "⚠️ Please enter a valid age (1–120).",
        isError: true,
      });
      return;
    }

    const trimmedNew = newPasscode.trim();
    const trimmedConfirm = confirmNewPasscode.trim();

    if (trimmedNew || trimmedConfirm) {
      if (!isValidAgeLockPin(trimmedNew)) {
        setUnifiedUpdateStatus({
          text: "⚠️ New PIN must be 4 to 6 digits (numbers only).",
          isError: true,
        });
        return;
      }
      if (trimmedNew !== trimmedConfirm) {
        setUnifiedUpdateStatus({
          text: "⚠️ New PIN codes do not match.",
          isError: true,
        });
        return;
      }
      await saveAgeLockPinSecure(trimmedNew);
    }

    saveUserAge(parsedAge);
    const finalName = profileNameInput.trim() || "Friend";
    if (typeof window !== "undefined") {
      localStorage.setItem("rabtv_profile_name", finalName);
    }
    setSavedProfileName(finalName);

    setUnifiedUpdateStatus({
      text: "✓ Profile & hashed PIN updated securely!",
      isError: false,
    });
    setUnifiedAgeCodeInput("");
    setNewPasscode("");
    setConfirmNewPasscode("");
    window.setTimeout(() => setUnifiedUpdateStatus(null), 3500);
    snapshotActiveProfile();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("rabtv_settings_updated"));
    }
  };

  const handleUpgradeFromProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const name =
      savedProfileName ||
      (typeof window !== "undefined"
        ? localStorage.getItem("rabtv_profile_name")
        : "") ||
      "Friend";
    const age = getSavedUserAge() || parseInt(userAgeInput, 10) || 0;

    const GIST_ID = ((import.meta as any).env?.VITE_GIST_ID as string) || "";
    const GITHUB_TOKEN =
      ((import.meta as any).env?.VITE_GH_PAT as string) || "";
    const GIST_API_URL = GIST_ID
      ? `https://api.github.com/gists/${GIST_ID}`
      : "";

    let isValidGitHubCode = false;
    if (GIST_ID && GITHUB_TOKEN && GIST_API_URL) {
      try {
        const res = await fetch(GIST_API_URL, {
          headers: {
            Authorization: `Bearer ${GITHUB_TOKEN}`,
            Accept: "application/vnd.github+json",
            "User-Agent": "RabbitTV-App",
          },
          cache: "no-store",
        });
        if (res.ok) {
          const gistData = await res.json();
          const rawContent = gistData.files?.["keys.json"]?.content;
          if (rawContent) {
            const keysList = JSON.parse(rawContent);
            if (Array.isArray(keysList)) {
              const matchedIndex = keysList.findIndex((item: any) =>
                typeof item === "object" && item !== null
                  ? String(item.key).trim() === String(unlockCodeInput.trim()) &&
                    item.active === true
                  : String(item).trim() === String(unlockCodeInput.trim())
              );
              if (matchedIndex !== -1) {
                isValidGitHubCode = true;
                if (typeof keysList[matchedIndex] === "object") {
                  keysList[matchedIndex].active = false;
                  keysList[matchedIndex].usedBy = `${name} (Age: ${age})`;
                  keysList[matchedIndex].claimedAt = new Date().toISOString();
                } else {
                  keysList.splice(matchedIndex, 1);
                }
                await fetch(GIST_API_URL, {
                  method: "PATCH",
                  headers: {
                    Authorization: `Bearer ${GITHUB_TOKEN}`,
                    Accept: "application/vnd.github+json",
                    "Content-Type": "application/json",
                    "User-Agent": "RabbitTV-App",
                  },
                  body: JSON.stringify({
                    files: {
                      "keys.json": {
                        content: JSON.stringify(keysList, null, 2),
                      },
                    },
                  }),
                });
              }
            }
          }
        }
      } catch (err) {
        console.error("Upgrade error", err);
      }
    }

    if (isValidGitHubCode) {
      if (typeof window !== "undefined") {
        localStorage.setItem("rabtv_access_status", "permanent");
        localStorage.removeItem("rabtv_trial_start_timestamp");
      }
      setIsTrialActive(false);
      sendPermanentActivationAlert(name);
      setUnlockStatusMsg({
        text: "✅ Successfully upgraded to Full Access!",
        isError: false,
      });
      setUnlockCodeInput("");
      window.setTimeout(() => {
        setUnlockStatusMsg(null);
        handleCloseSidebar();
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("rabtv_settings_updated"));
        }
      }, 2500);
    } else {
      setUnlockStatusMsg({
        text: "❌ Invalid unlock code for this profile name and age.",
        isError: true,
      });
    }
  };

  const handleSaveBackup = () => {
    const backupData = {
      ...exportAllSettingsSnapshot(),
      profileName: savedProfileName,
      myList:
        typeof window !== "undefined"
          ? localStorage.getItem("rabtv_my_list")
          : null,
      favorites:
        typeof window !== "undefined"
          ? localStorage.getItem("rabtv_favorites")
          : null,
      backedUpAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "rabtv_profile_backup.json";
    a.click();
    URL.revokeObjectURL(url);
    setBackupStatus("✓ Full profile & style backup exported!");
    window.setTimeout(() => setBackupStatus(null), 3000);
  };

  const handleRestoreBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        const result = importSettingsSnapshot(data);
        if (!result.valid) {
          setBackupStatus("⚠️ Invalid or empty backup file.");
          return;
        }

        if (typeof data.profileName === "string" && data.profileName.trim()) {
          const safeName = data.profileName.trim().slice(0, 25);
          localStorage.setItem("rabtv_profile_name", safeName);
          setSavedProfileName(safeName);
        }
        if (typeof data.myList === "string") {
          localStorage.setItem("rabtv_my_list", data.myList);
        }
        if (typeof data.favorites === "string") {
          localStorage.setItem("rabtv_favorites", data.favorites);
        }

        localStorage.removeItem(DISCLAIMER_ACCEPTED_KEY);
        localStorage.removeItem("rabtv_access_status");
        localStorage.removeItem("rabtv_is_admin");

        onTriggerFirstStartModal();
        handleCloseSidebar();
        setBackupStatus(
          `✓ Restored ${result.appliedCount} settings. Please verify access.`
        );
      } catch {
        setBackupStatus("⚠️ Failed to restore backup file.");
      }
    };
    reader.readAsText(file);
  };

  const crystalSubPanelClass = `relative w-full p-3.5 sm:p-4 rounded-2xl mt-2 overflow-hidden box-border backdrop-blur-xl border space-y-3.5 ${tokens.subPanel}`;

  const toggleSection = (section: ConsolidatedSection) => {
    setActiveSection((prev) => (prev === section ? null : section));
  };

  let activeStationName = "Heart Dance";
  for (const stations of Object.values(RADIO_STATIONS)) {
    const match = stations.find(
      (s) =>
        s.url === currentStationUrl ||
        (!currentStationUrl && bgAudio.getCurrentStation().url === s.url)
    );
    if (match) {
      activeStationName = match.name;
      break;
    }
  }

  const holidayOptions = getAllHolidayOptions();

  const renderCrystalAccordionButton = (
    sectionId: ConsolidatedSection,
    icon: string,
    title: string,
    subtitleBadge?: string
  ) => {
    const isActive = activeSection === sectionId;
    return (
      <button
        type="button"
        onClick={() => toggleSection(sectionId)}
        className={`crystal-menu-pill w-full max-w-full flex items-center justify-between gap-2 px-3 sm:px-3.5 py-2.5 sm:py-3 text-left text-xs font-extrabold text-white relative overflow-hidden rounded-2xl border cursor-pointer box-border transition-all duration-200 ease-out hover:brightness-110 active:scale-[0.99] focus:outline-none ${
          isActive ? tokens.accordionActive : tokens.accordionIdle
        }`}
      >
        <div
          className="rabtv-sb-pill-art absolute inset-0 pointer-events-none z-0"
          style={{
            backgroundImage: `url(${isActive ? RABBIT_PILL_ACTIVE : RABBIT_PILL_INACTIVE})`,
            backgroundSize: "100% 100%",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "center center",
            opacity: isActive ? 0.96 : 0.88,
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-[#0c0a09]/35 to-[#0c0a09]/55 w-full h-full" />
        </div>

        <span className="relative z-10 flex items-center gap-2 min-w-0 drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]">
          <span className="text-sm shrink-0">{icon}</span>
          <span className="truncate">{title}</span>
        </span>

        <div className="relative z-10 flex items-center gap-1.5 shrink-0">
          {subtitleBadge && (
            <span
              className={`rounded-full border px-2 py-0.5 text-[9px] font-bold whitespace-nowrap ${tokens.accordionBadge}`}
            >
              {subtitleBadge}
            </span>
          )}
          <span
            className={`text-[10px] transform transition-transform duration-200 ${
              tokens.accordionCaret
            } ${isActive ? "rotate-180" : ""}`}
          >
            ▼
          </span>
        </div>
      </button>
    );
  };

  return (
    <div className="rabtv-vidsrc-protected fixed inset-0 z-50 flex justify-end items-center sm:items-start p-2 sm:pt-[76px] xl:pt-[104px] sm:pr-4 sm:pb-3 pointer-events-none">
      <style>{`
        :root, html[data-theme="violet"] { --rabtv-sb-filter: hue-rotate(-78deg) saturate(1.12) brightness(1.02); }
        html[data-theme="red"] { --rabtv-sb-filter: hue-rotate(0deg) saturate(1.08) brightness(1.0); }
        html[data-theme="midnight"] { --rabtv-sb-filter: hue-rotate(-132deg) saturate(1.14) brightness(1.04); }
        html[data-theme="emerald"] { --rabtv-sb-filter: hue-rotate(154deg) saturate(1.10) brightness(1.02); }
        html[data-theme="amber"] { --rabtv-sb-filter: hue-rotate(28deg) saturate(1.14) brightness(1.04); }
        html[data-theme="cyan"] { --rabtv-sb-filter: hue-rotate(-154deg) saturate(1.12) brightness(1.04); }
        .rabtv-sb-pill-art { filter: var(--rabtv-sb-filter); }
        .rabtv-sb-9slice-shell {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-image: url("${RABBIT_DRAWER_FRAME}");
          background-size: 100% 100%;
          background-position: center center;
          background-repeat: no-repeat;
          filter: var(--rabtv-sb-filter);
          pointer-events: none;
          z-index: 0;
        }
        @keyframes crystalBladeSwipeIn {
          0% {
            opacity: 0;
            transform: translate3d(40px, -18px, 0) scale(0.94);
          }
          100% {
            opacity: 1;
            transform: translate3d(0, 0, 0) scale(1);
          }
        }
        .animate-crystal-blade-in {
          animation: crystalBladeSwipeIn 0.26s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          transform-origin: top right;
        }
      `}</style>

      {/* Light Transparent Backdrop so Background Media/Catalog Stays Visible */}
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-[2px] pointer-events-auto transition-opacity duration-300"
        onClick={handleCloseSidebar}
      />

      {/* Armored Punk-Neon Console Blade Drawer (9-Sliced — Zero Border Stretch & 100% Safe Inner Bay) */}
      <div
        data-tour="sidebar"
        className={`relative w-full max-w-[min(420px,calc(100vw-16px))] h-[calc(100dvh-16px)] sm:h-[calc(100dvh-92px)] xl:h-[calc(100dvh-120px)] max-h-[calc(100dvh-16px)] rounded-[28px] bg-[#0c0a09]/96 flex flex-col z-10 animate-crystal-blade-in overflow-hidden pt-14 pb-14 px-9 sm:px-10 pointer-events-auto box-border backdrop-blur-2xl ${tokens.drawerShell}`}
      >
        {/* 9-Sliced Punk-Neon Armored Outer Frame (Reused rabbit-tv-community-card-frame.jpg) */}
        <div className="rabtv-sb-9slice-shell" aria-hidden="true" />
        <div
          className={`absolute inset-0 bg-gradient-to-b pointer-events-none z-0 ${tokens.drawerOverlay}`}
        />

        {/* Scroll Up Arrow Button */}
        <button
          type="button"
          onClick={() => handleScrollSidebar("up")}
          className={`absolute top-4 left-1/2 -translate-x-1/2 z-20 w-14 h-6 border rounded-full flex items-center justify-center text-xs font-bold transition hover:scale-105 cursor-pointer ${tokens.scrollBtn}`}
          title="Scroll Up"
          aria-label="Scroll sidebar up"
        >
          ▲
        </button>

        {/* Scrollable Inner Container (Strictly Clipped Inside Neon Frame Safe Zone) */}
        <div
          ref={sidebarContentRef}
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-1.5 pt-2 pb-5 w-full max-w-full rounded-2xl scrollbar-none relative z-10 box-border"
          style={{
            maskImage:
              "linear-gradient(to bottom, transparent 0%, black 2.5%, black 97.5%, transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(to bottom, transparent 0%, black 2.5%, black 97.5%, transparent 100%)",
          }}
        >
          <div className="relative z-10 flex flex-col w-full box-border space-y-3 pb-4">
            {/* Crystal Profile Header Bar (Constrained & Non-Squishing Inside Neon Frame) */}
            <div
              data-tour="sidebar-profile-header"
              className={`flex flex-col gap-2.5 rounded-2xl backdrop-blur-xl border p-3 shadow-lg w-full max-w-full overflow-hidden box-border ${tokens.headerBar}`}
            >
              <div className="flex items-center gap-2.5 min-w-0 w-full">
                <MascotAvatar
                  mascot={profileMascot}
                  size="md"
                  rounded="xl"
                  className={`border shrink-0 ${tokens.avatarFrame}`}
                  alt={savedProfileName || "User Profile"}
                />
                <div className="min-w-0 flex-1">
                  <h3
                    className={`text-sm font-black tracking-wide truncate ${getPrimaryAccentColor(
                      appTheme
                    )}`}
                  >
                    {savedProfileName || "User Profile"}
                  </h3>
                  <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-bold whitespace-nowrap">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span>Online</span>
                    </span>
                    <span
                      className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border whitespace-nowrap ${tokens.subBox} ${tokens.mutedText}`}
                    >
                      {ramMode === "low"
                        ? "1-2GB Stick"
                        : ramMode === "high"
                          ? "High RAM"
                          : "Auto RAM"}
                    </span>
                    {seniorEasyMode && (
                      <span
                        className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border whitespace-nowrap ${tokens.accordionBadge}`}
                      >
                        Easy
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 w-full">
                <button
                  type="button"
                  onClick={() => {
                    handleCloseSidebar();
                    triggerOpenProfileSwitcher();
                  }}
                  className={`w-full px-2.5 py-1.5 rounded-xl border text-[11px] font-extrabold whitespace-nowrap transition active:scale-95 cursor-pointer ${tokens.subtlePill}`}
                  title="Switch or Manage Household Profiles"
                >
                  👥 Profiles
                </button>
                <button
                  type="button"
                  onClick={handleCloseSidebar}
                  className={`w-full px-2.5 py-1.5 rounded-xl border text-[11px] font-bold whitespace-nowrap transition active:scale-95 cursor-pointer ${tokens.secondaryBtn}`}
                >
                  ✕ Close
                </button>
              </div>
            </div>

            {/* CONSOLIDATED CRYSTAL NEON ACCORDIONS */}
            <div className="space-y-2.5 w-full box-border pt-0.5">
              {/* 1. FEED, STARTUP & HISTORY */}
              <div data-tour="sidebar-feed-history" className="w-full box-border">
                {renderCrystalAccordionButton(
                  "feedAndHistory",
                  "🌐",
                  "Feed & Startup",
                  selectedGlobalFeed === "All (Default)"
                    ? startupTab
                    : selectedGlobalFeed
                )}

                {activeSection === "feedAndHistory" && (
                  <div className={crystalSubPanelClass}>
                    <div>
                      <p className={`text-[11px] font-bold mb-1.5 ${tokens.mutedText}`}>
                        Region / Language Catalog Feed:
                      </p>
                      <select
                        value={selectedGlobalFeed}
                        onChange={(e) =>
                          handleGlobalFeedChange(
                            e.target.value as GlobalFeedOption
                          )
                        }
                        className={`h-10 w-full rounded-xl border px-3 text-xs font-bold focus:outline-none cursor-pointer ${tokens.inputClass}`}
                      >
                        {globalFeedOptions.map((opt) => (
                          <option
                            key={opt}
                            value={opt}
                            className={tokens.optionBg}
                          >
                            🌐 {opt}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className={`pt-2.5 border-t ${tokens.dividerBorder}`}>
                      <p className={`text-[11px] font-bold mb-1.5 ${tokens.mutedText}`}>
                        Favorite Startup Screen:
                      </p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {STARTUP_TAB_OPTIONS.map((tab) => (
                          <button
                            key={tab}
                            type="button"
                            onClick={() => {
                              setStartupTab(tab);
                              setStartupTabState(tab);
                            }}
                            className={`rounded-xl py-2 px-2 text-[11px] font-bold whitespace-nowrap truncate transition-all cursor-pointer hover:scale-[1.03] ${
                              startupTab === tab
                                ? `${getPrimaryBgColor(
                                    appTheme
                                  )} text-white shadow-md`
                                : tokens.subtlePill
                            }`}
                          >
                            {tab}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className={`pt-2.5 border-t space-y-2 ${tokens.dividerBorder}`}>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className={`font-bold ${tokens.mutedText}`}>
                          ⭐ Pinned Live Channels:
                        </span>
                        <span className={`font-extrabold ${tokens.accentText}`}>
                          {favoriteChannelCount} / {MAX_FAVORITE_CHANNELS}
                        </span>
                      </div>

                      <div
                        className={`grid gap-2 ${
                          remoteBranding.liveTvEnabled !== false
                            ? "grid-cols-2"
                            : "grid-cols-1"
                        }`}
                      >
                        {remoteBranding.liveTvEnabled !== false && (
                          <Link
                            to="/live-tv"
                            onClick={handleCloseSidebar}
                            className={`flex h-9 items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-bold transition hover:scale-[1.02] ${tokens.subtlePill}`}
                          >
                            <span>📡 Live TV</span>
                          </Link>
                        )}
                        <Link
                          to="/watch-history"
                          onClick={handleCloseSidebar}
                          className={`flex h-9 items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-extrabold shadow-md transition hover:scale-[1.02] ${getPrimaryBgColor(
                            appTheme
                          )}`}
                        >
                          <span>Watch History</span>
                        </Link>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 2. THEMES, POSTER STYLES & HOLIDAY OVERLAY */}
              <div data-tour="sidebar-themes-posters" className="w-full box-border">
                {renderCrystalAccordionButton(
                  "themesAndScale",
                  "🎨",
                  "Themes & Posters",
                  appTheme.toUpperCase()
                )}

                {activeSection === "themesAndScale" && (
                  <div className={crystalSubPanelClass}>
                    {/* App Themes */}
                    <div>
                      <p className={`text-[11px] mb-1.5 font-bold ${tokens.mutedText}`}>
                        Neon App Theme:
                      </p>
                      <div className="grid grid-cols-2 gap-2 w-full">
                        {allThemesList.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => onThemeChange(t.id)}
                            className={`rounded-xl p-2 text-xs font-bold whitespace-nowrap truncate transition-all text-left w-full cursor-pointer hover:scale-[1.03] ${
                              appTheme === t.id
                                ? `${getPrimaryBgColor(
                                    t.id
                                  )} text-white shadow-md ring-1 ring-white/40`
                                : tokens.subtlePill
                            }`}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Poster Corner Shape */}
                    <div className={`pt-2.5 border-t ${tokens.dividerBorder}`}>
                      <p className={`text-[11px] mb-1.5 font-bold ${tokens.mutedText}`}>
                        Poster Corner Shape:
                      </p>
                      <div className="grid grid-cols-3 gap-1.5">
                        {POSTER_SHAPE_OPTIONS.map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              setPosterShape(opt.id);
                              setPosterShapeState(opt.id);
                            }}
                            className={`rounded-xl py-2 px-1 text-[10px] font-bold leading-tight text-center transition-all cursor-pointer hover:scale-[1.03] ${
                              posterShape === opt.id
                                ? `${getPrimaryBgColor(
                                    appTheme
                                  )} text-white shadow-md`
                                : tokens.subtlePill
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Poster Frame Style */}
                    <div className={`pt-2.5 border-t ${tokens.dividerBorder}`}>
                      <p className={`text-[11px] mb-1.5 font-bold ${tokens.mutedText}`}>
                        Poster Frame Style:
                      </p>
                      <div className="space-y-1.5">
                        {POSTER_CARD_STYLE_OPTIONS.map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              setPosterCardStyle(opt.id);
                              setPosterCardStyleState(opt.id);
                            }}
                            className={`w-full rounded-xl px-3 py-2 text-left transition-all cursor-pointer hover:scale-[1.02] ${
                              posterCardStyle === opt.id
                                ? `${getPrimaryBgColor(
                                    appTheme
                                  )} text-white shadow-md ring-1 ring-white/30`
                                : tokens.subtlePill
                            }`}
                          >
                            <span className="block text-xs font-extrabold">
                              {opt.label}
                            </span>
                            <span className="block text-[10px] opacity-85">
                              {opt.desc}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Poster Info Layout */}
                    <div className={`pt-2.5 border-t ${tokens.dividerBorder}`}>
                      <p className={`text-[11px] mb-1.5 font-bold ${tokens.mutedText}`}>
                        Poster Information Layout:
                      </p>
                      <div className="space-y-1.5">
                        {POSTER_INFO_LAYOUT_OPTIONS.map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              setPosterInfoLayout(opt.id);
                              setPosterInfoLayoutState(opt.id);
                            }}
                            className={`w-full rounded-xl px-3 py-2 text-left transition-all cursor-pointer hover:scale-[1.02] ${
                              posterInfoLayout === opt.id
                                ? `${getPrimaryBgColor(
                                    appTheme
                                  )} text-white shadow-md ring-1 ring-white/30`
                                : tokens.subtlePill
                            }`}
                          >
                            <span className="block text-xs font-extrabold">
                              {opt.label}
                            </span>
                            <span className="block text-[10px] opacity-85">
                              {opt.desc}
                            </span>
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-3">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white">
                            Show Rating & Status Badges
                          </p>
                          <p className={`text-[10px] ${tokens.mutedText}`}>
                            Toggle floating star tags on posters.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const next = !showPosterBadges;
                            setShowPosterBadges(next);
                            setShowPosterBadgesState(next);
                          }}
                          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                            showPosterBadges
                              ? tokens.toggleActive
                              : tokens.toggleOff
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                              showPosterBadges
                                ? "translate-x-6"
                                : "translate-x-1"
                            }`}
                          />
                        </button>
                      </div>
                    </div>

                    {/* Catalog Card Size */}
                    <div className={`pt-2.5 border-t ${tokens.dividerBorder}`}>
                      <p className={`text-[11px] mb-1.5 font-bold ${tokens.mutedText}`}>
                        Catalog Poster Grid Size:
                      </p>
                      <div className="grid grid-cols-3 gap-1.5">
                        {(["small", "medium", "large"] as CardSize[]).map(
                          (size) => (
                            <button
                              key={size}
                              type="button"
                              onClick={() => onSizeChange(size)}
                              className={`rounded-xl py-2 text-xs font-bold capitalize transition-all cursor-pointer hover:scale-105 ${
                                cardSize === size
                                  ? `${getPrimaryBgColor(
                                      appTheme
                                    )} text-white shadow-md`
                                  : tokens.subtlePill
                              }`}
                            >
                              {size}
                            </button>
                          )
                        )}
                      </div>
                    </div>

                    {/* History Page Overscale */}
                    <div className={`pt-2.5 border-t ${tokens.dividerBorder}`}>
                      <p className={`text-[11px] mb-1.5 font-bold ${tokens.mutedText}`}>
                        Watch History Overscale:
                      </p>
                      <div className="grid grid-cols-4 gap-1.5">
                        {(
                          ["off", "20%", "50%", "80%"] as HistoryScale[]
                        ).map((scale) => (
                          <button
                            key={scale}
                            type="button"
                            onClick={() => onHistoryOverscaleChange(scale)}
                            className={`rounded-xl py-1.5 text-xs font-bold capitalize transition-all cursor-pointer hover:scale-105 ${
                              historyOverscale === scale
                                ? `${getPrimaryBgColor(
                                    appTheme
                                  )} text-white shadow-md`
                                : tokens.subtlePill
                            }`}
                          >
                            {scale === "off" ? "Off" : `+${scale}`}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 3D Seasonal Holiday Overlay Mode */}
                    <div className={`pt-2.5 border-t ${tokens.dividerBorder}`}>
                      <p className={`text-[11px] mb-1.5 font-bold ${tokens.mutedText}`}>
                        ✨ 3D Seasonal Holiday Overlay:
                      </p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {holidayOptions.map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              setHolidayPreviewOverride(opt.id);
                              setHolidayOverrideState(opt.id);
                            }}
                            className={`rounded-xl py-1.5 px-2 text-[10px] font-bold truncate transition-all cursor-pointer hover:scale-[1.03] ${
                              holidayOverride === opt.id
                                ? `${getPrimaryBgColor(
                                    appTheme
                                  )} text-white shadow-md`
                                : tokens.subtlePill
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Neon Glow Intensity + Safe Visual Reset */}
                    <div className={`pt-2.5 border-t space-y-2.5 ${tokens.dividerBorder}`}>
                      <div>
                        <p className={`text-[11px] mb-1.5 font-bold ${tokens.mutedText}`}>
                          Neon Glow Intensity:
                        </p>
                        <div className="grid grid-cols-3 gap-1.5">
                          {GLOW_INTENSITY_OPTIONS.map((opt) => (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => {
                                setGlowIntensity(opt.id);
                                setGlowIntensityState(opt.id);
                              }}
                              className={`rounded-xl py-1.5 px-1 text-[10px] font-bold transition-all cursor-pointer hover:scale-105 ${
                                glowIntensity === opt.id
                                  ? `${getPrimaryBgColor(
                                      appTheme
                                    )} text-white shadow-md`
                                  : tokens.subtlePill
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleResetVisualDefaults}
                        className={`w-full py-2 px-2 rounded-xl border text-[11px] font-bold transition cursor-pointer ${tokens.secondaryBtn}`}
                      >
                        ↺ Reset Visual & Poster Defaults
                      </button>
                      {visualResetMsg && (
                        <p className="text-[11px] font-bold text-emerald-400 text-center">
                          {visualResetMsg}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* 3. BACKGROUND LOBBY RADIO */}
              <div data-tour="sidebar-radio" className="w-full box-border">
                {renderCrystalAccordionButton(
                  "audio",
                  "🎵",
                  "Lobby Radio",
                  bgMusicState === "playing"
                    ? `${Math.round(bgMusicVolume * 100)}%`
                    : "MUTED"
                )}

                {activeSection === "audio" && (
                  <div className={crystalSubPanelClass}>
                    <div
                      className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 ${tokens.subBox}`}
                    >
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider shrink-0 ${tokens.subMutedText}`}
                      >
                        Station:
                      </span>
                      <span className={`text-xs font-extrabold truncate ${tokens.accentText}`}>
                        📻 {activeStationName}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => onBackgroundAudioToggle("playing")}
                        className={`rounded-xl py-2 text-xs font-bold transition-all cursor-pointer hover:scale-[1.03] ${
                          bgMusicState === "playing"
                            ? `${getPrimaryBgColor(
                                appTheme
                              )} text-white shadow-md`
                            : tokens.subtlePill
                        }`}
                      >
                        🎵 Radio ON
                      </button>
                      <button
                        type="button"
                        onClick={() => onBackgroundAudioToggle("muted")}
                        className={`rounded-xl py-2 text-xs font-bold transition-all cursor-pointer hover:scale-[1.03] ${
                          bgMusicState === "muted"
                            ? `${getPrimaryBgColor(
                                appTheme
                              )} text-white shadow-md`
                            : tokens.subtlePill
                        }`}
                      >
                        🔇 Radio Off
                      </button>
                    </div>

                    <div className={`pt-2 border-t space-y-1.5 ${tokens.dividerBorder}`}>
                      <div className="flex items-center justify-between">
                        <p className={`text-[11px] font-bold ${tokens.mutedText}`}>
                          Music Volume:
                        </p>
                        <span className={`text-[11px] font-bold ${tokens.accentText}`}>
                          {Math.round(bgMusicVolume * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={bgMusicVolume}
                        onChange={(e) =>
                          handleVolumeChange(parseFloat(e.target.value))
                        }
                        className={`w-full h-1.5 rounded-lg appearance-none cursor-pointer ${tokens.sliderClass}`}
                      />
                    </div>

                    <div className={`pt-2 border-t ${tokens.dividerBorder}`}>
                      <p className={`text-[11px] mb-2 font-bold ${tokens.mutedText}`}>
                        Select Channel by Genre:
                      </p>
                      <div className="max-h-40 overflow-y-auto space-y-1.5 pr-0.5 scrollbar-none">
                        {Object.entries(RADIO_STATIONS).map(
                          ([category, stations]) => {
                            const hasActiveStation = stations.some(
                              (s) =>
                                currentStationUrl === s.url ||
                                (!currentStationUrl &&
                                  bgAudio.getCurrentStation().url === s.url)
                            );

                            return (
                              <details
                                key={category}
                                open={
                                  hasActiveStation ||
                                  category.toLowerCase().includes("2000")
                                }
                                className={`group rounded-xl border overflow-hidden ${tokens.subBox}`}
                              >
                                <summary
                                  className={`flex items-center justify-between px-3 py-1.5 text-xs font-bold cursor-pointer select-none hover:bg-white/10 transition ${tokens.accentText}`}
                                >
                                  <span className="flex items-center gap-2 truncate pr-2">
                                    <span>📁 {category}</span>
                                    <span
                                      className={`text-[9px] px-1.5 py-0.5 rounded-full bg-white/10 ${tokens.mutedText}`}
                                    >
                                      {stations.length}
                                    </span>
                                  </span>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {hasActiveStation && (
                                      <span
                                        className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"
                                        title="Active stream in this category"
                                      />
                                    )}
                                    <span className="transform group-open:rotate-180 transition-transform text-[10px]">
                                      ▼
                                    </span>
                                  </div>
                                </summary>

                                <div
                                  className={`p-1.5 space-y-1 border-t ${tokens.detailsBody}`}
                                >
                                  {stations.map((station) => {
                                    const isSelected =
                                      currentStationUrl === station.url ||
                                      (!currentStationUrl &&
                                        bgAudio.getCurrentStation().url ===
                                          station.url);
                                    return (
                                      <button
                                        key={station.url}
                                        type="button"
                                        onClick={() =>
                                          handleStationSelect(station.url)
                                        }
                                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-between cursor-pointer ${
                                          isSelected
                                            ? `${getPrimaryBgColor(
                                                appTheme
                                              )} text-white shadow-md`
                                            : tokens.subtlePill
                                        }`}
                                      >
                                        <span className="truncate pr-1">
                                          🎵 {station.name}
                                        </span>
                                        {isSelected && (
                                          <span className="text-[9px] shrink-0 font-bold bg-black/50 px-1.5 py-0.5 rounded">
                                            ▶ LIVE
                                          </span>
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>
                              </details>
                            );
                          }
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 4. PROFILE, PIN, PERSONALIZATION & SENIOR / TV MODE */}
              <div data-tour="sidebar-profile-accessibility" className="w-full box-border">
                {renderCrystalAccordionButton(
                  "profileAndAccessibility",
                  "🔒",
                  "Profile & Senior/TV",
                  kidsLocked ? "KIDS" : seniorEasyMode ? "EASY" : undefined
                )}

                {activeSection === "profileAndAccessibility" && (
                  <div className={crystalSubPanelClass}>
                    {/* ONE-TAP SENIOR EASY MODE */}
                    <div
                      className={`rounded-2xl border p-3 flex items-center justify-between gap-2 ${tokens.highlightCard}`}
                    >
                      <div className="min-w-0">
                        <p className={`text-xs font-black ${tokens.accentText}`}>
                          👓 One-Tap Senior Easy Mode
                        </p>
                        <p className={`text-[10px] leading-snug ${tokens.mutedText}`}>
                          Large text, big buttons, XL pointer, bright TV
                          focus & steady screen.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const next = !seniorEasyMode;
                          applySeniorEasyPreset(next);
                          setSeniorEasyModeState(next);
                        }}
                        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                          seniorEasyMode ? tokens.toggleActive : tokens.toggleOff
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                            seniorEasyMode ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </div>

                    {/* PERSONALIZATION: MASCOT, GREETING, EYE-CARE, CORNER CLOCK */}
                    <div className={`space-y-2.5 pb-3 border-b ${tokens.dividerBorder}`}>
                      <p
                        className={`text-[10px] font-extrabold uppercase tracking-widest ${tokens.accentText}`}
                      >
                        ✨ Fun Personalizations
                      </p>

                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-1.5">
                          <p className={`text-[11px] font-bold ${tokens.mutedText}`}>
                            Profile Mascot Badge:
                          </p>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setMascotPickerTab("custom")}
                              className={`rounded-lg px-2 py-0.5 text-[10px] font-extrabold transition cursor-pointer ${
                                mascotPickerTab === "custom"
                                  ? `${getPrimaryBgColor(appTheme)} text-white shadow`
                                  : tokens.subtlePill
                              }`}
                            >
                              🎨 Custom ({customBadges.length})
                            </button>
                            <button
                              type="button"
                              onClick={() => setMascotPickerTab("emoji")}
                              className={`rounded-lg px-2 py-0.5 text-[10px] font-extrabold transition cursor-pointer ${
                                mascotPickerTab === "emoji"
                                  ? `${getPrimaryBgColor(appTheme)} text-white shadow`
                                  : tokens.subtlePill
                              }`}
                            >
                              ✨ Classic
                            </button>
                          </div>
                        </div>

                        {mascotPickerTab === "custom" && customBadges.length > 0 ? (
                          <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto pr-0.5 scrollbar-none">
                            {customBadges.map((badge) => {
                              const isSelected = profileMascot === badge.id;
                              return (
                                <button
                                  key={badge.id}
                                  type="button"
                                  onClick={() => {
                                    const saved = setActiveMascotBadge(badge.id);
                                    setProfileMascotState(saved);
                                    snapshotActiveProfile();
                                  }}
                                  title={badge.label}
                                  aria-label={badge.label}
                                  className={`p-1 rounded-2xl border flex items-center justify-center transition-all cursor-pointer hover:scale-105 ${
                                    isSelected
                                      ? `${getPrimaryBgColor(
                                          appTheme
                                        )} ring-2 ring-white/60 border-transparent shadow-md`
                                      : `${tokens.subBox} hover:bg-white/10`
                                  }`}
                                >
                                  <MascotAvatar
                                    mascot={badge.id}
                                    size="lg"
                                    rounded="xl"
                                    alt={badge.label}
                                  />
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="grid grid-cols-5 gap-1.5">
                            {EMOJI_MASCOT_BADGES.map((m) => (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => {
                                  const saved = setActiveMascotBadge(m.id);
                                  setProfileMascotState(saved);
                                  snapshotActiveProfile();
                                }}
                                title={m.label}
                                className={`py-1.5 rounded-xl text-base transition-all cursor-pointer hover:scale-110 ${
                                  profileMascot === m.id
                                    ? `${getPrimaryBgColor(
                                        appTheme
                                      )} ring-2 ring-white/50 shadow-md`
                                    : `border hover:bg-white/15 ${tokens.subBox}`
                                }`}
                              >
                                {m.emojiFallback}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div>
                        <p className={`text-[11px] font-bold mb-1 ${tokens.mutedText}`}>
                          Home Greeting Style:
                        </p>
                        <select
                          value={greetingStyle}
                          onChange={(e) => {
                            const val = e.target.value as GreetingStyle;
                            setGreetingStyle(val);
                            setGreetingStyleState(val);
                          }}
                          className={`h-9 w-full rounded-xl border px-3 text-xs font-bold focus:outline-none cursor-pointer ${tokens.inputClass}`}
                        >
                          {GREETING_STYLE_OPTIONS.map((g) => (
                            <option
                              key={g.id}
                              value={g.id}
                              className={tokens.optionBg}
                            >
                              {g.label} — {g.sample}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white">
                            🌙 Night Owl Eye-Care Filter
                          </p>
                          <p className={`text-[10px] ${tokens.mutedText}`}>
                            Soft warm tint for late-night watching.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const next = !warmEyeCare;
                            setWarmEyeCare(next);
                            setWarmEyeCareState(next);
                          }}
                          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                            warmEyeCare ? tokens.toggleActive : tokens.toggleOff
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                              warmEyeCare ? "translate-x-6" : "translate-x-1"
                            }`}
                          />
                        </button>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white">
                            🕒 Couch Corner Clock
                          </p>
                          <p className={`text-[10px] ${tokens.mutedText}`}>
                            Subtle live time while browsing.
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              const nextFmt: ClockFormat =
                                clockFormat === "12h" ? "24h" : "12h";
                              setClockFormat(nextFmt);
                              setClockFormatState(nextFmt);
                            }}
                            className={`px-2 py-1 rounded-lg border text-[10px] font-bold cursor-pointer ${tokens.subBox} ${tokens.accentText}`}
                            title="Toggle 12h / 24h"
                          >
                            {clockFormat.toUpperCase()}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const next = !showCornerClock;
                              setShowCornerClock(next);
                              setShowCornerClockState(next);
                            }}
                            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                              showCornerClock
                                ? tokens.toggleActive
                                : tokens.toggleOff
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                                showCornerClock
                                  ? "translate-x-6"
                                  : "translate-x-1"
                              }`}
                            />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* ACCESSIBILITY, TV OVERSCAN & SUBTITLES */}
                    <div className={`space-y-2.5 pb-3 border-b ${tokens.dividerBorder}`}>
                      <p
                        className={`text-[10px] font-extrabold uppercase tracking-widest ${tokens.accentText}`}
                      >
                        ♿ TV, Projector & Accessibility
                      </p>

                      <div>
                        <p className={`text-[11px] font-bold mb-1 ${tokens.mutedText}`}>
                          Text Size:
                        </p>
                        <div className="grid grid-cols-3 gap-1.5">
                          {(["normal", "large", "xl"] as TextScale[]).map(
                            (sc) => (
                              <button
                                key={sc}
                                type="button"
                                onClick={() => {
                                  setTextScale(sc);
                                  setTextScaleState(sc);
                                }}
                                className={`rounded-xl py-1.5 text-xs font-bold uppercase transition cursor-pointer ${
                                  textScale === sc
                                    ? `${getPrimaryBgColor(
                                        appTheme
                                      )} text-white shadow-md`
                                    : tokens.subtlePill
                                }`}
                              >
                                {sc}
                              </button>
                            )
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white">
                            XL Mouse Pointer (3x)
                          </p>
                          <p className={`text-[10px] ${tokens.mutedText}`}>
                            Enlarges cursor for TVs & projectors.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => onMouseToggle(!helpfulMouse)}
                          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                            helpfulMouse
                              ? tokens.toggleActive
                              : tokens.toggleOff
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                              helpfulMouse ? "translate-x-6" : "translate-x-1"
                            }`}
                          />
                        </button>
                      </div>

                      {helpfulMouse && (
                        <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                          {CURSOR_STYLE_OPTIONS.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => {
                                setCursorStyle(c.id);
                                setCursorStyleState(c.id);
                              }}
                              className={`rounded-xl py-1.5 px-2 text-[10px] font-bold transition cursor-pointer ${
                                cursorStyle === c.id
                                  ? `${getPrimaryBgColor(
                                      appTheme
                                    )} text-white shadow`
                                  : tokens.subtlePill
                              }`}
                            >
                              {c.label}
                            </button>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center justify-between gap-2 pt-1">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white">
                            Enlarged Action Buttons
                          </p>
                          <p className={`text-[10px] ${tokens.mutedText}`}>
                            Bigger icons & touch targets.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => onLargeButtonsToggle(!largeButtons)}
                          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                            largeButtons
                              ? tokens.toggleActive
                              : tokens.toggleOff
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                              largeButtons ? "translate-x-6" : "translate-x-1"
                            }`}
                          />
                        </button>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white">
                            Bright TV Focus Spotlight
                          </p>
                          <p className={`text-[10px] ${tokens.mutedText}`}>
                            High-contrast yellow D-pad highlight.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const next = !highContrastFocus;
                            setHighContrastFocus(next);
                            setHighContrastFocusState(next);
                          }}
                          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                            highContrastFocus
                              ? tokens.toggleActive
                              : tokens.toggleOff
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                              highContrastFocus
                                ? "translate-x-6"
                                : "translate-x-1"
                            }`}
                          />
                        </button>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white">
                            Steady Screen (No Motion)
                          </p>
                          <p className={`text-[10px] ${tokens.mutedText}`}>
                            Stops animations for eyes & low-RAM sticks.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const next = !reducedMotion;
                            setReducedMotion(next);
                            setReducedMotionState(next);
                          }}
                          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                            reducedMotion
                              ? tokens.toggleActive
                              : tokens.toggleOff
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                              reducedMotion ? "translate-x-6" : "translate-x-1"
                            }`}
                          />
                        </button>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white">
                            Soft Remote Click Sounds
                          </p>
                          <p className={`text-[10px] ${tokens.mutedText}`}>
                            Gentle audio feedback on button taps.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const next = !uiClickSounds;
                            setUiClickSounds(next);
                            setUiClickSoundsState(next);
                          }}
                          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                            uiClickSounds
                              ? tokens.toggleActive
                              : tokens.toggleOff
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                              uiClickSounds ? "translate-x-6" : "translate-x-1"
                            }`}
                          />
                        </button>
                      </div>

                      <div className="pt-1">
                        <p className={`text-[11px] font-bold mb-1 ${tokens.mutedText}`}>
                          TV / Projector Screen Safe-Zone:
                        </p>
                        <div className="grid grid-cols-4 gap-1">
                          {TV_OVERSCAN_OPTIONS.map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => {
                                setTvOverscan(opt.value);
                                setTvOverscanState(opt.value);
                              }}
                              className={`rounded-xl py-1.5 text-[10px] font-bold transition cursor-pointer ${
                                tvOverscan === opt.value
                                  ? `${getPrimaryBgColor(
                                      appTheme
                                    )} text-white shadow`
                                  : tokens.subtlePill
                              }`}
                            >
                              {opt.value}%
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="pt-1">
                        <p className={`text-[11px] font-bold mb-1 ${tokens.mutedText}`}>
                          Caption / Subtitle Style:
                        </p>
                        <div className="grid grid-cols-3 gap-1.5">
                          <select
                            value={subtitles.size}
                            onChange={(e) =>
                              setSubtitlesState(
                                saveSubtitleSettings({
                                  size: e.target
                                    .value as SubtitleSettings["size"],
                                })
                              )
                            }
                            className={`h-8 rounded-lg border px-1.5 text-[10px] font-bold ${tokens.inputClass}`}
                          >
                            <option value="normal" className={tokens.optionBg}>
                              Normal
                            </option>
                            <option value="large" className={tokens.optionBg}>
                              Large
                            </option>
                            <option value="xl" className={tokens.optionBg}>
                              XL Size
                            </option>
                          </select>
                          <select
                            value={subtitles.color}
                            onChange={(e) =>
                              setSubtitlesState(
                                saveSubtitleSettings({
                                  color: e.target
                                    .value as SubtitleSettings["color"],
                                })
                              )
                            }
                            className={`h-8 rounded-lg border px-1.5 text-[10px] font-bold ${tokens.inputClass}`}
                          >
                            <option value="white" className={tokens.optionBg}>
                              White
                            </option>
                            <option value="yellow" className={tokens.optionBg}>
                              Yellow
                            </option>
                            <option value="cyan" className={tokens.optionBg}>
                              Cyan
                            </option>
                          </select>
                          <select
                            value={subtitles.bgOpacity}
                            onChange={(e) =>
                              setSubtitlesState(
                                saveSubtitleSettings({
                                  bgOpacity: e.target
                                    .value as SubtitleSettings["bgOpacity"],
                                })
                              )
                            }
                            className={`h-8 rounded-lg border px-1.5 text-[10px] font-bold ${tokens.inputClass}`}
                          >
                            <option value="none" className={tokens.optionBg}>
                              No Box
                            </option>
                            <option value="medium" className={tokens.optionBg}>
                              Dim Box
                            </option>
                            <option value="solid" className={tokens.optionBg}>
                              Solid Box
                            </option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* KIDS SAFE MODE LOCK */}
                    <div className={`space-y-2 pb-3 border-b ${tokens.dividerBorder}`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-extrabold text-emerald-300">
                            🧒 Kids Safe Mode Lock
                          </p>
                          <p className={`text-[10px] ${tokens.mutedText}`}>
                            Caps catalog to kid-safe titles until PIN unlocked.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleKidsLockToggle()}
                          className={`px-3 py-1.5 rounded-xl text-[10px] font-extrabold shrink-0 transition cursor-pointer ${
                            kidsLocked
                              ? "bg-emerald-600 text-white shadow"
                              : `border ${tokens.secondaryBtn}`
                          }`}
                        >
                          {kidsLocked ? "🔓 Unlock" : "🔒 Lock ON"}
                        </button>
                      </div>

                      {kidsLocked && (
                        <input
                          type="password"
                          dir="ltr"
                          inputMode="numeric"
                          maxLength={6}
                          placeholder="Enter 4–6 digit PIN then tap Unlock"
                          value={kidsUnlockPin}
                          onChange={(e) =>
                            setKidsUnlockPin(
                              e.target.value.replace(/\D/g, "").slice(0, 6)
                            )
                          }
                          className={`w-full rounded-xl border px-3 py-1.5 text-xs font-bold focus:outline-none tracking-widest ${tokens.inputClass}`}
                        />
                      )}

                      {kidsLockStatus && (
                        <p className={`text-[10px] font-bold text-center ${tokens.accentText}`}>
                          {kidsLockStatus}
                        </p>
                      )}
                    </div>

                    {/* PROFILE, AGE & 4-6 DIGIT HASHED PIN FORM */}
                    <form
                      onSubmit={handleUnifiedProfileUpdate}
                      className="space-y-2.5"
                    >
                      <p
                        className={`text-[10px] font-extrabold uppercase tracking-widest ${tokens.accentText}`}
                      >
                        🔐 Profile, Age & Parental PIN (4–6 Digits)
                      </p>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className={`block text-[11px] mb-1 font-bold ${tokens.mutedText}`}>
                            Name:
                          </span>
                          <input
                            type="text"
                            dir="ltr"
                            maxLength={25}
                            value={profileNameInput}
                            onChange={(e) =>
                              setProfileNameInput(e.target.value)
                            }
                            className={`w-full rounded-xl border px-2.5 py-1.5 text-xs focus:outline-none ${tokens.inputClass}`}
                          />
                        </div>
                        <div>
                          <span className={`block text-[11px] mb-1 font-bold ${tokens.mutedText}`}>
                            Age:
                          </span>
                          <input
                            type="number"
                            dir="ltr"
                            min={1}
                            max={120}
                            value={userAgeInput}
                            onChange={(e) => setUserAgeInput(e.target.value)}
                            className={`w-full rounded-xl border px-2.5 py-1.5 text-xs focus:outline-none ${tokens.inputClass}`}
                          />
                        </div>
                      </div>

                      <div>
                        <span className={`block text-[11px] mb-1 font-bold ${tokens.mutedText}`}>
                          Current 4–6 Digit PIN (Required):
                        </span>
                        <input
                          type="password"
                          dir="ltr"
                          inputMode="numeric"
                          maxLength={6}
                          placeholder="••••••"
                          value={unifiedAgeCodeInput}
                          onChange={(e) =>
                            setUnifiedAgeCodeInput(
                              e.target.value.replace(/\D/g, "").slice(0, 6)
                            )
                          }
                          className={`w-full rounded-xl border px-2.5 py-1.5 text-xs focus:outline-none tracking-widest ${tokens.inputClass}`}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div>
                          <span className={`block text-[11px] mb-1 font-bold ${tokens.mutedText}`}>
                            New PIN (Opt):
                          </span>
                          <input
                            type="password"
                            dir="ltr"
                            inputMode="numeric"
                            maxLength={6}
                            placeholder="••••••"
                            value={newPasscode}
                            onChange={(e) =>
                              setNewPasscode(
                                e.target.value.replace(/\D/g, "").slice(0, 6)
                              )
                            }
                            className={`w-full rounded-xl border px-2.5 py-1.5 text-xs focus:outline-none tracking-widest ${tokens.inputClass}`}
                          />
                        </div>
                        <div>
                          <span className={`block text-[11px] mb-1 font-bold ${tokens.mutedText}`}>
                            Confirm PIN:
                          </span>
                          <input
                            type="password"
                            dir="ltr"
                            inputMode="numeric"
                            maxLength={6}
                            placeholder="••••••"
                            value={confirmNewPasscode}
                            onChange={(e) =>
                              setConfirmNewPasscode(
                                e.target.value.replace(/\D/g, "").slice(0, 6)
                              )
                            }
                            className={`w-full rounded-xl border px-2.5 py-1.5 text-xs focus:outline-none tracking-widest ${tokens.inputClass}`}
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        className={`w-full py-2.5 rounded-xl ${getPrimaryBgColor(
                          appTheme
                        )} text-xs font-extrabold shadow-lg transition hover:scale-[1.02] cursor-pointer`}
                      >
                        Save Profile & PIN Updates
                      </button>

                      {unifiedUpdateStatus && (
                        <p
                          className={`text-[11px] font-bold text-center ${
                            unifiedUpdateStatus.isError
                              ? "text-red-400"
                              : "text-emerald-400"
                          }`}
                        >
                          {unifiedUpdateStatus.text}
                        </p>
                      )}
                    </form>
                  </div>
                )}
              </div>

              {/* 5. HARDWARE RAM, STREAM ENGINE & STORAGE METER */}
              <div data-tour="sidebar-hardware-stream" className="w-full box-border">
                {renderCrystalAccordionButton(
                  "hardwareAndStream",
                  "⚡",
                  "RAM & Stream Engine",
                  ramMode === "low"
                    ? "1-2GB"
                    : ramMode === "high"
                      ? "4GB+"
                      : "Auto"
                )}

                {activeSection === "hardwareAndStream" && (
                  <div className={crystalSubPanelClass}>
                    <div>
                      <p className={`text-[11px] font-bold mb-1 ${tokens.mutedText}`}>
                        Device Memory Allocation Profile:
                      </p>
                      <p className={`text-[10px] mb-2 leading-snug ${tokens.subMutedText}`}>
                        Use <strong className={tokens.accentText}>1–2GB</strong> for
                        Nero 8K / Fire TV Sticks to cap video RAM buffers &
                        disable heavy blurs.
                      </p>
                      <div className="grid grid-cols-3 gap-1.5">
                        {(
                          [
                            { id: "auto", label: "✨ Auto" },
                            { id: "low", label: "📟 1–2GB" },
                            { id: "high", label: "🚀 4GB+" },
                          ] as { id: RamMode; label: string }[]
                        ).map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => handleRamModeChange(opt.id)}
                            className={`rounded-xl py-2 px-1 text-xs font-extrabold whitespace-nowrap transition-all cursor-pointer hover:scale-[1.03] ${
                              ramMode === opt.id
                                ? `${getPrimaryBgColor(
                                    appTheme
                                  )} text-white shadow-md ring-1 ring-white/40`
                                : tokens.subtlePill
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className={`flex items-center justify-between gap-2 pt-2.5 border-t ${tokens.dividerBorder}`}>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white">
                          📶 Data Saver / Lite Posters
                        </p>
                        <p className={`text-[10px] ${tokens.subMutedText}`}>
                          Uses lighter w342 images (~45% less RAM).
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const next = !dataSaverMode;
                          setDataSaverMode(next);
                          setDataSaverModeState(next);
                        }}
                        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                          dataSaverMode
                            ? tokens.toggleActive
                            : tokens.toggleOff
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                            dataSaverMode ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </div>

                    <div className={`pt-2.5 border-t ${tokens.dividerBorder}`}>
                      <p className={`text-[11px] font-bold mb-1.5 ${tokens.mutedText}`}>
                        Preferred Stream Resolution:
                      </p>
                      <div className="grid grid-cols-4 gap-1.5">
                        {(
                          ["auto", "1080p", "720p", "480p"] as StreamQuality[]
                        ).map((q) => (
                          <button
                            key={q}
                            type="button"
                            onClick={() => handleStreamQualitySelect(q)}
                            className={`rounded-xl py-2 text-[11px] font-bold uppercase transition-all cursor-pointer hover:scale-105 ${
                              activeStreamQuality === q
                                ? `${getPrimaryBgColor(
                                    appTheme
                                  )} text-white shadow-md`
                                : tokens.subtlePill
                            }`}
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className={`pt-2.5 border-t space-y-1.5 ${tokens.dividerBorder}`}>
                      <div className="flex items-center justify-between">
                        <p className={`text-[11px] font-bold ${tokens.mutedText}`}>
                          Default Live Player Volume:
                        </p>
                        <span className={`text-[11px] font-bold ${tokens.accentText}`}>
                          {Math.round(defaultPlayerVolume * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={defaultPlayerVolume}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setDefaultPlayerVolume(val);
                          setDefaultPlayerVolumeState(val);
                        }}
                        className={`w-full h-1.5 rounded-lg appearance-none cursor-pointer ${tokens.sliderClass}`}
                      />
                    </div>

                    <div className={`pt-2.5 border-t flex items-center justify-between gap-2 ${tokens.dividerBorder}`}>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white">
                          Auto-Play Next Episode
                        </p>
                        <p className={`text-[10px] ${tokens.subMutedText}`}>
                          Seamless binge-watching for TV series.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const next = !autoPlayNext;
                          setAutoPlayNext(next);
                          setAutoPlayNextState(next);
                        }}
                        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                          autoPlayNext
                            ? tokens.toggleActive
                            : tokens.toggleOff
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                            autoPlayNext ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </div>

                    <div className={`pt-2.5 border-t space-y-2 ${tokens.dividerBorder}`}>
                      <div className="flex flex-wrap items-center justify-between gap-1 text-[10px] font-bold">
                        <span className={tokens.mutedText}>
                          Storage ({storageHealth.cacheEntriesCount} caches)
                        </span>
                        {/* Semantic Storage Health Indicator */}
                        <span
                          className={
                            storageHealth.status === "high"
                              ? "text-red-400"
                              : storageHealth.status === "moderate"
                                ? "text-amber-300"
                                : "text-emerald-400"
                          }
                        >
                          {storageHealth.usedKB} / {storageHealth.maxEstimatedKB}{" "}
                          KB ({storageHealth.percentUsed}%)
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            storageHealth.status === "high"
                              ? "bg-red-500"
                              : storageHealth.status === "moderate"
                                ? "bg-amber-400"
                                : "bg-emerald-400"
                          }`}
                          style={{
                            width: `${Math.max(4, storageHealth.percentUsed)}%`,
                          }}
                        />
                      </div>

                      <button
                        type="button"
                        onClick={handlePurgeVolatileCaches}
                        className={`w-full py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer hover:scale-[1.02] ${tokens.subtlePill}`}
                      >
                        🧹 Purge Stream & Metadata Caches
                      </button>

                      <p
                        className={`text-[9px] font-mono text-center break-all ${tokens.subMutedText}`}
                      >
                        Device ID: {deviceId}
                      </p>

                      {cacheClearMsg && (
                        <p className="text-[11px] font-bold text-emerald-400 text-center">
                          {cacheClearMsg}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* 6. SCREENSAVER, SLEEP TIMER & BACKUP */}
              <div data-tour="sidebar-sleep-backup" className="w-full box-border">
                {renderCrystalAccordionButton(
                  "screensaverAndBackup",
                  "💤",
                  "Sleep & Backup",
                  sleepTimerMin > 0 ? `SLEEP ${sleepTimerMin}m` : undefined
                )}

                {activeSection === "screensaverAndBackup" && (
                  <div className={crystalSubPanelClass}>
                    <div>
                      <p className={`text-[11px] font-bold mb-1.5 ${tokens.mutedText}`}>
                        🌙 Couch Sleep Timer (Auto-Pause & Dark Screen):
                      </p>
                      <div className="grid grid-cols-3 gap-1.5">
                        {SLEEP_TIMER_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => {
                              setSleepTimerMinutes(opt.value);
                              setSleepTimerMin(opt.value);
                            }}
                            className={`rounded-xl py-2 px-1 text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer hover:scale-105 ${
                              sleepTimerMin === opt.value
                                ? `${getPrimaryBgColor(
                                    appTheme
                                  )} text-white shadow-md`
                                : tokens.subtlePill
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className={`pt-2.5 border-t ${tokens.dividerBorder}`}>
                      <p className={`text-[11px] font-bold mb-1.5 ${tokens.mutedText}`}>
                        Start Screensaver After:
                      </p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {TIMEOUT_OPTIONS.map((opt) => {
                          const shortLabel = opt.label.replace(
                            " (Default)",
                            " ★"
                          );
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() =>
                                handleScreensaverTimeoutChange(opt.value)
                              }
                              className={`rounded-xl py-2 px-2 text-xs font-bold whitespace-nowrap transition-all cursor-pointer hover:scale-[1.03] ${
                                screensaverTimeoutMs === opt.value
                                  ? `${getPrimaryBgColor(
                                      appTheme
                                    )} text-white shadow-md`
                                  : tokens.subtlePill
                              }`}
                            >
                              {shortLabel}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className={`pt-2.5 border-t space-y-2 ${tokens.dividerBorder}`}>
                      <p className={`text-[11px] font-bold ${tokens.mutedText}`}>
                        Profile, Poster Styles & Watchlist Backup:
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={handleSaveBackup}
                          className={`rounded-xl px-2 py-2 text-xs font-bold whitespace-nowrap transition-all cursor-pointer hover:scale-[1.03] ${tokens.subtlePill}`}
                        >
                          💾 Export JSON
                        </button>
                        <label
                          className={`text-center cursor-pointer rounded-xl px-2 py-2 text-xs font-bold whitespace-nowrap transition-all hover:scale-[1.03] ${tokens.subtlePill}`}
                        >
                          🔄 Restore
                          <input
                            type="file"
                            accept=".json"
                            onChange={handleRestoreBackup}
                            className="hidden"
                          />
                        </label>
                      </div>
                      {backupStatus && (
                        <span
                          className={`text-xs ${getPrimaryAccentColor(
                            appTheme
                          )} font-bold block text-center`}
                        >
                          {backupStatus}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* REFER FRIENDS & EARN CASH LAUNCHER (Theme-Matched) */}
            <div data-tour="sidebar-referrals" className="pt-2 w-full box-border">
              <button
                type="button"
                onClick={() => setIsReferralModalOpen(true)}
                className={`w-full max-w-full overflow-hidden rounded-2xl border p-3 text-left transition-all duration-200 hover:brightness-110 active:scale-[0.99] cursor-pointer focus:outline-none focus:ring-2 ${tokens.referralCard}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border text-base ${tokens.referralIcon}`}
                    >
                      💸
                    </span>
                    <div className="min-w-0">
                      <p className={`text-xs font-black truncate ${tokens.accentText}`}>
                        Refer Friends & Earn Cash
                      </p>
                      <p className={`text-[10px] font-semibold truncate ${tokens.mutedText}`}>
                        ${PAYOUT_PER_EXTRA_REFERRAL_CAD}/friend after{" "}
                        {MIN_CONFIRMED_REFERRALS} paid invites
                      </p>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-black ${tokens.referralPill}`}
                  >
                    Open ↗
                  </span>
                </div>
              </button>
            </div>

            {/* ADMIN PANEL (IF ADMIN) */}
            {isAdmin && (
              <div className={`pt-3 border-t w-full box-border ${tokens.dividerBorder}`}>
                <AdminPanel
                  appTheme={appTheme}
                  getPrimaryBgColor={getPrimaryBgColor}
                  getPrimaryAccentColor={getPrimaryAccentColor}
                />
              </div>
            )}

            {/* FEEDBACK, WALKTHROUGH & LEGAL SECTION */}
            <div
              data-tour="sidebar-support"
              className={`pt-3 border-t space-y-2 w-full box-border ${tokens.dividerBorder}`}
            >
              <h4
                className={`text-[10px] font-extrabold uppercase tracking-widest px-1 ${tokens.mutedText}`}
              >
                Feedback, Guide & Legal
              </h4>
              <button
                type="button"
                onClick={onOpenBugModal}
                className={`w-full py-2.5 rounded-xl text-xs font-extrabold transition-all hover:scale-[1.02] active:scale-95 cursor-pointer ${getPrimaryBgColor(
                  appTheme
                )} text-white shadow-md`}
              >
                🐞 Report a Bug / Issue
              </button>
              <button
                type="button"
                onClick={onOpenBugFeedModal}
                className={`w-full py-2.5 rounded-xl border text-xs font-bold transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 cursor-pointer ${tokens.secondaryBtn}`}
              >
                📋 View Bug Reports Feed
              </button>
              <div className="grid grid-cols-2 gap-2 pt-0.5">
                <button
                  type="button"
                  data-tour="sidebar-walkthrough"
                  onClick={() => {
                    if (onStartWalkthrough) {
                      onStartWalkthrough();
                    } else {
                      handleCloseSidebar();
                      triggerRabbitWalkthrough(0);
                    }
                  }}
                  className={`w-full py-2.5 px-2 rounded-xl text-[11px] font-extrabold transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer ${tokens.subtlePill}`}
                >
                  🧭 Replay Tour
                </button>
                <button
                  type="button"
                  data-tour="sidebar-tos"
                  onClick={() => {
                    if (onOpenTosModal) {
                      onOpenTosModal();
                    } else {
                      handleCloseSidebar();
                      triggerOpenTosModal(false);
                    }
                  }}
                  className={`w-full py-2.5 px-2 rounded-xl border text-[11px] font-extrabold transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer ${tokens.secondaryBtn}`}
                >
                  📜 Terms (ToS)
                </button>
              </div>
            </div>

            {/* UPDATE CHANNEL & ACTIONS */}
            <div
              data-tour="sidebar-updates"
              className={`pt-3 border-t space-y-2 w-full box-border ${tokens.dividerBorder}`}
            >
              <h4
                className={`text-[10px] font-extrabold uppercase tracking-widest px-1 ${tokens.mutedText}`}
              >
                Update Channel
              </h4>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleUpdateChannelChange("stable")}
                  className={`py-2 rounded-xl text-xs font-bold transition-all hover:scale-105 cursor-pointer ${
                    updateChannel === "stable"
                      ? `${getPrimaryBgColor(appTheme)} text-white`
                      : `border ${tokens.secondaryBtn}`
                  }`}
                >
                  🛡️ Stable
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdateChannelChange("nightly")}
                  className={`py-2 rounded-xl text-xs font-bold transition-all hover:scale-105 cursor-pointer ${
                    updateChannel === "nightly"
                      ? `${getPrimaryBgColor(appTheme)} text-white`
                      : `border ${tokens.secondaryBtn}`
                  }`}
                >
                  ⚡ Nightly
                </button>
              </div>
              <button
                type="button"
                onClick={() => void checkForAppUpdates(false)}
                className={`w-full py-2.5 rounded-xl text-xs font-extrabold transition-all hover:scale-[1.02] active:scale-95 cursor-pointer ${getPrimaryBgColor(
                  appTheme
                )} text-white shadow-md`}
              >
                🔍 Check for Updates Now
              </button>
            </div>

            {/* LICENSE STATUS */}
            <div
              data-tour="sidebar-license"
              className={`pt-3 border-t space-y-2 w-full box-border ${tokens.dividerBorder}`}
            >
              <h4
                className={`text-[10px] font-extrabold uppercase tracking-widest px-1 ${tokens.mutedText}`}
              >
                License Status
              </h4>
              {isAdmin ? (
                <p
                  className={`text-[11px] font-bold border p-2.5 rounded-xl backdrop-blur-md ${tokens.highlightCard} ${tokens.accentText}`}
                >
                  🔐 Admin access active.
                </p>
              ) : isTrialActive ? (
                <div className="space-y-2">
                  <p className="text-[11px] text-amber-300 bg-amber-500/15 border border-amber-500/35 p-2.5 rounded-xl leading-relaxed backdrop-blur-md">
                    Trial:{" "}
                    <strong>
                      {trialDaysRemaining}{" "}
                      {trialDaysRemaining === 1 ? "day" : "days"} remaining
                    </strong>
                    .
                  </p>
                  <form
                    onSubmit={handleUpgradeFromProfile}
                    className="space-y-1.5"
                  >
                    <input
                      type="password"
                      dir="ltr"
                      placeholder="Unlock code"
                      value={unlockCodeInput}
                      onChange={(e) => setUnlockCodeInput(e.target.value)}
                      className={`w-full rounded-xl border px-3 py-2 text-xs focus:outline-none ${tokens.inputClass}`}
                    />
                    <button
                      type="submit"
                      className={`w-full py-2 rounded-xl ${getPrimaryBgColor(
                        appTheme
                      )} text-xs font-extrabold shadow transition-all hover:scale-[1.02] cursor-pointer`}
                    >
                      Upgrade to Full Unlock
                    </button>
                  </form>
                </div>
              ) : (
                <p className="text-[11px] text-emerald-400 font-bold bg-emerald-500/15 border border-emerald-500/35 p-2.5 rounded-xl backdrop-blur-md">
                  ✅ Lifetime Access Unlocked.
                </p>
              )}
              {unlockStatusMsg && (
                <p
                  className={`text-[11px] font-bold text-center ${
                    unlockStatusMsg.isError
                      ? "text-red-400"
                      : "text-emerald-400"
                  }`}
                >
                  {unlockStatusMsg.text}
                </p>
              )}
            </div>

            {/* Sidebar Footer with Neon Divider */}
            <div className={`pt-4 border-t text-center w-full ${tokens.dividerBorder}`}>
              <img
                src={RABBIT_DIVIDER}
                alt=""
                className="w-2/3 mx-auto h-2 object-contain opacity-80 mb-2.5"
              />
              <span
                className={`text-[9px] uppercase tracking-widest font-extrabold ${tokens.subMutedText}`}
              >
                Crystal Console UI v2.8 • RABBiT TV
              </span>
            </div>
          </div>
        </div>

        {/* Scroll Down Arrow Button */}
        <button
          type="button"
          onClick={() => handleScrollSidebar("down")}
          className={`absolute bottom-3.5 left-1/2 -translate-x-1/2 z-20 w-14 h-6 border rounded-full flex items-center justify-center text-xs font-bold transition hover:scale-110 cursor-pointer ${tokens.scrollBtn}`}
          title="Scroll Down"
          aria-label="Scroll sidebar down"
        >
          ▼
        </button>
      </div>

      {/* Full-Screen Portal for User Refer & Earn Dashboard */}
      {isReferralModalOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <ReferralModal
            isOpen={isReferralModalOpen}
            onClose={() => setIsReferralModalOpen(false)}
          />,
          document.body
        )}
    </div>
  );
}

export default Sidebar;