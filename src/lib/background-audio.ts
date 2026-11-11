// lib/background-audio.ts

export interface RadioStation {
  name: string;
  url: string;
  category: string;
}

// ──────────────────────────────────────────────
// Helper: parse raw .m3u / .m3u8 playlist text
// ──────────────────────────────────────────────
function parseM3U(content: string, category: string): RadioStation[] {
  const lines = content.split(/\r?\n/);
  const stations: RadioStation[] = [];
  let currentName = "";

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("#EXTINF:")) {
      const commaIndex = trimmed.lastIndexOf(",");
      if (commaIndex !== -1) {
        currentName = trimmed.substring(commaIndex + 1).trim();
      }
    } else if (trimmed && !trimmed.startsWith("#")) {
      stations.push({
        name: currentName || "Unknown Station",
        url: trimmed,
        category: category,
      });
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
const dynamicStations: Record<string, RadioStation[]> = { ...protectedStations };

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

// Absolute fallback
if (!dynamicStations["House"] && Object.keys(dynamicStations).length <= 3) {
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

// ──────────────────────────────────────────────
// Station Organizer (health + speed filter)
// ──────────────────────────────────────────────

export interface StationCheckResult {
  station: RadioStation;
  ok: boolean;
  latencyMs: number;
  status?: number;
  contentType?: string;
  error?: string;
}

const HEALTH_CACHE_KEY = "rabtv_station_health";
const HEALTH_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
const DEFAULT_TIMEOUT = 2500; // "pretty quickly"

interface HealthCache {
  timestamp: number;
  results: Record<string, { ok: boolean; latencyMs: number }>;
}

/** Test a single station */
export async function checkStation(
  station: RadioStation,
  timeoutMs = DEFAULT_TIMEOUT
): Promise<StationCheckResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const start = performance.now();

  try {
    const res = await fetch(station.url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        Range: "bytes=0-1023",
        "Icy-MetaData": "1",
      },
    });

    clearTimeout(timer);
    const latencyMs = Math.round(performance.now() - start);
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
    clearTimeout(timer);
    const latencyMs = Math.round(performance.now() - start);
    return {
      station,
      ok: false,
      latencyMs,
      error: err.name === "AbortError" ? "Timeout" : err.message || "Network error",
    };
  }
}

