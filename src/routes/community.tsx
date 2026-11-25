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
// COMMITTED COMMUNITY PAGE IMAGE ASSETS (5 DEDICATED + REUSED CROSS-PAGE PLATES)
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

// Reused Cross-Page Assets (1:1 Continuity across Index, Details, Player, Search & Watch History)
const IMG_BUTTON_WRAPPER =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-button-wrapper-background.jpg";
const IMG_BTN_HOME =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-search-button-home-primary.jpg";
const IMG_BTN_PLAY_PRIMARY =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-button-play-primary.jpg";
const IMG_BTN_FILTER_IDLE =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-search-button-filter-idle.jpg";
const IMG_BTN_FILTER_ACTIVE =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-search-button-filter-active.jpg";
const IMG_BTN_DANGER =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-search-button-clear-danger.jpg";
const IMG_PILL_INACTIVE =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-pill-inactive-dark.jpg";
const IMG_INPUT_BAR =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-search-input-bar-background.jpg";
const IMG_STAT_CARD =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-stat-card-background.jpg";

const TAGLINE_STARTERS = [
  "90s Sci-Fi & Mystery Buff",
  "Late-Night Horror Fan",
  "Cozy Binge Watcher",
  "Action & Thriller Addict",
  "Comedy & Popcorn Crew",
];

const QUICK_CHAT_REACTIONS = [
  "🍿 Starting now!",
  "🔥 Loved it!",
  "🤯 Wild plot twist!",
  "😂 Hilarious",
  "⭐ 10/10 Classic",
];

