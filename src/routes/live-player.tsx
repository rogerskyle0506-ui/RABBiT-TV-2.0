import { createFileRoute, Link } from '@tanstack/react-router';
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { AppTheme, getSavedTheme } from '@/lib/settings';
import { fetchLiveCategories, fetchChannelsByCategory, LiveChannel } from '@/lib/live-feed-service';

export const Route = createFileRoute('/live-player')({
  component: LivePlayerComponent,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      url: (search.url as string) || '',
      title: (search.title as string) || 'Live Stream',
    };
  },
});

function LivePlayerComponent() {
  const { url: streamUrl, title } = Route.useSearch();
  const [appTheme, setAppTheme] = useState<AppTheme>('violet');
  const [suggestedChannels, setSuggestedChannels] = useState<LiveChannel[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState<boolean>(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    setAppTheme(getSavedTheme());
    const handleSettingsUpdate = () => setAppTheme(getSavedTheme());
    window.addEventListener('rabtv_settings_updated', handleSettingsUpdate);
    return () => window.removeEventListener('rabtv_settings_updated', handleSettingsUpdate);
  }, []);

  // Fetch recommended live feeds
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

  // HLS stream playback handler with optimized live configuration for streaming sticks
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !streamUrl) return;

    let hlsInstance: any = null;

    if (streamUrl.includes('.m3u8')) {
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS support (Safari / standard browser engines)
        video.src = streamUrl;
        video.addEventListener('loadedmetadata', () => {
          video.play().catch((err) => console.log('Autoplay deferred:', err));
        });
      } else {
        // Dynamic loader for HLS.js with strict memory and live-edge configs
        const initHls = () => {
          const HlsClass = (window as any).Hls;
          if (HlsClass && HlsClass.isSupported()) {
            hlsInstance = new HlsClass({
              liveSyncDurationCount: 3,         // Keep close to live edge
              liveMaxLatencyDurationCount: 10,  // Max allowed drift before jumping to live edge
              maxBufferLength: 30,              // Limit buffer to 30 seconds to prevent RAM crashes on sticks
              maxMaxBufferLength: 60,
              enableWorker: true,
              lowLatencyMode: true,
            });

            hlsInstance.loadSource(streamUrl);
            hlsInstance.attachMedia(video);

            hlsInstance.on(HlsClass.Events.MANIFEST_PARSED, () => {
              video.play().catch((err) => console.log('Autoplay deferred:', err));
            });

            // Error recovery to prevent freezing and app crashes on low-spec hardware
            hlsInstance.on(HlsClass.Events.ERROR, (_event: any, data: any) => {
              if (data.fatal) {
                switch (data.type) {
                  case HlsClass.ErrorTypes.NETWORK_ERROR:
                    console.warn('Network error encountered, attempting to recover...');
                    hlsInstance.startLoad();
                    break;
                  case HlsClass.ErrorTypes.MEDIA_ERROR:
                    console.warn('Media error encountered, attempting to recover...');
                    hlsInstance.recoverMediaError();
                    break;
                  default:
                    console.error('Fatal HLS error, destroying instance');
                    hlsInstance.destroy();
                    break;
                }
              }
            });
          }
        };

        if ((window as any).Hls) {
          initHls();
        } else {
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js';
          script.async = true;
          script.onload = () => initHls();
          document.head.appendChild(script);
        }
      }
    } else {
      video.src = streamUrl;
      video.play().catch((err) => console.log('Autoplay deferred:', err));
    }

    return () => {
      if (hlsInstance) {
        hlsInstance.destroy();
      }
    };
  }, [streamUrl]);

  const themeStyles = useMemo(() => {
    switch (appTheme) {
      case 'red':
        return {
          bg: 'bg-gradient-to-br from-zinc-950 via-red-950/40 to-black',
          cardGradient: 'from-red-950/80 via-zinc-900 to-neutral-950',
          btnActive: 'bg-gradient-to-r from-red-600 via-rose-600 to-orange-600 text-white shadow-lg shadow-red-600/30',
          accentText: 'text-red-400',
          borderGlow: 'border-red-500/30',
        };
      case 'midnight':
        return {
          bg: 'bg-gradient-to-br from-slate-950 via-blue-950/40 to-slate-950',
          cardGradient: 'from-blue-950/80 via-slate-900 to-sky-950/80',
          btnActive: 'bg-gradient-to-r from-blue-600 via-cyan-600 to-sky-600 text-white shadow-lg shadow-blue-600/30',
          accentText: 'text-sky-300',
          borderGlow: 'border-sky-500/30',
        };
      case 'emerald':
        return {
          bg: 'bg-gradient-to-br from-slate-950 via-emerald-950/40 to-slate-950',
          cardGradient: 'from-emerald-950/80 via-slate-900 to-teal-950/80',
          btnActive: 'bg-gradient-to-r from-emerald-600 via-teal-600 to-green-600 text-white shadow-lg shadow-emerald-600/30',
          accentText: 'text-emerald-300',
          borderGlow: 'border-emerald-500/30',
        };
      case 'amber':
        return {
          bg: 'bg-gradient-to-br from-stone-950 via-yellow-950/40 to-neutral-950',
          cardGradient: 'from-yellow-950/80 via-stone-900 to-amber-950/80',
          btnActive: 'bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 text-white shadow-lg shadow-amber-600/30',
          accentText: 'text-amber-300',
          borderGlow: 'border-amber-500/30',
        };
      case 'cyan':
        return {
          bg: 'bg-gradient-to-br from-slate-950 via-cyan-950/40 to-slate-950',
          cardGradient: 'from-cyan-950/80 via-slate-900 to-blue-950/80',
          btnActive: 'bg-gradient-to-r from-cyan-600 via-teal-600 to-blue-600 text-white shadow-lg shadow-cyan-600/30',
          accentText: 'text-cyan-300',
          borderGlow: 'border-cyan-500/30',
        };
      case 'violet':
      default:
        return {
          bg: 'bg-gradient-to-br from-slate-950 via-purple-950/40 to-slate-950',
          cardGradient: 'from-purple-950/80 via-slate-900 to-indigo-950/80',
          btnActive: 'bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 text-white shadow-lg shadow-violet-600/30',
          accentText: 'text-violet-300',
          borderGlow: 'border-violet-500/30',
        };
    }
  }, [appTheme]);

  return (
    <div className={`min-h-screen ${themeStyles.bg} text-white transition-colors duration-300 pb-20`}>
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-4 bg-black/70 backdrop-blur-xl border-b border-white/10 z-20 sticky top-0 shadow-lg">
        <Link
          to="/live-tv"
          className="text-xs sm:text-sm font-bold text-slate-300 hover:text-white flex items-center space-x-2 transition px-3 py-1.5 rounded-xl bg-white/5 border border-white/10"
        >
          <span>← Back to Live TV</span>
        </Link>
        <div className="flex items-center space-x-2.5">
          <h1 className="text-sm sm:text-base font-black truncate max-w-xs sm:max-w-md">{title}</h1>
          <span className="inline-block w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)] shrink-0"></span>
          <span className="text-[10px] font-bold text-red-400 tracking-wider shrink-0">LIVE</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4 space-y-6">
        {/* Main Video Player Container with custom CSS to hide timeline scrubbing for live feeds */}
        <div className="w-full relative flex items-center justify-center rounded-2xl overflow-hidden bg-black border border-white/10 shadow-2xl min-h-[300px] sm:min-h-[480px]">
          {streamUrl ? (
            <video
              ref={videoRef}
              controls
              autoPlay
              playsInline
              className="w-full max-h-[75vh] object-contain rounded-2xl bg-black [&::-webkit-media-controls-timeline]:hidden [&::-webkit-media-controls-seek-back-button]:hidden [&::-webkit-media-controls-seek-forward-button]:hidden"
              onError={(e) => console.error('Video stream error:', e)}
            >
              Your browser does not support live video playback.
            </video>
          ) : (
            <div className="text-center text-slate-400 p-8 rounded-2xl bg-black/40 border border-white/10">
              <p className="text-sm font-medium">Invalid or missing stream URL.</p>
            </div>
          )}
        </div>

        {/* Channel Information Header */}
        <div className={`p-4 sm:p-5 rounded-2xl bg-gradient-to-r ${themeStyles.cardGradient} border ${themeStyles.borderGlow} shadow-xl flex items-center justify-between`}>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="rounded-full bg-red-500/20 border border-red-500/40 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-300">
                Live Broadcast
              </span>
              <span className={`text-xs font-medium ${themeStyles.accentText}`}>Streaming Now</span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-white">{title}</h2>
          </div>

          <Link
            to="/"
            className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-bold hover:bg-white/10 transition text-slate-200"
          >
            Explore Movies & Shows
          </Link>
        </div>

        {/* Suggested Channels Grid */}
        <section className="pt-2">
          <div className="mb-3 flex items-center justify-between px-1">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <span>✨ Recommended Live Feeds</span>
            </h3>
            <span className={`text-xs font-medium ${themeStyles.accentText}`}>
              {suggestedChannels.length} streams available
            </span>
          </div>

          {loadingSuggestions ? (
            <div className="flex justify-center items-center h-32">
              <div className={`animate-spin rounded-full h-8 w-8 border-t-2 ${themeStyles.accentText}`}></div>
            </div>
          ) : suggestedChannels.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {suggestedChannels.map((channel) => (
                <Link
                  key={channel.id}
                  to="/live-player"
                  search={{ url: channel.streamUrl, title: channel.title }}
                  className={`group flex flex-col items-center p-3.5 rounded-2xl bg-gradient-to-b ${themeStyles.cardGradient} border ${themeStyles.borderGlow} shadow-xl hover:-translate-y-1 transition text-center relative overflow-hidden`}
                >
                  {channel.logo ? (
                    <img
                      src={channel.logo}
                      alt={channel.title}
                      className="w-14 h-14 object-contain mb-2.5 rounded-xl bg-black/40 p-2 border border-white/10 group-hover:scale-105 transition-transform"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-14 h-14 bg-white/5 rounded-xl mb-2.5 flex items-center justify-center text-slate-400 font-bold border border-white/10 text-xs">
                      LIVE
                    </div>
                  )}
                  <span className="text-xs font-bold line-clamp-2 text-white group-hover:text-slate-200">
                    {channel.title}
                  </span>
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
