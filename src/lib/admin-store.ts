// src/lib/admin-store.ts
// 100% GitHub-Backed Admin Store for RABBiT TV (Zero External Servers)
// Manages Remote Stream Sources, Custom Title Overrides, User Enforcement,
// Global Ad Blocklist Overrides, Branding & Feature Flags, and Audit Logs via GitHub Gist.

import type { AppTheme } from "@/lib/settings";

export const ADMIN_STORE_UPDATED_EVENT = "rabtv_admin_store_updated";

const LOCAL_MASTER_GIST_KEY = "rabtv_admin_master_gist_id_v1";
const LOCAL_ADMIN_PAT_KEY = "rabtv_admin_personal_pat_v1";
const LOCAL_MANIFEST_CACHE_KEY = "rabtv_sources_manifest_cache_v1";
const LOCAL_BRANDING_CACHE_KEY = "rabtv_branding_config_cache_v1";
const LOCAL_ADBLOCK_CACHE_KEY = "rabtv_adblock_overrides_cache_v1";
const LOCAL_ENFORCEMENT_CACHE_KEY = "rabtv_user_enforcement_cache_v1";

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_AUDIT_ENTRIES = 250;
const MAX_REVISIONS = 10;

// Safe domains that can NEVER be accidentally added to the global ad blocklist
export const PROTECTED_WHITELIST_DOMAINS = new Set<string>([
  "localhost",
  "127.0.0.1",
  "themoviedb.org",
  "api.themoviedb.org",
  "image.tmdb.org",
  "tmdb.org",
  "github.com",
  "api.github.com",
  "raw.githubusercontent.com",
  "githubusercontent.com",
  "youtube.com",
  "youtube-nocookie.com",
  "imdb.com",
]);

export const THEME_HEX_ACCENT: Record<AppTheme, string> = {
  red: "ef4444",
  midnight: "38bdf8",
  emerald: "10b981",
  amber: "f59e0b",
  cyan: "06b6d4",
  violet: "8b5cf6",
};

export interface StreamProviderConfig {
  id: string;
  name: string;
  origin: string;
  movieTemplate: string;
  tvTemplate: string;
  enabled: boolean;
  priority: number;
  tier: 1 | 2;
  notes?: string;
  isBuiltIn?: boolean;
  healthStatus?: "unknown" | "healthy" | "degraded" | "down";
  lastLatencyMs?: number | null;
  lastCheckedAt?: number | null;
}

export interface TitleSourceOverride {
  id: string; // e.g. "movie-550" or "tv-1399"
  mediaId: string;
  mediaType: "movie" | "tv";
  title: string;
  directUrl?: string; // Custom embed or direct HLS/MP4 URL
  season?: number;
  episode?: number;
  action: "override_stream" | "quarantine_hide" | "pin_hero";
  publishAt?: string; // ISO date optional scheduling
  expireAt?: string; // ISO date optional expiration
  reason?: string;
  updatedAt: number;
}

export interface ManifestRevision {
  version: number;
  savedAt: number;
  actor: string;
  summary: string;
  providers: StreamProviderConfig[];
  overrides: TitleSourceOverride[];
}

export interface SourcesManifest {
  version: number;
  updatedAt: number;
  providers: StreamProviderConfig[];
  overrides: TitleSourceOverride[];
  revisions: ManifestRevision[];
}

export type EnforcementType = "suspend" | "ban" | "shadow_ban" | "mute";
export type EnforcementReasonCode =
  | "fraud"
  | "scam"
  | "chargeback"
  | "tos_violation"
  | "attack"
  | "abuse"
  | "other";

export interface UserEnforcementRecord {
  id: string;
  target: string; // Public Handle, Owner Name, or License Key
  type: EnforcementType;
  reasonCode: EnforcementReasonCode;
  note: string;
  active: boolean;
  createdAt: number;
  expiresAt: number | null; // null = permanent
  actor: string;
}

export interface AdBlockRule {
  id: string;
  domain: string;
  reason: string;
  source: "manual" | "player_inspector";
  providerId?: string;
  active: boolean;
  addedBy: string;
  addedAt: number;
}

export interface AdInjectionTicket {
  id: string;
  mediaId: string;
  mediaType: "movie" | "tv";
  title: string;
  providerId: string;
  domain: string;
  selector: string;
  originType: string;
  status: "open" | "blocked" | "dismissed";
  notes?: string;
  createdBy: string;
  createdAt: number;
}

export interface BrandingAndFlagsConfig {
  allowTrials: boolean;
  maintenanceMode: boolean;
  motdBanner: string;
  minAppVersion: string;
  // Feature Flags & Emergency Panic Controls
  movieClubEnabled: boolean;
  watchBuddiesEnabled: boolean;
  liveTvEnabled: boolean;
  holidayOverlayEnabled: boolean;
  panicReadOnlyCommunity: boolean;
  panicStrictTier1Only: boolean;
  // OTA Appearance Overrides
  customWallpaperUrl: string;
  customSplashUrl: string;
  forceDefaultTheme: "" | AppTheme;
  updatedAt: number;
}

export interface AuditLogEntry {
  id: string;
  timestamp: number;
  actor: string;
  action: string;
  target: string;
  reason: string;
  beforeSummary?: string;
  afterSummary?: string;
  prevHash: string;
  entryHash: string;
}

export interface RemoteKeyRecord {
  key: string;
  active: boolean;
  owner?: string;
  usedBy?: string;
  createdAt?: string;
  revokedReason?: string;
}

export interface RemoteToastRecord {
  id: string;
  target: string;
  message: string;
  severity?: "info" | "warning" | "critical";
  timestamp: number;
}

