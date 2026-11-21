// src/routes/__root.tsx
import React, { useState, useEffect, useRef, memo, useCallback } from "react";
import { BugReportModal } from "@/components/BugReportModal";
import { PublicBugFeedModal } from "@/components/PublicBugFeedModal";
import { UserNotifier } from "@/components/UserNotifier";
import { Screensaver } from "@/components/Screensaver";
import { SplashIntro } from "@/components/SplashIntro";
import { ProfileSwitcherModal } from "@/components/ProfileSwitcherModal";
import { MascotAvatar } from "@/components/MascotAvatar";
import {
  getActiveMascotBadge,
  MASCOT_UPDATED_EVENT,
} from "@/lib/mascots";
import {
  ensurePrimaryProfileInitialized,
  OPEN_PROFILE_SWITCHER_EVENT,
  PROFILES_UPDATED_EVENT,
} from "@/lib/profiles";
import {
  Outlet,
  createRootRoute,
  HeadContent,
  Scripts,
  Link,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { AuthProvider } from "@/components/auth-provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { HolidayOverlay } from "@/components/HolidayOverlay";
import { AppWallpaper } from "@/components/AppWallpaper";
import { ActivationModal } from "@/components/ActivationModal";
import {
  InteractiveWalkthrough,
  SIDEBAR_TOGGLE_EVENT,
  triggerRabbitWalkthrough,
} from "@/components/InteractiveWalkthrough";
import {
  TermsOfServiceModal,
  TOS_OPEN_EVENT,
  hasAcceptedTos,
} from "@/components/TermsOfServiceModal";
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
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rootheaderrabbittv.jpg";

const RABBIT_LOGO_URL =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/homelogo.png";

const SIDEBAR_BUTTON_BG_URL =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/sidebar.png";

const SEARCHWRAPPER =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/search.png";

export const BUTTON_WRAPPER_URL =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/buttonwrapper.png";

/**
 * Viewport-locked header geometry so logo, search wrapper, search button, and
 * profile pill keep exact proportions and alignment across portrait phones,
 * landscape phones, tablets, TVs, and projectors.
 */
const VIEWPORT_HEADER_STYLES = `
  .rabtv-hdr-bar {
    --hdr-u: clamp(35px, 11vw, 52px);
    min-height: calc(var(--hdr-u) * 3.25);
  }

  .rabtv-hdr-inner {
    width: 100%;
    max-width: 1440px;
    margin-inline: auto;
    padding: clamp(10px, 2.6vw, 16px) clamp(8px, 2.4vw, 24px);
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    row-gap: clamp(8px, 2.2vw, 14px);
    column-gap: clamp(6px, 1.8vw, 16px);
  }

  .rabtv-hdr-logo-wrap {
    order: 1;
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    max-width: calc(100% - (var(--hdr-u) * 4.15));
  }

  .rabtv-hdr-logo {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    height: calc(var(--hdr-u) * 1.52);
    width: calc(var(--hdr-u) * 4.25);
    max-width: 100%;
    flex: 0 0 auto;
  }

  .rabtv-hdr-profile-wrap {
    order: 2;
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: clamp(4px, 0.8vw, 10px);
  }

  .rabtv-hdr-profile-btn {
    position: relative;
    display: flex;
    align-items: center;
    height: calc(var(--hdr-u) * 1.22);
    width: calc(var(--hdr-u) * 1.22 * 3.3);
    padding-left: 37%;
    padding-right: 17.5%;
    flex: 0 0 auto;
    box-sizing: border-box;
  }

  .rabtv-hdr-profile-avatar {
    position: absolute;
    left: 20.8%;
    top: 50%;
    transform: translate(-50%, -50%);
    height: 76%;
    aspect-ratio: 1 / 1;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 9999px;
    overflow: hidden;
    pointer-events: none;
  }

  .rabtv-hdr-profile-label {
    display: block;
    width: 100%;
    min-width: 0;
    text-align: left;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.15;
    font-size: clamp(10px, calc(var(--hdr-u) * 0.27), 14px);
  }

  .rabtv-hdr-search-form {
    order: 3;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: clamp(6px, 1.6vw, 14px);
    min-width: 0;
  }

  .rabtv-hdr-search-shell {
    position: relative;
    display: flex;
    align-items: center;
    height: var(--hdr-u);
    width: calc(var(--hdr-u) * 5.8);
    max-width: calc(100% - (var(--hdr-u) * 2.3) - clamp(6px, 1.6vw, 14px));
    flex: 0 1 auto;
    box-sizing: border-box;
  }

  .rabtv-hdr-search-input {
    position: relative;
    z-index: 10;
    width: 100%;
    height: 100%;
    min-width: 0;
    padding-left: 15.5%;
    padding-right: 27%;
    padding-top: 0;
    padding-bottom: 0;
    line-height: 1;
    font-size: clamp(11px, calc(var(--hdr-u) * 0.3), 16px);
    box-sizing: border-box;
  }

  .rabtv-hdr-search-pill-hit {
    position: absolute;
    z-index: 20;
    right: 2%;
    top: 10%;
    bottom: 10%;
    width: 23%;
    border: 0;
    background: transparent;
    border-radius: 9999px;
    cursor: pointer;
  }

  .rabtv-hdr-search-btn {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    height: var(--hdr-u);
    width: calc(var(--hdr-u) * 2.3);
    padding: 0 8px;
    flex: 0 0 auto;
    font-size: clamp(10px, calc(var(--hdr-u) * 0.27), 15px);
    line-height: 1;
    box-sizing: border-box;
  }

  @media (min-width: 640px) {
    .rabtv-hdr-bar {
      --hdr-u: clamp(35px, 5.4vw, 60px);
      min-height: clamp(82px, 10.5vw, 140px);
    }

    .rabtv-hdr-inner {
      flex-wrap: nowrap;
      padding: clamp(8px, 1.3vw, 20px) clamp(10px, 2vw, 28px);
      column-gap: clamp(8px, 1.3vw, 20px);
    }

    .rabtv-hdr-logo-wrap {
      max-width: none;
    }

    .rabtv-hdr-logo {
      height: calc(var(--hdr-u) * 1.42);
      width: calc(var(--hdr-u) * 3.95);
    }

    .rabtv-hdr-search-form {
      order: 2;
      width: auto;
      flex: 1 1 auto;
      justify-content: center;
      gap: clamp(6px, 1vw, 14px);
    }

    .rabtv-hdr-search-shell {
      width: calc(var(--hdr-u) * 5.5);
    }

    .rabtv-hdr-profile-wrap {
      order: 3;
    }

    .rabtv-hdr-profile-btn {
      height: calc(var(--hdr-u) * 1.16);
      width: calc(var(--hdr-u) * 1.16 * 3.3);
    }

    .rabtv-hdr-profile-label {
      font-size: clamp(10px, calc(var(--hdr-u) * 0.25), 14px);
    }
  }
`;

const themeStatusBarMap: Record<AppTheme, string> = {
  violet: "#0f0728",
  red: "#180505",
  midnight: "#050b1a",
  emerald: "#021a12",
  amber: "#1c1505",
  cyan: "#021820",
};

interface RootThemeTokens {
  bodyBg: string;
  bodyText: string;
  headerBg: string;
  headerBorder: string;
  glowClass: string;
  cardBg: string;
  profileBtn: string;
  avatarFrame: string;
  searchInput: string;
  searchIcon: string;
  searchSubmitBtn: string;
  trialBadge: string;
  footerShell: string;
  footerText: string;
  footerSubText: string;
  footerLink: string;
  footerBtn: string;
  footerVersion: string;
  clockPill: string;
  primaryAccent: string;
  primaryBg: string;
  focusRing: string;
  artTint: string;
}

function getRootThemeTokens(theme: AppTheme): RootThemeTokens {
  switch (theme) {
    case "red":
      return {
        bodyBg: "bg-gradient-to-br from-zinc-950/78 via-red-950/30 to-black/82",
        bodyText: "text-zinc-100",
        headerBg: "bg-red-950/25 backdrop-blur-md",
        headerBorder: "border-red-500/35",
        glowClass: "border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.38)]",
        cardBg: "bg-zinc-950/90 border-red-500/30 shadow-2xl backdrop-blur-xl",
        profileBtn: "text-red-100",
        avatarFrame: "bg-transparent",
        searchInput:
          "border-red-500/30 bg-black/55 text-white placeholder-zinc-300 focus:ring-2 focus:ring-red-500 focus:border-red-400/60",
        searchIcon: "text-red-300",
        searchSubmitBtn: "text-red-100 hover:text-white",
        trialBadge:
          "bg-red-950/50 border-red-500/35 text-red-200 backdrop-blur-md",
        footerShell:
          "border-red-500/20 bg-zinc-950/55 shadow-[0_8px_30px_rgba(239,68,68,0.12)]",
        footerText: "text-zinc-300",
        footerSubText: "text-zinc-400",
        footerLink: "text-red-300 hover:text-red-200",
        footerBtn:
          "bg-red-950/45 hover:bg-red-900/70 border-red-500/30 text-red-100 hover:text-white backdrop-blur-sm",
        footerVersion:
          "bg-black/50 border-red-500/25 text-zinc-300",
        clockPill:
          "bg-zinc-950/60 border-red-500/35 text-red-100 backdrop-blur-md shadow-[0_6px_20px_rgba(239,68,68,0.2)]",
        primaryAccent: "text-red-400",
        primaryBg:
          "bg-gradient-to-r from-red-600 via-rose-600 to-orange-600 text-white shadow-lg shadow-red-600/30",
        focusRing: "focus:ring-red-500",
        artTint: "bg-red-950/15",
      };
    case "midnight":
      return {
        bodyBg: "bg-gradient-to-br from-slate-950/78 via-blue-950/30 to-black/82",
        bodyText: "text-slate-100",
        headerBg: "bg-blue-950/25 backdrop-blur-md",
        headerBorder: "border-blue-500/35",
        glowClass: "border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.38)]",
        cardBg: "bg-slate-950/90 border-blue-500/30 shadow-2xl backdrop-blur-xl",
        profileBtn: "text-blue-100",
        avatarFrame: "bg-transparent",
        searchInput:
          "border-blue-500/30 bg-black/55 text-white placeholder-slate-300 focus:ring-2 focus:ring-sky-400 focus:border-sky-400/60",
        searchIcon: "text-sky-300",
        searchSubmitBtn: "text-sky-100 hover:text-white",
        trialBadge:
          "bg-blue-950/50 border-blue-500/35 text-sky-200 backdrop-blur-md",
        footerShell:
          "border-blue-500/20 bg-slate-950/55 shadow-[0_8px_30px_rgba(59,130,246,0.12)]",
        footerText: "text-slate-300",
        footerSubText: "text-slate-400",
        footerLink: "text-sky-300 hover:text-sky-200",
        footerBtn:
          "bg-blue-950/45 hover:bg-blue-900/70 border-blue-500/30 text-blue-100 hover:text-white backdrop-blur-sm",
        footerVersion:
          "bg-black/50 border-blue-500/25 text-slate-300",
        clockPill:
          "bg-slate-950/60 border-blue-500/35 text-sky-100 backdrop-blur-md shadow-[0_6px_20px_rgba(59,130,246,0.2)]",
        primaryAccent: "text-sky-300",
        primaryBg:
          "bg-gradient-to-r from-blue-600 via-cyan-600 to-sky-600 text-white shadow-lg shadow-blue-600/30",
        focusRing: "focus:ring-sky-400",
        artTint: "bg-blue-950/15",
      };
    case "emerald":
      return {
        bodyBg: "bg-gradient-to-br from-neutral-950/78 via-emerald-950/30 to-black/82",
        bodyText: "text-neutral-100",
        headerBg: "bg-emerald-950/25 backdrop-blur-md",
        headerBorder: "border-emerald-500/35",
        glowClass: "border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.38)]",
        cardBg: "bg-neutral-950/90 border-emerald-500/30 shadow-2xl backdrop-blur-xl",
        profileBtn: "text-emerald-100",
        avatarFrame: "bg-transparent",
        searchInput:
          "border-emerald-500/30 bg-black/55 text-white placeholder-neutral-300 focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400/60",
        searchIcon: "text-emerald-300",
        searchSubmitBtn: "text-emerald-100 hover:text-white",
        trialBadge:
          "bg-emerald-950/50 border-emerald-500/35 text-emerald-200 backdrop-blur-md",
        footerShell:
          "border-emerald-500/20 bg-neutral-950/55 shadow-[0_8px_30px_rgba(16,185,129,0.12)]",
        footerText: "text-neutral-300",
        footerSubText: "text-neutral-400",
        footerLink: "text-emerald-300 hover:text-emerald-200",
        footerBtn:
          "bg-emerald-950/45 hover:bg-emerald-900/70 border-emerald-500/30 text-emerald-100 hover:text-white backdrop-blur-sm",
        footerVersion:
          "bg-black/50 border-emerald-500/25 text-neutral-300",
        clockPill:
          "bg-neutral-950/60 border-emerald-500/35 text-emerald-100 backdrop-blur-md shadow-[0_6px_20px_rgba(16,185,129,0.2)]",
        primaryAccent: "text-emerald-300",
        primaryBg:
          "bg-gradient-to-r from-emerald-600 via-teal-600 to-green-600 text-white shadow-lg shadow-emerald-600/30",
        focusRing: "focus:ring-emerald-400",
        artTint: "bg-emerald-950/15",
      };
    case "amber":
      return {
        bodyBg: "bg-gradient-to-br from-stone-950/78 via-yellow-950/30 to-black/82",
        bodyText: "text-stone-100",
        headerBg: "bg-yellow-950/25 backdrop-blur-md",
        headerBorder: "border-amber-500/35",
        glowClass: "border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.38)]",
        cardBg: "bg-stone-950/90 border-amber-500/30 shadow-2xl backdrop-blur-xl",
        profileBtn: "text-amber-100",
        avatarFrame: "bg-transparent",
        searchInput:
          "border-amber-500/30 bg-black/55 text-white placeholder-stone-300 focus:ring-2 focus:ring-amber-400 focus:border-amber-400/60",
        searchIcon: "text-amber-300",
        searchSubmitBtn: "text-amber-100 hover:text-white",
        trialBadge:
          "bg-amber-950/50 border-amber-500/35 text-amber-200 backdrop-blur-md",
        footerShell:
          "border-amber-500/20 bg-stone-950/55 shadow-[0_8px_30px_rgba(245,158,11,0.12)]",
        footerText: "text-stone-300",
        footerSubText: "text-stone-400",
        footerLink: "text-amber-300 hover:text-amber-200",
        footerBtn:
          "bg-amber-950/45 hover:bg-amber-900/70 border-amber-500/30 text-amber-100 hover:text-white backdrop-blur-sm",
        footerVersion:
          "bg-black/50 border-amber-500/25 text-stone-300",
        clockPill:
          "bg-stone-950/60 border-amber-500/35 text-amber-100 backdrop-blur-md shadow-[0_6px_20px_rgba(245,158,11,0.2)]",
        primaryAccent: "text-amber-300",
        primaryBg:
          "bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 text-white shadow-lg shadow-amber-600/30",
        focusRing: "focus:ring-amber-400",
        artTint: "bg-amber-950/15",
      };
    case "cyan":
      return {
        bodyBg: "bg-gradient-to-br from-slate-950/78 via-cyan-950/30 to-black/82",
        bodyText: "text-slate-100",
        headerBg: "bg-cyan-950/25 backdrop-blur-md",
        headerBorder: "border-cyan-500/35",
        glowClass: "border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.38)]",
        cardBg: "bg-slate-950/90 border-cyan-500/30 shadow-2xl backdrop-blur-xl",
        profileBtn: "text-cyan-100",
        avatarFrame: "bg-transparent",
        searchInput:
          "border-cyan-500/30 bg-black/55 text-white placeholder-slate-300 focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400/60",
        searchIcon: "text-cyan-300",
        searchSubmitBtn: "text-cyan-100 hover:text-white",
        trialBadge:
          "bg-cyan-950/50 border-cyan-500/35 text-cyan-200 backdrop-blur-md",
        footerShell:
          "border-cyan-500/20 bg-slate-950/55 shadow-[0_8px_30px_rgba(6,182,212,0.12)]",
        footerText: "text-slate-300",
        footerSubText: "text-slate-400",
        footerLink: "text-cyan-300 hover:text-cyan-200",
        footerBtn:
          "bg-cyan-950/45 hover:bg-cyan-900/70 border-cyan-500/30 text-cyan-100 hover:text-white backdrop-blur-sm",
        footerVersion:
          "bg-black/50 border-cyan-500/25 text-slate-300",
        clockPill:
          "bg-slate-950/60 border-cyan-500/35 text-cyan-100 backdrop-blur-md shadow-[0_6px_20px_rgba(6,182,212,0.2)]",
        primaryAccent: "text-cyan-300",
        primaryBg:
          "bg-gradient-to-r from-cyan-600 via-teal-600 to-blue-600 text-white shadow-lg shadow-cyan-600/30",
        focusRing: "focus:ring-cyan-400",
        artTint: "bg-cyan-950/15",
      };
    case "violet":
    default:
      return {
        bodyBg: "bg-gradient-to-br from-slate-950/78 via-purple-950/30 to-black/82",
        bodyText: "text-slate-100",
        headerBg: "bg-purple-950/25 backdrop-blur-md",
        headerBorder: "border-violet-500/35",
        glowClass: "border-violet-500/50 shadow-[0_0_15px_rgba(139,92,246,0.38)]",
        cardBg: "bg-slate-950/90 border-violet-500/30 shadow-2xl backdrop-blur-xl",
        profileBtn: "text-purple-100",
        avatarFrame: "bg-transparent",
        searchInput:
          "border-violet-500/30 bg-black/55 text-white placeholder-slate-300 focus:ring-2 focus:ring-violet-400 focus:border-violet-400/60",
        searchIcon: "text-violet-300",
        searchSubmitBtn: "text-purple-100 hover:text-white",
        trialBadge:
          "bg-purple-950/50 border-violet-500/35 text-violet-200 backdrop-blur-md",
        footerShell:
          "border-violet-500/20 bg-slate-950/55 shadow-[0_8px_30px_rgba(139,92,246,0.12)]",
        footerText: "text-slate-300",
        footerSubText: "text-slate-400",
        footerLink: "text-violet-300 hover:text-violet-200",
        footerBtn:
          "bg-purple-950/45 hover:bg-purple-900/70 border-violet-500/30 text-purple-100 hover:text-white backdrop-blur-sm",
        footerVersion:
          "bg-black/50 border-violet-500/25 text-slate-300",
        clockPill:
          "bg-slate-950/60 border-violet-500/35 text-purple-100 backdrop-blur-md shadow-[0_6px_20px_rgba(139,92,246,0.2)]",
        primaryAccent: "text-violet-400",
        primaryBg:
          "bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 text-white shadow-lg shadow-violet-600/30",
        focusRing: "focus:ring-violet-400",
        artTint: "bg-purple-950/15",
      };
  }
}

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
 * Isolated uncontrolled Header Search Bar:
 * 1) Never triggers RootComponent re-renders on keystrokes (eliminates Android WebView
 *    IME caret-reset-to-0 bug that reverses typed words like "talk" -> "klat").
 * 2) Allows empty submission to navigate directly to /search.
 * 3) Uses viewport-locked aspect ratios so search.png and buttonwrapper.png never
 *    squish or drift across phones, tablets, TVs, and projectors.
 */
