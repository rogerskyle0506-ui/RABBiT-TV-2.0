// src/components/sidebar.tsx
import React, { useState, useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { AdminPanel } from "@/components/AdminPanel";
import { TIMEOUT_OPTIONS } from "@/components/Screensaver";
import { bgAudio, RADIO_STATIONS } from "@/lib/background-audio";
import { sendPermanentActivationAlert } from "@/lib/report";
import { checkForAppUpdates } from "@/lib/updater";
import {
  CardSize,
  StreamQuality,
  AppTheme,
  HistoryScale,
  DISCLAIMER_ACCEPTED_KEY,
  saveStreamQuality,
  getSavedUserAge,
  saveUserAge,
} from "@/lib/settings";

const AGE_LOCK_KEY = "rabtv_age_passcode";
const RAM_MODE_STORAGE_KEY = "rabtv_ram_mode";
const AUTOPLAY_NEXT_STORAGE_KEY = "rabtv_autoplay_next";
const HEARTBEAT_DEFAULT_MIGRATED_KEY = "rabtv_heartbeat_default_v1";

export type RamMode = "low" | "high";

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

// Original Neon Rabbit Console Assets
const RABBIT_HEADER_PILL =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/main/assets/rabbit-header-pill.jpg";
const RABBIT_PANEL =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/main/assets/rabbit-panel.jpg";
const RABBIT_PANEL_ALT =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/main/assets/rabbit-panel-alt.jpg";
const RABBIT_DIVIDER =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/main/assets/rabbit-divider.jpg";

/**
 * Finds "Heartbeat Radio" inside the "2000s" category of RADIO_STATIONS.
 */
export function getDefaultHeartbeatStationUrl(): string {
  // 1. Direct lookup in "2000s"
  const stations2000s =
    RADIO_STATIONS["2000s"] ||
    RADIO_STATIONS["2000's"] ||
    RADIO_STATIONS["00s"] ||
    [];
  const exactHeartbeat = stations2000s.find((s) =>
    s.name.toLowerCase().includes("heartbeat")
  );
  if (exactHeartbeat?.url) return exactHeartbeat.url;
  if (stations2000s[0]?.url) return stations2000s[0].url;

  // 2. Fallback scan across all categories for Heartbeat Radio or 2000s
  for (const [category, list] of Object.entries(RADIO_STATIONS)) {
    const match = list.find((s) => s.name.toLowerCase().includes("heartbeat"));
    if (match?.url) return match.url;
    if (category.toLowerCase().includes("2000") && list[0]?.url) {
      return list[0].url;
    }
  }

  return RADIO_STATIONS["80s"]?.[0]?.url || "";
}

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
  headerIconUrl,
  allThemesList,
  getPrimaryBgColor,
  getPrimaryAccentColor,
}: SidebarProps) {
  const sidebarContentRef = useRef<HTMLDivElement>(null);
  const lastScrollYRef = useRef<number>(0);

  const [activeSection, setActiveSection] =
    useState<ConsolidatedSection>(null);

  const [screensaverTimeoutMs, setScreensaverTimeoutMs] = useState<number>(
    () => {
      if (typeof window !== "undefined") {
        const saved = localStorage.getItem("rabtv_screensaver_timeout_ms");
        return saved ? Number(saved) : 2.5 * 60 * 60 * 1000;
      }
      return 2.5 * 60 * 60 * 1000;
    }
  );

  const [bgMusicVolume, setBgMusicVolume] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("rabtv_bg_volume");
      return saved !== null ? parseFloat(saved) : 0.5;
    }
    return 0.5;
  });

  const [currentStationUrl, setCurrentStationUrl] = useState<string>(() => {
    const heartbeatUrl = getDefaultHeartbeatStationUrl();
    if (typeof window !== "undefined") {
      const migrated = localStorage.getItem(HEARTBEAT_DEFAULT_MIGRATED_KEY);
      const saved = localStorage.getItem("rabtv_radio_url");
      if (!migrated && heartbeatUrl) {
        localStorage.setItem(HEARTBEAT_DEFAULT_MIGRATED_KEY, "true");
        localStorage.setItem("rabtv_radio_url", heartbeatUrl);
        return heartbeatUrl;
      }
      if (saved) return saved;
    }
    return heartbeatUrl;
  });

  // Ensure Heartbeat Radio (2000s) is applied to bgAudio on initial app boot
  useEffect(() => {
    if (typeof window === "undefined") return;
    const heartbeatUrl = getDefaultHeartbeatStationUrl();
    const migrated = localStorage.getItem(HEARTBEAT_DEFAULT_MIGRATED_KEY);
    const saved = localStorage.getItem("rabtv_radio_url");

    if ((!migrated || !saved) && heartbeatUrl) {
      localStorage.setItem(HEARTBEAT_DEFAULT_MIGRATED_KEY, "true");
      localStorage.setItem("rabtv_radio_url", heartbeatUrl);
      bgAudio.setStation(heartbeatUrl);
      setCurrentStationUrl(heartbeatUrl);
    }
  }, []);

  // Hardware RAM Mode State ("low" for 1-2GB streaming sticks, "high" for 4GB+ devices)
  const [ramMode, setRamModeState] = useState<RamMode>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(RAM_MODE_STORAGE_KEY) as RamMode | null;
      if (saved === "low" || saved === "high") return saved;
      const devMem = (navigator as any).deviceMemory;
      if (typeof devMem === "number" && devMem <= 2) return "low";
    }
    return "low";
  });

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-ram-mode", ramMode);
    }
  }, [ramMode]);

  const [activeStreamQuality, setActiveStreamQuality] =
    useState<StreamQuality>(streamQuality);

  useEffect(() => {
    setActiveStreamQuality(streamQuality);
  }, [streamQuality]);

  const [autoPlayNext, setAutoPlayNextState] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(AUTOPLAY_NEXT_STORAGE_KEY);
      return saved !== null ? saved === "true" : true;
    }
    return true;
  });

  const [cacheClearMsg, setCacheClearMsg] = useState<string | null>(null);

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

  // Close sidebar if main window scrolls significantly
  useEffect(() => {
    if (!isOpen || typeof window === "undefined") return;
    lastScrollYRef.current = window.scrollY;

    const handleWindowScroll = () => {
      if (Math.abs(window.scrollY - lastScrollYRef.current) > 60) {
        setActiveSection(null);
        onClose();
      }
    };

    window.addEventListener("scroll", handleWindowScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleWindowScroll);
  }, [isOpen, onClose]);

  // D-pad / Arrow Key navigation handler with smooth scroll-into-view
  useEffect(() => {
    if (!isOpen) return;

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
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCloseSidebar = () => {
    setActiveSection(null);
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
    if (typeof window !== "undefined") {
      localStorage.setItem("rabtv_screensaver_timeout_ms", String(newMs));
      window.dispatchEvent(new Event("rabtv_settings_updated"));
    }
  };

  const handleVolumeChange = (newVol: number) => {
    setBgMusicVolume(newVol);
    bgAudio.setVolume(newVol);
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
    if (typeof window !== "undefined") {
      localStorage.setItem(RAM_MODE_STORAGE_KEY, mode);
      document.documentElement.setAttribute("data-ram-mode", mode);
      window.dispatchEvent(
        new CustomEvent("rabtv_ram_mode_updated", { detail: mode })
      );
      window.dispatchEvent(new Event("rabtv_settings_updated"));
    }
  };

  const handleStreamQualitySelect = (quality: StreamQuality) => {
    saveStreamQuality(quality);
    setActiveStreamQuality(quality);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("rabtv_settings_updated"));
    }
  };

  const handleAutoPlayNextToggle = (enabled: boolean) => {
    setAutoPlayNextState(enabled);
    if (typeof window !== "undefined") {
      localStorage.setItem(AUTOPLAY_NEXT_STORAGE_KEY, String(enabled));
      window.dispatchEvent(new Event("rabtv_settings_updated"));
    }
  };

  const handlePurgeVolatileCaches = () => {
    if (typeof window === "undefined") return;
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (
          key &&
          (key.startsWith("rabtv_cache_") ||
            key.startsWith("rabtv_fast_live_health") ||
            key.startsWith("rabtv_ublock_cached"))
        ) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
      setCacheClearMsg(
        `✓ Purged ${keysToRemove.length} cached stream & metadata buffers!`
      );
      setTimeout(() => setCacheClearMsg(null), 3500);
    } catch {
      setCacheClearMsg("✓ Stream memory buffers refreshed!");
      setTimeout(() => setCacheClearMsg(null), 3000);
    }
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

  const getAgeLockCode = () =>
    typeof window !== "undefined"
      ? localStorage.getItem(AGE_LOCK_KEY) || ""
      : "";

  const handleUnifiedProfileUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    const locked = getAgeLockCode();

    if (!locked || unifiedAgeCodeInput.trim() !== locked) {
      setUnifiedUpdateStatus({
        text: "⚠️ Current age-lock code is incorrect.",
        isError: true,
      });
      setUnifiedAgeCodeInput("");
      return;
    }

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
      if (!/^\d{4}$/.test(trimmedNew)) {
        setUnifiedUpdateStatus({
          text: "⚠️ New age-lock code must be exactly 4 digits.",
          isError: true,
        });
        return;
      }
      if (trimmedNew !== trimmedConfirm) {
        setUnifiedUpdateStatus({
          text: "⚠️ New codes do not match.",
          isError: true,
        });
        return;
      }
      if (typeof window !== "undefined") {
        localStorage.setItem(AGE_LOCK_KEY, trimmedNew);
      }
    }

    saveUserAge(parsedAge);
    const finalName = profileNameInput.trim() || "Friend";
    if (typeof window !== "undefined") {
      localStorage.setItem("rabtv_profile_name", finalName);
    }
    setSavedProfileName(finalName);

    setUnifiedUpdateStatus({
      text: "✓ Profile and age-lock updated successfully!",
      isError: false,
    });
    setUnifiedAgeCodeInput("");
    setNewPasscode("");
    setConfirmNewPasscode("");
    setTimeout(() => setUnifiedUpdateStatus(null), 3500);
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
        });
        if (res.ok) {
          const gistData = await res.json();
          const rawContent = gistData.files?.["keys.json"]?.content;
          if (rawContent) {
            const keysList = JSON.parse(rawContent);
            if (Array.isArray(keysList)) {
              const matchedIndex = keysList.findIndex((item: any) =>
                typeof item === "object" && item !== null
                  ? item.key === String(unlockCodeInput.trim()) &&
                    item.active === true
                  : String(item) === String(unlockCodeInput.trim())
              );
              if (matchedIndex !== -1) {
                isValidGitHubCode = true;
                if (typeof keysList[matchedIndex] === "object") {
                  keysList[matchedIndex].active = false;
                  keysList[matchedIndex].usedBy = `${name} (Age: ${age})`;
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
      setTimeout(() => {
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
      cardSize,
      streamQuality: activeStreamQuality,
      appTheme,
      helpfulMouse,
      historyOverscale,
      largeButtons,
      ramMode,
      autoPlayNext,
      userAge: getSavedUserAge(),
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
    setBackupStatus("Profile settings backup saved!");
    setTimeout(() => setBackupStatus(null), 3000);
  };

  const handleRestoreBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.cardSize) onSizeChange(data.cardSize);
        if (data.streamQuality) handleStreamQualitySelect(data.streamQuality);
        if (data.appTheme) onThemeChange(data.appTheme);
        if (typeof data.helpfulMouse === "boolean")
          onMouseToggle(data.helpfulMouse);
        if (data.historyOverscale)
          onHistoryOverscaleChange(data.historyOverscale);
        if (typeof data.largeButtons === "boolean")
          onLargeButtonsToggle(data.largeButtons);
        if (data.ramMode === "low" || data.ramMode === "high")
          handleRamModeChange(data.ramMode);
        if (typeof data.autoPlayNext === "boolean")
          handleAutoPlayNextToggle(data.autoPlayNext);
        if (data.userAge) saveUserAge(data.userAge);
        if (data.profileName && typeof window !== "undefined") {
          localStorage.setItem("rabtv_profile_name", data.profileName);
          setSavedProfileName(data.profileName);
        }
        if (data.myList && typeof window !== "undefined")
          localStorage.setItem("rabtv_my_list", data.myList);
        if (data.favorites && typeof window !== "undefined")
          localStorage.setItem("rabtv_favorites", data.favorites);

        if (typeof window !== "undefined") {
          localStorage.removeItem(DISCLAIMER_ACCEPTED_KEY);
          localStorage.removeItem("rabtv_access_status");
          localStorage.removeItem("rabtv_is_admin");
        }
        onTriggerFirstStartModal();
        handleCloseSidebar();
        setBackupStatus(
          "Settings restored. Please reinstate your passcode agreement."
        );
      } catch {
        setBackupStatus("Failed to restore backup file.");
      }
    };
    reader.readAsText(file);
  };

  const getSubtlePillBg = (theme: AppTheme) => {
    switch (theme) {
      case "red":
        return "bg-red-950/45 border border-red-500/30 text-red-100 hover:bg-red-900/65";
      case "midnight":
        return "bg-blue-950/45 border border-blue-500/30 text-blue-100 hover:bg-blue-900/65";
      case "emerald":
        return "bg-emerald-950/45 border border-emerald-500/30 text-emerald-100 hover:bg-emerald-900/65";
      case "amber":
        return "bg-yellow-950/45 border border-amber-500/30 text-amber-100 hover:bg-yellow-900/65";
      case "cyan":
        return "bg-cyan-950/45 border border-cyan-500/30 text-cyan-100 hover:bg-cyan-900/65";
      case "violet":
      default:
        return "bg-purple-950/45 border border-violet-500/30 text-purple-100 hover:bg-purple-900/65";
    }
  };

  const toggleSection = (section: ConsolidatedSection) => {
    setActiveSection((prev) => (prev === section ? null : section));
  };

  // Find active station name for the radio badge
  let activeStationName = "Heartbeat Radio";
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

  /**
   * Renders a Crystal Neon Accordion Header using the signature RABBIT_HEADER_PILL
   * with 3D mouse hover & D-pad focus pop-out physics.
   */
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
        className={`crystal-menu-pill w-full flex items-center justify-between px-6 py-3.5 text-left text-xs font-extrabold text-white relative overflow-hidden rounded-2xl cursor-pointer box-border transition-all duration-200 ease-out hover:scale-[1.04] focus:scale-[1.05] hover:-translate-y-0.5 focus:-translate-y-0.5 active:scale-[0.98] focus:outline-none ${
          isActive
            ? "ring-2 ring-cyan-400/90 shadow-[0_0_28px_rgba(56,189,248,0.45),0_0_20px_rgba(239,68,68,0.35)] scale-[1.02]"
            : "hover:shadow-[0_10px_28px_rgba(56,189,248,0.3),0_0_18px_rgba(239,68,68,0.25)] focus:ring-2 focus:ring-cyan-400"
        }`}
        style={{
          WebkitMaskImage:
            "linear-gradient(to right, rgba(0,0,0,0.12) 0%, rgba(0,0,0,1) 10%, rgba(0,0,0,1) 90%, rgba(0,0,0,0.12) 100%)",
          maskImage:
            "linear-gradient(to right, rgba(0,0,0,0.12) 0%, rgba(0,0,0,1) 10%, rgba(0,0,0,1) 90%, rgba(0,0,0,0.12) 100%)",
        }}
      >
        {/* Signature Neon Pill Artwork with Crystal Glass Transparency */}
        <div
          className="absolute inset-0 pointer-events-none rounded-2xl overflow-hidden z-0 opacity-85"
          style={{
            backgroundImage: `url(${RABBIT_HEADER_PILL})`,
            backgroundSize: "113% 380%",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "center center",
          }}
        >
          <div className="absolute inset-0 bg-slate-950/30 backdrop-blur-[4px] w-full h-full" />
        </div>

        <span className="relative z-10 flex items-center gap-2.5 truncate pr-2 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
          <span className="text-sm shrink-0">{icon}</span>
          <span className="truncate">{title}</span>
        </span>

        <div className="relative z-10 flex items-center gap-2 shrink-0">
          {subtitleBadge && (
            <span className="rounded-full bg-black/55 border border-white/15 px-2 py-0.5 text-[9px] font-bold text-cyan-300 backdrop-blur-md">
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

      {/* Crystal Neon Console Blade Drawer (Restored RABBIT_PANEL with Glass Transparency) */}
      <div className="relative my-1.5 w-[420px] max-w-[95vw] h-[calc(100dvh-74px)] rounded-[30px] border border-white/20 shadow-[0_25px_70px_rgba(0,0,0,0.95),inset_0_1px_1px_rgba(255,255,255,0.25)] flex flex-col z-10 animate-crystal-blade-in overflow-hidden pt-11 pb-11 px-5 pointer-events-auto box-border backdrop-blur-2xl bg-slate-950/50">
        {/* Translucent RABBIT_PANEL Neon Outer Frame Layer */}
        <div
          className="absolute inset-0 pointer-events-none z-0 opacity-80 mix-blend-lighten"
          style={{
            backgroundImage: `url(${RABBIT_PANEL})`,
            backgroundSize: "100% 100%",
            backgroundRepeat: "no-repeat",
          }}
        />
        {/* Subtle Glass Specular Tint */}
        <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/[0.06] via-slate-950/40 to-red-500/[0.06] pointer-events-none z-0" />

        {/* Scroll Up Arrow Button */}
        <button
          type="button"
          onClick={() => handleScrollSidebar("up")}
          className="absolute top-2.5 left-1/2 -translate-x-1/2 z-20 w-14 h-6 bg-black/75 hover:bg-black border border-cyan-400/35 rounded-full flex items-center justify-center text-amber-300 text-xs font-bold shadow-[0_0_12px_rgba(56,189,248,0.4)] transition hover:scale-110 cursor-pointer"
          title="Scroll Up"
        >
          ▲
        </button>

        {/* Scrollable Inner Container */}
        <div
          ref={sidebarContentRef}
          className="flex-1 overflow-y-auto px-2.5 pt-4 pb-6 w-full scrollbar-none relative z-10 box-border overflow-x-hidden"
          style={{
            maskImage:
              "linear-gradient(to bottom, transparent 0%, black 3%, black 97%, transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(to bottom, transparent 0%, black 3%, black 97%, transparent 100%)",
          }}
        >
          <div className="relative z-10 flex flex-col w-full box-border space-y-3 pb-4">
            {/* Crystal Profile Header Bar */}
            <div className="flex items-center justify-between rounded-2xl bg-black/45 backdrop-blur-xl border border-white/15 px-3.5 py-2.5 shadow-lg w-full box-border">
              <div className="flex items-center gap-3 min-w-0">
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
                    {savedProfileName || "User Profile"}
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-bold">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span>Online</span>
                    </span>
                    <span className="text-[9px] text-slate-400 font-bold uppercase px-1.5 py-0.5 rounded bg-white/5 border border-white/10">
                      {ramMode === "low" ? "1-2GB Stick" : "High RAM"}
                    </span>
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
            <div className="space-y-2.5 w-full box-border pt-1">
              {/* 1. GLOBAL FEED & WATCH HISTORY */}
              <div className="w-full box-border">
                {renderCrystalAccordionButton(
                  "feedAndHistory",
                  "🌐",
                  "Global Feed & Watch History",
                  selectedGlobalFeed === "All (Default)"
                    ? "Global"
                    : selectedGlobalFeed
                )}

                {activeSection === "feedAndHistory" && (
                  <div className="relative w-full px-5 py-4 rounded-2xl mt-2 shadow-2xl overflow-hidden box-border backdrop-blur-xl bg-slate-950/55 border border-white/15 space-y-3.5">
                    <div
                      className="absolute inset-0 pointer-events-none z-0 opacity-75 mix-blend-lighten"
                      style={{
                        backgroundImage: `url(${RABBIT_PANEL})`,
                        backgroundSize: "100% 100%",
                        backgroundRepeat: "no-repeat",
                      }}
                    />
                    <div className="relative z-10 space-y-3 w-full box-border">
                      <div>
                        <p className="text-[11px] text-slate-300 font-bold mb-1.5">
                          Select Region / Language Catalog Feed:
                        </p>
                        <select
                          value={selectedGlobalFeed}
                          onChange={(e) =>
                            handleGlobalFeedChange(
                              e.target.value as GlobalFeedOption
                            )
                          }
                          className="h-10 w-full rounded-xl border border-cyan-400/30 bg-black/70 px-3 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-cyan-400 cursor-pointer"
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
                          Activity & Playback Timeline:
                        </p>
                        <Link
                          to="/watch-history"
                          onClick={handleCloseSidebar}
                          className={`flex h-10 w-full items-center justify-center gap-2 rounded-xl px-3 text-xs font-extrabold shadow-lg transition hover:scale-[1.03] active:scale-95 ${getPrimaryBgColor(
                            appTheme
                          )}`}
                        >
                          <span>🕒 Open Watch History & Activity</span>
                        </Link>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 2. THEMES, SCALE & GRID SIZE (Collapsed Together!) */}
              <div className="w-full box-border">
                {renderCrystalAccordionButton(
                  "themesAndScale",
                  "🎨",
                  "Themes, Scale & Grid Size",
                  `${appTheme.toUpperCase()} • ${cardSize.toUpperCase()}`
                )}

                {activeSection === "themesAndScale" && (
                  <div className="relative w-full px-5 py-4 rounded-2xl mt-2 shadow-2xl overflow-hidden box-border backdrop-blur-xl bg-slate-950/55 border border-white/15 space-y-3.5">
                    <div
                      className="absolute inset-0 pointer-events-none z-0 opacity-75 mix-blend-lighten"
                      style={{
                        backgroundImage: `url(${RABBIT_PANEL_ALT})`,
                        backgroundSize: "100% 100%",
                        backgroundRepeat: "no-repeat",
                      }}
                    />
                    <div className="relative z-10 space-y-3.5 w-full box-border">
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
                              className={`rounded-xl p-2 text-xs font-bold transition-all text-left w-full cursor-pointer hover:scale-[1.04] focus:scale-[1.04] ${
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
                    </div>
                  </div>
                )}
              </div>

              {/* 3. BACKGROUND LOBBY RADIO (Defaulted to Heartbeat Radio in 2000s!) */}
              <div className="w-full box-border">
                {renderCrystalAccordionButton(
                  "audio",
                  "🎵",
                  "Background Lobby Radio",
                  bgMusicState === "playing" ? "ON" : "MUTED"
                )}

                {activeSection === "audio" && (
                  <div className="relative w-full px-5 py-4 rounded-2xl mt-2 shadow-2xl overflow-hidden box-border backdrop-blur-xl bg-slate-950/55 border border-white/15 space-y-3">
                    <div
                      className="absolute inset-0 pointer-events-none z-0 opacity-75 mix-blend-lighten"
                      style={{
                        backgroundImage: `url(${RABBIT_PANEL})`,
                        backgroundSize: "100% 100%",
                        backgroundRepeat: "no-repeat",
                      }}
                    />
                    <div className="relative z-10 space-y-3 w-full box-border">
                      <div className="flex items-center justify-between rounded-xl bg-black/55 border border-white/10 px-3 py-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Tuned Station:
                        </span>
                        <span className="text-xs font-extrabold text-amber-300 truncate max-w-[180px]">
                          📻 {activeStationName}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => onBackgroundAudioToggle("playing")}
                          className={`rounded-xl py-2 text-xs font-bold transition-all cursor-pointer hover:scale-105 ${
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
                          className={`rounded-xl py-2 text-xs font-bold transition-all cursor-pointer hover:scale-105 ${
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

                      {/* Volume Slider */}
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

                      {/* Genre Folders (2000s auto-expanded if active) */}
                      <div className="pt-2 border-t border-white/10">
                        <p className="text-[11px] text-slate-300 mb-2 font-bold">
                          Select Channel by Genre:
                        </p>
                        <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 scrollbar-none">
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
                                  className="group rounded-xl bg-black/50 border border-white/10 overflow-hidden"
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

                                  <div className="p-1.5 space-y-1 border-t border-white/10 bg-slate-950/65">
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
                                          className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-between cursor-pointer hover:scale-[1.02] ${
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
                  </div>
                )}
              </div>

              {/* 4. PROFILE, PIN & ACCESSIBILITY (Collapsed Together!) */}
              <div className="w-full box-border">
                {renderCrystalAccordionButton(
                  "profileAndAccessibility",
                  "🔒",
                  "Profile, PIN & Accessibility"
                )}

                {activeSection === "profileAndAccessibility" && (
                  <div className="relative w-full px-5 py-4 rounded-2xl mt-2 shadow-2xl overflow-hidden box-border backdrop-blur-xl bg-slate-950/55 border border-white/15 space-y-3.5">
                    <div
                      className="absolute inset-0 pointer-events-none z-0 opacity-75 mix-blend-lighten"
                      style={{
                        backgroundImage: `url(${RABBIT_PANEL_ALT})`,
                        backgroundSize: "100% 100%",
                        backgroundRepeat: "no-repeat",
                      }}
                    />
                    <div className="relative z-10 space-y-3.5 w-full box-border">
                      {/* Accessibility Toggles */}
                      <div className="space-y-2.5 pb-3 border-b border-white/15">
                        <p className="text-[10px] font-extrabold uppercase tracking-widest text-cyan-300">
                          ♿ TV & Accessibility Controls
                        </p>

                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs font-bold text-white">
                              XL Mouse Pointer (3x)
                            </p>
                            <p className="text-[10px] text-slate-300">
                              Enlarges cursor for TVs/projectors.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => onMouseToggle(!helpfulMouse)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                              helpfulMouse
                                ? getPrimaryBgColor(appTheme).split(" ")[0]
                                : "bg-slate-700"
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                helpfulMouse ? "translate-x-6" : "translate-x-1"
                              }`}
                            />
                          </button>
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <div>
                            <p className="text-xs font-bold text-white">
                              Enlarged Action Buttons
                            </p>
                            <p className="text-[10px] text-slate-300">
                              Bigger icons & buttons.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => onLargeButtonsToggle(!largeButtons)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                              largeButtons
                                ? getPrimaryBgColor(appTheme).split(" ")[0]
                                : "bg-slate-700"
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                largeButtons ? "translate-x-6" : "translate-x-1"
                              }`}
                            />
                          </button>
                        </div>
                      </div>

                      {/* Profile, Age & 4-Digit PIN Form */}
                      <form
                        onSubmit={handleUnifiedProfileUpdate}
                        className="space-y-2.5"
                      >
                        <p className="text-[10px] font-extrabold uppercase tracking-widest text-amber-300">
                          🔐 Profile, Age & Parental PIN
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
                              className="w-full rounded-xl border border-white/15 bg-black/70 px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
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
                              className="w-full rounded-xl border border-white/15 bg-black/70 px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
                            />
                          </div>
                        </div>

                        <div>
                          <span className="block text-[11px] text-slate-300 mb-1 font-bold">
                            Current 4-digit PIN (Required):
                          </span>
                          <input
                            type="password"
                            inputMode="numeric"
                            maxLength={4}
                            placeholder="••••"
                            value={unifiedAgeCodeInput}
                            onChange={(e) =>
                              setUnifiedAgeCodeInput(
                                e.target.value.replace(/\D/g, "").slice(0, 4)
                              )
                            }
                            className="w-full rounded-xl border border-white/15 bg-black/70 px-2.5 py-1.5 text-xs text-white focus:outline-none tracking-widest"
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
                              maxLength={4}
                              placeholder="••••"
                              value={newPasscode}
                              onChange={(e) =>
                                setNewPasscode(
                                  e.target.value.replace(/\D/g, "").slice(0, 4)
                                )
                              }
                              className="w-full rounded-xl border border-white/15 bg-black/70 px-2.5 py-1.5 text-xs text-white focus:outline-none tracking-widest"
                            />
                          </div>
                          <div>
                            <span className="block text-[11px] text-slate-300 mb-1 font-bold">
                              Confirm PIN:
                            </span>
                            <input
                              type="password"
                              inputMode="numeric"
                              maxLength={4}
                              placeholder="••••"
                              value={confirmNewPasscode}
                              onChange={(e) =>
                                setConfirmNewPasscode(
                                  e.target.value.replace(/\D/g, "").slice(0, 4)
                                )
                              }
                              className="w-full rounded-xl border border-white/15 bg-black/70 px-2.5 py-1.5 text-xs text-white focus:outline-none tracking-widest"
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
                  </div>
                )}
              </div>

              {/* 5. HARDWARE RAM MODE & STREAM ENGINE (New Modern Streaming Hub!) */}
              <div className="w-full box-border">
                {renderCrystalAccordionButton(
                  "hardwareAndStream",
                  "⚡",
                  "Hardware RAM & Stream Engine",
                  ramMode === "low" ? "1-2GB Mode" : "4GB+ Turbo"
                )}

                {activeSection === "hardwareAndStream" && (
                  <div className="relative w-full px-5 py-4 rounded-2xl mt-2 shadow-2xl overflow-hidden box-border backdrop-blur-xl bg-slate-950/55 border border-white/15 space-y-3.5">
                    <div
                      className="absolute inset-0 pointer-events-none z-0 opacity-75 mix-blend-lighten"
                      style={{
                        backgroundImage: `url(${RABBIT_PANEL})`,
                        backgroundSize: "100% 100%",
                        backgroundRepeat: "no-repeat",
                      }}
                    />
                    <div className="relative z-10 space-y-3.5 w-full box-border">
                      {/* Low RAM vs High RAM Selector */}
                      <div>
                        <p className="text-[11px] text-slate-300 font-bold mb-1">
                          Device Memory Allocation Profile:
                        </p>
                        <p className="text-[10px] text-slate-400 mb-2 leading-snug">
                          Choose <strong className="text-cyan-300">Low RAM Stick</strong> for 1–2GB streaming sticks (Nero 8K / Fire Stick) to cap video buffers and prevent crashes.
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => handleRamModeChange("low")}
                            className={`rounded-xl p-2.5 text-left transition-all cursor-pointer hover:scale-[1.03] ${
                              ramMode === "low"
                                ? `${getPrimaryBgColor(
                                    appTheme
                                  )} text-white shadow-md ring-1 ring-white/40`
                                : getSubtlePillBg(appTheme)
                            }`}
                          >
                            <span className="block text-xs font-extrabold">
                              📟 Low RAM (1–2GB)
                            </span>
                            <span className="block text-[9px] opacity-85 mt-0.5">
                              15MB buffer cap • Anti-crash
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRamModeChange("high")}
                            className={`rounded-xl p-2.5 text-left transition-all cursor-pointer hover:scale-[1.03] ${
                              ramMode === "high"
                                ? `${getPrimaryBgColor(
                                    appTheme
                                  )} text-white shadow-md ring-1 ring-white/40`
                                : getSubtlePillBg(appTheme)
                            }`}
                          >
                            <span className="block text-xs font-extrabold">
                              🚀 High RAM (4GB+)
                            </span>
                            <span className="block text-[9px] opacity-85 mt-0.5">
                              Max pre-buffer • Full FX
                            </span>
                          </button>
                        </div>
                      </div>

                      {/* Default Stream Quality */}
                      <div className="pt-2.5 border-t border-white/10">
                        <p className="text-[11px] text-slate-300 font-bold mb-1.5">
                          Preferred Stream Resolution:
                        </p>
                        <div className="grid grid-cols-3 gap-1.5">
                          {(["1080p", "720p", "480p"] as StreamQuality[]).map(
                            (q) => (
                              <button
                                key={q}
                                type="button"
                                onClick={() => handleStreamQualitySelect(q)}
                                className={`rounded-xl py-2 text-xs font-bold uppercase transition-all cursor-pointer hover:scale-105 ${
                                  activeStreamQuality === q
                                    ? `${getPrimaryBgColor(
                                        appTheme
                                      )} text-white shadow-md`
                                    : getSubtlePillBg(appTheme)
                                }`}
                              >
                                {q}
                              </button>
                            )
                          )}
                        </div>
                      </div>

                      {/* Auto-Play Next Episode & Fast Cache Cleaner */}
                      <div className="pt-2.5 border-t border-white/10 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs font-bold text-white">
                              Auto-Play Next Episode
                            </p>
                            <p className="text-[10px] text-slate-400">
                              Seamless binge-watching for TV series.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              handleAutoPlayNextToggle(!autoPlayNext)
                            }
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                              autoPlayNext
                                ? getPrimaryBgColor(appTheme).split(" ")[0]
                                : "bg-slate-700"
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                autoPlayNext ? "translate-x-6" : "translate-x-1"
                              }`}
                            />
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={handlePurgeVolatileCaches}
                          className={`w-full py-2 rounded-xl text-xs font-bold transition-all cursor-pointer hover:scale-[1.02] ${getSubtlePillBg(
                            appTheme
                          )}`}
                        >
                          🧹 Purge Stream & Metadata Caches (Free RAM)
                        </button>

                        {cacheClearMsg && (
                          <p className="text-[11px] font-bold text-emerald-400 text-center">
                            {cacheClearMsg}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 6. SCREENSAVER, BACKUP & DATA (Collapsed Together!) */}
              <div className="w-full box-border">
                {renderCrystalAccordionButton(
                  "screensaverAndBackup",
                  "💤",
                  "Screensaver, Backup & Data"
                )}

                {activeSection === "screensaverAndBackup" && (
                  <div className="relative w-full px-5 py-4 rounded-2xl mt-2 shadow-2xl overflow-hidden box-border backdrop-blur-xl bg-slate-950/55 border border-white/15 space-y-3.5">
                    <div
                      className="absolute inset-0 pointer-events-none z-0 opacity-75 mix-blend-lighten"
                      style={{
                        backgroundImage: `url(${RABBIT_PANEL_ALT})`,
                        backgroundSize: "100% 100%",
                        backgroundRepeat: "no-repeat",
                      }}
                    />
                    <div className="relative z-10 space-y-3.5 w-full box-border">
                      {/* Screensaver Timeout */}
                      <div>
                        <p className="text-[11px] text-slate-300 font-bold mb-1.5">
                          Start Screensaver After:
                        </p>
                        <div className="grid grid-cols-2 gap-1.5">
                          {TIMEOUT_OPTIONS.map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() =>
                                handleScreensaverTimeoutChange(opt.value)
                              }
                              className={`rounded-xl py-2 px-2 text-xs font-bold transition-all truncate cursor-pointer hover:scale-105 ${
                                screensaverTimeoutMs === opt.value
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

                      {/* Backup & Restore */}
                      <div className="pt-2.5 border-t border-white/10 space-y-2">
                        <p className="text-[11px] text-slate-300 font-bold">
                          Profile & Watchlist Backup:
                        </p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={handleSaveBackup}
                            className={`flex-1 rounded-xl px-3 py-2 text-xs font-bold transition-all cursor-pointer hover:scale-105 ${getSubtlePillBg(
                              appTheme
                            )}`}
                          >
                            💾 Export JSON
                          </button>
                          <label
                            className={`flex-1 text-center cursor-pointer rounded-xl px-3 py-2 text-xs font-bold transition-all hover:scale-105 ${getSubtlePillBg(
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
                  </div>
                )}
              </div>
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

            {/* FEEDBACK & SUPPORT SECTION */}
            <div className="pt-3 border-t border-white/15 space-y-2 w-full box-border">
              <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-300 px-1">
                Feedback & Support
              </h4>
              <button
                type="button"
                onClick={onOpenBugModal}
                className={`w-full py-2.5 rounded-xl text-xs font-extrabold transition-all hover:scale-[1.03] active:scale-95 cursor-pointer ${getPrimaryBgColor(
                  appTheme
                )} text-white shadow-md`}
              >
                🐞 Report a Bug / Issue
              </button>
              <button
                type="button"
                onClick={onOpenBugFeedModal}
                className="w-full py-2.5 rounded-xl bg-black/55 hover:bg-white/[0.12] border border-white/15 text-xs font-bold text-slate-200 transition-all hover:scale-[1.03] active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
              >
                📋 View Bug Reports Feed
              </button>
            </div>

            {/* UPDATE CHANNEL & ACTIONS */}
            <div className="pt-3 border-t border-white/15 space-y-2 w-full box-border">
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
                      : "bg-black/55 text-slate-300 hover:bg-white/[0.12] border border-white/15"
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
                      : "bg-black/55 text-slate-300 hover:bg-white/[0.12] border border-white/15"
                  }`}
                >
                  ⚡ Nightly
                </button>
              </div>
              <button
                type="button"
                onClick={() => void checkForAppUpdates(false)}
                className={`w-full py-2.5 rounded-xl text-xs font-extrabold transition-all hover:scale-[1.03] active:scale-95 cursor-pointer ${getPrimaryBgColor(
                  appTheme
                )} text-white shadow-md`}
              >
                🔍 Check for Updates Now
              </button>
            </div>

            {/* LICENSE STATUS */}
            <div className="pt-3 border-t border-white/15 space-y-2 w-full box-border">
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
                      className="w-full rounded-xl border border-white/15 bg-black/70 px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
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
                Crystal Console UI v2.6 • RABBiT TV
              </span>
            </div>
          </div>
        </div>

        {/* Scroll Down Arrow Button */}
        <button
          type="button"
          onClick={() => handleScrollSidebar("down")}
          className="absolute bottom-2.5 left-1/2 -translate-x-1/2 z-20 w-14 h-6 bg-black/75 hover:bg-black border border-red-400/35 rounded-full flex items-center justify-center text-amber-300 text-xs font-bold shadow-[0_0_12px_rgba(239,68,68,0.4)] transition hover:scale-110 cursor-pointer"
          title="Scroll Down"
        >
          ▼
        </button>
      </div>
    </div>
  );
}

export default Sidebar;
