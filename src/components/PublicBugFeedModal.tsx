// src/components/PublicBugFeedModal.tsx
import React, { useEffect, useState } from "react";
import { fetchBugSystemData, BugReport } from "@/lib/bugReports";

interface PublicBugFeedModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PublicBugFeedModal({ isOpen, onClose }: PublicBugFeedModalProps) {
  const [reports, setReports] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(true);

  const loadReports = async () => {
    setLoading(true);
    const data = await fetchBugSystemData();
    // Sort newest first
    const sorted = data.reports.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    setReports(sorted);
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      loadReports();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md overflow-y-auto">
      <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-slate-900 p-6 text-white shadow-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div>
            <h3 className="text-lg font-bold text-amber-400">Community Bug Tracker</h3>
            <p className="text-xs text-slate-400">Read-only live feed of submitted issues and resolution statuses</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-300 hover:bg-slate-700 transition"
          >
            Close
          </button>
        </div>

        {/* Report Feed */}
        <div className="flex-1 overflow-y-auto py-4 space-y-3 pr-1">
          {loading ? (
            <p className="text-center text-xs text-slate-400 py-10 animate-pulse">Loading reported issues...</p>
          ) : reports.length === 0 ? (
            <div className="text-center py-12 space-y-1">
              <p className="text-sm font-semibold text-slate-300">No bugs reported yet.</p>
              <p className="text-xs text-slate-500">All systems are currently running smoothly!</p>
            </div>
          ) : (
            reports.map((report) => (
              <div
                key={report.id}
                className="rounded-xl border border-white/10 bg-slate-800/60 p-4 space-y-2.5"
              >
                <div className="flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-200">{report.name}</span>
                    <span className="ml-2 text-slate-500 font-mono text-[11px]">
                      (...{report.codeSuffix})
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {new Date(report.timestamp).toLocaleDateString()}
                  </span>
                </div>

                <p className="text-xs text-slate-100 font-medium bg-black/30 p-2.5 rounded-lg border border-white/5 leading-relaxed">
                  &ldquo;{report.message}&rdquo;
                </p>

                <div className="flex items-center justify-between pt-1 text-xs">
                  <span className="text-[11px] text-slate-400">Status:</span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      report.status === "pending"
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                        : report.status === "in_progress"
                        ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                        : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    }`}
                  >
                    {report.status === "pending"
                      ? "Pending Review"
                      : report.status === "in_progress"
                      ? "Read & in Progress"
                      : "Attempted and/or Completed"}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
