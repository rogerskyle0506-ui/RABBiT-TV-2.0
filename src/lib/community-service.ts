/**
 * ============================================================
 * RABBiT TV MOVIE CLUB — COMMUNITY PROFILES, REVIEWS & BUDDIES
 * ============================================================
 * - Runs on GitHub Gists today (`VITE_COMMUNITY_GIST_ID || VITE_GIST_ID`)
 * - Pluggable `CommunityStorageAdapter` — set `VITE_COMMUNITY_API_URL` later
 *   to switch seamlessly to your own server with ZERO UI changes!
 * - Zero private data ever leaves the device (separate anonymous `publicId`
 *   + local-only secret + SHA-256 `ownerProof`; never uploads real name,
 *   age, PIN, device ID, or activation key)
 * - Strict read-time & write-time moderation, schema validation, TMDB-only
 *   poster URL pinning, auto-hide at 3 reports, 2-way user blocking, & Kids lock
 */

import {
  getKidsModeLocked,
  getSavedUserAge,
  purgeOldTmdbCaches,
} from "./settings";
import { getActiveMascotBadge } from "./mascots";
import {
  getWatchHistory,
  getWatchActivityStats,
  calculateSeriesProgress,
} from "./watch-history";
import {
  moderatePublicText,
  sanitizePublicText,
  validatePublicHandle,
  checkActionRateLimit,
  commitActionRateLimit,
} from "./content-moderation";

// ——— Environment & Pluggable Backend Config ———
const COMMUNITY_API_URL = (
  ((import.meta as any).env?.VITE_COMMUNITY_API_URL as string) || ""
).replace(/\/+$/, "");

// Supports optional dedicated Community Gist ID for extra isolation, falling back to main Gist
const COMMUNITY_GIST_ID =
  ((import.meta as any).env?.VITE_COMMUNITY_GIST_ID as string) ||
  ((import.meta as any).env?.VITE_GIST_ID as string) ||
  "";
const GITHUB_TOKEN = ((import.meta as any).env?.VITE_GH_PAT as string) || "";
const GIST_API_URL = COMMUNITY_GIST_ID
  ? `https://api.github.com/gists/${COMMUNITY_GIST_ID}`
  : "";

const PROFILES_FILE = "community_profiles.json";
const REVIEWS_FILE = "community_reviews.json";
const BUDDIES_FILE = "community_buddies.json";

const LOCAL_IDENTITY_KEY = "rabtv_comm_identity_v1";
const LOCAL_BLOCKED_KEY = "rabtv_comm_blocked_v1";
const LOCAL_CACHE_KEY = "rabtv_comm_cache_v1";

const CACHE_TTL_MS = 90 * 1000; // 90s client cache keeps Gist API calls light
const NETWORK_TIMEOUT_MS = 9000;
const AUTO_HIDE_REPORT_THRESHOLD = 3;

const MAX_PROFILES = 150;
const MAX_REVIEWS = 400;
const MAX_BUDDY_THREADS = 120;
const MAX_MESSAGES_PER_THREAD = 40;
const MAX_PUBLIC_WATCHED_SHOWCASE = 10;

export const COMMUNITY_UPDATED_EVENT = "rabtv_community_updated";

// ——— Data Models ———
export interface PublicWatchedItem {
  mediaId: string;
  mediaType: "movie" | "tv";
  title: string;
  posterPath: string | null;
  completed: boolean;
}

export interface CommunityProfile {
  publicId: string;
  ownerProof: string;
  handle: string;
  mascot: string;
  bio: string;
  topGenreVibe: string;
  secondaryVibes: string[];
  moviesWatched: number;
  showsWatched: number;
  showWatchedList: boolean;
  recentWatched: PublicWatchedItem[];
  updatedAt: number;
  reportedBy: string[];
}

export interface CommunityReview {
  reviewId: string;
  mediaKey: string; // e.g. "movie-12345" or "tv-67890"
  mediaId: string;
  mediaType: "movie" | "tv";
  title: string;
  posterPath: string | null;
  authorId: string;
  ownerProof: string;
  authorHandle: string;
  authorMascot: string;
  rating: number; // 1..5
  liked: boolean; // true = Liked, false = Disliked
  comment: string;
  isSpoiler: boolean;
  createdAt: number;
  updatedAt: number;
  reportedBy: string[];
}

export interface BuddyMessage {
  msgId: string;
  senderId: string;
  senderHandle: string;
  senderMascot: string;
  text: string;
  isSpoiler: boolean;
  sentAt: number;
}

export interface WatchBuddyThread {
  threadId: string;
  mediaId: string;
  mediaType: "movie" | "tv";
  title: string;
  posterPath: string | null;
  fromId: string;
  fromHandle: string;
  fromMascot: string;
  toId: string;
  toHandle: string;
  toMascot: string;
  status: "pending" | "accepted" | "declined";
  note: string;
  createdAt: number;
  updatedAt: number;
  messages: BuddyMessage[];
}

export interface LocalCommunityIdentity {
  publicId: string;
  secretKey: string; // NEVER uploaded — stays strictly on this device
  ownerProof: string; // Safe SHA-256 commitment sent to backend
  publicHandle: string;
  bio: string;
  isPublic: boolean;
  showWatchedList: boolean;
  hiddenPublicMediaIds: string[];
}

export interface TitleRatingSummary {
  averageRating: number;
  totalRatings: number;
  likedCount: number;
  dislikedCount: number;
  reviews: CommunityReview[];
  myReview: CommunityReview | null;
}

// TMDB Genre ID -> Display Name (for computing Genre Vibe locally)
const TMDB_GENRE_NAMES: Record<number, string> = {
  28: "Action",
  12: "Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Family",
  14: "Fantasy",
  36: "History",
  27: "Horror",
  10402: "Music",
  9648: "Mystery",
  10749: "Romance",
  878: "Sci-Fi",
  53: "Thriller",
  10752: "War",
  37: "Western",
  10759: "Action & Adventure",
  10765: "Sci-Fi & Fantasy",
};

// ============================================================
// 1. SECURITY & CRYPTO HELPERS (ZERO PRIVATE INFO LEAKED)
// ============================================================

