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
  saveCardSize,
  saveStreamQuality,
  saveTheme,
  setHelpfulMouse,
  getSavedUserAge,
  saveUserAge,
  setHistoryOverscale,
  setLargeButtons,
} from "@/lib/settings";

const AGE_LOCK_KEY = "rabtv_age_passcode";

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

const RABBIT_DIVIDER =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/main/assets/rabbit-divider.jpg";

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

  const [activeSidebarSection, setActiveSidebarSection] = useState<
    | "theme"
    | "scale"
    | "audio"
    | "screensaver"
    | "pin"
    | "backup"
    | "accessibility"
    | "globalFeed"
    | "history"
    | null
  >(null);

  const [screensaverTimeoutMs, setScreensaverTimeoutMs] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("rabtv_screensaver_timeout_ms");
      return saved ? Number(saved) : 2.5 * 60 * 60 * 1000;
    }
    return 2.5 * 60 * 60 * 1000;
  });

  const [bgMusicVolume, setBgMusicVolume] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("rabtv_bg_volume");
      return saved !== null ? parseFloat(saved) : 0.5;
    }
    return 0.5;
  });

  const [currentStationUrl, setCurrentStationUrl] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("rabtv_radio_url");
      if (saved) return saved;
    }
    return RADIO_STATIONS["80s"]?.[0]?.url || "";
  });

  const [selectedGlobalFeed, setSelectedGlobalFeed] = useState<GlobalFeedOption>(
    () => {
      if (typeof window !== "undefined") {
        return (
          (localStorage.getItem("rabtv_global_feed") as GlobalFeedOption) ||
          "All (Default)"
        );
      }
      return "All (Default)";
    }
  );

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

  const [updateChannel, setUpdateChannel] = useState<"stable" | "nightly">(() => {
    if (typeof window !== "undefined") {
      return (
        (localStorage.getItem("rabtv_update_channel") as "stable" | "nightly") ||
        "stable"
      );
    }
    return "stable";
  });

  const [backupStatus, setBackupStatus] = useState<string | null>(null);

  // Record scroll position when opened and close if main window scrolls significantly
  useEffect(() => {
    if (!isOpen || typeof window === "undefined") return;
    lastScrollYRef.current = window.scrollY;

    const handleWindowScroll = () => {
      if (Math.abs(window.scrollY - lastScrollYRef.current) > 60) {
        setActiveSidebarSection(null);
        onClose();
      }
    };

    window.addEventListener("scroll", handleWindowScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleWindowScroll);
  }, [isOpen, onClose]);

  // D-pad / Arrow Key navigation handler for sidebar menu items
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!sidebarContentRef.current) return;
      const focusables = Array.from(
        sidebarContentRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !el.hasAttribute("disabled") && el.offsetParent !== null);

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
        setActiveSidebarSection(null);
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCloseSidebar = () => {
    setActiveSidebarSection(null);
    onClose();
  };

  const handleScrollSidebar = (direction: "up" | "down") => {
    if (sidebarContentRef.current) {
      sidebarContentRef.current.scrollBy({
        top: direction === "down" ? 180 : -180,
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
    if (bgMusicState === "playing") {
      bgAudio.play();
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
    typeof window !== "undefined" ? localStorage.getItem(AGE_LOCK_KEY) || "" : "";

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
    const GITHUB_TOKEN = ((import.meta as any).env?.VITE_GH_PAT as string) || "";
    const GIST_API_URL = GIST_ID ? `https://api.github.com/gists/${GIST_ID}` : "";

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
      streamQuality,
      appTheme,
      helpfulMouse,
      historyOverscale,
      largeButtons,
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
        if (data.streamQuality) saveStreamQuality(data.streamQuality);
        if (data.appTheme) onThemeChange(data.appTheme);
        if (typeof data.helpfulMouse === "boolean")
          onMouseToggle(data.helpfulMouse);
        if (data.historyOverscale)
          onHistoryOverscaleChange(data.historyOverscale);
        if (typeof data.largeButtons === "boolean")
          onLargeButtonsToggle(data.largeButtons);
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

  const getThemeTokens = (theme: AppTheme) => {
    switch (theme) {
      case "red":
        return {
          drawerBorder:
            "border-red-500/30 shadow-[0_20px_60px_rgba(0,0,0,0.95),0_0_35px_rgba(239,68,68,0.2)]",
          activeAccordion:
            "bg-gradient-to-r from-red-950/80 via-zinc-900/90 to-black border-red-400/50 text-white shadow-[0_0_18px_rgba(239,68,68,0.25)]",
          subtleBtn:
            "bg-red-950/35 border border-red-500/25 text-red-200 hover:bg-red-900/50",
          laserLine: "from-transparent via-red-500 to-amber-400",
        };
      case "midnight":
        return {
          drawerBorder:
            "border-sky-500/30 shadow-[0_20px_60px_rgba(0,0,0,0.95),0_0_35px_rgba(56,189,248,0.2)]",
          activeAccordion:
            "bg-gradient-to-r from-blue-950/80 via-slate-900/90 to-black border-sky-400/50 text-white shadow-[0_0_18px_rgba(56,189,248,0.25)]",
          subtleBtn:
            "bg-blue-950/35 border border-blue-500/25 text-sky-200 hover:bg-blue-900/50",
          laserLine: "from-transparent via-sky-400 to-blue-500",
        };
      case "emerald":
        return {
          drawerBorder:
            "border-emerald-500/30 shadow-[0_20px_60px_rgba(0,0,0,0.95),0_0_35px_rgba(16,185,129,0.2)]",
          activeAccordion:
            "bg-gradient-to-r from-emerald-950/80 via-slate-900/90 to-black border-emerald-400/50 text-white shadow-[0_0_18px_rgba(16,185,129,0.25)]",
          subtleBtn:
            "bg-emerald-950/35 border border-emerald-500/25 text-emerald-200 hover:bg-emerald-900/50",
          laserLine: "from-transparent via-emerald-400 to-cyan-400",
        };
      case "amber":
        return {
          drawerBorder:
            "border-amber-500/30 shadow-[0_20px_60px_rgba(0,0,0,0.95),0_0_35px_rgba(245,158,11,0.2)]",
          activeAccordion:
            "bg-gradient-to-r from-amber-950/80 via-stone-900/90 to-black border-amber-400/50 text-white shadow-[0_0_18px_rgba(245,158,11,0.25)]",
          subtleBtn:
            "bg-yellow-950/35 border border-amber-500/25 text-amber-200 hover:bg-yellow-900/50",
          laserLine: "from-transparent via-amber-400 to-orange-500",
        };
      case "cyan":
        return {
          drawerBorder:
            "border-cyan-500/30 shadow-[0_20px_60px_rgba(0,0,0,0.95),0_0_35px_rgba(34,211,238,0.2)]",
          activeAccordion:
            "bg-gradient-to-r from-cyan-950/80 via-slate-900/90 to-black border-cyan-400/50 text-white shadow-[0_0_18px_rgba(34,211,238,0.25)]",
          subtleBtn:
            "bg-cyan-950/35 border border-cyan-500/25 text-cyan-200 hover:bg-cyan-900/50",
          laserLine: "from-transparent via-cyan-400 to-sky-500",
        };
      case "violet":
      default:
        return {
          drawerBorder:
            "border-purple-500/35 shadow-[0_20px_60px_rgba(0,0,0,0.95),0_0_35px_rgba(168,85,247,0.25)]",
          activeAccordion:
            "bg-gradient-to-r from-purple-950/80 via-slate-900/90 to-black border-purple-400/50 text-white shadow-[0_0_18px_rgba(168,85,247,0.25)]",
          subtleBtn:
            "bg-purple-950/35 border border-violet-500/25 text-purple-200 hover:bg-purple-900/50",
          laserLine: "from-transparent via-pink-500 to-cyan-400",
        };
    }
  };

  const tokens = getThemeTokens(appTheme);

  const toggleSection = (
    section:
      | "theme"
      | "scale"
      | "audio"
      | "screensaver"
      | "pin"
      | "backup"
      | "accessibility"
      | "globalFeed"
      | "history"
  ) => {
    setActiveSidebarSection((prev) => (prev === section ? null : section));
  };

  const getAccordionBtnClass = (isActive: boolean) =>
    `w-full flex items-center justify-between px-4 py-3.5 text-left text-xs font-extrabold rounded-2xl border transition-all duration-200 cursor-pointer ${
      isActive
        ? tokens.activeAccordion
        : "bg-white/[0.04] hover:bg-white/[0.08] border-white/10 text-slate-200 hover:text-white"
    }`;

  return (
    <div className="rabtv-vidsrc-protected fixed inset-0 z-50 flex pt-[60px] sm:pt-[65px] pointer-events-none">
      {/* Frosted Cinema Glass Backdrop */}
      <div
        className="fixed inset-0 bg-black/65 backdrop-blur-md pointer-events-auto transition-opacity duration-300"
        onClick={handleCloseSidebar}
      />

      {/* High-End Glass Side Blade Drawer */}
      <div
        className={`relative mx-3 my-2 w-[410px] max-w-[94vw] h-[calc(100dvh-76px)] bg-slate-950/95 backdrop-blur-2xl flex flex-col z-10 transition-transform duration-300 pt-10 pb-10 px-4 sm:px-5 rounded-3xl border pointer-events-auto box-border overflow-hidden ${tokens.drawerBorder}`}
      >
        {/* Top Ambient Neon Laser Line */}
        <div
          className={`absolute inset-x-8 top-0 h-[2px] bg-gradient-to-r ${tokens.laserLine} opacity-85`}
        />

        {/* Scroll Up Arrow Button */}
        <button
          type="button"
          onClick={() => handleScrollSidebar("up")}
          className="absolute top-2.5 left-1/2 -translate-x-1/2 z-20 w-16 h-6 bg-slate-900/90 hover:bg-slate-800 border border-white/15 rounded-full flex items-center justify-center text-amber-300 text-[10px] font-bold shadow-md transition cursor-pointer"
          title="Scroll Up"
        >
          ▲
        </button>

        {/* Scrollable Inner Container */}
        <div
          ref={sidebarContentRef}
          className="flex-1 overflow-y-auto px-1 pt-3 pb-6 w-full scrollbar-none relative z-10 box-border overflow-x-hidden"
        >
          <div className="flex flex-col w-full box-border space-y-4">
            {/* Profile Identity Header Card */}
            <div className="flex items-center justify-between rounded-2xl bg-white/[0.04] border border-white/10 p-3.5 w-full box-border">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl overflow-hidden border border-white/25 bg-slate-900 shadow-md shrink-0 flex items-center justify-center">
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
                  <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-bold">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>System Online</span>
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseSidebar}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-red-600/80 border border-white/10 hover:border-red-400 text-xs font-bold text-slate-200 hover:text-white transition shrink-0 cursor-pointer"
              >
                ✕ Close
              </button>
            </div>

            {/* ACCORDION MENU SECTIONS */}
            <div className="space-y-2.5 w-full box-border">
              {/* 1. GLOBAL FEED SELECTOR */}
              <div className="w-full box-border">
                <button
                  type="button"
                  onClick={() => toggleSection("globalFeed")}
                  className={getAccordionBtnClass(
                    activeSidebarSection === "globalFeed"
                  )}
                >
                  <span className="flex items-center gap-2.5">
                    <span>🌐</span>
                    <span>Global Feed Selector</span>
                  </span>
                  <span
                    className={`text-[10px] transform transition-transform ${
                      activeSidebarSection === "globalFeed" ? "rotate-180" : ""
                    }`}
                  >
                    ▼
                  </span>
                </button>
                {activeSidebarSection === "globalFeed" && (
                  <div className="w-full p-4 rounded-2xl mt-2 bg-black/60 border border-white/10 space-y-2.5 box-border">
                    <p className="text-[11px] text-slate-300 font-bold">
                      Select Region Feed:
                    </p>
                    <select
                      value={selectedGlobalFeed}
                      onChange={(e) =>
                        handleGlobalFeedChange(
                          e.target.value as GlobalFeedOption
                        )
                      }
                      className="h-10 w-full rounded-xl border border-white/15 bg-slate-900 px-3 text-xs font-bold text-white focus:outline-none cursor-pointer"
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
                )}
              </div>

              {/* 2. WATCH HISTORY */}
              <div className="w-full box-border">
                <button
                  type="button"
                  onClick={() => toggleSection("history")}
                  className={getAccordionBtnClass(
                    activeSidebarSection === "history"
                  )}
                >
                  <span className="flex items-center gap-2.5">
                    <span>🕒</span>
                    <span>Watch History & Activity</span>
                  </span>
                  <span
                    className={`text-[10px] transform transition-transform ${
                      activeSidebarSection === "history" ? "rotate-180" : ""
                    }`}
                  >
                    ▼
                  </span>
                </button>
                {activeSidebarSection === "history" && (
                  <div className="w-full p-4 rounded-2xl mt-2 bg-black/60 border border-white/10 space-y-2.5 box-border">
                    <p className="text-[11px] text-slate-300 font-medium">
                      Manage in-progress titles, completed shows & catalog
                      filters:
                    </p>
                    <Link
                      to="/watch-history"
                      onClick={handleCloseSidebar}
                      className={`flex h-10 w-full items-center justify-center rounded-xl px-3 text-xs font-extrabold shadow-md transition ${getPrimaryBgColor(
                        appTheme
                      )}`}
                    >
                      🕒 Open Watch History
                    </Link>
                  </div>
                )}
              </div>

              {/* 3. APP THEMES & STYLING */}
              <div className="w-full box-border">
                <button
                  type="button"
                  onClick={() => toggleSection("theme")}
                  className={getAccordionBtnClass(
                    activeSidebarSection === "theme"
                  )}
                >
                  <span className="flex items-center gap-2.5">
                    <span>🎨</span>
                    <span>App Themes & Styling</span>
                  </span>
                  <span
                    className={`text-[10px] transform transition-transform ${
                      activeSidebarSection === "theme" ? "rotate-180" : ""
                    }`}
                  >
                    ▼
                  </span>
                </button>
                {activeSidebarSection === "theme" && (
                  <div className="w-full p-4 rounded-2xl mt-2 bg-black/60 border border-white/10 box-border">
                    <div className="grid grid-cols-2 gap-2 w-full">
                      {allThemesList.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => onThemeChange(t.id)}
                          className={`rounded-xl p-2.5 text-xs font-bold transition text-left w-full cursor-pointer ${
                            appTheme === t.id
                              ? `${getPrimaryBgColor(t.id)} text-white shadow-md`
                              : tokens.subtleBtn
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 4. OVER SCALE & GRID SIZING */}
              <div className="w-full box-border">
                <button
                  type="button"
                  onClick={() => toggleSection("scale")}
                  className={getAccordionBtnClass(
                    activeSidebarSection === "scale"
                  )}
                >
                  <span className="flex items-center gap-2.5">
                    <span>📐</span>
                    <span>Over Scale & Grid Size</span>
                  </span>
                  <span
                    className={`text-[10px] transform transition-transform ${
                      activeSidebarSection === "scale" ? "rotate-180" : ""
                    }`}
                  >
                    ▼
                  </span>
                </button>
                {activeSidebarSection === "scale" && (
                  <div className="w-full p-4 rounded-2xl mt-2 bg-black/60 border border-white/10 space-y-3.5 box-border">
                    <div>
                      <p className="text-[11px] text-slate-300 mb-1.5 font-bold">
                        Catalog Card Size:
                      </p>
                      <div className="grid grid-cols-3 gap-1.5">
                        {(["small", "medium", "large"] as CardSize[]).map(
                          (size) => (
                            <button
                              key={size}
                              type="button"
                              onClick={() => onSizeChange(size)}
                              className={`rounded-xl py-2 text-xs font-bold capitalize transition cursor-pointer ${
                                cardSize === size
                                  ? `${getPrimaryBgColor(
                                      appTheme
                                    )} text-white shadow-md`
                                  : tokens.subtleBtn
                              }`}
                            >
                              {size}
                            </button>
                          )
                        )}
                      </div>
                    </div>

                    <div className="pt-2.5 border-t border-white/10">
                      <p className="text-[11px] text-slate-300 mb-1.5 font-bold">
                        History Page Overscale:
                      </p>
                      <div className="grid grid-cols-4 gap-1.5">
                        {(
                          ["off", "20%", "50%", "80%"] as HistoryScale[]
                        ).map((scale) => (
                          <button
                            key={scale}
                            type="button"
                            onClick={() => onHistoryOverscaleChange(scale)}
                            className={`rounded-xl py-1.5 text-xs font-bold capitalize transition cursor-pointer ${
                              historyOverscale === scale
                                ? `${getPrimaryBgColor(
                                    appTheme
                                  )} text-white shadow-md`
                                : tokens.subtleBtn
                            }`}
                          >
                            {scale === "off" ? "Off" : `+${scale}`}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 5. BACKGROUND LOBBY RADIO */}
              <div className="w-full box-border">
                <button
                  type="button"
                  onClick={() => toggleSection("audio")}
                  className={getAccordionBtnClass(
                    activeSidebarSection === "audio"
                  )}
                >
                  <span className="flex items-center gap-2.5">
                    <span>🎵</span>
                    <span>Background Lobby Radio</span>
                  </span>
                  <span
                    className={`text-[10px] transform transition-transform ${
                      activeSidebarSection === "audio" ? "rotate-180" : ""
                    }`}
                  >
                    ▼
                  </span>
                </button>
                {activeSidebarSection === "audio" && (
                  <div className="w-full p-4 rounded-2xl mt-2 bg-black/60 border border-white/10 space-y-3.5 box-border">
                    <div>
                      <p className="text-[11px] text-slate-300 mb-1.5 font-bold">
                        Playback Controls:
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => onBackgroundAudioToggle("playing")}
                          className={`rounded-xl py-2 text-xs font-bold transition cursor-pointer ${
                            bgMusicState === "playing"
                              ? `${getPrimaryBgColor(
                                  appTheme
                                )} text-white shadow-md`
                              : tokens.subtleBtn
                          }`}
                        >
                          🎵 Radio ON
                        </button>
                        <button
                          type="button"
                          onClick={() => onBackgroundAudioToggle("muted")}
                          className={`rounded-xl py-2 text-xs font-bold transition cursor-pointer ${
                            bgMusicState === "muted"
                              ? `${getPrimaryBgColor(
                                  appTheme
                                )} text-white shadow-md`
                              : tokens.subtleBtn
                          }`}
                        >
                          🔇 Radio Off
                        </button>
                      </div>
                    </div>

                    <div className="pt-2.5 border-t border-white/10 space-y-1.5">
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
                        className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-violet-500"
                      />
                    </div>

                    <div className="pt-2.5 border-t border-white/10">
                      <p className="text-[11px] text-slate-300 mb-2 font-bold">
                        Select Channel / Stream by Genre:
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
                                className="group rounded-xl bg-white/[0.04] border border-white/10 overflow-hidden"
                              >
                                <summary className="flex items-center justify-between px-3 py-2 text-xs font-bold text-amber-300 cursor-pointer select-none hover:bg-white/5 transition">
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

                                <div className="p-1.5 space-y-1 border-t border-white/10 bg-black/50">
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
                                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center justify-between cursor-pointer ${
                                          isSelected
                                            ? `${getPrimaryBgColor(
                                                appTheme
                                              )} text-white shadow-md`
                                            : tokens.subtleBtn
                                        }`}
                                      >
                                        <span className="truncate pr-1">
                                          🎵 {station.name}
                                        </span>
                                        {isSelected && (
                                          <span className="text-[9px] shrink-0 font-bold bg-black/40 px-1.5 py-0.5 rounded">
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

              {/* 6. SCREENSAVER TIMER */}
              <div className="w-full box-border">
                <button
                  type="button"
                  onClick={() => toggleSection("screensaver")}
                  className={getAccordionBtnClass(
                    activeSidebarSection === "screensaver"
                  )}
                >
                  <span className="flex items-center gap-2.5">
                    <span>💤</span>
                    <span>Screensaver Timer</span>
                  </span>
                  <span
                    className={`text-[10px] transform transition-transform ${
                      activeSidebarSection === "screensaver" ? "rotate-180" : ""
                    }`}
                  >
                    ▼
                  </span>
                </button>
                {activeSidebarSection === "screensaver" && (
                  <div className="w-full p-4 rounded-2xl mt-2 bg-black/60 border border-white/10 space-y-2 box-border">
                    <p className="text-[11px] text-slate-300 font-bold">
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
                          className={`rounded-xl py-2 px-2 text-xs font-bold transition truncate cursor-pointer ${
                            screensaverTimeoutMs === opt.value
                              ? `${getPrimaryBgColor(
                                  appTheme
                                )} text-white shadow-md`
                              : tokens.subtleBtn
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 7. PROFILE, AGE & PIN SETTINGS */}
              <div className="w-full box-border">
                <button
                  type="button"
                  onClick={() => toggleSection("pin")}
                  className={getAccordionBtnClass(
                    activeSidebarSection === "pin"
                  )}
                >
                  <span className="flex items-center gap-2.5">
                    <span>🔒</span>
                    <span>Profile, Age & PIN Settings</span>
                  </span>
                  <span
                    className={`text-[10px] transform transition-transform ${
                      activeSidebarSection === "pin" ? "rotate-180" : ""
                    }`}
                  >
                    ▼
                  </span>
                </button>
                {activeSidebarSection === "pin" && (
                  <form
                    onSubmit={handleUnifiedProfileUpdate}
                    className="w-full p-4 rounded-2xl mt-2 bg-black/60 border border-white/10 space-y-3 box-border"
                  >
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="block text-[11px] text-slate-300 mb-1 font-bold">
                          Name:
                        </span>
                        <input
                          type="text"
                          maxLength={25}
                          value={profileNameInput}
                          onChange={(e) => setProfileNameInput(e.target.value)}
                          className="w-full rounded-xl border border-white/15 bg-slate-900 px-2.5 py-1.5 text-xs text-white focus:outline-none"
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
                          className="w-full rounded-xl border border-white/15 bg-slate-900 px-2.5 py-1.5 text-xs text-white focus:outline-none"
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
                        className="w-full rounded-xl border border-white/15 bg-slate-900 px-2.5 py-1.5 text-xs text-white focus:outline-none tracking-widest"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10">
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
                          className="w-full rounded-xl border border-white/15 bg-slate-900 px-2.5 py-1.5 text-xs text-white focus:outline-none tracking-widest"
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
                          className="w-full rounded-xl border border-white/15 bg-slate-900 px-2.5 py-1.5 text-xs text-white focus:outline-none tracking-widest"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className={`w-full py-2.5 rounded-xl ${getPrimaryBgColor(
                        appTheme
                      )} text-xs font-extrabold shadow transition cursor-pointer`}
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
                )}
              </div>

              {/* 8. BACKUP & PROFILE DATA */}
              <div className="w-full box-border">
                <button
                  type="button"
                  onClick={() => toggleSection("backup")}
                  className={getAccordionBtnClass(
                    activeSidebarSection === "backup"
                  )}
                >
                  <span className="flex items-center gap-2.5">
                    <span>💾</span>
                    <span>Backup & Profile Data</span>
                  </span>
                  <span
                    className={`text-[10px] transform transition-transform ${
                      activeSidebarSection === "backup" ? "rotate-180" : ""
                    }`}
                  >
                    ▼
                  </span>
                </button>
                {activeSidebarSection === "backup" && (
                  <div className="w-full p-4 rounded-2xl mt-2 bg-black/60 border border-white/10 space-y-2.5 box-border">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleSaveBackup}
                        className={`flex-1 rounded-xl px-3 py-2 text-xs font-bold transition cursor-pointer ${tokens.subtleBtn}`}
                      >
                        💾 Export Backup
                      </button>
                      <label
                        className={`flex-1 text-center cursor-pointer rounded-xl px-3 py-2 text-xs font-bold transition ${tokens.subtleBtn}`}
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
                )}
              </div>

              {/* 9. ACCESSIBILITY OPTIONS */}
              <div className="w-full box-border">
                <button
                  type="button"
                  onClick={() => toggleSection("accessibility")}
                  className={getAccordionBtnClass(
                    activeSidebarSection === "accessibility"
                  )}
                >
                  <span className="flex items-center gap-2.5">
                    <span>♿</span>
                    <span>Accessibility Options</span>
                  </span>
                  <span
                    className={`text-[10px] transform transition-transform ${
                      activeSidebarSection === "accessibility"
                        ? "rotate-180"
                        : ""
                    }`}
                  >
                    ▼
                  </span>
                </button>
                {activeSidebarSection === "accessibility" && (
                  <div className="w-full p-4 rounded-2xl mt-2 bg-black/60 border border-white/10 space-y-3 box-border">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-white">
                          XL Mouse Pointer (3x)
                        </p>
                        <p className="text-[10px] text-slate-400">
                          Enlarges cursor for TVs & projectors.
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

                    <div className="flex items-center justify-between pt-2.5 border-t border-white/10">
                      <div>
                        <p className="text-xs font-bold text-white">
                          Enlarged Action Buttons
                        </p>
                        <p className="text-[10px] text-slate-400">
                          Bigger icons & controls.
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
                )}
              </div>
            </div>

            {/* ADMIN PANEL (IF ADMIN) */}
            {isAdmin && (
              <div className="pt-3 border-t border-white/10 w-full box-border">
                <AdminPanel
                  appTheme={appTheme}
                  getPrimaryBgColor={getPrimaryBgColor}
                  getPrimaryAccentColor={getPrimaryAccentColor}
                />
              </div>
            )}

            {/* FEEDBACK & SUPPORT SECTION */}
            <div className="pt-3 border-t border-white/10 space-y-2 w-full box-border">
              <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 px-1">
                Feedback & Support
              </h4>
              <button
                type="button"
                onClick={onOpenBugModal}
                className={`w-full py-2.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${getPrimaryBgColor(
                  appTheme
                )} text-white shadow-md`}
              >
                🐞 Report a Bug / Issue
              </button>
              <button
                type="button"
                onClick={onOpenBugFeedModal}
                className="w-full py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs font-bold text-slate-200 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                📋 View Bug Reports Feed
              </button>
            </div>

            {/* UPDATE CHANNEL & ACTIONS */}
            <div className="pt-3 border-t border-white/10 space-y-2 w-full box-border">
              <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 px-1">
                Update Channel
              </h4>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleUpdateChannelChange("stable")}
                  className={`py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    updateChannel === "stable"
                      ? `${getPrimaryBgColor(appTheme)} text-white`
                      : "bg-white/[0.06] text-slate-300 hover:bg-white/[0.12] border border-white/10"
                  }`}
                >
                  🛡️ Stable
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdateChannelChange("nightly")}
                  className={`py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    updateChannel === "nightly"
                      ? `${getPrimaryBgColor(appTheme)} text-white`
                      : "bg-white/[0.06] text-slate-300 hover:bg-white/[0.12] border border-white/10"
                  }`}
                >
                  ⚡ Nightly
                </button>
              </div>
              <button
                type="button"
                onClick={() => void checkForAppUpdates(false)}
                className={`w-full py-2.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${getPrimaryBgColor(
                  appTheme
                )} text-white shadow-md`}
              >
                🔍 Check for Updates Now
              </button>
            </div>

            {/* LICENSE STATUS */}
            <div className="pt-3 border-t border-white/10 space-y-2 w-full box-border">
              <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 px-1">
                License Status
              </h4>
              {isAdmin ? (
                <p className="text-[11px] text-red-300 font-bold bg-red-500/10 border border-red-500/25 p-2.5 rounded-xl">
                  🔐 Admin access active.
                </p>
              ) : isTrialActive ? (
                <div className="space-y-2">
                  <p className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/25 p-2.5 rounded-xl leading-relaxed">
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
                      className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
                    />
                    <button
                      type="submit"
                      className={`w-full py-2 rounded-xl ${getPrimaryBgColor(
                        appTheme
                      )} text-xs font-extrabold shadow transition cursor-pointer`}
                    >
                      Upgrade to Full Unlock
                    </button>
                  </form>
                </div>
              ) : (
                <p className="text-[11px] text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/25 p-2.5 rounded-xl">
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

            {/* Sidebar Footer */}
            <div className="pt-4 border-t border-white/10 text-center w-full">
              <img
                src={RABBIT_DIVIDER}
                alt=""
                className="w-2/3 mx-auto h-2 object-contain opacity-70 mb-2.5"
              />
              <span className="text-[9px] text-slate-500 uppercase tracking-widest font-extrabold">
                Console UI v2.5 • RABBiT TV
              </span>
            </div>
          </div>
        </div>

        {/* Scroll Down Arrow Button */}
        <button
          type="button"
          onClick={() => handleScrollSidebar("down")}
          className="absolute bottom-2.5 left-1/2 -translate-x-1/2 z-20 w-16 h-6 bg-slate-900/90 hover:bg-slate-800 border border-white/15 rounded-full flex items-center justify-center text-amber-300 text-[10px] font-bold shadow-md transition cursor-pointer"
          title="Scroll Down"
        >
          ▼
        </button>

        {/* Bottom Ambient Neon Laser Line */}
        <div
          className={`absolute inset-x-8 bottom-0 h-[2px] bg-gradient-to-r ${tokens.laserLine} opacity-85`}
        />
      </div>
    </div>
  );
}

export default Sidebar;