const QUICK_INVITE_NOTES = [
  "Watch this weekend & chat!",
  "No spoilers till we finish!",
  "Classic rewatch — you in?",
];

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
    padding: 0 clamp(14px, 4.5%, 28px);
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

  /* Unobstructed Split Hero Showcase (16:9 Town Art Above + Dedicated Identity & 4-Tab Bar Below) */
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
    max-height: 390px;
    overflow: hidden;
    background-color: #0c0a09;
  }

  .rabtv-club-town-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center 28%;
    display: block;
  }

  /* =========================================================================
     PIXEL-PRECISE 9-SLICE ARMORED CONTAINERS (ZERO BORDER STRETCHING!)
     Outer rails stay a locked pixel thickness regardless of card height,
     guaranteeing 100% of text sits inside the dark center bay + extra cushion.
     ========================================================================= */

  .rabtv-club-plate {
    position: relative;
    overflow: hidden;
    box-sizing: border-box;
    padding: 40px 36px !important;
    background-color: #0c0a09;
    contain: layout paint;
  }

  @media (min-width: 640px) {
    .rabtv-club-plate {
      padding: 48px 44px !important;
    }
  }

  .rabtv-club-9slice-card {
    position: absolute;
    inset: 0;
    box-sizing: border-box;
    border-style: solid;
    border-color: transparent;
    border-width: 26px 22px;
    border-image-source: url("${IMG_COMM_CARD_FRAME}");
    border-image-slice: 13% 11% fill;
    border-image-repeat: stretch;
    filter: var(--rabtv-club-plate-filter);
    pointer-events: none;
    z-index: 0;
  }

  @media (min-width: 640px) {
    .rabtv-club-9slice-card {
      border-width: 32px 28px;
    }
  }

  .rabtv-club-plate-scrim {
    position: absolute;
    inset: 24px 20px;
    border-radius: 14px;
    background: rgba(12, 10, 9, 0.34);
    pointer-events: none;
    z-index: 1;
  }

  @media (min-width: 640px) {
    .rabtv-club-plate-scrim {
      inset: 30px 26px;
    }
  }

  /* 9-Sliced Stat Cards (Movies Watched / Shows Watched) */
  .rabtv-club-stat {
    position: relative;
    overflow: hidden;
    box-sizing: border-box;
    padding: 20px 22px !important;
    background-color: #0c0a09;
    contain: layout paint;
  }

  .rabtv-club-9slice-stat {
    position: absolute;
    inset: 0;
    box-sizing: border-box;
    border-style: solid;
    border-color: transparent;
    border-width: 14px 16px;
    border-image-source: url("${IMG_STAT_CARD}");
    border-image-slice: 20% 14% fill;
    border-image-repeat: stretch;
    filter: var(--rabtv-club-plate-filter);
    pointer-events: none;
    z-index: 0;
  }

  /* 9-Sliced 21:9 Movie Club Section Banner (Film-Reel & Rabbit-Ear Clamps Locked Cleanly at Ends) */
  .rabtv-club-section-banner {
    position: relative;
    width: 100%;
    min-height: 54px;
    box-sizing: border-box;
    padding: 15px 64px !important;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 18px;
    overflow: hidden;
    background-color: #0c0a09;
    contain: layout paint;
  }

  @media (min-width: 640px) {
    .rabtv-club-section-banner {
      min-height: 64px;
      padding: 18px 88px !important;
    }
  }

  .rabtv-club-9slice-banner {
    position: absolute;
    inset: 0;
    box-sizing: border-box;
    border-style: solid;
    border-color: transparent;
    border-width: 11px 52px;
    border-image-source: url("${IMG_COMM_SECTION_BANNER}");
    border-image-slice: 18% 20% fill;
    border-image-repeat: stretch;
    filter: var(--rabtv-club-plate-filter);
    pointer-events: none;
    z-index: 0;
  }

  @media (min-width: 640px) {
    .rabtv-club-9slice-banner {
      border-width: 13px 72px;
    }
  }

  /* Empty State Underground Lounge Panel */
  .rabtv-club-empty {
    position: relative;
    overflow: hidden;
    box-sizing: border-box;
    padding: 44px 36px !important;
    background-color: #0c0a09;
    contain: layout paint;
  }

  @media (min-width: 640px) {
    .rabtv-club-empty {
      padding: 58px 56px !important;
    }
  }

  .rabtv-club-empty-bg {
    position: absolute;
    inset: 0;
    background-size: cover;
    background-position: center center;
    background-repeat: no-repeat;
    opacity: 0.68;
    pointer-events: none;
    z-index: 0;
  }

  .rabtv-club-empty-scrim {
    position: absolute;
    inset: 0;
    background: radial-gradient(
      ellipse 78% 72% at 50% 44%,
      rgba(12, 10, 9, 0.80) 0%,
      rgba(12, 10, 9, 0.50) 68%,
      rgba(12, 10, 9, 0.36) 100%
    );
    pointer-events: none;
    z-index: 1;
  }

  /* 9-Sliced 4:1 Navigation Tab Plates (Zero Side-Clamp Clipping) */
  .rabtv-club-tab {
    position: relative;
    overflow: hidden;
    box-sizing: border-box;
    padding: 11px 26px !important;
    background-color: #0c0a09;
    border: 0 !important;
    contain: layout paint;
    transition: transform 150ms ease, opacity 150ms ease;
  }

  .rabtv-club-tab:hover { transform: scale(1.02); }
  .rabtv-club-tab:active { transform: scale(0.98); }

  .rabtv-club-9slice-tab-active {
    position: absolute;
    inset: 0;
    box-sizing: border-box;
    border-style: solid;
    border-color: transparent;
    border-width: 9px 22px;
    border-image-source: url("${IMG_COMM_TAB_ACTIVE}");
    border-image-slice: 28% 20% fill;
    border-image-repeat: stretch;
    filter: var(--rabtv-club-plate-filter) brightness(1.06);
    pointer-events: none;
    z-index: 0;
  }

  .rabtv-club-9slice-tab-idle {
    position: absolute;
    inset: 0;
    box-sizing: border-box;
    border-style: solid;
    border-color: transparent;
    border-width: 8px 18px;
    border-image-source: url("${IMG_PILL_INACTIVE}");
    border-image-slice: 24% 16% fill;
    border-image-repeat: stretch;
    opacity: 0.88;
    filter: var(--rabtv-club-plate-filter) brightness(0.92);
    pointer-events: none;
    z-index: 0;
  }

  /* 9-Sliced Armored Input Housing (Typed Text & Placeholders Never Touch Side Clamps!) */
  .rabtv-club-input-shell {
    position: relative;
    overflow: hidden;
    background-color: #0c0a09;
    contain: layout paint;
  }

  .rabtv-club-9slice-input {
    position: absolute;
    inset: 0;
    box-sizing: border-box;
    border-style: solid;
    border-color: transparent;
    border-width: 8px 22px;
    border-image-source: url("${IMG_INPUT_BAR}");
    border-image-slice: 22% 14% fill;
    border-image-repeat: stretch;
    filter: var(--rabtv-club-plate-filter);
    pointer-events: none;
    z-index: 0;
  }

  .rabtv-club-input-scrim {
    position: absolute;
    inset: 6px 20px;
    border-radius: 6px;
    background: rgba(12, 10, 9, 0.42);
    pointer-events: none;
    z-index: 1;
  }

  .rabtv-club-input-field {
    position: relative;
    z-index: 10;
    width: 100%;
    box-sizing: border-box;
    padding-inline: 28px !important;
    background: transparent;
    color: #ffffff;
    outline: none;
  }

  @media (min-width: 640px) {
    .rabtv-club-input-field {
      padding-inline: 32px !important;
    }
  }

  /* Universal Armored Image Buttons with Generous Clamp-Safe Side Padding */
  .rabtv-club-btn {
    position: relative;
    overflow: hidden;
    box-sizing: border-box;
    padding-inline: clamp(22px, 8%, 34px) !important;
    background-color: #0c0a09;
    border: 0 !important;
    box-shadow: none !important;
    contain: layout paint;
    transition: transform 150ms ease, opacity 150ms ease;
  }

  .rabtv-club-btn--compact {
    padding-inline: 12px !important;
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
      ellipse 94% 86% at 50% 50%,
      rgba(12, 10, 9, 1) 74%,
      rgba(12, 10, 9, 0.65) 94%,
      transparent 100%
    );
    mask-image: radial-gradient(
      ellipse 94% 86% at 50% 50%,
      rgba(12, 10, 9, 1) 74%,
      rgba(12, 10, 9, 0.65) 94%,
      transparent 100%
    );
  }

  .rabtv-club-btn-art--primary {
    opacity: 0.96;
    filter: var(--rabtv-club-play-filter);
  }

  .rabtv-club-btn-art--active {
    opacity: 0.98;
    filter: saturate(1.08) brightness(1.05);
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
`;

export const Route = createFileRoute("/community")({
  component: CommunityPage,
});

type ClubTab = "profile" | "buffs" | "buddies" | "reviews";
type ClubBtnVariant = "primary" | "active" | "idle" | "danger" | "home";
type BuffSort = "match" | "watched" | "recent";
type BuddyFilter = "all" | "pending" | "active";
type ReviewFilter = "all" | "liked" | "disliked" | "top" | "movie" | "tv";

function sanitizeInputText(raw: string, maxLen: number): string {
  return String(raw || "")
    .replace(/[\u0000-\u001F\u007F<>]/g, "")
    .slice(0, maxLen);
}

function getCinemaRank(totalWatched: number): { label: string; tier: string } {
  if (totalWatched >= 100) return { label: "Cinema Legend", tier: "Tier V" };
  if (totalWatched >= 50) return { label: "Projectionist", tier: "Tier IV" };
  if (totalWatched >= 25) return { label: "Cinephile", tier: "Tier III" };
  if (totalWatched >= 10) return { label: "Film Buff", tier: "Tier II" };
  return { label: "Club Member", tier: "Tier I" };
}

function computeTasteMatch(
  myVibe: ReturnType<typeof computeMyPublicVibePreview>,
  other: CommunityProfile
): { pct: number; sharedTitles: string[] } {
  const myIds = new Map<string, string>();
  for (const w of myVibe.recentWatched || []) {
    myIds.set(`${w.mediaType}-${w.mediaId}`, w.title);
  }
  const sharedTitles: string[] = [];
  for (const w of other.recentWatched || []) {
    const key = `${w.mediaType}-${w.mediaId}`;
    if (myIds.has(key)) {
      sharedTitles.push(w.title);
    }
  }
  const sameVibe =
    Boolean(myVibe.topGenreVibe) &&
    Boolean(other.topGenreVibe) &&
    myVibe.topGenreVibe.toLowerCase() === other.topGenreVibe.toLowerCase();

  let score = sameVibe ? 76 : 48;
  score += Math.min(22, sharedTitles.length * 8);
  if (
    Math.abs((myVibe.moviesWatched || 0) - (other.moviesWatched || 0)) <= 10
  ) {
    score += 4;
  }
  return { pct: Math.min(99, score), sharedTitles };
}

const ClubArmoredBtn = memo(function ClubArmoredBtn({
  variant = "idle",
  compact = false,
  className = "",
  children,
  onClick,
  type = "button",
  disabled = false,
  title,
  ariaLabel,
  ariaPressed,
}: {
  variant?: ClubBtnVariant;
  compact?: boolean;
  className?: string;
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  type?: "button" | "submit";
  disabled?: boolean;
  title?: string;
  ariaLabel?: string;
  ariaPressed?: boolean;
}) {
  const bgUrl =
    variant === "home"
      ? IMG_BTN_HOME
      : variant === "primary"
        ? IMG_BTN_PLAY_PRIMARY
        : variant === "active"
          ? IMG_BTN_FILTER_ACTIVE
          : variant === "danger"
            ? IMG_BTN_DANGER
            : IMG_BTN_FILTER_IDLE;

  const artMod =
    variant === "primary"
      ? "rabtv-club-btn-art--primary"
      : variant === "active"
        ? "rabtv-club-btn-art--active"
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
      aria-pressed={ariaPressed}
      className={`rabtv-club-btn ${
        compact ? "rabtv-club-btn--compact" : ""
      } rounded-xl text-white font-extrabold cursor-pointer disabled:opacity-45 disabled:pointer-events-none focus:outline-none focus:ring-2 focus:ring-cyan-400 ${className}`}
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
      <div className="rabtv-club-9slice-banner" aria-hidden="true" />
      <h2 className="relative z-10 text-xs sm:text-base font-black tracking-wide text-white text-center truncate drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)]">
        {title}
      </h2>
    </div>
  );
});

/**
 * Isolated uncontrolled LTR search input so Android WebView never flips typing
 * when filtering Movie Buffs, Reviews, or Invite Movies.
 */
const ClubInlineSearch = memo(function ClubInlineSearch({
  placeholder,
  onChange,
}: {
  placeholder: string;
  onChange: (val: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [hasVal, setHasVal] = useState(false);

  return (
    <div className="rabtv-club-input-shell flex-1 min-w-0 rounded-xl">
      <div className="rabtv-club-9slice-input" aria-hidden="true" />
      <div className="rabtv-club-input-scrim" aria-hidden="true" />
      <input
        ref={ref}
        type="search"
        dir="ltr"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        defaultValue=""
        onInput={(e) => {
          const clean = sanitizeInputText(
            (e.target as HTMLInputElement).value,
            60
          );
          setHasVal(Boolean(clean));
          onChange(clean);
        }}
        placeholder={placeholder}
        style={{ direction: "ltr", unicodeBidi: "plaintext", textAlign: "left" }}
        className="rabtv-club-input-field h-10 text-xs font-bold placeholder-zinc-400"
      />
      {hasVal && (
        <button
          type="button"
          onClick={() => {
            if (ref.current) {
              ref.current.value = "";
              ref.current.focus();
            }
            setHasVal(false);
            onChange("");
          }}
          aria-label="Clear filter"
          className="absolute right-6 top-1/2 -translate-y-1/2 z-20 text-xs font-black text-zinc-400 hover:text-white cursor-pointer"
        >
          ✕
        </button>
      )}
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
  const [handleLen, setHandleLen] = useState<number>(
    (identity.publicHandle || "").length
  );
  const [bioLen, setBioLen] = useState<number>((identity.bio || "").length);
  const [sessionHiddenTitles, setSessionHiddenTitles] = useState<
    { mediaId: string; title: string }[]
  >([]);
  const [blockedIds, setBlockedIds] = useState<string[]>(() =>
    getBlockedPublicIds()
  );

  // Directory, Buddy & Review Filters (zero extra network calls — instant local filtering!)
  const [buffSearch, setBuffSearch] = useState<string>("");
  const [buffVibeFilter, setBuffVibeFilter] = useState<string>("all");
  const [buffSort, setBuffSort] = useState<BuffSort>("match");
  const [buddyFilter, setBuddyFilter] = useState<BuddyFilter>("all");
  const [reviewSearch, setReviewSearch] = useState<string>("");
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("all");
  const [inviteMovieSearch, setInviteMovieSearch] = useState<string>("");

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
  const chatBottomRef = useRef<HTMLDivElement>(null);
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
    if (busy) return;
    setBusy(true);
    try {
      const cleanHandle = sanitizeInputText(
        handleRef.current?.value || identity.publicHandle,
        20
      ).trim();
      const cleanBio = sanitizeInputText(bioRef.current?.value || "", 140).trim();
      const res = await saveAndPublishMyProfile({
        publicHandle: cleanHandle,
        bio: cleanBio,
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

  const handleCopyAnonymousCard = async () => {
    const handle = identity.publicHandle || "RABBiT TV Member";
    const rank = getCinemaRank(
      (vibePreview.moviesWatched || 0) + (vibePreview.showsWatched || 0)
    );
    const shareText = `Find me on RABBiT TV Movie Club: ${handle} (${vibePreview.topGenreVibe} • ${rank.label})`;
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        await navigator.clipboard.writeText(shareText);
        showToast(true, "✓ Anonymous Movie Club handle copied!");
        return;
      }
    } catch {
      // Fall through to toast notice
    }
    showToast(true, `Handle: ${handle}`);
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
    if (busy) return;
    setBusy(true);
    try {
      const cleanNote = sanitizeInputText(
        inviteNoteRef.current?.value || "",
        160
      ).trim();
      const res = await sendWatchBuddyRequest({
        toProfile: target,
        mediaId: movie.mediaId,
        mediaType: movie.mediaType,
        title: movie.title,
        posterPath: movie.posterPath,
        note: cleanNote || undefined,
      });
      if (!isMountedRef.current) return;
      if (!res.ok) {
        showToast(false, res.error || "Could not send invite.");
        return;
      }
      setInviteTarget(null);
      setInviteMovieSearch("");
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
    if (busy) return;
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

  const handleSendChatMsg = async (
    e: React.FormEvent | null,
    threadId: string,
    quickText?: string
  ) => {
    if (e) e.preventDefault();
    if (busy) return;
    const raw = quickText ?? chatInputRef.current?.value ?? "";
    const clean = sanitizeInputText(raw, 360).trim();
    if (!clean) return;
    setBusy(true);
    try {
      const res = await sendBuddyThreadMessage(
        threadId,
        clean,
        quickText ? false : chatSpoiler
      );
      if (!isMountedRef.current) return;
      if (!res.ok) {
        showToast(false, res.error || "Message blocked.");
        return;
      }
      if (!quickText && chatInputRef.current) chatInputRef.current.value = "";
      setChatSpoiler(false);
      await refreshAll(true);
      window.setTimeout(() => {
        chatBottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 120);
    } finally {
      if (isMountedRef.current) setBusy(false);
    }
  };

  // Derived Telemetry, Filtered Buffs, Filtered Threads & Filtered Reviews (Zero Extra API Calls)
  const myRank = useMemo(
    () =>
      getCinemaRank(
        (vibePreview.moviesWatched || 0) + (vibePreview.showsWatched || 0)
      ),
    [vibePreview.moviesWatched, vibePreview.showsWatched]
  );

  const availableVibes = useMemo(() => {
    const set = new Set<string>();
    for (const p of profiles) {
      if (p.topGenreVibe) set.add(p.topGenreVibe);
    }
    return Array.from(set).slice(0, 8);
  }, [profiles]);

  const enrichedProfiles = useMemo(() => {
    const q = buffSearch.trim().toLowerCase();
    return profiles
      .map((prof) => {
        const isMe = prof.publicId === identity.publicId;
        const match = isMe
          ? { pct: 100, sharedTitles: [] as string[] }
          : computeTasteMatch(vibePreview, prof);
        return { prof, isMe, match };
      })
      .filter(({ prof }) => {
        if (buffVibeFilter !== "all" && prof.topGenreVibe !== buffVibeFilter) {
          return false;
        }
        if (!q) return true;
        const inHandle = (prof.handle || "").toLowerCase().includes(q);
        const inBio = (prof.bio || "").toLowerCase().includes(q);
        const inVibe = (prof.topGenreVibe || "").toLowerCase().includes(q);
        const inShelf = (prof.recentWatched || []).some((w) =>
          w.title.toLowerCase().includes(q)
        );
        return inHandle || inBio || inVibe || inShelf;
      })
      .sort((a, b) => {
        if (buffSort === "watched") {
          return (
            b.prof.moviesWatched +
            b.prof.showsWatched -
            (a.prof.moviesWatched + a.prof.showsWatched)
          );
        }
        if (buffSort === "recent") {
          return (b.prof.updatedAt || 0) - (a.prof.updatedAt || 0);
        }
        if (a.isMe) return -1;
        if (b.isMe) return 1;
        return b.match.pct - a.match.pct;
      });
  }, [
    profiles,
    identity.publicId,
    vibePreview,
    buffSearch,
    buffVibeFilter,
    buffSort,
  ]);

  const pendingIncomingCount = threads.filter(
    (t) => t.status === "pending" && t.toId === identity.publicId
  ).length;

  const filteredThreads = useMemo(() => {
    return threads.filter((t) => {
      if (buddyFilter === "pending") return t.status === "pending";
      if (buddyFilter === "active") return t.status === "accepted";
      return true;
    });
  }, [threads, buddyFilter]);

  const activeThread =
    threads.find((t) => t.threadId === activeThreadId) || null;

  const reviewPulse = useMemo(() => {
    if (reviews.length === 0) return { avg: 0, likedPct: 0 };
    const totalStars = reviews.reduce((acc, r) => acc + (r.rating || 0), 0);
    const likedCount = reviews.filter((r) => r.liked).length;
    return {
      avg: totalStars / reviews.length,
      likedPct: Math.round((likedCount / reviews.length) * 100),
    };
  }, [reviews]);

  const filteredReviews = useMemo(() => {
    const q = reviewSearch.trim().toLowerCase();
    return reviews.filter((r) => {
      if (reviewFilter === "liked" && !r.liked) return false;
      if (reviewFilter === "disliked" && r.liked) return false;
      if (reviewFilter === "top" && r.rating < 4) return false;
      if (reviewFilter === "movie" && r.mediaType !== "movie") return false;
      if (reviewFilter === "tv" && r.mediaType !== "tv") return false;
      if (!q) return true;
      return (
        (r.title || "").toLowerCase().includes(q) ||
        (r.authorHandle || "").toLowerCase().includes(q) ||
        (r.comment || "").toLowerCase().includes(q)
      );
    });
  }, [reviews, reviewSearch, reviewFilter]);

  const inviteCandidateMovies = useMemo(() => {
    if (!inviteTarget) return [];
    const dedup = Array.from(
      new Map(
        [
          ...(inviteTarget.recentWatched || []),
          ...(vibePreview.recentWatched || []),
        ].map((w) => [`${w.mediaType}-${w.mediaId}`, w])
      ).values()
    );
    const q = inviteMovieSearch.trim().toLowerCase();
    if (!q) return dedup;
    return dedup.filter((m) => m.title.toLowerCase().includes(q));
  }, [inviteTarget, vibePreview.recentWatched, inviteMovieSearch]);

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

        {/* Split Hero Card: 100% Unobstructed Town Artwork Above + Clean Identity & 4-Tab Bar Below */}
        <div
          className={`rabtv-club-hero-shell rounded-3xl border ${
            isLowRam ? "" : "backdrop-blur-md"
          } ${tokens.panel}`}
        >
          {/* 16:9 Unobstructed Town Gathering Artwork (Zero Text Covering Characters!) */}
          <div className="rabtv-club-town-stage">
            <img
              src={IMG_COMM_TOWN_PANEL}
              alt="RABBiT TV Movie Club Gathering"
              decoding="async"
              className="rabtv-club-town-img"
            />
            <div
              className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-[#0c0a09] to-transparent pointer-events-none"
              aria-hidden="true"
            />
          </div>

          {/* Dedicated Dark Club Header + Live Pulse + 4-Tab Navigation Strip */}
          <div className="px-4 sm:px-6 pt-3 pb-4 bg-[#0c0a09]/96 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <MascotAvatar
                  mascot={myMascot}
                  size="lg"
                  rounded="full"
                  className="h-12 w-12 sm:h-14 sm:w-14 shrink-0 border-2 border-white/20 bg-black/70 overflow-hidden [&_img]:w-full [&_img]:h-full [&_img]:object-cover shadow-xl"
                  alt="My Mascot"
                />
                <div className="min-w-0 text-left">
                  <h1 className="text-lg sm:text-2xl font-black tracking-tight text-white leading-tight">
                    RABBiT TV Movie Club
                  </h1>
                  <p className={`text-[11px] sm:text-xs leading-snug mt-0.5 ${tokens.subMuted}`}>
                    Anonymous movie-buff cards • Moderated reviews & Watch Buddies
                  </p>
                </div>
              </div>

              <div className="flex items-center flex-wrap gap-1.5 shrink-0">
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider ${tokens.badge}`}
                >
                  🛡️ {getCommunityBackendLabel()}
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold ${tokens.sub} ${tokens.muted}`}
                >
                  🏆 {myRank.label}
                </span>
              </div>
            </div>

            {/* 4-Column 9-Sliced Navigation Tab Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
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
                        ? `Buddies (${pendingIncomingCount}!)`
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
                      largeButtons ? "text-xs" : "text-[11px] sm:text-xs"
                    } font-extrabold text-white cursor-pointer focus:outline-none focus:ring-2 ${tokens.ring}`}
                  >
                    <span
                      className={
                        isSelected
                          ? "rabtv-club-9slice-tab-active"
                          : "rabtv-club-9slice-tab-idle"
                      }
                      aria-hidden="true"
                    />
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
          <div className={`rabtv-club-empty rounded-3xl border text-center ${tokens.panel}`}>
            <div
              className="rabtv-club-empty-bg"
              aria-hidden="true"
              style={{ backgroundImage: `url(${IMG_COMM_EMPTY_STATE})` }}
            />
            <div className="rabtv-club-empty-scrim" aria-hidden="true" />
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
          <div className={`rabtv-club-empty rounded-3xl border text-center ${tokens.panel}`}>
            <div
              className="rabtv-club-empty-bg"
              aria-hidden="true"
              style={{ backgroundImage: `url(${IMG_COMM_EMPTY_STATE})` }}
            />
            <div className="rabtv-club-empty-scrim" aria-hidden="true" />
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            <form
              onSubmit={handleSaveProfile}
              className={`rabtv-club-plate rounded-3xl border ${tokens.panel}`}
            >
              <div className="rabtv-club-9slice-card" aria-hidden="true" />
              <div className="rabtv-club-plate-scrim" aria-hidden="true" />

              <div className="relative z-10 space-y-4 text-left">
                <div>
                  <h2 className="text-base sm:text-lg font-black text-white leading-snug">
                    Anonymous Public Identity
                  </h2>
                  <p className={`text-[11px] leading-relaxed mt-1 ${tokens.subMuted}`}>
                    Pick a public nickname just for Movie Club. Your private
                    profile name, age, PIN, and device ID never leave your
                    device.
                  </p>
                </div>

                {/* Public Handle Input (9-sliced with 28px/32px inner side clearance) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <label
                      className={`text-[10px] font-extrabold uppercase tracking-wider ${tokens.subMuted}`}
                    >
                      Public Handle (3–20 chars)
                    </label>
                    <span className={`text-[10px] font-bold ${tokens.subMuted}`}>
                      {handleLen}/20
                    </span>
                  </div>
                  <div className="rabtv-club-input-shell rounded-xl">
                    <div className="rabtv-club-9slice-input" aria-hidden="true" />
                    <div className="rabtv-club-input-scrim" aria-hidden="true" />
                    <input
                      ref={handleRef}
                      type="text"
                      dir="ltr"
                      maxLength={20}
                      defaultValue={identity.publicHandle}
                      onInput={(e) =>
                        setHandleLen((e.target as HTMLInputElement).value.length)
                      }
                      placeholder="e.g. NeonSciFiBuff"
                      style={{
                        direction: "ltr",
                        unicodeBidi: "plaintext",
                        textAlign: "left",
                      }}
                      className="rabtv-club-input-field h-11 text-xs font-bold placeholder-zinc-400"
                    />
                  </div>
                </div>

                {/* Tagline Input + One-Tap Remote-Friendly Tagline Starters */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label
                      className={`text-[10px] font-extrabold uppercase tracking-wider ${tokens.subMuted}`}
                    >
                      Movie-Buff Tagline (Optional)
                    </label>
                    <span className={`text-[10px] font-bold ${tokens.subMuted}`}>
                      {bioLen}/140
                    </span>
                  </div>
                  <div className="rabtv-club-input-shell rounded-xl">
                    <div className="rabtv-club-9slice-input" aria-hidden="true" />
                    <div className="rabtv-club-input-scrim" aria-hidden="true" />
                    <input
                      ref={bioRef}
                      type="text"
                      dir="ltr"
                      maxLength={140}
                      defaultValue={identity.bio}
                      onInput={(e) =>
                        setBioLen((e.target as HTMLInputElement).value.length)
                      }
                      placeholder="Always down for sci-fi & thrillers"
                      style={{
                        direction: "ltr",
                        unicodeBidi: "plaintext",
                        textAlign: "left",
                      }}
                      className="rabtv-club-input-field h-11 text-xs font-bold placeholder-zinc-400"
                    />
                  </div>

                  {/* One-Tap Tagline Presets (Great for TV Remotes) */}
                  <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pt-0.5 pb-0.5">
                    {TAGLINE_STARTERS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          if (bioRef.current) {
                            bioRef.current.value = preset;
                            setBioLen(preset.length);
                          }
                        }}
                        className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold whitespace-nowrap transition cursor-pointer hover:text-white ${tokens.sub} ${tokens.muted}`}
                      >
                        + {preset}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Privacy Toggle Controls */}
                <div className="space-y-2.5 pt-1">
                  <label
                    className={`flex items-center justify-between gap-3 rounded-2xl border p-3.5 cursor-pointer ${tokens.sub}`}
                  >
                    <div className="min-w-0">
                      <span className="block text-xs font-extrabold text-white">
                        List My Card in Movie Buffs Directory
                      </span>
                      <span className={`block text-[10px] mt-0.5 ${tokens.subMuted}`}>
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
                    className={`flex items-center justify-between gap-3 rounded-2xl border p-3.5 cursor-pointer ${tokens.sub}`}
                  >
                    <div className="min-w-0">
                      <span className="block text-xs font-extrabold text-white">
                        Show My Recently Watched Shelf Publicly
                      </span>
                      <span className={`block text-[10px] mt-0.5 ${tokens.subMuted}`}>
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

                {/* Primary Save CTA (Generous Side Clearance — Zero Bevel Touching) */}
                <ClubArmoredBtn
                  type="submit"
                  variant="primary"
                  disabled={busy}
                  className="w-full py-3 text-[11px] sm:text-xs uppercase tracking-wide whitespace-nowrap"
                >
                  {busy ? "Syncing Securely..." : "Save & Sync Card"}
                </ClubArmoredBtn>

                {blockedIds.length > 0 && (
                  <div
                    className={`pt-2.5 border-t ${tokens.divider} flex items-center justify-between text-[11px]`}
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

            {/* Live Public Card Preview (9-Sliced — Top & Bottom Rails NEVER Overlap Content!) */}
            <div className={`rabtv-club-plate rounded-3xl border ${tokens.panel}`}>
              <div className="rabtv-club-9slice-card" aria-hidden="true" />
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

                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3.5 min-w-0">
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
                      <div className="flex items-center flex-wrap gap-1.5 mt-1">
                        <span
                          className={`inline-block rounded-full border px-2.5 py-0.5 text-[10.5px] font-extrabold ${tokens.badge}`}
                        >
                          ✨ {vibePreview.topGenreVibe}
                        </span>
                        <span
                          className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold ${tokens.sub} ${tokens.muted}`}
                        >
                          {myRank.label}
                        </span>
                      </div>
                    </div>
                  </div>

                  <ClubArmoredBtn
                    variant="idle"
                    compact
                    onClick={() => void handleCopyAnonymousCard()}
                    title="Copy anonymous handle to share"
                    className="py-1.5 text-[10px] shrink-0 whitespace-nowrap"
                  >
                    Copy
                  </ClubArmoredBtn>
                </div>

                {/* 9-Sliced Stat Cards */}
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="rabtv-club-stat rounded-2xl">
                    <div className="rabtv-club-9slice-stat" aria-hidden="true" />
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
                  <div className="rabtv-club-stat rounded-2xl">
                    <div className="rabtv-club-9slice-stat" aria-hidden="true" />
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

                {/* Public Watched Shelf with Safe Margins & Undo Restore */}
                {showWatchedList && vibePreview.recentWatched.length > 0 && (
                  <div className="space-y-2.5">
                    <span
                      className={`block text-[10px] font-extrabold uppercase tracking-wider ${tokens.subMuted}`}
                    >
                      Public Watched Shelf (Tap ✕ to hide)
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {vibePreview.recentWatched.map((w) => (
                        <span
                          key={`${w.mediaType}-${w.mediaId}`}
                          title={w.title}
                          className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-[11px] font-bold max-w-full ${tokens.sub}`}
                        >
                          <span className="truncate">{w.title}</span>
                          <button
                            type="button"
                            onClick={() => {
                              toggleHideTitleFromPublicProfile(w.mediaId);
                              setSessionHiddenTitles((prev) => [
                                { mediaId: w.mediaId, title: w.title },
                                ...prev.filter((x) => x.mediaId !== w.mediaId),
                              ]);
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

                    {sessionHiddenTitles.length > 0 && (
                      <div className={`pt-2 border-t ${tokens.divider} space-y-1.5`}>
                        <span className={`block text-[10px] font-bold ${tokens.subMuted}`}>
                          Hidden just now (tap to restore):
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {sessionHiddenTitles.map((h) => (
                            <button
                              key={h.mediaId}
                              type="button"
                              onClick={() => {
                                toggleHideTitleFromPublicProfile(h.mediaId);
                                setSessionHiddenTitles((prev) =>
                                  prev.filter((x) => x.mediaId !== h.mediaId)
                                );
                                setVibePreview(computeMyPublicVibePreview());
                                showToast(true, `↺ Restored "${h.title}" to shelf.`);
                              }}
                              className={`rounded-lg border px-2.5 py-1 text-[10px] font-bold cursor-pointer ${tokens.btnSecondary}`}
                            >
                              ↺ {h.title}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : activeTab === "buffs" ? (
          /* ================= TAB 2: MOVIE BUFFS DIRECTORY ================= */
          <div className="space-y-4">
            <ClubSectionBanner title="Public Movie-Buff Profiles" />

            {/* Clean Search, Sort & Vibe Filter Strip */}
            {profiles.length > 0 && (
              <div className="space-y-2.5">
                <div className="flex flex-col sm:flex-row gap-2">
                  <ClubInlineSearch
                    placeholder="Search buffs by handle, vibe, or movie..."
                    onChange={setBuffSearch}
                  />
                  <div className="grid grid-cols-3 sm:flex items-center gap-1.5 shrink-0">
                    {(
                      [
                        { id: "match", label: "Best Match" },
                        { id: "watched", label: "Most Watched" },
                        { id: "recent", label: "Active" },
                      ] as { id: BuffSort; label: string }[]
                    ).map((opt) => (
                      <ClubArmoredBtn
                        key={opt.id}
                        variant={buffSort === opt.id ? "active" : "idle"}
                        compact
                        onClick={() => setBuffSort(opt.id)}
                        className="h-10 text-[10.5px] whitespace-nowrap"
                      >
                        {opt.label}
                      </ClubArmoredBtn>
                    ))}
                  </div>
                </div>

                {availableVibes.length > 1 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
                    <ClubArmoredBtn
                      variant={buffVibeFilter === "all" ? "active" : "idle"}
                      compact
                      onClick={() => setBuffVibeFilter("all")}
                      className="shrink-0 py-1.5 text-[10.5px] whitespace-nowrap"
                    >
                      All Vibes
                    </ClubArmoredBtn>
                    {availableVibes.map((vibe) => (
                      <ClubArmoredBtn
                        key={vibe}
                        variant={buffVibeFilter === vibe ? "active" : "idle"}
                        compact
                        onClick={() => setBuffVibeFilter(vibe)}
                        className="shrink-0 py-1.5 text-[10.5px] whitespace-nowrap"
                      >
                        {vibe}
                      </ClubArmoredBtn>
                    ))}
                  </div>
                )}
              </div>
            )}

            {enrichedProfiles.length === 0 ? (
              <div className={`rabtv-club-empty rounded-3xl border text-center ${tokens.panel}`}>
                <div
                  className="rabtv-club-empty-bg"
                  aria-hidden="true"
                  style={{ backgroundImage: `url(${IMG_COMM_EMPTY_STATE})` }}
                />
                <div className="rabtv-club-empty-scrim" aria-hidden="true" />
                <p className={`relative z-10 text-xs sm:text-sm ${tokens.muted}`}>
                  {profiles.length === 0 ? (
                    <>
                      No public movie buffs yet — switch to{" "}
                      <strong className="text-white">My Public Card</strong> to be
                      the first!
                    </>
                  ) : (
                    "No movie buffs match that search or vibe filter."
                  )}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {enrichedProfiles.map(({ prof, isMe, match }) => {
                  const profRank = getCinemaRank(
                    prof.moviesWatched + prof.showsWatched
                  );
                  return (
                    <div
                      key={prof.publicId}
                      className={`rabtv-club-plate rounded-3xl border flex flex-col justify-between ${tokens.panel}`}
                    >
                      <div className="rabtv-club-9slice-card" aria-hidden="true" />
                      <div className="rabtv-club-plate-scrim" aria-hidden="true" />

                      <div className="relative z-10 flex flex-col justify-between gap-3.5 h-full text-left">
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
                              <div className="flex items-center flex-wrap gap-1 mt-0.5">
                                <span
                                  className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-extrabold ${tokens.badge}`}
                                >
                                  ✨ {prof.topGenreVibe}
                                </span>
                                {!isMe && (
                                  <span className="inline-block rounded-full border border-emerald-500/35 bg-emerald-950/75 px-2 py-0.5 text-[9.5px] font-extrabold text-emerald-300">
                                    {match.pct}% Match
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {prof.bio && (
                            <p className={`text-xs leading-relaxed ${tokens.muted}`}>
                              “{prof.bio}”
                            </p>
                          )}

                          <p className={`text-[11px] font-bold ${tokens.subMuted}`}>
                            {prof.moviesWatched} movies • {prof.showsWatched} shows •{" "}
                            <span className="text-white/90">{profRank.label}</span>
                          </p>

                          {match.sharedTitles.length > 0 && !isMe && (
                            <p className="text-[10px] font-bold text-emerald-300">
                              ✓ Shared watch:{" "}
                              {match.sharedTitles.slice(0, 2).join(", ")}
                            </p>
                          )}

                          {prof.showWatchedList && prof.recentWatched.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
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
                                  className={`rounded-lg border px-2.5 py-1 text-[10px] font-bold hover:text-white cursor-pointer truncate max-w-[160px] ${tokens.sub} ${tokens.muted}`}
                                >
                                  {w.title}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {!isMe && (
                          <div
                            className={`flex items-center gap-2 pt-3 border-t ${tokens.divider}`}
                          >
                            <ClubArmoredBtn
                              variant="primary"
                              onClick={() => {
                                setInviteMovieSearch("");
                                setInviteTarget(prof);
                              }}
                              className="flex-1 py-2 text-[11px] whitespace-nowrap"
                            >
                              Watch Together
                            </ClubArmoredBtn>
                            <ClubArmoredBtn
                              variant="danger"
                              compact
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
                              compact
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
            <ClubSectionBanner title="Watch Buddy Requests & Chats" />

            {threads.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-0.5">
                {(
                  [
                    { id: "all", label: `All (${threads.length})` },
                    {
                      id: "pending",
                      label: `Invites (${
                        threads.filter((t) => t.status === "pending").length
                      })`,
                    },
                    {
                      id: "active",
                      label: `Active Chats (${
                        threads.filter((t) => t.status === "accepted").length
                      })`,
                    },
                  ] as { id: BuddyFilter; label: string }[]
                ).map((f) => (
                  <ClubArmoredBtn
                    key={f.id}
                    variant={buddyFilter === f.id ? "active" : "idle"}
                    compact
                    onClick={() => setBuddyFilter(f.id)}
                    className="shrink-0 py-1.5 text-[11px] whitespace-nowrap"
                  >
                    {f.label}
                  </ClubArmoredBtn>
                ))}
              </div>
            )}

            {filteredThreads.length === 0 ? (
              <div className={`rabtv-club-empty rounded-3xl border text-center ${tokens.panel}`}>
                <div
                  className="rabtv-club-empty-bg"
                  aria-hidden="true"
                  style={{ backgroundImage: `url(${IMG_COMM_EMPTY_STATE})` }}
                />
                <div className="rabtv-club-empty-scrim" aria-hidden="true" />
                <div className="relative z-10 space-y-2">
                  <p className="text-sm sm:text-base font-black text-white">
                    {threads.length === 0
                      ? "No Watch Buddy threads yet!"
                      : "No threads in this filter."}
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
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                {/* Thread List */}
                <div className="space-y-3">
                  {filteredThreads.map((t) => {
                    const isIncoming = t.toId === identity.publicId;
                    const peerHandle = isIncoming ? t.fromHandle : t.toHandle;
                    const peerMascot = isIncoming ? t.fromMascot : t.toMascot;
                    const isSelected = activeThreadId === t.threadId;

                    return (
                      <div
                        key={t.threadId}
                        className={`rabtv-club-plate rounded-3xl border transition ${
                          isSelected
                            ? `${tokens.panel} ring-2 ring-white/30`
                            : tokens.panel
                        }`}
                      >
                        <div className="rabtv-club-9slice-card" aria-hidden="true" />
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
                              compact
                              onClick={() =>
                                navigate({
                                  to: "/details",
                                  search: { id: t.mediaId, type: t.mediaType },
                                })
                              }
                              className="shrink-0 py-1.5 text-[10px] whitespace-nowrap"
                            >
                              Details
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
                                compact
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
                                compact
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
                                compact
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
                              Open Chat ({t.messages.length})
                            </ClubArmoredBtn>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Active Async Movie Discussion Pane */}
                {activeThread ? (
                  <div
                    className={`rabtv-club-plate rounded-3xl border min-h-[360px] flex flex-col justify-between ${tokens.panel}`}
                  >
                    <div className="rabtv-club-9slice-card" aria-hidden="true" />
                    <div className="rabtv-club-plate-scrim" aria-hidden="true" />

                    <div className="relative z-10 flex flex-col justify-between gap-3 flex-1 text-left">
                      <div
                        className={`flex items-center justify-between gap-2 pb-2.5 border-b ${tokens.divider}`}
                      >
                        <div className="min-w-0">
                          <h3 className="text-sm font-black text-white truncate">
                            {activeThread.title}
                          </h3>
                          <p className={`text-[10px] ${tokens.subMuted}`}>
                            Chat with{" "}
                            {activeThread.fromId === identity.publicId
                              ? activeThread.toHandle
                              : activeThread.fromHandle}
                          </p>
                        </div>
                        <ClubArmoredBtn
                          variant="primary"
                          compact
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
                            Watch on your own time and tap a quick reaction or
                            write a message below!
                          </p>
                        ) : (
                          activeThread.messages.map((m) => {
                            const mine = m.senderId === identity.publicId;
                            const hidden =
                              m.isSpoiler && !revealedSpoilers.has(m.msgId);
                            return (
                              <div
                                key={m.msgId}
                                className={`rounded-2xl border p-3 text-xs space-y-1 ${
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
                        <div ref={chatBottomRef} />
                      </div>

                      {/* One-Tap Quick Reactions (TV Remote Friendly) */}
                      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pt-1">
                        {QUICK_CHAT_REACTIONS.map((rx) => (
                          <button
                            key={rx}
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              void handleSendChatMsg(
                                null,
                                activeThread.threadId,
                                rx
                              )
                            }
                            className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold whitespace-nowrap cursor-pointer hover:text-white disabled:opacity-40 ${tokens.sub} ${tokens.muted}`}
                          >
                            {rx}
                          </button>
                        ))}
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
                            <span>Blur as spoiler</span>
                          </label>
                          <span className={tokens.subMuted}>🛡️ Moderated</span>
                        </div>
                        <div className="flex gap-2">
                          <div className="rabtv-club-input-shell flex-1 rounded-xl">
                            <div
                              className="rabtv-club-9slice-input"
                              aria-hidden="true"
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
                              placeholder="Share your thoughts..."
                              style={{
                                direction: "ltr",
                                unicodeBidi: "plaintext",
                                textAlign: "left",
                              }}
                              className="rabtv-club-input-field h-10 text-xs font-bold placeholder-zinc-400"
                            />
                          </div>
                          <ClubArmoredBtn
                            type="submit"
                            variant="primary"
                            compact
                            disabled={busy}
                            className="h-10 text-xs shrink-0"
                          >
                            Send
                          </ClubArmoredBtn>
                        </div>
                      </form>
                    </div>
                  </div>
                ) : (
                  <div
                    className={`rabtv-club-empty rounded-3xl border min-h-[300px] flex items-center justify-center text-center ${tokens.panel}`}
                  >
                    <div
                      className="rabtv-club-empty-bg"
                      aria-hidden="true"
                      style={{ backgroundImage: `url(${IMG_COMM_EMPTY_STATE})` }}
                    />
                    <div className="rabtv-club-empty-scrim" aria-hidden="true" />
                    <p className={`relative z-10 text-xs sm:text-sm max-w-xs ${tokens.muted}`}>
                      Select an accepted Watch Buddy on the left to open your
                      async movie chat.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* ================= TAB 4: LATEST COMMUNITY REVIEWS ================= */
          <div className="space-y-4">
            <ClubSectionBanner title="Latest Community Reviews" />

            {/* Community Pulse + Search & Filter Bar */}
            {reviews.length > 0 && (
              <div className="space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <ClubInlineSearch
                    placeholder="Search reviews by movie, show, or member..."
                    onChange={setReviewSearch}
                  />
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`rounded-full border px-3 py-1.5 text-[11px] font-extrabold whitespace-nowrap ${tokens.badge}`}
                    >
                      ★ {reviewPulse.avg.toFixed(1)} Avg
                    </span>
                    <span className="rounded-full border border-emerald-500/35 bg-emerald-950/75 px-3 py-1.5 text-[11px] font-extrabold text-emerald-300 whitespace-nowrap">
                      👍 {reviewPulse.likedPct}% Liked
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
                  {(
                    [
                      { id: "all", label: "All" },
                      { id: "liked", label: "👍 Liked" },
                      { id: "disliked", label: "👎 Disliked" },
                      { id: "top", label: "★ 4+ Stars" },
                      { id: "movie", label: "Movies" },
                      { id: "tv", label: "TV Shows" },
                    ] as { id: ReviewFilter; label: string }[]
                  ).map((f) => (
                    <ClubArmoredBtn
                      key={f.id}
                      variant={reviewFilter === f.id ? "active" : "idle"}
                      compact
                      onClick={() => setReviewFilter(f.id)}
                      className="shrink-0 py-1.5 text-[10.5px] whitespace-nowrap"
                    >
                      {f.label}
                    </ClubArmoredBtn>
                  ))}
                </div>
              </div>
            )}

            {filteredReviews.length === 0 ? (
              <div className={`rabtv-club-empty rounded-3xl border text-center ${tokens.panel}`}>
                <div
                  className="rabtv-club-empty-bg"
                  aria-hidden="true"
                  style={{ backgroundImage: `url(${IMG_COMM_EMPTY_STATE})` }}
                />
                <div className="rabtv-club-empty-scrim" aria-hidden="true" />
                <p className={`relative z-10 text-xs sm:text-sm ${tokens.muted}`}>
                  {reviews.length === 0 ? (
                    <>
                      No reviews posted yet — open any movie or TV show and tap{" "}
                      <strong className="text-white">Rate & Reviews</strong>!
                    </>
                  ) : (
                    "No reviews match that filter."
                  )}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredReviews.map((rev) => {
                  const hidden =
                    rev.isSpoiler && !revealedSpoilers.has(rev.reviewId);
                  const isMine = rev.authorId === identity.publicId;

                  return (
                    <div
                      key={rev.reviewId}
                      className={`rabtv-club-plate rounded-3xl border text-left ${tokens.panel}`}
                    >
                      <div className="rabtv-club-9slice-card" aria-hidden="true" />
                      <div className="rabtv-club-plate-scrim" aria-hidden="true" />

                      <div className="relative z-10 space-y-3">
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
                            {rev.authorHandle} {isMine ? "(You)" : ""}
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

                        {/* Direct Watch & Social Actions */}
                        <div
                          className={`flex items-center justify-between gap-2 pt-2.5 border-t ${tokens.divider}`}
                        >
                          <ClubArmoredBtn
                            variant="primary"
                            compact
                            onClick={() =>
                              navigate({
                                to: "/player",
                                search: {
                                  id: rev.mediaId,
                                  type: rev.mediaType,
                                  season: 1,
                                  episode: 1,
                                },
                              })
                            }
                            className="py-1.5 text-[10.5px] whitespace-nowrap"
                          >
                            ▶ Watch
                          </ClubArmoredBtn>

                          <div className="flex items-center gap-1.5">
                            {!isMine && (
                              <>
                                <ClubArmoredBtn
                                  variant="idle"
                                  compact
                                  disabled={busy}
                                  onClick={() =>
                                    void handleSendInviteForMovie(
                                      {
                                        publicId: rev.authorId,
                                        handle: rev.authorHandle,
                                        mascot: rev.authorMascot,
                                        bio: "",
                                        topGenreVibe: "",
                                        moviesWatched: 0,
                                        showsWatched: 0,
                                        isPublic: true,
                                        showWatchedList: false,
                                        recentWatched: [],
                                        updatedAt: Date.now(),
                                      },
                                      {
                                        mediaId: rev.mediaId,
                                        mediaType: rev.mediaType,
                                        title: rev.title,
                                        posterPath: rev.posterPath || null,
                                      }
                                    )
                                  }
                                  className="py-1.5 text-[10.5px] whitespace-nowrap"
                                >
                                  Invite Buddy
                                </ClubArmoredBtn>
                                <ClubArmoredBtn
                                  variant="danger"
                                  compact
                                  onClick={async () => {
                                    const r = await reportCommunityItem(
                                      "review",
                                      rev.reviewId
                                    );
                                    showToast(
                                      r.ok,
                                      r.ok
                                        ? "🚩 Review reported."
                                        : r.error || "Failed."
                                    );
                                  }}
                                  title="Report review"
                                  ariaLabel="Report review"
                                  className="py-1.5 text-[10.5px]"
                                >
                                  🚩
                                </ClubArmoredBtn>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Watch Buddy Movie Picker Modal (9-Sliced — Crisp Corners & Zero Edge Clipping) */}
      {inviteTarget && (
        <div
          className="rabtv-vidsrc-protected fixed inset-0 z-50 flex items-center justify-center bg-black/82 p-4 backdrop-blur-md"
          onClick={() => setInviteTarget(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`rabtv-club-plate w-full max-w-md max-h-[86dvh] overflow-y-auto scrollbar-none rounded-3xl border text-left ${tokens.panel}`}
          >
            <div className="rabtv-club-9slice-card" aria-hidden="true" />
            <div className="rabtv-club-plate-scrim" aria-hidden="true" />

            <div className="relative z-10 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm sm:text-base font-black text-white truncate">
                  Watch Together • {inviteTarget.handle}
                </h3>
                <ClubArmoredBtn
                  variant="idle"
                  compact
                  onClick={() => setInviteTarget(null)}
                  ariaLabel="Close Watch Together modal"
                  className="h-8 w-8 rounded-full text-xs shrink-0"
                >
                  ✕
                </ClubArmoredBtn>
              </div>

              {/* Optional Invite Note + Quick Note Chips */}
              <div className="space-y-2">
                <div className="rabtv-club-input-shell rounded-xl">
                  <div className="rabtv-club-9slice-input" aria-hidden="true" />
                  <div className="rabtv-club-input-scrim" aria-hidden="true" />
                  <input
                    ref={inviteNoteRef}
                    type="text"
                    dir="ltr"
                    maxLength={160}
                    placeholder="Optional note..."
                    style={{
                      direction: "ltr",
                      unicodeBidi: "plaintext",
                      textAlign: "left",
                    }}
                    className="rabtv-club-input-field h-10 text-xs font-bold placeholder-zinc-400"
                  />
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
                  {QUICK_INVITE_NOTES.map((note) => (
                    <button
                      key={note}
                      type="button"
                      onClick={() => {
                        if (inviteNoteRef.current) {
                          inviteNoteRef.current.value = note;
                        }
                      }}
                      className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold whitespace-nowrap cursor-pointer hover:text-white ${tokens.sub} ${tokens.muted}`}
                    >
                      + {note}
                    </button>
                  ))}
                </div>
              </div>

              {/* Movie Picker with Instant Search */}
              <div className="space-y-2">
                <span
                  className={`block text-[10px] font-extrabold uppercase tracking-wider ${tokens.subMuted}`}
                >
                  Pick a Title to Discuss
                </span>

                <ClubInlineSearch
                  placeholder="Filter titles..."
                  onChange={setInviteMovieSearch}
                />

                {inviteCandidateMovies.length === 0 ? (
                  <p className={`text-xs leading-relaxed ${tokens.subMuted}`}>
                    Open any movie or show page and tap{" "}
                    <strong className="text-white">
                      Rate & Reviews → Watch Together
                    </strong>{" "}
                    to invite {inviteTarget.handle} to that title!
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-52 overflow-y-auto scrollbar-none pt-1">
                    {inviteCandidateMovies.map((movie) => (
                      <button
                        key={`${movie.mediaType}-${movie.mediaId}`}
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void handleSendInviteForMovie(inviteTarget, movie)
                        }
                        className={`w-full flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-xs font-bold cursor-pointer transition ${tokens.btnSecondary}`}
                      >
                        <span className="truncate">{movie.title}</span>
                        <span className="text-[10px] font-extrabold shrink-0">
                          Invite →
                        </span>
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