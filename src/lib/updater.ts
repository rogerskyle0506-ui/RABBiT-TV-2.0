// lib/updater.ts
import { APP_VERSION } from "./version";

const GITHUB_REPO = (import.meta as any).env?.VITE_GH_REPO || "rogerskyle0506-ui/RABBiT-TV-2.0";
const GITHUB_API_BASE = `https://api.github.com/repos/${GITHUB_REPO}`;
const GITHUB_TOKEN = (import.meta as any).env?.VITE_GH_PAT || "";
const TARGET_RELEASE_TAG = "RABBiTTV2.3.0.1";

/**
 * Parses a version string into numeric segments [major, minor, patch, build]
 * to ensure bulletproof numeric comparison.
 */
function parseVersion(versionStr: string): number[] {
  if (!versionStr) return [0, 0, 0, 0];
  const clean = versionStr.replace(/^v/i, "").split("-")[0];
  return clean.split(".").map((part) => {
    const num = parseInt(part, 10);
    return isNaN(num) ? 0 : num;
  });
}

/**
 * Compares two version strings numerically segment by segment.
 * Returns 1 if v1 > v2, -1 if v1 < v2, and 0 if equal.
 */
function compareVersions(v1: string, v2: string): number {
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
 * Dynamically fetches the currently installed application version.
 */
export async function getCurrentAppVersion(): Promise<string> {
  // Primary source of truth generated straight from package.json/version.ts at build time
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
    console.warn("Could not fetch native app version from Capacitor, using fallback:", err);
  }

  const metaVersion = document.querySelector('meta[name="app-version"]')?.getAttribute("content");
  return metaVersion || APP_VERSION || "2.2.9.5";
}

/**
 * Main update checker routine for manual or dynamic triggers.
 */
