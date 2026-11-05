// src/components/AdminBugInbox.tsx
import React, { useEffect, useState } from "react";
import {
  fetchBugSystemData,
  updateBugReportStatus,
  banUserFromReport,
  BugReport,
  BannedUser
} from "@/lib/bugReports";

interface AdminBugInboxProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function AdminBugInbox({ isOpen = true, onClose }: AdminBugInboxProps) {
  const [reports, setReports] = useState<BugReport[]>([]);
  const [bannedUsers, setBannedUsers] = useState<BannedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"inbox" | "banned">("inbox");

  const loadData = async () => {
    setLoading(true);
    const data = await fetchBugSystemData();
    setReports(data.reports);
    setBannedUsers(data.bannedUsers);
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleStatusChange = async (id: string, status: "pending" | "in_progress" | "completed") => {
    const success = await updateBugReportStatus(id, status);
    if (success) loadData();
  };

  const handleBan = async (name: string, codeSuffix: string) => {
    if (window.confirm(`Are you sure you want to ban user "${name}" (...${codeSuffix}) from reporting bugs?`)) {
      const success = await banUserFromReport(name, codeSuffix);
      if (success) loadData();
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between pb-2 border-b border-white/10">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-red-300">
            🐞 Bug Reports Inbox ({reports.length})
          </h4>
          <p className="text-[10px] text-slate-400">Manage bug reports, statuses, and user bans</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadData}
            className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-[10px] font-bold text-white transition"
          >
            {loading ? "Loading..." : "🔄 Refresh"}
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-slate-800 px-2 py-1 text-[10px] font-bold text-slate-300 hover:bg-slate-700 transition"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* Tab Controls */}
      <div className="flex space-x-2 pt-1">
        <button
          type="button"
          onClick={() => setActiveTab("inbox")}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
            activeTab === "inbox"
              ? "bg-red-600 text-white shadow-lg"
              : "bg-slate-800 text-slate-300 hover:bg-slate-700"
          }`}
        >
          Bug Inbox ({reports.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("banned")}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
            activeTab === "banned"
              ? "bg-red-600 text-white shadow-lg"
              : "bg-slate-800 text-slate-300 hover:bg-slate-700"
          }`}
        >
          Banned Users ({bannedUsers.length})
        </button>
      </div>

      <div className="max-h-56 overflow-y-auto py-2 space-y-2 pr-1">
        {loading ? (
          <p className="text-center text-xs text-slate-400 py-6">Loading inbox data...</p>
        ) : activeTab === "inbox" ? (
          reports.length === 0 ? (
            <div className="text-center py-8 space-y-1">
              <p className="text-xs font-semibold text-slate-300 italic">No active bug reports. Inbox clean! 🎉</p>
            </div>
          ) : (
            reports.map((report) => (
              <div
                key={report.id}
                className="rounded-xl border border-white/10 bg-black/50 p-3 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-amber-300">{report.name}</span>
                    <span className="ml-2 text-slate-400 font-mono text-[10px]">
                      (...{report.codeSuffix})
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {new Date(report.timestamp).toLocaleString()}
                  </span>
                </div>

                <p className="text-xs text-white font-medium bg-slate-900/80 p-2.5 rounded-lg border border-white/5 leading-relaxed">
                  &ldquo;{report.message}&rdquo;
                </p>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px]">
                  <div className="flex items-center space-x-1.5">
                    <span className="text-slate-400">Status:</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                        report.status === "pending"
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          : report.status === "in_progress"
                          ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                          : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      }`}
                    >
                      {report.status === "pending"
                        ? "Pending"
                        : report.status === "in_progress"
                        ? "In Progress"
                        : "Completed"}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <select
                      value={report.status}
                      onChange={(e) =>
                        handleStatusChange(report.id, e.target.value as any)
                      }
                      className="rounded-lg bg-slate-900 border border-white/10 px-2 py-1 text-[10px] font-semibold text-white focus:outline-none"
                    >
                      <option value="pending">Pending</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => handleBan(report.name, report.codeSuffix)}
                      className="rounded-lg bg-red-600/80 hover:bg-red-600 px-2.5 py-1 text-[10px] font-bold text-white transition"
                    >
                      Ban User
                    </button>
                  </div>
                </div>
              </div>
            ))
          )
        ) : (
          bannedUsers.length === 0 ? (
            <div className="text-center py-8 space-y-1">
              <p className="text-xs font-semibold text-slate-300 italic">No banned users.</p>
            </div>
          ) : (
            bannedUsers.map((banned) => (
              <div
                key={banned.identifier}
                className="rounded-xl border border-red-500/30 bg-red-950/20 p-3 flex items-center justify-between text-xs"
              >
                <div className="space-y-0.5">
                  <p className="font-bold text-red-400 text-xs">
                    {banned.name} <span className="font-mono text-[10px]">(...{banned.codeSuffix})</span>
                  </p>
                  <p className="text-slate-400 text-[10px]">
                    Banned on: {new Date(banned.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
            ))
          )
        )}
      </div>
    </div>
  );
}
