// src/components/ActivationModal.tsx
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  CardSize,
  StreamQuality,
  AppTheme,
  DISCLAIMER_ACCEPTED_KEY,
  saveCardSize,
  saveStreamQuality,
  saveTheme,
  setHelpfulMouse,
  saveUserAge,
  setRamMode,
  getRamMode,
  saveAgeLockPinSecure,
  isValidAgeLockPin,
  applyAllSettingsToDocument,
  getOrCreateDeviceId,
  getLargeButtons,
  setLargeButtons,
  getHardwareLimits,
  getAutoPlayNext,
  setAutoPlayNext,
} from "@/lib/settings";
import { sendPermanentActivationAlert } from "@/lib/report";
import {
  isGistConfigured,
  readGistJsonFile,
  patchGistFilesSerialized,
  runSerializedGistTransaction,
  generateSecureId,
} from "@/lib/gist-client";
import { bgAudio } from "@/lib/background-audio";
import { getDefaultHeartbeatStationUrl } from "@/components/sidebar";

// ——— Private GitHub Gist Key Verification, Trial Registry & Admin Alerts ———
const GIST_ID = ((import.meta as any).env?.VITE_GIST_ID as string) || "";
const GITHUB_TOKEN = ((import.meta as any).env?.VITE_GH_PAT as string) || "";
const ADMIN_PASSCODE_ENV =
  ((import.meta as any).env?.VITE_ADMIN_CODE as string) || "";
const GIST_API_URL = GIST_ID ? `https://api.github.com/gists/${GIST_ID}` : "";

const ADMIN_NAME = "Rabbit";
const ADMIN_BIRTH_YEAR = 1988;
const TRIAL_CODE = "9654";
const TRIAL_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
const GIST_TIMEOUT_MS = 9000;
const CHAT_SEND_COOLDOWN_MS = 2500; // 2.5s anti-spam spacing between live chat messages
const ADMIN_ALERT_SOUND_URL =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/Notification-sounds/Soviet%20Power%20Supreme.mp3";
const ADMIN_LAST_ALERTED_MAP_KEY = "rabtv_admin_last_alerted_msg_map_v2";
const MAX_CHAT_THREADS = 60;
const MAX_CHAT_MESSAGES_PER_THREAD = 40;

const SUPPORT_PHONE_RAW = "17058093865";
const SUPPORT_PHONE_DISPLAY = "(705) 809-3865";

// Multi-layer persistence keys (localStorage + sessionStorage + IndexedDB)
const AUTH_LOCKOUT_KEY = "rabtv_activation_lockout_until_v2";
const AUTH_STRIKES_KEY = "rabtv_activation_strikes_v2";
const AUTH_LAST_TICK_KEY = "rabtv_monotonic_clock_guard_v1";
const TRIAL_USED_LOCAL_KEY = "rabtv_trial_used_flag";
const TRIAL_FP_LOCAL_KEY = "rabtv_trial_hw_fp_v1";
const ACCESS_SIG_KEY = "rabtv_access_integrity_sig_v1";
const REQUEST_COOLDOWN_KEY = "rabtv_admin_req_cooldown_v1";
const ADMIN_SEEN_REQS_KEY = "rabtv_admin_seen_req_ids_v1";

const IDB_VAULT_NAME = "rabtv_secure_vault_v1";
const IDB_STORE_NAME = "kv";

const IMG_ACT_MODAL_FRAME =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-referral-modal-frame.jpg";
const IMG_ACT_BANNER =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-activation-banner.jpg";
const IMG_ACT_BTN_PRIMARY =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-referral-btn-primary.jpg";
const IMG_ACT_BTN_EMERALD =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-referral-btn-emerald.jpg";
const IMG_ACT_TAB_ACTIVE =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-referral-tab-active.jpg";
const IMG_ACT_TAB_IDLE =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-referral-tab-idle.jpg";

const RABBIT_DIVIDER =
  "https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/main/assets/rabbit-divider.jpg";

interface RadioPreset {
  id: string;
  label: string;
  vibe: string;
  url: string;
}

interface ActivationChatMessage {
  id: string;
  sender: "user" | "admin";
  text: string;
  sentAt: string;
  deliveredKey?: string;
}

interface ActivationRequestRecord {
  id: string;
  priority: "HIGH";
  name: string;
  age: number;
  deviceId: string;
  hwFingerprint: string;
  note: string;
  requestedAt: string;
  updatedAt?: string;
  seenByAdmin?: boolean;
  unreadByAdmin?: boolean;
  closed?: boolean;
  messages?: ActivationChatMessage[];
}

interface TrialRegistryEntry {
  hwFingerprint: string;
  deviceId: string;
  profileHash: string;
  name: string;
  age: number;
  startedAt: number;
  expiresAt: number;
  claimedIso: string;
}

interface ModalThemeTokens {
  frameBorder: string;
  frameShadow: string;
  laserTop: string;
  laserBottom: string;
  avatarBorder: string;
  sectionBorder: string;
  inputClass: string;
  labelAccent: string;
  badgeClass: string;
  secondaryBtn: string;
  toggleOn: string;
  focusRing: string;
  alertToastBg: string;
}

function getModalThemeTokens(theme: AppTheme): ModalThemeTokens {
  switch (theme) {
    case "red":
      return {
        frameBorder: "border-red-500/45",
        frameShadow:
          "shadow-[0_25px_80px_rgba(0,0,0,0.95),0_0_38px_rgba(239,68,68,0.28)]",
        laserTop: "from-red-500 via-rose-400 to-orange-500",
        laserBottom: "from-orange-500 via-rose-400 to-red-500",
        avatarBorder: "border-red-400/60 shadow-[0_0_24px_rgba(239,68,68,0.4)]",
        sectionBorder: "border-red-500/20",
        inputClass:
          "border-red-500/35 bg-black/80 text-white placeholder-zinc-400 focus:border-red-400 focus:ring-2 focus:ring-red-500/60",
        labelAccent: "text-red-300",
        badgeClass: "bg-red-950/75 border-red-500/40 text-red-200",
        secondaryBtn:
          "bg-red-950/55 hover:bg-red-900/80 border-red-500/35 text-red-100 hover:text-white",
        toggleOn: "bg-red-600",
        focusRing: "focus:ring-red-400",
        alertToastBg:
          "bg-zinc-950/96 border-red-400/80 shadow-[0_18px_50px_rgba(239,68,68,0.45)]",
      };
    case "midnight":
      return {
        frameBorder: "border-sky-400/45",
        frameShadow:
          "shadow-[0_25px_80px_rgba(0,0,0,0.95),0_0_38px_rgba(56,189,248,0.28)]",
        laserTop: "from-blue-500 via-sky-400 to-cyan-400",
        laserBottom: "from-cyan-400 via-sky-400 to-blue-500",
        avatarBorder:
          "border-sky-400/60 shadow-[0_0_24px_rgba(56,189,248,0.4)]",
        sectionBorder: "border-blue-500/20",
        inputClass:
          "border-blue-500/35 bg-black/80 text-white placeholder-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/60",
        labelAccent: "text-sky-300",
        badgeClass: "bg-blue-950/75 border-blue-500/40 text-sky-200",
        secondaryBtn:
          "bg-blue-950/55 hover:bg-blue-900/80 border-blue-500/35 text-sky-100 hover:text-white",
        toggleOn: "bg-blue-600",
        focusRing: "focus:ring-sky-400",
        alertToastBg:
          "bg-slate-950/96 border-sky-400/80 shadow-[0_18px_50px_rgba(56,189,248,0.45)]",
      };
    case "emerald":
      return {
        frameBorder: "border-emerald-400/45",
        frameShadow:
          "shadow-[0_25px_80px_rgba(0,0,0,0.95),0_0_38px_rgba(16,185,129,0.28)]",
        laserTop: "from-emerald-400 via-teal-400 to-green-500",
        laserBottom: "from-green-500 via-teal-400 to-emerald-400",
        avatarBorder:
          "border-emerald-400/60 shadow-[0_0_24px_rgba(16,185,129,0.4)]",
        sectionBorder: "border-emerald-500/20",
        inputClass:
          "border-emerald-500/35 bg-black/80 text-white placeholder-neutral-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/60",
        labelAccent: "text-emerald-300",
        badgeClass: "bg-emerald-950/75 border-emerald-500/40 text-emerald-200",
        secondaryBtn:
          "bg-emerald-950/55 hover:bg-emerald-900/80 border-emerald-500/35 text-emerald-100 hover:text-white",
        toggleOn: "bg-emerald-600",
        focusRing: "focus:ring-emerald-400",
        alertToastBg:
          "bg-neutral-950/96 border-emerald-400/80 shadow-[0_18px_50px_rgba(16,185,129,0.45)]",
      };
    case "amber":
      return {
        frameBorder: "border-amber-400/45",
        frameShadow:
          "shadow-[0_25px_80px_rgba(0,0,0,0.95),0_0_38px_rgba(245,158,11,0.28)]",
        laserTop: "from-amber-400 via-yellow-400 to-orange-500",
        laserBottom: "from-orange-500 via-yellow-400 to-amber-400",
        avatarBorder:
          "border-amber-400/60 shadow-[0_0_24px_rgba(245,158,11,0.4)]",
        sectionBorder: "border-amber-500/20",
        inputClass:
          "border-amber-500/35 bg-black/80 text-white placeholder-stone-400 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/60",
        labelAccent: "text-amber-300",
        badgeClass: "bg-amber-950/75 border-amber-500/40 text-amber-200",
        secondaryBtn:
          "bg-amber-950/55 hover:bg-amber-900/80 border-amber-500/35 text-amber-100 hover:text-white",
        toggleOn: "bg-amber-600",
        focusRing: "focus:ring-amber-400",
        alertToastBg:
          "bg-stone-950/96 border-amber-400/80 shadow-[0_18px_50px_rgba(245,158,11,0.45)]",
      };
    case "cyan":
      return {
        frameBorder: "border-cyan-400/45",
        frameShadow:
          "shadow-[0_25px_80px_rgba(0,0,0,0.95),0_0_38px_rgba(6,182,212,0.28)]",
        laserTop: "from-cyan-400 via-teal-400 to-sky-500",
        laserBottom: "from-sky-500 via-teal-400 to-cyan-400",
        avatarBorder:
          "border-cyan-400/60 shadow-[0_0_24px_rgba(6,182,212,0.4)]",
        sectionBorder: "border-cyan-500/20",
        inputClass:
          "border-cyan-500/35 bg-black/80 text-white placeholder-slate-400 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/60",
        labelAccent: "text-cyan-300",
        badgeClass: "bg-cyan-950/75 border-cyan-500/40 text-cyan-200",
        secondaryBtn:
          "bg-cyan-950/55 hover:bg-cyan-900/80 border-cyan-500/35 text-cyan-100 hover:text-white",
        toggleOn: "bg-cyan-600",
        focusRing: "focus:ring-cyan-400",
        alertToastBg:
          "bg-slate-950/96 border-cyan-400/80 shadow-[0_18px_50px_rgba(6,182,212,0.45)]",
      };
    case "violet":
    default:
      return {
        frameBorder: "border-violet-400/45",
        frameShadow:
          "shadow-[0_25px_80px_rgba(0,0,0,0.95),0_0_38px_rgba(139,92,246,0.28)]",
        laserTop: "from-violet-500 via-purple-400 to-indigo-400",
        laserBottom: "from-indigo-400 via-purple-400 to-violet-500",
        avatarBorder:
          "border-violet-400/60 shadow-[0_0_24px_rgba(139,92,246,0.4)]",
        sectionBorder: "border-violet-500/20",
        inputClass:
          "border-violet-500/35 bg-black/80 text-white placeholder-slate-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-400/60",
        labelAccent: "text-violet-300",
        badgeClass: "bg-purple-950/75 border-violet-500/40 text-violet-200",
        secondaryBtn:
          "bg-purple-950/55 hover:bg-purple-900/80 border-violet-500/35 text-purple-100 hover:text-white",
        toggleOn: "bg-violet-600",
        focusRing: "focus:ring-violet-400",
        alertToastBg:
          "bg-slate-950/96 border-violet-400/80 shadow-[0_18px_50px_rgba(139,92,246,0.45)]",
      };
  }
}

// ——— Security & Crypto Utilities ———

function sanitizeText(raw: string, maxLen = 40): string {
  return String(raw || "")
    .replace(/[\u200B-\u200D\uFEFF\x00-\x1F\x7F<>]/g, "")
    .trim()
    .slice(0, maxLen);
}

/** Constant-time string comparison to prevent timing side-channels */
function safeEqual(a: string, b: string): boolean {
  const s1 = String(a || "");
  const s2 = String(b || "");
  let diff = s1.length ^ s2.length;
  const max = Math.max(s1.length, s2.length);
  for (let i = 0; i < max; i++) {
    diff |= (s1.charCodeAt(i) || 0) ^ (s2.charCodeAt(i) || 0);
  }
  return diff === 0;
}

async function sha256Hex(input: string): Promise<string> {
  try {
    if (typeof crypto !== "undefined" && crypto.subtle) {
      const data = new TextEncoder().encode(input);
      const buf = await crypto.subtle.digest("SHA-256", data);
      return Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    }
  } catch {
    // fallback below for legacy Android WebViews without subtle crypto
  }
  let h1 = 0xdeadbeef ^ input.length;
  let h2 = 0x41c6ce57 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 =
    Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
    Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 =
    Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
    Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (
    (h2 >>> 0).toString(16).padStart(8, "0") +
    (h1 >>> 0).toString(16).padStart(8, "0")
  );
}

/**
 * Deterministic hardware/GPU/display fingerprint that survives localStorage clears
 * and APK reinstalls on the same phone, tablet, Fire Stick, TV, or projector.
 */
async function computeHardwareFingerprint(): Promise<string> {
  if (typeof window === "undefined") return "ssr-device";
  let gpuInfo = "no-webgl";
  try {
    const canvas = document.createElement("canvas");
    const gl =
      (canvas.getContext("webgl") as WebGLRenderingContext | null) ||
      (canvas.getContext("experimental-webgl") as WebGLRenderingContext | null);
    if (gl) {
      const dbg = gl.getExtension("WEBGL_debug_renderer_info");
      if (dbg) {
        const vendor = gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) || "";
        const renderer = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || "";
        gpuInfo = `${vendor}|${renderer}`;
      }
    }
  } catch {
    // ignore WebGL restrictions
  }

  const nav = navigator as any;
  const tz =
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone || ""
      : "";
  const screenDims = [
    Math.min(window.screen?.width || 0, window.screen?.height || 0),
    Math.max(window.screen?.width || 0, window.screen?.height || 0),
    window.screen?.colorDepth || 0,
    Math.round((window.devicePixelRatio || 1) * 100),
  ].join("x");

  // Extract stable Android/device model signature from UA while ignoring mutable app/chrome build numbers
  const ua = (navigator.userAgent || "").replace(/Chrome\/[\d.]+/g, "Chrome");
  const modelMatch = ua.match(/\(([^)]+)\)/);
  const stablePlatform = modelMatch ? modelMatch[1] : navigator.platform || "";

  const rawSignals = [
    stablePlatform,
    screenDims,
    String(navigator.hardwareConcurrency || 0),
    String(nav.deviceMemory || 0),
    tz,
    navigator.language || "",
    gpuInfo,
  ].join("::");

  const digest = await sha256Hex(`rabtv-hw-v2::${rawSignals}`);
  return digest.slice(0, 32);
}

