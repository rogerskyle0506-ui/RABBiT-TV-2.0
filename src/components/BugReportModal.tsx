// src/components/BugReportModal.tsx
import React, { useState, useEffect, useRef, useMemo } from "react";
import { submitBugReport, isUserBanned } from "@/lib/bugReports";
import { AppTheme, getSavedTheme } from "@/lib/settings";

interface BugReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  userName: string;
  userUnlockCode: string;
}

const MAX_MESSAGE_LENGTH = 50;
const COOLDOWN_MS = 60 * 1000; // 60-second anti-spam cooldown between reports
const LAST_REPORT_TS_KEY = "rabtv_last_bug_report_ts";

const RABBIT_HEADER_PILL =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/main/assets/rabbit-header-pill.jpg";
const RABBIT_PANEL =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/main/assets/rabbit-panel.jpg";
const RABBIT_DIVIDER =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/main/assets/rabbit-divider.jpg";

// TV-remote friendly presets (safe from media-request strike keywords)
const QUICK_ISSUE_PRESETS = [
  { label: "🎬 Player Froze", text: "Player froze during playback" },
  { label: "🔊 Audio Glitch", text: "Audio cut out or out of sync" },
  { label: "📡 Live TV Lag", text: "Live TV feed buffering/lagging" },
  { label: "🖥️ UI / Menu Bug", text: "Menu or UI layout issue" },
  { label: "💥 App Crash", text: "App crashed or restarted" },
] as const;

const FORBIDDEN_SUGGESTION_KEYWORDS = [
  "movie",
  "show",
  "season",
  "episode",
  "add ",
  "watch ",
  "series",
];

function sanitizeBugText(raw: string): string {
  return raw
    .replace(/[<>]/g, "") // Strip HTML angle brackets
    .replace(/[\u0000-\u001F\u007F]/g, " ") // Strip control characters
    .replace(/\s+/g, " ");
}

