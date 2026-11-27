// src/components/ReferralModal.tsx
import React, { useEffect, useState, useMemo, useCallback, memo } from "react";
import {
  LIFETIME_PRICE_CAD,
  MIN_CONFIRMED_REFERRALS,
  PAYOUT_PER_EXTRA_REFERRAL_CAD,
  STEP_UP_CONFIRMED_THRESHOLD,
  STEP_UP_PAYOUT_CAD,
  PAYOUT_METHODS,
  type PayoutMethod,
  getOrCreateMyReferralCode,
  getSavedPayoutMethod,
  getSavedPayoutInfo,
  getClaimedReferralCode,
  fetchReferralSystemData,
  registerOrUpdateMyReferrerProfile,
  submitReferralClaim,
  computeReferrerSummary,
  type ReferralSystemData,
} from "@/lib/referrals";
import {
  type AppTheme,
  getSavedTheme,
  getLargeButtons,
  getReducedMotion,
  getHardwareLimits,
  getClockFormat,
  formatAppTime,
} from "@/lib/settings";

// =============================================================================
// COMMITTED REFERRAL MODAL GRAPHIC UI ASSETS (9 NEW + 1 SHARED 9-SLICE INPUT)
// =============================================================================
const IMG_REF_MODAL_FRAME =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-referral-modal-frame.jpg";
const IMG_REF_HEADER_BANNER =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-referral-header-banner.jpg";
const IMG_REF_CODE_CARD =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-referral-code-card-bg.jpg";
const IMG_REF_SECTION_CARD =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-referral-section-card.jpg";
const IMG_REF_TAB_ACTIVE =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-referral-tab-active.jpg";
const IMG_REF_TAB_IDLE =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-referral-tab-idle.jpg";
const IMG_REF_BTN_PRIMARY =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-referral-btn-primary.jpg";
const IMG_REF_BTN_EMERALD =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-referral-btn-emerald.jpg";
const IMG_REF_PROGRESS_TRACK =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-referral-progress-track.jpg";
const IMG_REF_INPUT_BAR =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-search-input-bar-background.jpg";

