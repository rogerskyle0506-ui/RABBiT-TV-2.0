// src/routes/__root.tsx
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
import { useState, useEffect, useRef } from "react";
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
  "Ukrainian",
  "Arabic / Islamic",
  "Russian",
  "British",
  "Hungarian",
] as const;
export type GlobalFeedOption = (typeof globalFeedOptions)[number];

const HEADER_ICON_URL =
  "https://avatars.githubusercontent.com/u/330663733?v=4";

// Background assets for the side menu depth and styling
const RABBIT_HEADER_PILL = "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/main/assets/rabbit-header-pill.jpg";
const RABBIT_MENU_STRIP  = "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/main/assets/rabbit-menu-strip.jpg";
const RABBIT_PANEL       = "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/main/assets/rabbit-panel.jpg";
const RABBIT_PANEL_ALT   = "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/main/assets/rabbit-panel-alt.jpg";
const RABBIT_DIVIDER     = "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/main/assets/rabbit-divider.jpg";

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
  const profileName = localStorage.getItem("rabtv_profile_name");
  
  if (!status || !profileName) return false;

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
  const lastScrollYRef = useRef(0);

  const [activeSidebarSection, setActiveSidebarSection] = useState<
    "theme" | "scale" | "audio" | "pin" | "backup" | "accessibility" | "globalFeed" | "history" | null
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
      if (typeof window !== "undefined") {
        lastScrollYRef.current = window.scrollY;
      }
      setShowProfileMenu(true);
    }
  };

  useEffect(() => {
    const updateTimer = setTimeout(() => {
      void checkForAppUpdates(true);
    }, 3000);
    return () => clearTimeout(updateTimer);
  }, []);

  useEffect(() => {
    const handleWindowScroll = () => {
      if (showProfileMenu && typeof window !== "undefined") {
        if (Math.abs(window.scrollY - lastScrollYRef.current) > 60) {
          handleCloseAll();
        }
      }
    };
    if (typeof window !== "undefined") {
      window.addEventListener("scroll", handleWindowScroll, { passive: true });
      return () => window.removeEventListener("scroll", handleWindowScroll);
    }
  }, [showProfileMenu]);

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
        return "bg-slate-900/90 border-violet-500/25 shadow-2xl backdrop-blur-xl";
    }
  };

  const getThemeHeaderStyles = (theme: AppTheme) => {
    switch (theme) {
      case "red":
        return {
          btnBg:
            "bg-red-950/60 border-red-500/25 text-red-100 hover:bg-red-900/80 shadow-sm",
        };
      case "midnight":
        return {
          btnBg:
            "bg-blue-950/60 border-blue-500/25 text-blue-100 hover:bg-blue-900/80 shadow-sm",
        };
      case "emerald":
        return {
          btnBg:
            "bg-emerald-950/60 border-emerald-500/25 text-emerald-100 hover:bg-emerald-900/80 shadow-sm",
        };
      case "amber":
        return {
          btnBg:
            "bg-yellow-950/60 border-amber-500/25 text-amber-100 hover:bg-yellow-900/80 shadow-sm",
        };
      case "cyan":
        return {
          btnBg:
            "bg-cyan-950/60 border-cyan-500/25 text-cyan-100 hover:bg-cyan-900/80 shadow-sm",
        };
      case "violet":
      default:
        return {
          btnBg:
            "bg-purple-950/60 border-violet-500/25 text-purple-100 hover:bg-purple-900/80 shadow-sm",
        };
    }
  };

  const activeHeader = getThemeHeaderStyles(appTheme);

  const getPrimaryAccentColor = (theme: AppTheme) => {
    switch (theme) {
      case "red":
        return "text-red-400";
      case "midnight":
        return "text-blue-400";
      case "emerald":
        return "text-emerald-300";
      case "amber":
        return "text-amber-300";
      case "cyan":
        return "text-cyan-300";
      case "violet":
      default:
        return "text-violet-400";
    }
  };

  const getPrimaryBgColor = (theme: AppTheme) => {
    switch (theme) {
      case "red":
        return "bg-gradient-to-r from-red-600 via-rose-600 to-orange-600 text-white shadow-lg shadow-red-600/30";
      case "midnight":
        return "bg-gradient-to-r from-blue-600 via-cyan-600 to-sky-600 text-white shadow-lg shadow-blue-600/30";
      case "emerald":
        return "bg-gradient-to-r from-emerald-600 via-teal-600 to-green-600 text-white shadow-lg shadow-emerald-600/30";
      case "amber":
        return "bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 text-white shadow-lg shadow-amber-600/30";
      case "cyan":
        return "bg-gradient-to-r from-cyan-600 via-teal-600 to-blue-600 text-white shadow-lg shadow-cyan-600/30";
      case "violet":
      default:
        return "bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 text-white shadow-lg shadow-violet-600/30";
    }
  };

  const getThemeGlowClass = (theme: AppTheme) => {
    switch (theme) {
      case "red":
        return "border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.4)]";
      case "midnight":
        return "border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.4)]";
      case "emerald":
        return "border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.4)]";
      case "amber":
        return "border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.4)]";
      case "cyan":
        return "border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.4)]";
      case "violet":
      default:
        return "border-violet-500/50 shadow-[0_0_15px_rgba(139,92,246,0.4)]";
    }
  };

  const getSubtlePillBg = (theme: AppTheme) => {
    switch (theme) {
      case "red":
        return "bg-red-950/40 border-red-500/25 text-red-200 hover:bg-red-900/60";
      case "midnight":
        return "bg-blue-950/40 border-blue-500/25 text-blue-200 hover:bg-blue-900/60";
      case "emerald":
        return "bg-emerald-950/40 border-emerald-500/25 text-emerald-200 hover:bg-emerald-900/60";
      case "amber":
        return "bg-yellow-950/40 border-amber-500/25 text-amber-200 hover:bg-yellow-900/60";
      case "cyan":
        return "bg-cyan-950/40 border-cyan-500/25 text-cyan-200 hover:bg-cyan-900/60";
      case "violet":
      default:
        return "bg-purple-950/40 border-violet-500/25 text-purple-200 hover:bg-purple-900/60";
    }
  };

  const allThemesList: { id: AppTheme; label: string }[] = [
    { id: "violet", label: "🟣 Violet / Neon" },
    { id: "red", label: "🔴 Red & Black" },
    { id: "midnight", label: "🔵 Midnight & Black" },
    { id: "emerald", label: "🟢 Emerald / Teal" },
    { id: "amber", label: "🟠 Amber / Gold" },
    { id: "cyan", label: "🔷 Cyan / Sky" },
  ];

  return (
    <html lang="en" data-theme={appTheme}>
      <head>
        <HeadContent />
        {helpfulMouse && (
          <style>{`
            *, button, a, select, input, [role="button"] {
              cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='72' height='72' viewBox='0 0 24 24' fill='%23ffffff' stroke='%23000000' stroke-width='2'%3E%3Cpath d='M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z'/%3E%3C/svg%3E"), auto !important;
            }
          `}</style>
        )}
      </head>
      <body
        className={`min-h-screen max-w-full overflow-x-hidden ${getBodyBackground(appTheme)} text-slate-100 antialiased transition-colors duration-300 relative`}
      >
        <PreviewHostBridge />
        <HolidayOverlay />
        <AppWallpaper />
        <AuthProvider>
          <header className={`sticky top-0 z-40 border-b border-white/10 transition-colors duration-300 relative overflow-hidden ${getHeaderThemeBg(appTheme)}`}>
            <div className="absolute inset-0 pointer-events-none opacity-20">
              <img
                src={HEADER_ICON_URL}
                alt="Header Background"
                className="w-full h-full object-fill"
              />
            </div>

            <div className="relative z-10 mx-auto flex max-w-7xl flex-col sm:flex-row items-stretch sm:items-center justify-between px-3 py-2.5 sm:px-6 gap-2.5">
              <div className="flex items-center justify-between sm:justify-start gap-2.5">
                <Link
                  to="/"
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-black/40 backdrop-blur-md border text-sm sm:text-lg font-black tracking-wider text-white focus:outline-none shrink-0 group transition-all animate-pulse ${getThemeGlowClass(appTheme)}`}
                >
                  <span className="whitespace-nowrap">RABBiT TV</span>
                </Link>

                {savedProfileName && !showFirstStartModal && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleToggleProfileMenu}
                      className="w-full sm:w-auto flex items-center justify-between sm:justify-start gap-2 px-3.5 py-2 rounded-xl border border-white/20 text-xs font-bold text-white shadow-md transition cursor-pointer group relative overflow-hidden"
                      style={{
                        backgroundImage: `url(${RABBIT_HEADER_PILL})`,
                        backgroundSize: "100% 100%",
                        backgroundRepeat: "no-repeat",
                        backgroundPosition: "center center",
                      }}
                    >
                      <div className="absolute inset-0 bg-black/40 pointer-events-none w-full h-full" />
                      <div className="relative z-10 flex items-center gap-2 w-full">
                        <div className="w-5 h-5 rounded-full overflow-hidden border border-white/30 bg-slate-800 shrink-0">
                          <img src={HEADER_ICON_URL} alt="Avatar" className="w-full h-full object-cover" />
                        </div>
                        <span className="truncate">
                          Hi, <strong className="text-white">{savedProfileName}</strong>{" "}
                          {isAdmin
                            ? "(Admin)"
                            : isTrialActive
                            ? `(Trial: ${trialDaysRemaining}d)`
                            : "(Full)"}
                        </span>
                        <span className="text-[10px] ml-auto text-slate-300 group-hover:translate-x-0.5 transition-transform">☰</span>
                      </div>
                    </button>
                    {isTrialActive && (
                      <div className="hidden md:flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[11px] font-bold animate-pulse">
                        <span>⏳ {trialDaysRemaining}d left</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {!showFirstStartModal && (
                <div className="flex items-center justify-between sm:justify-end gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                  <form
                    onSubmit={handleHeaderSearchSubmit}
                    className="flex items-center gap-1.5 shrink-0 flex-1 sm:flex-initial"
                  >
                    <input
                      type="text"
                      value={headerSearchInput}
                      onChange={(e) => setHeaderSearchInput(e.target.value)}
                      placeholder="Search..."
                      className="h-9 sm:h-10 w-full sm:w-32 lg:w-44 rounded-xl border border-white/10 bg-slate-900/70 px-3 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 backdrop-blur-md shadow-inner"
                    />
                    <button
                      type="submit"
                      className={`flex h-9 sm:h-10 px-3 items-center justify-center rounded-xl border text-xs font-bold shadow-sm transition shrink-0 ${activeHeader.btnBg}`}
                      aria-label="Search"
                    >
                      🔍
                    </button>
                  </form>
                </div>
              )}
            </div>
          </header>

          {/* CONSOLE-GRADE LEFT SIDE BLADE SIDEBAR */}
          {showProfileMenu && !showFirstStartModal && (
            <div className="fixed inset-0 z-50 flex">
              {/* Backdrop Blur Overlay */}
              <div
                className="fixed inset-0 bg-black/70 backdrop-blur-md transition-opacity animate-fade-in"
                onClick={handleCloseAll}
              />

              {/* Side Blade Drawer Content with 25% transparency and Top/Bottom Fade-Out Mask */}
              <div
                className="relative w-96 max-w-[90vw] h-[100dvh] border-r border-white/20 shadow-2xl flex flex-col z-10 overflow-y-auto p-5 pt-8 pb-8 transition-transform duration-300 animate-slide-right opacity-75"
                style={{
                  backgroundImage: `url(${RABBIT_PANEL})`,
                  backgroundSize: "100% 100%",
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "center center",
                  maskImage: "linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%)",
                  WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%)",
                }}
              >
                <div className="relative z-10 flex flex-col h-full w-full">
                  {/* Sidebar Header with Perfectly Aligned Logo and Padding */}
                  <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4 pt-3 px-1 w-full">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl overflow-hidden border border-white/30 bg-slate-800 shadow-md shrink-0 flex items-center justify-center">
                        <img src={HEADER_ICON_URL} alt="Avatar" className="w-full h-full object-cover" />
                      </div>
                      <div>
                        <h3 className={`text-sm font-black tracking-wide ${getPrimaryAccentColor(appTheme)}`}>
                          {savedProfileName || "User Profile"}
                        </h3>
                        <span className="text-[10px] text-emerald-400 font-semibold">● System Online</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleCloseAll}
                      className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-slate-200 transition shrink-0"
                    >
                      ✕ Close
                    </button>
                  </div>

                  {/* ACCORDION SECTIONS */}
                  <div className="space-y-3.5 flex-1 w-full">

                    {/* 1. GLOBAL FEED SELECTOR ACCORDION */}
                    <div className="border-0 bg-transparent overflow-hidden w-full">
                      <button
                        type="button"
                        onClick={() => setActiveSidebarSection(activeSidebarSection === "globalFeed" ? null : "globalFeed")}
                        className="w-full flex items-center justify-between px-4 py-4 text-left text-xs font-bold text-white hover:bg-white/5 transition relative overflow-hidden"
                        style={{
                          backgroundImage: `url(${RABBIT_HEADER_PILL})`,
                          backgroundSize: "100% 100%",
                          backgroundRepeat: "no-repeat",
                          backgroundPosition: "center center",
                        }}
                      >
                        <span className="relative z-10 flex items-center gap-2">🌐 Global Feed Selector</span>
                        <span className={`relative z-10 transform transition-transform ${activeSidebarSection === "globalFeed" ? "rotate-180" : ""}`}>▼</span>
                      </button>
                      {activeSidebarSection === "globalFeed" && (
                        <div
                          className="p-4 border-0 space-y-2 relative w-full opacity-75"
                          style={{
                            backgroundImage: `url(${RABBIT_PANEL})`,
                            backgroundSize: "100% 100%",
                            backgroundRepeat: "no-repeat",
                            backgroundPosition: "center center",
                          }}
                        >
                          <div className="relative z-10 space-y-2 w-full">
                            <p className="text-[10px] text-slate-300 font-semibold">Select Region Feed:</p>
                            <div className="relative w-full">
                              <div
                                className={`flex h-10 w-full items-center justify-between rounded-xl border px-3 text-xs font-bold shadow-sm transition ${activeHeader.btnBg} gap-1 relative pointer-events-auto`}
                              >
                                <span className="truncate">
                                  🌐 {selectedGlobalFeed === "All (Default)" ? "Global" : selectedGlobalFeed}
                                </span>
                                <span className="text-[9px]">▼</span>
                                <select
                                  value={selectedGlobalFeed}
                                  onChange={(e) => handleGlobalFeedChange(e.target.value as GlobalFeedOption)}
                                  className="absolute inset-0 w-full h-full opacity-0 bg-transparent text-white cursor-pointer z-50 appearance-none"
                                >
                                  {globalFeedOptions.map((opt) => (
                                    <option key={opt} value={opt} className="bg-slate-900 text-white p-2">
                                      🌐 {opt}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 2. WATCH HISTORY ACCORDION */}
                    <div className="border-0 bg-transparent overflow-hidden w-full">
                      <button
                        type="button"
                        onClick={() => setActiveSidebarSection(activeSidebarSection === "history" ? null : "history")}
                        className="w-full flex items-center justify-between px-4 py-4 text-left text-xs font-bold text-white hover:bg-white/5 transition relative overflow-hidden"
                        style={{
                          backgroundImage: `url(${RABBIT_HEADER_PILL})`,
                          backgroundSize: "100% 100%",
                          backgroundRepeat: "no-repeat",
                          backgroundPosition: "center center",
                        }}
                      >
                        <span className="relative z-10 flex items-center gap-2">🕒 Watch History</span>
                        <span className={`relative z-10 transform transition-transform ${activeSidebarSection === "history" ? "rotate-180" : ""}`}>▼</span>
                      </button>
                      {activeSidebarSection === "history" && (
                        <div
                          className="p-4 border-0 space-y-2 relative w-full opacity-75"
                          style={{
                            backgroundImage: `url(${RABBIT_PANEL_ALT})`,
                            backgroundSize: "100% 100%",
                            backgroundRepeat: "no-repeat",
                            backgroundPosition: "center center",
                          }}
                        >
                          <div className="relative z-10 space-y-2 w-full">
                            <p className="text-[10px] text-slate-300 font-semibold">View previously watched media:</p>
                            <Link
                              to="/watch-history"
                              onClick={handleCloseAll}
                              className={`flex h-10 w-full items-center justify-center rounded-xl border px-3 text-xs font-bold shadow-sm transition ${activeHeader.btnBg}`}
                            >
                              🕒 Open Watch History
                            </Link>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 3. APP CUSTOMIZATION ACCORDION */}
                    <div className="border-0 bg-transparent overflow-hidden w-full">
                      <button
                        type="button"
                        onClick={() => setActiveSidebarSection(activeSidebarSection === "theme" ? null : "theme")}
                        className="w-full flex items-center justify-between px-4 py-4 text-left text-xs font-bold text-white hover:bg-white/5 transition relative overflow-hidden"
                        style={{
                          backgroundImage: `url(${RABBIT_HEADER_PILL})`,
                          backgroundSize: "100% 100%",
                          backgroundRepeat: "no-repeat",
                          backgroundPosition: "center center",
                        }}
                      >
                        <span className="relative z-10 flex items-center gap-2">🎨 App Themes & Styling</span>
                        <span className={`relative z-10 transform transition-transform ${activeSidebarSection === "theme" ? "rotate-180" : ""}`}>▼</span>
                      </button>
                      {activeSidebarSection === "theme" && (
                        <div
                          className="p-4 border-0 space-y-2 relative w-full opacity-75"
                          style={{
                            backgroundImage: `url(${RABBIT_PANEL})`,
                            backgroundSize: "100% 100%",
                            backgroundRepeat: "no-repeat",
                            backgroundPosition: "center center",
                          }}
                        >
                          <div className="relative z-10 grid grid-cols-2 gap-2 w-full">
                            {allThemesList.map((t) => (
                              <button
                                key={t.id}
                                type="button"
                                onClick={() => handleThemeChange(t.id)}
                                className={`rounded-lg p-2 text-xs font-bold transition text-left w-full ${
                                  appTheme === t.id
                                    ? `${getPrimaryBgColor(t.id)} text-white shadow-md`
                                    : `${getSubtlePillBg(appTheme)}`
                                }`}
                              >
                                {t.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 4. OVER SCALE & GRID SIZING ACCORDION */}
                    <div className="border-0 bg-transparent overflow-hidden w-full">
                      <button
                        type="button"
                        onClick={() => setActiveSidebarSection(activeSidebarSection === "scale" ? null : "scale")}
                        className="w-full flex items-center justify-between px-4 py-4 text-left text-xs font-bold text-white hover:bg-white/5 transition relative overflow-hidden"
                        style={{
                          backgroundImage: `url(${RABBIT_HEADER_PILL})`,
                          backgroundSize: "100% 100%",
                          backgroundRepeat: "no-repeat",
                          backgroundPosition: "center center",
                        }}
                      >
                        <span className="relative z-10 flex items-center gap-2">📐 Over Scale & Grid Size</span>
                        <span className={`relative z-10 transform transition-transform ${activeSidebarSection === "scale" ? "rotate-180" : ""}`}>▼</span>
                      </button>
                      {activeSidebarSection === "scale" && (
                        <div
                          className="p-4 border-0 space-y-3 relative w-full opacity-75"
                          style={{
                            backgroundImage: `url(${RABBIT_PANEL_ALT})`,
                            backgroundSize: "100% 100%",
                            backgroundRepeat: "no-repeat",
                            backgroundPosition: "center center",
                          }}
                        >
                          <div className="relative z-10 space-y-3 w-full">
                            <div className="w-full">
                              <p className="text-[10px] text-slate-300 mb-1.5 font-semibold">Catalog Card Size:</p>
                              <div className="grid grid-cols-3 gap-1.5 w-full">
                                {(["small", "medium", "large"] as CardSize[]).map((size) => (
                                  <button
                                    key={size}
                                    type="button"
                                    onClick={() => handleSizeChange(size)}
                                    className={`rounded-lg py-2 text-xs font-bold capitalize transition w-full ${
                                      cardSize === size
                                        ? `${getPrimaryBgColor(appTheme)} text-white shadow-md`
                                        : `${getSubtlePillBg(appTheme)}`
                                    }`}
                                  >
                                    {size}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="pt-2 border-t border-white/10 w-full">
                              <p className="text-[10px] text-slate-300 mb-1.5 font-semibold">History Page Overscale:</p>
                              <div className="grid grid-cols-4 gap-1.5 w-full">
                                {(["off", "20%", "50%", "80%"] as HistoryScale[]).map((scale) => (
                                  <button
                                    key={scale}
                                    type="button"
                                    onClick={() => handleHistoryOverscaleChange(scale)}
                                    className={`rounded-lg py-1.5 text-xs font-bold capitalize transition w-full ${
                                      historyOverscale === scale
                                        ? `${getPrimaryBgColor(appTheme)} text-white shadow-md`
                                        : `${getSubtlePillBg(appTheme)}`
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

                    {/* 5. BACKGROUND MUSIC AUDIO ACCORDION */}
                    <div className="border-0 bg-transparent overflow-hidden w-full">
                      <button
                        type="button"
                        onClick={() => setActiveSidebarSection(activeSidebarSection === "audio" ? null : "audio")}
                        className="w-full flex items-center justify-between px-4 py-4 text-left text-xs font-bold text-white hover:bg-white/5 transition relative overflow-hidden"
                        style={{
                          backgroundImage: `url(${RABBIT_HEADER_PILL})`,
                          backgroundSize: "100% 100%",
                          backgroundRepeat: "no-repeat",
                          backgroundPosition: "center center",
                        }}
                      >
                        <span className="relative z-10 flex items-center gap-2">🎵 Background Lobby Audio</span>
                        <span className={`relative z-10 transform transition-transform ${activeSidebarSection === "audio" ? "rotate-180" : ""}`}>▼</span>
                      </button>
                      {activeSidebarSection === "audio" && (
                        <div
                          className="p-4 border-0 space-y-3 relative w-full opacity-75"
                          style={{
                            backgroundImage: `url(${RABBIT_PANEL})`,
                            backgroundSize: "100% 100%",
                            backgroundRepeat: "no-repeat",
                            backgroundPosition: "center center",
                          }}
                        >
                          <div className="relative z-10 space-y-3 w-full">
                            <div className="w-full">
                              <p className="text-[10px] text-slate-300 mb-1.5 font-semibold">Playback Controls:</p>
                              <div className="grid grid-cols-2 gap-2 w-full">
                                <button
                                  type="button"
                                  onClick={() => handleBackgroundAudioToggle("playing")}
                                  className={`rounded-lg py-2 text-xs font-bold transition w-full ${
                                    bgMusicState === "playing"
                                      ? `${getPrimaryBgColor(appTheme)} text-white shadow-md`
                                      : `${getSubtlePillBg(appTheme)}`
                                  }`}
                                >
                                  🎵 Audio ON
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleBackgroundAudioToggle("muted")}
                                  className={`rounded-lg py-2 text-xs font-bold transition w-full ${
                                    bgMusicState === "muted"
                                      ? `${getPrimaryBgColor(appTheme)} text-white shadow-md`
                                      : `${getSubtlePillBg(appTheme)}`
                                  }`}
                                >
                                  🔇 Mute / OFF
                                </button>
                              </div>
                            </div>

                            <div className="pt-2 border-t border-white/10 w-full">
                              <p className="text-[10px] text-slate-300 mb-1.5 font-semibold">Select Channel / Stream:</p>
                              <div className="max-h-52 overflow-y-auto space-y-2 pr-1 w-full">
                                {Object.entries(RADIO_STATIONS).map(([category, stations]) => (
                                  <div key={category} className="space-y-1 w-full">
                                    <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider block">{category}</span>
                                    {stations.map((station) => {
                                      const isSelected = (currentStationUrl === station.url) || (!currentStationUrl && bgAudio.getCurrentStation().url === station.url);
                                      return (
                                        <button
                                          key={station.url}
                                          type="button"
                                          onClick={() => handleStationSelect(station.url)}
                                          className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center justify-between ${
                                            isSelected
                                              ? `${getPrimaryBgColor(appTheme)} text-white shadow-md`
                                              : `${getSubtlePillBg(appTheme)}`
                                          }`}
                                        >
                                          <span className="truncate pr-1">{station.name}</span>
                                          {isSelected && <span className="text-[9px] shrink-0">▶ Active</span>}
                                        </button>
                                      );
                                    })}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 6. SECURITY & PIN MANAGEMENT ACCORDION */}
                    <div className="border-0 bg-transparent overflow-hidden w-full">
                      <button
                        type="button"
                        onClick={() => setActiveSidebarSection(activeSidebarSection === "pin" ? null : "pin")}
                        className="w-full flex items-center justify-between px-4 py-4 text-left text-xs font-bold text-white hover:bg-white/5 transition relative overflow-hidden"
                        style={{
                          backgroundImage: `url(${RABBIT_HEADER_PILL})`,
                          backgroundSize: "100% 100%",
                          backgroundRepeat: "no-repeat",
                          backgroundPosition: "center center",
                        }}
                      >
                        <span className="relative z-10 flex items-center gap-2">🔒 Profile, Age & PIN Settings</span>
                        <span className={`relative z-10 transform transition-transform ${activeSidebarSection === "pin" ? "rotate-180" : ""}`}>▼</span>
                      </button>
                      {activeSidebarSection === "pin" && (
                        <form
                          onSubmit={handleUnifiedProfileUpdate}
                          className="p-4 border-0 space-y-3 relative w-full opacity-75"
                          style={{
                            backgroundImage: `url(${RABBIT_PANEL_ALT})`,
                            backgroundSize: "100% 100%",
                            backgroundRepeat: "no-repeat",
                            backgroundPosition: "center center",
                          }}
                        >
                          <div className="relative z-10 space-y-3 w-full">
                            <div className="grid grid-cols-2 gap-2 w-full">
                              <div className="w-full">
                                <span className="block text-[10px] text-slate-300 mb-1">Name:</span>
                                <input
                                  type="text"
                                  maxLength={25}
                                  value={profileNameInput}
                                  onChange={(e) => setProfileNameInput(e.target.value)}
                                  className="w-full rounded-lg border border-white/10 bg-slate-800/80 px-2.5 py-1.5 text-xs text-white focus:outline-none"
                                />
                              </div>
                              <div className="w-full">
                                <span className="block text-[10px] text-slate-300 mb-1">Age:</span>
                                <input
                                  type="number"
                                  min={1}
                                  max={120}
                                  value={userAgeInput}
                                  onChange={(e) => setUserAgeInput(e.target.value)}
                                  className="w-full rounded-lg border border-white/10 bg-slate-800/80 px-2.5 py-1.5 text-xs text-white focus:outline-none"
                                />
                              </div>
                            </div>

                            <div className="w-full">
                              <span className="block text-[10px] text-slate-300 mb-1">Current 4-digit PIN (Required):</span>
                              <input
                                type="password"
                                inputMode="numeric"
                                maxLength={4}
                                placeholder="••••"
                                value={unifiedAgeCodeInput}
                                onChange={(e) => setUnifiedAgeCodeInput(e.target.value.replace(/\D/g, "").slice(0, 4))}
                                className="w-full rounded-lg border border-white/10 bg-slate-800/80 px-2.5 py-1.5 text-xs text-white focus:outline-none tracking-widest"
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/10 w-full">
                              <div className="w-full">
                                <span className="block text-[10px] text-slate-300 mb-1">New PIN (Opt):</span>
                                <input
                                  type="password"
                                  inputMode="numeric"
                                  maxLength={4}
                                  placeholder="••••"
                                  value={newPasscode}
                                  onChange={(e) => setNewPasscode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                                  className="w-full rounded-lg border border-white/10 bg-slate-800/80 px-2.5 py-1.5 text-xs text-white focus:outline-none tracking-widest"
                                />
                              </div>
                              <div className="w-full">
                                <span className="block text-[10px] text-slate-300 mb-1">Confirm PIN:</span>
                                <input
                                  type="password"
                                  inputMode="numeric"
                                  maxLength={4}
                                  placeholder="••••"
                                  value={confirmNewPasscode}
                                  onChange={(e) => setConfirmNewPasscode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                                  className="w-full rounded-lg border border-white/10 bg-slate-800/80 px-2.5 py-1.5 text-xs text-white focus:outline-none tracking-widest"
                                />
                              </div>
                            </div>

                            <button
                              type="submit"
                              className={`w-full py-2 rounded-lg ${getPrimaryBgColor(appTheme)} text-xs font-bold shadow transition`}
                            >
                              Save Profile & PIN Updates
                            </button>

                            {unifiedUpdateStatus && (
                              <p className={`text-[11px] font-bold text-center ${unifiedUpdateStatus.isError ? "text-red-400" : "text-emerald-400"}`}>
                                {unifiedUpdateStatus.text}
                              </p>
                            )}
                          </div>
                        </form>
                      )}
                    </div>

                    {/* 7. BACKUP & RESTORE ACCORDION */}
                    <div className="border-0 bg-transparent overflow-hidden w-full">
                      <button
                        type="button"
                        onClick={() => setActiveSidebarSection(activeSidebarSection === "backup" ? null : "backup")}
                        className="w-full flex items-center justify-between px-4 py-4 text-left text-xs font-bold text-white hover:bg-white/5 transition relative overflow-hidden"
                        style={{
                          backgroundImage: `url(${RABBIT_HEADER_PILL})`,
                          backgroundSize: "100% 100%",
                          backgroundRepeat: "no-repeat",
                          backgroundPosition: "center center",
                        }}
                      >
                        <span className="relative z-10 flex items-center gap-2">💾 Backup & Profile Data</span>
                        <span className={`relative z-10 transform transition-transform ${activeSidebarSection === "backup" ? "rotate-180" : ""}`}>▼</span>
                      </button>
                      {activeSidebarSection === "backup" && (
                        <div
                          className="p-4 border-0 space-y-2 relative w-full opacity-75"
                          style={{
                            backgroundImage: `url(${RABBIT_PANEL})`,
                            backgroundSize: "100% 100%",
                            backgroundRepeat: "no-repeat",
                            backgroundPosition: "center center",
                          }}
                        >
                          <div className="relative z-10 space-y-2 w-full">
                            <div className="flex gap-2 w-full">
                              <button
                                type="button"
                                onClick={handleSaveBackup}
                                className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition ${getSubtlePillBg(appTheme)}`}
                              >
                                💾 Export Backup
                              </button>
                              <label className={`flex-1 text-center cursor-pointer rounded-lg border px-3 py-2 text-xs font-semibold transition ${getSubtlePillBg(appTheme)}`}>
                                🔄 Restore
                                <input type="file" accept=".json" onChange={handleRestoreBackup} className="hidden" />
                              </label>
                            </div>
                            {backupStatus && (
                              <span className={`text-xs ${getPrimaryAccentColor(appTheme)} font-semibold block text-center`}>
                                {backupStatus}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 8. ACCESSIBILITY ACCORDION */}
                    <div className="border-0 bg-transparent overflow-hidden w-full">
                      <button
                        type="button"
                        onClick={() => setActiveSidebarSection(activeSidebarSection === "accessibility" ? null : "accessibility")}
                        className="w-full flex items-center justify-between px-4 py-4 text-left text-xs font-bold text-white hover:bg-white/5 transition relative overflow-hidden"
                        style={{
                          backgroundImage: `url(${RABBIT_HEADER_PILL})`,
                          backgroundSize: "100% 100%",
                          backgroundRepeat: "no-repeat",
                          backgroundPosition: "center center",
                        }}
                      >
                        <span className="relative z-10 flex items-center gap-2">♿ Accessibility Options</span>
                        <span className={`relative z-10 transform transition-transform ${activeSidebarSection === "accessibility" ? "rotate-180" : ""}`}>▼</span>
                      </button>
                      {activeSidebarSection === "accessibility" && (
                        <div
                          className="p-4 border-0 space-y-3 relative w-full opacity-75"
                          style={{
                            backgroundImage: `url(${RABBIT_PANEL_ALT})`,
                            backgroundSize: "100% 100%",
                            backgroundRepeat: "no-repeat",
                            backgroundPosition: "center center",
                          }}
                        >
                          <div className="relative z-10 space-y-3 w-full">
                            <div className="flex items-center justify-between w-full">
                              <div>
                                <p className="text-xs font-bold text-white">XL Mouse Pointer (3x)</p>
                                <p className="text-[10px] text-slate-300">Enlarges cursor for TVs/projectors.</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleMouseToggle(!helpfulMouse)}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                  helpfulMouse ? `${getPrimaryBgColor(appTheme).split(" ")[0]}` : "bg-slate-700"
                                }`}
                              >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${helpfulMouse ? "translate-x-6" : "translate-x-1"}`} />
                              </button>
                            </div>
                            <div className="flex items-center justify-between pt-2 border-t border-white/10 w-full">
                              <div>
                                <p className="text-xs font-bold text-white">Enlarged Action Buttons</p>
                                <p className="text-[10px] text-slate-300">Bigger icons & buttons.</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleLargeButtonsToggle(!largeButtons)}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                  largeButtons ? `${getPrimaryBgColor(appTheme).split(" ")[0]}` : "bg-slate-700"
                                }`}
                              >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${largeButtons ? "translate-x-6" : "translate-x-1"}`} />
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                  </div>

                  {/* ADMIN PANEL (IF ADMIN) */}
                  {isAdmin && (
                    <div className="mt-4 pt-4 border-t border-white/10 w-full">
                      <AdminPanel
                        appTheme={appTheme}
                        getPrimaryBgColor={getPrimaryBgColor}
                        getPrimaryAccentColor={getPrimaryAccentColor}
                      />
                    </div>
                  )}

                  {/* FEEDBACK & SUPPORT SECTION */}
                  <div className="mt-4 pt-4 border-t border-white/10 space-y-2 w-full">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Feedback & Support</h4>
                    <button
                      type="button"
                      onClick={() => setShowBugModal(true)}
                      className={`w-full py-2.5 rounded-xl text-xs font-bold transition ${getPrimaryBgColor(appTheme)} text-white shadow-md`}
                    >
                      🐞 Report a Bug / Issue
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowBugFeedModal(true)}
                      className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 transition border border-white/10 flex items-center justify-center gap-2"
                    >
                      📋 View Bug Reports Feed
                    </button>
                  </div>

                  {/* UPDATE CHANNEL & ACTIONS */}
                  <div className="mt-4 pt-4 border-t border-white/10 space-y-2 w-full">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Update Channel</h4>
                    <div className="grid grid-cols-2 gap-2 w-full">
                      <button
                        type="button"
                        onClick={() => handleUpdateChannelChange("stable")}
                        className={`py-2 rounded-lg text-xs font-bold transition w-full ${
                          updateChannel === "stable" ? `${getPrimaryBgColor(appTheme)} text-white` : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                        }`}
                      >
                        🛡️ Stable
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateChannelChange("nightly")}
                        className={`py-2 rounded-lg text-xs font-bold transition w-full ${
                          updateChannel === "nightly" ? `${getPrimaryBgColor(appTheme)} text-white` : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                        }`}
                      >
                        ⚡ Nightly
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => void checkForAppUpdates(false)}
                      className={`w-full py-2.5 rounded-xl text-xs font-bold transition ${getPrimaryBgColor(appTheme)} text-white shadow-md`}
                    >
                      🔍 Check for Updates Now
                    </button>
                  </div>

                  {/* LICENSE STATUS */}
                  <div className="mt-4 pt-4 border-t border-white/10 space-y-2 w-full">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">License Status</h4>
                    {isAdmin ? (
                      <p className="text-[11px] text-red-300 font-semibold bg-red-500/10 border border-red-500/30 p-2.5 rounded-lg">
                        🔐 Admin access active.
                      </p>
                    ) : isTrialActive ? (
                      <div className="space-y-2 w-full">
                        <p className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/30 p-2.5 rounded-lg leading-relaxed">
                          Trial: <strong>{trialDaysRemaining} {trialDaysRemaining === 1 ? "day" : "days"} remaining</strong>.
                        </p>
                        <form onSubmit={handleUpgradeFromProfile} className="space-y-1.5 w-full">
                          <input
                            type="password"
                            placeholder="Unlock code"
                            value={unlockCodeInput}
                            onChange={(e) => setUnlockCodeInput(e.target.value)}
                            className="w-full rounded-lg border border-white/10 bg-slate-800/80 px-2.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
                          />
                          <button
                            type="submit"
                            className={`w-full py-2 rounded-lg ${getPrimaryBgColor(appTheme)} text-xs font-bold shadow transition`}
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
                      <p className={`text-[11px] font-bold text-center ${unlockStatusMsg.isError ? "text-red-400" : "text-emerald-400"}`}>
                        {unlockStatusMsg.text}
                      </p>
                    )}
                  </div>

                  {/* Sidebar Footer with Divider Asset */}
                  <div className="mt-6 pt-4 border-t border-white/10 text-center w-full">
                    <img
                      src={RABBIT_DIVIDER}
                      alt=""
                      className="w-2/3 mx-auto h-2 object-contain opacity-70 mb-3"
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

          {/* USER NOTIFICATION LISTENER TOAST */}
          <UserNotifier appTheme={appTheme} />

          {/* BUG REPORT MODAL */}
          <BugReportModal
            isOpen={showBugModal}
            onClose={() => setShowBugModal(false)}
            userName={savedProfileName || "Friend"}
            userUnlockCode={typeof window !== "undefined" ? localStorage.getItem(AGE_LOCK_KEY) || "0000" : "0000"}
          />

          {/* PUBLIC COMMUNITY BUG FEED MODAL */}
          <PublicBugFeedModal
            isOpen={showBugFeedModal}
            onClose={() => setShowBugFeedModal(false)}
          />

          {/* FIRST-START ACTIVATION MODAL CALL */}
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