// ——— IndexedDB Secondary Vault (Survives casual localStorage wipes) ———

function idbOpen(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(IDB_VAULT_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
          db.createObjectStore(IDB_STORE_NAME);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbGet(key: string): Promise<string | null> {
  const db = await idbOpen();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE_NAME, "readonly");
      const req = tx.objectStore(IDB_STORE_NAME).get(key);
      req.onsuccess = () => resolve(req.result != null ? String(req.result) : null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbSet(key: string, value: string): Promise<void> {
  const db = await idbOpen();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE_NAME, "readwrite");
      tx.objectStore(IDB_STORE_NAME).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

function readPersistentNumber(key: string): number {
  if (typeof window === "undefined") return 0;
  const s = Number(sessionStorage.getItem(key) || 0);
  const l = Number(localStorage.getItem(key) || 0);
  return Math.max(isNaN(s) ? 0 : s, isNaN(l) ? 0 : l);
}

function writePersistentNumber(key: string, val: number): void {
  if (typeof window === "undefined") return;
  const str = String(val);
  try {
    sessionStorage.setItem(key, str);
  } catch {
    // ignore
  }
  try {
    localStorage.setItem(key, str);
  } catch {
    // ignore
  }
  void idbSet(key, str);
}

function getExpectedAdminAge(): number {
  return new Date().getFullYear() - ADMIN_BIRTH_YEAR;
}

function isAdminIdentity(name: string, age: number): boolean {
  return (
    safeEqual(name.trim().toLowerCase(), ADMIN_NAME.toLowerCase()) &&
    age === getExpectedAdminAge()
  );
}

function verifyAdminPasscode(enteredCode: string): boolean {
  const clean = sanitizeText(enteredCode, 32);
  if (!clean) return false;
  const expected = ADMIN_PASSCODE_ENV.trim() || String(ADMIN_BIRTH_YEAR);
  return safeEqual(clean, expected);
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = GIST_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
}

async function fetchGistBundle(): Promise<{
  ok: boolean;
  files?: Record<string, { content?: string }>;
  serverTimeMs: number;
}> {
  if (!GIST_ID || !GITHUB_TOKEN || !GIST_API_URL) {
    return { ok: false, serverTimeMs: Date.now() };
  }
  const res = await fetchWithTimeout(GIST_API_URL, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "RabbitTV-App",
    },
    cache: "no-store",
  });
  const dateHeader = res.headers.get("date");
  const parsedServerMs = dateHeader ? Date.parse(dateHeader) : NaN;
  const serverTimeMs = !isNaN(parsedServerMs) ? parsedServerMs : Date.now();
  if (!res.ok) return { ok: false, serverTimeMs };
  const data = await res.json();
  return { ok: true, files: data?.files || {}, serverTimeMs };
}

async function patchGistFiles(
  files: Record<string, { content: string }>
): Promise<boolean> {
  if (!GIST_ID || !GITHUB_TOKEN || !GIST_API_URL) return false;
  try {
    const res = await fetchWithTimeout(GIST_API_URL, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "RabbitTV-App",
      },
      body: JSON.stringify({ files }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Fail-closed hardened 7-Day Trial validator & remote registry writer.
 * Blocks reinstall / clear-data / clock-rollback / multi-account-same-device bypasses.
 */
async function verifyAndClaimHardenedTrial(
  name: string,
  age: number,
  deviceId: string,
  hwFingerprint: string
): Promise<{
  allowed: boolean;
  serverNowMs?: number;
  errorMsg?: string;
}> {
  // 1. Check all local vaults (localStorage + IndexedDB)
  const localUsed =
    localStorage.getItem(TRIAL_USED_LOCAL_KEY) === "true" ||
    localStorage.getItem(TRIAL_FP_LOCAL_KEY) === hwFingerprint;
  const idbUsed = (await idbGet(TRIAL_USED_LOCAL_KEY)) === "true";
  if (localUsed || idbUsed) {
    return {
      allowed: false,
      errorMsg:
        "⚠️ A 7-day free trial has already been used on this device and cannot be reset or reclaimed.",
    };
  }

  // 2. Require online verification (fail-closed — Airplane Mode cannot bypass trial checks)
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return {
      allowed: false,
      errorMsg:
        "📡 An active internet connection is required to verify and start your 7-day trial.",
    };
  }

  try {
    const bundle = await fetchGistBundle();
    if (!bundle.ok || !bundle.files) {
      return {
        allowed: false,
        errorMsg:
          "⚠️ Could not reach the activation server to verify trial eligibility. Please check your connection and try again.",
      };
    }

    // 3. Anti-clock-tampering check (> 15 min drift from GitHub server clock blocks bypass)
    const clockDriftMs = Math.abs(Date.now() - bundle.serverTimeMs);
    if (clockDriftMs > 15 * 60 * 1000) {
      return {
        allowed: false,
        errorMsg:
          "🕒 Your device date/time appears out of sync. Enable Automatic Date & Time in device settings to start a trial.",
      };
    }

    // 4. Remote admin pause switch (`admin_config.json`)
    const rawConfig = bundle.files["admin_config.json"]?.content;
    if (rawConfig) {
      try {
        const cfg = JSON.parse(rawConfig);
        if (cfg && cfg.allowTrials === false) {
          return {
            allowed: false,
            errorMsg:
              "⚠️ 7-Day Free Trials are currently paused by the administrator. Tap 'Message Admin for Code' below to request full access.",
          };
        }
      } catch {
        // ignore malformed config
      }
    }

    // 5. Remote device & identity trial registry (`trial_devices.json`)
    const profileHash = (
      await sha256Hex(`${name.trim().toLowerCase()}::${age}`)
    ).slice(0, 24);

    let registry: TrialRegistryEntry[] = [];
    const rawRegistry = bundle.files["trial_devices.json"]?.content;
    if (rawRegistry) {
      try {
        const parsed = JSON.parse(rawRegistry);
        if (Array.isArray(parsed)) registry = parsed;
      } catch {
        registry = [];
      }
    }

    const existing = registry.find(
      (entry) =>
        entry &&
        (entry.hwFingerprint === hwFingerprint ||
          entry.deviceId === deviceId ||
          entry.profileHash === profileHash)
    );

    if (existing) {
      // Mirror lock locally so repeated attempts fail instantly
      localStorage.setItem(TRIAL_USED_LOCAL_KEY, "true");
      localStorage.setItem(TRIAL_FP_LOCAL_KEY, hwFingerprint);
      void idbSet(TRIAL_USED_LOCAL_KEY, "true");
      void idbSet(TRIAL_FP_LOCAL_KEY, hwFingerprint);

      return {
        allowed: false,
        errorMsg:
          "⚠️ This device or profile already redeemed its one-time 7-day trial. Reinstalling does not reset trials — request a lifetime key below.",
      };
    }

    // 6. Register device remotely BEFORE unlocking locally (must confirm PATCH succeeded)
    const entry: TrialRegistryEntry = {
      hwFingerprint,
      deviceId,
      profileHash,
      name,
      age,
      startedAt: bundle.serverTimeMs,
      expiresAt: bundle.serverTimeMs + TRIAL_DURATION_MS,
      claimedIso: new Date(bundle.serverTimeMs).toISOString(),
    };
    const nextRegistry = [entry, ...registry].slice(0, 1500);
    const saved = await patchGistFiles({
      "trial_devices.json": {
        content: JSON.stringify(nextRegistry, null, 2),
      },
    });

    if (!saved) {
      return {
        allowed: false,
        errorMsg:
          "⚠️ Could not register your device trial on the server. Please retry in a moment.",
      };
    }

    return { allowed: true, serverNowMs: bundle.serverTimeMs };
  } catch (err) {
    console.error("Hardened trial check failed:", err);
    return {
      allowed: false,
      errorMsg:
        "⚠️ Network timeout while verifying trial eligibility. Please check your connection.",
    };
  }
}

/**
 * Verifies and atomically consumes a single-use unlock key from `keys.json` on Gist.
 * Requires PATCH confirmation so keys cannot be reused by dropping connection mid-flight.
 */
async function verifyUnlockCodeWithGitHub(
  name: string,
  age: number,
  securityKey: string,
  deviceId: string,
  hwFingerprint: string
): Promise<{ valid: boolean; errorMsg?: string }> {
  const cleanKey = sanitizeText(securityKey, 32);
  if (!cleanKey) {
    return { valid: false, errorMsg: "⚠️ Please enter an unlock code." };
  }
  if (!GIST_ID || !GITHUB_TOKEN || !GIST_API_URL) {
    return {
      valid: false,
      errorMsg: "⚠️ Verification service unavailable. Check connection.",
    };
  }

  try {
    const bundle = await fetchGistBundle();
    if (!bundle.ok || !bundle.files) {
      return {
        valid: false,
        errorMsg: "⚠️ Could not reach verification server. Try again.",
      };
    }

    const rawContent = bundle.files["keys.json"]?.content;
    if (!rawContent) {
      return { valid: false, errorMsg: "⚠️ Invalid Passcode." };
    }

    const keysList = JSON.parse(rawContent);
    if (!Array.isArray(keysList)) {
      return { valid: false, errorMsg: "⚠️ Invalid Passcode." };
    }

    const matchedIndex = keysList.findIndex((item: any) => {
      if (typeof item === "object" && item !== null) {
        return safeEqual(String(item.key).trim(), cleanKey) && item.active === true;
      }
      return safeEqual(String(item).trim(), cleanKey);
    });

    if (matchedIndex === -1) {
      const alreadyUsed = keysList.some(
        (item: any) =>
          typeof item === "object" &&
          item !== null &&
          safeEqual(String(item.key).trim(), cleanKey) &&
          item.active === false
      );
      if (alreadyUsed) {
        return {
          valid: false,
          errorMsg:
            "⚠️ This unlock key has already been redeemed and cannot be reused.",
        };
      }
      return {
        valid: false,
        errorMsg: "⚠️ Invalid Passcode for this name and age.",
      };
    }

    const matchedItem = keysList[matchedIndex];

    // Strict owner Name & Age binding check
    if (
      typeof matchedItem === "object" &&
      matchedItem !== null &&
      typeof matchedItem.owner === "string"
    ) {
      const ownerStr = matchedItem.owner.trim();
      const isGenericOwner =
        !ownerStr ||
        ownerStr === "Legacy" ||
        ownerStr === "Unassigned" ||
        ownerStr === "Admin Recycled";

      if (!isGenericOwner) {
        const ownerMatch = ownerStr.match(/^(.*?)\s*\((\d+)\)$/);
        if (ownerMatch) {
          const expectedName = ownerMatch[1].trim().toLowerCase();
          const expectedAge = parseInt(ownerMatch[2], 10);
          const enteredNameLower = name.trim().toLowerCase();

          const nameMatches =
            expectedName === enteredNameLower ||
            expectedName.includes(enteredNameLower) ||
            enteredNameLower.includes(expectedName);
          const ageMatches = !isNaN(expectedAge) && expectedAge === age;

          if (!nameMatches || !ageMatches) {
            return {
              valid: false,
              errorMsg:
                "⚠️ This key is registered to a different Name or Age. Enter the exact Name and Age given to Rabbit.",
            };
          }
        }
      }
    }

    // Consume key atomically & bind device fingerprint
    if (typeof matchedItem === "object" && matchedItem !== null) {
      keysList[matchedIndex] = {
        ...matchedItem,
        active: false,
        usedBy: `${name} (Age: ${age})`,
        deviceId,
        hwFingerprint,
        claimedAt: new Date(bundle.serverTimeMs).toISOString(),
      };
    } else {
      keysList.splice(matchedIndex, 1);
    }

    const patchOk = await patchGistFiles({
      "keys.json": {
        content: JSON.stringify(keysList, null, 2),
      },
    });

    if (!patchOk) {
      return {
        valid: false,
        errorMsg:
          "⚠️ Could not finalize key redemption on server. Please try again with a stable connection.",
      };
    }

    return { valid: true };
  } catch (error) {
    console.error("Failed to verify and consume key with Gist:", error);
    return {
      valid: false,
      errorMsg: "⚠️ Network error while verifying key. Please try again.",
    };
  }
}

// ——— 2-Way Activation Chat Storage Helpers (ETag-Cached & Serialized via gist-client) ———

function normalizeActivationThread(raw: any): ActivationRequestRecord | null {
  if (!raw || typeof raw !== "object" || !raw.id) return null;
  const requestedAt =
    typeof raw.requestedAt === "string" && raw.requestedAt
      ? raw.requestedAt
      : new Date().toISOString();
  const baseNote = sanitizeText(String(raw.note || ""), 220);

  let messages: ActivationChatMessage[] = Array.isArray(raw.messages)
    ? raw.messages
        .filter((m: any) => m && typeof m === "object" && typeof m.text === "string")
        .map((m: any) => ({
          id: String(m.id || generateSecureId("msg", 4)),
          sender: m.sender === "admin" ? "admin" : "user",
          text: sanitizeText(m.text, 280),
          sentAt:
            typeof m.sentAt === "string" && m.sentAt ? m.sentAt : requestedAt,
          deliveredKey:
            typeof m.deliveredKey === "string" && m.deliveredKey.trim()
              ? sanitizeText(m.deliveredKey, 32)
              : undefined,
        }))
        .slice(-MAX_CHAT_MESSAGES_PER_THREAD)
    : [];

  // Upgrade legacy single-note requests into a clean chat thread seamlessly
  if (messages.length === 0 && baseNote) {
    messages = [
      {
        id: `${raw.id}-init`,
        sender: "user",
        text: baseNote,
        sentAt: requestedAt,
      },
    ];
  }

  return {
    id: String(raw.id),
    priority: "HIGH",
    name: sanitizeText(String(raw.name || "Guest"), 30) || "Guest",
    age: Number(raw.age) || 0,
    deviceId: sanitizeText(String(raw.deviceId || ""), 48),
    hwFingerprint: sanitizeText(String(raw.hwFingerprint || ""), 32),
    note: baseNote || messages[messages.length - 1]?.text || "",
    requestedAt,
    updatedAt:
      typeof raw.updatedAt === "string" && raw.updatedAt
        ? raw.updatedAt
        : messages[messages.length - 1]?.sentAt || requestedAt,
    seenByAdmin: Boolean(raw.seenByAdmin),
    unreadByAdmin:
      typeof raw.unreadByAdmin === "boolean"
        ? raw.unreadByAdmin
        : !raw.seenByAdmin,
    closed: Boolean(raw.closed),
    messages,
  };
}

async function fetchActivationThreads(
  options?: { force?: boolean; maxAgeMs?: number }
): Promise<ActivationRequestRecord[]> {
  if (!isGistConfigured()) return [];
  const raw = await readGistJsonFile<unknown[]>("activation_requests.json", [], {
    force: options?.force ?? false,
    maxAgeMs: options?.maxAgeMs ?? 5000,
    timeoutMs: GIST_TIMEOUT_MS,
  });
  if (!Array.isArray(raw)) return [];
  return raw
    .map(normalizeActivationThread)
    .filter((r): r is ActivationRequestRecord => Boolean(r));
}

function getLatestUserMessage(
  thread: ActivationRequestRecord
): ActivationChatMessage | null {
  const msgs = thread.messages || [];
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].sender === "user") return msgs[i];
  }
  return null;
}

