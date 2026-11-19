import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import { createPortal } from 'react-dom';

/* ============================================================================
 * RABBiT TV — Complete Interactive App Walkthrough (InteractiveWalkthrough.tsx)
 *
 * Covers every interactable feature across the entire app:
 *  1. Entry Gate (Passcode / 7-Day Trial / Parental PIN / Controls)
 *  2. The Glass Sidebar (Master Navigation & Quick-Control Hubs)
 *  3. Home Screen (Global Feed, Mascot Greeting, Hero, Flip-to-Trailer Cards)
 *  4. Movies & TV Shows Catalogs (Filters, Providers, Region, Grid Sizing)
 *  5. Movie & TV Show Details Pages (Finish Time, Seasons, IMDb, Report Broken)
 *  6. Video Player & Playback Controls (Ad-Free, Seek, Quality, Episode Switch)
 *  7. Trailers Hub (Browse, Inline Flip-Play, Quick Actions)
 *  8. Live TV (284+ Channels, Categories, Search, Pin Favorites)
 *  9. Global Search (Query, Clear, Category & Rating Filters)
 * 10. My Favorites / Watchlist (Saved Movies, Shows & Pinned Channels)
 * 11. Watch History & Activity Hub (Search, Sort, Bulk Delete, Export Snapshot)
 * 12. Full Settings, Accessibility, RAM Modes, Timers & JSON Backup/Restore
 * 13. Page Footers, App Version Badge & Official TMDB Attribution Link
 *
 * Zero external icon or UI library dependencies — pure React + TypeScript.
 * Drop into: src/components/InteractiveWalkthrough.tsx
 * ========================================================================== */

export const WALKTHROUGH_COMPLETED_KEY = 'rabtv_walkthrough_completed';
export const WALKTHROUGH_STEP_KEY = 'rabtv_walkthrough_step';
export const WALKTHROUGH_OPEN_EVENT = 'rabtv_start_walkthrough';
export const SIDEBAR_TOGGLE_EVENT = 'rabtv_sidebar_toggle';

export type WalkthroughChapterId =
  | 'entry'
  | 'sidebar'
  | 'home'
  | 'catalog'
  | 'details'
  | 'player'
  | 'trailers'
  | 'livetv'
  | 'search'
  | 'favorites'
  | 'history'
  | 'settings'
  | 'footer';

export interface WalkthroughChapter {
  id: WalkthroughChapterId;
  number: number;
  title: string;
  shortTitle: string;
}

export interface WalkthroughStep {
  id: string;
  chapterId: WalkthroughChapterId;
  title: string;
  description: string;
  actionHint: string;
  /** CSS selectors checked in priority order to spotlight a live DOM element */
  targetSelectors: string[];
  /** Optional fallback route path passed to onNavigate when advancing */
  routeHint?: string;
  /** Opens or closes the glass sidebar automatically for this step */
  needsSidebar?: boolean;
  /** If true, clicking the spotlighted live element automatically advances */
  advanceOnTargetClick?: boolean;
  /** If true, scrolls the page to the bottom before searching for footer elements */
  scrollToBottom?: boolean;
  /** Optional extra tip shown in a subtle callout */
  proTip?: string;
}

export interface InteractiveWalkthroughProps {
  /** Controlled open state (optional — works self-managed if omitted) */
  isOpen?: boolean;
  /** Auto-launch on first visit when WALKTHROUGH_COMPLETED_KEY is not set */
  autoStartOnFirstLaunch?: boolean;
  /** Force the walkthrough open regardless of localStorage */
  forceShow?: boolean;
  /** Called when the user closes or skips the walkthrough */
  onClose?: () => void;
  /** Called when the user completes the final step */
  onComplete?: () => void;
  /** Optional router navigation hook (e.g. (path) => navigate({ to: path })) */
  onNavigate?: (path: string) => void;
  /** Optional sidebar toggle hook (e.g. (open) => setSidebarOpen(open)) */
  onToggleSidebar?: (open: boolean) => void;
  /** Starting step index (defaults to saved step or 0) */
  initialStepIndex?: number;
}

export const WALKTHROUGH_CHAPTERS: WalkthroughChapter[] = [
  { id: 'entry', number: 1, title: 'Welcome & Entry Controls', shortTitle: 'Welcome' },
  { id: 'sidebar', number: 2, title: 'The Glass Sidebar Hub', shortTitle: 'Sidebar' },
  { id: 'home', number: 3, title: 'Home Feed & Media Cards', shortTitle: 'Home Feed' },
  { id: 'catalog', number: 4, title: 'Movies & TV Catalogs', shortTitle: 'Catalogs' },
  { id: 'details', number: 5, title: 'Media Details Pages', shortTitle: 'Details' },
  { id: 'player', number: 6, title: 'Video Player & Controls', shortTitle: 'Player' },
  { id: 'trailers', number: 7, title: 'Trailers Hub', shortTitle: 'Trailers' },
  { id: 'livetv', number: 8, title: 'Live TV (284+ Channels)', shortTitle: 'Live TV' },
  { id: 'search', number: 9, title: 'Global Search', shortTitle: 'Search' },
  { id: 'favorites', number: 10, title: 'My Favorites & Watchlist', shortTitle: 'Favorites' },
  { id: 'history', number: 11, title: 'Watch History Hub', shortTitle: 'History' },
  { id: 'settings', number: 12, title: 'Full Settings & Backups', shortTitle: 'Settings' },
  { id: 'footer', number: 13, title: 'Footers & TMDB Link', shortTitle: 'Footer & TMDB' },
];

