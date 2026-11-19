// src/lib/bugReports.ts
const GIST_ID = ((import.meta as any).env?.VITE_GIST_ID as string) || "";
const GITHUB_TOKEN = ((import.meta as any).env?.VITE_GH_PAT as string) || "";
const GIST_API_URL = GIST_ID ? `https://api.github.com/gists/${GIST_ID}` : "";

export interface BugReport {
  id: string;
  name: string;
  codeSuffix: string;
  message: string;
  timestamp: number;
  status: "pending" | "in_progress" | "completed";
}

export interface BannedUser {
  identifier: string; // "name:suffix"
  name: string;
  codeSuffix: string;
  timestamp: number;
}

export interface StrikeRecord {
  identifier: string;
  strikes: number;
}

const STRIKES_KEY = "rabtv_user_strikes";
const CACHE_TTL_MS = 10 * 1000; // 10-second read cache to reduce redundant Gist hits
const FETCH_TIMEOUT_MS = 8000; // Prevent UI hangs on slow TV Wi-Fi
const MAX_STORED_REPORTS = 150; // Hard cap to keep memory light on 1-2GB streaming sticks
const RATE_LIMIT_WINDOW_MS = 45 * 1000; // 45s per-user Gist-level anti-spam window
const DUPLICATE_WINDOW_MS = 10 * 60 * 1000; // 10m duplicate message block

// In-memory read cache
let cachedSystemData: {
  reports: BugReport[];
  bannedUsers: BannedUser[];
  strikes: StrikeRecord[];
} | null = null;
let cachedTimestamp = 0;

function invalidateBugCache(): void {
  cachedSystemData = null;
  cachedTimestamp = 0;
}

function safeParseArray<T>(raw: string | null | undefined): T[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readLocalStrikes(): StrikeRecord[] {
  if (typeof window === "undefined") return [];
  try {
    return safeParseArray<StrikeRecord>(localStorage.getItem(STRIKES_KEY));
  } catch {
    return [];
  }
}

function writeLocalStrikes(strikes: StrikeRecord[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STRIKES_KEY, JSON.stringify(strikes));
  } catch {
    // Ignore storage quota errors on low-storage sticks
  }
}

function mergeStrikeRecords(
  remoteStrikes: StrikeRecord[],
  localStrikes: StrikeRecord[]
): StrikeRecord[] {
  const map = new Map<string, number>();

  for (const rec of [...remoteStrikes, ...localStrikes]) {
    if (!rec || typeof rec.identifier !== "string") continue;
    const key = rec.identifier.trim().toLowerCase();
    const val = Number(rec.strikes) || 0;
    const prev = map.get(key) || 0;
    if (val > prev) {
      map.set(key, val);
    }
  }

  return Array.from(map.entries()).map(([identifier, strikes]) => ({
    identifier,
    strikes,
  }));
}

function sanitizeInput(raw: string, maxLen: number): string {
  return String(raw || "")
    .replace(/[<>]/g, "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

function normalizeCodeSuffix(code: string): string {
  const cleaned = String(code || "0000").trim();
  const digitsOnly = cleaned.replace(/\D/g, "");
  if (digitsOnly.length >= 4) {
    return digitsOnly.slice(-4);
  }
  return cleaned.slice(-4) || "0000";
}

function buildIdentifier(name: string, codeSuffix: string): string {
  return `${name.trim().toLowerCase()}:${codeSuffix.trim().toLowerCase()}`;
}

/**
 * Word-boundary media suggestion detector.
 * Blocks movie/TV requests without false-triggering on words like "showing" or "address".
 */
function isMediaSuggestionMessage(message: string): boolean {
  const lower = message.toLowerCase();
  const wordBoundaryPattern =
    /\b(movie|movies|show|shows|season|seasons|episode|episodes|series)\b/i;
  const requestPhrasePattern = /\b(add|watch|request|upload)\s+/i;

  return wordBoundaryPattern.test(lower) || requestPhrasePattern.test(lower);
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs = FETCH_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer =
    typeof window !== "undefined"
      ? window.setTimeout(() => controller.abort(), timeoutMs)
      : setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    if (typeof window !== "undefined") {
      window.clearTimeout(timer as number);
    } else {
      clearTimeout(timer);
    }
  }
}

/**
 * Fetches all reports, banned users, and strike data from Gist (with short read cache).
 * Pass `forceRefresh = true` before write mutations to prevent stale overwrites.
 */
export async function fetchBugSystemData(forceRefresh = false): Promise<{
  reports: BugReport[];
  bannedUsers: BannedUser[];
  strikes: StrikeRecord[];
}> {
  if (!GIST_ID || !GITHUB_TOKEN || !GIST_API_URL) {
    return { reports: [], bannedUsers: [], strikes: readLocalStrikes() };
  }

  if (
    !forceRefresh &&
    cachedSystemData &&
    Date.now() - cachedTimestamp < CACHE_TTL_MS
  ) {
    return {
      reports: [...cachedSystemData.reports],
      bannedUsers: [...cachedSystemData.bannedUsers],
      strikes: [...cachedSystemData.strikes],
    };
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
      return { reports: [], bannedUsers: [], strikes: readLocalStrikes() };
    }

    const gistData = await res.json();

    const reports = safeParseArray<BugReport>(
      gistData.files?.["bug-reports.json"]?.content
    );
    const bannedUsers = safeParseArray<BannedUser>(
      gistData.files?.["bug-bans.json"]?.content
    );
    const remoteStrikes = safeParseArray<StrikeRecord>(
      gistData.files?.["bug-strikes.json"]?.content
    );

    const mergedStrikes = mergeStrikeRecords(remoteStrikes, readLocalStrikes());
    writeLocalStrikes(mergedStrikes);

    cachedSystemData = {
      reports,
      bannedUsers,
      strikes: mergedStrikes,
    };
    cachedTimestamp = Date.now();

    return {
      reports: [...reports],
      bannedUsers: [...bannedUsers],
      strikes: [...mergedStrikes],
    };
  } catch (error) {
    console.error("Failed to fetch bug system data:", error);
    return { reports: [], bannedUsers: [], strikes: readLocalStrikes() };
  }
}

