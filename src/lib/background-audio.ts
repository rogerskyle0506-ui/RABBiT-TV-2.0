// lib/background-audio.ts

export interface RadioStation {
  name: string;
  url: string;
  category: string;
}

export const RADIO_STATIONS: Record<string, RadioStation[]> = {
  default: [
    { name: "Dance Wave!", url: "https://dancewave.online/dance.mp3", category: "House / EDM" },
    { name: "1.FM - Deep House Radio", url: "http://strm112.1.fm/deephouse_mobile_mp3", category: "House / EDM" },
    { name: "RadioX UK", url: "http://icecast.thisisdax.com/RadioXUKMP3", category: "Rock" },
    { name: "Arrow Classic Rock", url: "http://stream.gal.io/arrow", category: "Rock" },
    { name: "Adroit Jazz Underground", url: "https://icecast.walmradio.com:8443/jazz", category: "Jazz" },
    { name: "101 SMOOTH JAZZ", url: "http://jking.cdnstream1.com/b22139_128mp3", category: "Jazz" },
    { name: "181.FM - Old School HipHop/RnB", url: "http://listen.181fm.com/181-oldschool_128k.mp3", category: "Hip Hop & R&B" },
    { name: ".977 Hitz", url: "http://15313.live.streamtheworld.com/977_HITS_SC", category: "Top 100 / Pop" },
  ],
  christmas: [
    { name: "Christmas Vinyl HD", url: "https://icecast.walmradio.com:8443/christmas", category: "Christmas" },
    { name: "109.0 FM Christmas Kids", url: "http://stream.dar.fm/97821", category: "Christmas" },
  ],
  valentines: [
    { name: "LOVE RADIO Only Love Songs", url: "http://shoutcast3.streamingmedia.it:3162/", category: "Valentine's" },
  ],
  halloween: [
    { name: "SomaFM Secret Agent", url: "https://ice5.somafm.com/secretagent-128-mp3", category: "Halloween" },
  ]
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

    // Christmas Override (Dec 1 - Dec 26)
    if (month === 12 && day <= 26) {
      return RADIO_STATIONS.christmas[0];
    }
    // Valentine's Override (Feb 10 - Feb 15)
    if (month === 2 && day >= 10 && day <= 15) {
      return RADIO_STATIONS.valentines[0];
    }
    // Halloween Override (Oct 25 - Oct 31)
    if (month === 10 && day >= 25 && day <= 31) {
      return RADIO_STATIONS.halloween[0];
    }

    // Default or user-selected station from localStorage
    const savedUrl = localStorage.getItem("rabtv_radio_url");
    if (savedUrl) {
      for (const cat of Object.values(RADIO_STATIONS)) {
        const found = cat.find(s => s.url === savedUrl);
        if (found) return found;
      }
    }

    // Absolute fallback default
    return RADIO_STATIONS.default[0];
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