export interface FullAdminSnapshot {
  keys: RemoteKeyRecord[];
  notifications: RemoteToastRecord[];
  manifest: SourcesManifest;
  branding: BrandingAndFlagsConfig;
  enforcement: UserEnforcementRecord[];
  adblockRules: AdBlockRule[];
  adTickets: AdInjectionTicket[];
  auditLog: AuditLogEntry[];
  fetchedAt: number;
}

// =============================================================================
// BUILT-IN 17 RABBIT CINEMA PROVIDERS (EXACT MATCH WITH player.tsx)
// =============================================================================
export const DEFAULT_CINEMA_PROVIDERS: StreamProviderConfig[] = [
  {
    id: "rabbit-s1",
    name: "VidLink Pro",
    origin: "https://vidlink.pro",
    movieTemplate:
      "https://vidlink.pro/movie/{id}?primaryColor={accent}&autoplay=true",
    tvTemplate:
      "https://vidlink.pro/tv/{id}/{season}/{episode}?primaryColor={accent}&autoplay=true&nextbutton=true",
    enabled: true,
    priority: 1,
    tier: 1,
    isBuiltIn: true,
    healthStatus: "healthy",
  },
  {
    id: "rabbit-s2",
    name: "BingeAPI",
    origin: "https://bingeapi.st",
    movieTemplate:
      "https://bingeapi.st/embed/movie/{id}?color={accent}&autoplay=1",
    tvTemplate:
      "https://bingeapi.st/embed/tv/{id}/{season}/{episode}?color={accent}&autoplay=1",
    enabled: true,
    priority: 2,
    tier: 1,
    isBuiltIn: true,
    healthStatus: "healthy",
  },
  {
    id: "rabbit-s3",
    name: "VidPlus",
    origin: "https://player.vidplus.to",
    movieTemplate:
      "https://player.vidplus.to/embed/movie/{id}?autoplay=true&primarycolor={accent}",
    tvTemplate:
      "https://player.vidplus.to/embed/tv/{id}/{season}/{episode}?autoplay=true&primarycolor={accent}&autonext={autonext}",
    enabled: true,
    priority: 3,
    tier: 1,
    isBuiltIn: true,
    healthStatus: "healthy",
  },
  {
    id: "rabbit-s4",
    name: "VidNest",
    origin: "https://vidnest.fun",
    movieTemplate: "https://vidnest.fun/movie/{id}",
    tvTemplate: "https://vidnest.fun/tv/{id}/{season}/{episode}",
    enabled: true,
    priority: 4,
    tier: 1,
    isBuiltIn: true,
    healthStatus: "healthy",
  },
  {
    id: "rabbit-s5",
    name: "VidKing",
    origin: "https://vidking.net",
    movieTemplate:
      "https://vidking.net/embed/movie/{id}?color={accent}&autoPlay=true",
    tvTemplate:
      "https://vidking.net/embed/tv/{id}/{season}/{episode}?color={accent}&autoPlay=true&nextEpisode=true",
    enabled: true,
    priority: 5,
    tier: 1,
    isBuiltIn: true,
    healthStatus: "healthy",
  },
  {
    id: "rabbit-s6",
    name: "VidFast",
    origin: "https://vidfast.pro",
    movieTemplate:
      "https://vidfast.pro/movie/{id}?autoPlay=true&theme={accent}",
    tvTemplate:
      "https://vidfast.pro/tv/{id}/{season}/{episode}?autoPlay=true&theme={accent}&nextButton=true",
    enabled: true,
    priority: 6,
    tier: 1,
    isBuiltIn: true,
    healthStatus: "healthy",
  },
  {
    id: "rabbit-s7",
    name: "Vidify",
    origin: "https://player.vidify.top",
    movieTemplate:
      "https://player.vidify.top/embed/movie/{id}?primarycolor={accent}&autoplay=true",
    tvTemplate:
      "https://player.vidify.top/embed/tv/{id}/{season}/{episode}?primarycolor={accent}&autoplay=true",
    enabled: true,
    priority: 7,
    tier: 2,
    isBuiltIn: true,
    healthStatus: "unknown",
  },
  {
    id: "rabbit-s8",
    name: "VidCore",
    origin: "https://www.vidcore.org",
    movieTemplate: "https://www.vidcore.org/movie/{id}",
    tvTemplate: "https://www.vidcore.org/tv/{id}/{season}/{episode}",
    enabled: true,
    priority: 8,
    tier: 2,
    isBuiltIn: true,
    healthStatus: "unknown",
  },
  {
    id: "rabbit-s9",
    name: "VidRock",
    origin: "https://vidrock.net",
    movieTemplate: "https://vidrock.net/movie/{id}",
    tvTemplate: "https://vidrock.net/tv/{id}/{season}/{episode}",
    enabled: true,
    priority: 9,
    tier: 2,
    isBuiltIn: true,
    healthStatus: "unknown",
  },
  {
    id: "rabbit-s10",
    name: "SmashyStream",
    origin: "https://player.smashy.stream",
    movieTemplate: "https://player.smashy.stream/movie/{id}",
    tvTemplate:
      "https://player.smashy.stream/tv/{id}?s={season}&e={episode}",
    enabled: true,
    priority: 10,
    tier: 2,
    isBuiltIn: true,
    healthStatus: "unknown",
  },
  {
    id: "rabbit-s11",
    name: "VidSrc.me",
    origin: "https://vidsrcme.ru",
    movieTemplate: "https://vidsrcme.ru/embed/movie/{id}",
    tvTemplate: "https://vidsrcme.ru/embed/tv/{id}/{season}/{episode}",
    enabled: true,
    priority: 11,
    tier: 2,
    isBuiltIn: true,
    healthStatus: "unknown",
  },
  {
    id: "rabbit-s12",
    name: "VidSrc.to",
    origin: "https://vidsrc.to",
    movieTemplate: "https://vidsrc.to/embed/movie/{id}",
    tvTemplate: "https://vidsrc.to/embed/tv/{id}/{season}/{episode}",
    enabled: true,
    priority: 12,
    tier: 1,
    isBuiltIn: true,
    healthStatus: "healthy",
  },
  {
    id: "rabbit-s13",
    name: "AutoEmbed",
    origin: "https://player.autoembed.cc",
    movieTemplate: "https://player.autoembed.cc/embed/movie/{id}",
    tvTemplate:
      "https://player.autoembed.cc/embed/tv/{id}/{season}/{episode}",
    enabled: true,
    priority: 13,
    tier: 2,
    isBuiltIn: true,
    healthStatus: "unknown",
  },
  {
    id: "rabbit-s14",
    name: "Embed.su",
    origin: "https://embed.su",
    movieTemplate: "https://embed.su/embed/movie/{id}",
    tvTemplate: "https://embed.su/embed/tv/{id}/{season}/{episode}",
    enabled: true,
    priority: 14,
    tier: 2,
    isBuiltIn: true,
    healthStatus: "unknown",
  },
  {
    id: "rabbit-s15",
    name: "MultiEmbed",
    origin: "https://multiembed.mov",
    movieTemplate: "https://multiembed.mov/?video_id={id}&tmdb=1",
    tvTemplate:
      "https://multiembed.mov/?video_id={id}&tmdb=1&s={season}&e={episode}",
    enabled: true,
    priority: 15,
    tier: 2,
    isBuiltIn: true,
    healthStatus: "unknown",
  },
  {
    id: "rabbit-s16",
    name: "MoviesAPI Club",
    origin: "https://moviesapi.club",
    movieTemplate: "https://moviesapi.club/movie/{id}",
    tvTemplate: "https://moviesapi.club/tv/{id}-{season}-{episode}",
    enabled: true,
    priority: 16,
    tier: 2,
    isBuiltIn: true,
    healthStatus: "unknown",
  },
  {
    id: "rabbit-s17",
    name: "2Embed",
    origin: "https://www.2embed.cc",
    movieTemplate: "https://www.2embed.cc/embed/{id}",
    tvTemplate:
      "https://www.2embed.cc/embedtv/{id}&s={season}&e={episode}",
    enabled: true,
    priority: 17,
    tier: 2,
    isBuiltIn: true,
    healthStatus: "unknown",
  },
];

