// src/components/AdminBugInbox.tsx
import React, { useEffect, useState, useMemo, useCallback } from "react";
import { getHardwareLimits } from "@/lib/settings";
import {
  fetchBugSystemData,
  updateBugReportStatus,
  banUserFromReport,
  deleteBugReport,
  removeBannedUser,
  BugReport,
  BannedUser,
  StrikeRecord,
} from "@/lib/bugReports";

interface AdminBugInboxProps {
  isOpen?: boolean;
  onClose?: () => void;
}

type InboxTab = "inbox" | "banned";
type StatusFilter = "all" | "pending" | "in_progress" | "completed";

interface PendingConfirmation {
  type: "delete" | "ban" | "unban" | "purge_completed";
  id: string;
  name?: string;
  codeSuffix?: string;
}

const IMG_ABI_BANNER =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-bugs-banner.jpg";
const IMG_ABI_TAB_ACTIVE =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-referral-tab-active.jpg";
const IMG_ABI_TAB_IDLE =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-legal-tab-idle.jpg";

const GIST_ID = ((import.meta as any).env?.VITE_GIST_ID as string) || "";
const GITHUB_TOKEN = ((import.meta as any).env?.VITE_GH_PAT as string) || "";
const GIST_API_URL = GIST_ID ? `https://api.github.com/gists/${GIST_ID}` : "";

