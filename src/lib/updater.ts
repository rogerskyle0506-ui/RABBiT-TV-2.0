// src/lib/updater.ts
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';

// Public repository raw content endpoint pointing to your root /updates folder
const GITHUB_OWNER = "rogerskyle0506-ui";
const GITHUB_Here is the updated **`src/lib/updater.ts`** configured to fetch updates directly from the public `/updates` folder in your GitHub repository, running silently once per app launch based on the user's selected update channel.

### `src/lib/updater.ts`

```typescript
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';

// ——— Public Repository Update Configuration ———
const GITHUB_OWNER = "rogerskyle0506-ui";
const GITHUB_REPO = "RABBiT-TV-2.0";
const RAW_REPO_BASE_URL = `[https://raw.githubusercontent.com/$](https://raw.githubusercontent.com/$){GITHUB_OWNER}/${GITHUB_REPO}/main/updates`;

export interface UpdateManifest {
  versionCode: number;
  versionName: string;
  apkUrl: string;
  releaseNotes: string;
}

/**
 * Parses semantic version strings (e.g., "2.0.1") into numeric components for comparison.
 */
function isVersionGreater(remoteVersion: string, currentVersion: string): boolean {
  const parseVersion = (v: string) => v.replace(/^v/i, '').split('.').map(Number);
  const remote = parseVersion(remoteVersion);
  const current = parseVersion(currentVersion);

  for (let i = 0; i < Math.max(remote.length, current.length); i++) {
    const r = remote[i] || 0;
    const c = current[i] || 0;
    if (r > c) return true;
    if (r < c) return false;
  }
  return false;
}

/**
 * Checks for app updates silently against the public repo's /updates directory.
 * Executes strictly ONCE per app launch session.
 */
export async function checkForAppUpdates(): Promise<void> {
  // 1. Ensure this check runs only ONCE per app launch session
  if (typeof window !== 'undefined' && sessionStorage.getItem('rabtv_update_checked') === 'true') {
    return;
  }
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('rabtv_update_checked', 'true');
  }

  try {
    // 2. Resolve current app version
    const appInfo = await App.getInfo().catch(() => null);
    const currentVersion = appInfo?.version || (import.meta as any).env?.VITE_APP_VERSION || '2.0.0';

    // 3. Determine user update channel ("stable" vs "nightly")
    const updateChannel = (typeof window !== 'undefined' ? localStorage.getItem('rabtv_update_channel') : null) || 'stable';
    const manifestFileName = updateChannel === 'nightly' ? 'nightly_manifest.json' : 'stable_manifest.json';
    const manifestUrl = `${RAW_REPO_BASE_URL}/${manifestFileName}`;

    // 4. Fetch the raw manifest from public GitHub repo without caching
    const res = await fetch(manifestUrl, { cache: 'no-store' });
    if (!res.ok) return;

    const manifest: UpdateManifest = await res.json();

    // 5. Compare manifest version with running app version
    if (manifest?.versionName && isVersionGreater(manifest.versionName, currentVersion)) {
      const channelLabel = updateChannel === 'nightly' ? 'Nightly Build' : 'Stable Release';
      const confirmUpdate = window.confirm(
        `🚀 New ${channelLabel} (${manifest.versionName}) Available!\n\n` +
        `${manifest.releaseNotes}\n\n` +
        `Would you like to download and install this update now?`
      );

      if (confirmUpdate && manifest.apkUrl) {
        await Browser.open({ url: manifest.apkUrl });
      }
    }
  } catch (error) {
    console.error('Failed to check for updates from repo /updates folder:', error);
  }
}
