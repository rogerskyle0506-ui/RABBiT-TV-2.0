import { createFileRoute } from '@tanstack/react-router';
import React, { useEffect, useState } from 'react';
import { AppTheme, getSavedTheme } from '@/lib/settings';

export const Route = createFileRoute('/live-player')({
  component: LivePlayerComponent,
});

function LivePlayerComponent() {
  const [appTheme, setAppTheme] = useState<AppTheme>('violet');

  useEffect(() => {
    setAppTheme(getSavedTheme());
  }, []);

  const searchParams = new URLSearchParams(window.location.search);
  const streamUrl = searchParams.get('url') || '';
  const title = searchParams.get('title') || 'Live Stream';

  const themeStyles = {
    violet: { bg: 'from-slate-950 via-purple-950/40 to-slate-950', text: 'text-violet-300' },
    red: { bg: 'from-zinc-950 via-red-950/40 to-black', text: 'text-red-400' },
    midnight: { bg: 'from-slate-950 via-blue-950/40 to-slate-950', text: 'text-sky-300' },
    emerald: { bg: 'from-slate-950 via-emerald-950/40 to-slate-950', text: 'text-emerald-300' },
    amber: { bg: 'from-stone-950 via-yellow-950/40 to-neutral-950', text: 'text-amber-300' },
    cyan: { bg: 'from-slate-950 via-cyan-950/40 to-slate-950', text: 'text-cyan-300' },
  }[appTheme] ?? { bg: 'from-slate-950 via-purple-950/40 to-slate-950', text: 'text-violet-300' };

  return (
    <div className={`flex flex-col h-screen bg-gradient-to-br ${themeStyles.bg} text-white`}>
      <div className="flex items-center justify-between px-6 py-4 bg-black/60 backdrop-blur-xl border-b border-white/10 z-10">
        <a href="/live-tv" className="text-xs sm:text-sm font-semibold text-slate-400 hover:text-white flex items-center space-x-2 transition">
          <span>← Back to Live TV</span>
        </a>
        <div className="flex items-center space-x-2">
          <h1 className="text-sm sm:text-base font-bold truncate max-w-xs sm:max-w-md">{title}</h1>
          <span className="inline-block w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]"></span>
          <span className="text-[10px] font-bold text-red-400 tracking-wider">LIVE</span>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-4 relative">
        {streamUrl ? (
          <video
            src={streamUrl}
            controls
            autoPlay
            playsInline
            className="w-full h-full max-h-[85vh] rounded-2xl shadow-2xl object-contain bg-black border border-white/10"
            onError={(e) => console.error('Video stream playback error:', e)}
          >
            Your browser does not support live HLS video playback.
          </video>
        ) : (
          <div className="text-center text-slate-400 p-8 rounded-2xl bg-black/40 border border-white/10">
            <p className="text-sm font-medium">Invalid or missing stream URL.</p>
          </div>
        )}
      </div>
    </div>
  );
}
