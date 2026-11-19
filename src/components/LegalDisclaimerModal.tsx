// src/components/LegalDisclaimerModal.tsx
import React, { useState, useEffect } from "react";
import {
  DISCLAIMER_ACCEPTED_KEY,
  type AppTheme,
  getSavedTheme,
  getLargeButtons,
  getHardwareLimits,
} from "@/lib/settings";

export const LEGAL_DISCLAIMER_VERSION = "2.1";
const LEGAL_ACCEPTED_META_KEY = "rabtv_disclaimer_meta_v2";

type LegalTab = "disclaimer" | "privacy" | "terms";

export function hasAcceptedCurrentDisclaimer(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const flagAccepted = localStorage.getItem(DISCLAIMER_ACCEPTED_KEY) === "true";
    const metaRaw = localStorage.getItem(LEGAL_ACCEPTED_META_KEY) || "";
    return flagAccepted && metaRaw.includes('"version":"2.1"');
  } catch {
    return false;
  }
}

export function recordDisclaimerAcceptance(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DISCLAIMER_ACCEPTED_KEY, "true");
    localStorage.setItem(
      LEGAL_ACCEPTED_META_KEY,
      JSON.stringify({
        version: LEGAL_DISCLAIMER_VERSION,
        acceptedAt: new Date().toISOString(),
      })
    );
    window.dispatchEvent(new Event("rabtv_settings_updated"));
  } catch {
    // ignore storage quota errors
  }
}

interface LegalDisclaimerModalProps {
  isOpen: boolean;
  /** When true (first launch), user must check the box & accept to proceed */
  requireAcceptance?: boolean;
  initialTab?: LegalTab;
  onAccept?: () => void;
  onClose?: () => void;
}

