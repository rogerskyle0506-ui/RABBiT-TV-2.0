// src/routes/community.tsx
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import React, { useEffect, useState, useRef, useMemo, useCallback, memo } from "react";
import {
  AppTheme,
  getSavedTheme,
  getHardwareLimits,
  getLargeButtons,
} from "@/lib/settings";
import { AppWallpaper } from "@/components/AppWallpaper";
import { MascotAvatar } from "@/components/MascotAvatar";
import { getActiveMascotBadge, MASCOT_UPDATED_EVENT } from "@/lib/mascots";
import {
  isCommunityAccessLocked,
  isCommunityBackendConfigured,
  getCommunityBackendLabel,
  getLocalCommunityIdentity,
  computeMyPublicVibePreview,
  saveAndPublishMyProfile,
  toggleHideTitleFromPublicProfile,
  fetchPublicProfiles,
  fetchLatestCommunityReviews,
  fetchMyBuddyThreads,
  sendWatchBuddyRequest,
  respondToWatchBuddyRequest,
  sendBuddyThreadMessage,
  blockCommunityUser,
  unblockCommunityUser,
  getBlockedPublicIds,
  reportCommunityItem,
  COMMUNITY_UPDATED_EVENT,
  type CommunityProfile,
  type CommunityReview,
  type WatchBuddyThread,
} from "@/lib/community-service";

// =============================================================================
// COMMITTED COMMUNITY PAGE IMAGE ASSETS (5 NEW + REUSED CROSS-PAGE PLATES)
// =============================================================================
const IMG_COMM_TOWN_PANEL =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-community-town-panel.jpg";
const IMG_COMM_SECTION_BANNER =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-community-section-banner.jpg";
const IMG_COMM_CARD_FRAME =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-community-card-frame.jpg";
const IMG_COMM_TAB_ACTIVE =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-community-tab-active.jpg";
const IMG_COMM_EMPTY_STATE =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-community-empty-state.jpg";

// Reused Cross-Page Assets (1:1 Continuity with Index, Details, Player, Search & Watch History)
const IMG_BUTTON_WRAPPER =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-button-wrapper-background.jpg";
const IMG_BTN_HOME =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-search-button-home-primary.jpg";
const IMG_BTN_PLAY_PRIMARY =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-button-play-primary.jpg";
const IMG_BTN_FILTER_IDLE =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-search-button-filter-idle.jpg";
const IMG_BTN_DANGER =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-search-button-clear-danger.jpg";
const IMG_PILL_INACTIVE =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-pill-inactive-dark.jpg";
const IMG_INPUT_BAR =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-search-input-bar-background.jpg";
const IMG_STAT_CARD =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-stat-card-background.jpg";
const IMG_DETAILS_PANEL =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-details-panel-background.jpg";

const COMMUNITY_PAGE_STYLES = `
  /* 6-Theme Hue-Shift Tokens Synced 1:1 with All Rabbit TV Pages */
  :root,
  html[data-theme="violet"] {
    --rabtv-club-plate-filter: hue-rotate(-78deg) saturate(1.12) brightness(1.02);
    --rabtv-club-play-filter: hue-rotate(-74deg) saturate(1.16) brightness(1.05);
  }
  html[data-theme="red"] {
    --rabtv-club-plate-filter: hue-rotate(0deg) saturate(1.08) brightness(1.0);
    --rabtv-club-play-filter: hue-rotate(0deg) saturate(1.14) brightness(1.04);
  }
  html[data-theme="midnight"] {
    --rabtv-club-plate-filter: hue-rotate(-132deg) saturate(1.14) brightness(1.04);
    --rabtv-club-play-filter: hue-rotate(-128deg) saturate(1.18) brightness(1.06);
  }
  html[data-theme="emerald"] {
    --rabtv-club-plate-filter: hue-rotate(154deg) saturate(1.10) brightness(1.02);
    --rabtv-club-play-filter: hue-rotate(150deg) saturate(1.15) brightness(1.04);
  }
  html[data-theme="amber"] {
    --rabtv-club-plate-filter: hue-rotate(28deg) saturate(1.14) brightness(1.04);
    --rabtv-club-play-filter: hue-rotate(24deg) saturate(1.18) brightness(1.06);
  }
  html[data-theme="cyan"] {
    --rabtv-club-plate-filter: hue-rotate(-154deg) saturate(1.12) brightness(1.04);
    --rabtv-club-play-filter: hue-rotate(-150deg) saturate(1.16) brightness(1.06);
  }

  /* Top Dual Utility Wrapper */
  .rabtv-club-dual-wrap {
    position: relative;
    width: 100%;
    height: clamp(48px, 12.6vw, 58px);
    padding: 0 4%;
    margin-inline: auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: clamp(8px, 2vw, 16px);
    box-sizing: border-box;
    border-radius: 9999px;
    overflow: hidden;
    contain: layout paint;
  }

  .rabtv-club-dual-bg {
    position: absolute;
    inset: 0;
    background-size: 100% 100%;
    background-repeat: no-repeat;
    background-position: center center;
    opacity: 0.74;
    filter: var(--rabtv-club-plate-filter);
    -webkit-mask-image: radial-gradient(
      ellipse 88% 80% at 50% 50%,
      rgba(12, 10, 9, 1) 66%,
      rgba(12, 10, 9, 0.76) 88%,
      rgba(12, 10, 9, 0.30) 100%
    );
    mask-image: radial-gradient(
      ellipse 88% 80% at 50% 50%,
      rgba(12, 10, 9, 1) 66%,
      rgba(12, 10, 9, 0.76) 88%,
      rgba(12, 10, 9, 0.30) 100%
    );
    pointer-events: none;
    z-index: 0;
  }

  /* Featured Community Town Panel Showcase (rabbit-tv-community-town-panel.jpg) */
  .rabtv-club-hero-shell {
    position: relative;
    overflow: hidden;
    background-color: #0c0a09;
    contain: layout paint;
  }

  .rabtv-club-town-stage {
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 9;
    max-height: 360px;
    overflow: hidden;
    background-color: #0c0a09;
  }

  .rabtv-club-town-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center 32%;
    display: block;
  }

  /* 21:9 Movie Club Section Banner (rabbit-tv-community-section-banner.jpg) */
  .rabtv-club-section-banner {
    position: relative;
    width: 100%;
    min-height: clamp(50px, 12.5vw, 68px);
    box-sizing: border-box;
    padding: clamp(12px, 3vw, 18px) clamp(44px, 15.5%, 104px);
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 20px;
    overflow: hidden;
    background-color: #0c0a09;
    contain: layout paint;
  }

  .rabtv-club-section-banner-bg {
    position: absolute;
    inset: 0;
    background-size: 100% 100%;
    background-position: center center;
    background-repeat: no-repeat;
    opacity: 0.90;
    filter: var(--rabtv-club-plate-filter);
    pointer-events: none;
    z-index: 0;
  }

  .rabtv-club-section-banner-scrim {
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse 72% 70% at 50% 50%, rgba(12, 10, 9, 0.42) 0%, rgba(12, 10, 9, 0.14) 100%);
    pointer-events: none;
    z-index: 1;
  }

  /* Armored Community Cards, Profile Panels, Stat Cards & Empty States (100% Inner-Bay Safe Padding) */
  .rabtv-club-plate {
    position: relative;
    overflow: hidden;
    box-sizing: border-box;
    padding: clamp(26px, 6.4vw, 40px) clamp(30px, 10%, 56px) !important;
    background-color: rgba(12, 10, 9, 0.78);
    contain: layout paint;
  }

  .rabtv-club-plate--card {
    padding: clamp(22px, 5.4vw, 32px) clamp(26px, 9.5%, 44px) !important;
  }

  .rabtv-club-plate--stat {
    padding: clamp(16px, 4.2vw, 22px) clamp(22px, 10%, 34px) !important;
  }

  .rabtv-club-plate--empty {
    padding: clamp(36px, 8.5vw, 60px) clamp(30px, 10.5%, 64px) !important;
  }

  .rabtv-club-plate-bg {
    position: absolute;
    inset: 0;
    background-size: 100% 100%;
    background-position: center center;
    background-repeat: no-repeat;
    opacity: 0.80;
    filter: var(--rabtv-club-plate-filter);
    pointer-events: none;
    z-index: 0;
  }

  .rabtv-club-plate-bg--empty {
    background-size: cover;
    opacity: 0.68;
    filter: none;
  }

  .rabtv-club-plate-scrim {
    position: absolute;
    inset: 0;
    background: radial-gradient(
      ellipse 82% 80% at 50% 45%,
      rgba(12, 10, 9, 0.52) 0%,
      rgba(12, 10, 9, 0.36) 70%,
      rgba(12, 10, 9, 0.56) 100%
    );
    pointer-events: none;
    z-index: 1;
  }

  .rabtv-club-plate-scrim--empty {
    background: radial-gradient(
      ellipse 78% 72% at 50% 44%,
      rgba(12, 10, 9, 0.76) 0%,
      rgba(12, 10, 9, 0.46) 68%,
      rgba(12, 10, 9, 0.34) 100%
    );
  }

  /* 4:1 Navigation Tab Plates (rabbit-tv-community-tab-active.jpg / pill-inactive-dark.jpg) */
  .rabtv-club-tab {
    position: relative;
    overflow: hidden;
    box-sizing: border-box;
    padding-inline: clamp(14px, 11%, 26px) !important;
    background-color: #0c0a09;
    border: 0 !important;
    contain: layout paint;
    transition: transform 150ms ease, opacity 150ms ease;
  }

  .rabtv-club-tab:hover { transform: scale(1.02); }
  .rabtv-club-tab:active { transform: scale(0.98); }

  .rabtv-club-tab-art {
    position: absolute;
    inset: 0;
    background-size: 100% 100%;
    background-position: center center;
    background-repeat: no-repeat;
    pointer-events: none;
    z-index: 0;
  }

  .rabtv-club-tab-art--active {
    opacity: 0.98;
    filter: var(--rabtv-club-plate-filter) brightness(1.06);
  }

  .rabtv-club-tab-art--idle {
    opacity: 0.84;
    filter: var(--rabtv-club-plate-filter) brightness(0.92);
  }

  /* Universal Armored Image Buttons */
  .rabtv-club-btn {
    position: relative;
    overflow: hidden;
    box-sizing: border-box;
    padding-inline: clamp(14px, 4.2vw, 24px) !important;
    background-color: #0c0a09;
    border: 0 !important;
    box-shadow: none !important;
    contain: layout paint;
    transition: transform 150ms ease, opacity 150ms ease;
  }

  .rabtv-club-btn:hover:not(:disabled) { transform: scale(1.02); }
  .rabtv-club-btn:active:not(:disabled) { transform: scale(0.97); }

  .rabtv-club-btn-art {
    position: absolute;
    inset: 0;
    background-size: 100% 100%;
    background-position: center center;
    background-repeat: no-repeat;
    pointer-events: none;
    z-index: 0;
    transition: filter 160ms ease, transform 160ms ease;
    -webkit-mask-image: radial-gradient(
      ellipse 92% 84% at 50% 50%,
      rgba(12, 10, 9, 1) 72%,
      rgba(12, 10, 9, 0.62) 94%,
      transparent 100%
    );
    mask-image: radial-gradient(
      ellipse 92% 84% at 50% 50%,
      rgba(12, 10, 9, 1) 72%,
      rgba(12, 10, 9, 0.62) 94%,
      transparent 100%
    );
  }

  .rabtv-club-btn-art--primary {
    opacity: 0.96;
    filter: var(--rabtv-club-play-filter);
  }

  .rabtv-club-btn-art--idle {
    opacity: 0.90;
    filter: var(--rabtv-club-plate-filter) brightness(0.96);
  }

  .rabtv-club-btn-art--danger {
    opacity: 0.96;
    filter: saturate(1.12) brightness(1.02);
  }

  .rabtv-club-btn-scrim {
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse 76% 68% at 50% 50%, rgba(12, 10, 9, 0.44) 0%, rgba(12, 10, 9, 0.16) 100%);
    pointer-events: none;
    z-index: 1;
  }

  .rabtv-club-btn-label {
    position: relative;
    z-index: 2;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    min-width: 0;
    max-width: 100%;
    text-shadow: 0 1px 4px rgba(12, 10, 9, 0.96), 0 0 10px rgba(12, 10, 9, 0.85);
  }

  /* Armored Input Housing (rabbit-tv-search-input-bar-background.jpg) */
  .rabtv-club-input-shell {
    position: relative;
    overflow: hidden;
    background-color: #0c0a09;
    contain: layout paint;
  }

  .rabtv-club-input-bg {
    position: absolute;
    inset: 0;
    background-size: 100% 100%;
    background-position: center center;
    background-repeat: no-repeat;
    opacity: 0.92;
    filter: var(--rabtv-club-plate-filter);
    pointer-events: none;
    z-index: 0;
  }

  .rabtv-club-input-scrim {
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, rgba(12, 10, 9, 0.38) 0%, rgba(12, 10, 9, 0.56) 100%);
    pointer-events: none;
    z-index: 1;
  }
`;

