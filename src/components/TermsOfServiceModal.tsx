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

const IMG_TOS_MODAL_FRAME =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-legal-modal-frame.jpg";
const IMG_TOS_HEADER_BANNER =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-legal-header-banner.jpg";
const IMG_TOS_CLAUSE_CARD =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-legal-clause-card.jpg";
const IMG_TOS_HIGHLIGHT_CARD =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-legal-highlight-card.jpg";
const IMG_TOS_TAB_IDLE =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-legal-tab-idle.jpg";
const IMG_TOS_BTN_ACCEPT =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-legal-btn-accept.jpg";

const TOS_STYLES = `
  :root, html[data-theme="violet"] { --rabtv-tos-filter: hue-rotate(-72deg) saturate(1.12) brightness(1.02); }
  html[data-theme="red"] { --rabtv-tos-filter: hue-rotate(-24deg) saturate(1.12) brightness(1.0); }
  html[data-theme="midnight"] { --rabtv-tos-filter: hue-rotate(-132deg) saturate(1.14) brightness(1.04); }
  html[data-theme="emerald"] { --rabtv-tos-filter: hue-rotate(120deg) saturate(1.10) brightness(1.02); }
  html[data-theme="amber"] { --rabtv-tos-filter: hue-rotate(0deg) saturate(1.10) brightness(1.03); }
  html[data-theme="cyan"] { --rabtv-tos-filter: hue-rotate(-154deg) saturate(1.12) brightness(1.04); }

  .rabtv-tos-shell { position: relative; overflow: hidden; box-sizing: border-box; padding: 18px 14px !important; background-color: #0c0a09; contain: layout paint; }
  @media (min-width: 640px) { .rabtv-tos-shell { padding: 24px 22px !important; } }
  .rabtv-tos-shell-9slice { position: absolute; inset: 0; box-sizing: border-box; border-style: solid; border-color: transparent; border-width: 24px 20px; border-image-source: url("${IMG_TOS_MODAL_FRAME}"); border-image-slice: 12% 11% fill; border-image-repeat: stretch; filter: var(--rabtv-tos-filter); pointer-events: none; z-index: 0; }
  .rabtv-tos-card { position: relative; overflow: hidden; box-sizing: border-box; padding: 16px 16px !important; background-color: #0c0a09; contain: layout paint; }
  .rabtv-tos-card-9slice { position: absolute; inset: 0; box-sizing: border-box; border-style: solid; border-color: transparent; border-width: 14px 14px; border-image-source: url("${IMG_TOS_CLAUSE_CARD}"); border-image-slice: 14% 11% fill; border-image-repeat: stretch; filter: var(--rabtv-tos-filter); pointer-events: none; z-index: 0; }
  .rabtv-tos-card-9slice--hi { border-image-source: url("${IMG_TOS_HIGHLIGHT_CARD}"); filter: none; }
  .rabtv-tos-btn { position: relative; overflow: hidden; background-color: #0c0a09; border: 0 !important; clip-path: polygon(9px 0%, calc(100% - 9px) 0%, 100% 9px, 100% calc(100% - 9px), calc(100% - 9px) 100%, 9px 100%, 0% calc(100% - 9px), 0% 9px); contain: layout paint; transition: transform 140ms ease, filter 140ms ease; }
  .rabtv-tos-btn:hover:not(:disabled) { transform: scale(1.02); filter: brightness(1.09); }
  .rabtv-tos-btn-art { position: absolute; inset: -2px; background-size: 100% 100%; filter: var(--rabtv-tos-filter); pointer-events: none; z-index: 0; }
  .rabtv-tos-btn-scrim { position: absolute; inset: 0; background: radial-gradient(ellipse 78% 72% at 50% 50%, rgba(12,10,9,0.36) 0%, rgba(12,10,9,0.14) 100%); pointer-events: none; z-index: 1; }
  .rabtv-tos-btn-label { position: relative; z-index: 2; display: inline-flex; align-items: center; justify-content: center; gap: 6px; text-shadow: 0 1px 4px rgba(12,10,9,0.96); }
`;

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
      className="fixed inset-0 z-[99990] flex items-center justify-center p-2.5 sm:p-5 bg-black/86 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="RABBiT TV Terms of Service"
    >
      <style>{TOS_STYLES}</style>
      <div className="rabtv-tos-shell relative w-full max-w-2xl max-h-[90dvh] flex flex-col rounded-[26px] text-slate-100 shadow-2xl">
        <div className="rabtv-tos-shell-9slice" aria-hidden="true" />

        <div className="relative z-10 flex flex-col max-h-full overflow-hidden gap-3">
          {/* Courtroom Mascot Hero Header */}
          <div className="relative overflow-hidden rounded-2xl border border-white/10 min-h-[154px] sm:min-h-[180px] p-3.5 sm:p-4 flex flex-col justify-between bg-[#0c0a09] shrink-0">
            <div
              className="absolute inset-0 bg-cover bg-center opacity-92 pointer-events-none"
              style={{
                backgroundImage: `url(${IMG_TOS_HEADER_BANNER})`,
                backgroundPosition: "center 26%",
              }}
              aria-hidden="true"
            />
            <div
              className="absolute inset-0 bg-gradient-to-b from-[#0c0a09]/84 via-[#0c0a09]/26 to-[#0c0a09]/92 pointer-events-none"
              aria-hidden="true"
            />

            <div className="relative z-10 flex items-center justify-between gap-2">
              <span className="rounded-full bg-black/80 border border-white/15 px-2.5 py-1 text-[9.5px] font-black uppercase tracking-widest text-amber-300">
                📜 ToS v{TOS_CURRENT_VERSION}
              </span>
              {!requireAcceptance && (
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close Terms of Service"
                  className="rabtv-tos-btn px-3 py-1.5 text-[11px] font-extrabold text-white cursor-pointer"
                >
                  <span className="rabtv-tos-btn-art" style={{ backgroundImage: `url(${IMG_TOS_TAB_IDLE})` }} />
                  <span className="rabtv-tos-btn-scrim" />
                  <span className="rabtv-tos-btn-label">✕ Close</span>
                </button>
              )}
            </div>

            <div className="relative z-10 pt-8 text-center sm:text-left">
              <h2 className="text-lg sm:text-xl font-black uppercase tracking-tight text-amber-300 drop-shadow-[0_2px_8px_rgba(0,0,0,0.98)]">
                RABBiT TV Terms of Service &amp; Disclaimer
              </h2>
              <p className="text-[11px] font-bold text-zinc-200 mt-0.5 drop-shadow">
                Version {TOS_CURRENT_VERSION}
                {acceptedDateText && !requireAcceptance
                  ? ` • Accepted on ${acceptedDateText}`
                  : " • Please review before continuing"}
              </p>
            </div>
          </div>

          {/* Scrollable 9-Sliced Legal Clauses */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-0.5 text-xs sm:text-sm leading-relaxed text-slate-200 scrollbar-none">
            {[
              {
                title: "1. Authorized Access & Acceptance",
                body: (
                  <p>
                    By activating, unlocking, or using RABBiT TV (including any 7-day
                    trial or permanent unlock code), you agree to these Terms of
                    Service. Access codes are issued for authorized personal use only.
                    Unauthorized redistribution, resale, or tampering with app access
                    gates is prohibited.
                  </p>
                ),
              },
              {
                title: "2. Third-Party Streams, Links & TMDB Attribution",
                body: (
                  <>
                    <p>
                      RABBiT TV acts strictly as a user interface and media discovery
                      browser. RABBiT TV does not host, upload, store, or own any movies,
                      TV episodes, or live broadcast video files. All third-party streams
                      and external websites (including IMDb and TMDB) are controlled by
                      their respective providers.
                    </p>
                    <p className="text-slate-300 mt-1.5">
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
                  </>
                ),
              },
              {
                title: "3. Age Ratings, Kids Safe Mode & Parental PIN",
                body: (
                  <p>
                    You are responsible for setting an accurate profile age, enabling
                    Kids Safe Mode when children use the device, and keeping your 4–6
                    digit Parental PIN confidential. Content ratings come from public
                    metadata sources and may occasionally vary by region.
                  </p>
                ),
              },
              {
                title: "4. Privacy, Local Storage & JSON Backups",
                body: (
                  <p>
                    Your profile name, themes, accessibility settings, watch history,
                    and favorite lists are stored locally on your own device using
                    browser/app storage. When you export a JSON backup file, you are
                    responsible for storing that file safely. Bug reports and
                    activation checks only transmit the minimum details needed to
                    verify access or diagnose broken links.
                  </p>
                ),
              },
              {
                title: "5. Acceptable Use, Referrals & Local Laws",
                highlight: true,
                body: (
                  <p>
                    You agree to use RABBiT TV responsibly and in compliance with all
                    applicable local laws in your jurisdiction. Participation in the
                    Refer Friends &amp; Earn Cash program requires genuine confirmed
                    invites and is subject to the payout minimums displayed in the
                    referral dashboard.
                  </p>
                ),
              },
              {
                title: '6. Availability, Updates & "As-Is" Warranty Disclaimer',
                body: (
                  <p>
                    RABBiT TV is provided on an &ldquo;as-is&rdquo; and &ldquo;as-available&rdquo; basis
                    without warranties of uninterrupted uptime. External streams, radio
                    stations, or live channels may go offline without notice — please
                    use the built-in Report Broken or Bug Report buttons whenever you
                    spot an issue.
                  </p>
                ),
              },
            ].map((sec) => (
              <section key={sec.title} className="rabtv-tos-card rounded-2xl">
                <div
                  className={`rabtv-tos-card-9slice ${
                    sec.highlight ? "rabtv-tos-card-9slice--hi" : ""
                  }`}
                  aria-hidden="true"
                />
                <div className="relative z-10 space-y-1.5">
                  <h3 className={`text-xs sm:text-sm font-black ${sec.highlight ? "text-amber-300" : "text-cyan-300"}`}>
                    {sec.title}
                  </h3>
                  {sec.body}
                </div>
              </section>
            ))}
          </div>

          {/* Armored Footer Acceptance Gate */}
          <div className="rabtv-tos-card rounded-2xl shrink-0">
            <div className="rabtv-tos-card-9slice rabtv-tos-card-9slice--hi" aria-hidden="true" />
            <div className="relative z-10 space-y-3">
              {requireAcceptance ? (
                <>
                  <label className="flex items-start gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={agreedChecked}
                      onChange={(e) => setAgreedChecked(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-amber-400 bg-black accent-amber-400 cursor-pointer shrink-0"
                    />
                    <span className="text-xs text-slate-100 leading-snug font-bold">
                      I have read and agree to the{" "}
                      <strong className="text-amber-300">
                        RABBiT TV Terms of Service &amp; Disclaimer
                      </strong>
                      .
                    </span>
                  </label>

                  <button
                    type="button"
                    disabled={!agreedChecked}
                    onClick={handleConfirmAccept}
                    className="rabtv-tos-btn w-full py-3 text-xs sm:text-sm font-black uppercase tracking-wider text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <span className="rabtv-tos-btn-art" style={{ backgroundImage: `url(${IMG_TOS_BTN_ACCEPT})` }} />
                    <span className="rabtv-tos-btn-scrim" />
                    <span className="rabtv-tos-btn-label">✅ I Agree &amp; Continue to RABBiT TV</span>
                  </button>
                </>
              ) : (
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <span className="text-[11px] text-emerald-300 font-bold">
                    ✅ Terms accepted
                    {acceptedDateText ? ` (${acceptedDateText})` : ""}
                  </span>
                  <button
                    type="button"
                    onClick={onClose}
                    className="rabtv-tos-btn px-6 py-2.5 text-xs font-extrabold uppercase tracking-wider text-white cursor-pointer"
                  >
                    <span className="rabtv-tos-btn-art" style={{ backgroundImage: `url(${IMG_TOS_BTN_ACCEPT})` }} />
                    <span className="rabtv-tos-btn-scrim" />
                    <span className="rabtv-tos-btn-label">Done</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
};

export default TermsOfServiceModal;