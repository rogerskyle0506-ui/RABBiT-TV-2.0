// src/routes/live-player.tsx
import { createFileRoute } from '@tanstack/react-router';
import React from 'react';

export const Route = createFileRoute('/live-player')({
  component: LivePlayerComponent,
});

function LivePlayerComponent() {
  const searchParams = new URLSearchParams(window.location.search);
  const streamUrl = searchParams.get('url') || '';
  const title = searchParams.get('title') || 'Live Stream';

  return (
    <div className="flex flex-col h-screen bg-black text-white">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-6 py-4 bg-zinc-900/80 border-b border-zinc-800">
        <a href="/live-tv" className="text-sm text-zinc-400 hover:text-white flex items-center space-x-2">
          <span>← Back to Live TV</span>
        </a>
        <h1 className="text-lg font-semibold truncate max-w-md">{title}</h1>
        <div className="flex items-center space-x-2">
          <span className="inline-block w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse"></span>
          <span className="text-xs font-bold text-red-500 tracking-wider">LIVE</span>
        </div>
      </div>

      {/* Player Container */}
      <div className="flex-1 flex items-center justify-center bg-zinc-950 relative">
        {streamUrl ? (
          <video
            src={streamUrl}
            controls
            autoPlay
            playsInline
            className="w-full h-full max-h-[85vh] object-contain"
            onError={(e) => console.error('Video stream error:', e)}
          >
            Your browser does not support live HLS video playback.
          </video>
        ) : (
          <div className="text-center text-zinc-500">
            <p className="text-lg font-medium">Invalid or missing stream URL.</p>
          </div>
        )}
      </div>
    </div>
  );
}
