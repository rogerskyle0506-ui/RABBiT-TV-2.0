// src/lib/referrals.ts
import { getOrCreateDeviceId, purgeOldTmdbCaches } from "./settings";

// ──────────────────────────────────────────────────────────────
// Referral Program Configuration (Unlimited Referrals + Step-Up)
// ──────────────────────────────────────────────────────────────
export const LIFETIME_PRICE_CAD = 20;
export const MIN_CONFIRMED_REFERRALS = 5;
export const PAYOUT_PER_EXTRA_REFERRAL_CAD = 5; // Tier 1 rate: Friends #6 – #100
export const STEP_UP_CONFIRMED_THRESHOLD = 100; // After 100 confirmed paid friends -> $10/friend
export const STEP_UP_PAYOUT_CAD = 10; // Tier 2 rate: Friends #101+

export type PayoutMethod = "e-Transfer" | "PayPal" | "Cash";
export const PAYOUT_METHODS: PayoutMethod[] = ["e-Transfer", "PayPal", "Cash"];

export type ReferralStatus =
  | "pending"
  | "confirmed_paid"
  | "scam_attempt"
  | "rejected";

export type ReferralPayoutTier =
  | "unlock_threshold" // Confirmed #1..#5 ($0 unlock minimum)
  | "tier1_5" // Confirmed #6..#100 ($5/friend)
  | "tier2_10" // Confirmed #101+ ($10/friend)
  | "non_payable"; // Pending, Scam Attempt, or Refused/Rejected ($0)

export interface ReferrerProfile {
  code: string; // e.g. "RAB-KYLE-4F9A"
  name: string;
  deviceId: string;
  payoutMethod?: PayoutMethod;
  payoutInfo?: string; // e-Transfer email/phone, PayPal email/@handle, or Cash contact
  revoked?: boolean;
  revokedAt?: number;
  revokedReason?: string;
  createdAt: number;
}

export interface ReferralEntry {
  id: string;
  referrerCode: string;
  referrerName: string;
  referrerDeviceId: string;
  referredName: string;
  referredDeviceId: string;
  referredContact?: string; // Optional name/email/phone to verify $20 payment
  status: ReferralStatus;
  subscriptionPrice: number;
  createdAt: number;
  confirmedAt?: number;
  flaggedScamAt?: number;
  reimbursedAt?: number;
  reimbursedPayoutId?: string;
  reimbursedAmount?: number;
  note?: string;
}

export interface PayoutRecord {
  id: string;
  referrerCode: string;
  referrerName: string;
  amount: number;
  method: PayoutMethod | string;
  payoutDetailsUsed?: string;
  reimbursedReferralIds?: string[];
  overpaymentOverride?: boolean;
  note?: string;
  paidAt: number;
}

export interface ReferralSystemData {
  profiles: Record<string, ReferrerProfile>;
  referrals: ReferralEntry[];
  payouts: PayoutRecord[];
  updatedAt: number;
}

/** Enriched referral entry with live slot number, tier rate, and reimbursement state */
export interface EnrichedReferralEntry extends ReferralEntry {
  confirmedSlotNumber: number | null; // 1-based rank among confirmed_paid friends
  payoutTier: ReferralPayoutTier;
  payoutRate: number; // $0, $5, or $10
  isPayable: boolean; // true only for confirmed_paid #6+
  isReimbursed: boolean; // true if already paid out to the referrer
}

export interface ReferrerSummary {
  code: string;
  name: string;
  deviceId: string;
  payoutMethod: PayoutMethod;
  payoutInfo: string;
  revoked: boolean;
  revokedReason?: string;
  pendingCount: number;
  confirmedPaidCount: number;
  scamCount: number; // Includes scam_attempt + legacy rejected
  rejectedCount: number;
  scamRatePct: number;
  isHighScamRisk: boolean;
  remainingToUnlock: number;
  isPayoutUnlocked: boolean;
  isStepUpTier: boolean; // true once >= 100 confirmed paid friends
  nextPayoutRate: number; // $5 or $10 for the next qualifying friend
  remainingToStepUp: number;
  billableReferrals: number; // Confirmed friends #6+
  tier1BillableCount: number; // Confirmed #6..#100
  tier2BillableCount: number; // Confirmed #101+
  reimbursedCount: number;
  unreimbursedCount: number;
  totalEarned: number;
  totalPaidOut: number;
  balanceOwed: number;
  grossRevenueGenerated: number;
  referrals: EnrichedReferralEntry[];
  unreimbursedBillableReferrals: EnrichedReferralEntry[];
  payouts: PayoutRecord[];
}

export interface PayoutAllocationPreview {
  requestedAmount: number;
  maxPayableOwed: number;
  selectedReferrals: EnrichedReferralEntry[];
  coveredAmount: number;
  isOverpayment: boolean;
  overpaymentExcess: number;
  unallocatedRemainder: number;
  alreadyReimbursedCount: number;
  excludedScamOrPendingCount: number;
  warnings: string[];
}

