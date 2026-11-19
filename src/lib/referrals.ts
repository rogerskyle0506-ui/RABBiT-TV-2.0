// src/lib/referrals.ts
import { getOrCreateDeviceId, purgeOldTmdbCaches } from "./settings";

// ──────────────────────────────────────────────────────────────
// Referral Program Configuration (Edit anytime in one place)
// ──────────────────────────────────────────────────────────────
export const LIFETIME_PRICE_CAD = 20;
export const MIN_CONFIRMED_REFERRALS = 5;
export const PAYOUT_PER_EXTRA_REFERRAL_CAD = 5;

export type ReferralStatus = "pending" | "confirmed_paid" | "rejected";

export interface ReferrerProfile {
  code: string; // e.g. "RAB-KYLE-4F9A"
  name: string;
  deviceId: string;
  payoutInfo?: string; // e-Transfer email / phone so admin knows where to pay
  createdAt: number;
}

export interface ReferralEntry {
  id: string;
  referrerCode: string;
  referrerName: string;
  referrerDeviceId: string;
  referredName: string;
  referredDeviceId: string;
  referredContact?: string; // Optional name/email/phone to match $20 payment
  status: ReferralStatus;
  subscriptionPrice: number;
  createdAt: number;
  confirmedAt?: number;
  note?: string;
}

export interface PayoutRecord {
  id: string;
  referrerCode: string;
  referrerName: string;
  amount: number;
  method: string; // e.g. "e-Transfer", "Cash", "PayPal"
  note?: string;
  paidAt: number;
}

export interface ReferralSystemData {
  profiles: Record<string, ReferrerProfile>;
  referrals: ReferralEntry[];
  payouts: PayoutRecord[];
  updatedAt: number;
}

export interface ReferrerSummary {
  code: string;
  name: string;
  deviceId: string;
  payoutInfo: string;
  pendingCount: number;
  confirmedPaidCount: number;
  rejectedCount: number;
  remainingToUnlock: number;
  isPayoutUnlocked: boolean;
  billableReferrals: number; // Confirmed friends AFTER the first 5
  totalEarned: number; // billableReferrals * $5
  totalPaidOut: number;
  balanceOwed: number; // max(0, totalEarned - totalPaidOut)
  grossRevenueGenerated: number; // confirmedPaidCount * $20
  referrals: ReferralEntry[];
  payouts: PayoutRecord[];
}

export interface FleetReferralTotals {
  totalReferrers: number;
  pendingApprovals: number;
  totalConfirmedPaid: number;
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

/**
 * Generates or retrieves this user's permanent referral code (e.g. RAB-KYLE-8F2A).
 */
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

export function getSavedPayoutInfo(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(MY_PAYOUT_INFO_KEY) || "";
}

export function savePayoutInfoLocally(info: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(MY_PAYOUT_INFO_KEY, sanitizeText(info, 80));
  } catch {
    // ignore
  }
}

export function getClaimedReferralCode(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(CLAIMED_REFERRAL_CODE_KEY) || "";
}

// ──────────────────────────────────────────────────────────────
// Pure Calculation Helpers (Exact $20 / 5-Min / $5 Rule)
// ──────────────────────────────────────────────────────────────

export function computeReferrerSummary(
  code: string,
  data: ReferralSystemData
): ReferrerSummary {
  const normCode = normalizeReferralCode(code);
  const profile = data.profiles[normCode];

  const myReferrals = (data.referrals || [])
    .filter((r) => normalizeReferralCode(r.referrerCode) === normCode)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  const myPayouts = (data.payouts || [])
    .filter((p) => normalizeReferralCode(p.referrerCode) === normCode)
    .sort((a, b) => (b.paidAt || 0) - (a.paidAt || 0));

  let pendingCount = 0;
  let confirmedPaidCount = 0;
  let rejectedCount = 0;

  for (const r of myReferrals) {
    if (r.status === "confirmed_paid") confirmedPaidCount++;
    else if (r.status === "pending") pendingCount++;
    else if (r.status === "rejected") rejectedCount++;
  }

  const remainingToUnlock = Math.max(
    0,
    MIN_CONFIRMED_REFERRALS - confirmedPaidCount
  );
  const isPayoutUnlocked = confirmedPaidCount >= MIN_CONFIRMED_REFERRALS;
  const billableReferrals = Math.max(
    0,
    confirmedPaidCount - MIN_CONFIRMED_REFERRALS
  );
  const totalEarned = billableReferrals * PAYOUT_PER_EXTRA_REFERRAL_CAD;
  const totalPaidOut = myPayouts.reduce(
    (sum, p) => sum + (Number(p.amount) || 0),
    0
  );
  const balanceOwed = Math.max(0, totalEarned - totalPaidOut);
  const grossRevenueGenerated = confirmedPaidCount * LIFETIME_PRICE_CAD;

  return {
    code: normCode,
    name:
      profile?.name ||
      myReferrals[0]?.referrerName ||
      "Member",
    deviceId: profile?.deviceId || myReferrals[0]?.referrerDeviceId || "",
    payoutInfo: profile?.payoutInfo || "",
    pendingCount,
    confirmedPaidCount,
    rejectedCount,
    remainingToUnlock,
    isPayoutUnlocked,
    billableReferrals,
    totalEarned,
    totalPaidOut,
    balanceOwed,
    grossRevenueGenerated,
    referrals: myReferrals,
    payouts: myPayouts,
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
      // Highest Balance Owed first, then most confirmed paid friends
      if (b.balanceOwed !== a.balanceOwed) return b.balanceOwed - a.balanceOwed;
      if (b.confirmedPaidCount !== a.confirmedPaidCount) {
        return b.confirmedPaidCount - a.confirmedPaidCount;
      }
      return b.pendingCount - a.pendingCount;
    });
}

