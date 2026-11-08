// lib/background-audio.ts

export interface RadioStation {
  name: string;
  url: string;
  category: string;
}

// Helper function to parse raw .m3u / .m3u8 playlist text files
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

// 1. Permanently protected seasonal stations (Guaranteed not to be lost)
const protectedStations: Record<string, RadioStation[]> = {
  "Christmas": [
    { name: "Christmas Vinyl HD", url: "https://icecast.walmradio.com:8443/christmas", category: "Christmas" },
    { name: "109.0 FM Christmas Kids", url: "http://stream.dar.fm/97821", category: "Christmas" },
  ],
  "Valentine's": [
    { name: "LOVE RADIO Only Love Songs 70s80s90s", url: "http://shoutcast3.streamingmedia.it:3162/", category: "Valentine's" },
  ],
  "Halloween": [
    { name: "SomaFM Secret Agent (128k MP3)", url: "https://ice5.somafm.com/secretagent-128-mp3", category: "Halloween" },
  ],
};

// 2. Initialize dynamic station list incorporating protected seasonal stations
const dynamicStations: Record<string, RadioStation[]> = { ...protectedStations };

try {
  // Automatically glob all flat .m3u files inside the radio-stations directory using ?raw query
  const m3uFiles = import.meta.glob('../radio-stations/*.m3u', {
    query: '?raw',
    import: 'default',
    eager: true,
  });

  for (const [path, rawContent] of Object.entries(m3uFiles)) {
    const parts = path.split('/');
    const fileName = parts[parts.length - 1]; // e.g., "classic-rock.m3u"
    const baseName = fileName.replace(/\.[^/.]+$/, ""); // "classic-rock"
    
    // Format filename into a clean category name (e.g. "classic-rock" -> "Classic Rock", "2000s" -> "2000s")
    const category = baseName
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    const parsed = parseM3U(rawContent as string, category);

    if (parsed.length > 0) {
      if (!dynamicStations[category]) {
        dynamicStations[category] = [];
      }
      dynamicStations[category].push(...parsed);
    }
  }
} catch (err) {
  console.warn("Dynamic folder scanning skipped or unavailable, using fallback/protected stations.", err);
}

// Absolute fallback default if folder scanning fails or is empty
if (!dynamicStations["House"] && Object.keys(dynamicStations).length <= 3) {
  dynamicStations["House"] = [
    { name: "Dance Wave! | MP3", url: "https://dancewave.online/dance.mp3", category: "House" },
    { name: "1.FM - Deep House Radio", url: "http://strm112.1.fm/deephouse_mobile_mp3", category: "House" },
  ];
}

export const RADIO_STATIONS: Record<string, RadioStation[]> = dynamicStations;

class BackgroundAudioManager {
  private audio: HTMLAudioElement | null = null;
  private currentUrl: string = "";
  private isPlaying: boolean = false;

  constructor() {
    if (typeof window !== "undefined") {
      this.audio = new Audio();
      this.audio.loop = true;
      
      // Default volume to 50% (0.5), or load from localStorage if saved previously
      const savedVol = localStorage.getItem("rabtv_bg_volume");
      const initialVol = savedVol !== null ? parseFloat(savedVol) : 0.5;
      this.audio.volume = Math.max(0, Math.min(1, initialVol));
    }
  }

  getSeasonalStation(): RadioStation {
    const now = new Date();
    const month = now.getMonth() + 1; // 1-12
    const day = now.getDate();

    // Christmas Override: Dec 10 - Dec 28
    if (month === 12 && day >= 10 && day <= 28) {
      if (RADIO_STATIONS["Christmas"] && RADIO_STATIONS["Christmas"].length > 0) {
        return RADIO_STATIONS["Christmas"][0];
      }
    }
    // Valentine's Override: Feb 7 - Feb 15 (1 week before through day after)
    if (month === 2 && day >= 7 && day <= 15) {
      if (RADIO_STATIONS["Valentine's"] && RADIO_STATIONS["Valentine's"].length > 0) {
        return RADIO_STATIONS["Valentine's"][0];
      }
    }
    // Halloween Override: Oct 17 - Nov 1 (2 weeks before through day after)
    if ((month === 10 && day >= 17 && day <= 31) || (month === 11 && day === 1)) {
      if (RADIO_STATIONS["Halloween"] && RADIO_STATIONS["Halloween"].length > 0) {
        return RADIO_STATIONS["Halloween"][0];
      }
    }

    // Check user-selected station from localStorage
    const savedUrl = localStorage.getItem("rabtv_radio_url");
    if (savedUrl) {
      for (const catStations of Object.values(RADIO_STATIONS)) {
        const found = catStations.find(s => s.url === savedUrl);
        if (found) return found;
      }
    }

    // Absolute fallback default (First available station in the first category)
    const firstCategory = Object.values(RADIO_STATIONS)[0];
    return firstCategory ? firstCategory[0] : { name: "Default Stream", url: "https://dancewave.online/dance.mp3", category: "House" };
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
        this.audio.play().then(() => {
          this.isPlaying = true;
        }).catch(err => {
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
      this.audio.play().then(() => {
        this.isPlaying = true;
      }).catch(err => {
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
