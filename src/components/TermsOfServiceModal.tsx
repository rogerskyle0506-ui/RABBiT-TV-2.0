// src/components/TermsOfServiceModal.tsx
import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import type { AppTheme } from "@/lib/settings";

export const TOS_ACCEPTED_KEY = "rabtv_tos_accepted";
export const TOS_ACCEPTED_AT_KEY = "rabtv_tos_accepted_at";
export const TOS_VERSION_KEY = "rabtv_tos_version";
export const TOS_CURRENT_VERSION = "2.8";
export const TOS_OPEN_EVENT = "rabtv_open_tos";

export function hasAcceptedTos(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return (
      localStorage.getItem(TOS_ACCEPTED_KEY) === "true" &&
      localStorage.getItem(TOS_VERSION_KEY) === TOS_CURRENT_VERSION
    );
  } catch {
    return false;
  }
}

export function triggerOpenTosModal(requireAcceptance = false): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(TOS_OPEN_EVENT, { detail: { requireAcceptance } })
  );
}

export interface TermsOfServiceModalProps {
  isOpen: boolean;
  /** When true, user must check the box and click Agree before closing */
  requireAcceptance?: boolean;
  appTheme?: AppTheme;
  onAccept?: () => void;
  onClose?: () => void;
  onOpenExternal?: (url: string, e?: React.MouseEvent) => void;
}

const themeBorderGlow: Record<AppTheme, string> = {
  violet: "border-violet-500/45 shadow-[0_0_45px_rgba(139,92,246,0.35)]",
  red: "border-red-500/45 shadow-[0_0_45px_rgba(239,68,68,0.35)]",
  midnight: "border-blue-500/45 shadow-[0_0_45px_rgba(59,130,246,0.35)]",
  emerald: "border-emerald-500/45 shadow-[0_0_45px_rgba(16,185,129,0.35)]",
  amber: "border-amber-500/45 shadow-[0_0_45px_rgba(245,158,11,0.35)]",
  cyan: "border-cyan-500/45 shadow-[0_0_45px_rgba(6,182,212,0.35)]",
};

const themeButtonGradient: Record<AppTheme, string> = {
  violet:
    "bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 shadow-violet-600/35",
  red: "bg-gradient-to-r from-red-600 via-rose-600 to-orange-600 shadow-red-600/35",
  midnight:
    "bg-gradient-to-r from-blue-600 via-cyan-600 to-sky-600 shadow-blue-600/35",
  emerald:
    "bg-gradient-to-r from-emerald-600 via-teal-600 to-green-600 shadow-emerald-600/35",
  amber:
    "bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 shadow-amber-600/35",
  cyan: "bg-gradient-to-r from-cyan-600 via-teal-600 to-blue-600 shadow-cyan-600/35",
};

