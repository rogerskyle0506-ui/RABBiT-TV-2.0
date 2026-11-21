// src/lib/updater.ts
import { APP_VERSION } from "./version";
import {
  type AppTheme,
  getSavedTheme,
  getLargeButtons,
  getReducedMotion,
  getHardwareLimits,
  getGlowIntensity,
} from "./settings";

const GITHUB_REPO =
  ((import.meta as any).env?.VITE_GH_REPO as string) ||
  "rogerskyle0506-ui/RABBiT-TV-2.0";
const GITHUB_API_BASE = `https://api.github.com/repos/${GITHUB_REPO}`;
const DEFAULT_RELEASES_PAGE_URL = `https://github.com/${GITHUB_REPO}/releases`;
const GITHUB_TOKEN = ((import.meta as any).env?.VITE_GH_PAT as string) || "";
const GIST_ID = ((import.meta as any).env?.VITE_GIST_ID as string) || "";
const GIST_API_URL = GIST_ID ? `https://api.github.com/gists/${GIST_ID}` : "";

const FETCH_TIMEOUT_MS = 7000;
const SILENT_CHECK_COOLDOWN_MS = 30 * 60 * 1000; // 30 mins between silent checks
const LAST_CHECK_STORAGE_KEY = "rabtv_updater_last_check_v2";
const SKIPPED_VERSION_KEY = "rabtv_updater_skipped_version_v1";
const UPDATE_CHANNEL_KEY = "rabtv_update_channel";
const UPDATE_MODAL_DOM_ID = "rabtv-crystal-updater-modal";

const TRUSTED_DOWNLOAD_HOSTS = new Set([
  "github.com",
  "raw.githubusercontent.com",
  "objects.githubusercontent.com",
  "release-assets.githubusercontent.com",
  "github-releases.githubusercontent.com",
]);

export type UpdateChannel = "stable" | "nightly";

export interface FleetPolicySnapshot {
  minAppVersion: string;
  allowTrials: boolean;
  maintenanceMode: boolean;
  motdBanner: string;
}

export interface UpdateCheckResult {
  status:
    | "update_available"
    | "mandatory_update"
    | "up_to_date"
    | "skipped"
    | "cooldown"
    | "error";
  channel: UpdateChannel;
  currentVersion: string;
  latestVersion: string;
  downloadUrl: string;
  releasePageUrl?: string;
  assetName?: string;
  fileSizeBytes?: number;
  publishedAt?: string;
  releaseNotes?: string;
  isMandatory: boolean;
  minAppVersion?: string;
  errorMessage?: string;
}

interface CandidateBuild {
  version: string;
  downloadUrl: string;
  releasePageUrl: string;
  assetName: string;
  channel: UpdateChannel;
  fileSizeBytes?: number;
  publishedAt?: string;
  releaseNotes?: string;
}

/**
 * Determines the build channel strictly from the APK filename:
 * - Ends in ".apk" AND contains "nightly" -> "nightly"
 * - Ends in ".apk" AND missing "nightly"  -> "stable"
 * - Anything else                         -> null
 */
export function getApkChannelFromFilename(
  fileName: string
): UpdateChannel | null {
  const lowerName = String(fileName || "").trim().toLowerCase();
  if (!lowerName.endsWith(".apk")) return null;
  return lowerName.includes("nightly") ? "nightly" : "stable";
}

function getFileNameFromUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl.trim());
    const lastSegment = parsed.pathname.split("/").pop() || "";
    return decodeURIComponent(lastSegment);
  } catch {
    return "";
  }
}

function getSafeReleasesPageUrl(rawUrl?: string): string {
  if (rawUrl && isTrustedDownloadUrl(rawUrl)) {
    return rawUrl.trim();
  }
  return DEFAULT_RELEASES_PAGE_URL;
}

/**
 * Parses a version string into numeric segments [major, minor, patch, build]
 * for bulletproof numeric comparison.
 */
export function parseVersion(versionStr: string): number[] {
  if (!versionStr) return [0, 0, 0, 0];
  const clean = String(versionStr)
    .trim()
    .replace(/^v/i, "")
    .split("-")[0];
  return clean.split(".").map((part) => {
    const num = parseInt(part, 10);
    return isNaN(num) ? 0 : num;
  });
}

/**
 * Compares two version strings numerically segment by segment.
 * Returns 1 if v1 > v2, -1 if v1 < v2, and 0 if equal.
 */
export function compareVersions(v1: string, v2: string): number {
  const segs1 = parseVersion(v1);
  const segs2 = parseVersion(v2);
  const maxLength = Math.max(segs1.length, segs2.length);

  for (let i = 0; i < maxLength; i++) {
    const num1 = segs1[i] || 0;
    const num2 = segs2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

/**
 * Security: Strictly ensures APK download and release URLs originate from official GitHub hosts over HTTPS.
 */
export function isTrustedDownloadUrl(rawUrl: string): boolean {
  if (!rawUrl || typeof rawUrl !== "string") return false;
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    return (
      TRUSTED_DOWNLOAD_HOSTS.has(host) ||
      host.endsWith(".githubusercontent.com")
    );
  } catch {
    return false;
  }
}

export function getUpdateChannel(): UpdateChannel {
  if (typeof window === "undefined") return "nightly";
  const saved = localStorage.getItem(UPDATE_CHANNEL_KEY);
  return saved === "stable" ? "stable" : "nightly";
}

export function setUpdateChannel(channel: UpdateChannel): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(UPDATE_CHANNEL_KEY, channel);
  window.dispatchEvent(new Event("rabtv_settings_updated"));
}

