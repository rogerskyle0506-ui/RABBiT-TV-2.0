// src/routes/__root.tsx
// UPDATED: Side profile menu now uses the new Rabbit.TV header bars, panels & dividers
import { BugReportModal } from "@/components/BugReportModal";
import { PublicBugFeedModal } from "@/components/PublicBugFeedModal";
import { UserNotifier } from "@/components/UserNotifier";
import { Outlet, createRootRoute, HeadContent, Scripts, Link, useNavigate } from "@tanstack/react-router";
import { AuthProvider } from "@/components/auth-provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { HolidayOverlay } from "@/components/HolidayOverlay";
import { AppWallpaper } from "@/components/AppWallpaper";
import { ActivationModal } from "@/components/ActivationModal";
import { AdminPanel } from "@/components/AdminPanel";
import { bgAudio, RADIO_STATIONS } from "@/lib/background-audio";
import "@/styles.css";
import { useState, useEffect } from "react";
import { StatusBar, Style } from "@capacitor/status-bar";
import { sendPermanentActivationAlert } from "@/lib/report";
import { checkForAppUpdates } from "@/lib/updater";
import {
  CardSize,
  StreamQuality,
  AppTheme,
  HistoryScale,
  DISCLAIMER_ACCEPTED_KEY,
  getSavedCardSize,
  saveCardSize,
  getSavedStreamQuality,
  saveStreamQuality,
  getSavedTheme,
  saveTheme,
  getHelpfulMouse,
  setHelpfulMouse,
  getSavedUserAge,
  saveUserAge,
  getHistoryOverscale,
  setHistoryOverscale,
  getLargeButtons,
  setLargeButtons,
} from "@/lib/settings";

const TRIAL_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
const AGE_LOCK_KEY = "rabtv_age_passcode";

const globalFeedOptions = [
  "All (Default)",
  "Canada (All)",
  "English",
  "German",
  "Arabic / Islamic",
  "Russian",
  "British",
  "Hungarian",
] as const;
export type GlobalFeedOption = (typeof globalFeedOptions)[number];

const HEADER_ICON_URL =
  "https://avatars.githubusercontent.com/u/330663733?v=4";

// ------------------------------------------------------------------
// NEW IMAGE ASSETS (place these in public/assets/ or your assets folder)
// ------------------------------------------------------------------
const RABBIT_HEADER_PILL = "/assets/rabbit-header-pill.jpg";
const RABBIT_MENU_STRIP  = "/assets/rabbit-menu-strip.jpg";
const RABBIT_PANEL       = "/assets/rabbit-panel.jpg";
const RABBIT_PANEL_ALT   = "/assets/rabbit-panel-alt.jpg";
const RABBIT_DIVIDER     = "/assets/rabbit-divider.jpg";

const themeStatusBarMap: Record<AppTheme, string> = {
  violet: "#0f0728",
  red: "#180505",
  midnight: "#050b1a",
  emerald: "#021a12",
  amber: "#1c1505",
  cyan: "#021820",
};

async function updateNativeStatusBar(theme: AppTheme) {
  if (typeof window === "undefined") return;
  try {
    const hex = themeStatusBarMap[theme] || "#050b1a";
    await StatusBar.setBackgroundColor({ color: hex });
    await StatusBar.setStyle({ style: Style.Dark });
  } catch {
    // ignore
  }
}

function verifyCurrentAccess(): boolean {
  if (typeof window === "undefined") return false;
  const status = localStorage.getItem("rabtv_access_status");
  if (status === "permanent") return true;
  if (status === "trial") {
    const startTime = Number(localStorage.getItem("rabtv_trial_start_timestamp") || 0);
    if (Date.now() - startTime < TRIAL_DURATION_MS) return true;
    localStorage.setItem("rabtv_access_status", "expired");
    return false;
  }
  if (localStorage.getItem(DISCLAIMER_ACCEPTED_KEY) === "true") {
    localStorage.setItem("rabtv_access_status", "permanent");
    return true;
  }
  return false;
}

export const Route = createRootRoute({
  component: RootComponent,
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
    ],
    title: "RABTV - Stream Your Favorite Shows",
  }),
});