/**
 * Checks if a user identifier is banned.
 */
export async function isUserBanned(
  name: string,
  codeSuffix: string
): Promise<boolean> {
  const cleanName = sanitizeInput(name, 30) || "Anonymous";
  const suffix = normalizeCodeSuffix(codeSuffix);
  const identifier = buildIdentifier(cleanName, suffix);
  const { bannedUsers } = await fetchBugSystemData();
  return bannedUsers.some(
    (b) => b.identifier.trim().toLowerCase() === identifier
  );
}

/**
 * Submits a bug report with input sanitization, anti-spam rate limiting,
 * duplicate filtering, Gist-backed strike counting, and auto-ban enforcement.
 */
export async function submitBugReport(
  name: string,
  code: string,
  message: string
): Promise<{
  success: boolean;
  error?: string;
  banned?: boolean;
  strikeWarning?: boolean;
}> {
  if (!GIST_ID || !GITHUB_TOKEN || !GIST_API_URL) {
    return { success: false, error: "Gist configuration missing." };
  }

  const cleanName = sanitizeInput(name, 30) || "Anonymous";
  const cleanMessage = sanitizeInput(message, 50);
  const codeSuffix = normalizeCodeSuffix(code);
  const identifier = buildIdentifier(cleanName, codeSuffix);

  if (cleanMessage.length < 4) {
    return {
      success: false,
      error: "⚠️ Please enter at least 4 characters describing the bug.",
    };
  }

  // Always force-refresh before mutating Gist data
  const { reports, bannedUsers, strikes } = await fetchBugSystemData(true);

  // 1. Check if user is already banned
  if (
    bannedUsers.some((b) => b.identifier.trim().toLowerCase() === identifier)
  ) {
    return {
      success: false,
      banned: true,
      error:
        "The owner Rabbit is very busy and you have possibly spammed, annoyed, or offended the admin via messages who has now removed reporting rights for you. If you think this was a mistake please kindly message Rabbit directly for an answer or resolve.",
    };
  }

  // 2. Check for media suggestion violation (Movie/TV requests)
  if (isMediaSuggestionMessage(cleanMessage)) {
    const userStrikeIndex = strikes.findIndex(
      (s: StrikeRecord) => s.identifier.trim().toLowerCase() === identifier
    );
    let currentStrikes =
      userStrikeIndex !== -1 ? Number(strikes[userStrikeIndex].strikes) || 0 : 0;
    currentStrikes += 1;

    if (userStrikeIndex !== -1) {
      strikes[userStrikeIndex].strikes = currentStrikes;
    } else {
      strikes.push({ identifier, strikes: currentStrikes });
    }
    writeLocalStrikes(strikes);

    if (currentStrikes >= 2) {
      // Auto ban upon 2nd strike for media suggestions
      bannedUsers.push({
        identifier,
        name: cleanName,
        codeSuffix,
        timestamp: Date.now(),
      });
      await syncGistFiles(reports, bannedUsers, strikes);
      return {
        success: false,
        banned: true,
        error:
          "⚠️ Explicit warning: Movie or TV show suggestions are strictly forbidden in report chat. You have reached 2 strikes and your reporting rights have been revoked.",
      };
    }

    // Persist 1st strike to Gist so clearing app cache cannot reset it
    await syncGistFiles(reports, bannedUsers, strikes);
    return {
      success: false,
      strikeWarning: true,
      error: `⚠️ Strike ${currentStrikes}/2: Report chat is strictly for bugs/issues, NOT movie or TV suggestions. One more strike and your reporting rights will be removed.`,
    };
  }

  // 3. Anti-spam cooldown & duplicate check against existing Gist reports
  const now = Date.now();
  const recentUserReport = reports.find(
    (r) =>
      buildIdentifier(r.name, r.codeSuffix) === identifier &&
      now - (r.timestamp || 0) < RATE_LIMIT_WINDOW_MS
  );
  if (recentUserReport) {
    const waitSec = Math.max(
      1,
      Math.ceil(
        (RATE_LIMIT_WINDOW_MS - (now - recentUserReport.timestamp)) / 1000
      )
    );
    return {
      success: false,
      error: `⏳ Please wait ${waitSec}s before sending another bug report.`,
    };
  }

  const isDuplicate = reports.some(
    (r) =>
      buildIdentifier(r.name, r.codeSuffix) === identifier &&
      r.message.trim().toLowerCase() === cleanMessage.toLowerCase() &&
      now - (r.timestamp || 0) < DUPLICATE_WINDOW_MS
  );
  if (isDuplicate) {
    return {
      success: false,
      error: "⚠️ You already submitted this exact bug report recently.",
    };
  }

  // 4. Post valid report (capped to MAX_STORED_REPORTS for 1-2GB RAM devices)
  const uniqueRand = Math.random().toString(36).substring(2, 6);
  const newReport: BugReport = {
    id: `bug_${now}_${uniqueRand}`,
    name: cleanName,
    codeSuffix,
    message: cleanMessage,
    timestamp: now,
    status: "pending",
  };

  reports.unshift(newReport);
  const cappedReports = reports.slice(0, MAX_STORED_REPORTS);

  const updated = await syncGistFiles(cappedReports, bannedUsers, strikes);
  return {
    success: updated,
    error: updated
      ? undefined
      : "⚠️ Could not save report to server. Please try again.",
  };
}

