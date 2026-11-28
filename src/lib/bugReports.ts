// src/lib/bugReports.ts
import {
  isGistConfigured,
  readGistJsonFile,
  patchGistFilesSerialized,
  runSerializedGistTransaction,
  generateSecureId,
} from "./gist-client";
import { purgeOldTmdbCaches } from "./settings";

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
const CACHE_TTL_MS = 10 * 1000;
const MAX_STORED_REPORTS = 150;
const RATE_LIMIT_WINDOW_MS = 45 * 1000;
const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;

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
  const serialized = JSON.stringify(strikes);
  try {
    localStorage.setItem(STRIKES_KEY, serialized);
  } catch {
    try {
      purgeOldTmdbCaches();
      localStorage.setItem(STRIKES_KEY, serialized);
    } catch {
      // ignore
    }
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
 * Context-aware media suggestion detector:
 * Strictly blocks movie/TV addition requests ("add movie", "upload season",
 * "can you add...") while allowing legitimate technical bug reports
 * ("Episode 3 audio out of sync", "Movie player froze").
 */
function isMediaSuggestionMessage(message: string): boolean {
  const lower = message.toLowerCase();

  // Explicit request phrases are always blocked regardless of context
  const explicitRequestPhrase =
    /\b(add|upload|request|put\s+on|please\s+add|can\s+you\s+add|could\s+you\s+add|where\s+is|need\s+the\s+new)\s+(the\s+)?(movie|movies|show|shows|season|seasons|episode|episodes|series|film|[a-z0-9]+)/i;
  if (explicitRequestPhrase.test(lower)) {
    return true;
  }

  // If the message clearly describes a technical bug symptom, allow it
  const hasTechBugSymptom =
    /\b(froze|freeze|freezing|crash|crashed|crashes|audio|sound|sync|buffer|buffering|lag|lagging|black\s*screen|won'?t\s*load|doesn'?t\s*load|error|glitch|subtitle|subtitles|caption|broken|stutter|menu|layout|remote|cursor|button|play|playback|stream|link|loading|stuck|blank|flicker)\b/i.test(
      lower
    );
  if (hasTechBugSymptom) {
    return false;
  }

  const standaloneMediaWord =
    /\b(movie|movies|show|shows|season|seasons|episode|episodes|series)\b/i;
  return standaloneMediaWord.test(lower);
}

/**
 * Fetches all reports, banned users, and strike data using the ETag-cached,
 * truncation-safe enterprise Gist client.
 */
export async function fetchBugSystemData(forceRefresh = false): Promise<{
  reports: BugReport[];
  bannedUsers: BannedUser[];
  strikes: StrikeRecord[];
}> {
  if (!isGistConfigured()) {
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
    const opts = { force: forceRefresh, maxAgeMs: CACHE_TTL_MS };
    const [rawReports, rawBans, rawStrikes] = await Promise.all([
      readGistJsonFile<BugReport[]>("bug-reports.json", [], opts),
      readGistJsonFile<BannedUser[]>("bug-bans.json", [], opts),
      readGistJsonFile<StrikeRecord[]>("bug-strikes.json", [], opts),
    ]);

    const reports = Array.isArray(rawReports) ? rawReports : [];
    const bannedUsers = Array.isArray(rawBans) ? rawBans : [];
    const remoteStrikes = Array.isArray(rawStrikes) ? rawStrikes : [];

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

async function syncGistFiles(
  reports: BugReport[],
  bannedUsers: BannedUser[],
  strikes?: StrikeRecord[]
): Promise<boolean> {
  const filesPayload: Record<string, { content: string }> = {
    "bug-reports.json": { content: JSON.stringify(reports, null, 2) },
    "bug-bans.json": { content: JSON.stringify(bannedUsers, null, 2) },
  };

  if (Array.isArray(strikes)) {
    filesPayload["bug-strikes.json"] = {
      content: JSON.stringify(strikes, null, 2),
    };
  }

  const ok = await patchGistFilesSerialized(filesPayload);
  if (ok) {
    invalidateBugCache();
  }
  return ok;
}

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
  if (!isGistConfigured()) {
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

  return runSerializedGistTransaction(async () => {
    const { reports, bannedUsers, strikes } = await fetchBugSystemData(true);

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

      await syncGistFiles(reports, bannedUsers, strikes);
      return {
        success: false,
        strikeWarning: true,
        error: `⚠️ Strike ${currentStrikes}/2: Report chat is strictly for bugs/issues, NOT movie or TV suggestions. One more strike and your reporting rights will be removed.`,
      };
    }

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

    const newReport: BugReport = {
      id: generateSecureId("bug", 4),
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
  });
}

export async function updateBugReportStatus(
  id: string,
  status: "pending" | "in_progress" | "completed"
): Promise<boolean> {
  return runSerializedGistTransaction(async () => {
    const { reports, bannedUsers, strikes } = await fetchBugSystemData(true);
    const index = reports.findIndex((r) => r.id === id);
    if (index === -1) return false;

    reports[index].status = status;
    return await syncGistFiles(reports, bannedUsers, strikes);
  });
}

export async function deleteBugReport(id: string): Promise<boolean> {
  return runSerializedGistTransaction(async () => {
    const { reports, bannedUsers, strikes } = await fetchBugSystemData(true);
    const filteredReports = reports.filter((r) => r.id !== id);
    return await syncGistFiles(filteredReports, bannedUsers, strikes);
  });
}

export async function banUserFromReport(
  name: string,
  codeSuffix: string
): Promise<boolean> {
  return runSerializedGistTransaction(async () => {
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
  });
}

export async function removeBannedUser(identifier: string): Promise<boolean> {
  return runSerializedGistTransaction(async () => {
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
  });
}