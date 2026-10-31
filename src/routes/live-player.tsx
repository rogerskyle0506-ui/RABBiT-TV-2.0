import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { AppTheme, getSavedTheme } from '@/lib/settings';
import { fetchLiveCategories, fetchChannelsByCategory, LiveChannel } from '@/lib/live-feed-service';
import { logLiveChannelWatch } from '@/lib/watch-history';
import { getChannelDescription } from '@/lib/channel-descriptions';

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
}

type StreamStatus = 'checking' | 'live' | 'offline';

function LivePlayerComponent() {
  const { url: streamUrl, title, logo } = Route.useSearch();
  const navigate = useNavigate();
  const [appTheme, setAppTheme] = useState<AppTheme>('violet');
  const [suggestedChannels, setSuggestedChannels] = useState<LiveChannel[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState<boolean>(true);
  const [qualityLevels, setQualityLevels] = useState<QualityLevel[]>([]);
  const [selectedQuality, setSelectedQuality] = useState<number>(-1);
  const [streamStatus, setStreamStatus] = useState<StreamStatus>('checking');
  
  // Volume & Audio Control States
  const [volume, setVolume] = useState<number>(1.0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [previousVolume, setPreviousVolume] = useState<number>(1.0);
  const [showVolumeSlider, setShowVolumeSlider] = useState<boolean>(false);
  
  // 10-Second Offline Auto-Boot Timer State
  const [offlineCountdown, setOfflineCountdown] = useState<number>(10);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<any>(null);

  useEffect(() => {
    setAppTheme(getSavedTheme());
    const handleSettingsUpdate = () => setAppTheme(getSavedTheme());
    window.addEventListener('rabtv_settings_updated', handleSettingsUpdate);
    return () => window.removeEventListener('rabtv_settings_updated', handleSettingsUpdate);
  }, []);

  useEffect(() => {
    if (streamUrl && title) {
      logLiveChannelWatch({
        title,
        logo,
        streamUrl,
      });
    }
  }, [streamUrl, title, logo]);

  // Handle 10-second auto-boot countdown when stream is offline
  useEffect(() => {
    if (streamStatus !== 'offline') return;

    const timer = setInterval(() => {
      setOfflineCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          navigate({ to: '/live-tv' });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [streamStatus, navigate]);

  useEffect(() => {
    let isMounted = true;
    setLoadingSuggestions(true);

    async function loadSuggestions() {
      try {
        const categories = await fetchLiveCategories();
        const primaryCategory = categories[0] || 'All';
        const channels = await fetchChannelsByCategory(primaryCategory);
        if (isMounted) {
          const filtered = channels.filter((c) => c.streamUrl !== streamUrl);
          setSuggestedChannels(filtered.slice(0, 12));
          setLoadingSuggestions(false);
        }
      } catch (err) {
        console.error('Failed to load live feed suggestions:', err);
        if (isMounted) setLoadingSuggestions(false);
      }
    }

    void loadSuggestions();
    return () => {
      isMounted = false;
    };
  }, [streamUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !streamUrl) {
      setStreamStatus('offline');
      return;
    }

    setStreamStatus('checking');
    setOfflineCountdown(10); // Reset countdown on new stream load

    const handlePlaying = () => setStreamStatus('live');
    const handleError = () => setStreamStatus('offline');
    const handleStalled = () => {
      if (video.networkState === HTMLVideoElement.NETWORK_NO_SOURCE) {
        setStreamStatus('offline');
      }
    };

    video.addEventListener('playing', handlePlaying);
    video.addEventListener('error', handleError);
    video.addEventListener('stalled', handleStalled);

    // Safety timeout: if it doesn't load within 8 seconds, flag as offline
    const timeoutId = setTimeout(() => {
      if (video.paused && video.readyState < 2) {
        setStreamStatus('offline');
      }
    }, 8000);

    if (streamUrl.includes('.m3u8')) {
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = streamUrl;
        video.play()
          .then(() => setStreamStatus('live'))
          .catch(() => setStreamStatus('offline'));
      } else {
        const initHls = () => {
          const HlsClass = (window as any).Hls;
          if (HlsClass && HlsClass.isSupported()) {
            const hlsInstance = new HlsClass({
              liveSyncDurationCount: 3,
              liveMaxLatencyDurationCount: 10,
              maxBufferLength: 30,
              maxMaxBufferLength: 60,
              enableWorker: true,
              lowLatencyMode: true,
            });

            hlsRef.current = hlsInstance;
            hlsInstance.loadSource(streamUrl);
            hlsInstance.attachMedia(video);

            hlsInstance.on(HlsClass.Events.MANIFEST_PARSED, () => {
              video.play()
                .then(() => setStreamStatus('live'))
                .catch(() => setStreamStatus('offline'));

              if (hlsInstance.levels && hlsInstance.levels.length > 0) {
                const levels: QualityLevel[] = hlsInstance.levels.map((lvl: any, idx: number) => ({
                  index: idx,
                  label: lvl.height ? `${lvl.height}p` : `${Math.round(lvl.bitrate / 1000)}k`,
                }));
                setQualityLevels(levels);
              }
            });

            hlsInstance.on(HlsClass.Events.ERROR, (_event: any, data: any) => {
              if (data.fatal) {
                setStreamStatus('offline');
                if (data.type === HlsClass.ErrorTypes.NETWORK_ERROR) {
                  hlsInstance.startLoad();
                } else if (data.type === HlsClass.ErrorTypes.MEDIA_ERROR) {
                  hlsInstance.recoverMediaError();
                } else {
                  hlsInstance.destroy();
                }
              }
            });
          } else {
            setStreamStatus('offline');
          }
        };

        if ((window as any).Hls) {
          initHls();
        } else {
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js';
          script.async = true;
          script.onload = () => initHls();
          script.onerror = () => setStreamStatus('offline');
          document.head.appendChild(script);
        }
      }
    } else {
      video.src = streamUrl;
      video.play()
        .then(() => setStreamStatus('live'))
        .catch(() => setStreamStatus('offline'));
    }

    return () => {
      clearTimeout(timeoutId);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('error', handleError);
      video.removeEventListener('stalled', handleStalled);
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
    };
  }, [streamUrl]);

  const handleQualityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const levelIndex = parseInt(e.target.value, 10);
    setSelectedQuality(levelIndex);
    if (hlsRef.current) {
      hlsRef.current.currentLevel = levelIndex;
    }
  };

  const themeStyles = useMemo(() => {
    switch (appTheme) {
      case 'red':
        return {
          bg: 'bg-gradient-to-br from-zinc-950 via-red-950/40 to-black',
          cardGradient: 'from-red-950/80 via-zinc-900 to-neutral-950',
          accentText: 'text-red-400',
          borderGlow: 'border-red-500/30',
        };
      case 'midnight':
        return {
          bg: 'bg-gradient-to-br from-slate-950 via-blue-950/40 to-slate-950',
          cardGradient: 'from-blue-950/80 via-slate-900 to-sky-950/80',
          accentText: 'text-sky-300',
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

  return (
    <div className={`min-h-screen ${themeStyles.bg} text-white transition-colors duration-300 pb-16 w-full max-w-full overflow-x-hidden box-border`}>
      <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 pt-3 space-y-4 box-border">
        
        {/* TOP CONTROL & CONSTRAINED HEADER CONTAINER */}
        <div className="w-full flex items-center justify-between p-3 rounded-2xl bg-black/60 backdrop-blur-md border border-white/10 shadow-lg box-border gap-2">
          <div className="flex items-center gap-2">
            <Link
              to="/live-tv"
              className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-slate-300 hover:text-white hover:bg-white/10 transition shrink-0"
            >
              <span>← TV Menu</span>
            </Link>

            {/* DYNAMIC HEALTH BADGE LOCKED BESIDE PILLBOX */}
            <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-xl bg-black/40 border border-white/10 shrink-0">
              {streamStatus === 'live' ? (
                <>
                  <span className="inline-block w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]"></span>
                  <span className="text-xs font-bold text-red-400 tracking-wider">LIVE</span>
                </>
              ) : streamStatus === 'offline' ? (
                <>
                  <span className="inline-flex items-center justify-center w-4 h-4 bg-red-600/90 text-white rounded-full text-[10px] font-black shadow-[0_0_8px_rgba(239,68,68,0.8)]">✕</span>
                  <span className="text-xs font-bold text-red-400 tracking-wider uppercase">OFF-AIR</span>
                </>
              ) : (
                <>
                  <span className="inline-block w-2.5 h-2.5 bg-yellow-500 rounded-full animate-ping"></span>
                  <span className="text-xs font-bold text-yellow-400 tracking-wider">CHECKING...</span>
                </>
              )}
            </div>
          </div>

          {qualityLevels.length > 0 && (
            <div className="bg-black/80 backdrop-blur-md px-2.5 py-1 rounded-xl border border-white/20 shrink-0">
              <select
                value={selectedQuality}
                onChange={handleQualityChange}
                className="bg-transparent text-[11px] sm:text-xs font-bold text-white focus:outline-none cursor-pointer"
              >
                <option value={-1} className="bg-zinc-900 text-white">Auto Quality</option>
                {qualityLevels.map((lvl) => (
                  <option key={lvl.index} value={lvl.index} className="bg-zinc-900 text-white">
                    {lvl.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* WIDER CHANNEL WATERMARK BANNER HEADER */}
        <div className={`relative w-full overflow-hidden p-4 sm:p-5 rounded-2xl bg-gradient-to-r ${themeStyles.cardGradient} border ${themeStyles.borderGlow} shadow-xl flex items-center justify-center box-border`}>
          {/* Faded Background Watermark Layer */}
          {logo && (
            <div className="absolute inset-0 opacity-15 pointer-events-none flex items-center justify-center overflow-hidden">
              <img src={logo} alt="" className="w-full h-full object-cover blur-md scale-125" />
            </div>
          )}

          {/* Larger & Wider Channel Logo / Title */}
          <div className="relative z-10 flex items-center justify-center w-[200px] sm:w-[280px] h-[70px] sm:h-[90px] shrink-0">
            {logo ? (
              <img
                src={logo}
                alt={title}
                className="w-full h-full object-contain drop-shadow-md"
              />
            ) : (
              <span className="text-base sm:text-xl font-black text-white tracking-wider uppercase">
                {title}
              </span>
            )}
          </div>
        </div>

        {/* PLAYER WRAPPER WITH VOLUME CONTROLS & OFFLINE OVERLAY */}
        <div className="w-full relative flex items-center justify-center rounded-2xl overflow-hidden bg-black border border-white/10 shadow-2xl max-h-[50vh] sm:max-h-[60vh] lg:max-h-[70vh] aspect-video box-border group">
          {streamUrl ? (
            <video
              ref={videoRef}
              controls
              autoPlay
              playsInline
              className="w-full h-full max-h-[50vh] sm:max-h-[60vh] lg:max-h-[70vh] object-contain rounded-2xl bg-black [&::-webkit-media-controls-timeline]:hidden"
            >
              Your browser does not support live video playback.
            </video>
          ) : (
            <div className="text-center text-slate-400 p-6 rounded-2xl bg-black/40 border border-white/10">
              <p className="text-xs sm:text-sm font-medium">Invalid or missing stream URL.</p>
            </div>
          )}

          {/* CUSTOM INTERACTIVE VOLUME CONTROL OVERLAY BUTTON */}
          <div className="absolute bottom-4 right-4 z-20 flex items-center">
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  if (videoRef.current) {
                    if (isMuted) {
                      videoRef.current.volume = previousVolume;
                      setVolume(previousVolume);
                      setIsMuted(false);
                    } else {
                      setPreviousVolume(volume);
                      videoRef.current.volume = 0;
                      setVolume(0);
                      setIsMuted(true);
                    }
                  }
                }}
                onMouseEnter={() => setShowVolumeSlider(true)}
                className="flex items-center justify-center h-10 w-10 rounded-xl bg-black/80 backdrop-blur-md border border-white/20 text-white hover:bg-zinc-800 transition shadow-xl font-bold text-base cursor-pointer"
                title="Adjust Volume"
              >
                {isMuted || volume === 0 ? "🔇" : volume < 0.5 ? "🔉" : "🔊"}
              </button>

              {/* Popup Vertical Volume Slider */}
              {showVolumeSlider && (
                <div 
                  className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 bg-black/95 border border-white/20 p-3 rounded-2xl shadow-2xl backdrop-blur-md flex flex-col items-center gap-2 z-30"
                  onMouseLeave={() => setShowVolumeSlider(false)}
                >
                  <span className="text-[10px] font-bold text-slate-300">
                    {Math.round(volume * 100)}%
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
                      if (videoRef.current) {
                        videoRef.current.volume = newVol;
                      }
                    }}
                    className="h-24 w-2 accent-violet-500 bg-slate-800 rounded-lg appearance-none cursor-pointer [writing-mode:vertical-lr] [direction:rtl]"
                  />
                </div>
              )}
            </div>
          </div>

          {/* OFFLINE / OFF-AIR OVERLAY & 10-SECOND AUTO-BOOT */}
          {streamStatus === 'offline' && (
            <div className="absolute inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-30">
              <div className="w-14 h-14 bg-red-500/20 border border-red-500/40 rounded-full flex items-center justify-center text-red-400 text-2xl mb-3 shadow-[0_0_20px_rgba(239,68,68,0.3)]">
                📡
              </div>
              <h3 className="text-lg sm:text-xl font-black text-white uppercase tracking-wider mb-1">
                Channel Is Off-Air
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 max-w-sm mb-6">
                This channel feed is currently offline or off-air. Returning to the Live TV menu in <span className="text-red-400 font-bold">{offlineCountdown}</span> seconds...
              </p>
              
              <div className="flex flex-col sm:flex-row gap-2.5 w-full max-w-xs">
                <Link
                  to="/live-tv"
                  className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold uppercase tracking-wider transition shadow-lg text-center flex items-center justify-center"
                >
                  Return to TV Menu Now
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* WRITTEN DESCRIPTION / CHANNEL NAME BELOW VIDEO */}
        <div className={`p-4 sm:p-5 rounded-2xl bg-gradient-to-r ${themeStyles.cardGradient} border ${themeStyles.borderGlow} shadow-xl flex flex-col items-center justify-center text-center space-y-2 box-border`}>
          <div className="flex items-center justify-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider border ${
              streamStatus === 'offline' 
                ? 'bg-red-500/20 border-red-500/40 text-red-300' 
                : 'bg-red-500/20 border-red-500/40 text-red-300'
            }`}>
              {streamStatus === 'offline' ? 'Off-Air / Broken Link' : 'Live Broadcast'}
            </span>
            <span className={`text-[11px] sm:text-xs font-medium ${themeStyles.accentText}`}>
              {streamStatus === 'offline' ? 'Stream Unavailable' : 'Streaming Now'}
            </span>
          </div>
          <h2 className="text-base sm:text-xl font-black text-white truncate max-w-full px-2">{title}</h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl px-2 leading-relaxed">
            {getChannelDescription(title)}
          </p>
        </div>

        {/* NAVIGATION EXPLORER */}
        <div className="w-full p-3.5 rounded-2xl bg-black/40 border border-white/10 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-3 box-border text-center sm:text-left">
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-white">Looking for something else?</h4>
            <p className="text-[11px] sm:text-xs text-slate-400">Discover full movies, TV series, and more.</p>
          </div>
          <Link
            to="/"
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-xs font-bold hover:bg-white/20 transition text-white text-center shrink-0"
          >
            Explore Movies & Shows →
          </Link>
        </div>

        {/* RECOMMENDED FEEDS */}
        <section className="pt-2">
          <div className="mb-3 flex items-center justify-between px-1">
            <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <span>✨ Recommended Live Feeds</span>
            </h3>
            <span className={`text-xs font-medium ${themeStyles.accentText}`}>
              {suggestedChannels.length} streams available
            </span>
          </div>

          {loadingSuggestions ? (
            <div className="flex justify-center items-center h-28">
              <div className={`animate-spin rounded-full h-8 w-8 border-t-2 ${themeStyles.accentText}`}></div>
            </div>
          ) : suggestedChannels.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 sm:gap-3">
              {suggestedChannels.map((channel) => (
                <Link
                  key={channel.channelId || channel.url}
                  to="/live-player"
                  search={{ url: channel.streamUrl, title: channel.title, logo: channel.logo || '' }}
                  className={`group flex flex-col items-center p-3 rounded-2xl bg-gradient-to-b ${themeStyles.cardGradient} border ${themeStyles.borderGlow} shadow-xl hover:-translate-y-1 transition text-center relative overflow-hidden box-border`}
                >
                  <div className="w-full h-20 sm:h-24 bg-black/50 rounded-xl mb-2 overflow-hidden flex items-center justify-center border border-white/10 relative p-2 box-border">
                    {channel.logo ? (
                      <img
                        src={channel.logo}
                        alt={channel.title}
                        className="w-full h-full object-contain group-hover:scale-105 transition-transform"
                        loading="lazy"
                      />
                    ) : (
                      <span className="text-xs font-bold text-slate-400">LIVE</span>
                    )}
                  </div>
                  <span className="text-xs font-bold line-clamp-2 text-white group-hover:text-slate-200">
                    {channel.title}
                  </span>
                  <p className="text-[10px] text-slate-400 line-clamp-2 mt-1 px-1">
                    {getChannelDescription(channel.title)}
                  </p>
                  <span className="mt-2 w-full py-1 text-[10px] font-bold rounded-full bg-black/60 border border-white/10 text-slate-300">
                    WATCH NOW →
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className={`rounded-2xl bg-gradient-to-r ${themeStyles.cardGradient} border ${themeStyles.borderGlow} p-6 text-center`}>
              <p className="text-xs text-slate-300">No other channels found in this section.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
