// src/components/sidebar.tsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Link } from "@tanstack/react-router";
import { AdminPanel } from "@/components/AdminPanel";
import { ReferralModal } from "@/components/ReferralModal";
import {
  SIDEBAR_SECTION_EVENT,
  triggerRabbitWalkthrough,
} from "@/components/InteractiveWalkthrough";
import { triggerOpenTosModal } from "@/components/TermsOfServiceModal";
import { TIMEOUT_OPTIONS } from "@/components/Screensaver";
import { bgAudio, RADIO_STATIONS } from "@/lib/background-audio";
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
  PROFILE_MASCOT_OPTIONS,
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
  getProfileMascot,
  setProfileMascot,
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

// Original Neon Rabbit Console Assets (Outer Shell & Header Pills)
const RABBIT_HEADER_PILL =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/main/assets/rabbit-header-pill.jpg";
const RABBIT_PANEL =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/main/assets/rabbit-panel.jpg";
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
  headerIconUrl: string;
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
  headerIconUrl,
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
    getProfileMascot()
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
    setProfileMascotState(getProfileMascot());
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
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    syncLocalControls();
    window.addEventListener("rabtv_settings_updated", syncLocalControls);
    window.addEventListener("rabtv_holiday_updated", syncLocalControls);
    return () => {
      window.removeEventListener("rabtv_settings_updated", syncLocalControls);
      window.removeEventListener("rabtv_holiday_updated", syncLocalControls);
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

  // Close sidebar if main window scrolls significantly (paused while ReferralModal is open)
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

  const getToggleActiveBg = (theme: AppTheme) => {
    switch (theme) {
      case "red":
        return "bg-red-600";
      case "midnight":
        return "bg-sky-500";
      case "emerald":
        return "bg-emerald-500";
      case "amber":
        return "bg-amber-500";
      case "cyan":
        return "bg-cyan-500";
      case "violet":
      default:
        return "bg-violet-600";
    }
  };

  const getSubtlePillBg = (theme: AppTheme) => {
    switch (theme) {
      case "red":
        return "bg-red-950/50 border border-red-500/30 text-red-100 hover:bg-red-900/70";
      case "midnight":
        return "bg-blue-950/50 border border-blue-500/30 text-blue-100 hover:bg-blue-900/70";
      case "emerald":
        return "bg-emerald-950/50 border border-emerald-500/30 text-emerald-100 hover:bg-emerald-900/70";
      case "amber":
        return "bg-yellow-950/50 border border-amber-500/30 text-amber-100 hover:bg-yellow-900/70";
      case "cyan":
        return "bg-cyan-950/50 border border-cyan-500/30 text-cyan-100 hover:bg-cyan-900/70";
      case "violet":
      default:
        return "bg-purple-950/50 border border-violet-500/30 text-purple-100 hover:bg-purple-900/70";
    }
  };

  const toggleActiveClass = getToggleActiveBg(appTheme);

  const crystalSubPanelClass =
    "relative w-full p-3.5 sm:p-4 rounded-2xl mt-2 shadow-[0_12px_35px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(56,189,248,0.08)] overflow-hidden box-border backdrop-blur-xl bg-slate-950/85 border border-white/15 space-y-3.5";

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
        className={`crystal-menu-pill w-full flex items-center justify-between gap-2 px-4 py-3 text-left text-xs font-extrabold text-white relative overflow-hidden rounded-2xl border border-white/15 cursor-pointer box-border transition-all duration-200 ease-out hover:scale-[1.03] focus:scale-[1.04] hover:-translate-y-0.5 focus:-translate-y-0.5 active:scale-[0.98] focus:outline-none ${
          isActive
            ? "ring-2 ring-cyan-400/90 border-cyan-400/60 shadow-[0_0_26px_rgba(56,189,248,0.45),0_0_18px_rgba(239,68,68,0.3)]"
            : "hover:border-cyan-400/50 hover:shadow-[0_10px_24px_rgba(56,189,248,0.28),0_0_16px_rgba(239,68,68,0.2)] focus:ring-2 focus:ring-cyan-400"
        }`}
      >
        <div
          className="absolute inset-0 pointer-events-none z-0 opacity-80"
          style={{
            backgroundImage: `url(${RABBIT_HEADER_PILL})`,
            backgroundSize: "115% 380%",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "center center",
          }}
        >
          <div className="absolute inset-0 bg-slate-950/35 backdrop-blur-[3px] w-full h-full" />
        </div>

        <span className="relative z-10 flex items-center gap-2 min-w-0 drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]">
          <span className="text-sm shrink-0">{icon}</span>
          <span className="truncate">{title}</span>
        </span>

        <div className="relative z-10 flex items-center gap-1.5 shrink-0">
          {subtitleBadge && (
            <span className="rounded-full bg-black/65 border border-white/15 px-2 py-0.5 text-[9px] font-bold text-cyan-300 whitespace-nowrap">
              {subtitleBadge}
            </span>
          )}
          <span
            className={`text-[10px] text-amber-300 transform transition-transform duration-200 ${
              isActive ? "rotate-180" : ""
            }`}
          >
            ▼
          </span>
        </div>
      </button>
    );
  };

  return (
    <div className="rabtv-vidsrc-protected fixed inset-0 z-50 flex justify-end items-start pt-[56px] sm:pt-[64px] pr-2 sm:pr-4 pointer-events-none">
      <style>{`
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
        className="fixed inset-0 bg-black/25 backdrop-blur-[2px] pointer-events-auto transition-opacity duration-300"
        onClick={handleCloseSidebar}
      />

      {/* Crystal Neon Console Blade Drawer */}
      <div
        data-tour="sidebar"
        className="relative my-1.5 w-[420px] max-w-[95vw] h-[calc(100dvh-74px)] rounded-[28px] border border-white/20 shadow-[0_25px_70px_rgba(0,0,0,0.95),inset_0_1px_1px_rgba(255,255,255,0.25)] flex flex-col z-10 animate-crystal-blade-in overflow-hidden pt-10 pb-10 px-3.5 sm:px-4 pointer-events-auto box-border backdrop-blur-2xl bg-slate-950/60"
      >
        {/* Translucent RABBIT_PANEL Neon Outer Frame Layer */}
        <div
          className="absolute inset-0 pointer-events-none z-0 opacity-75 mix-blend-lighten"
          style={{
            backgroundImage: `url(${RABBIT_PANEL})`,
            backgroundSize: "100% 100%",
            backgroundRepeat: "no-repeat",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/[0.05] via-slate-950/45 to-red-500/[0.05] pointer-events-none z-0" />

        {/* Scroll Up Arrow Button */}
        <button
          type="button"
          onClick={() => handleScrollSidebar("up")}
          className="absolute top-2 left-1/2 -translate-x-1/2 z-20 w-14 h-6 bg-black/80 hover:bg-black border border-cyan-400/40 rounded-full flex items-center justify-center text-amber-300 text-xs font-bold shadow-[0_0_12px_rgba(56,189,248,0.4)] transition hover:scale-110 cursor-pointer"
          title="Scroll Up"
        >
          ▲
        </button>

        {/* Scrollable Inner Container */}
        <div
          ref={sidebarContentRef}
          className="flex-1 overflow-y-auto px-1 pt-2.5 pb-6 w-full scrollbar-none relative z-10 box-border overflow-x-hidden"
          style={{
            maskImage:
              "linear-gradient(to bottom, transparent 0%, black 2.5%, black 97.5%, transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(to bottom, transparent 0%, black 2.5%, black 97.5%, transparent 100%)",
          }}
        >
          <div className="relative z-10 flex flex-col w-full box-border space-y-3 pb-4">
            {/* Crystal Profile Header Bar */}
            <div
              data-tour="sidebar-profile-header"
              className="flex items-center justify-between gap-2 rounded-2xl bg-black/55 backdrop-blur-xl border border-white/15 px-3 py-2.5 shadow-lg w-full box-border"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-10 h-10 rounded-xl overflow-hidden border border-cyan-400/40 bg-slate-900 shadow-[0_0_15px_rgba(56,189,248,0.3)] shrink-0 flex items-center justify-center">
                  <img
                    src={headerIconUrl}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <h3
                    className={`text-sm font-black tracking-wide truncate ${getPrimaryAccentColor(
                      appTheme
                    )}`}
                  >
                    <span className="mr-1">{profileMascot}</span>
                    {savedProfileName || "User Profile"}
                  </h3>
                  <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-bold">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span>Online</span>
                    </span>
                    <span className="text-[9px] text-slate-300 font-bold uppercase px-1.5 py-0.5 rounded bg-white/5 border border-white/10">
                      {ramMode === "low"
                        ? "1-2GB Stick"
                        : ramMode === "high"
                          ? "High RAM"
                          : "Auto RAM"}
                    </span>
                    {seniorEasyMode && (
                      <span className="text-[9px] text-amber-300 font-bold uppercase px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-400/30">
                        Easy
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCloseSidebar}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-red-600/80 border border-white/15 hover:border-red-400 text-xs font-bold text-slate-100 hover:text-white transition hover:scale-105 active:scale-95 shrink-0 cursor-pointer"
              >
                ✕ Close
              </button>
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
                      <p className="text-[11px] text-slate-300 font-bold mb-1.5">
                        Region / Language Catalog Feed:
                      </p>
                      <select
                        value={selectedGlobalFeed}
                        onChange={(e) =>
                          handleGlobalFeedChange(
                            e.target.value as GlobalFeedOption
                          )
                        }
                        className="h-10 w-full rounded-xl border border-cyan-400/35 bg-black/80 px-3 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-cyan-400 cursor-pointer"
                      >
                        {globalFeedOptions.map((opt) => (
                          <option
                            key={opt}
                            value={opt}
                            className="bg-slate-950 text-white"
                          >
                            🌐 {opt}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="pt-2.5 border-t border-white/10">
                      <p className="text-[11px] text-slate-300 font-bold mb-1.5">
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
                            className={`rounded-xl py-2 px-2 text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer hover:scale-[1.03] ${
                              startupTab === tab
                                ? `${getPrimaryBgColor(
                                    appTheme
                                  )} text-white shadow-md`
                                : getSubtlePillBg(appTheme)
                            }`}
                          >
                            {tab}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2.5 border-t border-white/10 space-y-2">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-300 font-bold">
                          ⭐ Pinned Live Channels:
                        </span>
                        <span className="font-extrabold text-amber-300">
                          {favoriteChannelCount} / {MAX_FAVORITE_CHANNELS}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <Link
                          to="/live-tv"
                          onClick={handleCloseSidebar}
                          className={`flex h-9 items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-bold transition hover:scale-[1.02] ${getSubtlePillBg(
                            appTheme
                          )}`}
                        >
                          <span>📡 Live TV</span>
                        </Link>
                        <Link
                          to="/watch-history"
                          onClick={handleCloseSidebar}
                          className={`flex h-9 items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-extrabold shadow-md transition hover:scale-[1.02] ${getPrimaryBgColor(
                            appTheme
                          )}`}
                        >
                          <span>🕒 History</span>
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
                      <p className="text-[11px] text-slate-300 mb-1.5 font-bold">
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
                                : getSubtlePillBg(appTheme)
                            }`}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Poster Corner Shape */}
                    <div className="pt-2.5 border-t border-white/10">
                      <p className="text-[11px] text-slate-300 mb-1.5 font-bold">
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
                                : getSubtlePillBg(appTheme)
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Poster Frame Style */}
                    <div className="pt-2.5 border-t border-white/10">
                      <p className="text-[11px] text-slate-300 mb-1.5 font-bold">
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
                                : getSubtlePillBg(appTheme)
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
                    <div className="pt-2.5 border-t border-white/10">
                      <p className="text-[11px] text-slate-300 mb-1.5 font-bold">
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
                                : getSubtlePillBg(appTheme)
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
                          <p className="text-[10px] text-slate-300">
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
                            showPosterBadges ? toggleActiveClass : "bg-slate-700"
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
                    <div className="pt-2.5 border-t border-white/10">
                      <p className="text-[11px] text-slate-300 mb-1.5 font-bold">
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
                                  : getSubtlePillBg(appTheme)
                              }`}
                            >
                              {size}
                            </button>
                          )
                        )}
                      </div>
                    </div>

                    {/* History Page Overscale */}
                    <div className="pt-2.5 border-t border-white/10">
                      <p className="text-[11px] text-slate-300 mb-1.5 font-bold">
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
                                : getSubtlePillBg(appTheme)
                            }`}
                          >
                            {scale === "off" ? "Off" : `+${scale}`}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 3D Seasonal Holiday Overlay Mode */}
                    <div className="pt-2.5 border-t border-white/10">
                      <p className="text-[11px] text-slate-300 mb-1.5 font-bold">
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
                            className={`rounded-xl py-1.5 px-2 text-[10px] font-bold transition-all cursor-pointer hover:scale-[1.03] ${
                              holidayOverride === opt.id
                                ? `${getPrimaryBgColor(
                                    appTheme
                                  )} text-white shadow-md`
                                : getSubtlePillBg(appTheme)
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Neon Glow Intensity + Safe Visual Reset */}
                    <div className="pt-2.5 border-t border-white/10 space-y-2.5">
                      <div>
                        <p className="text-[11px] text-slate-300 mb-1.5 font-bold">
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
                                  : getSubtlePillBg(appTheme)
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
                        className="w-full py-2 px-2 rounded-xl bg-black/70 hover:bg-white/15 border border-white/15 text-[11px] font-bold text-amber-300 transition cursor-pointer"
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
                    <div className="flex items-center justify-between gap-2 rounded-xl bg-black/65 border border-white/10 px-3 py-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0">
                        Station:
                      </span>
                      <span className="text-xs font-extrabold text-amber-300 truncate">
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
                            : getSubtlePillBg(appTheme)
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
                            : getSubtlePillBg(appTheme)
                        }`}
                      >
                        🔇 Radio Off
                      </button>
                    </div>

                    <div className="pt-2 border-t border-white/10 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] text-slate-300 font-bold">
                          Music Volume:
                        </p>
                        <span className="text-[11px] font-bold text-amber-300">
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
                        className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                      />
                    </div>

                    <div className="pt-2 border-t border-white/10">
                      <p className="text-[11px] text-slate-300 mb-2 font-bold">
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
                                className="group rounded-xl bg-black/60 border border-white/10 overflow-hidden"
                              >
                                <summary className="flex items-center justify-between px-3 py-1.5 text-xs font-bold text-amber-300 cursor-pointer select-none hover:bg-white/10 transition">
                                  <span className="flex items-center gap-2 truncate pr-2">
                                    <span>📁 {category}</span>
                                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/10 text-slate-300">
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

                                <div className="p-1.5 space-y-1 border-t border-white/10 bg-slate-950/75">
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
                                            : getSubtlePillBg(appTheme)
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
                    <div className="rounded-2xl bg-gradient-to-r from-amber-500/20 via-black/75 to-amber-500/15 border border-amber-400/45 p-3 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-black text-amber-300">
                          👓 One-Tap Senior Easy Mode
                        </p>
                        <p className="text-[10px] text-slate-200 leading-snug">
                          Large text, big buttons, yellow XL pointer, bright TV
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
                          seniorEasyMode ? "bg-amber-500" : "bg-slate-700"
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
                    <div className="space-y-2.5 pb-3 border-b border-white/15">
                      <p className="text-[10px] font-extrabold uppercase tracking-widest text-pink-300">
                        ✨ Fun Personalizations
                      </p>

                      <div>
                        <p className="text-[11px] text-slate-300 font-bold mb-1">
                          Profile Mascot Badge:
                        </p>
                        <div className="grid grid-cols-5 gap-1.5">
                          {PROFILE_MASCOT_OPTIONS.map((m) => (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => {
                                setProfileMascot(m.id);
                                setProfileMascotState(m.id);
                              }}
                              title={m.label}
                              className={`py-1.5 rounded-xl text-base transition-all cursor-pointer hover:scale-110 ${
                                profileMascot === m.id
                                  ? `${getPrimaryBgColor(
                                      appTheme
                                    )} ring-2 ring-white/50 shadow-md`
                                  : "bg-black/65 border border-white/10 hover:bg-white/15"
                              }`}
                            >
                              {m.id}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="text-[11px] text-slate-300 font-bold mb-1">
                          Home Greeting Style:
                        </p>
                        <select
                          value={greetingStyle}
                          onChange={(e) => {
                            const val = e.target.value as GreetingStyle;
                            setGreetingStyle(val);
                            setGreetingStyleState(val);
                          }}
                          className="h-9 w-full rounded-xl border border-white/15 bg-black/80 px-3 text-xs font-bold text-white focus:outline-none cursor-pointer"
                        >
                          {GREETING_STYLE_OPTIONS.map((g) => (
                            <option
                              key={g.id}
                              value={g.id}
                              className="bg-slate-950 text-white"
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
                          <p className="text-[10px] text-slate-300">
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
                            warmEyeCare ? "bg-amber-500" : "bg-slate-700"
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
                          <p className="text-[10px] text-slate-300">
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
                            className="px-2 py-1 rounded-lg bg-black/80 border border-white/15 text-[10px] font-bold text-cyan-300 cursor-pointer"
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
                                ? toggleActiveClass
                                : "bg-slate-700"
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
                    <div className="space-y-2.5 pb-3 border-b border-white/15">
                      <p className="text-[10px] font-extrabold uppercase tracking-widest text-cyan-300">
                        ♿ TV, Projector & Accessibility
                      </p>

                      <div>
                        <p className="text-[11px] text-slate-300 font-bold mb-1">
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
                                    : getSubtlePillBg(appTheme)
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
                          <p className="text-[10px] text-slate-300">
                            Enlarges cursor for TVs & projectors.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => onMouseToggle(!helpfulMouse)}
                          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                            helpfulMouse ? toggleActiveClass : "bg-slate-700"
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
                                  : getSubtlePillBg(appTheme)
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
                          <p className="text-[10px] text-slate-300">
                            Bigger icons & touch targets.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => onLargeButtonsToggle(!largeButtons)}
                          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                            largeButtons ? toggleActiveClass : "bg-slate-700"
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
                          <p className="text-[10px] text-slate-300">
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
                            highContrastFocus ? "bg-amber-500" : "bg-slate-700"
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
                          <p className="text-[10px] text-slate-300">
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
                            reducedMotion ? toggleActiveClass : "bg-slate-700"
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
                          <p className="text-[10px] text-slate-300">
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
                            uiClickSounds ? toggleActiveClass : "bg-slate-700"
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
                        <p className="text-[11px] text-slate-300 font-bold mb-1">
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
                                  : getSubtlePillBg(appTheme)
                              }`}
                            >
                              {opt.value}%
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="pt-1">
                        <p className="text-[11px] text-slate-300 font-bold mb-1">
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
                            className="h-8 rounded-lg border border-white/15 bg-black/80 px-1.5 text-[10px] font-bold text-white"
                          >
                            <option value="normal">Normal</option>
                            <option value="large">Large</option>
                            <option value="xl">XL Size</option>
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
                            className="h-8 rounded-lg border border-white/15 bg-black/80 px-1.5 text-[10px] font-bold text-white"
                          >
                            <option value="white">White</option>
                            <option value="yellow">Yellow</option>
                            <option value="cyan">Cyan</option>
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
                            className="h-8 rounded-lg border border-white/15 bg-black/80 px-1.5 text-[10px] font-bold text-white"
                          >
                            <option value="none">No Box</option>
                            <option value="medium">Dim Box</option>
                            <option value="solid">Solid Box</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* KIDS SAFE MODE LOCK */}
                    <div className="space-y-2 pb-3 border-b border-white/15">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-extrabold text-emerald-300">
                            🧒 Kids Safe Mode Lock
                          </p>
                          <p className="text-[10px] text-slate-300">
                            Caps catalog to kid-safe titles until PIN unlocked.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleKidsLockToggle()}
                          className={`px-3 py-1.5 rounded-xl text-[10px] font-extrabold shrink-0 transition cursor-pointer ${
                            kidsLocked
                              ? "bg-emerald-600 text-white shadow"
                              : "bg-black/75 border border-white/15 text-slate-200 hover:bg-white/15"
                          }`}
                        >
                          {kidsLocked ? "🔓 Unlock" : "🔒 Lock ON"}
                        </button>
                      </div>

                      {kidsLocked && (
                        <input
                          type="password"
                          inputMode="numeric"
                          maxLength={6}
                          placeholder="Enter 4–6 digit PIN then tap Unlock"
                          value={kidsUnlockPin}
                          onChange={(e) =>
                            setKidsUnlockPin(
                              e.target.value.replace(/\D/g, "").slice(0, 6)
                            )
                          }
                          className="w-full rounded-xl border border-emerald-400/40 bg-black/80 px-3 py-1.5 text-xs font-bold text-white placeholder-slate-400 focus:outline-none tracking-widest"
                        />
                      )}

                      {kidsLockStatus && (
                        <p className="text-[10px] font-bold text-amber-300 text-center">
                          {kidsLockStatus}
                        </p>
                      )}
                    </div>

                    {/* PROFILE, AGE & 4-6 DIGIT HASHED PIN FORM */}
                    <form
                      onSubmit={handleUnifiedProfileUpdate}
                      className="space-y-2.5"
                    >
                      <p className="text-[10px] font-extrabold uppercase tracking-widest text-amber-300">
                        🔐 Profile, Age & Parental PIN (4–6 Digits)
                      </p>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="block text-[11px] text-slate-300 mb-1 font-bold">
                            Name:
                          </span>
                          <input
                            type="text"
                            maxLength={25}
                            value={profileNameInput}
                            onChange={(e) =>
                              setProfileNameInput(e.target.value)
                            }
                            className="w-full rounded-xl border border-white/15 bg-black/80 px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
                          />
                        </div>
                        <div>
                          <span className="block text-[11px] text-slate-300 mb-1 font-bold">
                            Age:
                          </span>
                          <input
                            type="number"
                            min={1}
                            max={120}
                            value={userAgeInput}
                            onChange={(e) => setUserAgeInput(e.target.value)}
                            className="w-full rounded-xl border border-white/15 bg-black/80 px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
                          />
                        </div>
                      </div>

                      <div>
                        <span className="block text-[11px] text-slate-300 mb-1 font-bold">
                          Current 4–6 Digit PIN (Required):
                        </span>
                        <input
                          type="password"
                          inputMode="numeric"
                          maxLength={6}
                          placeholder="••••••"
                          value={unifiedAgeCodeInput}
                          onChange={(e) =>
                            setUnifiedAgeCodeInput(
                              e.target.value.replace(/\D/g, "").slice(0, 6)
                            )
                          }
                          className="w-full rounded-xl border border-white/15 bg-black/80 px-2.5 py-1.5 text-xs text-white focus:outline-none tracking-widest"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div>
                          <span className="block text-[11px] text-slate-300 mb-1 font-bold">
                            New PIN (Opt):
                          </span>
                          <input
                            type="password"
                            inputMode="numeric"
                            maxLength={6}
                            placeholder="••••••"
                            value={newPasscode}
                            onChange={(e) =>
                              setNewPasscode(
                                e.target.value.replace(/\D/g, "").slice(0, 6)
                              )
                            }
                            className="w-full rounded-xl border border-white/15 bg-black/80 px-2.5 py-1.5 text-xs text-white focus:outline-none tracking-widest"
                          />
                        </div>
                        <div>
                          <span className="block text-[11px] text-slate-300 mb-1 font-bold">
                            Confirm PIN:
                          </span>
                          <input
                            type="password"
                            inputMode="numeric"
                            maxLength={6}
                            placeholder="••••••"
                            value={confirmNewPasscode}
                            onChange={(e) =>
                              setConfirmNewPasscode(
                                e.target.value.replace(/\D/g, "").slice(0, 6)
                              )
                            }
                            className="w-full rounded-xl border border-white/15 bg-black/80 px-2.5 py-1.5 text-xs text-white focus:outline-none tracking-widest"
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
                      <p className="text-[11px] text-slate-300 font-bold mb-1">
                        Device Memory Allocation Profile:
                      </p>
                      <p className="text-[10px] text-slate-400 mb-2 leading-snug">
                        Use <strong className="text-cyan-300">1–2GB</strong> for
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
                                : getSubtlePillBg(appTheme)
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-white/10">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white">
                          📶 Data Saver / Lite Posters
                        </p>
                        <p className="text-[10px] text-slate-400">
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
                          dataSaverMode ? toggleActiveClass : "bg-slate-700"
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                            dataSaverMode ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </div>

                    <div className="pt-2.5 border-t border-white/10">
                      <p className="text-[11px] text-slate-300 font-bold mb-1.5">
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
                                : getSubtlePillBg(appTheme)
                            }`}
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2.5 border-t border-white/10 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] text-slate-300 font-bold">
                          Default Live Player Volume:
                        </p>
                        <span className="text-[11px] font-bold text-cyan-300">
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
                        className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                      />
                    </div>

                    <div className="pt-2.5 border-t border-white/10 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white">
                          Auto-Play Next Episode
                        </p>
                        <p className="text-[10px] text-slate-400">
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
                          autoPlayNext ? toggleActiveClass : "bg-slate-700"
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                            autoPlayNext ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </div>

                    <div className="pt-2.5 border-t border-white/10 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-1 text-[10px] font-bold">
                        <span className="text-slate-300">
                          Storage ({storageHealth.cacheEntriesCount} caches)
                        </span>
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
                        className={`w-full py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer hover:scale-[1.02] ${getSubtlePillBg(
                          appTheme
                        )}`}
                      >
                        🧹 Purge Stream & Metadata Caches
                      </button>

                      <p className="text-[9px] text-slate-400 font-mono text-center break-all">
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
                      <p className="text-[11px] text-slate-300 font-bold mb-1.5">
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
                                : getSubtlePillBg(appTheme)
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2.5 border-t border-white/10">
                      <p className="text-[11px] text-slate-300 font-bold mb-1.5">
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
                                  : getSubtlePillBg(appTheme)
                              }`}
                            >
                              {shortLabel}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="pt-2.5 border-t border-white/10 space-y-2">
                      <p className="text-[11px] text-slate-300 font-bold">
                        Profile, Poster Styles & Watchlist Backup:
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={handleSaveBackup}
                          className={`rounded-xl px-2 py-2 text-xs font-bold whitespace-nowrap transition-all cursor-pointer hover:scale-[1.03] ${getSubtlePillBg(
                            appTheme
                          )}`}
                        >
                          💾 Export JSON
                        </button>
                        <label
                          className={`text-center cursor-pointer rounded-xl px-2 py-2 text-xs font-bold whitespace-nowrap transition-all hover:scale-[1.03] ${getSubtlePillBg(
                            appTheme
                          )}`}
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

            {/* REFER FRIENDS & EARN CASH LAUNCHER */}
            <div data-tour="sidebar-referrals" className="pt-2 w-full box-border">
              <button
                type="button"
                onClick={() => setIsReferralModalOpen(true)}
                className="w-full rounded-2xl border border-amber-400/50 bg-gradient-to-r from-amber-950/75 via-emerald-950/60 to-amber-950/75 hover:from-amber-900/80 hover:to-emerald-900/75 p-3 text-left shadow-[0_10px_28px_rgba(245,158,11,0.22)] transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 border border-amber-400/50 text-base">
                      💸
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-black text-amber-300 truncate">
                        Refer Friends & Earn Cash
                      </p>
                      <p className="text-[10px] text-emerald-200/90 font-semibold truncate">
                        ${PAYOUT_PER_EXTRA_REFERRAL_CAD}/friend after{" "}
                        {MIN_CONFIRMED_REFERRALS} paid invites
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-emerald-500/20 border border-emerald-400/45 px-2.5 py-0.5 text-[10px] font-black text-emerald-300">
                    Open ↗
                  </span>
                </div>
              </button>
            </div>

            {/* ADMIN PANEL (IF ADMIN) */}
            {isAdmin && (
              <div className="pt-3 border-t border-white/15 w-full box-border">
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
              className="pt-3 border-t border-white/15 space-y-2 w-full box-border"
            >
              <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-300 px-1">
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
                className="w-full py-2.5 rounded-xl bg-black/60 hover:bg-white/[0.12] border border-white/15 text-xs font-bold text-slate-200 transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
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
                  className="w-full py-2.5 px-2 rounded-xl bg-cyan-950/60 hover:bg-cyan-900/75 border border-cyan-400/35 text-[11px] font-extrabold text-cyan-200 transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
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
                  className="w-full py-2.5 px-2 rounded-xl bg-black/60 hover:bg-white/[0.12] border border-white/15 text-[11px] font-extrabold text-slate-200 transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  📜 Terms (ToS)
                </button>
              </div>
            </div>

            {/* UPDATE CHANNEL & ACTIONS */}
            <div data-tour="sidebar-updates" className="pt-3 border-t border-white/15 space-y-2 w-full box-border">
              <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-300 px-1">
                Update Channel
              </h4>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleUpdateChannelChange("stable")}
                  className={`py-2 rounded-xl text-xs font-bold transition-all hover:scale-105 cursor-pointer ${
                    updateChannel === "stable"
                      ? `${getPrimaryBgColor(appTheme)} text-white`
                      : "bg-black/60 text-slate-300 hover:bg-white/[0.12] border border-white/15"
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
                      : "bg-black/60 text-slate-300 hover:bg-white/[0.12] border border-white/15"
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
            <div data-tour="sidebar-license" className="pt-3 border-t border-white/15 space-y-2 w-full box-border">
              <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-300 px-1">
                License Status
              </h4>
              {isAdmin ? (
                <p className="text-[11px] text-red-300 font-bold bg-red-500/15 border border-red-500/30 p-2.5 rounded-xl backdrop-blur-md">
                  🔐 Admin access active.
                </p>
              ) : isTrialActive ? (
                <div className="space-y-2">
                  <p className="text-[11px] text-amber-300 bg-amber-500/15 border border-amber-500/30 p-2.5 rounded-xl leading-relaxed backdrop-blur-md">
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
                      placeholder="Unlock code"
                      value={unlockCodeInput}
                      onChange={(e) => setUnlockCodeInput(e.target.value)}
                      className="w-full rounded-xl border border-white/15 bg-black/80 px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
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
                <p className="text-[11px] text-emerald-400 font-bold bg-emerald-500/15 border border-emerald-500/30 p-2.5 rounded-xl backdrop-blur-md">
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
            <div className="pt-4 border-t border-white/15 text-center w-full">
              <img
                src={RABBIT_DIVIDER}
                alt=""
                className="w-2/3 mx-auto h-2 object-contain opacity-80 mb-2.5"
              />
              <span className="text-[9px] text-slate-400 uppercase tracking-widest font-extrabold">
                Crystal Console UI v2.8 • RABBiT TV
              </span>
            </div>
          </div>
        </div>

        {/* Scroll Down Arrow Button */}
        <button
          type="button"
          onClick={() => handleScrollSidebar("down")}
          className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 w-14 h-6 bg-black/80 hover:bg-black border border-red-400/40 rounded-full flex items-center justify-center text-amber-300 text-xs font-bold shadow-[0_0_12px_rgba(239,68,68,0.4)] transition hover:scale-110 cursor-pointer"
          title="Scroll Down"
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