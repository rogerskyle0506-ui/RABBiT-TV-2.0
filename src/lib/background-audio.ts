// src/lib/background-audio.ts
import {
  getHardwareLimits,
  getReducedMotion,
  purgeOldTmdbCaches,
} from "./settings";

export interface RadioStation {
  name: string;
  url: string;
  category: string;
}

export interface StationCheckResult {
  station: RadioStation;
  ok: boolean;
  latencyMs: number;
  status?: number;
  contentType?: string;
  error?: string;
}

export interface RadioPlaybackStatus {
  isPlaying: boolean;
  isMuted: boolean;
  volume: number;
  station: RadioStation;
  reconnecting: boolean;
}

const DEFAULT_RADIO_VOLUME = 0.25;
const FALLBACK_HEART_DANCE_URL = "https://media-ssl.musicradio.com/HeartDance";
const SESSION_USER_STATION_OVERRIDE_KEY = "rabtv_session_radio_override";
// Uses rabtv_cache_ prefix so settings.ts purgeOldTmdbCaches() can clean it safely
const HEALTH_CACHE_KEY = "rabtv_cache_station_health_v2";
const HEALTH_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
const DEFAULT_TIMEOUT = 2500;

function isSafeAudioUrl(rawUrl: string): boolean {
  if (!rawUrl || typeof rawUrl !== "string") return false;
  try {
    const parsed = new URL(rawUrl.trim());
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function safeWriteJson(key: string, payload: unknown): void {
  if (typeof window === "undefined") return;
  const serialized = JSON.stringify(payload);
  try {
    localStorage.setItem(key, serialized);
  } catch {
    try {
      purgeOldTmdbCaches();
      localStorage.setItem(key, serialized);
    } catch {
      // Ignore quota failures on low-storage sticks
    }
  }
}

// ──────────────────────────────────────────────
// Helper: parse raw .m3u / .m3u8 playlist text safely
// ──────────────────────────────────────────────
function parseM3U(content: string, category: string): RadioStation[] {
  const lines = String(content || "").split(/\r?\n/);
  const stations: RadioStation[] = [];
  const seenUrls = new Set<string>();
  let currentName = "";

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("#EXTINF:")) {
      const commaIndex = trimmed.lastIndexOf(",");
      if (commaIndex !== -1) {
        currentName = trimmed
          .substring(commaIndex + 1)
          .replace(/[<>]/g, "")
          .trim();
      }
    } else if (trimmed && !trimmed.startsWith("#")) {
      if (isSafeAudioUrl(trimmed) && !seenUrls.has(trimmed)) {
        seenUrls.add(trimmed);
        stations.push({
          name: currentName || "Unknown Station",
          url: trimmed,
          category,
        });
      }
      currentName = "";
    }
  }
  return stations;
}

// ──────────────────────────────────────────────
// 1. Permanently protected seasonal stations
// ──────────────────────────────────────────────
const protectedStations: Record<string, RadioStation[]> = {
  Christmas: [
    {
      name: "Christmas Vinyl HD",
      url: "https://icecast.walmradio.com:8443/christmas",
      category: "Christmas",
    },
    {
      name: "109.0 FM Christmas Kids",
      url: "http://stream.dar.fm/97821",
      category: "Christmas",
    },
  ],
  "Valentine's": [
    {
      name: "LOVE RADIO Only Love Songs 70s80s90s",
      url: "http://shoutcast3.streamingmedia.it:3162/",
      category: "Valentine's",
    },
  ],
  Halloween: [
    {
      name: "SomaFM Secret Agent (128k MP3)",
      url: "https://ice5.somafm.com/secretagent-128-mp3",
      category: "Halloween",
    },
  ],
};

// ──────────────────────────────────────────────
// 2. Dynamic station list (protected + .m3u files)
// ──────────────────────────────────────────────
const dynamicStations: Record<string, RadioStation[]> = {
  ...protectedStations,
};

