// src/routes/__root.tsx
import React, { useState, useEffect, useRef } from "react";
import { BugReportModal } from "@/components/BugReportModal";
import { PublicBugFeedModal } from "@/components/PublicBugFeedModal";
import { UserNotifier } from "@/components/UserNotifier";
import { Screensaver } from "@/components/Screensaver";
import {
  Outlet,
  createRootRoute,
  HeadContent,
  Scripts,
  Link,
  useNavigate,
} from "@tanstack/react-router";
import { AuthProvider } from "@/components/auth-provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { HolidayOverlay } from "@/components/HolidayOverlay";
import { AppWallpaper } from "@/components/AppWallpaper";
import { ActivationModal } from "@/components/ActivationModal";
import {
  Sidebar,
  GlobalFeedOption,
  getDefaultHeartbeatStationUrl,
} from "@/components/sidebar";
import { bgAudio } from "@/lib/background-audio";
import "@/styles.css";
import { StatusBar, Style } from "@capacitor/status-bar";
import { checkForAppUpdates } from "@/lib/updater";
import {
  CardSize,
  StreamQuality,
  AppTheme,
  HistoryScale,
  CursorStyle,
  DISCLAIMER_ACCEPTED_KEY,
  getSavedCardSize,
  saveCardSize,
  getSavedStreamQuality,
  getSavedTheme,
  saveTheme,
  getHelpfulMouse,
  setHelpfulMouse,
  setHistoryOverscale,
  getHistoryOverscale,
  getLargeButtons,
  setLargeButtons,
  applyAllSettingsToDocument,
  getOrCreateDeviceId,
  getCursorStyle,
  getCursorSvgDataUri,
  getProfileMascot,
  getShowCornerClock,
  getClockFormat,
  formatAppTime,
  getSleepTimerMinutes,
  setSleepTimerMinutes,
  getUiClickSounds,
  playSoftUiClick,
  getKidsModeLocked,
  getStartupTab,
  getAgeLockPinSuffix,
  purgeOldTmdbCaches,
} from "@/lib/settings";

export type { GlobalFeedOption };

const TRIAL_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
const STARTUP_ROUTED_KEY = "rabtv_startup_tab_applied";

const HEADER_ICON_URL = "https://avatars.githubusercontent.com/u/330663733?v=4";

const RABBITHEADERWALL =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/HeaderPirate.jpg";

const RABBIT_LOGO_URL =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/1794279353317.jpg";

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
    // ignore outside native Capacitor shell
  }
}

