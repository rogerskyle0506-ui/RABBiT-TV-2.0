// lib/background-audio.ts

export interface RadioStation {
  name: string;
  url: string;
  category: string;
}

export const RADIO_STATIONS: Record<string, RadioStation[]> = {
  "House / EDM": [
    { name: "Dance Wave! | MP3", url: "https://dancewave.online/dance.mp3", category: "House / EDM" },
    { name: "1.FM - Deep House Radio", url: "http://strm112.1.fm/deephouse_mobile_mp3", category: "House / EDM" },
  ],
  "Rock": [
    { name: "RadioX UK", url: "http://icecast.thisisdax.com/RadioXUKMP3", category: "Rock" },
    { name: "Arrow Classic Rock", url: "http://stream.gal.io/arrow", category: "Rock" },
  ],
  "Jazz": [
    { name: "Adroit Jazz Underground", url: "https://icecast.walmradio.com:8443/jazz", category: "Jazz" },
    { name: "101 SMOOTH JAZZ", url: "http://jking.cdnstream1.com/b22139_128mp3", category: "Jazz" },
  ],
  "Hip Hop & R&B": [
    { name: "181.FM - Old School HipHop/RnB", url: "http://listen.181fm.com/181-oldschool_128k.mp3", category: "Hip Hop & R&B" },
    { name: "181.FM - The Beat (HipHop/R&B)", url: "http://listen.181fm.com/181-beat_128k.mp3", category: "Hip Hop & R&B" },
  ],
  "Top 100 / Pop": [
    { name: ".977 Hitz", url: "http://15313.live.streamtheworld.com/977_HITS_SC", category: "Top 100 / Pop" },
    { name: "Capital FM London", url: "http://media-ice.musicradio.com/CapitalMP3", category: "Top 100 / Pop" },
  ],
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

class BackgroundAudioManager {
  private audio: HTMLAudioElement | null = null;
  private currentUrl: string = "";
  private isPlaying: boolean = false;

  constructor() {
    if (typeof window !== "undefined") {
      this.audio = new Audio();
      this.audio.loop = true;
      this.audio.volume = 0.3; // Low ambient background volume by default
    }
  }

  getSeasonalStation(): RadioStation {
    const now = new Date();
    const month = now.getMonth() + 1; // 1-12
    const day = now.getDate();

    // Christmas Override: Dec 10 - Dec 28
    if (month === 12 && day >= 10 && day <= 28) {
      return RADIO_STATIONS["Christmas"][0];
    }
    // Valentine's Override: Feb 7 - Feb 15 (1 week before through day after)
    if (month === 2 && day >= 7 && day <= 15) {
      return RADIO_STATIONS["Valentine's"][0];
    }
    // Halloween Override: Oct 17 - Nov 1 (2 weeks before through day after)
    if ((month === 10 && day >= 17 && day <= 31) || (month === 11 && day === 1)) {
      return RADIO_STATIONS["Halloween"][0];
    }

    // Check user-selected station from localStorage
    const savedUrl = localStorage.getItem("rabtv_radio_url");
    if (savedUrl) {
      for (const catStations of Object.values(RADIO_STATIONS)) {
        const found = catStations.find(s => s.url === savedUrl);
        if (found) return found;
      }
    }

    // Absolute fallback default (First station under House / EDM)
    return RADIO_STATIONS["House / EDM"][0];
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
    if (this.audio) {
      this.audio.volume = Math.max(0, Math.min(1, vol));
    }
  }
}

export const bgAudio = new BackgroundAudioManager();