export const Route = createFileRoute("/community")({
  component: CommunityPage,
});

type ClubTab = "profile" | "buffs" | "buddies" | "reviews";
type ClubBtnVariant = "primary" | "idle" | "danger" | "home";

const ClubArmoredBtn = memo(function ClubArmoredBtn({
  variant = "idle",
  className = "",
  children,
  onClick,
  type = "button",
  disabled = false,
  title,
  ariaLabel,
}: {
  variant?: ClubBtnVariant;
  className?: string;
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  type?: "button" | "submit";
  disabled?: boolean;
  title?: string;
  ariaLabel?: string;
}) {
  const bgUrl =
    variant === "home"
      ? IMG_BTN_HOME
      : variant === "primary"
        ? IMG_BTN_PLAY_PRIMARY
        : variant === "danger"
          ? IMG_BTN_DANGER
          : IMG_BTN_FILTER_IDLE;

  const artMod =
    variant === "primary"
      ? "rabtv-club-btn-art--primary"
      : variant === "danger"
        ? "rabtv-club-btn-art--danger"
        : "rabtv-club-btn-art--idle";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      className={`rabtv-club-btn rounded-xl text-white font-extrabold cursor-pointer disabled:opacity-45 disabled:pointer-events-none focus:outline-none focus:ring-2 focus:ring-cyan-400 ${className}`}
    >
      <span
        className={`rabtv-club-btn-art ${artMod}`}
        aria-hidden="true"
        style={{ backgroundImage: `url(${bgUrl})` }}
      />
      <span className="rabtv-club-btn-scrim" aria-hidden="true" />
      <span className="rabtv-club-btn-label">{children}</span>
    </button>
  );
});

const ClubSectionBanner = memo(function ClubSectionBanner({
  title,
}: {
  title: string;
}) {
  return (
    <div className="rabtv-club-section-banner">
      <div
        className="rabtv-club-section-banner-bg"
        aria-hidden="true"
        style={{ backgroundImage: `url(${IMG_COMM_SECTION_BANNER})` }}
      />
      <div className="rabtv-club-section-banner-scrim" aria-hidden="true" />
      <h2 className="relative z-10 text-sm sm:text-lg font-black tracking-wide text-white text-center truncate drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)]">
        {title}
      </h2>
    </div>
  );
});

