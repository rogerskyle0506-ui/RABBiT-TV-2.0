/**
 * ============================================================
 * CONTENT MODERATION, ANTI-BYPASS & ANTI-SPAM SECURITY ENGINE
 * ============================================================
 * - Zero external dependencies — runs cleanly offline & on 1-2GB TVs
 * - Normalizes leetspeak, accents, invisible Unicode, stretched letters & spaced bypasses
 * - Tier 1: Zero-tolerance hate speech, racism, sexism, slurs & violent threats (logs strikes)
 * - Tier 2: Profanity & vulgarity filter with false-positive safe-word protection
 * - Tier 3: Anti-doxxing & anti-spam shield (blocks URLs, emails, phone #s, IPs & scripts)
 * - Built-in rate limiting & 3-strike 24-hour posting cooldown
 */

const STRIKES_STORAGE_KEY = "rabtv_mod_strikes_v1";
const RATE_LIMIT_STORAGE_KEY = "rabtv_mod_ratelimit_v1";
const STRIKE_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_STRIKES_BEFORE_MUTE = 3;

export type ModerationSeverity = "clean" | "privacy" | "profanity" | "hate";

export interface ModerationResult {
  allowed: boolean;
  severity: ModerationSeverity;
  reason?: string;
  sanitizedText: string;
  mutedUntil?: number;
}

interface StrikeState {
  timestamps: number[];
  mutedUntil: number;
}

interface RateBucket {
  lastAt: number;
  dayStart: number;
  dayCount: number;
}

// Benign movie/English words that can contain substrings of blocked terms
const SAFE_ALLOWLIST_WORDS = new Set([
  "classic",
  "classics",
  "class",
  "classes",
  "classify",
  "glass",
  "glasses",
  "grass",
  "brass",
  "pass",
  "passes",
  "passed",
  "passing",
  "passion",
  "passive",
  "compass",
  "bypass",
  "surpass",
  "assassin",
  "assassins",
  "assassination",
  "assemble",
  "assembly",
  "assert",
  "assess",
  "asset",
  "assets",
  "assign",
  "assist",
  "assistant",
  "associate",
  "assume",
  "assure",
  "bass",
  "mass",
  "massive",
  "harass",
  "title",
  "titles",
  "titled",
  "subtitle",
  "subtitles",
  "entitled",
  "titan",
  "titanic",
  "cocktail",
  "peacock",
  "hitchcock",
  "woodcock",
  "dickens",
  "therapist",
  "analysis",
  "analyst",
  "canal",
  "banal",
  "final",
  "knight",
  "knights",
  "night",
  "nightmare",
  "midnight",
  "snigger",
  "bigger",
  "trigger",
  "digger",
  "vigor",
  "rigor",
  "spicier",
  "spicy",
  "spice",
  "spices",
  "despise",
  "suspicion",
  "conspiracy",
  "scunthorpe",
  "butter",
  "butterfly",
  "button",
  "buttons",
  "rebuttal",
  "documentary",
  "document",
  "circumstance",
  "accumulate",
  "cucumber",
  "scrape",
  "scraped",
  "scraper",
  "grape",
  "grapes",
  "drape",
  "drapes",
  "trapeze",
  "sextet",
  "middlesex",
  "sussex",
  "essex",
  "wessex",
  "homozygous",
  "homogeneous",
  "hellboy",
  "hello",
  "shell",
  "shelter",
  "michelle",
  "damn",
]);

// Reserved handles to prevent staff/admin impersonation
const RESERVED_HANDLES = new Set([
  "admin",
  "administrator",
  "moderator",
  "mod",
  "staff",
  "official",
  "system",
  "support",
  "rabbittv",
  "rabbitadmin",
  "owner",
  "developer",
  "dev",
  "security",
  "helpdesk",
]);

// Tier 1: Hate speech, racism, sexism, slurs, harassment, threats & sexual violence
// Stored in normalized lowercase form; matched with anti-bypass decoding
const TIER1_HATE_TERMS: string[] = [
  "nigger",
  "nigga",
  "niggaz",
  "niggas",
  "nigglet",
  "coon",
  "darkie",
  "jigaboo",
  "porchmonkey",
  "spook",
  "chink",
  "gook",
  "zipperhead",
  "wetback",
  "beaner",
  "spic",
  "spick",
  "kike",
  "heeb",
  "raghead",
  "towelhead",
  "sandnigger",
  "cameljockey",
  "paki",
  "redskin",
  "squaw",
  "cracker",
  "whitey",
  "honky",
  "faggot",
  "fagot",
  "fag",
  "dyke",
  "tranny",
  "shemale",
  "retard",
  "retarded",
  "mongoloid",
  "cripple",
  "cunt",
  "whore",
  "slut",
  "skank",
  "bimbo",
  "feminazi",
  "incel",
  "rape",
  "rapist",
  "raping",
  "molest",
  "molester",
  "pedo",
  "pedophile",
  "paedophile",
  "childporn",
  "nazi",
  "neonazi",
  "hitler",
  "swastika",
  "kkk",
  "klansman",
  "lynch",
  "genocide",
  "holocaustdenial",
  "kys",
];