export const DEFAULT_BRANDING_CONFIG: BrandingAndFlagsConfig = {
  allowTrials: true,
  maintenanceMode: false,
  motdBanner: "",
  minAppVersion: "1.2.0",
  movieClubEnabled: true,
  watchBuddiesEnabled: true,
  liveTvEnabled: true,
  holidayOverlayEnabled: true,
  panicReadOnlyCommunity: false,
  panicStrictTier1Only: false,
  customWallpaperUrl: "",
  customSplashUrl: "",
  forceDefaultTheme: "",
  updatedAt: 0,
};

export function createDefaultSourcesManifest(): SourcesManifest {
  return {
    version: 1,
    updatedAt: Date.now(),
    providers: DEFAULT_CINEMA_PROVIDERS.map((p) => ({ ...p })),
    overrides: [],
    revisions: [],
  };
}

// =============================================================================
// SECURITY, VALIDATION & SPLIT-GIST CREDENTIAL RESOLUTION
// =============================================================================
export function sanitizeAdminText(raw: string, maxLen = 200): string {
  return String(raw || "")
    .replace(/[\u0000-\u001F\u007F<>]/g, "")
    .trim()
    .slice(0, maxLen);
}

export function isSafeHttpsUrl(raw: string): boolean {
  const cleaned = String(raw || "").trim();
  if (!cleaned) return false;
  try {
    const u = new URL(cleaned);
    if (u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    // Block SSRF / private / loopback hostnames
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "0.0.0.0" ||
      host.startsWith("10.") ||
      host.startsWith("192.168.") ||
      host.startsWith("169.254.") ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
    ) {
      return false;
    }
    return host.includes(".");
  } catch {
    return false;
  }
}

export function normalizeBlockDomain(raw: string): string | null {
  const cleaned = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .split(":")[0]
    .trim();
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(cleaned)) return null;
  if (cleaned.length > 120) return null;
  return cleaned;
}

export function isDomainProtected(domain: string): boolean {
  const clean = domain.toLowerCase();
  for (const safe of PROTECTED_WHITELIST_DOMAINS) {
    if (clean === safe || clean.endsWith(`.${safe}`)) return true;
  }
  return false;
}

export function getAdminActorName(): string {
  if (typeof window === "undefined") return "Admin";
  return (
    sanitizeAdminText(localStorage.getItem("rabtv_profile_name") || "", 32) ||
    "Super Admin"
  );
}

export function getLocalVaultCredentials(): {
  customGistId: string;
  customPat: string;
} {
  if (typeof window === "undefined") {
    return { customGistId: "", customPat: "" };
  }
  try {
    return {
      customGistId: (localStorage.getItem(LOCAL_MASTER_GIST_KEY) || "").trim(),
      customPat: (localStorage.getItem(LOCAL_ADMIN_PAT_KEY) || "").trim(),
    };
  } catch {
    return { customGistId: "", customPat: "" };
  }
}