function getClubTheme(theme: AppTheme) {
  switch (theme) {
    case "red":
      return {
        pageBg: "bg-gradient-to-br from-zinc-950/65 via-red-950/30 to-black/75",
        panel: "border-red-500/30 shadow-[0_14px_40px_rgba(239,68,68,0.16)]",
        sub: "bg-black/70 border-red-500/20",
        divider: "border-red-500/20",
        accent: "text-red-400",
        badge: "bg-red-950/75 border-red-500/35 text-red-200",
        btnSecondary:
          "bg-red-950/55 hover:bg-red-900/75 border-red-500/35 text-red-100 hover:text-white",
        muted: "text-zinc-300",
        subMuted: "text-zinc-400",
        ring: "focus:ring-red-500",
      };
    case "midnight":
      return {
        pageBg: "bg-gradient-to-br from-slate-950/65 via-blue-950/30 to-black/75",
        panel: "border-blue-500/30 shadow-[0_14px_40px_rgba(59,130,246,0.16)]",
        sub: "bg-black/70 border-blue-500/20",
        divider: "border-blue-500/20",
        accent: "text-sky-300",
        badge: "bg-blue-950/75 border-blue-500/35 text-sky-200",
        btnSecondary:
          "bg-blue-950/55 hover:bg-blue-900/75 border-blue-500/35 text-blue-100 hover:text-white",
        muted: "text-slate-300",
        subMuted: "text-slate-400",
        ring: "focus:ring-sky-400",
      };
    case "emerald":
      return {
        pageBg: "bg-gradient-to-br from-neutral-950/65 via-emerald-950/30 to-black/75",
        panel: "border-emerald-500/30 shadow-[0_14px_40px_rgba(16,185,129,0.16)]",
        sub: "bg-black/70 border-emerald-500/20",
        divider: "border-emerald-500/20",
        accent: "text-emerald-300",
        badge: "bg-emerald-950/75 border-emerald-500/35 text-emerald-200",
        btnSecondary:
          "bg-emerald-950/55 hover:bg-emerald-900/75 border-emerald-500/35 text-emerald-100 hover:text-white",
        muted: "text-neutral-300",
        subMuted: "text-neutral-400",
        ring: "focus:ring-emerald-400",
      };
    case "amber":
      return {
        pageBg: "bg-gradient-to-br from-stone-950/65 via-yellow-950/30 to-black/75",
        panel: "border-amber-500/30 shadow-[0_14px_40px_rgba(245,158,11,0.16)]",
        sub: "bg-black/70 border-amber-500/20",
        divider: "border-amber-500/20",
        accent: "text-amber-300",
        badge: "bg-amber-950/75 border-amber-500/35 text-amber-200",
        btnSecondary:
          "bg-amber-950/55 hover:bg-amber-900/75 border-amber-500/35 text-amber-100 hover:text-white",
        muted: "text-stone-300",
        subMuted: "text-stone-400",
        ring: "focus:ring-amber-400",
      };
    case "cyan":
      return {
        pageBg: "bg-gradient-to-br from-slate-950/65 via-cyan-950/30 to-black/75",
        panel: "border-cyan-500/30 shadow-[0_14px_40px_rgba(6,182,212,0.16)]",
        sub: "bg-black/70 border-cyan-500/20",
        divider: "border-cyan-500/20",
        accent: "text-cyan-300",
        badge: "bg-cyan-950/75 border-cyan-500/35 text-cyan-200",
        btnSecondary:
          "bg-cyan-950/55 hover:bg-cyan-900/75 border-cyan-500/35 text-cyan-100 hover:text-white",
        muted: "text-slate-300",
        subMuted: "text-slate-400",
        ring: "focus:ring-cyan-400",
      };
    case "violet":
    default:
      return {
        pageBg: "bg-gradient-to-br from-slate-950/65 via-purple-950/30 to-black/75",
        panel: "border-violet-500/30 shadow-[0_14px_40px_rgba(139,92,246,0.16)]",
        sub: "bg-black/70 border-violet-500/20",
        divider: "border-violet-500/20",
        accent: "text-violet-300",
        badge: "bg-purple-950/75 border-violet-500/35 text-violet-200",
        btnSecondary:
          "bg-purple-950/55 hover:bg-purple-900/75 border-violet-500/35 text-purple-100 hover:text-white",
        muted: "text-slate-300",
        subMuted: "text-slate-400",
        ring: "focus:ring-violet-400",
      };
  }
}