async function syncGistFiles(
  reports: BugReport[],
  bannedUsers: BannedUser[],
  strikes?: StrikeRecord[]
): Promise<boolean> {
  if (!GIST_ID || !GITHUB_TOKEN || !GIST_API_URL) return false;

  const filesPayload: Record<string, { content: string }> = {
    "bug-reports.json": { content: JSON.stringify(reports, null, 2) },
    "bug-bans.json": { content: JSON.stringify(bannedUsers, null, 2) },
  };

  if (Array.isArray(strikes)) {
    filesPayload["bug-strikes.json"] = {
      content: JSON.stringify(strikes, null, 2),
    };
  }

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
        files: filesPayload,
      }),
    });

    if (res.ok) {
      invalidateBugCache();
      return true;
    }
    return false;
  } catch (err) {
    console.error("Failed to sync Gist bug data:", err);
    return false;
  }
}

/**
 * Updates bug report status ("pending", "in_progress", "completed").
 */
export async function updateBugReportStatus(
  id: string,
  status: "pending" | "in_progress" | "completed"
): Promise<boolean> {
  const { reports, bannedUsers, strikes } = await fetchBugSystemData(true);
  const index = reports.findIndex((r) => r.id === id);
  if (index === -1) return false;

  reports[index].status = status;
  return await syncGistFiles(reports, bannedUsers, strikes);
}

/**
 * Deletes a bug report entirely from the system (for spam control).
 */
export async function deleteBugReport(id: string): Promise<boolean> {
  const { reports, bannedUsers, strikes } = await fetchBugSystemData(true);
  const filteredReports = reports.filter((r) => r.id !== id);
  return await syncGistFiles(filteredReports, bannedUsers, strikes);
}

/**
 * Bans a user directly from the admin panel using name and code suffix.
 */
export async function banUserFromReport(
  name: string,
  codeSuffix: string
): Promise<boolean> {
  const { reports, bannedUsers, strikes } = await fetchBugSystemData(true);
  const cleanName = sanitizeInput(name, 30) || "Anonymous";
  const suffix = normalizeCodeSuffix(codeSuffix);
  const identifier = buildIdentifier(cleanName, suffix);

  if (
    !bannedUsers.some((b) => b.identifier.trim().toLowerCase() === identifier)
  ) {
    bannedUsers.push({
      identifier,
      name: cleanName,
      codeSuffix: suffix,
      timestamp: Date.now(),
    });
  }
  return await syncGistFiles(reports, bannedUsers, strikes);
}

/**
 * Removes a ban for a user identifier from the admin panel and clears their strike count.
 */
export async function removeBannedUser(identifier: string): Promise<boolean> {
  const { reports, bannedUsers, strikes } = await fetchBugSystemData(true);
  const normId = identifier.trim().toLowerCase();

  const filteredBans = bannedUsers.filter(
    (b) => b.identifier.trim().toLowerCase() !== normId
  );
  const filteredStrikes = strikes.filter(
    (s) => s.identifier.trim().toLowerCase() !== normId
  );

  writeLocalStrikes(filteredStrikes);
  return await syncGistFiles(reports, filteredBans, filteredStrikes);
}
