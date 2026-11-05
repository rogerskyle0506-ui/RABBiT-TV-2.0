// src/lib/bugReports.ts
const GIST_ID = (import.meta as any).env?.VITE_GIST_ID as string || "";
const GITHUB_TOKEN = (import.meta as any).env?.VITE_GH_PAT as string || "";
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

/**
 * Fetches all reports and banned/strike data from Gist or localStorage tracking.
 */
export async function fetchBugSystemData(): Promise<{
  reports: BugReport[];
  bannedUsers: BannedUser[];
  strikes: StrikeRecord[];
}> {
  if (!GIST_ID || !GITHUB_TOKEN || !GIST_API_URL) {
    return { reports: [], bannedUsers: [], strikes: [] };
  }
  try {
    const res = await fetch(GIST_API_URL, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "RabbitTV-App"
      },
      cache: "no-store"
    });

    if (!res.ok) return { reports: [], bannedUsers: [], strikes: [] };
    const gistData = await res.json();

    const reportsRaw = gistData.files?.["bug-reports.json"]?.content;
    const bansRaw = gistData.files?.["bug-bans.json"]?.content;

    const reports = reportsRaw ? JSON.parse(reportsRaw) : [];
    const bannedUsers = bansRaw ? JSON.parse(bansRaw) : [];
    const strikes = JSON.parse(localStorage.getItem(STRIKES_KEY) || "[]");

    return {
      reports: Array.isArray(reports) ? reports : [],
      bannedUsers: Array.isArray(bannedUsers) ? bannedUsers : [],
      strikes: Array.isArray(strikes) ? strikes : []
    };
  } catch (error) {
    console.error("Failed to fetch bug system data:", error);
    return { reports: [], bannedUsers: [], strikes: [] };
  }
}

/**
 * Checks if a user identifier is banned.
 */
export async function isUserBanned(name: string, codeSuffix: string): Promise<boolean> {
  const identifier = `${name.trim().toLowerCase()}:${codeSuffix}`;
  const { bannedUsers } = await fetchBugSystemData();
  return bannedUsers.some(b => b.identifier === identifier);
}

/**
 * Submits a bug report with anti-spam check, strike counting for media suggestions, and ban enforcement.
 */
export async function submitBugReport(
  name: string,
  code: string,
  message: string
): Promise<{ success: boolean; error?: string; banned?: boolean; strikeWarning?: boolean }> {
  if (!GIST_ID || !GITHUB_TOKEN || !GIST_API_URL) {
    return { success: false, error: "Gist configuration missing." };
  }

  const cleanName = name.trim() || "Anonymous";
  const codeSuffix = code.slice(-4);
  const identifier = `${cleanName.toLowerCase()}:${codeSuffix}`;

  // 1. Check if user is already banned
  const { reports, bannedUsers, strikes } = await fetchBugSystemData();
  if (bannedUsers.some(b => b.identifier === identifier)) {
    return {
      success: false,
      banned: true,
      error: "The owner Rabbit is very busy and you have possibly spammed, annoyed, or offended the admin via messages who has now removed reporting rights for you. If you think this was a mistake please kindly message Rabbit directly for an answer or resolve."
    };
  }

  // 2. Check for media suggestion violation (Movie/TV titles)
  const lowerMsg = message.toLowerCase();
  const isSuggestion =
    lowerMsg.includes("movie") ||
    lowerMsg.includes("show") ||
    lowerMsg.includes("season") ||
    lowerMsg.includes("episode") ||
    lowerMsg.includes("add ") ||
    lowerMsg.includes("watch ") ||
    lowerMsg.includes("series");

  if (isSuggestion) {
    const userStrikeIndex = strikes.findIndex((s: StrikeRecord) => s.identifier === identifier);
    let currentStrikes = userStrikeIndex !== -1 ? strikes[userStrikeIndex].strikes : 0;
    currentStrikes += 1;

    if (userStrikeIndex !== -1) {
      strikes[userStrikeIndex].strikes = currentStrikes;
    } else {
      strikes.push({ identifier, strikes: currentStrikes });
    }
    localStorage.setItem(STRIKES_KEY, JSON.stringify(strikes));

    if (currentStrikes >= 2) {
      // Auto ban upon 2nd strike for media suggestions
      bannedUsers.push({ identifier, name: cleanName, codeSuffix, timestamp: Date.now() });
      await syncGistFiles(reports, bannedUsers);
      return {
        success: false,
        banned: true,
        error: "⚠️ Explicit warning: Movie or TV show suggestions are strictly forbidden in report chat. You have reached 2 strikes and your reporting rights have been revoked."
      };
    }

    return {
      success: false,
      strikeWarning: true,
      error: `⚠️ Strike ${currentStrikes}/2: Report chat is strictly for bugs/issues, NOT movie or TV suggestions. One more strike and your reporting rights will be removed.`
    };
  }

  // 3. Post valid report
  const newReport: BugReport = {
    id: `bug_${Date.now()}`,
    name: cleanName,
    codeSuffix,
    message: message.slice(0, 50),
    timestamp: Date.now(),
    status: "pending"
  };

  reports.unshift(newReport);
  const updated = await syncGistFiles(reports, bannedUsers);
  return { success: updated };
}

async function syncGistFiles(reports: BugReport[], bannedUsers: BannedUser[]): Promise<boolean> {
  try {
    const res = await fetch(GIST_API_URL, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "RabbitTV-App"
      },
      body: JSON.stringify({
        files: {
          "bug-reports.json": { content: JSON.stringify(reports, null, 2) },
          "bug-bans.json": { content: JSON.stringify(bannedUsers, null, 2) }
        }
      })
    });
    return res.ok;
  } catch (err) {
    console.error("Failed to sync Gist bug data:", err);
    return false;
  }
}

/**
 * Updates bug report status ("pending", "in_progress", "completed").
 */
export async function updateBugReportStatus(id: string, status: "pending" | "in_progress" | "completed"): Promise<boolean> {
  const { reports, bannedUsers } = await fetchBugSystemData();
  const index = reports.findIndex(r => r.id === id);
  if (index === -1) return false;

  reports[index].status = status;
  return await syncGistFiles(reports, bannedUsers);
}

/**
 * Deletes a bug report entirely from the system (for spam control).
 */
export async function deleteBugReport(id: string): Promise<boolean> {
  const { reports, bannedUsers } = await fetchBugSystemData();
  const filteredReports = reports.filter(r => r.id !== id);
  return await syncGistFiles(filteredReports, bannedUsers);
}

/**
 * Bans a user directly from the admin panel using name and code suffix.
 */
export async function banUserFromReport(name: string, codeSuffix: string): Promise<boolean> {
  const { reports, bannedUsers } = await fetchBugSystemData();
  const identifier = `${name.trim().toLowerCase()}:${codeSuffix}`;
  if (!bannedUsers.some(b => b.identifier === identifier)) {
    bannedUsers.push({ identifier, name, codeSuffix, timestamp: Date.now() });
  }
  return await syncGistFiles(reports, bannedUsers);
}

/**
 * Removes a ban for a user identifier from the admin panel.
 */
export async function removeBannedUser(identifier: string): Promise<boolean> {
  const { reports, bannedUsers } = await fetchBugSystemData();
  const filteredBans = bannedUsers.filter(b => b.identifier !== identifier);
  return await syncGistFiles(reports, filteredBans);
}
