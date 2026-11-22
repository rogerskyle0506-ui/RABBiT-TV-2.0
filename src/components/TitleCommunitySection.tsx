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

interface TitleCommunityProps {
  mediaId: string;
  mediaType: "movie" | "tv";
  title: string;
  posterPath: string | null;
  appTheme: AppTheme;
  isLowRam?: boolean;
}

function getCommunityTokens(theme: AppTheme) {
  switch (theme) {
    case "red":
      return {
        panel: "bg-zinc-950/70 border-red-500/30",
        sub: "bg-black/70 border-red-500/20",
        accent: "text-red-400",
        badge: "bg-red-950/75 border-red-500/35 text-red-200",
        btnPrimary:
          "bg-gradient-to-r from-red-600 via-rose-600 to-orange-600 text-white shadow-lg shadow-red-600/25",
        btnSecondary:
          "bg-red-950/55 hover:bg-red-900/75 border-red-500/35 text-red-100 hover:text-white",
        input:
          "border-red-500/30 bg-black/80 text-white placeholder-zinc-400 focus:ring-2 focus:ring-red-500",
        muted: "text-zinc-300",
        subMuted: "text-zinc-400",
        ring: "focus:ring-red-500",
      };
    case "midnight":
      return {
        panel: "bg-slate-950/70 border-blue-500/30",
        sub: "bg-black/70 border-blue-500/20",
        accent: "text-sky-300",
        badge: "bg-blue-950/75 border-blue-500/35 text-sky-200",
        btnPrimary:
          "bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-500 text-white shadow-lg shadow-blue-600/25",
        btnSecondary:
          "bg-blue-950/55 hover:bg-blue-900/75 border-blue-500/35 text-blue-100 hover:text-white",
        input:
          "border-blue-500/30 bg-black/80 text-white placeholder-slate-400 focus:ring-2 focus:ring-sky-400",
        muted: "text-slate-300",
        subMuted: "text-slate-400",
        ring: "focus:ring-sky-400",
      };
    case "emerald":
      return {
        panel: "bg-neutral-950/70 border-emerald-500/30",
        sub: "bg-black/70 border-emerald-500/20",
        accent: "text-emerald-300",
        badge: "bg-emerald-950/75 border-emerald-500/35 text-emerald-200",
        btnPrimary:
          "bg-gradient-to-r from-emerald-600 via-teal-600 to-green-600 text-white shadow-lg shadow-emerald-600/25",
        btnSecondary:
          "bg-emerald-950/55 hover:bg-emerald-900/75 border-emerald-500/35 text-emerald-100 hover:text-white",
        input:
          "border-emerald-500/30 bg-black/80 text-white placeholder-neutral-400 focus:ring-2 focus:ring-emerald-400",
        muted: "text-neutral-300",
        subMuted: "text-neutral-400",
        ring: "focus:ring-emerald-400",
      };
    case "amber":
      return {
        panel: "bg-stone-950/70 border-amber-500/30",
        sub: "bg-black/70 border-amber-500/20",
        accent: "text-amber-300",
        badge: "bg-amber-950/75 border-amber-500/35 text-amber-200",
        btnPrimary:
          "bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 text-white shadow-lg shadow-amber-600/25",
        btnSecondary:
          "bg-amber-950/55 hover:bg-amber-900/75 border-amber-500/35 text-amber-100 hover:text-white",
        input:
          "border-amber-500/30 bg-black/80 text-white placeholder-stone-400 focus:ring-2 focus:ring-amber-400",
        muted: "text-stone-300",
        subMuted: "text-stone-400",
        ring: "focus:ring-amber-400",
      };
    case "cyan":
      return {
        panel: "bg-slate-950/70 border-cyan-500/30",
        sub: "bg-black/70 border-cyan-500/20",
        accent: "text-cyan-300",
        badge: "bg-cyan-950/75 border-cyan-500/35 text-cyan-200",
        btnPrimary:
          "bg-gradient-to-r from-cyan-600 via-teal-600 to-blue-600 text-white shadow-lg shadow-cyan-600/25",
        btnSecondary:
          "bg-cyan-950/55 hover:bg-cyan-900/75 border-cyan-500/35 text-cyan-100 hover:text-white",
        input:
          "border-cyan-500/30 bg-black/80 text-white placeholder-slate-400 focus:ring-2 focus:ring-cyan-400",
        muted: "text-slate-300",
        subMuted: "text-slate-400",
        ring: "focus:ring-cyan-400",
      };
    case "violet":
    default:
      return {
        panel: "bg-slate-950/70 border-violet-500/30",
        sub: "bg-black/70 border-violet-500/20",
        accent: "text-violet-300",
        badge: "bg-purple-950/75 border-violet-500/35 text-violet-200",
        btnPrimary:
          "bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 text-white shadow-lg shadow-violet-600/25",
        btnSecondary:
          "bg-purple-950/55 hover:bg-purple-900/75 border-violet-500/35 text-purple-100 hover:text-white",
        input:
          "border-violet-500/30 bg-black/80 text-white placeholder-slate-400 focus:ring-2 focus:ring-violet-400",
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

  const loadSummary = useCallback(
    async (force = false) => {
      if (!mediaId || !isCommunityBackendConfigured()) return;
      setLoading(true);
      try {
        const res = await fetchTitleReviews(mediaId, mediaType, force);
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
        setLoading(false);
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
      if (!res.ok) {
        setFeedback({ ok: false, text: res.error || "Could not save handle." });
        return;
      }
      setIdentity(getLocalCommunityIdentity());
      setFeedback({
        ok: true,
        text: `✓ Public handle "${res.profile?.handle}" ready! Your real name stays private.`,
      });
    } finally {
      setSubmitting(false);
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
      if (!res.ok) {
        setFeedback({ ok: false, text: res.error || "Could not post review." });
        return;
      }
      setFeedback({ ok: true, text: "✓ Your RABBiT TV rating & review is live!" });
      await loadSummary(true);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteOwn = async (reviewId: string) => {
    setSubmitting(true);
    try {
      const ok = await deleteMyTitleReview(reviewId);
      if (ok) {
        if (commentRef.current) commentRef.current.value = "";
        setFeedback({ ok: true, text: "Removed your review." });
        await loadSummary(true);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleReportReview = async (reviewId: string) => {
    const res = await reportCommunityItem("review", reviewId);
    setFeedback({
      ok: res.ok,
      text: res.ok
        ? res.hiddenNow
          ? "🚩 Reported & automatically hidden from community."
          : "🚩 Thank you — review flagged for moderation."
        : res.error || "Could not report right now.",
    });
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
      setFeedback({
        ok: res.ok,
        text: res.ok
          ? `🤝 Sent Watch Buddy invite for "${title}" to ${target.handle}!`
          : res.error || "Could not send invite.",
      });
      if (res.ok) setInspectProfile(null);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isCommunityBackendConfigured()) return null;

  return (
    <section
      className={`mt-4 w-full rounded-3xl border p-4 sm:p-6 space-y-4 ${
        isLowRam ? "" : "backdrop-blur-md"
      } ${tokens.panel}`}
    >
      {/* Header Strip (Collapsed by default so Details stays ultra-fast on 1-2GB sticks) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 space-y-0.5 text-left">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm sm:text-lg font-black text-white">
              🍿 RABBiT TV Community Ratings & Reviews
            </h3>
            {summary.totalRatings > 0 && (
              <span
                className={`rounded-full border px-2.5 py-0.5 text-[11px] font-extrabold ${tokens.badge}`}
              >
                ★ {summary.averageRating.toFixed(1)} / 5 ({summary.totalRatings})
              </span>
            )}
          </div>
          <p className={`text-[11px] ${tokens.subMuted}`}>
            Anonymous handles • Strictly moderated (zero profanity/hate speech) • Async Watch Buddies
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => navigate({ to: "/community" as any })}
            className={`rounded-xl border px-3 py-1.5 text-[11px] font-bold cursor-pointer transition ${tokens.btnSecondary}`}
          >
            🎭 Movie Club
          </button>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className={`rounded-xl px-3.5 py-1.5 text-[11px] font-extrabold cursor-pointer transition ${tokens.btnPrimary}`}
          >
            {expanded ? "Hide Reviews ▴" : "Rate & Reviews ▾"}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="space-y-4 pt-2 border-t border-white/10">
          {feedback && (
            <div
              className={`rounded-xl border px-3 py-2 text-xs font-bold text-center ${
                feedback.ok
                  ? "bg-emerald-950/80 border-emerald-400/45 text-emerald-200"
                  : "bg-red-950/80 border-red-400/45 text-red-200"
              }`}
            >
              {feedback.text}
            </div>
          )}

          {/* Kids Safe Lockout */}
          {kidsLocked ? (
            <div className={`rounded-2xl border p-4 text-center text-xs ${tokens.sub} ${tokens.muted}`}>
              🧒 Community ratings, comments, and Watch Buddy invites are locked while Kids Safe Mode is active.
            </div>
          ) : !identity.publicHandle ? (
            /* Quick Anonymous Handle Setup (Protects real name!) */
            <form
              onSubmit={handleQuickSetupHandle}
              className={`rounded-2xl border p-4 space-y-2.5 text-left ${tokens.sub}`}
            >
              <p className="text-xs font-extrabold text-white">
                🛡️ Pick an Anonymous Public Handle to Rate & Comment
              </p>
              <p className={`text-[11px] ${tokens.subMuted}`}>
                Your private profile name, age, and device info are NEVER shared publicly.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  ref={quickHandleRef}
                  type="text"
                  dir="ltr"
                  maxLength={20}
                  autoComplete="off"
                  placeholder="e.g. SciFiNightOwl"
                  style={{ direction: "ltr", unicodeBidi: "plaintext", textAlign: "left" }}
                  className={`flex-1 h-10 rounded-xl border px-3 text-xs font-bold focus:outline-none ${tokens.input}`}
                />
                <button
                  type="submit"
                  disabled={submitting}
                  className={`h-10 px-4 rounded-xl text-xs font-extrabold cursor-pointer disabled:opacity-50 ${tokens.btnPrimary}`}
                >
                  {submitting ? "Saving..." : "Create Public Alias"}
                </button>
              </div>
            </form>
          ) : (
            /* Rating & Review Composer */
            <form
              onSubmit={handleSubmitReview}
              className={`rounded-2xl border p-3.5 sm:p-4 space-y-3 text-left ${tokens.sub}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-extrabold text-white">
                  Posting anonymously as{" "}
                  <span className={tokens.accent}>{identity.publicHandle}</span>
                </span>

                {/* 1-5 Star Selector */}
                <div className="flex items-center gap-1" role="radiogroup" aria-label="Star rating">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setStarRating(star)}
                      className={`text-lg sm:text-xl leading-none transition hover:scale-110 cursor-pointer ${
                        star <= starRating ? "text-amber-400" : "text-white/25"
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
                  <button
                    type="button"
                    onClick={() => setLiked(true)}
                    className={`rounded-xl border px-3 py-1.5 text-[11px] font-extrabold cursor-pointer transition ${
                      liked
                        ? "bg-emerald-600/35 border-emerald-400 text-emerald-200"
                        : tokens.btnSecondary
                    }`}
                  >
                    👍 Liked It
                  </button>
                  <button
                    type="button"
                    onClick={() => setLiked(false)}
                    className={`rounded-xl border px-3 py-1.5 text-[11px] font-extrabold cursor-pointer transition ${
                      !liked
                        ? "bg-red-600/35 border-red-400 text-red-200"
                        : tokens.btnSecondary
                    }`}
                  >
                    👎 Disliked It
                  </button>
                </div>

                <label className="inline-flex items-center gap-1.5 text-[11px] font-bold text-white/80 cursor-pointer select-none">
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
                style={{ direction: "ltr", unicodeBidi: "plaintext", textAlign: "left" }}
                className={`w-full rounded-xl border p-3 text-xs font-medium focus:outline-none ${tokens.input}`}
              />

              <div className="flex flex-wrap items-center justify-between gap-2">
                {summary.myReview ? (
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => void handleDeleteOwn(summary.myReview!.reviewId)}
                    className="rounded-xl bg-red-950/75 hover:bg-red-700 border border-red-500/40 px-3 py-1.5 text-[11px] font-bold text-red-200 hover:text-white cursor-pointer"
                  >
                    🗑️ Delete My Review
                  </button>
                ) : (
                  <span className={`text-[10px] ${tokens.subMuted}`}>
                    🛡️ Protected by RABBiT TV Hate & Profanity Filter
                  </span>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className={`rounded-xl px-4 py-2 text-xs font-extrabold cursor-pointer disabled:opacity-50 ${tokens.btnPrimary}`}
                >
                  {submitting
                    ? "Publishing..."
                    : summary.myReview
                      ? "Update Review"
                      : "Post Rating & Comment"}
                </button>
              </div>
            </form>
          )}

          {/* Community Reviews Feed */}
          {loading ? (
            <p className={`text-center text-xs py-4 ${tokens.subMuted}`}>
              Loading community reviews…
            </p>
          ) : summary.reviews.length === 0 ? (
            <div className={`rounded-2xl border p-5 text-center text-xs ${tokens.sub} ${tokens.subMuted}`}>
              No RABBiT TV reviews for <strong>{title}</strong> yet. Be the first movie buff to rate it!
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
                    className={`rounded-2xl border p-3.5 space-y-2 text-left ${tokens.sub}`}
                  >
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
                          className="h-8 w-8 shrink-0"
                          alt={rev.authorHandle}
                        />
                        <div className="min-w-0 text-left">
                          <span className="block text-xs font-black text-white group-hover:underline truncate">
                            {rev.authorHandle} {isMine ? "(You)" : ""}
                          </span>
                          <span className={`block text-[10px] ${tokens.subMuted}`}>
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

                    {rev.comment && (
                      spoilerHidden ? (
                        <button
                          type="button"
                          onClick={() =>
                            setRevealedSpoilers((prev) => {
                              const next = new Set(prev);
                              next.add(rev.reviewId);
                              return next;
                            })
                          }
                          className={`w-full rounded-xl border border-dashed px-3 py-2 text-xs font-bold cursor-pointer ${tokens.btnSecondary}`}
                        >
                          🙈 Spoiler Blurred — Tap to Reveal
                        </button>
                      ) : (
                        <p className={`text-xs leading-relaxed ${tokens.muted}`}>
                          {rev.comment}
                        </p>
                      )
                    )}

                    {!isMine && !kidsLocked && (
                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() =>
                            void handleInviteWatchBuddy({
                              publicId: rev.authorId,
                              handle: rev.authorHandle,
                              mascot: rev.authorMascot,
                            })
                          }
                          className={`rounded-lg border px-2.5 py-1 text-[10px] font-bold cursor-pointer ${tokens.btnSecondary}`}
                        >
                          🤝 Watch Together
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleReportReview(rev.reviewId)}
                          className="rounded-lg border border-white/15 bg-black/50 hover:bg-red-950/70 px-2 py-1 text-[10px] font-bold text-white/70 hover:text-red-200 cursor-pointer"
                          title="Report offensive content"
                        >
                          🚩
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            blockCommunityUser(rev.authorId);
                            setFeedback({
                              ok: true,
                              text: `🚫 Blocked ${rev.authorHandle}.`,
                            });
                          }}
                          className="rounded-lg border border-white/15 bg-black/50 hover:bg-red-950/70 px-2 py-1 text-[10px] font-bold text-white/70 hover:text-red-200 cursor-pointer"
                          title="Block this user"
                        >
                          🚫
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Public Profile Quick-Inspect Modal */}
      {inspectProfile && (
        <div
          className="rabtv-vidsrc-protected fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
          onClick={() => setInspectProfile(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-md max-h-[85dvh] overflow-y-auto scrollbar-none rounded-3xl border p-5 space-y-4 text-left ${tokens.panel}`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <MascotAvatar
                  mascot={inspectProfile.full?.mascot || inspectProfile.mascot}
                  size="lg"
                  rounded="full"
                  className="h-14 w-14 shrink-0"
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
              <button
                type="button"
                onClick={() => setInspectProfile(null)}
                className={`h-8 w-8 rounded-full border text-xs font-bold cursor-pointer ${tokens.btnSecondary}`}
              >
                ✕
              </button>
            </div>

            {inspectProfile.loading ? (
              <p className={`text-xs ${tokens.subMuted}`}>Loading public card…</p>
            ) : inspectProfile.full ? (
              <>
                {inspectProfile.full.bio && (
                  <p className={`text-xs leading-relaxed ${tokens.muted}`}>
                    “{inspectProfile.full.bio}”
                  </p>
                )}

                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className={`rounded-xl border p-2.5 ${tokens.sub}`}>
                    <span className={`block text-[10px] uppercase font-bold ${tokens.subMuted}`}>
                      Movies Watched
                    </span>
                    <strong className={`text-lg font-black ${tokens.accent}`}>
                      {inspectProfile.full.moviesWatched}
                    </strong>
                  </div>
                  <div className={`rounded-xl border p-2.5 ${tokens.sub}`}>
                    <span className={`block text-[10px] uppercase font-bold ${tokens.subMuted}`}>
                      Shows Watched
                    </span>
                    <strong className={`text-lg font-black ${tokens.accent}`}>
                      {inspectProfile.full.showsWatched}
                    </strong>
                  </div>
                </div>

                {inspectProfile.full.showWatchedList &&
                  inspectProfile.full.recentWatched.length > 0 && (
                    <div className="space-y-1.5">
                      <span className={`text-[10px] font-extrabold uppercase tracking-wider ${tokens.subMuted}`}>
                        Recently Watched
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {inspectProfile.full.recentWatched.map((w) => (
                          <span
                            key={`${w.mediaType}-${w.mediaId}`}
                            className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold ${tokens.sub} text-white`}
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
              <button
                type="button"
                disabled={submitting}
                onClick={() =>
                  void handleInviteWatchBuddy({
                    publicId: inspectProfile.publicId,
                    handle: inspectProfile.handle,
                    mascot: inspectProfile.full?.mascot || inspectProfile.mascot,
                  })
                }
                className={`w-full rounded-xl py-2.5 text-xs font-extrabold cursor-pointer ${tokens.btnPrimary}`}
              >
                🤝 Invite {inspectProfile.handle} to Watch "{title}" Together
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
});