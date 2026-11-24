// src/components/TitleCommunitySection.tsx
import React, { useEffect, useState, useRef, useMemo, useCallback, memo } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { AppTheme } from "@/lib/settings";
import { MascotAvatar } from "@/components/MascotAvatar";
import {
  isCommunityAccessLocked,
  isCommunityBackendConfigured,
  getLocalCommunityIdentity,
  fetchTitleReviews,
  submitTitleReview,
  deleteMyTitleReview,
  reportCommunityItem,
  blockCommunityUser,
  getPublicProfileById,
  sendWatchBuddyRequest,
  saveAndPublishMyProfile,
  COMMUNITY_UPDATED_EVENT,
  type CommunityReview,
  type CommunityProfile,
  type TitleRatingSummary,
} from "@/lib/community-service";

// =============================================================================
// COMMITTED COMMUNITY IMAGE ASSETS (3 NEW + REUSED CROSS-PAGE PLATES)
// =============================================================================
const IMG_COMM_CLUB_HEADER =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-community-club-header-panel.jpg";
const IMG_COMM_MEMBER_CARD =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-community-member-card-bg.jpg";
const IMG_COMM_REVIEWS_BANNER =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-community-reviews-banner.jpg";

// Reused Cross-Page Assets for 1:1 Consistency with Index, Details, Player, Search & Watch History
const IMG_BTN_PLAY_PRIMARY =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-button-play-primary.jpg";
const IMG_BTN_FILTER_IDLE =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-search-button-filter-idle.jpg";
const IMG_BTN_FILTER_ACTIVE =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-search-button-filter-active.jpg";
const IMG_BTN_DANGER =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-search-button-clear-danger.jpg";
const IMG_INPUT_BAR =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-search-input-bar-background.jpg";
const IMG_STAT_CARD =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-stat-card-background.jpg";
const IMG_DETAILS_PANEL =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-details-panel-background.jpg";

