// src/lib/updater.ts
import { App } from '@capacitor/app';

const GITHUB_RAW_BASE = "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/main/updates";

export interface UpdateManifest {
  versionCode: number;
  versionName: string;
  apkUrl: string;
  releaseNotes?: string;
}

/**
 * Converts a 4-part or 3-part version string (e.g. "2.2.5.1") into a numeric version code.
 */
export function parseVersionCode(versionStr: string): number {
  if (!versionStr) return 0;
  const parts = versionStr.split('.').map((p) => parseInt(p, 10) || 0);
  while (parts.length < 4) {
    parts.push(0);
  }
  return parts[0] * 1000000 + parts[1] * 10004 + parts[2] * 100 + parts[3];
}

/**
 * Returns the currently running app version.
 */
export async function getCurrentAppVersion(): Promise<{ versionName: string; versionCode: number }> {
  try {
    const info = await App.getInfo();
    const versionName = info.version || "2.2.5.0";
    const versionCode = parseInt(info.build, 10) || parseVersionCode(versionName);
    return { versionName, versionCode };
  } catch {
    return { versionName: "2.2.5.0", versionCode: parseVersionCode("2.2.5.0") };
  }
}

/**
 * Checks for updates based on the user's selected update channel ("stable" | "nightly").
 */
export async function checkForAppUpdates(): Promise<void> {
  if (typeof window === "undefined") return;

  const channel = (localStorage.getItem("rabtv_update_channel") as "stable" | "nightly") || "stable";
  const manifestFile = channel === "nightly" ? "nightly_manifest.json" : "manifest.json";
  const manifestUrl = `${GITHUB_RAW_BASE}/${manifestFile}?t=${Date.now()}`;

  try {
    const response = await fetch(manifestUrl, { cache: "no-store" });
    if (!response.ok) return;

    const remoteManifest: UpdateManifest = await response.json();
    const current = await getCurrentAppVersion();

    if (remoteManifest.versionCode > current.versionCode) {
      console.log(`[Updater] New ${channel} build found: v${remoteManifest.versionName}`);
      promptUserToUpdate(remoteManifest);
    }
  } catch (error) {
    console.error("[Updater] Silent update check failed:", error);
  }
}

/**
 * Displays an update notification overlay when a newer build is available.
 */
function promptUserToUpdate(manifest: UpdateManifest) {
  const existing = document.getElementById("rabtv-update-modal");
  if (existing) return;

  const overlay = document.createElement("div");
  overlay.id = "rabtv-update-modal";
  overlay.className =
    "fixed inset-0 z-[99999] flex items-center justify-center bg-black/90 p-4 backdrop-blur-xl animate-fade-in";

  overlay.innerHTML = `
    <div class="max-w-md w-full bg-slate-900 border border-violet-500/40 rounded-3xl p-6 text-white shadow-2xl space-y-4 text-center">
      <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-600/20 text-2xl border border-violet-500/30">
        🚀
      </div>
      <h3 class="text-xl font-bold text-violet-300">New Update Available!</h3>
      <p class="text-xs text-slate-300">
        Version <strong>v${manifest.versionName}</strong> is ready for installation.
      </p>
      ${
        manifest.releaseNotes
          ? `<div class="bg-black/40 border border-white/10 p-3 rounded-xl text-left text-[11px] text-slate-300 max-h-28 overflow-y-auto">${manifest.releaseNotes}</div>`
          : ""
      }
      <div class="flex gap-2 pt-2">
        <button id="rabtv-update-skip" class="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 transition">
          Later
        </button>
        <a id="rabtv-update-dl" href="${manifest.apkUrl}" download class="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-xs font-bold text-white shadow-lg transition flex items-center justify-center gap-1">
          📥 Download APK
        </a>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  document.getElementById("rabtv-update-skip")?.addEventListener("click", () => {
    overlay.remove();
  });
}