try {
  const m3uFiles = import.meta.glob("../radio-stations/*.m3u", {
    query: "?raw",
    import: "default",
    eager: true,
  });

  for (const [path, rawContent] of Object.entries(m3uFiles)) {
    const parts = path.split("/");
    const fileName = parts[parts.length - 1];
    const baseName = fileName.replace(/\.[^/.]+$/, "");

    const category = baseName
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

    const parsed = parseM3U(rawContent as string, category);

    if (parsed.length > 0) {
      if (!dynamicStations[category]) {
        dynamicStations[category] = [];
      }
      dynamicStations[category].push(...parsed);
    }
  }
} catch (err) {
  console.warn(
    "Dynamic folder scanning skipped or unavailable, using fallback/protected stations.",
    err
  );
}

// Absolute fallback if no .m3u files loaded
if (!dynamicStations["2000s"] && Object.keys(dynamicStations).length <= 3) {
  dynamicStations["2000s"] = [
    {
      name: "Heart Dance",
      url: FALLBACK_HEART_DANCE_URL,
      category: "2000s",
    },
  ];
}

if (!dynamicStations["House"] && Object.keys(dynamicStations).length <= 4) {
  dynamicStations["House"] = [
    {
      name: "Dance Wave! | MP3",
      url: "https://dancewave.online/dance.mp3",
      category: "House",
    },
    {
      name: "1.FM - Deep House Radio",
      url: "http://strm112.1.fm/deephouse_mobile_mp3",
      category: "House",
    },
  ];
}

export const RADIO_STATIONS: Record<string, RadioStation[]> = dynamicStations;

/**
 * Resolves the default Heart Dance station inside the 2000s category.
 */
export function resolveDefaultHeartDanceStation(): RadioStation {
  const stations2000s =
    RADIO_STATIONS["2000s"] ||
    RADIO_STATIONS["2000's"] ||
    RADIO_STATIONS["00s"] ||
    [];

  const exactIn2000s = stations2000s.find((s) => {
    const n = s.name.toLowerCase();
    return n.includes("heart dance") || n.includes("heartdance");
  });
  if (exactIn2000s) return exactIn2000s;

  const heartIn2000s = stations2000s.find((s) =>
    s.name.toLowerCase().includes("heart")
  );
  if (heartIn2000s) return heartIn2000s;

  for (const list of Object.values(RADIO_STATIONS)) {
    const match = list.find((s) => {
      const n = s.name.toLowerCase();
      return n.includes("heart dance") || n.includes("heartdance");
    });
    if (match) return match;
  }

  if (stations2000s[0]) return stations2000s[0];

  return {
    name: "Heart Dance",
    url: FALLBACK_HEART_DANCE_URL,
    category: "2000s",
  };
}

// ──────────────────────────────────────────────
// Station Organizer (health + speed filter)
// ──────────────────────────────────────────────

interface HealthCache {
  timestamp: number;
  results: Record<string, { ok: boolean; latencyMs: number }>;
}

/** Test a single station with safe timeout */
export async function checkStation(
  station: RadioStation,
  timeoutMs = DEFAULT_TIMEOUT
): Promise<StationCheckResult> {
  if (!isSafeAudioUrl(station.url)) {
    return {
      station,
      ok: false,
      latencyMs: 0,
      error: "Blocked invalid station URL",
    };
  }

  const controller = new AbortController();
  const timer =
    typeof window !== "undefined"
      ? window.setTimeout(() => controller.abort(), timeoutMs)
      : setTimeout(() => controller.abort(), timeoutMs);
  const start =
    typeof performance !== "undefined" ? performance.now() : Date.now();

  try {
    const res = await fetch(station.url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        Range: "bytes=0-1023",
        "Icy-MetaData": "1",
      },
    });

    const elapsed =
      (typeof performance !== "undefined" ? performance.now() : Date.now()) -
      start;
    const latencyMs = Math.round(elapsed);
    const contentType = res.headers.get("content-type")?.toLowerCase() ?? "";

    const isAudioLike =
      contentType.startsWith("audio/") ||
      contentType.includes("mpegurl") ||
      contentType.includes("x-mpegurl") ||
      contentType.includes("octet-stream") ||
      contentType.includes("icy") ||
      !contentType;

    const okStatus = res.status === 200 || res.status === 206;

    if (okStatus && isAudioLike && latencyMs <= timeoutMs) {
      return {
        station,
        ok: true,
        latencyMs,
        status: res.status,
        contentType,
      };
    }

    return {
      station,
      ok: false,
      latencyMs,
      status: res.status,
      contentType,
      error: `Bad response (${res.status}) or non-audio content-type`,
    };
  } catch (err: any) {
    const elapsed =
      (typeof performance !== "undefined" ? performance.now() : Date.now()) -
      start;
    return {
      station,
      ok: false,
      latencyMs: Math.round(elapsed),
      error:
        err?.name === "AbortError" ? "Timeout" : err?.message || "Network error",
    };
  } finally {
    if (typeof window !== "undefined") {
      window.clearTimeout(timer as number);
    } else {
      clearTimeout(timer);
    }
  }
}