export const WALKTHROUGH_STEPS: WalkthroughStep[] = [
  /* ========================================================================
   * CHAPTER 1: WELCOME & ENTRY CONTROLS
   * ====================================================================== */
  {
    id: 'entry-welcome',
    chapterId: 'entry',
    title: 'Welcome to RABBiT TV',
    description:
      'This hands-on tour walks you through every single button, menu, toggle, and link in RABBiT TV — starting with the Glass Sidebar and going all the way down to the TMDB link at the bottom of pages.',
    actionHint: 'Press Next (or Right Arrow / Enter) to begin, or open Chapters to jump anywhere.',
    targetSelectors: ['[data-tour="app-root"]', '#root', 'main'],
    needsSidebar: false,
    proTip: 'You can pause, skip, or relaunch this tour anytime from Settings.',
  },
  {
    id: 'entry-passcode-trial',
    chapterId: 'entry',
    title: 'Access Passcode & 7-Day Trial Gate',
    description:
      'When launching on a new device, RABBiT TV unlocks with either an 8-digit Access Passcode or a temporary 7-day Trial Code. Once verified, your device remembers your access so you do not have to re-type it every time.',
    actionHint: 'Enter your 8-digit passcode or trial code on the lock screen to unlock full streaming.',
    targetSelectors: ['[data-tour="passcode-gate"]', '[data-tour="app-lock"]'],
    needsSidebar: false,
  },
  {
    id: 'entry-profile-pin',
    chapterId: 'entry',
    title: 'Profiles & 4–6 Digit Parental PIN',
    description:
      'Profiles keep watch history, favorites, and age limits separate for each viewer. A 4–6 digit Parental PIN protects profile switching, age-restricted titles, and locked configuration settings.',
    actionHint: 'Click your Profile badge or enter your 4–6 digit PIN whenever a lock prompt appears.',
    targetSelectors: [
      '[data-tour="profile-switcher"]',
      '[data-tour="parental-pin"]',
      '[aria-label*="profile" i]',
    ],
    needsSidebar: false,
  },
  {
    id: 'entry-controls',
    chapterId: 'entry',
    title: 'TV Remote, Mouse & Touch Ready',
    description:
      'Every button works with a TV remote D-Pad, keyboard arrows, USB mouse, or touchscreen. Use Arrow keys to move, Enter/OK to select, and Escape/Back to step out of any menu.',
    actionHint: 'Try pressing Left/Right Arrow keys or clicking Next below.',
    targetSelectors: ['[data-tour="app-root"]', 'main'],
    needsSidebar: false,
    proTip: 'Using a TV or projector with a mouse? Turn on the XL Colored Mouse Pointer in the Sidebar.',
  },

  /* ========================================================================
   * CHAPTER 2: THE GLASS SIDEBAR (MASTER NAVIGATION & CONTROL HUB)
   * ====================================================================== */
  {
    id: 'sidebar-open',
    chapterId: 'sidebar',
    title: 'Meet the Glass Sidebar',
    description:
      'The glass-styled Sidebar is the command center for all of RABBiT TV. Every main section, theme switcher, radio control, accessibility toggle, performance mode, and backup tool lives right here.',
    actionHint: 'Click the Sidebar toggle button (or press Left on a TV remote) to open and close it.',
    targetSelectors: [
      '[data-tour="sidebar-toggle"]',
      '[data-tour="sidebar"]',
      'aside',
      'nav[aria-label*="sidebar" i]',
    ],
    needsSidebar: true,
    advanceOnTargetClick: true,
  },
  {
    id: 'sidebar-global-feed',
    chapterId: 'sidebar',
    title: 'Sidebar Tab: Global Feed (Home)',
    description:
      'Global Feed brings you straight back to the main discovery page with your personalized greeting, spotlight hero banner, trending rows, and algorithm picks.',
    actionHint: 'Click Global Feed / Home in the Sidebar to return to the start screen anytime.',
    targetSelectors: [
      '[data-tour="nav-home"]',
      '[data-tour="sidebar-home"]',
      'aside a[href="/"]',
      'nav a[href="/"]',
    ],
    routeHint: '/',
    needsSidebar: true,
    advanceOnTargetClick: true,
  },
  {
    id: 'sidebar-movies-tv-trailers',
    chapterId: 'sidebar',
    title: 'Sidebar Tabs: Movies, TV Shows & Trailers',
    description:
      'Jump directly into full on-demand catalogs: Movies for feature films, TV Shows for multi-season series, and Trailers for quick TMDB previews of trending and upcoming releases.',
    actionHint: 'Click Movies, TV Shows, or Trailers inside the Sidebar to switch catalogs.',
    targetSelectors: [
      '[data-tour="nav-movies"]',
      '[data-tour="nav-tv"]',
      '[data-tour="nav-trailers"]',
      'aside a[href*="movie" i]',
    ],
    needsSidebar: true,
  },
  {
    id: 'sidebar-livetv-search-lists',
    chapterId: 'sidebar',
    title: 'Sidebar Tabs: Live TV, Search, Favorites & History',
    description:
      'Right below the catalogs are your quick-jump tabs for 284+ Live TV channels, Global Search, My Favorites (saved watchlist & pinned channels), and your complete Watch History hub.',
    actionHint: 'Select any of these four Sidebar tabs to jump straight to live streams, search, or saved lists.',
    targetSelectors: [
      '[data-tour="nav-livetv"]',
      '[data-tour="nav-search"]',
      '[data-tour="nav-favorites"]',
      '[data-tour="nav-history"]',
      'aside a[href*="live" i]',
    ],
    needsSidebar: true,
  },
  {
    id: 'sidebar-theme-grid',
    chapterId: 'sidebar',
    title: 'Sidebar Quick Hub: Themes & Poster Grid Sizing',
    description:
      'Customize the entire look of the app right from the Sidebar. Swap between Violet, Red, Midnight, and neon UI themes, change poster shapes, and resize card grids on the fly.',
    actionHint: 'Click any color swatch or grid size button in the Sidebar to preview changes instantly.',
    targetSelectors: [
      '[data-tour="sidebar-themes"]',
      '[data-tour="theme-picker"]',
      '[data-tour="grid-size"]',
    ],
    needsSidebar: true,
  },
  {
    id: 'sidebar-lobby-radio',
    chapterId: 'sidebar',
    title: 'Sidebar Quick Hub: Background Lobby Radio',
    description:
      'Play relaxing background music while browsing menus! Toggle Play/Pause, switch stations (Heartbeat / Heart Dance is the default alongside seasonal and genre streams), and slide the radio volume (defaults to 25%).',
    actionHint: 'Use the Sidebar Radio bar to play, pause, change stations, or adjust volume.',
    targetSelectors: [
      '[data-tour="sidebar-radio"]',
      '[data-tour="lobby-radio"]',
      '[aria-label*="radio" i]',
    ],
    needsSidebar: true,
    proTip: 'Lobby Radio automatically pauses when you start a movie or Live TV and resumes when you return.',
  },
  {
    id: 'sidebar-profile-pin',
    chapterId: 'sidebar',
    title: 'Sidebar Quick Hub: Profile, Mascot & Parental PIN',
    description:
      'Manage your active profile, change your profile mascot and welcome greeting style, or lock and unlock age-restricted content using your 4–6 digit Parental PIN.',
    actionHint: 'Open the Profile section in the Sidebar to swap mascots, greetings, or PIN locks.',
    targetSelectors: [
      '[data-tour="sidebar-profile"]',
      '[data-tour="nav-profile"]',
      '[data-tour="sidebar-pin"]',
    ],
    needsSidebar: true,
  },
  {
    id: 'sidebar-accessibility',
    chapterId: 'sidebar',
    title: 'Sidebar Quick Hub: Accessibility & Visual Comfort',
    description:
      'Enable Senior Easy Mode for larger simplified controls, turn on High-Contrast Focus for bright remote highlights, toggle Warm Eye-Care Mode for night viewing, or activate the XL Colored Mouse Pointer.',
    actionHint: 'Toggle any accessibility switch in the Sidebar to tailor visibility and pointer size.',
    targetSelectors: [
      '[data-tour="sidebar-accessibility"]',
      '[data-tour="senior-mode"]',
      '[data-tour="mouse-pointer"]',
    ],
    needsSidebar: true,
  },
  {
    id: 'sidebar-streaming-engine',
    chapterId: 'sidebar',
    title: 'Sidebar Streaming Engine: RAM Mode, Quality & Autoplay',
    description:
      'Tune RABBiT TV for your exact hardware: choose RAM Mode (Auto, Low for streaming sticks/older boxes, or High for full glass animations), set default Stream Quality, and toggle Autoplay Next.',
    actionHint: 'Open the Streaming Engine hub in the Sidebar to adjust RAM mode, quality, or autoplay.',
    targetSelectors: [
      '[data-tour="sidebar-streaming"]',
      '[data-tour="ram-mode"]',
      '[data-tour="stream-quality"]',
    ],
    needsSidebar: true,
    proTip: 'On a Fire TV Stick or low-RAM Android box, Low RAM Mode keeps scrolling fast and crash-free.',
  },
  {
    id: 'sidebar-timers-backup',
    chapterId: 'sidebar',
    title: 'Sidebar Hub: Screensaver, Sleep Timer & JSON Backups',
    description:
      'Set your Screensaver inactivity timer, start a Sleep Timer so playback stops automatically at bedtime, or Export/Restore a complete JSON backup of all profiles, themes, and saved lists.',
    actionHint: 'Use these Sidebar tools to configure timers or save a portable JSON backup file.',
    targetSelectors: [
      '[data-tour="sidebar-timers"]',
      '[data-tour="sidebar-backup"]',
      '[data-tour="screensaver-timer"]',
    ],
    needsSidebar: true,
  },
  {
    id: 'sidebar-support-updates',
    chapterId: 'sidebar',
    title: 'Sidebar Hub: Bug Reports & App Updates',
    description:
      'Spot a broken stream or glitch? Click Community Bug Report / Feedback directly in the Sidebar. Right beside it, check the Update Channel to see if a newer RABBiT TV version is ready.',
    actionHint: 'Click Bug Report to submit feedback, or Check for Updates to stay on the latest build.',
    targetSelectors: [
      '[data-tour="sidebar-bug-report"]',
      '[data-tour="sidebar-updates"]',
      '[data-tour="bug-report"]',
    ],
    needsSidebar: true,
  },

  /* ========================================================================
   * CHAPTER 3: HOME SCREEN (GLOBAL FEED) & MEDIA CARDS
   * ====================================================================== */
  {
    id: 'home-greeting-mascot',
    chapterId: 'home',
    title: 'Home Header: Mascot & Personalized Greeting',
    description:
      'At the top of the Global Feed, RABBiT TV greets you using your chosen Profile Mascot and custom Greeting Style — making it obvious at a glance which profile is active.',
    actionHint: 'Click your mascot or greeting banner to jump straight to profile customization.',
    targetSelectors: [
      '[data-tour="greeting-header"]',
      '[data-tour="profile-mascot"]',
      'header',
    ],
    routeHint: '/',
    needsSidebar: false,
  },
  {
    id: 'home-hero-spotlight',
    chapterId: 'home',
    title: 'Hero Spotlight Banner',
    description:
      'The large featured spotlight highlights a top movie or show. Use Play to launch it immediately, Details to check runtime and cast, or the Heart button to save it to My Favorites.',
    actionHint: 'Click Play, Details, or Favorite right on the Hero Spotlight banner.',
    targetSelectors: [
      '[data-tour="hero-banner"]',
      '[data-tour="hero-play"]',
      'section:first-of-type',
    ],
    routeHint: '/',
    needsSidebar: false,
  },
  {
    id: 'home-algorithm-rows',
    chapterId: 'home',
    title: 'Category & Private Algorithm Rows',
    description:
      'Scroll horizontally through curated rows including Trending, Popular, Top Rated, Regional/Language picks, and recommendations powered by your private on-device algorithm.',
    actionHint: 'Swipe, scroll sideways, or press Left/Right on your remote to browse each row.',
    targetSelectors: [
      '[data-tour="media-row"]',
      '[data-tour="catalog-row"]',
      '[data-tour="trending-row"]',
    ],
    routeHint: '/',
    needsSidebar: false,
  },
  {
    id: 'home-media-cards',
    chapterId: 'home',
    title: 'Interactable Media Cards & Focus Glow',
    description:
      'Hovering or focusing any poster card highlights it with a neon glow (or a bold border in High-Contrast Focus mode). Clicking the card opens its full Movie or TV Show Details Page.',
    actionHint: 'Focus or click any movie or show poster card to view full details.',
    targetSelectors: [
      '[data-tour="media-card"]',
      '[data-tour="poster-card"]',
      'article',
    ],
    needsSidebar: false,
  },
  {
    id: 'home-flip-trailer',
    chapterId: 'home',
    title: 'Flip Cover Art for Instant TMDB Trailers',
    description:
      'Want a quick preview before opening a page? Flip a poster card to reveal its back side and play the official TMDB trailer directly inside the browse grid.',
    actionHint: 'Click the Flip / Trailer icon on a poster card to spin it and preview the trailer.',
    targetSelectors: [
      '[data-tour="card-flip"]',
      '[data-tour="flip-trailer"]',
      '[aria-label*="trailer" i]',
    ],
    needsSidebar: false,
  },
  {
    id: 'home-quick-actions-back',
    chapterId: 'home',
    title: 'Quick Favorite, Dislike & Back to Home Button',
    description:
      'Save titles with the Heart icon, hide titles you do not want recommended using Dislike, and use the custom transparent "Back to Home" PNG button whenever you want an instant shortcut back to the main feed.',
    actionHint: 'Tap the Heart icon to favorite, or click Back to Home from any inner page.',
    targetSelectors: [
      '[data-tour="card-favorite"]',
      '[data-tour="back-to-home"]',
      '[aria-label*="Back to Home" i]',
    ],
    needsSidebar: false,
  },

  /* ========================================================================
   * CHAPTER 4: MOVIES & TV SHOWS CATALOGS
   * ====================================================================== */
  {
    id: 'catalog-switch',
    chapterId: 'catalog',
    title: 'Dedicated Movies & TV Shows Catalogs',
    description:
      'Open Movies for feature films or TV Shows for series. Each catalog loads fresh metadata directly from TMDB with crisp cover art, ratings, and release years.',
    actionHint: 'Switch between Movies and TV Shows using the Sidebar or catalog header tabs.',
    targetSelectors: [
      '[data-tour="catalog-grid"]',
      '[data-tour="movies-grid"]',
      '[data-tour="tv-grid"]',
    ],
    routeHint: '/movies',
    needsSidebar: false,
  },
  {
    id: 'catalog-genre-provider',
    chapterId: 'catalog',
    title: 'Genre & Streaming Provider Filters',
    description:
      'Narrow thousands of titles in seconds. Filter by Genre (Action, Comedy, Sci-Fi, Horror, Documentary, Kids, etc.) or filter by Streaming Provider / Network to find platform exclusives.',
    actionHint: 'Click any Genre chip or Provider dropdown to filter the catalog grid live.',
    targetSelectors: [
      '[data-tour="genre-filter"]',
      '[data-tour="provider-filter"]',
      '[data-tour="catalog-filters"]',
    ],
    needsSidebar: false,
  },
  {
    id: 'catalog-region-language-age',
    chapterId: 'catalog',
    title: 'Region, Language & Age Rating Filters',
    description:
      'Browse catalogs by country/region or spoken language. When Parental Age Restrictions are turned on, mature ratings are automatically filtered out of every catalog and search.',
    actionHint: 'Use the Region and Language selectors to explore international or local catalogs.',
    targetSelectors: [
      '[data-tour="region-filter"]',
      '[data-tour="language-filter"]',
      '[data-tour="age-filter"]',
    ],
    needsSidebar: false,
  },
  {
    id: 'catalog-grid-sizing',
    chapterId: 'catalog',
    title: 'Poster Shapes & Card Size Scaling',
    description:
      'Resize posters to match your screen. Choose compact cards to scan lots of titles at once on a phone or monitor, or oversized posters for effortless reading across the living room.',
    actionHint: 'Adjust the Card Size or Poster Shape controls to reshape the grid immediately.',
    targetSelectors: [
      '[data-tour="poster-size"]',
      '[data-tour="poster-shape"]',
      '[data-tour="card-size"]',
    ],
    needsSidebar: false,
  },
  {
    id: 'catalog-pagination',
    chapterId: 'catalog',
    title: 'Load More & Deep Catalog Browsing',
    description:
      'Reached the bottom of the current grid? Click Load More or Next Page to keep pulling deeper pages of movies and shows from TMDB.',
    actionHint: 'Scroll to the end of the grid and click Load More / Next Page.',
    targetSelectors: [
      '[data-tour="load-more"]',
      '[data-tour="pagination"]',
      'button[aria-label*="next" i]',
    ],
    needsSidebar: false,
  },

  /* ========================================================================
   * CHAPTER 5: MOVIE & TV SHOW DETAILS PAGES
   * ====================================================================== */
  {
    id: 'details-metadata-finish-time',
    chapterId: 'details',
    title: 'Full Metadata & Live Estimated Finish Time',
    description:
      'Every Details page displays high-res artwork, plot synopsis, rating, release year, runtime, and a live "Ends at..." Estimated Finish Time showing the exact clock time playback will finish if you press Play now.',
    actionHint: 'Check the runtime and Estimated Finish Time right below the title header.',
    targetSelectors: [
      '[data-tour="details-metadata"]',
      '[data-tour="finish-time"]',
      '[data-tour="details-header"]',
    ],
    needsSidebar: false,
  },
  {
    id: 'details-play-resume',
    chapterId: 'details',
    title: 'Play / Resume Button',
    description:
      'Click the custom Play button to launch the video player immediately. If you watched part of the movie or episode earlier, RABBiT TV remembers your progress so you can pick right back up.',
    actionHint: 'Click Play (or Resume) to launch full-screen ad-free streaming.',
    targetSelectors: [
      '[data-tour="details-play"]',
      '[data-tour="play-button"]',
      'button[aria-label*="play" i]',
    ],
    needsSidebar: false,
  },
  {
    id: 'details-watch-trailer',
    chapterId: 'details',
    title: 'Watch Official TMDB Trailer',
    description:
      'Not sure if you want to commit to a full movie? Click Watch Trailer to play the official preview pulled directly from TMDB.',
    actionHint: 'Click the Watch Trailer button on any Details page.',
    targetSelectors: [
      '[data-tour="details-trailer"]',
      '[data-tour="watch-trailer"]',
    ],
    needsSidebar: false,
  },
  {
    id: 'details-favorite',
    chapterId: 'details',
    title: 'Save or Remove from My Favorites',
    description:
      'Click Add to Favorites to bookmark the title to your personal Watchlist. Click it again anytime to remove it once you have finished watching.',
    actionHint: 'Toggle the Favorite button to save or unsave the current movie or series.',
    targetSelectors: [
      '[data-tour="details-favorite"]',
      '[data-tour="favorite-button"]',
    ],
    needsSidebar: false,
  },
  {
    id: 'details-seasons-episodes',
    chapterId: 'details',
    title: 'Season Selector & Episode Cards (TV Shows)',
    description:
      'On TV Show pages, use the Season dropdown or tabs to switch between seasons. Each Episode card shows its thumbnail, episode summary, runtime, and watched status — click any card to play that episode.',
    actionHint: 'Pick a Season and click any Episode card to start streaming.',
    targetSelectors: [
      '[data-tour="season-selector"]',
      '[data-tour="episode-list"]',
      '[data-tour="episode-card"]',
    ],
    needsSidebar: false,
  },
  {
    id: 'details-report-broken',
    chapterId: 'details',
    title: 'Report Broken Stream Button',
    description:
      'If a movie or episode link fails to load or plays the wrong video, click the custom "Report Broken" button to flag that exact title so it can be investigated and fixed.',
    actionHint: 'Click Report Broken whenever a stream will not load.',
    targetSelectors: [
      '[data-tour="report-broken"]',
      'button[aria-label*="report" i]',
    ],
    needsSidebar: false,
  },
  {
    id: 'details-imdb-back',
    chapterId: 'details',
    title: 'Official IMDb Link & Back Navigation',
    description:
      'Want full cast trivia, parental guides, or user reviews? Click the official IMDb link on the Details page to open that title on IMDb. Use Back or Back to Home to return to browsing.',
    actionHint: 'Click the IMDb badge to view external cast/reviews, or Back to Home to return.',
    targetSelectors: [
      '[data-tour="imdb-link"]',
      'a[href*="imdb.com" i]',
      '[data-tour="back-button"]',
    ],
    needsSidebar: false,
  },

  /* ========================================================================
   * CHAPTER 6: VIDEO PLAYER & PLAYBACK CONTROLS
   * ====================================================================== */
  {
    id: 'player-adblock-radio',
    chapterId: 'player',
    title: 'Built-In uBlock Ad-Free Streaming',
    description:
      'RABBiT TV runs built-in uBlock-based ad blocking automatically so streams stay clean without popups or ad redirects. Starting playback also automatically pauses Background Lobby Radio.',
    actionHint: 'No setup needed — ad blocking and radio auto-pause run automatically during playback.',
    targetSelectors: ['[data-tour="video-player"]', 'video', 'iframe'],
    needsSidebar: false,
  },
  {
    id: 'player-play-seek',
    chapterId: 'player',
    title: 'Play / Pause, Progress Seek Bar & Quick Skip',
    description:
      'Use Play/Pause (click, tap, Spacebar, or OK on a remote) to control playback. Drag the Seek Bar or press Left/Right to skip backward or forward to any moment.',
    actionHint: 'Tap the video or move the mouse/remote to reveal the on-screen player bar.',
    targetSelectors: [
      '[data-tour="player-play-pause"]',
      '[data-tour="player-seekbar"]',
      '[data-tour="player-controls"]',
    ],
    needsSidebar: false,
  },
  {
    id: 'player-volume-quality',
    chapterId: 'player',
    title: 'Volume, Mute & Stream Quality Selector',
    description:
      'Adjust video volume independently from Lobby Radio, tap Mute for instant silence, or switch Stream Quality up or down if your internet slows down or buffers.',
    actionHint: 'Use the Speaker icon for volume/mute and the Quality gear to change resolution.',
    targetSelectors: [
      '[data-tour="player-volume"]',
      '[data-tour="player-quality"]',
    ],
    needsSidebar: false,
  },
  {
    id: 'player-episode-autoplay',
    chapterId: 'player',
    title: 'In-Player Episode Switcher & Autoplay Next',
    description:
      'Binge-watching a series? Jump straight to the Next Episode, Previous Episode, or another Season without leaving the player. Keep Autoplay enabled to roll automatically into the next episode.',
    actionHint: 'Click Next Episode or open the In-Player Season/Episode menu during TV playback.',
    targetSelectors: [
      '[data-tour="player-next-episode"]',
      '[data-tour="player-episodes"]',
      '[data-tour="player-autoplay"]',
    ],
    needsSidebar: false,
  },
  {
    id: 'player-fullscreen-exit',
    chapterId: 'player',
    title: 'Fullscreen Toggle & Exit Player',
    description:
      'Expand playback edge-to-edge with Fullscreen, or hit Exit / Back to leave the player. Your progress saves automatically into Watch History so you never lose your place.',
    actionHint: 'Click Fullscreen to maximize video, or Back/Exit to return to the Details page.',
    targetSelectors: [
      '[data-tour="player-fullscreen"]',
      '[data-tour="player-exit"]',
    ],
    needsSidebar: false,
  },
  {
    id: 'player-report-broken',
    chapterId: 'player',
    title: 'In-Player Report Broken Stream',
    description:
      'If a video freezes, has missing audio, or refuses to play while inside the player, hit the In-Player Report Broken button to send a report immediately.',
    actionHint: 'Click Report Broken inside the player controls if a stream acts up.',
    targetSelectors: ['[data-tour="player-report-broken"]', '[data-tour="report-broken"]'],
    needsSidebar: false,
  },

  /* ========================================================================
   * CHAPTER 7: TRAILERS HUB
   * ====================================================================== */
  {
    id: 'trailers-feed',
    chapterId: 'trailers',
    title: 'Dedicated Trailers Browser',
    description:
      'Not sure what to watch tonight? Open the Trailers section from the Sidebar to browse a visual wall of trending and upcoming trailers powered by TMDB.',
    actionHint: 'Scroll through the Trailers feed to discover upcoming movies and series.',
    targetSelectors: ['[data-tour="trailers-page"]', '[data-tour="trailers-grid"]'],
    routeHint: '/trailers',
    needsSidebar: false,
  },
  {
    id: 'trailers-flip-play',
    chapterId: 'trailers',
    title: 'Flip & Play Trailers Inline',
    description:
      'Click or flip any cover card in the Trailers feed to watch its preview immediately right on the screen without navigating away.',
    actionHint: 'Click any trailer card to flip the cover art and start playing the preview.',
    targetSelectors: ['[data-tour="trailer-card"]', '[data-tour="card-flip"]'],
    needsSidebar: false,
  },
  {
    id: 'trailers-quick-jump',
    chapterId: 'trailers',
    title: 'Jump to Full Details or Save for Later',
    description:
      'Like what you see in a trailer? Click straight through to the title’s full Details Page to watch it now, or tap Favorite to bookmark it for later.',
    actionHint: 'Use the Details or Heart buttons attached to any trailer preview.',
    targetSelectors: ['[data-tour="trailer-details"]', '[data-tour="trailer-favorite"]'],
    needsSidebar: false,
  },

  /* ========================================================================
   * CHAPTER 8: LIVE TV (284+ CHANNELS)
   * ====================================================================== */
  {
    id: 'livetv-categories',
    chapterId: 'livetv',
    title: 'Live TV Genre Category Tabs (284+ Channels)',
    description:
      'RABBiT TV includes over 284 live streaming channels automatically organized by smart keyword categories — including Sports, News, Movies, Entertainment, Kids, and Music.',
    actionHint: 'Click any category pill at the top of Live TV to filter the channel lineup.',
    targetSelectors: [
      '[data-tour="livetv-categories"]',
      '[data-tour="channel-categories"]',
    ],
    routeHint: '/live',
    needsSidebar: false,
  },
  {
    id: 'livetv-search',
    chapterId: 'livetv',
    title: 'Live Channel Instant Search',
    description:
      'Looking for a specific network or sports broadcast? Type a channel name or keyword into the Live TV search bar to filter the lineup in real time.',
    actionHint: 'Type any channel name (like News, Sports, or Movies) in the Live TV search box.',
    targetSelectors: ['[data-tour="livetv-search"]', '[data-tour="channel-search"]'],
    needsSidebar: false,
  },
  {
    id: 'livetv-pin-favorites',
    chapterId: 'livetv',
    title: 'Pin Your Favorite Live Channels',
    description:
      'Click the Pin / Star icon on any channel you watch regularly. Pinned channels lock right to the top of your Live TV list and also appear in My Favorites for instant access.',
    actionHint: 'Click the Pin icon on any channel card to lock it to the top.',
    targetSelectors: ['[data-tour="channel-pin"]', '[data-tour="livetv-pin"]'],
    needsSidebar: false,
  },
  {
    id: 'livetv-watch-history-report',
    chapterId: 'livetv',
    title: 'Tune In, Auto-History & Offline Reports',
    description:
      'Click any channel card to start watching live. Every channel you tune into is automatically logged in Watch History so you can jump back fast. If a channel is offline, click Report Broken.',
    actionHint: 'Select any channel to start streaming live, or Report Broken if it is down.',
    targetSelectors: ['[data-tour="channel-card"]', '[data-tour="livetv-player"]'],
    needsSidebar: false,
  },

  /* ========================================================================
   * CHAPTER 9: GLOBAL SEARCH
   * ====================================================================== */
  {
    id: 'search-bar-clear',
    chapterId: 'search',
    title: 'Global Search Bar & One-Click Clear',
    description:
      'Search across the entire RABBiT TV universe at once — movies, TV series, actors, and live TV channels. Use the X Clear button to wipe your search and start fresh in one tap.',
    actionHint: 'Type any title, actor, or channel into the Search input, or click X to clear.',
    targetSelectors: [
      '[data-tour="global-search-input"]',
      'input[type="search"]',
      'input[placeholder*="search" i]',
    ],
    routeHint: '/search',
    needsSidebar: false,
  },
  {
    id: 'search-filters',
    chapterId: 'search',
    title: 'Search Result Tabs & Filters',
    description:
      'Narrow search results using the Movies, TV Shows, and Live TV tabs, plus genre, language, and active age-rating filters so you find the exact match fast.',
    actionHint: 'Click result tabs or filter chips right below the Search bar.',
    targetSelectors: ['[data-tour="search-tabs"]', '[data-tour="search-filters"]'],
    needsSidebar: false,
  },
  {
    id: 'search-launch',
    chapterId: 'search',
    title: 'Jump Straight to Any Result',
    description:
      'Click any search result card to open its Movie/TV Details Page or launch a matching Live TV channel immediately.',
    actionHint: 'Select any result card to open details or start watching.',
    targetSelectors: ['[data-tour="search-results"]', '[data-tour="media-card"]'],
    needsSidebar: false,
  },

  /* ========================================================================
   * CHAPTER 10: MY FAVORITES (WATCHLIST)
   * ====================================================================== */
  {
    id: 'favorites-library',
    chapterId: 'favorites',
    title: 'Your Personal Favorites & Watchlist',
    description:
      'My Favorites brings together every movie, TV show, and pinned Live TV channel you have saved in one clean, distraction-free shelf.',
    actionHint: 'Open My Favorites from the Sidebar to browse everything you bookmarked.',
    targetSelectors: ['[data-tour="favorites-page"]', '[data-tour="favorites-grid"]'],
    routeHint: '/favorites',
    needsSidebar: false,
  },
  {
    id: 'favorites-launch-remove',
    chapterId: 'favorites',
    title: 'One-Click Launch & Remove Items',
    description:
      'Click any saved poster or pinned channel to start watching right away. Finished with a title? Click its Heart/Remove button to tidy up your Watchlist.',
    actionHint: 'Click a saved card to watch, or click Remove to take it off your list.',
    targetSelectors: ['[data-tour="favorite-remove"]', '[data-tour="favorites-grid"]'],
    needsSidebar: false,
  },

  /* ========================================================================
   * CHAPTER 11: WATCH HISTORY & ACTIVITY HUB
   * ====================================================================== */
  {
    id: 'history-search-filter-sort',
    chapterId: 'history',
    title: 'Watch History: Search, Filter & Sort',
    description:
      'Your Watch History Hub tracks Movies, TV Shows, and Live TV channels automatically. Search past titles by name, filter by media type, and sort by newest, oldest, or alphabetical order.',
    actionHint: 'Use the History search box, type tabs, and sort dropdown to find anything you watched.',
    targetSelectors: [
      '[data-tour="history-page"]',
      '[data-tour="history-search"]',
      '[data-tour="history-filters"]',
    ],
    routeHint: '/history',
    needsSidebar: false,
  },
  {
    id: 'history-resume',
    chapterId: 'history',
    title: 'One-Click Resume from History',
    description:
      'Forgot which episode you were on or which live channel you watched yesterday? Click any entry in Watch History to jump right back into it.',
    actionHint: 'Click any history item to resume watching immediately.',
    targetSelectors: ['[data-tour="history-item"]', '[data-tour="history-list"]'],
    needsSidebar: false,
  },
  {
    id: 'history-bulk-delete',
    chapterId: 'history',
    title: 'Single Delete & Bulk Cleanup',
    description:
      'Keep your history private and clean. Remove a single item with its Delete icon, or select multiple entries to clear history in bulk with one confirmation.',
    actionHint: 'Use individual Delete buttons or Bulk Select to clear unwanted history entries.',
    targetSelectors: ['[data-tour="history-bulk-delete"]', '[data-tour="history-delete"]'],
    needsSidebar: false,
  },
  {
    id: 'history-export',
    chapterId: 'history',
    title: 'Export Watch History Snapshot',
    description:
      'Want a record of everything you have watched? Click Export Snapshot to download a clean backup file of your viewing activity.',
    actionHint: 'Click Export Snapshot in the Watch History toolbar to save a copy.',
    targetSelectors: ['[data-tour="history-export"]', 'button[aria-label*="export" i]'],
    needsSidebar: false,
  },

  /* ========================================================================
   * CHAPTER 12: FULL SETTINGS, PERSONALIZATION, TIMERS & BACKUPS
   * ====================================================================== */
  {
    id: 'settings-appearance',
    chapterId: 'settings',
    title: 'Settings: Themes, Poster Layouts & Warm Eye-Care',
    description:
      'Open full Settings to dial in every visual detail: pick Violet, Red, Midnight, or neon themes, adjust poster shapes and card sizes, and toggle Warm Eye-Care Mode to reduce blue-light glare at night.',
    actionHint: 'Pick your favorite color theme, poster style, and eye-care setting.',
    targetSelectors: ['[data-tour="settings-appearance"]', '[data-tour="theme-picker"]'],
    routeHint: '/settings',
    needsSidebar: false,
  },
  {
    id: 'settings-personalization',
    chapterId: 'settings',
    title: 'Settings: Mascots, Greetings, Region & Language',
    description:
      'Make RABBiT TV feel yours: pick a Profile Mascot, choose your Home screen Greeting Style, and set your preferred catalog Region and spoken Language.',
    actionHint: 'Select a mascot, greeting style, and preferred language/region.',
    targetSelectors: ['[data-tour="settings-personalization"]', '[data-tour="mascot-picker"]'],
    needsSidebar: false,
  },
  {
    id: 'settings-accessibility',
    chapterId: 'settings',
    title: 'Settings: Senior Easy Mode, Focus & XL Pointer',
    description:
      'Turn on Senior Easy Mode for larger, simplified screens; enable High-Contrast Focus for TV remotes; or turn on the oversized, high-visibility Colored Mouse Pointer for big TVs and projectors.',
    actionHint: 'Toggle any accessibility feature here to make reading and clicking effortless.',
    targetSelectors: ['[data-tour="settings-accessibility"]', '[data-tour="senior-mode"]'],
    needsSidebar: false,
  },
  {
    id: 'settings-performance',
    chapterId: 'settings',
    title: 'Settings: RAM Modes (Auto / Low / High) & Playback',
    description:
      'Match RABBiT TV to your hardware: Auto adjusts automatically, Low strips heavy blur/animations for older Fire Sticks or budget boxes, and High unlocks full visual flair. Set default Stream Quality and Autoplay here too.',
    actionHint: 'Choose Auto, Low, or High RAM Mode and your preferred Stream Quality.',
    targetSelectors: ['[data-tour="settings-performance"]', '[data-tour="ram-mode"]'],
    needsSidebar: false,
  },
  {
    id: 'settings-timers-security',
    chapterId: 'settings',
    title: 'Settings: Screensaver, Sleep Timer & Parental PIN',
    description:
      'Configure your Screensaver timeout and Sleep Timer countdown, update your 4–6 digit Parental PIN, set maximum allowed Age Ratings per profile, and check your App Passcode / Trial status.',
    actionHint: 'Adjust timers or lock down age ratings and your Parental PIN.',
    targetSelectors: ['[data-tour="settings-security"]', '[data-tour="settings-timers"]'],
    needsSidebar: false,
  },
  {
    id: 'settings-backup-relaunch',
    chapterId: 'settings',
    title: 'Settings: JSON Backup & Restore, Reports & Relaunch Tour',
    description:
      'Export a complete JSON backup of all profiles, themes, favorites, and settings — or Restore a JSON file on a new TV or phone in seconds. You can also report bugs, check updates, or Relaunch this Walkthrough anytime.',
    actionHint: 'Use Export/Restore JSON to move your setup between devices, or click Relaunch Walkthrough.',
    targetSelectors: [
      '[data-tour="settings-backup"]',
      '[data-tour="relaunch-walkthrough"]',
    ],
    needsSidebar: false,
  },

  /* ========================================================================
   * CHAPTER 13: PAGE FOOTERS, APP VERSION & TMDB ATTRIBUTION LINK
   * ====================================================================== */
  {
    id: 'footer-scroll',
    chapterId: 'footer',
    title: 'Page Footer Bar & Bottom Quick Links',
    description:
      'Scroll all the way to the bottom of Home, Catalog, or Details pages to reach the Footer Bar. It gives you quick links for credits, reporting bugs, jumping back to the top, and official data attribution.',
    actionHint: 'Scroll to the bottom of the page to inspect the footer links.',
    targetSelectors: ['[data-tour="app-footer"]', 'footer'],
    needsSidebar: false,
    scrollToBottom: true,
  },
  {
    id: 'footer-tmdb-link',
    chapterId: 'footer',
    title: 'Clicking the Official TMDB Logo & Link',
    description:
      'RABBiT TV gets movie posters, episode summaries, cast info, and trailers from The Movie Database (TMDB). Clicking the TMDB logo or link at the bottom of the page opens themoviedb.org in your browser so you can explore the full public film database directly.',
    actionHint: 'Click the TMDB logo or link in the footer whenever you want to visit themoviedb.org.',
    targetSelectors: [
      '[data-tour="tmdb-link"]',
      'footer a[href*="themoviedb.org" i]',
      'a[href*="themoviedb.org" i]',
      'footer img[alt*="tmdb" i]',
    ],
    needsSidebar: false,
    scrollToBottom: true,
    proTip: 'This footer also shows the official notice that RABBiT TV uses the TMDB API but is not endorsed or certified by TMDB.',
  },
  {
    id: 'footer-version-complete',
    chapterId: 'footer',
    title: 'App Version Badge — You Are Ready!',
    description:
      'Right beside the footer links is your installed RABBiT TV Version Badge — handy when checking for updates or submitting a bug report. You have now walked through every single feature in RABBiT TV. Enjoy ad-free streaming!',
    actionHint: 'Click Finish Tour to start watching, or open Chapters to revisit any section.',
    targetSelectors: [
      '[data-tour="app-version"]',
      '[data-tour="version-badge"]',
      'footer',
    ],
    needsSidebar: false,
    scrollToBottom: true,
  },
];