const COMMUNITY_SECTION_STYLES = `
  /* 6-Theme Hue-Shift Tokens Synced 1:1 with Index, Details, Player, Search & Watch History */
  :root,
  html[data-theme="violet"] {
    --rabtv-comm-plate-filter: hue-rotate(-78deg) saturate(1.12) brightness(1.02);
    --rabtv-comm-play-filter: hue-rotate(-74deg) saturate(1.16) brightness(1.05);
  }
  html[data-theme="red"] {
    --rabtv-comm-plate-filter: hue-rotate(0deg) saturate(1.08) brightness(1.0);
    --rabtv-comm-play-filter: hue-rotate(0deg) saturate(1.14) brightness(1.04);
  }
  html[data-theme="midnight"] {
    --rabtv-comm-plate-filter: hue-rotate(-132deg) saturate(1.14) brightness(1.04);
    --rabtv-comm-play-filter: hue-rotate(-128deg) saturate(1.18) brightness(1.06);
  }
  html[data-theme="emerald"] {
    --rabtv-comm-plate-filter: hue-rotate(154deg) saturate(1.10) brightness(1.02);
    --rabtv-comm-play-filter: hue-rotate(150deg) saturate(1.15) brightness(1.04);
  }
  html[data-theme="amber"] {
    --rabtv-comm-plate-filter: hue-rotate(28deg) saturate(1.14) brightness(1.04);
    --rabtv-comm-play-filter: hue-rotate(24deg) saturate(1.18) brightness(1.06);
  }
  html[data-theme="cyan"] {
    --rabtv-comm-plate-filter: hue-rotate(-154deg) saturate(1.12) brightness(1.04);
    --rabtv-comm-play-filter: hue-rotate(-150deg) saturate(1.16) brightness(1.06);
  }

  /* Translucent Armored Community Shell & Sub-Panels */
  .rabtv-comm-plate {
    position: relative;
    overflow: hidden;
    background-color: rgba(12, 10, 9, 0.74);
    contain: layout paint;
  }

  .rabtv-comm-plate-bg {
    position: absolute;
    inset: 0;
    background-size: 100% 100%;
    background-position: center center;
    background-repeat: no-repeat;
    opacity: 0.72;
    filter: var(--rabtv-comm-plate-filter);
    -webkit-mask-image: radial-gradient(
      ellipse 96% 94% at 50% 50%,
      rgba(12, 10, 9, 1) 74%,
      rgba(12, 10, 9, 0.74) 93%,
      rgba(12, 10, 9, 0.34) 100%
    );
    mask-image: radial-gradient(
      ellipse 96% 94% at 50% 50%,
      rgba(12, 10, 9, 1) 74%,
      rgba(12, 10, 9, 0.74) 93%,
      rgba(12, 10, 9, 0.34) 100%
    );
    pointer-events: none;
    z-index: 0;
  }

  .rabtv-comm-plate-scrim {
    position: absolute;
    inset: 0;
    background: radial-gradient(
      ellipse 80% 78% at 38% 36%,
      rgba(12, 10, 9, 0.58) 0%,
      rgba(12, 10, 9, 0.38) 70%,
      rgba(12, 10, 9, 0.24) 100%
    );
    pointer-events: none;
    z-index: 1;
  }

  /* Panoramic Ratings & Reviews Header Banner */
  .rabtv-comm-banner {
    position: relative;
    overflow: hidden;
    background-color: rgba(12, 10, 9, 0.74);
    contain: layout paint;
  }

  .rabtv-comm-banner-bg {
    position: absolute;
    inset: 0;
    background-size: 100% 100%;
    background-position: center center;
    background-repeat: no-repeat;
    opacity: 0.78;
    filter: var(--rabtv-comm-plate-filter);
    pointer-events: none;
    z-index: 0;
  }

  .rabtv-comm-banner-scrim {
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, rgba(12, 10, 9, 0.36) 0%, rgba(12, 10, 9, 0.54) 100%);
    pointer-events: none;
    z-index: 1;
  }

  /* Armored Image Buttons (Primary / Idle / Active / Danger) */
  .rabtv-comm-btn {
    position: relative;
    overflow: hidden;
    background-color: #0c0a09;
    border: 0 !important;
    box-shadow: none !important;
    contain: layout paint;
    transition: transform 150ms ease, opacity 150ms ease;
  }

  .rabtv-comm-btn:hover:not(:disabled) {
    transform: scale(1.03);
  }

  .rabtv-comm-btn:active:not(:disabled) {
    transform: scale(0.97);
  }

  .rabtv-comm-btn-art {
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

  .rabtv-comm-btn-art--idle {
    opacity: 0.90;
    filter: var(--rabtv-comm-plate-filter) brightness(0.96);
  }

  .rabtv-comm-btn-art--active {
    opacity: 0.98;
    filter: saturate(1.08) brightness(1.05);
  }

  .rabtv-comm-btn-art--primary {
    opacity: 0.96;
    filter: var(--rabtv-comm-play-filter);
  }

  .rabtv-comm-btn-art--danger {
    opacity: 0.96;
    filter: saturate(1.12) brightness(1.02);
  }

  .rabtv-comm-btn:hover:not(:disabled) .rabtv-comm-btn-art {
    filter: brightness(1.12) saturate(1.12);
    transform: scale(1.02);
  }

  .rabtv-comm-btn-scrim {
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse 76% 68% at 50% 50%, rgba(12, 10, 9, 0.44) 0%, rgba(12, 10, 9, 0.16) 100%);
    pointer-events: none;
    z-index: 1;
  }

  .rabtv-comm-btn-label {
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

  /* Armored Input Shell (rabbit-tv-search-input-bar-background.jpg) */
  .rabtv-comm-input-shell {
    position: relative;
    overflow: hidden;
    background-color: #0c0a09;
    contain: layout paint;
  }

  .rabtv-comm-input-bg {
    position: absolute;
    inset: 0;
    background-size: 100% 100%;
    background-position: center center;
    background-repeat: no-repeat;
    opacity: 0.92;
    filter: var(--rabtv-comm-plate-filter);
    pointer-events: none;
    z-index: 0;
  }

  .rabtv-comm-input-scrim {
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, rgba(12, 10, 9, 0.38) 0%, rgba(12, 10, 9, 0.56) 100%);
    pointer-events: none;
    z-index: 1;
  }
`;

interface TitleCommunityProps {
  mediaId: string;
  mediaType: "movie" | "tv";
  title: string;
  posterPath: string | null;
  appTheme: AppTheme;
  isLowRam?: boolean;
}

type CommBtnVariant = "idle" | "active" | "primary" | "danger";

const CommArmoredBtn = memo(function CommArmoredBtn({
  variant = "idle",
  className = "",
  children,
  onClick,
  type = "button",
  disabled = false,
  title,
  ariaLabel,
}: {
  variant?: CommBtnVariant;
  className?: string;
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  type?: "button" | "submit";
  disabled?: boolean;
  title?: string;
  ariaLabel?: string;
}) {
  const bgUrl =
    variant === "primary"
      ? IMG_BTN_PLAY_PRIMARY
      : variant === "active"
        ? IMG_BTN_FILTER_ACTIVE
        : variant === "danger"
          ? IMG_BTN_DANGER
          : IMG_BTN_FILTER_IDLE;

  const artMod =
    variant === "primary"
      ? "rabtv-comm-btn-art--primary"
      : variant === "active"
        ? "rabtv-comm-btn-art--active"
        : variant === "danger"
          ? "rabtv-comm-btn-art--danger"
          : "rabtv-comm-btn-art--idle";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      className={`rabtv-comm-btn rounded-xl text-white font-extrabold cursor-pointer disabled:opacity-45 disabled:pointer-events-none focus:outline-none focus:ring-2 focus:ring-cyan-400 ${className}`}
    >
      <span
        className={`rabtv-comm-btn-art ${artMod}`}
        aria-hidden="true"
        style={{ backgroundImage: `url(${bgUrl})` }}
      />
      <span className="rabtv-comm-btn-scrim" aria-hidden="true" />
      <span className="rabtv-comm-btn-label">{children}</span>
    </button>
  );
});

