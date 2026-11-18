// src/routes/live-player.tsx
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { AppTheme, getSavedTheme } from '@/lib/settings';
import {
  fetchLiveCategories,
  fetchChannelsByCategory,
  fetchAllChannels,
  LiveChannel,
} from '@/lib/live-feed-service';
import { logLiveChannelWatch } from '@/lib/watch-history';
import { getChannelDescription } from '@/lib/channel-descriptions';
import { AppWallpaper } from '@/components/AppWallpaper';
import { bgAudio } from '@/lib/background-audio';

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

// 1x1 transparent GIF prevents Android WebView / Android TV 14 from rendering the giant ugly default play icon poster
const TRANSPARENT_POSTER =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

function LivePlayerComponent() {
  const { url: streamUrl, title, logo } = Route.useSearch();
  const navigate = useNavigate();

  const [appTheme, setAppTheme] = useState<AppTheme>('violet');
  const [suggestedChannels, setSuggestedChannels] = useState<LiveChannel[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);
  const [qualityLevels, setQualityLevels] = useState<QualityLevel[]>([]);
  const [selectedQuality, setSelectedQuality] = useState<number>(-1);
  const [streamStatus, setStreamStatus] = useState<StreamStatus>('checking');
  const [retryNonce, setRetryNonce] = useState<number>(0);

  const [volume, setVolume] = useState(1.0);
  const [isMuted, setIsMuted] = useState(false);
  const [previousVolume, setPreviousVolume] = useState(1.0);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

  const [isPlaying, setIsPlaying] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<any>(null);
  const controlsTimeoutRef = useRef<number | null>(null);

  // Halt background radio audio to prevent clashing audio and free audio decoder RAM
  useEffect(() => {
    bgAudio.pause();
  }, [streamUrl]);

  // Log channel to Watch History when opened
  useEffect(() => {
    if (!streamUrl) return;
    logLiveChannelWatch({
      title: title || 'Live Channel',
      logo: logo || '',
      streamUrl,
      channelId: streamUrl,
    });
  }, [streamUrl, title, logo]);

  useEffect(() => {
    const handler = () => setAppTheme(getSavedTheme());
    handler();
    window.addEventListener('rabtv_settings_updated', handler);
    return () => window.removeEventListener('rabtv_settings_updated', handler);
  }, []);

  // Load deduplicated suggested channels without triggering background network probes (protects 2GB RAM sticks)
  useEffect(() => {
    let cancelled = false;
    setLoadingSuggestions(true);

    const loadSuggestions = async () => {
      try {
        const categories = await fetchLiveCategories();
        if (cancelled) return;

        let rawList: LiveChannel[] = [];
        if (categories && categories.length > 0) {
          const firstCat = categories[0] as any;
          const categoryKey =
            typeof firstCat === 'string' ? firstCat : firstCat?.id || 'Nz';
          rawList = await fetchChannelsByCategory(categoryKey, {
            probe: false,
            hideOffline: false,
          });
        } else {
          rawList = await fetchAllChannels({
            probe: false,
            hideOffline: false,
          });
        }

        if (cancelled) return;

        // Deduplicate by title and stream URL, and exclude the currently playing stream
        const seenNames = new Set<string>();
        const seenUrls = new Set<string>();
        const uniqueSuggestions: LiveChannel[] = [];

        for (const ch of rawList) {
          const targetUrl = (ch.streamUrl || ch.url || '').trim();
          const normTitle = (ch.title || '').trim().toLowerCase();
          if (!targetUrl || !normTitle) continue;
          if (targetUrl === streamUrl || normTitle === (title || '').trim().toLowerCase()) {
            continue;
          }
          if (seenNames.has(normTitle) || seenUrls.has(targetUrl)) {
            continue;
          }
          seenNames.add(normTitle);
          seenUrls.add(targetUrl);
          uniqueSuggestions.push(ch);
          if (uniqueSuggestions.length >= 6) break;
        }

        setSuggestedChannels(uniqueSuggestions);
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
  }, [streamUrl, title]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  const revealControlsTemporarily = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      window.clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = window.setTimeout(() => {
      setShowControls(false);
      setShowVolumeSlider(false);
    }, 4000);
  }, []);

  useEffect(() => {
    revealControlsTemporarily();
    return () => {
      if (controlsTimeoutRef.current) {
        window.clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [revealControlsTemporarily]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () =>
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!playerContainerRef.current) return;
    if (!document.fullscreenElement) {
      playerContainerRef.current.requestFullscreen().catch((err) => {
        console.error('Error attempting to enable fullscreen:', err);
      });
    } else {
      document.exitFullscreen().catch((err) => {
        console.error('Error attempting to exit fullscreen:', err);
      });
    }
  };

  const togglePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;
    revealControlsTemporarily();
    if (video.paused) {
      video
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => {});
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const destroyHls = useCallback(() => {
    if (hlsRef.current) {
      try {
        hlsRef.current.stopLoad();
        hlsRef.current.detachMedia();
        hlsRef.current.destroy();
      } catch {
        // Ignore teardown errors
      }
      hlsRef.current = null;
    }
  }, []);

  /**
   * 2GB RAM Streaming Stick Optimization:
   * Prefer 720p or 1080p by default instead of 2160p (4K) so low-RAM Android TV sticks
   * don't crash from MSE buffer exhaustion. Users can still manually pick 4K in the dropdown.
   */
  const pickPreferredQualityIndex = (levels: QualityLevel[]) => {
    if (!levels.length) return -1;
    const preferredHeights = [1080, 720, 480, 360];
    for (const target of preferredHeights) {
      const match = levels.find(
        (level) =>
          level.height === target ||
          (level.label && level.label.replace(/\D+/g, '') === String(target))
      );
      if (match) return match.index;
    }
    return -1; // Default to Hls.js ABR auto-level
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !streamUrl) {
      setStreamStatus('offline');
      return;
    }

    let cancelled = false;
    let timeoutId: number | null = null;
    let mediaRecoveryAttempts = 0;

    setStreamStatus('checking');
    setQualityLevels([]);
    setSelectedQuality(-1);
    destroyHls();
    video.pause();
    video.removeAttribute('src');
    video.load();

    const onPlaying = () => {
      if (!cancelled) {
        setStreamStatus('live');
        setIsPlaying(true);
      }
    };
    const onPause = () => {
      if (!cancelled) setIsPlaying(false);
    };
    const onError = () => {
      if (!cancelled && !hlsRef.current) {
        setStreamStatus('offline');
      }
    };
    const onStalled = () => {
      if (
        video.networkState === HTMLVideoElement.NETWORK_NO_SOURCE &&
        !cancelled
      ) {
        setStreamStatus('offline');
      }
    };

    video.addEventListener('playing', onPlaying);
    video.addEventListener('pause', onPause);
    video.addEventListener('error', onError);
    video.addEventListener('stalled', onStalled);

    timeoutId = window.setTimeout(() => {
      if (!cancelled && video.paused && video.readyState < 2) {
        setStreamStatus('offline');
      }
    }, 10000);

    const startPlayback = () => {
      if (cancelled) return;

      const HlsClass = (window as any).Hls;

      // Use Hls.js with strict 2GB RAM Stick memory caps when supported
      if (HlsClass && HlsClass.isSupported() && streamUrl.includes('.m3u8')) {
        const hlsInstance = new HlsClass({
          enableWorker: true, // Offloads demuxing to Web Worker so main UI thread never freezes
          lowLatencyMode: false,
          liveSyncDurationCount: 3,
          liveMaxLatencyDurationCount: 5,
          maxBufferLength: 6, // Keep only 6s forward buffer in RAM
          maxMaxBufferLength: 12, // Hard cap at 12s
          backBufferLength: 2, // Immediately purge watched segments older than 2s from RAM!
          maxBufferSize: 15 * 1000 * 1000, // Strict 15MB memory ceiling (down from 60MB default)
          capLevelToPlayerSize: true, // Never decode 4K segments into a 1080p/720p box
          startLevel: -1,
        });

        hlsRef.current = hlsInstance;
        hlsInstance.loadSource(streamUrl);
        hlsInstance.attachMedia(video);

        hlsInstance.on(HlsClass.Events.MANIFEST_PARSED, () => {
          if (cancelled) return;

          const levels: QualityLevel[] = hlsInstance.levels.map(
            (lvl: any, idx: number) => {
              let label = 'Auto';
              if (lvl.height) {
                if (lvl.height >= 2160) label = '4K UHD';
                else if (lvl.height >= 1080) label = '1080p HD';
                else if (lvl.height >= 720) label = '720p HD';
                else if (lvl.height >= 480) label = '480p';
                else if (lvl.height >= 360) label = '360p';
                else label = `${lvl.height}p`;
              } else if (lvl.bitrate) {
                label = `${Math.round(lvl.bitrate / 1000)} kbps`;
              }

              return { index: idx, label, height: lvl.height ?? 0 };
            }
          );

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
            .then(() => {
              if (!cancelled) {
                setStreamStatus('live');
                setIsPlaying(true);
              }
            })
            .catch(() => {
              // If autoplay with sound is blocked, try muted autoplay or show controls
              if (!cancelled) {
                setIsPlaying(false);
                setShowControls(true);
              }
            });
        });

        hlsInstance.on(HlsClass.Events.ERROR, (_event: any, data: any) => {
          if (!data.fatal || cancelled) return;

          if (data.type === HlsClass.ErrorTypes.NETWORK_ERROR) {
            hlsInstance.startLoad();
          } else if (
            data.type === HlsClass.ErrorTypes.MEDIA_ERROR &&
            mediaRecoveryAttempts < 2
          ) {
            mediaRecoveryAttempts++;
            hlsInstance.recoverMediaError();
          } else {
            setStreamStatus('offline');
            destroyHls();
          }
        });
        return;
      }

      // Fallback to native hardware HLS (Safari / iOS / Native Android ExoPlayer WebView)
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = streamUrl;
        video
          .play()
          .then(() => {
            if (!cancelled) {
              setStreamStatus('live');
              setIsPlaying(true);
            }
          })
          .catch(() => !cancelled && setStreamStatus('offline'));
        return;
      }

      setStreamStatus('offline');
    };

    if (streamUrl.includes('.m3u8')) {
      if ((window as any).Hls) {
        startPlayback();
      } else {
        const existing = document.querySelector(
          'script[data-hls-js]'
        ) as HTMLScriptElement | null;
        if (existing) {
          if ((window as any).Hls) {
            startPlayback();
          } else {
            existing.addEventListener('load', startPlayback, { once: true });
          }
        } else {
          const script = document.createElement('script');
          script.src =
            'https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js';
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
        .then(() => {
          if (!cancelled) {
            setStreamStatus('live');
            setIsPlaying(true);
          }
        })
        .catch(() => !cancelled && setStreamStatus('offline'));
    }

    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('error', onError);
      video.removeEventListener('stalled', onStalled);
      destroyHls();
      video.pause();
      video.removeAttribute('src');
      video.load();
    };
  }, [streamUrl, retryNonce, destroyHls]);

  const handleQualityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const levelIndex = Number(e.target.value);
    setSelectedQuality(levelIndex);
    if (hlsRef.current) {
      hlsRef.current.currentLevel = levelIndex;
    }
  };

  const handleResyncStream = () => {
    setRetryNonce((n) => n + 1);
  };

  const toggleMute = () => {
    revealControlsTemporarily();
    if (isMuted) {
      setVolume(previousVolume || 0.8);
      setIsMuted(false);
    } else {
      setPreviousVolume(volume > 0 ? volume : 0.8);
      setVolume(0);
      setIsMuted(true);
    }
  };

  const themeStyles = useMemo(() => {
    switch (appTheme) {
      case 'red':
        return {
          bg: 'bg-gradient-to-br from-zinc-950/90 via-red-950/40 to-black/95',
          accentText: 'text-red-400',
          accentBar: 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.95)]',
          badge: 'text-red-200 border-red-500/30 bg-red-950/60',
          ambient: 'from-red-600/20 via-rose-600/5 to-transparent',
          playerGlow:
            'shadow-[0_25px_70px_rgba(0,0,0,0.95),0_0_40px_rgba(239,68,68,0.22)]',
          laserLine: 'from-transparent via-red-500 to-amber-400',
          primaryBtn:
            'bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 text-white shadow-[0_0_20px_rgba(239,68,68,0.45)]',
          borderHover: 'hover:border-red-400/70',
        };
      case 'midnight':
        return {
          bg: 'bg-gradient-to-br from-slate-950/90 via-blue-950/40 to-slate-950/95',
          accentText: 'text-sky-300',
          accentBar: 'bg-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.95)]',
          badge: 'text-sky-200 border-blue-500/30 bg-blue-950/60',
          ambient: 'from-blue-600/20 via-sky-500/5 to-transparent',
          playerGlow:
            'shadow-[0_25px_70px_rgba(0,0,0,0.95),0_0_40px_rgba(56,189,248,0.22)]',
          laserLine: 'from-transparent via-sky-400 to-blue-500',
          primaryBtn:
            'bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500 text-slate-950 shadow-[0_0_20px_rgba(56,189,248,0.45)]',
          borderHover: 'hover:border-sky-400/70',
        };
      case 'emerald':
        return {
          bg: 'bg-gradient-to-br from-slate-950/90 via-emerald-950/40 to-slate-950/95',
          accentText: 'text-emerald-300',
          accentBar: 'bg-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.95)]',
          badge: 'text-emerald-200 border-emerald-500/30 bg-emerald-950/60',
          ambient: 'from-emerald-600/20 via-teal-500/5 to-transparent',
          playerGlow:
            'shadow-[0_25px_70px_rgba(0,0,0,0.95),0_0_40px_rgba(52,211,153,0.22)]',
          laserLine: 'from-transparent via-emerald-400 to-cyan-400',
          primaryBtn:
            'bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 text-slate-950 shadow-[0_0_20px_rgba(52,211,153,0.45)]',
          borderHover: 'hover:border-emerald-400/70',
        };
      case 'amber':
        return {
          bg: 'bg-gradient-to-br from-stone-950/90 via-yellow-950/40 to-neutral-950/95',
          accentText: 'text-amber-300',
          accentBar: 'bg-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.95)]',
          badge: 'text-amber-200 border-amber-500/30 bg-amber-950/60',
          ambient: 'from-amber-600/20 via-yellow-500/5 to-transparent',
          playerGlow:
            'shadow-[0_25px_70px_rgba(0,0,0,0.95),0_0_40px_rgba(245,158,11,0.22)]',
          laserLine: 'from-transparent via-amber-400 to-orange-500',
          primaryBtn:
            'bg-gradient-to-r from-amber-400 via-yellow-400 to-orange-500 text-slate-950 shadow-[0_0_20px_rgba(245,158,11,0.45)]',
          borderHover: 'hover:border-amber-400/70',
        };
      case 'cyan':
        return {
          bg: 'bg-gradient-to-br from-slate-950/90 via-cyan-950/40 to-slate-950/95',
          accentText: 'text-cyan-300',
          accentBar: 'bg-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.95)]',
          badge: 'text-cyan-200 border-cyan-500/30 bg-cyan-950/60',
          ambient: 'from-cyan-600/20 via-sky-500/5 to-transparent',
          playerGlow:
            'shadow-[0_25px_70px_rgba(0,0,0,0.95),0_0_40px_rgba(34,211,238,0.22)]',
          laserLine: 'from-transparent via-cyan-400 to-sky-500',
          primaryBtn:
            'bg-gradient-to-r from-cyan-400 via-teal-300 to-sky-400 text-slate-950 shadow-[0_0_20px_rgba(34,211,238,0.45)]',
          borderHover: 'hover:border-cyan-400/70',
        };
      case 'violet':
      default:
        return {
          bg: 'bg-gradient-to-br from-slate-950/90 via-purple-950/40 to-slate-950/95',
          accentText: 'text-violet-300',
          accentBar: 'bg-violet-500 shadow-[0_0_15px_rgba(139,92,246,0.95)]',
          badge: 'text-slate-200 border-white/15 bg-white/[0.06]',
          ambient: 'from-violet-600/20 via-fuchsia-500/5 to-transparent',
          playerGlow:
            'shadow-[0_25px_70px_rgba(0,0,0,0.95),0_0_40px_rgba(168,85,247,0.25)]',
          laserLine: 'from-transparent via-pink-500 to-cyan-400',
          primaryBtn:
            'bg-gradient-to-r from-cyan-400 via-sky-400 to-purple-500 text-slate-950 shadow-[0_0_20px_rgba(56,189,248,0.45)]',
          borderHover: 'hover:border-purple-400/70',
        };
    }
  }, [appTheme]);

  const qualityLabel =
    qualityLevels.find((level) => level.index === selectedQuality)?.label ??
    (selectedQuality === -1 ? 'Auto HD' : 'Auto');

  const channelDescription = useMemo(
    () =>
      getChannelDescription(title || 'Live Channel') ||
      'Live broadcast feed streaming in real time.',
    [title]
  );

  return (
    <div
      className={`min-h-screen ${themeStyles.bg} text-white transition-colors duration-300 pb-20 py-4 sm:py-6 px-3 sm:px-6 md:px-10 w-full max-w-full overflow-x-hidden box-border relative rounded-3xl`}
    >
      {/* Hide Android WebView's giant ugly default play overlay graphic */}
      <style>{`
        video::-webkit-media-controls {
          display: none !important;
        }
        video::-webkit-media-controls-start-playback-button {
          display: none !important;
          -webkit-appearance: none !important;
        }
      `}</style>

      <AppWallpaper />
      <div
        className={`absolute inset-x-0 -top-10 h-[28rem] bg-gradient-to-b ${themeStyles.ambient} blur-3xl z-0 pointer-events-none rounded-t-3xl`}
      />

      <div className="w-full max-w-6xl mx-auto space-y-5 box-border relative z-10">
        {/* Top Navigation Row: Sleek Side-by-Side Neon Glass Capsules */}
        <div className="w-full flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              to="/live-tv"
              className="group inline-flex items-center gap-2.5 rounded-full bg-slate-900/80 hover:bg-slate-900/95 backdrop-blur-xl pl-3.5 pr-2 py-1.5 border border-white/15 hover:border-purple-400/60 shadow-[0_4px_20px_rgba(0,0,0,0.6)] hover:shadow-[0_0_20px_rgba(168,85,247,0.35)] transition-all duration-300 transform active:scale-95 focus:outline-none focus:ring-4 focus:ring-purple-500/50"
            >
              <span className="text-slate-400 group-hover:text-white group-hover:-translate-x-0.5 transition-all text-xs font-bold">
                ‹
              </span>
              <span className="text-xs sm:text-sm font-semibold tracking-wide text-slate-100 group-hover:text-white">
                Live TV Guide
              </span>
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-tr from-purple-600/50 via-pink-500/40 to-cyan-400/50 border border-purple-300/50 text-[11px] text-white shadow-[0_0_12px_rgba(217,70,239,0.7)]">
                📡
              </span>
            </Link>

            <Link
              to="/"
              className="group inline-flex items-center gap-2 rounded-full bg-slate-900/65 hover:bg-slate-900/90 backdrop-blur-xl px-3.5 py-1.5 border border-white/10 hover:border-white/25 text-xs font-semibold text-slate-300 hover:text-white transition"
            >
              <span>⌂ Home</span>
            </Link>
          </div>

          {/* Right Live Telemetry Pill */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResyncStream}
              className="inline-flex items-center gap-1.5 rounded-full bg-slate-900/80 hover:bg-slate-800 border border-white/15 px-3 py-1.5 text-xs font-bold text-slate-200 hover:text-white shadow transition cursor-pointer"
              title="Reload & Resync Live Stream"
            >
              <span>↻ Resync</span>
            </button>

            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-950/85 backdrop-blur-xl border border-white/15 shadow-lg">
              {streamStatus === 'live' ? (
                <>
                  <span className="inline-block w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_10px_rgba(52,211,153,0.95)]" />
                  <span className="text-xs font-extrabold text-emerald-300 tracking-wider uppercase">
                    On Air • {qualityLabel}
                  </span>
                </>
              ) : streamStatus === 'offline' ? (
                <>
                  <span className="inline-block w-2.5 h-2.5 bg-red-500 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.9)]" />
                  <span className="text-xs font-extrabold text-red-400 tracking-wider uppercase">
                    Off-Air
                  </span>
                </>
              ) : (
                <>
                  <span className="inline-block w-2.5 h-2.5 bg-amber-400 rounded-full animate-ping" />
                  <span className="text-xs font-extrabold text-amber-300 tracking-wider uppercase">
                    Connecting…
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Theater-Grade Live Video Player Stage (Placed First for Instant Viewing) */}
        <div
          ref={playerContainerRef}
          onMouseMove={revealControlsTemporarily}
          onTouchStart={revealControlsTemporarily}
          className={`w-full relative flex items-center justify-center rounded-2xl sm:rounded-3xl overflow-hidden bg-black border border-white/20 aspect-video box-border group select-none ${themeStyles.playerGlow}`}
        >
          {streamUrl ? (
            <video
              ref={videoRef}
              poster={TRANSPARENT_POSTER}
              autoPlay
              playsInline
              controls={false}
              onClick={togglePlayPause}
              className="w-full h-full object-contain bg-black cursor-pointer"
            />
          ) : (
            <div className="text-center text-slate-400 p-6 rounded-2xl bg-slate-950/80 border border-white/10">
              <p className="text-xs sm:text-sm font-bold">
                Invalid or missing stream URL.
              </p>
            </div>
          )}

          {/* Subtle Top-Left Channel Watermark Badge inside Player HUD */}
          <div
            className={`absolute top-3.5 left-3.5 z-20 flex items-center gap-2.5 rounded-2xl bg-slate-950/75 backdrop-blur-xl border border-white/15 px-3 py-1.5 shadow-xl pointer-events-none transition-opacity duration-300 ${
              showControls ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {logo && (
              <img
                src={logo}
                alt=""
                className="h-6 w-auto max-w-[70px] object-contain drop-shadow"
              />
            )}
            <span className="text-xs font-extrabold text-white tracking-wide truncate max-w-[180px] sm:max-w-xs">
              {title}
            </span>
          </div>

          {/* Connecting / Buffering Shimmer Overlay (Replaces Android's ugly default play graphic) */}
          {streamStatus === 'checking' && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/75 backdrop-blur-sm pointer-events-none gap-3">
              {logo && (
                <img
                  src={logo}
                  alt={title}
                  className="h-14 sm:h-16 w-auto object-contain opacity-90 drop-shadow-[0_4px_20px_rgba(255,255,255,0.2)] mb-1"
                />
              )}
              <div
                className={`h-9 w-9 rounded-full border-2 border-t-transparent animate-spin ${themeStyles.accentText}`}
              />
              <span className="text-xs font-extrabold tracking-widest uppercase text-slate-200">
                Tuning Live Broadcast…
              </span>
            </div>
          )}

          {/* High-End Glassmorphic Vector Control Bar (Bottom HUD) */}
          <div
            className={`absolute inset-x-0 bottom-0 z-20 pt-12 pb-3 px-3 sm:px-5 bg-gradient-to-t from-black/95 via-black/70 to-transparent transition-opacity duration-300 ${
              showControls
                ? 'opacity-100 pointer-events-auto'
                : 'opacity-0 pointer-events-none'
            }`}
          >
            <div className="flex items-center justify-between gap-2 sm:gap-4 rounded-2xl bg-slate-950/85 backdrop-blur-2xl border border-white/15 px-3 sm:px-4 py-2.5 shadow-[0_10px_30px_rgba(0,0,0,0.85)]">
              {/* Left Controls: Play/Pause + Live Pulse Indicator + Resync */}
              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={togglePlayPause}
                  className={`flex h-10 w-10 items-center justify-center rounded-xl transition transform active:scale-95 cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-400 ${themeStyles.primaryBtn}`}
                  title={isPlaying ? 'Pause' : 'Play'}
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? (
                    <svg
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="w-5 h-5"
                    >
                      <rect x="6" y="5" width="4" height="14" rx="1.2" />
                      <rect x="14" y="5" width="4" height="14" rx="1.2" />
                    </svg>
                  ) : (
                    <svg
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="w-5 h-5 ml-0.5"
                    >
                      <path d="M6 4.75a1.25 1.25 0 0 1 1.9-.1l11.25 7.25a1.25 1.25 0 0 1 0 2.1L7.9 21.25A1.25 1.25 0 0 1 6 20.2V4.75Z" />
                    </svg>
                  )}
                </button>

                {/* Live Edge Badge */}
                <button
                  type="button"
                  onClick={handleResyncStream}
                  className="hidden xs:inline-flex items-center gap-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 px-3 py-2 text-[11px] font-extrabold uppercase tracking-wider text-white transition cursor-pointer"
                  title="Click to jump to live edge"
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      streamStatus === 'live'
                        ? 'bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.9)]'
                        : 'bg-amber-400'
                    }`}
                  />
                  <span>LIVE</span>
                </button>

                {/* Quality Selector Pill */}
                {qualityLevels.length > 0 && (
                  <div className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.06] hover:bg-white/[0.1] px-2.5 sm:px-3 py-2 transition">
                    <span className="hidden sm:inline text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                      HD:
                    </span>
                    <select
                      value={selectedQuality}
                      onChange={handleQualityChange}
                      className="bg-transparent text-[11px] sm:text-xs font-extrabold text-white focus:outline-none cursor-pointer"
                    >
                      <option value={-1} className="bg-slate-950 text-white">
                        Auto ({qualityLabel})
                      </option>
                      {qualityLevels.map((lvl) => (
                        <option
                          key={lvl.index}
                          value={lvl.index}
                          className="bg-slate-950 text-white"
                        >
                          {lvl.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Right Controls: Clean Vector Volume + Inline Slider + Fullscreen + Hide HUD */}
              <div className="flex items-center gap-2 sm:gap-2.5">
                {/* Volume Control Group */}
                <div
                  className="relative flex items-center gap-2 rounded-xl bg-white/[0.06] border border-white/10 px-2 py-1.5"
                  onMouseEnter={() => setShowVolumeSlider(true)}
                  onMouseLeave={() => setShowVolumeSlider(false)}
                >
                  <button
                    type="button"
                    onClick={toggleMute}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-200 hover:text-white hover:bg-white/10 transition cursor-pointer focus:outline-none"
                    title={isMuted || volume === 0 ? 'Unmute' : 'Mute'}
                    aria-label="Toggle Mute"
                  >
                    {isMuted || volume === 0 ? (
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="w-4 h-4 text-red-400"
                      >
                        <path d="M11 5 6 9H2v6h4l5 4V5Z" />
                        <line x1="22" y1="9" x2="16" y2="15" />
                        <line x1="16" y1="9" x2="22" y2="15" />
                      </svg>
                    ) : (
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="w-4 h-4 text-cyan-300"
                      >
                        <path d="M11 5 6 9H2v6h4l5 4V5Z" />
                        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                        {volume > 0.5 && (
                          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                        )}
                      </svg>
                    )}
                  </button>

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
                    className={`w-16 sm:w-24 h-1.5 accent-cyan-400 bg-slate-800 rounded-lg appearance-none cursor-pointer transition-all ${
                      showVolumeSlider ? 'inline-block' : 'hidden sm:inline-block'
                    }`}
                    aria-label="Volume"
                  />
                </div>

                {/* Fullscreen Vector Button */}
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.06] hover:bg-white/[0.15] border border-white/15 text-slate-100 hover:text-white transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
                  aria-label="Fullscreen Toggle"
                >
                  {isFullscreen ? (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="w-4 h-4"
                    >
                      <path d="M8 3v3a2 2 0 0 1-2 2H3" />
                      <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
                      <path d="M3 16h3a2 2 0 0 1 2 2v3" />
                      <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
                    </svg>
                  ) : (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="w-4 h-4"
                    >
                      <path d="M15 3h6v6" />
                      <path d="M9 21H3v-6" />
                      <path d="M21 3l-7 7" />
                      <path d="M3 21l7-7" />
                    </svg>
                  )}
                </button>

                {/* Hide HUD / Exit Fullscreen Button */}
                <button
                  type="button"
                  onClick={() => {
                    if (document.fullscreenElement) {
                      document.exitFullscreen().catch(() => {});
                    }
                    setShowControls(false);
                  }}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.06] hover:bg-red-600/80 border border-white/15 hover:border-red-400 text-slate-300 hover:text-white transition cursor-pointer focus:outline-none"
                  title="Hide Controls"
                  aria-label="Hide Controls"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-4 h-4"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Offline / Recovery Overlay */}
          {streamStatus === 'offline' && (
            <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center z-30">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-red-500/40 bg-red-500/10 text-2xl shadow-[0_0_25px_rgba(239,68,68,0.3)]">
                📡
              </div>
              <p className="text-base sm:text-lg font-black text-white">
                Broadcast Feed Unavailable
              </p>
              <p className="mt-1.5 text-xs text-slate-400 max-w-sm leading-relaxed">
                This live stream timed out, is temporarily off-air, or requires a
                stream resync.
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={handleResyncStream}
                  className={`rounded-xl px-5 py-2.5 text-xs font-extrabold tracking-wide transition cursor-pointer ${themeStyles.primaryBtn}`}
                >
                  ↻ Retry Stream Now
                </button>
                <Link
                  to="/live-tv"
                  className="rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 px-5 py-2.5 text-xs font-bold text-white transition"
                >
                  Return to Live TV Guide
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Unified Cinema Broadcast Deck (Combines Logo Showcase + Channel Title + Live Metadata + Synopsis) */}
        <div className="relative overflow-hidden w-full rounded-3xl border border-white/15 bg-slate-950/85 backdrop-blur-2xl p-5 sm:p-7 shadow-[0_16px_50px_rgba(0,0,0,0.75)] flex flex-col sm:flex-row items-center sm:items-start gap-5 text-center sm:text-left">
          {/* Upfront High-Contrast Channel Logo Stage */}
          <div className="relative w-32 h-24 sm:w-40 sm:h-28 shrink-0 rounded-2xl bg-gradient-to-b from-slate-900 via-black to-slate-950 border border-white/15 flex items-center justify-center p-3.5 shadow-inner overflow-hidden">
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  'radial-gradient(circle at center, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.03) 50%, transparent 75%)',
              }}
            />
            {logo ? (
              <img
                src={logo}
                alt={title}
                className="relative z-10 max-h-full max-w-full object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.85)]"
              />
            ) : (
              <span className="relative z-10 text-base font-black text-white uppercase tracking-wider">
                {title}
              </span>
            )}
          </div>

          {/* Channel Details & Status Pills */}
          <div className="flex-1 min-w-0 space-y-2.5">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <span
                className={`rounded-full border px-3 py-0.5 text-[10px] font-extrabold uppercase tracking-widest ${
                  streamStatus === 'offline'
                    ? 'bg-red-950/70 border-red-500/40 text-red-300'
                    : 'bg-emerald-950/70 border-emerald-400/40 text-emerald-300'
                }`}
              >
                {streamStatus === 'offline'
                  ? '○ Off-Air / Standby'
                  : '● Live Broadcast'}
              </span>
              <span
                className={`rounded-full border px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider ${themeStyles.badge}`}
              >
                {streamStatus === 'offline'
                  ? 'Feed Unavailable'
                  : `Quality: ${qualityLabel}`}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white truncate">
              {title || 'Live Channel'}
            </h1>

            <p className="text-xs sm:text-sm text-slate-300/95 max-w-3xl leading-relaxed">
              {channelDescription}
            </p>
          </div>

          {/* Neon Bottom Laser Accent Line */}
          <div
            className={`absolute inset-x-6 bottom-0 h-[2px] bg-gradient-to-r ${themeStyles.laserLine} opacity-85 shadow-[0_0_15px_rgba(236,72,153,0.9)]`}
          />
        </div>

        {/* More Live Channels Section (Deduplicated & Upfront Logos) */}
        <div className="w-full pt-2 space-y-4">
          <div className="flex items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-2.5">
              <span
                className={`w-1.5 h-6 rounded-full ${themeStyles.accentBar}`}
              />
              <h2 className="text-base sm:text-xl font-black tracking-tight text-white">
                More Live Channels
              </h2>
            </div>

            <button
              type="button"
              onClick={() => navigate({ to: '/live-tv' })}
              className="rounded-full border border-white/15 bg-white/[0.06] hover:bg-white/[0.15] px-4 py-1.5 text-xs font-bold text-white transition cursor-pointer"
            >
              Browse All Channels →
            </button>
          </div>

          {loadingSuggestions ? (
            <div className="flex items-center justify-center rounded-3xl border border-white/10 bg-slate-950/70 py-10 text-xs font-bold text-slate-400">
              Loading live channels…
            </div>
          ) : suggestedChannels.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 sm:gap-4">
              {suggestedChannels.map((channel) => {
                const targetUrl = channel.streamUrl || channel.url;
                return (
                  <Link
                    key={channel.channelId || targetUrl || channel.title}
                    to="/live-player"
                    search={{
                      url: targetUrl,
                      title: channel.title,
                      logo: channel.logo || '',
                    }}
                    className={`group relative flex flex-col justify-between rounded-3xl border border-white/15 ${themeStyles.borderHover} bg-slate-950/85 backdrop-blur-xl p-3.5 transition-all duration-300 hover:-translate-y-1.5 shadow-xl overflow-hidden text-center`}
                  >
                    <div className="relative w-full h-24 sm:h-28 rounded-2xl bg-gradient-to-b from-slate-900 via-black to-slate-950 border border-white/10 mb-2.5 p-3 flex items-center justify-center overflow-hidden">
                      <div
                        className="absolute inset-0 pointer-events-none"
                        style={{
                          background:
                            'radial-gradient(circle at center, rgba(255,255,255,0.14) 0%, transparent 72%)',
                        }}
                      />
                      {channel.logo ? (
                        <img
                          src={channel.logo}
                          alt={channel.title}
                          className="relative z-10 max-h-full max-w-full object-contain group-hover:scale-110 transition-transform duration-300 drop-shadow"
                          loading="lazy"
                        />
                      ) : (
                        <span className="relative z-10 text-xs font-black text-slate-300">
                          LIVE
                        </span>
                      )}
                    </div>

                    <div className="space-y-1">
                      <span className="block text-xs sm:text-sm font-black line-clamp-1 text-white">
                        {channel.title}
                      </span>
                      <p className="text-[10px] text-slate-400 line-clamp-2 leading-snug min-h-[2rem]">
                        {getChannelDescription(channel.title)}
                      </p>
                    </div>

                    <span className="mt-2.5 inline-flex w-full items-center justify-center gap-1 py-1.5 text-[10px] font-extrabold uppercase tracking-wider rounded-xl bg-white/[0.06] group-hover:bg-white/[0.15] border border-white/10 text-white transition">
                      <span>▶ Watch Live</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="rounded-3xl bg-slate-950/80 border border-white/15 p-8 text-center">
              <p className="text-xs font-bold text-slate-300">
                No additional channels are available right now.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default LivePlayerComponent;