const TIER1_HATE_PHRASES: RegExp[] = [
  /\bkill\s+(your|ur|them|all)\s*(self|selves)?\b/i,
  /\bgo\s+die\b/i,
  /\bwhite\s+(power|supremac\w*)\b/i,
  /\bheil\s+hitler\b/i,
  /\bgo\s+back\s+to\s+(your|ur)\s+country\b/i,
  /\bwomen\s+(belong\s+in\s+the\s+kitchen|are\s+inferior|shouldnt\s+vote)\b/i,
  /\b(hate|kill|hang|burn|shoot)\s+(all\s+)?(blacks|jews|muslims|asians|mexicans|gays|women|men|immigrants|trans)\b/i,
  /\b(doxx|swat)\s+(you|him|her|them)\b/i,
];

// Tier 2: Profanity, explicit vulgarity & sexual slang
const TIER2_PROFANITY_TERMS: string[] = [
  "fuck",
  "fucker",
  "fucking",
  "fucked",
  "motherfucker",
  "motherfucking",
  "shit",
  "shitty",
  "bullshit",
  "horseshit",
  "dipshit",
  "shithead",
  "bitch",
  "bitches",
  "bitchy",
  "sonofabitch",
  "bastard",
  "asshole",
  "arsehole",
  "dumbass",
  "jackass",
  "smartass",
  "fatass",
  "dick",
  "dickhead",
  "cock",
  "cocksucker",
  "pussy",
  "twat",
  "wanker",
  "bollocks",
  "prick",
  "tits",
  "titties",
  "boobs",
  "dildo",
  "blowjob",
  "handjob",
  "cum",
  "cumshot",
  "jizz",
  "porn",
  "porno",
  "pornography",
  "hentai",
  "milf",
  "orgasm",
  "masturbate",
  "masturbation",
  "boner",
  "erection",
  "anal",
  "anus",
  "scrotum",
  "testicles",
  "penis",
  "vagina",
  "douche",
  "douchebag",
  "scumbag",
  "shitbag",
  "piss",
  "pissed",
  "stfu",
  "gtfo",
  "lmfao",
  "wtf",
];

const TIER1_SET = new Set(TIER1_HATE_TERMS);
const TIER2_SET = new Set(TIER2_PROFANITY_TERMS);

// Longer terms safe to check against space-stripped obfuscation (e.g. "f u c k" or "n.i.g.g.e.r")
const TIER1_COMPACT_CHECK = TIER1_HATE_TERMS.filter((w) => w.length >= 4);
const TIER2_COMPACT_CHECK = TIER2_PROFANITY_TERMS.filter((w) => w.length >= 4);

/**
 * Strips HTML tags, control chars, bidirectional spoofers, and zero-width characters.
 */