export function getSkippedUpdateVersion(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(SKIPPED_VERSION_KEY) || "";
}

export function clearSkippedUpdateVersion(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SKIPPED_VERSION_KEY);
}

/**
 * Fetch wrapper with strict AbortController timeout so slow Wi-Fi never freezes 1-2GB sticks.
 */
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

/**
 * Dynamically fetches the currently installed application version.
 */
export async function getCurrentAppVersion(): Promise<string> {
  if (APP_VERSION && APP_VERSION !== "0.0.0") {
    return APP_VERSION;
  }

  try {
    if (typeof window !== "undefined") {
      const isCapacitor = !!(window as any).Capacitor;
      if (isCapacitor) {
        // @vite-ignore prevents Rolldown/Vite from attempting static module resolution during web build
        const appModule = await import(/* @vite-ignore */ "@capacitor/app");
        const info = await appModule.App.getInfo();
        if (info && info.version) {
          return info.version;
        }
      }
    }
  } catch (err) {
    console.warn(
      "Could not fetch native app version from Capacitor, using fallback:",
      err
    );
  }

  if (typeof document !== "undefined") {
    const metaVersion = document
      .querySelector('meta[name="app-version"]')
      ?.getAttribute("content");
    if (metaVersion) return metaVersion;
  }

  return APP_VERSION || "2.4.0.0";
}

/**
 * Reads `admin_config.json` from the private admin Gist to enforce `minAppVersion`
 * set inside the Admin Command Center.
 */
export async function checkFleetPolicy(): Promise<FleetPolicySnapshot | null> {
  if (!GIST_ID || !GITHUB_TOKEN || !GIST_API_URL) return null;
  try {
    const res = await fetchWithTimeout(
      `${GIST_API_URL}?t=${Date.now()}`,
      {
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "RabbitTV-App",
        },
        cache: "no-store",
      },
      5500
    );
    if (!res.ok) return null;
    const gistData = await res.json();
    const rawConfig = gistData.files?.["admin_config.json"]?.content;
    if (!rawConfig) return null;
    const parsed = JSON.parse(rawConfig);
    if (!parsed || typeof parsed !== "object") return null;

    return {
      minAppVersion:
        typeof parsed.minAppVersion === "string"
          ? parsed.minAppVersion.trim()
          : "",
      allowTrials: parsed.allowTrials !== false,
      maintenanceMode: Boolean(parsed.maintenanceMode),
      motdBanner:
        typeof parsed.motdBanner === "string" ? parsed.motdBanner.trim() : "",
    };
  } catch {
    return null;
  }
}

/**
 * Dynamically extracts the version numbers from filenames like:
 * - rabbittv-v2.4.8.8.apk
 * - rabbittv-v2.4.8.8-nightly.apk
 */
function extractVersionFromAssetOrTag(
  assetName: string,
  tagName?: string
): string {
  const assetStr = String(assetName || "");
  const assetMatch =
    assetStr.match(/v(\d+(?:\.\d+)*)/i) ||
    assetStr.match(/(\d+\.\d+(?:\.\d+)*)/);
  if (assetMatch?.[1]) return assetMatch[1];

  const tagStr = String(tagName || "");
  const tagMatch =
    tagStr.match(/v(\d+(?:\.\d+)*)/i) || tagStr.match(/(\d+\.\d+(?:\.\d+)*)/);
  if (tagMatch?.[1]) return tagMatch[1];

  return tagStr.replace(/^v/i, "").split("-")[0].trim();
}

function pickHigherCandidate(
  currentBest: CandidateBuild | null,
  candidate: CandidateBuild
): CandidateBuild | null {
  if (!candidate.version || !isTrustedDownloadUrl(candidate.downloadUrl)) {
    return currentBest;
  }
  if (!currentBest) return candidate;
  return compareVersions(candidate.version, currentBest.version) > 0
    ? candidate
    : currentBest;
}