export function BugReportModal({
  isOpen,
  onClose,
  userName,
  userUnlockCode,
}: BugReportModalProps) {
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(false);
  const [isBanned, setIsBanned] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [appTheme, setAppTheme] = useState<AppTheme>("violet");
  const [feedback, setFeedback] = useState<{
    text: string;
    isError: boolean;
  } | null>(null);

  const closeTimerRef = useRef<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync active theme when modal opens
  useEffect(() => {
    if (!isOpen) return;
    setAppTheme(getSavedTheme());
  }, [isOpen]);

  // Clean up pending auto-close timer on unmount or close
  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  // Pre-check ban status and active cooldown when modal opens
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    setFeedback(null);

    const checkCooldown = () => {
      if (typeof window === "undefined") return 0;
      const lastTs = Number(localStorage.getItem(LAST_REPORT_TS_KEY) || 0);
      const remaining = Math.max(
        0,
        Math.ceil((lastTs + COOLDOWN_MS - Date.now()) / 1000)
      );
      setCooldownSeconds(remaining);
      return remaining;
    };

    checkCooldown();
    const cooldownInterval = window.setInterval(() => {
      const rem = checkCooldown();
      if (rem <= 0) {
        window.clearInterval(cooldownInterval);
      }
    }, 1000);

    const verifyBanStatus = async () => {
      setCheckingAccess(true);
      try {
        const cleanName = userName?.trim() || "Anonymous";
        const codeSuffix = String(userUnlockCode || "0000").slice(-4);
        const banned = await isUserBanned(cleanName, codeSuffix);
        if (!cancelled) {
          setIsBanned(banned);
        }
      } catch {
        if (!cancelled) setIsBanned(false);
      } finally {
        if (!cancelled) setCheckingAccess(false);
      }
    };

    void verifyBanStatus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      cancelled = true;
      window.clearInterval(cooldownInterval);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, userName, userUnlockCode, onClose]);

  const themeTokens = useMemo(() => {
    switch (appTheme) {
      case "red":
        return {
          borderGlow:
            "border-red-500/40 shadow-[0_25px_70px_rgba(0,0,0,0.95),0_0_35px_rgba(239,68,68,0.3)]",
          primaryBtn:
            "bg-gradient-to-r from-red-600 via-rose-600 to-orange-600 text-white shadow-lg shadow-red-600/35",
          accentText: "text-red-300",
          ring: "focus:ring-red-400",
          laser: "from-transparent via-red-500 to-amber-400",
        };
      case "midnight":
        return {
          borderGlow:
            "border-sky-500/40 shadow-[0_25px_70px_rgba(0,0,0,0.95),0_0_35px_rgba(56,189,248,0.3)]",
          primaryBtn:
            "bg-gradient-to-r from-blue-600 via-cyan-600 to-sky-500 text-white shadow-lg shadow-blue-600/35",
          accentText: "text-sky-300",
          ring: "focus:ring-sky-400",
          laser: "from-transparent via-sky-400 to-blue-500",
        };
      case "emerald":
        return {
          borderGlow:
            "border-emerald-500/40 shadow-[0_25px_70px_rgba(0,0,0,0.95),0_0_35px_rgba(16,185,129,0.3)]",
          primaryBtn:
            "bg-gradient-to-r from-emerald-600 via-teal-600 to-green-500 text-white shadow-lg shadow-emerald-600/35",
          accentText: "text-emerald-300",
          ring: "focus:ring-emerald-400",
          laser: "from-transparent via-emerald-400 to-cyan-400",
        };
      case "amber":
        return {
          borderGlow:
            "border-amber-500/40 shadow-[0_25px_70px_rgba(0,0,0,0.95),0_0_35px_rgba(245,158,11,0.3)]",
          primaryBtn:
            "bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500 text-slate-950 shadow-lg shadow-amber-500/35",
          accentText: "text-amber-300",
          ring: "focus:ring-amber-400",
          laser: "from-transparent via-amber-400 to-orange-500",
        };
      case "cyan":
        return {
          borderGlow:
            "border-cyan-500/40 shadow-[0_25px_70px_rgba(0,0,0,0.95),0_0_35px_rgba(34,211,238,0.3)]",
          primaryBtn:
            "bg-gradient-to-r from-cyan-500 via-teal-500 to-blue-600 text-white shadow-lg shadow-cyan-500/35",
          accentText: "text-cyan-300",
          ring: "focus:ring-cyan-400",
          laser: "from-transparent via-cyan-400 to-sky-500",
        };
      case "violet":
      default:
        return {
          borderGlow:
            "border-purple-500/40 shadow-[0_25px_70px_rgba(0,0,0,0.95),0_0_35px_rgba(168,85,247,0.3)]",
          primaryBtn:
            "bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 text-white shadow-lg shadow-violet-600/35",
          accentText: "text-violet-300",
          ring: "focus:ring-violet-400",
          laser: "from-transparent via-pink-500 to-cyan-400",
        };
    }
  }, [appTheme]);

  // Real-time strike keyword warning before user hits submit
  const liveKeywordWarning = useMemo(() => {
    const lower = message.toLowerCase();
    return FORBIDDEN_SUGGESTION_KEYWORDS.some((kw) => lower.includes(kw));
  }, [message]);

  if (!isOpen) return null;

  const charPercent = Math.min(
    100,
    Math.round((message.length / MAX_MESSAGE_LENGTH) * 100)
  );
  const codeSuffixDisplay = String(userUnlockCode || "0000").slice(-4);

  const handlePresetClick = (presetText: string) => {
    setMessage(presetText.slice(0, MAX_MESSAGE_LENGTH));
    setFeedback(null);
    textareaRef.current?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || isBanned || cooldownSeconds > 0) return;

    const cleaned = sanitizeBugText(message).trim();
    if (cleaned.length < 4) {
      setFeedback({
        text: "⚠️ Please enter at least 4 characters describing the bug.",
        isError: true,
      });
      return;
    }

    if (cleaned.length > MAX_MESSAGE_LENGTH) {
      setFeedback({
        text: `⚠️ Message must be ${MAX_MESSAGE_LENGTH} characters or less.`,
        isError: true,
      });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      const result = await submitBugReport(userName, userUnlockCode, cleaned);

      if (result.success) {
        if (typeof window !== "undefined") {
          localStorage.setItem(LAST_REPORT_TS_KEY, String(Date.now()));
        }
        setCooldownSeconds(Math.ceil(COOLDOWN_MS / 1000));
        setFeedback({
          text: "✅ Bug report sent to Rabbit! Thank you for helping improve the app.",
          isError: false,
        });
        setMessage("");
        closeTimerRef.current = window.setTimeout(() => {
          setFeedback(null);
          onClose();
        }, 2000);
      } else {
        if (result.banned) {
          setIsBanned(true);
        }
        setFeedback({
          text: result.error || "⚠️ Failed to send report. Please try again.",
          isError: true,
        });
      }
    } catch {
      setFeedback({
        text: "⚠️ Network error while sending bug report.",
        isError: true,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rabtv-vidsrc-protected fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-5 backdrop-blur-xl overflow-y-auto">
      <style>{`
        @keyframes modalCrystalIn {
          0% { opacity: 0; transform: scale(0.95) translateY(10px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-modal-crystal-in {
          animation: modalCrystalIn 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* Click-outside backdrop */}
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Crystal Neon Glass Modal Card */}
      <div
        className={`relative z-10 w-full max-w-md rounded-[28px] border bg-slate-950/85 backdrop-blur-2xl text-white overflow-hidden animate-modal-crystal-in ${themeTokens.borderGlow}`}
      >
        {/* Translucent Neon Panel Frame Layer */}
        <div
          className="absolute inset-0 pointer-events-none z-0 opacity-75 mix-blend-lighten"
          style={{
            backgroundImage: `url(${RABBIT_PANEL})`,
            backgroundSize: "100% 100%",
            backgroundRepeat: "no-repeat",
          }}
        />
        <div
          className={`absolute inset-x-8 top-0 h-[2px] bg-gradient-to-r ${themeTokens.laser} opacity-90 z-10`}
        />

        <div className="relative z-10 p-5 sm:p-6 space-y-4">
          {/* Header Bar */}
          <div className="flex items-center justify-between gap-2">
            <div className="relative inline-flex items-center gap-2 px-4 py-1.5 rounded-xl overflow-hidden border border-white/15">
              <div
                className="absolute inset-0 pointer-events-none opacity-80"
                style={{
                  backgroundImage: `url(${RABBIT_HEADER_PILL})`,
                  backgroundSize: "120% 340%",
                  backgroundPosition: "center center",
                }}
              />
              <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" />
              <span className="relative z-10 text-base">🐞</span>
              <h3 className="relative z-10 text-sm sm:text-base font-black tracking-wide text-amber-300 drop-shadow">
                Report a Bug / Issue
              </h3>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-white/10 hover:bg-red-600/80 border border-white/15 hover:border-red-400 px-3 py-1.5 text-xs font-extrabold text-slate-200 hover:text-white transition hover:scale-105 active:scale-95 cursor-pointer focus:outline-none focus:ring-2 focus:ring-red-400"
              aria-label="Close Bug Report Modal"
            >
              ✕
            </button>
          </div>

          {/* Reporter Identity Pill */}
          <div className="flex items-center justify-between rounded-xl bg-black/55 border border-white/10 px-3 py-2 text-[11px]">
            <span className="text-slate-300 font-semibold truncate">
              Reporting as:{" "}
              <strong className={themeTokens.accentText}>
                {userName || "Anonymous"}
              </strong>
            </span>
            <span className="font-mono text-[10px] text-slate-400 bg-white/5 px-2 py-0.5 rounded border border-white/10 shrink-0">
              ID: ...{codeSuffixDisplay}
            </span>
          </div>

          {/* Rules Warning Box */}
          <div className="rounded-xl bg-red-950/35 border border-red-500/30 p-3 text-[11px] text-slate-200 leading-relaxed">
            Describe technical bugs below (max {MAX_MESSAGE_LENGTH} chars).{" "}
            <span className="text-red-300 font-extrabold">
              Movie & TV requests are strictly forbidden (2 strikes = auto-ban).
            </span>
          </div>

          {/* Feedback Alert */}
          {feedback && (
            <div
              className={`rounded-xl p-3 text-xs font-bold text-center border backdrop-blur-md ${
                feedback.isError
                  ? "bg-red-950/75 border-red-500/50 text-red-200"
                  : "bg-emerald-950/75 border-emerald-400/50 text-emerald-300"
              }`}
            >
              {feedback.text}
            </div>
          )}

          {checkingAccess ? (
            <div className="py-8 flex flex-col items-center justify-center gap-2 text-center">
              <div className="h-6 w-6 rounded-full border-2 border-t-transparent border-amber-400 animate-spin" />
              <span className="text-xs font-bold text-slate-300">
                Verifying report access...
              </span>
            </div>
          ) : isBanned ? (
            <div className="rounded-2xl bg-red-950/60 border border-red-500/50 p-4 text-center space-y-2.5">
              <div className="text-2xl">🚫</div>
              <h4 className="text-sm font-black text-red-300 uppercase tracking-wider">
                Reporting Access Revoked
              </h4>
              <p className="text-xs text-slate-200 leading-relaxed">
                Your reporting rights have been disabled due to spam or media
                request strikes. Message Rabbit directly if you believe this was
                a mistake.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="mt-1 w-full rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 py-2.5 text-xs font-extrabold text-white transition cursor-pointer"
              >
                Close Window
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3.5">
              {/* TV Remote / One-Tap Quick Issue Chips */}
              <div className="space-y-1.5">
                <span className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                  Quick-Tap Common Issues (TV Remote Friendly):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_ISSUE_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      disabled={submitting || cooldownSeconds > 0}
                      onClick={() => handlePresetClick(preset.text)}
                      className="rounded-xl bg-black/65 hover:bg-white/15 border border-white/15 hover:border-amber-400/50 px-2.5 py-1.5 text-[10px] font-bold text-slate-200 hover:text-white transition-all hover:scale-105 active:scale-95 disabled:opacity-40 cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-400"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Message Input & Character Progress Bar */}
              <div className="space-y-1.5">
                <textarea
                  ref={textareaRef}
                  rows={2}
                  maxLength={MAX_MESSAGE_LENGTH}
                  disabled={submitting || cooldownSeconds > 0}
                  value={message}
                  onChange={(e) => {
                    setMessage(
                      sanitizeBugText(e.target.value).slice(
                        0,
                        MAX_MESSAGE_LENGTH
                      )
                    );
                    if (feedback) setFeedback(null);
                  }}
                  placeholder="Describe technical bug (No movie/TV requests)..."
                  className={`w-full rounded-2xl border border-white/15 bg-black/75 p-3 text-sm font-semibold text-white placeholder-slate-500 focus:outline-none focus:ring-2 ${themeTokens.ring} resize-none disabled:opacity-50 transition`}
                />

                {/* Progress Bar & Counter */}
                <div className="space-y-1">
                  <div className="h-1 w-full rounded-full bg-white/10 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-200 ${
                        charPercent >= 95
                          ? "bg-red-500"
                          : charPercent >= 75
                            ? "bg-amber-400"
                            : "bg-cyan-400"
                      }`}
                      style={{ width: `${charPercent}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-bold">
                    <span className="text-slate-400">
                      {cooldownSeconds > 0
                        ? `⏳ Next report ready in ${cooldownSeconds}s`
                        : "Short technical note only"}
                    </span>
                    <span
                      className={
                        charPercent >= 95 ? "text-red-400" : "text-slate-300"
                      }
                    >
                      {message.length}/{MAX_MESSAGE_LENGTH} chars
                    </span>
                  </div>
                </div>

                {/* Live Pre-Submit Strike Filter Guardrail */}
                {liveKeywordWarning && (
                  <div className="rounded-xl bg-amber-950/65 border border-amber-400/50 px-3 py-2 text-[11px] font-bold text-amber-200">
                    ⚠️ Heads up: Words like &ldquo;movie&rdquo;,
                    &ldquo;show&rdquo;, or &ldquo;add&rdquo; trigger the
                    anti-request strike filter. Rephrase as a technical bug (e.g.
                    &ldquo;player froze&rdquo;).
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl bg-black/65 hover:bg-white/15 border border-white/15 py-2.5 text-xs font-extrabold text-slate-200 hover:text-white transition hover:scale-[1.02] active:scale-95 cursor-pointer focus:outline-none focus:ring-2 focus:ring-white/40"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    submitting ||
                    cooldownSeconds > 0 ||
                    message.trim().length < 4
                  }
                  className={`rounded-xl py-2.5 text-xs font-black tracking-wide transition hover:scale-[1.02] active:scale-95 disabled:opacity-45 cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-400 ${themeTokens.primaryBtn}`}
                >
                  {submitting
                    ? "⚡ Sending..."
                    : cooldownSeconds > 0
                      ? `Wait ${cooldownSeconds}s`
                      : "🚀 Submit Report"}
                </button>
              </div>
            </form>
          )}

          {/* Neon Divider Footer */}
          <div className="pt-1 text-center">
            <img
              src={RABBIT_DIVIDER}
              alt=""
              className="w-1/2 mx-auto h-1.5 object-contain opacity-75"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