export async function checkForAppUpdates(silent = false) {
  try {
    const channel = (localStorage.getItem("rabtv_update_channel") as "stable" | "nightly") || "nightly";
    const currentVersion = await getCurrentAppVersion();

    let latestVersion = "";
    let downloadUrl = "";

    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "User-Agent": "RabbitTV-App"
    };
    if (GITHUB_TOKEN) {
      headers["Authorization"] = `Bearer ${GITHUB_TOKEN}`;
    }

    // Step 1: Check the specific target release tag provided or list releases
    const targetTagRes = await fetch(`${GITHUB_API_BASE}/releases/tags/${TARGET_RELEASE_TAG}`, { headers });
    let releasesList: any[] = [];

    if (targetTagRes.ok) {
      const targetRelease = await targetTagRes.json();
      releasesList = [targetRelease];
    }

    // Fetch general releases list to ensure full scanning capability
    const res = await fetch(`${GITHUB_API_BASE}/releases`, { headers });
    if (res.ok) {
      const fetchedReleases = await res.json();
      if (Array.isArray(fetchedReleases)) {
        // Merge without duplicates based on tag_name/id
        const existingIds = new Set(releasesList.map((r) => r.id));
        for (const rel of fetchedReleases) {
          if (!existingIds.has(rel.id)) {
            releasesList.push(rel);
          }
        }
      }
    }

    if (releasesList.length > 0) {
      if (channel === "nightly") {
        // Search releases for an asset marked with "nightly"
        for (const release of releasesList) {
          const nightlyAsset = release.assets?.find((asset: any) =>
            asset.name.toLowerCase().endsWith(".apk") && asset.name.toLowerCase().includes("nightly")
          );
          if (nightlyAsset) {
            downloadUrl = nightlyAsset.browser_download_url;
            const match = nightlyAsset.name.match(/v?(\d+\.\d+\.\d+(?:\.\d+)?)/i);
            latestVersion = match ? match[1] : (release.tag_name?.replace(/^v/i, "") || "");
            break;
          }
        }
        // Fallback to latest release general APK if no explicit nightly asset was found
        if (!downloadUrl && releasesList[0]) {
          const latestRelease = releasesList[0];
          latestVersion = latestRelease.tag_name?.replace(/^v/i, "") || "";
          const apkAsset = latestRelease.assets?.find((asset: any) => asset.name.endsWith(".apk"));
          if (apkAsset) {
            downloadUrl = apkAsset.browser_download_url;
          }
        }
      } else {
        // Stable track: find the appropriate stable version/APK missing the nightly format
        for (const release of releasesList) {
          const stableAsset = release.assets?.find((asset: any) =>
            asset.name.toLowerCase().endsWith(".apk") && !asset.name.toLowerCase().includes("nightly")
          );
          if (stableAsset) {
            downloadUrl = stableAsset.browser_download_url;
            const match = stableAsset.name.match(/v?(\d+\.\d+\.\d+(?:\.\d+)?)/i);
            latestVersion = match ? match[1] : (release.tag_name?.replace(/^v/i, "") || "");
            break;
          }
        }
      }
    }

    // Fallback to manifest if release endpoint or asset matching fails for nightly
    if ((!latestVersion || !downloadUrl) && channel === "nightly") {
      const rawManifestUrl = `https://raw.githubusercontent.com/${GITHUB_REPO}/main/updates/nightly_manifest.json`;
      const manifestRes = await fetch(rawManifestUrl, { cache: "no-store" });

      if (manifestRes.ok) {
        const manifest = await manifestRes.json();
        latestVersion = manifest.versionName || manifest.version || "";
        downloadUrl = manifest.apkUrl || manifest.download_url || "";
      }
    }

    // Fallback to /releases/latest for stable if needed
    if ((!latestVersion || !downloadUrl) && channel === "stable") {
      const latestRes = await fetch(`${GITHUB_API_BASE}/releases/latest`, { headers });
      if (latestRes.ok) {
        const release = await latestRes.json();
        latestVersion = release.tag_name?.replace(/^v/i, "") || currentVersion;
        const stableAsset = release.assets?.find((asset: any) =>
          asset.name.endsWith(".apk") && !asset.name.toLowerCase().includes("nightly")
        );
        if (stableAsset) {
          downloadUrl = stableAsset.browser_download_url;
        } else {
          const anyApk = release.assets?.find((asset: any) => asset.name.endsWith(".apk"));
          if (anyApk) downloadUrl = anyApk.browser_download_url;
        }
      }
    }

    if (!latestVersion || !downloadUrl) {
      if (!silent) {
        alert(`❌ Update Check Failed: Could not resolve a valid build version or APK URL on the ${channel.toUpperCase()} track.`);
      }
      return;
    }

    // Strict numeric comparison against installed version
    const versionComparison = compareVersions(latestVersion, currentVersion);

    if (versionComparison > 0) {
      const userChoice = confirm(
        `🚀 New ${channel.toUpperCase()} Update Available!\n\n` +
        `Installed Version: v${currentVersion}\n` +
        `Latest Build: v${latestVersion}\n\n` +
        `Direct APK Link (Copy or write down):\n${downloadUrl}\n\n` +
        `Would you like to open the download link now?`
      );

      if (userChoice) {
        await downloadAndInstallApk(downloadUrl, `rabtv-${channel}-v${latestVersion}.apk`);
      }
    } else if (!silent) {
      alert(
        `✅ Up to Date!\n\n` +
        `Track: ${channel.toUpperCase()}\n` +
        `Current Version: v${currentVersion}\n` +
        `Remote Version: v${latestVersion}\n\n` +
        `Direct APK Link:\n${downloadUrl}`
      );
    }
  } catch (err: any) {
    console.error("Error checking for updates:", err);
    if (!silent) {
      alert(`⚠️ Update Connection Error!\nDetails: ${err?.message || err}`);
    }
  }
}

/**
 * Dispatches APK download or opens direct browser download intent.
 */
async function downloadAndInstallApk(url: string, fileName: string) {
  try {
    if (typeof window === "undefined") return;

    const isCapacitor = !!(window as any).Capacitor;

    if (isCapacitor) {
      try {
        // @vite-ignore prevents Vite static resolution breakages
        const browserModule = await import(/* @vite-ignore */ "@capacitor/browser");
        await browserModule.Browser.open({ url });
        return;
      } catch (nativeErr: any) {
        console.warn("Capacitor Browser plugin unavailable, falling back to anchor trigger:", nativeErr);
      }
    }

    // Standard web fallback using anchor download trigger
    const a = document.createElement("a");
    a.href = url;
    a.setAttribute("download", fileName);
    a.setAttribute("target", "_blank");
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (err: any) {
    console.error("Failed to trigger APK download:", err);
    window.open(url, "_blank");
  }
}