/* ============================================================================
 * Helper utilities for triggering / resetting walkthrough from anywhere
 * ========================================================================== */

/** Call this from Settings -> "Relaunch Walkthrough" to start from Step 1 */
export function triggerRabbitWalkthrough(stepIndex = 0): void {
  try {
    localStorage.setItem(WALKTHROUGH_STEP_KEY, String(stepIndex));
  } catch {
    // Ignore storage quota / private mode issues
  }
  window.dispatchEvent(
    new CustomEvent(WALKTHROUGH_OPEN_EVENT, { detail: { stepIndex } })
  );
}

/** Clears saved completion flag so the tour launches again on next reload */
export function resetRabbitWalkthrough(): void {
  try {
    localStorage.removeItem(WALKTHROUGH_COMPLETED_KEY);
    localStorage.removeItem(WALKTHROUGH_STEP_KEY);
  } catch {
    // Ignore storage errors
  }
}

/* ============================================================================
 * Internal DOM helpers
 * ========================================================================== */

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function findFirstVisibleElement(selectors: string[]): HTMLElement | null {
  for (const selector of selectors) {
    try {
      const nodes = document.querySelectorAll<HTMLElement>(selector);
      for (let i = 0; i < nodes.length; i++) {
        const el = nodes[i];
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        const isVisible =
          rect.width > 4 &&
          rect.height > 4 &&
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          parseFloat(style.opacity || '1') > 0.05;
        if (isVisible) {
          return el;
        }
      }
    } catch {
      // Ignore invalid selector syntax on older WebViews
    }
  }
  return null;
}

