// src/components/LiveMiniGuide.tsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { AppTheme } from '@/lib/settings';
import type { LiveChannel } from '@/lib/live-feed-service';
import { channelCategories } from '@/lib/channel-categories';
import { getChannelDescription } from '@/lib/channel-descriptions';

export type MiniGuideMode = 'tune' | 'split';

const IMG_LIVEGUIDE_DRAWER_BG =
  'https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-liveguide-drawer-bg.jpg';
const IMG_CHANNEL_CARD_FRAME =
  'https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-livetv-channel-card-frame.jpg';
const IMG_INPUT_BAR_BG =
  'https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-search-input-bar-background.jpg';
const IMG_PILL_ACTIVE =
  'https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-pill-active-crimson.jpg';
const IMG_PILL_INACTIVE =
  'https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-pill-inactive-dark.jpg';
const IMG_BTN_IDLE =
  'https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/refs/heads/main/assets/rabbit-tv-player-button-action-idle.jpg';

const MINI_GUIDE_STYLES = `
  :root, html[data-theme="violet"] { --rabtv-mg-filter: hue-rotate(-78deg) saturate(1.12) brightness(1.02); }
  html[data-theme="red"] { --rabtv-mg-filter: hue-rotate(0deg) saturate(1.08) brightness(1.0); }
  html[data-theme="midnight"] { --rabtv-mg-filter: hue-rotate(-132deg) saturate(1.14) brightness(1.04); }
  html[data-theme="emerald"] { --rabtv-mg-filter: hue-rotate(154deg) saturate(1.10) brightness(1.02); }
  html[data-theme="amber"] { --rabtv-mg-filter: hue-rotate(28deg) saturate(1.14) brightness(1.04); }
  html[data-theme="cyan"] { --rabtv-mg-filter: hue-rotate(-154deg) saturate(1.12) brightness(1.04); }

  .rabtv-mg-input-shell {
    position: relative;
    overflow: hidden;
    background-color: #0c0a09;
    contain: layout paint;
  }
  .rabtv-mg-input-9slice {
    position: absolute;
    inset: 0;
    box-sizing: border-box;
    border-style: solid;
    border-color: transparent;
    border-width: 7px 16px;
    border-image-source: url("${IMG_INPUT_BAR_BG}");
    border-image-slice: 22% 14% fill;
    border-image-repeat: stretch;
    filter: var(--rabtv-mg-filter);
    pointer-events: none;
    z-index: 0;
  }
  .rabtv-mg-pill-scroll {
    -webkit-mask-image: linear-gradient(to right, transparent 0%, black 12px, black calc(100% - 12px), transparent 100%);
    mask-image: linear-gradient(to right, transparent 0%, black 12px, black calc(100% - 12px), transparent 100%);
  }
  .rabtv-mg-pill {
    position: relative;
    overflow: hidden;
    background-color: #0c0a09;
    border: 0 !important;
    contain: layout paint;
  }
  .rabtv-mg-pill-bg {
    position: absolute;
    inset: 0;
    background-size: 100% 100%;
    filter: var(--rabtv-mg-filter);
    pointer-events: none;
    z-index: 0;
  }
  .rabtv-mg-row {
    position: relative;
    overflow: hidden;
    background-color: #0c0a09;
    contain: layout paint;
  }
  .rabtv-mg-row-9slice {
    position: absolute;
    inset: 0;
    box-sizing: border-box;
    border-style: solid;
    border-color: transparent;
    border-width: 10px 10px;
    border-image-source: url("${IMG_CHANNEL_CARD_FRAME}");
    border-image-slice: 13% 11% fill;
    border-image-repeat: stretch;
    filter: var(--rabtv-mg-filter);
    pointer-events: none;
    z-index: 0;
  }
`;

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
      return { border: 'border-red-500/45', accent: 'text-red-300', activeRing: 'ring-2 ring-red-400/80' };
    case 'midnight':
      return { border: 'border-blue-500/45', accent: 'text-sky-300', activeRing: 'ring-2 ring-sky-400/80' };
    case 'emerald':
      return { border: 'border-emerald-500/45', accent: 'text-emerald-300', activeRing: 'ring-2 ring-emerald-400/80' };
    case 'amber':
      return { border: 'border-amber-500/45', accent: 'text-amber-300', activeRing: 'ring-2 ring-amber-400/80' };
    case 'cyan':
      return { border: 'border-cyan-500/45', accent: 'text-cyan-300', activeRing: 'ring-2 ring-cyan-400/80' };
    case 'violet':
    default:
      return { border: 'border-violet-500/45', accent: 'text-violet-300', activeRing: 'ring-2 ring-violet-400/80' };
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
  const genreScrollRef = useRef<HTMLDivElement>(null);

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

  // Strip 7flix AND deduplicate channels by normalized title so no regional duplicates clog the drawer
  const filtered = useMemo(() => {
    const seenTitles = new Set<string>();
    const cleanList: LiveChannel[] = [];
    for (const ch of channels) {
      const hay = `${ch.title || ''} ${ch.channelId || ''} ${ch.streamUrl || ''} ${ch.url || ''}`.toLowerCase();
      if (hay.includes('7flix') || hay.includes('sevenflix')) continue;
      const norm = normalizeText(ch.title);
      if (norm && seenTitles.has(norm)) continue;
      if (norm) seenTitles.add(norm);
      cleanList.push(ch);
    }

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
      <style>{MINI_GUIDE_STYLES}</style>
      <div
        className="fixed inset-0 bg-black/68 backdrop-blur-xs"
        onClick={onClose}
      />

      <aside
        className={`relative z-10 w-full max-w-md h-[100dvh] bg-[#0c0a09] border-l ${styles.border} ${
          isLowRam ? '' : 'backdrop-blur-xl'
        } flex flex-col overflow-hidden shadow-2xl px-4 sm:px-5`}
      >
        {/* Armored Vertical Drawer Background with Steel Side Rails & Glowing Bottom CRT Monitors */}
        <div
          className="pointer-events-none absolute inset-0 bg-cover bg-bottom opacity-80"
          style={{
            backgroundImage: `url(${IMG_LIVEGUIDE_DRAWER_BG})`,
            backgroundSize: '100% 100%',
            filter: 'var(--rabtv-mg-filter)',
          }}
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-x-3.5 inset-y-0 bg-gradient-to-b from-[#0c0a09]/82 via-[#0c0a09]/68 to-[#0c0a09]/40"
          aria-hidden="true"
        />

        {/* Header */}
        <div className="relative z-10 px-2 pt-4 pb-3 border-b border-white/10 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-black text-white truncate drop-shadow">
                {mode === 'split' ? 'Split Screen 2 Guide' : 'Live TV Mini-Guide'}
              </h2>
              <p className={`text-[11px] font-bold truncate ${styles.accent}`}>
                {filtered.length} channels • Zap without leaving stream
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Mini-Guide"
              className="rabtv-mg-pill h-8 w-8 shrink-0 rounded-xl text-xs font-black text-white cursor-pointer flex items-center justify-center"
            >
              <span
                className="rabtv-mg-pill-bg"
                aria-hidden="true"
                style={{ backgroundImage: `url(${IMG_BTN_IDLE})` }}
              />
              <span className="relative z-10">✕</span>
            </button>
          </div>

          {/* 9-Sliced Armored Search Input */}
          <div className="rabtv-mg-input-shell rounded-xl">
            <div className="rabtv-mg-input-9slice" aria-hidden="true" />
            <input
              ref={inputRef}
              type="search"
              dir="ltr"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Filter channels..."
              className="relative z-10 w-full h-10 bg-transparent px-5 text-xs font-bold text-white placeholder-zinc-400 focus:outline-none"
            />
          </div>

          {/* Armored Genre Pills with Edge Fade & Scroll Arrows (Zero Hard Clipping!) */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Scroll genres left"
              onClick={() => genreScrollRef.current?.scrollBy({ left: -160, behavior: 'smooth' })}
              className="rabtv-mg-pill h-7 w-7 shrink-0 rounded-lg text-xs font-black text-white cursor-pointer flex items-center justify-center"
            >
              <span className="rabtv-mg-pill-bg" style={{ backgroundImage: `url(${IMG_BTN_IDLE})` }} />
              <span className="relative z-10">‹</span>
            </button>

            <div
              ref={genreScrollRef}
              className="rabtv-mg-pill-scroll flex-1 min-w-0 flex items-center gap-1.5 overflow-x-auto scrollbar-none px-2.5 py-0.5"
            >
              {genres.map((g) => {
                const active = genre === g;
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGenre(g)}
                    className="rabtv-mg-pill shrink-0 rounded-xl px-3 py-1.5 text-[10.5px] font-extrabold text-white whitespace-nowrap cursor-pointer transition hover:scale-[1.03]"
                  >
                    <span
                      className="rabtv-mg-pill-bg"
                      aria-hidden="true"
                      style={{
                        backgroundImage: `url(${active ? IMG_PILL_ACTIVE : IMG_PILL_INACTIVE})`,
                        opacity: active ? 0.98 : 0.86,
                      }}
                    />
                    <span className="relative z-10 drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]">
                      {g}
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              aria-label="Scroll genres right"
              onClick={() => genreScrollRef.current?.scrollBy({ left: 160, behavior: 'smooth' })}
              className="rabtv-mg-pill h-7 w-7 shrink-0 rounded-lg text-xs font-black text-white cursor-pointer flex items-center justify-center"
            >
              <span className="rabtv-mg-pill-bg" style={{ backgroundImage: `url(${IMG_BTN_IDLE})` }} />
              <span className="relative z-10">›</span>
            </button>
          </div>
        </div>

        {/* 9-Sliced Armored Channel Rows */}
        <div className="relative z-10 flex-1 overflow-y-auto scrollbar-none px-1.5 py-3 space-y-2">
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
                className={`rabtv-mg-row w-full rounded-2xl p-3 flex items-center gap-3 text-left transition cursor-pointer hover:brightness-110 ${
                  isCurrent || isSplit ? styles.activeRing : ''
                }`}
              >
                <div className="rabtv-mg-row-9slice" aria-hidden="true" />
                <div className="relative z-10 h-11 w-14 shrink-0 rounded-xl bg-black/90 border border-white/15 p-1.5 flex items-center justify-center overflow-hidden">
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

                <div className="relative z-10 min-w-0 flex-1">
                  <p className="text-xs font-black text-white truncate">
                    {ch.title}
                  </p>
                  <p className="text-[10.5px] text-zinc-400 line-clamp-1 mt-0.5">
                    {getChannelDescription(ch.title)}
                  </p>
                </div>

                <span
                  className={`relative z-10 text-xs font-black shrink-0 ${
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
        <div className="relative z-10 px-2 py-2.5 border-t border-white/10 bg-[#0c0a09]/85 flex items-center justify-between text-[10.5px] font-bold text-zinc-300">
          <span>Tap channel to tune</span>
          <span>Esc to close</span>
        </div>
      </aside>
    </div>
  );
}