export function sanitizePublicText(raw: string, maxLen = 360): string {
  return String(raw || "")
    .replace(/<[^>]*>/g, "")
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF\u00AD\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/\r?\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

/**
 * Decodes accents, Unicode homoglyphs, and leetspeak into plain ASCII letters.
 */
function normalizeForScan(input: string): string {
  let text = String(input || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  // Map common leetspeak & symbol substitutions
  text = text
    .replace(/[@4]/g, "a")
    .replace(/8/g, "b")
    .replace(/3/g, "e")
    .replace(/[1!|]/g, "i")
    .replace(/0/g, "o")
    .replace(/[$5]/g, "s")
    .replace(/[7+]/g, "t")
    .replace(/2/g, "z");

  return text;
}

/** Collapses 3+ repeated letters ("fuuuuck" -> "fuck", "shiiiit" -> "shit") */
function collapseRepeats(word: string, maxRun = 1): string {
  if (maxRun === 1) return word.replace(/(.)\1+/g, "$1");
  return word.replace(/(.)\1{2,}/g, "$1$1");
}

/** Detects URLs, emails, phone numbers, IPs, or invite links to protect user privacy */
function containsPrivacyOrLinkRisk(text: string): string | null {
  if (/(https?:\/\/|www\.|ftp:\/\/)/i.test(text)) {
    return "Links and websites are not allowed for community safety.";
  }
  if (
    /\b[a-z0-9-]+\.(com|net|org|io|gg|tv|me|xyz|ru|co|ca|uk|info|biz|app|link|site|top)\b/i.test(
      text
    )
  ) {
    return "Website domains and invite links cannot be posted here.";
  }
  if (/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(text)) {
    return "Email addresses are blocked to protect privacy.";
  }
  if (/(?:\+?\d[\s().-]*){7,15}\b/.test(text) && /\d{3}[\s().-]+\d{3,4}/.test(text)) {
    return "Phone numbers are blocked to protect privacy.";
  }
  if (/\b(?:\d{1,3}\.){3}\d{1,3}\b/.test(text)) {
    return "IP addresses cannot be posted publicly.";
  }
  if (/(^|\s)@[a-z0-9_]{3,}/i.test(text)) {
    return "External social handles (@username) are blocked for privacy.";
  }
  return null;
}

// ——— Strike & Cooldown Persistence ———
function loadStrikeState(): StrikeState {
  if (typeof window === "undefined") return { timestamps: [], mutedUntil: 0 };
  try {
    const raw = localStorage.getItem(STRIKES_STORAGE_KEY);
    if (!raw) return { timestamps: [], mutedUntil: 0 };
    const parsed = JSON.parse(raw) as StrikeState;
    const now = Date.now();
    const recent = Array.isArray(parsed.timestamps)
      ? parsed.timestamps.filter((ts) => typeof ts === "number" && now - ts < STRIKE_WINDOW_MS)
      : [];
    const mutedUntil =
      typeof parsed.mutedUntil === "number" && parsed.mutedUntil > now
        ? parsed.mutedUntil
        : 0;
    return { timestamps: recent, mutedUntil };
  } catch {
    return { timestamps: [], mutedUntil: 0 };
  }
}

function recordSevereStrike(): StrikeState {
  const state = loadStrikeState();
  const now = Date.now();
  const nextTimestamps = [...state.timestamps, now].slice(-5);
  const nextMutedUntil =
    nextTimestamps.length >= MAX_STRIKES_BEFORE_MUTE
      ? now + STRIKE_WINDOW_MS
      : state.mutedUntil;

  const updated: StrikeState = {
    timestamps: nextTimestamps,
    mutedUntil: nextMutedUntil,
  };
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STRIKES_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // ignore quota errors
    }
  }
  return updated;
}

export function getModerationMuteRemainingMs(): number {
  const state = loadStrikeState();
  return Math.max(0, state.mutedUntil - Date.now());
}

/**
 * Rate limiter protecting Gist writes & preventing spam floods.
 */
export function checkActionRateLimit(
  bucketKey: string,
  cooldownMs: number,
  maxPerDay: number
): { ok: boolean; error?: string } {
  if (typeof window === "undefined") return { ok: true };
  try {
    const raw = localStorage.getItem(RATE_LIMIT_STORAGE_KEY);
    const map: Record<string, RateBucket> = raw ? JSON.parse(raw) : {};
    const now = Date.now();
    const dayStart = new Date().setHours(0, 0, 0, 0);
    const cur = map[bucketKey];

    if (cur) {
      const waitMs = cooldownMs - (now - cur.lastAt);
      if (waitMs > 0) {
        return {
          ok: false,
          error: `Please wait ${Math.ceil(waitMs / 1000)}s before posting again.`,
        };
      }
      const sameDayCount = cur.dayStart === dayStart ? cur.dayCount : 0;
      if (sameDayCount >= maxPerDay) {
        return {
          ok: false,
          error: `Daily limit (${maxPerDay}) reached for this action. Try again tomorrow.`,
        };
      }
    }
    return { ok: true };
  } catch {
    return { ok: true };
  }
}

export function commitActionRateLimit(bucketKey: string): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(RATE_LIMIT_STORAGE_KEY);
    const map: Record<string, RateBucket> = raw ? JSON.parse(raw) : {};
    const now = Date.now();
    const dayStart = new Date().setHours(0, 0, 0, 0);
    const cur = map[bucketKey];
    const nextCount = cur && cur.dayStart === dayStart ? cur.dayCount + 1 : 1;
    map[bucketKey] = { lastAt: now, dayStart, dayCount: nextCount };
    localStorage.setItem(RATE_LIMIT_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore quota errors
  }
}

/**
 * Full multi-layer content moderation check.
 * Set `recordStrikes: true` when validating user submissions (false for display-time reads).
 */