function formatBytesToMb(bytes?: number): string {
  if (!bytes || bytes <= 0) return "";
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function cleanReleaseNotes(raw?: string): string {
  if (!raw) return "";
  return String(raw)
    .replace(/[#*_`>]/g, "")
    .replace(/\r?\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 420);
}

/**
 * Resolves the highest available APK build for the selected track by scanning
 * GitHub Releases (and nightly manifest when on nightly), strictly separating
 * stable vs. nightly based on whether "nightly" is present in the APK filename.
 */
async function resolveLatestBuild(
  channel: UpdateChannel
): Promise<CandidateBuild | null> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "RabbitTV-App",
  };
  if (GITHUB_TOKEN) {
    headers["Authorization"] = `Bearer ${GITHUB_TOKEN}`;
  }

  let best: CandidateBuild | null = null;

  const releasesPromise = fetchWithTimeout(
    `${GITHUB_API_BASE}/releases?per_page=30`,
    { headers, cache: "no-store" }
  )
    .then(async (res) => (res.ok ? res.json() : []))
    .catch(() => []);

  const manifestPromise =
    channel === "nightly"
      ? fetchWithTimeout(
          `https://raw.githubusercontent.com/${GITHUB_REPO}/main/updates/nightly_manifest.json?t=${Date.now()}`,
          { cache: "no-store" }
        )
          .then(async (res) => (res.ok ? res.json() : null))
          .catch(() => null)
      : Promise.resolve(null);

  const [releasesList, manifestData] = await Promise.all([
    releasesPromise,
    manifestPromise,
  ]);

  // 1. Evaluate recent GitHub Releases strictly matching APK filename channel
  if (Array.isArray(releasesList)) {
    for (const release of releasesList) {
      if (release?.draft) continue;

      const releasePageUrl = getSafeReleasesPageUrl(release?.html_url);
      const assets = Array.isArray(release?.assets) ? release.assets : [];
      for (const asset of assets) {
        const assetName = String(asset?.name || "").trim();
        const assetChannel = getApkChannelFromFilename(assetName);

        // Ignore non-APK files and any APK that does not match the selected channel
        if (assetChannel !== channel) continue;

        const version = extractVersionFromAssetOrTag(
          assetName,
          release.tag_name
        );
        if (!version) continue;

        const candidate: CandidateBuild = {
          version,
          downloadUrl: String(asset.browser_download_url || ""),
          releasePageUrl,
          assetName,
          channel: assetChannel,
          fileSizeBytes: typeof asset.size === "number" ? asset.size : undefined,
          publishedAt: release.published_at || release.created_at,
          releaseNotes: cleanReleaseNotes(release.body),
        };

        best = pickHigherCandidate(best, candidate);
      }
    }
  }

  // 2. When on nightly, compare against updates/nightly_manifest.json on main
  if (channel === "nightly" && manifestData && typeof manifestData === "object") {
    const manifestUrl = String(
      manifestData.apkUrl || manifestData.download_url || ""
    ).trim();
    const manifestFileName = getFileNameFromUrl(manifestUrl);
    const manifestChannel = getApkChannelFromFilename(manifestFileName);

    const manifestVersion =
      extractVersionFromAssetOrTag(
        manifestFileName,
        String(manifestData.versionName || manifestData.version || "")
      ) || "";

    const manifestReleasePage = getSafeReleasesPageUrl(
      manifestData.releasePageUrl ||
        manifestData.releaseUrl ||
        manifestData.html_url
    );

    if (
      manifestChannel === "nightly" &&
      manifestVersion &&
      isTrustedDownloadUrl(manifestUrl)
    ) {
      best = pickHigherCandidate(best, {
        version: manifestVersion,
        downloadUrl: manifestUrl,
        releasePageUrl: manifestReleasePage,
        assetName: manifestFileName,
        channel: "nightly",
        publishedAt: manifestData.publishedAt || manifestData.date,
        releaseNotes: cleanReleaseNotes(
          manifestData.notes || manifestData.changelog
        ),
      });
    }
  }

  return best;
}

// ──────────────────────────────────────────────────────────────
// Direct Download + Chrome Release Assets Fallback Engine
// ──────────────────────────────────────────────────────────────

/**
 * Launches Chrome (or the system browser if Chrome is not installed on Android TV)
 * directly to the GitHub release assets page.
 */
export async function openReleaseAssetsInChrome(
  releasePageUrl?: string
): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const targetUrl = getSafeReleasesPageUrl(releasePageUrl);
  const isCapacitor = !!(window as any).Capacitor;
  const isAndroid = /android/i.test(navigator.userAgent || "");

  // Build an Android Chrome intent URL that falls back to the default browser if Chrome isn't installed
  let chromeIntentUrl = targetUrl;
  try {
    const parsed = new URL(targetUrl);
    chromeIntentUrl = `intent://${parsed.host}${parsed.pathname}${parsed.search}${parsed.hash}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(targetUrl)};end`;
  } catch {
    chromeIntentUrl = targetUrl;
  }

  if (isCapacitor) {
    // 1. Try launching Chrome specifically via Capacitor AppLauncher (if installed)
    if (isAndroid) {
      try {
        const launcherModule = await import(
          /* @vite-ignore */ "@capacitor/app-launcher"
        );
        if (launcherModule?.AppLauncher?.openUrl) {
          const chromeCheck = launcherModule.AppLauncher.canOpenUrl
            ? await launcherModule.AppLauncher.canOpenUrl({
                url: "com.android.chrome",
              }).catch(() => ({ value: false }))
            : { value: true };

          await launcherModule.AppLauncher.openUrl({
            url: chromeCheck?.value ? chromeIntentUrl : targetUrl,
          });
          return true;
        }
      } catch {
        // Plugin not installed; move to Capacitor Browser
      }
    }

    // 2. Capacitor Browser (opens Chrome Custom Tabs / Chrome on Android)
    try {
      const browserModule = await import(
        /* @vite-ignore */ "@capacitor/browser"
      );
      if (browserModule?.Browser?.open) {
        await browserModule.Browser.open({ url: targetUrl });
        return true;
      }
    } catch (browserErr) {
      console.warn(
        "Capacitor Browser unavailable, falling back to window.open:",
        browserErr
      );
    }
  }

  // 3. Standard browser / final fallback
  try {
    const opened = window.open(targetUrl, "_blank", "noopener,noreferrer");
    if (opened) return true;
  } catch {
    // Ignore and try direct navigation below
  }

  try {
    window.location.href = targetUrl;
    return true;
  } catch {
    return false;
  }
}

