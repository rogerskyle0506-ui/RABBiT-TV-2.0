// src/components/LegalDisclaimerModal.tsx
import React, { useState, useEffect } from "react";
import {
  DISCLAIMER_ACCEPTED_KEY,
  type AppTheme,
  getSavedTheme,
  getLargeButtons,
  getHardwareLimits,
} from "@/lib/settings";

export const LEGAL_DISCLAIMER_VERSION = "2.2";
const LEGAL_ACCEPTED_META_KEY = "rabtv_disclaimer_meta_v2";

export type LegalTab = "disclaimer" | "privacy" | "terms" | "loopholes";

export function hasAcceptedCurrentDisclaimer(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const flagAccepted = localStorage.getItem(DISCLAIMER_ACCEPTED_KEY) === "true";
    const metaRaw = localStorage.getItem(LEGAL_ACCEPTED_META_KEY) || "";
    return (
      flagAccepted && metaRaw.includes(`"version":"${LEGAL_DISCLAIMER_VERSION}"`)
    );
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
  /** When true (first launch or policy bump), user must check the box & accept to proceed */
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

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {(
              [
                { id: "disclaimer", label: "⚖️ Disclaimer" },
                { id: "privacy", label: "🛡️ Privacy" },
                { id: "terms", label: "📜 Terms" },
                { id: "loopholes", label: "🔒 Loopholes" },
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
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 text-xs sm:text-[13px] text-slate-200 leading-relaxed scrollbar-none">
          {activeTab === "disclaimer" && (
            <>
              <div className="rounded-2xl border border-white/10 bg-black/55 p-3.5 space-y-1">
                <h3 className="font-black text-cyan-300 uppercase text-[11px] tracking-wider">
                  1. Entertainment & Educational Purpose Only
                </h3>
                <p>
                  RABBiT TV is an independent software client created strictly
                  for personal <strong>entertainment and educational purposes</strong>
                  . Nothing in this application constitutes legal advice, a
                  content license, a public performance authorization, or a
                  guarantee of availability or accuracy. The software is provided
                  &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without
                  warranties of any kind, whether express, implied, or
                  statutory.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/55 p-3.5 space-y-1">
                <h3 className="font-black text-cyan-300 uppercase text-[11px] tracking-wider">
                  2. Zero Media Hosting — Public Web Indexing Only
                </h3>
                <p>
                  RABBiT TV and its developer <strong>do not host, upload, store,
                  cache for redistribution, broadcast, re-stream, or
                  transcode</strong> any video, movie, television episode, live
                  channel feed, or audio track on any owned server. The
                  application operates solely as a client-side user interface that
                  retrieves metadata and references streams already publicly
                  accessible online on independent third-party websites and
                  public internet sources. We have no ownership, control,
                  endorsement, or editorial oversight over third-party external
                  hosts.
                </p>
              </div>

              <div className="rounded-2xl border border-amber-400/40 bg-amber-950/20 p-3.5 space-y-1">
                <h3 className="font-black text-amber-300 uppercase text-[11px] tracking-wider">
                  3. Sole User Responsibility & Jurisdictional Compliance
                </h3>
                <p>
                  <strong>
                    Every action, stream selection, or use of this software is
                    100% the sole legal responsibility of the individual user.
                  </strong>{" "}
                  Before installing, opening, or using RABBiT TV, you must
                  independently verify and obey all applicable{" "}
                  <strong>
                    local municipal bylaws, provincial or state laws, and
                    federal laws
                  </strong>{" "}
                  (including copyright, broadcast, telecom, and age-restriction
                  laws) in your current location to confirm whether your usage is
                  lawful. The developer is not responsible for and assumes zero
                  liability for user conduct, network usage, or local law
                  violations.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/55 p-3.5 space-y-1">
                <h3 className="font-black text-cyan-300 uppercase text-[11px] tracking-wider">
                  4. Disclaimer of Liability & Indemnification
                </h3>
                <p>
                  To the maximum extent permitted by applicable law, the
                  developer is not liable for any direct, indirect, incidental,
                  special, consequential, or punitive damages—including loss of
                  data, device issues, service interruptions, ISP/carrier
                  actions, or legal claims—arising from your use of or inability
                  to use the software. By using RABBiT TV, you agree to hold
                  harmless and indemnify the developer against claims,
                  complaints, or disputes arising out of your misuse or breach
                  of applicable laws.
                </p>
              </div>
            </>
          )}

          {activeTab === "privacy" && (
            <>
              <div className="rounded-2xl border border-emerald-400/40 bg-emerald-950/20 p-3.5 space-y-1">
                <h3 className="font-black text-emerald-300 uppercase text-[11px] tracking-wider">
                  1. Strict No-Ads, No-Partners & No-Sale Promise
                </h3>
                <p>
                  We <strong>do not save, collect, profile, share, send out,
                  license, rent, or sell</strong> any user information for any
                  form of advertising, behavioral ad targeting, retargeting,
                  data brokering, or third-party commercial partners. There are
                  no ad-tech trackers, ad-network data profiles, or partner
                  data sales built into this app.
                </p>
              </div>

              <div className="rounded-2xl border border-cyan-400/35 bg-black/55 p-3.5 space-y-1">
                <h3 className="font-black text-cyan-300 uppercase text-[11px] tracking-wider">
                  2. Saved Strictly for Core App Functionality
                </h3>
                <p>
                  Information is saved <strong>only when required for app
                  functionality</strong> or when you explicitly submit an entry
                  for a feature you initiate:
                </p>
                <ul className="list-disc pl-5 space-y-1 pt-1 text-slate-300">
                  <li>
                    <strong>Device Preferences & State:</strong> Saved locally in
                    your browser/device storage (such as theme, poster layout,
                    accessibility options, watch history, pinned channels,
                    parental PIN hash, and device ID) so the interface works as
                    configured.
                  </li>
                  <li>
                    <strong>User-Submitted Feature Records:</strong> If you
                    submit a bug report, enter or share a referral code, or
                    provide optional payout details for referral tracking, that
                    information is stored solely to operate that requested
                    feature and verify records.
                  </li>
                  <li>
                    <strong>Backups & Cache Purging:</strong> Exported backup
                    files are generated only when you request an export, and
                    local caches can be cleared anytime from settings.
                  </li>
                </ul>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/55 p-3.5 space-y-1">
                <h3 className="font-black text-cyan-300 uppercase text-[11px] tracking-wider">
                  3. Direct Third-Party Network Connections
                </h3>
                <p>
                  When your device loads external metadata, filter lists, or
                  third-party media URLs/iframes, your device connects directly to
                  those remote endpoints over the internet. Those independent
                  third-party services operate under their own privacy and
                  network policies outside our control.
                </p>
              </div>
            </>
          )}

          {activeTab === "terms" && (
            <>
              <div className="rounded-2xl border border-white/10 bg-black/55 p-3.5 space-y-1">
                <h3 className="font-black text-cyan-300 uppercase text-[11px] tracking-wider">
                  1. Software Interface Fee vs. Third-Party Media
                </h3>
                <p>
                  Any unlock code, activation key, or subscription fee applies
                  strictly to access and use of the{" "}
                  <strong>RABBiT TV software interface and client tools</strong>
                  —never as a payment for copyrighted media ownership or
                  third-party streaming rights. Third-party feeds or embeds may
                  change, buffer, geoblock, or go offline at any time without
                  refund or liability from the app developer.
                </p>
              </div>

              <div className="rounded-2xl border border-amber-400/35 bg-amber-950/20 p-3.5 space-y-1">
                <h3 className="font-black text-amber-300 uppercase text-[11px] tracking-wider">
                  2. Referral Program Rules & Payout Conditions
                </h3>
                <p>
                  Where a referral program is active, lifetime access is priced
                  at <strong>$20</strong> per referred user. Referral payout
                  eligibility requires a minimum of{" "}
                  <strong>5 referred friends whose payments are confirmed</strong>
                  , after which confirmed qualifying referrals beyond the first 5
                  are tracked at <strong>$5 per qualifying friend</strong>{" "}
                  subject to anti-fraud review (no self-referrals, duplicate
                  device abuse, chargebacks, or unconfirmed entries). Payout
                  terms may be modified, paused, or discontinued prospectively if
                  required by law, payment rules, or program abuse.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/55 p-3.5 space-y-1">
                <h3 className="font-black text-cyan-300 uppercase text-[11px] tracking-wider">
                  3. Acceptable Use, Takedowns & Updates
                </h3>
                <p>
                  You agree not to use the software for unlawful activities,
                  harassment, unauthorized commercial redistribution, or attacks
                  on third-party infrastructure. Because RABBiT TV does not host
                  media files, rightsholders should address content removal to
                  the originating third-party host, and may also report
                  references for interface review. We may modify features,
                  security controls, or terms at any time.
                </p>
              </div>
            </>
          )}

          {activeTab === "loopholes" && (
            <>
              <div className="rounded-2xl border border-white/10 bg-black/55 p-3.5 space-y-1">
                <h3 className="font-black text-cyan-300 uppercase text-[11px] tracking-wider">
                  1. User-Added Streams, Playlists & External Links
                </h3>
                <p>
                  If you manually enter custom stream URLs, import playlists, or
                  open external links or embedded players, you are solely
                  responsible for the legality, safety, and rights associated
                  with those sources. Nothing in the app authorizes bypassing
                  paywalls, regional blocks, DRM, or access controls.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/55 p-3.5 space-y-1">
                <h3 className="font-black text-cyan-300 uppercase text-[11px] tracking-wider">
                  2. Public Filter Lists, Ad Blocking & Security Tools
                </h3>
                <p>
                  Built-in blocking or filter rules rely on community/public
                  lists and client-side rules and cannot guarantee 100% blocking
                  of all third-party scripts, popups, or external web content.
                  Client-side protections are provided strictly for personal
                  browsing convenience and do not create a legal duty or
                  warranty against third-party web behavior.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/55 p-3.5 space-y-1">
                <h3 className="font-black text-cyan-300 uppercase text-[11px] tracking-wider">
                  3. No Implied Warranties, Translations & Severability
                </h3>
                <p>
                  Informal labels, descriptions, translations, or UI phrasing
                  (including &ldquo;lifetime&rdquo; software access terms, which
                  apply for the supported lifespan of the software/service and do
                  not guarantee perpetual third-party streams) do not create
                  hidden obligations. If any clause is held unenforceable under a
                  local bylaw, provincial/state law, or federal law, the
                  remaining provisions remain in full force, and failure to
                  enforce any right is not a waiver.
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
                  I agree to the Legal Disclaimer, Privacy Policy (zero data
                  saved or sold for ads or partners; saved strictly for app
                  functionality), Terms of Service, and Loophole provisions, and
                  accept sole responsibility under my local bylaws,
                  provincial/state laws, and federal laws.
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