function formatAgo(ts: number): string {
  const diffMin = Math.max(0, Math.floor((Date.now() - ts) / 60000));
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

function CommunityPage() {
  const navigate = useNavigate();
  const [appTheme, setAppTheme] = useState<AppTheme>(() => getSavedTheme());
  const [isLowRam, setIsLowRam] = useState(
    () => getHardwareLimits().effectiveMode === "low"
  );
  const [largeButtons, setLargeButtons] = useState(() => getLargeButtons());
  const [kidsLocked, setKidsLocked] = useState(() => isCommunityAccessLocked());
  const [myMascot, setMyMascot] = useState(() => getActiveMascotBadge());

  const [activeTab, setActiveTab] = useState<ClubTab>("profile");
  const [identity, setIdentity] = useState(() => getLocalCommunityIdentity());
  const [vibePreview, setVibePreview] = useState(() =>
    computeMyPublicVibePreview()
  );

  const [isPublic, setIsPublic] = useState<boolean>(identity.isPublic);
  const [showWatchedList, setShowWatchedList] = useState<boolean>(
    identity.showWatchedList
  );
  const [blockedIds, setBlockedIds] = useState<string[]>(() =>
    getBlockedPublicIds()
  );

  const [profiles, setProfiles] = useState<CommunityProfile[]>([]);
  const [reviews, setReviews] = useState<CommunityReview[]>([]);
  const [threads, setThreads] = useState<WatchBuddyThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [chatSpoiler, setChatSpoiler] = useState<boolean>(false);
  const [revealedSpoilers, setRevealedSpoilers] = useState<Set<string>>(
    () => new Set()
  );

  const [loading, setLoading] = useState<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [inviteTarget, setInviteTarget] = useState<CommunityProfile | null>(null);

  const handleRef = useRef<HTMLInputElement>(null);
  const bioRef = useRef<HTMLInputElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const inviteNoteRef = useRef<HTMLInputElement>(null);
  const isMountedRef = useRef<boolean>(true);
  const toastTimerRef = useRef<number | null>(null);

  const tokens = useMemo(() => getClubTheme(appTheme), [appTheme]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  // Escape closes Watch Together modal cleanly on TV remotes / keyboards
  useEffect(() => {
    if (!inviteTarget) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setInviteTarget(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inviteTarget]);

  const showToast = useCallback((ok: boolean, text: string) => {
    setToast({ ok, text });
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      if (isMountedRef.current) setToast(null);
      toastTimerRef.current = null;
    }, 3500);
  }, []);

  const refreshAll = useCallback(async (force = false) => {
    setLoading(true);
    try {
      const [pList, rList, bList] = await Promise.all([
        fetchPublicProfiles(force),
        fetchLatestCommunityReviews(24, force),
        fetchMyBuddyThreads(force),
      ]);
      if (!isMountedRef.current) return;
      setProfiles(pList);
      setReviews(rList);
      setThreads(bList);
      setBlockedIds(getBlockedPublicIds());
      setVibePreview(computeMyPublicVibePreview());
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const syncSettings = () => {
      setAppTheme(getSavedTheme());
      setIsLowRam(getHardwareLimits().effectiveMode === "low");
      setLargeButtons(getLargeButtons());
      setKidsLocked(isCommunityAccessLocked());
      setMyMascot(getActiveMascotBadge());
      setIdentity(getLocalCommunityIdentity());
      setVibePreview(computeMyPublicVibePreview());
      setBlockedIds(getBlockedPublicIds());
    };
    syncSettings();
    void refreshAll(false);

    window.addEventListener("rabtv_settings_updated", syncSettings);
    window.addEventListener("rabtv_ram_mode_updated", syncSettings);
    window.addEventListener(MASCOT_UPDATED_EVENT, syncSettings);
    window.addEventListener(COMMUNITY_UPDATED_EVENT, syncSettings);
    return () => {
      window.removeEventListener("rabtv_settings_updated", syncSettings);
      window.removeEventListener("rabtv_ram_mode_updated", syncSettings);
      window.removeEventListener(MASCOT_UPDATED_EVENT, syncSettings);
      window.removeEventListener(COMMUNITY_UPDATED_EVENT, syncSettings);
    };
  }, [refreshAll]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await saveAndPublishMyProfile({
        publicHandle: handleRef.current?.value || identity.publicHandle,
        bio: bioRef.current?.value || "",
        isPublic,
        showWatchedList,
      });
      if (!isMountedRef.current) return;
      if (!res.ok) {
        showToast(false, res.error || "Could not save public profile.");
        return;
      }
      setIdentity(getLocalCommunityIdentity());
      showToast(
        true,
        isPublic
          ? "✓ Public Movie-Buff Card published! Your real name stays 100% hidden."
          : "🔒 Public profile set to Private and removed from directory."
      );
      await refreshAll(true);
    } finally {
      if (isMountedRef.current) setBusy(false);
    }
  };

  const handleSendInviteForMovie = async (
    target: CommunityProfile,
    movie: {
      mediaId: string;
      mediaType: "movie" | "tv";
      title: string;
      posterPath: string | null;
    }
  ) => {
    setBusy(true);
    try {
      const res = await sendWatchBuddyRequest({
        toProfile: target,
        mediaId: movie.mediaId,
        mediaType: movie.mediaType,
        title: movie.title,
        posterPath: movie.posterPath,
        note: inviteNoteRef.current?.value || undefined,
      });
      if (!isMountedRef.current) return;
      if (!res.ok) {
        showToast(false, res.error || "Could not send invite.");
        return;
      }
      setInviteTarget(null);
      showToast(
        true,
        `🤝 Sent Watch Buddy invite to ${target.handle} for "${movie.title}"!`
      );
      await refreshAll(true);
      setActiveTab("buddies");
    } finally {
      if (isMountedRef.current) setBusy(false);
    }
  };

  const handleBuddyResponse = async (
    threadId: string,
    action: "accept" | "decline" | "block"
  ) => {
    setBusy(true);
    try {
      const res = await respondToWatchBuddyRequest(threadId, action);
      if (!isMountedRef.current) return;
      if (res.ok) {
        showToast(
          true,
          action === "accept"
            ? "✓ Watch Buddy accepted! Open the movie anytime & chat below."
            : action === "block"
              ? "🚫 Member blocked & request removed."
              : "Invite declined."
        );
        await refreshAll(true);
      } else {
        showToast(false, res.error || "Could not update request.");
      }
    } finally {
      if (isMountedRef.current) setBusy(false);
    }
  };

  const handleSendChatMsg = async (e: React.FormEvent, threadId: string) => {
    e.preventDefault();
    const raw = chatInputRef.current?.value || "";
    if (!raw.trim()) return;
    setBusy(true);
    try {
      const res = await sendBuddyThreadMessage(threadId, raw, chatSpoiler);
      if (!isMountedRef.current) return;
      if (!res.ok) {
        showToast(false, res.error || "Message blocked.");
        return;
      }
      if (chatInputRef.current) chatInputRef.current.value = "";
      setChatSpoiler(false);
      await refreshAll(true);
    } finally {
      if (isMountedRef.current) setBusy(false);
    }
  };

  const pendingIncomingCount = threads.filter(
    (t) => t.status === "pending" && t.toId === identity.publicId
  ).length;
  const activeThread =
    threads.find((t) => t.threadId === activeThreadId) || null;

  return (
    <main
      className={`min-h-screen w-full max-w-full ${tokens.pageBg} text-white px-2.5 sm:px-6 py-4 pb-16 relative rounded-3xl overflow-x-clip`}
    >
      <style>{COMMUNITY_PAGE_STYLES}</style>
      <AppWallpaper />

      <div className="relative z-10 max-w-6xl mx-auto space-y-5 min-w-0">
        {/* Top Dual Utility Wrapper (Reused Industrial Backplate + Home & Refresh Armored Buttons) */}
        <div className="rabtv-club-dual-wrap">
          <div
            className="rabtv-club-dual-bg"
            aria-hidden="true"
            style={{ backgroundImage: `url(${IMG_BUTTON_WRAPPER})` }}
          />
          <Link
            to="/"
            aria-label="Back to Home"
            title="Back to Home"
            className="relative z-10 inline-block"
          >
            <ClubArmoredBtn
              variant="home"
              className="rounded-full py-2 text-xs whitespace-nowrap"
            >
              ← Back to Home
            </ClubArmoredBtn>
          </Link>

          <ClubArmoredBtn
            variant="idle"
            disabled={loading}
            onClick={() => void refreshAll(true)}
            className="relative z-10 rounded-full py-2 text-xs whitespace-nowrap"
          >
            ↻ {loading ? "Sync…" : "Refresh"}
          </ClubArmoredBtn>
        </div>

        {/* Movie Club Town Gathering Hero Panel + 4-Tab Navigation Bar */}
        <div
          className={`rabtv-club-hero-shell rounded-3xl border ${
            isLowRam ? "" : "backdrop-blur-md"
          } ${tokens.panel}`}
        >
          {/* 16:9 Punk-Grunge Community Town Panel (rabbit-tv-community-town-panel.jpg) */}
          <div className="rabtv-club-town-stage">
            <img
              src={IMG_COMM_TOWN_PANEL}
              alt="RABBiT TV Movie Club Gathering"
              decoding="async"
              className="rabtv-club-town-img"
            />
            <div
              className="absolute inset-0 bg-gradient-to-t from-[#0c0a09] via-[#0c0a09]/35 to-transparent pointer-events-none"
              aria-hidden="true"
            />

            {/* Top-Right Status Pill */}
            <div className="absolute top-3 right-3 z-10">
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[9.5px] sm:text-[10px] font-extrabold uppercase tracking-wider backdrop-blur-md ${tokens.badge}`}
              >
                🛡️ {getCommunityBackendLabel()}
              </span>
            </div>

            {/* Bottom-Left Title Overlay */}
            <div className="absolute inset-x-4 sm:inset-x-6 bottom-3 sm:bottom-4 z-10 flex items-center gap-3 min-w-0">
              <MascotAvatar
                mascot={myMascot}
                size="lg"
                rounded="full"
                className="h-11 w-11 sm:h-14 sm:w-14 shrink-0 border-2 border-white/25 bg-black/70 overflow-hidden [&_img]:w-full [&_img]:h-full [&_img]:object-cover shadow-xl"
                alt="My Mascot"
              />
              <div className="min-w-0 text-left">
                <h1 className="text-lg sm:text-2xl md:text-3xl font-black tracking-tight text-white leading-tight drop-shadow-[0_2px_10px_rgba(0,0,0,0.96)]">
                  RABBiT TV Movie Club
                </h1>
                <p className="text-[10.5px] sm:text-xs font-semibold text-zinc-200/90 leading-snug drop-shadow-[0_1px_6px_rgba(0,0,0,0.95)]">
                  Anonymous movie-buff cards • Moderated reviews & Watch Buddies
                </p>
              </div>
            </div>
          </div>

          {/* 4-Column Armored Tab Strip (rabbit-tv-community-tab-active.jpg / pill-inactive-dark.jpg) */}
          <div className="p-3 sm:p-4 bg-[#0c0a09]/92 border-t border-white/10">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(
                [
                  {
                    id: "profile",
                    shortLabel: "My Card",
                    fullLabel: "My Public Card",
                  },
                  {
                    id: "buffs",
                    shortLabel: `Buffs (${profiles.length})`,
                    fullLabel: `Movie Buffs (${profiles.length})`,
                  },
                  {
                    id: "buddies",
                    shortLabel:
                      pendingIncomingCount > 0
                        ? `Buddies (${pendingIncomingCount} New)`
                        : `Buddies (${threads.length})`,
                    fullLabel:
                      pendingIncomingCount > 0
                        ? `Buddies (${pendingIncomingCount} New)`
                        : `Buddies (${threads.length})`,
                  },
                  {
                    id: "reviews",
                    shortLabel: `Reviews (${reviews.length})`,
                    fullLabel: `Reviews (${reviews.length})`,
                  },
                ] as { id: ClubTab; shortLabel: string; fullLabel: string }[]
              ).map((tab) => {
                const isSelected = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    aria-pressed={isSelected}
                    className={`rabtv-club-tab rounded-xl ${
                      largeButtons ? "py-3 text-xs" : "py-2.5 text-[11px] sm:text-xs"
                    } font-extrabold text-white cursor-pointer focus:outline-none focus:ring-2 ${tokens.ring}`}
                  >
                    <span
                      className={`rabtv-club-tab-art ${
                        isSelected
                          ? "rabtv-club-tab-art--active"
                          : "rabtv-club-tab-art--idle"
                      }`}
                      aria-hidden="true"
                      style={{
                        backgroundImage: `url(${
                          isSelected ? IMG_COMM_TAB_ACTIVE : IMG_PILL_INACTIVE
                        })`,
                      }}
                    />
                    <span className="rabtv-club-btn-scrim" aria-hidden="true" />
                    <span className="rabtv-club-btn-label whitespace-nowrap truncate">
                      <span className="sm:hidden">{tab.shortLabel}</span>
                      <span className="hidden sm:inline">{tab.fullLabel}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Status Toast */}
        {toast && (
          <div
            className={`rounded-2xl border px-4 py-2.5 text-center text-xs font-extrabold shadow-xl ${
              toast.ok
                ? "bg-emerald-950/88 border-emerald-400/50 text-emerald-200"
                : "bg-red-950/88 border-red-400/50 text-red-200"
            }`}
          >
            {toast.text}
          </div>
        )}

        {/* Kids Safe Hard Guard / Unconfigured Relay */}
        {kidsLocked ? (
          <div
            className={`rabtv-club-plate rabtv-club-plate--empty rounded-3xl border text-center ${tokens.panel}`}
          >
            <div
              className="rabtv-club-plate-bg rabtv-club-plate-bg--empty"
              aria-hidden="true"
              style={{ backgroundImage: `url(${IMG_COMM_EMPTY_STATE})` }}
            />
            <div
              className="rabtv-club-plate-scrim rabtv-club-plate-scrim--empty"
              aria-hidden="true"
            />
            <div className="relative z-10 space-y-2">
              <p className="text-base font-black text-white">
                🧒 Kids Safe Mode Active
              </p>
              <p className={`text-xs max-w-md mx-auto leading-relaxed ${tokens.muted}`}>
                Public profiles, community ratings, and Watch Buddy chats are
                automatically locked for accounts under 13 or with Kids Safe
                Mode turned on.
              </p>
            </div>
          </div>
        ) : !isCommunityBackendConfigured() ? (
          <div
            className={`rabtv-club-plate rabtv-club-plate--empty rounded-3xl border text-center ${tokens.panel}`}
          >
            <div
              className="rabtv-club-plate-bg rabtv-club-plate-bg--empty"
              aria-hidden="true"
              style={{ backgroundImage: `url(${IMG_COMM_EMPTY_STATE})` }}
            />
            <div
              className="rabtv-club-plate-scrim rabtv-club-plate-scrim--empty"
              aria-hidden="true"
            />
            <div className="relative z-10 space-y-2">
              <p className="text-base font-black text-white">
                Community Relay Not Configured
              </p>
              <p className={`text-xs max-w-md mx-auto ${tokens.muted}`}>
                Ensure VITE_GIST_ID and VITE_GH_PAT are configured in your build
                secrets.
              </p>
            </div>
          </div>
        ) : activeTab === "profile" ? (
          /* ================= TAB 1: MY ANONYMOUS PUBLIC CARD ================= */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <form
              onSubmit={handleSaveProfile}
              className={`rabtv-club-plate rounded-3xl border ${tokens.panel}`}
            >
              <div
                className="rabtv-club-plate-bg"
                aria-hidden="true"
                style={{ backgroundImage: `url(${IMG_DETAILS_PANEL})` }}
              />
              <div className="rabtv-club-plate-scrim" aria-hidden="true" />

              <div className="relative z-10 space-y-4 text-left">
                <div>
                  <h2 className="text-base sm:text-lg font-black text-white">
                    Anonymous Public Identity
                  </h2>
                  <p className={`text-[11px] leading-relaxed mt-1 ${tokens.subMuted}`}>
                    Pick a public nickname just for Movie Club. Your private
                    profile name, age, PIN, and device ID never leave your
                    device.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label
                    className={`block text-[10px] font-extrabold uppercase tracking-wider ${tokens.subMuted}`}
                  >
                    Public Handle (3–20 chars, anonymous)
                  </label>
                  <div className="rabtv-club-input-shell rounded-xl">
                    <div
                      className="rabtv-club-input-bg"
                      aria-hidden="true"
                      style={{ backgroundImage: `url(${IMG_INPUT_BAR})` }}
                    />
                    <div className="rabtv-club-input-scrim" aria-hidden="true" />
                    <input
                      ref={handleRef}
                      type="text"
                      dir="ltr"
                      maxLength={20}
                      defaultValue={identity.publicHandle}
                      placeholder="e.g. NeonSciFiBuff"
                      style={{
                        direction: "ltr",
                        unicodeBidi: "plaintext",
                        textAlign: "left",
                      }}
                      className="relative z-10 w-full h-11 bg-transparent px-4 text-xs font-bold text-white placeholder-zinc-400 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label
                    className={`block text-[10px] font-extrabold uppercase tracking-wider ${tokens.subMuted}`}
                  >
                    Movie-Buff Tagline (Optional, max 140 chars)
                  </label>
                  <div className="rabtv-club-input-shell rounded-xl">
                    <div
                      className="rabtv-club-input-bg"
                      aria-hidden="true"
                      style={{ backgroundImage: `url(${IMG_INPUT_BAR})` }}
                    />
                    <div className="rabtv-club-input-scrim" aria-hidden="true" />
                    <input
                      ref={bioRef}
                      type="text"
                      dir="ltr"
                      maxLength={140}
                      defaultValue={identity.bio}
                      placeholder="e.g. Always down for 90s sci-fi & mystery thrillers"
                      style={{
                        direction: "ltr",
                        unicodeBidi: "plaintext",
                        textAlign: "left",
                      }}
                      className="relative z-10 w-full h-11 bg-transparent px-4 text-xs font-bold text-white placeholder-zinc-400 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-2 pt-1">
                  <label
                    className={`flex items-center justify-between gap-3 rounded-2xl border p-3 cursor-pointer ${tokens.sub}`}
                  >
                    <div className="min-w-0">
                      <span className="block text-xs font-extrabold text-white">
                        List My Card in Movie Buffs Directory
                      </span>
                      <span className={`block text-[10px] ${tokens.subMuted}`}>
                        Turn off anytime to disappear from public browsing
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={isPublic}
                      onChange={(e) => setIsPublic(e.target.checked)}
                      className="h-4 w-4 shrink-0"
                    />
                  </label>

                  <label
                    className={`flex items-center justify-between gap-3 rounded-2xl border p-3 cursor-pointer ${tokens.sub}`}
                  >
                    <div className="min-w-0">
                      <span className="block text-xs font-extrabold text-white">
                        Show My Recently Watched Shelf Publicly
                      </span>
                      <span className={`block text-[10px] ${tokens.subMuted}`}>
                        You can still hide any individual movie below
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={showWatchedList}
                      onChange={(e) => setShowWatchedList(e.target.checked)}
                      className="h-4 w-4 shrink-0"
                    />
                  </label>
                </div>

                <ClubArmoredBtn
                  type="submit"
                  variant="primary"
                  disabled={busy}
                  className="w-full h-11 text-xs uppercase tracking-wider"
                >
                  {busy ? "Syncing Securely..." : "Save & Sync Public Card"}
                </ClubArmoredBtn>

                {blockedIds.length > 0 && (
                  <div
                    className={`pt-2 border-t ${tokens.divider} flex items-center justify-between text-[11px]`}
                  >
                    <span className={tokens.subMuted}>
                      Blocked members: {blockedIds.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        blockedIds.forEach((id) => unblockCommunityUser(id));
                        setBlockedIds([]);
                        showToast(true, "Unblocked all members.");
                      }}
                      className={`underline font-bold cursor-pointer ${tokens.accent}`}
                    >
                      Unblock All
                    </button>
                  </div>
                )}
              </div>
            </form>

            {/* Live Public Card Preview (rabbit-tv-community-card-frame.jpg + stat-card) */}
            <div className={`rabtv-club-plate rounded-3xl border ${tokens.panel}`}>
              <div
                className="rabtv-club-plate-bg"
                aria-hidden="true"
                style={{ backgroundImage: `url(${IMG_COMM_CARD_FRAME})` }}
              />
              <div className="rabtv-club-plate-scrim" aria-hidden="true" />

              <div className="relative z-10 space-y-4 text-left">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-[10px] font-extrabold uppercase tracking-wider ${tokens.subMuted}`}
                  >
                    Live Public Card Preview
                  </span>
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold shrink-0 ${tokens.badge}`}
                  >
                    {isPublic ? "🟢 Public" : "🔒 Private"}
                  </span>
                </div>

                <div className="flex items-center gap-3.5">
                  <MascotAvatar
                    mascot={myMascot}
                    size="lg"
                    rounded="full"
                    className="h-16 w-16 shrink-0 border-2 border-white/15 overflow-hidden [&_img]:w-full [&_img]:h-full [&_img]:object-cover"
                    alt="My Mascot"
                  />
                  <div className="min-w-0">
                    <h3 className="text-lg font-black text-white truncate">
                      {identity.publicHandle || "Choose Your Handle"}
                    </h3>
                    <span
                      className={`inline-block mt-1 rounded-full border px-2.5 py-0.5 text-[11px] font-extrabold ${tokens.badge}`}
                    >
                      ✨ {vibePreview.topGenreVibe}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5 text-center">
                  <div className="rabtv-club-plate rabtv-club-plate--stat rounded-2xl">
                    <div
                      className="rabtv-club-plate-bg"
                      aria-hidden="true"
                      style={{ backgroundImage: `url(${IMG_STAT_CARD})` }}
                    />
                    <div className="rabtv-club-plate-scrim" aria-hidden="true" />
                    <div className="relative z-10">
                      <span
                        className={`block text-[9.5px] sm:text-[10px] uppercase font-bold ${tokens.subMuted}`}
                      >
                        Movies Watched
                      </span>
                      <strong className={`text-xl font-black ${tokens.accent}`}>
                        {vibePreview.moviesWatched}
                      </strong>
                    </div>
                  </div>
                  <div className="rabtv-club-plate rabtv-club-plate--stat rounded-2xl">
                    <div
                      className="rabtv-club-plate-bg"
                      aria-hidden="true"
                      style={{ backgroundImage: `url(${IMG_STAT_CARD})` }}
                    />
                    <div className="rabtv-club-plate-scrim" aria-hidden="true" />
                    <div className="relative z-10">
                      <span
                        className={`block text-[9.5px] sm:text-[10px] uppercase font-bold ${tokens.subMuted}`}
                      >
                        Shows Watched
                      </span>
                      <strong className={`text-xl font-black ${tokens.accent}`}>
                        {vibePreview.showsWatched}
                      </strong>
                    </div>
                  </div>
                </div>

                {showWatchedList && vibePreview.recentWatched.length > 0 && (
                  <div className="space-y-2">
                    <span
                      className={`block text-[10px] font-extrabold uppercase tracking-wider ${tokens.subMuted}`}
                    >
                      Public Watched Shelf (Tap ✕ to hide)
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {vibePreview.recentWatched.map((w) => (
                        <span
                          key={`${w.mediaType}-${w.mediaId}`}
                          className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-[11px] font-bold ${tokens.sub}`}
                        >
                          <span className="truncate max-w-[160px]">{w.title}</span>
                          <button
                            type="button"
                            onClick={() => {
                              toggleHideTitleFromPublicProfile(w.mediaId);
                              setVibePreview(computeMyPublicVibePreview());
                              showToast(
                                true,
                                `Hid "${w.title}" from your public card (tap Save to sync).`
                              );
                            }}
                            className="text-red-400 hover:text-red-200 font-black cursor-pointer shrink-0"
                            title="Hide this movie from public profile"
                          >
                            ✕
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : activeTab === "buffs" ? (
          /* ================= TAB 2: MOVIE BUFFS DIRECTORY ================= */
          <div className="space-y-4">
            <ClubSectionBanner title="Public Movie-Buff Profiles" />

            {profiles.length === 0 ? (
              <div
                className={`rabtv-club-plate rabtv-club-plate--empty rounded-3xl border text-center ${tokens.panel}`}
              >
                <div
                  className="rabtv-club-plate-bg rabtv-club-plate-bg--empty"
                  aria-hidden="true"
                  style={{ backgroundImage: `url(${IMG_COMM_EMPTY_STATE})` }}
                />
                <div
                  className="rabtv-club-plate-scrim rabtv-club-plate-scrim--empty"
                  aria-hidden="true"
                />
                <p className={`relative z-10 text-xs sm:text-sm ${tokens.muted}`}>
                  No public movie buffs yet — switch to{" "}
                  <strong className="text-white">My Public Card</strong> to be
                  the first!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {profiles.map((prof) => {
                  const isMe = prof.publicId === identity.publicId;
                  return (
                    <div
                      key={prof.publicId}
                      className={`rabtv-club-plate rabtv-club-plate--card rounded-3xl border flex flex-col justify-between ${tokens.panel}`}
                    >
                      <div
                        className="rabtv-club-plate-bg"
                        aria-hidden="true"
                        style={{ backgroundImage: `url(${IMG_COMM_CARD_FRAME})` }}
                      />
                      <div className="rabtv-club-plate-scrim" aria-hidden="true" />

                      <div className="relative z-10 flex flex-col justify-between gap-3 h-full text-left">
                        <div className="space-y-2.5">
                          <div className="flex items-center gap-3">
                            <MascotAvatar
                              mascot={prof.mascot}
                              size="lg"
                              rounded="full"
                              className="h-12 w-12 shrink-0 overflow-hidden [&_img]:w-full [&_img]:h-full [&_img]:object-cover"
                              alt={prof.handle}
                            />
                            <div className="min-w-0 flex-1">
                              <h3 className="text-sm font-black text-white truncate">
                                {prof.handle} {isMe ? "(You)" : ""}
                              </h3>
                              <span
                                className={`inline-block mt-0.5 rounded-full border px-2 py-0.5 text-[10px] font-extrabold ${tokens.badge}`}
                              >
                                ✨ {prof.topGenreVibe}
                              </span>
                            </div>
                          </div>

                          {prof.bio && (
                            <p className={`text-xs leading-snug ${tokens.muted}`}>
                              “{prof.bio}”
                            </p>
                          )}

                          <p className={`text-[11px] font-bold ${tokens.subMuted}`}>
                            🎬 {prof.moviesWatched} movies • 📺 {prof.showsWatched} shows
                          </p>

                          {prof.showWatchedList && prof.recentWatched.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {prof.recentWatched.slice(0, 4).map((w) => (
                                <button
                                  key={`${w.mediaType}-${w.mediaId}`}
                                  type="button"
                                  onClick={() =>
                                    navigate({
                                      to: "/details",
                                      search: { id: w.mediaId, type: w.mediaType },
                                    })
                                  }
                                  className={`rounded-lg border px-2 py-0.5 text-[10px] font-bold hover:text-white cursor-pointer truncate max-w-[140px] ${tokens.sub} ${tokens.muted}`}
                                >
                                  {w.title}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {!isMe && (
                          <div
                            className={`flex items-center gap-2 pt-2.5 border-t ${tokens.divider}`}
                          >
                            <ClubArmoredBtn
                              variant="primary"
                              onClick={() => setInviteTarget(prof)}
                              className="flex-1 py-2 text-[11px] whitespace-nowrap"
                            >
                              Watch Together
                            </ClubArmoredBtn>
                            <ClubArmoredBtn
                              variant="danger"
                              onClick={async () => {
                                const r = await reportCommunityItem(
                                  "profile",
                                  prof.publicId
                                );
                                showToast(
                                  r.ok,
                                  r.ok
                                    ? "🚩 Profile reported."
                                    : r.error || "Failed."
                                );
                              }}
                              title="Report profile"
                              ariaLabel="Report profile"
                              className="py-2 text-[11px] shrink-0"
                            >
                              🚩
                            </ClubArmoredBtn>
                            <ClubArmoredBtn
                              variant="danger"
                              onClick={() => {
                                blockCommunityUser(prof.publicId);
                                showToast(true, `🚫 Blocked ${prof.handle}.`);
                              }}
                              title="Block user"
                              ariaLabel="Block user"
                              className="py-2 text-[11px] shrink-0"
                            >
                              🚫
                            </ClubArmoredBtn>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : activeTab === "buddies" ? (
          /* ================= TAB 3: ASYNC WATCH BUDDIES ================= */
          <div className="space-y-4">
            <ClubSectionBanner title="Watch Buddy Requests & Movie Chats" />

            {threads.length === 0 ? (
              <div
                className={`rabtv-club-plate rabtv-club-plate--empty rounded-3xl border text-center ${tokens.panel}`}
              >
                <div
                  className="rabtv-club-plate-bg rabtv-club-plate-bg--empty"
                  aria-hidden="true"
                  style={{ backgroundImage: `url(${IMG_COMM_EMPTY_STATE})` }}
                />
                <div
                  className="rabtv-club-plate-scrim rabtv-club-plate-scrim--empty"
                  aria-hidden="true"
                />
                <div className="relative z-10 space-y-2">
                  <p className="text-sm sm:text-base font-black text-white">
                    No Watch Buddy threads yet!
                  </p>
                  <p
                    className={`text-xs max-w-md mx-auto leading-relaxed ${tokens.muted}`}
                  >
                    Invite someone from{" "}
                    <strong className="text-white">Movie Buffs</strong> or any
                    movie&apos;s{" "}
                    <strong className="text-white">Community Reviews</strong>.
                    You each watch on your own time and trade spoiler-safe
                    thoughts here!
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Thread List */}
                <div className="space-y-3">
                  {threads.map((t) => {
                    const isIncoming = t.toId === identity.publicId;
                    const peerHandle = isIncoming ? t.fromHandle : t.toHandle;
                    const peerMascot = isIncoming ? t.fromMascot : t.toMascot;
                    const isSelected = activeThreadId === t.threadId;

                    return (
                      <div
                        key={t.threadId}
                        className={`rabtv-club-plate rabtv-club-plate--card rounded-3xl border transition ${
                          isSelected
                            ? `${tokens.panel} ring-2 ring-white/30`
                            : tokens.panel
                        }`}
                      >
                        <div
                          className="rabtv-club-plate-bg"
                          aria-hidden="true"
                          style={{ backgroundImage: `url(${IMG_COMM_CARD_FRAME})` }}
                        />
                        <div className="rabtv-club-plate-scrim" aria-hidden="true" />

                        <div className="relative z-10 space-y-3 text-left">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <MascotAvatar
                                mascot={peerMascot}
                                size="sm"
                                rounded="full"
                                className="h-9 w-9 shrink-0 overflow-hidden [&_img]:w-full [&_img]:h-full [&_img]:object-cover"
                                alt={peerHandle}
                              />
                              <div className="min-w-0">
                                <p className="text-xs font-black text-white truncate">
                                  {t.title}
                                </p>
                                <p className={`text-[10px] truncate ${tokens.subMuted}`}>
                                  with{" "}
                                  <strong className={tokens.accent}>
                                    {peerHandle}
                                  </strong>{" "}
                                  •{" "}
                                  {t.status === "pending"
                                    ? isIncoming
                                      ? "Incoming Invite"
                                      : "Waiting for Reply"
                                    : `${t.messages.length} msgs`}
                                </p>
                              </div>
                            </div>

                            <ClubArmoredBtn
                              variant="idle"
                              onClick={() =>
                                navigate({
                                  to: "/details",
                                  search: { id: t.mediaId, type: t.mediaType },
                                })
                              }
                              className="shrink-0 py-1.5 text-[10px] whitespace-nowrap"
                            >
                              ▶ Open
                            </ClubArmoredBtn>
                          </div>

                          {t.note && t.status === "pending" && (
                            <p className={`text-xs italic ${tokens.muted}`}>
                              “{t.note}”
                            </p>
                          )}

                          {t.status === "pending" && isIncoming ? (
                            <div className="grid grid-cols-3 gap-2">
                              <ClubArmoredBtn
                                variant="primary"
                                disabled={busy}
                                onClick={() =>
                                  void handleBuddyResponse(t.threadId, "accept")
                                }
                                className="py-2 text-[11px] whitespace-nowrap"
                              >
                                Accept
                              </ClubArmoredBtn>
                              <ClubArmoredBtn
                                variant="idle"
                                disabled={busy}
                                onClick={() =>
                                  void handleBuddyResponse(t.threadId, "decline")
                                }
                                className="py-2 text-[11px] whitespace-nowrap"
                              >
                                Decline
                              </ClubArmoredBtn>
                              <ClubArmoredBtn
                                variant="danger"
                                disabled={busy}
                                onClick={() =>
                                  void handleBuddyResponse(t.threadId, "block")
                                }
                                className="py-2 text-[11px] whitespace-nowrap"
                              >
                                Block
                              </ClubArmoredBtn>
                            </div>
                          ) : t.status === "accepted" ? (
                            <ClubArmoredBtn
                              variant="primary"
                              onClick={() => setActiveThreadId(t.threadId)}
                              className="w-full py-2 text-xs whitespace-nowrap"
                            >
                              Open Movie Chat ({t.messages.length})
                            </ClubArmoredBtn>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Active Async Movie Discussion Pane */}
                <div
                  className={`rabtv-club-plate rounded-3xl border min-h-[340px] flex flex-col justify-between ${tokens.panel}`}
                >
                  <div
                    className={`rabtv-club-plate-bg ${
                      activeThread ? "" : "rabtv-club-plate-bg--empty"
                    }`}
                    aria-hidden="true"
                    style={{
                      backgroundImage: `url(${
                        activeThread ? IMG_COMM_CARD_FRAME : IMG_COMM_EMPTY_STATE
                      })`,
                    }}
                  />
                  <div
                    className={`rabtv-club-plate-scrim ${
                      activeThread ? "" : "rabtv-club-plate-scrim--empty"
                    }`}
                    aria-hidden="true"
                  />

                  {activeThread ? (
                    <div className="relative z-10 flex flex-col justify-between gap-3 flex-1 text-left">
                      <div
                        className={`flex items-center justify-between gap-2 pb-2.5 border-b ${tokens.divider}`}
                      >
                        <div className="min-w-0">
                          <h3 className="text-sm font-black text-white truncate">
                            {activeThread.title}
                          </h3>
                          <p className={`text-[10px] ${tokens.subMuted}`}>
                            Async movie chat with{" "}
                            {activeThread.fromId === identity.publicId
                              ? activeThread.toHandle
                              : activeThread.fromHandle}
                          </p>
                        </div>
                        <ClubArmoredBtn
                          variant="primary"
                          onClick={() =>
                            navigate({
                              to: "/player",
                              search: {
                                id: activeThread.mediaId,
                                type: activeThread.mediaType,
                                season: 1,
                                episode: 1,
                              },
                            })
                          }
                          className="shrink-0 py-1.5 text-[11px] whitespace-nowrap"
                        >
                          ▶ Watch
                        </ClubArmoredBtn>
                      </div>

                      <div className="flex-1 space-y-2 max-h-72 overflow-y-auto scrollbar-none pr-1">
                        {activeThread.messages.length === 0 ? (
                          <p
                            className={`text-xs text-center py-8 ${tokens.subMuted}`}
                          >
                            Watch the movie on your own time and drop your first
                            reaction below!
                          </p>
                        ) : (
                          activeThread.messages.map((m) => {
                            const mine = m.senderId === identity.publicId;
                            const hidden =
                              m.isSpoiler && !revealedSpoilers.has(m.msgId);
                            return (
                              <div
                                key={m.msgId}
                                className={`rounded-2xl border p-2.5 text-xs space-y-1 ${
                                  mine ? tokens.badge : tokens.sub
                                }`}
                              >
                                <div className="flex items-center justify-between text-[10px] opacity-80">
                                  <strong>{mine ? "You" : m.senderHandle}</strong>
                                  <span>{formatAgo(m.sentAt)}</span>
                                </div>
                                {hidden ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setRevealedSpoilers((prev) => {
                                        const n = new Set(prev);
                                        n.add(m.msgId);
                                        return n;
                                      })
                                    }
                                    className="underline font-bold cursor-pointer"
                                  >
                                    🙈 Spoiler blurred — tap to reveal
                                  </button>
                                ) : (
                                  <p className="text-white leading-relaxed">
                                    {m.text}
                                  </p>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>

                      <form
                        onSubmit={(e) =>
                          void handleSendChatMsg(e, activeThread.threadId)
                        }
                        className={`space-y-2 pt-2.5 border-t ${tokens.divider}`}
                      >
                        <div className="flex items-center justify-between text-[10px]">
                          <label className="inline-flex items-center gap-1.5 font-bold cursor-pointer">
                            <input
                              type="checkbox"
                              checked={chatSpoiler}
                              onChange={(e) => setChatSpoiler(e.target.checked)}
                            />
                            <span>Blur message as spoiler</span>
                          </label>
                          <span className={tokens.subMuted}>🛡️ Moderated</span>
                        </div>
                        <div className="flex gap-2">
                          <div className="rabtv-club-input-shell flex-1 rounded-xl">
                            <div
                              className="rabtv-club-input-bg"
                              aria-hidden="true"
                              style={{ backgroundImage: `url(${IMG_INPUT_BAR})` }}
                            />
                            <div
                              className="rabtv-club-input-scrim"
                              aria-hidden="true"
                            />
                            <input
                              ref={chatInputRef}
                              type="text"
                              dir="ltr"
                              maxLength={360}
                              placeholder="Share your thoughts on this movie..."
                              style={{
                                direction: "ltr",
                                unicodeBidi: "plaintext",
                                textAlign: "left",
                              }}
                              className="relative z-10 w-full h-10 bg-transparent px-3.5 text-xs font-bold text-white placeholder-zinc-400 focus:outline-none"
                            />
                          </div>
                          <ClubArmoredBtn
                            type="submit"
                            variant="primary"
                            disabled={busy}
                            className="h-10 text-xs shrink-0"
                          >
                            Send
                          </ClubArmoredBtn>
                        </div>
                      </form>
                    </div>
                  ) : (
                    <div className="relative z-10 flex-1 flex items-center justify-center text-center p-4">
                      <p className={`text-xs sm:text-sm ${tokens.muted}`}>
                        Select an accepted Watch Buddy on the left to open your
                        async movie chat.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ================= TAB 4: LATEST COMMUNITY REVIEWS ================= */
          <div className="space-y-4">
            <ClubSectionBanner title="Latest Community Ratings & Reviews" />

            {reviews.length === 0 ? (
              <div
                className={`rabtv-club-plate rabtv-club-plate--empty rounded-3xl border text-center ${tokens.panel}`}
              >
                <div
                  className="rabtv-club-plate-bg rabtv-club-plate-bg--empty"
                  aria-hidden="true"
                  style={{ backgroundImage: `url(${IMG_COMM_EMPTY_STATE})` }}
                />
                <div
                  className="rabtv-club-plate-scrim rabtv-club-plate-scrim--empty"
                  aria-hidden="true"
                />
                <p className={`relative z-10 text-xs sm:text-sm ${tokens.muted}`}>
                  No reviews posted yet — open any movie or TV show and tap{" "}
                  <strong className="text-white">Rate & Reviews</strong>!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {reviews.map((rev) => {
                  const hidden =
                    rev.isSpoiler && !revealedSpoilers.has(rev.reviewId);
                  return (
                    <div
                      key={rev.reviewId}
                      className={`rabtv-club-plate rabtv-club-plate--card rounded-3xl border text-left ${tokens.panel}`}
                    >
                      <div
                        className="rabtv-club-plate-bg"
                        aria-hidden="true"
                        style={{ backgroundImage: `url(${IMG_COMM_CARD_FRAME})` }}
                      />
                      <div className="rabtv-club-plate-scrim" aria-hidden="true" />

                      <div className="relative z-10 space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              navigate({
                                to: "/details",
                                search: { id: rev.mediaId, type: rev.mediaType },
                              })
                            }
                            className="text-sm font-black text-white hover:underline truncate text-left cursor-pointer"
                          >
                            {rev.title}
                          </button>
                          <span className="text-xs font-black text-amber-400 shrink-0">
                            {"★".repeat(rev.rating)}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-[11px] flex-wrap">
                          <MascotAvatar
                            mascot={rev.authorMascot}
                            size="sm"
                            rounded="full"
                            className="h-6 w-6 shrink-0 overflow-hidden [&_img]:w-full [&_img]:h-full [&_img]:object-cover"
                            alt={rev.authorHandle}
                          />
                          <span className={`font-extrabold ${tokens.accent}`}>
                            {rev.authorHandle}
                          </span>
                          <span className={tokens.subMuted}>
                            • {formatAgo(rev.updatedAt)}
                          </span>
                          <span
                            className={`ml-auto rounded-full border px-2 py-0.5 text-[9.5px] font-extrabold ${
                              rev.liked
                                ? "bg-emerald-950/75 border-emerald-500/40 text-emerald-300"
                                : "bg-red-950/75 border-red-500/40 text-red-300"
                            }`}
                          >
                            {rev.liked ? "👍 Liked" : "👎 Disliked"}
                          </span>
                        </div>

                        {rev.comment &&
                          (hidden ? (
                            <ClubArmoredBtn
                              variant="idle"
                              onClick={() =>
                                setRevealedSpoilers((prev) => {
                                  const n = new Set(prev);
                                  n.add(rev.reviewId);
                                  return n;
                                })
                              }
                              className="w-full py-2 text-[11px]"
                            >
                              🙈 Spoiler — Tap to Reveal
                            </ClubArmoredBtn>
                          ) : (
                            <p className={`text-xs leading-relaxed ${tokens.muted}`}>
                              {rev.comment}
                            </p>
                          ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Watch Buddy Movie Picker Modal (Reused Details Panel Plate) */}
      {inviteTarget && (
        <div
          className="rabtv-vidsrc-protected fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
          onClick={() => setInviteTarget(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`rabtv-club-plate w-full max-w-md max-h-[85dvh] overflow-y-auto scrollbar-none rounded-3xl border text-left ${tokens.panel}`}
          >
            <div
              className="rabtv-club-plate-bg"
              aria-hidden="true"
              style={{ backgroundImage: `url(${IMG_DETAILS_PANEL})` }}
            />
            <div className="rabtv-club-plate-scrim" aria-hidden="true" />

            <div className="relative z-10 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm sm:text-base font-black text-white truncate">
                  Watch Together with {inviteTarget.handle}
                </h3>
                <ClubArmoredBtn
                  variant="idle"
                  onClick={() => setInviteTarget(null)}
                  ariaLabel="Close Watch Together modal"
                  className="h-8 w-8 rounded-full text-xs shrink-0"
                >
                  ✕
                </ClubArmoredBtn>
              </div>

              <div className="rabtv-club-input-shell rounded-xl">
                <div
                  className="rabtv-club-input-bg"
                  aria-hidden="true"
                  style={{ backgroundImage: `url(${IMG_INPUT_BAR})` }}
                />
                <div className="rabtv-club-input-scrim" aria-hidden="true" />
                <input
                  ref={inviteNoteRef}
                  type="text"
                  dir="ltr"
                  maxLength={160}
                  placeholder="Optional note (e.g. Let's watch this weekend & chat!)"
                  style={{
                    direction: "ltr",
                    unicodeBidi: "plaintext",
                    textAlign: "left",
                  }}
                  className="relative z-10 w-full h-10 bg-transparent px-3.5 text-xs font-bold text-white placeholder-zinc-400 focus:outline-none"
                />
              </div>

              <div className="space-y-2">
                <span
                  className={`block text-[10px] font-extrabold uppercase tracking-wider ${tokens.subMuted}`}
                >
                  Pick a Movie/Show to Discuss
                </span>
                {[
                  ...(inviteTarget.recentWatched || []),
                  ...(vibePreview.recentWatched || []),
                ].length === 0 ? (
                  <p className={`text-xs leading-relaxed ${tokens.subMuted}`}>
                    Open any movie or show page and tap{" "}
                    <strong className="text-white">
                      Rate & Reviews → Watch Together
                    </strong>{" "}
                    to invite {inviteTarget.handle} to that title!
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-56 overflow-y-auto scrollbar-none">
                    {Array.from(
                      new Map(
                        [
                          ...(inviteTarget.recentWatched || []),
                          ...(vibePreview.recentWatched || []),
                        ].map((w) => [`${w.mediaType}-${w.mediaId}`, w])
                      ).values()
                    ).map((movie) => (
                      <button
                        key={`${movie.mediaType}-${movie.mediaId}`}
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void handleSendInviteForMovie(inviteTarget, movie)
                        }
                        className={`w-full flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-xs font-bold cursor-pointer transition ${tokens.btnSecondary}`}
                      >
                        <span className="truncate">🎬 {movie.title}</span>
                        <span className="text-[10px] shrink-0">Invite →</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}