export interface FleetReferralTotals {
  totalReferrers: number;
  revokedReferrers: number;
  highScamRiskReferrers: number;
  pendingApprovals: number;
  totalConfirmedPaid: number;
  totalScamAttempts: number;
  totalGrossRevenue: number;
  totalEarnedByReferrers: number;
  totalPaidOut: number;
  totalOwedNow: number;
}

// ──────────────────────────────────────────────────────────────
// Storage & Gist Constants
// ──────────────────────────────────────────────────────────────
const GIST_ID = ((import.meta as any).env?.VITE_GIST_ID as string) || "";
const GITHUB_TOKEN = ((import.meta as any).env?.VITE_GH_PAT as string) || "";
const GIST_API_URL = GIST_ID ? `https://api.github.com/gists/${GIST_ID}` : "";

const MY_REFERRAL_CODE_KEY = "rabtv_my_referral_code_v1";
const MY_PAYOUT_METHOD_KEY = "rabtv_my_payout_method_v1";
const MY_PAYOUT_INFO_KEY = "rabtv_my_payout_info_v1";
const CLAIMED_REFERRAL_CODE_KEY = "rabtv_claimed_referral_code_v1";
const REFERRAL_CACHE_KEY = "rabtv_cache_referrals_v1";
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes
const FETCH_TIMEOUT_MS = 6500;

let memoryCache: { fetchedAt: number; data: ReferralSystemData } | null = null;

function emptySystemData(): ReferralSystemData {
  return {
    profiles: {},
    referrals: [],
    payouts: [],
    updatedAt: Date.now(),
  };
}

function sanitizeText(raw: unknown, maxLen = 80): string {
  return String(raw ?? "")
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, maxLen);
}

export function normalizePayoutMethod(raw?: string): PayoutMethod {
  const lower = String(raw || "").trim().toLowerCase();
  if (lower === "paypal") return "PayPal";
  if (lower === "cash") return "Cash";
  return "e-Transfer";
}

export function normalizeReferralCode(raw: string): string {
  return String(raw || "")
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .trim()
    .slice(0, 24);
}

function safeWriteJson(key: string, payload: unknown): void {
  if (typeof window === "undefined") return;
  const serialized = JSON.stringify(payload);
  try {
    localStorage.setItem(key, serialized);
  } catch {
    try {
      purgeOldTmdbCaches();
      localStorage.setItem(key, serialized);
    } catch {
      // Ignore storage quota errors on low-storage sticks
    }
  }
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = FETCH_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer =
    typeof window !== "undefined"
      ? window.setTimeout(() => controller.abort(), timeoutMs)
      : setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    if (typeof window !== "undefined") {
      window.clearTimeout(timer as number);
    } else {
      clearTimeout(timer);
    }
  }
}

function emitReferralUpdate(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("rabtv_referrals_updated"));
  }
}

// ──────────────────────────────────────────────────────────────
// Local User Code & Payout Contact Helpers
// ──────────────────────────────────────────────────────────────

export function getOrCreateMyReferralCode(profileName?: string): string {
  if (typeof window === "undefined") return "RAB-USER-0000";

  const existing = localStorage.getItem(MY_REFERRAL_CODE_KEY);
  if (existing && existing.length >= 6) {
    return normalizeReferralCode(existing);
  }

  const rawName =
    profileName || localStorage.getItem("rabtv_profile_name") || "USER";
  const cleanTag = rawName
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 4)
    .padEnd(4, "X");

  const deviceId = getOrCreateDeviceId();
  const deviceSuffix = deviceId
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(-4)
    .padStart(4, "7");

  const code = `RAB-${cleanTag}-${deviceSuffix}`;
  try {
    localStorage.setItem(MY_REFERRAL_CODE_KEY, code);
  } catch {
    // ignore
  }
  return code;
}

export function getSavedPayoutMethod(): PayoutMethod {
  if (typeof window === "undefined") return "e-Transfer";
  return normalizePayoutMethod(
    localStorage.getItem(MY_PAYOUT_METHOD_KEY) || "e-Transfer"
  );
}

export function savePayoutMethodLocally(method: PayoutMethod): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(MY_PAYOUT_METHOD_KEY, normalizePayoutMethod(method));
  } catch {
    // ignore
  }
}

export function getSavedPayoutInfo(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(MY_PAYOUT_INFO_KEY) || "";
}

export function savePayoutInfoLocally(info: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(MY_PAYOUT_INFO_KEY, sanitizeText(info, 100));
  } catch {
    // ignore
  }
}

export function getClaimedReferralCode(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(CLAIMED_REFERRAL_CODE_KEY) || "";
}

export function isScamOrRefusedStatus(status: ReferralStatus): boolean {
  return status === "scam_attempt" || status === "rejected";
}