/**
 * Customer sends a live chat message from the Activation Modal ONLY to Admin.
 * Appends to their device-isolated thread so Admin replies route back exclusively
 * to this user's activation window.
 */
async function sendUserActivationChatMessage(
  name: string,
  age: number,
  messageText: string,
  deviceId: string,
  hwFingerprint: string
): Promise<{ ok: boolean; thread?: ActivationRequestRecord; errorMsg?: string }> {
  if (!isGistConfigured()) {
    return {
      ok: false,
      errorMsg:
        "⚠️ Direct admin chat is offline. Please use WhatsApp or Text below.",
    };
  }

  const cleanText = sanitizeText(messageText, 240);
  if (!cleanText) {
    return { ok: false, errorMsg: "⚠️ Type a message before sending." };
  }

  return runSerializedGistTransaction(async () => {
    try {
      const existing = await fetchActivationThreads({ force: true });
      const nowIso = new Date().toISOString();
      const shortFp = hwFingerprint.slice(0, 12);

      const newMsg: ActivationChatMessage = {
        id: generateSecureId("umsg", 5),
        sender: "user",
        text: cleanText,
        sentAt: nowIso,
      };

      const existingIdx = existing.findIndex(
        (t) =>
          (t.deviceId && t.deviceId === deviceId) ||
          (shortFp && t.hwFingerprint && t.hwFingerprint === shortFp)
      );

      let updatedThread: ActivationRequestRecord;
      let nextList: ActivationRequestRecord[];

      if (existingIdx !== -1) {
        const prev = existing[existingIdx];
        const prevMsgs = Array.isArray(prev.messages) ? prev.messages : [];
        updatedThread = {
          ...prev,
          name,
          age,
          deviceId,
          hwFingerprint: shortFp || prev.hwFingerprint,
          note: cleanText,
          updatedAt: nowIso,
          seenByAdmin: false,
          unreadByAdmin: true,
          closed: false,
          messages: [...prevMsgs, newMsg].slice(-MAX_CHAT_MESSAGES_PER_THREAD),
        };
        nextList = [
          updatedThread,
          ...existing.filter((_, i) => i !== existingIdx),
        ].slice(0, MAX_CHAT_THREADS);
      } else {
        updatedThread = {
          id: generateSecureId("req", 5),
          priority: "HIGH",
          name,
          age,
          deviceId,
          hwFingerprint: shortFp,
          note: cleanText,
          requestedAt: nowIso,
          updatedAt: nowIso,
          seenByAdmin: false,
          unreadByAdmin: true,
          closed: false,
          messages: [newMsg],
        };
        nextList = [updatedThread, ...existing].slice(0, MAX_CHAT_THREADS);
      }

      const saved = await patchGistFilesSerialized({
        "activation_requests.json": {
          content: JSON.stringify(nextList, null, 2),
        },
      });

      if (!saved) {
        return {
          ok: false,
          errorMsg:
            "⚠️ Could not deliver message right now. Retry or use WhatsApp/Text.",
        };
      }

      // Notify secondary telemetry bridge only on brand-new threads
      if (existingIdx === -1) {
        try {
          void sendPermanentActivationAlert(
            `LIVE ACTIVATION CHAT: ${name} (Age ${age}) - ${cleanText}`
          );
        } catch {
          // ignore
        }
      }

      return { ok: true, thread: updatedThread };
    } catch {
      return {
        ok: false,
        errorMsg: "⚠️ Network error while sending message. Try WhatsApp/Text.",
      };
    }
  });
}

/**
 * Admin replies straight back to a specific user's Activation Modal chat window.
 * Optionally attaches a freshly generated key (`deliveredKey`) and commits it
 * atomically into `keys.json` in the exact same Gist PATCH!
 */
async function sendAdminActivationReply(params: {
  threadId: string;
  replyText: string;
  generateKeyForUser?: boolean;
}): Promise<{
  ok: boolean;
  thread?: ActivationRequestRecord;
  generatedKey?: string;
  errorMsg?: string;
}> {
  if (!isGistConfigured()) {
    return { ok: false, errorMsg: "Gist credentials unavailable." };
  }

  return runSerializedGistTransaction(async () => {
    try {
      const existing = await fetchActivationThreads({ force: true });
      const idx = existing.findIndex((t) => t.id === params.threadId);
      if (idx === -1) {
        return { ok: false, errorMsg: "Chat thread no longer exists." };
      }

      const target = existing[idx];
      const nowIso = new Date().toISOString();
      const filesToPatch: Record<string, { content: string }> = {};
      let createdKey: string | undefined;

      if (params.generateKeyForUser) {
        const randomEntropy =
          typeof window !== "undefined" && window.crypto?.getRandomValues
            ? window.crypto.getRandomValues(new Uint32Array(1))[0]
            : Math.floor(Math.random() * 1_000_000);
        const rawKeyStr = `${target.name.trim().toLowerCase()}-${target.age}-${Date.now()}-${randomEntropy}`;
        createdKey = Math.abs(
          rawKeyStr
            .split("")
            .reduce((acc, ch) => (acc << 5) - acc + ch.charCodeAt(0), 0)
        ).toString();

        const rawKeys = await readGistJsonFile<any[]>("keys.json", [], {
          force: true,
        });
        const keysList = Array.isArray(rawKeys) ? [...rawKeys] : [];
        keysList.push({
          key: createdKey,
          active: true,
          owner: `${target.name.trim()} (${target.age})`,
          createdAt: nowIso,
        });
        filesToPatch["keys.json"] = {
          content: JSON.stringify(keysList, null, 2),
        };
      }

      const cleanReply =
        sanitizeText(params.replyText, 260) ||
        (createdKey
          ? `Here is your lifetime unlock key for ${target.name} (Age ${target.age}): ${createdKey}. Tap "Fill Key" below and hit Enter!`
          : "");

      if (!cleanReply) {
        return { ok: false, errorMsg: "Reply cannot be empty." };
      }

      const adminMsg: ActivationChatMessage = {
        id: generateSecureId("amsg", 5),
        sender: "admin",
        text: cleanReply,
        sentAt: nowIso,
        deliveredKey: createdKey,
      };

      const prevMsgs = Array.isArray(target.messages) ? target.messages : [];
      const updatedThread: ActivationRequestRecord = {
        ...target,
        updatedAt: nowIso,
        seenByAdmin: true,
        unreadByAdmin: false,
        closed: false,
        messages: [...prevMsgs, adminMsg].slice(-MAX_CHAT_MESSAGES_PER_THREAD),
      };

      const nextList = [
        updatedThread,
        ...existing.filter((_, i) => i !== idx),
      ].slice(0, MAX_CHAT_THREADS);

      filesToPatch["activation_requests.json"] = {
        content: JSON.stringify(nextList, null, 2),
      };

      const saved = await patchGistFilesSerialized(filesToPatch);
      if (!saved) {
        return { ok: false, errorMsg: "Failed to push reply to Gist." };
      }

      return { ok: true, thread: updatedThread, generatedKey: createdKey };
    } catch {
      return { ok: false, errorMsg: "Network error sending reply." };
    }
  });
}

async function closeAdminActivationThread(threadId: string): Promise<boolean> {
  if (!isGistConfigured()) return false;
  return runSerializedGistTransaction(async () => {
    try {
      const existing = await fetchActivationThreads({ force: true });
      const updated = existing.map((t) =>
        t.id === threadId
          ? { ...t, seenByAdmin: true, unreadByAdmin: false, closed: true }
          : t
      );
      return await patchGistFilesSerialized({
        "activation_requests.json": {
          content: JSON.stringify(updated, null, 2),
        },
      });
    } catch {
      return false;
    }
  });
}

// ——— Admin Custom Notification Sound ("Soviet Power Supreme.mp3") & Phone Alert Engine ———

let sharedAdminAlertAudio: HTMLAudioElement | null = null;
let audioUnlockListenerAdded = false;

function ensureAdminAlertAudio(): HTMLAudioElement | null {
  if (typeof window === "undefined" || typeof Audio === "undefined") {
    return null;
  }
  if (!sharedAdminAlertAudio) {
    const audio = new Audio(ADMIN_ALERT_SOUND_URL);
    audio.preload = "auto";
    audio.volume = 1.0;
    audio.crossOrigin = "anonymous";
    sharedAdminAlertAudio = audio;
  }
  return sharedAdminAlertAudio;
}

/** Unlocks HTMLAudioElement once on first Admin tap so background/fullscreen alerts play reliably */
function installAdminAudioAutoUnlock(): void {
  if (typeof window === "undefined" || audioUnlockListenerAdded) return;
  audioUnlockListenerAdded = true;

  const unlock = () => {
    const audio = ensureAdminAlertAudio();
    if (!audio) return;
    const prevVol = audio.volume;
    audio.volume = 0;
    const p = audio.play();
    if (p && typeof p.then === "function") {
      p.then(() => {
        audio.pause();
        audio.currentTime = 0;
        audio.volume = prevVol || 1.0;
      }).catch(() => {
        audio.volume = prevVol || 1.0;
      });
    }
    window.removeEventListener("pointerdown", unlock, true);
    window.removeEventListener("keydown", unlock, true);
  };

  window.addEventListener("pointerdown", unlock, { capture: true, passive: true });
  window.addEventListener("keydown", unlock, { capture: true, passive: true });
}

/** Fallback synthesized chime if device is offline or blocks MP3 playback */
function playAdminHighAlertChimeFallback(): void {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx =
      window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    [880, 1174.66, 1318.5].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now + idx * 0.14);
      gain.gain.setValueAtTime(0.18, now + idx * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.14 + 0.24);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.14);
      osc.stop(now + idx * 0.14 + 0.26);
    });
    window.setTimeout(() => {
      void ctx.close().catch(() => {});
    }, 950);
  } catch {
    // ignore
  }
}

/** Plays the user's custom "Soviet Power Supreme.mp3" + vibration pattern */
function playAdminSovietAlertSound(): void {
  if (typeof window === "undefined") return;
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate([260, 90, 260, 90, 420]);
    }
  } catch {
    // ignore unsupported vibration
  }

  try {
    const audio = ensureAdminAlertAudio();
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      audio.volume = 1.0;
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {
          playAdminHighAlertChimeFallback();
        });
      }
      return;
    }
  } catch {
    // fall through
  }
  playAdminHighAlertChimeFallback();
}

/** Soft gentle ping for the customer when Admin replies inside their Activation Chat */
function playCustomerReplyPing(): void {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx =
      window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(660, now);
    osc.frequency.exponentialRampToValueAtTime(990, now + 0.14);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.22);
    window.setTimeout(() => {
      void ctx.close().catch(() => {});
    }, 500);
  } catch {
    // ignore
  }
}

let capacitorChannelInitialized = false;

/**
 * Triggers a native Android / OS notification (via @capacitor/local-notifications
 * when bundled, or Web Notification API fallback) so Admin's phone alerts even
 * when screen-locked or while another app is foregrounded.
 */
async function triggerAdminPhoneNotification(
  title: string,
  body: string
): Promise<void> {
  if (typeof window === "undefined") return;

  // 1. Try Capacitor LocalNotifications (Native Android notification tray & lock screen)
  if ((window as any).Capacitor) {
    try {
      const mod = await import(
        /* @vite-ignore */ "@capacitor/local-notifications"
      );
      const LocalNotifications = mod?.LocalNotifications;
      if (LocalNotifications) {
        if (!capacitorChannelInitialized && LocalNotifications.createChannel) {
          capacitorChannelInitialized = true;
          await LocalNotifications.createChannel({
            id: "rabtv_admin_activation_high",
            name: "RABBiT TV Activation Requests",
            description: "High-priority activation chat alerts from new users",
            importance: 5,
            visibility: 1,
            vibration: true,
            sound: "soviet_power_supreme.mp3",
          }).catch(() => {});
        }
        const perm = await LocalNotifications.checkPermissions().catch(() => ({
          display: "prompt",
        }));
        if (perm?.display === "granted") {
          await LocalNotifications.schedule({
            notifications: [
              {
                id: Math.floor(Date.now() % 2_000_000_000),
                title,
                body,
                channelId: "rabtv_admin_activation_high",
                sound: "soviet_power_supreme.mp3",
                schedule: { at: new Date(Date.now() + 250) },
                smallIcon: "ic_stat_icon_config_sample",
              },
            ],
          });
          return;
        }
      }
    } catch {
      // Plugin not installed in APK — fall through cleanly to Web Notification API
    }
  }

  // 2. Web Notification API fallback (Android Chrome / Desktop / Capacitor WebView)
  try {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, {
        body,
        tag: "rabtv-activation-chat",
        requireInteraction: true,
      });
    }
  } catch {
    // ignore if unsupported in WebView
  }
}

async function requestAdminPhoneNotificationPermission(): Promise<
  "granted" | "denied" | "unsupported"
> {
  if (typeof window === "undefined") return "unsupported";
  if ((window as any).Capacitor) {
    try {
      const mod = await import(
        /* @vite-ignore */ "@capacitor/local-notifications"
      );
      if (mod?.LocalNotifications?.requestPermissions) {
        const res = await mod.LocalNotifications.requestPermissions();
        if (res?.display === "granted") return "granted";
      }
    } catch {
      // fall through
    }
  }
  try {
    if ("Notification" in window && typeof Notification.requestPermission === "function") {
      const res = await Notification.requestPermission();
      return res === "granted" ? "granted" : "denied";
    }
  } catch {
    // ignore
  }
  return "unsupported";
}

/**
 * Reliable multi-platform launcher for WhatsApp and SMS that works across
 * Android Capacitor WebViews, mobile browsers, tablets, desktops, and TVs.
 */
function launchDirectContact(
  kind: "whatsapp" | "sms",
  message: string,
  fallbackOpenExternal: (url: string) => void
): void {
  if (typeof window === "undefined") return;
  const encoded = encodeURIComponent(message);

  if (kind === "sms") {
    const isApple = /iphone|ipad|ipod|macintosh/i.test(
      navigator.userAgent || ""
    );
    const smsUrl = isApple
      ? `sms:+${SUPPORT_PHONE_RAW}&body=${encoded}`
      : `sms:+${SUPPORT_PHONE_RAW}?body=${encoded}`;

    const a = document.createElement("a");
    a.href = smsUrl;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return;
  }

  const waWebUrl = `https://api.whatsapp.com/send?phone=${SUPPORT_PHONE_RAW}&text=${encoded}`;
  const isAndroid = /android/i.test(navigator.userAgent || "");

  if (isAndroid) {
    const a = document.createElement("a");
    a.href = waWebUrl;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return;
  }

  fallbackOpenExternal(waWebUrl);
}

