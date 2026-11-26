// src/components/LiveMiniGuide.tsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { AppTheme } from '@/lib/settings';
import type { LiveChannel } from '@/lib/live-feed-service';
import { channelCategories } from '@/lib/channel-categories';
import { getChannelDescription } from '@/lib/channel-descriptions';

export type MiniGuideMode = 'tune' | 'split';

const IMG_LIVEGUIDE_DRAWER_BG =
  'https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-liveguide-drawer-bg.jpg';

export interface LiveMiniGuideProps {
  isOpen: boolean;
  mode: MiniGuideMode;
  appTheme: AppTheme;
  channels: LiveChannel[];
  currentStreamUrl: string;
  secondaryStreamUrl?: string;
  isLowRam?: boolean;
  largeButtons?: boolean;
  onSelectChannel: (channel: LiveChannel) => void;
  onClose: () => void;
}

function normalizeText(raw: string): string {
  return String(raw || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function getGuideAccent(theme: AppTheme) {
  switch (theme) {
    case 'red':
      return {
        border: 'border-red-500/35',
        accent: 'text-red-300',
        activePill: 'bg-gradient-to-r from-red-600 to-rose-600 text-white border-red-300/60',
        activeRow: 'bg-red-950/80 border-red-400/70',
        idleRow: 'bg-black/75 border-white/10 hover:border-red-400/50',
      };
    case 'midnight':
      return {
        border: 'border-blue-500/35',
        accent: 'text-sky-300',
        activePill: 'bg-gradient-to-r from-blue-600 to-sky-500 text-white border-sky-300/60',
        activeRow: 'bg-blue-950/80 border-sky-400/70',
        idleRow: 'bg-black/75 border-white/10 hover:border-sky-400/50',
      };
    case 'emerald':
      return {
        border: 'border-emerald-500/35',
        accent: 'text-emerald-300',
        activePill: 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white border-emerald-300/60',
        activeRow: 'bg-emerald-950/80 border-emerald-400/70',
        idleRow: 'bg-black/75 border-white/10 hover:border-emerald-400/50',
      };
    case 'amber':
      return {
        border: 'border-amber-500/35',
        accent: 'text-amber-300',
        activePill: 'bg-gradient-to-r from-amber-500 to-orange-600 text-white border-amber-300/60',
        activeRow: 'bg-amber-950/80 border-amber-400/70',
        idleRow: 'bg-black/75 border-white/10 hover:border-amber-400/50',
      };
    case 'cyan':
      return {
        border: 'border-cyan-500/35',
        accent: 'text-cyan-300',
        activePill: 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white border-cyan-300/60',
        activeRow: 'bg-cyan-950/80 border-cyan-400/70',
        idleRow: 'bg-black/75 border-white/10 hover:border-cyan-400/50',
      };
    case 'violet':
    default:
      return {
        border: 'border-violet-500/35',
        accent: 'text-violet-300',
        activePill: 'bg-gradient-to-r from-violet-600 to-purple-600 text-white border-violet-300/60',
        activeRow: 'bg-purple-950/80 border-violet-400/70',
        idleRow: 'bg-black/75 border-white/10 hover:border-violet-400/50',
      };
  }
}

export function LiveMiniGuide({
  isOpen,
  mode,
  appTheme,
  channels,
  currentStreamUrl,
  secondaryStreamUrl,
  isLowRam = false,
  largeButtons = false,
  onSelectChannel,
  onClose,
}: LiveMiniGuideProps) {
  const [genre, setGenre] = useState<string>('All');
  const [filterText, setFilterText] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  const styles = useMemo(() => getGuideAccent(appTheme), [appTheme]);
  const genres = useMemo(() => ['All', ...Object.keys(channelCategories)], []);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const filtered = useMemo(() => {
    const cleanList = channels.filter((ch) => {
      const hay = `${ch.title || ''} ${ch.channelId || ''} ${ch.streamUrl || ''} ${ch.url || ''}`.toLowerCase();
      return !hay.includes('7flix') && !hay.includes('sevenflix');
    });

    let list = cleanList;
    if (genre !== 'All') {
      const allowed = new Set((channelCategories[genre] || []).map(normalizeText));
      list = list.filter((ch) => allowed.has(normalizeText(ch.title)));
    }
    const q = filterText.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (ch) =>
          ch.title.toLowerCase().includes(q) ||
          String(ch.channelNumber || '').includes(q)
      );
    }
    return list;
  }, [channels, genre, filterText]);

  if (!isOpen) return null;

  return (
    <div
      className="rabtv-vidsrc-protected fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-label="Live TV Mini-Guide"
    >
      <div
        className="fixed inset-0 bg-black/65 backdrop-blur-xs"
        onClick={onClose}
      />

      <aside
        className={`relative z-10 w-full max-w-md h-[100dvh] bg-[#0c0a09]/96 border-l ${styles.border} ${
          isLowRam ? '' : 'backdrop-blur-xl'
        } flex flex-col overflow-hidden shadow-2xl`}
      >
        {/* Armored Drawer Artwork with CRT Monitors at Base */}
        <div
          className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-55"
          style={{ backgroundImage: `url(${IMG_LIVEGUIDE_DRAWER_BG})` }}
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0c0a09]/85 via-[#0c0a09]/72 to-[#0c0a09]/55"
          aria-hidden="true"
        />

        {/* Header */}
        <div className="relative z-10 px-4 pt-4 pb-3 border-b border-white/10 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-black text-white truncate">
                {mode === 'split' ? 'Split Screen 2 Guide' : 'Live TV Mini-Guide'}
              </h2>
              <p className={`text-[11px] truncate ${styles.accent}`}>
                {filtered.length} channels • Zap without leaving stream
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Mini-Guide"
              className="h-8 w-8 shrink-0 rounded-xl border border-white/15 bg-black/75 hover:bg-white/15 text-xs font-black text-white cursor-pointer"
            >
              ✕
            </button>
          </div>

          <input
            ref={inputRef}
            type="search"
            dir="ltr"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Filter channels or CH #..."
            className="w-full h-9 rounded-xl border border-white/15 bg-black/80 px-3 text-xs font-bold text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-cyan-400"
          />

          {/* Genre Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
            {genres.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGenre(g)}
                className={`shrink-0 rounded-full border px-2.5 py-1 text-[10.5px] font-extrabold whitespace-nowrap cursor-pointer transition ${
                  genre === g
                    ? styles.activePill
                    : 'bg-black/70 border-white/10 text-zinc-300 hover:text-white'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* Channel Rows */}
        <div className="relative z-10 flex-1 overflow-y-auto scrollbar-none p-3 space-y-2">
          {filtered.map((ch, idx) => {
            const u = (ch.streamUrl || ch.url || '').trim();
            const isCurrent = u && u === currentStreamUrl;
            const isSplit = Boolean(secondaryStreamUrl && u === secondaryStreamUrl);

            return (
              <button
                key={ch.channelId || `${u}-${idx}`}
                type="button"
                onClick={() => {
                  onSelectChannel(ch);
                  onClose();
                }}
                className={`w-full rounded-2xl border p-2.5 flex items-center gap-3 text-left transition cursor-pointer ${
                  isCurrent || isSplit ? styles.activeRow : styles.idleRow
                }`}
              >
                <div className="h-11 w-14 shrink-0 rounded-xl bg-black/85 border border-white/10 p-1.5 flex items-center justify-center overflow-hidden">
                  {ch.logo ? (
                    <img
                      src={ch.logo}
                      alt={ch.title}
                      loading="lazy"
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <span className={`text-[9.5px] font-black ${styles.accent}`}>
                      LIVE
                    </span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    {ch.channelNumber !== undefined && (
                      <span className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-black text-zinc-200">
                        #{ch.channelNumber}
                      </span>
                    )}
                    <p className="text-xs font-black text-white truncate">
                      {ch.title}
                    </p>
                  </div>
                  <p className="text-[10.5px] text-zinc-400 line-clamp-1 mt-0.5">
                    {getChannelDescription(ch.title)}
                  </p>
                </div>

                <span
                  className={`text-xs font-black shrink-0 ${
                    largeButtons ? 'text-sm' : ''
                  } ${styles.accent}`}
                >
                  {isCurrent ? '●' : isSplit ? '2' : '▶'}
                </span>
              </button>
            );
          })}
        </div>

        {/* Footer Hint */}
        <div className="relative z-10 px-4 py-2.5 border-t border-white/10 bg-black/80 flex items-center justify-between text-[10.5px] font-bold text-zinc-400">
          <span>Tap channel to tune</span>
          <span>Esc to close</span>
        </div>
      </aside>
    </div>
  );
}