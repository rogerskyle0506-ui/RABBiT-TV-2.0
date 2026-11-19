// src/components/AdminReferralModal.tsx
import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  LIFETIME_PRICE_CAD,
  MIN_CONFIRMED_REFERRALS,
  PAYOUT_PER_EXTRA_REFERRAL_CAD,
  STEP_UP_CONFIRMED_THRESHOLD,
  STEP_UP_PAYOUT_CAD,
  PAYOUT_METHODS,
  type PayoutMethod,
  type ReferralStatus,
  fetchReferralSystemData,
  getAllReferrerSummaries,
  computeFleetReferralTotals,
  previewPayoutAllocation,
  adminUpdateReferralStatus,
  adminToggleReferrerRevoked,
  adminRecordPayout,
  adminAddManualReferral,
  type ReferralSystemData,
  type ReferrerSummary,
} from "@/lib/referrals";
import { getClockFormat, formatAppTime } from "@/lib/settings";

interface AdminReferralModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type AdminTab = "referrers" | "pending" | "scams";
type SubFilter = "all" | "paid" | "pending" | "scam" | "reimbursed";

function methodIcon(method: PayoutMethod | string): string {
  const m = String(method || "").toLowerCase();
  if (m === "paypal") return "🅿️";
  if (m === "cash") return "💵";
  return "🏦";
}