/**
 * ALWAYS-ON-TOP ADMIN FLOATING ACTIVATION CHAT BUBBLE:
 * - Runs automatically in the background ONLY on verified Admin sessions.
 * - Portals into `document.fullscreenElement || document.body` at max CSS z-index
 *   so it floats ABOVE movies, Live TV players, modals, and fullscreen playback!
 * - Plays "Soviet Power Supreme.mp3" + phone vibration + OS notification whenever
 *   a customer sends a message from the Activation Modal.
 * - Lets Admin read, reply directly back to THAT user's window only, or 1-tap
 *   Generate & Send their bound lifetime unlock key without leaving the movie!
 */
function AdminActivationAlertToast({ appTheme }: { appTheme: AppTheme }) {
  const [threads, setThreads] = useState<ActivationRequestRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [minimized, setMinimized] = useState<boolean>(false);
  const [replyDraft, setReplyDraft] = useState<string>("");
  const [sendingReply, setSendingReply] = useState<boolean>(false);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [notifPermission, setNotifPermission] = useState<string>(() => {
    if (typeof window === "undefined") return "default";
    try {
      return "Notification" in window ? Notification.permission : "unsupported";
    } catch {
      return "unsupported";
    }
  });
  const [portalTarget, setPortalTarget] = useState<Element | null>(() =>
    typeof document !== "undefined"
      ? document.fullscreenElement || document.body
      : null
  );

  const chatEndRef = useRef<HTMLDivElement>(null);
  const tokens = useMemo(() => getModalThemeTokens(appTheme), [appTheme]);

  // Dynamically follow fullscreen changes so bubble floats OVER fullscreen movies!
  useEffect(() => {
    if (typeof document === "undefined") return;
    const syncPortalHost = () => {
      const fsEl =
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        null;
      setPortalTarget(fsEl || document.body);
    };
    syncPortalHost();
    document.addEventListener("fullscreenchange", syncPortalHost);
    document.addEventListener("webkitfullscreenchange", syncPortalHost);
    return () => {
      document.removeEventListener("fullscreenchange", syncPortalHost);
      document.removeEventListener("webkitfullscreenchange", syncPortalHost);
    };
  }, []);

  // Poll activation_requests.json via ETag-cached gist-client (0 rate-limit burn on 304!)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem("rabtv_is_admin") !== "true") return;
    if (!isGistConfigured()) return;

    installAdminAudioAutoUnlock();
    ensureAdminAlertAudio();

    let cancelled = false;
    let pollTimer: number | null = null;

    const getLastAlertedMap = (): Record<string, string> => {
      try {
        const raw = localStorage.getItem(ADMIN_LAST_ALERTED_MAP_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        return parsed && typeof parsed === "object" ? parsed : {};
      } catch {
        return {};
      }
    };

    const saveLastAlertedMap = (map: Record<string, string>) => {
      try {
        localStorage.setItem(ADMIN_LAST_ALERTED_MAP_KEY, JSON.stringify(map));
      } catch {
        // ignore
      }
    };

    const getLegacySeenSet = (): Set<string> => {
      try {
        const raw = localStorage.getItem(ADMIN_SEEN_REQS_KEY);
        const arr = raw ? JSON.parse(raw) : [];
        return new Set(Array.isArray(arr) ? arr : []);
      } catch {
        return new Set();
      }
    };

    const pollChats = async () => {
      if (cancelled) return;
      if (localStorage.getItem("rabtv_is_admin") !== "true") return;

      try {
        const all = await fetchActivationThreads({ maxAgeMs: 5000 });
        if (cancelled) return;

        const legacySeen = getLegacySeenSet();
        const activeOpen = all
          .filter((t) => {
            if (t.closed) return false;
            if (legacySeen.has(t.id) && !t.unreadByAdmin) return false;
            // Keep open if unread OR had activity in the last 30 mins
            const ageMs = Date.now() - Date.parse(t.updatedAt || t.requestedAt);
            return t.unreadByAdmin || ageMs < 30 * 60 * 1000;
          })
          .slice(0, 6);

        const alertedMap = getLastAlertedMap();
        let newestPingThread: ActivationRequestRecord | null = null;
        let newestPingMsg: ActivationChatMessage | null = null;

        for (const t of activeOpen) {
          const lastUserMsg = getLatestUserMessage(t);
          const pingId = lastUserMsg?.id || t.id;
          if (t.unreadByAdmin && alertedMap[t.id] !== pingId) {
            alertedMap[t.id] = pingId;
            if (!newestPingThread) {
              newestPingThread = t;
              newestPingMsg = lastUserMsg;
            }
          }
        }

        if (newestPingThread) {
          saveLastAlertedMap(alertedMap);
          playAdminSovietAlertSound();
          setMinimized(false);
          setSelectedId(newestPingThread.id);
          void triggerAdminPhoneNotification(
            `🚨 RABBiT TV Activation: ${newestPingThread.name} (Age ${newestPingThread.age})`,
            newestPingMsg?.text || newestPingThread.note || "New activation chat message!"
          );
        }

        setThreads(activeOpen);
        setSelectedId((prev) =>
          prev && activeOpen.some((t) => t.id === prev)
            ? prev
            : activeOpen[0]?.id || ""
        );
      } catch {
        // silent background poll failure
      } finally {
        if (!cancelled) {
          // 8s when foregrounded, 20s when phone screen locked / backgrounded (304 = 0 quota cost)
          const nextDelay = document.hidden ? 20_000 : 8_000;
          pollTimer = window.setTimeout(() => void pollChats(), nextDelay);
        }
      }
    };

    pollTimer = window.setTimeout(() => void pollChats(), 2500);
    const onVis = () => {
      if (!document.hidden && !cancelled) {
        if (pollTimer) window.clearTimeout(pollTimer);
        void pollChats();
      }
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelled = true;
      if (pollTimer) window.clearTimeout(pollTimer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const activeThread = useMemo(
    () => threads.find((t) => t.id === selectedId) || threads[0] || null,
    [threads, selectedId]
  );

  // Auto-scroll chat feed when new messages arrive
  useEffect(() => {
    if (!minimized && activeThread) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [minimized, activeThread?.messages?.length, activeThread?.id]);

  const handleSendReply = async (generateKey = false) => {
    if (!activeThread || sendingReply) return;
    if (!generateKey && !replyDraft.trim()) return;

    setSendingReply(true);
    setStatusBanner(null);
    try {
      const res = await sendAdminActivationReply({
        threadId: activeThread.id,
        replyText: replyDraft,
        generateKeyForUser: generateKey,
      });
      if (res.ok && res.thread) {
        setReplyDraft("");
        setThreads((prev) =>
          prev.map((t) => (t.id === res.thread!.id ? res.thread! : t))
        );
        setStatusBanner(
          res.generatedKey
            ? `🔑 Key [${res.generatedKey}] generated, activated & sent directly to ${activeThread.name}!`
            : `✓ Reply sent directly to ${activeThread.name}'s screen!`
        );
        window.setTimeout(() => setStatusBanner(null), 3500);
      } else {
        setStatusBanner(`⚠️ ${res.errorMsg || "Could not send reply."}`);
      }
    } finally {
      setSendingReply(false);
    }
  };

  const handleCloseThread = async (threadId: string) => {
    setThreads((prev) => prev.filter((t) => t.id !== threadId));
    try {
      const raw = localStorage.getItem(ADMIN_SEEN_REQS_KEY);
      const arr: string[] = raw ? JSON.parse(raw) : [];
      const next = Array.from(new Set([threadId, ...arr])).slice(0, 120);
      localStorage.setItem(ADMIN_SEEN_REQS_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
    await closeAdminActivationThread(threadId);
  };

  const handleCopyUser = (req: ActivationRequestRecord) => {
    const formatted = `${req.name} (${req.age})`;
    try {
      void navigator.clipboard?.writeText(formatted);
    } catch {
      // ignore
    }
    setCopiedId(req.id);
    window.setTimeout(() => setCopiedId(null), 2000);
  };

  const handleEnablePhoneNotifs = async () => {
    const res = await requestAdminPhoneNotificationPermission();
    setNotifPermission(res);
    if (res === "granted") {
      setStatusBanner("🔔 Phone lock-screen alerts enabled!");
      window.setTimeout(() => setStatusBanner(null), 2500);
    }
  };

  if (threads.length === 0 || !portalTarget) return null;

  const unreadCount = threads.filter((t) => t.unreadByAdmin).length;
  const isLowRam = getHardwareLimits().effectiveMode === "low";

  const bubbleUi = minimized ? (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setMinimized(false);
      }}
      style={{ zIndex: 2147483647 }}
      className="rabtv-vidsrc-protected fixed bottom-5 right-4 flex items-center gap-2 rounded-full border-2 border-amber-400 bg-zinc-950/95 px-4 py-2.5 text-xs font-black text-white shadow-[0_12px_36px_rgba(239,68,68,0.65)] hover:scale-105 transition cursor-pointer pointer-events-auto"
    >
      <span className="inline-flex h-2.5 w-2.5 rounded-full bg-red-500 animate-ping" />
      <span>🚨 Activation Chat ({threads.length})</span>
      {unreadCount > 0 && (
        <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-black text-white">
          {unreadCount} NEW
        </span>
      )}
    </button>
  ) : (
    <div
      role="dialog"
      aria-live="assertive"
      aria-label="Live Activation Support Bubble"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      style={{ zIndex: 2147483647 }}
      className="rabtv-vidsrc-protected fixed top-3 right-3 sm:top-4 sm:right-5 w-[min(94vw,410px)] pointer-events-auto"
    >
      <div
        className={`rounded-3xl border-2 border-red-400/90 p-3.5 text-white ${
          isLowRam ? "bg-zinc-950/98" : "bg-zinc-950/94 backdrop-blur-2xl"
        } shadow-[0_24px_75px_rgba(0,0,0,0.96),0_0_40px_rgba(239,68,68,0.55)] space-y-2.5`}
      >
        {/* Top Priority Header */}
        <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-red-500 animate-ping shrink-0" />
            <span className="text-[10.5px] font-black uppercase tracking-widest text-amber-300 truncate">
              🚨 LIVE ACTIVATION CHAT
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => playAdminSovietAlertSound()}
              title="Test Soviet Power Supreme Alert Sound"
              className="rounded-lg bg-white/10 hover:bg-white/20 px-2 py-1 text-[10px] font-bold text-amber-300 cursor-pointer"
            >
              🔊
            </button>
            {notifPermission === "default" && (
              <button
                type="button"
                onClick={() => void handleEnablePhoneNotifs()}
                title="Enable Phone Lock-Screen Notifications"
                className="rounded-lg bg-amber-500/25 hover:bg-amber-500/40 border border-amber-400/50 px-2 py-1 text-[10px] font-extrabold text-amber-200 cursor-pointer"
              >
                🔔 Alerts
              </button>
            )}
            <button
              type="button"
              onClick={() => setMinimized(true)}
              title="Minimize to Corner Bubble"
              className="h-7 w-7 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-black text-white cursor-pointer"
            >
              —
            </button>
          </div>
        </div>

        {/* Multi-user tabs if more than one customer is chatting */}
        {threads.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
            {threads.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedId(t.id)}
                className={`shrink-0 rounded-xl px-2.5 py-1 text-[10.5px] font-extrabold border transition cursor-pointer ${
                  activeThread?.id === t.id
                    ? "bg-red-600 border-amber-300 text-white"
                    : "bg-black/70 border-white/15 text-zinc-300 hover:bg-white/10"
                }`}
              >
                {t.unreadByAdmin ? "🔴 " : ""}
                {t.name} ({t.age})
              </button>
            ))}
          </div>
        )}

        {activeThread && (
          <>
            {/* Customer Identity Bar */}
            <div className="flex items-center justify-between gap-2 rounded-xl bg-black/70 border border-white/10 px-3 py-2">
              <div className="min-w-0">
                <p className="text-sm font-black text-white truncate">
                  {activeThread.name}{" "}
                  <span className={`font-extrabold ${tokens.labelAccent}`}>
                    (Age {activeThread.age})
                  </span>
                </p>
                <p className="text-[10px] font-mono text-zinc-400 truncate">
                  Device: {activeThread.deviceId.slice(0, 14)} • Private Thread
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleCopyUser(activeThread)}
                className="shrink-0 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 px-2 py-1 text-[10px] font-extrabold text-cyan-200 cursor-pointer"
              >
                {copiedId === activeThread.id ? "✓ Copied" : "📋 Copy"}
              </button>
            </div>

            {/* Live Chat Messages Feed */}
            <div className="max-h-48 overflow-y-auto space-y-2 rounded-2xl bg-black/80 border border-white/10 p-2.5 scrollbar-none">
              {(activeThread.messages || []).map((msg) => {
                const isAdminMsg = msg.sender === "admin";
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${
                      isAdminMsg ? "items-end" : "items-start"
                    }`}
                  >
                    <div
                      className={`max-w-[88%] rounded-2xl px-3 py-2 text-xs leading-snug break-words ${
                        isAdminMsg
                          ? "bg-emerald-950/90 border border-emerald-400/45 text-emerald-100"
                          : "bg-zinc-900 border border-amber-400/35 text-white"
                      }`}
                    >
                      <span className="block text-[9.5px] font-black uppercase tracking-wider opacity-75 mb-0.5">
                        {isAdminMsg ? "🐰 You (Admin)" : `👤 ${activeThread.name}`}
                      </span>
                      <p className="font-semibold">{msg.text}</p>
                      {msg.deliveredKey && (
                        <div className="mt-1.5 rounded-lg bg-black/75 border border-amber-400/50 px-2 py-1 font-mono text-[11px] font-black text-amber-300">
                          🔑 Key Sent: {msg.deliveredKey}
                        </div>
                      )}
                    </div>
                    <span className="text-[9px] text-zinc-500 mt-0.5 px-1">
                      {new Date(msg.sentAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>

            {statusBanner && (
              <p className="rounded-xl bg-emerald-950/85 border border-emerald-400/50 px-2.5 py-1.5 text-[11px] font-bold text-emerald-200 text-center">
                {statusBanner}
              </p>
            )}

            {/* Direct Reply Composer (Replies strictly to THIS user's Activation Modal!) */}
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                dir="ltr"
                maxLength={240}
                disabled={sendingReply}
                value={replyDraft}
                onChange={(e) => setReplyDraft(e.target.value)}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleSendReply(false);
                  }
                }}
                placeholder={`Reply directly to ${activeThread.name}...`}
                style={{
                  direction: "ltr",
                  unicodeBidi: "plaintext",
                  textAlign: "left",
                }}
                className="flex-1 min-w-0 rounded-xl border border-white/20 bg-black/85 px-3 py-2 text-xs font-bold text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <button
                type="button"
                disabled={sendingReply || !replyDraft.trim()}
                onClick={() => void handleSendReply(false)}
                className="shrink-0 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 px-3 py-2 text-xs font-black text-white cursor-pointer"
              >
                {sendingReply ? "..." : "Send"}
              </button>
            </div>

            {/* One-Tap Key Delivery & Mark Handled Row */}
            <div className="grid grid-cols-2 gap-2 pt-0.5">
              <button
                type="button"
                disabled={sendingReply}
                onClick={() => void handleSendReply(true)}
                className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:brightness-110 disabled:opacity-45 py-2 px-2.5 text-[11px] font-black text-slate-950 shadow cursor-pointer"
              >
                🔑 Generate &amp; Send Key
              </button>
              <button
                type="button"
                disabled={sendingReply}
                onClick={() => void handleCloseThread(activeThread.id)}
                className="rounded-xl bg-emerald-600/85 hover:bg-emerald-500 py-2 px-2.5 text-[11px] font-extrabold text-white cursor-pointer"
              >
                ✓ Mark Done &amp; Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );

  return createPortal(bubbleUi, portalTarget);
}

interface ActivationModalProps {
  isOpen: boolean;
  splashActive?: boolean;
  onAuthorized: () => void;
  appTheme: AppTheme;
  cardSize: CardSize;
  streamQuality: StreamQuality;
  helpfulMouse: boolean;
  allThemesList: { id: AppTheme; label: string }[];
  headerIconUrl: string;
  onThemeChange: (theme: AppTheme) => void;
  onSizeChange: (size: CardSize) => void;
  onMouseToggle: (enabled: boolean) => void;
  handleOpenExternal: (url: string, e?: React.MouseEvent) => void;
  getCardBackground: (theme: AppTheme) => string;
  getPrimaryAccentColor: (theme: AppTheme) => string;
  getPrimaryBgColor: (theme: AppTheme) => string;
}

export function ActivationModal({
  isOpen,
  splashActive = false,
  onAuthorized,
  appTheme,
  cardSize,
  streamQuality,
  helpfulMouse,
  allThemesList,
  headerIconUrl,
  onThemeChange,
  onSizeChange,
  onMouseToggle,
  handleOpenExternal,
  getCardBackground,
  getPrimaryAccentColor,
  getPrimaryBgColor,
}: ActivationModalProps) {
  const modalRootRef = useRef<HTMLDivElement>(null);
  const scrollBodyRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const verifyingRef = useRef<boolean>(false);

  // Respect SplashIntro cleanly (never flash or hijack focus/audio during SplashIntro)
  const [splashCleared, setSplashCleared] = useState<boolean>(false);
  const effectiveOpen = isOpen && !splashActive && splashCleared;

  useEffect(() => {
    if (!isOpen || splashActive) {
      setSplashCleared(false);
      return;
    }
    // Brief smooth handoff frame after SplashIntro unmounts
    const t = window.setTimeout(() => setSplashCleared(true), 140);
    return () => window.clearTimeout(t);
  }, [isOpen, splashActive]);

  // Core Credential States
  const [profileNameInput, setProfileNameInput] = useState("");
  const [userAgeInput, setUserAgeInput] = useState("");
  const [ageLockInput, setAgeLockInput] = useState("");
  const [showPinDigits, setShowPinDigits] = useState(false);
  const [passcodeInput, setPasscodeInput] = useState("");
  const [showPasscode, setShowPasscode] = useState(false);

  // Validation & Status States
  const [passcodeError, setPasscodeError] = useState(false);
  const [passcodeErrorMsg, setPasscodeErrorMsg] = useState(
    "⚠️ Invalid Passcode. Please try again."
  );
  const [nameErrorNotice, setNameErrorNotice] = useState(false);
  const [ageErrorNotice, setAgeErrorNotice] = useState(false);
  const [ageLockError, setAgeLockError] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  // Live 2-Way Activation Support Chat States (Isolated Strictly to This Device)
  const [showRequestAdminBox, setShowRequestAdminBox] = useState(false);
  const [requestNote, setRequestNote] = useState("");
  const [isSendingRequest, setIsSendingRequest] = useState(false);
  const [chatThread, setChatThread] = useState<ActivationRequestRecord | null>(
    null
  );
  const [isSyncingChat, setIsSyncingChat] = useState(false);
  const [requestStatusMsg, setRequestStatusMsg] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const lastAdminReplyIdRef = useRef<string>("");
  const userChatEndRef = useRef<HTMLDivElement>(null);

  // Extended Setup Features (Quality, Radio Station, Large Buttons, Autoplay, RAM Mode)
  const [selectedQuality, setSelectedQuality] = useState<StreamQuality>(
    () => streamQuality || "1080p"
  );
  const [ramMode, setRamModeLocal] = useState<"low" | "high">(() => {
    const saved = getRamMode();
    return saved === "high" ? "high" : "low";
  });
  const [largeButtonsLocal, setLargeButtonsLocal] = useState<boolean>(() =>
    getLargeButtons()
  );
  const [autoPlayLocal, setAutoPlayLocal] = useState<boolean>(() =>
    getAutoPlayNext()
  );

  // Curated Lobby Radio Station Presets
  const radioPresets = useMemo<RadioPreset[]>(() => {
    const defaultHeartbeat =
      getDefaultHeartbeatStationUrl() ||
      "https://stream.zeno.fm/0r0xa792kwzuv";
    return [
      {
        id: "heartbeat",
        label: "💓 Heartbeat 2000s",
        vibe: "Default Lobby",
        url: defaultHeartbeat,
      },
      {
        id: "hiphop",
        label: "🎤 Hip-Hop & R&B",
        vibe: "Urban Beats",
        url: "https://streams.ilovemusic.de/iloveradio3.mp3",
      },
      {
        id: "edm",
        label: "⚡ House & EDM",
        vibe: "Club Energy",
        url: "https://streams.ilovemusic.de/iloveradio2.mp3",
      },
      {
        id: "rock",
        label: "🎸 Classic Rock",
        vibe: "Anthems",
        url: "https://ice1.somafm.com/metal-128-mp3",
      },
      {
        id: "lofi",
        label: "🌙 Chill Lo-Fi",
        vibe: "Late Night",
        url: "https://ice1.somafm.com/groovesalad-128-mp3",
      },
      {
        id: "off",
        label: "🔇 Radio Off",
        vibe: "Silent Lobby",
        url: "",
      },
    ];
  }, []);

  const [selectedRadioId, setSelectedRadioId] = useState<string>(() => {
    if (typeof window === "undefined") return "heartbeat";
    const musicState = localStorage.getItem("rabtv_bg_music_state");
    if (musicState === "paused") return "off";
    return "heartbeat";
  });
  const [isPreviewingRadio, setIsPreviewingRadio] = useState(false);

  // Hardware Fingerprint & Device ID (computed once asynchronously)
  const [hwFingerprint, setHwFingerprint] = useState<string>("");
  const [deviceId, setDeviceId] = useState<string>("");

  // Hardened Brute-Force Lockout States (Exponential Backoff)
  const [failedStrikes, setFailedStrikes] = useState<number>(() =>
    readPersistentNumber(AUTH_STRIKES_KEY)
  );
  const [lockoutUntil, setLockoutUntil] = useState<number>(() =>
    readPersistentNumber(AUTH_LOCKOUT_KEY)
  );
  const [lockoutSecondsLeft, setLockoutSecondsLeft] = useState(0);

  const tokens = useMemo(() => getModalThemeTokens(appTheme), [appTheme]);
  const isLowRam = useMemo(
    () => getHardwareLimits().effectiveMode === "low",
    [effectiveOpen]
  );
  void getCardBackground;
  void getPrimaryAccentColor;

  // Precompute hardware fingerprint & hydrate IndexedDB lockout vault
  useEffect(() => {
    if (!effectiveOpen) return;
    let active = true;

    const initSecurityState = async () => {
      const devId = getOrCreateDeviceId();
      const fp = await computeHardwareFingerprint();
      const idbLock = Number((await idbGet(AUTH_LOCKOUT_KEY)) || 0);
      const idbStrikes = Number((await idbGet(AUTH_STRIKES_KEY)) || 0);

      if (!active) return;
      setDeviceId(devId);
      setHwFingerprint(fp);

      if (idbLock > lockoutUntil) setLockoutUntil(idbLock);
      if (idbStrikes > failedStrikes) setFailedStrikes(idbStrikes);

      // Update monotonic last-seen timestamp guard
      const prevSeen = Number(localStorage.getItem(AUTH_LAST_TICK_KEY) || 0);
      if (Date.now() > prevSeen) {
        try {
          localStorage.setItem(AUTH_LAST_TICK_KEY, String(Date.now()));
        } catch {
          // ignore
        }
      }
    };

    void initSecurityState();
    return () => {
      active = false;
    };
  }, [effectiveOpen]);

  // Countdown tick for exponential security lockout
  useEffect(() => {
    if (!lockoutUntil || Date.now() >= lockoutUntil) {
      setLockoutSecondsLeft(0);
      return;
    }
    const updateRemaining = () => {
      const rem = Math.max(0, Math.ceil((lockoutUntil - Date.now()) / 1000));
      setLockoutSecondsLeft(rem);
      if (rem <= 0 && typeof window !== "undefined") {
        sessionStorage.removeItem(AUTH_LOCKOUT_KEY);
        localStorage.removeItem(AUTH_LOCKOUT_KEY);
        void idbSet(AUTH_LOCKOUT_KEY, "0");
      }
    };
    updateRemaining();
    const interval = window.setInterval(updateRemaining, 1000);
    return () => window.clearInterval(interval);
  }, [lockoutUntil]);

  // Stop radio preview if modal closes
  useEffect(() => {
    if (!effectiveOpen && isPreviewingRadio) {
      bgAudio.pause();
      setIsPreviewingRadio(false);
    }
  }, [effectiveOpen, isPreviewingRadio]);

  /**
   * BULLETPROOF TV REMOTE / D-PAD FOCUS TRAP & BACKGROUND SCROLL LOCK:
   * 1) Locks documentElement & body scrolling so background never moves.
   * 2) Sets `inert` on background app siblings so remote focus can NEVER leak behind the modal.
   * 3) Snaps initial focus into the modal as soon as it opens after SplashIntro.
   * 4) Spatial ArrowUp/ArrowDown/ArrowLeft/ArrowRight navigation moves focus cleanly
   *    between every button & input inside the modal and auto-scrolls the focused item to center.
   */
  useEffect(() => {
    if (!effectiveOpen || typeof document === "undefined") return;

    const htmlEl = document.documentElement;
    const bodyEl = document.body;
    const prevHtmlOverflow = htmlEl.style.overflow;
    const prevBodyOverflow = bodyEl.style.overflow;
    const prevBodyOverscroll = bodyEl.style.overscrollBehavior;

    htmlEl.style.overflow = "hidden";
    bodyEl.style.overflow = "hidden";
    bodyEl.style.overscrollBehavior = "none";

    // Mark background siblings inert so Android TV / Fire TV D-pad stays strictly inside modal
    const markedInert: HTMLElement[] = [];
    const rootNode = modalRootRef.current;
    if (rootNode) {
      let current: HTMLElement | null = rootNode;
      while (current && current.parentElement && current.parentElement !== htmlEl) {
        const parent = current.parentElement;
        Array.from(parent.children).forEach((child) => {
          if (child !== current && child instanceof HTMLElement) {
            if (!child.hasAttribute("inert")) {
              child.setAttribute("inert", "");
              child.setAttribute("aria-hidden", "true");
              markedInert.push(child);
            }
          }
        });
        current = parent;
      }
    }

    const getFocusableElements = (): HTMLElement[] => {
      const container = modalRootRef.current;
      if (!container) return [];
      const selector =
        'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';
      return Array.from(container.querySelectorAll<HTMLElement>(selector)).filter(
        (el) => {
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        }
      );
    };

    // Snap initial focus onto the Name field (or first focusable item) right after open
    const focusTimer = window.setTimeout(() => {
      const first = nameInputRef.current || getFocusableElements()[0];
      if (first) {
        first.focus({ preventScroll: true });
        if (scrollBodyRef.current) {
          scrollBodyRef.current.scrollTop = 0;
        }
      }
    }, 60);

    // Pull focus back immediately if anything tries to focus outside the modal
    const handleFocusIn = (e: FocusEvent) => {
      const container = modalRootRef.current;
      if (!container) return;
      const target = e.target as Node | null;
      if (target && !container.contains(target)) {
        const items = getFocusableElements();
        if (items[0]) {
          items[0].focus({ preventScroll: true });
        }
      }
    };

    const focusAndCenter = (el: HTMLElement) => {
      el.focus({ preventScroll: true });
      el.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "nearest",
      });
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const container = modalRootRef.current;
      if (!container) return;

      // Block Escape / Browser Back from dismissing the mandatory activation gate
      if (e.key === "Escape" || e.key === "BrowserBack") {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      const items = getFocusableElements();
      if (items.length === 0) return;

      const active = document.activeElement as HTMLElement | null;
      const activeIdx = active ? items.indexOf(active) : -1;

      // Strict Tab focus trap
      if (e.key === "Tab") {
        e.preventDefault();
        if (activeIdx === -1) {
          focusAndCenter(items[0]);
          return;
        }
        const nextIdx = e.shiftKey
          ? (activeIdx - 1 + items.length) % items.length
          : (activeIdx + 1) % items.length;
        focusAndCenter(items[nextIdx]);
        return;
      }

      const isArrow =
        e.key === "ArrowDown" ||
        e.key === "ArrowUp" ||
        e.key === "ArrowLeft" ||
        e.key === "ArrowRight";

      if (!isArrow) return;

      const isTextField =
        active &&
        (active.tagName === "INPUT" || active.tagName === "TEXTAREA") &&
        (active as HTMLInputElement).type !== "checkbox" &&
        (active as HTMLInputElement).type !== "radio";

      // Allow Left/Right caret movement inside text inputs unless at edges
      if (isTextField && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        const inp = active as HTMLInputElement;
        const pos = inp.selectionStart;
        const len = inp.value.length;
        if (e.key === "ArrowLeft" && pos !== null && pos > 0) return;
        if (e.key === "ArrowRight" && pos !== null && pos < len) return;
      }

      // Always prevent D-pad arrows from scrolling the background page
      e.preventDefault();
      e.stopPropagation();

      if (!active || activeIdx === -1) {
        focusAndCenter(items[0]);
        return;
      }

      const curRect = active.getBoundingClientRect();
      const curCx = curRect.left + curRect.width / 2;
      const curCy = curRect.top + curRect.height / 2;

      let bestEl: HTMLElement | null = null;
      let bestScore = Infinity;

      for (const candidate of items) {
        if (candidate === active) continue;
        const r = candidate.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const dx = cx - curCx;
        const dy = cy - curCy;

        if (e.key === "ArrowDown") {
          if (dy <= 6) continue;
          const score = dy * 2.2 + Math.abs(dx) * 0.85;
          if (score < bestScore) {
            bestScore = score;
            bestEl = candidate;
          }
        } else if (e.key === "ArrowUp") {
          if (dy >= -6) continue;
          const score = Math.abs(dy) * 2.2 + Math.abs(dx) * 0.85;
          if (score < bestScore) {
            bestScore = score;
            bestEl = candidate;
          }
        } else if (e.key === "ArrowRight") {
          if (dx <= 6 || Math.abs(dy) > Math.max(curRect.height, r.height) * 0.85) {
            continue;
          }
          const score = dx + Math.abs(dy) * 3;
          if (score < bestScore) {
            bestScore = score;
            bestEl = candidate;
          }
        } else if (e.key === "ArrowLeft") {
          if (dx >= -6 || Math.abs(dy) > Math.max(curRect.height, r.height) * 0.85) {
            continue;
          }
          const score = Math.abs(dx) + Math.abs(dy) * 3;
          if (score < bestScore) {
            bestScore = score;
            bestEl = candidate;
          }
        }
      }

      // Fallback sequential step if spatial check finds no neighbor in direction
      if (!bestEl) {
        if (e.key === "ArrowDown" || e.key === "ArrowRight") {
          bestEl = items[Math.min(items.length - 1, activeIdx + 1)];
        } else {
          bestEl = items[Math.max(0, activeIdx - 1)];
        }
      }

      if (bestEl) {
        focusAndCenter(bestEl);
      }
    };

    document.addEventListener("focusin", handleFocusIn, true);
    window.addEventListener("keydown", handleKeyDown, true);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("focusin", handleFocusIn, true);
      window.removeEventListener("keydown", handleKeyDown, true);
      htmlEl.style.overflow = prevHtmlOverflow;
      bodyEl.style.overflow = prevBodyOverflow;
      bodyEl.style.overscrollBehavior = prevBodyOverscroll;
      markedInert.forEach((el) => {
        el.removeAttribute("inert");
        el.removeAttribute("aria-hidden");
      });
    };
  }, [effectiveOpen]);

  const handleRadioSelect = useCallback(
    (preset: RadioPreset) => {
      setSelectedRadioId(preset.id);
      if (typeof window !== "undefined") {
        if (!preset.url) {
          localStorage.setItem("rabtv_bg_music_state", "paused");
          bgAudio.pause();
          setIsPreviewingRadio(false);
        } else {
          localStorage.setItem("rabtv_radio_url", preset.url);
          localStorage.setItem("rabtv_bg_music_state", "playing");
          bgAudio.setStation(preset.url);
          if (isPreviewingRadio) {
            bgAudio.play();
          }
        }
      }
    },
    [isPreviewingRadio]
  );

  const handleToggleRadioPreview = () => {
    const active = radioPresets.find((r) => r.id === selectedRadioId);
    if (!active || !active.url) {
      bgAudio.pause();
      setIsPreviewingRadio(false);
      return;
    }
    if (isPreviewingRadio) {
      bgAudio.pause();
      setIsPreviewingRadio(false);
    } else {
      bgAudio.setStation(active.url);
      bgAudio.play();
      setIsPreviewingRadio(true);
    }
  };

  const handleRamModeSelect = (mode: "low" | "high") => {
    setRamModeLocal(mode);
    setRamMode(mode);
  };

  const handleLargeButtonsSelect = (enabled: boolean) => {
    setLargeButtonsLocal(enabled);
    setLargeButtons(enabled);
  };

  const handleAutoPlaySelect = (enabled: boolean) => {
    setAutoPlayLocal(enabled);
    setAutoPlayNext(enabled);
  };

  const registerFailedAttempt = (msg: string) => {
    const nextStrikes = failedStrikes + 1;
    setFailedStrikes(nextStrikes);
    writePersistentNumber(AUTH_STRIKES_KEY, nextStrikes);

    setPasscodeError(true);
    setAgeErrorNotice(false);
    setAgeLockError(false);
    setNameErrorNotice(false);
    setPasscodeInput("");

    // Exponential brute-force cooldown: 3 -> 30s, 5 -> 2m, 7 -> 10m, 10+ -> 30m
    let cooldownSec = 0;
    if (nextStrikes >= 10) cooldownSec = 1800;
    else if (nextStrikes >= 7) cooldownSec = 600;
    else if (nextStrikes >= 5) cooldownSec = 120;
    else if (nextStrikes >= 3) cooldownSec = 30;

    if (cooldownSec > 0) {
      const until = Date.now() + cooldownSec * 1000;
      setLockoutUntil(until);
      writePersistentNumber(AUTH_LOCKOUT_KEY, until);
      setPasscodeErrorMsg(
        `🚨 Too many failed attempts (${nextStrikes}). Security cooldown active for ${
          cooldownSec >= 60 ? `${Math.round(cooldownSec / 60)} min` : `${cooldownSec}s`
        }.`
      );
    } else {
      setPasscodeErrorMsg(msg);
    }
  };

  const applySelectedPreferences = async (
    finalName: string,
    parsedAge: number,
    ageLockCode: string,
    accessStatus: "permanent" | "trial",
    trialStartMs?: number,
    options?: { admin?: boolean; forceTheme?: AppTheme; forceSize?: CardSize }
  ) => {
    const devId = deviceId || getOrCreateDeviceId();
    const fp = hwFingerprint || (await computeHardwareFingerprint());

    localStorage.setItem(DISCLAIMER_ACCEPTED_KEY, "true");
    localStorage.setItem("rabtv_access_status", accessStatus);

    if (accessStatus === "trial" && trialStartMs) {
      localStorage.setItem("rabtv_trial_start_timestamp", String(trialStartMs));
      localStorage.setItem(TRIAL_USED_LOCAL_KEY, "true");
      localStorage.setItem(TRIAL_FP_LOCAL_KEY, fp);
      void idbSet(TRIAL_USED_LOCAL_KEY, "true");
      void idbSet(TRIAL_FP_LOCAL_KEY, fp);
    } else {
      localStorage.removeItem("rabtv_trial_start_timestamp");
    }

    // Write cryptographic integrity signature bound to device + hardware + status
    const sig = await sha256Hex(
      `rabtv-sig-v2::${devId}::${fp}::${finalName}::${accessStatus}::${trialStartMs || 0}`
    );
    localStorage.setItem(ACCESS_SIG_KEY, sig);
    void idbSet(ACCESS_SIG_KEY, sig);

    sessionStorage.setItem("rabtv_session_verified", "true");
    sessionStorage.removeItem(AUTH_LOCKOUT_KEY);
    localStorage.removeItem(AUTH_LOCKOUT_KEY);
    localStorage.removeItem(AUTH_STRIKES_KEY);
    void idbSet(AUTH_LOCKOUT_KEY, "0");
    void idbSet(AUTH_STRIKES_KEY, "0");

    await saveAgeLockPinSecure(ageLockCode);
    setRamMode(ramMode);
    setLargeButtons(largeButtonsLocal);
    setAutoPlayNext(autoPlayLocal);

    const chosenRadio = radioPresets.find((r) => r.id === selectedRadioId);
    if (chosenRadio) {
      if (!chosenRadio.url) {
        localStorage.setItem("rabtv_bg_music_state", "paused");
        bgAudio.pause();
      } else {
        localStorage.setItem("rabtv_radio_url", chosenRadio.url);
        localStorage.setItem("rabtv_bg_music_state", "playing");
        bgAudio.setStation(chosenRadio.url);
      }
    }

    if (options?.admin) {
      localStorage.setItem("rabtv_is_admin", "true");
    } else {
      localStorage.removeItem("rabtv_is_admin");
    }

    const themeToUse = options?.forceTheme ?? appTheme;
    const sizeToUse = options?.forceSize ?? cardSize;

    saveCardSize(sizeToUse);
    saveStreamQuality(selectedQuality);
    saveTheme(themeToUse);
    setHelpfulMouse(helpfulMouse);

    saveUserAge(parsedAge);
    localStorage.setItem("rabtv_profile_name", finalName);
    applyAllSettingsToDocument();

    setPasscodeError(false);
    setAgeErrorNotice(false);
    setAgeLockError(false);
    setNameErrorNotice(false);
    setIsPreviewingRadio(false);

    window.dispatchEvent(new Event("rabtv_settings_updated"));
    onAuthorized();
  };

  const handleFirstTimeAuthorize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (verifyingRef.current) return;

    if (lockoutSecondsLeft > 0) {
      setPasscodeError(true);
      setPasscodeErrorMsg(
        `⏳ Security cooldown active. Please wait ${lockoutSecondsLeft}s before trying again.`
      );
      return;
    }

    const cleanName = sanitizeText(profileNameInput, 25);
    if (!cleanName || cleanName.length < 2) {
      setNameErrorNotice(true);
      setAgeErrorNotice(false);
      setAgeLockError(false);
      setPasscodeError(false);
      return;
    }

    const trimmedAge = userAgeInput.trim();
    const parsedAge = parseInt(trimmedAge, 10);
    if (!trimmedAge || isNaN(parsedAge) || parsedAge < 1 || parsedAge > 120) {
      setAgeErrorNotice(true);
      setNameErrorNotice(false);
      setPasscodeError(false);
      setAgeLockError(false);
      return;
    }

    const ageLock = ageLockInput.trim();
    if (!isValidAgeLockPin(ageLock)) {
      setAgeLockError(true);
      setNameErrorNotice(false);
      setAgeErrorNotice(false);
      setPasscodeError(false);
      return;
    }

    const enteredCode = sanitizeText(passcodeInput, 32);

    verifyingRef.current = true;
    setIsVerifying(true);
    try {
      const devId = deviceId || getOrCreateDeviceId();
      const fp = hwFingerprint || (await computeHardwareFingerprint());

      // 1. Hardened Admin Authentication (Requires Admin Identity + Master Passcode)
      if (isAdminIdentity(cleanName, parsedAge)) {
        if (!verifyAdminPasscode(enteredCode)) {
          registerFailedAttempt(
            "⚠️ Admin login requires your Admin Passcode in the Unlock Key box."
          );
          return;
        }
        await applySelectedPreferences(
          ADMIN_NAME,
          parsedAge,
          ageLock,
          "permanent",
          undefined,
          {
            admin: true,
            forceTheme: "red",
            forceSize: "small",
          }
        );
        return;
      }

      if (!enteredCode) {
        registerFailedAttempt(
          "⚠️ Please enter your Lifetime Unlock Key or Trial Code (9654)."
        );
        return;
      }

      // 2. Hardened 7-Day Free Trial Flow (9654)
      if (safeEqual(enteredCode, TRIAL_CODE)) {
        const trialResult = await verifyAndClaimHardenedTrial(
          cleanName,
          parsedAge,
          devId,
          fp
        );
        if (!trialResult.allowed) {
          registerFailedAttempt(
            trialResult.errorMsg || "⚠️ Free trials are currently unavailable."
          );
          return;
        }

        await applySelectedPreferences(
          cleanName,
          parsedAge,
          ageLock,
          "trial",
          trialResult.serverNowMs || Date.now()
        );
        return;
      }

      // 3. Permanent Single-Use Gist Key Flow
      const verification = await verifyUnlockCodeWithGitHub(
        cleanName,
        parsedAge,
        enteredCode,
        devId,
        fp
      );
      if (verification.valid) {
        sendPermanentActivationAlert(cleanName);
        await applySelectedPreferences(
          cleanName,
          parsedAge,
          ageLock,
          "permanent"
        );
        return;
      }

      registerFailedAttempt(
        verification.errorMsg || "⚠️ Invalid Passcode for this name and age."
      );
    } finally {
      verifyingRef.current = false;
      setIsVerifying(false);
    }
  };

  // Sync ONLY this device's private Activation Chat thread with Admin (ETag 304 safe!)
  const syncMyActivationChat = useCallback(
    async (force = false) => {
      if (!effectiveOpen || !isGistConfigured()) return;
      const devId = deviceId || getOrCreateDeviceId();
      const shortFp = hwFingerprint ? hwFingerprint.slice(0, 12) : "";
      if (!devId && !shortFp) return;

      setIsSyncingChat(true);
      try {
        const all = await fetchActivationThreads({
          force,
          maxAgeMs: force ? 0 : 4000,
        });
        const mine =
          all.find(
            (t) =>
              (devId && t.deviceId === devId) ||
              (shortFp && t.hwFingerprint && t.hwFingerprint === shortFp)
          ) || null;

        if (mine) {
          const msgs = mine.messages || [];
          const latestAdminMsg = [...msgs]
            .reverse()
            .find((m) => m.sender === "admin");
          if (
            latestAdminMsg &&
            latestAdminMsg.id !== lastAdminReplyIdRef.current
          ) {
            if (lastAdminReplyIdRef.current !== "") {
              playCustomerReplyPing();
            }
            lastAdminReplyIdRef.current = latestAdminMsg.id;
          }
          setChatThread(mine);
        }
      } finally {
        setIsSyncingChat(false);
      }
    },
    [effectiveOpen, deviceId, hwFingerprint]
  );

  // Live poll every 6s while the customer has the Activation Chat drawer open
  useEffect(() => {
    if (!effectiveOpen || !showRequestAdminBox) return;
    void syncMyActivationChat(true);
    const interval = window.setInterval(() => {
      if (!document.hidden) {
        void syncMyActivationChat(false);
      }
    }, 6000);
    return () => window.clearInterval(interval);
  }, [effectiveOpen, showRequestAdminBox, syncMyActivationChat]);

  useEffect(() => {
    if (showRequestAdminBox && chatThread?.messages?.length) {
      userChatEndRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    }
  }, [showRequestAdminBox, chatThread?.messages?.length]);

  // Send a live 2-way chat message from this user's Activation Modal directly to Admin's floating bubble
  const handleSendAdminActivationRequest = async () => {
    const cleanName = sanitizeText(profileNameInput, 25);
    const parsedAge = parseInt(userAgeInput.trim(), 10);

    if (!cleanName || cleanName.length < 2) {
      setNameErrorNotice(true);
      setRequestStatusMsg({
        type: "err",
        text: "⚠️ Enter your Name above first so Rabbit knows who to issue the key to.",
      });
      nameInputRef.current?.focus();
      return;
    }

    if (isNaN(parsedAge) || parsedAge < 1 || parsedAge > 120) {
      setAgeErrorNotice(true);
      setRequestStatusMsg({
        type: "err",
        text: "⚠️ Enter your Age (1–120) above first so your key binds properly.",
      });
      return;
    }

    const msgToSend =
      requestNote.trim() ||
      (!chatThread
        ? `Hi Rabbit, requesting an activation key for ${cleanName} (Age ${parsedAge}).`
        : "");

    if (!msgToSend) {
      setRequestStatusMsg({
        type: "err",
        text: "⚠️ Type a message to Rabbit before sending.",
      });
      return;
    }

    const lastSent = Number(localStorage.getItem(REQUEST_COOLDOWN_KEY) || 0);
    const waitMs = CHAT_SEND_COOLDOWN_MS - (Date.now() - lastSent);
    if (waitMs > 0) {
      setRequestStatusMsg({
        type: "err",
        text: "⏳ Just a second before sending the next message...",
      });
      return;
    }

    setIsSendingRequest(true);
    setRequestStatusMsg(null);
    try {
      const devId = deviceId || getOrCreateDeviceId();
      const fp = hwFingerprint || (await computeHardwareFingerprint());
      const res = await sendUserActivationChatMessage(
        cleanName,
        parsedAge,
        msgToSend,
        devId,
        fp
      );
      if (res.ok && res.thread) {
        localStorage.setItem(REQUEST_COOLDOWN_KEY, String(Date.now()));
        setRequestNote("");
        setChatThread(res.thread);
        setRequestStatusMsg({
          type: "ok",
          text: "✓ Sent! Keep this window open — Rabbit's reply will appear right here.",
        });
        window.setTimeout(() => setRequestStatusMsg(null), 4000);
      } else {
        setRequestStatusMsg({
          type: "err",
          text:
            res.errorMsg || "⚠️ Could not send message. Try WhatsApp or Text.",
        });
      }
    } finally {
      setIsSendingRequest(false);
    }
  };

  const buildPreFilledContactMessage = () => {
    const cleanName = sanitizeText(profileNameInput, 25) || "[My Name]";
    const cleanAge = userAgeInput.trim() || "[My Age]";
    const devSnippet = deviceId ? ` | Device: ${deviceId.slice(0, 10)}` : "";
    return `Hi Rabbit, I'm requesting a RABBiT TV activation code. Name: ${cleanName}, Age: ${cleanAge}${devSnippet}`;
  };

  const handleCopySupportInfo = () => {
    const info = `Rabbit Support: ${SUPPORT_PHONE_DISPLAY} — ${buildPreFilledContactMessage()}`;
    try {
      void navigator.clipboard?.writeText(info);
      setCopyFeedback("✓ Copied number & request!");
    } catch {
      setCopyFeedback(`Text/WhatsApp: ${SUPPORT_PHONE_DISPLAY}`);
    }
    window.setTimeout(() => setCopyFeedback(null), 2600);
  };

  // When ActivationModal is closed, mount the zero-overhead Admin High-Alert Toast Watcher
  if (!effectiveOpen) {
    return !isOpen && !splashActive ? (
      <AdminActivationAlertToast appTheme={appTheme} />
    ) : null;
  }

  return (
    <div
      ref={modalRootRef}
      role="dialog"
      aria-modal="true"
      aria-label="RABBiT TV Activation & Setup"
      data-theme={appTheme}
      className={`rabtv-vidsrc-protected fixed inset-0 z-50 flex items-center justify-center bg-black/88 p-2.5 sm:p-5 ${isLowRam ? "" : "backdrop-blur-xl"} overflow-hidden`}
    >
      <style>{`
        :root, html[data-theme="violet"] { --rabtv-act-filter: hue-rotate(-78deg) saturate(1.12) brightness(1.02); }
        html[data-theme="red"] { --rabtv-act-filter: hue-rotate(0deg) saturate(1.08) brightness(1.0); }
        html[data-theme="midnight"] { --rabtv-act-filter: hue-rotate(-132deg) saturate(1.14) brightness(1.04); }
        html[data-theme="emerald"] { --rabtv-act-filter: hue-rotate(154deg) saturate(1.10) brightness(1.02); }
        html[data-theme="amber"] { --rabtv-act-filter: hue-rotate(28deg) saturate(1.14) brightness(1.04); }
        html[data-theme="cyan"] { --rabtv-act-filter: hue-rotate(-154deg) saturate(1.12) brightness(1.04); }

        .rabtv-act-shell {
          position: relative;
          overflow: hidden;
          box-sizing: border-box;
          padding: 16px 14px !important;
          background-color: #0c0a09;
          contain: layout paint;
        }
        @media (min-width: 640px) { .rabtv-act-shell { padding: 22px 20px !important; } }
        .rabtv-act-shell-9slice {
          position: absolute;
          inset: 0;
          box-sizing: border-box;
          border-style: solid;
          border-color: transparent;
          border-width: 24px 20px;
          border-image-source: url("${IMG_ACT_MODAL_FRAME}");
          border-image-slice: 12% 11% fill;
          border-image-repeat: stretch;
          filter: var(--rabtv-act-filter);
          pointer-events: none;
          z-index: 0;
        }
        .rabtv-act-btn {
          position: relative;
          overflow: hidden;
          background-color: #0c0a09;
          border: 0 !important;
          clip-path: polygon(9px 0%, calc(100% - 9px) 0%, 100% 9px, 100% calc(100% - 9px), calc(100% - 9px) 100%, 9px 100%, 0% calc(100% - 9px), 0% 9px);
          contain: layout paint;
          transition: transform 140ms ease, filter 140ms ease;
        }
        .rabtv-act-btn:hover:not(:disabled) { transform: scale(1.02); filter: brightness(1.09); }
        .rabtv-act-btn:active:not(:disabled) { transform: scale(0.97); }
        .rabtv-act-btn-art {
          position: absolute;
          inset: -2px;
          background-size: 100% 100%;
          pointer-events: none;
          z-index: 0;
        }
        .rabtv-act-btn-scrim {
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse 78% 72% at 50% 50%, rgba(12,10,9,0.36) 0%, rgba(12,10,9,0.14) 100%);
          pointer-events: none;
          z-index: 1;
        }
        .rabtv-act-btn-label {
          position: relative;
          z-index: 2;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          text-shadow: 0 1px 4px rgba(12,10,9,0.96);
        }
        .rabtv-act-focus:focus,
        .rabtv-act-focus:focus-visible {
          outline: 2px solid rgba(255, 255, 255, 0.92);
          outline-offset: 2px;
          transform: scale(1.015);
        }
        @media (max-height: 500px) {
          .rabtv-act-scroll {
            padding: 8px 10px !important;
          }
        }
      `}</style>

      <form
        onSubmit={handleFirstTimeAuthorize}
        className={`rabtv-act-shell relative w-full max-w-2xl rounded-[26px] text-white ${tokens.frameShadow} max-h-[94dvh] flex flex-col`}
      >
        <div className="rabtv-act-shell-9slice" aria-hidden="true" />

        <div
          ref={scrollBodyRef}
          className="rabtv-act-scroll relative z-10 p-2 sm:p-3 space-y-4 overflow-y-auto overflow-x-clip scrollbar-none max-h-[90dvh]"
        >
          {/* Vault Blast-Door Mascot Welcome Hero Banner */}
          <div className="relative overflow-hidden rounded-2xl border border-white/10 min-h-[168px] sm:min-h-[200px] p-3.5 sm:p-4 flex flex-col justify-between bg-[#0c0a09]">
            <div
              className="absolute inset-0 bg-cover bg-center opacity-92 pointer-events-none"
              style={{
                backgroundImage: `url(${IMG_ACT_BANNER})`,
                backgroundPosition: "center 35%",
              }}
              aria-hidden="true"
            />
            <div
              className="absolute inset-0 bg-gradient-to-b from-[#0c0a09]/84 via-[#0c0a09]/22 to-[#0c0a09]/92 pointer-events-none"
              aria-hidden="true"
            />

            <div className="relative z-10 flex items-center justify-between gap-2">
              <span className="rounded-full bg-black/80 border border-white/15 px-2.5 py-1 text-[9.5px] font-black uppercase tracking-widest text-cyan-300">
                🔐 Access Vault
              </span>
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-xl overflow-hidden border bg-black ${tokens.avatarBorder}`}
              >
                <img
                  src={headerIconUrl}
                  alt="RABBiT TV Logo"
                  className="h-full w-full object-cover"
                />
              </div>
            </div>

            <div className="relative z-10 pt-10 text-center">
              <h2 className="text-lg sm:text-2xl font-black uppercase tracking-tight text-amber-300 drop-shadow-[0_2px_8px_rgba(0,0,0,0.98)]">
                Welcome to RABBiT TV
              </h2>
              <p className="text-[11px] sm:text-xs font-bold text-zinc-200 max-w-lg mx-auto mt-1 leading-snug drop-shadow">
                Movies, series, and 280+ live TV channels — zero ads, zero monthly
                bills. Use your remote D-Pad (▲ ▼ ◀ ▶) or tap to set up.
              </p>
            </div>
          </div>

          {/* Hardened Trial Notice Banner */}
          <div className={`rounded-2xl border border-amber-400/35 bg-gradient-to-r from-amber-500/15 via-black/70 to-amber-500/15 p-2.5 sm:p-3 text-xs text-amber-200 shadow-inner text-center ${isLowRam ? "" : "backdrop-blur-md"}`}>
            <p>
              <strong>⏳ One-Time 7-Day Trial:</strong> Enter{" "}
              <strong className="text-white font-mono bg-black/70 px-1.5 py-0.5 rounded border border-amber-400/40">
                9654
              </strong>{" "}
              below (device-locked & server-verified), or enter your lifetime
              unlock key.
            </p>
          </div>

          {/* SECTION 1: Name & Age */}
          <div
            className={`grid grid-cols-1 sm:grid-cols-3 gap-3 border-t pt-3.5 ${tokens.sectionBorder}`}
          >
            <div className="sm:col-span-2 space-y-1">
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-200">
                Your Name{" "}
                <span className={`font-normal lowercase ${tokens.labelAccent}`}>
                  (bound to your key)
                </span>
              </label>
              <input
                ref={nameInputRef}
                type="text"
                dir="ltr"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="words"
                spellCheck={false}
                maxLength={25}
                value={profileNameInput}
                onChange={(e) => {
                  setProfileNameInput(e.target.value);
                  if (nameErrorNotice) setNameErrorNotice(false);
                }}
                placeholder="Enter Your Name"
                style={{
                  direction: "ltr",
                  unicodeBidi: "plaintext",
                  textAlign: "left",
                }}
                className={`rabtv-act-focus w-full rounded-xl border px-3.5 py-2.5 text-sm font-bold focus:outline-none transition ${tokens.inputClass}`}
              />
              {nameErrorNotice && (
                <p className="text-[11px] font-bold text-red-400">
                  ⚠️ Please enter your name (at least 2 characters).
                </p>
              )}
            </div>

            <div className="sm:col-span-1 space-y-1">
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-200">
                Your Age <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                dir="ltr"
                autoComplete="off"
                maxLength={3}
                value={userAgeInput}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "").slice(0, 3);
                  setUserAgeInput(digits);
                  if (ageErrorNotice) setAgeErrorNotice(false);
                }}
                placeholder="Age"
                style={{ direction: "ltr", unicodeBidi: "plaintext" }}
                className={`rabtv-act-focus w-full rounded-xl border px-3.5 py-2.5 text-center text-sm font-bold focus:outline-none transition ${tokens.inputClass}`}
              />
              {ageErrorNotice && (
                <p className="text-[11px] font-bold text-red-400">
                  ⚠️ Enter age (1–120).
                </p>
              )}
            </div>
          </div>

          {/* SECTION 2: Mandatory 4–6 Digit Age-Lock PIN */}
          <div className={`space-y-1.5 border-t pt-3.5 ${tokens.sectionBorder}`}>
            <div className="flex items-center justify-between gap-2">
              <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-200 truncate">
                Age-Lock PIN (4–6 Digits){" "}
                <span className="text-red-400">*</span>
              </label>
              <span
                className={`whitespace-nowrap shrink-0 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${
                  isValidAgeLockPin(ageLockInput)
                    ? "bg-emerald-500/20 border-emerald-400/40 text-emerald-300"
                    : tokens.badgeClass
                }`}
              >
                {ageLockInput.length}/6 • TV Remote OK
              </span>
            </div>

            <div className="relative flex items-center gap-2">
              <input
                type={showPinDigits ? "text" : "password"}
                inputMode="numeric"
                dir="ltr"
                autoComplete="new-password"
                maxLength={6}
                value={ageLockInput}
                onChange={(e) => {
                  setAgeLockInput(
                    e.target.value.replace(/\D/g, "").slice(0, 6)
                  );
                  if (ageLockError) setAgeLockError(false);
                }}
                placeholder="4–6 digit PIN"
                style={{ direction: "ltr", unicodeBidi: "plaintext" }}
                className={`rabtv-act-focus flex-1 min-w-0 rounded-xl border px-3.5 py-2.5 text-center text-base sm:text-lg font-black tracking-[0.28em] focus:outline-none transition ${tokens.inputClass}`}
              />
              <button
                type="button"
                onClick={() => setShowPinDigits((prev) => !prev)}
                className={`rabtv-act-focus h-11 px-3 rounded-xl border text-xs font-extrabold shrink-0 transition cursor-pointer ${tokens.secondaryBtn}`}
                title={showPinDigits ? "Hide PIN" : "Show PIN"}
              >
                {showPinDigits ? "Hide" : "Show"}
              </button>
            </div>

            {ageLockError && (
              <p className="text-xs font-bold text-red-400 text-center">
                ⚠️ Please enter a 4 to 6 digit numeric PIN (numbers only).
              </p>
            )}
          </div>

          {/* SECTION 3: Console Theme, Poster Grid & Stream Quality */}
          <div className={`space-y-3 border-t pt-3.5 ${tokens.sectionBorder}`}>
            <div className="space-y-1.5">
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-200">
                🎨 Console Neon Theme:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {allThemesList.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onThemeChange(t.id)}
                    className={`rabtv-act-focus rounded-xl border py-2 px-2 text-xs font-bold whitespace-nowrap truncate transition-all cursor-pointer ${
                      appTheme === t.id
                        ? `border-white/50 ${getPrimaryBgColor(t.id)} text-white shadow-lg`
                        : "border-white/10 bg-black/65 text-slate-300 hover:bg-white/10"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Poster Grid Size */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-200">
                  🖼️ Poster Grid Size:
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      { id: "small", title: "Small", sub: "TV Grid" },
                      { id: "medium", title: "Medium", sub: "Balanced" },
                      { id: "large", title: "Large", sub: "Cinema" },
                    ] as { id: CardSize; title: string; sub: string }[]
                  ).map((size) => (
                    <button
                      key={size.id}
                      type="button"
                      onClick={() => onSizeChange(size.id)}
                      className={`rabtv-act-focus rounded-xl border py-2 px-1 text-center transition-all cursor-pointer ${
                        cardSize === size.id
                          ? `border-white/50 ${getPrimaryBgColor(appTheme)} text-white shadow-lg`
                          : "border-white/10 bg-black/65 text-slate-300 hover:bg-white/10"
                      }`}
                    >
                      <span className="block text-xs font-extrabold">
                        {size.title}
                      </span>
                      <span className="block text-[9px] opacity-85">
                        {size.sub}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Preferred Stream Quality */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-200">
                  📺 Preferred Quality:
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(
                    [
                      { id: "auto", label: "Auto" },
                      { id: "480p", label: "480p" },
                      { id: "720p", label: "720p" },
                      { id: "1080p", label: "1080p" },
                    ] as { id: StreamQuality; label: string }[]
                  ).map((q) => (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => setSelectedQuality(q.id)}
                      className={`rabtv-act-focus rounded-xl border py-2.5 px-1 text-xs font-extrabold text-center transition-all cursor-pointer ${
                        selectedQuality === q.id
                          ? `border-white/50 ${getPrimaryBgColor(appTheme)} text-white shadow-lg`
                          : "border-white/10 bg-black/65 text-slate-300 hover:bg-white/10"
                      }`}
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 4: Lobby Background Radio Station Picker */}
          <div className={`space-y-2 border-t pt-3.5 ${tokens.sectionBorder}`}>
            <div className="flex items-center justify-between gap-2">
              <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-200">
                📻 Lobby Background Radio Station:
              </label>
              {selectedRadioId !== "off" && (
                <button
                  type="button"
                  onClick={handleToggleRadioPreview}
                  className={`rabtv-act-focus rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold transition cursor-pointer ${tokens.secondaryBtn}`}
                >
                  {isPreviewingRadio ? "⏹ Stop Preview" : "▶ Preview"}
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {radioPresets.map((station) => (
                <button
                  key={station.id}
                  type="button"
                  onClick={() => handleRadioSelect(station)}
                  className={`rabtv-act-focus rounded-xl border py-2 px-2 text-left transition-all cursor-pointer ${
                    selectedRadioId === station.id
                      ? `border-white/50 ${getPrimaryBgColor(appTheme)} text-white shadow-lg`
                      : "border-white/10 bg-black/65 text-slate-300 hover:bg-white/10"
                  }`}
                >
                  <span className="block text-[11px] font-extrabold truncate">
                    {station.label}
                  </span>
                  <span className="block text-[9px] opacity-80 truncate">
                    {station.vibe}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* SECTION 5: Hardware, Remote & Playback Preferences */}
          <div
            className={`grid grid-cols-1 sm:grid-cols-2 gap-2 border-t pt-3.5 ${tokens.sectionBorder}`}
          >
            {/* Low RAM Stick Mode */}
            <button
              type="button"
              role="switch"
              aria-checked={ramMode === "low"}
              onClick={() =>
                handleRamModeSelect(ramMode === "low" ? "high" : "low")
              }
              className="rabtv-act-focus flex items-center justify-between gap-2 rounded-xl bg-black/65 border border-white/15 px-3 py-2.5 text-left cursor-pointer transition hover:border-white/30"
            >
              <div className="min-w-0">
                <span
                  className={`block text-[11px] font-extrabold uppercase tracking-wider ${tokens.labelAccent}`}
                >
                  📟 Low RAM Stick Mode
                </span>
                <span className="block text-[10px] text-slate-300">
                  Anti-crash cap for 1–2GB sticks
                </span>
              </div>
              <span
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                  ramMode === "low" ? "bg-emerald-600" : "bg-slate-700"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    ramMode === "low" ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </span>
            </button>

            {/* XL TV Mouse Pointer */}
            <button
              type="button"
              role="switch"
              aria-checked={helpfulMouse}
              onClick={() => onMouseToggle(!helpfulMouse)}
              className="rabtv-act-focus flex items-center justify-between gap-2 rounded-xl bg-black/65 border border-white/15 px-3 py-2.5 text-left cursor-pointer transition hover:border-white/30"
            >
              <div className="min-w-0">
                <span className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-100">
                  🖱️ XL Mouse Pointer
                </span>
                <span className="block text-[10px] text-slate-300">
                  3× larger cursor for TVs/projectors
                </span>
              </div>
              <span
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                  helpfulMouse ? tokens.toggleOn : "bg-slate-700"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    helpfulMouse ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </span>
            </button>

            {/* Large Couch Buttons */}
            <button
              type="button"
              role="switch"
              aria-checked={largeButtonsLocal}
              onClick={() => handleLargeButtonsSelect(!largeButtonsLocal)}
              className="rabtv-act-focus flex items-center justify-between gap-2 rounded-xl bg-black/65 border border-white/15 px-3 py-2.5 text-left cursor-pointer transition hover:border-white/30"
            >
              <div className="min-w-0">
                <span className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-100">
                  🛋️ Large TV Buttons
                </span>
                <span className="block text-[10px] text-slate-300">
                  Bigger touch & remote targets
                </span>
              </div>
              <span
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                  largeButtonsLocal ? tokens.toggleOn : "bg-slate-700"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    largeButtonsLocal ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </span>
            </button>

            {/* Auto-Play Next Episode */}
            <button
              type="button"
              role="switch"
              aria-checked={autoPlayLocal}
              onClick={() => handleAutoPlaySelect(!autoPlayLocal)}
              className="rabtv-act-focus flex items-center justify-between gap-2 rounded-xl bg-black/65 border border-white/15 px-3 py-2.5 text-left cursor-pointer transition hover:border-white/30"
            >
              <div className="min-w-0">
                <span className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-100">
                  ⏭️ Auto-Play Next Ep
                </span>
                <span className="block text-[10px] text-slate-300">
                  Binge series seamlessly
                </span>
              </div>
              <span
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                  autoPlayLocal ? tokens.toggleOn : "bg-slate-700"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    autoPlayLocal ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </span>
            </button>
          </div>

          {/* SECTION 6: Unlock Key, High-Alert Admin Request & Fixed Contact Support */}
          <div className={`space-y-2.5 border-t pt-3.5 ${tokens.sectionBorder}`}>
            <div className="flex items-center justify-between gap-2">
              <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-200">
                🔑 Lifetime Unlock Key or Trial Code (9654):
              </label>
              <button
                type="button"
                onClick={() => setShowPasscode((p) => !p)}
                className={`rabtv-act-focus rounded-lg border px-2 py-0.5 text-[10px] font-bold cursor-pointer ${tokens.secondaryBtn}`}
              >
                {showPasscode ? "Hide Key" : "Show Key"}
              </button>
            </div>

            <input
              type={showPasscode ? "text" : "password"}
              dir="ltr"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              maxLength={32}
              disabled={isVerifying || lockoutSecondsLeft > 0}
              value={passcodeInput}
              onChange={(e) => {
                setPasscodeInput(e.target.value);
                if (passcodeError) setPasscodeError(false);
              }}
              placeholder="Enter unlock key or 9654"
              style={{ direction: "ltr", unicodeBidi: "plaintext" }}
              className={`rabtv-act-focus w-full rounded-xl border px-3 py-3 text-center text-sm sm:text-base font-black tracking-wider focus:outline-none disabled:opacity-50 transition ${tokens.inputClass}`}
            />

            {passcodeError && (
              <div className="rounded-xl bg-red-950/80 border border-red-500/50 p-2.5 text-center">
                <p className="text-xs font-bold text-red-200">
                  {passcodeErrorMsg}
                </p>
              </div>
            )}

            {/* Primary Armored Authorize Submit Button */}
            <button
              type="submit"
              disabled={isVerifying || lockoutSecondsLeft > 0}
              className="rabtv-act-btn rabtv-act-focus w-full py-3.5 text-sm sm:text-base font-black uppercase tracking-wider text-white disabled:opacity-50 cursor-pointer"
            >
              <span
                className="rabtv-act-btn-art"
                style={{
                  backgroundImage: `url(${IMG_ACT_BTN_PRIMARY})`,
                  filter: "var(--rabtv-act-filter)",
                }}
              />
              <span className="rabtv-act-btn-scrim" />
              <span className="rabtv-act-btn-label">
                {lockoutSecondsLeft > 0
                  ? `⏳ Security Cooldown (${lockoutSecondsLeft}s)`
                  : isVerifying
                    ? "⚡ Verifying Credentials..."
                    : "🚀 Enter RABBiT TV"}
              </span>
            </button>

            {/* Built-in Live 2-Way Activation Chat with Admin (Isolated strictly to this device) */}
            <div className={`rounded-2xl border border-white/15 bg-black/65 p-3 space-y-2.5 ${isLowRam ? "" : "backdrop-blur-md"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-extrabold text-white">
                    Need an activation code?
                  </span>
                  {chatThread && (chatThread.messages || []).some((m) => m.sender === "admin") && (
                    <span className="rounded-full bg-emerald-500/20 border border-emerald-400/50 px-2 py-0.5 text-[9.5px] font-black text-emerald-300">
                      🐰 Admin Replied!
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setShowRequestAdminBox((v) => !v)}
                  className={`rabtv-act-focus rounded-xl border px-3 py-1.5 text-[11px] font-extrabold transition cursor-pointer ${tokens.secondaryBtn}`}
                >
                  {showRequestAdminBox
                    ? "✕ Hide Chat"
                    : "💬 Live Chat with Admin"}
                </button>
              </div>

              {showRequestAdminBox && (
                <div className="space-y-2.5 pt-2 border-t border-white/10">
                  {/* Live Header & Identity Strip */}
                  <div className="flex flex-wrap items-center justify-between gap-1.5 rounded-xl bg-white/[0.04] border border-white/10 px-3 py-2 text-[11px]">
                    <span className="text-slate-300 truncate">
                      <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 mr-1.5 align-middle" />
                      Chatting as{" "}
                      <strong className="text-white">
                        {profileNameInput.trim() || "Enter Name above"}
                      </strong>{" "}
                      (Age{" "}
                      <strong className={tokens.labelAccent}>
                        {userAgeInput.trim() || "?"}
                      </strong>
                      )
                    </span>
                    <button
                      type="button"
                      disabled={isSyncingChat}
                      onClick={() => void syncMyActivationChat(true)}
                      className="rounded-lg bg-white/10 hover:bg-white/20 px-2 py-0.5 text-[10px] font-bold text-cyan-300 cursor-pointer shrink-0"
                    >
                      {isSyncingChat ? "..." : "↻ Refresh"}
                    </button>
                  </div>

                  {/* Private 2-Way Message Feed */}
                  <div className="max-h-48 overflow-y-auto space-y-2 rounded-2xl border border-white/10 bg-black/80 p-2.5 scrollbar-none">
                    {!chatThread || (chatThread.messages || []).length === 0 ? (
                      <div className="py-4 text-center space-y-1">
                        <p className="text-xs font-bold text-zinc-200">
                          🐰 Direct Line to Rabbit
                        </p>
                        <p className="text-[11px] text-zinc-400 leading-snug">
                          Type a quick message (e.g. &ldquo;Sent $20 e-Transfer&rdquo;) and
                          Rabbit&apos;s reply &amp; unlock key will appear right in this box.
                        </p>
                      </div>
                    ) : (
                      (chatThread.messages || []).map((msg) => {
                        const isAdmin = msg.sender === "admin";
                        return (
                          <div
                            key={msg.id}
                            className={`flex flex-col ${
                              isAdmin ? "items-start" : "items-end"
                            }`}
                          >
                            <div
                              className={`max-w-[88%] rounded-2xl px-3 py-2 text-xs leading-snug break-words ${
                                isAdmin
                                  ? "bg-emerald-950/90 border border-emerald-400/50 text-emerald-100"
                                  : "bg-zinc-900 border border-cyan-400/35 text-white"
                              }`}
                            >
                              <span className="block text-[9.5px] font-black uppercase tracking-wider opacity-75 mb-0.5">
                                {isAdmin ? "🐰 Rabbit (Admin)" : "You"}
                              </span>
                              <p className="font-semibold">{msg.text}</p>

                              {/* 1-Tap Auto-Fill Key when Admin sends a key! */}
                              {msg.deliveredKey && (
                                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-black/80 border border-amber-400/60 px-2.5 py-1.5">
                                  <span className="font-mono text-xs font-black text-amber-300">
                                    🔑 {msg.deliveredKey}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPasscodeInput(msg.deliveredKey || "");
                                      setShowPasscode(true);
                                      setPasscodeError(false);
                                      setRequestStatusMsg({
                                        type: "ok",
                                        text: "✓ Unlock key filled into the box above! Tap Enter RABBiT TV.",
                                      });
                                    }}
                                    className="rounded-lg bg-amber-400 hover:bg-amber-300 px-2.5 py-1 text-[10px] font-black text-slate-950 cursor-pointer"
                                  >
                                    ⚡ Fill Key
                                  </button>
                                </div>
                              )}
                            </div>
                            <span className="text-[9px] text-zinc-500 mt-0.5 px-1">
                              {new Date(msg.sentAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                        );
                      })
                    )}
                    <div ref={userChatEndRef} />
                  </div>

                  {/* Chat Message Composer */}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      dir="ltr"
                      autoComplete="off"
                      autoCorrect="off"
                      spellCheck={false}
                      maxLength={240}
                      disabled={isSendingRequest}
                      value={requestNote}
                      onChange={(e) => setRequestNote(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          e.stopPropagation();
                          void handleSendAdminActivationRequest();
                        }
                      }}
                      placeholder={
                        chatThread
                          ? "Reply to Rabbit..."
                          : "Say hi or note e-Transfer sent..."
                      }
                      style={{
                        direction: "ltr",
                        unicodeBidi: "plaintext",
                        textAlign: "left",
                      }}
                      className={`rabtv-act-focus flex-1 min-w-0 rounded-xl border px-3 py-2 text-xs font-bold focus:outline-none ${tokens.inputClass}`}
                    />

                    <button
                      type="button"
                      disabled={isSendingRequest}
                      onClick={() => void handleSendAdminActivationRequest()}
                      className={`rabtv-act-focus shrink-0 rounded-xl py-2 px-3.5 text-xs font-black uppercase tracking-wider text-white transition cursor-pointer disabled:opacity-50 ${getPrimaryBgColor(
                        appTheme
                      )}`}
                    >
                      {isSendingRequest ? "Sending..." : "➤ Send"}
                    </button>
                  </div>

                  {requestStatusMsg && (
                    <p
                      className={`text-[11px] font-bold text-center ${
                        requestStatusMsg.type === "ok"
                          ? "text-emerald-300"
                          : "text-red-300"
                      }`}
                    >
                      {requestStatusMsg.text}
                    </p>
                  )}
                </div>
              )}

              {/* Armored Direct Contact Buttons (WhatsApp E.164 + Native SMS + Copy for TVs) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={() =>
                    launchDirectContact(
                      "whatsapp",
                      buildPreFilledContactMessage(),
                      (u) => handleOpenExternal(u)
                    )
                  }
                  className="rabtv-act-btn rabtv-act-focus py-2.5 px-2.5 text-[11px] font-extrabold text-white cursor-pointer"
                >
                  <span className="rabtv-act-btn-art" style={{ backgroundImage: `url(${IMG_ACT_BTN_EMERALD})` }} />
                  <span className="rabtv-act-btn-scrim" />
                  <span className="rabtv-act-btn-label">💬 WhatsApp Rabbit</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    launchDirectContact(
                      "sms",
                      buildPreFilledContactMessage(),
                      (u) => handleOpenExternal(u)
                    )
                  }
                  className="rabtv-act-btn rabtv-act-focus py-2.5 px-2.5 text-[11px] font-extrabold text-white cursor-pointer"
                >
                  <span
                    className="rabtv-act-btn-art"
                    style={{
                      backgroundImage: `url(${IMG_ACT_TAB_ACTIVE})`,
                      filter: "var(--rabtv-act-filter)",
                    }}
                  />
                  <span className="rabtv-act-btn-scrim" />
                  <span className="rabtv-act-btn-label">📱 Text {SUPPORT_PHONE_DISPLAY}</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopySupportInfo}
                  className="rabtv-act-btn rabtv-act-focus py-2.5 px-2.5 text-[11px] font-extrabold text-white cursor-pointer"
                >
                  <span
                    className="rabtv-act-btn-art"
                    style={{
                      backgroundImage: `url(${IMG_ACT_TAB_IDLE})`,
                      filter: "var(--rabtv-act-filter)",
                    }}
                  />
                  <span className="rabtv-act-btn-scrim" />
                  <span className="rabtv-act-btn-label">{copyFeedback || "📋 Copy # (TVs)"}</span>
                </button>
              </div>
            </div>

            <div className="pt-1 text-center">
              <img
                src={RABBIT_DIVIDER}
                alt=""
                className="w-1/2 mx-auto h-1.5 object-contain opacity-75"
              />
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}