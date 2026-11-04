// src/components/BugReportModal.tsx
import React, { useState } from "react";
import { submitBugReport } from "@/lib/bugReports";

interface BugReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  userName: string;
  userUnlockCode: string;
}

export function BugReportModal({ isOpen, onClose, userName, userUnlockCode }: BugReportModalProps) {
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; isError: boolean } | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) return;

    if (trimmed.length > 50) {
      setFeedback({ text: "⚠️ Message must be 50 characters or less.", isError: true });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    const result = await submitBugReport(userName, userUnlockCode, trimmed);
    setSubmitting(false);

    if (result.success) {
      setFeedback({ text: "✅ Bug report sent successfully!", isError: false });
      setMessage("");
      setTimeout(() => {
        setFeedback(null);
        onClose();
      }, 2000);
    } else {
      setFeedback({ text: result.error || "⚠️ Failed to send report.", isError: true });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6 text-white shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-amber-400">Report a Bug / Issue</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white text-sm font-bold"
          >
            ✕
          </button>
        </div>

        <p className="text-xs text-slate-300">
          Describe technical issues or bugs below (max 50 chars). <span className="text-red-400 font-semibold">Note: Movie & TV suggestions are strictly forbidden and lead to bans.</span>
        </p>

        {feedback && (
          <div
            className={`rounded-xl p-3 text-xs font-semibold text-center border ${
              feedback.isError
                ? "bg-red-500/20 border-red-500/40 text-red-300"
                : "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
            }`}
          >
            {feedback.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <textarea
              rows={2}
              maxLength={50}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe bug (No movie requests)..."
              className="w-full rounded-xl border border-white/10 bg-slate-800 p-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
            />
            <div className="flex justify-between text-[11px] text-slate-400 mt-1">
              <span>{message.length}/50 chars</span>
            </div>
          </div>

          <div className="flex space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl bg-slate-800 py-2.5 text-xs font-bold text-slate-300 hover:bg-slate-700 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !message.trim()}
              className="flex-1 rounded-xl bg-amber-600 py-2.5 text-xs font-bold text-white hover:bg-amber-500 transition disabled:opacity-50"
            >
              {submitting ? "Sending..." : "Submit Report"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