/**
 * Attempts a direct native APK download & install on Android/Capacitor.
 * Returns true if direct download + install handoff succeeded, false if unavailable or failed.
 */
async function tryNativeDirectApkDownload(
  url: string,
  fileName: string,
  onStatus?: (message: string) => void
): Promise<boolean> {
  if (typeof window === "undefined") return false;

  // 1. Check for a custom Android WebView / Capacitor native updater bridge
  const customBridge =
    (window as any).RabbitTvUpdater ||
    (window as any).AndroidUpdater ||
    (window as any).Capacitor?.Plugins?.RabbitUpdater ||
    (window as any).Capacitor?.Plugins?.ApkUpdater;

  if (customBridge && typeof customBridge.downloadAndInstallApk === "function") {
    try {
      onStatus?.("Downloading update directly...");
      await customBridge.downloadAndInstallApk({ url, fileName });
      return true;
    } catch (bridgeErr) {
      console.warn("Custom native updater bridge failed:", bridgeErr);
    }
  }

  // 2. Use Capacitor Filesystem.downloadFile + FileOpener (bypasses WebView CORS & opens APK installer)
  try {
    const filesystemModule = await import(
      /* @vite-ignore */ "@capacitor/filesystem"
    );
    const Filesystem = filesystemModule?.Filesystem;
    const Directory = filesystemModule?.Directory;

    if (!Filesystem || typeof Filesystem.downloadFile !== "function") {
      return false;
    }

    // Make sure a native FileOpener is present before downloading so the APK can actually be installed
    let fileOpener: any = null;
    try {
      const openerMod = await import(
        /* @vite-ignore */ "@capacitor-community/file-opener"
      );
      fileOpener = openerMod?.FileOpener || null;
    } catch {
      try {
        const capawesomeMod = await import(
          /* @vite-ignore */ "@capawesome-team/capacitor-file-opener"
        );
        fileOpener = capawesomeMod?.FileOpener || null;
      } catch {
        fileOpener = null;
      }
    }

    if (!fileOpener || typeof fileOpener.open !== "function") {
      return false;
    }

    onStatus?.("Downloading APK directly...");
    const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const downloadResult = await Filesystem.downloadFile({
      url,
      path: safeFileName,
      directory: Directory?.Cache ?? "CACHE",
    });

    const savedPath = downloadResult?.path;
    if (!savedPath) {
      return false;
    }

    onStatus?.("Opening Android installer...");
    await fileOpener.open({
      filePath: savedPath,
      contentType: "application/vnd.android.package-archive",
      openWithDefault: true,
    });

    return true;
  } catch (nativeErr) {
    console.warn(
      "Direct native APK download unavailable or failed, will fall back to Chrome assets page:",
      nativeErr
    );
    return false;
  }
}

/**
 * Attempts a direct APK download in a standard web browser.
 */
async function tryWebDirectApkDownload(
  url: string,
  fileName: string,
  onStatus?: (message: string) => void
): Promise<boolean> {
  if (typeof document === "undefined") return false;

  onStatus?.("Starting direct download...");

  // Direct anchor download works in desktop & mobile Chrome without CORS issues
  try {
    const a = document.createElement("a");
    a.href = url;
    a.setAttribute("download", fileName);
    a.setAttribute("rel", "noopener noreferrer");
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return true;
  } catch (err) {
    console.warn("Direct browser anchor download failed:", err);
    return false;
  }
}

/**
 * Primary download handler:
 * 1. Tries to download the APK directly (native on Capacitor, direct file download on web).
 * 2. If direct download is not possible or fails, launches Chrome straight to the release assets page.
 */
export async function downloadAndInstallApk(
  url: string,
  fileName: string,
  releasePageUrl?: string,
  onStatus?: (message: string) => void
): Promise<boolean> {
  try {
    if (typeof window === "undefined") return false;

    const safeReleasePage = getSafeReleasesPageUrl(releasePageUrl);

    if (!isTrustedDownloadUrl(url)) {
      console.warn("Blocked untrusted APK download URL:", url);
      onStatus?.("Opening GitHub Releases in Chrome...");
      return await openReleaseAssetsInChrome(safeReleasePage);
    }

    const isCapacitor = !!(window as any).Capacitor;

    if (isCapacitor) {
      // Step 1: Attempt direct native in-app download + Android package installer
      const nativeSuccess = await tryNativeDirectApkDownload(
        url,
        fileName,
        onStatus
      );
      if (nativeSuccess) {
        return true;
      }

      // Step 2: Direct in-app download not possible -> launch Chrome directly to the assets page
      onStatus?.("Opening Releases page in Chrome...");
      return await openReleaseAssetsInChrome(safeReleasePage);
    }

    // Web browser: try direct APK download first, then fall back to the release assets page
    const webSuccess = await tryWebDirectApkDownload(url, fileName, onStatus);
    if (webSuccess) {
      return true;
    }

    onStatus?.("Opening Releases page in Chrome...");
    return await openReleaseAssetsInChrome(safeReleasePage);
  } catch (err) {
    console.error("Failed to download APK directly, opening Releases page:", err);
    onStatus?.("Opening Releases page in Chrome...");
    return await openReleaseAssetsInChrome(releasePageUrl);
  }
}