function RootComponent() {
  const navigate = useNavigate();
  const [showFirstStartModal, setShowFirstStartModal] = useState(false);
  const [showBugModal, setShowBugModal] = useState(false);
  const [showBugFeedModal, setShowBugFeedModal] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  // Accordion section state for the console-grade side blade sidebar
  const [activeSidebarSection, setActiveSidebarSection] = useState<
    "theme" | "scale" | "audio" | "pin" | "backup" | "accessibility" | null
  >(null);

  const [cardSize, setCardSize] = useState<CardSize>("large");
  const [streamQuality, setStreamQuality] = useState<StreamQuality>("1080p");
  const [appTheme, setAppTheme] = useState<AppTheme>("violet");
  const [helpfulMouse, setHelpfulMouseState] = useState(false);
  const [historyOverscale, setHistoryOverscaleState] =
    useState<HistoryScale>("off");
  const [largeButtons, setLargeButtonsState] = useState(false);
  const [userAgeInput, setUserAgeInput] = useState<string>("");
  const [profileNameInput, setProfileNameInput] = useState<string>("");
  const [savedProfileName, setSavedProfileName] = useState<string>("");

  // Background Music State
  const [bgMusicState, setBgMusicState] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("rabtv_bg_music_state") || "playing";
    }
    return "playing";
  });

  const [currentStationUrl, setCurrentStationUrl] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("rabtv_radio_url") || "";
    }
    return "";
  });

  // Unified age and passcode management states
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
  const [isTrialActive, setIsTrialActive] = useState(false);
  const [trialDaysRemaining, setTrialDaysRemaining] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);

  // Update Channel State ("stable" vs "nightly")
  const [updateChannel, setUpdateChannel] = useState<"stable" | "nightly">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("rabtv_update_channel") as "stable" | "nightly") || "stable";
    }
    return "stable";
  });

  const handleUpdateChannelChange = (channel: "stable" | "nightly") => {
    setUpdateChannel(channel);
    if (typeof window !== "undefined") {
      localStorage.setItem("rabtv_update_channel", channel);
    }
  };

  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const [headerSearchInput, setHeaderSearchInput] = useState("");

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

  const handleGlobalFeedChange = (feed: GlobalFeedOption) => {
    setSelectedGlobalFeed(feed);
    if (typeof window !== "undefined") {
      localStorage.setItem("rabtv_global_feed", feed);
      window.dispatchEvent(
        new CustomEvent("rabtv_global_feed_updated", { detail: feed })
      );
    }
  };

  const handleHeaderSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate({ to: "/search", search: { q: headerSearchInput.trim() } });
    setHeaderSearchInput("");
  };

  const handleCloseAll = () => {
    setShowProfileMenu(false);
    setActiveSidebarSection(null);
  };

  const handleOpenExternal = async (url: string, e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    try {
      if (typeof window !== "undefined" && (window as any).Capacitor) {
        const browserModule = await import(/* @vite-ignore */ "@capacitor/browser");
        await browserModule.Browser.open({ url, presentationStyle: 'popover' });
        return;
      }
    } catch (err) {
      console.warn("Could not open via Capacitor Browser, using fallback", err);
    }
    if (typeof window !== "undefined") {
      window.open(url, "_blank");
    }
  };

  const handleToggleProfileMenu = () => {
    if (showProfileMenu) handleCloseAll();
    else {
      handleCloseAll();
      setShowProfileMenu(true);
    }
  };

  // Trigger silent OTA update check 3 seconds after app launch
  useEffect(() => {
    const updateTimer = setTimeout(() => {
      void checkForAppUpdates(true);
    }, 3000);
    return () => clearTimeout(updateTimer);
  }, []);

  // Lobby Background Audio Lifecycle Hooks
  useEffect(() => {
    const startAudio = () => {
      if (bgMusicState === "playing") {
        bgAudio.play();
      }
      window.removeEventListener("click", startAudio);
      window.removeEventListener("keydown", startAudio);
    };

    window.addEventListener("click", startAudio, { once: true });
    window.addEventListener("keydown", startAudio, { once: true });

    const handleRouteCheck = () => {
      const path = window.location.pathname;
      if (path.includes("details") || path.includes("watch") || path.includes("player")) {
        bgAudio.pause();
      } else if (bgMusicState === "playing") {
        bgAudio.play();
      }
    };

    window.addEventListener("popstate", handleRouteCheck);
    return () => {
      bgAudio.pause();
      window.removeEventListener("click", startAudio);
      window.removeEventListener("keydown", startAudio);
      window.removeEventListener("popstate", handleRouteCheck);
    };
  }, [bgMusicState]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const ua = navigator.userAgent.toLowerCase();
      if (ua.includes("silk") || ua.includes("firetv") || ua.includes("amazon")) {
        document.documentElement.classList.add("fire-os");
      }
    }

    if (!verifyCurrentAccess()) {
      setShowFirstStartModal(true);
    } else {
      const status = localStorage.getItem("rabtv_access_status");
      if (status === "trial") {
        setIsTrialActive(true);
        const startTime = Number(
          localStorage.getItem("rabtv_trial_start_timestamp") || 0
        );
        const remainingMs = Math.max(0, TRIAL_DURATION_MS - (Date.now() - startTime));
        setTrialDaysRemaining(Math.ceil(remainingMs / (1000 * 60 * 60 * 24)));
      }
    }

    setIsAdmin(localStorage.getItem("rabtv_is_admin") === "true");

    const loadedTheme = getSavedTheme();
    setCardSize(getSavedCardSize());
    setStreamQuality(getSavedStreamQuality());
    setAppTheme(loadedTheme);
    setHelpfulMouseState(getHelpfulMouse());
    setHistoryOverscaleState(getHistoryOverscale());
    setLargeButtonsState(getLargeButtons());
    void updateNativeStatusBar(loadedTheme);

    const existingAge = localStorage.getItem("rabtv_user_age");
    if (existingAge) setUserAgeInput(existingAge);

    const existingName = localStorage.getItem("rabtv_profile_name");
    if (existingName) {
      setProfileNameInput(existingName);
      setSavedProfileName(existingName);
    }

    const handleSettingsUpdate = () => {
      const updatedTheme = getSavedTheme();
      setCardSize(getSavedCardSize());
      setStreamQuality(getSavedStreamQuality());
      setAppTheme(updatedTheme);
      setHelpfulMouseState(getHelpfulMouse());
      setHistoryOverscaleState(getHistoryOverscale());
      setLargeButtonsState(getLargeButtons());
      void updateNativeStatusBar(updatedTheme);
      const updatedName = localStorage.getItem("rabtv_profile_name");
      if (updatedName) setSavedProfileName(updatedName);
      setIsAdmin(localStorage.getItem("rabtv_is_admin") === "true");
      const status = localStorage.getItem("rabtv_access_status");
      if (status === "trial") {
        setIsTrialActive(true);
        const startTime = Number(
          localStorage.getItem("rabtv_trial_start_timestamp") || 0
        );
        const remainingMs = Math.max(
          0,
          TRIAL_DURATION_MS - (Date.now() - startTime)
        );
        setTrialDaysRemaining(Math.ceil(remainingMs / (1000 * 60 * 60 * 24)));
      } else {
        setIsTrialActive(false);
      }
    };

    window.addEventListener("rabtv_settings_updated", handleSettingsUpdate);
    return () =>
      window.removeEventListener("rabtv_settings_updated", handleSettingsUpdate);
  }, []);

  const getAgeLockCode = () => typeof window !== "undefined" ? localStorage.getItem(AGE_LOCK_KEY) || "" : "";

  const handleUpgradeFromProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const name =
      savedProfileName ||
      (typeof window !== "undefined" ? localStorage.getItem("rabtv_profile_name") : "") ||
      "Friend";
    const age = getSavedUserAge() || parseInt(userAgeInput, 10) || 0;

    const GIST_ID = (import.meta as any).env?.VITE_GIST_ID as string || "";
    const GITHUB_TOKEN = (import.meta as any).env?.VITE_GH_PAT as string || "";
    const GIST_API_URL = GIST_ID ? `https://api.github.com/gists/${GIST_ID}` : "";

    let isValidGitHubCode = false;
    if (GIST_ID && GITHUB_TOKEN && GIST_API_URL) {
      try {
        const res = await fetch(GIST_API_URL, {
          headers: {
            Authorization: `Bearer ${GITHUB_TOKEN}`,
            Accept: "application/vnd.github+json",
            "User-Agent": "RabbitTV-App"
          }
        });
        if (res.ok) {
          const gistData = await res.json();
          const rawContent = gistData.files?.["keys.json"]?.content;
          if (rawContent) {
            let keysList = JSON.parse(rawContent);
            if (Array.isArray(keysList)) {
              let matchedIndex = keysList.findIndex((item: any) => 
                (typeof item === "object" && item !== null ? item.key === String(unlockCodeInput.trim()) && item.active === true : String(item) === String(unlockCodeInput.trim()))
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
                    "User-Agent": "RabbitTV-App"
                  },
                  body: JSON.stringify({
                    files: { "keys.json": { content: JSON.stringify(keysList, null, 2) } }
                  })
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
        handleCloseAll();
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

  const handleSizeChange = (newSize: CardSize) => {
    saveCardSize(newSize);
    setCardSize(newSize);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("rabtv_settings_updated"));
    }
  };

  const handleThemeChange = (newTheme: AppTheme) => {
    saveTheme(newTheme);
    setAppTheme(newTheme);
    void updateNativeStatusBar(newTheme);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("rabtv_settings_updated"));
    }
  };

  const handleMouseToggle = (enabled: boolean) => {
    setHelpfulMouse(enabled);
    setHelpfulMouseState(enabled);
  };

  const handleHistoryOverscaleChange = (scale: HistoryScale) => {
    setHistoryOverscale(scale);
    setHistoryOverscaleState(scale);
  };

  const handleLargeButtonsToggle = (enabled: boolean) => {
    setLargeButtons(enabled);
    setLargeButtonsState(enabled);
  };

  const handleBackgroundAudioToggle = (state: string) => {
    setBgMusicState(state);
    if (typeof window !== "undefined") {
      localStorage.setItem("rabtv_bg_music_state", state);
    }
    if (state === "playing") {
      bgAudio.play();
    } else {
      bgAudio.pause();
    }
  };

  const handleStationSelect = (url: string) => {
    bgAudio.setStation(url);
    setCurrentStationUrl(url);
    if (bgMusicState === "playing") {
      bgAudio.play();
    }
  };

  const handleUnifiedProfileUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    const locked = getAgeLockCode();

    if (!locked || unifiedAgeCodeInput.trim() !== locked) {
      setUnifiedUpdateStatus({ text: "⚠️ Current age-lock code is incorrect.", isError: true });
      setUnifiedAgeCodeInput("");
      return;
    }

    const parsedAge = parseInt(userAgeInput, 10);
    if (isNaN(parsedAge) || parsedAge < 1 || parsedAge > 120) {
      setUnifiedUpdateStatus({ text: "⚠️ Please enter a valid age (1–120).", isError: true });
      return;
    }

    const trimmedNew = newPasscode.trim();
    const trimmedConfirm = confirmNewPasscode.trim();

    if (trimmedNew || trimmedConfirm) {
      if (!/^\d{4}$/.test(trimmedNew)) {
        setUnifiedUpdateStatus({ text: "⚠️ New age-lock code must be exactly 4 digits.", isError: true });
        return;
      }
      if (trimmedNew !== trimmedConfirm) {
        setUnifiedUpdateStatus({ text: "⚠️ New codes do not match.", isError: true });
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

    setUnifiedUpdateStatus({ text: "✓ Profile and age-lock updated successfully!", isError: false });
    setUnifiedAgeCodeInput("");
    setNewPasscode("");
    setConfirmNewPasscode("");
    setTimeout(() => setUnifiedUpdateStatus(null), 3500);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("rabtv_settings_updated"));
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
      myList: typeof window !== "undefined" ? localStorage.getItem("rabtv_my_list") : null,
      favorites: typeof window !== "undefined" ? localStorage.getItem("rabtv_favorites") : null,
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
        if (data.cardSize) saveCardSize(data.cardSize);
        if (data.streamQuality) saveStreamQuality(data.streamQuality);
        if (data.appTheme) {
          saveTheme(data.appTheme);
          setAppTheme(data.appTheme);
          void updateNativeStatusBar(data.appTheme);
        }
        if (typeof data.helpfulMouse === "boolean")
          setHelpfulMouse(data.helpfulMouse);
        if (data.historyOverscale) setHistoryOverscale(data.historyOverscale);
        if (typeof data.largeButtons === "boolean")
          setLargeButtons(data.largeButtons);
        if (data.userAge) saveUserAge(data.userAge);
        if (data.profileName && typeof window !== "undefined") {
          localStorage.setItem("rabtv_profile_name", data.profileName);
          setSavedProfileName(data.profileName);
        }
        if (data.myList && typeof window !== "undefined") localStorage.setItem("rabtv_my_list", data.myList);
        if (data.favorites && typeof window !== "undefined")
          localStorage.setItem("rabtv_favorites", data.favorites);

        if (typeof window !== "undefined") {
          localStorage.removeItem(DISCLAIMER_ACCEPTED_KEY);
          localStorage.removeItem("rabtv_access_status");
          localStorage.removeItem("rabtv_is_admin");
        }
        setShowFirstStartModal(true);
        handleCloseAll();
        setBackupStatus(
          "Settings restored. Please reinstate your passcode agreement."
        );
      } catch {
        setBackupStatus("Failed to restore backup file.");
      }
    };
    reader.readAsText(file);
  };

  // ------------------------------------------------------------------
  // Theme helpers (kept exactly as you had them)
  // ------------------------------------------------------------------
  const getBodyBackground = (theme: AppTheme) => {
    switch (theme) {
      case "red":
        return "bg-gradient-to-br from-zinc-950/90 via-red-950/40 to-zinc-950/95";
      case "midnight":
        return "bg-gradient-to-br from-slate-950/90 via-blue-950/40 to-slate-950/95";
      case "emerald":
        return "bg-gradient-to-br from-slate-950/90 via-emerald-950/40 to-slate-950/95";
      case "amber":
        return "bg-gradient-to-br from-stone-950/90 via-yellow-950/40 to-stone-950/95";
      case "cyan":
        return "bg-gradient-to-br from-slate-950/90 via-cyan-950/40 to-slate-950/95";
      case "violet":
      default:
        return "bg-gradient-to-br from-slate-950/90 via-purple-950/40 to-slate-950/95";
    }
  };

  const getHeaderThemeBg = (theme: AppTheme) => {
    switch (theme) {
      case "red":
        return "bg-red-950/60 backdrop-blur-xl";
      case "midnight":
        return "bg-blue-950/60 backdrop-blur-xl";
      case "emerald":
        return "bg-emerald-950/60 backdrop-blur-xl";
      case "amber":
        return "bg-yellow-950/60 backdrop-blur-xl";
      case "cyan":
        return "bg-cyan-950/60 backdrop-blur-xl";
      case "violet":
      default:
        return "bg-purple-950/60 backdrop-blur-xl";
    }
  };

  const getCardBackground = (theme: AppTheme) => {
    switch (theme) {
      case "red":
        return "bg-zinc-900/90 border-red-500/25 shadow-2xl backdrop-blur-xl";
      case "midnight":
        return "bg-slate-900/90 border-blue-500/25 shadow-2xl backdrop-blur-xl";
      case "emerald":
        return "bg-slate-900/90 border-emerald-500/25 shadow-2xl backdrop-blur-xl";
      case "amber":
        return "bg-stone-900/90 border-amber-500/25 shadow-2xl backdrop-blur-xl";
      case "cyan":
        return "bg-slate-900/90 border-cyan-500/25 shadow-2xl backdrop-blur-xl";
      case "violet":
      default:
        return "bg-slate-900/90 border-purple-500/25 shadow-2xl backdrop-blur-xl";
    }
  };

  const getPrimaryBgColor = (theme: AppTheme) => {
    switch (theme) {
      case "red":
        return "bg-red-600 hover:bg-red-500";
      case "midnight":
        return "bg-blue-600 hover:bg-blue-500";
      case "emerald":
        return "bg-emerald-600 hover:bg-emerald-500";
      case "amber":
        return "bg-amber-600 hover:bg-amber-500";
      case "cyan":
        return "bg-cyan-600 hover:bg-cyan-500";
      case "violet":
      default:
        return "bg-violet-600 hover:bg-violet-500";
    }
  };

  const getPrimaryAccentColor = (theme: AppTheme) => {
    switch (theme) {
      case "red":
        return "text-red-400";
      case "midnight":
        return "text-blue-400";
      case "emerald":
        return "text-emerald-400";
      case "amber":
        return "text-amber-400";
      case "cyan":
        return "text-cyan-400";
      case "violet":
      default:
        return "text-violet-400";
    }
  };

  const getSubtlePillBg = (theme: AppTheme) => {
    switch (theme) {
      case "red":
        return "bg-red-950/50 border border-red-500/20 text-red-100 hover:bg-red-900/40";
      case "midnight":
        return "bg-blue-950/50 border border-blue-500/20 text-blue-100 hover:bg-blue-900/40";
      case "emerald":
        return "bg-emerald-950/50 border border-emerald-500/20 text-emerald-100 hover:bg-emerald-900/40";
      case "amber":
        return "bg-amber-950/50 border border-amber-500/20 text-amber-100 hover:bg-amber-900/40";
      case "cyan":
        return "bg-cyan-950/50 border border-cyan-500/20 text-cyan-100 hover:bg-cyan-900/40";
      case "violet":
      default:
        return "bg-violet-950/50 border border-violet-500/20 text-violet-100 hover:bg-violet-900/40";
    }
  };

  const allThemesList: AppTheme[] = ["violet", "red", "midnight", "emerald", "amber", "cyan"];

  // ------------------------------------------------------------------
  // Reusable styled accordion header (uses the thin pill image)
  // ------------------------------------------------------------------
  const MenuSectionHeader = ({
    title,
    isOpen,
    onClick,
    icon,
  }: {
    title: string;
    isOpen: boolean;
    onClick: () => void;
    icon: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center justify-between px-4 py-3.5 text-left text-xs font-bold text-white tracking-wide transition-all relative overflow-hidden rounded-xl group"
      style={{
        backgroundImage: `url(${RABBIT_HEADER_PILL})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* Subtle dark overlay so white text stays crisp */}
      <div className="absolute inset-0 bg-black/35 group-hover:bg-black/25 transition-colors pointer-events-none" />
      <span className="relative z-10 flex items-center gap-2.5">
        <span className="text-base">{icon}</span>
        <span>{title}</span>
      </span>
      <span
        className={`relative z-10 transform transition-transform duration-300 ${
          isOpen ? "rotate-180" : ""
        }`}
      >
        ▼
      </span>
    </button>
  );

  // ------------------------------------------------------------------
  // Reusable panel background for expanded content
  // ------------------------------------------------------------------
  const MenuPanel = ({
    children,
    alt = false,
  }: {
    children: React.ReactNode;
    alt?: boolean;
  }) => (
    <div
      className="p-3.5 border-t border-white/10 space-y-3 relative overflow-hidden"
      style={{
        backgroundImage: `url(${alt ? RABBIT_PANEL_ALT : RABBIT_PANEL})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* Keep content readable */}
      <div className="absolute inset-0 bg-black/55 pointer-events-none" />
      <div className="relative z-10">{children}</div>
    </div>
  );

  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className={`${getBodyBackground(appTheme)} min-h-screen text-white antialiased`}>
        <AuthProvider>
          <AppWallpaper theme={appTheme} />
          <HolidayOverlay />
          <PreviewHostBridge />

          {/* ===================== TOP HEADER BAR ===================== */}
          <header
            className={`sticky top-0 z-40 ${getHeaderThemeBg(appTheme)} border-b border-white/10`}
          >
            {/* ... keep your existing header markup exactly as it was ... */}
            {/* (I left the header untouched so you only get the menu changes) */}
            <div className="mx-auto max-w-7xl px-3 sm:px-4 py-2.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <img
                  src={HEADER_ICON_URL}
                  alt="Rabbit"
                  className="w-9 h-9 rounded-full border border-white/20 shadow-lg shrink-0"
                />
                <div className="min-w-0">
                  <h1 className="text-sm font-black tracking-tight truncate leading-none">
                    RABBiT TV
                  </h1>
                  <p className="text-[10px] text-white/60 truncate">
                    {savedProfileName ? `Hi, ${savedProfileName}` : "Stream Your Favorites"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <form onSubmit={handleHeaderSearchSubmit} className="hidden sm:block">
                  <input
                    type="search"
                    value={headerSearchInput}
                    onChange={(e) => setHeaderSearchInput(e.target.value)}
                    placeholder="Search..."
                    className="w-36 md:w-48 rounded-full bg-black/40 border border-white/15 px-3 py-1.5 text-xs text-white placeholder-white/40 focus:outline-none focus:border-white/40"
                  />
                </form>

                <button
                  type="button"
                  onClick={handleToggleProfileMenu}
                  className="relative flex items-center gap-1.5 rounded-full bg-black/40 border border-white/15 px-3 py-1.5 text-xs font-bold hover:bg-black/60 transition"
                >
                  <span className="hidden xs:inline">Menu</span>
                  <span>☰</span>
                </button>
              </div>
            </div>
          </header>

          {/* ===================== SIDE PROFILE MENU ===================== */}
          {showProfileMenu && (
            <div className="fixed inset-0 z-50 flex justify-end">
              {/* Backdrop */}
              <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={handleCloseAll}
              />

              {/* The blade itself */}
              <div
                className="relative w-full max-w-[340px] h-full overflow-y-auto border-l border-white/10 shadow-2xl"
                style={{
                  background: "linear-gradient(180deg, #0a0a0c 0%, #111114 100%)",
                }}
              >
                {/* Top brand strip */}
                <div
                  className="sticky top-0 z-20 px-4 py-3.5 flex items-center justify-between border-b border-white/10"
                  style={{
                    backgroundImage: `url(${RABBIT_MENU_STRIP})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                >
                  <div className="absolute inset-0 bg-black/40" />
                  <div className="relative z-10 flex items-center gap-2.5">
                    <img
                      src={HEADER_ICON_URL}
                      alt=""
                      className="w-8 h-8 rounded-full border border-white/25"
                    />
                    <div>
                      <p className="text-sm font-black tracking-wide">
                        {savedProfileName || "Rabbit"}
                      </p>
                      <p className="text-[10px] text-white/70">
                        {isAdmin ? "Admin" : "Profile"}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCloseAll}
                    className="relative z-10 rounded-full bg-black/50 border border-white/20 w-8 h-8 flex items-center justify-center text-sm hover:bg-black/70 transition"
                  >
                    ✕
                  </button>
                </div>

                <div className="p-3 space-y-2.5">
                  {/* 1. THEMES */}
                  <div className="rounded-xl overflow-hidden border border-white/10">
                    <MenuSectionHeader
                      title="App Themes & Styling"
                      icon="🎨"
                      isOpen={activeSidebarSection === "theme"}
                      onClick={() =>
                        setActiveSidebarSection(
                          activeSidebarSection === "theme" ? null : "theme"
                        )
                      }
                    />
                    {activeSidebarSection === "theme" && (
                      <MenuPanel>
                        <div className="grid grid-cols-3 gap-2">
                          {allThemesList.map((t) => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => handleThemeChange(t)}
                              className={`rounded-lg py-2 text-[11px] font-bold capitalize transition ${
                                appTheme === t
                                  ? `${getPrimaryBgColor(t)} text-white shadow-md`
                                  : "bg-black/50 border border-white/10 text-white/80 hover:bg-black/70"
                              }`}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      </MenuPanel>
                    )}
                  </div>

                  {/* 2. CARD SIZE / OVERSCALE */}
                  <div className="rounded-xl overflow-hidden border border-white/10">
                    <MenuSectionHeader
                      title="Over Scale & Grid Size"
                      icon="📐"
                      isOpen={activeSidebarSection === "scale"}
                      onClick={() =>
                        setActiveSidebarSection(
                          activeSidebarSection === "scale" ? null : "scale"
                        )
                      }
                    />
                    {activeSidebarSection === "scale" && (
                      <MenuPanel alt>
                        <div className="space-y-3">
                          <div>
                            <p className="text-[10px] text-slate-300 mb-1.5 font-semibold">
                              Card Size
                            </p>
                            <div className="grid grid-cols-3 gap-1.5">
                              {(["small", "medium", "large"] as CardSize[]).map((size) => (
                                <button
                                  key={size}
                                  type="button"
                                  onClick={() => handleSizeChange(size)}
                                  className={`rounded-lg py-1.5 text-[11px] font-bold capitalize transition ${
                                    cardSize === size
                                      ? `${getPrimaryBgColor(appTheme)} text-white`
                                      : "bg-black/50 border border-white/10 text-white/80"
                                  }`}
                                >
                                  {size}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <p className="text-[10px] text-slate-300 mb-1.5 font-semibold">
                              History Page Overscale
                            </p>
                            <div className="grid grid-cols-4 gap-1.5">
                              {(["off", "20", "50", "80"] as HistoryScale[]).map((scale) => (
                                <button
                                  key={scale}
                                  type="button"
                                  onClick={() => handleHistoryOverscaleChange(scale)}
                                  className={`rounded-lg py-1.5 text-[11px] font-bold transition ${
                                    historyOverscale === scale
                                      ? `${getPrimaryBgColor(appTheme)} text-white`
                                      : "bg-black/50 border border-white/10 text-white/80"
                                  }`}
                                >
                                  {scale === "off" ? "Off" : `+${scale}%`}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </MenuPanel>
                    )}
                  </div>

                  {/* 3. BACKGROUND AUDIO */}
                  <div className="rounded-xl overflow-hidden border border-white/10">
                    <MenuSectionHeader
                      title="Background Lobby Audio"
                      icon="🎵"
                      isOpen={activeSidebarSection === "audio"}
                      onClick={() =>
                        setActiveSidebarSection(
                          activeSidebarSection === "audio" ? null : "audio"
                        )
                      }
                    />
                    {activeSidebarSection === "audio" && (
                      <MenuPanel>
                        <div>
                          <p className="text-[10px] text-slate-300 mb-1.5 font-semibold">
                            Playback Controls:
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => handleBackgroundAudioToggle("playing")}
                              className={`rounded-lg py-2 text-xs font-bold transition ${
                                bgMusicState === "playing"
                                  ? `${getPrimaryBgColor(appTheme)} text-white shadow-md`
                                  : "bg-black/50 border border-white/10 text-white/80"
                              }`}
                            >
                              🎵 Audio ON
                            </button>
                            <button
                              type="button"
                              onClick={() => handleBackgroundAudioToggle("muted")}
                              className={`rounded-lg py-2 text-xs font-bold transition ${
                                bgMusicState === "muted"
                                  ? `${getPrimaryBgColor(appTheme)} text-white shadow-md`
                                  : "bg-black/50 border border-white/10 text-white/80"
                              }`}
                            >
                              🔇 Mute / OFF
                            </button>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-white/10">
                          <p className="text-[10px] text-slate-300 mb-1.5 font-semibold">
                            Select Channel / Stream:
                          </p>
                          <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
                            {Object.entries(RADIO_STATIONS).map(([category, stations]) => (
                              <div key={category} className="space-y-1">
                                <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider">
                                  {category}
                                </span>
                                {stations.map((station) => {
                                  const isSelected =
                                    currentStationUrl === station.url ||
                                    (!currentStationUrl &&
                                      bgAudio.getCurrentStation().url === station.url);
                                  return (
                                    <button
                                      key={station.url}
                                      type="button"
                                      onClick={() => handleStationSelect(station.url)}
                                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center justify-between ${
                                        isSelected
                                          ? `${getPrimaryBgColor(appTheme)} text-white shadow-md`
                                          : "bg-black/50 border border-white/10 text-white/80"
                                      }`}
                                    >
                                      <span className="truncate pr-1">{station.name}</span>
                                      {isSelected && (
                                        <span className="text-[9px] shrink-0">▶ Active</span>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            ))}
                          </div>
                        </div>
                      </MenuPanel>
                    )}
                  </div>

                  {/* 4. PROFILE / PIN */}
                  <div className="rounded-xl overflow-hidden border border-white/10">
                    <MenuSectionHeader
                      title="Profile, Age & PIN Settings"
                      icon="🔒"
                      isOpen={activeSidebarSection === "pin"}
                      onClick={() =>
                        setActiveSidebarSection(
                          activeSidebarSection === "pin" ? null : "pin"
                        )
                      }
                    />
                    {activeSidebarSection === "pin" && (
                      <MenuPanel alt>
                        <form onSubmit={handleUnifiedProfileUpdate} className="space-y-3">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <span className="block text-[10px] text-slate-300 mb-1">Name:</span>
                              <input
                                type="text"
                                maxLength={25}
                                value={profileNameInput}
                                onChange={(e) => setProfileNameInput(e.target.value)}
                                className="w-full rounded-lg border border-white/10 bg-black/50 px-2.5 py-1.5 text-xs text-white focus:outline-none"
                              />
                            </div>
                            <div>
                              <span className="block text-[10px] text-slate-300 mb-1">Age:</span>
                              <input
                                type="number"
                                min={1}
                                max={120}
                                value={userAgeInput}
                                onChange={(e) => setUserAgeInput(e.target.value)}
                                className="w-full rounded-lg border border-white/10 bg-black/50 px-2.5 py-1.5 text-xs text-white focus:outline-none"
                              />
                            </div>
                          </div>

                          <div>
                            <span className="block text-[10px] text-slate-300 mb-1">
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
                              className="w-full rounded-lg border border-white/10 bg-black/50 px-2.5 py-1.5 text-xs text-white focus:outline-none tracking-widest"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/10">
                            <div>
                              <span className="block text-[10px] text-slate-300 mb-1">
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
                                className="w-full rounded-lg border border-white/10 bg-black/50 px-2.5 py-1.5 text-xs text-white focus:outline-none tracking-widest"
                              />
                            </div>
                            <div>
                              <span className="block text-[10px] text-slate-300 mb-1">
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
                                className="w-full rounded-lg border border-white/10 bg-black/50 px-2.5 py-1.5 text-xs text-white focus:outline-none tracking-widest"
                              />
                            </div>
                          </div>

                          <button
                            type="submit"
                            className={`w-full py-2 rounded-lg ${getPrimaryBgColor(
                              appTheme
                            )} text-xs font-bold shadow transition`}
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
                      </MenuPanel>
                    )}
                  </div>

                  {/* 5. BACKUP */}
                  <div className="rounded-xl overflow-hidden border border-white/10">
                    <MenuSectionHeader
                      title="Backup & Profile Data"
                      icon="💾"
                      isOpen={activeSidebarSection === "backup"}
                      onClick={() =>
                        setActiveSidebarSection(
                          activeSidebarSection === "backup" ? null : "backup"
                        )
                      }
                    />
                    {activeSidebarSection === "backup" && (
                      <MenuPanel>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={handleSaveBackup}
                            className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition ${getSubtlePillBg(
                              appTheme
                            )}`}
                          >
                            💾 Export Backup
                          </button>
                          <label
                            className={`flex-1 text-center cursor-pointer rounded-lg border px-3 py-2 text-xs font-semibold transition ${getSubtlePillBg(
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
                            )} font-semibold block text-center`}
                          >
                            {backupStatus}
                          </span>
                        )}
                      </MenuPanel>
                    )}
                  </div>

                  {/* 6. ACCESSIBILITY */}
                  <div className="rounded-xl overflow-hidden border border-white/10">
                    <MenuSectionHeader
                      title="Accessibility Options"
                      icon="♿"
                      isOpen={activeSidebarSection === "accessibility"}
                      onClick={() =>
                        setActiveSidebarSection(
                          activeSidebarSection === "accessibility"
                            ? null
                            : "accessibility"
                        )
                      }
                    />
                    {activeSidebarSection === "accessibility" && (
                      <MenuPanel alt>
                        <div className="space-y-3">
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
                              onClick={() => handleMouseToggle(!helpfulMouse)}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
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

                          <div className="flex items-center justify-between pt-2 border-t border-white/10">
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
                              onClick={() => handleLargeButtonsToggle(!largeButtons)}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
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
                      </MenuPanel>
                    )}
                  </div>

                  {/* Divider image */}
                  <div className="py-1">
                    <img
                      src={RABBIT_DIVIDER}
                      alt=""
                      className="w-full h-3 object-contain opacity-80"
                    />
                  </div>

                  {/* ADMIN PANEL */}
                  {isAdmin && (
                    <div className="pt-1">
                      <AdminPanel
                        appTheme={appTheme}
                        getPrimaryBgColor={getPrimaryBgColor}
                        getPrimaryAccentColor={getPrimaryAccentColor}
                      />
                    </div>
                  )}

                  {/* FEEDBACK & SUPPORT */}
                  <div className="pt-2 space-y-2">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">
                      Feedback & Support
                    </h4>
                    <button
                      type="button"
                      onClick={() => setShowBugModal(true)}
                      className={`w-full py-2.5 rounded-xl text-xs font-bold transition ${getPrimaryBgColor(
                        appTheme
                      )} text-white shadow-md`}
                    >
                      🐞 Report a Bug / Issue
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowBugFeedModal(true)}
                      className="w-full py-2.5 rounded-xl bg-black/50 hover:bg-black/70 text-xs font-bold text-slate-200 transition border border-white/10 flex items-center justify-center gap-2"
                    >
                      📋 View Bug Reports Feed
                    </button>
                  </div>

                  {/* UPDATE CHANNEL */}
                  <div className="pt-3 space-y-2">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">
                      Update Channel
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleUpdateChannelChange("stable")}
                        className={`py-2 rounded-lg text-xs font-bold transition ${
                          updateChannel === "stable"
                            ? `${getPrimaryBgColor(appTheme)} text-white`
                            : "bg-black/50 text-slate-300 border border-white/10"
                        }`}
                      >
                        🛡️ Stable
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateChannelChange("nightly")}
                        className={`py-2 rounded-lg text-xs font-bold transition ${
                          updateChannel === "nightly"
                            ? `${getPrimaryBgColor(appTheme)} text-white`
                            : "bg-black/50 text-slate-300 border border-white/10"
                        }`}
                      >
                        ⚡ Nightly
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => void checkForAppUpdates(false)}
                      className={`w-full py-2.5 rounded-xl text-xs font-bold transition ${getPrimaryBgColor(
                        appTheme
                      )} text-white shadow-md`}
                    >
                      🔍 Check for Updates Now
                    </button>
                  </div>

                  {/* LICENSE STATUS */}
                  <div className="pt-3 space-y-2">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">
                      License Status
                    </h4>
                    {isAdmin ? (
                      <p className="text-[11px] text-red-300 font-semibold bg-red-500/10 border border-red-500/30 p-2.5 rounded-lg">
                        🔐 Admin access active.
                      </p>
                    ) : isTrialActive ? (
                      <div className="space-y-2">
                        <p className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/30 p-2.5 rounded-lg leading-relaxed">
                          Trial:{" "}
                          <strong>
                            {trialDaysRemaining}{" "}
                            {trialDaysRemaining === 1 ? "day" : "days"} remaining
                          </strong>
                          .
                        </p>
                        <form onSubmit={handleUpgradeFromProfile} className="space-y-1.5">
                          <input
                            type="password"
                            placeholder="Unlock code"
                            value={unlockCodeInput}
                            onChange={(e) => setUnlockCodeInput(e.target.value)}
                            className="w-full rounded-lg border border-white/10 bg-black/50 px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none"
                          />
                          <button
                            type="submit"
                            className={`w-full py-2 rounded-lg ${getPrimaryBgColor(
                              appTheme
                            )} text-xs font-bold shadow transition`}
                          >
                            Upgrade to Full Unlock
                          </button>
                        </form>
                      </div>
                    ) : (
                      <p className="text-[11px] text-emerald-400 font-semibold bg-emerald-500/10 border border-emerald-500/30 p-2.5 rounded-lg">
                        ✅ Full Lifetime Access Unlocked.
                      </p>
                    )}
                    {unlockStatusMsg && (
                      <p
                        className={`text-[11px] font-bold text-center ${
                          unlockStatusMsg.isError ? "text-red-400" : "text-emerald-400"
                        }`}
                      >
                        {unlockStatusMsg.text}
                      </p>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="pt-5 pb-6 text-center">
                    <img
                      src={RABBIT_DIVIDER}
                      alt=""
                      className="w-2/3 mx-auto h-2 object-contain opacity-60 mb-3"
                    />
                    <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">
                      Console UI v2.0 • RABBiT TV
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <main className="mx-auto max-w-7xl px-4 py-4 sm:px-6 md:py-6 overflow-x-hidden pb-20">
            <Outlet />
          </main>

          <UserNotifier appTheme={appTheme} />

          <BugReportModal
            isOpen={showBugModal}
            onClose={() => setShowBugModal(false)}
            userName={savedProfileName || "Friend"}
            userUnlockCode={
              typeof window !== "undefined"
                ? localStorage.getItem(AGE_LOCK_KEY) || "0000"
                : "0000"
            }
          />

          <PublicBugFeedModal
            isOpen={showBugFeedModal}
            onClose={() => setShowBugFeedModal(false)}
          />

          <ActivationModal
            isOpen={showFirstStartModal}
            onAuthorized={() => setShowFirstStartModal(false)}
            appTheme={appTheme}
            cardSize={cardSize}
            streamQuality={streamQuality}
            helpfulMouse={helpfulMouse}
            allThemesList={allThemesList}
            headerIconUrl={HEADER_ICON_URL}
            onThemeChange={handleThemeChange}
            onSizeChange={handleSizeChange}
            onMouseToggle={handleMouseToggle}
            handleOpenExternal={handleOpenExternal}
            getCardBackground={getCardBackground}
            getPrimaryAccentColor={getPrimaryAccentColor}
            getPrimaryBgColor={getPrimaryBgColor}
          />
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  );
}