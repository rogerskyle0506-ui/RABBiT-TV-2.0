// src/lib/report.ts
import {
  getOrCreateDeviceId,
  getHardwareLimits,
  getRamMode,
} from "./settings";
import { APP_VERSION, BUILD_TYPE } from "./version";

// Full email base64 encoded
const ENCODED_ALERT_DESTINATION = "cm9nZXJza3lsZTA1MDZAZ21haWwuY29t";
const AUDIT_LOG_STORAGE_KEY = "rabtv_security_audit_log_v1";
const MAX_AUDIT_ENTRIES = 25;

const GIST_ID = ((import.meta as any).env?.VITE_GIST_ID as string) || "";
const GITHUB_TOKEN = ((import.meta as any).env?.VITE_GH_PAT as string) || "";
const GIST_API_URL = GIST_ID ? `https://api.github.com/gists/${GIST_ID}` : "";

export interface DeviceDiagnostics {
  model: string;
  os: string;
  deviceId: string;
  ramMode: string;
  effectiveRamTier: "low" | "high";
  appVersion: string;
  buildType: string;
  screen: string;
  isTvDevice: boolean;
  online: boolean;
}

export interface SecurityAuditEntry {
  id: string;
  eventType:
    | "permanent_activation"
    | "trial_activation"
    | "pin_lockout"
    | "admin_unlock"
    | "backup_restore";
  userName: string;
  userAge: string;
  deviceId: string;
  deviceModel: string;
  deviceOs: string;
  appVersion: string;
  timestamp: number;
  note?: string;
}

function sanitizeText(raw: unknown, maxLen = 100): string {
  return String(raw ?? "")
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, maxLen);
}

/**
 * Decodes the base64-protected destination email at runtime
 */
function getAlertEmailAddress(): string {
  if (typeof window !== "undefined" && typeof window.atob === "function") {
    try {
      return window.atob(ENCODED_ALERT_DESTINATION);
    } catch {
      return "";
    }
  }
  return "";
}

/**
 * Captures rich, privacy-safe device & hardware telemetry without external dependencies
 */
export function getDeviceDetails(): DeviceDiagnostics {
  const deviceId = getOrCreateDeviceId();
  const limits = getHardwareLimits();
  const ramMode = getRamMode();

  if (typeof window === "undefined") {
    return {
      model: "Unknown Device",
      os: "Unknown OS",
      deviceId,
      ramMode,
      effectiveRamTier: limits.effectiveMode,
      appVersion: APP_VERSION || "1.0.0",
      buildType: BUILD_TYPE || "nightly",
      screen: "0x0",
      isTvDevice: false,
      online: true,
    };
  }

  const ua = navigator.userAgent || "";
  const lowerUa = ua.toLowerCase();
  let model = "Unknown Device";
  let os = "Unknown OS";

  if (ua.includes("Android")) {
    const match = ua.match(/Android\s([0-9.]+)/);
    os = match ? `Android ${match[1]}` : "Android";
  } else if (ua.includes("Windows")) {
    os = "Windows";
  } else if (ua.includes("Mac OS")) {
    os = "macOS / iOS";
  } else if (ua.includes("Linux")) {
    os = "Linux";
  }

  const isTvDevice =
    lowerUa.includes("aft") ||
    lowerUa.includes("firetv") ||
    lowerUa.includes("silk/") ||
    lowerUa.includes("smarttv") ||
    lowerUa.includes("android tv") ||
    lowerUa.includes("bravia") ||
    lowerUa.includes("shield");

  if (lowerUa.includes("silk/") || lowerUa.includes("firetv") || lowerUa.includes("aft")) {
    model = "Amazon Fire TV Stick / Fire OS";
  } else if (lowerUa.includes("smarttv") || lowerUa.includes("android tv")) {
    model = "Android TV / Streaming Stick";
  } else {
    const match = ua.match(/\(([^)]+)\)/);
    if (match && match[1]) {
      const parts = match[1].split(";");
      model =
        parts[parts.length - 1]?.replace(/\s*Build\/.*$/i, "").trim() ||
        navigator.platform ||
        "Web Device";
    }
  }

  return {
    model,
    os,
    deviceId,
    ramMode,
    effectiveRamTier: limits.effectiveMode,
    appVersion: APP_VERSION || "1.0.0",
    buildType: BUILD_TYPE || "nightly",
    screen: `${window.screen?.width || window.innerWidth}x${
      window.screen?.height || window.innerHeight
    }`,
    isTvDevice,
    online: navigator.onLine !== false,
  };
}

/**
 * Local security audit log helpers (capped at 25 entries for 1–2GB sticks)
 */
