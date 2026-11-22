// src/routes/community.tsx
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import {
  AppTheme,
  getSavedTheme,
  getHardwareLimits,
  getReducedMotion,
  getGlowIntensity,
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

const BUTTON_WRAPPER_URL =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/buttonwrapper.png";

const BACK_TO_HOME_BTN_URL =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/Backtohome.png";

export const Route = createFileRoute("/community")({
  component: CommunityPage,
});

type ClubTab = "profile" | "buffs" | "buddies" | "reviews";

function getClubTheme(theme: AppTheme) {
  switch (theme) {
    case "red":
      return {
        pageBg: "bg-gradient-to-br from-zinc-950/65 via-red-950/30 to-black/75",
        panel: "bg-zinc-950/70 border-red-500/30 shadow-[0_14px_40px_rgba(239,68,68,0.16)]",
        sub: "bg-black/70 border-red-500/20",
        accent: "text-red-400",
        badge: "bg-red-950/75 border-red-500/35 text-red-200",
        btnPrimary: "bg-gradient-to-r from-red-600 via-rose-600 to-orange-600 text-white shadow-lg shadow-red-600/30",
        btnSecondary: "bg-red-950/55 hover:bg-red-900/75 border-red-500/35 text-red-100 hover:text-white",
        tabIdle: "bg-black/65 hover:bg-red-950/55 border-red-500/20 text-zinc-300 hover:text-white",
        input: "border-red-500/30 bg-black/80 text-white placeholder-zinc-400 focus:ring-2 focus:ring-red-500",
        muted: "text-zinc-300",
        subMuted: "text-zinc-400",
        ring: "focus:ring-red-500",
      };
    case "midnight":
      return {
        pageBg: "bg-gradient-to-br from-slate-950/65 via-blue-950/30 to-black/75",
        panel: "bg-slate-950/70 border-blue-500/30 shadow-[0_14px_40px_rgba(59,130,246,0.16)]",
        sub: "bg-black/70 border-blue-500/20",
        accent: "text-sky-300",
        badge: "bg-blue-950/75 border-blue-500/35 text-sky-200",
        btnPrimary: "bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-500 text-white shadow-lg shadow-blue-600/30",
        btnSecondary: "bg-blue-950/55 hover:bg-blue-900/75 border-blue-500/35 text-blue-100 hover:text-white",
        tabIdle: "bg-black/65 hover:bg-blue-950/55 border-blue-500/20 text-slate-300 hover:text-white",
        input: "border-blue-500/30 bg-black/80 text-white placeholder-slate-400 focus:ring-2 focus:ring-sky-400",
        muted: "text-slate-300",
        subMuted: "text-slate-400",
        ring: "focus:ring-sky-400",
      };
    case "emerald":
      return {
        pageBg: "bg-gradient-to-br from-neutral-950/65 via-emerald-950/30 to-black/75",
        panel: "bg-neutral-950/70 border-emerald-500/30 shadow-[0_14px_40px_rgba(16,185,129,0.16)]",
        sub: "bg-black/70 border-emerald-500/20",
        accent: "text-emerald-300",
        badge: "bg-emerald-950/75 border-emerald-500/35 text-emerald-200",
        btnPrimary: "bg-gradient-to-r from-emerald-600 via-teal-600 to-green-600 text-white shadow-lg shadow-emerald-600/30",
        btnSecondary: "bg-emerald-950/55 hover:bg-emerald-900/75 border-emerald-500/35 text-emerald-100 hover:text-white",
        tabIdle: "bg-black/65 hover:bg-emerald-950/55 border-emerald-500/20 text-neutral-300 hover:text-white",
        input: "border-emerald-500/30 bg-black/80 text-white placeholder-neutral-400 focus:ring-2 focus:ring-emerald-400",
        muted: "text-neutral-300",
        subMuted: "text-neutral-400",
        ring: "focus:ring-emerald-400",
      };
    case "amber":
      return {
        pageBg: "bg-gradient-to-br from-stone-950/65 via-yellow-950/30 to-black/75",
        panel: "bg-stone-950/70 border-amber-500/30 shadow-[0_14px_40px_rgba(245,158,11,0.16)]",
        sub: "bg-black/70 border-amber-500/20",
        accent: "text-amber-300",
        badge: "bg-amber-950/75 border-amber-500/35 text-amber-200",
        btnPrimary: "bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 text-white shadow-lg shadow-amber-600/30",
        btnSecondary: "bg-amber-950/55 hover:bg-amber-900/75 border-amber-500/35 text-amber-100 hover:text-white",
        tabIdle: "bg-black/65 hover:bg-amber-950/55 border-amber-500/20 text-stone-300 hover:text-white",
        input: "border-amber-500/30 bg-black/80 text-white placeholder-stone-400 focus:ring-2 focus:ring-amber-400",
        muted: "text-stone-300",
        subMuted: "text-stone-400",
        ring: "focus:ring-amber-400",
      };
    case "cyan":
      return {
        pageBg: "bg-gradient-to-br from-slate-950/65 via-cyan-950/30 to-black/75",
        panel: "bg-slate-950/70 border-cyan-500/30 shadow-[0_14px_40px_rgba(6,182,212,0.16)]",
        sub: "bg-black/70 border-cyan-500/20",
        accent: "text-cyan-300",
        badge: "bg-cyan-950/75 border-cyan-500/35 text-cyan-200",
        btnPrimary: "bg-gradient-to-r from-cyan-600 via-teal-600 to-blue-600 text-white shadow-lg shadow-cyan-600/30",
        btnSecondary: "bg-cyan-950/55 hover:bg-cyan-900/75 border-cyan-500/35 text-cyan-100 hover:text-white",
        tabIdle: "bg-black/65 hover:bg-cyan-950/55 border-cyan-500/20 text-slate-300 hover:text-white",
        input: "border-cyan-500/30 bg-black/80 text-white placeholder-slate-400 focus:ring-2 focus:ring-cyan-400",
        muted: "text-slate-300",
        subMuted: "text-slate-400",
        ring: "focus:ring-cyan-400",
      };
    case "violet":
    default:
      return {
        pageBg: "bg-gradient-to-br from-slate-950/65 via-purple-950/30 to-black/75",
        panel: "bg-slate-950/70 border-violet-500/30 shadow-[0_14px_40px_rgba(139,92,246,0.16)]",
        sub: "bg-black/70 border-violet-500/20",
        accent: "text-violet-300",
        badge: "bg-purple-950/75 border-violet-500/35 text-violet-200",
        btnPrimary: "bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 text-white shadow-lg shadow-violet-600/30",
        btnSecondary: "bg-purple-950/55 hover:bg-purple-900/75 border-violet-500/35 text-purple-100 hover:text-white",
        tabIdle: "bg-black/65 hover:bg-purple-950/55 border-violet-500/20 text-slate-300 hover:text-white",
        input: "border-violet-500/30 bg-black/80 text-white placeholder-slate-400 focus:ring-2 focus:ring-violet-400",
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

  // Invite modal state for picking a movie to watch together with another buff
  const [inviteTarget, setInviteTarget] = useState<CommunityProfile | null>(null);

  const handleRef = useRef<HTMLInputElement>(null);
  const bioRef = useRef<HTMLInputElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const inviteNoteRef = useRef<HTMLInputElement>(null);

  const tokens = useMemo(() => getClubTheme(appTheme), [appTheme]);

  const showToast = useCallback((ok: boolean, text: string) => {
    setToast({ ok, text });
    window.setTimeout(() => setToast(null), 3500);
  }, []);

  const refreshAll = useCallback(async (force = false) => {
    setLoading(true);
    try {
      const [pList, rList, bList] = await Promise.all([
        fetchPublicProfiles(force),
        fetchLatestCommunityReviews(24, force),
        fetchMyBuddyThreads(force),
      ]);
      setProfiles(pList);
      setReviews(rList);
      setThreads(bList);
      setBlockedIds(getBlockedPublicIds());
      setVibePreview(computeMyPublicVibePreview());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const syncSettings = () => {
      setAppTheme(getSavedTheme());
      setIsLowRam(getHardwareLimits().effectiveMode === "low");
      setKidsLocked(isCommunityAccessLocked());
      setMyMascot(getActiveMascotBadge());
      setIdentity(getLocalCommunityIdentity());
      setVibePreview(computeMyPublicVibePreview());
      setBlockedIds(getBlockedPublicIds());
    };
    syncSettings();
    void refreshAll(false);

    window.addEventListener("rabtv_settings_updated", syncSettings);
    window.addEventListener(MASCOT_UPDATED_EVENT, syncSettings);
    window.addEventListener(COMMUNITY_UPDATED_EVENT, syncSettings);
    return () => {
      window.removeEventListener("rabtv_settings_updated", syncSettings);
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
      setBusy(false);
    }
  };

  const handleSendInviteForMovie = async (
    target: CommunityProfile,
    movie: { mediaId: string; mediaType: "movie" | "tv"; title: string; posterPath: string | null }
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
      setBusy(false);
    }
  };

  const handleBuddyResponse = async (
    threadId: string,
    action: "accept" | "decline" | "block"
  ) => {
    setBusy(true);
    try {
      const res = await respondToWatchBuddyRequest(threadId, action);
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
      setBusy(false);
    }
  };

  const handleSendChatMsg = async (e: React.FormEvent, threadId: string) => {
    e.preventDefault();
    const raw = chatInputRef.current?.value || "";
    if (!raw.trim()) return;
    setBusy(true);
    try {
      const res = await sendBuddyThreadMessage(threadId, raw, chatSpoiler);
      if (!res.ok) {
        showToast(false, res.error || "Message blocked.");
        return;
      }
      if (chatInputRef.current) chatInputRef.current.value = "";
      setChatSpoiler(false);
      await refreshAll(true);
    } finally {
      setBusy(false);
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
      <AppWallpaper />

      <div className="relative z-10 max-w-6xl mx-auto space-y-5 min-w-0">
        {/* Compact Theme-Tuned Top Navigation Wrapper */}
        <div className="rabtv-page-top-bar">
          <div className="rabtv-dual-wrapper">
            <div
              className="rabtv-art-bg"
              aria-hidden="true"
              style={{ backgroundImage: `url(${BUTTON_WRAPPER_URL})` }}
            />
            <Link
              to="/"
              aria-label="Back to Home"
              className={`rabtv-wrap-art-btn rabtv-wrap-art-btn--left rabtv-wrap-art-btn--home rounded-full hover:scale-[1.04] active:scale-95 focus:outline-none focus:ring-2 ${tokens.ring}`}
            >
              <img src={BACK_TO_HOME_BTN_URL} alt="Back to Home" decoding="async" />
            </Link>

            <button
              type="button"
              onClick={() => void refreshAll(true)}
              disabled={loading}
              className={`rabtv-wrap-pill-btn border font-extrabold backdrop-blur-md cursor-pointer hover:scale-[1.03] active:scale-95 ${tokens.btnSecondary}`}
            >
              <span className="truncate">↻ {loading ? "Sync…" : "Refresh"}</span>
            </button>
          </div>
        </div>

        {/* Header Banner */}
        <div
          className={`rounded-3xl border p-4 sm:p-6 space-y-4 ${
            isLowRam ? "" : "backdrop-blur-md"
          } ${tokens.panel}`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <MascotAvatar
                mascot={myMascot}
                size="lg"
                rounded="full"
                className="h-12 w-12 shrink-0"
                alt="My Mascot"
              />
              <div className="min-w-0">
                <h1 className="text-lg sm:text-2xl font-black tracking-tight text-white">
                  🍿 RABBiT TV Movie Club
                </h1>
                <p className={`text-[11px] sm:text-xs ${tokens.subMuted}`}>
                  Anonymous movie-buff cards • Zero real names exposed • Moderated ratings & Watch Buddies
                </p>
              </div>
            </div>

            <span
              className={`rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider ${tokens.badge}`}
            >
              🛡️ {getCommunityBackendLabel()}
            </span>
          </div>

          {/* 4 Navigation Tabs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(
              [
                { id: "profile", label: "🎭 My Public Card" },
                { id: "buffs", label: `🍿 Movie Buffs (${profiles.length})` },
                {
                  id: "buddies",
                  label: `🤝 Buddies${
                    pendingIncomingCount > 0 ? ` (${pendingIncomingCount} New)` : ` (${threads.length})`
                  }`,
                },
                { id: "reviews", label: `⭐ Reviews (${reviews.length})` },
              ] as { id: ClubTab; label: string }[]
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-xl border py-2.5 px-2 text-[11px] sm:text-xs font-extrabold cursor-pointer transition ${
                  activeTab === tab.id
                    ? `${tokens.btnPrimary} border-transparent`
                    : tokens.tabIdle
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Status Toast */}
        {toast && (
          <div
            className={`rounded-2xl border px-4 py-2.5 text-center text-xs font-extrabold ${
              toast.ok
                ? "bg-emerald-950/85 border-emerald-400/50 text-emerald-200"
                : "bg-red-950/85 border-red-400/50 text-red-200"
            }`}
          >
            {toast.text}
          </div>
        )}

        {/* Kids Safe Hard Guard */}
        {kidsLocked ? (
          <div className={`rounded-3xl border p-8 text-center space-y-2 ${tokens.panel}`}>
            <p className="text-base font-black text-white">🧒 Kids Safe Mode Active</p>
            <p className={`text-xs max-w-md mx-auto ${tokens.subMuted}`}>
              Public profiles, community ratings, and Watch Buddy chats are automatically locked for accounts under 13 or with Kids Safe Mode turned on.
            </p>
          </div>
        ) : !isCommunityBackendConfigured() ? (
          <div className={`rounded-3xl border p-8 text-center space-y-2 ${tokens.panel}`}>
            <p className="text-base font-black text-white">Community Relay Not Configured</p>
            <p className={`text-xs ${tokens.subMuted}`}>
              Ensure `VITE_GIST_ID` and `VITE_GH_PAT` (or future `VITE_COMMUNITY_API_URL`) are configured in your build secrets.
            </p>
          </div>
        ) : activeTab === "profile" ? (
          /* ================= TAB 1: MY ANONYMOUS PUBLIC CARD ================= */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <form
              onSubmit={handleSaveProfile}
              className={`rounded-3xl border p-4 sm:p-6 space-y-4 ${tokens.panel}`}
            >
              <div>
                <h2 className="text-base font-black text-white">
                  🛡️ Anonymous Public Identity
                </h2>
                <p className={`text-[11px] mt-0.5 ${tokens.subMuted}`}>
                  Pick a public nickname just for Movie Club. Your private profile name, age, PIN, and device ID never leave your device.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className={`block text-[10px] font-extrabold uppercase tracking-wider ${tokens.subMuted}`}>
                  Public Handle (3–20 chars, anonymous)
                </label>
                <input
                  ref={handleRef}
                  type="text"
                  dir="ltr"
                  maxLength={20}
                  defaultValue={identity.publicHandle}
                  placeholder="e.g. NeonSciFiBuff"
                  style={{ direction: "ltr", unicodeBidi: "plaintext", textAlign: "left" }}
                  className={`w-full h-10 rounded-xl border px-3 text-xs font-bold focus:outline-none ${tokens.input}`}
                />
              </div>

              <div className="space-y-1.5">
                <label className={`block text-[10px] font-extrabold uppercase tracking-wider ${tokens.subMuted}`}>
                  Movie-Buff Tagline (Optional, max 140 chars)
                </label>
                <input
                  ref={bioRef}
                  type="text"
                  dir="ltr"
                  maxLength={140}
                  defaultValue={identity.bio}
                  placeholder="e.g. Always down for 90s sci-fi & mystery thrillers"
                  style={{ direction: "ltr", unicodeBidi: "plaintext", textAlign: "left" }}
                  className={`w-full h-10 rounded-xl border px-3 text-xs font-bold focus:outline-none ${tokens.input}`}
                />
              </div>

              <div className="space-y-2 pt-1">
                <label className={`flex items-center justify-between gap-3 rounded-2xl border p-3 cursor-pointer ${tokens.sub}`}>
                  <div>
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
                    className="h-4 w-4"
                  />
                </label>

                <label className={`flex items-center justify-between gap-3 rounded-2xl border p-3 cursor-pointer ${tokens.sub}`}>
                  <div>
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
                    className="h-4 w-4"
                  />
                </label>
              </div>

              <button
                type="submit"
                disabled={busy}
                className={`w-full h-11 rounded-xl text-xs font-extrabold uppercase tracking-wider cursor-pointer disabled:opacity-50 ${tokens.btnPrimary}`}
              >
                {busy ? "Syncing Securely..." : "💾 Save & Sync Public Card"}
              </button>

              {blockedIds.length > 0 && (
                <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px]">
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
            </form>

            {/* Live Public Card Preview */}
            <div className={`rounded-3xl border p-4 sm:p-6 space-y-4 ${tokens.panel}`}>
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-extrabold uppercase tracking-wider ${tokens.subMuted}`}>
                  Live Public Card Preview
                </span>
                <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${tokens.badge}`}>
                  {isPublic ? "🟢 Public" : "🔒 Private"}
                </span>
              </div>

              <div className="flex items-center gap-3.5">
                <MascotAvatar
                  mascot={myMascot}
                  size="lg"
                  rounded="full"
                  className="h-16 w-16 shrink-0"
                  alt="My Mascot"
                />
                <div className="min-w-0">
                  <h3 className="text-lg font-black text-white truncate">
                    {identity.publicHandle || "Choose Your Handle"}
                  </h3>
                  <span className={`inline-block mt-1 rounded-full border px-2.5 py-0.5 text-[11px] font-extrabold ${tokens.badge}`}>
                    ✨ {vibePreview.topGenreVibe}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 text-center">
                <div className={`rounded-2xl border p-3 ${tokens.sub}`}>
                  <span className={`block text-[10px] uppercase font-bold ${tokens.subMuted}`}>
                    Movies Watched
                  </span>
                  <strong className={`text-xl font-black ${tokens.accent}`}>
                    {vibePreview.moviesWatched}
                  </strong>
                </div>
                <div className={`rounded-2xl border p-3 ${tokens.sub}`}>
                  <span className={`block text-[10px] uppercase font-bold ${tokens.subMuted}`}>
                    Shows Watched
                  </span>
                  <strong className={`text-xl font-black ${tokens.accent}`}>
                    {vibePreview.showsWatched}
                  </strong>
                </div>
              </div>

              {showWatchedList && vibePreview.recentWatched.length > 0 && (
                <div className="space-y-2">
                  <span className={`block text-[10px] font-extrabold uppercase tracking-wider ${tokens.subMuted}`}>
                    Public Watched Shelf (Tap ✕ to hide a title)
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {vibePreview.recentWatched.map((w) => (
                      <span
                        key={`${w.mediaType}-${w.mediaId}`}
                        className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-[11px] font-bold ${tokens.sub}`}
                      >
                        <span>{w.title}</span>
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
                          className="text-red-400 hover:text-red-200 font-black cursor-pointer"
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
        ) : activeTab === "buffs" ? (
          /* ================= TAB 2: MOVIE BUFFS DIRECTORY ================= */
          <div className="space-y-3">
            <div className="rabtv-section-banner">
              <div
                className="rabtv-art-bg"
                aria-hidden="true"
                style={{ backgroundImage: `url(${BUTTON_WRAPPER_URL})` }}
              />
              <h2 className="rabtv-section-banner-title font-black text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)]">
                🍿 Public Movie-Buff Profiles
              </h2>
            </div>

            {profiles.length === 0 ? (
              <div className={`rounded-3xl border p-8 text-center text-xs ${tokens.panel} ${tokens.subMuted}`}>
                No public movie buffs yet — switch to <strong>My Public Card</strong> to be the first!
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {profiles.map((prof) => {
                  const isMe = prof.publicId === identity.publicId;
                  return (
                    <div
                      key={prof.publicId}
                      className={`rounded-3xl border p-4 flex flex-col justify-between gap-3 ${tokens.panel}`}
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-center gap-3">
                          <MascotAvatar
                            mascot={prof.mascot}
                            size="lg"
                            rounded="full"
                            className="h-12 w-12 shrink-0"
                            alt={prof.handle}
                          />
                          <div className="min-w-0 flex-1">
                            <h3 className="text-sm font-black text-white truncate">
                              {prof.handle} {isMe ? "(You)" : ""}
                            </h3>
                            <span className={`inline-block mt-0.5 rounded-full border px-2 py-0.5 text-[10px] font-extrabold ${tokens.badge}`}>
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
                        <div className="flex items-center gap-2 pt-2 border-t border-white/10">
                          <button
                            type="button"
                            onClick={() => setInviteTarget(prof)}
                            className={`flex-1 rounded-xl py-2 text-[11px] font-extrabold cursor-pointer ${tokens.btnPrimary}`}
                          >
                            🤝 Watch Together
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              const r = await reportCommunityItem("profile", prof.publicId);
                              showToast(r.ok, r.ok ? "🚩 Profile reported." : r.error || "Failed.");
                            }}
                            className="rounded-xl border border-white/15 bg-black/50 px-2.5 py-2 text-[11px] cursor-pointer"
                            title="Report profile"
                          >
                            🚩
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              blockCommunityUser(prof.publicId);
                              showToast(true, `🚫 Blocked ${prof.handle}.`);
                            }}
                            className="rounded-xl border border-white/15 bg-black/50 px-2.5 py-2 text-[11px] cursor-pointer"
                            title="Block user"
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
        ) : activeTab === "buddies" ? (
          /* ================= TAB 3: ASYNC WATCH BUDDIES ================= */
          <div className="space-y-4">
            <div className="rabtv-section-banner">
              <div
                className="rabtv-art-bg"
                aria-hidden="true"
                style={{ backgroundImage: `url(${BUTTON_WRAPPER_URL})` }}
              />
              <h2 className="rabtv-section-banner-title font-black text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)]">
                🤝 Watch Buddy Requests & Movie Chats
              </h2>
            </div>

            {threads.length === 0 ? (
              <div className={`rounded-3xl border p-8 text-center space-y-2 ${tokens.panel}`}>
                <p className="text-sm font-black text-white">No Watch Buddy threads yet!</p>
                <p className={`text-xs max-w-md mx-auto ${tokens.subMuted}`}>
                  Invite someone from <strong>Movie Buffs</strong> or any movie's <strong>Community Reviews</strong>. You each watch the movie on your own time and trade spoiler-safe thoughts here!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Thread List */}
                <div className="space-y-2.5">
                  {threads.map((t) => {
                    const isIncoming = t.toId === identity.publicId;
                    const peerHandle = isIncoming ? t.fromHandle : t.toHandle;
                    const peerMascot = isIncoming ? t.fromMascot : t.toMascot;
                    const isSelected = activeThreadId === t.threadId;

                    return (
                      <div
                        key={t.threadId}
                        className={`rounded-2xl border p-3.5 space-y-2.5 transition ${
                          isSelected ? `${tokens.panel} ring-2 ring-white/30` : tokens.panel
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <MascotAvatar
                              mascot={peerMascot}
                              size="sm"
                              rounded="full"
                              className="h-9 w-9 shrink-0"
                              alt={peerHandle}
                            />
                            <div className="min-w-0">
                              <p className="text-xs font-black text-white truncate">
                                {t.title}
                              </p>
                              <p className={`text-[10px] truncate ${tokens.subMuted}`}>
                                with <strong className={tokens.accent}>{peerHandle}</strong> •{" "}
                                {t.status === "pending"
                                  ? isIncoming
                                    ? "Incoming Invite"
                                    : "Waiting for Reply"
                                  : `${t.messages.length} msgs`}
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              navigate({
                                to: "/details",
                                search: { id: t.mediaId, type: t.mediaType },
                              })
                            }
                            className={`shrink-0 rounded-xl border px-2.5 py-1.5 text-[10px] font-extrabold cursor-pointer ${tokens.btnSecondary}`}
                          >
                            ▶ Open Movie
                          </button>
                        </div>

                        {t.note && t.status === "pending" && (
                          <p className={`text-xs italic ${tokens.muted}`}>“{t.note}”</p>
                        )}

                        {t.status === "pending" && isIncoming ? (
                          <div className="grid grid-cols-3 gap-2">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void handleBuddyResponse(t.threadId, "accept")}
                              className="rounded-xl bg-emerald-600 hover:bg-emerald-500 py-1.5 text-[11px] font-extrabold text-white cursor-pointer"
                            >
                              ✓ Accept
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void handleBuddyResponse(t.threadId, "decline")}
                              className={`rounded-xl border py-1.5 text-[11px] font-bold cursor-pointer ${tokens.btnSecondary}`}
                            >
                              ✕ Decline
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void handleBuddyResponse(t.threadId, "block")}
                              className="rounded-xl bg-red-950/80 hover:bg-red-700 border border-red-500/40 py-1.5 text-[11px] font-bold text-red-200 cursor-pointer"
                            >
                              🚫 Block
                            </button>
                          </div>
                        ) : t.status === "accepted" ? (
                          <button
                            type="button"
                            onClick={() => setActiveThreadId(t.threadId)}
                            className={`w-full rounded-xl py-2 text-xs font-extrabold cursor-pointer ${tokens.btnPrimary}`}
                          >
                            💬 Open Movie Discussion ({t.messages.length})
                          </button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>

                {/* Active Async Movie Discussion Pane */}
                <div className={`rounded-3xl border p-4 flex flex-col justify-between gap-3 min-h-[320px] ${tokens.panel}`}>
                  {activeThread ? (
                    <>
                      <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/10">
                        <div className="min-w-0">
                          <h3 className="text-sm font-black text-white truncate">
                            💬 {activeThread.title}
                          </h3>
                          <p className={`text-[10px] ${tokens.subMuted}`}>
                            Async movie chat with{" "}
                            {activeThread.fromId === identity.publicId
                              ? activeThread.toHandle
                              : activeThread.fromHandle}
                          </p>
                        </div>
                        <button
                          type="button"
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
                          className={`shrink-0 rounded-xl px-3 py-1.5 text-[11px] font-extrabold cursor-pointer ${tokens.btnPrimary}`}
                        >
                          ▶ Watch Now
                        </button>
                      </div>

                      <div className="flex-1 space-y-2 max-h-72 overflow-y-auto scrollbar-none pr-1">
                        {activeThread.messages.length === 0 ? (
                          <p className={`text-xs text-center py-8 ${tokens.subMuted}`}>
                            Watch the movie on your own time and drop your first reaction below!
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
                                  <p className="text-white leading-relaxed">{m.text}</p>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>

                      <form
                        onSubmit={(e) => void handleSendChatMsg(e, activeThread.threadId)}
                        className="space-y-2 pt-2 border-t border-white/10"
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
                          <input
                            ref={chatInputRef}
                            type="text"
                            dir="ltr"
                            maxLength={360}
                            placeholder="Share your thoughts on this movie..."
                            style={{ direction: "ltr", unicodeBidi: "plaintext", textAlign: "left" }}
                            className={`flex-1 h-10 rounded-xl border px-3 text-xs font-bold focus:outline-none ${tokens.input}`}
                          />
                          <button
                            type="submit"
                            disabled={busy}
                            className={`h-10 px-4 rounded-xl text-xs font-extrabold cursor-pointer disabled:opacity-50 ${tokens.btnPrimary}`}
                          >
                            Send
                          </button>
                        </div>
                      </form>
                    </>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-center p-6">
                      <p className={`text-xs ${tokens.subMuted}`}>
                        Select an accepted Watch Buddy on the left to open your async movie chat.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ================= TAB 4: LATEST COMMUNITY REVIEWS ================= */
          <div className="space-y-3">
            <div className="rabtv-section-banner">
              <div
                className="rabtv-art-bg"
                aria-hidden="true"
                style={{ backgroundImage: `url(${BUTTON_WRAPPER_URL})` }}
              />
              <h2 className="rabtv-section-banner-title font-black text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)]">
                ⭐ Latest Community Ratings & Reviews
              </h2>
            </div>

            {reviews.length === 0 ? (
              <div className={`rounded-3xl border p-8 text-center text-xs ${tokens.panel} ${tokens.subMuted}`}>
                No reviews posted yet — open any movie or TV show and tap <strong>Rate & Reviews</strong>!
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {reviews.map((rev) => {
                  const hidden = rev.isSpoiler && !revealedSpoilers.has(rev.reviewId);
                  return (
                    <div
                      key={rev.reviewId}
                      className={`rounded-2xl border p-4 space-y-2 ${tokens.panel}`}
                    >
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
                          🎬 {rev.title}
                        </button>
                        <span className="text-xs font-black text-amber-400 shrink-0">
                          {"★".repeat(rev.rating)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-[11px]">
                        <MascotAvatar
                          mascot={rev.authorMascot}
                          size="sm"
                          rounded="full"
                          className="h-6 w-6 shrink-0"
                          alt={rev.authorHandle}
                        />
                        <span className={`font-extrabold ${tokens.accent}`}>
                          {rev.authorHandle}
                        </span>
                        <span className={tokens.subMuted}>• {formatAgo(rev.updatedAt)}</span>
                        <span
                          className={`ml-auto rounded-full border px-2 py-0.5 text-[9px] font-extrabold ${
                            rev.liked
                              ? "bg-emerald-950/75 border-emerald-500/40 text-emerald-300"
                              : "bg-red-950/75 border-red-500/40 text-red-300"
                          }`}
                        >
                          {rev.liked ? "👍 Liked" : "👎 Disliked"}
                        </span>
                      </div>

                      {rev.comment && (
                        hidden ? (
                          <button
                            type="button"
                            onClick={() =>
                              setRevealedSpoilers((prev) => {
                                const n = new Set(prev);
                                n.add(rev.reviewId);
                                return n;
                              })
                            }
                            className={`w-full rounded-xl border border-dashed py-1.5 text-[11px] font-bold cursor-pointer ${tokens.btnSecondary}`}
                          >
                            🙈 Spoiler — Tap to Reveal
                          </button>
                        ) : (
                          <p className={`text-xs leading-relaxed ${tokens.muted}`}>
                            {rev.comment}
                          </p>
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Watch Buddy Movie Picker Modal */}
      {inviteTarget && (
        <div
          className="rabtv-vidsrc-protected fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
          onClick={() => setInviteTarget(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-md max-h-[85dvh] overflow-y-auto scrollbar-none rounded-3xl border p-5 space-y-4 ${tokens.panel}`}
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm sm:text-base font-black text-white truncate">
                🤝 Watch Together with {inviteTarget.handle}
              </h3>
              <button
                type="button"
                onClick={() => setInviteTarget(null)}
                className={`h-8 w-8 rounded-full border text-xs font-bold cursor-pointer ${tokens.btnSecondary}`}
              >
                ✕
              </button>
            </div>

            <input
              ref={inviteNoteRef}
              type="text"
              dir="ltr"
              maxLength={160}
              placeholder="Optional note (e.g. Let's watch this weekend & chat!)"
              style={{ direction: "ltr", unicodeBidi: "plaintext", textAlign: "left" }}
              className={`w-full h-10 rounded-xl border px-3 text-xs font-bold focus:outline-none ${tokens.input}`}
            />

            <div className="space-y-2">
              <span className={`block text-[10px] font-extrabold uppercase tracking-wider ${tokens.subMuted}`}>
                Pick a Movie/Show to Discuss (or open any movie page & tap Watch Together)
              </span>
              {[
                ...(inviteTarget.recentWatched || []),
                ...(vibePreview.recentWatched || []),
              ].length === 0 ? (
                <p className={`text-xs ${tokens.subMuted}`}>
                  Open any movie or show page and tap <strong>Rate & Reviews → Watch Together</strong> to invite {inviteTarget.handle} to that title!
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
      )}
    </main>
  );
}