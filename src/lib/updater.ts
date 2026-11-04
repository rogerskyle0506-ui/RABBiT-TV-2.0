// lib/updater.ts
import { APP_VERSION } from "./version";

const GITHUB_REPO = (import.meta as any).env?.VITE_GH_REPO || "rogerskyle0506-ui/RABBiT-TV-2.0";
const GITHUB_RELEASES_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
const GITHUB_TOKEN = (import.meta as any).env?.VITE_GH_PAT || "";

/**
 * Parses a version string into numeric segments [major, minor, patch, build]
 * to ensure bulletproof numeric comparison.
 */
function parseVersion(versionStr: string): number[] {
  if (!versionStr) return [0, 0, 0, 0];
  const clean = versionStr.replace(/^v/, "").split("-")[0];
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
async function getCurrentAppVersion(): Promise<string> {
  // Primary source of truth generated straight from package.json at build time
  if (APP_VERSION) {
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
  return metaVersion || "2.2.6.7";
}

export async function checkForAppUpdates(silent = true) {
  try {
    const channel = (localStorage.getItem("rabtv_update_channel") as "stable" | "nightly") || "stable";
    const currentVersion = await getCurrentAppVersion();
    
    let latestVersion = "";
    let downloadUrl = "";

    if (channel === "nightly") {
      // Fetch nightly manifest matching your nightly_manifest.json layout
      const rawManifestUrl = `https://raw.githubusercontent.com/${GITHUB_REPO}/main/updates/nightly_manifest.json`;
      const res = await fetch(rawManifestUrl, { cache: "no-store" });
      
      if (!res.ok) {
        if (!silent) {
          alert(`❌ Nightly Update Check Failed!\nReason: HTTP ${res.status} (${res.statusText})\nTarget: updates/nightly_manifest.json`);
        }
        return;
      }

      const manifest = await res.json();
      latestVersion = manifest.versionName || manifest.version || "";
      downloadUrl = manifest.apkUrl || manifest.download_url || "";
    } else {
      // Stable updates fetch from GitHub Releases API
      const headers: Record<string, string> = {
        Accept: "application/vnd.github+json",
        "User-Agent": "RabbitTV-App"
      };
      if (GITHUB_TOKEN) {
        headers["Authorization"] = `Bearer ${GITHUB_TOKEN}`;
      }

      const res = await fetch(GITHUB_RELEASES_API, { headers });
      if (!res.ok) {
        if (!silent) {
          alert(`❌ Stable Update Check Failed!\nReason: HTTP ${res.status} (${res.statusText})\nCheck GitHub Releases API.`);
        }
        return;
      }

      const release = await res.json();
      latestVersion = release.tag_name?.replace(/^v/, "") || currentVersion;

      const apkAsset = release.assets?.find((asset: any) => asset.name.endsWith(".apk"));
      if (!apkAsset) {
        if (!silent) {
          alert(`❌ Stable Release Found (${latestVersion}), but no .apk asset was attached to the release.`);
        }
        return;
      }
      downloadUrl = apkAsset.browser_download_url;
    }

    if (!latestVersion || !downloadUrl) {
      if (!silent) {
        alert("❌ Update Check Failed: Could not parse version or download URL from manifest/release.");
      }
      return;
    }

    // Use strict numeric comparison against the installed version
    const versionComparison = compareVersions(latestVersion, currentVersion);

    if (versionComparison > 0) {
      if (confirm(`🚀 Update Available!\n\nChannel: ${channel.toUpperCase()}\nNew Version: ${latestVersion}\nCurrent Version: ${currentVersion}\n\nWould you like to download and install now?`)) {
        await downloadAndInstallApk(downloadUrl, `rabtv-${channel}-${latestVersion}.apk`);
      }
    } else if (!silent) {
      alert(`✅ You are running the latest ${channel} version!\n\nChannel: ${channel.toUpperCase()}\nCurrent Version: ${currentVersion}\nRemote Version: ${latestVersion}`);
    }
  } catch (err: any) {
    console.error("Error checking for updates:", err);
    if (!silent) {
      alert(`⚠️ Update Connection Error!\nDetails: ${err?.message || err}\nCheck your internet connection.`);
    }
  }
}

async function downloadAndInstallApk(url: string, fileName: string) {
  try {
    if (typeof window === "undefined") return;

    const isCapacitor = !!(window as any).Capacitor;

    if (isCapacitor) {
      try {
        // @vite-ignore prevents Rolldown/Vite from attempting static module resolution during web build
        const fsModule = await import(/* @vite-ignore */ "@capacitor/filesystem");
        const browserModule = await import(/* @vite-ignore */ "@capacitor/browser");
        const Filesystem = fsModule.Filesystem;
        const Directory = fsModule.Directory;
        const Browser = browserModule.Browser;

        const response = await fetch(url);
        if (!response.ok) throw new Error(`Download HTTP error ${response.status}`);

        const blob = await response.blob();
        const base64Data = await blobToBase64(blob);

        const savedFile = await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Cache,
        });

        await Browser.open({ url: savedFile.uri });
        return;
      } catch (nativeErr: any) {
        console.warn("Capacitor plugins unavailable, falling back to browser open", nativeErr);
        alert(`Native download failed: ${nativeErr?.message || nativeErr}. Opening in browser...`);
      }
    }

    window.open(url, "_blank");
  } catch (err: any) {
    console.error("Failed to download APK:", err);
    alert(`Failed to download APK: ${err?.message || err}`);
    window.open(url, "_blank");
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(",")[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
