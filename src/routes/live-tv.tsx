import { createFileRoute, Link } from '@tanstack/react-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchLiveCategories,
  fetchChannelsByCategory,
  fetchAllChannels,
  getCatalogHealthStats,
  refreshLiveHealth,
  type LiveChannel,
  type CatalogHealthStats,
} from '../lib/live-feed-service';
import { AppTheme, getSavedTheme } from '@/lib/settings';
import { ScrollPillBar } from '@/components/scroll-pill-bar';
import { getChannelDescription } from '@/lib/channel-descriptions';
import { channelCategories } from '@/lib/channel-categories';
import { AppWallpaper } from '@/components/AppWallpaper';

export const Route = createFileRoute('/live-tv')({
  component: LiveTvComponent,
});

const categoryMapping: Record<string, string> = {
  Nz: 'Atlantic Canada',
  Sydney: 'Toronto',
  Melbourne: 'Vancouver',
  Brisbane: 'Montreal',
  Perth: 'Calgary',
  Adelaide: 'Ottawa',
  Canberra: 'National',
  Darwin: 'Northern',
  Hobart: 'Pacific',
  Au: 'Canada Feeds',
  World: 'International',
};

const reverseCategoryMapping: Record<string, string> = Object.fromEntries(
  Object.entries(categoryMapping).map(([orig, disp]) => [disp, orig])
);

function HealthDot({ health }: { health?: LiveChannel['health'] }) {
  const color =
    health === 'online'
      ? 'bg-emerald-400 shadow-emerald-400/50'
      : health === 'offline'
        ? 'bg-red-500 shadow-red-500/40'
        : health === 'checking'
          ? 'bg-slate-400 animate-pulse'
          : 'bg-amber-400 shadow-amber-400/40';

  const title =
    health === 'online'
      ? 'Online'
      : health === 'offline'
        ? 'Offline'
        : health === 'checking'
          ? 'Checking…'
          : 'Status unknown';

  return (
    <span
      title={title}
      className={`absolute top-2 right-2 z-10 h-2.5 w-2.5 rounded-full shadow ${color}`}
    />
  );
}