export function saveLocalVaultCredentials(
  customGistId: string,
  customPat: string
): void {
  if (typeof window === "undefined") return;
  try {
    const cleanGist = customGistId.trim();
    const cleanPat = customPat.trim();
    if (cleanGist) localStorage.setItem(LOCAL_MASTER_GIST_KEY, cleanGist);
    else localStorage.removeItem(LOCAL_MASTER_GIST_KEY);

    if (cleanPat) localStorage.setItem(LOCAL_ADMIN_PAT_KEY, cleanPat);
    else localStorage.removeItem(LOCAL_ADMIN_PAT_KEY);
  } catch {
    // ignore storage errors
  }
}

export function resolveAdminGistConfig(): {
  gistId: string;
  token: string;
  apiUrl: string;
  usingPersonalVault: boolean;
} {
  const local = getLocalVaultCredentials();
  const envGist = ((import.meta as any).env?.VITE_GIST_ID as string) || "";
  const envPat = ((import.meta as any).env?.VITE_GH_PAT as string) || "";

  const gistId = local.customGistId || envGist;
  const token = local.customPat || envPat;
  const apiUrl = gistId ? `https://api.github.com/gists/${gistId}` : "";
  const usingPersonalVault = Boolean(local.customPat || local.customGistId);

  return { gistId, token, apiUrl, usingPersonalVault };
}

async function computeSha256Hex(input: string): Promise<string> {
  try {
    if (typeof crypto !== "undefined" && crypto.subtle) {
      const buf = new TextEncoder().encode(input);
      const hashBuf = await crypto.subtle.digest("SHA-256", buf);
      return Array.from(new Uint8Array(hashBuf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
        .slice(0, 16);
    }
  } catch {
    // fallback below
  }
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

function readLocalCache<T>(key: string): { data: T; ts: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.ts === "number" && parsed.data !== undefined) {
      return parsed;
    }
  } catch {
    // ignore malformed cache
  }
  return null;
}

function writeLocalCache<T>(key: string, data: T): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
  } catch {
    // ignore quota errors
  }
}

