// lib/updater.ts
const GITHUB_REPO = (import.meta as any).env?.VITE_GH_REPO || "RabbitProductions/RabbitTV-Releases";
const GITHUB_RELEASES_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
const GITHUB_TOKEN = (import.meta as any).env?.VITE_GH_PAT || "";

export async function checkForAppUpdates(silent = true) {
  try {
    const channel = localStorage.getItem("rabtv_update_channel") || "stable";
    
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "User-Agent": "RabbitTV-App"
    };
    
    if (GITHUB_TOKEN) {
      headers["Authorization"] = `Bearer ${GITHUB_TOKEN}`;
    }

    const res = await fetch(GITHUB_RELEASES_API, { headers });

    if (!res.ok) {
      if (!silent) console.error("Failed to check for updates");
      return;
    }

    const release = await res.json();
    const latestVersion = release.tag_name?.replace(/^v/, "") || "1.0.0";
    const currentVersion = "1.0.0"; // Active app version

    const apkAsset = release.assets?.find((asset: any) => asset.name.endsWith(".apk"));
    if (!apkAsset) return;

    if (latestVersion !== currentVersion || channel === "nightly") {
      const downloadUrl = apkAsset.browser_download_url;
      if (confirm(`A new ${channel} update (${latestVersion}) is available! Download and install now?`)) {
        await downloadAndInstallApk(downloadUrl, apkAsset.name);
      }
    } else if (!silent) {
      alert("You are running the latest version of RABBiT TV!");
    }
  } catch (err) {
    console.error("Error checking for updates:", err);
    if (!silent) alert("Failed to check for updates. Check your internet connection.");
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
        const blob = await response.blob();
        const base64Data = await blobToBase64(blob);

        const savedFile = await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Cache,
        });

        await Browser.open({ url: savedFile.uri });
        return;
      } catch (nativeErr) {
        console.warn("Capacitor plugins unavailable, falling back to browser open", nativeErr);
      }
    }

    window.open(url, "_blank");
  } catch (err) {
    console.error("Failed to download APK:", err);
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