export function getSecurityAuditLog(): SecurityAuditEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(AUDIT_LOG_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function clearSecurityAuditLog(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(AUDIT_LOG_STORAGE_KEY);
  }
}

export function logSecurityEvent(
  eventType: SecurityAuditEntry["eventType"],
  userName: string,
  note?: string,
  userAge?: string | number
): SecurityAuditEntry {
  const device = getDeviceDetails();
  const resolvedAge = sanitizeText(
    userAge ??
      (typeof window !== "undefined"
        ? localStorage.getItem("rabtv_user_age") || "Not Provided"
        : "Not Provided"),
    16
  );

  const entry: SecurityAuditEntry = {
    id: `sec-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    eventType,
    userName: sanitizeText(userName || "Friend", 40),
    userAge: resolvedAge,
    deviceId: device.deviceId,
    deviceModel: device.model,
    deviceOs: device.os,
    appVersion: `${device.appVersion} (${device.buildType})`,
    timestamp: Date.now(),
    note: note ? sanitizeText(note, 140) : undefined,
  };

  if (typeof window !== "undefined") {
    try {
      const next = [entry, ...getSecurityAuditLog()].slice(0, MAX_AUDIT_ENTRIES);
      localStorage.setItem(AUDIT_LOG_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore quota issues
    }
  }

  return entry;
}

/**
 * Silently logs activation telemetry to `activations.json` on the private admin Gist
 * with a strict 5-second timeout so user activation is never blocked.
 */
async function pushActivationTelemetryToGist(
  entry: SecurityAuditEntry
): Promise<boolean> {
  if (!GIST_ID || !GITHUB_TOKEN || !GIST_API_URL) return false;

  const controller = new AbortController();
  const timer =
    typeof window !== "undefined"
      ? window.setTimeout(() => controller.abort(), 5000)
      : setTimeout(() => controller.abort(), 5000);

  try {
    const getRes = await fetch(GIST_API_URL, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "RabbitTV-App",
      },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!getRes.ok) return false;

    const gistData = await getRes.json();
    let existingList: SecurityAuditEntry[] = [];
    const rawContent = gistData.files?.["activations.json"]?.content;
    if (rawContent) {
      try {
        const parsed = JSON.parse(rawContent);
        if (Array.isArray(parsed)) existingList = parsed;
      } catch {
        existingList = [];
      }
    }

    const updated = [entry, ...existingList].slice(0, 100);
    const patchRes = await fetch(GIST_API_URL, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "RabbitTV-App",
      },
      signal: controller.signal,
      body: JSON.stringify({
        files: {
          "activations.json": {
            content: JSON.stringify(updated, null, 2),
          },
        },
      }),
    });

    return patchRes.ok;
  } catch {
    return false;
  } finally {
    if (typeof window !== "undefined") {
      window.clearTimeout(timer as number);
    } else {
      clearTimeout(timer);
    }
  }
}

/**
 * Dispatches permanent activation telemetry (local audit + silent Gist log)
 */
export async function sendPermanentActivationAlert(
  profileName: string,
  userAge?: string | number
) {
  try {
    const destinationEmail = getAlertEmailAddress();
    const device = getDeviceDetails();
    const timestamp = new Date().toLocaleString();
    const safeName = sanitizeText(profileName || "Friend", 40);

    const resolvedAge = sanitizeText(
      userAge ??
        (typeof window !== "undefined"
          ? localStorage.getItem("rabtv_user_age") || "Not Provided"
          : "Not Provided"),
      16
    );

    const auditEntry = logSecurityEvent(
      "permanent_activation",
      safeName,
      `Activated on ${device.model} (${device.effectiveRamTier} RAM)`,
      resolvedAge
    );

    // Fire-and-forget Gist telemetry so UI activation never stalls
    void pushActivationTelemetryToGist(auditEntry);

    const alertPayload = {
      to_email: destinationEmail,
      user_name: safeName,
      user_age: resolvedAge,
      device_id: device.deviceId,
      device_model: device.model,
      device_os: device.os,
      app_version: `${device.appVersion} (${device.buildType})`,
      ram_tier: device.effectiveRamTier,
      activation_time: timestamp,
      message: `SECURITY ALERT: Permanent code entered!\n\nUser Name: ${safeName}\nAge: ${resolvedAge}\nDevice ID: ${device.deviceId}\nDevice Model: ${device.model}\nOS: ${device.os}\nApp: v${device.appVersion}\nTime: ${timestamp}`,
    };

    return alertPayload;
  } catch (err) {
    console.error("Failed to prepare activation report:", err);
  }
}