export function computeFleetReferralTotals(
  data: ReferralSystemData
): FleetReferralTotals {
  const summaries = getAllReferrerSummaries(data);
  let pendingApprovals = 0;
  let totalConfirmedPaid = 0;
  let totalEarnedByReferrers = 0;
  let totalPaidOut = 0;
  let totalOwedNow = 0;

  for (const s of summaries) {
    pendingApprovals += s.pendingCount;
    totalConfirmedPaid += s.confirmedPaidCount;
    totalEarnedByReferrers += s.totalEarned;
    totalPaidOut += s.totalPaidOut;
    totalOwedNow += s.balanceOwed;
  }

  return {
    totalReferrers: summaries.length,
    pendingApprovals,
    totalConfirmedPaid,
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
        parsed && typeof parsed.profiles === "object" && !Array.isArray(parsed.profiles)
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
// User Actions (Register Code, Save Payout Info, Submit Claim)
// ──────────────────────────────────────────────────────────────

/**
 * Registers or updates the current user's referral profile & payout info on the Gist.
 */
export async function registerOrUpdateMyReferrerProfile(params: {
  name: string;
  payoutInfo?: string;
}): Promise<{ ok: boolean; code: string; error?: string }> {
  const cleanName = sanitizeText(params.name || "Member", 40);
  const cleanPayout = sanitizeText(params.payoutInfo || "", 80);
  const code = getOrCreateMyReferralCode(cleanName);
  const deviceId = getOrCreateDeviceId();

  if (cleanPayout) {
    savePayoutInfoLocally(cleanPayout);
  }

  const latest = await fetchReferralSystemData(true);
  const existing = latest.profiles[code];

  latest.profiles[code] = {
    code,
    name: cleanName,
    deviceId,
    payoutInfo: cleanPayout || existing?.payoutInfo || "",
    createdAt: existing?.createdAt || Date.now(),
  };

  const saved = await saveReferralSystemData(latest);
  return {
    ok: saved,
    code,
    error: saved ? undefined : "Saved locally, but could not sync to cloud.",
  };
}

/**
 * Submits a friend's referral code (enters as PENDING until Admin confirms $20 paid).
 */
export async function submitReferralClaim(params: {
  referrerCode: string;
  myName: string;
  myContact?: string;
}): Promise<{ ok: boolean; message: string }> {
  const normCode = normalizeReferralCode(params.referrerCode);
  const myCode = getOrCreateMyReferralCode(params.myName);
  const myDeviceId = getOrCreateDeviceId();
  const cleanMyName = sanitizeText(params.myName || "New Member", 40);
  const cleanContact = sanitizeText(params.myContact || "", 80);

  if (!normCode || normCode.length < 6) {
    return { ok: false, message: "Please enter a valid referral code." };
  }

  // Block self-referral
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

  if (referrerProfile.deviceId === myDeviceId) {
    return {
      ok: false,
      message: "Self-referrals from the same device are not allowed.",
    };
  }

  const alreadyClaimedInCloud = latest.referrals.some(
    (r) => r.referredDeviceId === myDeviceId && r.status !== "rejected"
  );
  if (alreadyClaimedInCloud) {
    return {
      ok: false,
      message: "A referral has already been submitted from this device.",
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
// Admin Actions (Confirm $20 Paid, Reject, Revert, Record Payout)
// ──────────────────────────────────────────────────────────────

export async function adminUpdateReferralStatus(
  referralId: string,
  status: ReferralStatus,
  note?: string
): Promise<{ ok: boolean; data?: ReferralSystemData }> {
  const latest = await fetchReferralSystemData(true);
  const target = latest.referrals.find((r) => r.id === referralId);
  if (!target) return { ok: false };

  target.status = status;
  target.confirmedAt = status === "confirmed_paid" ? Date.now() : undefined;
  if (note !== undefined) {
    target.note = sanitizeText(note, 120);
  }

  const ok = await saveReferralSystemData(latest);
  return { ok, data: latest };
}

/**
 * Allows Admin to manually add a confirmed paid referral (e.g. if a friend paid cash
 * in person and forgot to type the code in the app!).
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
    referredContact: sanitizeText(params.referredContact || "", 80) || undefined,
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
 * Records a cash / e-Transfer payout sent to a referrer and reduces their Balance Owed.
 */
export async function adminRecordPayout(params: {
  referrerCode: string;
  amount: number;
  method: string;
  note?: string;
}): Promise<{ ok: boolean; message: string; data?: ReferralSystemData }> {
  const normCode = normalizeReferralCode(params.referrerCode);
  const cleanAmount = Math.round(Number(params.amount) * 100) / 100;

  if (!normCode || isNaN(cleanAmount) || cleanAmount <= 0) {
    return { ok: false, message: "Enter a valid payout amount greater than $0." };
  }

  const latest = await fetchReferralSystemData(true);
  const summary = computeReferrerSummary(normCode, latest);

  const payout: PayoutRecord = {
    id: `pay-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    referrerCode: normCode,
    referrerName: summary.name,
    amount: cleanAmount,
    method: sanitizeText(params.method || "e-Transfer", 30),
    note: sanitizeText(params.note || "", 120) || undefined,
    paidAt: Date.now(),
  };

  latest.payouts.unshift(payout);
  const ok = await saveReferralSystemData(latest);

  return {
    ok,
    message: ok
      ? `Recorded $${cleanAmount.toFixed(2)} payout to ${summary.name} (${payout.method}).`
      : "Failed to save payout to cloud.",
    data: latest,
  };
}
