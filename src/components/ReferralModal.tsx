// src/components/ReferralModal.tsx
import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  LIFETIME_PRICE_CAD,
  MIN_CONFIRMED_REFERRALS,
  PAYOUT_PER_EXTRA_REFERRAL_CAD,
  getOrCreateMyReferralCode,
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

interface ReferralModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ModalTab = "my_code" | "claim_code" | "my_friends";

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

  const showMessage = (type: "ok" | "err", text: string) => {
    setFeedback({ type, text });
    window.setTimeout(() => setFeedback(null), 4500);
  };

  const loadAll = useCallback(async (force = false) => {
    setLoading(true);
    try {
      const savedName =
        (typeof window !== "undefined"
          ? localStorage.getItem("rabtv_profile_name")
          : "") || "Member";
      const code = getOrCreateMyReferralCode(savedName);
      const savedPayout = getSavedPayoutInfo();

      setProfileName(savedName);
      setMyCode(code);
      setPayoutInfo(savedPayout);
      setClaimedCode(getClaimedReferralCode());

      const data = await fetchReferralSystemData(force);

      // Automatically register this user's referral code in Gist on first open
      if (!data.profiles[code]) {
        await registerOrUpdateMyReferrerProfile({
          name: savedName,
          payoutInfo: savedPayout,
        });
        const refreshed = await fetchReferralSystemData(true);
        setSystemData(refreshed);
      } else {
        setSystemData(data);
        if (!savedPayout && data.profiles[code]?.payoutInfo) {
          setPayoutInfo(data.profiles[code].payoutInfo || "");
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

  const themeTokens = useMemo(() => {
    switch (appTheme) {
      case "red":
        return {
          border:
            "border-red-500/45 shadow-[0_25px_75px_rgba(0,0,0,0.95),0_0_35px_rgba(239,68,68,0.28)]",
          btn: "bg-gradient-to-r from-red-600 via-rose-600 to-orange-600 text-white",
          laser: "from-red-500 via-amber-400 to-rose-500",
          accent: "text-red-300",
        };
      case "midnight":
        return {
          border:
            "border-sky-500/45 shadow-[0_25px_75px_rgba(0,0,0,0.95),0_0_35px_rgba(56,189,248,0.28)]",
          btn: "bg-gradient-to-r from-blue-600 via-cyan-600 to-sky-500 text-white",
          laser: "from-sky-400 via-cyan-300 to-blue-500",
          accent: "text-sky-300",
        };
      case "emerald":
        return {
          border:
            "border-emerald-500/45 shadow-[0_25px_75px_rgba(0,0,0,0.95),0_0_35px_rgba(16,185,129,0.28)]",
          btn: "bg-gradient-to-r from-emerald-600 via-teal-600 to-green-500 text-white",
          laser: "from-emerald-400 via-teal-300 to-cyan-400",
          accent: "text-emerald-300",
        };
      case "amber":
        return {
          border:
            "border-amber-500/45 shadow-[0_25px_75px_rgba(0,0,0,0.95),0_0_35px_rgba(245,158,11,0.28)]",
          btn: "bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500 text-slate-950",
          laser: "from-amber-400 via-yellow-300 to-orange-500",
          accent: "text-amber-300",
        };
      case "cyan":
        return {
          border:
            "border-cyan-500/45 shadow-[0_25px_75px_rgba(0,0,0,0.95),0_0_35px_rgba(34,211,238,0.28)]",
          btn: "bg-gradient-to-r from-cyan-500 via-teal-500 to-blue-600 text-white",
          laser: "from-cyan-400 via-sky-300 to-blue-500",
          accent: "text-cyan-300",
        };
      case "violet":
      default:
        return {
          border:
            "border-violet-500/45 shadow-[0_25px_75px_rgba(0,0,0,0.95),0_0_35px_rgba(168,85,247,0.28)]",
          btn: "bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 text-white",
          laser: "from-cyan-400 via-violet-400 to-pink-500",
          accent: "text-violet-300",
        };
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
      payoutInfo,
    });
    setBusy(false);
    if (res.ok) {
      showMessage("ok", "✓ Saved your payout details!");
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
  const progressSteps = Math.min(MIN_CONFIRMED_REFERRALS, confirmedCount);
  const progressPct = Math.round(
    (progressSteps / MIN_CONFIRMED_REFERRALS) * 100
  );

  return (
    <div className="rabtv-vidsrc-protected fixed inset-0 z-50 flex items-center justify-center bg-black/82 p-3 sm:p-5 backdrop-blur-xl overflow-y-auto">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      <div
        className={`relative z-10 w-full max-w-2xl rounded-[28px] border-2 bg-slate-950/94 ${
          isLowRam ? "" : "backdrop-blur-2xl"
        } text-white overflow-hidden max-h-[90dvh] flex flex-col ${themeTokens.border}`}
      >
        {/* Top & Bottom Neon Laser Accent */}
        <div
          className={`absolute inset-x-10 top-0 h-[2px] bg-gradient-to-r ${themeTokens.laser} pointer-events-none z-20`}
        />
        <div
          className={`absolute inset-x-10 bottom-0 h-[2px] bg-gradient-to-r ${themeTokens.laser} opacity-70 pointer-events-none z-20`}
        />

        {/* Header */}
        <div className="p-4 sm:p-5 pb-3.5 border-b border-white/10 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-base sm:text-lg font-black text-amber-300 flex items-center gap-2">
                <span>💸</span>
                <span>Refer Friends & Earn Cash</span>
              </h3>
              <p className="text-[11px] text-slate-400">
                ${LIFETIME_PRICE_CAD} Lifetime Access • Confirm {MIN_CONFIRMED_REFERRALS} paid friends, then earn{" "}
                <strong className="text-emerald-300">
                  ${PAYOUT_PER_EXTRA_REFERRAL_CAD} per friend
                </strong>{" "}
                afterwards!
              </p>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => void loadAll(true)}
                disabled={loading}
                className="rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 px-2.5 py-1.5 text-[11px] font-extrabold text-cyan-300 cursor-pointer disabled:opacity-50"
              >
                {loading ? "..." : "🔄 Sync"}
              </button>
              <button
                type="button"
                onClick={onClose}
                className={`rounded-xl bg-white/10 hover:bg-red-600/85 border border-white/15 ${
                  largeButtons ? "px-4 py-2 text-xs" : "px-3 py-1.5 text-xs"
                } font-extrabold text-slate-200 hover:text-white cursor-pointer`}
              >
                ✕ Close
              </button>
            </div>
          </div>

          {/* Feedback Toast */}
          {feedback && (
            <div
              className={`rounded-xl border px-3 py-2 text-xs font-bold ${
                feedback.type === "ok"
                  ? "bg-emerald-950/80 border-emerald-400/50 text-emerald-200"
                  : "bg-red-950/80 border-red-400/50 text-red-200"
              }`}
            >
              {feedback.text}
            </div>
          )}

          {/* Navigation Tabs */}
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { id: "my_code", label: "🎁 My Code & Pay" },
                { id: "claim_code", label: "🎟️ Enter Code" },
                {
                  id: "my_friends",
                  label: `👥 Referrals (${mySummary?.referrals.length || 0})`,
                },
              ] as { id: ModalTab; label: string }[]
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`rounded-xl ${
                  largeButtons ? "py-2.5 text-xs" : "py-2 text-[11px]"
                } font-extrabold transition cursor-pointer ${
                  activeTab === t.id
                    ? `${themeTokens.btn} shadow-lg`
                    : "bg-black/60 border border-white/10 text-slate-300 hover:bg-white/10"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 scrollbar-none">
          {loading ? (
            <div className="py-12 text-center text-xs font-bold text-slate-400">
              Loading your referral dashboard…
            </div>
          ) : activeTab === "my_code" ? (
            <>
              {/* Hero Code Card */}
              <div className="rounded-2xl border border-amber-400/35 bg-gradient-to-br from-slate-900 via-black to-slate-950 p-4 sm:p-5 text-center space-y-3 shadow-xl">
                <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-400">
                  Your Personal Referral Code
                </span>
                <div className="font-mono text-2xl sm:text-3xl font-black tracking-widest text-amber-300 drop-shadow">
                  {myCode}
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => void handleCopyCode()}
                    className={`rounded-xl px-4 ${
                      largeButtons ? "py-2.5 text-xs" : "py-2 text-xs"
                    } font-extrabold cursor-pointer transition ${themeTokens.btn}`}
                  >
                    {copiedCode ? "✓ Copied!" : "📋 Copy Code"}
                  </button>
                  <button
                    type="button"
                    onClick={handleWhatsAppShare}
                    className={`rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 ${
                      largeButtons ? "py-2.5 text-xs" : "py-2 text-xs"
                    } font-extrabold text-white cursor-pointer transition`}
                  >
                    💬 Share on WhatsApp
                  </button>
                </div>
              </div>

              {/* 5-Friend Unlock Progress Tracker */}
              <div className="rounded-2xl border border-white/10 bg-black/60 p-4 space-y-2.5">
                <div className="flex items-center justify-between text-xs font-extrabold">
                  <span className="text-white">
                    {mySummary?.isPayoutUnlocked
                      ? "🎉 Payouts Unlocked! Earning $5/friend now!"
                      : `Unlock Progress: ${progressSteps} / ${MIN_CONFIRMED_REFERRALS} Paid Friends`}
                  </span>
                  <span className="text-emerald-400">{progressPct}%</span>
                </div>

                <div className="h-2.5 w-full rounded-full bg-white/10 overflow-hidden">
                  <div
                    className={`h-full bg-gradient-to-r from-amber-400 via-emerald-400 to-cyan-400 ${
                      reducedMotion ? "" : "transition-all duration-500"
                    }`}
                    style={{ width: `${Math.max(4, progressPct)}%` }}
                  />
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {mySummary?.isPayoutUnlocked
                    ? `You have ${confirmedCount} confirmed paid friends (${mySummary.billableReferrals} past the ${MIN_CONFIRMED_REFERRALS}-friend minimum). Every new paid friend earns you $${PAYOUT_PER_EXTRA_REFERRAL_CAD}!`
                    : `Invite ${
                        mySummary?.remainingToUnlock ?? MIN_CONFIRMED_REFERRALS
                      } more paid friend${
                        (mySummary?.remainingToUnlock ?? MIN_CONFIRMED_REFERRALS) === 1
                          ? ""
                          : "s"
                      } ($${LIFETIME_PRICE_CAD} lifetime each) to unlock $${PAYOUT_PER_EXTRA_REFERRAL_CAD} cash payouts on every friend after that.`}
                </p>
              </div>

              {/* Earnings Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="rounded-2xl bg-black/60 border border-white/10 p-3 text-center">
                  <span className="block text-[10px] font-bold uppercase text-slate-400">
                    Confirmed Paid
                  </span>
                  <strong className="text-lg font-black text-white">
                    {confirmedCount}
                  </strong>
                  <span className="block text-[10px] text-amber-300">
                    {mySummary?.pendingCount || 0} pending
                  </span>
                </div>

                <div className="rounded-2xl bg-black/60 border border-white/10 p-3 text-center">
                  <span className="block text-[10px] font-bold uppercase text-slate-400">
                    Total Earned
                  </span>
                  <strong className="text-lg font-black text-cyan-300">
                    ${(mySummary?.totalEarned || 0).toFixed(2)}
                  </strong>
                  <span className="block text-[10px] text-slate-400">
                    {mySummary?.billableReferrals || 0} × ${PAYOUT_PER_EXTRA_REFERRAL_CAD}
                  </span>
                </div>

                <div className="rounded-2xl bg-black/60 border border-white/10 p-3 text-center">
                  <span className="block text-[10px] font-bold uppercase text-slate-400">
                    Paid Out
                  </span>
                  <strong className="text-lg font-black text-slate-200">
                    ${(mySummary?.totalPaidOut || 0).toFixed(2)}
                  </strong>
                  <span className="block text-[10px] text-slate-400">
                    {mySummary?.payouts.length || 0} transfers
                  </span>
                </div>

                <div className="rounded-2xl bg-emerald-950/40 border border-emerald-400/40 p-3 text-center">
                  <span className="block text-[10px] font-bold uppercase text-emerald-300">
                    Owed to You
                  </span>
                  <strong className="text-lg font-black text-emerald-300">
                    ${(mySummary?.balanceOwed || 0).toFixed(2)}
                  </strong>
                  <span className="block text-[10px] text-emerald-200/80">
                    Ready for payout
                  </span>
                </div>
              </div>

              {/* Payout Contact Info Form */}
              <form
                onSubmit={handleSavePayoutDetails}
                className="rounded-2xl border border-white/10 bg-black/55 p-4 space-y-2.5"
              >
                <label className="block text-xs font-extrabold text-slate-200">
                  💳 Where should we send your payouts? (e-Transfer email or phone)
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={payoutInfo}
                    onChange={(e) => setPayoutInfo(e.target.value)}
                    placeholder="e.g. yourname@email.com or Cash"
                    className="flex-1 rounded-xl border border-white/15 bg-slate-950 px-3 py-2 text-xs font-bold text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  />
                  <button
                    type="submit"
                    disabled={busy}
                    className="rounded-xl bg-white/15 hover:bg-white/25 border border-white/15 px-4 py-2 text-xs font-extrabold text-white cursor-pointer disabled:opacity-50"
                  >
                    {busy ? "Saving..." : "💾 Save"}
                  </button>
                </div>
              </form>
            </>
          ) : activeTab === "claim_code" ? (
            <div className="space-y-4">
              {claimedCode ? (
                <div className="rounded-2xl border border-emerald-400/40 bg-emerald-950/30 p-6 text-center space-y-2">
                  <div className="text-3xl">✅</div>
                  <h4 className="text-sm font-black text-emerald-300">
                    Referral Code Submitted!
                  </h4>
                  <p className="text-xs text-slate-300">
                    This device is linked to code{" "}
                    <strong className="font-mono text-amber-300">
                      {claimedCode}
                    </strong>
                    . Once your ${LIFETIME_PRICE_CAD} lifetime payment is confirmed, your friend receives credit automatically.
                  </p>
                </div>
              ) : (
                <form
                  onSubmit={handleClaimFriendCode}
                  className="rounded-2xl border border-white/15 bg-black/60 p-4 sm:p-5 space-y-3"
                >
                  <div>
                    <h4 className="text-sm font-black text-white">
                      Did a friend invite you to RABBiT TV?
                    </h4>
                    <p className="text-xs text-slate-400 mt-1">
                      Enter their referral code below so they get credit once your ${LIFETIME_PRICE_CAD} lifetime subscription is confirmed.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold uppercase text-slate-300">
                      Friend&apos;s Referral Code
                    </label>
                    <input
                      type="text"
                      value={friendCodeInput}
                      onChange={(e) =>
                        setFriendCodeInput(e.target.value.toUpperCase())
                      }
                      placeholder="e.g. RAB-KYLE-8F2A"
                      className="w-full rounded-xl border border-white/15 bg-slate-950 px-3.5 py-2.5 font-mono text-sm font-bold text-amber-300 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-400"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold uppercase text-slate-300">
                      Your Name / Contact Note (Helps confirm your $20 payment)
                    </label>
                    <input
                      type="text"
                      value={claimContactInput}
                      onChange={(e) => setClaimContactInput(e.target.value)}
                      placeholder="Optional: phone or e-Transfer name"
                      className="w-full rounded-xl border border-white/15 bg-slate-950 px-3.5 py-2.5 text-xs font-bold text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={busy || friendCodeInput.trim().length < 6}
                    className={`w-full rounded-xl py-3 text-xs font-black uppercase tracking-wider cursor-pointer disabled:opacity-50 ${themeTokens.btn}`}
                  >
                    {busy ? "Submitting..." : "✓ Submit Friend's Code"}
                  </button>
                </form>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Invited Friends List */}
              <div className="space-y-2">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                  Friends Who Used Your Code ({mySummary?.referrals.length || 0})
                </h4>
                {!mySummary || mySummary.referrals.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-black/50 p-6 text-center text-xs text-slate-400">
                    No friends have used your code yet. Share{" "}
                    <strong className="font-mono text-amber-300">{myCode}</strong>{" "}
                    to start building toward your {MIN_CONFIRMED_REFERRALS}-friend unlock!
                  </div>
                ) : (
                  mySummary.referrals.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/60 px-3.5 py-2.5 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="font-extrabold text-white truncate">
                          👤 {r.referredName}
                        </p>
                        <span className="text-[10px] text-slate-400">
                          {new Date(r.createdAt).toLocaleDateString()} •{" "}
                          {formatAppTime(r.createdAt, clockFormat)}
                        </span>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase border ${
                          r.status === "confirmed_paid"
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-400/40"
                            : r.status === "rejected"
                              ? "bg-red-500/20 text-red-300 border-red-400/40"
                              : "bg-amber-500/20 text-amber-300 border-amber-400/40"
                        }`}
                      >
                        {r.status === "confirmed_paid"
                          ? "✓ Confirmed Paid"
                          : r.status === "rejected"
                            ? "✕ Rejected"
                            : "⏳ Pending $20"}
                      </span>
                    </div>
                  ))
                )}
              </div>

              {/* Payout Transfer History */}
              {mySummary && mySummary.payouts.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-white/10">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-emerald-300">
                    Payouts Received ({mySummary.payouts.length})
                  </h4>
                  {mySummary.payouts.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between gap-2 rounded-xl border border-emerald-500/25 bg-emerald-950/20 px-3.5 py-2 text-xs"
                    >
                      <div>
                        <strong className="text-emerald-300">
                          +${p.amount.toFixed(2)} ({p.method})
                        </strong>
                        {p.note && (
                          <p className="text-[10px] text-slate-300">{p.note}</p>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {new Date(p.paidAt).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
