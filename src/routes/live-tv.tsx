import { createFileRoute, Link } from '@tanstack/react-router';
import React, { useEffect, useMemo, useState } from 'react';
import { fetchLiveCategories, fetchChannelsByCategory, liveFeedServices, LiveChannel } from '../lib/live-feed-service';
import { AppTheme, getSavedTheme } from '@/lib/settings';
import { ScrollPillBar } from '@/components/scroll-pill-bar';
import { getChannelDescription } from '@/lib/channel-descriptions';

export const Route = createFileRoute('/live-tv')({
  component: LiveTvComponent,
});

// Canadian display mapping for Australian / NZ regional feeds (display-only overlay)
const categoryMapping: Record<string, string> = {
  'Nz': 'Atlantic Canada',
  'Sydney': 'Toronto',
  'Melbourne': 'Vancouver',
  'Brisbane': 'Montreal',
  'Perth': 'Calgary',
  'Adelaide': 'Ottawa',
  'Canberra': 'National',
  'Darwin': 'Northern',
  'Hobart': 'Pacific',
  'Au': 'Canada Feeds',
  'World': 'International',
};

const reverseCategoryMapping: Record<string, string> = Object.fromEntries(
  Object.entries(categoryMapping).map(([orig, disp]) => [disp, orig])
);

function LiveTvComponent() {
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [channels, setChannels] = useState<LiveChannel[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [appTheme, setAppTheme] = useState<AppTheme>('violet');

  useEffect(() => {
    setAppTheme(getSavedTheme());
    const handleSettingsUpdate = () => setAppTheme(getSavedTheme());
    window.addEventListener('rabtv_settings_updated', handleSettingsUpdate);
    return () => window.removeEventListener('rabtv_settings_updated', handleSettingsUpdate);
  }, []);

  useEffect(() => {
    fetchLiveCategories().then((cats) => {
      // Map categories to Canadian display names while preserving original backend references
      const displayCats = cats.map((cat) => categoryMapping[cat] || cat);
      setCategories(['All', ...displayCats]);
      setSelectedCategory('All');
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    if (selectedCategory === 'All') {
      const allChannels: LiveChannel[] = liveFeedServices.map((s) => ({
        ...s,
        streamUrl: s.url,
        title: s.name,
      }));
      setChannels(allChannels);
      setLoading(false);
    } else if (selectedCategory) {
      // Resolve Canadian display tab back to original underlying category key
      const originalCategory = reverseCategoryMapping[selectedCategory] || selectedCategory;
      fetchChannelsByCategory(originalCategory).then((chans) => {
        setChannels(chans);
        setLoading(false);
      });
    }
  }, [selectedCategory]);

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
      case 'red': return 'bg-gradient-to-r from-red-600 via-rose-600 to-orange-600 text-white shadow-lg shadow-red-600/30';
      case 'midnight': return 'bg-gradient-to-r from-blue-600 via-cyan-600 to-sky-600 text-white shadow-lg shadow-blue-600/30';
      case 'emerald': return 'bg-gradient-to-r from-emerald-600 via-teal-600 to-green-600 text-white shadow-lg shadow-emerald-600/30';
      case 'amber': return 'bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 text-white shadow-lg shadow-amber-600/30';
      case 'cyan': return 'bg-gradient-to-r from-cyan-600 via-teal-600 to-blue-600 text-white shadow-lg shadow-cyan-600/30';
      case 'violet':
      default: return 'bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 text-white shadow-lg shadow-violet-600/30';
    }
  };

  return (
    <main className={`min-h-screen ${themeStyles.bg} text-slate-100 transition-colors duration-300 pb-20 px-4 sm:px-6 w-full max-w-full overflow-x-hidden box-border`}>
      <header className="py-6 max-w-7xl mx-auto space-y-3 box-border">
        <div>
          <Link
            to="/"
            className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-slate-300 hover:text-white hover:bg-white/10 transition"
          >
            <span>← Back to Home</span>
          </Link>
        </div>

        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">Live TV & Sports</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">Stream live broadcast feeds, sports channels, and events.</p>
        </div>

        {/* Category Navigation Bar with Canadian Display Names */}
        <div className="w-full pt-2">
          <ScrollPillBar
            options={categories.map((cat) => ({ id: cat, label: cat }))}
            activeId={selectedCategory}
            onSelect={(id) => setSelectedCategory(id)}
            appTheme={appTheme}
            getPrimaryBgColor={getPrimaryBgColor}
          />
        </div>
      </header>

      <div className="max-w-7xl mx-auto box-border">
        <div className="mb-3 flex items-center justify-between px-1">
          <h3 className="text-lg font-bold text-white">{selectedCategory} Feeds</h3>
          <span className={`text-xs font-medium ${themeStyles.accentText}`}>{channels.length} channels available</span>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className={`animate-spin rounded-full h-10 w-10 border-t-2 ${themeStyles.accentText}`}></div>
          </div>
        ) : channels.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {channels.map((channel) => (
              <Link
                key={channel.channelId || channel.url}
                to="/live-player"
                search={{ url: channel.streamUrl, title: channel.title, logo: channel.logo || '' }}
                className={`group flex flex-col items-center p-3.5 rounded-2xl bg-gradient-to-b ${themeStyles.cardGradient} border ${themeStyles.borderGlow} shadow-xl hover:-translate-y-1 transition text-center relative overflow-hidden box-border`}
              >
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
          <div className={`rounded-[20px] bg-gradient-to-r ${themeStyles.cardGradient} border ${themeStyles.borderGlow} p-8 text-center`}>
            <p className="text-sm text-slate-300">No channels found in this category.</p>
          </div>
        )}
      </div>
    </main>
  );
}