// ──────────────────────────────────────────────────────────────
// Core Tiered Accounting & FIFO Account Reimbursement Engine
// ──────────────────────────────────────────────────────────────

function getPayoutRateForSlot(slotNumber: number): {
  tier: ReferralPayoutTier;
  rate: number;
} {
  if (slotNumber <= MIN_CONFIRMED_REFERRALS) {
    return { tier: "unlock_threshold", rate: 0 };
  }
  if (slotNumber <= STEP_UP_CONFIRMED_THRESHOLD) {
    return { tier: "tier1_5", rate: PAYOUT_PER_EXTRA_REFERRAL_CAD };
  }
  return { tier: "tier2_10", rate: STEP_UP_PAYOUT_CAD };
}

export function computeReferrerSummary(
  code: string,
  data: ReferralSystemData
): ReferrerSummary {
  const normCode = normalizeReferralCode(code);
  const profile = data.profiles[normCode];

  const rawReferrals = (data.referrals || []).filter(
    (r) => normalizeReferralCode(r.referrerCode) === normCode
  );

  const myPayouts = (data.payouts || [])
    .filter((p) => normalizeReferralCode(p.referrerCode) === normCode)
    .sort((a, b) => (b.paidAt || 0) - (a.paidAt || 0));

  // Collect all referral IDs explicitly stamped as reimbursed in PayoutRecords
  const explicitlyReimbursedIds = new Set<string>();
  let legacyUnlinkedPayoutDollars = 0;

  for (const p of myPayouts) {
    if (Array.isArray(p.reimbursedReferralIds) && p.reimbursedReferralIds.length > 0) {
      for (const id of p.reimbursedReferralIds) {
        explicitlyReimbursedIds.add(id);
      }
    } else {
      // Backwards compatibility for older payouts logged before per-account stamping
      legacyUnlinkedPayoutDollars += Math.max(0, Number(p.amount) || 0);
    }
  }

  // Sort confirmed_paid referrals chronologically (oldest first) to assign exact #1..#100..#N slots
  const confirmedChronological = rawReferrals
    .filter((r) => r.status === "confirmed_paid")
    .sort(
      (a, b) =>
        (a.confirmedAt || a.createdAt || 0) -
        (b.confirmedAt || b.createdAt || 0)
    );

  const slotMap = new Map<
    string,
    {
      slot: number;
      tier: ReferralPayoutTier;
      rate: number;
      isReimbursed: boolean;
    }
  >();

  let remainingLegacyDollars = legacyUnlinkedPayoutDollars;
  let tier1BillableCount = 0;
  let tier2BillableCount = 0;
  let totalEarned = 0;

  confirmedChronological.forEach((entry, idx) => {
    const slot = idx + 1;
    const { tier, rate } = getPayoutRateForSlot(slot);

    if (tier === "tier1_5") tier1BillableCount++;
    if (tier === "tier2_10") tier2BillableCount++;
    totalEarned += rate;

    let isReimbursed = false;
    if (rate > 0) {
      if (
        Boolean(entry.reimbursedAt) ||
        Boolean(entry.reimbursedPayoutId) ||
        explicitlyReimbursedIds.has(entry.id)
      ) {
        isReimbursed = true;
      } else if (remainingLegacyDollars >= rate) {
        isReimbursed = true;
        remainingLegacyDollars =
          Math.round((remainingLegacyDollars - rate) * 100) / 100;
      }
    }

    slotMap.set(entry.id, { slot, tier, rate, isReimbursed });
  });

  // Build enriched referral records (newest first for display)
  let pendingCount = 0;
  let confirmedPaidCount = 0;
  let scamCount = 0;
  let rejectedCount = 0;

  const enrichedReferrals: EnrichedReferralEntry[] = rawReferrals
    .map((r) => {
      if (r.status === "confirmed_paid") {
        confirmedPaidCount++;
        const meta = slotMap.get(r.id);
        const rate = meta?.rate ?? 0;
        return {
          ...r,
          confirmedSlotNumber: meta?.slot ?? null,
          payoutTier: meta?.tier ?? "unlock_threshold",
          payoutRate: rate,
          isPayable: rate > 0,
          isReimbursed: Boolean(meta?.isReimbursed),
        };
      }

      if (r.status === "pending") pendingCount++;
      if (r.status === "scam_attempt") scamCount++;
      if (r.status === "rejected") {
        rejectedCount++;
        scamCount++;
      }

      // Scam, rejected, and pending accounts are NEVER payable or reimbursable
      return {
        ...r,
        confirmedSlotNumber: null,
        payoutTier: "non_payable" as ReferralPayoutTier,
        payoutRate: 0,
        isPayable: false,
        isReimbursed: false,
      };
    })
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  // Unreimbursed billable accounts sorted oldest-first (FIFO reimbursement queue)
  const unreimbursedBillableReferrals = enrichedReferrals
    .filter((r) => r.status === "confirmed_paid" && r.isPayable && !r.isReimbursed)
    .sort(
      (a, b) =>
        (a.confirmedSlotNumber || 999999) - (b.confirmedSlotNumber || 999999)
    );

  const billableReferrals = tier1BillableCount + tier2BillableCount;
  const unreimbursedCount = unreimbursedBillableReferrals.length;
  const reimbursedCount = Math.max(0, billableReferrals - unreimbursedCount);

  const totalPaidOut =
    Math.round(
      myPayouts.reduce((sum, p) => sum + (Number(p.amount) || 0), 0) * 100
    ) / 100;

  // Balance owed strictly tracks unpaid verified billable accounts (scam/pending never count!)
  const unpaidAccountDollars = unreimbursedBillableReferrals.reduce(
    (sum, r) => sum + r.payoutRate,
    0
  );
  const balanceOwed = Math.max(
    0,
    Math.round(
      Math.min(unpaidAccountDollars, Math.max(0, totalEarned - totalPaidOut)) *
        100
    ) / 100
  );

  const totalSubmitted = enrichedReferrals.length;
  const scamRatePct =
    totalSubmitted > 0 ? Math.round((scamCount / totalSubmitted) * 100) : 0;
  const isHighScamRisk =
    (scamCount >= 3 && scamRatePct >= 50) || scamCount >= 5;

  const isStepUpTier = confirmedPaidCount >= STEP_UP_CONFIRMED_THRESHOLD;
  const remainingToStepUp = Math.max(
    0,
    STEP_UP_CONFIRMED_THRESHOLD - confirmedPaidCount
  );

  return {
    code: normCode,
    name: profile?.name || rawReferrals[0]?.referrerName || "Member",
    deviceId: profile?.deviceId || rawReferrals[0]?.referrerDeviceId || "",
    payoutMethod: normalizePayoutMethod(profile?.payoutMethod),
    payoutInfo: profile?.payoutInfo || "",
    revoked: Boolean(profile?.revoked),
    revokedReason: profile?.revokedReason,
    pendingCount,
    confirmedPaidCount,
    scamCount,
    rejectedCount,
    scamRatePct,
    isHighScamRisk,
    remainingToUnlock: Math.max(0, MIN_CONFIRMED_REFERRALS - confirmedPaidCount),
    isPayoutUnlocked: confirmedPaidCount >= MIN_CONFIRMED_REFERRALS,
    isStepUpTier,
    nextPayoutRate: isStepUpTier
      ? STEP_UP_PAYOUT_CAD
      : PAYOUT_PER_EXTRA_REFERRAL_CAD,
    remainingToStepUp,
    billableReferrals,
    tier1BillableCount,
    tier2BillableCount,
    reimbursedCount,
    unreimbursedCount,
    totalEarned,
    totalPaidOut,
    balanceOwed,
    grossRevenueGenerated: confirmedPaidCount * LIFETIME_PRICE_CAD,
    referrals: enrichedReferrals,
    unreimbursedBillableReferrals,
    payouts: myPayouts,
  };
}

