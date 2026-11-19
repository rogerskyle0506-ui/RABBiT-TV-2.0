// src/components/AdminReferralModal.tsx
import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  LIFETIME_PRICE_CAD,
  MIN_CONFIRMED_REFERRALS,
  PAYOUT_PER_EXTRA_REFERRAL_CAD,
  fetchReferralSystemData,
  getAllReferrerSummaries,
  computeFleetReferralTotals,
  adminUpdateReferralStatus,
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

type AdminTab = "pending" | "payouts" | "all";

export function AdminReferralModal({
  isOpen,
  onClose,
}: AdminReferralModalProps) {
  const [data, setData] = useState<ReferralSystemData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTab>("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  // Inline payout form state
  const [payingCode, setPayingCode] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState<string>("");
  const [payMethod, setPayMethod] = useState<string>("e-Transfer");
  const [payNote, setPayNote] = useState<string>("");

  // Quick manual referral entry (when a friend pays cash in person)
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [manualFriendName, setManualFriendName] = useState("");
  const [manualContact, setManualContact] = useState("");

  const clockFormat = getClockFormat();

  const flashToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3500);
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

  const filteredSummaries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return summaries;
    return summaries.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        s.payoutInfo.toLowerCase().includes(q)
    );
  }, [summaries, searchQuery]);

  if (!isOpen) return null;

  const handleSetStatus = async (
    id: string,
    status: "confirmed_paid" | "rejected" | "pending"
  ) => {
    setBusyId(id);
    const res = await adminUpdateReferralStatus(id, status);
    setBusyId(null);
    if (res.ok && res.data) {
      setData({ ...res.data });
      flashToast(
        status === "confirmed_paid"
          ? "✓ Marked $20 Paid & Confirmed!"
          : status === "rejected"
            ? "✕ Referral rejected."
            : "↺ Reverted to Pending."
      );
    } else {
      flashToast("⚠️ Could not update Gist. Check connection.");
    }
  };

  const handleOpenPayoutForm = (s: ReferrerSummary) => {
    setPayingCode(s.code);
    setPayAmount(String(s.balanceOwed > 0 ? s.balanceOwed : PAYOUT_PER_EXTRA_REFERRAL_CAD));
    setPayMethod("e-Transfer");
    setPayNote("");
  };

  const handleSubmitPayout = async (e: React.FormEvent, code: string) => {
    e.preventDefault();
    setBusyId(code);
    const res = await adminRecordPayout({
      referrerCode: code,
      amount: parseFloat(payAmount),
      method: payMethod,
      note: payNote,
    });
    setBusyId(null);
    if (res.ok && res.data) {
      setData({ ...res.data });
      setPayingCode(null);
      flashToast(`💸 ${res.message}`);
    } else {
      flashToast(`⚠️ ${res.message}`);
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
      flashToast(`⚠️ ${res.message}`);
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
    flashToast("💾 Exported referral ledger JSON!");
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
                💰 Admin Referral & Payout Ledger
              </h3>
              <p className="text-[11px] text-slate-400">
                ${LIFETIME_PRICE_CAD} Lifetime • {MIN_CONFIRMED_REFERRALS} Confirmed Min → ${PAYOUT_PER_EXTRA_REFERRAL_CAD} Owed Per Extra Paid Friend
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
            <div className="rounded-xl bg-cyan-950/80 border border-cyan-400/50 px-3 py-2 text-xs font-extrabold text-cyan-200">
              {toast}
            </div>
          )}

          {/* KPI Strip */}
          {totals && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="rounded-xl bg-black/60 border border-white/10 p-2.5 text-center">
                <span className="block text-[10px] uppercase font-bold text-slate-400">
                  Pending Review
                </span>
                <strong className="text-lg font-black text-amber-300">
                  {totals.pendingApprovals}
                </strong>
              </div>
              <div className="rounded-xl bg-black/60 border border-white/10 p-2.5 text-center">
                <span className="block text-[10px] uppercase font-bold text-slate-400">
                  Gross Revenue
                </span>
                <strong className="text-lg font-black text-cyan-300">
                  ${totals.totalGrossRevenue.toFixed(0)}
                </strong>
                <span className="block text-[10px] text-slate-400">
                  {totals.totalConfirmedPaid} paid
                </span>
              </div>
              <div className="rounded-xl bg-black/60 border border-white/10 p-2.5 text-center">
                <span className="block text-[10px] uppercase font-bold text-slate-400">
                  Total Paid Out
                </span>
                <strong className="text-lg font-black text-slate-200">
                  ${totals.totalPaidOut.toFixed(2)}
                </strong>
              </div>
              <div className="rounded-xl bg-red-950/40 border border-red-400/45 p-2.5 text-center">
                <span className="block text-[10px] uppercase font-bold text-red-300">
                  Total Owed Now
                </span>
                <strong className="text-lg font-black text-red-300">
                  ${totals.totalOwedNow.toFixed(2)}
                </strong>
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
                  id: "pending",
                  label: `⏳ Pending (${pendingReferrals.length})`,
                },
                {
                  id: "payouts",
                  label: `💸 Payout Ledger (${summaries.length})`,
                },
                {
                  id: "all",
                  label: `📋 All Logs (${data?.referrals.length || 0})`,
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
          ) : activeTab === "pending" ? (
            pendingReferrals.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-black/50 p-8 text-center text-xs text-slate-400">
                No pending referrals waiting for $20 confirmation.
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
                        Contact/Payment Note: {r.referredContact}
                      </p>
                    )}
                    <p className="text-[10px] text-slate-500">
                      Device: {r.referredDeviceId} •{" "}
                      {new Date(r.createdAt).toLocaleDateString()}{" "}
                      {formatAppTime(r.createdAt, clockFormat)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() =>
                        void handleSetStatus(r.id, "confirmed_paid")
                      }
                      className="rounded-xl bg-emerald-600 hover:bg-emerald-500 px-3.5 py-2 text-xs font-extrabold text-white cursor-pointer disabled:opacity-50"
                    >
                      ✓ Confirm ${LIFETIME_PRICE_CAD} Paid
                    </button>
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => void handleSetStatus(r.id, "rejected")}
                      className="rounded-xl bg-red-900/70 hover:bg-red-600 border border-red-500/40 px-3 py-2 text-xs font-bold text-red-200 hover:text-white cursor-pointer disabled:opacity-50"
                    >
                      ✕ Reject
                    </button>
                  </div>
                </div>
              ))
            )
          ) : activeTab === "payouts" ? (
            <div className="space-y-3">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search referrer name, code, or e-Transfer email..."
                className="w-full rounded-xl border border-white/15 bg-black/75 px-3.5 py-2 text-xs font-bold text-white"
              />

              {filteredSummaries.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-black/50 p-8 text-center text-xs text-slate-400">
                  No referrers registered yet.
                </div>
              ) : (
                filteredSummaries.map((s) => (
                  <div
                    key={s.code}
                    className={`rounded-2xl border p-4 space-y-3 ${
                      s.balanceOwed > 0
                        ? "border-emerald-400/50 bg-emerald-950/20"
                        : "border-white/10 bg-black/60"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <strong className="text-sm font-black text-white">
                            {s.name}
                          </strong>
                          <span className="font-mono text-[11px] text-amber-300 bg-white/10 px-2 py-0.5 rounded">
                            {s.code}
                          </span>
                        </div>
                        <p className="text-[11px] text-cyan-300 mt-0.5">
                          💳 Payout Info: {s.payoutInfo || "Not provided yet"}
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="block text-[10px] uppercase font-bold text-slate-400">
                          Owed Now
                        </span>
                        <strong
                          className={`text-xl font-black ${
                            s.balanceOwed > 0
                              ? "text-emerald-300"
                              : "text-slate-400"
                          }`}
                        >
                          ${s.balanceOwed.toFixed(2)}
                        </strong>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] border-t border-white/10 pt-2.5">
                      <div className="flex flex-wrap gap-3 text-slate-300">
                        <span>
                          Confirmed Paid: <strong>{s.confirmedPaidCount}</strong>
                        </span>
                        <span>
                          Billable (after {MIN_CONFIRMED_REFERRALS}):{" "}
                          <strong className="text-cyan-300">
                            {s.billableReferrals}
                          </strong>
                        </span>
                        <span>
                          Earned: <strong>${s.totalEarned.toFixed(2)}</strong>
                        </span>
                        <span>
                          Paid Out: <strong>${s.totalPaidOut.toFixed(2)}</strong>
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleOpenPayoutForm(s)}
                        className="rounded-xl bg-emerald-600 hover:bg-emerald-500 px-3.5 py-1.5 text-xs font-extrabold text-white cursor-pointer"
                      >
                        💸 Record Payout
                      </button>
                    </div>

                    {payingCode === s.code && (
                      <form
                        onSubmit={(e) => void handleSubmitPayout(e, s.code)}
                        className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-2 border-t border-white/10"
                      >
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={payAmount}
                          onChange={(e) => setPayAmount(e.target.value)}
                          placeholder="Amount ($)"
                          required
                          className="rounded-xl border border-white/15 bg-slate-950 px-3 py-2 text-xs font-bold text-emerald-300"
                        />
                        <select
                          value={payMethod}
                          onChange={(e) => setPayMethod(e.target.value)}
                          className="rounded-xl border border-white/15 bg-slate-950 px-3 py-2 text-xs font-bold text-white"
                        >
                          <option value="e-Transfer">e-Transfer</option>
                          <option value="Cash">Cash</option>
                          <option value="PayPal">PayPal</option>
                          <option value="Other">Other</option>
                        </select>
                        <input
                          type="text"
                          value={payNote}
                          onChange={(e) => setPayNote(e.target.value)}
                          placeholder="Ref # / note"
                          className="rounded-xl border border-white/15 bg-slate-950 px-3 py-2 text-xs text-white"
                        />
                        <div className="flex gap-1.5">
                          <button
                            type="submit"
                            disabled={busyId === s.code}
                            className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-extrabold text-white py-2 cursor-pointer"
                          >
                            ✓ Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setPayingCode(null)}
                            className="rounded-xl bg-white/10 px-2.5 text-xs text-slate-300 cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {!data || data.referrals.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-black/50 p-8 text-center text-xs text-slate-400">
                  No referrals logged yet.
                </div>
              ) : (
                data.referrals.map((r) => (
                  <div
                    key={r.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/60 px-3.5 py-2.5 text-xs"
                  >
                    <div>
                      <strong className="text-white">{r.referredName}</strong>{" "}
                      <span className="text-slate-400">→</span>{" "}
                      <span className="text-amber-300 font-bold">
                        {r.referrerName} ({r.referrerCode})
                      </span>
                      <span className="block text-[10px] text-slate-500">
                        {new Date(r.createdAt).toLocaleDateString()} • Status:{" "}
                        {r.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {r.status !== "confirmed_paid" && (
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() =>
                            void handleSetStatus(r.id, "confirmed_paid")
                          }
                          className="rounded-lg bg-emerald-600/80 hover:bg-emerald-500 px-2.5 py-1 text-[10px] font-extrabold text-white cursor-pointer"
                        >
                          ✓ Confirm Paid
                        </button>
                      )}
                      {r.status !== "pending" && (
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => void handleSetStatus(r.id, "pending")}
                          className="rounded-lg bg-white/10 hover:bg-white/20 px-2.5 py-1 text-[10px] font-bold text-slate-200 cursor-pointer"
                        >
                          ↺ Pending
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
