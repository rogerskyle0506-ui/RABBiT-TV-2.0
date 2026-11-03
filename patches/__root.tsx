// patches/__root.tsx
import { Outlet, createRootRoute, HeadContent, Scripts, Link, useNavigate } from "@tanstack/react-router";
import { AuthProvider } from "@/components/auth-provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { HolidayOverlay } from "@/components/HolidayOverlay";
import { AppWallpaper } from "@/components/AppWallpaper";
import "@/styles.css";
import { useState, useEffect, useRef } from "react";
import { StatusBar, Style } from "@capacitor/status-bar";
import { sendPermanentActivationAlert } from "@/lib/report";
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

// ——— Unlock algorithm (name + age → 8-digit code) ———
function generateUnlockCode(name: string, age: number): string {
  const clean = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  if (!clean || !age || age < 1 || age > 120) return "";

  let sum = age * 17;
  for (let i = 0; i < clean.length; i++) {
    sum += clean.charCodeAt(i) * (i + 7);
  }
  const mixed = (sum * 7919 + age * 997) % 90000000;
  return String(mixed + 10000000);
}

const ADMIN_NAME = "Rabbit";
const ADMIN_BIRTH_YEAR = 1988;

function getExpectedAdminAge(): number {
  return new Date().getFullYear() - ADMIN_BIRTH_YEAR;
}

function isAdminCredentials(name: string, age: number): boolean {
  return name.trim() === ADMIN_NAME && age === getExpectedAdminAge();
}

const TRIAL_CODE = "9654";
const TRIAL_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
const AGE_LOCK_KEY = "rabtv_age_passcode";