/**
 * Live FIFO Payout Simulator & Overpayment / Scam Protection Guard.
 * Shows exactly which oldest unpaid confirmed-paid referrals will be marked Reimbursed
 * for any dollar amount entered by Admin, and flags overpayments clearly.
 */
export function previewPayoutAllocation(
  summary: ReferrerSummary,
  rawAmount: number
): PayoutAllocationPreview {
  const requestedAmount =
    isNaN(rawAmount) || rawAmount <= 0
      ? 0
      : Math.round(rawAmount * 100) / 100;
  const maxPayableOwed = summary.balanceOwed;

  const selectedReferrals: EnrichedReferralEntry[] = [];
  let remaining = requestedAmount;
  let coveredAmount = 0;

  // Strictly walk ONLY confirmed_paid, billable (#6+), un-reimbursed accounts (oldest first)
  for (const ref of summary.unreimbursedBillableReferrals) {
    if (ref.status !== "confirmed_paid" || !ref.isPayable || ref.isReimbursed) {
      continue;
    }
    if (remaining + 0.0001 >= ref.payoutRate) {
      selectedReferrals.push(ref);
      remaining = Math.round((remaining - ref.payoutRate) * 100) / 100;
      coveredAmount = Math.round((coveredAmount + ref.payoutRate) * 100) / 100;
    } else {
      break;
    }
  }

  const isOverpayment = requestedAmount > maxPayableOwed + 0.001;
  const overpaymentExcess = isOverpayment
    ? Math.round((requestedAmount - maxPayableOwed) * 100) / 100
    : 0;
  const unallocatedRemainder = Math.max(
    0,
    Math.round((requestedAmount - coveredAmount) * 100) / 100
  );

  const warnings: string[] = [];

  if (summary.revoked) {
    warnings.push(
      "This referrer's link is currently REVOKED. Double-check before sending funds."
    );
  }

  if (isOverpayment) {
    warnings.push(
      `OVERPAYMENT WARNING ($${overpaymentExcess.toFixed(
        2
      )} over owed): You are trying to pay $${requestedAmount.toFixed(
        2
      )}, but only $${maxPayableOwed.toFixed(
        2
      )} is owed for verified unpaid accounts. Some users may have already received funds for referred accounts, and scam/pending accounts are strictly unpayable.`
    );
  } else if (unallocatedRemainder > 0 && requestedAmount > 0) {
    warnings.push(
      `Amount $${requestedAmount.toFixed(
        2
      )} leaves $${unallocatedRemainder.toFixed(
        2
      )} unmatched (doesn't evenly match $${summary.nextPayoutRate} account tiers). Exact match for ${
        selectedReferrals.length
      } account(s) is $${coveredAmount.toFixed(2)}.`
    );
  }

  if (requestedAmount > 0 && selectedReferrals.length === 0 && !isOverpayment) {
    warnings.push(
      `Amount is too small to cover the next unpaid referral account ($${
        summary.unreimbursedBillableReferrals[0]?.payoutRate ??
        summary.nextPayoutRate
      }).`
    );
  }

  return {
    requestedAmount,
    maxPayableOwed,
    selectedReferrals,
    coveredAmount,
    isOverpayment,
    overpaymentExcess,
    unallocatedRemainder,
    alreadyReimbursedCount: summary.reimbursedCount,
    excludedScamOrPendingCount: summary.scamCount + summary.pendingCount,
    warnings,
  };
}