function LiveTvComponent() {
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const genreOptions = ['All Genres', ...Object.keys(channelCategories)];
  const [selectedGenre, setSelectedGenre] = useState<string>('All Genres');

  const [channels, setChannels] = useState<LiveChannel[]>([]);
  const [stats, setStats] = useState<CatalogHealthStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [probing, setProbing] = useState<boolean>(false);
  const [appTheme, setAppTheme] = useState<AppTheme>('violet');

  useEffect(() => {
    setAppTheme(getSavedTheme());
    const handleSettingsUpdate = () => setAppTheme(getSavedTheme());
    window.addEventListener('rabtv_settings_updated', handleSettingsUpdate);
    return () => window.removeEventListener('rabtv_settings_updated', handleSettingsUpdate);
  }, []);

  useEffect(() => {
    fetchLiveCategories().then((cats) => {
      const displayCats = cats.map((cat) => categoryMapping[cat] || cat);
      setCategories(['All', ...displayCats]);
      setSelectedCategory('All');
    });
  }, []);

  const loadFilteredChannels = useCallback(
    async (opts?: { forceProbe?: boolean }) => {
      setLoading(true);
      setProbing(true);
      try {
        let baseChannels: LiveChannel[] = [];

        if (selectedCategory === 'All') {
          baseChannels = await fetchAllChannels({
            probe: true,
            hideOffline: true,
            forceProbe: opts?.forceProbe,
          });
        } else {
          const originalCategory =
            reverseCategoryMapping[selectedCategory] || selectedCategory;
          baseChannels = await fetchChannelsByCategory(originalCategory, {
            probe: true,
            hideOffline: true,
            forceProbe: opts?.forceProbe,
          });
        }

        if (selectedGenre !== 'All Genres') {
          const allowedChannelNames = channelCategories[selectedGenre] || [];
          baseChannels = baseChannels.filter((c) =>
            allowedChannelNames.includes(c.title)
          );
        }

        setChannels(baseChannels);
        setStats(getCatalogHealthStats(baseChannels));
      } catch (err) {
        console.error('Failed to load channels:', err);
      } finally {
        setLoading(false);
        setProbing(false);
      }
    },
    [selectedCategory, selectedGenre]
  );

  useEffect(() => {
    let isMounted = true;
    void (async () => {
      await loadFilteredChannels();
      if (!isMounted) return;
    })();
    return () => {
      isMounted = false;
    };
  }, [loadFilteredChannels]);

  const handleRefreshHealth = async () => {
    setProbing(true);
    try {
      await refreshLiveHealth();
      await loadFilteredChannels({ forceProbe: true });
    } finally {
      setProbing(false);
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
          borderGlow: 'border-sky-500/30',
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

  const getPrimaryBgColor = (theme: AppTheme) => {
    switch (theme) {
      case 'red':
        return 'bg-gradient-to-r from-red-600 via-rose-600 to-orange-600 text-white shadow-lg shadow-red-600/30';
      case 'midnight':
        return 'bg-gradient-to-r from-blue-600 via-cyan-600 to-sky-600 text-white shadow-lg shadow-blue-600/30';
      case 'emerald':
        return 'bg-gradient-to-r from-emerald-600 via-teal-600 to-green-600 text-white shadow-lg shadow-emerald-600/30';
      case 'amber':
        return 'bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 text-white shadow-lg shadow-amber-600/30';
      case 'cyan':
        return 'bg-gradient-to-r from-cyan-600 via-teal-600 to-blue-600 text-white shadow-lg shadow-cyan-600/30';
      case 'violet':
      default:
        return 'bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 text-white shadow-lg shadow-violet-600/30';
    }
  };

  return (
    <main
      className={`min-h-screen ${themeStyles.bg} text-slate-100 transition-colors duration-300 pb-20 px-4 sm:px-6 w-full max-w-full overflow-x-hidden box-border relative`}
    >
      <AppWallpaper />
      <header className="py-6 max-w-7xl mx-auto space-y-3 box-border relative z-10">
        <div>
          <Link
            to="/"
            className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-slate-300 hover:text-white hover:bg-white/10 transition"
          >
            <span>← Back to Home</span>
          </Link>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white">
              Live TV & Sports
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              Stream live broadcast feeds, sports channels, and events.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void handleRefreshHealth()}
            disabled={probing}
            className={`self-start sm:self-auto rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-bold text-slate-200 transition hover:bg-white/10 disabled:opacity-50`}
          >
            {probing ? 'Checking streams…' : '↻ Refresh health'}
          </button>
        </div>

        {/* Upper Category Navigation Bar */}
        <div className="w-full pt-2">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
            Regions & Feeds
          </p>
          <ScrollPillBar
            options={categories.map((cat) => ({ id: cat, label: cat }))}
            activeId={selectedCategory}
            onSelect={(id) => setSelectedCategory(id)}
            appTheme={appTheme}
            getPrimaryBgColor={getPrimaryBgColor}
          />
        </div>

        {/* Lower Genre Navigation Bar */}
        <div className="w-full pt-2">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
            Categories & Genres
          </p>
          <ScrollPillBar
            options={genreOptions.map((genre) => ({ id: genre, label: genre }))}
            activeId={selectedGenre}
            onSelect={(id) => setSelectedGenre(id)}
            appTheme={appTheme}
            getPrimaryBgColor={getPrimaryBgColor}
          />
        </div>
      </header>

      <div className="max-w-7xl mx-auto box-border relative z-10">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
          <h3 className="text-lg font-bold text-white">
            {selectedGenre !== 'All Genres' ? selectedGenre : selectedCategory}{' '}
            Feeds
          </h3>

          <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
            {stats ? (
              <>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-black/40 border border-white/10 px-2.5 py-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  <span className="text-emerald-300">{stats.online} online</span>
                </span>
                {stats.offline > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-black/40 border border-white/10 px-2.5 py-1">
                    <span className="h-2 w-2 rounded-full bg-red-500" />
                    <span className="text-red-300">{stats.offline} offline</span>
                  </span>
                )}
                {stats.unknown > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-black/40 border border-white/10 px-2.5 py-1">
                    <span className="h-2 w-2 rounded-full bg-amber-400" />
                    <span className="text-amber-200">{stats.unknown} unchecked</span>
                  </span>
                )}
                <span className={`${themeStyles.accentText}`}>
                  {channels.length} shown
                </span>
              </>
            ) : (
              <span className={`${themeStyles.accentText}`}>
                {channels.length} channels available
              </span>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col justify-center items-center h-72 gap-3 max-w-md mx-auto text-center px-4">
            <div
              className={`animate-spin rounded-full h-10 w-10 border-t-2 ${themeStyles.accentText}`}
            />
            <p className="text-xs font-bold text-slate-200 mt-1">
              {probing ? 'Probing stream health…' : 'Loading channels…'}
            </p>
            <p className="text-[11px] text-slate-400 leading-relaxed bg-black/30 border border-white/10 rounded-xl p-3">
              Note: On initial load, checking the health status of your TV guide may take up to 2 minutes depending on your network speed. Subsequent visits will load instantly from memory.
            </p>
          </div>
        ) : channels.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {channels.map((channel) => (
              <Link
                key={channel.channelId || channel.url}
                to="/live-player"
                search={{
                  url: channel.streamUrl,
                  title: channel.title,
                  logo: channel.logo || '',
                }}
                className={`group flex flex-col items-center p-3.5 rounded-2xl bg-gradient-to-b ${themeStyles.cardGradient} border ${themeStyles.borderGlow} shadow-xl hover:-translate-y-1 transition text-center relative overflow-hidden box-border`}
              >
                <HealthDot health={channel.health} />

                <div className="w-full h-28 bg-black/50 rounded-xl mb-3 overflow-hidden flex items-center justify-center border border-white/10 relative p-2 box-border">
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
                <span className="text-xs font-bold line-clamp-2 text-white group-hover:text-slate-200 w-full">
                  {channel.title}
                </span>
                <p className="text-[10px] text-slate-400 line-clamp-2 mt-1 px-1 w-full overflow-hidden text-ellipsis">
                  {getChannelDescription(channel.title)}
                </p>
                <span className="mt-2 w-full py-1 text-[10px] font-bold rounded-full bg-black/60 border border-white/10 text-slate-300">
                  WATCH →
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div
            className={`rounded-[20px] bg-gradient-to-r ${themeStyles.cardGradient} border ${themeStyles.borderGlow} p-8 text-center`}
          >
            <p className="text-sm text-slate-300">
              No channels found matching this filter combination.
            </p>
            <p className="text-xs text-slate-500 mt-2">
              Offline streams are hidden automatically. Try Refresh health or
              another region.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
