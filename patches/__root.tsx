import { Outlet, createRootRoute, HeadContent, Scripts, Link, useNavigate } from "@tanstack/react-router";[span_1](start_span)[span_1](end_span)
import { AuthProvider } from "@/components/auth-provider";[span_2](start_span)[span_2](end_span)
import { PreviewHostBridge } from "@/components/preview-host-bridge";[span_3](start_span)[span_3](end_span)
import { HolidayOverlay } from "@/components/HolidayOverlay";[span_4](start_span)[span_4](end_span)
import { AppWallpaper } from "@/components/AppWallpaper";[span_5](start_span)[span_5](end_span)
import "@/styles.css";[span_6](start_span)[span_6](end_span)
import { useState, useEffect, useRef } from "react";[span_7](start_span)[span_7](end_span)
import { StatusBar, Style } from "@capacitor/status-bar";[span_8](start_span)[span_8](end_span)
import { sendPermanentActivationAlert } from "@/lib/report";[span_9](start_span)[span_9](end_span)
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
} from "@/lib/settings";[span_10](start_span)[span_10](end_span)

// ——— Unlock algorithm (name + age → 8-digit code) ———
export function generateUnlockCode(name: string, age: number): string {[span_11](start_span)[span_11](end_span)
  const clean = name[span_12](start_span)[span_12](end_span)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  if (!clean || !age || age < 1 || age > 120) return "";[span_13](start_span)[span_13](end_span)

  let sum = age * 17;[span_14](start_span)[span_14](end_span)
  for (let i = 0; i < clean.length; i++) {[span_15](start_span)[span_15](end_span)
    sum += clean.charCodeAt(i) * (i + 7);
  }
  const mixed = (sum * 7919 + age * 997) % 90000000;[span_16](start_span)[span_16](end_span)
  return String(mixed + 10000000); // always 8 digits[span_17](start_span)[span_17](end_span)
}

const ADMIN_NAME = "Rabbit";[span_18](start_span)[span_18](end_span)
const ADMIN_BIRTH_YEAR = 1988;[span_19](start_span)[span_19](end_span)

function getExpectedAdminAge(): number {[span_20](start_span)[span_20](end_span)
  return new Date().getFullYear() - ADMIN_BIRTH_YEAR;[span_21](start_span)[span_21](end_span)
}

function isAdminCredentials(name: string, age: number): boolean {[span_22](start_span)[span_22](end_span)
  return name.trim() === ADMIN_NAME && age === getExpectedAdminAge();[span_23](start_span)[span_23](end_span)
}

const TRIAL_CODE = "9654";[span_24](start_span)[span_24](end_span)
const TRIAL_DURATION_MS = 7 * 24 * 60 * 60 * 1000;[span_25](start_span)[span_25](end_span)
const AGE_LOCK_KEY = "rabtv_age_passcode";[span_26](start_span)[span_26](end_span)

const globalFeedOptions = ["All (Default)", "Russian", "British", "Hungarian", "German"] as const;[span_27](start_span)[span_27](end_span)
export type GlobalFeedOption = (typeof globalFeedOptions)[number];[span_28](start_span)[span_28](end_span)

const HEADER_ICON_URL =
  "https://avatars.githubusercontent.com/u/330663733?s=400&u=911c6843a369d9d42e99a852c6bf65a49c779b9d&v=4";[span_29](start_span)[span_29](end_span)

const themeStatusBarMap: Record<AppTheme, string> = {[span_30](start_span)[span_30](end_span)
  violet: "#0f0728",
  red: "#180505",
  midnight: "#050b1a",
  emerald: "#021a12",
  amber: "#1c1505",
  cyan: "#021820",
};

async function updateNativeStatusBar(theme: AppTheme) {[span_31](start_span)[span_31](end_span)
  if (typeof window === "undefined") return;[span_32](start_span)[span_32](end_span)
  try {
    const hex = themeStatusBarMap[theme] || "#050b1a";[span_33](start_span)[span_33](end_span)
    await StatusBar.setBackgroundColor({ color: hex });[span_34](start_span)[span_34](end_span)
    await StatusBar.setStyle({ style: Style.Dark });[span_35](start_span)[span_35](end_span)
  } catch {
    // ignore
  }
}

function verifyCurrentAccess(): boolean {[span_36](start_span)[span_36](end_span)
  if (typeof window === "undefined") return false;[span_37](start_span)[span_37](end_span)
  const status = localStorage.getItem("rabtv_access_status");[span_38](start_span)[span_38](end_span)
  if (status === "permanent") return true;[span_39](start_span)[span_39](end_span)
  if (status === "trial") {[span_40](start_span)[span_40](end_span)
    const startTime = Number(localStorage.getItem("rabtv_trial_start_timestamp") || 0);[span_41](start_span)[span_41](end_span)
    if (Date.now() - startTime < TRIAL_DURATION_MS) return true;[span_42](start_span)[span_42](end_span)
    localStorage.setItem("rabtv_access_status", "expired");[span_43](start_span)[span_43](end_span)
    return false;[span_44](start_span)[span_44](end_span)
  }
  if (localStorage.getItem(DISCLAIMER_ACCEPTED_KEY) === "true") {[span_45](start_span)[span_45](end_span)
    localStorage.setItem("rabtv_access_status", "permanent");[span_46](start_span)[span_46](end_span)
    return true;[span_47](start_span)[span_47](end_span)
  }
  return false;[span_48](start_span)[span_48](end_span)
}

export const Route = createRootRoute({[span_49](start_span)[span_49](end_span)
  component: RootComponent,
  head: () => ({
    meta: [
      { charSet: "utf-8" },[span_50](start_span)[span_50](end_span)
      { name: "viewport", content: "width=device-width, initial-scale=1" },[span_51](start_span)[span_51](end_span)
    ],
    title: "RABTV - Stream Your Favorite Shows",[span_52](start_span)[span_52](end_span)
  }),
});