export function getAllReferrerSummaries(
  data: ReferralSystemData
): ReferrerSummary[] {
  const codeSet = new Set<string>(Object.keys(data.profiles || {}));
  for (const r of data.referrals || []) {
    const c = normalizeReferralCode(r.referrerCode);
    if (c) codeSet.add(c);
  }
  for (const p of data.payouts || []) {
    const c = normalizeReferralCode(p.referrerCode);
    if (c) codeSet.add(c);
  }

  return Array.from(codeSet)
    .map((code) => computeReferrerSummary(code, data))
    .sort((a, b) => {
      if (b.balanceOwed !== a.balanceOwed) return b.balanceOwed - a.balanceOwed;
      if (b.pendingCount !== a.pendingCount)
        return b.pendingCount - a.pendingCount;
      if (b.confirmedPaidCount !== a.confirmedPaidCount) {
        return b.confirmedPaidCount - a.confirmedPaidCount;
      }
      return b.scamCount - a.scamCount;
    });
}

export function computeFleetReferralTotals(
  data: ReferralSystemData
): FleetReferralTotals {
  const summaries = getAllReferrerSummaries(data);
  let revokedReferrers = 0;
  let highScamRiskReferrers = 0;
  let pendingApprovals = 0;
  let totalConfirmedPaid = 0;
  let totalScamAttempts = 0;
  let totalEarnedByReferrers = 0;
  let totalPaidOut = 0;
  let totalOwedNow = 0;

  for (const s of summaries) {
    if (s.revoked) revokedReferrers++;
    if (s.isHighScamRisk) highScamRiskReferrers++;
    pendingApprovals += s.pendingCount;
    totalConfirmedPaid += s.confirmedPaidCount;
    totalScamAttempts += s.scamCount;
    totalEarnedByReferrers += s.totalEarned;
    totalPaidOut += s.totalPaidOut;
    totalOwedNow += s.balanceOwed;
  }

  return {
    totalReferrers: summaries.length,
    revokedReferrers,
    highScamRiskReferrers,
    pendingApprovals,
    totalConfirmedPaid,
    totalScamAttempts,
    totalGrossRevenue: totalConfirmedPaid * LIFETIME_PRICE_CAD,
    totalEarnedByReferrers,
    totalPaidOut,
    totalOwedNow,
  };
}

// ──────────────────────────────────────────────────────────────
// Private Gist Read / Write Engine (`referrals.json`)
// ──────────────────────────────────────────────────────────────

function loadCachedData(): ReferralSystemData | null {
  if (memoryCache && Date.now() - memoryCache.fetchedAt < CACHE_TTL_MS) {
    return memoryCache.data;
  }
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(REFERRAL_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      parsed.data &&
      typeof parsed.fetchedAt === "number" &&
      Date.now() - parsed.fetchedAt < CACHE_TTL_MS
    ) {
      memoryCache = parsed;
      return parsed.data as ReferralSystemData;
    }
  } catch {
    // ignore corrupt cache
  }
  return null;
}

function saveCachedData(data: ReferralSystemData): void {
  const wrapped = { fetchedAt: Date.now(), data };
  memoryCache = wrapped;
  safeWriteJson(REFERRAL_CACHE_KEY, wrapped);
}

