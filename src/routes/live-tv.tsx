// src/routes/live-tv.tsx
import { createFileRoute } from '@tanstack/react-router';
import React, { useEffect, useState } from 'react';
import { fetchLiveCategories, fetchChannelsByCategory, LiveChannel } from '../lib/live-feed-service';

export const Route = createFileRoute('/live-tv')({
  component: LiveTvComponent,
});

function LiveTvComponent() {
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [channels, setChannels] = useState<LiveChannel[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetchLiveCategories().then((cats) => {
      setCategories(cats);
      if (cats.length > 0) {
        setSelectedCategory(cats[0]);
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (selectedCategory) {
      setLoading(true);
      fetchChannelsByCategory(selectedCategory).then((chans) => {
        setChannels(chans);
        setLoading(false);
      });
    }
  }, [selectedCategory]);

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Live TV & Sports</h1>
        <p className="text-zinc-400 mt-1">Stream live broadcast feeds, events, and sports channels.</p>
      </header>

      {/* Category Pill Navigation */}
      <div className="flex overflow-x-auto space-x-3 pb-4 mb-6 scrollbar-none">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
              selectedCategory === cat
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Channel Grid */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {channels.map((channel) => (
            <a
              key={channel.id}
              href={`/live-player?url=${encodeURIComponent(channel.streamUrl)}&title=${encodeURIComponent(channel.title)}`}
              className="bg-zinc-900 border border-zinc-800/80 rounded-xl p-4 flex flex-col items-center text-center hover:border-blue-500/50 hover:bg-zinc-850 transition group"
            >
              {channel.logo ? (
                <img
                  src={channel.logo}
                  alt={channel.title}
                  className="w-16 h-16 object-contain mb-3 rounded-lg bg-zinc-950 p-2 group-hover:scale-105 transition-transform"
                  loading="lazy"
                />
              ) : (
                <div className="w-16 h-16 bg-zinc-800 rounded-lg mb-3 flex items-center justify-center text-zinc-500 font-bold">
                  LIVE
                </div>
              )}
              <span className="text-sm font-medium line-clamp-2 text-zinc-200 group-hover:text-white">
                {channel.title}
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