function RootComponent() {[span_53](start_span)[span_53](end_span)
  const navigate = useNavigate();[span_54](start_span)[span_54](end_span)
  const [showFirstStartModal, setShowFirstStartModal] = useState(false);[span_55](start_span)[span_55](end_span)
  const [passcodeInput, setPasscodeInput] = useState("");[span_56](start_span)[span_56](end_span)
  const [passcodeError, setPasscodeError] = useState(false);[span_57](start_span)[span_57](end_span)
  const [passcodeErrorMsg, setPasscodeErrorMsg] = useState([span_58](start_span)[span_58](end_span)
    "⚠️ Invalid Passcode. Please try again."
  );
  const [ageErrorNotice, setAgeErrorNotice] = useState(false);[span_59](start_span)[span_59](end_span)
  const [ageLockError, setAgeLockError] = useState(false);[span_60](start_span)[span_60](end_span)

  const [ageLockInput, setAgeLockInput] = useState("");[span_61](start_span)[span_61](end_span)

  const [showSettings, setShowSettings] = useState(false);[span_62](start_span)[span_62](end_span)
  const [showProfileMenu, setShowProfileMenu] = useState(false);[span_63](start_span)[span_63](end_span)
  const lastScrollYRef = useRef(0);[span_64](start_span)[span_64](end_span)
  const [activeSettingsTab, setActiveSettingsTab] = useState<[span_65](start_span)[span_65](end_span)
    "theme" | "scale" | "backup" | null
  >(null);

  const [cardSize, setCardSize] = useState<CardSize>("large");[span_66](start_span)[span_66](end_span)
  const [streamQuality, setStreamQuality] = useState<StreamQuality>("1080p");[span_67](start_span)[span_67](end_span)
  const [appTheme, setAppTheme] = useState<AppTheme>("violet");[span_68](start_span)[span_68](end_span)
  const [helpfulMouse, setHelpfulMouseState] = useState(false);[span_69](start_span)[span_69](end_span)
  const [historyOverscale, setHistoryOverscaleState] =[span_70](start_span)[span_70](end_span)
    useState<HistoryScale>("off");
  const [largeButtons, setLargeButtonsState] = useState(false);[span_71](start_span)[span_71](end_span)
  const [userAgeInput, setUserAgeInput] = useState<string>("");[span_72](start_span)[span_72](end_span)
  const [profileNameInput, setProfileNameInput] = useState<string>("");[span_73](start_span)[span_73](end_span)
  const [savedProfileName, setSavedProfileName] = useState<string>("");[span_74](start_span)[span_74](end_span)
  const [settingsAgeCodeInput, setSettingsAgeCodeInput] = useState<string>("");[span_75](start_span)[span_75](end_span)
  const [settingsAgeError, setSettingsAgeError] = useState(false);[span_76](start_span)[span_76](end_span)
  const [settingsAgeSuccess, setSettingsAgeSuccess] = useState(false);[span_77](start_span)[span_77](end_span)

  const [unlockCodeInput, setUnlockCodeInput] = useState("");[span_78](start_span)[span_78](end_span)
  const [unlockStatusMsg, setUnlockStatusMsg] = useState<{[span_79](start_span)[span_79](end_span)
    text: string;
    isError: boolean;
  } | null>(null);
  const [isTrialActive, setIsTrialActive] = useState(false);[span_80](start_span)[span_80](end_span)
  const [trialDaysRemaining, setTrialDaysRemaining] = useState(0);[span_81](start_span)[span_81](end_span)
  const [isAdmin, setIsAdmin] = useState(false);[span_82](start_span)[span_82](end_span)

  const [keygenName, setKeygenName] = useState("");[span_83](start_span)[span_83](end_span)
  const [keygenAge, setKeygenAge] = useState("");[span_84](start_span)[span_84](end_span)
  const [keygenResult, setKeygenResult] = useState<string | null>(null);[span_85](start_span)[span_85](end_span)

  const [currentPasscodeInput, setCurrentPasscodeInput] = useState("");[span_86](start_span)[span_86](end_span)
  const [newPasscode, setNewPasscode] = useState("");[span_87](start_span)[span_87](end_span)
  const [confirmNewPasscode, setConfirmNewPasscode] = useState("");[span_88](start_span)[span_88](end_span)
  const [passcodeStatusMsg, setPasscodeStatusMsg] = useState<{[span_89](start_span)[span_89](end_span)
    text: string;
    isError: boolean;
  } | null>(null);

  const [backupStatus, setBackupStatus] = useState<string | null>(null);[span_90](start_span)[span_90](end_span)
  const [headerSearchInput, setHeaderSearchInput] = useState("");[span_91](start_span)[span_91](end_span)

  const [selectedGlobalFeed, setSelectedGlobalFeed] = useState<GlobalFeedOption>([span_92](start_span)[span_92](end_span)
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

  const handleGlobalFeedChange = (feed: GlobalFeedOption) => {[span_93](start_span)[span_93](end_span)
    setSelectedGlobalFeed(feed);[span_94](start_span)[span_94](end_span)
    localStorage.setItem("rabtv_global_feed", feed);[span_95](start_span)[span_95](end_span)
    window.dispatchEvent([span_96](start_span)[span_96](end_span)
      new CustomEvent("rabtv_global_feed_updated", { detail: feed })
    );
  };

  const handleHeaderSearchSubmit = (e: React.FormEvent) => {[span_97](start_span)[span_97](end_span)
    e.preventDefault();[span_98](start_span)[span_98](end_span)
    navigate({ to: "/search", search: { q: headerSearchInput.trim() } });[span_99](start_span)[span_99](end_span)
    setHeaderSearchInput("");[span_100](start_span)[span_100](end_span)
  };

  const handleCloseAll = () => {[span_101](start_span)[span_101](end_span)
    setShowSettings(false);[span_102](start_span)[span_102](end_span)
    setShowProfileMenu(false);[span_103](start_span)[span_103](end_span)
    setActiveSettingsTab(null);[span_104](start_span)[span_104](end_span)
  };

  const handleToggleSettings = () => {[span_105](start_span)[span_105](end_span)
    if (showSettings) handleCloseAll();[span_106](start_span)[span_106](end_span)
    else {
      handleCloseAll();[span_107](start_span)[span_107](end_span)
      lastScrollYRef.current = window.scrollY;[span_108](start_span)[span_108](end_span)
      setShowSettings(true);[span_109](start_span)[span_109](end_span)
      setActiveSettingsTab(null);[span_110](start_span)[span_110](end_span)
    }
  };

  const handleToggleProfileMenu = () => {[span_111](start_span)[span_111](end_span)
    if (showProfileMenu) handleCloseAll();[span_112](start_span)[span_112](end_span)
    else {
      handleCloseAll();[span_113](start_span)[span_113](end_span)
      lastScrollYRef.current = window.scrollY;[span_114](start_span)[span_114](end_span)
      setShowProfileMenu(true);[span_115](start_span)[span_115](end_span)
    }
  };

  useEffect(() => {[span_116](start_span)[span_116](end_span)
    const handleWindowScroll = () => {[span_117](start_span)[span_117](end_span)
      if (showSettings || showProfileMenu) {[span_118](start_span)[span_118](end_span)
        if (Math.abs(window.scrollY - lastScrollYRef.current) > 60) {[span_119](start_span)[span_119](end_span)
          handleCloseAll();[span_120](start_span)[span_120](end_span)
        }
      }
    };
    window.addEventListener("scroll", handleWindowScroll, { passive: true });[span_121](start_span)[span_121](end_span)
    return () => window.removeEventListener("scroll", handleWindowScroll);[span_122](start_span)[span_122](end_span)
  }, [showSettings, showProfileMenu]);

  useEffect(() => {[span_123](start_span)[span_123](end_span)
    if (typeof window !== "undefined") {[span_124](start_span)[span_124](end_span)
      const ua = navigator.userAgent.toLowerCase();[span_125](start_span)[span_125](end_span)
      if (ua.includes("silk") || ua.includes("firetv") || ua.includes("amazon")) {[span_126](start_span)[span_126](end_span)
        document.documentElement.classList.add("fire-os");[span_127](start_span)[span_127](end_span)
      }
    }

    if (!verifyCurrentAccess()) {[span_128](start_span)[span_128](end_span)
      setShowFirstStartModal(true);[span_129](start_span)[span_129](end_span)
    } else {
      const status = localStorage.getItem("rabtv_access_status");[span_130](start_span)[span_130](end_span)
      if (status === "trial") {[span_131](start_span)[span_131](end_span)
        setIsTrialActive(true);[span_132](start_span)[span_132](end_span)
        const startTime = Number([span_133](start_span)[span_133](end_span)
          localStorage.getItem("rabtv_trial_start_timestamp") || 0
        );
        const remainingMs = Math.max(0, TRIAL_DURATION_MS - (Date.now() - startTime));[span_134](start_span)[span_134](end_span)
        setTrialDaysRemaining(Math.ceil(remainingMs / (1000 * 60 * 60 * 24)));[span_135](start_span)[span_135](end_span)
      }
    }

    setIsAdmin(localStorage.getItem("rabtv_is_admin") === "true");[span_136](start_span)[span_136](end_span)

    const loadedTheme = getSavedTheme();[span_137](start_span)[span_137](end_span)
    setCardSize(getSavedCardSize());[span_138](start_span)[span_138](end_span)
    setStreamQuality(getSavedStreamQuality());[span_139](start_span)[span_139](end_span)
    setAppTheme(loadedTheme);[span_140](start_span)[span_140](end_span)
    setHelpfulMouseState(getHelpfulMouse());[span_141](start_span)[span_141](end_span)
    setHistoryOverscaleState(getHistoryOverscale());[span_142](start_span)[span_142](end_span)
    setLargeButtonsState(getLargeButtons());[span_143](start_span)[span_143](end_span)
    void updateNativeStatusBar(loadedTheme);[span_144](start_span)[span_144](end_span)

    const existingAge = localStorage.getItem("rabtv_user_age");[span_145](start_span)[span_145](end_span)
    if (existingAge) setUserAgeInput(existingAge);[span_146](start_span)[span_146](end_span)

    const existingName = localStorage.getItem("rabtv_profile_name");[span_147](start_span)[span_147](end_span)
    if (existingName) {[span_148](start_span)[span_148](end_span)
      setProfileNameInput(existingName);[span_149](start_span)[span_149](end_span)
      setSavedProfileName(existingName);[span_150](start_span)[span_150](end_span)
    }

    const handleSettingsUpdate = () => {[span_151](start_span)[span_151](end_span)
      const updatedTheme = getSavedTheme();[span_152](start_span)[span_152](end_span)
      setCardSize(getSavedCardSize());[span_153](start_span)[span_153](end_span)
      setStreamQuality(getSavedStreamQuality());[span_154](start_span)[span_154](end_span)
      setAppTheme(updatedTheme);[span_155](start_span)[span_155](end_span)
      setHelpfulMouseState(getHelpfulMouse());[span_156](start_span)[span_156](end_span)
      setHistoryOverscaleState(getHistoryOverscale());[span_157](start_span)[span_157](end_span)
      setLargeButtonsState(getLargeButtons());[span_158](start_span)[span_158](end_span)
      void updateNativeStatusBar(updatedTheme);[span_159](start_span)[span_159](end_span)
      const updatedName = localStorage.getItem("rabtv_profile_name");[span_160](start_span)[span_160](end_span)
      if (updatedName) setSavedProfileName(updatedName);[span_161](start_span)[span_161](end_span)
      setIsAdmin(localStorage.getItem("rabtv_is_admin") === "true");[span_162](start_span)[span_162](end_span)
      const status = localStorage.getItem("rabtv_access_status");[span_163](start_span)[span_163](end_span)
      if (status === "trial") {[span_164](start_span)[span_164](end_span)
        setIsTrialActive(true);[span_165](start_span)[span_165](end_span)
        const startTime = Number([span_166](start_span)[span_166](end_span)
          localStorage.getItem("rabtv_trial_start_timestamp") || 0
        );
        const remainingMs = Math.max([span_167](start_span)[span_167](end_span)
          0,
          TRIAL_DURATION_MS - (Date.now() - startTime)
        );
        setTrialDaysRemaining(Math.ceil(remainingMs / (1000 * 60 * 60 * 24)));[span_168](start_span)[span_168](end_span)
      } else {
        setIsTrialActive(false);[span_169](start_span)[span_169](end_span)
      }
    };

    window.addEventListener("rabtv_settings_updated", handleSettingsUpdate);[span_170](start_span)[span_170](end_span)
    return () =>[span_171](start_span)[span_171](end_span)
      window.removeEventListener("rabtv_settings_updated", handleSettingsUpdate);
  }, []);

  const saveAgeLockCode = (code: string) => {[span_172](start_span)[span_172](end_span)
    localStorage.setItem(AGE_LOCK_KEY, code);[span_173](start_span)[span_173](end_span)
  };

  const getAgeLockCode = () => localStorage.getItem(AGE_LOCK_KEY) || "";[span_174](start_span)[span_174](end_span)

  const completePermanentLogin = ([span_175](start_span)[span_175](end_span)
    finalName: string,
    parsedAge: number,
    ageLockCode: string,
    options?: { admin?: boolean; forceTheme?: AppTheme; forceSize?: CardSize }
  ) => {
    localStorage.setItem(DISCLAIMER_ACCEPTED_KEY, "true");[span_176](start_span)[span_176](end_span)
    localStorage.setItem("rabtv_access_status", "permanent");[span_177](start_span)[span_177](end_span)
    localStorage.removeItem("rabtv_trial_start_timestamp");[span_178](start_span)[span_178](end_span)
    setIsTrialActive(false);[span_179](start_span)[span_179](end_span)

    saveAgeLockCode(ageLockCode);[span_180](start_span)[span_180](end_span)

    if (options?.admin) {[span_181](start_span)[span_181](end_span)
      localStorage.setItem("rabtv_is_admin", "true");[span_182](start_span)[span_182](end_span)
      setIsAdmin(true);[span_183](start_span)[span_183](end_span)
    } else {
      localStorage.removeItem("rabtv_is_admin");[span_184](start_span)[span_184](end_span)
      setIsAdmin(false);[span_185](start_span)[span_185](end_span)
    }

    const themeToUse = options?.forceTheme ?? appTheme;[span_186](start_span)[span_186](end_span)
    const sizeToUse = options?.forceSize ?? cardSize;[span_187](start_span)[span_187](end_span)

    saveCardSize(sizeToUse);[span_188](start_span)[span_188](end_span)
    setCardSize(sizeToUse);[span_189](start_span)[span_189](end_span)
    saveStreamQuality(streamQuality);[span_190](start_span)[span_190](end_span)
    saveTheme(themeToUse);[span_191](start_span)[span_191](end_span)
    setAppTheme(themeToUse);[span_192](start_span)[span_192](end_span)
    void updateNativeStatusBar(themeToUse);[span_193](start_span)[span_193](end_span)
    setHelpfulMouse(helpfulMouse);[span_194](start_span)[span_194](end_span)

    saveUserAge(parsedAge);[span_195](start_span)[span_195](end_span)
    localStorage.setItem("rabtv_profile_name", finalName);[span_196](start_span)[span_196](end_span)
    setSavedProfileName(finalName);[span_197](start_span)[span_197](end_span)

    if (!options?.admin) {[span_198](start_span)[span_198](end_span)
      sendPermanentActivationAlert(finalName);[span_199](start_span)[span_199](end_span)
    }

    setShowFirstStartModal(false);[span_200](start_span)[span_200](end_span)
    setPasscodeError(false);[span_201](start_span)[span_201](end_span)
    setAgeErrorNotice(false);[span_202](start_span)[span_202](end_span)
    setAgeLockError(false);[span_203](start_span)[span_203](end_span)
    window.dispatchEvent(new Event("rabtv_settings_updated"));[span_204](start_span)[span_204](end_span)
  };

  const handleFirstTimeAuthorize = (e: React.FormEvent) => {[span_205](start_span)[span_205](end_span)
    e.preventDefault();[span_206](start_span)[span_206](end_span)

    const trimmedAge = userAgeInput.trim();[span_207](start_span)[span_207](end_span)
    if (!trimmedAge || isNaN(parseInt(trimmedAge, 10))) {[span_208](start_span)[span_208](end_span)
      setAgeErrorNotice(true);[span_209](start_span)[span_209](end_span)
      setPasscodeError(false);[span_210](start_span)[span_210](end_span)
      setAgeLockError(false);[span_211](start_span)[span_211](end_span)
      return;
    }

    const ageLock = ageLockInput.trim();[span_212](start_span)[span_212](end_span)
    if (!/^\d{4}$/.test(ageLock)) {[span_213](start_span)[span_213](end_span)
      setAgeLockError(true);[span_214](start_span)[span_214](end_span)
      setAgeErrorNotice(false);[span_215](start_span)[span_215](end_span)
      setPasscodeError(false);[span_216](start_span)[span_216](end_span)
      return;
    }

    const parsedAge = parseInt(trimmedAge, 10);[span_217](start_span)[span_217](end_span)
    const finalName = profileNameInput.trim() || "Friend";[span_218](start_span)[span_218](end_span)
    const enteredCode = passcodeInput.trim();[span_219](start_span)[span_219](end_span)

    if (isAdminCredentials(finalName, parsedAge)) {[span_220](start_span)[span_220](end_span)
      completePermanentLogin(finalName, parsedAge, ageLock, {[span_221](start_span)[span_221](end_span)
        admin: true,
        forceTheme: "red",
        forceSize: "small",
      });
      return;
    }

    if (enteredCode === TRIAL_CODE) {[span_222](start_span)[span_222](end_span)
      const trialAlreadyUsed =[span_223](start_span)[span_223](end_span)
        localStorage.getItem("rabtv_trial_used_flag") === "true";
      if (trialAlreadyUsed) {[span_224](start_span)[span_224](end_span)
        setPasscodeError(true);[span_225](start_span)[span_225](end_span)
        setPasscodeErrorMsg([span_226](start_span)[span_226](end_span)
          "⚠️ Trial code has already been used on this device and cannot be redeemed again."
        );
        setAgeErrorNotice(false);[span_227](start_span)[span_227](end_span)
        setAgeLockError(false);[span_228](start_span)[span_228](end_span)
        setPasscodeInput("");[span_229](start_span)[span_229](end_span)
        return;
      }

      localStorage.setItem(DISCLAIMER_ACCEPTED_KEY, "true");[span_230](start_span)[span_230](end_span)
      localStorage.setItem("rabtv_access_status", "trial");[span_231](start_span)[span_231](end_span)
      localStorage.setItem("rabtv_trial_start_timestamp", String(Date.now()));[span_232](start_span)[span_232](end_span)
      localStorage.setItem("rabtv_trial_used_flag", "true");[span_233](start_span)[span_233](end_span)
      localStorage.removeItem("rabtv_is_admin");[span_234](start_span)[span_234](end_span)
      setIsAdmin(false);[span_235](start_span)[span_235](end_span)
      setIsTrialActive(true);[span_236](start_span)[span_236](end_span)
      setTrialDaysRemaining(7);[span_237](start_span)[span_237](end_span)

      saveAgeLockCode(ageLock);[span_238](start_span)[span_238](end_span)
      saveCardSize(cardSize);[span_239](start_span)[span_239](end_span)
      saveStreamQuality(streamQuality);[span_240](start_span)[span_240](end_span)
      saveTheme(appTheme);[span_241](start_span)[span_241](end_span)
      setHelpfulMouse(helpfulMouse);[span_242](start_span)[span_242](end_span)
      saveUserAge(parsedAge);[span_243](start_span)[span_243](end_span)
      localStorage.setItem("rabtv_profile_name", finalName);[span_244](start_span)[span_244](end_span)
      setSavedProfileName(finalName);[span_245](start_span)[span_245](end_span)

      setShowFirstStartModal(false);[span_246](start_span)[span_246](end_span)
      setPasscodeError(false);[span_247](start_span)[span_247](end_span)
      setAgeErrorNotice(false);[span_248](start_span)[span_248](end_span)
      setAgeLockError(false);[span_249](start_span)[span_249](end_span)
      window.dispatchEvent(new Event("rabtv_settings_updated"));[span_250](start_span)[span_250](end_span)
      return;
    }

    const expectedCode = generateUnlockCode(finalName, parsedAge);[span_251](start_span)[span_251](end_span)
    if (expectedCode && enteredCode === expectedCode) {[span_252](start_span)[span_252](end_span)
      completePermanentLogin(finalName, parsedAge, ageLock);[span_253](start_span)[span_253](end_span)
      return;
    }

    setPasscodeError(true);[span_254](start_span)[span_254](end_span)
    setPasscodeErrorMsg([span_255](start_span)[span_255](end_span)
      "⚠️ Invalid Passcode for this name and age. Please try again."
    );
    setAgeErrorNotice(false);[span_256](start_span)[span_256](end_span)
    setAgeLockError(false);[span_257](start_span)[span_257](end_span)
    setPasscodeInput("");[span_258](start_span)[span_258](end_span)
  };

  const handleUpgradeFromProfile = (e: React.FormEvent) => {[span_259](start_span)[span_259](end_span)
    e.preventDefault();[span_260](start_span)[span_260](end_span)
    const name =[span_261](start_span)[span_261](end_span)
      savedProfileName ||
      localStorage.getItem("rabtv_profile_name") ||
      "Friend";
    const age = getSavedUserAge() || parseInt(userAgeInput, 10) || 0;[span_262](start_span)[span_262](end_span)
    const expected = generateUnlockCode(name, age);[span_263](start_span)[span_263](end_span)

    if (unlockCodeInput.trim() === expected && expected) {[span_264](start_span)[span_264](end_span)
      localStorage.setItem("rabtv_access_status", "permanent");[span_265](start_span)[span_265](end_span)
      localStorage.removeItem("rabtv_trial_start_timestamp");[span_266](start_span)[span_266](end_span)
      setIsTrialActive(false);[span_267](start_span)[span_267](end_span)
      sendPermanentActivationAlert(name);[span_268](start_span)[span_268](end_span)
      setUnlockStatusMsg({[span_269](start_span)[span_269](end_span)
        text: "✅ Successfully upgraded to Full Access!",
        isError: false,
      });
      setUnlockCodeInput("");[span_270](start_span)[span_270](end_span)
      setTimeout(() => {[span_271](start_span)[span_271](end_span)
        setUnlockStatusMsg(null);[span_272](start_span)[span_272](end_span)
        handleCloseAll();[span_273](start_span)[span_273](end_span)
        window.dispatchEvent(new Event("rabtv_settings_updated"));[span_274](start_span)[span_274](end_span)
      }, 2500);
    } else {
      setUnlockStatusMsg({[span_275](start_span)[span_275](end_span)
        text: "❌ Invalid unlock code for this profile name and age.",
        isError: true,
      });
    }
  };

  const handleKeygen = (e: React.FormEvent) => {[span_276](start_span)[span_276](end_span)
    e.preventDefault();[span_277](start_span)[span_277](end_span)
    const age = parseInt(keygenAge.trim(), 10);[span_278](start_span)[span_278](end_span)
    const code = generateUnlockCode(keygenName, age);[span_279](start_span)[span_279](end_span)
    if (!code) {[span_280](start_span)[span_280](end_span)
      setKeygenResult("Enter a valid name and age (1–120).");[span_281](start_span)[span_281](end_span)
      return;
    }
    setKeygenResult(code);[span_282](start_span)[span_282](end_span)
  };

  const handleSizeChange = (newSize: CardSize) => {[span_283](start_span)[span_283](end_span)
    saveCardSize(newSize);[span_284](start_span)[span_284](end_span)
    setCardSize(newSize);[span_285](start_span)[span_285](end_span)
    window.dispatchEvent(new Event("rabtv_settings_updated"));[span_286](start_span)[span_286](end_span)
  };

  const handleThemeChange = (newTheme: AppTheme) => {[span_287](start_span)[span_287](end_span)
    saveTheme(newTheme);[span_288](start_span)[span_288](end_span)
    setAppTheme(newTheme);[span_289](start_span)[span_289](end_span)
    void updateNativeStatusBar(newTheme);[span_290](start_span)[span_290](end_span)
    window.dispatchEvent(new Event("rabtv_settings_updated"));[span_291](start_span)[span_291](end_span)
  };

  const handleMouseToggle = (enabled: boolean) => {[span_292](start_span)[span_292](end_span)
    setHelpfulMouse(enabled);[span_293](start_span)[span_293](end_span)
    setHelpfulMouseState(enabled);[span_294](start_span)[span_294](end_span)
  };

  const handleHistoryOverscaleChange = (scale: HistoryScale) => {[span_295](start_span)[span_295](end_span)
    setHistoryOverscale(scale);[span_296](start_span)[span_296](end_span)
    setHistoryOverscaleState(scale);[span_297](start_span)[span_297](end_span)
  };

  const handleLargeButtonsToggle = (enabled: boolean) => {[span_298](start_span)[span_298](end_span)
    setLargeButtons(enabled);[span_299](start_span)[span_299](end_span)
    setLargeButtonsState(enabled);[span_300](start_span)[span_300](end_span)
  };

  const handleUpdateAgeInSettings = (e: React.FormEvent) => {[span_301](start_span)[span_301](end_span)
    e.preventDefault();[span_302](start_span)[span_302](end_span)
    const locked = getAgeLockCode();[span_303](start_span)[span_303](end_span)
    if (!locked || settingsAgeCodeInput.trim() !== locked) {[span_304](start_span)[span_304](end_span)
      setSettingsAgeError(true);[span_305](start_span)[span_305](end_span)
      setSettingsAgeCodeInput("");[span_306](start_span)[span_306](end_span)
      return;
    }
    const parsedAge = parseInt(userAgeInput, 10);[span_307](start_span)[span_307](end_span)
    if (isNaN(parsedAge) || parsedAge < 1 || parsedAge > 120) {[span_308](start_span)[span_308](end_span)
      setSettingsAgeError(true);[span_309](start_span)[span_309](end_span)
      return;
    }
    saveUserAge(parsedAge);[span_310](start_span)[span_310](end_span)
    setSettingsAgeError(false);[span_311](start_span)[span_311](end_span)
    setSettingsAgeSuccess(true);[span_312](start_span)[span_312](end_span)
    setSettingsAgeCodeInput("");[span_313](start_span)[span_313](end_span)
    setTimeout(() => setSettingsAgeSuccess(false), 3000);[span_314](start_span)[span_314](end_span)
    window.dispatchEvent(new Event("rabtv_settings_updated"));[span_315](start_span)[span_315](end_span)
  };

  const handleChangePasscodeInSettings = (e: React.FormEvent) => {[span_316](start_span)[span_316](end_span)
    e.preventDefault();[span_317](start_span)[span_317](end_span)
    const locked = getAgeLockCode();[span_318](start_span)[span_318](end_span)
    if (currentPasscodeInput.trim() !== locked) {[span_319](start_span)[span_319](end_span)
      setPasscodeStatusMsg({[span_320](start_span)[span_320](end_span)
        text: "Current age-lock code is incorrect.",
        isError: true,
      });
      return;
    }
    if (!/^\d{4}$/.test(newPasscode.trim())) {[span_321](start_span)[span_321](end_span)
      setPasscodeStatusMsg({[span_322](start_span)[span_322](end_span)
        text: "New age-lock code must be exactly 4 digits.",
        isError: true,
      });
      return;
    }
    if (newPasscode !== confirmNewPasscode) {[span_323](start_span)[span_323](end_span)
      setPasscodeStatusMsg({[span_324](start_span)[span_324](end_span)
        text: "New codes do not match.",
        isError: true,
      });
      return;
    }
    saveAgeLockCode(newPasscode.trim());[span_325](start_span)[span_325](end_span)
    setPasscodeStatusMsg({[span_326](start_span)[span_326](end_span)
      text: "Age-lock code updated successfully!",
      isError: false,
    });
    setCurrentPasscodeInput("");[span_327](start_span)[span_327](end_span)
    setNewPasscode("");[span_328](start_span)[span_328](end_span)
    setConfirmNewPasscode("");[span_329](start_span)[span_329](end_span)
    setTimeout(() => setPasscodeStatusMsg(null), 3000);[span_330](start_span)[span_330](end_span)
  };

  const handleSaveBackup = () => {[span_331](start_span)[span_331](end_span)
    const backupData = {[span_332](start_span)[span_332](end_span)
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
    const blob = new Blob([JSON.stringify(backupData, null, 2)], {[span_333](start_span)[span_333](end_span)
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);[span_334](start_span)[span_334](end_span)
    const a = document.createElement("a");[span_335](start_span)[span_335](end_span)
    a.href = url;[span_336](start_span)[span_336](end_span)
    a.download = "rabtv_profile_backup.json";[span_337](start_span)[span_337](end_span)
    a.click();[span_338](start_span)[span_338](end_span)
    URL.revokeObjectURL(url);[span_339](start_span)[span_339](end_span)
    setBackupStatus("Profile settings backup saved!");[span_340](start_span)[span_340](end_span)
    setTimeout(() => setBackupStatus(null), 3000);[span_341](start_span)[span_341](end_span)
  };

  const handleRestoreBackup = (e: React.ChangeEvent<HTMLInputElement>) => {[span_342](start_span)[span_342](end_span)
    const file = e.target.files?.[0];[span_343](start_span)[span_343](end_span)
    if (!file) return;[span_344](start_span)[span_344](end_span)
    const reader = new FileReader();[span_345](start_span)[span_345](end_span)
    reader.onload = (event) => {[span_346](start_span)[span_346](end_span)
      try {
        const data = JSON.parse(event.target?.result as string);[span_347](start_span)[span_347](end_span)
        if (data.cardSize) saveCardSize(data.cardSize);[span_348](start_span)[span_348](end_span)
        if (data.streamQuality) saveStreamQuality(data.streamQuality);[span_349](start_span)[span_349](end_span)
        if (data.appTheme) {[span_350](start_span)[span_350](end_span)
          saveTheme(data.appTheme);[span_351](start_span)[span_351](end_span)
          setAppTheme(data.appTheme);[span_352](start_span)[span_352](end_span)
          void updateNativeStatusBar(data.appTheme);[span_353](start_span)[span_353](end_span)
        }
        if (typeof data.helpfulMouse === "boolean")[span_354](start_span)[span_354](end_span)
          setHelpfulMouse(data.helpfulMouse);
        if (data.historyOverscale) setHistoryOverscale(data.historyOverscale);[span_355](start_span)[span_355](end_span)
        if (typeof data.largeButtons === "boolean")[span_356](start_span)[span_356](end_span)
          setLargeButtons(data.largeButtons);
        if (data.userAge) saveUserAge(data.userAge);[span_357](start_span)[span_357](end_span)
        if (data.profileName) {[span_358](start_span)[span_358](end_span)
          localStorage.setItem("rabtv_profile_name", data.profileName);[span_359](start_span)[span_359](end_span)
          setSavedProfileName(data.profileName);[span_360](start_span)[span_360](end_span)
        }
        if (data.myList) localStorage.setItem("rabtv_my_list", data.myList);[span_361](start_span)[span_361](end_span)
        if (data.favorites)[span_362](start_span)[span_362](end_span)
          localStorage.setItem("rabtv_favorites", data.favorites);

        localStorage.removeItem(DISCLAIMER_ACCEPTED_KEY);[span_363](start_span)[span_363](end_span)
        localStorage.removeItem("rabtv_access_status");[span_364](start_span)[span_364](end_span)
        localStorage.removeItem("rabtv_is_admin");[span_365](start_span)[span_365](end_span)
        setShowFirstStartModal(true);[span_366](start_span)[span_366](end_span)
        handleCloseAll();[span_367](start_span)[span_367](end_span)
        setBackupStatus([span_368](start_span)[span_368](end_span)
          "Settings restored. Please reinstate your passcode agreement."
        );
      } catch {
        setBackupStatus("Failed to restore backup file.");[span_369](start_span)[span_369](end_span)
      }
    };
    reader.readAsText(file);
  };

  const getBodyBackground = (theme: AppTheme) => {[span_370](start_span)[span_370](end_span)
    switch (theme) {
      case "red":
        return "bg-gradient-to-br from-zinc-950/85 via-red-950/45 to-black/90";
      case "midnight":
        return "bg-gradient-to-br from-slate-950/85 via-blue-950/45 to-slate-950/90";
      case "emerald":
        return "bg-gradient-to-br from-slate-950/85 via-emerald-950/45 to-slate-950/90";
      case "amber":
        return "bg-gradient-to-br from-stone-950/85 via-yellow-950/45 to-neutral-950/90";
      case "cyan":
        return "bg-gradient-to-br from-slate-950/85 via-cyan-950/45 to-slate-950/90";
      case "violet":
      default:
        return "bg-gradient-to-br from-slate-950/85 via-purple-950/45 to-slate-950/90";
    }
  };

  const getCardBackground = (theme: AppTheme) => {[span_371](start_span)[span_371](end_span)
    switch (theme) {
      case "red":
        return "bg-zinc-900/95 border-red-500/30";
      case "midnight":
        return "bg-slate-900/95 border-blue-500/30";
      case "emerald":
        return "bg-slate-900/95 border-emerald-500/30";
      case "amber":
        return "bg-stone-900/95 border-amber-500/30";
      case "cyan":
        return "bg-slate-900/95 border-cyan-500/30";
      case "violet":
      default:
        return "bg-slate-900/95 border-violet-500/30";
    }
  };

  const getThemeHeaderStyles = (theme: AppTheme) => {[span_372](start_span)[span_372](end_span)
    switch (theme) {
      case "red":
        return {
          btnBg:
            "bg-red-950/70 border-red-500/30 text-red-200 hover:bg-red-900/80",
        };
      case "midnight":
        return {
          btnBg:
            "bg-blue-950/70 border-blue-500/30 text-blue-200 hover:bg-blue-900/80",
        };
      case "emerald":
        return {
          btnBg:
            "bg-emerald-950/70 border-emerald-500/30 text-emerald-200 hover:bg-emerald-900/80",
        };
      case "amber":
        return {
          btnBg:
            "bg-yellow-950/70 border-amber-500/30 text-amber-200 hover:bg-yellow-900/80",
        };
      case "cyan":
        return {
          btnBg:
            "bg-cyan-950/70 border-cyan-500/30 text-cyan-200 hover:bg-cyan-900/80",
        };
      case "violet":
      default:
        return {
          btnBg:
            "bg-purple-950/70 border-violet-500/30 text-purple-200 hover:bg-purple-900/80",
        };
    }
  };

  const activeHeader = getThemeHeaderStyles(appTheme);[span_373](start_span)[span_373](end_span)

  const getPrimaryAccentColor = (theme: AppTheme) => {[span_374](start_span)[span_374](end_span)
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

  const getPrimaryBgColor = (theme: AppTheme) => {[span_375](start_span)[span_375](end_span)
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
        return "bg-gradient-to-r from-cyan-600 via-teal-600 to-blue-600 text-white shadow-lg shadow-blue-600/30";
      case "violet":
      default:
        return "bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 text-white shadow-lg shadow-violet-600/30";
    }
  };

  const getThemeGlowClass = (theme: AppTheme) => {[span_376](start_span)[span_376](end_span)
    switch (theme) {
      case "red":
        return "border-red-500/60 shadow-[0_0_20px_rgba(239,68,68,0.6)]";
      case "midnight":
        return "border-blue-500/60 shadow-[0_0_20px_rgba(59,130,246,0.6)]";
      case "emerald":
        return "border-emerald-500/60 shadow-[0_0_20px_rgba(16,185,129,0.6)]";
      case "amber":
        return "border-amber-500/60 shadow-[0_0_20px_rgba(245,158,11,0.6)]";
      case "cyan":
        return "border-cyan-500/60 shadow-[0_0_20px_rgba(6,182,212,0.6)]";
      case "violet":
      default:
        return "border-violet-500/60 shadow-[0_0_20px_rgba(139,92,246,0.6)]";
    }
  };

  const getSubtlePillBg = (theme: AppTheme) => {[span_377](start_span)[span_377](end_span)
    switch (theme) {
      case "red":
        return "bg-red-950/50 border-red-500/30 text-red-200 hover:bg-red-900/60";
      case "midnight":
        return "bg-blue-950/50 border-blue-500/30 text-blue-200 hover:bg-blue-900/60";
      case "emerald":
        return "bg-emerald-950/50 border-emerald-500/30 text-emerald-200 hover:bg-emerald-900/60";
      case "amber":
        return "bg-yellow-950/50 border-amber-500/30 text-amber-200 hover:bg-yellow-900/60";
      case "cyan":
        return "bg-cyan-950/50 border-cyan-500/30 text-cyan-200 hover:bg-cyan-900/60";
      case "violet":
      default:
        return "bg-purple-950/50 border-violet-500/30 text-purple-200 hover:bg-purple-900/60";
    }
  };

  const allThemesList: { id: AppTheme; label: string }[] = [[span_378](start_span)[span_378](end_span)
    { id: "violet", label: "🟣 Violet / Neon" },
    { id: "red", label: "🔴 Red & Black" },
    { id: "midnight", label: "🔵 Midnight & Black" },
    { id: "emerald", label: "🟢 Emerald / Teal" },
    { id: "amber", label: "🟠 Amber / Gold" },
    { id: "cyan", label: "🔷 Cyan / Sky" },
  ];

  return (
    <html lang="en" data-theme={appTheme}>[span_379](start_span)[span_379](end_span)
      <head>
        <HeadContent />[span_380](start_span)[span_380](end_span)
        {helpfulMouse && ([span_381](start_span)[span_381](end_span)
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
        <PreviewHostBridge />[span_382](start_span)[span_382](end_span)
        <HolidayOverlay />[span_383](start_span)[span_383](end_span)
        <AppWallpaper />[span_384](start_span)[span_384](end_span)
        <AuthProvider>
          <header className="sticky top-0 z-40 border-b border-white/15 transition-colors duration-300 relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none">
              <img
                src={HEADER_ICON_URL}
                alt="Header Background"
                className="w-full h-full object-fill brightness-90"
              />
            </div>
            {/* Balanced dimmer overlay with minute 1px blur so header wallpaper shows through clearly without being too bright */}
            <div className="absolute inset-0 bg-black/25 backdrop-blur-[1px]" />

            <div className="relative z-10 mx-auto flex max-w-7xl flex-col sm:flex-row items-stretch sm:items-center justify-between px-3 py-2 sm:px-6 gap-2">
              <div className="flex items-center justify-between sm:justify-start gap-2">
                <Link
                  to="/"
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-black/50 backdrop-blur-md border text-sm sm:text-lg font-black tracking-wider text-white focus:outline-none shrink-0 group transition-all animate-pulse ${getThemeGlowClass(appTheme)}`}
                >
                  <span className="whitespace-nowrap">RABBiT TV</span>
                </Link>

                {savedProfileName && !showFirstStartModal && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleToggleProfileMenu}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-xs font-bold text-white shadow transition cursor-pointer"
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
                      <div className="hidden md:flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[11px] font-bold animate-pulse">
                        <span>⏳ {trialDaysRemaining}d left</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {!showFirstStartModal && (
                <div className="flex items-center justify-between sm:justify-end gap-1.5 sm:gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                  <form
                    onSubmit={handleHeaderSearchSubmit}
                    className="flex items-center gap-1 shrink-0 flex-1 sm:flex-initial"
                  >
                    <input
                      type="text"
                      value={headerSearchInput}
                      onChange={(e) => setHeaderSearchInput(e.target.value)}
                      placeholder="Search..."
                      className="h-9 sm:h-10 w-full sm:w-32 lg:w-44 rounded-xl border border-white/10 bg-slate-900/80 px-2.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2"
                    />
                    <button
                      type="submit"
                      className={`flex h-9 sm:h-10 px-2.5 sm:px-3 items-center justify-center rounded-xl border text-xs font-bold shadow-md transition shrink-0 ${activeHeader.btnBg}`}
                      aria-label="Search"
                    >
                      🔍
                    </button>
                  </form>

                  <div className="relative shrink-0">
                    <div
                      className={`flex h-9 sm:h-10 items-center justify-center rounded-xl border px-2 sm:px-3 text-[11px] sm:text-xs font-bold shadow-md transition focus-within:ring-2 ${activeHeader.btnBg} gap-1 relative pointer-events-auto`}
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
                        <option value="All (Default)" className="bg-slate-900 text-white p-2">
                          🌐 All (Default)
                        </option>
                        <option value="Russian" className="bg-slate-900 text-white p-2">
                          🇷🇺 Russian
                        </option>
                        <option value="British" className="bg-slate-900 text-white p-2">
                          🇬🇧 British
                        </option>
                        <option value="Hungarian" className="bg-slate-900 text-white p-2">
                          🇭🇺 Hungarian
                        </option>
                        <option value="German" className="bg-slate-900 text-white p-2">
                          🇩🇪 German
                        </option>
                      </select>
                    </div>
                  </div>

                  <Link
                    to="/watch-history"
                    className={`flex h-9 sm:h-10 items-center justify-center rounded-xl border px-2.5 sm:px-3 text-[11px] sm:text-xs font-bold shadow-md transition focus:outline-none focus:ring-2 shrink-0 ${activeHeader.btnBg}`}
                  >
                    🕒 History
                  </Link>

                  <button
                    type="button"
                    onClick={handleToggleSettings}
                    className={`flex h-9 sm:h-10 w-9 sm:w-10 items-center justify-center rounded-xl border text-base sm:text-lg shadow-md transition focus:outline-none focus:ring-2 shrink-0 ${activeHeader.btnBg}`}
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
              className={`fixed top-16 right-3 sm:right-6 z-50 w-96 max-w-[94vw] rounded-2xl border ${getCardBackground(appTheme)} px-4 py-4 backdrop-blur-xl shadow-2xl max-h-[85vh] overflow-y-auto box-border`}
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
                  <div className="space-y-3 bg-red-950/40 p-3.5 rounded-xl border border-red-500/40 box-border">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-red-300">
                      🔑 Admin Key Generator
                    </h4>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      Enter a user’s display name and age. The generated code
                      unlocks full access for that exact name + age pair.
                    </p>
                    <form onSubmit={handleKeygen} className="space-y-2">
                      <input
                        type="text"
                        placeholder="User name"
                        value={keygenName}
                        onChange={(e) => setKeygenName(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-xs font-bold text-white placeholder-slate-500 focus:outline-none"
                      />
                      <input
                        type="number"
                        min={1}
                        max={120}
                        placeholder="User age"
                        value={keygenAge}
                        onChange={(e) => setKeygenAge(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-xs font-bold text-white placeholder-slate-500 focus:outline-none"
                      />
                      <button
                        type="submit"
                        className="w-full py-2 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-bold text-white shadow transition"
                      >
                        Generate Unlock Code
                      </button>
                    </form>
                    {keygenResult && (
                      <div className="rounded-lg bg-black/50 border border-red-400/30 p-3 text-center">
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

                <div className="space-y-3 bg-black/30 p-3.5 rounded-xl border border-white/10 box-border">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
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
                        <label className="block text-[10px] uppercase font-semibold text-slate-400">
                          Enter Full Unlock Code:
                        </label>
                        <input
                          type="password"
                          placeholder="Unlock code for your name + age"
                          value={unlockCodeInput}
                          onChange={(e) => setUnlockCodeInput(e.target.value)}
                          className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-xs font-bold text-white placeholder-slate-500 focus:outline-none"
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
                <div className="space-y-3 bg-black/30 p-3.5 rounded-xl border border-white/10 box-border">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Age Lock
                  </h4>
                  <p className="text-[10px] text-slate-400">
                    Age is locked with the 4-digit code set at first login.
                    Enter that code to update age.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <span className="block text-[11px] text-slate-400 mb-1">
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
                        className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-xs font-bold text-white focus:outline-none box-border"
                      />
                    </div>
                    <div>
                      <span className="block text-[11px] text-slate-400 mb-1">
                        Age:
                      </span>
                      <input
                        type="number"
                        min={1}
                        max={120}
                        value={userAgeInput}
                        onChange={(e) => setUserAgeInput(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-xs font-bold text-white focus:outline-none box-border"
                      />
                    </div>
                  </div>

                  <form
                    onSubmit={handleUpdateAgeInSettings}
                    className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2 pt-1 w-full box-border"
                  >
                    <div className="flex-1">
                      <span className="block text-[11px] text-slate-400 mb-1">
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
                        className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-xs font-bold text-white focus:outline-none box-border tracking-widest"
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
                <div className="space-y-3 bg-black/30 p-3.5 rounded-xl border border-white/10 box-border">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Change Age-Lock Code
                  </h4>
                  <form
                    onSubmit={handleChangePasscodeInSettings}
                    className="space-y-2.5 box-border"
                  >
                    <div>
                      <span className="block text-[11px] text-slate-400 mb-1">
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
                        className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-xs font-bold text-white focus:outline-none box-border tracking-widest"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <span className="block text-[11px] text-slate-400 mb-1">
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
                          className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-xs font-bold text-white focus:outline-none box-border tracking-widest"
                        />
                      </div>
                      <div>
                        <span className="block text-[11px] text-slate-400 mb-1">
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
                          className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-xs font-bold text-white focus:outline-none box-border tracking-widest"
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
                <div className="space-y-3 bg-black/30 p-3.5 rounded-xl border border-white/10 box-border">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                    Accessibility
                  </span>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-white">
                        XL Mouse Pointer (3x)
                      </p>
                      <p className="text-[10px] text-slate-400">
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
                        <p className="text-[10px] text-slate-400">
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
                      <p className="text-[10px] text-slate-400">
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
              className={`fixed top-16 right-3 sm:right-6 z-50 w-96 max-w-[94vw] rounded-2xl border ${getCardBackground(appTheme)} px-4 py-4 backdrop-blur-xl shadow-2xl max-h-[80vh] overflow-y-auto`}
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

          {/* FIRST-START MODAL */}
          {showFirstStartModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4 backdrop-blur-md overflow-y-auto">
              <form
                onSubmit={handleFirstTimeAuthorize}
                className={`relative w-full max-w-xl my-8 rounded-2xl border text-white shadow-2xl ${getCardBackground(appTheme)}`}
              >
                <div className="p-6 md:p-8 space-y-5">
                  <div className="text-center space-y-2">
                    <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl overflow-hidden border border-red-500/30 shadow-lg bg-black">
                      <img
                        src={HEADER_ICON_URL}
                        alt="RABBiT TV Logo"
                        className="h-full w-full object-fill"
                      />
                    </div>
                    <h2
                      className={`text-2xl font-bold ${getPrimaryAccentColor(appTheme)}`}
                    >
                      Welcome to RABBiT TV
                    </h2>
                  </div>

                  <div className="space-y-3 text-sm leading-relaxed text-slate-300 text-center">
                    <p>
                      Get all your favorite movies and TV shows right here,
                      streaming smoothly in one place!
                    </p>
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
                      <strong>⏳ Trial:</strong> Enter <strong>`9654`</strong>{" "}
                      for a free 7-day trial (one-time per device). Full unlock
                      uses a personal code matched to your name and age.
                    </div>
                  </div>

                  <div className="space-y-2 border-t border-white/10 pt-4">
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
                      className="w-full rounded-xl border border-white/10 bg-slate-800 px-4 py-2.5 text-center text-base font-bold text-white placeholder-slate-500 focus:outline-none focus:ring-4 focus:ring-slate-500"
                    />
                  </div>

                  <div className="space-y-2 border-t border-white/10 pt-3">
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
                      className="w-full rounded-xl border border-white/10 bg-slate-800 px-4 py-2.5 text-center text-base font-bold text-white placeholder-slate-500 focus:outline-none focus:ring-4 focus:ring-slate-500"
                    />
                    {ageErrorNotice && (
                      <p className="text-xs font-semibold text-red-400 text-center">
                        ⚠️ Please enter your age.
                      </p>
                    )}
                  </div>

                  {/* Mandatory 4-digit age lock */}
                  <div className="space-y-2 border-t border-white/10 pt-3">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                      Create Age-Lock Code{" "}
                      <span className="text-red-400">*</span>
                    </label>
                    <p className="text-[11px] text-slate-400 text-center">
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
                      className="w-full rounded-xl border border-white/10 bg-slate-800 px-4 py-2.5 text-center text-lg font-bold tracking-[0.4em] text-white placeholder-slate-500 focus:outline-none focus:ring-4 focus:ring-slate-500"
                    />
                    {ageLockError && (
                      <p className="text-xs font-semibold text-red-400 text-center">
                        ⚠️ Enter a 4-digit age-lock code (numbers only).
                      </p>
                    )}
                  </div>

                  <div className="space-y-2 border-t border-white/10 pt-3">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Select Startup Theme:
                    </label>
                    <div className="grid grid-cols-3 gap-2 sm:gap-3">
                      {allThemesList.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => handleThemeChange(t.id)}
                          className={`rounded-xl border py-2.5 text-xs font-bold transition focus:outline-none focus:ring-4 ${
                            appTheme === t.id
                              ? `border-white/30 ${getPrimaryBgColor(t.id)} text-white shadow-lg`
                              : "border-white/10 bg-slate-800 text-slate-300 hover:bg-slate-700"
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2 border-t border-white/10 pt-3">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Select Display Size:
                    </label>
                    <div className="grid grid-cols-3 gap-2 sm:gap-3">
                      {(["small", "medium", "large"] as CardSize[]).map(
                        (size) => (
                          <button
                            key={size}
                            type="button"
                            onClick={() => handleSizeChange(size)}
                            className={`rounded-xl border py-2.5 text-xs font-bold transition focus:outline-none focus:ring-4 ${
                              cardSize === size
                                ? `border-white/30 ${getPrimaryBgColor(appTheme)} text-white shadow-lg`
                                : "border-white/10 bg-slate-800 text-slate-300 hover:bg-slate-700"
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
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                        XL Mouse Pointer
                      </label>
                      <p className="text-[11px] text-slate-400">
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

                  <div className="space-y-3 border-t border-white/10 pt-4">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Unlock Code or Trial (`9654`):
                    </label>
                    <input
                      type="text"
                      maxLength={12}
                      value={passcodeInput}
                      onChange={(e) => setPasscodeInput(e.target.value)}
                      placeholder="Unlock code or 9654"
                      className="w-full rounded-xl border border-white/10 bg-slate-800 px-4 py-3 text-center text-lg font-bold tracking-widest text-white placeholder-slate-500 focus:outline-none focus:ring-4 focus:ring-slate-500"
                    />
                    {passcodeError && (
                      <p className="text-xs font-semibold text-red-400 text-center">
                        {passcodeErrorMsg}
                      </p>
                    )}
                    <button
                      type="submit"
                      className={`w-full rounded-xl ${getPrimaryBgColor(appTheme)} py-3.5 text-base font-bold text-white shadow-lg transition active:scale-95 focus:outline-none focus:ring-4`}
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