// ──────────────────────────────────────────────────────────────
// Crystal Neon Glass Modal Renderer (TV Remote & XSS Safe DOM)
// ──────────────────────────────────────────────────────────────

function getThemeColors(theme: AppTheme) {
  switch (theme) {
    case "red":
      return {
        border: "rgba(239, 68, 68, 0.55)",
        glow: "rgba(239, 68, 68, 0.30)",
        accent: "#f87171",
        gradient: "linear-gradient(90deg, #dc2626, #e11d48, #ea580c)",
      };
    case "midnight":
      return {
        border: "rgba(56, 189, 248, 0.55)",
        glow: "rgba(56, 189, 248, 0.30)",
        accent: "#7dd3fc",
        gradient: "linear-gradient(90deg, #2563eb, #0284c7, #06b6d4)",
      };
    case "emerald":
      return {
        border: "rgba(16, 185, 129, 0.55)",
        glow: "rgba(16, 185, 129, 0.30)",
        accent: "#6ee7b7",
        gradient: "linear-gradient(90deg, #059669, #0d9488, #10b981)",
      };
    case "amber":
      return {
        border: "rgba(245, 158, 11, 0.55)",
        glow: "rgba(245, 158, 11, 0.30)",
        accent: "#fcd34d",
        gradient: "linear-gradient(90deg, #d97706, #f59e0b, #ea580c)",
      };
    case "cyan":
      return {
        border: "rgba(34, 211, 238, 0.55)",
        glow: "rgba(34, 211, 238, 0.30)",
        accent: "#67e8f9",
        gradient: "linear-gradient(90deg, #0891b2, #06b6d4, #2563eb)",
      };
    case "violet":
    default:
      return {
        border: "rgba(168, 85, 247, 0.55)",
        glow: "rgba(168, 85, 247, 0.30)",
        accent: "#c4b5fd",
        gradient: "linear-gradient(90deg, #7c3aed, #9333ea, #4f46e5)",
      };
  }
}

function dismissExistingUpdaterModal() {
  if (typeof document === "undefined") return;
  const existing = document.getElementById(UPDATE_MODAL_DOM_ID);
  if (existing) existing.remove();
}