export function isCommunityAccessLocked(): boolean {
  return getKidsModeLocked() || getSavedUserAge() < 13;
}

export function isCommunityBackendConfigured(): boolean {
  return Boolean(COMMUNITY_API_URL || (COMMUNITY_GIST_ID && GITHUB_TOKEN));
}

export function getCommunityBackendLabel(): string {
  if (COMMUNITY_API_URL) return "RABBiT Server";
  if (COMMUNITY_GIST_ID && GITHUB_TOKEN) return "GitHub Gist Relay";
  return "Offline";
}

function generateRandomHex(bytesLen: number): string {
  try {
    const arr = new Uint8Array(bytesLen);
    crypto.getRandomValues(arr);
    return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    let out = "";
    for (let i = 0; i < bytesLen * 2; i++) {
      out += Math.floor(Math.random() * 16).toString(16);
    }
    return out;
  }
}

/** Deterministic non-reversible commitment hash so secretKey NEVER leaves device */
function computeProofSyncFallback(input: string): string {
  let h1 = 0xdeadbeef ^ input.length;
  let h2 = 0x41c6ce57 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 =
    Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
    Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 =
    Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
    Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `prf_${(h2 >>> 0).toString(16).padStart(8, "0")}${(h1 >>> 0)
    .toString(16)
    .padStart(8, "0")}`;
}

async function computeSha256Proof(
  publicId: string,
  secretKey: string
): Promise<string> {
  const raw = `${publicId}:${secretKey}:rabtv-v1`;
  try {
    if (typeof crypto !== "undefined" && crypto.subtle) {
      const encoded = new TextEncoder().encode(raw);
      const digest = await crypto.subtle.digest("SHA-256", encoded);
      const hex = Array.from(new Uint8Array(digest))
        .slice(0, 12)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      return `sha_${hex}`;
    }
  } catch {
    // Fallback below on older Android WebViews
  }
  return computeProofSyncFallback(raw);
}

/** Only allows official TMDB poster paths or verified TMDB/Unsplash HTTPS URLs */
export function sanitizePosterPath(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 260) return null;
  if (/^\/[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$/i.test(trimmed)) {
    return trimmed;
  }
  try {
    const u = new URL(trimmed);
    if (
      u.protocol === "https:" &&
      (u.hostname === "image.tmdb.org" || u.hostname === "images.unsplash.com")
    ) {
      return trimmed;
    }
  } catch {
    return null;
  }
  return null;
}

function safeJsonParse<T>(raw: string | undefined, fallback: T): T {
  if (!raw || typeof raw !== "string") return fallback;
  try {
    return JSON.parse(raw, (key, value) => {
      if (key === "__proto__" || key === "constructor" || key === "prototype") {
        return undefined;
      }
      return value;
    }) as T;
  } catch {
    return fallback;
  }
}

function safeLocalWrite(key: string, payload: unknown): void {
  if (typeof window === "undefined") return;
  const serialized = JSON.stringify(payload);
  try {
    localStorage.setItem(key, serialized);
  } catch {
    try {
      purgeOldTmdbCaches();
      localStorage.setItem(key, serialized);
    } catch {
      // ignore if storage is critically full
    }
  }
}

// ============================================================
// 2. LOCAL ANONYMOUS IDENTITY & BLOCK LIST
// ============================================================

export function getLocalCommunityIdentity(): LocalCommunityIdentity {
  if (typeof window === "undefined") {
    return {
      publicId: "pub_ssr",
      secretKey: "",
      ownerProof: "",
      publicHandle: "",
      bio: "",
      isPublic: false,
      showWatchedList: true,
      hiddenPublicMediaIds: [],
    };
  }
  try {
    const raw = localStorage.getItem(LOCAL_IDENTITY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<LocalCommunityIdentity>;
      if (parsed.publicId && parsed.secretKey) {
        return {
          publicId: String(parsed.publicId),
          secretKey: String(parsed.secretKey),
          ownerProof:
            String(parsed.ownerProof || "") ||
            computeProofSyncFallback(`${parsed.publicId}:${parsed.secretKey}`),
          publicHandle: sanitizePublicText(parsed.publicHandle || "", 20),
          bio: sanitizePublicText(parsed.bio || "", 140),
          isPublic: Boolean(parsed.isPublic),
          showWatchedList: parsed.showWatchedList !== false,
          hiddenPublicMediaIds: Array.isArray(parsed.hiddenPublicMediaIds)
            ? parsed.hiddenPublicMediaIds.filter((x) => typeof x === "string")
            : [],
        };
      }
    }
  } catch {
    // create fresh anonymous identity below
  }

  const publicId = `pub_${generateRandomHex(8)}`;
  const secretKey = generateRandomHex(24);
  const ownerProof = computeProofSyncFallback(`${publicId}:${secretKey}`);
  const fresh: LocalCommunityIdentity = {
    publicId,
    secretKey,
    ownerProof,
    publicHandle: "",
    bio: "",
    isPublic: false,
    showWatchedList: true,
    hiddenPublicMediaIds: [],
  };
  safeLocalWrite(LOCAL_IDENTITY_KEY, fresh);
  return fresh;
}

async function ensureUpgradedOwnerProof(
  identity: LocalCommunityIdentity
): Promise<LocalCommunityIdentity> {
  if (identity.ownerProof.startsWith("sha_")) return identity;
  const sha = await computeSha256Proof(identity.publicId, identity.secretKey);
  const next = { ...identity, ownerProof: sha };
  safeLocalWrite(LOCAL_IDENTITY_KEY, next);
  return next;
}

export function getBlockedPublicIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_BLOCKED_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === "string" && x.length > 0)
      : [];
  } catch {
    return [];
  }
}

export function blockCommunityUser(targetPublicId: string): void {
  const clean = String(targetPublicId || "").trim();
  if (!clean) return;
  const set = new Set(getBlockedPublicIds());
  set.add(clean);
  safeLocalWrite(LOCAL_BLOCKED_KEY, Array.from(set).slice(0, 100));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(COMMUNITY_UPDATED_EVENT));
  }
}