function safeJsonParse<T>(raw: string | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

// =============================================================================
// GIST FETCH & ATOMIC-STYLE READ-BEFORE-WRITE PATCHING
// =============================================================================
async function fetchRawGistFiles(): Promise<Record<string, { content?: string }> | null> {
  const { apiUrl, token } = resolveAdminGistConfig();
  if (!apiUrl) return null;

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "RabbitTV-Admin",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${apiUrl}?t=${Date.now()}`, {
    headers,
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.files || {};
}

export async function fetchFullAdminSnapshot(): Promise<{
  ok: boolean;
  snapshot: FullAdminSnapshot;
  error?: string;
}> {
  const fallbackSnapshot: FullAdminSnapshot = {
    keys: [],
    notifications: [],
    manifest: createDefaultSourcesManifest(),
    branding: { ...DEFAULT_BRANDING_CONFIG },
    enforcement: [],
    adblockRules: [],
    adTickets: [],
    auditLog: [],
    fetchedAt: Date.now(),
  };

  try {
    const files = await fetchRawGistFiles();
    if (!files) {
      return {
        ok: false,
        snapshot: fallbackSnapshot,
        error: "Could not reach GitHub Gist. Check Gist ID / Token.",
      };
    }

    const rawKeys = safeJsonParse<any[]>(files["keys.json"]?.content, []);
    const keys: RemoteKeyRecord[] = Array.isArray(rawKeys)
      ? rawKeys.map((item) =>
          typeof item === "object" && item !== null
            ? {
                key: String(item.key ?? ""),
                active: Boolean(item.active),
                owner: item.owner,
                usedBy: item.usedBy,
                createdAt: item.createdAt,
                revokedReason: item.revokedReason,
              }
            : { key: String(item), active: true, owner: "Legacy" }
        )
      : [];

    const notifications = safeJsonParse<RemoteToastRecord[]>(
      files["notifications.json"]?.content,
      []
    );

    const parsedManifest = safeJsonParse<Partial<SourcesManifest>>(
      files["sources_manifest.json"]?.content,
      {}
    );
    const manifest: SourcesManifest = {
      version: Number(parsedManifest.version) || 1,
      updatedAt: Number(parsedManifest.updatedAt) || Date.now(),
      providers:
        Array.isArray(parsedManifest.providers) &&
        parsedManifest.providers.length > 0
          ? parsedManifest.providers
              .map((p, idx) => ({
                ...p,
                priority: Number(p.priority) || idx + 1,
                tier: p.tier === 1 ? 1 : 2,
                enabled: p.enabled !== false,
              }))
              .sort((a, b) => a.priority - b.priority)
          : DEFAULT_CINEMA_PROVIDERS.map((p) => ({ ...p })),
      overrides: Array.isArray(parsedManifest.overrides)
        ? parsedManifest.overrides
        : [],
      revisions: Array.isArray(parsedManifest.revisions)
        ? parsedManifest.revisions.slice(0, MAX_REVISIONS)
        : [],
    };

    const parsedAdminCfg = safeJsonParse<Partial<BrandingAndFlagsConfig>>(
      files["admin_config.json"]?.content,
      {}
    );
    const parsedBrandingCfg = safeJsonParse<Partial<BrandingAndFlagsConfig>>(
      files["branding_config.json"]?.content,
      {}
    );
    const branding: BrandingAndFlagsConfig = {
      ...DEFAULT_BRANDING_CONFIG,
      ...parsedAdminCfg,
      ...parsedBrandingCfg,
    };

    const enforcement = safeJsonParse<UserEnforcementRecord[]>(
      files["user_enforcement.json"]?.content,
      []
    );
    const adblockRules = safeJsonParse<AdBlockRule[]>(
      files["adblock_overrides.json"]?.content,
      []
    );
    const adTickets = safeJsonParse<AdInjectionTicket[]>(
      files["ad_tickets.json"]?.content,
      []
    );
    const auditLog = safeJsonParse<AuditLogEntry[]>(
      files["audit_log.json"]?.content,
      []
    );

    // Refresh local fast-read caches for Player & App startup
    writeLocalCache(LOCAL_MANIFEST_CACHE_KEY, manifest);
    writeLocalCache(LOCAL_BRANDING_CACHE_KEY, branding);
    writeLocalCache(LOCAL_ADBLOCK_CACHE_KEY, adblockRules);
    writeLocalCache(LOCAL_ENFORCEMENT_CACHE_KEY, enforcement);
    syncRemoteAdblockToNativeBridge(
      (Array.isArray(adblockRules) ? adblockRules : [])
        .filter((r) => r.active)
        .map((r) => r.domain)
    );

    return {
      ok: true,
      snapshot: {
        keys,
        notifications: Array.isArray(notifications) ? notifications : [],
        manifest,
        branding,
        enforcement: Array.isArray(enforcement) ? enforcement : [],
        adblockRules: Array.isArray(adblockRules) ? adblockRules : [],
        adTickets: Array.isArray(adTickets) ? adTickets : [],
        auditLog: Array.isArray(auditLog) ? auditLog : [],
        fetchedAt: Date.now(),
      },
    };
  } catch (err: any) {
    return {
      ok: false,
      snapshot: fallbackSnapshot,
      error: err?.message || "Network error reading GitHub Gist.",
    };
  }
}

export async function commitAdminGistFiles(options: {
  filesToUpdate: Record<string, unknown>;
  audit: {
    action: string;
    target: string;
    reason: string;
    beforeSummary?: string;
    afterSummary?: string;
  };
}): Promise<{ ok: boolean; error?: string }> {
  const { apiUrl, token } = resolveAdminGistConfig();
  if (!apiUrl || !token) {
    return {
      ok: false,
      error:
        "Missing GitHub write token. Add your personal PAT in Vault Security or build secrets.",
    };
  }

  try {
    // Read latest audit log first so hash-chain stays intact across devices
    const existingFiles = (await fetchRawGistFiles()) || {};
    const existingAudit = safeJsonParse<AuditLogEntry[]>(
      existingFiles["audit_log.json"]?.content,
      []
    );
    const prevHash = existingAudit[0]?.entryHash || "GENESIS";
    const actor = getAdminActorName();
    const timestamp = Date.now();
    const cleanReason =
      sanitizeAdminText(options.audit.reason, 160) || "Admin operation";
    const id = `aud_${timestamp.toString(36)}_${Math.random()
      .toString(36)
      .slice(2, 6)}`;

    const hashSeed = `${prevHash}|${timestamp}|${actor}|${options.audit.action}|${options.audit.target}|${cleanReason}`;
    const entryHash = await computeSha256Hex(hashSeed);

    const nextAuditEntry: AuditLogEntry = {
      id,
      timestamp,
      actor,
      action: sanitizeAdminText(options.audit.action, 64),
      target: sanitizeAdminText(options.audit.target, 80),
      reason: cleanReason,
      beforeSummary: options.audit.beforeSummary
        ? sanitizeAdminText(options.audit.beforeSummary, 140)
        : undefined,
      afterSummary: options.audit.afterSummary
        ? sanitizeAdminText(options.audit.afterSummary, 140)
        : undefined,
      prevHash,
      entryHash,
    };

    const nextAuditLog = [nextAuditEntry, ...existingAudit].slice(
      0,
      MAX_AUDIT_ENTRIES
    );

    const payloadFiles: Record<string, { content: string }> = {
      "audit_log.json": {
        content: JSON.stringify(nextAuditLog, null, 2),
      },
    };

    for (const [filename, value] of Object.entries(options.filesToUpdate)) {
      payloadFiles[filename] = {
        content: JSON.stringify(value, null, 2),
      };
    }

    const patchRes = await fetch(apiUrl, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "RabbitTV-Admin",
      },
      body: JSON.stringify({ files: payloadFiles }),
    });

    if (!patchRes.ok) {
      const errBody = await patchRes.json().catch(() => ({}));
      return {
        ok: false,
        error: errBody?.message || `GitHub Gist returned HTTP ${patchRes.status}`,
      };
    }

    // Update relevant local caches immediately
    if (options.filesToUpdate["sources_manifest.json"]) {
      writeLocalCache(
        LOCAL_MANIFEST_CACHE_KEY,
        options.filesToUpdate["sources_manifest.json"]
      );
    }
    if (options.filesToUpdate["branding_config.json"]) {
      writeLocalCache(
        LOCAL_BRANDING_CACHE_KEY,
        options.filesToUpdate["branding_config.json"]
      );
    }
    if (options.filesToUpdate["adblock_overrides.json"]) {
      writeLocalCache(
        LOCAL_ADBLOCK_CACHE_KEY,
        options.filesToUpdate["adblock_overrides.json"]
      );
    }
    if (options.filesToUpdate["user_enforcement.json"]) {
      writeLocalCache(
        LOCAL_ENFORCEMENT_CACHE_KEY,
        options.filesToUpdate["user_enforcement.json"]
      );
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(ADMIN_STORE_UPDATED_EVENT));
    }

    return { ok: true };
  } catch (err: any) {
    return {
      ok: false,
      error: err?.message || "Network error saving to GitHub Gist.",
    };
  }
}

// =============================================================================
// PLAYER RUNTIME HELPERS (FAST CACHED READS FOR player.tsx)
// =============================================================================
export function getCachedSourcesManifest(): SourcesManifest {
  const hit = readLocalCache<SourcesManifest>(LOCAL_MANIFEST_CACHE_KEY);
  if (hit && hit.data && Array.isArray(hit.data.providers)) {
    return hit.data;
  }
  return createDefaultSourcesManifest();
}

export function getCachedBrandingConfig(): BrandingAndFlagsConfig {
  const hit = readLocalCache<BrandingAndFlagsConfig>(LOCAL_BRANDING_CACHE_KEY);
  if (hit && hit.data) {
    return { ...DEFAULT_BRANDING_CONFIG, ...hit.data };
  }
  return { ...DEFAULT_BRANDING_CONFIG };
}

export function getCachedAdblockOverrideDomains(): string[] {
  const hit = readLocalCache<AdBlockRule[]>(LOCAL_ADBLOCK_CACHE_KEY);
  if (!hit || !Array.isArray(hit.data)) return [];
  return hit.data.filter((r) => r.active).map((r) => r.domain);
}

export async function refreshRemoteRuntimeConfig(
  force = false
): Promise<{
  manifest: SourcesManifest;
  branding: BrandingAndFlagsConfig;
}> {
  const cachedManifest = readLocalCache<SourcesManifest>(
    LOCAL_MANIFEST_CACHE_KEY
  );
  const cachedBranding = readLocalCache<BrandingAndFlagsConfig>(
    LOCAL_BRANDING_CACHE_KEY
  );

  if (
    !force &&
    cachedManifest &&
    cachedBranding &&
    Date.now() - cachedManifest.ts < CACHE_TTL_MS
  ) {
    return { manifest: cachedManifest.data, branding: cachedBranding.data };
  }

  const res = await fetchFullAdminSnapshot();
  if (res.ok) {
    return {
      manifest: res.snapshot.manifest,
      branding: res.snapshot.branding,
    };
  }

  return {
    manifest: cachedManifest?.data || createDefaultSourcesManifest(),
    branding: cachedBranding?.data || { ...DEFAULT_BRANDING_CONFIG },
  };
}

export function getActiveTitleOverride(
  manifest: SourcesManifest,
  mediaType: "movie" | "tv",
  mediaId: string,
  season?: number,
  episode?: number
): TitleSourceOverride | null {
  const now = Date.now();
  const cleanId = String(mediaId).replace(/^(movie|tv)-/i, "");

  for (const ov of manifest.overrides || []) {
    if (ov.mediaType !== mediaType) continue;
    if (String(ov.mediaId).replace(/^(movie|tv)-/i, "") !== cleanId) continue;

    if (
      mediaType === "tv" &&
      ov.season &&
      season &&
      ov.season !== season
    ) {
      continue;
    }
    if (
      mediaType === "tv" &&
      ov.episode &&
      episode &&
      ov.episode !== episode
    ) {
      continue;
    }

    if (ov.publishAt) {
      const startTs = new Date(ov.publishAt).getTime();
      if (!isNaN(startTs) && now < startTs) continue;
    }
    if (ov.expireAt) {
      const endTs = new Date(ov.expireAt).getTime();
      if (!isNaN(endTs) && now > endTs) continue;
    }

    return ov;
  }

  return null;
}

export function buildProviderUrlFromTemplate(
  provider: StreamProviderConfig,
  mediaType: "movie" | "tv",
  mediaId: string,
  season: number,
  episode: number,
  appTheme: AppTheme,
  autoPlayNext: boolean
): string {
  const accent = THEME_HEX_ACCENT[appTheme] || "8b5cf6";
  const template =
    mediaType === "tv" ? provider.tvTemplate : provider.movieTemplate;
  if (!template) return "about:blank";

  return template
    .replace(/\{id\}/g, encodeURIComponent(mediaId))
    .replace(/\{season\}/g, String(Math.max(1, Math.floor(season || 1))))
    .replace(/\{episode\}/g, String(Math.max(1, Math.floor(episode || 1))))
    .replace(/\{accent\}/g, accent)
    .replace(/\{autonext\}/g, autoPlayNext ? "true" : "false");
}

export function getActiveProvidersForPlayer(
  manifest: SourcesManifest,
  branding: BrandingAndFlagsConfig
): StreamProviderConfig[] {
  const enabled = (manifest.providers || DEFAULT_CINEMA_PROVIDERS)
    .filter((p) => p.enabled)
    .sort((a, b) => a.priority - b.priority);

  if (branding.panicStrictTier1Only) {
    const tier1 = enabled.filter((p) => p.tier === 1);
    if (tier1.length > 0) return tier1;
  }

  return enabled.length > 0
    ? enabled
    : DEFAULT_CINEMA_PROVIDERS.map((p) => ({ ...p }));
}

// =============================================================================
// LIVE SOURCE REACHABILITY PROBE & GITHUB ACTIONS REBUILD TRIGGER
// =============================================================================
export async function probeProviderHealth(
  provider: StreamProviderConfig
): Promise<{ status: "healthy" | "degraded" | "down"; latencyMs: number }> {
  const start = performance.now();
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 4500);
  try {
    await fetch(provider.origin, {
      method: "GET",
      mode: "no-cors",
      cache: "no-store",
      signal: controller.signal,
    });
    const latencyMs = Math.round(performance.now() - start);
    return {
      status: latencyMs > 2500 ? "degraded" : "healthy",
      latencyMs,
    };
  } catch {
    return {
      status: "down",
      latencyMs: Math.round(performance.now() - start),
    };
  } finally {
    window.clearTimeout(timer);
  }
}

export async function triggerGithubApkRebuild(
  repoSlug = "rogerskyle0506-ui/RABBiT-TV-2.0",
  workflowFile = "main.yml",
  ref = "main"
): Promise<{ ok: boolean; error?: string }> {
  const { token } = resolveAdminGistConfig();
  if (!token) {
    return {
      ok: false,
      error: "GitHub PAT with workflow permission is required to trigger builds.",
    };
  }
  try {
    const res = await fetch(
      `https://api.github.com/repos/${repoSlug}/actions/workflows/${workflowFile}/dispatches`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
          "User-Agent": "RabbitTV-Admin",
        },
        body: JSON.stringify({ ref }),
      }
    );
    if (res.status === 204 || res.ok) {
      return { ok: true };
    }
    const body = await res.json().catch(() => ({}));
    return {
      ok: false,
      error: body?.message || `GitHub returned HTTP ${res.status}`,
    };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Failed to dispatch workflow." };
  }
}