export async function fetchReferralSystemData(
  forceRefresh = false
): Promise<ReferralSystemData> {
  if (!forceRefresh) {
    const cached = loadCachedData();
    if (cached) return cached;
  }

  if (!GIST_ID || !GITHUB_TOKEN || !GIST_API_URL) {
    return loadCachedData() || emptySystemData();
  }

  try {
    const res = await fetchWithTimeout(`${GIST_API_URL}?t=${Date.now()}`, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "RabbitTV-App",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      return loadCachedData() || emptySystemData();
    }

    const gist = await res.json();
    const rawContent = gist.files?.["referrals.json"]?.content;
    if (!rawContent) {
      const fresh = emptySystemData();
      saveCachedData(fresh);
      return fresh;
    }

    const parsed = JSON.parse(rawContent);
    const normalized: ReferralSystemData = {
      profiles:
        parsed &&
        typeof parsed.profiles === "object" &&
        !Array.isArray(parsed.profiles)
          ? parsed.profiles
          : {},
      referrals: Array.isArray(parsed?.referrals) ? parsed.referrals : [],
      payouts: Array.isArray(parsed?.payouts) ? parsed.payouts : [],
      updatedAt: Number(parsed?.updatedAt) || Date.now(),
    };

    saveCachedData(normalized);
    return normalized;
  } catch (err) {
    console.error("Failed to fetch referrals.json from Gist:", err);
    return loadCachedData() || emptySystemData();
  }
}

async function saveReferralSystemData(
  data: ReferralSystemData
): Promise<boolean> {
  if (!GIST_ID || !GITHUB_TOKEN || !GIST_API_URL) {
    saveCachedData(data);
    emitReferralUpdate();
    return false;
  }

  const nextData: ReferralSystemData = {
    ...data,
    updatedAt: Date.now(),
  };

  try {
    const res = await fetchWithTimeout(GIST_API_URL, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "RabbitTV-App",
      },
      body: JSON.stringify({
        files: {
          "referrals.json": {
            content: JSON.stringify(nextData, null, 2),
          },
        },
      }),
    });

    if (!res.ok) return false;
    saveCachedData(nextData);
    emitReferralUpdate();
    return true;
  } catch (err) {
    console.error("Failed to save referrals.json to Gist:", err);
    return false;
  }
}

// ──────────────────────────────────────────────────────────────
// User Actions (Register Code, Save Payout Method & Details, Claim)
// ──────────────────────────────────────────────────────────────

export async function registerOrUpdateMyReferrerProfile(params: {
  name: string;
  payoutMethod?: PayoutMethod;
  payoutInfo?: string;
}): Promise<{ ok: boolean; code: string; error?: string }> {
  const cleanName = sanitizeText(params.name || "Member", 40);
  const cleanMethod = normalizePayoutMethod(
    params.payoutMethod || getSavedPayoutMethod()
  );
  const cleanPayout = sanitizeText(params.payoutInfo || "", 100);
  const code = getOrCreateMyReferralCode(cleanName);
  const deviceId = getOrCreateDeviceId();

  savePayoutMethodLocally(cleanMethod);
  if (params.payoutInfo !== undefined) {
    savePayoutInfoLocally(cleanPayout);
  }

  const latest = await fetchReferralSystemData(true);
  const existing = latest.profiles[code];

  latest.profiles[code] = {
    code,
    name: cleanName,
    deviceId,
    payoutMethod: cleanMethod,
    payoutInfo:
      params.payoutInfo !== undefined
        ? cleanPayout
        : existing?.payoutInfo || "",
    // Preserve admin revocation flags if already revoked!
    revoked: existing?.revoked,
    revokedAt: existing?.revokedAt,
    revokedReason: existing?.revokedReason,
    createdAt: existing?.createdAt || Date.now(),
  };

  const saved = await saveReferralSystemData(latest);
  return {
    ok: saved,
    code,
    error: saved ? undefined : "Saved locally, but could not sync to cloud.",
  };
}

