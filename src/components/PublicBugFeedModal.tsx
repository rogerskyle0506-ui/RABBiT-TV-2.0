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

const IMG_PBF_MODAL_FRAME =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-referral-modal-frame.jpg";
const IMG_PBF_BANNER =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-bugs-banner.jpg";
const IMG_PBF_CARD =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-referral-section-card.jpg";
const IMG_PBF_TAB_ACTIVE =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-referral-tab-active.jpg";
const IMG_PBF_TAB_IDLE =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-referral-tab-idle.jpg";
const IMG_PBF_PROGRESS_TRACK =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-referral-progress-track.jpg";
const IMG_PBF_INPUT =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-search-input-bar-background.jpg";

const PUBLIC_BUG_FEED_STYLES = `
  :root, html[data-theme="violet"] { --rabtv-pbf-filter: hue-rotate(-78deg) saturate(1.12) brightness(1.02); }
  html[data-theme="red"] { --rabtv-pbf-filter: hue-rotate(0deg) saturate(1.08) brightness(1.0); }
  html[data-theme="midnight"] { --rabtv-pbf-filter: hue-rotate(-132deg) saturate(1.14) brightness(1.04); }
  html[data-theme="emerald"] { --rabtv-pbf-filter: hue-rotate(154deg) saturate(1.10) brightness(1.02); }
  html[data-theme="amber"] { --rabtv-pbf-filter: hue-rotate(28deg) saturate(1.14) brightness(1.04); }
  html[data-theme="cyan"] { --rabtv-pbf-filter: hue-rotate(-154deg) saturate(1.12) brightness(1.04); }

  .rabtv-pbf-shell {
    position: relative;
    overflow: hidden;
    box-sizing: border-box;
    padding: 18px 14px !important;
    background-color: #0c0a09;
    contain: layout paint;
  }
  @media (min-width: 640px) { .rabtv-pbf-shell { padding: 24px 22px !important; } }
  .rabtv-pbf-shell-9slice {
    position: absolute;
    inset: 0;
    box-sizing: border-box;
    border-style: solid;
    border-color: transparent;
    border-width: 24px 20px;
    border-image-source: url("${IMG_PBF_MODAL_FRAME}");
    border-image-slice: 12% 11% fill;
    border-image-repeat: stretch;
    filter: var(--rabtv-pbf-filter);
    pointer-events: none;
    z-index: 0;
  }
  .rabtv-pbf-card {
    position: relative;
    overflow: hidden;
    box-sizing: border-box;
    padding: 15px 15px !important;
    background-color: #0c0a09;
    contain: layout paint;
  }
  .rabtv-pbf-card-9slice {
    position: absolute;
    inset: 0;
    box-sizing: border-box;
    border-style: solid;
    border-color: transparent;
    border-width: 14px 14px;
    border-image-source: url("${IMG_PBF_CARD}");
    border-image-slice: 14% 11% fill;
    border-image-repeat: stretch;
    filter: var(--rabtv-pbf-filter);
    pointer-events: none;
    z-index: 0;
  }
  .rabtv-pbf-btn {
    position: relative;
    overflow: hidden;
    background-color: #0c0a09;
    border: 0 !important;
    clip-path: polygon(8px 0%, calc(100% - 8px) 0%, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0% calc(100% - 8px), 0% 8px);
    contain: layout paint;
    transition: transform 140ms ease, filter 140ms ease;
  }
  .rabtv-pbf-btn:hover:not(:disabled) { transform: scale(1.02); filter: brightness(1.09); }
  .rabtv-pbf-btn-art {
    position: absolute;
    inset: -2px;
    background-size: 100% 100%;
    filter: var(--rabtv-pbf-filter);
    pointer-events: none;
    z-index: 0;
  }
  .rabtv-pbf-btn-scrim {
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse 78% 72% at 50% 50%, rgba(12,10,9,0.36) 0%, rgba(12,10,9,0.14) 100%);
    pointer-events: none;
    z-index: 1;
  }
  .rabtv-pbf-btn-label {
    position: relative;
    z-index: 2;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    text-shadow: 0 1px 4px rgba(12,10,9,0.96);
  }
  .rabtv-pbf-input-shell {
    position: relative;
    overflow: hidden;
    background-color: #0c0a09;
    contain: layout paint;
  }
  .rabtv-pbf-input-9slice {
    position: absolute;
    inset: 0;
    box-sizing: border-box;
    border-style: solid;
    border-color: transparent;
    border-width: 7px 16px;
    border-image-source: url("${IMG_PBF_INPUT}");
    border-image-slice: 22% 14% fill;
    border-image-repeat: stretch;
    filter: var(--rabtv-pbf-filter);
    pointer-events: none;
    z-index: 0;
  }
`;

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

  if (!isOpen) return null;

  const handleManualSync = () => {
    if (loading || refreshCooldown > 0) return;
    setRefreshCooldown(5);
    void loadReports(true);
  };

  return (
    <div
      data-theme={appTheme}
      className={`rabtv-vidsrc-protected fixed inset-0 z-50 flex items-center justify-center bg-black/84 p-2.5 sm:p-5 ${
        isLowRam ? "" : "backdrop-blur-xl"
      } overflow-y-auto`}
    >
      <style>{PUBLIC_BUG_FEED_STYLES}</style>
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      <div className="rabtv-pbf-shell relative z-10 w-full max-w-2xl rounded-[26px] text-white max-h-[92dvh] flex flex-col shadow-2xl">
        <div className="rabtv-pbf-shell-9slice" aria-hidden="true" />

        <div className="relative z-10 flex flex-col max-h-full overflow-hidden gap-3">
          {/* Tech Repair Workbench Header Banner */}
          <div className="relative overflow-hidden rounded-2xl border border-white/10 min-h-[150px] sm:min-h-[176px] p-3.5 sm:p-4 flex flex-col justify-between bg-[#0c0a09] shrink-0">
            <div
              className="absolute inset-0 bg-cover bg-center opacity-92 pointer-events-none"
              style={{ backgroundImage: `url(${IMG_PBF_BANNER})` }}
              aria-hidden="true"
            />
            <div
              className="absolute inset-0 bg-gradient-to-b from-[#0c0a09]/86 via-[#0c0a09]/25 to-[#0c0a09]/92 pointer-events-none"
              aria-hidden="true"
            />

            <div className="relative z-10 flex items-center justify-between gap-2">
              <span className="rounded-full bg-black/80 border border-white/15 px-2.5 py-1 text-[9.5px] font-black uppercase tracking-widest text-amber-300">
                📋 Live Issue Feed
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handleManualSync}
                  disabled={loading || refreshCooldown > 0}
                  className="rabtv-pbf-btn px-3 py-1.5 text-[11px] font-extrabold text-white disabled:opacity-45 cursor-pointer"
                >
                  <span className="rabtv-pbf-btn-art" style={{ backgroundImage: `url(${IMG_PBF_TAB_IDLE})` }} />
                  <span className="rabtv-pbf-btn-scrim" />
                  <span className="rabtv-pbf-btn-label">
                    {loading
                      ? "Syncing..."
                      : refreshCooldown > 0
                        ? `Wait ${refreshCooldown}s`
                        : "↻ Sync"}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close Community Bug Tracker"
                  className="rabtv-pbf-btn px-3 py-1.5 text-[11px] font-extrabold text-white cursor-pointer"
                >
                  <span className="rabtv-pbf-btn-art" style={{ backgroundImage: `url(${IMG_PBF_TAB_IDLE})` }} />
                  <span className="rabtv-pbf-btn-scrim" />
                  <span className="rabtv-pbf-btn-label">✕ Close</span>
                </button>
              </div>
            </div>

            <div className="relative z-10 pt-8">
              <h3 className="text-lg sm:text-xl font-black uppercase tracking-tight text-amber-300 drop-shadow-[0_2px_8px_rgba(0,0,0,0.98)]">
                Community Bug Tracker
              </h3>
              <p className="text-[11px] font-bold text-zinc-200 drop-shadow">
                {stats.total} tracked • <strong className="text-emerald-300">✓ {stats.resolvedPct}% Resolved</strong> ({stats.completed} of {stats.total})
              </p>
            </div>
          </div>

          {/* Riveted Resolution Progress Track */}
          <div className="relative h-6 w-full rounded-lg overflow-hidden bg-[#0c0a09] shrink-0">
            <div
              className="absolute inset-0 bg-cover bg-center pointer-events-none"
              style={{
                backgroundImage: `url(${IMG_PBF_PROGRESS_TRACK})`,
                backgroundSize: "100% 100%",
                filter: "var(--rabtv-pbf-filter)",
              }}
              aria-hidden="true"
            />
            <div className="absolute inset-x-[3.4%] inset-y-[22%] rounded bg-black/85 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 transition-all duration-500"
                style={{ width: `${Math.max(stats.total === 0 ? 100 : 4, stats.resolvedPct)}%` }}
              />
            </div>
          </div>

          {/* 9-Sliced Search + Armored Filter Tabs */}
          <div className="shrink-0 space-y-2">
            <div className="rabtv-pbf-input-shell rounded-xl">
              <div className="rabtv-pbf-input-9slice" aria-hidden="true" />
              <span className="absolute left-4 top-1/2 -translate-y-1/2 z-10 text-xs text-cyan-300 pointer-events-none">
                🔍
              </span>
              <input
                type="text"
                dir="ltr"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search bug reports or reporter..."
                className="relative z-10 w-full h-10 bg-transparent pl-10 pr-9 text-xs font-bold text-white placeholder-zinc-400 focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 z-20 text-xs text-zinc-400 hover:text-white cursor-pointer"
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
                  className={`rabtv-pbf-btn shrink-0 ${
                    largeButtons ? "px-3.5 py-2 text-xs" : "px-3 py-1.5 text-[11px]"
                  } font-extrabold text-white whitespace-nowrap cursor-pointer`}
                >
                  <span
                    className="rabtv-pbf-btn-art"
                    style={{
                      backgroundImage: `url(${
                        activeFilter === pill.id ? IMG_PBF_TAB_ACTIVE : IMG_PBF_TAB_IDLE
                      })`,
                    }}
                  />
                  <span className="rabtv-pbf-btn-scrim" />
                  <span className="rabtv-pbf-btn-label">{pill.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Scrollable 9-Sliced Ticket Feed */}
          <div className="flex-1 overflow-y-auto space-y-2.5 pr-0.5 scrollbar-none">
            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2.5 text-center">
                <div className="h-7 w-7 rounded-full border-2 border-t-transparent border-amber-400 animate-spin" />
                <p className="text-xs font-bold text-zinc-300">
                  Loading live community tracker...
                </p>
              </div>
            ) : filteredReports.length === 0 ? (
              <div className="rabtv-pbf-card rounded-2xl text-center">
                <div className="rabtv-pbf-card-9slice" aria-hidden="true" />
                <div className="relative z-10 py-6 space-y-1.5">
                  <div className="text-2xl">✨</div>
                  <p className="text-sm font-extrabold text-white">
                    {reports.length === 0
                      ? "No bugs reported yet — all systems smooth!"
                      : "No bug reports match your filter."}
                  </p>
                  <p className="text-xs text-zinc-400">
                    {reports.length === 0
                      ? "Use 'Report a Bug' in the menu if you ever spot a technical glitch."
                      : "Try switching tabs or clearing your search."}
                  </p>
                </div>
              </div>
            ) : (
              filteredReports.map((report) => {
                const mine = isMyReport(report);
                const statusMeta =
                  report.status === "pending"
                    ? {
                        badge: "bg-amber-500/20 text-amber-300 border-amber-400/45",
                        label: "⏳ Pending Review",
                      }
                    : report.status === "in_progress"
                      ? {
                          badge: "bg-sky-500/20 text-sky-300 border-sky-400/45",
                          label: "🔧 In Progress",
                        }
                      : {
                          badge: "bg-emerald-500/20 text-emerald-300 border-emerald-400/45",
                          label: "✓ Resolved / Fixed",
                        };

                return (
                  <div
                    key={report.id}
                    className={`rabtv-pbf-card rounded-2xl ${
                      mine ? "ring-1 ring-cyan-400/60" : ""
                    }`}
                  >
                    <div className="rabtv-pbf-card-9slice" aria-hidden="true" />
                    <div className="relative z-10 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center flex-wrap gap-1.5 min-w-0">
                          <span className="font-extrabold text-white truncate">
                            👤 {sanitizeDisplayText(report.name) || "User"}
                          </span>
                          <span className="font-mono text-[10px] text-zinc-400 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded">
                            ID {maskPublicSuffix(report.codeSuffix)}
                          </span>
                          {mine && (
                            <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-400/40 text-[9px] font-black uppercase tracking-wider text-cyan-300">
                              Your Ticket
                            </span>
                          )}
                        </div>

                        <span className="text-[10px] font-semibold text-zinc-400 shrink-0">
                          {report.timestamp
                            ? `${formatRelativeTime(report.timestamp)} • ${formatAppTime(
                                report.timestamp,
                                clockFormat
                              )}`
                            : "Recent"}
                        </span>
                      </div>

                      <p className="text-xs sm:text-sm text-zinc-100 font-semibold bg-black/70 p-2.5 rounded-xl border border-white/10 leading-relaxed break-words">
                        &ldquo;{sanitizeDisplayText(report.message)}&rdquo;
                      </p>

                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
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
        </div>
      </div>
    </div>
  );
}