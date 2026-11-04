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
  isOpen: boolean;
  onClose: () => void;
}

export function AdminBugInbox({ isOpen, onClose }: AdminBugInboxProps) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md overflow-y-auto">
      <div className="w-full max-w-3xl rounded-2xl border border-white/10 bg-slate-900 p-6 text-white shadow-2xl max-h-[88vh] flex flex-col">
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div>
            <h3 className="text-lg font-bold text-amber-400">Admin Bug & Moderation Inbox</h3>
            <p className="text-xs text-slate-400">Manage bug reports, statuses, and user bans</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-300 hover:bg-slate-700 transition"
          >
            Close
          </button>
        </div>

        {/* Tab Controls */}
        <div className="flex space-x-2 pt-4">
          <button
            type="button"
            onClick={() => setActiveTab("inbox")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === "inbox"
                ? "bg-amber-600 text-white shadow-lg"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            Bug Inbox ({reports.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("banned")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === "banned"
                ? "bg-red-600 text-white shadow-lg"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            Banned Users ({bannedUsers.length})
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-4 space-y-3">
          {loading ? (
            <p className="text-center text-xs text-slate-400 py-8">Loading inbox data...</p>
          ) : activeTab === "inbox" ? (
            reports.length === 0 ? (
              <div className="text-center py-12 space-y-1">
                <p className="text-sm font-semibold text-slate-300">No active bug reports.</p>
              </div>
            ) : (
              reports.map((report) => (
                <div
                  key={report.id}
                  className="rounded-xl border border-white/10 bg-slate-800/60 p-4 space-y-3"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-amber-300">{report.name}</span>
                      <span className="ml-2 text-slate-400 font-mono text-[11px]">
                        (...{report.codeSuffix})
                      </span>
                    </div>
                    <span className="text-slate-400">
                      {new Date(report.timestamp).toLocaleString()}
                    </span>
                  </div>

                  <p className="text-sm text-white font-medium bg-black/30 p-3 rounded-lg border border-white/5">
                    &ldquo;{report.message}&rdquo;
                  </p>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                    <div className="flex items-center space-x-2">
                      <span className="text-slate-400">Status:</span>
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
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
                          ? "Read & in Progress"
                          : "Attempted and/or Completed"}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <select
                        value={report.status}
                        onChange={(e) =>
                          handleStatusChange(report.id, e.target.value as any)
                        }
                        className="rounded-lg bg-slate-900 border border-white/10 px-2.5 py-1 text-xs font-semibold text-white focus:outline-none"
                      >
                        <option value="pending">Pending</option>
                        <option value="in_progress">Read & in Progress</option>
                        <option value="completed">Attempted and/or Completed</option>
                      </select>

                      <button
                        type="button"
                        onClick={() => handleBan(report.name, report.codeSuffix)}
                        className="rounded-lg bg-red-600/80 hover:bg-red-600 px-3 py-1 text-[11px] font-bold text-white transition"
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
              <div className="text-center py-12 space-y-1">
                <p className="text-sm font-semibold text-slate-300">No banned users.</p>
              </div>
            ) : (
              bannedUsers.map((banned) => (
                <div
                  key={banned.identifier}
                  className="rounded-xl border border-red-500/30 bg-red-950/20 p-4 flex items-center justify-between text-xs"
                >
                  <div className="space-y-1">
                    <p className="font-bold text-red-400 text-sm">
                      {banned.name} <span className="font-mono text-xs">(...{banned.codeSuffix})</span>
                    </p>
                    <p className="text-slate-400 text-[11px]">
                      Banned on: {new Date(banned.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))
            )
          )}
        </div>
      </div>
    </div>
  );
}