export function unblockCommunityUser(targetPublicId: string): void {
  const clean = String(targetPublicId || "").trim();
  const next = getBlockedPublicIds().filter((id) => id !== clean);
  safeLocalWrite(LOCAL_BLOCKED_KEY, next);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(COMMUNITY_UPDATED_EVENT));
  }
}

export function toggleHideTitleFromPublicProfile(mediaId: string): string[] {
  const cleanId = String(mediaId || "").replace(/^(movie|tv)-/i, "").trim();
  const identity = getLocalCommunityIdentity();
  const set = new Set(identity.hiddenPublicMediaIds);
  if (set.has(cleanId)) set.delete(cleanId);
  else set.add(cleanId);
  const next = { ...identity, hiddenPublicMediaIds: Array.from(set) };
  safeLocalWrite(LOCAL_IDENTITY_KEY, next);
  return next.hiddenPublicMediaIds;
}

// ============================================================
// 3. PLUGGABLE STORAGE ADAPTER (GIST TODAY -> YOUR SERVER LATER)
// ============================================================

interface CommunityBundle {
  profiles: CommunityProfile[];
  reviews: CommunityReview[];
  buddies: WatchBuddyThread[];
}

interface CommunityStorageAdapter {
  readFile<T>(fileName: string, fallback: T): Promise<T>;
  writeFile(fileName: string, data: unknown): Promise<boolean>;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = NETWORK_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer =
    typeof window !== "undefined"
      ? window.setTimeout(() => controller.abort(), timeoutMs)
      : setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    if (typeof window !== "undefined") window.clearTimeout(timer as number);
    else clearTimeout(timer);
  }
}

/** GitHub Gist Adapter (active today when VITE_COMMUNITY_API_URL is empty) */
const GistCommunityAdapter: CommunityStorageAdapter = {
  async readFile<T>(fileName: string, fallback: T): Promise<T> {
    if (!GIST_API_URL || !GITHUB_TOKEN) return fallback;
    try {
      const res = await fetchWithTimeout(`${GIST_API_URL}?t=${Date.now()}`, {
        method: "GET",
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "RabbitTV-App",
        },
      });
      if (!res.ok) return fallback;
      const gist = await res.json();
      const fileObj = gist?.files?.[fileName];
      if (!fileObj) return fallback;

      // Support truncated large Gist files transparently via raw_url
      let rawText: string | undefined = fileObj.content;
      if (fileObj.truncated && typeof fileObj.raw_url === "string") {
        const rawRes = await fetchWithTimeout(fileObj.raw_url, {
          method: "GET",
          cache: "no-store",
        });
        if (rawRes.ok) rawText = await rawRes.text();
      }
      return safeJsonParse<T>(rawText, fallback);
    } catch {
      return fallback;
    }
  },

  async writeFile(fileName: string, data: unknown): Promise<boolean> {
    if (!GIST_API_URL || !GITHUB_TOKEN) return false;
    try {
      const content = JSON.stringify(data);
      // Guard against runaway payloads bloating the Gist
      if (content.length > 480 * 1024) return false;

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
            [fileName]: { content },
          },
        }),
      });
      return res.ok;
    } catch {
      return false;
    }
  },
};

/**
 * Future Self-Hosted Server Adapter:
 * When you stand up your own server later, simply set `VITE_COMMUNITY_API_URL`
 * in your build secrets — every screen automatically routes through your server!
 */
