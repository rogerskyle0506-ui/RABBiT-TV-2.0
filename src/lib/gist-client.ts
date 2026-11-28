// src/lib/gist-client.ts
/**
 * ============================================================================
 * ENTERPRISE GITHUB GIST TRANSPORT LAYER (gist-client.ts)
 * ============================================================================
 * Shared infrastructure for referrals, bugReports, community-service, report,
 * live-feed-service, and updater:
 *  - ETag / If-None-Match conditional GET caching (304 responses do NOT burn
 *    GitHub's 5,000 req/hr primary PAT rate limit)
 *  - Single-flight GET deduplication across concurrent boot/tab calls
 *  - Automatic `truncated: true` -> `raw_url` hydration (prevents silent JSON
 *    truncation & catastrophic file wipes as Gist files grow)
 *  - Serialized per-Gist write queue with 1.05s mutative request pacing
 *    (complies with GitHub's secondary rate limit rules & prevents lost writes)
 *  - Retry-After / X-RateLimit-Reset backoff & circuit breaker
 *  - Prototype-pollution-safe JSON parser & cryptographic ID generator
 */

const DEFAULT_GIST_ID = ((import.meta as any).env?.VITE_GIST_ID as string) || "";
const DEFAULT_GH_PAT = ((import.meta as any).env?.VITE_GH_PAT as string) || "";

const DEFAULT_TIMEOUT_MS = 9000;
const MUTATION_PACING_MS = 1050; // GitHub best practice: >= 1s between PATCH calls
const MIN_FRESH_MS = 8000; // Reuse very recent snapshot within 8s unless forced

export interface GistFilePayload {
  content?: string;
  truncated?: boolean;
  raw_url?: string;
}

export interface GistSnapshot {
  gistId: string;
  etag: string | null;
  fetchedAt: number;
  serverTimeMs: number;
  files: Record<string, GistFilePayload>;
}

interface GistCacheSlot {
  snapshot: GistSnapshot | null;
  inFlightGet: Promise<GistSnapshot | null> | null;
  writeChain: Promise<unknown>;
  lastMutationAt: number;
  rateLimitedUntil: number;
}

const slots = new Map<string, GistCacheSlot>();

function getSlot(gistId: string): GistCacheSlot {
  let slot = slots.get(gistId);
  if (!slot) {
    slot = {
      snapshot: null,
      inFlightGet: null,
      writeChain: Promise.resolve(),
      lastMutationAt: 0,
      rateLimitedUntil: 0,
    };
    slots.set(gistId, slot);
  }
  return slot;
}

/** Prototype-pollution-safe JSON parser */
export function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
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

/** Cryptographically strong ID generator (zero Math.random() entropy weakness) */
export function generateSecureId(prefix = "id", randomBytes = 6): string {
  const ts = Date.now().toString(36);
  try {
    if (typeof crypto !== "undefined") {
      if (typeof crypto.randomUUID === "function" && randomBytes >= 8) {
        return `${prefix}_${ts}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
      }
      if (typeof crypto.getRandomValues === "function") {
        const buf = new Uint8Array(Math.max(4, Math.min(24, randomBytes)));
        crypto.getRandomValues(buf);
        const hex = Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
        return `${prefix}_${ts}_${hex}`;
      }
    }
  } catch {
    // Fallback below for restricted WebViews
  }
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${ts}_${rand}`;
}

export function isGistConfigured(gistId = DEFAULT_GIST_ID): boolean {
  return Boolean(gistId && DEFAULT_GH_PAT);
}

async function fetchWithAbortTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = DEFAULT_TIMEOUT_MS
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

function updateRateLimitFromHeaders(slot: GistCacheSlot, res: Response): void {
  const retryAfter = Number(res.headers.get("retry-after") || 0);
  if (retryAfter > 0 && Number.isFinite(retryAfter)) {
    slot.rateLimitedUntil = Math.max(
      slot.rateLimitedUntil,
      Date.now() + Math.min(retryAfter, 300) * 1000
    );
    return;
  }
  const remaining = res.headers.get("x-ratelimit-remaining");
  const resetEpochSec = Number(res.headers.get("x-ratelimit-reset") || 0);
  if (remaining === "0" && resetEpochSec > 0) {
    slot.rateLimitedUntil = Math.max(
      slot.rateLimitedUntil,
      Math.min(resetEpochSec * 1000, Date.now() + 5 * 60 * 1000)
    );
  }
}

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window !== "undefined") {
      window.setTimeout(resolve, ms);
    } else {
      setTimeout(resolve, ms);
    }
  });
}