export function moderatePublicText(
  rawText: string,
  options?: { maxLen?: number; recordStrikes?: boolean; allowEmpty?: boolean }
): ModerationResult {
  const maxLen = options?.maxLen ?? 360;
  const sanitizedText = sanitizePublicText(rawText, maxLen);

  if (options?.recordStrikes) {
    const muteRemaining = getModerationMuteRemainingMs();
    if (muteRemaining > 0) {
      const hrs = Math.max(1, Math.ceil(muteRemaining / (60 * 60 * 1000)));
      return {
        allowed: false,
        severity: "hate",
        reason: `Community posting is temporarily paused for ${hrs}h due to repeated policy violations.`,
        sanitizedText,
        mutedUntil: Date.now() + muteRemaining,
      };
    }
  }

  if (!sanitizedText) {
    return options?.allowEmpty
      ? { allowed: true, severity: "clean", sanitizedText: "" }
      : {
          allowed: false,
          severity: "privacy",
          reason: "Please enter a message before posting.",
          sanitizedText: "",
        };
  }

  // 1. Privacy, link & spam check
  const privacyError = containsPrivacyOrLinkRisk(sanitizedText);
  if (privacyError) {
    return {
      allowed: false,
      severity: "privacy",
      reason: privacyError,
      sanitizedText,
    };
  }

  const normalized = normalizeForScan(sanitizedText);

  // 2. Phrase-level Tier 1 hate/harassment patterns
  for (const rx of TIER1_HATE_PHRASES) {
    if (rx.test(normalized)) {
      const st = options?.recordStrikes ? recordSevereStrike() : loadStrikeState();
      return {
        allowed: false,
        severity: "hate",
        reason:
          "Blocked: Hate speech, racism, sexism, harassment, and threats are strictly prohibited.",
        sanitizedText,
        mutedUntil: st.mutedUntil || undefined,
      };
    }
  }

  // 3. Token-level scan (checks raw word, 2-char collapsed, and 1-char collapsed)
  const rawTokens = normalized.split(/[^a-z]+/).filter(Boolean);
  for (const tok of rawTokens) {
    if (SAFE_ALLOWLIST_WORDS.has(tok)) continue;

    const c2 = collapseRepeats(tok, 2);
    const c1 = collapseRepeats(tok, 1);

    if (TIER1_SET.has(tok) || TIER1_SET.has(c2) || TIER1_SET.has(c1)) {
      const st = options?.recordStrikes ? recordSevereStrike() : loadStrikeState();
      return {
        allowed: false,
        severity: "hate",
        reason:
          "Blocked: Offensive slurs, hate speech, racism, and sexism are not allowed in RABBiT TV.",
        sanitizedText,
        mutedUntil: st.mutedUntil || undefined,
      };
    }

    if (TIER2_SET.has(tok) || TIER2_SET.has(c2) || TIER2_SET.has(c1)) {
      return {
        allowed: false,
        severity: "profanity",
        reason:
          "Blocked: Please keep reviews and chats clean and free of profanity.",
        sanitizedText,
      };
    }
  }

  // 4. Anti-obfuscation check for intentionally spaced/punctuated slurs (e.g. "f.u.c.k" or "n i g g e r")
  const punctuatedGroups = normalized.match(/\b(?:[a-z][\s._*-]+){3,}[a-z]\b/g) || [];
  for (const grp of punctuatedGroups) {
    const squashed = grp.replace(/[^a-z]/g, "");
    const squashedC2 = collapseRepeats(squashed, 2);
    if (
      TIER1_COMPACT_CHECK.some(
        (bad) => squashed === bad || squashedC2 === bad || squashed.includes(bad)
      )
    ) {
      const st = options?.recordStrikes ? recordSevereStrike() : loadStrikeState();
      return {
        allowed: false,
        severity: "hate",
        reason:
          "Blocked: Disguised hate speech or slurs are strictly prohibited.",
        sanitizedText,
        mutedUntil: st.mutedUntil || undefined,
      };
    }
    if (
      TIER2_COMPACT_CHECK.some(
        (bad) => squashed === bad || squashedC2 === bad
      )
    ) {
      return {
        allowed: false,
        severity: "profanity",
        reason: "Blocked: Please avoid disguised profanity.",
        sanitizedText,
      };
    }
  }

  return { allowed: true, severity: "clean", sanitizedText };
}

/**
 * Validates an anonymous Public Profile Handle (never tied to user's private name).
 */
export function validatePublicHandle(rawHandle: string): {
  ok: boolean;
  cleanHandle: string;
  error?: string;
} {
  const cleanHandle = sanitizePublicText(rawHandle, 20);
  if (cleanHandle.length < 3) {
    return {
      ok: false,
      cleanHandle,
      error: "Public handle must be 3 to 20 characters.",
    };
  }
  if (!/^[a-zA-Z0-9 _-]+$/.test(cleanHandle)) {
    return {
      ok: false,
      cleanHandle,
      error: "Handle can only use letters, numbers, spaces, dashes, or underscores.",
    };
  }

  const compactLower = cleanHandle.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (RESERVED_HANDLES.has(compactLower)) {
    return {
      ok: false,
      cleanHandle,
      error: "That handle is reserved. Please pick a unique movie-buff name.",
    };
  }

  const mod = moderatePublicText(cleanHandle, {
    maxLen: 20,
    recordStrikes: true,
  });
  if (!mod.allowed) {
    return { ok: false, cleanHandle, error: mod.reason };
  }

  return { ok: true, cleanHandle };
}