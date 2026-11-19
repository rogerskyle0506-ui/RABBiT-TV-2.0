// src/components/PublicBugFeedModal.tsx
import React, { useEffect, useState, useMemo, useCallback } from "react";
import { fetchBugSystemData, type BugReport } from "@/lib/bugReports";
import {
  type AppTheme,
  getSavedTheme,
  getLargeButtons,
  getReducedMotion,
  getHardwareLimits,
  getClockFormat,
  formatAppTime,
  getAgeLockPinSuffix,
} from "@/lib/settings";

interface PublicBugFeedModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type FeedFilter = "all" | "pending" | "in_progress" | "completed" | "mine";

const RABBIT_HEADER_PILL =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/main/assets/rabbit-header-pill.jpg";
const RABBIT_DIVIDER =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/main/assets/rabbit-divider.jpg";

function maskPublicSuffix(suffix: string): string {
  const clean = String(suffix || "").replace(/\D/g, "");
  if (clean.length >= 2) return `••${clean.slice(-2)}`;
  return "••••";
}

function sanitizeDisplayText(text: string): string {
  return String(text || "")
    .replace(/[<>]/g, "")
    .trim();
}

function formatRelativeTime(timestamp: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return new Date(timestamp).toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
}

export function PublicBugFeedModal({
  isOpen,
  onClose,
}: PublicBugFeedModalProps) {
  const [reports, setReports] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshCooldown, setRefreshCooldown] = useState(0);
  const [activeFilter, setActiveFilter] = useState<FeedFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [appTheme, setAppTheme] = useState<AppTheme>(() => getSavedTheme());
  const [largeButtons, setLargeButtons] = useState<boolean>(() =>
    getLargeButtons()
  );
  const [reducedMotion, setReducedMotion] = useState<boolean>(() =>
    getReducedMotion()
  );
  const [isLowRam, setIsLowRam] = useState<boolean>(
    () => getHardwareLimits().effectiveMode === "low"
  );
  const [clockFormat, setClockFormat] = useState(() => getClockFormat());

  // Current user identity for highlighting their own submitted reports
  const myProfileName = useMemo(() => {
    if (typeof window === "undefined") return "";
    return (localStorage.getItem("rabtv_profile_name") || "")
      .trim()
      .toLowerCase();
  }, [isOpen]);

  const myPinSuffix = useMemo(() => {
    return getAgeLockPinSuffix().trim().toLowerCase();
  }, [isOpen]);

  const isMyReport = useCallback(
    (r: BugReport) => {
      if (!myProfileName) return false;
      const nameMatch = r.name.trim().toLowerCase() === myProfileName;
      const suffixMatch =
        myPinSuffix && r.codeSuffix.trim().toLowerCase() === myPinSuffix;
      return nameMatch && Boolean(suffixMatch);
    },
    [myProfileName, myPinSuffix]
  );

  const loadReports = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    try {
      const data = await fetchBugSystemData(forceRefresh);
      const sorted = [...(data.reports || [])].sort(
        (a, b) => (b.timestamp || 0) - (a.timestamp || 0)
      );
      setReports(sorted);
    } catch (err) {
      console.error("Failed to load public bug feed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    setAppTheme(getSavedTheme());
    setLargeButtons(getLargeButtons());
    setReducedMotion(getReducedMotion());
    setIsLowRam(getHardwareLimits().effectiveMode === "low");
    setClockFormat(getClockFormat());
    void loadReports(false);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, loadReports, onClose]);

  useEffect(() => {
    if (refreshCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setRefreshCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [refreshCooldown]);

  const stats = useMemo(() => {
    let pending = 0;
    let inProgress = 0;
    let completed = 0;
    let mine = 0;

    for (const r of reports) {
      if (r.status === "pending") pending++;
      else if (r.status === "in_progress") inProgress++;
      else if (r.status === "completed") completed++;
      if (isMyReport(r)) mine++;
    }

    const resolvedPct =
      reports.length > 0 ? Math.round((completed / reports.length) * 100) : 100;

    return {
      total: reports.length,
      pending,
      inProgress,
      completed,
      mine,
      resolvedPct,
    };
  }, [reports, isMyReport]);

  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      if (activeFilter === "mine" && !isMyReport(r)) return false;
      if (
        activeFilter !== "all" &&
        activeFilter !== "mine" &&
        r.status !== activeFilter
      ) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        return (
          (r.message || "").toLowerCase().includes(q) ||
          (r.name || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [reports, activeFilter, searchQuery, isMyReport]);

  const themeTokens = useMemo(() => {
    switch (appTheme) {
      case "red":
        return {
          borderGlow:
            "border-red-500/45 shadow-[0_25px_75px_rgba(0,0,0,0.95),0_0_35px_rgba(239,68,68,0.28)]",
          accentText: "text-red-300",
          activePill:
            "bg-gradient-to-r from-red-600 via-rose-600 to-orange-600 text-white shadow-md",
          laser: "from-red-500 via-amber-400 to-rose-500",
          ring: "focus:ring-red-400",
        };
      case "midnight":
        return {
          borderGlow:
            "border-sky-500/45 shadow-[0_25px_75px_rgba(0,0,0,0.95),0_0_35px_rgba(56,189,248,0.28)]",
          accentText: "text-sky-300",
          activePill:
            "bg-gradient-to-r from-blue-600 via-cyan-600 to-sky-500 text-white shadow-md",
          laser: "from-sky-400 via-cyan-300 to-blue-500",
          ring: "focus:ring-sky-400",
        };
      case "emerald":
        return {
          borderGlow:
            "border-emerald-500/45 shadow-[0_25px_75px_rgba(0,0,0,0.95),0_0_35px_rgba(16,185,129,0.28)]",
          accentText: "text-emerald-300",
          activePill:
            "bg-gradient-to-r from-emerald-600 via-teal-600 to-green-500 text-white shadow-md",
          laser: "from-emerald-400 via-teal-300 to-cyan-400",
          ring: "focus:ring-emerald-400",
        };
      case "amber":
        return {
          borderGlow:
            "border-amber-500/45 shadow-[0_25px_75px_rgba(0,0,0,0.95),0_0_35px_rgba(245,158,11,0.28)]",
          accentText: "text-amber-300",
          activePill:
            "bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500 text-slate-950 shadow-md",
          laser: "from-amber-400 via-yellow-300 to-orange-500",
          ring: "focus:ring-amber-400",
        };
      case "cyan":
        return {
          borderGlow:
            "border-cyan-500/45 shadow-[0_25px_75px_rgba(0,0,0,0.95),0_0_35px_rgba(34,211,238,0.28)]",
          accentText: "text-cyan-300",
          activePill:
            "bg-gradient-to-r from-cyan-500 via-teal-500 to-blue-600 text-white shadow-md",
          laser: "from-cyan-400 via-sky-300 to-blue-500",
          ring: "focus:ring-cyan-400",
        };
      case "violet":
      default:
        return {
          borderGlow:
            "border-violet-500/45 shadow-[0_25px_75px_rgba(0,0,0,0.95),0_0_35px_rgba(168,85,247,0.28)]",
          accentText: "text-violet-300",
          activePill:
            "bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 text-white shadow-md",
          laser: "from-cyan-400 via-violet-400 to-pink-500",
          ring: "focus:ring-violet-400",
        };
    }
  }, [appTheme]);

  if (!isOpen) return null;

  const handleManualSync = () => {
    if (loading || refreshCooldown > 0) return;
    setRefreshCooldown(5);
    void loadReports(true);
  };

  return (
    <div className="rabtv-vidsrc-protected fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-5 backdrop-blur-xl overflow-y-auto">
      {!reducedMotion && (
        <style>{`
          @keyframes crystalFeedIn {
            0% { opacity: 0; transform: scale(0.96) translateY(10px); }
            100% { opacity: 1; transform: scale(1) translateY(0); }
          }
          .animate-crystal-feed-in {
            animation: crystalFeedIn 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }
        `}</style>
      )}

      {/* Click-outside backdrop */}
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      {/* Crystal Neon Glass Tracker Vault */}
      <div
        className={`relative z-10 w-full max-w-2xl rounded-[28px] border-2 bg-slate-950/92 ${
          isLowRam ? "" : "backdrop-blur-2xl"
        } text-white overflow-hidden max-h-[88dvh] flex flex-col ${
          reducedMotion ? "" : "animate-crystal-feed-in"
        } ${themeTokens.borderGlow}`}
      >
        {/* Top & Bottom Couture Neon Laser Rim */}
        <div
          className={`absolute inset-x-10 top-0 h-[2px] bg-gradient-to-r ${themeTokens.laser} opacity-95 z-20 pointer-events-none`}
        />
        <div
          className={`absolute inset-x-10 bottom-0 h-[2px] bg-gradient-to-r ${themeTokens.laser} opacity-75 z-20 pointer-events-none`}
        />

        {/* Header Bar */}
        <div className="p-4 sm:p-5 pb-3.5 border-b border-white/10 space-y-3 bg-gradient-to-b from-white/[0.04] to-transparent">
          <div className="flex items-center justify-between gap-2">
            <div className="relative inline-flex items-center gap-2 px-4 py-1.5 rounded-2xl overflow-hidden border border-white/15 min-w-0">
              <div
                className="absolute inset-0 pointer-events-none opacity-80"
                style={{
                  backgroundImage: `url(${RABBIT_HEADER_PILL})`,
                  backgroundSize: "120% 340%",
                  backgroundPosition: "center center",
                }}
              />
              <div className="absolute inset-0 bg-black/45" />
              <span className="relative z-10 text-base shrink-0">📋</span>
              <h3 className="relative z-10 text-sm sm:text-base font-black tracking-wide text-amber-300 truncate drop-shadow">
                Community Bug Tracker
              </h3>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleManualSync}
                disabled={loading || refreshCooldown > 0}
                className={`rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 ${
                  largeButtons ? "px-3.5 py-2 text-xs" : "px-2.5 py-1.5 text-[11px]"
                } font-extrabold text-cyan-300 transition disabled:opacity-45 cursor-pointer focus:outline-none focus:ring-2 ${
                  themeTokens.ring
                }`}
                title="Refresh live bug tracker"
              >
                {loading
                  ? "Syncing..."
                  : refreshCooldown > 0
                    ? `Wait ${refreshCooldown}s`
                    : "🔄 Sync"}
              </button>

              <button
                type="button"
                onClick={onClose}
                className={`rounded-xl bg-white/10 hover:bg-red-600/85 border border-white/15 hover:border-red-400 ${
                  largeButtons ? "px-4 py-2 text-xs" : "px-3 py-1.5 text-xs"
                } font-extrabold text-slate-200 hover:text-white transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-red-400`}
                aria-label="Close Community Bug Tracker"
              >
                ✕ Close
              </button>
            </div>
          </div>

          {/* Live System Resolution Health Bar */}
          <div className="rounded-2xl bg-black/60 border border-white/10 p-3 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold">
              <span className="text-slate-300">
                Read-only live issue feed •{" "}
                <strong className="text-white">{stats.total}</strong> tracked
              </span>
              <span className="text-emerald-400 font-extrabold">
                ✓ {stats.resolvedPct}% Resolved ({stats.completed}/{stats.total})
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 transition-all duration-500"
                style={{ width: `${Math.max(stats.total === 0 ? 100 : 4, stats.resolvedPct)}%` }}
              />
            </div>
          </div>

          {/* Search & Interactive Filter Bar */}
          <div className="space-y-2">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">
                🔍
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search bug reports or reporter..."
                className={`w-full rounded-xl border border-white/15 bg-black/75 pl-8 pr-8 py-2 text-xs font-bold text-white placeholder-slate-500 focus:outline-none focus:ring-2 ${themeTokens.ring}`}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
              {(
                [
                  { id: "all", label: `All (${stats.total})` },
                  { id: "pending", label: `⏳ Pending (${stats.pending})` },
                  { id: "in_progress", label: `🔧 Working (${stats.inProgress})` },
                  { id: "completed", label: `✓ Fixed (${stats.completed})` },
                  ...(stats.mine > 0
                    ? [{ id: "mine" as FeedFilter, label: `👤 Mine (${stats.mine})` }]
                    : []),
                ] as { id: FeedFilter; label: string }[]
              ).map((pill) => (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setActiveFilter(pill.id)}
                  className={`shrink-0 rounded-xl ${
                    largeButtons ? "px-3.5 py-2 text-xs" : "px-3 py-1.5 text-[11px]"
                  } font-extrabold whitespace-nowrap transition cursor-pointer ${
                    activeFilter === pill.id
                      ? themeTokens.activePill
                      : "bg-black/60 border border-white/10 text-slate-300 hover:bg-white/10"
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Scrollable Report Feed */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 scrollbar-none">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2.5 text-center">
              <div className="h-7 w-7 rounded-full border-2 border-t-transparent border-amber-400 animate-spin" />
              <p className="text-xs font-bold text-slate-300">
                Loading live community tracker...
              </p>
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-black/55 p-8 text-center space-y-1.5">
              <div className="text-2xl">✨</div>
              <p className="text-sm font-extrabold text-white">
                {reports.length === 0
                  ? "No bugs reported yet — all systems smooth!"
                  : "No bug reports match your filter."}
              </p>
              <p className="text-xs text-slate-400">
                {reports.length === 0
                  ? "Use 'Report a Bug' in the menu if you ever spot a technical glitch."
                  : "Try switching tabs or clearing your search."}
              </p>
            </div>
          ) : (
            filteredReports.map((report) => {
              const mine = isMyReport(report);
              const statusMeta =
                report.status === "pending"
                  ? {
                      badge:
                        "bg-amber-500/20 text-amber-300 border-amber-400/40",
                      label: "⏳ Pending Review",
                      bar: "bg-amber-400",
                    }
                  : report.status === "in_progress"
                    ? {
                        badge: "bg-sky-500/20 text-sky-300 border-sky-400/40",
                        label: "🔧 In Progress",
                        bar: "bg-sky-400",
                      }
                    : {
                        badge:
                          "bg-emerald-500/20 text-emerald-300 border-emerald-400/40",
                        label: "✓ Resolved / Fixed",
                        bar: "bg-emerald-400",
                      };

              return (
                <div
                  key={report.id}
                  className={`relative overflow-hidden rounded-2xl border p-3.5 sm:p-4 space-y-2.5 transition ${
                    mine
                      ? "border-cyan-400/45 bg-cyan-950/20 shadow-[0_0_20px_rgba(34,211,238,0.12)]"
                      : "border-white/10 bg-black/60 hover:border-white/25"
                  }`}
                >
                  {/* Left Status Accent Rail */}
                  <div
                    className={`absolute left-0 top-3 bottom-3 w-1 rounded-r-full ${statusMeta.bar}`}
                  />

                  <div className="pl-2 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center flex-wrap gap-1.5 min-w-0">
                        <span className="font-extrabold text-white truncate">
                          👤 {sanitizeDisplayText(report.name) || "User"}
                        </span>
                        {/* Masked public suffix for user PIN privacy */}
                        <span className="font-mono text-[10px] text-slate-400 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded">
                          ID {maskPublicSuffix(report.codeSuffix)}
                        </span>
                        {mine && (
                          <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-400/40 text-[9px] font-black uppercase tracking-wider text-cyan-300">
                            Your Ticket
                          </span>
                        )}
                      </div>

                      <span
                        className="text-[10px] font-semibold text-slate-400 shrink-0"
                        title={
                          report.timestamp
                            ? `${new Date(
                                report.timestamp
                              ).toLocaleDateString()} ${formatAppTime(
                                report.timestamp,
                                clockFormat
                              )}`
                            : ""
                        }
                      >
                        {report.timestamp
                          ? `${formatRelativeTime(report.timestamp)} • ${formatAppTime(
                              report.timestamp,
                              clockFormat
                            )}`
                          : "Recent"}
                      </span>
                    </div>

                    <p className="text-xs sm:text-sm text-slate-100 font-semibold bg-slate-950/90 p-3 rounded-xl border border-white/10 leading-relaxed break-words">
                      &ldquo;{sanitizeDisplayText(report.message)}&rdquo;
                    </p>

                    <div className="flex items-center justify-between gap-2 pt-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Ticket Status
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${statusMeta.badge}`}
                      >
                        {statusMeta.label}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Divider */}
        <div className="px-4 py-2.5 border-t border-white/10 bg-black/50 text-center">
          <img
            src={RABBIT_DIVIDER}
            alt=""
            className="w-1/2 mx-auto h-1.5 object-contain opacity-75"
          />
        </div>
      </div>
    </div>
  );
}
// src/components/PublicBugFeedModal.tsx
import React, { useEffect, useState, useMemo, useCallback } from "react";
import { fetchBugSystemData, type BugReport } from "@/lib/bugReports";
import {
  type AppTheme,
  getSavedTheme,
  getLargeButtons,
  getReducedMotion,
  getHardwareLimits,
  getClockFormat,
  formatAppTime,
  getAgeLockPinSuffix,
} from "@/lib/settings";

interface PublicBugFeedModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type FeedFilter = "all" | "pending" | "in_progress" | "completed" | "mine";

const RABBIT_HEADER_PILL =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/main/assets/rabbit-header-pill.jpg";
const RABBIT_DIVIDER =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/main/assets/rabbit-divider.jpg";

function maskPublicSuffix(suffix: string): string {
  const clean = String(suffix || "").replace(/\D/g, "");
  if (clean.length >= 2) return `••${clean.slice(-2)}`;
  return "••••";
}

function sanitizeDisplayText(text: string): string {
  return String(text || "")
    .replace(/[<>]/g, "")
    .trim();
}

function formatRelativeTime(timestamp: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return new Date(timestamp).toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
}

export function PublicBugFeedModal({
  isOpen,
  onClose,
}: PublicBugFeedModalProps) {
  const [reports, setReports] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshCooldown, setRefreshCooldown] = useState(0);
  const [activeFilter, setActiveFilter] = useState<FeedFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [appTheme, setAppTheme] = useState<AppTheme>(() => getSavedTheme());
  const [largeButtons, setLargeButtons] = useState<boolean>(() =>
    getLargeButtons()
  );
  const [reducedMotion, setReducedMotion] = useState<boolean>(() =>
    getReducedMotion()
  );
  const [isLowRam, setIsLowRam] = useState<boolean>(
    () => getHardwareLimits().effectiveMode === "low"
  );
  const [clockFormat, setClockFormat] = useState(() => getClockFormat());

  // Current user identity for highlighting their own submitted reports
  const myProfileName = useMemo(() => {
    if (typeof window === "undefined") return "";
    return (localStorage.getItem("rabtv_profile_name") || "")
      .trim()
      .toLowerCase();
  }, [isOpen]);

  const myPinSuffix = useMemo(() => {
    return getAgeLockPinSuffix().trim().toLowerCase();
  }, [isOpen]);

  const isMyReport = useCallback(
    (r: BugReport) => {
      if (!myProfileName) return false;
      const nameMatch = r.name.trim().toLowerCase() === myProfileName;
      const suffixMatch =
        myPinSuffix && r.codeSuffix.trim().toLowerCase() === myPinSuffix;
      return nameMatch && Boolean(suffixMatch);
    },
    [myProfileName, myPinSuffix]
  );

  const loadReports = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    try {
      const data = await fetchBugSystemData(forceRefresh);
      const sorted = [...(data.reports || [])].sort(
        (a, b) => (b.timestamp || 0) - (a.timestamp || 0)
      );
      setReports(sorted);
    } catch (err) {
      console.error("Failed to load public bug feed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    setAppTheme(getSavedTheme());
    setLargeButtons(getLargeButtons());
    setReducedMotion(getReducedMotion());
    setIsLowRam(getHardwareLimits().effectiveMode === "low");
    setClockFormat(getClockFormat());
    void loadReports(false);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, loadReports, onClose]);

  useEffect(() => {
    if (refreshCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setRefreshCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [refreshCooldown]);

  const stats = useMemo(() => {
    let pending = 0;
    let inProgress = 0;
    let completed = 0;
    let mine = 0;

    for (const r of reports) {
      if (r.status === "pending") pending++;
      else if (r.status === "in_progress") inProgress++;
      else if (r.status === "completed") completed++;
      if (isMyReport(r)) mine++;
    }

    const resolvedPct =
      reports.length > 0 ? Math.round((completed / reports.length) * 100) : 100;

    return {
      total: reports.length,
      pending,
      inProgress,
      completed,
      mine,
      resolvedPct,
    };
  }, [reports, isMyReport]);

  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      if (activeFilter === "mine" && !isMyReport(r)) return false;
      if (
        activeFilter !== "all" &&
        activeFilter !== "mine" &&
        r.status !== activeFilter
      ) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        return (
          (r.message || "").toLowerCase().includes(q) ||
          (r.name || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [reports, activeFilter, searchQuery, isMyReport]);

  const themeTokens = useMemo(() => {
    switch (appTheme) {
      case "red":
        return {
          borderGlow:
            "border-red-500/45 shadow-[0_25px_75px_rgba(0,0,0,0.95),0_0_35px_rgba(239,68,68,0.28)]",
          accentText: "text-red-300",
          activePill:
            "bg-gradient-to-r from-red-600 via-rose-600 to-orange-600 text-white shadow-md",
          laser: "from-red-500 via-amber-400 to-rose-500",
          ring: "focus:ring-red-400",
        };
      case "midnight":
        return {
          borderGlow:
            "border-sky-500/45 shadow-[0_25px_75px_rgba(0,0,0,0.95),0_0_35px_rgba(56,189,248,0.28)]",
          accentText: "text-sky-300",
          activePill:
            "bg-gradient-to-r from-blue-600 via-cyan-600 to-sky-500 text-white shadow-md",
          laser: "from-sky-400 via-cyan-300 to-blue-500",
          ring: "focus:ring-sky-400",
        };
      case "emerald":
        return {
          borderGlow:
            "border-emerald-500/45 shadow-[0_25px_75px_rgba(0,0,0,0.95),0_0_35px_rgba(16,185,129,0.28)]",
          accentText: "text-emerald-300",
          activePill:
            "bg-gradient-to-r from-emerald-600 via-teal-600 to-green-500 text-white shadow-md",
          laser: "from-emerald-400 via-teal-300 to-cyan-400",
          ring: "focus:ring-emerald-400",
        };
      case "amber":
        return {
          borderGlow:
            "border-amber-500/45 shadow-[0_25px_75px_rgba(0,0,0,0.95),0_0_35px_rgba(245,158,11,0.28)]",
          accentText: "text-amber-300",
          activePill:
            "bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500 text-slate-950 shadow-md",
          laser: "from-amber-400 via-yellow-300 to-orange-500",
          ring: "focus:ring-amber-400",
        };
      case "cyan":
        return {
          borderGlow:
            "border-cyan-500/45 shadow-[0_25px_75px_rgba(0,0,0,0.95),0_0_35px_rgba(34,211,238,0.28)]",
          accentText: "text-cyan-300",
          activePill:
            "bg-gradient-to-r from-cyan-500 via-teal-500 to-blue-600 text-white shadow-md",
          laser: "from-cyan-400 via-sky-300 to-blue-500",
          ring: "focus:ring-cyan-400",
        };
      case "violet":
      default:
        return {
          borderGlow:
            "border-violet-500/45 shadow-[0_25px_75px_rgba(0,0,0,0.95),0_0_35px_rgba(168,85,247,0.28)]",
          accentText: "text-violet-300",
          activePill:
            "bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 text-white shadow-md",
          laser: "from-cyan-400 via-violet-400 to-pink-500",
          ring: "focus:ring-violet-400",
        };
    }
  }, [appTheme]);

  if (!isOpen) return null;

  const handleManualSync = () => {
    if (loading || refreshCooldown > 0) return;
    setRefreshCooldown(5);
    void loadReports(true);
  };

  return (
    <div className="rabtv-vidsrc-protected fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-5 backdrop-blur-xl overflow-y-auto">
      {!reducedMotion && (
        <style>{`
          @keyframes crystalFeedIn {
            0% { opacity: 0; transform: scale(0.96) translateY(10px); }
            100% { opacity: 1; transform: scale(1) translateY(0); }
          }
          .animate-crystal-feed-in {
            animation: crystalFeedIn 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }
        `}</style>
      )}

      {/* Click-outside backdrop */}
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      {/* Crystal Neon Glass Tracker Vault */}
      <div
        className={`relative z-10 w-full max-w-2xl rounded-[28px] border-2 bg-slate-950/92 ${
          isLowRam ? "" : "backdrop-blur-2xl"
        } text-white overflow-hidden max-h-[88dvh] flex flex-col ${
          reducedMotion ? "" : "animate-crystal-feed-in"
        } ${themeTokens.borderGlow}`}
      >
        {/* Top & Bottom Couture Neon Laser Rim */}
        <div
          className={`absolute inset-x-10 top-0 h-[2px] bg-gradient-to-r ${themeTokens.laser} opacity-95 z-20 pointer-events-none`}
        />
        <div
          className={`absolute inset-x-10 bottom-0 h-[2px] bg-gradient-to-r ${themeTokens.laser} opacity-75 z-20 pointer-events-none`}
        />

        {/* Header Bar */}
        <div className="p-4 sm:p-5 pb-3.5 border-b border-white/10 space-y-3 bg-gradient-to-b from-white/[0.04] to-transparent">
          <div className="flex items-center justify-between gap-2">
            <div className="relative inline-flex items-center gap-2 px-4 py-1.5 rounded-2xl overflow-hidden border border-white/15 min-w-0">
              <div
                className="absolute inset-0 pointer-events-none opacity-80"
                style={{
                  backgroundImage: `url(${RABBIT_HEADER_PILL})`,
                  backgroundSize: "120% 340%",
                  backgroundPosition: "center center",
                }}
              />
              <div className="absolute inset-0 bg-black/45" />
              <span className="relative z-10 text-base shrink-0">📋</span>
              <h3 className="relative z-10 text-sm sm:text-base font-black tracking-wide text-amber-300 truncate drop-shadow">
                Community Bug Tracker
              </h3>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleManualSync}
                disabled={loading || refreshCooldown > 0}
                className={`rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 ${
                  largeButtons ? "px-3.5 py-2 text-xs" : "px-2.5 py-1.5 text-[11px]"
                } font-extrabold text-cyan-300 transition disabled:opacity-45 cursor-pointer focus:outline-none focus:ring-2 ${
                  themeTokens.ring
                }`}
                title="Refresh live bug tracker"
              >
                {loading
                  ? "Syncing..."
                  : refreshCooldown > 0
                    ? `Wait ${refreshCooldown}s`
                    : "🔄 Sync"}
              </button>

              <button
                type="button"
                onClick={onClose}
                className={`rounded-xl bg-white/10 hover:bg-red-600/85 border border-white/15 hover:border-red-400 ${
                  largeButtons ? "px-4 py-2 text-xs" : "px-3 py-1.5 text-xs"
                } font-extrabold text-slate-200 hover:text-white transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-red-400`}
                aria-label="Close Community Bug Tracker"
              >
                ✕ Close
              </button>
            </div>
          </div>

          {/* Live System Resolution Health Bar */}
          <div className="rounded-2xl bg-black/60 border border-white/10 p-3 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold">
              <span className="text-slate-300">
                Read-only live issue feed •{" "}
                <strong className="text-white">{stats.total}</strong> tracked
              </span>
              <span className="text-emerald-400 font-extrabold">
                ✓ {stats.resolvedPct}% Resolved ({stats.completed}/{stats.total})
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 transition-all duration-500"
                style={{ width: `${Math.max(stats.total === 0 ? 100 : 4, stats.resolvedPct)}%` }}
              />
            </div>
          </div>

          {/* Search & Interactive Filter Bar */}
          <div className="space-y-2">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">
                🔍
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search bug reports or reporter..."
                className={`w-full rounded-xl border border-white/15 bg-black/75 pl-8 pr-8 py-2 text-xs font-bold text-white placeholder-slate-500 focus:outline-none focus:ring-2 ${themeTokens.ring}`}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
              {(
                [
                  { id: "all", label: `All (${stats.total})` },
                  { id: "pending", label: `⏳ Pending (${stats.pending})` },
                  { id: "in_progress", label: `🔧 Working (${stats.inProgress})` },
                  { id: "completed", label: `✓ Fixed (${stats.completed})` },
                  ...(stats.mine > 0
                    ? [{ id: "mine" as FeedFilter, label: `👤 Mine (${stats.mine})` }]
                    : []),
                ] as { id: FeedFilter; label: string }[]
              ).map((pill) => (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setActiveFilter(pill.id)}
                  className={`shrink-0 rounded-xl ${
                    largeButtons ? "px-3.5 py-2 text-xs" : "px-3 py-1.5 text-[11px]"
                  } font-extrabold whitespace-nowrap transition cursor-pointer ${
                    activeFilter === pill.id
                      ? themeTokens.activePill
                      : "bg-black/60 border border-white/10 text-slate-300 hover:bg-white/10"
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Scrollable Report Feed */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 scrollbar-none">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2.5 text-center">
              <div className="h-7 w-7 rounded-full border-2 border-t-transparent border-amber-400 animate-spin" />
              <p className="text-xs font-bold text-slate-300">
                Loading live community tracker...
              </p>
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-black/55 p-8 text-center space-y-1.5">
              <div className="text-2xl">✨</div>
              <p className="text-sm font-extrabold text-white">
                {reports.length === 0
                  ? "No bugs reported yet — all systems smooth!"
                  : "No bug reports match your filter."}
              </p>
              <p className="text-xs text-slate-400">
                {reports.length === 0
                  ? "Use 'Report a Bug' in the menu if you ever spot a technical glitch."
                  : "Try switching tabs or clearing your search."}
              </p>
            </div>
          ) : (
            filteredReports.map((report) => {
              const mine = isMyReport(report);
              const statusMeta =
                report.status === "pending"
                  ? {
                      badge:
                        "bg-amber-500/20 text-amber-300 border-amber-400/40",
                      label: "⏳ Pending Review",
                      bar: "bg-amber-400",
                    }
                  : report.status === "in_progress"
                    ? {
                        badge: "bg-sky-500/20 text-sky-300 border-sky-400/40",
                        label: "🔧 In Progress",
                        bar: "bg-sky-400",
                      }
                    : {
                        badge:
                          "bg-emerald-500/20 text-emerald-300 border-emerald-400/40",
                        label: "✓ Resolved / Fixed",
                        bar: "bg-emerald-400",
                      };

              return (
                <div
                  key={report.id}
                  className={`relative overflow-hidden rounded-2xl border p-3.5 sm:p-4 space-y-2.5 transition ${
                    mine
                      ? "border-cyan-400/45 bg-cyan-950/20 shadow-[0_0_20px_rgba(34,211,238,0.12)]"
                      : "border-white/10 bg-black/60 hover:border-white/25"
                  }`}
                >
                  {/* Left Status Accent Rail */}
                  <div
                    className={`absolute left-0 top-3 bottom-3 w-1 rounded-r-full ${statusMeta.bar}`}
                  />

                  <div className="pl-2 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center flex-wrap gap-1.5 min-w-0">
                        <span className="font-extrabold text-white truncate">
                          👤 {sanitizeDisplayText(report.name) || "User"}
                        </span>
                        {/* Masked public suffix for user PIN privacy */}
                        <span className="font-mono text-[10px] text-slate-400 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded">
                          ID {maskPublicSuffix(report.codeSuffix)}
                        </span>
                        {mine && (
                          <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-400/40 text-[9px] font-black uppercase tracking-wider text-cyan-300">
                            Your Ticket
                          </span>
                        )}
                      </div>

                      <span
                        className="text-[10px] font-semibold text-slate-400 shrink-0"
                        title={
                          report.timestamp
                            ? `${new Date(
                                report.timestamp
                              ).toLocaleDateString()} ${formatAppTime(
                                report.timestamp,
                                clockFormat
                              )}`
                            : ""
                        }
                      >
                        {report.timestamp
                          ? `${formatRelativeTime(report.timestamp)} • ${formatAppTime(
                              report.timestamp,
                              clockFormat
                            )}`
                          : "Recent"}
                      </span>
                    </div>

                    <p className="text-xs sm:text-sm text-slate-100 font-semibold bg-slate-950/90 p-3 rounded-xl border border-white/10 leading-relaxed break-words">
                      &ldquo;{sanitizeDisplayText(report.message)}&rdquo;
                    </p>

                    <div className="flex items-center justify-between gap-2 pt-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Ticket Status
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${statusMeta.badge}`}
                      >
                        {statusMeta.label}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Divider */}
        <div className="px-4 py-2.5 border-t border-white/10 bg-black/50 text-center">
          <img
            src={RABBIT_DIVIDER}
            alt=""
            className="w-1/2 mx-auto h-1.5 object-contain opacity-75"
          />
        </div>
      </div>
    </div>
  );
}