/** Check many stations with hardware-aware concurrency limit */
export async function checkStations(
  stations: RadioStation[],
  options: {
    timeoutMs?: number;
    concurrency?: number;
    onProgress?: (done: number, total: number) => void;
  } = {}
): Promise<StationCheckResult[]> {
  const defaultConcurrency =
    getHardwareLimits().effectiveMode === "low" ? 2 : 4;
  const {
    timeoutMs = DEFAULT_TIMEOUT,
    concurrency = defaultConcurrency,
    onProgress,
  } = options;
  const results: StationCheckResult[] = new Array(stations.length);
  let index = 0;
  let completed = 0;

  async function worker() {
    while (index < stations.length) {
      const i = index++;
      results[i] = await checkStation(stations[i], timeoutMs);
      completed++;
      onProgress?.(completed, stations.length);
    }
  }

  const workerCount = Math.min(Math.max(1, concurrency), stations.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

function loadHealthCache(): HealthCache | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(HEALTH_CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as HealthCache;
    if (Date.now() - data.timestamp > HEALTH_CACHE_TTL) return null;
    return data;
  } catch {
    return null;
  }
}

function saveHealthCache(results: StationCheckResult[]) {
  const map: Record<string, { ok: boolean; latencyMs: number }> = {};
  for (const r of results) {
    if (r?.station?.url) {
      map[r.station.url] = { ok: r.ok, latencyMs: r.latencyMs };
    }
  }
  safeWriteJson(HEALTH_CACHE_KEY, {
    timestamp: Date.now(),
    results: map,
  } satisfies HealthCache);
}

/**
 * Returns only stations that are active and respond quickly.
 * Protected seasonal categories are always kept.
 */
export async function organizeStations(
  allStations: Record<string, RadioStation[]> = RADIO_STATIONS,
  protectedCategories: string[] = ["Christmas", "Valentine's", "Halloween"]
): Promise<Record<string, RadioStation[]>> {
  const flat: RadioStation[] = [];
  for (const list of Object.values(allStations)) {
    flat.push(...list);
  }

  const cache = loadHealthCache();
  let results: StationCheckResult[];

  if (cache) {
    results = flat.map((s) => {
      const cached = cache.results[s.url];
      return {
        station: s,
        ok: cached?.ok ?? false,
        latencyMs: cached?.latencyMs ?? 9999,
      };
    });
  } else {
    results = await checkStations(flat);
    saveHealthCache(results);
  }

  const latencyLookup = new Map<string, number>();
  const organized: Record<string, RadioStation[]> = {};

  for (const r of results) {
    latencyLookup.set(r.station.url, r.latencyMs);
    const cat = r.station.category;
    const isProtected = protectedCategories.includes(cat);

    if (r.ok || isProtected) {
      if (!organized[cat]) organized[cat] = [];
      organized[cat].push(r.station);
    }
  }

  for (const cat of Object.keys(organized)) {
    organized[cat].sort(
      (a, b) =>
        (latencyLookup.get(a.url) ?? 9999) - (latencyLookup.get(b.url) ?? 9999)
    );
  }

  return organized;
}

/** Force a fresh check (ignores cache) */
export async function revalidateStations(
  allStations: Record<string, RadioStation[]> = RADIO_STATIONS
) {
  if (typeof window !== "undefined") {
    localStorage.removeItem(HEALTH_CACHE_KEY);
  }
  return organizeStations(allStations);
}

export async function getOrganizedStations() {
  return organizeStations(RADIO_STATIONS);
}

// ──────────────────────────────────────────────
// Background Audio Manager (RAM-Safe + Auto-Reconnect + MediaSession)
// ──────────────────────────────────────────────
class BackgroundAudioManager {
  private audio: HTMLAudioElement | null = null;
  private currentUrl: string = "";
  private activePlaying: boolean = false;
  private muted: boolean = false;
  private targetVolume: number = DEFAULT_RADIO_VOLUME;
  private reconnectAttempts: number = 0;
  private reconnectTimer: number | null = null;
  private fadeTimer: number | null = null;
  private isReconnecting: boolean = false;

  constructor() {
    if (typeof window !== "undefined") {
      this.audio = new Audio();
      this.audio.loop = true;
      this.audio.preload = "none";
      this.audio.dataset.bgAudio = "true";

      const savedVol = localStorage.getItem("rabtv_bg_volume");
      const parsedVol =
        savedVol !== null ? parseFloat(savedVol) : DEFAULT_RADIO_VOLUME;
      this.targetVolume = isNaN(parsedVol)
        ? DEFAULT_RADIO_VOLUME
        : Math.max(0, Math.min(1, parsedVol));
      this.audio.volume = this.targetVolume;

      // Auto-recover dropped streams on Wi-Fi hiccups
      this.audio.addEventListener("error", () => this.scheduleReconnect());
      this.audio.addEventListener("playing", () => {
        this.reconnectAttempts = 0;
        this.isReconnecting = false;
        this.activePlaying = true;
        this.updateMediaSession(this.getCurrentStation());
        this.emitUpdate();
      });

      window.addEventListener("online", () => {
        if (this.activePlaying && !this.muted && this.audio?.paused) {
          this.reconnectAttempts = 0;
          this.play();
        }
      });

      this.registerMediaSessionHandlers();
    }
  }

  private emitUpdate() {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("rabtv_radio_updated"));
    }
  }

  private clearTimers() {
    if (this.reconnectTimer !== null && typeof window !== "undefined") {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.fadeTimer !== null && typeof window !== "undefined") {
      window.clearInterval(this.fadeTimer);
      this.fadeTimer = null;
    }
  }

  private registerMediaSessionHandlers() {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) {
      return;
    }
    try {
      navigator.mediaSession.setActionHandler("play", () => this.play());
      navigator.mediaSession.setActionHandler("pause", () => this.pause());
      navigator.mediaSession.setActionHandler("nexttrack", () =>
        this.nextStation()
      );
      navigator.mediaSession.setActionHandler("previoustrack", () =>
        this.prevStation()
      );
    } catch {
      // Some TV WebViews partially support MediaSession
    }
  }

  private updateMediaSession(station: RadioStation) {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) {
      return;
    }
    try {
      const MediaMeta = (window as any).MediaMetadata;
      if (MediaMeta) {
        navigator.mediaSession.metadata = new MediaMeta({
          title: station.name,
          artist: `RABBiT TV Lobby Radio • ${station.category}`,
          album: "RABBiT TV 2.0",
        });
      }
      navigator.mediaSession.playbackState = this.activePlaying
        ? "playing"
        : "paused";
    } catch {
      // ignore
    }
  }

  private scheduleReconnect() {
    if (
      !this.activePlaying ||
      this.muted ||
      !this.audio ||
      typeof window === "undefined"
    ) {
      return;
    }
    if (this.reconnectAttempts >= 3) {
      this.isReconnecting = false;
      this.emitUpdate();
      return;
    }

    this.isReconnecting = true;
    this.reconnectAttempts++;
    const delayMs = this.reconnectAttempts * 2500;

    if (this.reconnectTimer) window.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = window.setTimeout(() => {
      if (!this.activePlaying || this.muted || !this.audio) return;
      const station = this.getCurrentStation();
      this.audio.src = station.url;
      this.currentUrl = station.url;
      this.audio.load();
      this.audio.play().catch(() => {
        this.isReconnecting = false;
      });
    }, delayMs);
    this.emitUpdate();
  }

  private fadeInToTargetVolume() {
    if (!this.audio || typeof window === "undefined") return;
    if (this.fadeTimer) {
      window.clearInterval(this.fadeTimer);
      this.fadeTimer = null;
    }

    const goal = this.muted ? 0 : this.targetVolume;
    // Skip animation timer on Reduced Motion / Low-RAM mode for zero CPU overhead
    if (
      goal <= 0.02 ||
      getReducedMotion() ||
      getHardwareLimits().effectiveMode === "low"
    ) {
      this.audio.volume = goal;
      return;
    }

    this.audio.volume = 0.01;
    let step = 0;
    const totalSteps = 8;
    this.fadeTimer = window.setInterval(() => {
      if (!this.audio || !this.activePlaying || this.muted) {
        if (this.fadeTimer) window.clearInterval(this.fadeTimer);
        this.fadeTimer = null;
        return;
      }
      step++;
      const nextVol = Math.min(goal, (goal * step) / totalSteps);
      this.audio.volume = nextVol;
      if (step >= totalSteps) {
        if (this.fadeTimer) window.clearInterval(this.fadeTimer);
        this.fadeTimer = null;
      }
    }, 60);
  }

  /**
   * Releases the underlying HTTP audio socket & buffer to save RAM on 1–2GB sticks.
   */
  private releaseAudioSocket() {
    if (!this.audio) return;
    try {
      this.audio.pause();
      this.audio.removeAttribute("src");
      this.audio.load();
      this.currentUrl = "";
    } catch {
      // ignore teardown errors
    }
  }

  getAllStations(): RadioStation[] {
    const flat: RadioStation[] = [];
    for (const list of Object.values(RADIO_STATIONS)) {
      flat.push(...list);
    }
    return flat;
  }

  getSeasonalStation(): RadioStation {
    const hasSessionOverride =
      typeof window !== "undefined" &&
      sessionStorage.getItem(SESSION_USER_STATION_OVERRIDE_KEY) === "true";

    if (!hasSessionOverride) {
      const now = new Date();
      const month = now.getMonth() + 1;
      const day = now.getDate();

      // Christmas: Dec 10 – Dec 28
      if (month === 12 && day >= 10 && day <= 28) {
        if (RADIO_STATIONS["Christmas"]?.length) {
          return RADIO_STATIONS["Christmas"][0];
        }
      }
      // Valentine's: Feb 7 – Feb 15
      if (month === 2 && day >= 7 && day <= 15) {
        if (RADIO_STATIONS["Valentine's"]?.length) {
          return RADIO_STATIONS["Valentine's"][0];
        }
      }
      // Halloween: Oct 17 – Nov 1
      if (
        (month === 10 && day >= 17 && day <= 31) ||
        (month === 11 && day === 1)
      ) {
        if (RADIO_STATIONS["Halloween"]?.length) {
          return RADIO_STATIONS["Halloween"][0];
        }
      }
    }

    // User-selected station
    if (typeof window !== "undefined") {
      const savedUrl = localStorage.getItem("rabtv_radio_url");
      if (savedUrl) {
        for (const catStations of Object.values(RADIO_STATIONS)) {
          const found = catStations.find((s) => s.url === savedUrl);
          if (found) return found;
        }
      }
    }

    // Default to Heart Dance inside 2000s
    return resolveDefaultHeartDanceStation();
  }

  getCurrentStation(): RadioStation {
    return this.getSeasonalStation();
  }

  setStation(url: string) {
    if (!isSafeAudioUrl(url)) return;
    if (typeof window !== "undefined") {
      localStorage.setItem("rabtv_radio_url", url);
      sessionStorage.setItem(SESSION_USER_STATION_OVERRIDE_KEY, "true");
    }

    const shouldResume =
      this.activePlaying || Boolean(this.audio && !this.audio.paused);

    this.clearTimers();
    this.reconnectAttempts = 0;

    if (this.audio) {
      this.audio.src = url;
      this.currentUrl = url;
      if (shouldResume && !this.muted) {
        this.audio
          .play()
          .then(() => {
            this.activePlaying = true;
            this.fadeInToTargetVolume();
            this.updateMediaSession(this.getCurrentStation());
            this.emitUpdate();
          })
          .catch((err) => {
            console.warn("Failed to play selected stream:", err);
          });
      } else {
        this.emitUpdate();
      }
    }
  }

  nextStation(): RadioStation | null {
    const all = this.getAllStations();
    if (!all.length) return null;
    const current = this.getCurrentStation();
    const idx = all.findIndex((s) => s.url === current.url);
    const next = all[(idx + 1) % all.length];
    this.setStation(next.url);
    return next;
  }

  prevStation(): RadioStation | null {
    const all = this.getAllStations();
    if (!all.length) return null;
    const current = this.getCurrentStation();
    const idx = all.findIndex((s) => s.url === current.url);
    const prev = all[(idx - 1 + all.length) % all.length];
    this.setStation(prev.url);
    return prev;
  }

  playRandomStation(): RadioStation | null {
    const all = this.getAllStations();
    if (!all.length) return null;
    const picked = all[Math.floor(Math.random() * all.length)];
    this.setStation(picked.url);
    this.play();
    return picked;
  }

  play() {
    if (!this.audio || this.muted) return;
    const station = this.getSeasonalStation();

    if (this.currentUrl !== station.url || !this.audio.src) {
      this.audio.src = station.url;
      this.currentUrl = station.url;
    }

    if (this.audio.paused) {
      this.audio
        .play()
        .then(() => {
          this.activePlaying = true;
          this.reconnectAttempts = 0;
          this.fadeInToTargetVolume();
          this.updateMediaSession(station);
          this.emitUpdate();
        })
        .catch((err) => {
          console.warn("Autoplay blocked or stream connection failed:", err);
        });
    }
  }

  pause() {
    this.clearTimers();
    this.activePlaying = false;
    this.isReconnecting = false;
    // Release open stream buffer to protect 1–2GB Fire TV / Android TV stick RAM
    this.releaseAudioSocket();
    if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
      try {
        navigator.mediaSession.playbackState = "paused";
      } catch {
        // ignore
      }
    }
    this.emitUpdate();
  }

  mute() {
    this.muted = true;
    if (this.audio) {
      this.audio.volume = 0;
      if (!this.audio.paused) {
        this.releaseAudioSocket();
      }
    }
    this.emitUpdate();
  }

  unmute() {
    this.muted = false;
    if (this.audio) {
      this.audio.volume = this.targetVolume;
    }
    if (this.activePlaying) {
      this.play();
    }
    this.emitUpdate();
  }

  setMuted(muted: boolean) {
    if (muted) this.mute();
    else this.unmute();
  }

  isMuted(): boolean {
    return this.muted;
  }

  isPlaying(): boolean {
    return this.activePlaying && !this.muted;
  }

  get playing(): boolean {
    return this.isPlaying();
  }

  setVolume(vol: number) {
    const clamped = Math.max(0, Math.min(1, Number(vol) || 0));
    this.targetVolume = clamped;
    if (typeof window !== "undefined") {
      localStorage.setItem("rabtv_bg_volume", clamped.toString());
    }
    if (this.audio && !this.muted) {
      this.audio.volume = clamped;
    }
    this.emitUpdate();
  }

  getVolume(): number {
    return this.targetVolume;
  }

  getStatus(): RadioPlaybackStatus {
    return {
      isPlaying: this.isPlaying(),
      isMuted: this.muted,
      volume: this.targetVolume,
      station: this.getCurrentStation(),
      reconnecting: this.isReconnecting,
    };
  }
}

export const bgAudio = new BackgroundAudioManager();