// =============================================================================
// STEP 2: NATIVE ANDROID AD-INSPECTOR BRIDGE & ONE-CLICK AD REMEDIATION HELPERS
// =============================================================================
export interface NativeInspectorBridge {
  isNativeBridgeAvailable?: () => boolean;
  setCaptureEnabled?: (enabled: boolean) => void;
  clearNetworkLog?: () => void;
  getNetworkLogJson?: () => string;
  syncRemoteBlockedDomains?: (domainsJsonArray: string) => number;
  addSessionBlockedDomain?: (domain: string) => boolean;
  removeSessionBlockedDomain?: (domain: string) => boolean;
  clearSessionBlockedDomains?: () => void;
  getBlocklistStatsJson?: () => string;
}

export function getNativeInspectorBridge(): NativeInspectorBridge | null {
  if (typeof window === "undefined") return null;
  const bridge = (window as any).RabbitAdInspector as
    | NativeInspectorBridge
    | undefined;
  if (!bridge) return null;
  try {
    if (
      typeof bridge.isNativeBridgeAvailable === "function" &&
      !bridge.isNativeBridgeAvailable()
    ) {
      return null;
    }
    return bridge;
  } catch {
    return null;
  }
}

export function syncRemoteAdblockToNativeBridge(domains?: string[]): number {
  const bridge = getNativeInspectorBridge();
  if (!bridge || typeof bridge.syncRemoteBlockedDomains !== "function") {
    return 0;
  }
  const activeDomains = domains ?? getCachedAdblockOverrideDomains();
  try {
    return bridge.syncRemoteBlockedDomains(JSON.stringify(activeDomains));
  } catch {
    return 0;
  }
}