export function LegalDisclaimerModal({
  isOpen,
  requireAcceptance = false,
  initialTab = "disclaimer",
  onAccept,
  onClose,
}: LegalDisclaimerModalProps) {
  const [activeTab, setActiveTab] = useState<LegalTab>(initialTab);
  const [checked, setChecked] = useState(false);
  const [appTheme, setAppTheme] = useState<AppTheme>(() => getSavedTheme());
  const [largeButtons, setLargeButtons] = useState<boolean>(() =>
    getLargeButtons()
  );
  const [isLowRam, setIsLowRam] = useState<boolean>(
    () => getHardwareLimits().effectiveMode === "low"
  );

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab(initialTab);
    setAppTheme(getSavedTheme());
    setLargeButtons(getLargeButtons());
    setIsLowRam(getHardwareLimits().effectiveMode === "low");
    setChecked(false);

    if (!requireAcceptance && onClose) {
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") onClose();
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }
  }, [isOpen, initialTab, requireAcceptance, onClose]);

  if (!isOpen) return null;

  const btnGradient =
    appTheme === "red"
      ? "bg-gradient-to-r from-red-600 via-rose-600 to-orange-600 text-white"
      : appTheme === "midnight"
        ? "bg-gradient-to-r from-blue-600 via-cyan-600 to-sky-500 text-white"
        : appTheme === "emerald"
          ? "bg-gradient-to-r from-emerald-600 via-teal-600 to-green-500 text-white"
          : appTheme === "amber"
            ? "bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500 text-slate-950"
            : appTheme === "cyan"
              ? "bg-gradient-to-r from-cyan-500 via-teal-500 to-blue-600 text-white"
              : "bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 text-white";

  const handleConfirm = () => {
    if (requireAcceptance && !checked) return;
    recordDisclaimerAcceptance();
    onAccept?.();
    onClose?.();
  };

  return (
    <div
      className="rabtv-vidsrc-protected fixed inset-0 z-[70] flex items-center justify-center bg-black/88 p-3 sm:p-5 backdrop-blur-xl overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rabtv-legal-title"
    >
      {!requireAcceptance && onClose && (
        <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />
      )}

      <div
        className={`relative z-10 w-full max-w-2xl rounded-[28px] border-2 border-amber-400/50 bg-slate-950/96 ${
          isLowRam ? "" : "backdrop-blur-2xl"
        } text-white shadow-[0_25px_80px_rgba(0,0,0,0.95)] max-h-[90dvh] flex flex-col overflow-hidden`}
      >
        {/* Top Laser Accent */}
        <div className="h-[2px] w-full bg-gradient-to-r from-amber-400 via-cyan-400 to-violet-500" />

        {/* Header & Section Tabs */}
        <div className="p-4 sm:p-5 pb-3 border-b border-white/10 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2
                id="rabtv-legal-title"
                className="text-base sm:text-lg font-black text-amber-300 flex items-center gap-2"
              >
                <span>⚖️</span>
                <span>Legal, Privacy & Terms</span>
              </h2>
              <p className="text-[11px] text-slate-400">
                RABBiT TV Software Interface • Policy v{LEGAL_DISCLAIMER_VERSION}
              </p>
            </div>

            {!requireAcceptance && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl bg-white/10 hover:bg-red-600/85 border border-white/15 px-3 py-1.5 text-xs font-extrabold text-white cursor-pointer"
              >
                ✕ Close
              </button>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { id: "disclaimer", label: "⚖️ Disclaimer" },
                { id: "privacy", label: "🛡️ Privacy Policy" },
                { id: "terms", label: "📜 Terms of Service" },
              ] as { id: LegalTab; label: string }[]
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`rounded-xl ${
                  largeButtons ? "py-2.5 text-xs" : "py-2 text-[11px]"
                } font-extrabold transition cursor-pointer ${
                  activeTab === t.id
                    ? `${btnGradient} shadow-lg`
                    : "bg-black/65 border border-white/10 text-slate-300 hover:bg-white/10"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 text-xs sm:text-[13px] text-slate-200 leading-relaxed scrollbar-none">
          {activeTab === "disclaimer" && (
            <>
              <div className="rounded-2xl border border-white/10 bg-black/55 p-3.5 space-y-1">
                <h3 className="font-black text-cyan-300 uppercase text-[11px] tracking-wider">
                  1. Entertainment & Educational Purpose Only
                </h3>
                <p>
                  RABBiT TV is an independent software interface built strictly
                  for personal <strong>entertainment and educational purposes</strong>
                  . It is provided &ldquo;as is&rdquo; without warranties of any
                  kind, express or implied.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/55 p-3.5 space-y-1">
                <h3 className="font-black text-cyan-300 uppercase text-[11px] tracking-wider">
                  2. No Media Hosting — Publicly Available Indexing Only
                </h3>
                <p>
                  RABBiT TV and its developer <strong>do not host, upload, store,
                  broadcast, or distribute</strong> any video, audio, or copyrighted
                  media files on any server. The app acts solely as a client
                  interface indexing metadata and streams already publicly
                  available online on third-party sites. We do not control or
                  endorse external third-party sources.
                </p>
              </div>

              <div className="rounded-2xl border border-amber-400/35 bg-amber-950/20 p-3.5 space-y-1">
                <h3 className="font-black text-amber-300 uppercase text-[11px] tracking-wider">
                  3. Sole User Responsibility & Law Compliance
                </h3>
                <p>
                  <strong>
                    What any user does with this software is strictly their own
                    legal responsibility.
                  </strong>{" "}
                  Every user must independently check and comply with their{" "}
                  <strong>
                    local bylaws, provincial or state laws, and federal laws
                  </strong>{" "}
                  to confirm whether using this application or accessing any
                  online stream is permitted where they live.
                </p>
              </div>
            </>
          )}

          {activeTab === "privacy" && (
            <>
              <div className="rounded-2xl border border-emerald-400/40 bg-emerald-950/20 p-3.5 space-y-1">
                <h3 className="font-black text-emerald-300 uppercase text-[11px] tracking-wider">
                  1. Zero Advertising & Zero Partner Data
                </h3>
                <p>
                  We <strong>do not collect, save, profile, share, transmit, or
                  sell</strong> any user information for any form of advertising,
                  ad targeting, analytics brokers, data resellers, or external
                  business partners.
                </p>
              </div>

              <div className="rounded-2xl border border-cyan-400/35 bg-black/55 p-3.5 space-y-1">
                <h3 className="font-black text-cyan-300 uppercase text-[11px] tracking-wider">
                  2. Stored Strictly for App Functionality
                </h3>
                <p>
                  Information is saved <strong>only when needed for the app to
                  function</strong>—such as your local themes, card layout, watch
                  history, pinned channels, parental PIN settings, or optional
                  bug reports and referral/payout records that you choose to
                  submit. Local preferences stay on your device unless you export
                  a backup file or use a feature that syncs your submitted
                  entry.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/55 p-3.5 space-y-1">
                <h3 className="font-black text-cyan-300 uppercase text-[11px] tracking-wider">
                  3. No Data Sales or Third-Party Monetization
                </h3>
                <p>
                  No personal details, device identifiers, viewing history, or
                  usage records are ever sold, rented, or traded to third parties.
                </p>
              </div>
            </>
          )}

          {activeTab === "terms" && (
            <>
              <div className="rounded-2xl border border-white/10 bg-black/55 p-3.5 space-y-1">
                <h3 className="font-black text-cyan-300 uppercase text-[11px] tracking-wider">
                  1. Software Interface Scope & Fees
                </h3>
                <p>
                  Any unlock code or subscription fee applies strictly to the
                  RABBiT TV software interface and client features—not to
                  third-party media streams, which may change or become
                  unavailable at any time outside our control.
                </p>
              </div>

              <div className="rounded-2xl border border-amber-400/35 bg-amber-950/20 p-3.5 space-y-1">
                <h3 className="font-black text-amber-300 uppercase text-[11px] tracking-wider">
                  2. Jurisdictional & Legal Responsibility
                </h3>
                <p>
                  By using RABBiT TV, you agree that you are solely responsible
                  for following all applicable{" "}
                  <strong>
                    local bylaws, provincial/state laws, and federal laws
                  </strong>{" "}
                  and that the app creator bears no legal liability for how you
                  use the software or access third-party web content.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/55 p-3.5 space-y-1">
                <h3 className="font-black text-cyan-300 uppercase text-[11px] tracking-wider">
                  3. Link Removal & Updates
                </h3>
                <p>
                  We may update features, security rules, or indexed links at
                  any time and promptly review reports of broken or unwanted
                  references.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer / Acceptance Gate */}
        <div className="p-4 sm:p-5 border-t border-white/10 bg-black/65 space-y-3">
          {requireAcceptance ? (
            <>
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => setChecked(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-amber-400 accent-amber-400 shrink-0 cursor-pointer"
                />
                <span className="text-xs font-bold text-slate-200 leading-snug">
                  I agree to the Legal Disclaimer, Privacy Policy (no ad/partner
                  data saving or selling), and Terms of Service, and accept sole
                  responsibility under my local bylaws, provincial/state laws,
                  and federal laws.
                </span>
              </label>

              <button
                type="button"
                disabled={!checked}
                onClick={handleConfirm}
                className={`w-full rounded-xl ${
                  largeButtons ? "py-3.5 text-sm" : "py-3 text-xs"
                } font-black uppercase tracking-wider shadow-lg transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${btnGradient}`}
              >
                ✓ I Agree & Continue to RABBiT TV
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className={`w-full rounded-xl ${
                largeButtons ? "py-3.5 text-sm" : "py-2.5 text-xs"
              } font-black uppercase tracking-wider shadow-lg cursor-pointer ${btnGradient}`}
            >
              ✓ Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