const REFERRAL_MODAL_STYLES = `
  /* 6-Theme Hue-Shift Sync Matching All Overhauled RABBiT TV Screens */
  :root,
  html[data-theme="violet"] {
    --rabtv-ref-plate-filter: hue-rotate(-78deg) saturate(1.12) brightness(1.02);
    --rabtv-ref-cta-filter: hue-rotate(-70deg) saturate(1.15) brightness(1.04);
    --rabtv-ref-glow: rgba(168, 85, 247, 0.34);
  }
  html[data-theme="red"] {
    --rabtv-ref-plate-filter: hue-rotate(0deg) saturate(1.08) brightness(1.0);
    --rabtv-ref-cta-filter: hue-rotate(0deg) saturate(1.12) brightness(1.03);
    --rabtv-ref-glow: rgba(239, 68, 68, 0.36);
  }
  html[data-theme="midnight"] {
    --rabtv-ref-plate-filter: hue-rotate(-132deg) saturate(1.14) brightness(1.04);
    --rabtv-ref-cta-filter: hue-rotate(-126deg) saturate(1.16) brightness(1.05);
    --rabtv-ref-glow: rgba(56, 189, 248, 0.34);
  }
  html[data-theme="emerald"] {
    --rabtv-ref-plate-filter: hue-rotate(154deg) saturate(1.10) brightness(1.02);
    --rabtv-ref-cta-filter: hue-rotate(148deg) saturate(1.14) brightness(1.04);
    --rabtv-ref-glow: rgba(16, 185, 129, 0.34);
  }
  html[data-theme="amber"] {
    --rabtv-ref-plate-filter: hue-rotate(28deg) saturate(1.14) brightness(1.04);
    --rabtv-ref-cta-filter: hue-rotate(22deg) saturate(1.16) brightness(1.05);
    --rabtv-ref-glow: rgba(245, 158, 11, 0.36);
  }
  html[data-theme="cyan"] {
    --rabtv-ref-plate-filter: hue-rotate(-154deg) saturate(1.12) brightness(1.04);
    --rabtv-ref-cta-filter: hue-rotate(-148deg) saturate(1.15) brightness(1.05);
    --rabtv-ref-glow: rgba(34, 211, 238, 0.36);
  }

  /* 9-Sliced Armored Outer Modal Shell (Zero Stretch in Portrait or Landscape) */
  .rabtv-ref-shell {
    position: relative;
    overflow: hidden;
    box-sizing: border-box;
    padding: 18px 14px !important;
    background-color: #0c0a09;
    box-shadow: 0 28px 80px rgba(0, 0, 0, 0.96), 0 0 38px var(--rabtv-ref-glow);
    contain: layout paint;
  }
  @media (min-width: 640px) {
    .rabtv-ref-shell {
      padding: 24px 22px !important;
    }
  }
  .rabtv-ref-shell-9slice {
    position: absolute;
    inset: 0;
    box-sizing: border-box;
    border-style: solid;
    border-color: transparent;
    border-width: 24px 20px;
    border-image-source: url("${IMG_REF_MODAL_FRAME}");
    border-image-slice: 12% 11% fill;
    border-image-repeat: stretch;
    filter: var(--rabtv-ref-plate-filter);
    pointer-events: none;
    z-index: 0;
  }

  /* Mascot Handshake Header Banner */
  .rabtv-ref-hero-banner {
    position: relative;
    overflow: hidden;
    border-radius: 18px;
    background-color: #0c0a09;
    contain: layout paint;
  }
  .rabtv-ref-hero-banner-bg {
    position: absolute;
    inset: 0;
    background-size: cover;
    background-position: center 35%;
    background-repeat: no-repeat;
    opacity: 0.92;
    pointer-events: none;
    z-index: 0;
  }
  .rabtv-ref-hero-banner-scrim {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      180deg,
      rgba(12, 10, 9, 0.86) 0%,
      rgba(12, 10, 9, 0.34) 44%,
      rgba(12, 10, 9, 0.22) 72%,
      rgba(12, 10, 9, 0.88) 100%
    );
    pointer-events: none;
    z-index: 1;
  }

  /* 9-Sliced Section / Stat / Form Card */
  .rabtv-ref-card {
    position: relative;
    overflow: hidden;
    box-sizing: border-box;
    padding: 18px 16px !important;
    background-color: #0c0a09;
    contain: layout paint;
  }
  @media (min-width: 640px) {
    .rabtv-ref-card {
      padding: 20px 20px !important;
    }
  }
  .rabtv-ref-card--stat {
    padding: 14px 12px !important;
  }
  .rabtv-ref-card--row {
    padding: 13px 15px !important;
  }
  .rabtv-ref-card-9slice {
    position: absolute;
    inset: 0;
    box-sizing: border-box;
    border-style: solid;
    border-color: transparent;
    border-width: 14px 14px;
    border-image-source: url("${IMG_REF_SECTION_CARD}");
    border-image-slice: 14% 11% fill;
    border-image-repeat: stretch;
    filter: var(--rabtv-ref-plate-filter);
    pointer-events: none;
    z-index: 0;
  }

  /* Personal Referral Code Vault Display Window (Amber Glow Steel Plate) */
  .rabtv-ref-code-vault {
    position: relative;
    width: 100%;
    max-width: 440px;
    margin-inline: auto;
    min-height: 76px;
    padding: 16px 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 16px;
    overflow: hidden;
    background-color: #0c0a09;
    contain: layout paint;
  }
  .rabtv-ref-code-vault-bg {
    position: absolute;
    inset: 0;
    background-size: 100% 100%;
    background-position: center center;
    background-repeat: no-repeat;
    opacity: 0.96;
    pointer-events: none;
    z-index: 0;
  }

  /* Die-Cut Armored Chamfered Tab & Action Buttons (Zero White Outer Corner Artifacts!) */
  .rabtv-ref-btn {
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
  .rabtv-ref-btn:hover:not(:disabled) {
    transform: scale(1.02);
    filter: brightness(1.09);
  }
  .rabtv-ref-btn:active:not(:disabled) {
    transform: scale(0.97);
  }
  .rabtv-ref-btn-art {
    position: absolute;
    inset: -2px;
    background-size: 100% 100%;
    background-position: center center;
    background-repeat: no-repeat;
    pointer-events: none;
    z-index: 0;
  }
  .rabtv-ref-btn-art--primary {
    filter: var(--rabtv-ref-cta-filter);
  }
  .rabtv-ref-btn-art--tab-active {
    filter: var(--rabtv-ref-cta-filter);
  }
  .rabtv-ref-btn-art--tab-idle {
    filter: var(--rabtv-ref-plate-filter) brightness(0.92);
  }
  .rabtv-ref-btn-art--emerald {
    filter: saturate(1.12) brightness(1.02);
  }
  .rabtv-ref-btn-scrim {
    position: absolute;
    inset: 0;
    background: radial-gradient(
      ellipse 78% 72% at 50% 50%,
      rgba(12, 10, 9, 0.38) 0%,
      rgba(12, 10, 9, 0.14) 100%
    );
    pointer-events: none;
    z-index: 1;
  }
  .rabtv-ref-btn-label {
    position: relative;
    z-index: 2;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    text-shadow: 0 1px 4px rgba(12, 10, 9, 0.96), 0 0 10px rgba(12, 10, 9, 0.85);
  }

  /* Riveted Metallic Progress Bar Track */
  .rabtv-ref-progress-housing {
    position: relative;
    width: 100%;
    height: 30px;
    border-radius: 10px;
    overflow: hidden;
    background-color: #0c0a09;
    contain: layout paint;
  }
  @media (min-width: 640px) {
    .rabtv-ref-progress-housing {
      height: 34px;
    }
  }
  .rabtv-ref-progress-track-art {
    position: absolute;
    inset: 0;
    background-size: 100% 100%;
    background-position: center center;
    background-repeat: no-repeat;
    filter: var(--rabtv-ref-plate-filter);
    pointer-events: none;
    z-index: 0;
  }
  .rabtv-ref-progress-channel {
    position: absolute;
    inset: 22% 3.4%;
    border-radius: 5px;
    overflow: hidden;
    background-color: rgba(12, 10, 9, 0.86);
    z-index: 2;
  }

  /* 9-Sliced Armored Text Input Housing */
  .rabtv-ref-input-shell {
    position: relative;
    overflow: hidden;
    background-color: #0c0a09;
    contain: layout paint;
  }
  .rabtv-ref-input-9slice {
    position: absolute;
    inset: 0;
    box-sizing: border-box;
    border-style: solid;
    border-color: transparent;
    border-width: 7px 16px;
    border-image-source: url("${IMG_REF_INPUT_BAR}");
    border-image-slice: 22% 14% fill;
    border-image-repeat: stretch;
    filter: var(--rabtv-ref-plate-filter);
    pointer-events: none;
    z-index: 0;
  }
`;

