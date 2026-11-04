// src/routes/__root.tsx
import { Outlet, createRootRoute, HeadContent, Scripts, Link, useNavigate } from "@tanstack/react-router";
import { AuthProvider } from "@/components/auth-provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { HolidayOverlay } from "@/components/HolidayOverlay";
import { AppWallpaper } from "@/components/AppWallpaper";
import { ActivationModal } from "@/components/ActivationModal";
import { AdminPanel } from "@/components/AdminPanel";
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

  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const lastScrollYRef = useRef(0);
  const [activeSettingsTab, setActiveSettingsTab] = useState<
    "theme" | "scale" | "backup" | null
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
    localStorage.setItem("rabtv_update_channel", channel);
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
    localStorage.setItem("rabtv_global_feed", feed);
    window.dispatchEvent(
      new CustomEvent("rabtv_global_feed_updated", { detail: feed })
    );
  };

  const handleHeaderSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate({ to: "/search", search: { q: headerSearchInput.trim() } });
    setHeaderSearchInput("");
  };

  const handleCloseAll = () => {
    setShowProfileMenu(false);
    setActiveSettingsTab(null);
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
    window.open(url, "_blank");
  };
  
  const handleToggleProfileMenu = () => {
    if (showProfileMenu) handleCloseAll();
    else {
      handleCloseAll();
      lastScrollYRef.current = window.scrollY;
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

  useEffect(() => {
    const handleWindowScroll = () => {
      if (showProfileMenu) {
        if (Math.abs(window.scrollY - lastScrollYRef.current) > 60) {
          handleCloseAll();
        }
      }
    };
    window.addEventListener("scroll", handleWindowScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleWindowScroll);
  }, [showProfileMenu]);

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

  const getAgeLockCode = () => localStorage.getItem(AGE_LOCK_KEY) || "";

  const handleUpgradeFromProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const name =
      savedProfileName ||
      localStorage.getItem("rabtv_profile_name") ||
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
      localStorage.setItem("rabtv_access_status", "permanent");
      localStorage.removeItem("rabtv_trial_start_timestamp");
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
        window.dispatchEvent(new Event("rabtv_settings_updated"));
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
    window.dispatchEvent(new Event("rabtv_settings_updated"));
  };

  const handleThemeChange = (newTheme: AppTheme) => {
    saveTheme(newTheme);
    setAppTheme(newTheme);
    void updateNativeStatusBar(newTheme);
    window.dispatchEvent(new Event("rabtv_settings_updated"));
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
      localStorage.setItem(AGE_LOCK_KEY, trimmedNew);
    }

    saveUserAge(parsedAge);
    const finalName = profileNameInput.trim() || "Friend";
    localStorage.setItem("rabtv_profile_name", finalName);
    setSavedProfileName(finalName);

    setUnifiedUpdateStatus({ text: "✓ Profile and age-lock updated successfully!", isError: false });
    setUnifiedAgeCodeInput("");
    setNewPasscode("");
    setConfirmNewPasscode("");
    setTimeout(() => setUnifiedUpdateStatus(null), 3500);
    window.dispatchEvent(new Event("rabtv_settings_updated"));
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
      myList: localStorage.getItem("rabtv_my_list"),
      favorites: localStorage.getItem("rabtv_favorites"),
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
        if (data.profileName) {
          localStorage.setItem("rabtv_profile_name", data.profileName);
          setSavedProfileName(data.profileName);
        }
        if (data.myList) localStorage.setItem("rabtv_my_list", data.myList);
        if (data.favorites)
          localStorage.setItem("rabtv_favorites", data.favorites);

        localStorage.removeItem(DISCLAIMER_ACCEPTED_KEY);
        localStorage.removeItem("rabtv_access_status");
        localStorage.removeItem("rabtv_is_admin");
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
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-bold text-white shadow-sm transition cursor-pointer"
                    >
                      <span>
                        👋 Hi,{" "}
                        <strong className="text-white">{savedProfileName}</strong>{" "}
                        {isAdmin
                          ? "(Admin)"
                          : isTrialActive
                          ? `(Trial: ${trialDaysRemaining}d)`
                          : "(Full)"}
                      </span>
                      <span className="text-[10px] ml-1 text-slate-300">▼</span>
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

                  <div className="relative shrink-0">
                    <div
                      className={`flex h-9 sm:h-10 items-center justify-center rounded-xl border px-3 text-[11px] sm:text-xs font-bold shadow-sm transition focus-within:ring-2 ${activeHeader.btnBg} gap-1 relative pointer-events-auto`}
                    >
                      <span className="whitespace-nowrap pointer-events-none truncate max-w-[90px] sm:max-w-none">
                        🌐{" "}
                        {selectedGlobalFeed === "All (Default)"
                          ? "Global"
                          : selectedGlobalFeed}
                      </span>
                      <span className="text-[9px] pointer-events-none">▼</span>
                      <select
                        value={selectedGlobalFeed}
                        onChange={(e) =>
                          handleGlobalFeedChange(
                            e.target.value as GlobalFeedOption
                          )
                        }
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

                  <Link
                    to="/watch-history"
                    className={`flex h-9 sm:h-10 items-center justify-center rounded-xl border px-3 text-[11px] sm:text-xs font-bold shadow-sm transition focus:outline-none focus:ring-2 shrink-0 ${activeHeader.btnBg}`}
                  >
                    🕒 History
                  </Link>
                </div>
              )}
            </div>
          </header>

          {/* PROFILE & SETTINGS MENU */}
          {showProfileMenu && !showFirstStartModal && (
            <div
              className={`fixed top-16 right-3 sm:right-6 z-50 w-96 max-w-[94vw] rounded-2xl border ${getCardBackground(appTheme)} px-4 py-4 backdrop-blur-2xl shadow-2xl max-h-[85vh] overflow-y-auto box-border`}
            >
              <div className="mx-auto flex flex-col gap-4 box-border">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <h3
                    className={`text-sm font-black uppercase tracking-wider ${getPrimaryAccentColor(appTheme)}`}
                  >
                    👤 Profile & Settings
                  </h3>
                  <button
                    type="button"
                    onClick={handleCloseAll}
                    className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-white/5"
                  >
                    ✕ Close
                  </button>
                </div>

                {/* APP SETTINGS TABS & CONTROLS */}
                <div className="space-y-3 bg-black/25 p-3.5 rounded-xl border border-white/10 box-border backdrop-blur-md">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                    ⚙️ App Customization
                  </h4>
                  <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
                    {(["theme", "scale", "backup"] as const).map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() =>
                          setActiveSettingsTab(
                            activeSettingsTab === tab ? null : tab
                          )
                        }
                        className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition shrink-0 capitalize ${
                          activeSettingsTab === tab
                            ? `${getPrimaryBgColor(appTheme)} text-white shadow-md`
                            : `${getSubtlePillBg(appTheme)}`
                        }`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>

                  {activeSettingsTab === "theme" && (
                    <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                      {allThemesList.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => handleThemeChange(t.id)}
                          className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${
                            appTheme === t.id
                              ? `${getPrimaryBgColor(t.id)} text-white shadow-md`
                              : `${getSubtlePillBg(appTheme)}`
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {activeSettingsTab === "scale" && (
                    <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                      {(["small", "medium", "large"] as CardSize[]).map(
                        (size) => (
                          <button
                            key={size}
                            type="button"
                            onClick={() => handleSizeChange(size)}
                            className={`rounded-lg px-3 py-1.5 text-xs font-bold capitalize transition ${
                              cardSize === size
                                ? `${getPrimaryBgColor(appTheme)} text-white shadow-md`
                                : `${getSubtlePillBg(appTheme)}`
                            }`}
                          >
                            {size}{" "}
                            {size === "small"
                              ? "(25%)"
                              : size === "medium"
                              ? "(60%)"
                              : "(100%)"}
                          </button>
                        )
                      )}
                    </div>
                  )}

                  {activeSettingsTab === "backup" && (
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-2 w-full pt-2">
                      <button
                        type="button"
                        onClick={handleSaveBackup}
                        className={`w-full sm:w-auto rounded-lg border px-3 py-2 text-xs font-semibold transition ${getSubtlePillBg(appTheme)}`}
                      >
                        💾 Export Backup
                      </button>
                      <label
                        className={`w-full sm:w-auto text-center cursor-pointer rounded-lg border px-3 py-2 text-xs font-semibold transition ${getSubtlePillBg(appTheme)}`}
                      >
                        🔄 Restore Backup
                        <input
                          type="file"
                          accept=".json"
                          onChange={handleRestoreBackup}
                          className="hidden"
                        />
                      </label>
                      {backupStatus && (
                        <span
                          className={`text-xs ${getPrimaryAccentColor(appTheme)} font-semibold text-center w-full`}
                        >
                          {backupStatus}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {isAdmin && (
                  <AdminPanel
                    appTheme={appTheme}
                    getPrimaryBgColor={getPrimaryBgColor}
                    getPrimaryAccentColor={getPrimaryAccentColor}
                  />
                )}

                {/* Update Channel Preference & Manual Check Button */}
                <div className="space-y-3 bg-black/25 p-3.5 rounded-xl border border-white/10 box-border backdrop-blur-md">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                    🚀 Update Channel & Actions
                  </h4>
                  <p className="text-[10px] text-slate-300 leading-relaxed">
                    Choose whether you want stable releases or bleeding-edge nightly builds.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleUpdateChannelChange("stable")}
                      className={`py-2 rounded-xl text-xs font-bold transition ${
                        updateChannel === "stable"
                          ? `${getPrimaryBgColor(appTheme)} text-white shadow-md`
                          : "bg-slate-800/80 text-slate-300 hover:bg-slate-700"
                      }`}
                    >
                      🛡️ Stable
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateChannelChange("nightly")}
                      className={`py-2 rounded-xl text-xs font-bold transition ${
                        updateChannel === "nightly"
                          ? `${getPrimaryBgColor(appTheme)} text-white shadow-md`
                          : "bg-slate-800/80 text-slate-300 hover:bg-slate-700"
                      }`}
                    >
                      ⚡ Nightly
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      void checkForAppUpdates(false);
                    }}
                    className={`w-full mt-2 py-2.5 rounded-xl text-xs font-bold transition ${getPrimaryBgColor(appTheme)} text-white shadow-md`}
                  >
                    🔍 Check for Updates Now
                  </button>
                </div>

                <div className="space-y-3 bg-black/25 p-3.5 rounded-xl border border-white/10 box-border backdrop-blur-md">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                    License Status
                  </h4>
                  {isAdmin ? (
                    <p className="text-[11px] text-red-300 font-semibold bg-red-500/10 border border-red-500/30 p-2.5 rounded-lg">
                      🔐 Admin access active.
                    </p>
                  ) : isTrialActive ? (
                    <div className="space-y-3">
                      <p className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/30 p-2.5 rounded-lg leading-relaxed">
                        Trial:{" "}
                        <strong>
                          {trialDaysRemaining}{" "}
                          {trialDaysRemaining === 1 ? "day" : "days"} remaining
                        </strong>
                        .
                      </p>
                      <form
                        onSubmit={handleUpgradeFromProfile}
                        className="space-y-2"
                      >
                        <label className="block text-[10px] uppercase font-semibold text-slate-300">
                          Enter Full Unlock Code:
                        </label>
                        <input
                          type="password"
                          placeholder="Unlock code"
                          value={unlockCodeInput}
                          onChange={(e) => setUnlockCodeInput(e.target.value)}
                          className="w-full rounded-xl border border-white/10 bg-slate-800/80 px-3 py-2 text-xs font-bold text-white placeholder-slate-500 focus:outline-none"
                        />
                        <button
                          type="submit"
                          className={`w-full py-2 rounded-xl ${getPrimaryBgColor(appTheme)} text-xs font-bold shadow transition`}
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
                        unlockStatusMsg.isError
                          ? "text-red-400"
                          : "text-emerald-400"
                      }`}
                    >
                      {unlockStatusMsg.text}
                    </p>
                  )}
                </div>

                {/* UNIFIED PROFILE, AGE & PASSCODE CHANGE SECTION */}
                <div className="space-y-3 bg-black/25 p-3.5 rounded-xl border border-white/10 box-border backdrop-blur-md">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                    👤 Profile Name, Age & Age-Lock PIN
                  </h4>
                  <p className="text-[10px] text-slate-300">
                    Update your profile details and/or change your 4-digit age-lock passcode.
                  </p>

                  <form onSubmit={handleUnifiedProfileUpdate} className="space-y-2.5 box-border">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <span className="block text-[11px] text-slate-300 mb-1">Name:</span>
                        <input
                          type="text"
                          maxLength={25}
                          value={profileNameInput}
                          onChange={(e) => setProfileNameInput(e.target.value)}
                          placeholder="Your Name"
                          className="w-full rounded-xl border border-white/10 bg-slate-800/80 px-3 py-2 text-xs font-bold text-white focus:outline-none box-border"
                        />
                      </div>
                      <div>
                        <span className="block text-[11px] text-slate-300 mb-1">Age:</span>
                        <input
                          type="number"
                          min={1}
                          max={120}
                          value={userAgeInput}
                          onChange={(e) => setUserAgeInput(e.target.value)}
                          className="w-full rounded-xl border border-white/10 bg-slate-800/80 px-3 py-2 text-xs font-bold text-white focus:outline-none box-border"
                        />
                      </div>
                    </div>

                    <div>
                      <span className="block text-[11px] text-slate-300 mb-1">Current 4-digit PIN (Required to save):</span>
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
                        className="w-full rounded-xl border border-white/10 bg-slate-800/80 px-3 py-2 text-xs font-bold text-white focus:outline-none box-border tracking-widest"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 border-t border-white/10">
                      <div>
                        <span className="block text-[11px] text-slate-300 mb-1">New PIN (Optional):</span>
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
                          className="w-full rounded-xl border border-white/10 bg-slate-800/80 px-3 py-2 text-xs font-bold text-white focus:outline-none box-border tracking-widest"
                        />
                      </div>
                      <div>
                        <span className="block text-[11px] text-slate-300 mb-1">Confirm New PIN:</span>
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
                          className="w-full rounded-xl border border-white/10 bg-slate-800/80 px-3 py-2 text-xs font-bold text-white focus:outline-none box-border tracking-widest"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className={`w-full mt-2 py-2 rounded-xl ${getPrimaryBgColor(appTheme)} text-xs font-bold shadow transition box-border`}
                    >
                      Save Profile & PIN Updates
                    </button>

                    {unifiedUpdateStatus && (
                      <p
                        className={`text-[11px] font-bold mt-1 text-center ${
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

                {/* Accessibility */}
                <div className="space-y-3 bg-black/25 p-3.5 rounded-xl border border-white/10 box-border backdrop-blur-md">
                  <span className="text-xs font-bold text-slate-200 uppercase tracking-wider block">
                    Accessibility
                  </span>
                  <div className="flex items-center justify-between gap-3">
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
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${
                        helpfulMouse
                          ? `${getPrimaryBgColor(appTheme).split(" ")[0]} bg-opacity-100`
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
                  <div className="flex flex-col gap-2 pt-2 border-t border-white/10">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-xs font-bold text-white">
                          History Page Overscale
                        </p>
                        <p className="text-[10px] text-slate-300">
                          Card size on history page.
                        </p>
                      </div>
                      <span className="text-xs font-bold text-violet-400">
                        {historyOverscale === "off"
                          ? "Off"
                          : `+${historyOverscale}`}
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {(["off", "20%", "50%", "80%"] as HistoryScale[]).map(
                        (scale) => (
                          <button
                            key={scale}
                            type="button"
                            onClick={() =>
                              handleHistoryOverscaleChange(scale)
                            }
                            className={`rounded-lg py-1.5 text-xs font-bold capitalize transition ${
                              historyOverscale === scale
                                ? `${getPrimaryBgColor(appTheme)} text-white shadow-md`
                                : `${getSubtlePillBg(appTheme)}`
                            }`}
                          >
                            {scale === "off" ? "Off" : `+${scale}`}
                          </button>
                        )
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/10">
                    <div>
                      <p className="text-xs font-bold text-white">
                        Enlarged Action Buttons
                      </p>
                      <p className="text-[10px] text-slate-300">
                        Bigger eye / thumb / X buttons.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleLargeButtonsToggle(!largeButtons)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${
                        largeButtons
                          ? `${getPrimaryBgColor(appTheme).split(" ")[0]} bg-opacity-100`
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
              </div>
            </div>
          )}

          <main className="mx-auto max-w-7xl px-4 py-4 sm:px-6 md:py-6 overflow-x-hidden pb-20">
            <Outlet />
          </main>

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