export function AdminReferralModal({
  isOpen,
  onClose,
}: AdminReferralModalProps) {
  const [data, setData] = useState<ReferralSystemData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTab>("referrers");
  const [searchQuery, setSearchQuery] = useState("");
  const [toast, setToast] = useState<{
    type: "info" | "warn";
    text: string;
  } | null>(null);

  // Per-user expandable referral list state
  const [expandedCode, setExpandedCode] = useState<string | null>(null);
  const [subFilter, setSubFilter] = useState<SubFilter>("all");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Inline FIFO payout form state
  const [payingCode, setPayingCode] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState<string>("");
  const [payMethod, setPayMethod] = useState<PayoutMethod>("e-Transfer");
  const [payNote, setPayNote] = useState<string>("");
  const [overrideOverpay, setOverrideOverpay] = useState<boolean>(false);

  // Quick manual referral entry (when a friend pays cash in person)
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [manualFriendName, setManualFriendName] = useState("");
  const [manualContact, setManualContact] = useState("");

  const clockFormat = getClockFormat();

  const flashToast = (text: string, type: "info" | "warn" = "info") => {
    setToast({ type, text });
    window.setTimeout(() => setToast(null), 4500);
  };

  const loadData = useCallback(async (force = true) => {
    setLoading(true);
    const fresh = await fetchReferralSystemData(force);
    setData(fresh);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    void loadData(true);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, loadData, onClose]);

  const totals = useMemo(
    () => (data ? computeFleetReferralTotals(data) : null),
    [data]
  );

  const summaries = useMemo<ReferrerSummary[]>(
    () => (data ? getAllReferrerSummaries(data) : []),
    [data]
  );

  const pendingReferrals = useMemo(() => {
    if (!data) return [];
    return data.referrals.filter((r) => r.status === "pending");
  }, [data]);

  const scamWatchReferrers = useMemo(() => {
    return summaries
      .filter((s) => s.scamCount > 0 || s.revoked)
      .sort((a, b) => {
        if (b.scamRatePct !== a.scamRatePct) return b.scamRatePct - a.scamRatePct;
        return b.scamCount - a.scamCount;
      });
  }, [summaries]);

  const filteredSummaries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return summaries;
    return summaries.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        s.payoutMethod.toLowerCase().includes(q) ||
        s.payoutInfo.toLowerCase().includes(q) ||
        s.referrals.some((r) => r.referredName.toLowerCase().includes(q))
    );
  }, [summaries, searchQuery]);

  if (!isOpen) return null;

  const handleCopyText = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(id);
      window.setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      // ignore clipboard errors on TV WebViews
    }
  };

  const handleSetStatus = async (id: string, status: ReferralStatus) => {
    setBusyId(id);
    const res = await adminUpdateReferralStatus(id, status);
    setBusyId(null);
    if (res.ok && res.data) {
      setData({ ...res.data });
      if (res.warning) {
        flashToast(`⚠️ ${res.warning}`, "warn");
      } else {
        flashToast(
          status === "confirmed_paid"
            ? `✓ Marked $${LIFETIME_PRICE_CAD} Confirmed Paid!`
            : status === "scam_attempt"
              ? "🚨 Flagged as Scam Attempt (Unpayable & tracked against referrer)."
              : "⏳ Set to Awaiting Payment Approval."
        );
      }
    } else {
      flashToast("⚠️ Could not update Gist. Check connection.", "warn");
    }
  };

  const handleToggleRevoke = async (s: ReferrerSummary) => {
    setBusyId(`revoke-${s.code}`);
    const nextRevoked = !s.revoked;
    const reason = nextRevoked
      ? `Revoked by Admin (${s.scamCount} scam attempt${
          s.scamCount === 1 ? "" : "s"
        } / ${s.scamRatePct}%)`
      : undefined;
    const res = await adminToggleReferrerRevoked(s.code, nextRevoked, reason);
    setBusyId(null);
    if (res.ok && res.data) {
      setData({ ...res.data });
      flashToast(res.message, nextRevoked ? "warn" : "info");
    } else {
      flashToast(`⚠️ ${res.message}`, "warn");
    }
  };

  const handleOpenPayoutForm = (s: ReferrerSummary) => {
    if (payingCode === s.code) {
      setPayingCode(null);
      return;
    }
    setPayingCode(s.code);
    setPayAmount(
      String(s.balanceOwed > 0 ? s.balanceOwed : s.nextPayoutRate)
    );
    setPayMethod(s.payoutMethod);
    setPayNote("");
    setOverrideOverpay(false);
  };

  const handleSubmitPayout = async (e: React.FormEvent, s: ReferrerSummary) => {
    e.preventDefault();
    const numericAmount = parseFloat(payAmount);
    const preview = previewPayoutAllocation(s, numericAmount);

    if (preview.isOverpayment && !overrideOverpay) {
      flashToast(
        "⚠️ Overpayment blocked! Check the override box only if you intentionally want to pay more than owed.",
        "warn"
      );
      return;
    }

    setBusyId(`pay-${s.code}`);
    const res = await adminRecordPayout({
      referrerCode: s.code,
      amount: numericAmount,
      method: payMethod,
      note: payNote,
      allowOverpaymentOverride: overrideOverpay,
    });
    setBusyId(null);

    if (res.ok && res.data) {
      setData({ ...res.data });
      setPayingCode(null);
      setOverrideOverpay(false);
      flashToast(`💸 ${res.message}`);
    } else {
      flashToast(`⚠️ ${res.message}`, "warn");
    }
  };

  const handleSubmitManualReferral = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusyId("manual");
    const res = await adminAddManualReferral({
      referrerCode: manualCode,
      referredName: manualFriendName,
      referredContact: manualContact,
      markPaidImmediately: true,
    });
    setBusyId(null);
    if (res.ok && res.data) {
      setData({ ...res.data });
      setManualFriendName("");
      setManualContact("");
      setShowManualForm(false);
      flashToast(`✓ ${res.message}`);
    } else {
      flashToast(`⚠️ ${res.message}`, "warn");
    }
  };

  const handleExportLedger = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rabtv_referral_ledger_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    flashToast("💾 Exported full referral & scam audit ledger JSON!");
  };

  const renderReferrerCard = (s: ReferrerSummary) => {
    const isExpanded = expandedCode === s.code;
    const isPaying = payingCode === s.code;
    const payoutPreview = isPaying
      ? previewPayoutAllocation(s, parseFloat(payAmount))
      : null;

    const filteredUserReferrals = s.referrals.filter((r) => {
      const isScam = r.status === "scam_attempt" || r.status === "rejected";
      if (subFilter === "paid") return r.status === "confirmed_paid";
      if (subFilter === "pending") return r.status === "pending";
      if (subFilter === "scam") return isScam;
      if (subFilter === "reimbursed") return r.isReimbursed;
      return true;
    });

    return (
      <div
        key={s.code}
        className={`rounded-2xl border p-4 space-y-3 ${
          s.revoked
            ? "border-red-500/60 bg-red-950/25"
            : s.isHighScamRisk
              ? "border-amber-500/60 bg-amber-950/15"
              : s.balanceOwed > 0
                ? "border-emerald-400/50 bg-emerald-950/15"
                : "border-white/10 bg-black/60"
        }`}
      >
        {/* Row 1: Referrer Identity, Tier, Scam Badges & Owed Balance */}
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <strong className="text-sm font-black text-white">{s.name}</strong>
              <span className="font-mono text-[11px] text-amber-300 bg-white/10 px-2 py-0.5 rounded">
                {s.code}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase border ${
                  s.isStepUpTier
                    ? "bg-amber-500/25 border-amber-400/60 text-amber-200"
                    : "bg-cyan-500/15 border-cyan-400/35 text-cyan-200"
                }`}
              >
                {s.isStepUpTier
                  ? `🏆 $${STEP_UP_PAYOUT_CAD}/Friend (100+)`
                  : `$${PAYOUT_PER_EXTRA_REFERRAL_CAD}/Friend`}
              </span>
              {s.revoked && (
                <span className="rounded-full px-2 py-0.5 text-[9px] font-black uppercase bg-red-600/80 text-white">
                  🚫 Link Revoked
                </span>
              )}
              {s.isHighScamRisk && (
                <span className="rounded-full px-2 py-0.5 text-[9px] font-black uppercase bg-red-950 border border-red-400/70 text-red-300">
                  ⚠️ High Scam Risk ({s.scamRatePct}%)
                </span>
              )}
            </div>

            {/* Payout Method + Details Immediately Visible */}
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="inline-flex items-center gap-1 rounded-lg bg-cyan-950/70 border border-cyan-400/35 px-2 py-0.5 font-extrabold text-cyan-200">
                {methodIcon(s.payoutMethod)} {s.payoutMethod}
              </span>
              <span className="text-slate-200 font-semibold break-all">
                {s.payoutInfo || "No payment details saved yet"}
              </span>
              {s.payoutInfo && (
                <button
                  type="button"
                  onClick={() => void handleCopyText(s.payoutInfo, s.code)}
                  className="rounded-md bg-white/10 hover:bg-white/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300 cursor-pointer"
                >
                  {copiedKey === s.code ? "✓ Copied" : "📋 Copy"}
                </button>
              )}
            </div>
          </div>

          <div className="text-right shrink-0">
            <span className="block text-[10px] uppercase font-bold text-slate-400">
              Owed Now
            </span>
            <strong
              className={`text-xl font-black ${
                s.balanceOwed > 0 ? "text-emerald-300" : "text-slate-400"
              }`}
            >
              ${s.balanceOwed.toFixed(2)}
            </strong>
            <span className="block text-[10px] text-slate-400">
              {s.unreimbursedCount} unpaid • {s.reimbursedCount} reimbursed
            </span>
          </div>
        </div>

        {/* Row 2: Live Counters + Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] border-t border-white/10 pt-2.5">
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-slate-300">
            <span>
              Paid: <strong className="text-emerald-300">{s.confirmedPaidCount}</strong>
            </span>
            <span>
              Awaiting: <strong className="text-amber-300">{s.pendingCount}</strong>
            </span>
            <span>
              Scams:{" "}
              <strong
                className={s.scamCount > 0 ? "text-red-400" : "text-slate-400"}
              >
                {s.scamCount} ({s.scamRatePct}%)
              </strong>
            </span>
            <span>
              Earned: <strong className="text-cyan-300">${s.totalEarned.toFixed(2)}</strong>
            </span>
            <span>
              Paid Out: <strong>${s.totalPaidOut.toFixed(2)}</strong>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setExpandedCode(isExpanded ? null : s.code);
                setSubFilter("all");
              }}
              className="rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 px-3 py-1.5 text-xs font-extrabold text-white cursor-pointer"
            >
              👥 Referrals ({s.referrals.length}) {isExpanded ? "▲" : "▼"}
            </button>

            <button
              type="button"
              onClick={() => handleOpenPayoutForm(s)}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-xs font-extrabold text-white cursor-pointer"
            >
              💸 Payout
            </button>

            <button
              type="button"
              disabled={busyId === `revoke-${s.code}`}
              onClick={() => void handleToggleRevoke(s)}
              className={`rounded-xl px-2.5 py-1.5 text-xs font-extrabold border cursor-pointer disabled:opacity-50 ${
                s.revoked
                  ? "bg-emerald-950/70 hover:bg-emerald-700 border-emerald-400/45 text-emerald-200"
                  : "bg-red-950/75 hover:bg-red-600 border-red-500/45 text-red-200 hover:text-white"
              }`}
            >
              {s.revoked ? "✅ Restore Link" : "🚫 Revoke Link"}
            </button>
          </div>
        </div>

        {/* INLINE FIFO PAYOUT & OVERPAYMENT GUARD PANEL */}
        {isPaying && payoutPreview && (
          <form
            onSubmit={(e) => void handleSubmitPayout(e, s)}
            className="rounded-2xl border border-emerald-400/40 bg-slate-950/90 p-3.5 space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <strong className="text-emerald-300">
                💸 Payout to {s.name} ({methodIcon(s.payoutMethod)}{" "}
                {s.payoutMethod}: {s.payoutInfo || "No details"})
              </strong>
              <div className="flex flex-wrap gap-1">
                {[5, 10, 20, 50].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => {
                      setPayAmount(String(amt));
                      setOverrideOverpay(false);
                    }}
                    className="rounded-lg bg-white/10 hover:bg-white/20 px-2 py-0.5 text-[10px] font-bold text-slate-200 cursor-pointer"
                  >
                    ${amt}
                  </button>
                ))}
                {s.balanceOwed > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setPayAmount(String(s.balanceOwed));
                      setOverrideOverpay(false);
                    }}
                    className="rounded-lg bg-emerald-600/40 hover:bg-emerald-600 px-2 py-0.5 text-[10px] font-extrabold text-emerald-100 cursor-pointer"
                  >
                    Full (${s.balanceOwed.toFixed(2)})
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={payAmount}
                onChange={(e) => {
                  setPayAmount(e.target.value);
                  setOverrideOverpay(false);
                }}
                placeholder="Amount ($)"
                required
                className="rounded-xl border border-white/15 bg-black/80 px-3 py-2 text-xs font-bold text-emerald-300"
              />
              <select
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value as PayoutMethod)}
                className="rounded-xl border border-white/15 bg-black/80 px-3 py-2 text-xs font-bold text-white"
              >
                {PAYOUT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {methodIcon(m)} {m}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={payNote}
                onChange={(e) => setPayNote(e.target.value)}
                placeholder="Transfer ref # / note"
                className="rounded-xl border border-white/15 bg-black/80 px-3 py-2 text-xs text-white"
              />
              <div className="flex gap-1.5">
                <button
                  type="submit"
                  disabled={
                    busyId === `pay-${s.code}` ||
                    (payoutPreview.isOverpayment && !overrideOverpay)
                  }
                  className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-xs font-extrabold text-white py-2 cursor-pointer"
                >
                  ✓ Mark Paid Out
                </button>
                <button
                  type="button"
                  onClick={() => setPayingCode(null)}
                  className="rounded-xl bg-white/10 px-2.5 text-xs text-slate-300 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Live FIFO Account Reimbursement Preview */}
            <div className="rounded-xl bg-black/70 border border-white/10 p-2.5 text-[11px] space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-1 font-bold">
                <span className="text-cyan-300">
                  ✓ Accounts to mark Reimbursed (
                  {payoutPreview.selectedReferrals.length} = $
                  {payoutPreview.coveredAmount.toFixed(2)}):
                </span>
                <span className="text-slate-400">
                  {payoutPreview.excludedScamOrPendingCount} scam/awaiting
                  strictly excluded
                </span>
              </div>

              {payoutPreview.selectedReferrals.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {payoutPreview.selectedReferrals.map((r) => (
                    <span
                      key={r.id}
                      className="rounded-lg bg-emerald-950/70 border border-emerald-500/35 px-2 py-0.5 text-[10px] font-bold text-emerald-200"
                    >
                      #{r.confirmedSlotNumber} {r.referredName} (${r.payoutRate})
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-slate-400">
                  No eligible unpaid confirmed accounts will be checked off at
                  this amount.
                </p>
              )}
            </div>

            {/* Warnings & Overpayment Protection */}
            {payoutPreview.warnings.length > 0 && (
              <div className="rounded-xl border-2 border-red-500/60 bg-red-950/55 p-3 space-y-2 text-xs text-red-100">
                {payoutPreview.warnings.map((w, idx) => (
                  <p key={idx} className="font-bold leading-snug">
                    🚨 {w}
                  </p>
                ))}

                {payoutPreview.isOverpayment && (
                  <label className="flex items-center gap-2 pt-1 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={overrideOverpay}
                      onChange={(e) => setOverrideOverpay(e.target.checked)}
                      className="h-4 w-4 accent-red-500 cursor-pointer"
                    />
                    <span className="text-[11px] font-extrabold text-amber-200">
                      I reviewed the warning (some accounts may already be paid
                      out) — override & save anyway
                    </span>
                  </label>
                )}
              </div>
            )}
          </form>
        )}

        {/* EXPANDED PER-USER REFERRALS BREAKDOWN */}
        {isExpanded && (
          <div className="pt-3 border-t border-white/15 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-amber-300">
                {s.name}&apos;s Referred Accounts ({s.referrals.length})
              </span>
              <div className="flex flex-wrap gap-1">
                {(
                  [
                    { id: "all", label: `All (${s.referrals.length})` },
                    { id: "paid", label: `Paid (${s.confirmedPaidCount})` },
                    { id: "pending", label: `Awaiting (${s.pendingCount})` },
                    { id: "scam", label: `Scams (${s.scamCount})` },
                    {
                      id: "reimbursed",
                      label: `Reimbursed (${s.reimbursedCount})`,
                    },
                  ] as { id: SubFilter; label: string }[]
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setSubFilter(f.id)}
                    className={`rounded-lg px-2 py-1 text-[10px] font-extrabold cursor-pointer ${
                      subFilter === f.id
                        ? "bg-amber-500 text-slate-950"
                        : "bg-black/70 border border-white/10 text-slate-300 hover:bg-white/10"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {filteredUserReferrals.length === 0 ? (
              <p className="text-center text-[11px] text-slate-400 py-3">
                No referrals match this filter.
              </p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1 scrollbar-none">
                {filteredUserReferrals.map((r) => {
                  const isScam =
                    r.status === "scam_attempt" || r.status === "rejected";
                  return (
                    <div
                      key={r.id}
                      className={`rounded-xl border px-3 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs ${
                        isScam
                          ? "border-red-500/40 bg-red-950/25"
                          : r.isReimbursed
                            ? "border-cyan-500/35 bg-cyan-950/20"
                            : r.status === "confirmed_paid"
                              ? "border-emerald-500/35 bg-emerald-950/20"
                              : "border-amber-500/30 bg-black/70"
                      }`}
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <strong className="text-white">
                            👤 {r.referredName}
                          </strong>
                          {r.confirmedSlotNumber !== null && (
                            <span className="font-mono text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-slate-200">
                              #{r.confirmedSlotNumber}
                            </span>
                          )}
                          {r.status === "confirmed_paid" ? (
                            r.payoutTier === "unlock_threshold" ? (
                              <span className="rounded-full px-2 py-0.5 text-[9px] font-black uppercase bg-slate-800 text-slate-200 border border-white/20">
                                🔓 Unlock #{r.confirmedSlotNumber}/
                                {MIN_CONFIRMED_REFERRALS} ($0)
                              </span>
                            ) : r.isReimbursed ? (
                              <span className="rounded-full px-2 py-0.5 text-[9px] font-black uppercase bg-cyan-500/25 text-cyan-200 border border-cyan-400/50">
                                ✓ Reimbursed (${r.reimbursedAmount ?? r.payoutRate})
                              </span>
                            ) : (
                              <span className="rounded-full px-2 py-0.5 text-[9px] font-black uppercase bg-emerald-500/25 text-emerald-200 border border-emerald-400/50">
                                ✓ Confirmed Paid (${r.payoutRate} Unpaid)
                              </span>
                            )
                          ) : isScam ? (
                            <span className="rounded-full px-2 py-0.5 text-[9px] font-black uppercase bg-red-600/80 text-white">
                              🚨 Scam Attempt (Unpayable)
                            </span>
                          ) : (
                            <span className="rounded-full px-2 py-0.5 text-[9px] font-black uppercase bg-amber-500/25 text-amber-200 border border-amber-400/50">
                              ⏳ Awaiting Payment
                            </span>
                          )}
                        </div>

                        {r.referredContact && (
                          <p className="text-[11px] text-cyan-300 font-semibold">
                            Note: {r.referredContact}
                          </p>
                        )}
                        <p className="text-[10px] text-slate-500">
                          Device: {r.referredDeviceId} •{" "}
                          {new Date(r.createdAt).toLocaleDateString()}{" "}
                          {formatAppTime(r.createdAt, clockFormat)}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-1 shrink-0">
                        <button
                          type="button"
                          disabled={
                            busyId === r.id || r.status === "confirmed_paid"
                          }
                          onClick={() =>
                            void handleSetStatus(r.id, "confirmed_paid")
                          }
                          className="rounded-lg bg-emerald-600/85 hover:bg-emerald-500 disabled:opacity-35 px-2.5 py-1 text-[10px] font-extrabold text-white cursor-pointer"
                        >
                          ✓ Mark Paid
                        </button>
                        <button
                          type="button"
                          disabled={busyId === r.id || r.status === "pending"}
                          onClick={() => void handleSetStatus(r.id, "pending")}
                          className="rounded-lg bg-amber-600/40 hover:bg-amber-600 disabled:opacity-35 border border-amber-400/40 px-2 py-1 text-[10px] font-bold text-amber-100 cursor-pointer"
                        >
                          ⏳ Awaiting
                        </button>
                        <button
                          type="button"
                          disabled={busyId === r.id || isScam}
                          onClick={() =>
                            void handleSetStatus(r.id, "scam_attempt")
                          }
                          className="rounded-lg bg-red-900/80 hover:bg-red-600 disabled:opacity-35 border border-red-500/50 px-2 py-1 text-[10px] font-extrabold text-red-100 cursor-pointer"
                        >
                          🚨 Scam
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="rabtv-vidsrc-protected fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-3 sm:p-5 backdrop-blur-xl overflow-y-auto">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      <div className="relative z-10 w-full max-w-4xl rounded-[28px] border-2 border-amber-500/45 bg-slate-950/95 text-white shadow-[0_25px_80px_rgba(0,0,0,0.95)] max-h-[90dvh] flex flex-col overflow-hidden">
        {/* Top Header */}
        <div className="p-4 sm:p-5 border-b border-white/10 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-lg font-black text-amber-300">
                💰 Admin Referral, Scam & Payout Ledger
              </h3>
              <p className="text-[11px] text-slate-400">
                ${LIFETIME_PRICE_CAD} Lifetime • {MIN_CONFIRMED_REFERRALS} Min →{" "}
                ${PAYOUT_PER_EXTRA_REFERRAL_CAD} (#6–#{STEP_UP_CONFIRMED_THRESHOLD})
                → ${STEP_UP_PAYOUT_CAD} (#{STEP_UP_CONFIRMED_THRESHOLD + 1}+,
                Unlimited)
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowManualForm((v) => !v)}
                className="rounded-xl bg-emerald-600/25 hover:bg-emerald-600/45 border border-emerald-400/45 px-3 py-1.5 text-xs font-extrabold text-emerald-200 cursor-pointer"
              >
                + Add Cash Referral
              </button>
              <button
                type="button"
                onClick={handleExportLedger}
                className="rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 px-3 py-1.5 text-xs font-bold text-slate-200 cursor-pointer"
              >
                💾 Export
              </button>
              <button
                type="button"
                onClick={() => void loadData(true)}
                className="rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 px-3 py-1.5 text-xs font-bold text-cyan-300 cursor-pointer"
              >
                🔄 Sync
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl bg-red-600/80 hover:bg-red-500 px-3 py-1.5 text-xs font-extrabold text-white cursor-pointer"
              >
                ✕ Close
              </button>
            </div>
          </div>

          {toast && (
            <div
              className={`rounded-xl border px-3 py-2 text-xs font-extrabold ${
                toast.type === "warn"
                  ? "bg-red-950/85 border-red-400/60 text-red-200"
                  : "bg-cyan-950/80 border-cyan-400/50 text-cyan-200"
              }`}
            >
              {toast.text}
            </div>
          )}

          {/* KPI Strip */}
          {totals && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <div className="rounded-xl bg-black/60 border border-white/10 p-2 text-center">
                <span className="block text-[9px] uppercase font-bold text-slate-400">
                  Awaiting Pay
                </span>
                <strong className="text-base font-black text-amber-300">
                  {totals.pendingApprovals}
                </strong>
              </div>
              <div className="rounded-xl bg-black/60 border border-white/10 p-2 text-center">
                <span className="block text-[9px] uppercase font-bold text-slate-400">
                  Gross Revenue
                </span>
                <strong className="text-base font-black text-cyan-300">
                  ${totals.totalGrossRevenue.toFixed(0)}
                </strong>
                <span className="block text-[9px] text-slate-400">
                  {totals.totalConfirmedPaid} paid
                </span>
              </div>
              <div className="rounded-xl bg-black/60 border border-white/10 p-2 text-center">
                <span className="block text-[9px] uppercase font-bold text-slate-400">
                  Paid Out
                </span>
                <strong className="text-base font-black text-slate-200">
                  ${totals.totalPaidOut.toFixed(2)}
                </strong>
              </div>
              <div className="rounded-xl bg-emerald-950/35 border border-emerald-400/45 p-2 text-center">
                <span className="block text-[9px] uppercase font-bold text-emerald-300">
                  Owed Now
                </span>
                <strong className="text-base font-black text-emerald-300">
                  ${totals.totalOwedNow.toFixed(2)}
                </strong>
              </div>
              <div className="rounded-xl bg-red-950/40 border border-red-400/45 p-2 text-center col-span-2 sm:col-span-1">
                <span className="block text-[9px] uppercase font-bold text-red-300">
                  Scam Attempts
                </span>
                <strong className="text-base font-black text-red-300">
                  {totals.totalScamAttempts}
                </strong>
                <span className="block text-[9px] text-red-200/80">
                  {totals.revokedReferrers} revoked
                </span>
              </div>
            </div>
          )}

          {/* Manual Referral Form */}
          {showManualForm && (
            <form
              onSubmit={handleSubmitManualReferral}
              className="rounded-2xl border border-emerald-500/35 bg-emerald-950/20 p-3 grid grid-cols-1 sm:grid-cols-4 gap-2"
            >
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                placeholder="Referrer Code (RAB-...)"
                required
                className="rounded-xl border border-white/15 bg-black/75 px-3 py-2 font-mono text-xs text-amber-300"
              />
              <input
                type="text"
                value={manualFriendName}
                onChange={(e) => setManualFriendName(e.target.value)}
                placeholder="Paid Friend's Name"
                required
                className="rounded-xl border border-white/15 bg-black/75 px-3 py-2 text-xs text-white"
              />
              <input
                type="text"
                value={manualContact}
                onChange={(e) => setManualContact(e.target.value)}
                placeholder="Note (e.g. Cash $20)"
                className="rounded-xl border border-white/15 bg-black/75 px-3 py-2 text-xs text-white"
              />
              <button
                type="submit"
                disabled={busyId === "manual"}
                className="rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-extrabold text-white py-2 cursor-pointer"
              >
                ✓ Add Confirmed Paid
              </button>
            </form>
          )}

          {/* Tabs */}
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                {
                  id: "referrers",
                  label: `👥 Users & Payouts (${summaries.length})`,
                },
                {
                  id: "pending",
                  label: `⏳ Awaiting Pay (${pendingReferrals.length})`,
                },
                {
                  id: "scams",
                  label: `🚨 Scam Watch (${scamWatchReferrers.length})`,
                },
              ] as { id: AdminTab; label: string }[]
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`rounded-xl py-2 text-xs font-extrabold cursor-pointer transition ${
                  activeTab === t.id
                    ? "bg-gradient-to-r from-amber-500 to-orange-600 text-slate-950 shadow"
                    : "bg-black/60 border border-white/10 text-slate-300 hover:bg-white/10"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 scrollbar-none">
          {loading ? (
            <p className="py-12 text-center text-xs text-slate-400">
              Syncing live referral ledger…
            </p>
          ) : activeTab === "referrers" ? (
            <div className="space-y-3">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search referrer, referred friend, code, PayPal, or e-Transfer..."
                className="w-full rounded-xl border border-white/15 bg-black/75 px-3.5 py-2 text-xs font-bold text-white"
              />

              {filteredSummaries.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-black/50 p-8 text-center text-xs text-slate-400">
                  No referrers found.
                </div>
              ) : (
                filteredSummaries.map((s) => renderReferrerCard(s))
              )}
            </div>
          ) : activeTab === "pending" ? (
            pendingReferrals.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-black/50 p-8 text-center text-xs text-slate-400">
                No referrals currently awaiting $20 payment approval.
              </div>
            ) : (
              pendingReferrals.map((r) => (
                <div
                  key={r.id}
                  className="rounded-2xl border border-amber-500/30 bg-black/60 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="text-white text-sm">
                        👤 {r.referredName}
                      </strong>
                      <span className="text-slate-400">referred by</span>
                      <span className="font-extrabold text-amber-300">
                        {r.referrerName}
                      </span>
                      <span className="font-mono text-[10px] bg-white/10 px-1.5 py-0.5 rounded">
                        {r.referrerCode}
                      </span>
                    </div>
                    {r.referredContact && (
                      <p className="text-cyan-300 font-semibold">
                        Payment / Contact Note: {r.referredContact}
                      </p>
                    )}
                    <p className="text-[10px] text-slate-500">
                      Device: {r.referredDeviceId} •{" "}
                      {new Date(r.createdAt).toLocaleDateString()}{" "}
                      {formatAppTime(r.createdAt, clockFormat)}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() =>
                        void handleSetStatus(r.id, "confirmed_paid")
                      }
                      className="rounded-xl bg-emerald-600 hover:bg-emerald-500 px-3 py-2 text-xs font-extrabold text-white cursor-pointer disabled:opacity-50"
                    >
                      ✓ Mark ${LIFETIME_PRICE_CAD} Paid
                    </button>
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => void handleSetStatus(r.id, "scam_attempt")}
                      className="rounded-xl bg-red-900/80 hover:bg-red-600 border border-red-500/50 px-3 py-2 text-xs font-extrabold text-red-100 cursor-pointer disabled:opacity-50"
                    >
                      🚨 Mark Scam
                    </button>
                  </div>
                </div>
              ))
            )
          ) : scamWatchReferrers.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-black/50 p-8 text-center text-xs text-slate-400">
              No scam attempts or revoked referral links recorded.
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-[11px] text-red-200/90 bg-red-950/35 border border-red-500/35 rounded-xl px-3 py-2 font-semibold">
                🚨 Referrers with flagged scam attempts or revoked links are
                ranked by scam percentage below. Scam accounts are strictly
                excluded from all payouts.
              </p>
              {scamWatchReferrers.map((s) => renderReferrerCard(s))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