interface ReferralModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ModalTab = "my_code" | "claim_code" | "my_friends";
type RefBtnVariant = "primary" | "emerald" | "tab_active" | "tab_idle";

function getPayoutPlaceholder(method: PayoutMethod): string {
  if (method === "PayPal") return "PayPal email or @paypal.me username";
  if (method === "Cash") return "Your phone # or meetup note for Cash payout";
  return "e-Transfer email address or phone number";
}

function getPayoutMethodIcon(method: PayoutMethod): string {
  if (method === "PayPal") return "🅿️";
  if (method === "Cash") return "💵";
  return "🏦";
}

const ReferralArmoredBtn = memo(function ReferralArmoredBtn({
  variant = "tab_idle",
  className = "",
  children,
  onClick,
  type = "button",
  disabled = false,
  title,
  ariaLabel,
}: {
  variant?: RefBtnVariant;
  className?: string;
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  type?: "button" | "submit";
  disabled?: boolean;
  title?: string;
  ariaLabel?: string;
}) {
  const bgUrl =
    variant === "primary"
      ? IMG_REF_BTN_PRIMARY
      : variant === "emerald"
        ? IMG_REF_BTN_EMERALD
        : variant === "tab_active"
          ? IMG_REF_TAB_ACTIVE
          : IMG_REF_TAB_IDLE;

  const artMod =
    variant === "primary"
      ? "rabtv-ref-btn-art--primary"
      : variant === "emerald"
        ? "rabtv-ref-btn-art--emerald"
        : variant === "tab_active"
          ? "rabtv-ref-btn-art--tab-active"
          : "rabtv-ref-btn-art--tab-idle";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      className={`rabtv-ref-btn text-white font-extrabold cursor-pointer disabled:opacity-40 disabled:pointer-events-none focus:outline-none focus:ring-2 focus:ring-cyan-400 ${className}`}
    >
      <span
        className={`rabtv-ref-btn-art ${artMod}`}
        aria-hidden="true"
        style={{ backgroundImage: `url(${bgUrl})` }}
      />
      <span className="rabtv-ref-btn-scrim" aria-hidden="true" />
      <span className="rabtv-ref-btn-label">{children}</span>
    </button>
  );
});

const ReferralSectionCard = memo(function ReferralSectionCard({
  children,
  className = "",
  variant = "default",
}: {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "stat" | "row";
}) {
  const mod =
    variant === "stat"
      ? "rabtv-ref-card--stat"
      : variant === "row"
        ? "rabtv-ref-card--row"
        : "";
  return (
    <div className={`rabtv-ref-card ${mod} rounded-2xl ${className}`}>
      <div className="rabtv-ref-card-9slice" aria-hidden="true" />
      <div className="relative z-10">{children}</div>
    </div>
  );
});