export function AdminBugInbox({ isOpen = true, onClose }: AdminBugInboxProps) {
  const [reports, setReports] = useState<BugReport[]>([]);
  const [bannedUsers, setBannedUsers] = useState<BannedUser[]>([]);
  const [strikes, setStrikes] = useState<StrikeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyActionId, setBusyActionId] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<InboxTab>("inbox");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Inline security confirmation (replaces blocking window.confirm for TV/WebView compatibility)
  const [confirmTarget, setConfirmTarget] =
    useState<PendingConfirmation | null>(null);

  // Direct Quick-Reply Toast States
  const [replyingToReportId, setReplyingToReportId] = useState<string | null>(
    null
  );
  const [replyMessage, setReplyMessage] = useState("");
  const [replyAutoComplete, setReplyAutoComplete] = useState(true);
  const [statusFeedback, setStatusFeedback] = useState<{
    text: string;
    isError: boolean;
  } | null>(null);

  // Manual Ban Form States (in Banned Users tab)
  const [manualBanName, setManualBanName] = useState("");
  const [manualBanSuffix, setManualBanSuffix] = useState("");

  const showTempFeedback = (text: string, isError = false) => {
    setStatusFeedback({ text, isError });
    window.setTimeout(() => {
      setStatusFeedback(null);
    }, 3200);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchBugSystemData();
      setReports(Array.isArray(data.reports) ? data.reports : []);
      setBannedUsers(Array.isArray(data.bannedUsers) ? data.bannedUsers : []);
      setStrikes(Array.isArray(data.strikes) ? data.strikes : []);
    } catch (err) {
      console.error("Failed to load bug inbox data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      void loadData();
    }
  }, [isOpen, loadData]);

  const statusCounts = useMemo(() => {
    const counts = {
      all: reports.length,
      pending: 0,
      in_progress: 0,
      completed: 0,
    };
    for (const r of reports) {
      if (r.status === "pending") counts.pending++;
      else if (r.status === "in_progress") counts.in_progress++;
      else if (r.status === "completed") counts.completed++;
    }
    return counts;
  }, [reports]);

  const bannedIdentifierSet = useMemo(() => {
    return new Set(bannedUsers.map((b) => b.identifier.trim().toLowerCase()));
  }, [bannedUsers]);

  const strikesMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of strikes) {
      if (s && s.identifier) {
        map[s.identifier.trim().toLowerCase()] = s.strikes || 0;
      }
    }
    return map;
  }, [strikes]);

  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const nameMatch = (r.name || "").toLowerCase().includes(q);
        const codeMatch = (r.codeSuffix || "").toLowerCase().includes(q);
        const msgMatch = (r.message || "").toLowerCase().includes(q);
        return nameMatch || codeMatch || msgMatch;
      }
      return true;
    });
  }, [reports, statusFilter, searchQuery]);

  const filteredBannedUsers = useMemo(() => {
    if (!searchQuery.trim()) return bannedUsers;
    const q = searchQuery.trim().toLowerCase();
    return bannedUsers.filter(
      (b) =>
        (b.name || "").toLowerCase().includes(q) ||
        (b.codeSuffix || "").toLowerCase().includes(q) ||
        (b.identifier || "").toLowerCase().includes(q)
    );
  }, [bannedUsers, searchQuery]);

  if (!isOpen) return null;

  const handleStatusChange = async (
    id: string,
    status: "pending" | "in_progress" | "completed"
  ) => {
    setBusyActionId(id);
    try {
      setReports((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status } : r))
      );
      const success = await updateBugReportStatus(id, status);
      if (success) {
        showTempFeedback(`✓ Ticket marked as ${status.replace("_", " ")}.`);
        await loadData();
      } else {
        showTempFeedback("⚠️ Failed to update ticket status.", true);
        await loadData();
      }
    } finally {
      setBusyActionId(null);
    }
  };

  const executeConfirmedAction = async () => {
    if (!confirmTarget) return;
    const target = confirmTarget;
    setConfirmTarget(null);
    setBusyActionId(target.id);

    try {
      if (target.type === "delete") {
        const success = await deleteBugReport(target.id);
        if (success) {
          showTempFeedback("🗑️ Bug report deleted.");
          await loadData();
        } else {
          showTempFeedback("⚠️ Could not delete report.", true);
        }
      } else if (target.type === "ban" && target.name && target.codeSuffix) {
        const success = await banUserFromReport(target.name, target.codeSuffix);
        if (success) {
          showTempFeedback(
            `🚫 Banned ${target.name} (...${target.codeSuffix}).`
          );
          await loadData();
        } else {
          showTempFeedback("⚠️ Failed to ban user.", true);
        }
      } else if (target.type === "unban") {
        const success = await removeBannedUser(target.id);
        if (success) {
          showTempFeedback(`✓ Removed ban for ${target.name || target.id}.`);
          await loadData();
        } else {
          showTempFeedback("⚠️ Failed to remove ban.", true);
        }
      } else if (target.type === "purge_completed") {
        const completedIds = reports
          .filter((r) => r.status === "completed")
          .map((r) => r.id);
        for (const cId of completedIds) {
          await deleteBugReport(cId);
        }
        showTempFeedback(
          `🧹 Purged ${completedIds.length} completed bug reports.`
        );
        await loadData();
      }
    } finally {
      setBusyActionId(null);
    }
  };

  const handleManualBanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = manualBanName.trim();
    const cleanSuffix = manualBanSuffix.trim().slice(-4);
    if (!cleanName || cleanSuffix.length < 4) {
      showTempFeedback(
        "⚠️ Enter a valid user name and at least 4 PIN digits.",
        true
      );
      return;
    }

    setBusyActionId("manual_ban");
    try {
      const success = await banUserFromReport(cleanName, cleanSuffix);
      if (success) {
        setManualBanName("");
        setManualBanSuffix("");
        showTempFeedback(
          `🚫 Added ${cleanName} (...${cleanSuffix}) to ban list.`
        );
        await loadData();
      } else {
        showTempFeedback("⚠️ Failed to add manual ban.", true);
      }
    } finally {
      setBusyActionId(null);
    }
  };

  const handleSendDirectToastReply = async (report: BugReport) => {
    const cleanReply = replyMessage.trim();
    if (!cleanReply) return;

    if (!GIST_ID || !GITHUB_TOKEN || !GIST_API_URL) {
      showTempFeedback("⚠️ Gist credentials missing for toast reply.", true);
      return;
    }

    setBusyActionId(report.id);
    try {
      const getRes = await fetch(GIST_API_URL, {
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "RabbitTV-App",
        },
        cache: "no-store",
      });

      let notifsList: any[] = [];
      if (getRes.ok) {
        const gistData = await getRes.json();
        const rawNotifs = gistData.files?.["notifications.json"]?.content;
        if (rawNotifs) {
          try {
            const parsed = JSON.parse(rawNotifs);
            if (Array.isArray(parsed)) notifsList = parsed;
          } catch {
            notifsList = [];
          }
        }
      }

      const newToast = {
        target: report.name.trim(),
        message: `🛠️ [Admin Reply to "${report.message.slice(
          0,
          22
        )}..."]: ${cleanReply}`,
        severity: "info",
        timestamp: Date.now(),
        id: Math.random().toString(36).substring(2, 9),
      };

      notifsList.push(newToast);

      const patchRes = await fetch(GIST_API_URL, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
          "User-Agent": "RabbitTV-App",
        },
        body: JSON.stringify({
          files: {
            "notifications.json": {
              content: JSON.stringify(notifsList, null, 2),
            },
          },
        }),
      });

      if (patchRes.ok) {
        if (replyAutoComplete && report.status !== "completed") {
          await updateBugReportStatus(report.id, "completed");
        }
        setReplyingToReportId(null);
        setReplyMessage("");
        showTempFeedback(`📢 Toast reply pushed to ${report.name}!`);
        await loadData();
      } else {
        showTempFeedback("⚠️ Failed to push toast reply.", true);
      }
    } catch (err) {
      console.error("Failed to send direct toast reply:", err);
      showTempFeedback("⚠️ Network error while sending reply.", true);
    } finally {
      setBusyActionId(null);
    }
  };

  const handleExportInboxJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      reports,
      bannedUsers,
      strikes,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rabtv_bug_inbox_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3 w-full box-border text-white">
      {/* Armored Workbench Header & Quick Actions */}
      <div className="relative overflow-hidden rounded-2xl border border-red-500/30 p-3 space-y-2 bg-[#0c0a09]">
        <div
          className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-28"
          style={{ backgroundImage: `url(${IMG_ABI_BANNER})` }}
          aria-hidden="true"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#0c0a09]/85 via-[#0c0a09]/65 to-[#0c0a09]/85" aria-hidden="true" />
        <div className="relative z-10 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-xs font-black uppercase tracking-wider text-red-300 flex items-center gap-1.5 min-w-0">
            <span className="truncate">🐞 Bug Inbox</span>
            <span className="shrink-0 rounded-full bg-red-600/30 border border-red-400/40 px-2 py-0.5 text-[9px] text-amber-300">
              {reports.length}
            </span>
          </h4>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleExportInboxJson}
              className="px-2 py-1 rounded-lg bg-black/75 hover:bg-red-950 border border-red-500/30 text-[10px] font-bold text-amber-300 transition cursor-pointer"
              title="Export Bug & Ban Logs as JSON"
            >
              💾 Export
            </button>
            <button
              type="button"
              onClick={() => void loadData()}
              disabled={loading}
              className="px-2.5 py-1 rounded-lg bg-red-950/80 hover:bg-red-800 border border-red-400/40 text-[10px] font-extrabold text-red-100 transition disabled:opacity-50 cursor-pointer"
            >
              {loading ? "..." : "🔄 Sync"}
            </button>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg bg-black/70 hover:bg-red-600 border border-white/15 px-2 py-1 text-[10px] font-bold text-slate-300 hover:text-white transition cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
        </div>
        <p className="text-[10px] text-zinc-300">
          Triaging, direct toast replies, strike tracking &amp; ban control.
        </p>
        </div>
      </div>

      {/* Status Toast Banner */}
      {statusFeedback && (
        <div
          className={`rounded-xl px-3 py-2 text-[11px] font-bold text-center border ${getHardwareLimits().effectiveMode === "low" ? "" : "backdrop-blur-md"} transition ${
            statusFeedback.isError
              ? "bg-red-950/80 border-red-500/50 text-red-200"
              : "bg-emerald-950/80 border-emerald-500/50 text-emerald-300"
          }`}
        >
          {statusFeedback.text}
        </div>
      )}

      {/* Inline Two-Step Security Confirmation Bar (TV / D-Pad Safe) */}
      {confirmTarget && (
        <div className="rounded-xl bg-red-950/90 border-2 border-amber-400/80 p-3 shadow-[0_0_25px_rgba(239,68,68,0.5)] space-y-2 text-center">
          <p className="text-[11px] font-extrabold text-white">
            {confirmTarget.type === "delete" &&
              "⚠️ Permanently delete this bug report?"}
            {confirmTarget.type === "ban" &&
              `🚫 Ban "${confirmTarget.name}" (...${confirmTarget.codeSuffix}) from reporting?`}
            {confirmTarget.type === "unban" &&
              `✓ Restore reporting rights for "${confirmTarget.name}"?`}
            {confirmTarget.type === "purge_completed" &&
              `🧹 Delete all ${statusCounts.completed} completed tickets from Gist?`}
          </p>
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => void executeConfirmedAction()}
              className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-red-600 to-orange-600 text-white text-[10px] font-black uppercase tracking-wider shadow-md hover:scale-105 transition cursor-pointer"
            >
              ✓ Confirm
            </button>
            <button
              type="button"
              onClick={() => setConfirmTarget(null)}
              className="px-3.5 py-1.5 rounded-lg bg-black/75 border border-white/20 text-slate-200 hover:text-white text-[10px] font-bold transition cursor-pointer"
            >
              ✕ Cancel
            </button>
          </div>
        </div>
      )}

      {/* Primary Tab Switcher: Equal Single-Line Buttons */}
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab("inbox")}
            style={{
              backgroundImage: `url(${activeTab === "inbox" ? IMG_ABI_TAB_ACTIVE : IMG_ABI_TAB_IDLE})`,
              backgroundSize: "100% 100%",
              clipPath: "polygon(8px 0%, calc(100% - 8px) 0%, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0% calc(100% - 8px), 0% 8px)",
            }}
            className="py-2 px-2 rounded-xl text-[11px] font-extrabold text-white whitespace-nowrap transition-all cursor-pointer hover:brightness-110"
          >
            <span className="drop-shadow-[0_1px_4px_rgba(0,0,0,0.95)]">📥 Inbox ({reports.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("banned")}
            style={{
              backgroundImage: `url(${activeTab === "banned" ? IMG_ABI_TAB_ACTIVE : IMG_ABI_TAB_IDLE})`,
              backgroundSize: "100% 100%",
              clipPath: "polygon(8px 0%, calc(100% - 8px) 0%, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0% calc(100% - 8px), 0% 8px)",
            }}
            className="py-2 px-2 rounded-xl text-[11px] font-extrabold text-white whitespace-nowrap transition-all cursor-pointer hover:brightness-110"
          >
            <span className="drop-shadow-[0_1px_4px_rgba(0,0,0,0.95)]">🚫 Banned ({bannedUsers.length})</span>
          </button>
        </div>

        {activeTab === "inbox" && statusCounts.completed > 0 && (
          <button
            type="button"
            onClick={() =>
              setConfirmTarget({
                type: "purge_completed",
                id: "purge_completed",
              })
            }
            className="w-full py-1.5 rounded-xl bg-black/70 hover:bg-red-950/80 border border-red-500/35 text-[10px] font-extrabold text-amber-300 transition cursor-pointer"
            title="Delete all completed tickets"
          >
            🧹 Purge Completed Tickets ({statusCounts.completed})
          </button>
        )}
      </div>

      {/* Search & Status Filter Bar */}
      <div className="space-y-2">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              activeTab === "inbox"
                ? "Search name, PIN, or bug..."
                : "Search banned user or PIN..."
            }
            className="w-full rounded-xl border border-red-500/30 bg-black/80 pl-3 pr-7 py-1.5 text-xs font-bold text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-red-400 box-border"
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

        {activeTab === "inbox" && (
          <div className="grid grid-cols-4 gap-1">
            {(
              [
                { id: "all", label: `All (${statusCounts.all})` },
                { id: "pending", label: `⏳ (${statusCounts.pending})` },
                { id: "in_progress", label: `🔧 (${statusCounts.in_progress})` },
                { id: "completed", label: `✓ (${statusCounts.completed})` },
              ] as { id: StatusFilter; label: string }[]
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`py-1 px-1 rounded-lg text-[10px] font-extrabold whitespace-nowrap transition truncate cursor-pointer ${
                  statusFilter === tab.id
                    ? "bg-red-600 text-white shadow"
                    : "bg-black/60 border border-white/10 text-slate-400 hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main List Body */}
      <div className="max-h-64 overflow-y-auto py-1 space-y-2.5 pr-0.5 scrollbar-none">
        {loading ? (
          <div className="text-center py-8 space-y-2">
            <div className="mx-auto h-6 w-6 rounded-full border-2 border-t-transparent border-red-400 animate-spin" />
            <p className="text-xs font-bold text-slate-400">
              Syncing bug reports...
            </p>
          </div>
        ) : activeTab === "inbox" ? (
          filteredReports.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-black/55 p-6 text-center space-y-1">
              <p className="text-xs font-bold text-slate-300">
                {reports.length === 0
                  ? "No active bug reports. Inbox clean! 🎉"
                  : "No tickets match your current filter."}
              </p>
            </div>
          ) : (
            filteredReports.map((report) => {
              const reporterKey = `${report.name
                .trim()
                .toLowerCase()}:${report.codeSuffix}`;
              const isAlreadyBanned = bannedIdentifierSet.has(reporterKey);
              const userStrikes = strikesMap[reporterKey] || 0;
              const isBusy = busyActionId === report.id;
              const isReplying = replyingToReportId === report.id;

              return (
                <div
                  key={report.id}
                  className={`rounded-2xl border bg-black/80 p-3 space-y-2.5 text-xs transition-all ${
                    isAlreadyBanned
                      ? "border-red-500/60 bg-red-950/25"
                      : "border-red-500/25 hover:border-red-400/50"
                  }`}
                >
                  {/* Ticket Header */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center flex-wrap gap-1.5 min-w-0">
                      <span className="font-extrabold text-amber-300 truncate">
                        👤 {report.name}
                      </span>
                      <span className="text-slate-400 font-mono text-[10px] bg-white/5 px-1.5 py-0.5 rounded border border-white/10">
                        ...{report.codeSuffix}
                      </span>
                      {userStrikes > 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-400/40 text-[9px] font-extrabold text-amber-300">
                          ⚠️ {userStrikes}/2
                        </span>
                      )}
                      {isAlreadyBanned && (
                        <span className="px-1.5 py-0.5 rounded bg-red-600/30 border border-red-400/50 text-[9px] font-extrabold text-red-200 uppercase">
                          🚫 Banned
                        </span>
                      )}
                    </div>
                    <span className="text-[9px] text-slate-400 shrink-0">
                      {new Date(report.timestamp).toLocaleDateString([], {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>

                  {/* Ticket Message */}
                  <p className="text-xs text-white font-semibold bg-slate-950/90 p-2.5 rounded-xl border border-white/10 leading-relaxed break-words">
                    &ldquo;{report.message}&rdquo;
                  </p>

                  {/* Ticket Controls Row */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5 text-[11px]">
                    <select
                      value={report.status}
                      disabled={isBusy}
                      onChange={(e) =>
                        void handleStatusChange(
                          report.id,
                          e.target.value as
                            | "pending"
                            | "in_progress"
                            | "completed"
                        )
                      }
                      className="rounded-lg bg-slate-900 border border-white/15 px-2 py-1 text-[10px] font-bold text-white focus:outline-none cursor-pointer"
                    >
                      <option value="pending">⏳ Pending</option>
                      <option value="in_progress">🔧 In Progress</option>
                      <option value="completed">✓ Completed</option>
                    </select>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setReplyingToReportId(isReplying ? null : report.id);
                          setReplyMessage("");
                        }}
                        className={`rounded-lg px-2 py-1 text-[10px] font-extrabold border transition cursor-pointer ${
                          isReplying
                            ? "bg-amber-500 text-slate-950 border-amber-300"
                            : "bg-black/70 hover:bg-amber-950/70 text-amber-300 border-amber-500/35"
                        }`}
                        title="Send a direct toast reply to this user"
                      >
                        📢 Reply
                      </button>

                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() =>
                          setConfirmTarget({
                            type: "delete",
                            id: report.id,
                            name: report.name,
                          })
                        }
                        className="rounded-lg bg-black/70 hover:bg-red-950 px-2 py-1 text-[10px] font-bold text-red-300 border border-red-500/30 transition cursor-pointer"
                        title="Delete report"
                      >
                        🗑️
                      </button>

                      {!isAlreadyBanned && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() =>
                            setConfirmTarget({
                              type: "ban",
                              id: report.id,
                              name: report.name,
                              codeSuffix: report.codeSuffix,
                            })
                          }
                          className="rounded-lg bg-red-600/80 hover:bg-red-600 px-2 py-1 text-[10px] font-extrabold text-white transition cursor-pointer"
                        >
                          🚫 Ban
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Direct Toast Reply Drawer */}
                  {isReplying && (
                    <div className="pt-2 border-t border-white/10 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-extrabold text-amber-300 truncate">
                          📢 Reply to {report.name}:
                        </span>
                        <label className="inline-flex items-center gap-1 text-[10px] text-slate-300 shrink-0 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={replyAutoComplete}
                            onChange={(e) =>
                              setReplyAutoComplete(e.target.checked)
                            }
                            className="rounded border-white/20 bg-black text-emerald-500"
                          />
                          <span>Mark Fixed</span>
                        </label>
                      </div>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={replyMessage}
                          onChange={(e) => setReplyMessage(e.target.value)}
                          placeholder="Type reply message..."
                          className="flex-1 min-w-0 rounded-xl border border-amber-400/40 bg-black/85 px-2.5 py-1.5 text-xs font-bold text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-400"
                        />
                        <button
                          type="button"
                          disabled={isBusy || !replyMessage.trim()}
                          onClick={() => void handleSendDirectToastReply(report)}
                          className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-slate-950 text-[10px] font-black uppercase tracking-wider shadow disabled:opacity-40 shrink-0 cursor-pointer"
                        >
                          Send
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )
        ) : (
          /* BANNED USERS TAB */
          <div className="space-y-3">
            <form
              onSubmit={handleManualBanSubmit}
              className="rounded-2xl border border-red-500/30 bg-black/75 p-3 space-y-2"
            >
              <span className="block text-[10px] font-extrabold uppercase tracking-wider text-red-300">
                ➕ Manual Ban (Name & PIN)
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                <input
                  type="text"
                  value={manualBanName}
                  onChange={(e) => setManualBanName(e.target.value)}
                  placeholder="User Name"
                  className="col-span-2 rounded-xl border border-red-500/30 bg-slate-950 px-2.5 py-1.5 text-xs font-bold text-white placeholder-slate-500 focus:outline-none"
                />
                <input
                  type="text"
                  maxLength={6}
                  value={manualBanSuffix}
                  onChange={(e) =>
                    setManualBanSuffix(
                      e.target.value.replace(/\D/g, "").slice(0, 6)
                    )
                  }
                  placeholder="PIN"
                  className="col-span-1 rounded-xl border border-red-500/30 bg-slate-950 px-2 py-1.5 text-center text-xs font-mono font-bold text-white placeholder-slate-500 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={busyActionId === "manual_ban"}
                className="w-full py-1.5 rounded-xl bg-red-600/85 hover:bg-red-600 text-[11px] font-extrabold text-white shadow transition cursor-pointer"
              >
                🚫 Add User to Ban List
              </button>
            </form>

            {filteredBannedUsers.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-xs font-semibold text-slate-400 italic">
                  No banned users found.
                </p>
              </div>
            ) : (
              filteredBannedUsers.map((banned) => (
                <div
                  key={banned.identifier}
                  className="rounded-2xl border border-red-500/35 bg-red-950/30 p-3 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="space-y-0.5 min-w-0">
                    <p className="font-extrabold text-red-300 text-xs truncate">
                      🚫 {banned.name}{" "}
                      <span className="font-mono text-[10px] text-amber-300">
                        (...{banned.codeSuffix})
                      </span>
                    </p>
                    <p className="text-slate-400 text-[10px]">
                      Banned:{" "}
                      {new Date(banned.timestamp).toLocaleDateString([], {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busyActionId === banned.identifier}
                    onClick={() =>
                      setConfirmTarget({
                        type: "unban",
                        id: banned.identifier,
                        name: banned.name,
                      })
                    }
                    className="rounded-xl bg-emerald-950/80 hover:bg-emerald-600 px-3 py-1.5 text-[10px] font-extrabold text-emerald-300 hover:text-white border border-emerald-500/40 transition shrink-0 cursor-pointer"
                  >
                    ✓ Unban
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}