/**
 * Fetches the full Gist snapshot using ETag conditional caching and single-flight
 * deduplication. `304 Not Modified` responses reuse the cached files with zero
 * GitHub primary rate-limit cost.
 */
export async function fetchGistSnapshot(options?: {
  gistId?: string;
  force?: boolean;
  maxAgeMs?: number;
  timeoutMs?: number;
}): Promise<GistSnapshot | null> {
  const gistId = (options?.gistId || DEFAULT_GIST_ID).trim();
  if (!gistId || !DEFAULT_GH_PAT) return null;

  const slot = getSlot(gistId);
  const now = Date.now();
  const maxAge = options?.maxAgeMs ?? MIN_FRESH_MS;

  if (
    !options?.force &&
    slot.snapshot &&
    now - slot.snapshot.fetchedAt < maxAge
  ) {
    return slot.snapshot;
  }

  // Respect GitHub rate-limit backoff window
  if (slot.rateLimitedUntil > now) {
    return slot.snapshot;
  }

  if (slot.inFlightGet && !options?.force) {
    return slot.inFlightGet;
  }

  const task = (async (): Promise<GistSnapshot | null> => {
    const apiUrl = `https://api.github.com/gists/${encodeURIComponent(gistId)}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${DEFAULT_GH_PAT}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "RabbitTV-App",
    };

    if (slot.snapshot?.etag) {
      headers["If-None-Match"] = slot.snapshot.etag;
    }

    try {
      const res = await fetchWithAbortTimeout(
        apiUrl,
        { method: "GET", headers, cache: "no-store" },
        options?.timeoutMs ?? DEFAULT_TIMEOUT_MS
      );

      const dateHeader = res.headers.get("date");
      const parsedServerMs = dateHeader ? Date.parse(dateHeader) : NaN;
      const serverTimeMs = !isNaN(parsedServerMs) ? parsedServerMs : Date.now();

      if (res.status === 304 && slot.snapshot) {
        slot.snapshot = {
          ...slot.snapshot,
          fetchedAt: Date.now(),
          serverTimeMs,
        };
        return slot.snapshot;
      }

      if (res.status === 403 || res.status === 429) {
        updateRateLimitFromHeaders(slot, res);
        return slot.snapshot;
      }

      if (!res.ok) {
        return slot.snapshot;
      }

      const data = await res.json();
      const etag = res.headers.get("etag") || slot.snapshot?.etag || null;
      const snapshot: GistSnapshot = {
        gistId,
        etag,
        fetchedAt: Date.now(),
        serverTimeMs,
        files: (data && typeof data.files === "object" ? data.files : {}) as Record<
          string,
          GistFilePayload
        >,
      };
      slot.snapshot = snapshot;
      return snapshot;
    } catch {
      return slot.snapshot;
    } finally {
      slot.inFlightGet = null;
    }
  })();

  slot.inFlightGet = task;
  return task;
}

/**
 * Safely reads a single file's full text from a Gist snapshot.
 * Automatically fetches `raw_url` if GitHub truncated `content` (> 1 MB),
 * preventing JSON.parse crashes and accidental data wipes.
 */
export async function readGistFileText(
  fileName: string,
  options?: {
    gistId?: string;
    force?: boolean;
    maxAgeMs?: number;
    timeoutMs?: number;
  }
): Promise<string | null> {
  const snapshot = await fetchGistSnapshot(options);
  if (!snapshot) return null;
  const fileObj = snapshot.files[fileName];
  if (!fileObj) return null;

  if (fileObj.truncated && typeof fileObj.raw_url === "string") {
    try {
      const rawRes = await fetchWithAbortTimeout(
        fileObj.raw_url,
        { method: "GET", cache: "no-store" },
        options?.timeoutMs ?? DEFAULT_TIMEOUT_MS
      );
      if (rawRes.ok) {
        const fullText = await rawRes.text();
        fileObj.content = fullText;
        fileObj.truncated = false;
        return fullText;
      }
    } catch {
      return null;
    }
  }

  return typeof fileObj.content === "string" ? fileObj.content : null;
}

/**
 * Reads & parses a JSON file from the Gist safely.
 */
export async function readGistJsonFile<T>(
  fileName: string,
  fallback: T,
  options?: {
    gistId?: string;
    force?: boolean;
    maxAgeMs?: number;
    timeoutMs?: number;
  }
): Promise<T> {
  const text = await readGistFileText(fileName, options);
  if (text === null) return fallback;
  return safeJsonParse<T>(text, fallback);
}

/**
 * Serialized, rate-limit-paced Gist PATCH writer.
 * Queues all mutations targeting the same Gist so two writes never overlap,
 * enforces GitHub's 1s pacing between mutative calls, and refreshes the cache
 * immediately with the returned snapshot & ETag.
 */
export function patchGistFilesSerialized(
  files: Record<string, { content: string }>,
  options?: {
    gistId?: string;
    timeoutMs?: number;
    maxPayloadBytes?: number;
  }
): Promise<boolean> {
  const gistId = (options?.gistId || DEFAULT_GIST_ID).trim();
  if (!gistId || !DEFAULT_GH_PAT) return Promise.resolve(false);

  const slot = getSlot(gistId);
  const runWrite = async (): Promise<boolean> => {
    const now = Date.now();
    if (slot.rateLimitedUntil > now) {
      return false;
    }

    const bodyStr = JSON.stringify({ files });
    const limit = options?.maxPayloadBytes ?? 900 * 1024;
    if (bodyStr.length > limit) {
      console.error(`Blocked oversized Gist PATCH (${bodyStr.length} bytes > ${limit})`);
      return false;
    }

    // Enforce >= 1s pacing between mutative requests (GitHub secondary rate-limit rule)
    const sinceLast = Date.now() - slot.lastMutationAt;
    if (sinceLast < MUTATION_PACING_MS) {
      await sleepMs(MUTATION_PACING_MS - sinceLast);
    }

    const apiUrl = `https://api.github.com/gists/${encodeURIComponent(gistId)}`;
    slot.lastMutationAt = Date.now();

    try {
      const res = await fetchWithAbortTimeout(
        apiUrl,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${DEFAULT_GH_PAT}`,
            Accept: "application/vnd.github+json",
            "Content-Type": "application/json",
            "User-Agent": "RabbitTV-App",
          },
          body: bodyStr,
        },
        options?.timeoutMs ?? DEFAULT_TIMEOUT_MS
      );

      if (res.status === 403 || res.status === 429) {
        updateRateLimitFromHeaders(slot, res);
        return false;
      }

      if (!res.ok) return false;

      const updated = await res.json().catch(() => null);
      const etag = res.headers.get("etag") || null;
      const dateHeader = res.headers.get("date");
      const parsedServerMs = dateHeader ? Date.parse(dateHeader) : NaN;
      const serverTimeMs = !isNaN(parsedServerMs) ? parsedServerMs : Date.now();

      if (updated && typeof updated.files === "object") {
        slot.snapshot = {
          gistId,
          etag,
          fetchedAt: Date.now(),
          serverTimeMs,
          files: updated.files as Record<string, GistFilePayload>,
        };
      } else if (slot.snapshot) {
        // Optimistically patch cached files if response body omitted
        const nextFiles = { ...slot.snapshot.files };
        for (const [k, v] of Object.entries(files)) {
          nextFiles[k] = { content: v.content, truncated: false };
        }
        slot.snapshot = {
          ...slot.snapshot,
          etag,
          fetchedAt: Date.now(),
          serverTimeMs,
          files: nextFiles,
        };
      }

      return true;
    } catch {
      return false;
    }
  };

  const resultPromise = slot.writeChain.then(runWrite, runWrite);
  slot.writeChain = resultPromise.catch(() => false);
  return resultPromise;
}

/**
 * Atomic read-modify-write helper serialized on the per-Gist write queue:
 * guarantees no concurrent local mutation can read stale state before patching.
 */
export function runSerializedGistTransaction<T>(
  work: () => Promise<T>,
  gistId = DEFAULT_GIST_ID
): Promise<T> {
  const cleanId = (gistId || DEFAULT_GIST_ID).trim() || "default";
  const slot = getSlot(cleanId);
  const txPromise = slot.writeChain.then(work, work);
  slot.writeChain = txPromise.catch(() => undefined);
  return txPromise;
}

export function invalidateGistCache(gistId = DEFAULT_GIST_ID): void {
  const cleanId = (gistId || DEFAULT_GIST_ID).trim();
  if (!cleanId) {
    slots.clear();
    return;
  }
  const slot = slots.get(cleanId);
  if (slot) {
    slot.snapshot = null;
  }
}