/** Check many stations with concurrency limit */
export async function checkStations(
  stations: RadioStation[],
  options: {
    timeoutMs?: number;
    concurrency?: number;
    onProgress?: (done: number, total: number) => void;
  } = {}
): Promise<StationCheckResult[]> {
  const { timeoutMs = DEFAULT_TIMEOUT, concurrency = 4, onProgress } = options;
  const results: StationCheckResult[] = new Array(stations.length);
  let index = 0;

  async function worker() {
    while (index < stations.length) {
      const i = index++;
      results[i] = await checkStation(stations[i], timeoutMs);
      onProgress?.(results.filter(Boolean).length, stations.length);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return results;
}

function loadHealthCache(): HealthCache | null {
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
    map[r.station.url] = { ok: r.ok, latencyMs: r.latencyMs };
  }
  localStorage.setItem(
    HEALTH_CACHE_KEY,
    JSON.stringify({
      timestamp: Date.now(),
      results: map,
    } satisfies HealthCache)
  );
}

/**
 * Main organizer.
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
    console.log("[RadioOrganizer] Checking stations…");
    results = await checkStations(flat, {
      onProgress: (done, total) => {
        if (done % 5 === 0 || done === total) {
          console.log(`[RadioOrganizer] ${done}/${total}`);
        }
      },
    });
    saveHealthCache(results);
  }

  const organized: Record<string, RadioStation[]> = {};

  for (const r of results) {
    const cat = r.station.category;
    const isProtected = protectedCategories.includes(cat);

    if (r.ok || isProtected) {
      if (!organized[cat]) organized[cat] = [];
      organized[cat].push(r.station);
    }
  }

  // Sort each category by latency (fastest first)
  for (const cat of Object.keys(organized)) {
    organized[cat].sort((a, b) => {
      const la = results.find((r) => r.station.url === a.url)?.latencyMs ?? 9999;
      const lb = results.find((r) => r.station.url === b.url)?.latencyMs ?? 9999;
      return la - lb;
    });
  }

  return organized;
}

/** Force a fresh check (ignores cache) */
export async function revalidateStations(
  allStations: Record<string, RadioStation[]> = RADIO_STATIONS
) {
  localStorage.removeItem(HEALTH_CACHE_KEY);
  return organizeStations(allStations);
}

/** Convenience helper for the player route */
export async function getOrganizedStations() {
  return organizeStations(RADIO_STATIONS);
}

// ──────────────────────────────────────────────
// Background Audio Manager
// ──────────────────────────────────────────────
class BackgroundAudioManager {
  private audio: HTMLAudioElement | null = null;
  private currentUrl: string = "";
  private isPlaying: boolean = false;

  constructor() {
    if (typeof window !== "undefined") {
      this.audio = new Audio();
      this.audio.loop = true;
      // Tag element so screensaver logic knows this is background audio
      this.audio.dataset.bgAudio = "true";

      const savedVol = localStorage.getItem("rabtv_bg_volume");
      const initialVol = savedVol !== null ? parseFloat(savedVol) : 0.5;
      this.audio.volume = Math.max(0, Math.min(1, initialVol));
    }
  }

  getSeasonalStation(): RadioStation {
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
    if ((month === 10 && day >= 17 && day <= 31) || (month === 11 && day === 1)) {
      if (RADIO_STATIONS["Halloween"]?.length) {
        return RADIO_STATIONS["Halloween"][0];
      }
    }

    // User-selected station
    const savedUrl = localStorage.getItem("rabtv_radio_url");
    if (savedUrl) {
      for (const catStations of Object.values(RADIO_STATIONS)) {
        const found = catStations.find((s) => s.url === savedUrl);
        if (found) return found;
      }
    }

    // Absolute fallback
    const firstCategory = Object.values(RADIO_STATIONS)[0];
    return firstCategory
      ? firstCategory[0]
      : {
          name: "Default Stream",
          url: "https://dancewave.online/dance.mp3",
          category: "House",
        };
  }

  getCurrentStation(): RadioStation {
    return this.getSeasonalStation();
  }

  setStation(url: string) {
    if (typeof window !== "undefined") {
      localStorage.setItem("rabtv_radio_url", url);
    }
    const wasPlaying = this.isPlaying || (this.audio && !this.audio.paused);
    if (this.audio) {
      this.audio.src = url;
      this.currentUrl = url;
      if (wasPlaying) {
        this.audio
          .play()
          .then(() => {
            this.isPlaying = true;
          })
          .catch((err) => {
            console.warn("Failed to play selected stream:", err);
          });
      }
    }
  }

  play() {
    if (!this.audio) return;
    const station = this.getSeasonalStation();

    if (this.currentUrl !== station.url) {
      this.audio.src = station.url;
      this.currentUrl = station.url;
    }

    if (this.audio.paused) {
      this.audio
        .play()
        .then(() => {
          this.isPlaying = true;
        })
        .catch((err) => {
          console.warn("Autoplay blocked or stream connection failed:", err);
        });
    }
  }

  pause() {
    if (this.audio && !this.audio.paused) {
      this.audio.pause();
      this.isPlaying = false;
    }
  }

  setVolume(vol: number) {
    if (typeof window !== "undefined") {
      localStorage.setItem("rabtv_bg_volume", vol.toString());
    }
    if (this.audio) {
      this.audio.volume = Math.max(0, Math.min(1, vol));
    }
  }

  getVolume(): number {
    if (this.audio) {
      return this.audio.volume;
    }
    return 0.5;
  }
}

export const bgAudio = new BackgroundAudioManager();