export const TermsOfServiceModal: React.FC<TermsOfServiceModalProps> = ({
  isOpen,
  requireAcceptance = false,
  appTheme = "violet",
  onAccept,
  onClose,
  onOpenExternal,
}) => {
  const [agreedChecked, setAgreedChecked] = useState(false);
  const [acceptedDateText, setAcceptedDateText] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || typeof window === "undefined") return;
    setAgreedChecked(false);
    try {
      const iso = localStorage.getItem(TOS_ACCEPTED_AT_KEY);
      if (iso) {
        const dt = new Date(iso);
        if (!Number.isNaN(dt.getTime())) {
          setAcceptedDateText(dt.toLocaleDateString());
        }
      }
    } catch {
      setAcceptedDateText(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || requireAcceptance) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose?.();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, requireAcceptance, onClose]);

  if (!isOpen || typeof document === "undefined") return null;

  const handleConfirmAccept = () => {
    if (requireAcceptance && !agreedChecked) return;
    try {
      localStorage.setItem(TOS_ACCEPTED_KEY, "true");
      localStorage.setItem(TOS_VERSION_KEY, TOS_CURRENT_VERSION);
      localStorage.setItem(TOS_ACCEPTED_AT_KEY, new Date().toISOString());
    } catch {
      // ignore storage errors
    }
    onAccept?.();
  };

  const handleExternalClick = (url: string, e: React.MouseEvent) => {
    if (onOpenExternal) {
      onOpenExternal(url, e);
      return;
    }
    e.preventDefault();
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const modal = (
    <div
      className="fixed inset-0 z-[99990] flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="RABBiT TV Terms of Service"
    >
      <div
        className={`relative w-full max-w-2xl max-h-[88dvh] flex flex-col rounded-3xl border bg-slate-950/95 text-slate-100 overflow-hidden backdrop-blur-2xl ${
          themeBorderGlow[appTheme] || themeBorderGlow.violet
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 sm:px-6 py-4 border-b border-white/15 bg-black/50 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-lg">📜</span>
              <h2 className="text-base sm:text-lg font-black tracking-wide text-white">
                RABBiT TV Terms of Service & Disclaimer
              </h2>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Version {TOS_CURRENT_VERSION}
              {acceptedDateText && !requireAcceptance
                ? ` • Accepted on ${acceptedDateText}`
                : " • Please review before continuing"}
            </p>
          </div>

          {!requireAcceptance && (
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-red-600/80 border border-white/15 text-xs font-bold text-slate-100 transition cursor-pointer shrink-0"
              aria-label="Close Terms of Service"
            >
              ✕ Close
            </button>
          )}
        </div>

        {/* Scrollable Legal Content */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 space-y-4 text-xs sm:text-sm leading-relaxed text-slate-300">
          <section className="rounded-2xl bg-white/[0.04] border border-white/10 p-3.5 space-y-1.5">
            <h3 className="text-xs sm:text-sm font-extrabold text-white">
              1. Authorized Access & Acceptance
            </h3>
            <p>
              By activating, unlocking, or using RABBiT TV (including any 7-day
              trial or permanent unlock code), you agree to these Terms of
              Service. Access codes are issued for authorized personal use only.
              Unauthorized redistribution, resale, or tampering with app access
              gates is prohibited.
            </p>
          </section>

          <section className="rounded-2xl bg-white/[0.04] border border-white/10 p-3.5 space-y-1.5">
            <h3 className="text-xs sm:text-sm font-extrabold text-white">
              2. Third-Party Streams, Links & TMDB Attribution
            </h3>
            <p>
              RABBiT TV acts strictly as a user interface and media discovery
              browser. RABBiT TV does not host, upload, store, or own any movies,
              TV episodes, or live broadcast video files. All third-party streams
              and external websites (including IMDb and TMDB) are controlled by
              their respective providers.
            </p>
            <p className="text-slate-400">
              Movie posters, episode descriptions, cast data, and trailer
              listings are provided by{" "}
              <a
                href="https://www.themoviedb.org"
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) =>
                  handleExternalClick("https://www.themoviedb.org", e)
                }
                className="text-cyan-300 underline hover:text-cyan-200 font-semibold"
              >
                The Movie Database (TMDB)
              </a>
              . This product uses the TMDB API but is not endorsed or certified
              by TMDB.
            </p>
          </section>

          <section className="rounded-2xl bg-white/[0.04] border border-white/10 p-3.5 space-y-1.5">
            <h3 className="text-xs sm:text-sm font-extrabold text-white">
              3. Age Ratings, Kids Safe Mode & Parental PIN
            </h3>
            <p>
              You are responsible for setting an accurate profile age, enabling
              Kids Safe Mode when children use the device, and keeping your 4–6
              digit Parental PIN confidential. Content ratings come from public
              metadata sources and may occasionally vary by region.
            </p>
          </section>

          <section className="rounded-2xl bg-white/[0.04] border border-white/10 p-3.5 space-y-1.5">
            <h3 className="text-xs sm:text-sm font-extrabold text-white">
              4. Privacy, Local Storage & JSON Backups
            </h3>
            <p>
              Your profile name, themes, accessibility settings, watch history,
              and favorite lists are stored locally on your own device using
              browser/app storage. When you export a JSON backup file, you are
              responsible for storing that file safely. Bug reports and
              activation checks only transmit the minimum details needed to
              verify access or diagnose broken links.
            </p>
          </section>

          <section className="rounded-2xl bg-white/[0.04] border border-white/10 p-3.5 space-y-1.5">
            <h3 className="text-xs sm:text-sm font-extrabold text-white">
              5. Acceptable Use, Referrals & Local Laws
            </h3>
            <p>
              You agree to use RABBiT TV responsibly and in compliance with all
              applicable local laws in your jurisdiction. Participation in the
              Refer Friends & Earn Cash program requires genuine confirmed
              invites and is subject to the payout minimums displayed in the
              referral dashboard.
            </p>
          </section>

          <section className="rounded-2xl bg-white/[0.04] border border-white/10 p-3.5 space-y-1.5">
            <h3 className="text-xs sm:text-sm font-extrabold text-white">
              6. Availability, Updates & "As-Is" Warranty Disclaimer
            </h3>
            <p>
              RABBiT TV is provided on an "as-is" and "as-available" basis
              without warranties of uninterrupted uptime. External streams, radio
              stations, or live channels may go offline without notice — please
              use the built-in Report Broken or Bug Report buttons whenever you
              spot an issue.
            </p>
          </section>
        </div>

        {/* Footer Actions */}
        <div className="px-5 sm:px-6 py-4 border-t border-white/15 bg-black/60 shrink-0 space-y-3">
          {requireAcceptance ? (
            <>
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={agreedChecked}
                  onChange={(e) => setAgreedChecked(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-white/30 bg-black accent-violet-500 cursor-pointer shrink-0"
                />
                <span className="text-xs text-slate-200 leading-snug">
                  I have read and agree to the{" "}
                  <strong className="text-white">
                    RABBiT TV Terms of Service & Disclaimer
                  </strong>
                  .
                </span>
              </label>

              <button
                type="button"
                disabled={!agreedChecked}
                onClick={handleConfirmAccept}
                className={`w-full py-3 rounded-xl text-xs sm:text-sm font-black text-white shadow-lg transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  themeButtonGradient[appTheme] || themeButtonGradient.violet
                }`}
              >
                ✅ I Agree & Continue to RABBiT TV
              </button>
            </>
          ) : (
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <span className="text-[11px] text-emerald-400 font-bold">
                ✅ Terms accepted
                {acceptedDateText ? ` (${acceptedDateText})` : ""}
              </span>
              <button
                type="button"
                onClick={onClose}
                className={`px-5 py-2.5 rounded-xl text-xs font-extrabold text-white shadow-lg transition cursor-pointer ${
                  themeButtonGradient[appTheme] || themeButtonGradient.violet
                }`}
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
};

export default TermsOfServiceModal;