const HeaderSearchBar = memo(function HeaderSearchBar({
  tokens,
  onSubmitQuery,
}: {
  tokens: RootThemeTokens;
  onSubmitQuery: (query: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = (inputRef.current?.value || "").trim();
    onSubmitQuery(raw);
    if (inputRef.current) {
      inputRef.current.value = "";
      inputRef.current.blur();
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      data-tour="header-search"
      className="rabtv-hdr-search-form"
    >
      <div
        className="rabtv-hdr-search-shell bg-transparent border-0 opacity-95 hover:opacity-100 focus-within:opacity-100 transition-opacity"
        style={{
          backgroundImage: `url(${SEARCHWRAPPER})`,
          backgroundSize: "105% 152%",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center center",
        }}
      >
        <input
          ref={inputRef}
          type="search"
          dir="ltr"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="search"
          defaultValue=""
          data-tour="global-search-input"
          placeholder="Search..."
          style={{ direction: "ltr", unicodeBidi: "plaintext", textAlign: "left" }}
          className="rabtv-hdr-search-input bg-transparent font-bold text-white placeholder-slate-200/75 focus:outline-none drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]"
        />
        {/* Transparent submit hit-target aligned over the inner Search pill of search.png */}
        <button
          type="submit"
          aria-label="Run search"
          tabIndex={-1}
          className="rabtv-hdr-search-pill-hit"
        />
      </div>

      <button
        type="submit"
        aria-label="Search"
        title="Open Search"
        className={`rabtv-hdr-search-btn font-black uppercase tracking-wider bg-transparent border-0 opacity-95 hover:opacity-100 transition active:scale-95 cursor-pointer focus:outline-none focus:ring-2 rounded-full ${tokens.searchSubmitBtn} ${tokens.focusRing}`}
        style={{
          backgroundImage: `url(${BUTTON_WRAPPER_URL})`,
          backgroundSize: "108% 158%",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center center",
        }}
      >
        <span className="relative z-10 text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.95)]">
          Search
        </span>
      </button>
    </form>
  );
});

/**
 * Global Crash-Recovery Error Boundary (Theme-Matched via CSS Custom Properties)
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
        <div
          className="mx-auto my-12 max-w-lg rounded-3xl p-6 sm:p-8 text-center shadow-2xl space-y-4 border"
          style={{
            backgroundColor: "var(--app-surface)",
            borderColor: "var(--app-border)",
          }}
        >
          <div
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border text-3xl"
            style={{
              backgroundColor: "var(--app-accent-soft)",
              borderColor: "var(--app-border)",
            }}
          >
            🛠️
          </div>
          <h2 className="text-xl font-black text-white">
            Oops — This Screen Hit a Bump
          </h2>
          <p
            className="text-xs sm:text-sm leading-relaxed"
            style={{ color: "var(--app-muted)" }}
          >
            Your saved lists, license, and watch history are completely safe.
            Tap below to reload cleanly.
          </p>
          <p
            className="rounded-xl bg-black/60 border p-2 text-[10px] font-mono truncate"
            style={{
              borderColor: "var(--app-border)",
              color: "var(--app-accent)",
            }}
          >
            {this.state.errorMessage}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-xl py-3 px-4 text-xs font-black text-white shadow-lg cursor-pointer"
              style={{ backgroundColor: "var(--app-accent-strong)" }}
            >
              🔄 Reload App
            </button>
            <button
              type="button"
              onClick={() => {
                purgeOldTmdbCaches();
                window.location.href = "/";
              }}
              className="rounded-xl bg-black/60 hover:bg-black/80 border py-3 px-4 text-xs font-extrabold cursor-pointer"
              style={{
                borderColor: "var(--app-border)",
                color: "var(--app-accent)",
              }}
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
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  const isPlayerRoute =
    pathname.startsWith("/live-player") || pathname.startsWith("/player");

  const [showSplashIntro, setShowSplashIntro] = useState(true);
  const [showProfileSwitcher, setShowProfileSwitcher] = useState(false);
  const [showFirstStartModal, setShowFirstStartModal] = useState(false);
  const [showBugModal, setShowBugModal] = useState(false);
  const [showBugFeedModal, setShowBugFeedModal] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showTosModal, setShowTosModal] = useState(false);
  const [tosRequireAccept, setTosRequireAccept] = useState(false);
  const [tosAccepted, setTosAccepted] = useState<boolean>(() =>
    hasAcceptedTos()
  );

  const [cardSize, setCardSize] = useState<CardSize>("large");
  const [streamQuality, setStreamQuality] = useState<StreamQuality>("1080p");
  const [appTheme, setAppTheme] = useState<AppTheme>("violet");
  const [helpfulMouse, setHelpfulMouseState] = useState(false);
  const [cursorStyle, setCursorStyleState] = useState<CursorStyle>("white");
  const [historyOverscale, setHistoryOverscaleState] =
    useState<HistoryScale>("off");
  const [largeButtons, setLargeButtonsState] = useState(false);
  const [profileMascot, setProfileMascotState] = useState<string>(() =>
    getActiveMascotBadge()
  );
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

  const sleepTimerRef = useRef<number | null>(null);

  const handleHeaderSearchQuery = useCallback(
    (query: string) => {
      navigate({ to: "/search", search: { q: query } });
    },
    [navigate]
  );

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

  // Background lobby audio lifecycle synced with SplashIntro & TanStack Router pathname
  useEffect(() => {
    if (
      showSplashIntro ||
      pathname.includes("details") ||
      pathname.includes("watch") ||
      pathname.includes("player")
    ) {
      bgAudio.pause();
    } else if (bgMusicState === "playing") {
      bgAudio.play();
    }
  }, [showSplashIntro, pathname, bgMusicState]);

  useEffect(() => {
    if (showSplashIntro) return;

    const startAudio = () => {
      const path = window.location.pathname;
      if (
        bgMusicState === "playing" &&
        !path.includes("details") &&
        !path.includes("watch") &&
        !path.includes("player")
      ) {
        bgAudio.play();
      }
      window.removeEventListener("click", startAudio);
      window.removeEventListener("keydown", startAudio);
    };

    window.addEventListener("click", startAudio, { once: true });
    window.addEventListener("keydown", startAudio, { once: true });

    return () => {
      bgAudio.pause();
      window.removeEventListener("click", startAudio);
      window.removeEventListener("keydown", startAudio);
    };
  }, [showSplashIntro, bgMusicState]);

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
      ensurePrimaryProfileInitialized();
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
      if (!hasAcceptedTos()) {
        setTosAccepted(false);
        setTosRequireAccept(true);
        setShowTosModal(true);
      } else {
        setTosAccepted(true);
      }
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
      setProfileMascotState(getActiveMascotBadge());
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

    const handleSidebarToggleEvent = (event: Event) => {
      const custom = event as CustomEvent<{ open?: boolean }>;
      if (typeof custom.detail?.open === "boolean") {
        setShowProfileMenu(custom.detail.open);
      }
    };

    const handleOpenTosEvent = (event: Event) => {
      const custom = event as CustomEvent<{ requireAcceptance?: boolean }>;
      setTosRequireAccept(Boolean(custom.detail?.requireAcceptance));
      setShowTosModal(true);
    };

    const handleOpenSwitcherEvent = () => {
      setShowProfileMenu(false);
      setShowProfileSwitcher(true);
    };

    syncRootStateFromSettings();
    window.addEventListener("rabtv_settings_updated", syncRootStateFromSettings);
    window.addEventListener(PROFILES_UPDATED_EVENT, syncRootStateFromSettings);
    window.addEventListener(MASCOT_UPDATED_EVENT, syncRootStateFromSettings);
    window.addEventListener(SIDEBAR_TOGGLE_EVENT, handleSidebarToggleEvent);
    window.addEventListener(TOS_OPEN_EVENT, handleOpenTosEvent);
    window.addEventListener(OPEN_PROFILE_SWITCHER_EVENT, handleOpenSwitcherEvent);
    return () => {
      window.removeEventListener(
        "rabtv_settings_updated",
        syncRootStateFromSettings
      );
      window.removeEventListener(PROFILES_UPDATED_EVENT, syncRootStateFromSettings);
      window.removeEventListener(MASCOT_UPDATED_EVENT, syncRootStateFromSettings);
      window.removeEventListener(SIDEBAR_TOGGLE_EVENT, handleSidebarToggleEvent);
      window.removeEventListener(TOS_OPEN_EVENT, handleOpenTosEvent);
      window.removeEventListener(
        OPEN_PROFILE_SWITCHER_EVENT,
        handleOpenSwitcherEvent
      );
    };
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

  const tokens = getRootThemeTokens(appTheme);

  const getCardBackground = (theme: AppTheme) => getRootThemeTokens(theme).cardBg;
  const getPrimaryAccentColor = (theme: AppTheme) =>
    getRootThemeTokens(theme).primaryAccent;
  const getPrimaryBgColor = (theme: AppTheme) =>
    getRootThemeTokens(theme).primaryBg;

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
        <style>{VIEWPORT_HEADER_STYLES}</style>
        {helpfulMouse && activeCursorUri && (
          <style>{`
            *, button, a, select, input, [role="button"] {
              cursor: ${activeCursorUri}, auto !important;
            }
          `}</style>
        )}
      </head>
      <body
        className={`min-h-screen max-w-full overflow-x-clip ${tokens.bodyBg} ${tokens.bodyText} antialiased transition-colors duration-300 relative`}
      >
        {/* Full-Screen Animated Splash Intro (Plays Every App Launch) */}
        {showSplashIntro && (
          <SplashIntro
            appTheme={appTheme}
            onFinish={() => setShowSplashIntro(false)}
          />
        )}

        {/* Household Multi-Profile Switcher ("Who's Watching?") */}
        <ProfileSwitcherModal
          isOpen={showProfileSwitcher && !showSplashIntro && !showFirstStartModal}
          appTheme={appTheme}
          canDismiss={true}
          onClose={() => setShowProfileSwitcher(false)}
        />
        <PreviewHostBridge />
        <HolidayOverlay />
        <AppWallpaper />
        <Screensaver />
        <AuthProvider>
          {/* Live Wi-Fi Offline Warning Banner (Semantic Alert) */}
          {isOffline && (
            <div className="rabtv-vidsrc-protected sticky top-0 z-50 w-full bg-red-700/95 border-b border-red-400/60 px-4 py-2 text-center text-xs font-extrabold text-white shadow-lg">
              📡 No Internet Connection — Waiting for Wi-Fi to reconnect...
            </div>
          )}

          {/* Viewport-Proportional Theme-Matched Glass Header */}
          <header
            data-tour="app-header"
            className={`rabtv-vidsrc-protected rabtv-hdr-bar sticky top-0 z-40 border-b transition-colors duration-300 relative overflow-hidden flex items-center ${
              isPlayerRoute ? "rabtv-header-player-route" : ""
            } ${tokens.headerBg} ${tokens.headerBorder} ${tokens.glowClass}`}
          >
            {/* Brightened Header Wallpaper */}
            <div className="absolute inset-0 pointer-events-none opacity-50">
              <img
                src={RABBITHEADERWALL}
                alt=""
                className="w-full h-full object-cover object-center brightness-110 contrast-105"
              />
            </div>
            <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-black/40 pointer-events-none" />

            <div className="relative z-10 rabtv-hdr-inner">
              {/* Left: Viewport-Scaled Borderless Neon Rabbit Logo */}
              <div className="rabtv-hdr-logo-wrap">
                <Link
                  to="/"
                  data-tour="home-logo"
                  aria-label="Rabbit TV Home"
                  title="Back to Home"
                  className={`rabtv-hdr-logo bg-transparent border-0 text-white opacity-95 hover:opacity-100 focus:outline-none focus:ring-2 rounded-full transition-all hover:scale-[1.03] active:scale-95 ${tokens.focusRing}`}
                >
                  <img
                    src={RABBIT_LOGO_URL}
                    alt="Rabbit TV Home"
                    decoding="async"
                    className="w-full h-full object-contain scale-[1.38] drop-shadow-[0_3px_10px_rgba(0,0,0,0.9)]"
                  />
                </Link>
              </div>

              {/* Isolated Search Bar: Full-width Row 2 on Portrait Phones, Center on Landscape/Tablet/TV/Projector */}
              {!showFirstStartModal && (
                <HeaderSearchBar
                  tokens={tokens}
                  onSubmitQuery={handleHeaderSearchQuery}
                />
              )}

              {/* Right: Corner Clock Pill + Kids Badge + Viewport-Locked Sidebar Profile Pill */}
              {savedProfileName && !showFirstStartModal && (
                <div className="rabtv-hdr-profile-wrap">
                  {showCornerClock && cornerClockText && !isPlayerRoute && (
                    <span
                      data-tour="corner-clock"
                      className={`hidden xl:inline-flex items-center gap-1 px-2.5 py-1 rounded-xl border text-[11px] font-extrabold tracking-wider ${tokens.clockPill}`}
                    >
                      🕒 {cornerClockText}
                    </span>
                  )}
                  {kidsLocked && (
                    <span
                      className="hidden xl:inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[10px] font-extrabold uppercase tracking-wider"
                      title="Kids Safe Mode Locked"
                    >
                      🧒 Kids
                    </span>
                  )}

                  <button
                    type="button"
                    data-tour="sidebar-toggle"
                    aria-label="Open menu"
                    onClick={() => setShowProfileMenu((prev) => !prev)}
                    style={{
                      backgroundImage: `url(${SIDEBAR_BUTTON_BG_URL})`,
                      backgroundSize: "100% 132%",
                      backgroundRepeat: "no-repeat",
                      backgroundPosition: "center center",
                    }}
                    className={`rabtv-hdr-profile-btn rounded-full bg-transparent border-0 font-black text-white opacity-95 hover:opacity-100 transition hover:scale-[1.02] active:scale-95 cursor-pointer group focus:outline-none focus:ring-2 ${tokens.profileBtn} ${tokens.focusRing}`}
                  >
                    <div className="rabtv-hdr-profile-avatar">
                      <MascotAvatar
                        mascot={profileMascot}
                        size="sm"
                        rounded="full"
                        className="!w-full !h-full border-0 bg-transparent [&_img]:w-full [&_img]:h-full [&_img]:object-cover"
                        alt={savedProfileName}
                      />
                    </div>
                    <span className="rabtv-hdr-profile-label relative z-10 drop-shadow-[0_1px_4px_rgba(0,0,0,0.95)]">
                      <strong className="text-white">{savedProfileName}</strong>{" "}
                      {isAdmin
                        ? "(Admin)"
                        : isTrialActive
                          ? `(${trialDaysRemaining}d)`
                          : ""}
                    </span>
                  </button>

                  {isTrialActive && (
                    <div
                      className={`hidden xl:flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] font-bold ${tokens.trialBadge}`}
                    >
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
            onOpenTosModal={() => {
              setShowProfileMenu(false);
              setTosRequireAccept(false);
              setShowTosModal(true);
            }}
            onStartWalkthrough={() => {
              setShowProfileMenu(false);
              triggerRabbitWalkthrough(0);
            }}
            headerIconUrl={HEADER_ICON_URL}
            allThemesList={allThemesList}
            getPrimaryBgColor={getPrimaryBgColor}
            getPrimaryAccentColor={getPrimaryAccentColor}
          />

          {/* Dedicated TV/Projector Overscan Safe-Zone Shell (Preserves Inner Tailwind Padding) */}
          <div className="rabtv-vidsrc-protected rabtv-overscan-shell">
            {/* Main Route Container with Crash Shield */}
            <main
              data-tour="app-main"
              className="mx-auto max-w-7xl px-2.5 py-3 sm:px-6 md:py-6 overflow-x-clip pb-8"
            >
              <AppErrorBoundary>
                <Outlet />
              </AppErrorBoundary>
            </main>

            {/* Theme-Matched Global Attribution Footer: Official TMDB Link, ToS, Tour & Version */}
            {!showFirstStartModal && (
              <footer
                data-tour="app-footer"
                className="mx-auto max-w-7xl px-2.5 sm:px-6 pb-10"
              >
                <div
                  className={`rounded-2xl border backdrop-blur-md px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left ${tokens.footerShell}`}
                >
                  <div className="space-y-1 min-w-0">
                    <p
                      className={`text-[11px] sm:text-xs leading-relaxed ${tokens.footerText}`}
                    >
                      Metadata, posters & trailers powered by{" "}
                      <a
                        href="https://www.themoviedb.org"
                        target="_blank"
                        rel="noopener noreferrer"
                        data-tour="tmdb-link"
                        onClick={(e) =>
                          void handleOpenExternal("https://www.themoviedb.org", e)
                        }
                        className={`inline-flex items-center gap-1 font-extrabold underline underline-offset-2 transition cursor-pointer ${tokens.footerLink}`}
                      >
                        TMDB (themoviedb.org) ↗
                      </a>
                    </p>
                    <p className={`text-[10px] ${tokens.footerSubText}`}>
                      This product uses the TMDB API but is not endorsed or
                      certified by TMDB.
                    </p>
                  </div>

                  <div className="flex items-center justify-center gap-2 flex-wrap shrink-0">
                    <button
                      type="button"
                      data-tour="footer-tos"
                      onClick={() => {
                        setTosRequireAccept(false);
                        setShowTosModal(true);
                      }}
                      className={`rounded-xl border px-3 py-1.5 text-[11px] font-bold transition cursor-pointer ${tokens.footerBtn}`}
                    >
                      📜 Terms of Service
                    </button>
                    <button
                      type="button"
                      data-tour="footer-walkthrough"
                      onClick={() => triggerRabbitWalkthrough(0)}
                      className={`rounded-xl border px-3 py-1.5 text-[11px] font-bold transition cursor-pointer ${tokens.footerBtn}`}
                    >
                      🧭 App Tour
                    </button>
                    <span
                      data-tour="app-version"
                      className={`rounded-xl border px-2.5 py-1.5 text-[10px] font-extrabold uppercase tracking-wider ${tokens.footerVersion}`}
                    >
                      RABBiT TV v2.8
                    </span>
                  </div>
                </div>
              </footer>
            )}
          </div>

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
            isOpen={showFirstStartModal && !showSplashIntro}
            onAuthorized={() => {
              setShowFirstStartModal(false);
              if (!hasAcceptedTos()) {
                setTosAccepted(false);
                setTosRequireAccept(true);
                setShowTosModal(true);
              } else {
                setTosAccepted(true);
              }
            }}
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

          {/* TERMS OF SERVICE & LEGAL DISCLAIMER MODAL */}
          <TermsOfServiceModal
            isOpen={showTosModal && !showFirstStartModal && !showSplashIntro}
            requireAcceptance={tosRequireAccept}
            appTheme={appTheme}
            onAccept={() => {
              setTosAccepted(true);
              setTosRequireAccept(false);
              setShowTosModal(false);
            }}
            onClose={() => {
              if (!tosRequireAccept) {
                setShowTosModal(false);
              }
            }}
            onOpenExternal={handleOpenExternal}
          />

          {/* FULL INTERACTIVE APP WALKTHROUGH (Starts after Splash, Activation & ToS) */}
          <InteractiveWalkthrough
            autoStartOnFirstLaunch={
              !showSplashIntro && !showFirstStartModal && !showTosModal && tosAccepted
            }
            onNavigate={(path) => navigate({ to: path as any })}
            onToggleSidebar={(open) => setShowProfileMenu(open)}
          />
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  );
}