function showCrystalUpdateModal(result: UpdateCheckResult): void {
  if (typeof document === "undefined" || typeof window === "undefined") return;
  dismissExistingUpdaterModal();

  const theme = getSavedTheme();
  const colors = getThemeColors(theme);
  const largeButtons = getLargeButtons();
  const reducedMotion = getReducedMotion();
  const isLowRam = getHardwareLimits().effectiveMode === "low";
  const glowOff = getGlowIntensity() === "off";

  const isUpdate =
    result.status === "update_available" ||
    result.status === "mandatory_update";
  const isError = result.status === "error";
  const releaseAssetsPage = getSafeReleasesPageUrl(result.releasePageUrl);

  const overlay = document.createElement("div");
  overlay.id = UPDATE_MODAL_DOM_ID;
  overlay.className = "rabtv-vidsrc-protected";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  Object.assign(overlay.style, {
    position: "fixed",
    inset: "0",
    zIndex: "99999",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "16px",
    backgroundColor: "rgba(2, 6, 18, 0.84)",
    backdropFilter: isLowRam ? "none" : "blur(14px)",
    WebkitBackdropFilter: isLowRam ? "none" : "blur(14px)",
    fontFamily:
      'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  });

  const card = document.createElement("div");
  Object.assign(card.style, {
    position: "relative",
    width: "100%",
    maxWidth: "460px",
    maxHeight: "90dvh",
    overflowY: "auto",
    borderRadius: "26px",
    border: `2px solid ${result.isMandatory ? "rgba(239,68,68,0.75)" : colors.border}`,
    background:
      "linear-gradient(160deg, rgba(15,23,42,0.96) 0%, rgba(5,11,22,0.98) 100%)",
    color: "#ffffff",
    padding: largeButtons ? "24px" : "20px",
    boxShadow: glowOff
      ? "0 20px 55px rgba(0,0,0,0.95)"
      : `0 25px 70px rgba(0,0,0,0.95), 0 0 36px ${
          result.isMandatory ? "rgba(239,68,68,0.4)" : colors.glow
        }`,
    boxSizing: "border-box",
    transition: reducedMotion ? "none" : "transform 0.2s ease",
  });

  // Top neon laser strip
  const topLaser = document.createElement("div");
  Object.assign(topLaser.style, {
    position: "absolute",
    top: "0",
    left: "28px",
    right: "28px",
    height: "2px",
    background: result.isMandatory
      ? "linear-gradient(90deg, #ef4444, #f59e0b, #ef4444)"
      : colors.gradient,
  });
  card.appendChild(topLaser);

  // Header
  const header = document.createElement("div");
  Object.assign(header.style, {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    marginBottom: "14px",
  });

  const titleWrap = document.createElement("div");
  const titleEl = document.createElement("h3");
  titleEl.textContent = result.isMandatory
    ? "🚨 Required Security Update"
    : isUpdate
      ? `🚀 New ${result.channel.toUpperCase()} Update`
      : isError
        ? "⚠️ Update Check Failed"
        : "✅ RABBiT TV is Up to Date";
  Object.assign(titleEl.style, {
    margin: "0",
    fontSize: largeButtons ? "20px" : "17px",
    fontWeight: "900",
    color: result.isMandatory ? "#fca5a5" : "#ffffff",
  });

  const subEl = document.createElement("p");
  subEl.textContent = `Track: ${result.channel.toUpperCase()} • Installed v${result.currentVersion}`;
  Object.assign(subEl.style, {
    margin: "4px 0 0 0",
    fontSize: "12px",
    fontWeight: "700",
    color: "#94a3b8",
  });

  titleWrap.appendChild(titleEl);
  titleWrap.appendChild(subEl);
  header.appendChild(titleWrap);

  const cleanupModal = () => {
    window.removeEventListener("keydown", handleKeyDown);
    overlay.remove();
  };

  if (!result.isMandatory) {
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.textContent = "✕";
    closeBtn.setAttribute("aria-label", "Close update dialog");
    Object.assign(closeBtn.style, {
      width: largeButtons ? "40px" : "32px",
      height: largeButtons ? "40px" : "32px",
      borderRadius: "12px",
      border: "1px solid rgba(255,255,255,0.18)",
      background: "rgba(255,255,255,0.08)",
      color: "#e2e8f0",
      fontWeight: "800",
      cursor: "pointer",
      flexShrink: "0",
    });
    closeBtn.onclick = cleanupModal;
    header.appendChild(closeBtn);
  }

  card.appendChild(header);

  // Version & Metadata Card
  const metaBox = document.createElement("div");
  Object.assign(metaBox.style, {
    borderRadius: "16px",
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(0,0,0,0.55)",
    padding: "12px 14px",
    marginBottom: "14px",
    fontSize: largeButtons ? "14px" : "12px",
    lineHeight: "1.55",
  });

  if (isError) {
    const errP = document.createElement("p");
    errP.textContent =
      result.errorMessage ||
      "Could not reach GitHub releases. Check your Wi-Fi connection and try again.";
    errP.style.margin = "0";
    errP.style.color = "#fca5a5";
    errP.style.fontWeight = "700";
    metaBox.appendChild(errP);
  } else {
    const verRow = document.createElement("div");
    Object.assign(verRow.style, {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      flexWrap: "wrap",
      gap: "8px",
      fontWeight: "800",
    });

    const vText = document.createElement("span");
    vText.textContent = isUpdate
      ? `v${result.currentVersion}  →  v${result.latestVersion}`
      : `Latest Build: v${result.latestVersion}`;
    vText.style.color = isUpdate ? "#34d399" : colors.accent;
    verRow.appendChild(vText);

    const sizeText = formatBytesToMb(result.fileSizeBytes);
    if (sizeText) {
      const sizePill = document.createElement("span");
      sizePill.textContent = `📦 ${sizeText}`;
      Object.assign(sizePill.style, {
        fontSize: "11px",
        padding: "2px 8px",
        borderRadius: "999px",
        background: "rgba(255,255,255,0.08)",
        border: "1px solid rgba(255,255,255,0.12)",
        color: "#cbd5e1",
      });
      verRow.appendChild(sizePill);
    }

    metaBox.appendChild(verRow);

    if (result.isMandatory && result.minAppVersion) {
      const mandNote = document.createElement("p");
      mandNote.textContent = `Minimum required version is v${result.minAppVersion}. Please install this update to keep streaming smoothly.`;
      Object.assign(mandNote.style, {
        margin: "8px 0 0 0",
        color: "#fcd34d",
        fontWeight: "700",
      });
      metaBox.appendChild(mandNote);
    }

    if (result.releaseNotes) {
      const notesLabel = document.createElement("div");
      notesLabel.textContent = "What's New:";
      Object.assign(notesLabel.style, {
        marginTop: "10px",
        fontSize: "11px",
        fontWeight: "800",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        color: "#94a3b8",
      });
      const notesBody = document.createElement("p");
      notesBody.textContent = result.releaseNotes;
      Object.assign(notesBody.style, {
        margin: "4px 0 0 0",
        whiteSpace: "pre-line",
        color: "#e2e8f0",
        maxHeight: "120px",
        overflowY: "auto",
      });
      metaBox.appendChild(notesLabel);
      metaBox.appendChild(notesBody);
    }

    if (result.downloadUrl) {
      const urlLine = document.createElement("div");
      urlLine.textContent = result.downloadUrl;
      Object.assign(urlLine.style, {
        marginTop: "10px",
        padding: "8px 10px",
        borderRadius: "10px",
        background: "rgba(15,23,42,0.9)",
        border: "1px solid rgba(255,255,255,0.1)",
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#94a3b8",
        wordBreak: "break-all",
      });
      metaBox.appendChild(urlLine);
    }
  }

  card.appendChild(metaBox);

  // Action Buttons
  const actionsWrap = document.createElement("div");
  Object.assign(actionsWrap.style, {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  });

  const btnPadding = largeButtons ? "14px 16px" : "11px 14px";
  const btnFontSize = largeButtons ? "14px" : "12px";

  let primaryBtn: HTMLButtonElement | null = null;

  if (isUpdate && result.downloadUrl) {
    const dlBtn = document.createElement("button");
    dlBtn.type = "button";
    const defaultLabel = `⬇ Download & Install v${result.latestVersion}`;
    dlBtn.textContent = defaultLabel;
    Object.assign(dlBtn.style, {
      width: "100%",
      padding: btnPadding,
      borderRadius: "14px",
      border: "none",
      background: result.isMandatory
        ? "linear-gradient(90deg, #dc2626, #ea580c)"
        : colors.gradient,
      color: "#ffffff",
      fontSize: btnFontSize,
      fontWeight: "900",
      cursor: "pointer",
      boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
    });

    const fallbackFileName =
      result.channel === "nightly"
        ? `rabbittv-v${result.latestVersion}-nightly.apk`
        : `rabbittv-v${result.latestVersion}.apk`;

    dlBtn.onclick = async () => {
      if (dlBtn.disabled) return;
      dlBtn.disabled = true;
      dlBtn.style.opacity = "0.75";
      dlBtn.textContent = `⏳ Downloading v${result.latestVersion}...`;

      await downloadAndInstallApk(
        result.downloadUrl,
        result.assetName || fallbackFileName,
        releaseAssetsPage,
        (statusMsg) => {
          dlBtn.textContent = `⏳ ${statusMsg}`;
        }
      );

      if (!result.isMandatory) {
        cleanupModal();
      } else {
        dlBtn.disabled = false;
        dlBtn.style.opacity = "1";
        dlBtn.textContent = defaultLabel;
      }
    };
    actionsWrap.appendChild(dlBtn);
    primaryBtn = dlBtn;
  }

  // Secondary Row: Open Assets Page in Chrome + Copy Link / Skip
  const secondaryRow = document.createElement("div");
  Object.assign(secondaryRow.style, {
    display: "grid",
    gridTemplateColumns:
      isUpdate && !result.isMandatory ? "1fr 1fr" : "1fr",
    gap: "8px",
  });

  if (isUpdate || isError) {
    const assetsBtn = document.createElement("button");
    assetsBtn.type = "button";
    assetsBtn.textContent = "🌐 Open Assets Page";
    Object.assign(assetsBtn.style, {
      padding: btnPadding,
      borderRadius: "14px",
      border: "1px solid rgba(255,255,255,0.16)",
      background: "rgba(255,255,255,0.08)",
      color: "#f1f5f9",
      fontSize: btnFontSize,
      fontWeight: "800",
      cursor: "pointer",
    });
    assetsBtn.onclick = () => {
      void openReleaseAssetsInChrome(releaseAssetsPage);
    };
    secondaryRow.appendChild(assetsBtn);
    if (!primaryBtn) primaryBtn = assetsBtn;
  } else if (result.downloadUrl) {
    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.textContent = "📋 Copy APK Link";
    Object.assign(copyBtn.style, {
      padding: btnPadding,
      borderRadius: "14px",
      border: "1px solid rgba(255,255,255,0.16)",
      background: "rgba(255,255,255,0.08)",
      color: "#f1f5f9",
      fontSize: btnFontSize,
      fontWeight: "800",
      cursor: "pointer",
    });
    copyBtn.onclick = async () => {
      try {
        await navigator.clipboard.writeText(result.downloadUrl);
        copyBtn.textContent = "✓ Link Copied!";
        copyBtn.style.color = "#34d399";
      } catch {
        copyBtn.textContent = "Select URL Above";
      }
    };
    secondaryRow.appendChild(copyBtn);
    if (!primaryBtn) primaryBtn = copyBtn;
  }

  if (isUpdate && !result.isMandatory) {
    const skipBtn = document.createElement("button");
    skipBtn.type = "button";
    skipBtn.textContent = "Skip This Version";
    Object.assign(skipBtn.style, {
      padding: btnPadding,
      borderRadius: "14px",
      border: "1px solid rgba(255,255,255,0.14)",
      background: "rgba(0,0,0,0.55)",
      color: "#cbd5e1",
      fontSize: btnFontSize,
      fontWeight: "700",
      cursor: "pointer",
    });
    skipBtn.onclick = () => {
      if (typeof window !== "undefined") {
        localStorage.setItem(SKIPPED_VERSION_KEY, result.latestVersion);
      }
      cleanupModal();
    };
    secondaryRow.appendChild(skipBtn);
  }

  if (secondaryRow.childElementCount > 0) {
    actionsWrap.appendChild(secondaryRow);
  }

  if (isUpdate && result.downloadUrl) {
    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.textContent = "📋 Copy Direct APK Link";
    Object.assign(copyBtn.style, {
      width: "100%",
      padding: btnPadding,
      borderRadius: "14px",
      border: "1px solid rgba(255,255,255,0.12)",
      background: "rgba(255,255,255,0.04)",
      color: "#cbd5e1",
      fontSize: btnFontSize,
      fontWeight: "700",
      cursor: "pointer",
    });
    copyBtn.onclick = async () => {
      try {
        await navigator.clipboard.writeText(result.downloadUrl);
        copyBtn.textContent = "✓ Link Copied!";
        copyBtn.style.color = "#34d399";
      } catch {
        copyBtn.textContent = "Select URL Above";
      }
    };
    actionsWrap.appendChild(copyBtn);
  }

  if (!result.isMandatory && !isUpdate) {
    const okBtn = document.createElement("button");
    okBtn.type = "button";
    okBtn.textContent = "✓ Got It";
    Object.assign(okBtn.style, {
      width: "100%",
      padding: btnPadding,
      borderRadius: "14px",
      border: "none",
      background: colors.gradient,
      color: "#ffffff",
      fontSize: btnFontSize,
      fontWeight: "900",
      cursor: "pointer",
    });
    okBtn.onclick = cleanupModal;
    actionsWrap.appendChild(okBtn);
    primaryBtn = okBtn;
  }

  card.appendChild(actionsWrap);
  overlay.appendChild(card);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape" && !result.isMandatory) {
      cleanupModal();
    }
  };

  if (!result.isMandatory) {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) cleanupModal();
    });
  }

  window.addEventListener("keydown", handleKeyDown);
  document.body.appendChild(overlay);
  primaryBtn?.focus();
}

