// src/components/LegalDisclaimerModal.tsx
import React, { useState, useEffect, useMemo, memo } from "react";
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

// =============================================================================
// COMMITTED LEGAL MODAL GRAPHIC UI ASSETS (7 FILES)
// =============================================================================
const IMG_LEG_MODAL_FRAME =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-legal-modal-frame.jpg";
const IMG_LEG_HEADER_BANNER =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-legal-header-banner.jpg";
const IMG_LEG_CLAUSE_CARD =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-legal-clause-card.jpg";
const IMG_LEG_HIGHLIGHT_CARD =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-legal-highlight-card.jpg";
const IMG_LEG_TAB_ACTIVE =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-legal-tab-active.jpg";
const IMG_LEG_TAB_IDLE =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-legal-tab-idle.jpg";
const IMG_LEG_BTN_ACCEPT =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-legal-btn-accept.jpg";

const LEGAL_MODAL_STYLES = `
  /* 6-Theme Hue-Shift Sync Matching All Overhauled RABBiT TV Screens */
  :root,
  html[data-theme="violet"] {
    --rabtv-leg-plate-filter: hue-rotate(-72deg) saturate(1.12) brightness(1.02);
    --rabtv-leg-cta-filter: hue-rotate(-68deg) saturate(1.14) brightness(1.04);
    --rabtv-leg-glow: rgba(168, 85, 247, 0.34);
  }
  html[data-theme="red"] {
    --rabtv-leg-plate-filter: hue-rotate(-24deg) saturate(1.12) brightness(1.0);
    --rabtv-leg-cta-filter: hue-rotate(-20deg) saturate(1.14) brightness(1.02);
    --rabtv-leg-glow: rgba(239, 68, 68, 0.36);
  }
  html[data-theme="midnight"] {
    --rabtv-leg-plate-filter: hue-rotate(-132deg) saturate(1.14) brightness(1.04);
    --rabtv-leg-cta-filter: hue-rotate(-126deg) saturate(1.16) brightness(1.05);
    --rabtv-leg-glow: rgba(56, 189, 248, 0.34);
  }
  html[data-theme="emerald"] {
    --rabtv-leg-plate-filter: hue-rotate(120deg) saturate(1.10) brightness(1.02);
    --rabtv-leg-cta-filter: hue-rotate(116deg) saturate(1.14) brightness(1.04);
    --rabtv-leg-glow: rgba(16, 185, 129, 0.34);
  }
  html[data-theme="amber"] {
    --rabtv-leg-plate-filter: hue-rotate(0deg) saturate(1.10) brightness(1.03);
    --rabtv-leg-cta-filter: hue-rotate(0deg) saturate(1.12) brightness(1.04);
    --rabtv-leg-glow: rgba(245, 158, 11, 0.36);
  }
  html[data-theme="cyan"] {
    --rabtv-leg-plate-filter: hue-rotate(-154deg) saturate(1.12) brightness(1.04);
    --rabtv-leg-cta-filter: hue-rotate(-148deg) saturate(1.15) brightness(1.05);
    --rabtv-leg-glow: rgba(34, 211, 238, 0.36);
  }

  /* 9-Sliced Armored Outer Modal Shell (Zero Stretch in Portrait or Landscape) */
  .rabtv-leg-shell {
    position: relative;
    overflow: hidden;
    box-sizing: border-box;
    padding: 18px 14px !important;
    background-color: #0c0a09;
    box-shadow: 0 28px 80px rgba(0, 0, 0, 0.96), 0 0 38px var(--rabtv-leg-glow);
    contain: layout paint;
  }
  @media (min-width: 640px) {
    .rabtv-leg-shell {
      padding: 24px 22px !important;
    }
  }
  .rabtv-leg-shell-9slice {
    position: absolute;
    inset: 0;
    box-sizing: border-box;
    border-style: solid;
    border-color: transparent;
    border-width: 24px 20px;
    border-image-source: url("${IMG_LEG_MODAL_FRAME}");
    border-image-slice: 12% 11% fill;
    border-image-repeat: stretch;
    filter: var(--rabtv-leg-plate-filter);
    pointer-events: none;
    z-index: 0;
  }

  /* Courtroom Mascot Header Banner (Natural Mascot Colors — No Hue-Shift Distortion) */
  .rabtv-leg-hero-banner {
    position: relative;
    overflow: hidden;
    border-radius: 18px;
    background-color: #0c0a09;
    contain: layout paint;
  }
  .rabtv-leg-hero-banner-bg {
    position: absolute;
    inset: 0;
    background-size: cover;
    background-position: center 26%;
    background-repeat: no-repeat;
    opacity: 0.92;
    pointer-events: none;
    z-index: 0;
  }
  .rabtv-leg-hero-banner-scrim {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      180deg,
      rgba(12, 10, 9, 0.84) 0%,
      rgba(12, 10, 9, 0.28) 42%,
      rgba(12, 10, 9, 0.22) 68%,
      rgba(12, 10, 9, 0.90) 100%
    );
    pointer-events: none;
    z-index: 1;
  }

  /* 9-Sliced Clause & Highlight Cards */
  .rabtv-leg-card {
    position: relative;
    overflow: hidden;
    box-sizing: border-box;
    padding: 18px 16px !important;
    background-color: #0c0a09;
    contain: layout paint;
  }
  @media (min-width: 640px) {
    .rabtv-leg-card {
      padding: 20px 22px !important;
    }
  }
  .rabtv-leg-card--footer {
    padding: 16px 16px !important;
  }
  .rabtv-leg-card-9slice {
    position: absolute;
    inset: 0;
    box-sizing: border-box;
    border-style: solid;
    border-color: transparent;
    border-width: 15px 15px;
    border-image-slice: 14% 11% fill;
    border-image-repeat: stretch;
    pointer-events: none;
    z-index: 0;
  }
  .rabtv-leg-card-9slice--clause {
    border-image-source: url("${IMG_LEG_CLAUSE_CARD}");
    filter: var(--rabtv-leg-plate-filter);
  }
  .rabtv-leg-card-9slice--highlight {
    border-image-source: url("${IMG_LEG_HIGHLIGHT_CARD}");
  }

  /* Die-Cut Chamfered Armored Buttons & Tabs */
  .rabtv-leg-btn {
    position: relative;
    overflow: hidden;
    box-sizing: border-box;
    background-color: #0c0a09;
    border: 0 !important;
    clip-path: polygon(
      9px 0%,
      calc(100% - 9px) 0%,
      100% 9px,
      100% calc(100% - 9px),
      calc(100% - 9px) 100%,
      9px 100%,
      0% calc(100% - 9px),
      0% 9px
    );
    contain: layout paint;
    transition: transform 140ms ease, opacity 140ms ease, filter 140ms ease;
  }
  .rabtv-leg-btn:hover:not(:disabled) {
    transform: scale(1.02);
    filter: brightness(1.09);
  }
  .rabtv-leg-btn:active:not(:disabled) {
    transform: scale(0.97);
  }
  .rabtv-leg-btn-art {
    position: absolute;
    inset: -2px;
    background-size: 100% 100%;
    background-position: center center;
    background-repeat: no-repeat;
    pointer-events: none;
    z-index: 0;
  }
  .rabtv-leg-btn-art--accept {
    filter: var(--rabtv-leg-cta-filter);
  }
  .rabtv-leg-btn-art--active {
    filter: var(--rabtv-leg-cta-filter);
  }
  .rabtv-leg-btn-art--idle {
    filter: var(--rabtv-leg-plate-filter) brightness(0.94);
  }
  .rabtv-leg-btn-scrim {
    position: absolute;
    inset: 0;
    background: radial-gradient(
      ellipse 78% 72% at 50% 50%,
      rgba(12, 10, 9, 0.36) 0%,
      rgba(12, 10, 9, 0.14) 100%
    );
    pointer-events: none;
    z-index: 1;
  }
  .rabtv-leg-btn-label {
    position: relative;
    z-index: 2;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    text-shadow: 0 1px 4px rgba(12, 10, 9, 0.96), 0 0 10px rgba(12, 10, 9, 0.85);
  }
`;

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