function getClampedCardPosition(
  rect: SpotlightRect | null,
  cardWidth: number,
  cardHeight: number
): { top: number; left: number; placement: 'center' | 'bottom' | 'top' | 'right' | 'left' } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const margin = 16;

  if (!rect) {
    return {
      top: Math.max(margin, Math.round((vh - cardHeight) / 2)),
      left: Math.max(margin, Math.round((vw - cardWidth) / 2)),
      placement: 'center',
    };
  }

  // If element covers almost the entire screen, center the card cleanly
  if (rect.width > vw * 0.78 && rect.height > vh * 0.72) {
    return {
      top: Math.max(margin, Math.round((vh - cardHeight) / 2)),
      left: Math.max(margin, Math.round((vw - cardWidth) / 2)),
      placement: 'center',
    };
  }

  // Prefer placing to the right if highlighting a left-docked Sidebar
  if (rect.left < vw * 0.35 && rect.left + rect.width + cardWidth + margin * 2 < vw) {
    const idealTop = rect.top + rect.height / 2 - cardHeight / 2;
    return {
      top: Math.min(Math.max(margin, idealTop), Math.max(margin, vh - cardHeight - margin)),
      left: Math.round(rect.left + rect.width + margin),
      placement: 'right',
    };
  }

  // Try below the spotlight
  if (rect.top + rect.height + cardHeight + margin * 2 < vh) {
    const idealLeft = rect.left + rect.width / 2 - cardWidth / 2;
    return {
      top: Math.round(rect.top + rect.height + margin),
      left: Math.min(Math.max(margin, idealLeft), Math.max(margin, vw - cardWidth - margin)),
      placement: 'bottom',
    };
  }

  // Try above the spotlight
  if (rect.top - cardHeight - margin * 2 > 0) {
    const idealLeft = rect.left + rect.width / 2 - cardWidth / 2;
    return {
      top: Math.round(rect.top - cardHeight - margin),
      left: Math.min(Math.max(margin, idealLeft), Math.max(margin, vw - cardWidth - margin)),
      placement: 'top',
    };
  }

  // Try left of the spotlight
  if (rect.left - cardWidth - margin * 2 > 0) {
    const idealTop = rect.top + rect.height / 2 - cardHeight / 2;
    return {
      top: Math.min(Math.max(margin, idealTop), Math.max(margin, vh - cardHeight - margin)),
      left: Math.round(rect.left - cardWidth - margin),
      placement: 'left',
    };
  }

  // Fallback: bottom-center of viewport
  return {
    top: Math.max(margin, vh - cardHeight - margin),
    left: Math.max(margin, Math.round((vw - cardWidth) / 2)),
    placement: 'center',
  };
}