function getCommunityTokens(theme: AppTheme) {
  switch (theme) {
    case "red":
      return {
        panel: "border-red-500/30",
        sub: "border-red-500/20",
        divider: "border-red-500/20",
        accent: "text-red-400",
        badge: "bg-red-950/75 border-red-500/35 text-red-200",
        input:
          "border-red-500/30 bg-black/75 text-white placeholder-zinc-400 focus:ring-2 focus:ring-red-500",
        muted: "text-zinc-300",
        subMuted: "text-zinc-400",
        ring: "focus:ring-red-500",
      };
    case "midnight":
      return {
        panel: "border-blue-500/30",
        sub: "border-blue-500/20",
        divider: "border-blue-500/20",
        accent: "text-sky-300",
        badge: "bg-blue-950/75 border-blue-500/35 text-sky-200",
        input:
          "border-blue-500/30 bg-black/75 text-white placeholder-slate-400 focus:ring-2 focus:ring-sky-400",
        muted: "text-slate-300",
        subMuted: "text-slate-400",
        ring: "focus:ring-sky-400",
      };
    case "emerald":
      return {
        panel: "border-emerald-500/30",
        sub: "border-emerald-500/20",
        divider: "border-emerald-500/20",
        accent: "text-emerald-300",
        badge: "bg-emerald-950/75 border-emerald-500/35 text-emerald-200",
        input:
          "border-emerald-500/30 bg-black/75 text-white placeholder-neutral-400 focus:ring-2 focus:ring-emerald-400",
        muted: "text-neutral-300",
        subMuted: "text-neutral-400",
        ring: "focus:ring-emerald-400",
      };
    case "amber":
      return {
        panel: "border-amber-500/30",
        sub: "border-amber-500/20",
        divider: "border-amber-500/20",
        accent: "text-amber-300",
        badge: "bg-amber-950/75 border-amber-500/35 text-amber-200",
        input:
          "border-amber-500/30 bg-black/75 text-white placeholder-stone-400 focus:ring-2 focus:ring-amber-400",
        muted: "text-stone-300",
        subMuted: "text-stone-400",
        ring: "focus:ring-amber-400",
      };
    case "cyan":
      return {
        panel: "border-cyan-500/30",
        sub: "border-cyan-500/20",
        divider: "border-cyan-500/20",
        accent: "text-cyan-300",
        badge: "bg-cyan-950/75 border-cyan-500/35 text-cyan-200",
        input:
          "border-cyan-500/30 bg-black/75 text-white placeholder-slate-400 focus:ring-2 focus:ring-cyan-400",
        muted: "text-slate-300",
        subMuted: "text-slate-400",
        ring: "focus:ring-cyan-400",
      };
    case "violet":
    default:
      return {
        panel: "border-violet-500/30",
        sub: "border-violet-500/20",
        divider: "border-violet-500/20",
        accent: "text-violet-300",
        badge: "bg-purple-950/75 border-violet-500/35 text-violet-200",
        input:
          "border-violet-500/30 bg-black/75 text-white placeholder-slate-400 focus:ring-2 focus:ring-violet-400",
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

export const TitleCommunitySection = memo(function TitleCommunitySection({
  mediaId,
  mediaType,
  title,
  posterPath,
  appTheme,
  isLowRam = false,
}: TitleCommunityProps) {
  const navigate = useNavigate();
  const tokens = useMemo(() => getCommunityTokens(appTheme), [appTheme]);

  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<TitleRatingSummary>({
    averageRating: 0,
    totalRatings: 0,
    likedCount: 0,
    dislikedCount: 0,
    reviews: [],
    myReview: null,
  });

  const [identity, setIdentity] = useState(() => getLocalCommunityIdentity());
  const [kidsLocked, setKidsLocked] = useState(() => isCommunityAccessLocked());

  // Composer state (uncontrolled refs keep Android WebView typing strictly LTR)
  const [starRating, setStarRating] = useState<number>(5);
  const [liked, setLiked] = useState<boolean>(true);
  const [isSpoiler, setIsSpoiler] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(
    null
  );
  const [revealedSpoilers, setRevealedSpoilers] = useState<Set<string>>(
    () => new Set()
  );

  // Quick Profile Preview modal when tapping a reviewer's mascot/handle
  const [inspectProfile, setInspectProfile] = useState<{
    publicId: string;
    handle: string;
    mascot: string;
    full: CommunityProfile | null;
    loading: boolean;
  } | null>(null);

  const commentRef = useRef<HTMLTextAreaElement>(null);
  const quickHandleRef = useRef<HTMLInputElement>(null);
  const isMountedRef = useRef<boolean>(true);
  const feedbackTimerRef = useRef<number | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (feedbackTimerRef.current) {
        window.clearTimeout(feedbackTimerRef.current);
      }
    };
  }, []);

  const showFeedback = useCallback((ok: boolean, text: string) => {
    setFeedback({ ok, text });
    if (feedbackTimerRef.current) {
      window.clearTimeout(feedbackTimerRef.current);
    }
    feedbackTimerRef.current = window.setTimeout(() => {
      if (isMountedRef.current) setFeedback(null);
      feedbackTimerRef.current = null;
    }, 4000);
  }, []);

  // Escape closes Quick-Inspect modal cleanly on TV remotes / keyboards
  useEffect(() => {
    if (!inspectProfile) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setInspectProfile(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inspectProfile]);

  const loadSummary = useCallback(
    async (force = false) => {
      if (!mediaId || !isCommunityBackendConfigured()) return;
      setLoading(true);
      try {
        const res = await fetchTitleReviews(mediaId, mediaType, force);
        if (!isMountedRef.current) return;
        setSummary(res);
        if (res.myReview) {
          setStarRating(res.myReview.rating);
          setLiked(res.myReview.liked);
          setIsSpoiler(res.myReview.isSpoiler);
          if (commentRef.current && !commentRef.current.value) {
            commentRef.current.value = res.myReview.comment;
          }
        }
      } finally {
        if (isMountedRef.current) setLoading(false);
      }
    },
    [mediaId, mediaType]
  );

  useEffect(() => {
    setKidsLocked(isCommunityAccessLocked());
    setIdentity(getLocalCommunityIdentity());
    if (expanded) {
      void loadSummary(false);
    }
  }, [mediaId, mediaType, expanded, loadSummary]);

  useEffect(() => {
    const onUpdate = () => {
      setIdentity(getLocalCommunityIdentity());
      setKidsLocked(isCommunityAccessLocked());
      if (expanded) void loadSummary(false);
    };
    window.addEventListener(COMMUNITY_UPDATED_EVENT, onUpdate);
    window.addEventListener("rabtv_settings_updated", onUpdate);
    return () => {
      window.removeEventListener(COMMUNITY_UPDATED_EVENT, onUpdate);
      window.removeEventListener("rabtv_settings_updated", onUpdate);
    };
  }, [expanded, loadSummary]);

  const handleQuickSetupHandle = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawHandle = quickHandleRef.current?.value || "";
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await saveAndPublishMyProfile({
        publicHandle: rawHandle,
        bio: identity.bio,
        isPublic: true,
        showWatchedList: true,
      });
      if (!isMountedRef.current) return;
      if (!res.ok) {
        showFeedback(false, res.error || "Could not save handle.");
        return;
      }
      setIdentity(getLocalCommunityIdentity());
      showFeedback(
        true,
        `✓ Public handle "${res.profile?.handle}" ready! Your real name stays private.`
      );
    } finally {
      if (isMountedRef.current) setSubmitting(false);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);
    try {
      const rawComment = commentRef.current?.value || "";
      const res = await submitTitleReview({
        mediaId,
        mediaType,
        title,
        posterPath,
        rating: starRating,
        liked,
        comment: rawComment,
        isSpoiler,
      });
      if (!isMountedRef.current) return;
      if (!res.ok) {
        showFeedback(false, res.error || "Could not post review.");
        return;
      }
      showFeedback(true, "✓ Your RABBiT TV rating & review is live!");
      await loadSummary(true);
    } finally {
      if (isMountedRef.current) setSubmitting(false);
    }
  };

  const handleDeleteOwn = async (reviewId: string) => {
    setSubmitting(true);
    try {
      const ok = await deleteMyTitleReview(reviewId);
      if (!isMountedRef.current) return;
      if (ok) {
        if (commentRef.current) commentRef.current.value = "";
        showFeedback(true, "Removed your review.");
        await loadSummary(true);
      }
    } finally {
      if (isMountedRef.current) setSubmitting(false);
    }
  };

  const handleReportReview = async (reviewId: string) => {
    const res = await reportCommunityItem("review", reviewId);
    if (!isMountedRef.current) return;
    showFeedback(
      res.ok,
      res.ok
        ? res.hiddenNow
          ? "🚩 Reported & automatically hidden from community."
          : "🚩 Thank you — review flagged for moderation."
        : res.error || "Could not report right now."
    );
    if (res.ok) void loadSummary(true);
  };

  const handleOpenReviewerProfile = async (rev: CommunityReview) => {
    setInspectProfile({
      publicId: rev.authorId,
      handle: rev.authorHandle,
      mascot: rev.authorMascot,
      full: null,
      loading: true,
    });
    const full = await getPublicProfileById(rev.authorId);
    if (!isMountedRef.current) return;
    setInspectProfile((prev) =>
      prev && prev.publicId === rev.authorId
        ? { ...prev, full, loading: false }
        : prev
    );
  };

  const handleInviteWatchBuddy = async (target: {
    publicId: string;
    handle: string;
    mascot: string;
  }) => {
    setSubmitting(true);
    try {
      const res = await sendWatchBuddyRequest({
        toProfile: target,
        mediaId,
        mediaType,
        title,
        posterPath,
      });
      if (!isMountedRef.current) return;
      showFeedback(
        res.ok,
        res.ok
          ? `🤝 Sent Watch Buddy invite for "${title}" to ${target.handle}!`
          : res.error || "Could not send invite."
      );
      if (res.ok) setInspectProfile(null);
    } finally {
      if (isMountedRef.current) setSubmitting(false);
    }
  };

  if (!isCommunityBackendConfigured()) return null;

  return (
    <section
      className={`rabtv-comm-plate mt-4 w-full rounded-3xl border p-4 sm:p-6 ${
        isLowRam ? "" : "backdrop-blur-md"
      } ${tokens.panel}`}
    >
      <style>{COMMUNITY_SECTION_STYLES}</style>

      {/* Main Community Backdrop (Movie Club Punk Rabbits in Bottom-Right) */}
      <div
        className="rabtv-comm-plate-bg"
        aria-hidden="true"
        style={{
          backgroundImage: `url(${
            expanded ? IMG_COMM_CLUB_HEADER : IMG_COMM_REVIEWS_BANNER
          })`,
        }}
      />
      <div className="rabtv-comm-plate-scrim" aria-hidden="true" />

      <div className="relative z-10 space-y-4">
        {/* Panoramic Header Strip (rabbit-tv-community-reviews-banner.jpg) */}
        <div
          className={`rabtv-comm-banner rounded-2xl border p-3 sm:p-4 ${tokens.sub}`}
        >
          <div
            className="rabtv-comm-banner-bg"
            aria-hidden="true"
            style={{ backgroundImage: `url(${IMG_COMM_REVIEWS_BANNER})` }}
          />
          <div className="rabtv-comm-banner-scrim" aria-hidden="true" />

          <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 space-y-0.5 text-left">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-lg font-black text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)]">
                  🍿 RABBiT TV Community Ratings & Reviews
                </h3>
                {summary.totalRatings > 0 && (
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-[11px] font-extrabold ${tokens.badge}`}
                  >
                    ★ {summary.averageRating.toFixed(1)} / 5 (
                    {summary.totalRatings})
                  </span>
                )}
              </div>
              <p className={`text-[11px] ${tokens.subMuted}`}>
                Anonymous handles • Strictly moderated (zero profanity/hate
                speech) • Async Watch Buddies
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <CommArmoredBtn
                variant="idle"
                onClick={() => navigate({ to: "/community" as any })}
                className="px-3.5 py-2 text-[11px]"
              >
                🎭 Movie Club
              </CommArmoredBtn>
              <CommArmoredBtn
                variant="primary"
                onClick={() => setExpanded((v) => !v)}
                className="px-4 py-2 text-[11px]"
              >
                {expanded ? "Hide Reviews ▴" : "Rate & Reviews ▾"}
              </CommArmoredBtn>
            </div>
          </div>
        </div>

        {expanded && (
          <div className={`space-y-4 pt-2 border-t ${tokens.divider}`}>
            {feedback && (
              <div
                className={`rounded-xl border px-3 py-2 text-xs font-bold text-center ${
                  feedback.ok
                    ? "bg-emerald-950/85 border-emerald-400/45 text-emerald-200"
                    : "bg-red-950/85 border-red-400/45 text-red-200"
                }`}
              >
                {feedback.text}
              </div>
            )}

            {/* Kids Safe Lockout */}
            {kidsLocked ? (
              <div
                className={`rabtv-comm-plate rounded-2xl border p-4 text-center text-xs ${tokens.sub} ${tokens.muted}`}
              >
                <div
                  className="rabtv-comm-plate-bg"
                  aria-hidden="true"
                  style={{ backgroundImage: `url(${IMG_DETAILS_PANEL})` }}
                />
                <div className="rabtv-comm-plate-scrim" aria-hidden="true" />
                <span className="relative z-10">
                  🧒 Community ratings, comments, and Watch Buddy invites are
                  locked while Kids Safe Mode is active.
                </span>
              </div>
            ) : !identity.publicHandle ? (
              /* Quick Anonymous Handle Setup (Protects real name!) */
              <form
                onSubmit={handleQuickSetupHandle}
                className={`rabtv-comm-plate rounded-2xl border p-4 text-left ${tokens.sub}`}
              >
                <div
                  className="rabtv-comm-plate-bg"
                  aria-hidden="true"
                  style={{ backgroundImage: `url(${IMG_DETAILS_PANEL})` }}
                />
                <div className="rabtv-comm-plate-scrim" aria-hidden="true" />
                <div className="relative z-10 space-y-2.5">
                  <p className="text-xs font-extrabold text-white">
                    🛡️ Pick an Anonymous Public Handle to Rate & Comment
                  </p>
                  <p className={`text-[11px] ${tokens.subMuted}`}>
                    Your private profile name, age, and device info are NEVER
                    shared publicly.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="rabtv-comm-input-shell flex-1 rounded-xl">
                      <div
                        className="rabtv-comm-input-bg"
                        aria-hidden="true"
                        style={{ backgroundImage: `url(${IMG_INPUT_BAR})` }}
                      />
                      <div
                        className="rabtv-comm-input-scrim"
                        aria-hidden="true"
                      />
                      <input
                        ref={quickHandleRef}
                        type="text"
                        dir="ltr"
                        maxLength={20}
                        autoComplete="off"
                        placeholder="e.g. SciFiNightOwl"
                        style={{
                          direction: "ltr",
                          unicodeBidi: "plaintext",
                          textAlign: "left",
                        }}
                        className="relative z-10 w-full h-10 bg-transparent px-3.5 text-xs font-bold text-white placeholder-zinc-400 focus:outline-none"
                      />
                    </div>
                    <CommArmoredBtn
                      type="submit"
                      variant="primary"
                      disabled={submitting}
                      className="h-10 px-5 text-xs shrink-0"
                    >
                      {submitting ? "Saving..." : "Create Public Alias"}
                    </CommArmoredBtn>
                  </div>
                </div>
              </form>
            ) : (
              /* Rating & Review Composer */
              <form
                onSubmit={handleSubmitReview}
                className={`rabtv-comm-plate rounded-2xl border p-3.5 sm:p-4 text-left ${tokens.sub}`}
              >
                <div
                  className="rabtv-comm-plate-bg"
                  aria-hidden="true"
                  style={{ backgroundImage: `url(${IMG_DETAILS_PANEL})` }}
                />
                <div className="rabtv-comm-plate-scrim" aria-hidden="true" />
                <div className="relative z-10 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-extrabold text-white">
                      Posting anonymously as{" "}
                      <span className={tokens.accent}>
                        {identity.publicHandle}
                      </span>
                    </span>

                    {/* 1-5 Star Selector */}
                    <div
                      className="flex items-center gap-1"
                      role="radiogroup"
                      aria-label="Star rating"
                    >
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setStarRating(star)}
                          className={`text-lg sm:text-xl leading-none transition hover:scale-110 cursor-pointer ${
                            star <= starRating
                              ? "text-amber-400"
                              : "text-white/25"
                          }`}
                          aria-label={`Rate ${star} stars`}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Liked / Disliked + Spoiler Toggle */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <CommArmoredBtn
                        variant={liked ? "active" : "idle"}
                        onClick={() => setLiked(true)}
                        className="px-3.5 py-1.5 text-[11px]"
                      >
                        👍 Liked It
                      </CommArmoredBtn>
                      <CommArmoredBtn
                        variant={!liked ? "danger" : "idle"}
                        onClick={() => setLiked(false)}
                        className="px-3.5 py-1.5 text-[11px]"
                      >
                        👎 Disliked It
                      </CommArmoredBtn>
                    </div>

                    <label className="inline-flex items-center gap-1.5 text-[11px] font-bold text-white/85 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isSpoiler}
                        onChange={(e) => setIsSpoiler(e.target.checked)}
                        className="h-3.5 w-3.5 rounded"
                      />
                      <span>Blur as Spoiler</span>
                    </label>
                  </div>

                  <textarea
                    ref={commentRef}
                    dir="ltr"
                    rows={3}
                    maxLength={400}
                    defaultValue={summary.myReview?.comment || ""}
                    placeholder="What did you like or dislike? (No profanity, hate speech, or links — max 400 chars)"
                    style={{
                      direction: "ltr",
                      unicodeBidi: "plaintext",
                      textAlign: "left",
                    }}
                    className={`w-full rounded-xl border p-3 text-xs font-medium focus:outline-none ${tokens.input}`}
                  />

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    {summary.myReview ? (
                      <CommArmoredBtn
                        variant="danger"
                        disabled={submitting}
                        onClick={() =>
                          void handleDeleteOwn(summary.myReview!.reviewId)
                        }
                        className="px-3.5 py-1.5 text-[11px]"
                      >
                        🗑️ Delete My Review
                      </CommArmoredBtn>
                    ) : (
                      <span className={`text-[10px] ${tokens.subMuted}`}>
                        🛡️ Protected by RABBiT TV Hate & Profanity Filter
                      </span>
                    )}

                    <CommArmoredBtn
                      type="submit"
                      variant="primary"
                      disabled={submitting}
                      className="px-4 py-2 text-xs"
                    >
                      {submitting
                        ? "Publishing..."
                        : summary.myReview
                          ? "Update Review"
                          : "Post Rating & Comment"}
                    </CommArmoredBtn>
                  </div>
                </div>
              </form>
            )}

            {/* Community Reviews Feed */}
            {loading ? (
              <p className={`text-center text-xs py-4 ${tokens.subMuted}`}>
                Loading community reviews…
              </p>
            ) : summary.reviews.length === 0 ? (
              <div
                className={`rabtv-comm-plate rounded-2xl border p-5 text-center text-xs ${tokens.sub} ${tokens.subMuted}`}
              >
                <div
                  className="rabtv-comm-plate-bg"
                  aria-hidden="true"
                  style={{ backgroundImage: `url(${IMG_DETAILS_PANEL})` }}
                />
                <div className="rabtv-comm-plate-scrim" aria-hidden="true" />
                <span className="relative z-10">
                  No RABBiT TV reviews for <strong>{title}</strong> yet. Be the
                  first movie buff to rate it!
                </span>
              </div>
            ) : (
              <div className="space-y-2.5">
                {summary.reviews.map((rev) => {
                  const isMine = rev.authorId === identity.publicId;
                  const spoilerHidden =
                    rev.isSpoiler && !revealedSpoilers.has(rev.reviewId);

                  return (
                    <div
                      key={rev.reviewId}
                      className={`rabtv-comm-plate rounded-2xl border p-3.5 text-left ${tokens.sub}`}
                    >
                      <div
                        className="rabtv-comm-plate-bg"
                        aria-hidden="true"
                        style={{
                          backgroundImage: `url(${IMG_COMM_MEMBER_CARD})`,
                        }}
                      />
                      <div
                        className="rabtv-comm-plate-scrim"
                        aria-hidden="true"
                      />

                      <div className="relative z-10 space-y-2">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => void handleOpenReviewerProfile(rev)}
                            className="flex items-center gap-2 min-w-0 cursor-pointer group focus:outline-none"
                            title={`View ${rev.authorHandle}'s public movie profile`}
                          >
                            <MascotAvatar
                              mascot={rev.authorMascot}
                              size="sm"
                              rounded="full"
                              className="h-8 w-8 shrink-0 overflow-hidden [&_img]:w-full [&_img]:h-full [&_img]:object-cover"
                              alt={rev.authorHandle}
                            />
                            <div className="min-w-0 text-left">
                              <span className="block text-xs font-black text-white group-hover:underline truncate">
                                {rev.authorHandle} {isMine ? "(You)" : ""}
                              </span>
                              <span
                                className={`block text-[10px] ${tokens.subMuted}`}
                              >
                                {formatAgo(rev.updatedAt)}
                              </span>
                            </div>
                          </button>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-xs font-black text-amber-400">
                              {"★".repeat(rev.rating)}
                              <span className="text-white/20">
                                {"★".repeat(5 - rev.rating)}
                              </span>
                            </span>
                            <span
                              className={`rounded-full border px-2 py-0.5 text-[10px] font-extrabold ${
                                rev.liked
                                  ? "bg-emerald-950/75 border-emerald-500/40 text-emerald-300"
                                  : "bg-red-950/75 border-red-500/40 text-red-300"
                              }`}
                            >
                              {rev.liked ? "👍 Liked" : "👎 Disliked"}
                            </span>
                          </div>
                        </div>

                        {rev.comment &&
                          (spoilerHidden ? (
                            <CommArmoredBtn
                              variant="idle"
                              onClick={() =>
                                setRevealedSpoilers((prev) => {
                                  const next = new Set(prev);
                                  next.add(rev.reviewId);
                                  return next;
                                })
                              }
                              className="w-full px-3 py-2 text-xs"
                            >
                              🙈 Spoiler Blurred — Tap to Reveal
                            </CommArmoredBtn>
                          ) : (
                            <p
                              className={`text-xs leading-relaxed ${tokens.muted}`}
                            >
                              {rev.comment}
                            </p>
                          ))}

                        {!isMine && !kidsLocked && (
                          <div className="flex items-center justify-end gap-2 pt-1">
                            <CommArmoredBtn
                              variant="idle"
                              onClick={() =>
                                void handleInviteWatchBuddy({
                                  publicId: rev.authorId,
                                  handle: rev.authorHandle,
                                  mascot: rev.authorMascot,
                                })
                              }
                              className="px-3 py-1 text-[10px]"
                            >
                              🤝 Watch Together
                            </CommArmoredBtn>
                            <CommArmoredBtn
                              variant="danger"
                              onClick={() =>
                                void handleReportReview(rev.reviewId)
                              }
                              title="Report offensive content"
                              className="px-2.5 py-1 text-[10px]"
                            >
                              🚩
                            </CommArmoredBtn>
                            <CommArmoredBtn
                              variant="danger"
                              onClick={() => {
                                blockCommunityUser(rev.authorId);
                                showFeedback(
                                  true,
                                  `🚫 Blocked ${rev.authorHandle}.`
                                );
                              }}
                              title="Block this user"
                              className="px-2.5 py-1 text-[10px]"
                            >
                              🚫
                            </CommArmoredBtn>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Public Profile Quick-Inspect Modal (rabbit-tv-community-member-card-bg.jpg + stat-card) */}
      {inspectProfile && (
        <div
          className="rabtv-vidsrc-protected fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
          onClick={() => setInspectProfile(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`rabtv-comm-plate w-full max-w-md max-h-[85dvh] overflow-y-auto scrollbar-none rounded-3xl border p-5 text-left ${tokens.panel}`}
          >
            <div
              className="rabtv-comm-plate-bg"
              aria-hidden="true"
              style={{ backgroundImage: `url(${IMG_COMM_MEMBER_CARD})` }}
            />
            <div className="rabtv-comm-plate-scrim" aria-hidden="true" />

            <div className="relative z-10 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <MascotAvatar
                    mascot={inspectProfile.full?.mascot || inspectProfile.mascot}
                    size="lg"
                    rounded="full"
                    className="h-14 w-14 shrink-0 overflow-hidden [&_img]:w-full [&_img]:h-full [&_img]:object-cover"
                    alt={inspectProfile.handle}
                  />
                  <div className="min-w-0">
                    <h4 className="text-base font-black text-white truncate">
                      {inspectProfile.handle}
                    </h4>
                    <span
                      className={`inline-block mt-0.5 rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold ${tokens.badge}`}
                    >
                      ✨ {inspectProfile.full?.topGenreVibe || "Movie Buff"}
                    </span>
                  </div>
                </div>
                <CommArmoredBtn
                  variant="idle"
                  onClick={() => setInspectProfile(null)}
                  ariaLabel="Close profile preview"
                  className="h-8 w-8 rounded-full text-xs shrink-0"
                >
                  ✕
                </CommArmoredBtn>
              </div>

              {inspectProfile.loading ? (
                <p className={`text-xs ${tokens.subMuted}`}>
                  Loading public card…
                </p>
              ) : inspectProfile.full ? (
                <>
                  {inspectProfile.full.bio && (
                    <p className={`text-xs leading-relaxed ${tokens.muted}`}>
                      “{inspectProfile.full.bio}”
                    </p>
                  )}

                  <div className="grid grid-cols-2 gap-2.5 text-center">
                    <div className="rabtv-comm-plate rounded-xl p-3">
                      <div
                        className="rabtv-comm-plate-bg"
                        aria-hidden="true"
                        style={{ backgroundImage: `url(${IMG_STAT_CARD})` }}
                      />
                      <div
                        className="rabtv-comm-plate-scrim"
                        aria-hidden="true"
                      />
                      <div className="relative z-10">
                        <span
                          className={`block text-[10px] uppercase font-bold ${tokens.subMuted}`}
                        >
                          Movies Watched
                        </span>
                        <strong
                          className={`text-lg font-black ${tokens.accent}`}
                        >
                          {inspectProfile.full.moviesWatched}
                        </strong>
                      </div>
                    </div>
                    <div className="rabtv-comm-plate rounded-xl p-3">
                      <div
                        className="rabtv-comm-plate-bg"
                        aria-hidden="true"
                        style={{ backgroundImage: `url(${IMG_STAT_CARD})` }}
                      />
                      <div
                        className="rabtv-comm-plate-scrim"
                        aria-hidden="true"
                      />
                      <div className="relative z-10">
                        <span
                          className={`block text-[10px] uppercase font-bold ${tokens.subMuted}`}
                        >
                          Shows Watched
                        </span>
                        <strong
                          className={`text-lg font-black ${tokens.accent}`}
                        >
                          {inspectProfile.full.showsWatched}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {inspectProfile.full.showWatchedList &&
                    inspectProfile.full.recentWatched.length > 0 && (
                      <div className="space-y-1.5">
                        <span
                          className={`text-[10px] font-extrabold uppercase tracking-wider ${tokens.subMuted}`}
                        >
                          Recently Watched
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {inspectProfile.full.recentWatched.map((w) => (
                            <span
                              key={`${w.mediaType}-${w.mediaId}`}
                              className="rounded-lg border border-white/15 bg-black/75 px-2.5 py-1 text-[11px] font-bold text-white"
                            >
                              {w.completed ? "✓ " : "🎬 "}
                              {w.title}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                </>
              ) : (
                <p className={`text-xs ${tokens.subMuted}`}>
                  This member keeps their full watched shelf private.
                </p>
              )}

              {inspectProfile.publicId !== identity.publicId && !kidsLocked && (
                <CommArmoredBtn
                  variant="primary"
                  disabled={submitting}
                  onClick={() =>
                    void handleInviteWatchBuddy({
                      publicId: inspectProfile.publicId,
                      handle: inspectProfile.handle,
                      mascot:
                        inspectProfile.full?.mascot || inspectProfile.mascot,
                    })
                  }
                  className="w-full py-2.5 text-xs"
                >
                  🤝 Invite {inspectProfile.handle} to Watch "{title}" Together
                </CommArmoredBtn>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
});