type LegalBtnVariant = "accept" | "tab_active" | "tab_idle";

const LegalArmoredBtn = memo(function LegalArmoredBtn({
  variant = "tab_idle",
  className = "",
  children,
  onClick,
  disabled = false,
  ariaLabel,
}: {
  variant?: LegalBtnVariant;
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  const bgUrl =
    variant === "accept"
      ? IMG_LEG_BTN_ACCEPT
      : variant === "tab_active"
        ? IMG_LEG_TAB_ACTIVE
        : IMG_LEG_TAB_IDLE;

  const artMod =
    variant === "accept"
      ? "rabtv-leg-btn-art--accept"
      : variant === "tab_active"
        ? "rabtv-leg-btn-art--active"
        : "rabtv-leg-btn-art--idle";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`rabtv-leg-btn text-white font-extrabold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none focus:outline-none focus:ring-2 focus:ring-cyan-400 ${className}`}
    >
      <span
        className={`rabtv-leg-btn-art ${artMod}`}
        aria-hidden="true"
        style={{ backgroundImage: `url(${bgUrl})` }}
      />
      <span className="rabtv-leg-btn-scrim" aria-hidden="true" />
      <span className="rabtv-leg-btn-label">{children}</span>
    </button>
  );
});

const LegalClauseCard = memo(function LegalClauseCard({
  children,
  highlight = false,
  footer = false,
  className = "",
}: {
  children: React.ReactNode;
  highlight?: boolean;
  footer?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`rabtv-leg-card ${footer ? "rabtv-leg-card--footer" : ""} rounded-2xl ${className}`}
    >
      <div
        className={`rabtv-leg-card-9slice ${
          highlight
            ? "rabtv-leg-card-9slice--highlight"
            : "rabtv-leg-card-9slice--clause"
        }`}
        aria-hidden="true"
      />
      <div className="relative z-10 space-y-1.5">{children}</div>
    </div>
  );
});

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

  const accentTextClass = useMemo(() => {
    switch (appTheme) {
      case "red":
        return "text-red-300";
      case "midnight":
        return "text-sky-300";
      case "emerald":
        return "text-emerald-300";
      case "amber":
        return "text-amber-300";
      case "cyan":
        return "text-cyan-300";
      case "violet":
      default:
        return "text-violet-300";
    }
  }, [appTheme]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (requireAcceptance && !checked) return;
    recordDisclaimerAcceptance();
    onAccept?.();
    onClose?.();
  };

  return (
    <div
      className={`rabtv-vidsrc-protected fixed inset-0 z-[70] flex items-center justify-center bg-black/88 p-2.5 sm:p-5 ${
        isLowRam ? "" : "backdrop-blur-xl"
      } overflow-y-auto`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="rabtv-legal-title"
    >
      <style>{LEGAL_MODAL_STYLES}</style>
      {!requireAcceptance && onClose && (
        <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />
      )}

      {/* 9-Sliced Armored Modal Container */}
      <div className="rabtv-leg-shell relative z-10 w-full max-w-2xl rounded-[26px] text-white max-h-[92dvh] flex flex-col">
        <div className="rabtv-leg-shell-9slice" aria-hidden="true" />

        {/* Interior Shell */}
        <div className="relative z-10 flex flex-col max-h-full overflow-hidden gap-3">
          {/* COURTROOM MASCOT HERO HEADER BANNER */}
          <div className="rabtv-leg-hero-banner shrink-0 min-h-[164px] sm:min-h-[192px] p-3.5 sm:p-4 flex flex-col justify-between border border-white/10">
            <div
              className="rabtv-leg-hero-banner-bg"
              aria-hidden="true"
              style={{ backgroundImage: `url(${IMG_LEG_HEADER_BANNER})` }}
            />
            <div className="rabtv-leg-hero-banner-scrim" aria-hidden="true" />

            {/* Top Utility Row */}
            <div className="relative z-10 flex items-center justify-between gap-2">
              <span
                className={`rounded-full bg-black/75 border border-white/15 px-2.5 py-1 text-[9.5px] font-black uppercase tracking-widest ${accentTextClass}`}
              >
                ⚖️ Policy v{LEGAL_DISCLAIMER_VERSION}
              </span>

              {!requireAcceptance && onClose && (
                <LegalArmoredBtn
                  variant="tab_idle"
                  onClick={onClose}
                  ariaLabel="Close Legal Modal"
                  className={
                    largeButtons
                      ? "px-4 py-2 text-xs"
                      : "px-3 py-1.5 text-[11px]"
                  }
                >
                  <span>✕ Close</span>
                </LegalArmoredBtn>
              )}
            </div>

            {/* Bottom Title Overlay (Leaves Rabbit Judge Podium & Raccoon Law Desk Clear!) */}
            <div className="relative z-10 pt-10 sm:pt-12 text-center sm:text-left">
              <h2
                id="rabtv-legal-title"
                className="text-lg sm:text-2xl font-black uppercase tracking-tight text-amber-300 drop-shadow-[0_2px_8px_rgba(0,0,0,0.98)] leading-tight"
              >
                Legal, Privacy &amp; Terms
              </h2>
              <p className="text-[10.5px] sm:text-xs font-bold text-zinc-200 mt-0.5 drop-shadow-[0_1px_4px_rgba(0,0,0,0.98)]">
                RABBiT TV Software Interface • Policy v{LEGAL_DISCLAIMER_VERSION}
              </p>
            </div>
          </div>

          {/* 4 ARMORED SECTION TABS */}
          <div className="shrink-0 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(
              [
                { id: "disclaimer", label: "⚖️ Disclaimer" },
                { id: "privacy", label: "🛡️ Privacy" },
                { id: "terms", label: "📜 Terms" },
                { id: "loopholes", label: "🔒 Loopholes" },
              ] as { id: LegalTab; label: string }[]
            ).map((t) => (
              <LegalArmoredBtn
                key={t.id}
                variant={activeTab === t.id ? "tab_active" : "tab_idle"}
                onClick={() => setActiveTab(t.id)}
                className={`w-full px-2 ${
                  largeButtons ? "py-2.5 text-xs" : "py-2 text-[11px] sm:text-xs"
                } uppercase tracking-wide`}
              >
                <span className="truncate">{t.label}</span>
              </LegalArmoredBtn>
            ))}
          </div>

          {/* SCROLLABLE LEGAL CLAUSES */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-0.5 text-xs sm:text-[13px] text-slate-200 leading-relaxed scrollbar-none">
            {activeTab === "disclaimer" && (
              <>
                <LegalClauseCard>
                  <h3 className="font-black text-cyan-300 uppercase text-[11px] tracking-wider">
                    1. Entertainment &amp; Educational Purpose Only
                  </h3>
                  <p>
                    RABBiT TV is an independent software client created strictly
                    for personal{" "}
                    <strong>entertainment and educational purposes</strong>.
                    Nothing in this application constitutes legal advice, a
                    content license, a public performance authorization, or a
                    guarantee of availability or accuracy. The software is
                    provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;
                    without warranties of any kind, whether express, implied, or
                    statutory.
                  </p>
                </LegalClauseCard>

                <LegalClauseCard>
                  <h3 className="font-black text-cyan-300 uppercase text-[11px] tracking-wider">
                    2. Zero Media Hosting — Public Web Indexing Only
                  </h3>
                  <p>
                    RABBiT TV and its developer{" "}
                    <strong>
                      do not host, upload, store, cache for redistribution,
                      broadcast, re-stream, or transcode
                    </strong>{" "}
                    any video, movie, television episode, live channel feed, or
                    audio track on any owned server. The application operates
                    solely as a client-side user interface that retrieves
                    metadata and references streams already publicly accessible
                    online on independent third-party websites and public
                    internet sources. We have no ownership, control,
                    endorsement, or editorial oversight over third-party
                    external hosts.
                  </p>
                </LegalClauseCard>

                <LegalClauseCard highlight>
                  <h3 className="font-black text-amber-300 uppercase text-[11px] tracking-wider">
                    3. Sole User Responsibility &amp; Jurisdictional Compliance
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
                    (including copyright, broadcast, telecom, and
                    age-restriction laws) in your current location to confirm
                    whether your usage is lawful. The developer is not
                    responsible for and assumes zero liability for user conduct,
                    network usage, or local law violations.
                  </p>
                </LegalClauseCard>

                <LegalClauseCard>
                  <h3 className="font-black text-cyan-300 uppercase text-[11px] tracking-wider">
                    4. Disclaimer of Liability &amp; Indemnification
                  </h3>
                  <p>
                    To the maximum extent permitted by applicable law, the
                    developer is not liable for any direct, indirect,
                    incidental, special, consequential, or punitive
                    damages—including loss of data, device issues, service
                    interruptions, ISP/carrier actions, or legal claims—arising
                    from your use of or inability to use the software. By using
                    RABBiT TV, you agree to hold harmless and indemnify the
                    developer against claims, complaints, or disputes arising
                    out of your misuse or breach of applicable laws.
                  </p>
                </LegalClauseCard>
              </>
            )}

            {activeTab === "privacy" && (
              <>
                <LegalClauseCard highlight>
                  <h3 className="font-black text-emerald-300 uppercase text-[11px] tracking-wider">
                    1. Strict No-Ads, No-Partners &amp; No-Sale Promise
                  </h3>
                  <p>
                    We{" "}
                    <strong>
                      do not save, collect, profile, share, send out, license,
                      rent, or sell
                    </strong>{" "}
                    any user information for any form of advertising, behavioral
                    ad targeting, retargeting, data brokering, or third-party
                    commercial partners. There are no ad-tech trackers,
                    ad-network data profiles, or partner data sales built into
                    this app.
                  </p>
                </LegalClauseCard>

                <LegalClauseCard>
                  <h3 className="font-black text-cyan-300 uppercase text-[11px] tracking-wider">
                    2. Saved Strictly for Core App Functionality
                  </h3>
                  <p>
                    Information is saved{" "}
                    <strong>only when required for app functionality</strong> or
                    when you explicitly submit an entry for a feature you
                    initiate:
                  </p>
                  <ul className="list-disc pl-5 space-y-1 pt-1 text-slate-300">
                    <li>
                      <strong>Device Preferences &amp; State:</strong> Saved
                      locally in your browser/device storage (such as theme,
                      poster layout, accessibility options, watch history,
                      pinned channels, parental PIN hash, and device ID) so the
                      interface works as configured.
                    </li>
                    <li>
                      <strong>User-Submitted Feature Records:</strong> If you
                      submit a bug report, enter or share a referral code, or
                      provide optional payout details for referral tracking,
                      that information is stored solely to operate that
                      requested feature and verify records.
                    </li>
                    <li>
                      <strong>Backups &amp; Cache Purging:</strong> Exported
                      backup files are generated only when you request an
                      export, and local caches can be cleared anytime from
                      settings.
                    </li>
                  </ul>
                </LegalClauseCard>

                <LegalClauseCard>
                  <h3 className="font-black text-cyan-300 uppercase text-[11px] tracking-wider">
                    3. Direct Third-Party Network Connections
                  </h3>
                  <p>
                    When your device loads external metadata, filter lists, or
                    third-party media URLs/iframes, your device connects
                    directly to those remote endpoints over the internet. Those
                    independent third-party services operate under their own
                    privacy and network policies outside our control.
                  </p>
                </LegalClauseCard>
              </>
            )}

            {activeTab === "terms" && (
              <>
                <LegalClauseCard>
                  <h3 className="font-black text-cyan-300 uppercase text-[11px] tracking-wider">
                    1. Software Interface Fee vs. Third-Party Media
                  </h3>
                  <p>
                    Any unlock code, activation key, or subscription fee applies
                    strictly to access and use of the{" "}
                    <strong>
                      RABBiT TV software interface and client tools
                    </strong>
                    —never as a payment for copyrighted media ownership or
                    third-party streaming rights. Third-party feeds or embeds
                    may change, buffer, geoblock, or go offline at any time
                    without refund or liability from the app developer.
                  </p>
                </LegalClauseCard>

                <LegalClauseCard highlight>
                  <h3 className="font-black text-amber-300 uppercase text-[11px] tracking-wider">
                    2. Referral Program Rules &amp; Payout Conditions
                  </h3>
                  <p>
                    Where a referral program is active, lifetime access is
                    priced at <strong>$20</strong> per referred user. Referral
                    payout eligibility requires a minimum of{" "}
                    <strong>
                      5 referred friends whose payments are confirmed
                    </strong>
                    , after which confirmed qualifying referrals beyond the
                    first 5 are tracked at{" "}
                    <strong>$5 per qualifying friend</strong> subject to
                    anti-fraud review (no self-referrals, duplicate device
                    abuse, chargebacks, or unconfirmed entries). Payout terms
                    may be modified, paused, or discontinued prospectively if
                    required by law, payment rules, or program abuse.
                  </p>
                </LegalClauseCard>

                <LegalClauseCard>
                  <h3 className="font-black text-cyan-300 uppercase text-[11px] tracking-wider">
                    3. Acceptable Use, Takedowns &amp; Updates
                  </h3>
                  <p>
                    You agree not to use the software for unlawful activities,
                    harassment, unauthorized commercial redistribution, or
                    attacks on third-party infrastructure. Because RABBiT TV
                    does not host media files, rightsholders should address
                    content removal to the originating third-party host, and may
                    also report references for interface review. We may modify
                    features, security controls, or terms at any time.
                  </p>
                </LegalClauseCard>
              </>
            )}

            {activeTab === "loopholes" && (
              <>
                <LegalClauseCard>
                  <h3 className="font-black text-cyan-300 uppercase text-[11px] tracking-wider">
                    1. User-Added Streams, Playlists &amp; External Links
                  </h3>
                  <p>
                    If you manually enter custom stream URLs, import playlists,
                    or open external links or embedded players, you are solely
                    responsible for the legality, safety, and rights associated
                    with those sources. Nothing in the app authorizes bypassing
                    paywalls, regional blocks, DRM, or access controls.
                  </p>
                </LegalClauseCard>

                <LegalClauseCard>
                  <h3 className="font-black text-cyan-300 uppercase text-[11px] tracking-wider">
                    2. Public Filter Lists, Ad Blocking &amp; Security Tools
                  </h3>
                  <p>
                    Built-in blocking or filter rules rely on community/public
                    lists and client-side rules and cannot guarantee 100%
                    blocking of all third-party scripts, popups, or external web
                    content. Client-side protections are provided strictly for
                    personal browsing convenience and do not create a legal duty
                    or warranty against third-party web behavior.
                  </p>
                </LegalClauseCard>

                <LegalClauseCard highlight>
                  <h3 className="font-black text-amber-300 uppercase text-[11px] tracking-wider">
                    3. No Implied Warranties, Translations &amp; Severability
                  </h3>
                  <p>
                    Informal labels, descriptions, translations, or UI phrasing
                    (including &ldquo;lifetime&rdquo; software access terms,
                    which apply for the supported lifespan of the
                    software/service and do not guarantee perpetual third-party
                    streams) do not create hidden obligations. If any clause is
                    held unenforceable under a local bylaw, provincial/state
                    law, or federal law, the remaining provisions remain in full
                    force, and failure to enforce any right is not a waiver.
                  </p>
                </LegalClauseCard>
              </>
            )}
          </div>

          {/* ARMORED FOOTER / ACCEPTANCE GATE */}
          <LegalClauseCard highlight footer className="shrink-0">
            {requireAcceptance ? (
              <div className="space-y-3">
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => setChecked(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-amber-400 accent-amber-400 shrink-0 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-slate-100 leading-snug">
                    I agree to the Legal Disclaimer, Privacy Policy (zero data
                    saved or sold for ads or partners; saved strictly for app
                    functionality), Terms of Service, and Loophole provisions,
                    and accept sole responsibility under my local bylaws,
                    provincial/state laws, and federal laws.
                  </span>
                </label>

                <LegalArmoredBtn
                  variant="accept"
                  disabled={!checked}
                  onClick={handleConfirm}
                  className={`w-full ${
                    largeButtons ? "py-3.5 text-sm" : "py-3 text-xs"
                  } font-black uppercase tracking-wider`}
                >
                  <span>✓ I Agree &amp; Continue to RABBiT TV</span>
                </LegalArmoredBtn>
              </div>
            ) : (
              <LegalArmoredBtn
                variant="accept"
                onClick={onClose}
                className={`w-full ${
                  largeButtons ? "py-3.5 text-sm" : "py-2.5 text-xs"
                } font-black uppercase tracking-wider`}
              >
                <span>✓ Close</span>
              </LegalArmoredBtn>
            )}
          </LegalClauseCard>
        </div>
      </div>
    </div>
  );
}
