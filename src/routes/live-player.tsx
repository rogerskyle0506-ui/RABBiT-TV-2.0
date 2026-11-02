import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { AppTheme, getSavedTheme } from '@/lib/settings';
import { fetchLiveCategories, fetchChannelsByCategory, LiveChannel } from '@/lib/live-feed-service';
import { logLiveChannelWatch } from '@/lib/watch-history';
import { getChannelDescription } from '@/lib/channel-descriptions';
import { AppWallpaper } from '@/components/AppWallpaper';

export const Route = createFileRoute('/live-player')({
  component: LivePlayerComponent,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      url: (search.url as string) || '',
      title: (search.title as string) || 'Live Stream',
      logo: (search.logo as string) || '',
    };
  },
});

interface QualityLevel {
  index: number;
  label: string;
  height?: number;
}

type StreamStatus = 'checking' | 'live' | 'offline';

function LivePlayerComponent() {
  const { url: streamUrl, title, logo } = Route.useSearch();
  const navigate = useNavigate();

  const [appTheme, setAppTheme] = useState<AppTheme>('violet');
  const [suggestedChannels, setSuggestedChannels] = useState<LiveChannel[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);
  const [qualityLevels, setQualityLevels] = useState<QualityLevel[]>([]);
  const [selectedQuality, setSelectedQuality] = useState<number>(-1);
  const [streamStatus, setStreamStatus] = useState<StreamStatus>('checking');
  const [volume, setVolume] = useState(1.0);
  const [isMuted, setIsMuted] = useState(false);
  const [previousVolume, setPreviousVolume] = useState(1.0);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [offlineCountdown, setOfflineCountdown] = useState(10);

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<any>(null);

  useEffect(() => {
    const handler = () => setAppTheme(getSavedTheme());
    handler();
    window.addEventListener('rabtv_settings_updated', handler);
    return () => window.removeEventListener('rabtv_settings_updated', handler);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoadingSuggestions(true);

    const loadSuggestions = async () => {
      try {
        const categories = await fetchLiveCategories();
        if (cancelled || !categories?.length) {
          setSuggestedChannels([]);
          setLoadingSuggestions(false);
          return;
        }

        const category = categories[0];
        const list = await fetchChannelsByCategory(category.id);
        if (!cancelled) {
          setSuggestedChannels(list.slice(0, 6));
        }
      } catch {
        if (!cancelled) {
          setSuggestedChannels([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingSuggestions(false);
        }
      }
    };

    void loadSuggestions();
    return () => {
      cancelled = true;
    };
  }, [streamUrl]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  const destroyHls = () => {
    if (hlsRef.current) {
      try {
        hlsRef.current.detachMedia();
        hlsRef.current.destroy();
      } catch {}
      hlsRef.current = null;
    }
  };

  const pickPreferredQualityIndex = (levels: QualityLevel[]) => {
    if (!levels.length) return -1;

    const preferredHeights = [2160, 1080, 720, 480, 360];
    for (const target of preferredHeights) {
      const match = levels.find((level) => level.height === target || (level.label && level.label.replace(/\D+/g, '') === String(target)));
      if (match) return match.index;
    }

    return 0;
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !streamUrl) {
      setStreamStatus('offline');
      return;
    }

    let cancelled = false;
    let timeoutId: number | null = null;

    setStreamStatus('checking');
    setOfflineCountdown(10);
    setQualityLevels([]);
    setSelectedQuality(-1);
    destroyHls();
    video.removeAttribute('src');
    video.load();

    const onPlaying = () => {
      if (!cancelled) setStreamStatus('live');
    };
    const onError = () => {
      if (!cancelled) setStreamStatus('offline');
    };
    const onStalled = () => {
      if (video.networkState === HTMLVideoElement.NETWORK_NO_SOURCE && !cancelled) {
        setStreamStatus('offline');
      }
    };

    video.addEventListener('playing', onPlaying);
    video.addEventListener('error', onError);
    video.addEventListener('stalled', onStalled);

    timeoutId = window.setTimeout(() => {
      if (!cancelled && video.paused && video.readyState < 2) {
        setStreamStatus('offline');
      }
    }, 8000);

    const startPlayback = () => {
      if (cancelled) return;

      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = streamUrl;
        video
          .play()
          .then(() => !cancelled && setStreamStatus('live'))
          .catch(() => !cancelled && setStreamStatus('offline'));
        return;
      }

      const HlsClass = (window as any).Hls;
      if (!HlsClass || !HlsClass.isSupported()) {
        setStreamStatus('offline');
        return;
      }

      const hlsInstance = new HlsClass({
        enableWorker: false,
        lowLatencyMode: false,
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 6,
        maxBufferLength: 12,
        maxMaxBufferLength: 24,
        backBufferLength: 8,
        startLevel: -1,
      });

      hlsRef.current = hlsInstance;
      hlsInstance.loadSource(streamUrl);
      hlsInstance.attachMedia(video);

      hlsInstance.on(HlsClass.Events.MANIFEST_PARSED, () => {
        if (cancelled) return;

        const levels = hlsInstance.levels.map((lvl: any, idx: number) => {
          let label = 'Auto';
          if (lvl.height) {
            if (lvl.height >= 2160) label = '4K';
            else if (lvl.height >= 1080) label = '1080p';
            else if (lvl.height >= 720) label = '720p';
            else if (lvl.height >= 480) label = '480p';
            else if (lvl.height >= 360) label = '360p';
            else label = `${lvl.height}p`;
          } else if (lvl.bitrate) {
            label = `${Math.round(lvl.bitrate / 1000)}k`;
          }

          return { index: idx, label, height: lvl.height ?? 0 };
        });

        setQualityLevels(levels);

        const preferredIndex = pickPreferredQualityIndex(levels);
        if (preferredIndex >= 0) {
          setSelectedQuality(preferredIndex);
          hlsInstance.currentLevel = preferredIndex;
        } else {
          setSelectedQuality(-1);
          hlsInstance.currentLevel = -1;
        }

        video
          .play()
          .then(() => !cancelled && setStreamStatus('live'))
          .catch(() => !cancelled && setStreamStatus('offline'));
      });

      hlsInstance.on(HlsClass.Events.ERROR, (_event: any, data: any) => {
        if (!data.fatal || cancelled) return;
        setStreamStatus('offline');

        if (data.type === HlsClass.ErrorTypes.NETWORK_ERROR) {
          hlsInstance.startLoad();
        } else if (data.type === HlsClass.ErrorTypes.MEDIA_ERROR) {
          hlsInstance.recoverMediaError();
        } else {
          destroyHls();
        }
      });
    };

    if (streamUrl.includes('.m3u8')) {
      if ((window as any).Hls) {
        startPlayback();
      } else {
        const existing = document.querySelector('script[data-hls-js]') as HTMLScriptElement | null;
        if (existing) {
          if ((window as any).Hls) {
            startPlayback();
          } else {
            existing.addEventListener('load', startPlayback, { once: true });
          }
        } else {
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js';
          script.async = true;
          script.dataset.hlsJs = 'true';
          script.onload = startPlayback;
          script.onerror = () => !cancelled && setStreamStatus('offline');
          document.head.appendChild(script);
        }
      }
    } else {
      video.src = streamUrl;
      video
        .play()
        .then(() => !cancelled && setStreamStatus('live'))
        .catch(() => !cancelled && setStreamStatus('offline'));
    }

    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('error', onError);
      video.removeEventListener('stalled', onStalled);
      destroyHls();
      video.removeAttribute('src');
      video.load();
    };
  }, [streamUrl]);

  const handleQualityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const levelIndex = Number(e.target.value);
    setSelectedQuality(levelIndex);
    if (hlsRef.current) {
      hlsRef.current.currentLevel = levelIndex;
    }
  };

  const toggleMute = () => {
    if (isMuted) {
      setVolume(previousVolume || 0.7);
      setIsMuted(false);
    } else {
      setPreviousVolume(volume);
      setVolume(0);
      setIsMuted(true);
    }
  };

  const themeStyles = useMemo(() => {
    switch (appTheme) {
      case 'red':
        return {
          bg: 'bg-gradient-to-br from-zinc-950 via-red-950/40 to-black',
          cardGradient: 'from-red-950/80 via-zinc-900 to-black',
          accentText: 'text-red-300',
          borderGlow: 'border-red-500/30',
        };
      case 'midnight':
        return {
          bg: 'bg-gradient-to-br from-slate-950 via-blue-950/40 to-slate-950',
          cardGradient: 'from-blue-950/80 via-slate-900 to-slate-950',
          accentText: 'text-blue-300',
          borderGlow: 'border-blue-500/30',
        };
      case 'emerald':
        return {
          bg: 'bg-gradient-to-br from-slate-950 via-emerald-950/40 to-slate-950',
          cardGradient: 'from-emerald-950/80 via-slate-900 to-teal-950/80',
          accentText: 'text-emerald-300',
          borderGlow: 'border-emerald-500/30',
        };
      case 'amber':
        return {
          bg: 'bg-gradient-to-br from-stone-950 via-yellow-950/40 to-neutral-950',
          cardGradient: 'from-yellow-950/80 via-stone-900 to-amber-950/80',
          accentText: 'text-amber-300',
          borderGlow: 'border-amber-500/30',
        };
      case 'cyan':
        return {
          bg: 'bg-gradient-to-br from-slate-950 via-cyan-950/40 to-slate-950',
          cardGradient: 'from-cyan-950/80 via-slate-900 to-blue-950/80',
          accentText: 'text-cyan-300',
          borderGlow: 'border-cyan-500/30',
        };
      case 'violet':
      default:
        return {
          bg: 'bg-gradient-to-br from-slate-950 via-purple-950/40 to-slate-950',
          cardGradient: 'from-purple-950/80 via-slate-900 to-indigo-950/80',
          accentText: 'text-violet-300',
          borderGlow: 'border-violet-500/30',
        };
    }
  }, [appTheme]);

  const qualityLabel =
    qualityLevels.find((level) => level.index === selectedQuality)?.label ??
    (selectedQuality === -1 ? 'Auto (1080p)' : 'Auto');

  return (
    <div className={`min-h-screen ${themeStyles.bg} text-white transition-colors duration-300 pb-16 w-full max-w-full overflow-x-hidden box-border relative`}>
      <AppWallpaper />
      <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 pt-3 space-y-4 box-border relative z-10">
        <div className="w-full flex items-center justify-between p-3 rounded-2xl bg-black/60 backdrop-blur-md border border-white/10 shadow-lg box-border gap-2">
          <div className="flex items-center gap-2">
            <Link
              to="/live-tv"
              className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-slate-300 hover:text-white hover:bg-white/10 transition shrink-0"
            >
              <span>← TV Menu</span>
            </Link>

            <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-xl bg-black/40 border border-white/10 shrink-0">
              {streamStatus === 'live' ? (
                <>
                  <span className="inline-block w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                  <span className="text-xs font-bold text-red-400 tracking-wider">LIVE</span>
                </>
              ) : streamStatus === 'offline' ? (
                <>
                  <span className="inline-flex items-center justify-center w-4 h-4 bg-red-600/90 text-white rounded-full text-[10px] font-black">✕</span>
                  <span className="text-xs font-bold text-red-400 tracking-wider uppercase">OFF-AIR</span>
                </>
              ) : (
                <>
                  <span className="inline-block w-2.5 h-2.5 bg-yellow-500 rounded-full animate-ping" />
                  <span className="text-xs font-bold text-yellow-400 tracking-wider">CHECKING...</span>
                </>
              )}
            </div>
          </div>

          {qualityLevels.length > 0 && (
            <div className="bg-black/80 backdrop-blur-md px-2.5 py-1 rounded-xl border border-white/20 shrink-0 max-w-[170px]">
              <label className="sr-only">Select player quality</label>
              <select
                value={selectedQuality}
                onChange={handleQualityChange}
                className="bg-transparent text-[11px] sm:text-xs font-bold text-white focus:outline-none cursor-pointer max-w-full"
              >
                <option value={-1} className="bg-zinc-900 text-white">
                  Auto (1080p)
                </option>
                {qualityLevels.map((lvl) => (
                  <option key={lvl.index} value={lvl.index} className="bg-zinc-900 text-white">
                    {lvl.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className={`relative w-full overflow-hidden p-4 sm:p-5 rounded-2xl bg-gradient-to-r ${themeStyles.cardGradient} border ${themeStyles.borderGlow} shadow-xl flex items-center justify-center box-border`}>
          {logo && (
            <div className="absolute inset-0 opacity-15 pointer-events-none flex items-center justify-center overflow-hidden">
              <img src={logo} alt="" className="w-full h-full object-cover blur-md scale-125" />
            </div>
          )}

          <div className="relative z-10 flex items-center justify-center w-[200px] sm:w-[280px] h-[70px] sm:h-[90px] shrink-0">
            {logo ? (
              <img src={logo} alt={title} className="w-full h-full object-contain drop-shadow-md" />
            ) : (
              <span className="text-base sm:text-xl font-black text-white tracking-wider uppercase">{title}</span>
            )}
          </div>
        </div>

        <div className="w-full relative flex items-center justify-center rounded-2xl overflow-hidden bg-black border border-white/10 shadow-2xl aspect-video box-border group">
          {streamUrl ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              controls={false}
              className="w-full h-full object-contain bg-black"
            >
              Your browser does not support live video playback.
            </video>
          ) : (
            <div className="text-center text-slate-400 p-6 rounded-2xl bg-black/40 border border-white/10">
              <p className="text-xs sm:text-sm font-medium">Invalid or missing stream URL.</p>
            </div>
          )}

          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-end justify-between gap-3 p-3 sm:p-4">
            <div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-white/15 bg-black/70 px-2 py-1.5 backdrop-blur-md">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">Q</span>
              {qualityLevels.length > 0 && (
                <select
                  value={selectedQuality}
                  onChange={handleQualityChange}
                  className="bg-transparent text-[11px] sm:text-xs font-bold text-white focus:outline-none cursor-pointer"
                >
                  <option value={-1} className="bg-zinc-900 text-white">
                    Auto (1080p)
                  </option>
                  {qualityLevels.map((lvl) => (
                    <option key={lvl.index} value={lvl.index} className="bg-zinc-900 text-white">
                      {lvl.label}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div
              className="pointer-events-auto relative"
              onMouseEnter={() => setShowVolumeSlider(true)}
              onMouseLeave={() => setShowVolumeSlider(false)}
            >
              <button
                type="button"
                onClick={toggleMute}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-black/80 backdrop-blur-md border border-white/20 text-white hover:bg-zinc-800 transition shadow-xl text-base"
                title="Volume / Mute"
              >
                {isMuted || volume === 0 ? '🔇' : volume < 0.45 ? '🔉' : '🔊'}
              </button>

              {showVolumeSlider && (
                <div className="absolute bottom-full right-0 mb-3 bg-black/95 border border-white/20 p-3 rounded-2xl shadow-2xl backdrop-blur-md flex flex-col items-center gap-2 z-30 min-w-[140px]">
                  <span className="text-[10px] font-bold text-slate-300">
                    {isMuted ? 0 : Math.round(volume * 100)}%
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={isMuted ? 0 : volume}
                    onChange={(e) => {
                      const newVol = parseFloat(e.target.value);
                      setVolume(newVol);
                      setIsMuted(newVol === 0);
                      if (newVol > 0) setPreviousVolume(newVol);
                    }}
                    className="h-24 w-2 accent-violet-500 bg-slate-800 rounded-lg appearance-none cursor-pointer [writing-mode:vertical-lr] [direction:rtl]"
                  />
                </div>
              )}
            </div>
          </div>

          {streamStatus === 'offline' && (
            <div className="absolute inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-30">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10 text-2xl">
                ⚠️
              </div>
              <p className="text-sm sm:text-base font-bold text-white">Stream Unavailable</p>
              <p className="mt-2 text-[11px] sm:text-xs text-slate-300 max-w-xs">
                This channel may be offline, broken, or rate-limited. Try another feed or refresh in a moment.
              </p>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="rounded-xl bg-white/10 px-3 py-1.5 text-xs font-bold text-white border border-white/10"
                >
                  Retry
                </button>
                <Link
                  to="/live-tv"
                  className="rounded-xl bg-violet-600 px-3 py-1.5 text-xs font-bold text-white"
                >
                  Return to TV Menu
                </Link>
              </div>
            </div>
          )}
        </div>

        <div className={`p-4 sm:p-5 rounded-2xl bg-gradient-to-r ${themeStyles.cardGradient} border ${themeStyles.borderGlow} shadow-xl flex flex-col items-center justify-center text-center space-y-2 box-border`}>
          <div className="flex items-center justify-center gap-2">
            <span className="rounded-full px-2 py-0.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider border bg-red-500/20 border-red-500/40 text-red-300">
              {streamStatus === 'offline' ? 'Off-Air / Broken Link' : 'Live Broadcast'}
            </span>
            <span className={`text-[11px] sm:text-xs font-medium ${themeStyles.accentText}`}>
              {streamStatus === 'offline' ? 'Stream Unavailable' : `Streaming Now • ${qualityLabel}`}
            </span>
          </div>

          <h1 className="text-lg sm:text-2xl font-black tracking-wide text-white">{title || 'Live Channel'}</h1>
          <p className="text-[11px] sm:text-xs text-slate-300 max-w-2xl leading-relaxed">
            {getChannelDescription(title || 'Live Channel') || 'Watching this live stream in real time.'}
          </p>
        </div>

        <div className="w-full">
          <div className="mb-3 flex items-center justify-between gap-2 px-1">
            <h2 className="text-sm sm:text-base font-black text-white uppercase tracking-[0.18em]">More Channels</h2>
            <button
              type="button"
              onClick={() => navigate('/live-tv')}
              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] sm:text-[11px] font-bold text-slate-200"
            >
              Browse All
            </button>
          </div>

          {loadingSuggestions ? (
            <div className="flex items-center justify-center rounded-2xl border border-white/10 bg-black/25 py-6 text-xs text-slate-400">
              Loading channels...
            </div>
          ) : suggestedChannels.length ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {suggestedChannels.map((channel) => (
                <Link
                  key={channel.channelId || channel.title}
                  to="/live-player"
                  search={{
                    url: channel.url,
                    title: channel.title,
                    logo: channel.logo || '',
                  }}
                  className="group rounded-2xl border border-white/10 bg-black/30 p-3 transition hover:border-violet-400/40 hover:bg-white/5"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative h-16 w-16 overflow-hidden rounded-xl bg-slate-900 border border-white/10">
                      {channel.logo ? (
                        <img src={channel.logo} alt={channel.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-xs font-bold text-slate-300">LIVE</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="block text-xs font-bold line-clamp-2 text-white group-hover:text-slate-200">
                        {channel.title}
                      </span>
                      <p className="text-[10px] text-slate-400 line-clamp-2 mt-1 px-1">
                        {getChannelDescription(channel.title)}
                      </p>
                    </div>
                  </div>
                  <span className="mt-3 inline-flex w-full justify-center py-1 text-[10px] font-bold rounded-full bg-black/60 border border-white/10 text-slate-300">
                    WATCH NOW →
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className={`rounded-2xl bg-gradient-to-r ${themeStyles.cardGradient} border ${themeStyles.borderGlow} p-6 text-center`}>
              <p className="text-xs text-slate-300">No additional channels are available right now.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default LivePlayerComponent;