/**
 * Main update checker routine for manual or silent boot triggers.
 */
export async function checkForAppUpdates(
  silent = false
): Promise<UpdateCheckResult> {
  const channel = getUpdateChannel();
  const currentVersion = await getCurrentAppVersion();

  try {
    // Respect 30-min rate-limit cooldown on silent boot checks (manual checks always run live)
    if (silent && typeof window !== "undefined") {
      const lastCheck = Number(
        localStorage.getItem(LAST_CHECK_STORAGE_KEY) || 0
      );
      if (lastCheck && Date.now() - lastCheck < SILENT_CHECK_COOLDOWN_MS) {
        return {
          status: "cooldown",
          channel,
          currentVersion,
          latestVersion: currentVersion,
          downloadUrl: "",
          releasePageUrl: DEFAULT_RELEASES_PAGE_URL,
          isMandatory: false,
        };
      }
    }

    // Fetch latest APK build and Admin Panel Fleet Policy in parallel
    const [latestBuild, fleetPolicy] = await Promise.all([
      resolveLatestBuild(channel),
      checkFleetPolicy(),
    ]);

    if (typeof window !== "undefined") {
      localStorage.setItem(LAST_CHECK_STORAGE_KEY, String(Date.now()));
    }

    const minAppVersion = fleetPolicy?.minAppVersion || "";
    const isBelowMinVersion =
      Boolean(minAppVersion) &&
      compareVersions(minAppVersion, currentVersion) > 0;

    if (!latestBuild || !latestBuild.version || !latestBuild.downloadUrl) {
      const errResult: UpdateCheckResult = {
        status: "error",
        channel,
        currentVersion,
        latestVersion: "",
        downloadUrl: "",
        releasePageUrl: DEFAULT_RELEASES_PAGE_URL,
        isMandatory: isBelowMinVersion,
        minAppVersion,
        errorMessage: `Could not find a matching ${channel.toUpperCase()} APK build.`,
      };
      if (!silent || isBelowMinVersion) {
        showCrystalUpdateModal(errResult);
      }
      return errResult;
    }

    const versionComparison = compareVersions(
      latestBuild.version,
      currentVersion
    );
    const hasUpdate = versionComparison > 0 || isBelowMinVersion;
    const skippedVersion = getSkippedUpdateVersion();

    if (hasUpdate) {
      // Honor "Skip This Version" on silent checks only (never skip mandatory security updates)
      if (
        silent &&
        !isBelowMinVersion &&
        skippedVersion &&
        compareVersions(latestBuild.version, skippedVersion) === 0
      ) {
        return {
          status: "skipped",
          channel,
          currentVersion,
          latestVersion: latestBuild.version,
          downloadUrl: latestBuild.downloadUrl,
          releasePageUrl: latestBuild.releasePageUrl,
          assetName: latestBuild.assetName,
          isMandatory: false,
          minAppVersion,
        };
      }

      const updateResult: UpdateCheckResult = {
        status: isBelowMinVersion ? "mandatory_update" : "update_available",
        channel,
        currentVersion,
        latestVersion: latestBuild.version,
        downloadUrl: latestBuild.downloadUrl,
        releasePageUrl: latestBuild.releasePageUrl,
        assetName: latestBuild.assetName,
        fileSizeBytes: latestBuild.fileSizeBytes,
        publishedAt: latestBuild.publishedAt,
        releaseNotes: latestBuild.releaseNotes,
        isMandatory: isBelowMinVersion,
        minAppVersion,
      };

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("rabtv_update_available", { detail: updateResult })
        );
      }

      showCrystalUpdateModal(updateResult);
      return updateResult;
    }

    const upToDateResult: UpdateCheckResult = {
      status: "up_to_date",
      channel,
      currentVersion,
      latestVersion: latestBuild.version,
      downloadUrl: latestBuild.downloadUrl,
      releasePageUrl: latestBuild.releasePageUrl,
      assetName: latestBuild.assetName,
      fileSizeBytes: latestBuild.fileSizeBytes,
      publishedAt: latestBuild.publishedAt,
      isMandatory: false,
      minAppVersion,
    };

    if (!silent) {
      showCrystalUpdateModal(upToDateResult);
    }
    return upToDateResult;
  } catch (err: any) {
    console.error("Error checking for updates:", err);
    const errResult: UpdateCheckResult = {
      status: "error",
      channel,
      currentVersion,
      latestVersion: "",
      downloadUrl: "",
      releasePageUrl: DEFAULT_RELEASES_PAGE_URL,
      isMandatory: false,
      errorMessage:
        err?.name === "AbortError"
          ? "Update server timed out. Please check your Wi-Fi and try again."
          : err?.message || "Connection error while checking for updates.",
    };
    if (!silent) {
      showCrystalUpdateModal(errResult);
    }
    return errResult;
  }
}