export async function submitReferralClaim(params: {
  referrerCode: string;
  myName: string;
  myContact?: string;
}): Promise<{ ok: boolean; message: string }> {
  const normCode = normalizeReferralCode(params.referrerCode);
  const myCode = getOrCreateMyReferralCode(params.myName);
  const myDeviceId = getOrCreateDeviceId();
  const cleanMyName = sanitizeText(params.myName || "New Member", 40);
  const cleanContact = sanitizeText(params.myContact || "", 100);

  if (!normCode || normCode.length < 6) {
    return { ok: false, message: "Please enter a valid referral code." };
  }

  if (normCode === myCode) {
    return {
      ok: false,
      message: "You cannot use your own referral code.",
    };
  }

  if (getClaimedReferralCode()) {
    return {
      ok: false,
      message: `This device already claimed referral code ${getClaimedReferralCode()}.`,
    };
  }

  const latest = await fetchReferralSystemData(true);
  const referrerProfile = latest.profiles[normCode];

  if (!referrerProfile) {
    return {
      ok: false,
      message: `Code "${normCode}" was not found. Ask your friend to open Refer & Earn once to activate their code.`,
    };
  }

  if (referrerProfile.revoked) {
    return {
      ok: false,
      message: `Referral code "${normCode}" has been deactivated by Admin and can no longer be used.`,
    };
  }

  if (referrerProfile.deviceId === myDeviceId) {
    return {
      ok: false,
      message: "Self-referrals from the same device are not allowed.",
    };
  }

  const alreadyClaimedInCloud = latest.referrals.some(
    (r) => r.referredDeviceId === myDeviceId
  );
  if (alreadyClaimedInCloud) {
    return {
      ok: false,
      message: "A referral has already been logged from this device.",
    };
  }

  const newEntry: ReferralEntry = {
    id: `ref-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    referrerCode: normCode,
    referrerName: referrerProfile.name,
    referrerDeviceId: referrerProfile.deviceId,
    referredName: cleanMyName,
    referredDeviceId: myDeviceId,
    referredContact: cleanContact || undefined,
    status: "pending",
    subscriptionPrice: LIFETIME_PRICE_CAD,
    createdAt: Date.now(),
  };

  latest.referrals.unshift(newEntry);
  const ok = await saveReferralSystemData(latest);

  if (ok && typeof window !== "undefined") {
    try {
      localStorage.setItem(CLAIMED_REFERRAL_CODE_KEY, normCode);
    } catch {
      // ignore
    }
    return {
      ok: true,
      message: `Referral linked to ${referrerProfile.name}! Once your $${LIFETIME_PRICE_CAD} lifetime payment is confirmed, they will get credit.`,
    };
  }

  return {
    ok: false,
    message: "Connection error while submitting referral. Please try again.",
  };
}

// ──────────────────────────────────────────────────────────────
// Admin Actions (Confirm Paid, Pending, Scam Flag, Revoke Link, FIFO Payout)
// ──────────────────────────────────────────────────────────────

export async function adminUpdateReferralStatus(
  referralId: string,
  status: ReferralStatus,
  note?: string
): Promise<{ ok: boolean; warning?: string; data?: ReferralSystemData }> {
  const latest = await fetchReferralSystemData(true);
  const target = latest.referrals.find((r) => r.id === referralId);
  if (!target) return { ok: false };

  let warning: string | undefined;
  if (
    target.reimbursedAt &&
    (status === "scam_attempt" || status === "rejected" || status === "pending")
  ) {
    warning =
      "Heads-up: This referral was previously marked Reimbursed. Flagged now, and its reimbursement stamp has been cleared.";
    target.reimbursedAt = undefined;
    target.reimbursedPayoutId = undefined;
    target.reimbursedAmount = undefined;
  }

  target.status = status;
  if (status === "confirmed_paid") {
    target.confirmedAt = target.confirmedAt || Date.now();
    target.flaggedScamAt = undefined;
  } else if (status === "scam_attempt" || status === "rejected") {
    target.confirmedAt = undefined;
    target.flaggedScamAt = Date.now();
  } else {
    target.confirmedAt = undefined;
    target.flaggedScamAt = undefined;
  }

  if (note !== undefined) {
    target.note = sanitizeText(note, 140);
  }

  const ok = await saveReferralSystemData(latest);
  return { ok, warning, data: latest };
}

/**
 * Revokes or restores a referrer's referral link (e.g., if they mostly refer scammers).
 */
export async function adminToggleReferrerRevoked(
  referrerCode: string,
  revoked: boolean,
  reason?: string
): Promise<{ ok: boolean; message: string; data?: ReferralSystemData }> {
  const normCode = normalizeReferralCode(referrerCode);
  const latest = await fetchReferralSystemData(true);
  const existing = latest.profiles[normCode];

  if (!existing) {
    const summary = computeReferrerSummary(normCode, latest);
    latest.profiles[normCode] = {
      code: normCode,
      name: summary.name,
      deviceId: summary.deviceId,
      payoutMethod: summary.payoutMethod,
      payoutInfo: summary.payoutInfo,
      revoked,
      revokedAt: revoked ? Date.now() : undefined,
      revokedReason: revoked
        ? sanitizeText(reason || "Revoked by Admin (High scam rate)", 120)
        : undefined,
      createdAt: Date.now(),
    };
  } else {
    existing.revoked = revoked;
    existing.revokedAt = revoked ? Date.now() : undefined;
    existing.revokedReason = revoked
      ? sanitizeText(reason || "Revoked by Admin (High scam rate)", 120)
      : undefined;
  }

  const ok = await saveReferralSystemData(latest);
  return {
    ok,
    message: ok
      ? revoked
        ? `🚫 Revoked referral link ${normCode}. New claims are now blocked.`
        : `✅ Restored referral link ${normCode}.`
      : "Failed to update revocation status in cloud.",
    data: latest,
  };
}

/**
 * Allows Admin to manually add a referral (e.g., paid cash in person).
 */
export async function adminAddManualReferral(params: {
  referrerCode: string;
  referredName: string;
  referredContact?: string;
  markPaidImmediately?: boolean;
}): Promise<{ ok: boolean; message: string; data?: ReferralSystemData }> {
  const normCode = normalizeReferralCode(params.referrerCode);
  const latest = await fetchReferralSystemData(true);
  const profile = latest.profiles[normCode];

  if (!profile) {
    return { ok: false, message: `Referrer code "${normCode}" not found.` };
  }

  const isPaid = params.markPaidImmediately !== false;
  const entry: ReferralEntry = {
    id: `ref-adm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
    referrerCode: normCode,
    referrerName: profile.name,
    referrerDeviceId: profile.deviceId,
    referredName: sanitizeText(params.referredName || "Manual Friend", 40),
    referredDeviceId: `manual-${Date.now().toString(36)}`,
    referredContact:
      sanitizeText(params.referredContact || "", 100) || undefined,
    status: isPaid ? "confirmed_paid" : "pending",
    subscriptionPrice: LIFETIME_PRICE_CAD,
    createdAt: Date.now(),
    confirmedAt: isPaid ? Date.now() : undefined,
    note: "Added by Admin",
  };

  latest.referrals.unshift(entry);
  const ok = await saveReferralSystemData(latest);
  return {
    ok,
    message: ok
      ? `Added ${entry.referredName} under ${profile.name}.`
      : "Failed to save to cloud.",
    data: latest,
  };
}