/* ============================================================================
 * Main Component: InteractiveWalkthrough
 * ========================================================================== */

export const InteractiveWalkthrough: React.FC<InteractiveWalkthroughProps> = ({
  isOpen: controlledOpen,
  autoStartOnFirstLaunch = true,
  forceShow = false,
  onClose,
  onComplete,
  onNavigate,
  onToggleSidebar,
  initialStepIndex,
}) => {
  const [internalOpen, setInternalOpen] = useState<boolean>(() => {
    if (forceShow) return true;
    if (controlledOpen !== undefined) return controlledOpen;
    if (!autoStartOnFirstLaunch) return false;
    try {
      return localStorage.getItem(WALKTHROUGH_COMPLETED_KEY) !== 'true';
    } catch {
      return false;
    }
  });

  const isVisible = forceShow || (controlledOpen !== undefined ? controlledOpen : internalOpen);

  const [stepIndex, setStepIndex] = useState<number>(() => {
    if (typeof initialStepIndex === 'number') {
      return Math.max(0, Math.min(WALKTHROUGH_STEPS.length - 1, initialStepIndex));
    }
    try {
      const saved = parseInt(localStorage.getItem(WALKTHROUGH_STEP_KEY) || '0', 10);
      if (!Number.isNaN(saved) && saved >= 0 && saved < WALKTHROUGH_STEPS.length) {
        return saved;
      }
    } catch {
      // Ignore storage errors
    }
    return 0;
  });

  const [showChapterMenu, setShowChapterMenu] = useState<boolean>(false);
  const [showWelcomeGate, setShowWelcomeGate] = useState<boolean>(() => {
    try {
      const saved = parseInt(localStorage.getItem(WALKTHROUGH_STEP_KEY) || '0', 10);
      return !(saved > 0);
    } catch {
      return true;
    }
  });
  const [targetRect, setTargetRect] = useState<SpotlightRect | null>(null);
  const [targetFound, setTargetFound] = useState<boolean>(false);
  const [viewportTick, setViewportTick] = useState<number>(0);

  const cardRef = useRef<HTMLDivElement | null>(null);
  const nextBtnRef = useRef<HTMLButtonElement | null>(null);
  const activeTargetElRef = useRef<HTMLElement | null>(null);

  const currentStep = WALKTHROUGH_STEPS[stepIndex] || WALKTHROUGH_STEPS[0];
  const currentChapter = useMemo(
    () =>
      WALKTHROUGH_CHAPTERS.find((c) => c.id === currentStep.chapterId) ||
      WALKTHROUGH_CHAPTERS[0],
    [currentStep.chapterId]
  );

  const totalSteps = WALKTHROUGH_STEPS.length;
  const progressPercent = Math.round(((stepIndex + 1) / totalSteps) * 100);

  // Sync controlled open prop if provided
  useEffect(() => {
    if (controlledOpen !== undefined) {
      setInternalOpen(controlledOpen);
    }
  }, [controlledOpen]);

  // Listen for global relaunch event (e.g. Settings -> Relaunch Walkthrough)
  useEffect(() => {
    const handleOpenEvent = (event: Event) => {
      const custom = event as CustomEvent<{ stepIndex?: number }>;
      const nextIdx =
        typeof custom.detail?.stepIndex === 'number'
          ? Math.max(0, Math.min(WALKTHROUGH_STEPS.length - 1, custom.detail.stepIndex))
          : 0;
      setStepIndex(nextIdx);
      setShowWelcomeGate(nextIdx === 0);
      setShowChapterMenu(false);
      setInternalOpen(true);
    };

    window.addEventListener(WALKTHROUGH_OPEN_EVENT, handleOpenEvent);
    return () => window.removeEventListener(WALKTHROUGH_OPEN_EVENT, handleOpenEvent);
  }, []);

  // Persist current step progress
  useEffect(() => {
    if (!isVisible) return;
    try {
      localStorage.setItem(WALKTHROUGH_STEP_KEY, String(stepIndex));
    } catch {
      // Ignore storage errors
    }
  }, [isVisible, stepIndex]);

  const finishWalkthrough = useCallback(
    (completed: boolean) => {
      try {
        localStorage.setItem(WALKTHROUGH_COMPLETED_KEY, 'true');
        if (completed) {
          localStorage.removeItem(WALKTHROUGH_STEP_KEY);
        }
      } catch {
        // Ignore storage errors
      }
      setInternalOpen(false);
      setShowChapterMenu(false);
      if (completed) {
        onComplete?.();
      } else {
        onClose?.();
      }
    },
    [onClose, onComplete]
  );

  const goNext = useCallback(() => {
    setShowChapterMenu(false);
    if (stepIndex < totalSteps - 1) {
      setStepIndex((prev) => prev + 1);
    } else {
      finishWalkthrough(true);
    }
  }, [stepIndex, totalSteps, finishWalkthrough]);

  const goPrev = useCallback(() => {
    setShowChapterMenu(false);
    setStepIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const jumpToChapter = useCallback((chapterId: WalkthroughChapterId) => {
    const idx = WALKTHROUGH_STEPS.findIndex((s) => s.chapterId === chapterId);
    if (idx !== -1) {
      setStepIndex(idx);
      setShowWelcomeGate(false);
      setShowChapterMenu(false);
    }
  }, []);

  // Coordinate sidebar visibility and optional route hints for the current step
  useEffect(() => {
    if (!isVisible || showWelcomeGate) return;

    if (typeof currentStep.needsSidebar === 'boolean') {
      onToggleSidebar?.(currentStep.needsSidebar);
      window.dispatchEvent(
        new CustomEvent(SIDEBAR_TOGGLE_EVENT, {
          detail: { open: currentStep.needsSidebar },
        })
      );
    }

    if (currentStep.routeHint && onNavigate) {
      try {
        if (window.location.pathname !== currentStep.routeHint) {
          onNavigate(currentStep.routeHint);
        }
      } catch {
        // Ignore navigation errors if router is not mounted
      }
    }

    if (currentStep.scrollToBottom) {
      try {
        window.scrollTo({
          top: document.documentElement.scrollHeight,
          behavior: 'smooth',
        });
      } catch {
        window.scrollTo(0, document.documentElement.scrollHeight);
      }
    }
  }, [isVisible, showWelcomeGate, currentStep, onNavigate, onToggleSidebar]);

  // Measure and spotlight target element + optional click-to-advance listener
  useEffect(() => {
    if (!isVisible || showWelcomeGate) {
      setTargetRect(null);
      setTargetFound(false);
      activeTargetElRef.current = null;
      return;
    }

    let cancelled = false;
    let attachedEl: HTMLElement | null = null;

    const handleTargetInteraction = () => {
      if (currentStep.advanceOnTargetClick) {
        window.setTimeout(() => {
          if (!cancelled) {
            goNext();
          }
        }, 180);
      }
    };

    const locateAndMeasure = (shouldScroll: boolean) => {
      if (cancelled) return;
      const el = findFirstVisibleElement(currentStep.targetSelectors);

      if (attachedEl && attachedEl !== el) {
        attachedEl.removeEventListener('click', handleTargetInteraction);
        attachedEl = null;
      }

      if (!el) {
        activeTargetElRef.current = null;
        setTargetRect(null);
        setTargetFound(false);
        return;
      }

      activeTargetElRef.current = el;
      setTargetFound(true);

      if (shouldScroll && !currentStep.scrollToBottom) {
        try {
          el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        } catch {
          // Ignore scroll errors
        }
      }

      const raw = el.getBoundingClientRect();
      const pad = 8;
      setTargetRect({
        top: Math.max(4, raw.top - pad),
        left: Math.max(4, raw.left - pad),
        width: Math.min(window.innerWidth - 8, raw.width + pad * 2),
        height: Math.min(window.innerHeight - 8, raw.height + pad * 2),
      });

      if (currentStep.advanceOnTargetClick && attachedEl !== el) {
        attachedEl = el;
        el.addEventListener('click', handleTargetInteraction);
      }
    };

    // Initial measure + delayed re-measure after sidebar animation / route transition
    locateAndMeasure(true);
    const t1 = window.setTimeout(() => locateAndMeasure(true), 220);
    const t2 = window.setTimeout(() => locateAndMeasure(false), 550);

    const onViewportChange = () => {
      setViewportTick((v) => v + 1);
      locateAndMeasure(false);
    };

    window.addEventListener('resize', onViewportChange);
    window.addEventListener('scroll', onViewportChange, true);

    return () => {
      cancelled = true;
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('scroll', onViewportChange, true);
      if (attachedEl) {
        attachedEl.removeEventListener('click', handleTargetInteraction);
      }
    };
  }, [isVisible, showWelcomeGate, currentStep, goNext]);

  // Keyboard & TV Remote D-Pad navigation
  useEffect(() => {
    if (!isVisible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (showChapterMenu) {
          setShowChapterMenu(false);
        } else {
          finishWalkthrough(false);
        }
        return;
      }

      if (showWelcomeGate) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setShowWelcomeGate(false);
        }
        return;
      }

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrev();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isVisible, showWelcomeGate, showChapterMenu, goNext, goPrev, finishWalkthrough]);

  // Keep Next button focusable for smooth TV remote navigation
  useEffect(() => {
    if (isVisible && !showWelcomeGate && !showChapterMenu) {
      nextBtnRef.current?.focus({ preventScroll: true });
    }
  }, [isVisible, showWelcomeGate, showChapterMenu, stepIndex]);

  if (!isVisible || typeof document === 'undefined') {
    return null;
  }

  // Calculate responsive floating tooltip position
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const cardWidth = Math.min(440, Math.max(290, vw - 32));
  const estimatedHeight = cardRef.current?.offsetHeight || 310;
  const pos = getClampedCardPosition(
    showWelcomeGate ? null : targetRect,
    cardWidth,
    estimatedHeight
  );
  // Reference viewportTick so memoized layout responds to resize
  void viewportTick;

  const chapterStepCounts = WALKTHROUGH_CHAPTERS.map((ch) => {
    const stepsInChapter = WALKTHROUGH_STEPS.filter((s) => s.chapterId === ch.id);
    const firstIndex = WALKTHROUGH_STEPS.findIndex((s) => s.chapterId === ch.id);
    const lastIndex = firstIndex + stepsInChapter.length - 1;
    const isCurrent = ch.id === currentStep.chapterId;
    const isDone = stepIndex > lastIndex;
    return {
      ...ch,
      count: stepsInChapter.length,
      firstIndex,
      isCurrent,
      isDone,
    };
  });

  const overlay = (
    <div
      className="rabtv-wt-root"
      role="dialog"
      aria-modal="true"
      aria-label="RABBiT TV Interactive Walkthrough"
    >
      {/* Scoped glassmorphism + neon styles (adapts to app accent CSS vars) */}
      <style>{`
        .rabtv-wt-root {
          --wt-accent: var(--accent-color, var(--primary-color, #a855f7));
          --wt-accent-glow: rgba(168, 85, 247, 0.55);
          --wt-glass-bg: rgba(15, 17, 28, 0.88);
          --wt-glass-border: rgba(255, 255, 255, 0.16);
          --wt-text: #f8fafc;
          --wt-muted: #cbd5e1;
          position: fixed;
          inset: 0;
          z-index: 99999;
          pointer-events: none;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          color: var(--wt-text);
        }
        .rabtv-wt-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(5, 7, 15, 0.74);
          backdrop-filter: blur(3px);
          -webkit-backdrop-filter: blur(3px);
          pointer-events: auto;
          transition: opacity 0.25s ease;
        }
        .rabtv-wt-spotlight {
          position: fixed;
          border-radius: 14px;
          box-shadow:
            0 0 0 9999px rgba(5, 7, 15, 0.76),
            0 0 0 3px var(--wt-accent),
            0 0 28px 6px var(--wt-accent-glow);
          pointer-events: none;
          transition: top 0.28s cubic-bezier(0.22, 1, 0.36, 1),
                      left 0.28s cubic-bezier(0.22, 1, 0.36, 1),
                      width 0.28s cubic-bezier(0.22, 1, 0.36, 1),
                      height 0.28s cubic-bezier(0.22, 1, 0.36, 1);
          animation: rabtvWtPulse 2.1s infinite ease-in-out;
        }
        @keyframes rabtvWtPulse {
          0%, 100% {
            box-shadow:
              0 0 0 9999px rgba(5, 7, 15, 0.76),
              0 0 0 3px var(--wt-accent),
              0 0 22px 4px var(--wt-accent-glow);
          }
          50% {
            box-shadow:
              0 0 0 9999px rgba(5, 7, 15, 0.76),
              0 0 0 4px #ffffff,
              0 0 36px 10px var(--wt-accent-glow);
          }
        }
        .rabtv-wt-card {
          position: fixed;
          pointer-events: auto;
          background: var(--wt-glass-bg);
          border: 1px solid var(--wt-glass-border);
          border-radius: 20px;
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
          box-shadow:
            0 24px 60px rgba(0, 0, 0, 0.65),
            0 0 0 1px rgba(255, 255, 255, 0.06) inset,
            0 0 32px rgba(168, 85, 247, 0.22);
          padding: 20px 22px 18px;
          box-sizing: border-box;
          transition: top 0.28s cubic-bezier(0.22, 1, 0.36, 1),
                      left 0.28s cubic-bezier(0.22, 1, 0.36, 1);
          max-height: calc(100vh - 32px);
          overflow-y: auto;
        }
        .rabtv-wt-btn {
          appearance: none;
          border: 1px solid rgba(255, 255, 255, 0.16);
          background: rgba(255, 255, 255, 0.08);
          color: #ffffff;
          border-radius: 12px;
          padding: 9px 14px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          transition: transform 0.14s ease, background 0.15s ease, box-shadow 0.15s ease;
        }
        .rabtv-wt-btn:hover,
        .rabtv-wt-btn:focus-visible {
          background: rgba(255, 255, 255, 0.18);
          outline: 2px solid #ffffff;
          outline-offset: 2px;
          transform: translateY(-1px);
        }
        .rabtv-wt-btn-primary {
          background: linear-gradient(135deg, var(--wt-accent), #6366f1);
          border-color: rgba(255, 255, 255, 0.28);
          box-shadow: 0 6px 20px rgba(168, 85, 247, 0.42);
        }
        .rabtv-wt-btn-primary:hover,
        .rabtv-wt-btn-primary:focus-visible {
          background: linear-gradient(135deg, #c084fc, #818cf8);
          box-shadow: 0 8px 26px rgba(168, 85, 247, 0.65);
        }
        .rabtv-wt-btn:disabled {
          opacity: 0.38;
          cursor: not-allowed;
          transform: none;
        }
        .rabtv-wt-chapter-item {
          width: 100%;
          text-align: left;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #f8fafc;
          border-radius: 12px;
          padding: 9px 12px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          font-size: 13px;
          transition: background 0.15s ease, border-color 0.15s ease;
        }
        .rabtv-wt-chapter-item:hover,
        .rabtv-wt-chapter-item:focus-visible {
          background: rgba(168, 85, 247, 0.22);
          border-color: var(--wt-accent);
          outline: none;
        }
        .rabtv-wt-chapter-item.is-current {
          background: rgba(168, 85, 247, 0.28);
          border-color: var(--wt-accent);
          font-weight: 700;
        }
      `}</style>

      {/* Dimmer layer: cutout spotlight when live element found, full blur otherwise */}
      {!showWelcomeGate && targetRect ? (
        <div
          className="rabtv-wt-spotlight"
          style={{
            top: targetRect.top,
            left: targetRect.left,
            width: targetRect.width,
            height: targetRect.height,
          }}
        />
      ) : (
        <div className="rabtv-wt-backdrop" />
      )}

      {/* First-Launch Welcome Gate Modal */}
      {showWelcomeGate ? (
        <div
          ref={cardRef}
          className="rabtv-wt-card"
          style={{
            width: Math.min(500, vw - 32),
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: '#d8b4fe',
                background: 'rgba(168, 85, 247, 0.2)',
                border: '1px solid rgba(168, 85, 247, 0.45)',
                padding: '4px 10px',
                borderRadius: 999,
              }}
            >
              RABBiT TV Guided Tour
            </span>
            <button
              type="button"
              className="rabtv-wt-btn"
              style={{ padding: '6px 10px', fontSize: 12 }}
              onClick={() => finishWalkthrough(false)}
              aria-label="Skip walkthrough"
            >
              Skip
            </button>
          </div>

          <h2 style={{ margin: '0 0 10px', fontSize: 23, fontWeight: 800, lineHeight: 1.2 }}>
            Explore Every Feature of RABBiT TV
          </h2>

          <p style={{ margin: '0 0 14px', fontSize: 15, lineHeight: 1.55, color: 'var(--wt-muted)' }}>
            Take a complete, step-by-step interactive tour through all{' '}
            <strong style={{ color: '#fff' }}>{WALKTHROUGH_CHAPTERS.length} sections</strong> ({totalSteps}{' '}
            hands-on stops) — starting with the <strong style={{ color: '#fff' }}>Glass Sidebar</strong>,
            themes, Lobby Radio, Movies, TV Shows, 284+ Live TV channels, Settings, Backups, and even the
            official <strong style={{ color: '#fff' }}>TMDB link</strong> at the bottom of pages.
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 8,
              marginBottom: 18,
              fontSize: 13,
              color: '#e2e8f0',
            }}
          >
            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '8px 10px', borderRadius: 10 }}>
              • Glass Sidebar & Themes
            </div>
            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '8px 10px', borderRadius: 10 }}>
              • Lobby Radio & RAM Modes
            </div>
            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '8px 10px', borderRadius: 10 }}>
              • Flip-to-Trailer & Ad-Free Play
            </div>
            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '8px 10px', borderRadius: 10 }}>
              • 284+ Live TV, History & TMDB
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="rabtv-wt-btn"
              onClick={() => finishWalkthrough(false)}
            >
              Skip for Now
            </button>
            <button
              type="button"
              className="rabtv-wt-btn rabtv-wt-btn-primary"
              onClick={() => setShowWelcomeGate(false)}
              autoFocus
            >
              Start Full Walkthrough →
            </button>
          </div>
        </div>
      ) : (
        /* Main Floating Step Card */
        <div
          ref={cardRef}
          className="rabtv-wt-card"
          style={{
            width: cardWidth,
            top: pos.top,
            left: pos.left,
          }}
        >
          {/* Header: Chapter Pill + Step Counter + Close */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              marginBottom: 10,
            }}
          >
            <button
              type="button"
              className="rabtv-wt-btn"
              style={{
                padding: '5px 10px',
                fontSize: 12,
                borderRadius: 999,
                background: 'rgba(168, 85, 247, 0.22)',
                borderColor: 'rgba(168, 85, 247, 0.5)',
                color: '#e9d5ff',
              }}
              onClick={() => setShowChapterMenu((prev) => !prev)}
              aria-expanded={showChapterMenu}
              title="Open chapter jump menu"
            >
              <span>
                Ch {currentChapter.number}/{WALKTHROUGH_CHAPTERS.length}: {currentChapter.shortTitle}
              </span>
              <span aria-hidden="true">{showChapterMenu ? '▲' : '▼'}</span>
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--wt-muted)' }}>
                {stepIndex + 1} / {totalSteps}
              </span>
              <button
                type="button"
                className="rabtv-wt-btn"
                style={{ padding: '5px 9px', fontSize: 12 }}
                onClick={() => finishWalkthrough(false)}
                aria-label="Close walkthrough"
                title="Close walkthrough (Esc)"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div
            style={{
              height: 5,
              width: '100%',
              background: 'rgba(255, 255, 255, 0.1)',
              borderRadius: 999,
              overflow: 'hidden',
              marginBottom: 14,
            }}
            aria-label={`Walkthrough progress: ${progressPercent}%`}
          >
            <div
              style={{
                width: `${progressPercent}%`,
                height: '100%',
                background: 'linear-gradient(90deg, var(--wt-accent), #38bdf8)',
                borderRadius: 999,
                transition: 'width 0.25s ease',
              }}
            />
          </div>

          {/* Chapter Jump Drawer OR Active Step Content */}
          {showChapterMenu ? (
            <div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  marginBottom: 10,
                  color: '#e2e8f0',
                }}
              >
                Jump to Any Section ({WALKTHROUGH_CHAPTERS.length} Chapters)
              </div>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  maxHeight: 280,
                  overflowY: 'auto',
                  paddingRight: 4,
                  marginBottom: 14,
                }}
              >
                {chapterStepCounts.map((ch) => (
                  <button
                    key={ch.id}
                    type="button"
                    className={`rabtv-wt-chapter-item ${ch.isCurrent ? 'is-current' : ''}`}
                    onClick={() => jumpToChapter(ch.id)}
                  >
                    <span>
                      {ch.isDone ? '✓ ' : `${ch.number}. `}
                      {ch.title}
                    </span>
                    <span style={{ fontSize: 11, color: '#cbd5e1', whiteSpace: 'nowrap' }}>
                      {ch.count} {ch.count === 1 ? 'step' : 'steps'}
                    </span>
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="rabtv-wt-btn"
                  onClick={() => setShowChapterMenu(false)}
                >
                  Back to Current Step
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Live Element Spotlight Badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: 999,
                    background: targetFound
                      ? 'rgba(34, 197, 94, 0.2)'
                      : 'rgba(148, 163, 184, 0.16)',
                    border: targetFound
                      ? '1px solid rgba(34, 197, 94, 0.45)'
                      : '1px solid rgba(148, 163, 184, 0.3)',
                    color: targetFound ? '#86efac' : '#cbd5e1',
                  }}
                >
                  {targetFound ? '● Highlighted on Screen' : '○ Feature Overview'}
                </span>

                {currentStep.needsSidebar && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: '3px 8px',
                      borderRadius: 999,
                      background: 'rgba(56, 189, 248, 0.18)',
                      border: '1px solid rgba(56, 189, 248, 0.4)',
                      color: '#bae6fd',
                    }}
                  >
                    Sidebar Control
                  </span>
                )}
              </div>

              {/* Step Title */}
              <h3
                style={{
                  margin: '0 0 8px',
                  fontSize: 19,
                  fontWeight: 800,
                  lineHeight: 1.25,
                  color: '#ffffff',
                }}
              >
                {currentStep.title}
              </h3>

              {/* Step Description */}
              <p
                style={{
                  margin: '0 0 12px',
                  fontSize: 14.5,
                  lineHeight: 1.55,
                  color: 'var(--wt-muted)',
                }}
              >
                {currentStep.description}
              </p>

              {/* Action Hint Box */}
              <div
                style={{
                  background: 'rgba(168, 85, 247, 0.14)',
                  border: '1px solid rgba(168, 85, 247, 0.35)',
                  borderRadius: 12,
                  padding: '9px 12px',
                  fontSize: 13,
                  lineHeight: 1.45,
                  color: '#f3e8ff',
                  marginBottom: currentStep.proTip ? 10 : 16,
                }}
              >
                <strong>Try it: </strong>
                {currentStep.actionHint}
              </div>

              {/* Optional Pro Tip */}
              {currentStep.proTip && (
                <div
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 10,
                    padding: '8px 11px',
                    fontSize: 12.5,
                    lineHeight: 1.45,
                    color: '#cbd5e1',
                    marginBottom: 16,
                  }}
                >
                  <strong style={{ color: '#fde68a' }}>Tip: </strong>
                  {currentStep.proTip}
                </div>
              )}

              {/* Footer Controls */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  flexWrap: 'wrap',
                }}
              >
                <button
                  type="button"
                  className="rabtv-wt-btn"
                  style={{ padding: '8px 12px', fontSize: 13 }}
                  onClick={() => finishWalkthrough(false)}
                >
                  Skip Tour
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    type="button"
                    className="rabtv-wt-btn"
                    onClick={goPrev}
                    disabled={stepIndex === 0}
                  >
                    ← Back
                  </button>
                  <button
                    ref={nextBtnRef}
                    type="button"
                    className="rabtv-wt-btn rabtv-wt-btn-primary"
                    onClick={goNext}
                  >
                    {stepIndex === totalSteps - 1 ? 'Finish Tour ✓' : 'Next →'}
                  </button>
                </div>
              </div>

              {/* Remote / Keyboard Shortcut Hint */}
              <div
                style={{
                  marginTop: 10,
                  textAlign: 'center',
                  fontSize: 11,
                  color: 'rgba(203, 213, 225, 0.72)',
                }}
              >
                Remote / Keys: ← Back • → Next • Esc Exit
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );

  return createPortal(overlay, document.body);
};

export default InteractiveWalkthrough;