export function ReferralModal({ isOpen, onClose }: ReferralModalProps) {
  const [activeTab, setActiveTab] = useState<ModalTab>("my_code");
  const [systemData, setSystemData] = useState<ReferralSystemData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [busy, setBusy] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);

  const [profileName, setProfileName] = useState<string>("");
  const [myCode, setMyCode] = useState<string>("");
  const [payoutMethod, setPayoutMethod] = useState<PayoutMethod>(() =>
    getSavedPayoutMethod()
  );
  const [payoutInfo, setPayoutInfo] = useState<string>("");
  const [friendCodeInput, setFriendCodeInput] = useState<string>("");
  const [claimContactInput, setClaimContactInput] = useState<string>("");
  const [claimedCode, setClaimedCode] = useState<string>("");
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  const [appTheme, setAppTheme] = useState<AppTheme>(() => getSavedTheme());
  const [largeButtons, setLargeButtons] = useState<boolean>(() =>
    getLargeButtons()
  );
  const [reducedMotion, setReducedMotion] = useState<boolean>(() =>
    getReducedMotion()
  );
  const [isLowRam, setIsLowRam] = useState<boolean>(
    () => getHardwareLimits().effectiveMode === "low"
  );
  const [clockFormat, setClockFormat] = useState(() => getClockFormat());

  const showMessage = useCallback((type: "ok" | "err", text: string) => {
    setFeedback({ type, text });
    window.setTimeout(() => setFeedback(null), 4500);
  }, []);

  const loadAll = useCallback(async (force = false) => {
    setLoading(true);
    try {
      const savedName =
        (typeof window !== "undefined"
          ? localStorage.getItem("rabtv_profile_name")
          : "") || "Member";
      const code = getOrCreateMyReferralCode(savedName);
      const savedMethod = getSavedPayoutMethod();
      const savedPayout = getSavedPayoutInfo();

      setProfileName(savedName);
      setMyCode(code);
      setPayoutMethod(savedMethod);
      setPayoutInfo(savedPayout);
      setClaimedCode(getClaimedReferralCode());

      const data = await fetchReferralSystemData(force);

      if (!data.profiles[code]) {
        await registerOrUpdateMyReferrerProfile({
          name: savedName,
          payoutMethod: savedMethod,
          payoutInfo: savedPayout,
        });
        const refreshed = await fetchReferralSystemData(true);
        setSystemData(refreshed);
      } else {
        setSystemData(data);
        const cloudProfile = data.profiles[code];
        if (cloudProfile?.payoutMethod) {
          setPayoutMethod(cloudProfile.payoutMethod);
        }
        if (!savedPayout && cloudProfile?.payoutInfo) {
          setPayoutInfo(cloudProfile.payoutInfo);
        }
      }
    } catch (err) {
      console.error("Failed to load referral portal:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setAppTheme(getSavedTheme());
    setLargeButtons(getLargeButtons());
    setReducedMotion(getReducedMotion());
    setIsLowRam(getHardwareLimits().effectiveMode === "low");
    setClockFormat(getClockFormat());
    void loadAll(false);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, loadAll, onClose]);

  const mySummary = useMemo(() => {
    if (!systemData || !myCode) return null;
    return computeReferrerSummary(myCode, systemData);
  }, [systemData, myCode]);

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

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(myCode);
      setCopiedCode(true);
      showMessage("ok", `Copied code ${myCode}!`);
      window.setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      showMessage("err", `Your code is ${myCode} — share it with friends!`);
    }
  };

  const handleWhatsAppShare = () => {
    const text = `Check out RABBiT TV! It's $${LIFETIME_PRICE_CAD} for a lifetime subscription (movies, shows & 280+ live channels). Use my referral code when you join: ${myCode}`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleSavePayoutDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const res = await registerOrUpdateMyReferrerProfile({
      name: profileName,
      payoutMethod,
      payoutInfo,
    });
    setBusy(false);
    if (res.ok) {
      showMessage(
        "ok",
        `✓ Saved ${payoutMethod} payout details for Admin!`
      );
      void loadAll(true);
    } else {
      showMessage("err", res.error || "Could not sync payout details.");
    }
  };

  const handleClaimFriendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const res = await submitReferralClaim({
      referrerCode: friendCodeInput,
      myName: profileName,
      myContact: claimContactInput,
    });
    setBusy(false);
    if (res.ok) {
      setClaimedCode(friendCodeInput.toUpperCase().trim());
      setFriendCodeInput("");
      setClaimContactInput("");
      showMessage("ok", res.message);
      void loadAll(true);
    } else {
      showMessage("err", res.message);
    }
  };

  const confirmedCount = mySummary?.confirmedPaidCount || 0;
  const isUnlocked = Boolean(mySummary?.isPayoutUnlocked);
  const isStepUp = Boolean(mySummary?.isStepUpTier);

  const unlockPct = Math.round(
    (Math.min(MIN_CONFIRMED_REFERRALS, confirmedCount) /
      MIN_CONFIRMED_REFERRALS) *
      100
  );
  const stepUpPct = Math.round(
    (Math.min(STEP_UP_CONFIRMED_THRESHOLD, confirmedCount) /
      STEP_UP_CONFIRMED_THRESHOLD) *
      100
  );
  const activeProgressPct = isUnlocked ? stepUpPct : unlockPct;

  return (
    <div
      className={`rabtv-vidsrc-protected fixed inset-0 z-50 flex items-center justify-center bg-black/84 p-2.5 sm:p-5 ${
        isLowRam ? "" : "backdrop-blur-xl"
      } overflow-y-auto`}
      role="dialog"
      aria-modal="true"
      aria-label="Refer Friends & Earn Unlimited Cash"
    >
      <style>{REFERRAL_MODAL_STYLES}</style>
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      {/* 9-Sliced Armored Modal Container */}
      <div className="rabtv-ref-shell relative z-10 w-full max-w-2xl rounded-[26px] text-white max-h-[92dvh] flex flex-col">
        <div className="rabtv-ref-shell-9slice" aria-hidden="true" />

        {/* Scrollable Interior Shell */}
        <div className="relative z-10 flex flex-col max-h-full overflow-hidden gap-3">
          {/* HERO MASCOT HANDSHAKE HEADER BANNER */}
          <div className="rabtv-ref-hero-banner shrink-0 min-h-[168px] sm:min-h-[196px] p-3.5 sm:p-4 flex flex-col justify-between border border-white/10">
            <div
              className="rabtv-ref-hero-banner-bg"
              aria-hidden="true"
              style={{ backgroundImage: `url(${IMG_REF_HEADER_BANNER})` }}
            />
            <div className="rabtv-ref-hero-banner-scrim" aria-hidden="true" />

            {/* Top Utility Bar: Sync & Close */}
            <div className="relative z-10 flex items-center justify-between gap-2">
              <span
                className={`rounded-full bg-black/75 border border-white/15 px-2.5 py-1 text-[9.5px] font-black uppercase tracking-widest ${accentTextClass}`}
              >
                💸 Referral Vault
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                <ReferralArmoredBtn
                  variant="tab_idle"
                  disabled={loading}
                  onClick={() => void loadAll(true)}
                  className="px-3 py-1.5 text-[11px]"
                >
                  <span>{loading ? "..." : "↻ Sync"}</span>
                </ReferralArmoredBtn>
                <ReferralArmoredBtn
                  variant="tab_idle"
                  onClick={onClose}
                  className={
                    largeButtons
                      ? "px-4 py-2 text-xs"
                      : "px-3 py-1.5 text-[11px]"
                  }
                >
                  <span>✕ Close</span>
                </ReferralArmoredBtn>
              </div>
            </div>

            {/* Bottom Title Overlay (Leaves Rabbit & Raccoon Handshake Center Visible!) */}
            <div className="relative z-10 pt-10 sm:pt-12 text-center sm:text-left">
              <h3 className="text-lg sm:text-2xl font-black uppercase tracking-tight text-amber-300 drop-shadow-[0_2px_8px_rgba(0,0,0,0.98)] leading-tight">
                Refer Friends &amp; Earn Unlimited Cash
              </h3>
              <p className="text-[10.5px] sm:text-xs font-bold text-zinc-200 mt-1 drop-shadow-[0_1px_4px_rgba(0,0,0,0.98)]">
                ${LIFETIME_PRICE_CAD} Lifetime • {MIN_CONFIRMED_REFERRALS} Paid
                Unlock →{" "}
                <strong className="text-emerald-300">
                  ${PAYOUT_PER_EXTRA_REFERRAL_CAD}/friend
                </strong>{" "}
                • After {STEP_UP_CONFIRMED_THRESHOLD} Paid →{" "}
                <strong className="text-amber-300">
                  ${STEP_UP_PAYOUT_CAD}/friend (No Limit!)
                </strong>
              </p>
            </div>
          </div>

          {/* Feedback Toast */}
          {feedback && (
            <div
              className={`shrink-0 rounded-xl border px-3.5 py-2 text-center text-xs font-extrabold shadow-lg ${
                feedback.type === "ok"
                  ? "bg-emerald-950/90 border-emerald-400/55 text-emerald-200"
                  : "bg-red-950/90 border-red-400/55 text-red-200"
              }`}
            >
              {feedback.text}
            </div>
          )}

          {/* 3 ARMORED NAVIGATION TABS */}
          <div className="shrink-0 grid grid-cols-3 gap-2">
            {(
              [
                { id: "my_code", label: "🎁 My Code" },
                { id: "claim_code", label: "🎟️ Enter Code" },
                {
                  id: "my_friends",
                  label: `👥 Referrals (${mySummary?.referrals.length || 0})`,
                },
              ] as { id: ModalTab; label: string }[]
            ).map((t) => (
              <ReferralArmoredBtn
                key={t.id}
                variant={activeTab === t.id ? "tab_active" : "tab_idle"}
                onClick={() => setActiveTab(t.id)}
                className={`w-full px-2 ${
                  largeButtons ? "py-3 text-xs" : "py-2.5 text-[11px] sm:text-xs"
                } uppercase tracking-wide`}
              >
                <span className="truncate">{t.label}</span>
              </ReferralArmoredBtn>
            ))}
          </div>

          {/* SCROLLABLE MODAL BODY */}
          <div className="flex-1 overflow-y-auto space-y-3.5 pr-0.5 pb-1 scrollbar-none">
            {loading ? (
              <ReferralSectionCard className="py-10 text-center">
                <div className="mx-auto mb-2.5 h-7 w-7 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
                <p className="text-xs font-bold text-zinc-300">
                  Loading your referral dashboard…
                </p>
              </ReferralSectionCard>
            ) : activeTab === "my_code" ? (
              <>
                {/* Revoked Notice */}
                {mySummary?.revoked && (
                  <div className="rounded-2xl border-2 border-red-500/60 bg-red-950/65 p-4 text-xs text-red-200 space-y-1">
                    <p className="font-black text-red-300">
                      🚫 Referral Code Deactivated
                    </p>
                    <p>
                      Your referral link has been suspended by Admin and cannot
                      accept new signups.
                      {mySummary.revokedReason
                        ? ` Reason: ${mySummary.revokedReason}`
                        : ""}
                    </p>
                  </div>
                )}

                {/* HERO PERSONAL REFERRAL CODE VAULT CARD */}
                <ReferralSectionCard>
                  <div className="text-center space-y-3">
                    <div className="flex items-center justify-center gap-2 flex-wrap">
                      <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-zinc-300">
                        Your Personal Referral Code
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase border ${
                          isStepUp
                            ? "bg-amber-500/25 border-amber-400/60 text-amber-300"
                            : "bg-cyan-500/15 border-cyan-400/45 text-cyan-200"
                        }`}
                      >
                        {isStepUp
                          ? `🏆 VIP Tier: $${STEP_UP_PAYOUT_CAD}/Friend`
                          : `Active Rate: $${PAYOUT_PER_EXTRA_REFERRAL_CAD}/Friend`}
                      </span>
                    </div>

                    {/* Dedicated Amber-Trimmed Steel Vault Display Window */}
                    <div className="rabtv-ref-code-vault">
                      <div
                        className="rabtv-ref-code-vault-bg"
                        aria-hidden="true"
                        style={{
                          backgroundImage: `url(${IMG_REF_CODE_CARD})`,
                        }}
                      />
                      <span
                        className={`relative z-10 font-mono text-2xl sm:text-3xl font-black tracking-widest drop-shadow-[0_2px_10px_rgba(245,158,11,0.55)] ${
                          mySummary?.revoked
                            ? "text-red-400 line-through opacity-60"
                            : "text-amber-300"
                        }`}
                      >
                        {myCode}
                      </span>
                    </div>

                    {/* Armored Primary & Emerald WhatsApp Action Buttons */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-w-md mx-auto pt-1">
                      <ReferralArmoredBtn
                        variant="primary"
                        disabled={Boolean(mySummary?.revoked)}
                        onClick={() => void handleCopyCode()}
                        className={`w-full px-5 ${
                          largeButtons ? "py-3.5 text-sm" : "py-3 text-xs"
                        } uppercase tracking-wider`}
                      >
                        <span>{copiedCode ? "✓ Copied!" : "📋 Copy Code"}</span>
                      </ReferralArmoredBtn>

                      <ReferralArmoredBtn
                        variant="emerald"
                        disabled={Boolean(mySummary?.revoked)}
                        onClick={handleWhatsAppShare}
                        className={`w-full px-5 ${
                          largeButtons ? "py-3.5 text-sm" : "py-3 text-xs"
                        } uppercase tracking-wider`}
                      >
                        <span>💬 Share on WhatsApp</span>
                      </ReferralArmoredBtn>
                    </div>
                  </div>
                </ReferralSectionCard>

                {/* DUAL-STAGE PROGRESS TRACKER WITH RIVETED STEEL GAUGE */}
                <ReferralSectionCard>
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2 text-xs font-extrabold">
                      <span className="text-white leading-snug">
                        {!isUnlocked
                          ? `Unlock Progress: ${confirmedCount} / ${MIN_CONFIRMED_REFERRALS} Confirmed Paid Friends`
                          : isStepUp
                            ? `🏆 VIP Tier Active! Earning $${STEP_UP_PAYOUT_CAD}/friend (Unlimited!)`
                            : `🚀 Step-Up to $${STEP_UP_PAYOUT_CAD}/Friend: ${confirmedCount} / ${STEP_UP_CONFIRMED_THRESHOLD} Confirmed`}
                      </span>
                      <span
                        className={`shrink-0 font-black ${
                          isUnlocked ? "text-amber-300" : "text-emerald-300"
                        }`}
                      >
                        {activeProgressPct}%
                      </span>
                    </div>

                    {/* Riveted Metallic Progress Bar Housing */}
                    <div
                      className="rabtv-ref-progress-housing"
                      role="progressbar"
                      aria-valuenow={activeProgressPct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div
                        className="rabtv-ref-progress-track-art"
                        aria-hidden="true"
                        style={{
                          backgroundImage: `url(${IMG_REF_PROGRESS_TRACK})`,
                        }}
                      />
                      <div className="rabtv-ref-progress-channel">
                        <div
                          className={`h-full rounded-[4px] bg-gradient-to-r from-emerald-400 via-cyan-400 to-amber-400 shadow-[0_0_12px_rgba(52,211,153,0.9)] ${
                            reducedMotion ? "" : "transition-all duration-500"
                          }`}
                          style={{
                            width: `${Math.max(4, activeProgressPct)}%`,
                          }}
                        />
                      </div>
                    </div>

                    <p className="text-[11px] text-zinc-300 leading-relaxed">
                      {!isUnlocked ? (
                        <>
                          Invite{" "}
                          <strong className="text-white">
                            {mySummary?.remainingToUnlock ??
                              MIN_CONFIRMED_REFERRALS}
                          </strong>{" "}
                          more paid friend
                          {(mySummary?.remainingToUnlock ??
                            MIN_CONFIRMED_REFERRALS) === 1
                            ? ""
                            : "s"}{" "}
                          (${LIFETIME_PRICE_CAD} lifetime each) to unlock{" "}
                          <strong className="text-emerald-300">
                            ${PAYOUT_PER_EXTRA_REFERRAL_CAD}
                          </strong>{" "}
                          cash payouts—and step up to{" "}
                          <strong className="text-amber-300">
                            ${STEP_UP_PAYOUT_CAD}/friend
                          </strong>{" "}
                          after {STEP_UP_CONFIRMED_THRESHOLD} confirmed!
                        </>
                      ) : isStepUp ? (
                        <>
                          You have {confirmedCount} confirmed paid friends (
                          {mySummary?.tier1BillableCount || 0} at $
                          {PAYOUT_PER_EXTRA_REFERRAL_CAD} +{" "}
                          {mySummary?.tier2BillableCount || 0} at $
                          {STEP_UP_PAYOUT_CAD}). Every new confirmed friend now
                          pays ${STEP_UP_PAYOUT_CAD}!
                        </>
                      ) : (
                        <>
                          Payouts unlocked! You earn $
                          {PAYOUT_PER_EXTRA_REFERRAL_CAD}/friend now, and only{" "}
                          {mySummary?.remainingToStepUp || 0} more confirmed
                          friends unlock ${STEP_UP_PAYOUT_CAD}/friend forever.
                        </>
                      )}
                    </p>
                  </div>
                </ReferralSectionCard>

                {/* 4 ARMORED EARNINGS SUMMARY KPI CARDS */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <ReferralSectionCard variant="stat" className="text-center">
                    <span className="block text-[9.5px] font-extrabold uppercase tracking-wider text-zinc-400">
                      Confirmed Paid
                    </span>
                    <strong className="block text-xl font-black text-white mt-0.5">
                      {confirmedCount}
                    </strong>
                    <span className="block text-[10px] font-bold text-amber-300">
                      {mySummary?.pendingCount || 0} awaiting
                    </span>
                  </ReferralSectionCard>

                  <ReferralSectionCard variant="stat" className="text-center">
                    <span className="block text-[9.5px] font-extrabold uppercase tracking-wider text-zinc-400">
                      Total Earned
                    </span>
                    <strong className="block text-xl font-black text-cyan-300 mt-0.5">
                      ${(mySummary?.totalEarned || 0).toFixed(2)}
                    </strong>
                    <span className="block text-[10px] font-bold text-zinc-400">
                      {mySummary?.billableReferrals || 0} billable
                    </span>
                  </ReferralSectionCard>

                  <ReferralSectionCard variant="stat" className="text-center">
                    <span className="block text-[9.5px] font-extrabold uppercase tracking-wider text-zinc-400">
                      Reimbursed
                    </span>
                    <strong className="block text-xl font-black text-zinc-100 mt-0.5">
                      ${(mySummary?.totalPaidOut || 0).toFixed(2)}
                    </strong>
                    <span className="block text-[10px] font-bold text-zinc-400">
                      {mySummary?.reimbursedCount || 0} paid off
                    </span>
                  </ReferralSectionCard>

                  <ReferralSectionCard variant="stat" className="text-center">
                    <span className="block text-[9.5px] font-extrabold uppercase tracking-wider text-emerald-300">
                      Owed to You
                    </span>
                    <strong className="block text-xl font-black text-emerald-300 mt-0.5">
                      ${(mySummary?.balanceOwed || 0).toFixed(2)}
                    </strong>
                    <span className="block text-[10px] font-bold text-emerald-200/80">
                      {mySummary?.unreimbursedCount || 0} unpaid
                    </span>
                  </ReferralSectionCard>
                </div>

                {/* PAYOUT METHOD & DETAILS FORM */}
                <ReferralSectionCard>
                  <form
                    onSubmit={handleSavePayoutDetails}
                    className="space-y-3"
                  >
                    <div>
                      <label className="block text-xs font-extrabold text-zinc-100 mb-2">
                        💳 Preferred Payout Method (Sent straight to Admin):
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {PAYOUT_METHODS.map((method) => (
                          <ReferralArmoredBtn
                            key={method}
                            variant={
                              payoutMethod === method
                                ? "tab_active"
                                : "tab_idle"
                            }
                            onClick={() => setPayoutMethod(method)}
                            className="w-full py-2.5 px-2 text-[11px] sm:text-xs"
                          >
                            <span className="truncate">
                              {getPayoutMethodIcon(method)} {method}
                            </span>
                          </ReferralArmoredBtn>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
                      <div className="rabtv-ref-input-shell flex-1 rounded-xl">
                        <div
                          className="rabtv-ref-input-9slice"
                          aria-hidden="true"
                        />
                        <input
                          type="text"
                          dir="ltr"
                          value={payoutInfo}
                          onChange={(e) => setPayoutInfo(e.target.value)}
                          placeholder={getPayoutPlaceholder(payoutMethod)}
                          style={{
                            direction: "ltr",
                            unicodeBidi: "plaintext",
                            textAlign: "left",
                          }}
                          className="relative z-10 w-full h-11 bg-transparent px-4 text-xs font-bold text-white placeholder-zinc-400 focus:outline-none"
                        />
                      </div>

                      <ReferralArmoredBtn
                        type="submit"
                        variant="primary"
                        disabled={busy}
                        className="px-5 py-3 text-xs uppercase tracking-wider shrink-0"
                      >
                        <span>
                          {busy ? "Saving..." : "💾 Save Payout Info"}
                        </span>
                      </ReferralArmoredBtn>
                    </div>
                  </form>
                </ReferralSectionCard>
              </>
            ) : activeTab === "claim_code" ? (
              <div className="space-y-3.5">
                {claimedCode ? (
                  <ReferralSectionCard className="text-center">
                    <div className="py-4 space-y-2">
                      <div className="text-3xl">✅</div>
                      <h4 className="text-sm sm:text-base font-black text-emerald-300">
                        Referral Code Submitted!
                      </h4>
                      <p className="text-xs text-zinc-300 max-w-md mx-auto leading-relaxed">
                        This device is linked to code{" "}
                        <strong className="font-mono text-amber-300">
                          {claimedCode}
                        </strong>
                        . Once your ${LIFETIME_PRICE_CAD} lifetime payment is
                        confirmed, your friend receives credit automatically.
                      </p>
                    </div>
                  </ReferralSectionCard>
                ) : (
                  <ReferralSectionCard>
                    <form
                      onSubmit={handleClaimFriendCode}
                      className="space-y-3.5"
                    >
                      <div>
                        <h4 className="text-sm sm:text-base font-black text-white">
                          Did a friend invite you to RABBiT TV?
                        </h4>
                        <p className="text-xs text-zinc-300 mt-1 leading-relaxed">
                          Enter their referral code below so they get credit
                          once your ${LIFETIME_PRICE_CAD} lifetime subscription
                          is confirmed.
                        </p>
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-[10.5px] font-extrabold uppercase tracking-wider text-zinc-300">
                          Friend&apos;s Referral Code
                        </label>
                        <div className="rabtv-ref-input-shell rounded-xl">
                          <div
                            className="rabtv-ref-input-9slice"
                            aria-hidden="true"
                          />
                          <input
                            type="text"
                            dir="ltr"
                            value={friendCodeInput}
                            onChange={(e) =>
                              setFriendCodeInput(e.target.value.toUpperCase())
                            }
                            placeholder="e.g. RAB-KYLE-8F2A"
                            style={{
                              direction: "ltr",
                              unicodeBidi: "plaintext",
                              textAlign: "left",
                            }}
                            className="relative z-10 w-full h-11 bg-transparent px-4 font-mono text-sm font-black text-amber-300 placeholder-zinc-500 focus:outline-none"
                            required
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-[10.5px] font-extrabold uppercase tracking-wider text-zinc-300">
                          Your Name / Contact Note (Helps confirm your $
                          {LIFETIME_PRICE_CAD} payment)
                        </label>
                        <div className="rabtv-ref-input-shell rounded-xl">
                          <div
                            className="rabtv-ref-input-9slice"
                            aria-hidden="true"
                          />
                          <input
                            type="text"
                            dir="ltr"
                            value={claimContactInput}
                            onChange={(e) =>
                              setClaimContactInput(e.target.value)
                            }
                            placeholder="Optional: phone or e-Transfer name"
                            style={{
                              direction: "ltr",
                              unicodeBidi: "plaintext",
                              textAlign: "left",
                            }}
                            className="relative z-10 w-full h-11 bg-transparent px-4 text-xs font-bold text-white placeholder-zinc-400 focus:outline-none"
                          />
                        </div>
                      </div>

                      <ReferralArmoredBtn
                        type="submit"
                        variant="primary"
                        disabled={busy || friendCodeInput.trim().length < 6}
                        className="w-full py-3.5 text-xs uppercase tracking-wider"
                      >
                        <span>
                          {busy ? "Submitting..." : "✓ Submit Friend's Code"}
                        </span>
                      </ReferralArmoredBtn>
                    </form>
                  </ReferralSectionCard>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {/* Invited Friends List */}
                <div className="space-y-2.5">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-zinc-300 px-1">
                    Friends Who Used Your Code (
                    {mySummary?.referrals.length || 0})
                  </h4>
                  {!mySummary || mySummary.referrals.length === 0 ? (
                    <ReferralSectionCard className="text-center">
                      <p className="py-3 text-xs text-zinc-300 leading-relaxed">
                        No friends have used your code yet. Share{" "}
                        <strong className="font-mono text-amber-300">
                          {myCode}
                        </strong>{" "}
                        to start building toward your {MIN_CONFIRMED_REFERRALS}
                        -friend unlock!
                      </p>
                    </ReferralSectionCard>
                  ) : (
                    mySummary.referrals.map((r) => {
                      const isScam =
                        r.status === "scam_attempt" || r.status === "rejected";
                      return (
                        <ReferralSectionCard key={r.id} variant="row">
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <div className="min-w-0">
                              <p className="font-extrabold text-white truncate">
                                👤 {r.referredName}
                                {r.confirmedSlotNumber !== null && (
                                  <span className="ml-1.5 text-[10px] font-mono text-zinc-400">
                                    #{r.confirmedSlotNumber}
                                  </span>
                                )}
                              </p>
                              <span className="text-[10px] text-zinc-400">
                                {new Date(r.createdAt).toLocaleDateString()} •{" "}
                                {formatAppTime(r.createdAt, clockFormat)}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {r.status === "confirmed_paid" ? (
                                r.payoutTier === "unlock_threshold" ? (
                                  <span className="rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase border bg-zinc-900/90 text-zinc-200 border-white/20">
                                    🔓 Unlock #{r.confirmedSlotNumber}/
                                    {MIN_CONFIRMED_REFERRALS}
                                  </span>
                                ) : r.isReimbursed ? (
                                  <span className="rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase border bg-cyan-500/20 text-cyan-200 border-cyan-400/45">
                                    ✓ Reimbursed (${r.payoutRate})
                                  </span>
                                ) : (
                                  <span className="rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase border bg-emerald-500/20 text-emerald-300 border-emerald-400/45">
                                    ✓ Paid (+${r.payoutRate} Owed)
                                  </span>
                                )
                              ) : isScam ? (
                                <span className="rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase border bg-red-500/20 text-red-300 border-red-400/40">
                                  🚫 Unpayable
                                </span>
                              ) : (
                                <span className="rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase border bg-amber-500/20 text-amber-300 border-amber-400/40">
                                  ⏳ Awaiting ${LIFETIME_PRICE_CAD}
                                </span>
                              )}
                            </div>
                          </div>
                        </ReferralSectionCard>
                      );
                    })
                  )}
                </div>

                {/* Payout Transfer History */}
                {mySummary && mySummary.payouts.length > 0 && (
                  <div className="space-y-2.5 pt-2 border-t border-white/10">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-emerald-300 px-1">
                      Payouts Received ({mySummary.payouts.length})
                    </h4>
                    {mySummary.payouts.map((p) => (
                      <ReferralSectionCard key={p.id} variant="row">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <div>
                            <strong className="text-emerald-300">
                              +${p.amount.toFixed(2)} ({p.method})
                            </strong>
                            {Array.isArray(p.reimbursedReferralIds) &&
                              p.reimbursedReferralIds.length > 0 && (
                                <span className="ml-2 text-[10px] text-cyan-300 font-bold">
                                  • {p.reimbursedReferralIds.length} account
                                  {p.reimbursedReferralIds.length === 1
                                    ? ""
                                    : "s"}{" "}
                                  reimbursed
                                </span>
                              )}
                            {p.note && (
                              <p className="text-[10px] text-zinc-300">
                                {p.note}
                              </p>
                            )}
                          </div>
                          <span className="text-[10px] text-zinc-400 shrink-0">
                            {new Date(p.paidAt).toLocaleDateString()}
                          </span>
                        </div>
                      </ReferralSectionCard>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