/**
 * Records a payout AND automatically stamps the oldest unpaid confirmed-paid
 * referral accounts (FIFO) as Reimbursed — never marking scam/pending accounts.
 * Blocks accidental overpayments unless `allowOverpaymentOverride` is explicitly true.
 */
export async function adminRecordPayout(params: {
  referrerCode: string;
  amount: number;
  method: PayoutMethod | string;
  note?: string;
  allowOverpaymentOverride?: boolean;
}): Promise<{
  ok: boolean;
  requiresOverride?: boolean;
  reimbursedCount?: number;
  message: string;
  data?: ReferralSystemData;
}> {
  const normCode = normalizeReferralCode(params.referrerCode);
  const cleanAmount = Math.round(Number(params.amount) * 100) / 100;

  if (!normCode || isNaN(cleanAmount) || cleanAmount <= 0) {
    return {
      ok: false,
      message: "Enter a valid payout amount greater than $0.",
    };
  }

  const latest = await fetchReferralSystemData(true);
  const summary = computeReferrerSummary(normCode, latest);
  const preview = previewPayoutAllocation(summary, cleanAmount);

  if (preview.isOverpayment && !params.allowOverpaymentOverride) {
    return {
      ok: false,
      requiresOverride: true,
      message:
        preview.warnings[0] ||
        `Overpayment blocked: Only $${summary.balanceOwed.toFixed(
          2
        )} is owed for verified unpaid referrals.`,
    };
  }

  const payoutId = `pay-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 6)}`;
  const now = Date.now();
  const reimbursedIds: string[] = [];

  // Stamp ONLY the verified eligible confirmed_paid accounts selected by FIFO preview
  for (const selected of preview.selectedReferrals) {
    const rawEntry = latest.referrals.find((r) => r.id === selected.id);
    if (
      rawEntry &&
      rawEntry.status === "confirmed_paid" &&
      !rawEntry.reimbursedAt
    ) {
      rawEntry.reimbursedAt = now;
      rawEntry.reimbursedPayoutId = payoutId;
      rawEntry.reimbursedAmount = selected.payoutRate;
      reimbursedIds.push(rawEntry.id);
    }
  }

  const normalizedMethod = normalizePayoutMethod(params.method);
  const payout: PayoutRecord = {
    id: payoutId,
    referrerCode: normCode,
    referrerName: summary.name,
    amount: cleanAmount,
    method: normalizedMethod,
    payoutDetailsUsed: summary.payoutInfo || undefined,
    reimbursedReferralIds: reimbursedIds,
    overpaymentOverride: preview.isOverpayment || undefined,
    note: sanitizeText(params.note || "", 140) || undefined,
    paidAt: now,
  };

  latest.payouts.unshift(payout);
  const ok = await saveReferralSystemData(latest);

  return {
    ok,
    reimbursedCount: reimbursedIds.length,
    message: ok
      ? `Recorded $${cleanAmount.toFixed(2)} (${normalizedMethod}) to ${
          summary.name
        } — marked ${reimbursedIds.length} referred account${
          reimbursedIds.length === 1 ? "" : "s"
        } as Reimbursed.`
      : "Failed to save payout to cloud.",
    data: latest,
  };
}