export async function addGlobalAdBlockDomain(options: {
  domain: string;
  reason: string;
  source?: "manual" | "player_inspector";
  providerId?: string;
}): Promise<{ ok: boolean; domain?: string; error?: string }> {
  const domain = normalizeBlockDomain(options.domain);
  if (!domain) {
    return { ok: false, error: "Invalid domain format." };
  }
  if (isDomainProtected(domain)) {
    return {
      ok: false,
      error: `Protected core domain "${domain}" cannot be blocked.`,
    };
  }

  const snapRes = await fetchFullAdminSnapshot();
  const existing = snapRes.snapshot.adblockRules || [];
  if (existing.some((r) => r.domain === domain && r.active)) {
    syncRemoteAdblockToNativeBridge(
      existing.filter((r) => r.active).map((r) => r.domain)
    );
    return { ok: true, domain };
  }

  const nextRule: AdBlockRule = {
    id: `ad_${Date.now().toString(36)}`,
    domain,
    reason: sanitizeAdminText(options.reason, 140) || "Captured by Ad Inspector",
    source: options.source || "player_inspector",
    providerId: options.providerId,
    active: true,
    addedBy: getAdminActorName(),
    addedAt: Date.now(),
  };

  const nextRules = [
    nextRule,
    ...existing.filter((r) => r.domain !== domain),
  ];

  const commitRes = await commitAdminGistFiles({
    filesToUpdate: { "adblock_overrides.json": nextRules },
    audit: {
      action:
        options.source === "player_inspector"
          ? "INSPECTOR_GLOBAL_BLOCK"
          : "ADBLOCK_DOMAIN_ADD",
      target: domain,
      reason: nextRule.reason,
      afterSummary: options.providerId
        ? `Blocked from ${options.providerId}`
        : "Global adblock override",
    },
  });

  if (commitRes.ok) {
    syncRemoteAdblockToNativeBridge(
      nextRules.filter((r) => r.active).map((r) => r.domain)
    );
    return { ok: true, domain };
  }
  return { ok: false, error: commitRes.error };
}

