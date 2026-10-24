RABBiT TV 2.0 - README

Welcome to RABBiT TV 2.0, a lightweight, high-performance web-based media and live stream streaming application optimized for fast browsing, media exploration, and live channel playback.
🌟 Key Features

    Multi-Tab Media Navigation: Seamlessly browse between Home, TV Shows, Movies, In Theaters, Live TV & Sports, and My List with smooth URL search parameter syncing.

    Live TV & Sports Stream Player (/live-player):

        Full HLS (.m3u8) streaming support powered by hls.js.

        Dynamic quality selection (Auto, 1080p, 720p, etc.).

        Recently Watched Live TV: Automatically logs your last 5 watched live streams so you can easily resume your favorite broadcasts from your watch history.

    Smart Watch History & Activity:

        Tracks your progress across movies and multi-episode TV series.

        Eyeball toggle confirmation to verify completed episodes or movies.

        Dislike & Global Scrubbing tool to hide unwanted titles from your feeds permanently.

    Customizable Themes & Display Settings:

        Multiple color themes (Violet, Red, Midnight, Emerald, Amber, Cyan).

        Adjustable card scaling sizes (Small, Medium, Large).

        Age restriction safety filters.

    Optimized Performance:

        Memoized media components and strict history capping (50 items) to guarantee low memory overhead and smooth device performance.

        30-second inactivity scroll reminders to help users discover out-of-view catalog content.

🛠️ Project Structure

    src/routes/index.tsx — Main dashboard, smart hero spotlight carousel, genre/provider filtering, and catalog grid.

    src/routes/watch-history.tsx — Central activity page containing in-progress movies/shows, completed titles, disliked items, and recently watched live streams.

    src/routes/live-player.tsx — HLS stream player with auto-tracking history integration and recommended channel feeds.

    src/lib/watch-history.ts — Core state management utilities for watch progress, bookmarks, and recent live channel logs stored in localStorage.

🚀 Getting Started

    Install Dependencies:
    Bash

    npm install

    Run Development Server:
    Bash

    npm run dev

    Build for Production:
    Bash

    npm run build
