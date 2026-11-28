// src/components/BugReportModal.tsx
import React, { useState, useEffect, useRef, useMemo } from "react";
import { submitBugReport, isUserBanned } from "@/lib/bugReports";
import { AppTheme, getSavedTheme, getHardwareLimits } from "@/lib/settings";

interface BugReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  userName: string;
  userUnlockCode: string;
}

const MAX_MESSAGE_LENGTH = 50;
const COOLDOWN_MS = 60 * 1000; // 60-second anti-spam cooldown between reports
const LAST_REPORT_TS_KEY = "rabtv_last_bug_report_ts";

// TV-remote friendly presets (safe from media-request strike keywords)
const IMG_BUG_MODAL_FRAME =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-referral-modal-frame.jpg";
const IMG_BUG_BANNER =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-bugs-banner.jpg";
const IMG_BUG_CARD =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-referral-section-card.jpg";
const IMG_BUG_BTN_PRIMARY =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-referral-btn-primary.jpg";
const IMG_BUG_BTN_IDLE =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-referral-tab-idle.jpg";

const BUG_MODAL_STYLES = `
  :root, html[data-theme="violet"] { --rabtv-bug-filter: hue-rotate(-78deg) saturate(1.12) brightness(1.02); }
  html[data-theme="red"] { --rabtv-bug-filter: hue-rotate(0deg) saturate(1.08) brightness(1.0); }
  html[data-theme="midnight"] { --rabtv-bug-filter: hue-rotate(-132deg) saturate(1.14) brightness(1.04); }
  html[data-theme="emerald"] { --rabtv-bug-filter: hue-rotate(154deg) saturate(1.10) brightness(1.02); }
  html[data-theme="amber"] { --rabtv-bug-filter: hue-rotate(28deg) saturate(1.14) brightness(1.04); }
  html[data-theme="cyan"] { --rabtv-bug-filter: hue-rotate(-154deg) saturate(1.12) brightness(1.04); }

  .rabtv-bug-shell {
    position: relative;
    overflow: hidden;
    box-sizing: border-box;
    padding: clamp(22px, 5.2%, 32px) clamp(22px, 6.4%, 34px) !important;
    background-color: #0c0a09;
  }
  .rabtv-bug-shell-9slice {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-image: url("${IMG_BUG_MODAL_FRAME}");
    background-size: 100% 100%;
    background-position: center center;
    background-repeat: no-repeat;
    filter: var(--rabtv-bug-filter);
    pointer-events: none;
    z-index: 0;
  }
  .rabtv-bug-card {
    position: relative;
    overflow: hidden;
    box-sizing: border-box;
    padding: 14px 18px !important;
    background-color: #0c0a09;
  }
  .rabtv-bug-card-9slice {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-image: url("${IMG_BUG_CARD}");
    background-size: 100% 100%;
    background-position: center center;
    background-repeat: no-repeat;
    filter: var(--rabtv-bug-filter);
    pointer-events: none;
    z-index: 0;
  }
  @media (max-height: 540px) {
    .rabtv-bug-shell {
      padding: 16px 24px !important;
    }
    .rabtv-bug-hero {
      min-height: 76px !important;
      padding: 10px 12px !important;
    }
  }
  .rabtv-bug-btn {
    position: relative;
    overflow: hidden;
    background-color: #0c0a09;
    border: 0 !important;
    clip-path: polygon(8px 0%, calc(100% - 8px) 0%, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0% calc(100% - 8px), 0% 8px);
    contain: layout paint;
    transition: transform 140ms ease, filter 140ms ease;
  }
  .rabtv-bug-btn:hover:not(:disabled) { transform: scale(1.02); filter: brightness(1.09); }
  .rabtv-bug-btn:active:not(:disabled) { transform: scale(0.97); }
  .rabtv-bug-btn-art {
    position: absolute;
    inset: -2px;
    background-size: 100% 100%;
    filter: var(--rabtv-bug-filter);
    pointer-events: none;
    z-index: 0;
  }
  .rabtv-bug-btn-scrim {
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse 78% 72% at 50% 50%, rgba(12,10,9,0.38) 0%, rgba(12,10,9,0.14) 100%);
    pointer-events: none;
    z-index: 1;
  }
  .rabtv-bug-btn-label {
    position: relative;
    z-index: 2;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    text-shadow: 0 1px 4px rgba(12,10,9,0.96);
  }
`;

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
    <div data-theme={appTheme}
      className={`rabtv-vidsrc-protected fixed inset-0 z-50 flex items-center justify-center bg-black/84 p-2.5 sm:p-5 ${getHardwareLimits().effectiveMode === "low" ? "" : "backdrop-blur-xl"} overflow-y-auto`}>
      <style>{BUG_MODAL_STYLES}</style>
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      <div className="rabtv-bug-shell relative z-10 w-full max-w-md rounded-[26px] text-white max-h-[92dvh] flex flex-col shadow-2xl">
        <div className="rabtv-bug-shell-9slice" aria-hidden="true" />

        <div className="relative z-10 flex flex-col max-h-full overflow-y-auto scrollbar-none space-y-3.5">
          {/* Tech Repair Workbench Mascot Header Banner */}
          <div className="rabtv-bug-hero relative overflow-hidden rounded-2xl border border-white/10 min-h-[132px] p-3.5 flex flex-col justify-between bg-[#0c0a09] shrink-0">
            <div
              className="absolute inset-0 bg-cover bg-center opacity-92 pointer-events-none"
              style={{ backgroundImage: `url(${IMG_BUG_BANNER})` }}
              aria-hidden="true"
            />
            <div
              className="absolute inset-0 bg-gradient-to-b from-[#0c0a09]/86 via-[#0c0a09]/26 to-[#0c0a09]/92 pointer-events-none"
              aria-hidden="true"
            />

            <div className="relative z-10 flex items-center justify-between gap-2">
              <span className="rounded-full bg-black/80 border border-white/15 px-2.5 py-1 text-[9.5px] font-black uppercase tracking-widest text-amber-300">
                🐞 Repair Bench
              </span>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close Bug Report Modal"
                className="rabtv-bug-btn px-3 py-1.5 text-[11px] font-extrabold text-white cursor-pointer"
              >
                <span className="rabtv-bug-btn-art" style={{ backgroundImage: `url(${IMG_BUG_BTN_IDLE})` }} />
                <span className="rabtv-bug-btn-scrim" />
                <span className="rabtv-bug-btn-label">✕</span>
              </button>
            </div>

            <div className="relative z-10 pt-8">
              <h3 className="text-lg font-black uppercase tracking-tight text-amber-300 drop-shadow-[0_2px_8px_rgba(0,0,0,0.98)]">
                Report a Bug / Issue
              </h3>
              <p className="text-[10.5px] font-bold text-zinc-200 drop-shadow">
                Reporting as <strong className="text-cyan-300">{userName || "Anonymous"}</strong> • ID ...{codeSuffixDisplay}
              </p>
            </div>
          </div>

          {/* Rules Warning Box */}
          <div className="rounded-xl bg-red-950/55 border border-red-500/40 p-3 text-[11px] text-zinc-200 leading-relaxed">
            Describe technical bugs below (max {MAX_MESSAGE_LENGTH} chars).{" "}
            <span className="text-red-300 font-extrabold">
              Movie &amp; TV requests are strictly forbidden (2 strikes = auto-ban).
            </span>
          </div>

          {/* Feedback Alert */}
          {feedback && (
            <div
              className={`rounded-xl p-3 text-xs font-bold text-center border ${
                feedback.isError
                  ? "bg-red-950/85 border-red-500/55 text-red-200"
                  : "bg-emerald-950/85 border-emerald-400/55 text-emerald-300"
              }`}
            >
              {feedback.text}
            </div>
          )}

          {checkingAccess ? (
            <div className="py-8 flex flex-col items-center justify-center gap-2 text-center">
              <div className="h-6 w-6 rounded-full border-2 border-t-transparent border-amber-400 animate-spin" />
              <span className="text-xs font-bold text-zinc-300">
                Verifying report access...
              </span>
            </div>
          ) : isBanned ? (
            <div className="rounded-2xl bg-red-950/70 border border-red-500/55 p-4 text-center space-y-2.5">
              <div className="text-2xl">🚫</div>
              <h4 className="text-sm font-black text-red-300 uppercase tracking-wider">
                Reporting Access Revoked
              </h4>
              <p className="text-xs text-zinc-200 leading-relaxed">
                Your reporting rights have been disabled due to spam or media
                request strikes. Message Rabbit directly if you believe this was
                a mistake.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="rabtv-bug-btn w-full py-2.5 text-xs font-extrabold text-white cursor-pointer"
              >
                <span className="rabtv-bug-btn-art" style={{ backgroundImage: `url(${IMG_BUG_BTN_IDLE})` }} />
                <span className="rabtv-bug-btn-scrim" />
                <span className="rabtv-bug-btn-label">Close Window</span>
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              {/* Quick Issue Chips */}
              <div className="space-y-1.5">
                <span className="block text-[10px] font-extrabold uppercase tracking-widest text-zinc-400">
                  Quick-Tap Common Issues:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_ISSUE_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      disabled={submitting || cooldownSeconds > 0}
                      onClick={() => handlePresetClick(preset.text)}
                      className="rabtv-bug-btn px-2.5 py-1.5 text-[10px] font-bold text-white disabled:opacity-40 cursor-pointer"
                    >
                      <span className="rabtv-bug-btn-art" style={{ backgroundImage: `url(${IMG_BUG_BTN_IDLE})` }} />
                      <span className="rabtv-bug-btn-scrim" />
                      <span className="rabtv-bug-btn-label">{preset.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Message Input Card */}
              <div className="rabtv-bug-card rounded-2xl">
                <div className="rabtv-bug-card-9slice" aria-hidden="true" />
                <div className="relative z-10 space-y-2">
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
                    className="w-full bg-transparent text-sm font-semibold text-white placeholder-zinc-400 focus:outline-none resize-none disabled:opacity-50"
                  />

                  <div className="space-y-1">
                    <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
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
                    <div className="flex items-center justify-between text-[10.5px] font-bold">
                      <span className="text-zinc-400">
                        {cooldownSeconds > 0
                          ? `⏳ Next report ready in ${cooldownSeconds}s`
                          : "Short technical note only"}
                      </span>
                      <span
                        className={
                          charPercent >= 95 ? "text-red-400" : "text-zinc-300"
                        }
                      >
                        {message.length}/{MAX_MESSAGE_LENGTH}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {liveKeywordWarning && (
                <div className="rounded-xl bg-amber-950/75 border border-amber-400/50 px-3 py-2 text-[11px] font-bold text-amber-200">
                  ⚠️ Heads up: Words like &ldquo;movie&rdquo;, &ldquo;show&rdquo;, or &ldquo;add&rdquo; trigger the anti-request strike filter. Rephrase as a technical bug.
                </div>
              )}

              {/* Armored Action Buttons */}
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="rabtv-bug-btn py-2.5 px-4 text-[11px] sm:text-xs font-extrabold text-white whitespace-nowrap cursor-pointer"
                >
                  <span className="rabtv-bug-btn-art" style={{ backgroundImage: `url(${IMG_BUG_BTN_IDLE})` }} />
                  <span className="rabtv-bug-btn-scrim" />
                  <span className="rabtv-bug-btn-label">Cancel</span>
                </button>
                <button
                  type="submit"
                  disabled={
                    submitting ||
                    cooldownSeconds > 0 ||
                    message.trim().length < 4
                  }
                  className="rabtv-bug-btn py-2.5 px-5 text-[10.5px] sm:text-xs font-black uppercase tracking-normal text-white whitespace-nowrap disabled:opacity-45 cursor-pointer"
                >
                  <span className="rabtv-bug-btn-art" style={{ backgroundImage: `url(${IMG_BUG_BTN_PRIMARY})` }} />
                  <span className="rabtv-bug-btn-scrim" />
                  <span className="rabtv-bug-btn-label">
                    {submitting
                      ? "⚡ Sending..."
                      : cooldownSeconds > 0
                        ? `Wait ${cooldownSeconds}s`
                        : "🚀 Submit"}
                  </span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}