export async function submitAdInjectionTicket(payload: {
  mediaId: string;
  mediaType: "movie" | "tv";
  title: string;
  providerId: string;
  domain: string;
  selector: string;
  originType: string;
  notes?: string;
}): Promise<{ ok: boolean; ticket?: AdInjectionTicket; error?: string }> {
  const snapRes = await fetchFullAdminSnapshot();
  const existing = snapRes.snapshot.adTickets || [];

  const ticket: AdInjectionTicket = {
    id: `adt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
    mediaId: sanitizeAdminText(payload.mediaId, 24),
    mediaType: payload.mediaType,
    title: sanitizeAdminText(payload.title, 80),
    providerId: sanitizeAdminText(payload.providerId, 40),
    domain: sanitizeAdminText(payload.domain, 120) || "unknown",
    selector: sanitizeAdminText(payload.selector, 220) || "unknown",
    originType: sanitizeAdminText(payload.originType, 60) || "third-party",
    status: "open",
    notes: payload.notes ? sanitizeAdminText(payload.notes, 200) : undefined,
    createdBy: getAdminActorName(),
    createdAt: Date.now(),
  };

  const nextTickets = [ticket, ...existing].slice(0, 100);
  const res = await commitAdminGistFiles({
    filesToUpdate: { "ad_tickets.json": nextTickets },
    audit: {
      action: "INSPECTOR_AD_TICKET",
      target: `${ticket.domain} (${ticket.title})`,
      reason: ticket.notes || `Reported ad element on ${ticket.providerId}`,
      afterSummary: ticket.selector,
    },
  });

  if (res.ok) return { ok: true, ticket };
  return { ok: false, error: res.error };
}

export async function resolveAdInjectionTicket(
  ticketId: string,
  status: "blocked" | "dismissed",
  blockDomainToo = false
): Promise<{ ok: boolean; error?: string }> {
  const snapRes = await fetchFullAdminSnapshot();
  const existing = snapRes.snapshot.adTickets || [];
  const target = existing.find((t) => t.id === ticketId);
  if (!target) return { ok: false, error: "Ticket not found." };

  const filesToUpdate: Record<string, unknown> = {
    "ad_tickets.json": existing.map((t) =>
      t.id === ticketId ? { ...t, status } : t
    ),
  };

  if (blockDomainToo && target.domain) {
    const cleanDomain = normalizeBlockDomain(target.domain);
    if (cleanDomain && !isDomainProtected(cleanDomain)) {
      const existingRules = snapRes.snapshot.adblockRules || [];
      const nextRules: AdBlockRule[] = [
        {
          id: `ad_${Date.now().toString(36)}`,
          domain: cleanDomain,
          reason: `From Ad Ticket on ${target.title} (${target.providerId})`,
          source: "player_inspector",
          providerId: target.providerId,
          active: true,
          addedBy: getAdminActorName(),
          addedAt: Date.now(),
        },
        ...existingRules.filter((r) => r.domain !== cleanDomain),
      ];
      filesToUpdate["adblock_overrides.json"] = nextRules;
      syncRemoteAdblockToNativeBridge(
        nextRules.filter((r) => r.active).map((r) => r.domain)
      );
    }
  }

  return commitAdminGistFiles({
    filesToUpdate,
    audit: {
      action:
        status === "blocked"
          ? "AD_TICKET_BLOCK_RESOLVE"
          : "AD_TICKET_DISMISS",
      target: `${target.domain} (${target.title})`,
      reason: blockDomainToo
        ? `Blocked domain globally & closed ticket ${ticketId}`
        : `Marked ticket ${ticketId} as ${status}`,
    },
  });
}

export async function logInspectorAuditEvent(
  action: string,
  target: string,
  reason: string
): Promise<void> {
  try {
    await commitAdminGistFiles({
      filesToUpdate: {},
      audit: { action, target, reason },
    });
  } catch {
    // non-blocking best-effort audit trail for inspector opens
  }
}

// =============================================================================
// STEP 3: ENFORCEMENT, GLOBAL QUARANTINE & FEATURE FLAG HELPERS (ZERO SERVER)
// =============================================================================
export function getCachedUserEnforcement(): UserEnforcementRecord[] {
  const hit = readLocalCache<UserEnforcementRecord[]>(
    LOCAL_ENFORCEMENT_CACHE_KEY
  );
  if (!hit || !Array.isArray(hit.data)) return [];
  const now = Date.now();
  return hit.data.filter(
    (rec) => rec && rec.active && (!rec.expiresAt || rec.expiresAt > now)
  );
}

export function getActiveEnforcementForCurrentUser(
  extraIdentifiers: string[] = []
): UserEnforcementRecord | null {
  if (typeof window === "undefined") return null;
  // Never accidentally lock out an admin device from fixing rules
  if (localStorage.getItem("rabtv_is_admin") === "true") return null;

  const activeList = getCachedUserEnforcement();
  if (activeList.length === 0) return null;

  const candidates = new Set<string>();
  const rawNames = [
    localStorage.getItem("rabtv_profile_name") || "",
    localStorage.getItem("rabtv_comm_public_handle") || "",
    localStorage.getItem("rabtv_unlock_key") || "",
    ...extraIdentifiers,
  ];
  for (const val of rawNames) {
    const clean = val.trim().toLowerCase();
    if (clean) candidates.add(clean);
  }
  if (candidates.size === 0) return null;

  // Priority order: ban > suspend > shadow_ban > mute
  const priority: Record<EnforcementType, number> = {
    ban: 4,
    suspend: 3,
    shadow_ban: 2,
    mute: 1,
  };

  let matched: UserEnforcementRecord | null = null;
  for (const rec of activeList) {
    const targetLower = String(rec.target || "").trim().toLowerCase();
    if (!targetLower) continue;
    let isMatch = false;
    for (const c of candidates) {
      if (c === targetLower || targetLower.startsWith(`${c} (`)) {
        isMatch = true;
        break;
      }
    }
    if (isMatch) {
      if (!matched || priority[rec.type] > priority[matched.type]) {
        matched = rec;
      }
    }
  }
  return matched;
}

export function isTitleGloballyQuarantined(
  manifest: SourcesManifest,
  mediaType: "movie" | "tv",
  mediaId: string
): boolean {
  const ov = getActiveTitleOverride(manifest, mediaType, mediaId);
  return ov?.action === "quarantine_hide";
}