function verifyCurrentAccess(): boolean {
  if (typeof window === "undefined") return false;
  const status = localStorage.getItem("rabtv_access_status");
  const profileName = localStorage.getItem("rabtv_profile_name");

  if (!status || !profileName) return false;

  if (status === "permanent") return true;
  if (status === "trial") {
    const startTime = Number(
      localStorage.getItem("rabtv_trial_start_timestamp") || 0
    );
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

/**
 * Global Crash-Recovery Error Boundary so corrupted TMDB data or memory glitches
 * never leave users stuck on a blank screen.
 */
class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; errorMessage: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      errorMessage: error?.message || "Unexpected rendering error",
    };
  }

  componentDidCatch(error: Error) {
    console.error("RABBiT TV caught route error:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-auto my-12 max-w-lg rounded-3xl border border-red-500/40 bg-slate-950/90 p-6 sm:p-8 text-center shadow-2xl space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-600/20 border border-red-400/40 text-3xl">
            🛠️
          </div>
          <h2 className="text-xl font-black text-white">
            Oops — This Screen Hit a Bump
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Your saved lists, license, and watch history are completely safe.
            Tap below to reload cleanly.
          </p>
          <p className="rounded-xl bg-black/60 border border-white/10 p-2 text-[10px] font-mono text-red-300 truncate">
            {this.state.errorMessage}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 py-3 px-4 text-xs font-black text-white shadow-lg cursor-pointer"
            >
              🔄 Reload App
            </button>
            <button
              type="button"
              onClick={() => {
                purgeOldTmdbCaches();
                window.location.href = "/";
              }}
              className="rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 py-3 px-4 text-xs font-extrabold text-amber-300 cursor-pointer"
            >
              🧹 Clear Cache & Fix
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
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

  const [cardSize, setCardSize] = useState<CardSize>("large");
  const [streamQuality, setStreamQuality] = useState<StreamQuality>("1080p");
  const [appTheme, setAppTheme] = useState<AppTheme>("violet");
  const [helpfulMouse, setHelpfulMouseState] = useState(false);
  const [cursorStyle, setCursorStyleState] = useState<CursorStyle>("white");
  const [historyOverscale, setHistoryOverscaleState] =
    useState<HistoryScale>("off");
  const [largeButtons, setLargeButtonsState] = useState(false);
  const [profileMascot, setProfileMascotState] = useState<string>("🐰");
  const [kidsLocked, setKidsLockedState] = useState<boolean>(false);
  const [showCornerClock, setShowCornerClockState] = useState<boolean>(false);
  const [cornerClockText, setCornerClockText] = useState<string>("");
  const [isOffline, setIsOffline] = useState<boolean>(false);

  const [userAgeInput, setUserAgeInput] = useState<string>("");
  const [profileNameInput, setProfileNameInput] = useState<string>("");
  const [savedProfileName, setSavedProfileName] = useState<string>("");

  const [bgMusicState, setBgMusicState] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("rabtv_bg_music_state") || "playing";
    }
    return "playing";
  });

  const [isTrialActive, setIsTrialActive] = useState(false);
  const [trialDaysRemaining, setTrialDaysRemaining] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [headerSearchInput, setHeaderSearchInput] = useState("");

  const sleepTimerRef = useRef<number | null>(null);

  const handleHeaderSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!headerSearchInput.trim()) return;
    navigate({ to: "/search", search: { q: headerSearchInput.trim() } });
    setHeaderSearchInput("");
  };

  const handleOpenExternal = async (url: string, e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    try {
      if (typeof window !== "undefined" && (window as any).Capacitor) {
        const browserModule = await import(
          /* @vite-ignore */ "@capacitor/browser"
        );
        await browserModule.Browser.open({
          url,
          presentationStyle: "popover",
        });
        return;
      }
    } catch (err) {
      console.warn(
        "Could not open via Capacitor Browser, using fallback",
        err
      );
    }
    if (typeof window !== "undefined") {
      window.open(url, "_blank");
    }
  };

  // Delayed app update check
  useEffect(() => {
    const updateTimer = window.setTimeout(() => {
      void checkForAppUpdates(true);
    }, 3000);
    return () => window.clearTimeout(updateTimer);
  }, []);

  // Ensure default radio station is Heartbeat Radio (2000s)
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      !localStorage.getItem("rabtv_radio_url")
    ) {
      const defaultHeartbeat = getDefaultHeartbeatStationUrl();
      if (defaultHeartbeat) {
        bgAudio.setStation(defaultHeartbeat);
      }
    }
  }, []);

  // Background lobby audio lifecycle
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
      if (
        path.includes("details") ||
        path.includes("watch") ||
        path.includes("player")
      ) {
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

  // Global soft remote click sound (single delegated listener, zero per-button cost)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleGlobalClick = (e: MouseEvent) => {
      if (!getUiClickSounds()) return;
      const target = e.target as HTMLElement | null;
      if (target && target.closest("button, a, select, [role='button']")) {
        playSoftUiClick();
      }
    };
    window.addEventListener("click", handleGlobalClick, { passive: true });
    return () => window.removeEventListener("click", handleGlobalClick);
  }, []);

  // Live Wi-Fi online/offline monitor for streaming sticks
  useEffect(() => {
    if (typeof window === "undefined") return;
    setIsOffline(!navigator.onLine);
    const goOffline = () => setIsOffline(true);
    const goOnline = () => setIsOffline(false);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  // Couch Corner Clock updater (runs only when user turns it on)
  useEffect(() => {
    if (!showCornerClock || typeof window === "undefined") return;
    const refreshClock = () =>
      setCornerClockText(formatAppTime(new Date(), getClockFormat()));
    refreshClock();
    const interval = window.setInterval(refreshClock, 15000);
    return () => window.clearInterval(interval);
  }, [showCornerClock]);

  // Active Couch Sleep Timer Engine
  useEffect(() => {
    const armSleepTimer = () => {
      if (sleepTimerRef.current) {
        window.clearTimeout(sleepTimerRef.current);
        sleepTimerRef.current = null;
      }
      const minutes = getSleepTimerMinutes();
      if (minutes > 0 && typeof window !== "undefined") {
        sleepTimerRef.current = window.setTimeout(() => {
          // Pause all active media & lobby radio
          bgAudio.pause();
          document.querySelectorAll("video, audio").forEach((el) => {
            try {
              (el as HTMLMediaElement).pause();
            } catch {
              // ignore
            }
          });
          setSleepTimerMinutes(0);
          window.dispatchEvent(new Event("rabtv_sleep_timer_triggered"));
        }, minutes * 60 * 1000);
      }
    };

    armSleepTimer();
    window.addEventListener("rabtv_settings_updated", armSleepTimer);
    return () => {
      if (sleepTimerRef.current) window.clearTimeout(sleepTimerRef.current);
      window.removeEventListener("rabtv_settings_updated", armSleepTimer);
    };
  }, []);

  // Initial boot, Fire OS detection, document attributes, and startup tab routing
  useEffect(() => {
    if (typeof window !== "undefined") {
      getOrCreateDeviceId();
      applyAllSettingsToDocument();

      const ua = navigator.userAgent.toLowerCase();
      if (
        ua.includes("silk") ||
        ua.includes("firetv") ||
        ua.includes("amazon")
      ) {
        document.documentElement.classList.add("fire-os");
      }
    }

    const authorized = verifyCurrentAccess();
    if (!authorized) {
      setShowFirstStartModal(true);
    } else {
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
        setTrialDaysRemaining(
          Math.ceil(remainingMs / (1000 * 60 * 60 * 24))
        );
      }

      // Route once per session to the user's chosen Favorite Startup Tab if landing on "/"
      if (
        typeof window !== "undefined" &&
        window.location.pathname === "/" &&
        !window.location.search &&
        !sessionStorage.getItem(STARTUP_ROUTED_KEY)
      ) {
        sessionStorage.setItem(STARTUP_ROUTED_KEY, "true");
        const prefTab = getStartupTab();
        if (prefTab === "Live TV") {
          navigate({ to: "/live-tv" });
        } else if (prefTab === "Watch History") {
          navigate({ to: "/watch-history" });
        } else if (
          prefTab === "Movies" ||
          prefTab === "TV Shows" ||
          prefTab === "My List"
        ) {
          navigate({ to: "/", search: { tab: prefTab } });
        }
      }
    }

    const syncRootStateFromSettings = () => {
      applyAllSettingsToDocument();
      const updatedTheme = getSavedTheme();
      setCardSize(getSavedCardSize());
      setStreamQuality(getSavedStreamQuality());
      setAppTheme(updatedTheme);
      setHelpfulMouseState(getHelpfulMouse());
      setCursorStyleState(getCursorStyle());
      setHistoryOverscaleState(getHistoryOverscale());
      setLargeButtonsState(getLargeButtons());
      setProfileMascotState(getProfileMascot());
      setKidsLockedState(getKidsModeLocked());
      setShowCornerClockState(getShowCornerClock());
      setCornerClockText(formatAppTime(new Date(), getClockFormat()));
      void updateNativeStatusBar(updatedTheme);

      const updatedAge = localStorage.getItem("rabtv_user_age");
      if (updatedAge) setUserAgeInput(updatedAge);

      const updatedName = localStorage.getItem("rabtv_profile_name");
      if (updatedName) {
        setProfileNameInput(updatedName);
        setSavedProfileName(updatedName);
      }

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
        setTrialDaysRemaining(
          Math.ceil(remainingMs / (1000 * 60 * 60 * 24))
        );
      } else {
        setIsTrialActive(false);
      }
    };

    syncRootStateFromSettings();
    window.addEventListener("rabtv_settings_updated", syncRootStateFromSettings);
    return () =>
      window.removeEventListener(
        "rabtv_settings_updated",
        syncRootStateFromSettings
      );
  }, [navigate]);

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
        return "bg-red-950/40 backdrop-blur-xl";
      case "midnight":
        return "bg-blue-950/40 backdrop-blur-xl";
      case "emerald":
        return "bg-emerald-950/40 backdrop-blur-xl";
      case "amber":
        return "bg-yellow-950/40 backdrop-blur-xl";
      case "cyan":
        return "bg-cyan-950/40 backdrop-blur-xl";
      case "violet":
      default:
        return "bg-purple-950/40 backdrop-blur-xl";
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

  const allThemesList: { id: AppTheme; label: string }[] = [
    { id: "violet", label: "🟣 Violet / Neon" },
    { id: "red", label: "🔴 Red & Black" },
    { id: "midnight", label: "🔵 Midnight & Black" },
    { id: "emerald", label: "🟢 Emerald / Teal" },
    { id: "amber", label: "🟠 Amber / Gold" },
    { id: "cyan", label: "🔷 Cyan / Sky" },
  ];

  const activeCursorUri = helpfulMouse ? getCursorSvgDataUri(cursorStyle) : "";

  return (
    <html lang="en" data-theme={appTheme}>
      <head>
        <HeadContent />
        {helpfulMouse && activeCursorUri && (
          <style>{`
            *, button, a, select, input, [role="button"] {
              cursor: ${activeCursorUri}, auto !important;
            }
          `}</style>
        )}
      </head>
      <body
        className={`min-h-screen max-w-full overflow-x-hidden ${getBodyBackground(
          appTheme
        )} text-slate-100 antialiased transition-colors duration-300 relative`}
      >
        <PreviewHostBridge />
        <HolidayOverlay />
        <AppWallpaper />
        <Screensaver />
        <AuthProvider>
          {/* Live Wi-Fi Offline Warning Banner */}
          {isOffline && (
            <div className="rabtv-vidsrc-protected sticky top-0 z-50 w-full bg-red-700/95 border-b border-red-400/60 px-4 py-2 text-center text-xs font-extrabold text-white shadow-lg">
              📡 No Internet Connection — Waiting for Wi-Fi to reconnect...
            </div>
          )}

          <header
            className={`rabtv-vidsrc-protected sticky top-0 z-40 border-b border-white/10 transition-colors duration-300 relative overflow-hidden ${getHeaderThemeBg(
              appTheme
            )} ${getThemeGlowClass(appTheme)}`}
          >
            {/* Streamlined Cinema Glass Header Background */}
            <div className="absolute inset-0 pointer-events-none opacity-25">
              <img
                src={RABBITHEADERWALL}
                alt=""
                className="w-full h-full object-cover object-center"
              />
            </div>
            <div className="absolute inset-0 bg-black/60 pointer-events-none" />

            <div className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-3 sm:px-6 py-2.5 gap-2 sm:gap-4">
              {/* Left group: Crisp Non-Pulsing Neon Rabbit Logo */}
              <div className="flex items-center shrink-0">
                <Link
                  to="/"
                  className={`flex items-center gap-2 w-[110px] sm:w-[150px] md:w-[170px] h-10 sm:h-11 px-2.5 rounded-xl bg-black/60 backdrop-blur-md border border-white/25 text-white focus:outline-none transition-all ${getThemeGlowClass(
                    appTheme
                  )}`}
                  style={{
                    backgroundImage: `url(${RABBIT_LOGO_URL})`,
                    backgroundSize: "cover",
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "center center",
                  }}
                >
                  <div className="absolute inset-0 bg-black/25 rounded-xl pointer-events-none" />
                </Link>
              </div>

              {/* Unified Prime / Netflix Search Bar with Icon Inside */}
              {!showFirstStartModal && (
                <form
                  onSubmit={handleHeaderSearchSubmit}
                  className="relative flex items-center flex-1 max-w-xl mx-2"
                >
                  <span className="absolute left-3.5 z-10 text-slate-400 text-xs sm:text-sm pointer-events-none">
                    🔍
                  </span>
                  <input
                    type="text"
                    value={headerSearchInput}
                    onChange={(e) => setHeaderSearchInput(e.target.value)}
                    placeholder="Search movies, TV shows..."
                    className="h-10 sm:h-11 w-full rounded-xl border border-white/15 bg-black/60 pl-9 pr-3 text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-400 backdrop-blur-xl shadow-inner transition-all"
                  />
                </form>
              )}

              {/* Far Right: Profile Pill with Mascot & Kids Lock Indicator */}
              {savedProfileName && !showFirstStartModal && (
                <div className="flex items-center gap-1.5 shrink-0">
                  {kidsLocked && (
                    <span
                      className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[10px] font-extrabold uppercase tracking-wider"
                      title="Kids Safe Mode Locked"
                    >
                      🧒 Kids
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowProfileMenu((prev) => !prev)}
                    className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs font-bold text-white shadow-lg transition cursor-pointer group relative overflow-hidden border border-white/20 ${
                      activeHeader.btnBg
                    } ${getThemeGlowClass(appTheme)}`}
                  >
                    <div className="w-5 h-5 rounded-full overflow-hidden border border-white/30 bg-slate-800 shrink-0">
                      <img
                        src={HEADER_ICON_URL}
                        alt="Avatar"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <span className="truncate max-w-[90px] sm:max-w-[140px] md:max-w-none text-xs">
                      <span className="mr-1">{profileMascot}</span>
                      <strong className="text-white">{savedProfileName}</strong>{" "}
                      {isAdmin
                        ? "(Admin)"
                        : isTrialActive
                          ? `(${trialDaysRemaining}d)`
                          : ""}
                    </span>
                    <span className="text-[10px] text-slate-300 group-hover:translate-x-0.5 transition-transform">
                      ☰
                    </span>
                  </button>

                  {isTrialActive && (
                    <div className="hidden md:flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[11px] font-bold">
                      <span>⏳ {trialDaysRemaining}d</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </header>

          {/* STANDALONE SIDE BLADE COMPONENT */}
          <Sidebar
            isOpen={showProfileMenu && !showFirstStartModal}
            onClose={() => setShowProfileMenu(false)}
            appTheme={appTheme}
            cardSize={cardSize}
            streamQuality={streamQuality}
            helpfulMouse={helpfulMouse}
            historyOverscale={historyOverscale}
            largeButtons={largeButtons}
            savedProfileName={savedProfileName}
            setSavedProfileName={setSavedProfileName}
            userAgeInput={userAgeInput}
            setUserAgeInput={setUserAgeInput}
            profileNameInput={profileNameInput}
            setProfileNameInput={setProfileNameInput}
            isAdmin={isAdmin}
            isTrialActive={isTrialActive}
            setIsTrialActive={setIsTrialActive}
            trialDaysRemaining={trialDaysRemaining}
            bgMusicState={bgMusicState}
            onBackgroundAudioToggle={handleBackgroundAudioToggle}
            onThemeChange={handleThemeChange}
            onSizeChange={handleSizeChange}
            onMouseToggle={handleMouseToggle}
            onHistoryOverscaleChange={handleHistoryOverscaleChange}
            onLargeButtonsToggle={handleLargeButtonsToggle}
            onOpenBugModal={() => setShowBugModal(true)}
            onOpenBugFeedModal={() => setShowBugFeedModal(true)}
            onTriggerFirstStartModal={() => setShowFirstStartModal(true)}
            headerIconUrl={HEADER_ICON_URL}
            allThemesList={allThemesList}
            getPrimaryBgColor={getPrimaryBgColor}
            getPrimaryAccentColor={getPrimaryAccentColor}
          />

          {/* Main Route Container with TV Overscan Safe-Zone & Crash Shield */}
          <main className="rabtv-vidsrc-protected rabtv-overscan-shell mx-auto max-w-7xl px-4 py-4 sm:px-6 md:py-6 overflow-x-hidden pb-20">
            <AppErrorBoundary>
              <Outlet />
            </AppErrorBoundary>
          </main>

          {/* Optional Couch Corner Clock */}
          {showCornerClock && cornerClockText && !showFirstStartModal && (
            <div className="rabtv-vidsrc-protected fixed bottom-4 left-4 z-30 pointer-events-none rounded-xl bg-black/65 border border-white/15 px-3 py-1.5 shadow-xl backdrop-blur-md">
              <span className="text-xs font-extrabold tracking-wider text-slate-100">
                🕒 {cornerClockText}
              </span>
            </div>
          )}

          {/* USER NOTIFICATION LISTENER TOAST */}
          <UserNotifier appTheme={appTheme} />

          {/* BUG REPORT MODAL */}
          <BugReportModal
            isOpen={showBugModal}
            onClose={() => setShowBugModal(false)}
            userName={savedProfileName || "Friend"}
            userUnlockCode={getAgeLockPinSuffix()}
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