const globalFeedOptions = [
  "All (Default)",
  "Canada (All)",
  "Ontario / Toronto",
  "Atlantic Canada",
  "Western Canada",
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
  const [passcodeInput, setPasscodeInput] = useState("");
  const [passcodeError, setPasscodeError] = useState(false);
  const [passcodeErrorMsg, setPasscodeErrorMsg] = useState(
    "⚠️ Invalid Passcode. Please try again. WhatsApp: RabbitProductions | Private #: (705) 809-3865"
  );
  const [ageErrorNotice, setAgeErrorNotice] = useState(false);
  const [ageLockError, setAgeLockError] = useState(false);

  const [ageLockInput, setAgeLockInput] = useState("");

  const [showSettings, setShowSettings] = useState(false);
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
  const [settingsAgeCodeInput, setSettingsAgeCodeInput] = useState<string>("");
  const [settingsAgeError, setSettingsAgeError] = useState(false);
  const [settingsAgeSuccess, setSettingsAgeSuccess] = useState(false);

  const [unlockCodeInput, setUnlockCodeInput] = useState("");
  const [unlockStatusMsg, setUnlockStatusMsg] = useState<{
    text: string;
    isError: boolean;
  } | null>(null);
  const [isTrialActive, setIsTrialActive] = useState(false);
  const [trialDaysRemaining, setTrialDaysRemaining] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);

  const [keygenName, setKeygenName] = useState("");
  const [keygenAge, setKeygenAge] = useState("");
  const [keygenResult, setKeygenResult] = useState<string | null>(null);

  const [currentPasscodeInput, setCurrentPasscodeInput] = useState("");
  const [newPasscode, setNewPasscode] = useState("");
  const [confirmNewPasscode, setConfirmNewPasscode] = useState("");
  const [passcodeStatusMsg, setPasscodeStatusMsg] = useState<{
    text: string;
    isError: boolean;
  } | null>(null);

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
    setShowSettings(false);
    setShowProfileMenu(false);
    setActiveSettingsTab(null);
  };

  const handleToggleSettings = () => {
    if (showSettings) handleCloseAll();
    else {
      handleCloseAll();
      lastScrollYRef.current = window.scrollY;
      setShowSettings(true);
      setActiveSettingsTab(null);
    }
  };

  const handleToggleProfileMenu = () => {
    if (showProfileMenu) handleCloseAll();
    else {
      handleCloseAll();
      lastScrollYRef.current = window.scrollY;
      setShowProfileMenu(true);
    }
  };

  useEffect(() => {
    const handleWindowScroll = () => {
      if (showSettings || showProfileMenu) {
        if (Math.abs(window.scrollY - lastScrollYRef.current) > 60) {
          handleCloseAll();
        }
      }
    };
    window.addEventListener("scroll", handleWindowScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleWindowScroll);
  }, [showSettings, showProfileMenu]);

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

  const saveAgeLockCode = (code: string) => {
    localStorage.setItem(AGE_LOCK_KEY, code);
  };

  const getAgeLockCode = () => localStorage.getItem(AGE_LOCK_KEY) || "";

  const completePermanentLogin = (
    finalName: string,
    parsedAge: number,
    ageLockCode: string,
    options?: { admin?: boolean; forceTheme?: AppTheme; forceSize?: CardSize }
  ) => {
    localStorage.setItem(DISCLAIMER_ACCEPTED_KEY, "true");
    localStorage.setItem("rabtv_access_status", "permanent");
    localStorage.removeItem("rabtv_trial_start_timestamp");
    setIsTrialActive(false);

    saveAgeLockCode(ageLockCode);

    if (options?.admin) {
      localStorage.setItem("rabtv_is_admin", "true");
      setIsAdmin(true);
    } else {
      localStorage.removeItem("rabtv_is_admin");
      setIsAdmin(false);
    }

    const themeToUse = options?.forceTheme ?? appTheme;
    const sizeToUse = options?.forceSize ?? cardSize;

    saveCardSize(sizeToUse);
    setCardSize(sizeToUse);
    saveStreamQuality(streamQuality);
    saveTheme(themeToUse);
    setAppTheme(themeToUse);
    void updateNativeStatusBar(themeToUse);
    setHelpfulMouse(helpfulMouse);

    saveUserAge(parsedAge);
    localStorage.setItem("rabtv_profile_name", finalName);
    setSavedProfileName(finalName);

    if (!options?.admin) {
      sendPermanentActivationAlert(finalName);
    }

    setShowFirstStartModal(false);
    setPasscodeError(false);
    setAgeErrorNotice(false);
    setAgeLockError(false);
    window.dispatchEvent(new Event("rabtv_settings_updated"));
  };

  const handleFirstTimeAuthorize = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedAge = userAgeInput.trim();
    if (!trimmedAge || isNaN(parseInt(trimmedAge, 10))) {
      setAgeErrorNotice(true);
      setPasscodeError(false);
      setAgeLockError(false);
      return;
    }

    const ageLock = ageLockInput.trim();
    if (!/^\d{4}$/.test(ageLock)) {
      setAgeLockError(true);
      setAgeErrorNotice(false);
      setPasscodeError(false);
      return;
    }

    const parsedAge = parseInt(trimmedAge, 10);
    const finalName = profileNameInput.trim() || "Friend";
    const enteredCode = passcodeInput.trim();

    if (isAdminCredentials(finalName, parsedAge)) {
      completePermanentLogin(finalName, parsedAge, ageLock, {
        admin: true,
        forceTheme: "red",
        forceSize: "small",
      });
      return;
    }

    if (enteredCode === TRIAL_CODE) {
      const trialAlreadyUsed =
        localStorage.getItem("rabtv_trial_used_flag") === "true";
      if (trialAlreadyUsed) {
        setPasscodeError(true);
        setPasscodeErrorMsg(
          "⚠️ Trial code has already been used on this device and cannot be redeemed again. WhatsApp: RabbitProductions | Private #: (705) 809-3865"
        );
        setAgeErrorNotice(false);
        setAgeLockError(false);
        setPasscodeInput("");
        return;
      }

      localStorage.setItem(DISCLAIMER_ACCEPTED_KEY, "true");
      localStorage.setItem("rabtv_access_status", "trial");
      localStorage.setItem("rabtv_trial_start_timestamp", String(Date.now()));
      localStorage.setItem("rabtv_trial_used_flag", "true");
      localStorage.removeItem("rabtv_is_admin");
      setIsAdmin(false);
      setIsTrialActive(true);
      setTrialDaysRemaining(7);

      saveAgeLockCode(ageLock);
      saveCardSize(cardSize);
      saveStreamQuality(streamQuality);
      saveTheme(appTheme);
      setHelpfulMouse(helpfulMouse);
      saveUserAge(parsedAge);
      localStorage.setItem("rabtv_profile_name", finalName);
      setSavedProfileName(finalName);

      setShowFirstStartModal(false);
      setPasscodeError(false);
      setAgeErrorNotice(false);
      setAgeLockError(false);
      window.dispatchEvent(new Event("rabtv_settings_updated"));
      return;
    }

    const expectedCode = generateUnlockCode(finalName, parsedAge);
    if (expectedCode && enteredCode === expectedCode) {
      completePermanentLogin(finalName, parsedAge, ageLock);
      return;
    }

    setPasscodeError(true);
    setPasscodeErrorMsg(
      "⚠️ Invalid Passcode for this name and age. WhatsApp: RabbitProductions | Private #: (705) 809-3865"
    );
    setAgeErrorNotice(false);
    setAgeLockError(false);
    setPasscodeInput("");
  };

  const handleUpgradeFromProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const name =
      savedProfileName ||
      localStorage.getItem("rabtv_profile_name") ||
      "Friend";
    const age = getSavedUserAge() || parseInt(userAgeInput, 10) || 0;
    const expected = generateUnlockCode(name, age);

    if (unlockCodeInput.trim() === expected && expected) {
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

  const handleKeygen = (e: React.FormEvent) => {
    e.preventDefault();
    const age = parseInt(keygenAge.trim(), 10);
    const code = generateUnlockCode(keygenName, age);
    if (!code) {
      setKeygenResult("Enter a valid name and age (1–120).");
      return;
    }
    setKeygenResult(code);
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

  const handleUpdateAgeInSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const locked = getAgeLockCode();
    if (!locked || settingsAgeCodeInput.trim() !== locked) {
      setSettingsAgeError(true);
      setSettingsAgeCodeInput("");
      return;
    }
    const parsedAge = parseInt(userAgeInput, 10);
    if (isNaN(parsedAge) || parsedAge < 1 || parsedAge > 120) {
      setSettingsAgeError(true);
      return;
    }
    saveUserAge(parsedAge);
    setSettingsAgeError(false);
    setSettingsAgeSuccess(true);
    setSettingsAgeCodeInput("");
    setTimeout(() => setSettingsAgeSuccess(false), 3000);
    window.dispatchEvent(new Event("rabtv_settings_updated"));
  };

  const handleChangePasscodeInSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const locked = getAgeLockCode();
    if (currentPasscodeInput.trim() !== locked) {
      setPasscodeStatusMsg({
        text: "Current age-lock code is incorrect.",
        isError: true,
      });
      return;
    }
    if (!/^\d{4}$/.test(newPasscode.trim())) {
      setPasscodeStatusMsg({
        text: "New age-lock code must be exactly 4 digits.",
        isError: true,
      });
      return;
    }
    if (newPasscode !== confirmNewPasscode) {
      setPasscodeStatusMsg({
        text: "New codes do not match.",
        isError: true,
      });
      return;
    }
    saveAgeLockCode(newPasscode.trim());
    setPasscodeStatusMsg({
      text: "Age-lock code updated successfully!",
      isError: false,
    });
    setCurrentPasscodeInput("");
    setNewPasscode("");
    setConfirmNewPasscode("");
    setTimeout(() => setPasscodeStatusMsg(null), 3000);
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

                  <button
                    type="button"
                    onClick={handleToggleSettings}
                    className={`flex h-9 sm:h-10 w-9 sm:w-10 items-center justify-center rounded-xl border text-base sm:text-lg shadow-sm transition focus:outline-none focus:ring-2 shrink-0 ${activeHeader.btnBg}`}
                    aria-label="Settings"
                  >
                    ⚙️
                  </button>
                </div>
              )}
            </div>
          </header>

          {/* PROFILE MENU */}
          {showProfileMenu && !showFirstStartModal && (
            <div
              className={`fixed top-16 right-3 sm:right-6 z-50 w-96 max-w-[94vw] rounded-2xl border ${getCardBackground(appTheme)} px-4 py-4 backdrop-blur-2xl shadow-2xl max-h-[85vh] overflow-y-auto box-border`}
            >
              <div className="mx-auto flex flex-col gap-4 box-border">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <h3
                    className={`text-sm font-black uppercase tracking-wider ${getPrimaryAccentColor(appTheme)}`}
                  >
                    👤 Personal Profile & License
                  </h3>
                  <button
                    type="button"
                    onClick={handleCloseAll}
                    className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-white/5"
                  >
                    ✕ Close
                  </button>
                </div>

                {isAdmin && (
                  <div className="space-y-3 bg-red-950/40 p-3.5 rounded-xl border border-red-500/30 box-border backdrop-blur-md">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-red-300">
                      🔑 Admin Key Generator
                    </h4>
                    <p className="text-[10px] text-slate-300 leading-relaxed">
                      Enter a user’s display name and age. The generated code
                      unlocks full access for that exact name + age pair.
                    </p>
                    <form onSubmit={handleKeygen} className="space-y-2">
                      <input
                        type="text"
                        placeholder="User name"
                        value={keygenName}
                        onChange={(e) => setKeygenName(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-slate-800/80 px-3 py-2 text-xs font-bold text-white placeholder-slate-500 focus:outline-none"
                      />
                      <input
                        type="number"
                        min={1}
                        max={120}
                        placeholder="User age"
                        value={keygenAge}
                        onChange={(e) => setKeygenAge(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-slate-800/80 px-3 py-2 text-xs font-bold text-white placeholder-slate-500 focus:outline-none"
                      />
                      <button
                        type="submit"
                        className="w-full py-2 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-bold text-white shadow transition"
                      >
                        Generate Unlock Code
                      </button>
                    </form>
                    {keygenResult && (
                      <div className="rounded-lg bg-black/60 border border-red-400/30 p-3 text-center backdrop-blur-md">
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">
                          Unlock code
                        </p>
                        <p className="text-lg font-black tracking-widest text-red-300 select-all">
                          {keygenResult}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Catalog Language & Region Preference */}
                <div className="space-y-3 bg-black/25 p-3.5 rounded-xl border border-white/10 box-border backdrop-blur-md">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                    🌐 Catalog Language & Region
                  </h4>
                  <p className="text-[10px] text-slate-300 leading-relaxed">
                    Set your preferred regional feed or language to directly customize your stream catalog.
                  </p>
                  <select
                    value={selectedGlobalFeed}
                    onChange={(e) => handleGlobalFeedChange(e.target.value as GlobalFeedOption)}
                    className="w-full rounded-xl border border-white/10 bg-slate-800/80 px-3 py-2 text-xs font-bold text-white focus:outline-none"
                  >
                    {globalFeedOptions.map((opt) => (
                      <option key={opt} value={opt} className="bg-slate-900 text-white">
                        🌐 {opt}
                      </option>
                    ))}
                  </select>
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
                          placeholder="Unlock code for your name + age"
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

                {/* Age lock – change age only with 4-digit PIN */}
                <div className="space-y-3 bg-black/25 p-3.5 rounded-xl border border-white/10 box-border backdrop-blur-md">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                    Age Lock
                  </h4>
                  <p className="text-[10px] text-slate-300">
                    Age is locked with the 4-digit code set at first login.
                    Enter that code to update age.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <span className="block text-[11px] text-slate-300 mb-1">
                        Name:
                      </span>
                      <input
                        type="text"
                        maxLength={20}
                        value={profileNameInput}
                        onChange={(e) => {
                          const val = e.target.value;
                          setProfileNameInput(val);
                          localStorage.setItem(
                            "rabtv_profile_name",
                            val.trim()
                          );
                          setSavedProfileName(val.trim());
                        }}
                        placeholder="Your Name"
                        className="w-full rounded-xl border border-white/10 bg-slate-800/80 px-3 py-2 text-xs font-bold text-white focus:outline-none box-border"
                      />
                    </div>
                    <div>
                      <span className="block text-[11px] text-slate-300 mb-1">
                        Age:
                      </span>
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

                  <form
                    onSubmit={handleUpdateAgeInSettings}
                    className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2 pt-1 w-full box-border"
                  >
                    <div className="flex-1">
                      <span className="block text-[11px] text-slate-300 mb-1">
                        Age-lock code (4 digits):
                      </span>
                      <input
                        type="password"
                        inputMode="numeric"
                        maxLength={4}
                        placeholder="••••"
                        value={settingsAgeCodeInput}
                        onChange={(e) =>
                          setSettingsAgeCodeInput(
                            e.target.value.replace(/\D/g, "").slice(0, 4)
                          )
                        }
                        className="w-full rounded-xl border border-white/10 bg-slate-800/80 px-3 py-2 text-xs font-bold text-white focus:outline-none box-border tracking-widest"
                      />
                    </div>
                    <button
                      type="submit"
                      className={`w-full sm:w-auto px-4 py-2 rounded-xl ${getPrimaryBgColor(appTheme)} text-xs font-bold whitespace-nowrap shadow transition shrink-0 box-border`}
                    >
                      Update Age
                    </button>
                  </form>

                  {settingsAgeError && (
                    <span className="text-[11px] font-semibold text-red-400 text-center block">
                      ⚠️ Wrong age-lock code or invalid age
                    </span>
                  )}
                  {settingsAgeSuccess && (
                    <span className="text-[11px] font-semibold text-emerald-400 text-center block">
                      ✓ Age updated!
                    </span>
                  )}
                </div>

                {/* Change age-lock PIN */}
                <div className="space-y-3 bg-black/25 p-3.5 rounded-xl border border-white/10 box-border backdrop-blur-md">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                    Change Age-Lock Code
                  </h4>
                  <form
                    onSubmit={handleChangePasscodeInSettings}
                    className="space-y-2.5 box-border"
                  >
                    <div>
                      <span className="block text-[11px] text-slate-300 mb-1">
                        Current 4-digit code:
                      </span>
                      <input
                        type="password"
                        inputMode="numeric"
                        maxLength={4}
                        placeholder="••••"
                        value={currentPasscodeInput}
                        onChange={(e) =>
                          setCurrentPasscodeInput(
                            e.target.value.replace(/\D/g, "").slice(0, 4)
                          )
                        }
                        className="w-full rounded-xl border border-white/10 bg-slate-800/80 px-3 py-2 text-xs font-bold text-white focus:outline-none box-border tracking-widest"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <span className="block text-[11px] text-slate-300 mb-1">
                          New code:
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
                          className="w-full rounded-xl border border-white/10 bg-slate-800/80 px-3 py-2 text-xs font-bold text-white focus:outline-none box-border tracking-widest"
                        />
                      </div>
                      <div>
                        <span className="block text-[11px] text-slate-300 mb-1">
                          Confirm:
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
                          className="w-full rounded-xl border border-white/10 bg-slate-800/80 px-3 py-2 text-xs font-bold text-white focus:outline-none box-border tracking-widest"
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      className="w-full mt-1 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-bold text-white transition box-border"
                    >
                      Update Age-Lock Code
                    </button>
                    {passcodeStatusMsg && (
                      <p
                        className={`text-[11px] font-bold mt-1 text-center ${
                          passcodeStatusMsg.isError
                            ? "text-red-400"
                            : "text-emerald-400"
                        }`}
                      >
                        {passcodeStatusMsg.text}
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

          {/* SETTINGS */}
          {showSettings && !showFirstStartModal && (
            <div
              className={`fixed top-16 right-3 sm:right-6 z-50 w-96 max-w-[94vw] rounded-2xl border ${getCardBackground(appTheme)} px-4 py-4 backdrop-blur-2xl shadow-2xl max-h-[80vh] overflow-y-auto`}
            >
              <div className="mx-auto flex flex-col items-center gap-3">
                <div className="flex items-center justify-between w-full border-b border-white/10 pb-2">
                  <h3
                    className={`text-sm font-black uppercase tracking-wider ${getPrimaryAccentColor(appTheme)}`}
                  >
                    ⚙️ App Settings
                  </h3>
                  <button
                    type="button"
                    onClick={handleCloseAll}
                    className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-white/5"
                  >
                    ✕ Close
                  </button>
                </div>
                <div className="flex items-center gap-1 overflow-x-auto pb-2 border-b border-white/10 w-full justify-start sm:justify-center scrollbar-none">
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
                  <div className="flex flex-wrap items-center justify-center gap-2">
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
                  <div className="flex flex-wrap items-center justify-center gap-2">
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
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-2 w-full">
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
            </div>
          )}

          <main className="mx-auto max-w-7xl px-4 py-4 sm:px-6 md:py-6 overflow-x-hidden pb-20">
            <Outlet />
          </main>

          {/* FIRST-START MODAL (Fixed Centering with auto margins & max height padding) */}
          {showFirstStartModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-3 sm:p-6 backdrop-blur-xl overflow-y-auto">
              <form
                onSubmit={handleFirstTimeAuthorize}
                className={`relative w-full max-w-xl my-auto rounded-3xl border text-white shadow-2xl ${getCardBackground(appTheme)} backdrop-blur-2xl max-h-[92vh] overflow-y-auto`}
              >
                <div className="p-5 sm:p-8 space-y-4 sm:space-y-5">
                  <div className="text-center space-y-2">
                    <div className="mx-auto flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-2xl overflow-hidden border border-white/20 shadow-lg bg-black">
                      <img
                        src={HEADER_ICON_URL}
                        alt="RABBiT TV Logo"
                        className="h-full w-full object-fill"
                      />
                    </div>
                    <h2
                      className={`text-xl sm:text-2xl font-bold ${getPrimaryAccentColor(appTheme)}`}
                    >
                      Welcome to RABBiT TV
                    </h2>
                  </div>

                  <div className="space-y-2.5 text-xs sm:text-sm leading-relaxed text-slate-300 text-center">
                    <p>
                      Get all your favorite movies and TV shows right here,
                      streaming smoothly in one place!
                    </p>
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-300">
                      <strong>⏳ Trial:</strong> Enter <strong>`9654`</strong>{" "}
                      for a free 7-day trial (one-time per device). Full unlock
                      uses a personal code matched to your name and age.
                    </div>
                  </div>

                  <div className="space-y-1.5 border-t border-white/10 pt-3">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                      What&apos;s your name?{" "}
                      <span className="text-slate-400 font-normal lowercase">
                        (Used for your unlock code)
                      </span>
                    </label>
                    <input
                      type="text"
                      maxLength={25}
                      value={profileNameInput}
                      onChange={(e) => {
                        const val = e.target.value;
                        setProfileNameInput(val);
                        localStorage.setItem(
                          "rabtv_profile_name",
                          val.trim()
                        );
                        setSavedProfileName(val.trim());
                      }}
                      placeholder="Enter Name"
                      className="w-full rounded-xl border border-white/10 bg-slate-800/80 px-4 py-2.5 text-center text-sm sm:text-base font-bold text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500"
                    />
                  </div>

                  <div className="space-y-1.5 border-t border-white/10 pt-3">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                      How old are you?
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={120}
                      value={userAgeInput}
                      onChange={(e) => setUserAgeInput(e.target.value)}
                      placeholder="Enter Age"
                      className="w-full rounded-xl border border-white/10 bg-slate-800/80 px-4 py-2.5 text-center text-sm sm:text-base font-bold text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500"
                    />
                    {ageErrorNotice && (
                      <p className="text-xs font-semibold text-red-400 text-center">
                        ⚠️ Please enter your age.
                      </p>
                    )}
                  </div>

                  {/* Mandatory 4-digit age lock */}
                  <div className="space-y-1.5 border-t border-white/10 pt-3">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                      Create Age-Lock Code{" "}
                      <span className="text-red-400">*</span>
                    </label>
                    <p className="text-[11px] text-slate-300 text-center">
                      Choose a 4-digit PIN parents can use later to change the
                      age setting. Required.
                    </p>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      value={ageLockInput}
                      onChange={(e) =>
                        setAgeLockInput(
                          e.target.value.replace(/\D/g, "").slice(0, 4)
                        )
                      }
                      placeholder="••••"
                      className="w-full rounded-xl border border-white/10 bg-slate-800/80 px-4 py-2 text-center text-lg font-bold tracking-[0.4em] text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500"
                    />
                    {ageLockError && (
                      <p className="text-xs font-semibold text-red-400 text-center">
                        ⚠️ Enter a 4-digit age-lock code (numbers only).
                      </p>
                    )}
                  </div>

                  <div className="space-y-2 border-t border-white/10 pt-3">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                      Select Startup Theme:
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {allThemesList.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => handleThemeChange(t.id)}
                          className={`rounded-xl border py-2 px-1 text-[11px] sm:text-xs font-bold transition focus:outline-none ${
                            appTheme === t.id
                              ? `border-white/30 ${getPrimaryBgColor(t.id)} text-white shadow-lg`
                              : "border-white/10 bg-slate-800/60 text-slate-300 hover:bg-slate-700/60"
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2 border-t border-white/10 pt-3">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                      Select Display Size:
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(["small", "medium", "large"] as CardSize[]).map(
                        (size) => (
                          <button
                            key={size}
                            type="button"
                            onClick={() => handleSizeChange(size)}
                            className={`rounded-xl border py-2 px-1 text-[11px] sm:text-xs font-bold transition focus:outline-none ${
                              cardSize === size
                                ? `border-white/30 ${getPrimaryBgColor(appTheme)} text-white shadow-lg`
                                : "border-white/10 bg-slate-800/60 text-slate-300 hover:bg-slate-700/60"
                            }`}
                          >
                            {size === "small"
                              ? "Small (25%)"
                              : size === "medium"
                              ? "Medium (60%)"
                              : "Large (100%)"}
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-white/10 pt-3">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                        XL Mouse Pointer
                      </label>
                      <p className="text-[11px] text-slate-300">
                        Enlarges cursor 3x for projector/TV use.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleMouseToggle(!helpfulMouse)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        helpfulMouse ? "bg-violet-600" : "bg-slate-700"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          helpfulMouse ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>

                  <div className="space-y-2.5 border-t border-white/10 pt-3">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                      Unlock Code or Trial (`9654`):
                    </label>
                    <input
                      type="text"
                      maxLength={12}
                      value={passcodeInput}
                      onChange={(e) => setPasscodeInput(e.target.value)}
                      placeholder="Unlock code or 9654"
                      className="w-full rounded-xl border border-white/10 bg-slate-800/80 px-4 py-3 text-center text-base sm:text-lg font-bold tracking-widest text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500"
                    />
                    {passcodeError && (
                      <p className="text-xs font-semibold text-red-400 text-center">
                        {passcodeErrorMsg}
                      </p>
                    )}

                    {/* Contact Me info */}
                    <div className="rounded-xl border border-white/10 bg-black/40 p-2.5 text-center text-xs text-slate-300 space-y-0.5 backdrop-blur-md">
                      <p className="font-semibold text-white">Need an activation code or support?</p>
                      <p className="text-[11px] text-slate-300">
                        Message me on WhatsApp (<span className="text-emerald-400 font-bold">RabbitProductions</span>) or text my private number at <span className="text-amber-300 font-bold">(705) 809-3865</span>.
                      </p>
                    </div>

                    <button
                      type="submit"
                      className={`w-full rounded-xl ${getPrimaryBgColor(appTheme)} py-3.5 text-sm sm:text-base font-bold text-white shadow-lg transition active:scale-95 focus:outline-none`}
                    >
                      Enter RABBiT TV
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  );
}