const ServerCommunityAdapter: CommunityStorageAdapter = {
  async readFile<T>(fileName: string, fallback: T): Promise<T> {
    if (!COMMUNITY_API_URL) return fallback;
    try {
      const endpoint = fileName.replace(/\.json$/, "");
      const res = await fetchWithTimeout(
        `${COMMUNITY_API_URL}/community/${encodeURIComponent(endpoint)}`,
        {
          method: "GET",
          cache: "no-store",
          headers: { Accept: "application/json" },
        }
      );
      if (!res.ok) return fallback;
      const txt = await res.text();
      return safeJsonParse<T>(txt, fallback);
    } catch {
      return fallback;
    }
  },

  async writeFile(fileName: string, data: unknown): Promise<boolean> {
    if (!COMMUNITY_API_URL) return false;
    try {
      const endpoint = fileName.replace(/\.json$/, "");
      const identity = getLocalCommunityIdentity();
      const res = await fetchWithTimeout(
        `${COMMUNITY_API_URL}/community/${encodeURIComponent(endpoint)}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "X-Rabbit-Public-Id": identity.publicId,
            "X-Rabbit-Owner-Proof": identity.ownerProof,
          },
          body: JSON.stringify(data),
        }
      );
      return res.ok;
    } catch {
      return false;
    }
  },
};

function getAdapter(): CommunityStorageAdapter {
  return COMMUNITY_API_URL ? ServerCommunityAdapter : GistCommunityAdapter;
}

// ============================================================
// 4. DEFENSIVE READ-TIME SANITIZATION & IN-MEMORY CACHE
// ============================================================

let cacheMem: {
  profilesAt: number;
  reviewsAt: number;
  buddiesAt: number;
  bundle: CommunityBundle;
} = {
  profilesAt: 0,
  reviewsAt: 0,
  buddiesAt: 0,
  bundle: { profiles: [], reviews: [], buddies: [] },
};

function sanitizeRemoteProfile(raw: any): CommunityProfile | null {
  if (!raw || typeof raw !== "object") return null;
  const publicId = sanitizePublicText(raw.publicId, 40);
  const handle = sanitizePublicText(raw.handle, 20);
  if (!publicId || handle.length < 3) return null;

  // Read-time moderation defense (protects UI even if Gist was tampered with)
  if (!moderatePublicText(handle, { maxLen: 20 }).allowed) return null;
  const bioCheck = moderatePublicText(raw.bio || "", {
    maxLen: 140,
    allowEmpty: true,
  });

  const reportedBy = Array.isArray(raw.reportedBy)
    ? Array.from(
        new Set(raw.reportedBy.filter((x: any) => typeof x === "string"))
      ).slice(0, 20)
    : [];

  const recentWatched: PublicWatchedItem[] = Array.isArray(raw.recentWatched)
    ? raw.recentWatched
        .slice(0, MAX_PUBLIC_WATCHED_SHOWCASE)
        .filter((w: any) => w && typeof w.mediaId === "string" && typeof w.title === "string")
        .map((w: any) => ({
          mediaId: sanitizePublicText(w.mediaId, 24),
          mediaType: w.mediaType === "tv" ? "tv" : "movie",
          title: sanitizePublicText(w.title, 70),
          posterPath: sanitizePosterPath(w.posterPath),
          completed: Boolean(w.completed),
        }))
    : [];

  return {
    publicId,
    ownerProof: sanitizePublicText(raw.ownerProof, 64),
    handle,
    mascot: sanitizePublicText(raw.mascot || "classic", 40) || "classic",
    bio: bioCheck.allowed ? bioCheck.sanitizedText : "",
    topGenreVibe: sanitizePublicText(raw.topGenreVibe || "Movie Buff", 40),
    secondaryVibes: Array.isArray(raw.secondaryVibes)
      ? raw.secondaryVibes
          .filter((v: any) => typeof v === "string")
          .map((v: string) => sanitizePublicText(v, 24))
          .filter(Boolean)
          .slice(0, 3)
      : [],
    moviesWatched: Math.max(0, Math.min(99999, Number(raw.moviesWatched) || 0)),
    showsWatched: Math.max(0, Math.min(99999, Number(raw.showsWatched) || 0)),
    showWatchedList: raw.showWatchedList !== false,
    recentWatched,
    updatedAt: Number(raw.updatedAt) || 0,
    reportedBy: reportedBy as string[],
  };
}

function sanitizeRemoteReview(raw: any): CommunityReview | null {
  if (!raw || typeof raw !== "object") return null;
  const reviewId = sanitizePublicText(raw.reviewId, 60);
  const mediaId = sanitizePublicText(raw.mediaId, 24);
  const authorId = sanitizePublicText(raw.authorId, 40);
  const authorHandle = sanitizePublicText(raw.authorHandle, 20);
  const comment = sanitizePublicText(raw.comment, 420);
  if (!reviewId || !mediaId || !authorId || !authorHandle) return null;

  // Read-time moderation defense
  if (!moderatePublicText(authorHandle, { maxLen: 20 }).allowed) return null;
  if (comment && !moderatePublicText(comment, { maxLen: 420 }).allowed) {
    return null;
  }

  const rating = Math.max(1, Math.min(5, Math.round(Number(raw.rating) || 0)));
  const mediaType: "movie" | "tv" = raw.mediaType === "tv" ? "tv" : "movie";
  const reportedBy = Array.isArray(raw.reportedBy)
    ? Array.from(
        new Set(raw.reportedBy.filter((x: any) => typeof x === "string"))
      ).slice(0, 20)
    : [];

  return {
    reviewId,
    mediaKey: `${mediaType}-${mediaId}`,
    mediaId,
    mediaType,
    title: sanitizePublicText(raw.title || "Untitled", 80),
    posterPath: sanitizePosterPath(raw.posterPath),
    authorId,
    ownerProof: sanitizePublicText(raw.ownerProof, 64),
    authorHandle,
    authorMascot: sanitizePublicText(raw.authorMascot || "classic", 40) || "classic",
    rating,
    liked: raw.liked !== false,
    comment,
    isSpoiler: Boolean(raw.isSpoiler),
    createdAt: Number(raw.createdAt) || Date.now(),
    updatedAt: Number(raw.updatedAt) || Date.now(),
    reportedBy: reportedBy as string[],
  };
}

function sanitizeRemoteBuddyThread(raw: any): WatchBuddyThread | null {
  if (!raw || typeof raw !== "object") return null;
  const threadId = sanitizePublicText(raw.threadId, 60);
  const mediaId = sanitizePublicText(raw.mediaId, 24);
  const fromId = sanitizePublicText(raw.fromId, 40);
  const toId = sanitizePublicText(raw.toId, 40);
  if (!threadId || !mediaId || !fromId || !toId) return null;

  const status =
    raw.status === "accepted" || raw.status === "declined"
      ? raw.status
      : "pending";
  const noteCheck = moderatePublicText(raw.note || "", {
    maxLen: 160,
    allowEmpty: true,
  });

  const messages: BuddyMessage[] = Array.isArray(raw.messages)
    ? raw.messages
        .slice(-MAX_MESSAGES_PER_THREAD)
        .map((m: any) => {
          if (!m || typeof m !== "object") return null;
          const textCheck = moderatePublicText(m.text || "", { maxLen: 360 });
          if (!textCheck.allowed) return null;
          return {
            msgId: sanitizePublicText(m.msgId, 50),
            senderId: sanitizePublicText(m.senderId, 40),
            senderHandle: sanitizePublicText(m.senderHandle || "Member", 20),
            senderMascot: sanitizePublicText(m.senderMascot || "classic", 40),
            text: textCheck.sanitizedText,
            isSpoiler: Boolean(m.isSpoiler),
            sentAt: Number(m.sentAt) || Date.now(),
          };
        })
        .filter((x: BuddyMessage | null): x is BuddyMessage => Boolean(x))
    : [];

  return {
    threadId,
    mediaId,
    mediaType: raw.mediaType === "tv" ? "tv" : "movie",
    title: sanitizePublicText(raw.title || "Movie", 80),
    posterPath: sanitizePosterPath(raw.posterPath),
    fromId,
    fromHandle: sanitizePublicText(raw.fromHandle || "Member", 20),
    fromMascot: sanitizePublicText(raw.fromMascot || "classic", 40),
    toId,
    toHandle: sanitizePublicText(raw.toHandle || "Member", 20),
    toMascot: sanitizePublicText(raw.toMascot || "classic", 40),
    status,
    note: noteCheck.allowed ? noteCheck.sanitizedText : "",
    createdAt: Number(raw.createdAt) || Date.now(),
    updatedAt: Number(raw.updatedAt) || Date.now(),
    messages,
  };
}

// ============================================================
// 5. LOCAL GENRE VIBE & WATCHED SHOWCASE BUILDER
// ============================================================

export function computeMyPublicVibePreview(): {
  topGenreVibe: string;
  secondaryVibes: string[];
  moviesWatched: number;
  showsWatched: number;
  recentWatched: PublicWatchedItem[];
} {
  const identity = getLocalCommunityIdentity();
  const hiddenSet = new Set(identity.hiddenPublicMediaIds);
  const history = getWatchHistory();
  const stats = getWatchActivityStats();

  const genreCounts: Record<number, number> = {};
  const entries = Object.values(history).sort(
    (a, b) => (b.lastWatchedAt || 0) - (a.lastWatchedAt || 0)
  );

  let moviesWatched = 0;
  let showsWatched = 0;
  const recentWatched: PublicWatchedItem[] = [];

  for (const entry of entries) {
    if (entry.mediaType === "tv") showsWatched++;
    else moviesWatched++;

    const gIds = (entry as any).genreIds;
    if (Array.isArray(gIds)) {
      for (const gid of gIds) {
        if (typeof gid === "number" && TMDB_GENRE_NAMES[gid]) {
          genreCounts[gid] = (genreCounts[gid] || 0) + 1;
        }
      }
    }

    if (
      !hiddenSet.has(entry.showId) &&
      recentWatched.length < MAX_PUBLIC_WATCHED_SHOWCASE
    ) {
      recentWatched.push({
        mediaId: entry.showId,
        mediaType: entry.mediaType === "tv" ? "tv" : "movie",
        title: sanitizePublicText(entry.title, 70),
        posterPath: sanitizePosterPath(entry.posterPath),
        completed: calculateSeriesProgress(entry) >= 100,
      });
    }
  }

  const rankedGenres = Object.entries(genreCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => TMDB_GENRE_NAMES[Number(id)])
    .filter(Boolean);

  const primary = rankedGenres[0] || stats.topGenreName || "Cinema Explorer";
  const secondaryVibes = rankedGenres.slice(1, 4);
  const topGenreVibe =
    rankedGenres.length >= 2
      ? `${rankedGenres[0]} & ${rankedGenres[1]} Fan`
      : primary === "Cinema Explorer"
        ? "All-Around Movie Buff"
        : `Loves ${primary}`;

  return {
    topGenreVibe,
    secondaryVibes,
    moviesWatched,
    showsWatched,
    recentWatched,
  };
}

// ============================================================
// 6. PUBLIC PROFILES API
// ============================================================

export async function fetchPublicProfiles(
  force = false
): Promise<CommunityProfile[]> {
  if (!force && Date.now() - cacheMem.profilesAt < CACHE_TTL_MS && cacheMem.bundle.profiles.length > 0) {
    return filterVisibleProfiles(cacheMem.bundle.profiles);
  }
  const rawList = await getAdapter().readFile<unknown[]>(PROFILES_FILE, []);
  const clean = Array.isArray(rawList)
    ? rawList
        .map(sanitizeRemoteProfile)
        .filter((p): p is CommunityProfile => Boolean(p))
    : [];

  cacheMem.bundle.profiles = clean;
  cacheMem.profilesAt = Date.now();
  return filterVisibleProfiles(clean);
}

function filterVisibleProfiles(list: CommunityProfile[]): CommunityProfile[] {
  const blocked = new Set(getBlockedPublicIds());
  const me = getLocalCommunityIdentity().publicId;
  return list
    .filter(
      (p) =>
        p.publicId === me ||
        (!blocked.has(p.publicId) &&
          p.reportedBy.length < AUTO_HIDE_REPORT_THRESHOLD)
    )
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getPublicProfileById(
  publicId: string
): Promise<CommunityProfile | null> {
  const profiles = await fetchPublicProfiles(false);
  return profiles.find((p) => p.publicId === publicId) || null;
}

export async function saveAndPublishMyProfile(input: {
  publicHandle: string;
  bio: string;
  isPublic: boolean;
  showWatchedList: boolean;
}): Promise<{ ok: boolean; error?: string; profile?: CommunityProfile }> {
  if (isCommunityAccessLocked()) {
    return {
      ok: false,
      error: "Public profiles are disabled while Kids Safe Mode is active.",
    };
  }

  const handleCheck = validatePublicHandle(input.publicHandle);
  if (!handleCheck.ok) {
    return { ok: false, error: handleCheck.error };
  }

  const bioCheck = moderatePublicText(input.bio || "", {
    maxLen: 140,
    recordStrikes: true,
    allowEmpty: true,
  });
  if (!bioCheck.allowed) {
    return { ok: false, error: bioCheck.reason };
  }

  const rl = checkActionRateLimit("profile_save", 10_000, 25);
  if (!rl.ok) return { ok: false, error: rl.error };

  const identity = await ensureUpgradedOwnerProof(getLocalCommunityIdentity());
  const updatedIdentity: LocalCommunityIdentity = {
    ...identity,
    publicHandle: handleCheck.cleanHandle,
    bio: bioCheck.sanitizedText,
    isPublic: input.isPublic,
    showWatchedList: input.showWatchedList,
  };
  safeLocalWrite(LOCAL_IDENTITY_KEY, updatedIdentity);

  if (!isCommunityBackendConfigured()) {
    return {
      ok: false,
      error: "Community sync is not configured in this build.",
    };
  }

  // Fresh read-merge-write to avoid overwriting other users
  const rawList = await getAdapter().readFile<unknown[]>(PROFILES_FILE, []);
  const existing = Array.isArray(rawList)
    ? rawList
        .map(sanitizeRemoteProfile)
        .filter((p): p is CommunityProfile => Boolean(p))
    : [];

  // Enforce unique handles across other users
  const handleConflict = existing.find(
    (p) =>
      p.publicId !== updatedIdentity.publicId &&
      p.handle.toLowerCase() === handleCheck.cleanHandle.toLowerCase()
  );
  if (handleConflict) {
    return {
      ok: false,
      error: `"${handleCheck.cleanHandle}" is already taken by another movie buff. Pick a different alias!`,
    };
  }

  const others = existing.filter((p) => p.publicId !== updatedIdentity.publicId);

  if (!input.isPublic) {
    const saved = await getAdapter().writeFile(PROFILES_FILE, others);
    if (!saved) return { ok: false, error: "Could not sync privacy change. Try again." };
    cacheMem.bundle.profiles = others;
    cacheMem.profilesAt = Date.now();
    commitActionRateLimit("profile_save");
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(COMMUNITY_UPDATED_EVENT));
    }
    return { ok: true };
  }

  const prevMine = existing.find((p) => p.publicId === updatedIdentity.publicId);
  const vibe = computeMyPublicVibePreview();

  const myProfile: CommunityProfile = {
    publicId: updatedIdentity.publicId,
    ownerProof: updatedIdentity.ownerProof,
    handle: updatedIdentity.publicHandle,
    mascot: getActiveMascotBadge(),
    bio: updatedIdentity.bio,
    topGenreVibe: vibe.topGenreVibe,
    secondaryVibes: vibe.secondaryVibes,
    moviesWatched: vibe.moviesWatched,
    showsWatched: vibe.showsWatched,
    showWatchedList: updatedIdentity.showWatchedList,
    recentWatched: updatedIdentity.showWatchedList ? vibe.recentWatched : [],
    updatedAt: Date.now(),
    reportedBy: prevMine?.reportedBy || [],
  };

  const merged = [myProfile, ...others].slice(0, MAX_PROFILES);
  const ok = await getAdapter().writeFile(PROFILES_FILE, merged);
  if (!ok) {
    return { ok: false, error: "Network busy — could not publish profile right now." };
  }

  cacheMem.bundle.profiles = merged;
  cacheMem.profilesAt = Date.now();
  commitActionRateLimit("profile_save");
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(COMMUNITY_UPDATED_EVENT));
  }
  return { ok: true, profile: myProfile };
}

// ============================================================
// 7. COMMUNITY RATINGS & REVIEWS API
// ============================================================

async function loadAllReviews(force = false): Promise<CommunityReview[]> {
  if (!force && Date.now() - cacheMem.reviewsAt < CACHE_TTL_MS && cacheMem.bundle.reviews.length > 0) {
    return cacheMem.bundle.reviews;
  }
  const rawList = await getAdapter().readFile<unknown[]>(REVIEWS_FILE, []);
  const clean = Array.isArray(rawList)
    ? rawList
        .map(sanitizeRemoteReview)
        .filter((r): r is CommunityReview => Boolean(r))
    : [];

  cacheMem.bundle.reviews = clean;
  cacheMem.reviewsAt = Date.now();
  return clean;
}

function filterVisibleReviews(list: CommunityReview[]): CommunityReview[] {
  const blocked = new Set(getBlockedPublicIds());
  const me = getLocalCommunityIdentity().publicId;
  return list.filter(
    (r) =>
      r.authorId === me ||
      (!blocked.has(r.authorId) &&
        r.reportedBy.length < AUTO_HIDE_REPORT_THRESHOLD)
  );
}

export async function fetchTitleReviews(
  mediaId: string,
  mediaType: "movie" | "tv",
  force = false
): Promise<TitleRatingSummary> {
  const cleanId = String(mediaId || "").replace(/^(movie|tv)-/i, "").trim();
  const key = `${mediaType}-${cleanId}`;
  const all = filterVisibleReviews(await loadAllReviews(force));
  const matching = all
    .filter((r) => r.mediaKey === key)
    .sort((a, b) => b.updatedAt - a.updatedAt);

  const me = getLocalCommunityIdentity().publicId;
  let sum = 0;
  let likedCount = 0;
  let dislikedCount = 0;
  let myReview: CommunityReview | null = null;

  for (const r of matching) {
    sum += r.rating;
    if (r.liked) likedCount++;
    else dislikedCount++;
    if (r.authorId === me) myReview = r;
  }

  return {
    averageRating:
      matching.length > 0 ? Math.round((sum / matching.length) * 10) / 10 : 0,
    totalRatings: matching.length,
    likedCount,
    dislikedCount,
    reviews: matching,
    myReview,
  };
}

export async function fetchLatestCommunityReviews(
  limit = 24,
  force = false
): Promise<CommunityReview[]> {
  const visible = filterVisibleReviews(await loadAllReviews(force));
  return visible
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, Math.max(1, limit));
}

export async function submitTitleReview(input: {
  mediaId: string;
  mediaType: "movie" | "tv";
  title: string;
  posterPath: string | null;
  rating: number;
  liked: boolean;
  comment: string;
  isSpoiler: boolean;
}): Promise<{ ok: boolean; error?: string; review?: CommunityReview }> {
  if (isCommunityAccessLocked()) {
    return {
      ok: false,
      error: "Community ratings & comments are locked in Kids Safe Mode.",
    };
  }

  const identity = await ensureUpgradedOwnerProof(getLocalCommunityIdentity());
  if (!identity.publicHandle || identity.publicHandle.length < 3) {
    return {
      ok: false,
      error: "Pick an anonymous Public Handle in Movie Club first so your real name stays private!",
    };
  }

  const commentCheck = moderatePublicText(input.comment || "", {
    maxLen: 400,
    recordStrikes: true,
    allowEmpty: true,
  });
  if (!commentCheck.allowed) {
    return { ok: false, error: commentCheck.reason };
  }

  const rl = checkActionRateLimit("submit_review", 20_000, 30);
  if (!rl.ok) return { ok: false, error: rl.error };

  const cleanId = String(input.mediaId || "").replace(/^(movie|tv)-/i, "").trim();
  const mediaKey = `${input.mediaType}-${cleanId}`;
  const safeRating = Math.max(1, Math.min(5, Math.round(Number(input.rating) || 5)));

  const freshList = await loadAllReviews(true);
  const existingOwn = freshList.find(
    (r) => r.mediaKey === mediaKey && r.authorId === identity.publicId
  );

  const review: CommunityReview = {
    reviewId: existingOwn?.reviewId || `rev_${Date.now().toString(36)}_${generateRandomHex(3)}`,
    mediaKey,
    mediaId: cleanId,
    mediaType: input.mediaType,
    title: sanitizePublicText(input.title, 80) || "Untitled",
    posterPath: sanitizePosterPath(input.posterPath),
    authorId: identity.publicId,
    ownerProof: identity.ownerProof,
    authorHandle: identity.publicHandle,
    authorMascot: getActiveMascotBadge(),
    rating: safeRating,
    liked: Boolean(input.liked),
    comment: commentCheck.sanitizedText,
    isSpoiler: Boolean(input.isSpoiler),
    createdAt: existingOwn?.createdAt || Date.now(),
    updatedAt: Date.now(),
    reportedBy: existingOwn?.reportedBy || [],
  };

  const others = freshList.filter(
    (r) => !(r.mediaKey === mediaKey && r.authorId === identity.publicId)
  );
  const merged = [review, ...others].slice(0, MAX_REVIEWS);

  const saved = await getAdapter().writeFile(REVIEWS_FILE, merged);
  if (!saved) {
    return { ok: false, error: "Could not post review right now. Check connection." };
  }

  cacheMem.bundle.reviews = merged;
  cacheMem.reviewsAt = Date.now();
  commitActionRateLimit("submit_review");
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(COMMUNITY_UPDATED_EVENT));
  }
  return { ok: true, review };
}

export async function deleteMyTitleReview(reviewId: string): Promise<boolean> {
  const identity = getLocalCommunityIdentity();
  const freshList = await loadAllReviews(true);
  const target = freshList.find((r) => r.reviewId === reviewId);
  if (!target || target.authorId !== identity.publicId) return false;

  const next = freshList.filter((r) => r.reviewId !== reviewId);
  const ok = await getAdapter().writeFile(REVIEWS_FILE, next);
  if (ok) {
    cacheMem.bundle.reviews = next;
    cacheMem.reviewsAt = Date.now();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(COMMUNITY_UPDATED_EVENT));
    }
  }
  return ok;
}

export async function reportCommunityItem(
  kind: "review" | "profile",
  targetId: string
): Promise<{ ok: boolean; hiddenNow?: boolean; error?: string }> {
  const rl = checkActionRateLimit("report_item", 10_000, 20);
  if (!rl.ok) return { ok: false, error: rl.error };

  const me = getLocalCommunityIdentity().publicId;
  if (kind === "review") {
    const fresh = await loadAllReviews(true);
    let hiddenNow = false;
    const next = fresh.map((r) => {
      if (r.reviewId !== targetId) return r;
      const reporters = Array.from(new Set([...r.reportedBy, me]));
      hiddenNow = reporters.length >= AUTO_HIDE_REPORT_THRESHOLD;
      return { ...r, reportedBy: reporters };
    });
    const ok = await getAdapter().writeFile(REVIEWS_FILE, next);
    if (!ok) return { ok: false, error: "Could not submit report." };
    cacheMem.bundle.reviews = next;
    cacheMem.reviewsAt = Date.now();
    commitActionRateLimit("report_item");
    return { ok: true, hiddenNow };
  }

  const rawProfiles = await getAdapter().readFile<unknown[]>(PROFILES_FILE, []);
  const profiles = Array.isArray(rawProfiles)
    ? rawProfiles
        .map(sanitizeRemoteProfile)
        .filter((p): p is CommunityProfile => Boolean(p))
    : [];
  let hiddenNow = false;
  const next = profiles.map((p) => {
    if (p.publicId !== targetId) return p;
    const reporters = Array.from(new Set([...p.reportedBy, me]));
    hiddenNow = reporters.length >= AUTO_HIDE_REPORT_THRESHOLD;
    return { ...p, reportedBy: reporters };
  });
  const ok = await getAdapter().writeFile(PROFILES_FILE, next);
  if (!ok) return { ok: false, error: "Could not submit report." };
  cacheMem.bundle.profiles = next;
  cacheMem.profilesAt = Date.now();
  commitActionRateLimit("report_item");
  return { ok: true, hiddenNow };
}

// ============================================================
// 8. ASYNC WATCH BUDDY REQUESTS & MOVIE DISCUSSION THREADS
// ============================================================

async function loadAllBuddyThreads(force = false): Promise<WatchBuddyThread[]> {
  if (!force && Date.now() - cacheMem.buddiesAt < CACHE_TTL_MS && cacheMem.bundle.buddies.length > 0) {
    return cacheMem.bundle.buddies;
  }
  const rawList = await getAdapter().readFile<unknown[]>(BUDDIES_FILE, []);
  const clean = Array.isArray(rawList)
    ? rawList
        .map(sanitizeRemoteBuddyThread)
        .filter((t): t is WatchBuddyThread => Boolean(t))
    : [];

  cacheMem.bundle.buddies = clean;
  cacheMem.buddiesAt = Date.now();
  return clean;
}

export async function fetchMyBuddyThreads(
  force = false
): Promise<WatchBuddyThread[]> {
  const me = getLocalCommunityIdentity().publicId;
  const blocked = new Set(getBlockedPublicIds());
  const all = await loadAllBuddyThreads(force);
  return all
    .filter((t) => {
      const involvesMe = t.fromId === me || t.toId === me;
      if (!involvesMe) return false;
      const peerId = t.fromId === me ? t.toId : t.fromId;
      return !blocked.has(peerId) && t.status !== "declined";
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function sendWatchBuddyRequest(input: {
  toProfile: Pick<CommunityProfile, "publicId" | "handle" | "mascot">;
  mediaId: string;
  mediaType: "movie" | "tv";
  title: string;
  posterPath: string | null;
  note?: string;
}): Promise<{ ok: boolean; error?: string; thread?: WatchBuddyThread }> {
  if (isCommunityAccessLocked()) {
    return {
      ok: false,
      error: "Watch Buddy invites are disabled in Kids Safe Mode.",
    };
  }

  const identity = await ensureUpgradedOwnerProof(getLocalCommunityIdentity());
  if (!identity.publicHandle || identity.publicHandle.length < 3) {
    return {
      ok: false,
      error: "Set up your anonymous Public Handle in Movie Club first!",
    };
  }
  if (input.toProfile.publicId === identity.publicId) {
    return { ok: false, error: "You cannot send a Watch Buddy invite to yourself." };
  }

  const noteCheck = moderatePublicText(
    input.note || `Want to watch "${input.title}" on our own time and chat about it?`,
    { maxLen: 160, recordStrikes: true }
  );
  if (!noteCheck.allowed) {
    return { ok: false, error: noteCheck.reason };
  }

  const rl = checkActionRateLimit("buddy_invite", 20_000, 10);
  if (!rl.ok) return { ok: false, error: rl.error };

  const cleanMediaId = String(input.mediaId || "").replace(/^(movie|tv)-/i, "").trim();
  const all = await loadAllBuddyThreads(true);

  const duplicate = all.find(
    (t) =>
      t.mediaId === cleanMediaId &&
      t.mediaType === input.mediaType &&
      t.status !== "declined" &&
      ((t.fromId === identity.publicId && t.toId === input.toProfile.publicId) ||
        (t.fromId === input.toProfile.publicId && t.toId === identity.publicId))
  );
  if (duplicate) {
    return {
      ok: false,
      error: `You already have an active Watch Buddy thread with ${input.toProfile.handle} for this title!`,
    };
  }

  const now = Date.now();
  const thread: WatchBuddyThread = {
    threadId: `bud_${now.toString(36)}_${generateRandomHex(4)}`,
    mediaId: cleanMediaId,
    mediaType: input.mediaType,
    title: sanitizePublicText(input.title, 80),
    posterPath: sanitizePosterPath(input.posterPath),
    fromId: identity.publicId,
    fromHandle: identity.publicHandle,
    fromMascot: getActiveMascotBadge(),
    toId: input.toProfile.publicId,
    toHandle: input.toProfile.handle,
    toMascot: input.toProfile.mascot,
    status: "pending",
    note: noteCheck.sanitizedText,
    createdAt: now,
    updatedAt: now,
    messages: [],
  };

  const merged = [thread, ...all].slice(0, MAX_BUDDY_THREADS);
  const ok = await getAdapter().writeFile(BUDDIES_FILE, merged);
  if (!ok) return { ok: false, error: "Could not send invite right now. Try again." };

  cacheMem.bundle.buddies = merged;
  cacheMem.buddiesAt = Date.now();
  commitActionRateLimit("buddy_invite");
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(COMMUNITY_UPDATED_EVENT));
  }
  return { ok: true, thread };
}

export async function respondToWatchBuddyRequest(
  threadId: string,
  action: "accept" | "decline" | "block"
): Promise<{ ok: boolean; error?: string }> {
  const me = getLocalCommunityIdentity().publicId;
  const all = await loadAllBuddyThreads(true);
  const target = all.find((t) => t.threadId === threadId);
  if (!target || (target.toId !== me && target.fromId !== me)) {
    return { ok: false, error: "Invite not found." };
  }

  if (action === "block") {
    const peerId = target.fromId === me ? target.toId : target.fromId;
    blockCommunityUser(peerId);
  }

  const next =
    action === "accept"
      ? all.map((t) =>
          t.threadId === threadId
            ? { ...t, status: "accepted" as const, updatedAt: Date.now() }
            : t
        )
      : all.filter((t) => t.threadId !== threadId);

  const ok = await getAdapter().writeFile(BUDDIES_FILE, next);
  if (!ok) return { ok: false, error: "Could not update invite right now." };

  cacheMem.bundle.buddies = next;
  cacheMem.buddiesAt = Date.now();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(COMMUNITY_UPDATED_EVENT));
  }
  return { ok: true };
}

export async function sendBuddyThreadMessage(
  threadId: string,
  rawText: string,
  isSpoiler = false
): Promise<{ ok: boolean; error?: string; thread?: WatchBuddyThread }> {
  if (isCommunityAccessLocked()) {
    return { ok: false, error: "Messaging is disabled in Kids Safe Mode." };
  }

  const identity = getLocalCommunityIdentity();
  if (!identity.publicHandle) {
    return { ok: false, error: "Set your anonymous Public Handle first." };
  }

  const mod = moderatePublicText(rawText, { maxLen: 360, recordStrikes: true });
  if (!mod.allowed) {
    return { ok: false, error: mod.reason };
  }

  const rl = checkActionRateLimit("buddy_msg", 5_000, 120);
  if (!rl.ok) return { ok: false, error: rl.error };

  const all = await loadAllBuddyThreads(true);
  const target = all.find((t) => t.threadId === threadId);
  if (
    !target ||
    target.status !== "accepted" ||
    (target.fromId !== identity.publicId && target.toId !== identity.publicId)
  ) {
    return { ok: false, error: "This Watch Buddy chat is not active." };
  }

  const msg: BuddyMessage = {
    msgId: `msg_${Date.now().toString(36)}_${generateRandomHex(3)}`,
    senderId: identity.publicId,
    senderHandle: identity.publicHandle,
    senderMascot: getActiveMascotBadge(),
    text: mod.sanitizedText,
    isSpoiler: Boolean(isSpoiler),
    sentAt: Date.now(),
  };

  const updatedThread: WatchBuddyThread = {
    ...target,
    updatedAt: Date.now(),
    messages: [...target.messages, msg].slice(-MAX_MESSAGES_PER_THREAD),
  };

  const next = [
    updatedThread,
    ...all.filter((t) => t.threadId !== threadId),
  ].slice(0, MAX_BUDDY_THREADS);

  const ok = await getAdapter().writeFile(BUDDIES_FILE, next);
  if (!ok) return { ok: false, error: "Message failed to send. Please retry." };

  cacheMem.bundle.buddies = next;
  cacheMem.buddiesAt = Date.now();
  commitActionRateLimit("buddy_msg");
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(COMMUNITY_UPDATED_EVENT));
  }
  return { ok: true, thread: updatedThread };
}

export function clearCommunityLocalCache(): void {
  cacheMem = {
    profilesAt: 0,
    reviewsAt: 0,
    buddiesAt: 0,
    bundle: { profiles: [], reviews: [], buddies: [] },
  };
  if (typeof window !== "undefined") {
    localStorage.removeItem(LOCAL_CACHE_KEY);
  }
}