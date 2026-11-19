// src/components/InteractiveWalkthrough.tsx
import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { createPortal } from "react-dom";

/* ============================================================================
 * RABBiT TV — Complete Interactive App Walkthrough (InteractiveWalkthrough.tsx)
 *
 * Wired directly to:
 *  - src/routes/__root.tsx (Header, Search, Profile Pill, Corner Clock, Footer & TMDB)
 *  - src/components/sidebar.tsx (Right-Docked Crystal Console + all 6 Accordions)
 *  - src/components/TermsOfServiceModal.tsx (ToS & Legal)
 *  - Movies, TV Shows, Details, Ad-Free Video Player, Trailers, Live TV, Search,
 *    My List / Favorites & Watch History Hub
 *
 * Zero extra npm dependencies — pure React + TypeScript + react-dom portal.
 * ========================================================================== */

export const WALKTHROUGH_COMPLETED_KEY = "rabtv_walkthrough_completed";
export const WALKTHROUGH_STEP_KEY = "rabtv_walkthrough_step";
export const WALKTHROUGH_OPEN_EVENT = "rabtv_start_walkthrough";
export const SIDEBAR_TOGGLE_EVENT = "rabtv_sidebar_toggle";
export const SIDEBAR_SECTION_EVENT = "rabtv_sidebar_section";

export type SidebarAccordionSection =
  | "feedAndHistory"
  | "themesAndScale"
  | "audio"
  | "profileAndAccessibility"
  | "hardwareAndStream"
  | "screensaverAndBackup"
  | null;

export type WalkthroughChapterId =
  | "entry"
  | "header"
  | "sidebar"
  | "home"
  | "catalog"
  | "details"
  | "player"
  | "trailers"
  | "livetv"
  | "search"
  | "favorites"
  | "history"
  | "footer";

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
  /** Optional route path passed to onNavigate */
  routeHint?: string;
  /** Opens or closes the Crystal Console Sidebar automatically */
  needsSidebar?: boolean;
  /** Opens a specific accordion inside sidebar.tsx automatically */
  sidebarSection?: SidebarAccordionSection;
  /** Scrolls the sidebar inner list to a data-tour target when open */
  sidebarScrollTarget?: string;
  /** Automatically advances if user clicks the spotlighted target */
  advanceOnTargetClick?: boolean;
  /** Scrolls page to the bottom (used for Footer & TMDB link steps) */
  scrollToBottom?: boolean;
  /** Optional quick tip */
  proTip?: string;
}

export interface InteractiveWalkthroughProps {
  /** Controlled open state (optional) */
  isOpen?: boolean;
  /** Auto-launch on first visit once Activation & ToS are complete */
  autoStartOnFirstLaunch?: boolean;
  /** Force visible regardless of localStorage */
  forceShow?: boolean;
  /** Called when closed or skipped */
  onClose?: () => void;
  /** Called when completed */
  onComplete?: () => void;
  /** Router navigation callback from __root.tsx */
  onNavigate?: (path: string) => void;
  /** Sidebar open/close callback from __root.tsx */
  onToggleSidebar?: (open: boolean) => void;
  /** Starting step index */
  initialStepIndex?: number;
}

export const WALKTHROUGH_CHAPTERS: WalkthroughChapter[] = [
  { id: "entry", number: 1, title: "Welcome, Access & ToS", shortTitle: "Welcome" },
  { id: "header", number: 2, title: "Top Bar & Quick Search", shortTitle: "Top Bar" },
  { id: "sidebar", number: 3, title: "Crystal Console Sidebar (All Controls)", shortTitle: "Sidebar" },
  { id: "home", number: 4, title: "Home Feed & Media Cards", shortTitle: "Home Feed" },
  { id: "catalog", number: 5, title: "Movies & TV Catalogs", shortTitle: "Catalogs" },
  { id: "details", number: 6, title: "Movie & Show Details Pages", shortTitle: "Details" },
  { id: "player", number: 7, title: "Ad-Free Player & Controls", shortTitle: "Player" },
  { id: "trailers", number: 8, title: "Trailers & Flip-to-Preview", shortTitle: "Trailers" },
  { id: "livetv", number: 9, title: "Live TV (284+ Channels)", shortTitle: "Live TV" },
  { id: "search", number: 10, title: "Global Search Page", shortTitle: "Search" },
  { id: "favorites", number: 11, title: "My List & Favorites", shortTitle: "Favorites" },
  { id: "history", number: 12, title: "Watch History Activity Hub", shortTitle: "History" },
  { id: "footer", number: 13, title: "Footer, Legal & TMDB Link", shortTitle: "Footer & TMDB" },
];

export const WALKTHROUGH_STEPS: WalkthroughStep[] = [
  /* ========================================================================
   * CHAPTER 1: WELCOME, ACCESS GATE, TERMS OF SERVICE & CONTROLS
   * ====================================================================== */
  {
    id: "entry-welcome",
    chapterId: "entry",
    title: "Welcome to RABBiT TV",
    description:
      "This interactive guide walks you through every button, menu, toggle, and link in RABBiT TV — starting with the Top Bar and the full Crystal Console Sidebar, all the way down to the official TMDB link at the bottom of pages.",
    actionHint: "Click Next (or press Right Arrow) to begin, or open Chapters to jump to any section.",
    targetSelectors: ['[data-tour="app-main"]', "main"],
    needsSidebar: false,
    proTip: "You can skip or replay this walkthrough anytime from the Sidebar or page footer.",
  },
  {
    id: "entry-access-tos",
    chapterId: "entry",
    title: "Passcode Gate, 7-Day Trial & Terms of Service",
    description:
      "RABBiT TV protects access with an 8-digit unlock passcode or 7-day trial code plus your Terms of Service agreement. You can view your License Status, upgrade a trial, or re-read the Terms of Service anytime inside the Sidebar.",
    actionHint: "Press Next to see how remote, mouse, and touch controls work.",
    targetSelectors: ['[data-tour="app-main"]', "main"],
    needsSidebar: false,
  },
  {
    id: "entry-controls",
    chapterId: "entry",
    title: "Built for TV Remotes, Mice & Touchscreens",
    description:
      "Navigate effortlessly with Arrow keys / TV remote D-Pad, Enter/OK to select, and Escape/Back to close menus. If you use a USB mouse on a TV or projector, you can turn on the 3x XL Colored Mouse Pointer right inside the Sidebar.",
    actionHint: "Try pressing the Left/Right Arrow keys or clicking Next.",
    targetSelectors: ['[data-tour="app-main"]', "main"],
    needsSidebar: false,
  },

  /* ========================================================================
   * CHAPTER 2: TOP BAR & QUICK SEARCH
   * ====================================================================== */
  {
    id: "header-home-logo",
    chapterId: "header",
    title: "Neon Rabbit Logo (Instant Home Button)",
    description:
      "Clicking the RABBiT TV logo in the top-left corner brings you straight back to the main Global Feed from any movie, show, Live TV channel, or search screen.",
    actionHint: "Click the top-left Rabbit logo anytime to jump back home.",
    targetSelectors: ['[data-tour="home-logo"]', 'header a[href="/"]'],
    routeHint: "/",
    needsSidebar: false,
  },
  {
    id: "header-search-bar",
    chapterId: "header",
    title: "Top Bar Instant Search",
    description:
      "Type any movie title, TV show, or actor right into the glass search bar at the top of the screen and press Enter to jump straight to full search results.",
    actionHint: "Click the top search box, type a title, and press Enter.",
    targetSelectors: [
      '[data-tour="header-search"]',
      '[data-tour="global-search-input"]',
      'header input[type="text"]',
    ],
    needsSidebar: false,
  },
  {
    id: "header-profile-sidebar-toggle",
    chapterId: "header",
    title: "Profile Pill — Opens the Crystal Sidebar",
    description:
      "Your Profile Pill in the top-right shows your mascot, profile name, trial/admin badge, and Kids Safe Mode indicator when locked. Clicking it slides open the Crystal Console Sidebar!",
    actionHint: "Click your Profile Pill (☰) in the top-right, or click Next to open it automatically.",
    targetSelectors: ['[data-tour="sidebar-toggle"]', "header button"],
    needsSidebar: false,
    advanceOnTargetClick: true,
  },

  /* ========================================================================
   * CHAPTER 3: THE CRYSTAL CONSOLE SIDEBAR (EVERY ACCORDION & CONTROL)
   * ====================================================================== */
  {
    id: "sidebar-overview",
    chapterId: "sidebar",
    title: "Inside the Crystal Console Sidebar",
    description:
      "Welcome to the command center of RABBiT TV! At the top you see your Mascot, Online status, active RAM Mode badge, Easy Mode tag, and Close button. Use the ▲ and ▼ arrows (or scroll/D-Pad) to move smoothly through every panel.",
    actionHint: "Look over the Sidebar header bar and ▲ / ▼ scroll buttons.",
    targetSelectors: ['[data-tour="sidebar-profile-header"]', '[data-tour="sidebar"]'],
    needsSidebar: true,
    sidebarSection: null,
    sidebarScrollTarget: "sidebar-profile-header",
  },
  {
    id: "sidebar-feed-startup",
    chapterId: "sidebar",
    title: "Sidebar 1/6: Feed & Startup",
    description:
      "Switch your Region/Language Catalog Feed (All, Canada, English, German, Ukrainian, Arabic/Islamic, Russian, British, or Hungarian), pick your Favorite Startup Screen, check your Pinned Live Channels count, and jump straight to Live TV or Watch History.",
    actionHint: "Pick a regional feed, set your startup screen, or tap Live TV / History here.",
    targetSelectors: ['[data-tour="sidebar-feed-history"]', '[data-tour="sidebar"]'],
    needsSidebar: true,
    sidebarSection: "feedAndHistory",
    sidebarScrollTarget: "sidebar-feed-history",
  },
  {
    id: "sidebar-themes-posters",
    chapterId: "sidebar",
    title: "Sidebar 2/6: Themes & Posters",
    description:
      "Customize every visual detail: choose from 6 Neon Themes (Violet, Red, Midnight, Emerald, Amber, Cyan), change Poster Corner Shapes, Frame Styles, Info Layouts, Rating Badges, Catalog Grid Size, History Overscale, 3D Seasonal Holiday Overlays, and Neon Glow Intensity — or reset visual defaults with one tap.",
    actionHint: "Tap any Neon Theme or Poster Style inside this panel to watch the app restyle live.",
    targetSelectors: ['[data-tour="sidebar-themes-posters"]', '[data-tour="sidebar"]'],
    needsSidebar: true,
    sidebarSection: "themesAndScale",
    sidebarScrollTarget: "sidebar-themes-posters",
  },
  {
    id: "sidebar-lobby-radio",
    chapterId: "sidebar",
    title: "Sidebar 3/6: Background Lobby Radio",
    description:
      "Enjoy built-in music while browsing! Heart Dance (2000s) is set as your default station at 25% volume. Toggle Radio ON/Off, drag the Music Volume slider, or open any Genre Folder to switch live radio stations.",
    actionHint: "Toggle Radio ON/Off, adjust the volume slider, or expand a music genre folder.",
    targetSelectors: ['[data-tour="sidebar-radio"]', '[data-tour="sidebar"]'],
    needsSidebar: true,
    sidebarSection: "audio",
    sidebarScrollTarget: "sidebar-radio",
    proTip: "Lobby Radio automatically pauses when you open a movie, details player, or Live TV.",
  },
  {
    id: "sidebar-senior-personalization",
    chapterId: "sidebar",
    title: "Sidebar 4/6: Senior Easy Mode & Fun Personalizations",
    description:
      "Turn on One-Tap Senior Easy Mode for big text, enlarged buttons, bright yellow focus, and an XL pointer all at once. Customize your Profile Mascot, Home Greeting Style, Night Owl Eye-Care tint, and the live Couch Corner Clock (12h/24h).",
    actionHint: "Try tapping a Profile Mascot or toggling Night Owl Eye-Care / Corner Clock.",
    targetSelectors: ['[data-tour="sidebar-profile-accessibility"]', '[data-tour="sidebar"]'],
    needsSidebar: true,
    sidebarSection: "profileAndAccessibility",
    sidebarScrollTarget: "sidebar-profile-accessibility",
  },
  {
    id: "sidebar-tv-accessibility-pin",
    chapterId: "sidebar",
    title: "Sidebar 4/6 (Cont.): TV Safe-Zone, Subtitles, Kids Lock & PIN",
    description:
      "Inside this same panel you can also set Text Size, 3x XL Mouse Pointer + cursor colors, Enlarged Action Buttons, Bright TV Focus Spotlight, Steady Screen (No Motion), Soft Remote Click Sounds, TV/Projector Overscan Safe-Zone %, Caption/Subtitle styling, Kids Safe Mode PIN Lock, and your Name, Age & 4–6 Digit Hashed Parental PIN.",
    actionHint: "Scroll inside Profile & Senior/TV whenever you need Kids Lock, PIN updates, or TV Overscan.",
    targetSelectors: ['[data-tour="sidebar-profile-accessibility"]', '[data-tour="sidebar"]'],
    needsSidebar: true,
    sidebarSection: "profileAndAccessibility",
    sidebarScrollTarget: "sidebar-profile-accessibility",
    proTip: "If TV edges cut off menus on an older TV or projector, bump Screen Safe-Zone up a notch.",
  },
  {
    id: "sidebar-ram-stream-engine",
    chapterId: "sidebar",
    title: "Sidebar 5/6: RAM & Stream Engine + Storage Health",
    description:
      "Match RABBiT TV to your device: choose Auto, 1–2GB (ideal for Fire TV Sticks & Nero 8K boxes to prevent crashes), or 4GB+ RAM Mode. Toggle Data Saver / Lite Posters, Preferred Stream Quality (Auto/1080p/720p/480p), Default Live Player Volume, Auto-Play Next Episode, check your Storage Health Meter, or Purge Caches.",
    actionHint: "Pick 1–2GB Mode on streaming sticks, or click Purge Caches if storage gets full.",
    targetSelectors: ['[data-tour="sidebar-hardware-stream"]', '[data-tour="sidebar"]'],
    needsSidebar: true,
    sidebarSection: "hardwareAndStream",
    sidebarScrollTarget: "sidebar-hardware-stream",
  },
  {
    id: "sidebar-sleep-screensaver-backup",
    chapterId: "sidebar",
    title: "Sidebar 6/6: Sleep Timer, Screensaver & JSON Backups",
    description:
      "Set a Couch Sleep Timer to auto-pause video at bedtime, choose how long before the Screensaver starts, and use Export JSON / Restore to back up or transfer all your themes, poster styles, profile, and watchlists between devices.",
    actionHint: "Set a Sleep Timer or save a rabtv_profile_backup.json copy of your setup.",
    targetSelectors: ['[data-tour="sidebar-sleep-backup"]', '[data-tour="sidebar"]'],
    needsSidebar: true,
    sidebarSection: "screensaverAndBackup",
    sidebarScrollTarget: "sidebar-sleep-backup",
  },
  {
    id: "sidebar-referrals",
    chapterId: "sidebar",
    title: "Sidebar Tool: Refer Friends & Earn Cash",
    description:
      "Click the golden Refer Friends & Earn Cash banner to open your personal referral dashboard, grab your invite info, and track confirmed referrals and cash payouts.",
    actionHint: "Click Refer Friends & Earn Cash anytime to open your referral tracker.",
    targetSelectors: ['[data-tour="sidebar-referrals"]', '[data-tour="sidebar"]'],
    needsSidebar: true,
    sidebarSection: null,
    sidebarScrollTarget: "sidebar-referrals",
  },
  {
    id: "sidebar-support-tour-tos",
    chapterId: "sidebar",
    title: "Sidebar Tools: Bug Reports, Replay Tour & Terms of Service",
    description:
      "In Feedback & Support you can report a bug or broken link, view the live Community Bug Reports Feed, replay this Interactive Walkthrough anytime, or open the Terms of Service & Disclaimer.",
    actionHint: "Use these buttons to report issues, replay the tour, or review the Terms of Service.",
    targetSelectors: ['[data-tour="sidebar-support"]', '[data-tour="sidebar-tos"]', '[data-tour="sidebar"]'],
    needsSidebar: true,
    sidebarSection: null,
    sidebarScrollTarget: "sidebar-support",
  },
  {
    id: "sidebar-updates-license",
    chapterId: "sidebar",
    title: "Sidebar Bottom: Update Channel & License Status",
    description:
      "Switch between Stable and Nightly update channels, tap Check for Updates Now to grab the newest build, and view your License Status (Admin, Lifetime Unlocked, or Trial days remaining with an instant Upgrade box).",
    actionHint: "Tap Check for Updates Now anytime to stay current on the latest RABBiT TV release.",
    targetSelectors: ['[data-tour="sidebar-updates"]', '[data-tour="sidebar-license"]', '[data-tour="sidebar"]'],
    needsSidebar: true,
    sidebarSection: null,
    sidebarScrollTarget: "sidebar-license",
  },

  /* ========================================================================
   * CHAPTER 4: HOME SCREEN (GLOBAL FEED) & MEDIA CARDS
   * ====================================================================== */
  {
    id: "home-feed-overview",
    chapterId: "home",
    title: "Home Screen (Global Feed) & Personalized Rows",
    description:
      "Back on the main screen, you get your custom greeting, featured Hero Spotlight banner, and horizontally scrollable rows including Trending, Popular, Top Rated, Regional picks, and private on-device algorithm suggestions.",
    actionHint: "Scroll through the main rows or click Play / Details on the featured spotlight.",
    targetSelectors: [
      '[data-tour="hero-banner"]',
      '[data-tour="media-row"]',
      '[data-tour="app-main"]',
    ],
    routeHint: "/",
    needsSidebar: false,
  },
  {
    id: "home-media-cards",
    chapterId: "home",
    title: "Interactable Media Cards, Flip-to-Trailer & Quick Actions",
    description:
      "Hover or focus any poster card to see its neon focus glow. Click a card to open its full Details Page, flip the cover art to watch its TMDB trailer right in place, tap the Heart to save to My List, or dislike titles to refine your feed.",
    actionHint: "Click any poster card for details, or use its Flip/Trailer and Favorite icons.",
    targetSelectors: ['[data-tour="media-card"]', "article", '[data-tour="app-main"]'],
    needsSidebar: false,
  },

  /* ========================================================================
   * CHAPTER 5: MOVIES & TV SHOWS CATALOGS
   * ====================================================================== */
  {
    id: "catalog-tabs-filters",
    chapterId: "catalog",
    title: "Movies & TV Shows Tabs + Smart Filters",
    description:
      "Switch between Movies, TV Shows, and My List tabs on the catalog screen. Filter thousands of TMDB titles by Genre, Streaming Provider / Network, Region/Language feed, and automatic Age Rating protection.",
    actionHint: "Click the Movies or TV Shows tab and try a Genre or Provider filter.",
    targetSelectors: [
      '[data-tour="catalog-filters"]',
      '[data-tour="genre-filter"]',
      '[data-tour="app-main"]',
    ],
    needsSidebar: false,
  },
  {
    id: "catalog-sizing-pagination",
    chapterId: "catalog",
    title: "Custom Poster Grids & Deep Browsing",
    description:
      "Every poster obeys the Corner Shape, Frame Style, Info Layout, Rating Badges, and Small/Medium/Large Card Size you picked in the Sidebar. Click Load More or Next Page at the end of a grid to explore deeper results.",
    actionHint: "Scroll down any catalog and click Load More to browse even more titles.",
    targetSelectors: ['[data-tour="load-more"]', '[data-tour="catalog-grid"]', '[data-tour="app-main"]'],
    needsSidebar: false,
  },

  /* ========================================================================
   * CHAPTER 6: MOVIE & TV SHOW DETAILS PAGES
   * ====================================================================== */
  {
    id: "details-metadata-finish",
    chapterId: "details",
    title: "Details Page: Synopsis, Ratings & Live Finish Time",
    description:
      "Opening any movie or TV series shows full cover art, synopsis, release year, user rating, runtime, and a live Estimated Finish Time telling you what clock time the movie or episode will end if started right now.",
    actionHint: "Click any movie or show poster to view its full Details page and Finish Time.",
    targetSelectors: ['[data-tour="details-metadata"]', '[data-tour="finish-time"]', '[data-tour="app-main"]'],
    needsSidebar: false,
  },
  {
    id: "details-play-seasons",
    chapterId: "details",
    title: "Play / Resume, Watch Trailer & Season/Episode Picker",
    description:
      "Press Play to launch full-screen streaming (or resume right where you left off), tap Watch Trailer for the official TMDB preview, or toggle Favorite. For TV Shows, pick any Season and click an Episode card to jump straight in.",
    actionHint: "Use Play, Watch Trailer, Favorite, or the Season/Episode selector on any Details page.",
    targetSelectors: [
      '[data-tour="details-play"]',
      '[data-tour="season-selector"]',
      '[data-tour="app-main"]',
    ],
    needsSidebar: false,
  },
  {
    id: "details-imdb-report-back",
    chapterId: "details",
    title: "Official IMDb Link, Report Broken & Back to Home",
    description:
      "Click the official IMDb link to read cast lists, trivia, and reviews externally. If a stream link fails, tap the custom Report Broken button to flag it, or tap Back to Home to jump right back to browsing.",
    actionHint: "Look for the IMDb link, Report Broken, and Back to Home buttons on every Details page.",
    targetSelectors: [
      '[data-tour="imdb-link"]',
      'a[href*="imdb.com" i]',
      '[data-tour="report-broken"]',
      '[data-tour="app-main"]',
    ],
    needsSidebar: false,
  },

  /* ========================================================================
   * CHAPTER 7: VIDEO PLAYER & PLAYBACK CONTROLS
   * ====================================================================== */
  {
    id: "player-adfree-controls",
    chapterId: "player",
    title: "uBlock Ad-Free Player & Playback Controls",
    description:
      "Built-in uBlock-style ad blocking runs automatically to block popups and redirects, and Background Lobby Radio pauses automatically while you watch. Use Play/Pause, Seek Bar, Volume/Mute, Stream Quality, Fullscreen, and Exit controls right on screen.",
    actionHint: "Tap the video screen or move your mouse/remote to reveal the player controls.",
    targetSelectors: ['[data-tour="video-player"]', "video", "iframe", '[data-tour="app-main"]'],
    needsSidebar: false,
  },
  {
    id: "player-episodes-report",
    chapterId: "player",
    title: "In-Player Episode Switcher, Autoplay & Report Broken",
    description:
      "During TV series playback, jump directly to Next Episode, Previous Episode, or another Season without leaving the player. With Auto-Play Next enabled, the next episode queues automatically. Hit In-Player Report Broken if a stream stalls.",
    actionHint: "Use the in-player episode switcher when binge-watching a TV series.",
    targetSelectors: ['[data-tour="player-controls"]', '[data-tour="app-main"]'],
    needsSidebar: false,
  },

  /* ========================================================================
   * CHAPTER 8: TRAILERS & FLIP-TO-PREVIEW
   * ====================================================================== */
  {
    id: "trailers-preview",
    chapterId: "trailers",
    title: "Trailers Hub & Instant Cover-Flip Previews",
    description:
      "Browse upcoming and trending trailers powered by TMDB. Flip poster cover art to preview trailers inline, then jump straight into the full Details Page or bookmark the title to Favorites in one click.",
    actionHint: "Flip any trailer card to watch a preview before committing to a full movie.",
    targetSelectors: ['[data-tour="trailers-grid"]', '[data-tour="card-flip"]', '[data-tour="app-main"]'],
    needsSidebar: false,
  },

  /* ========================================================================
   * CHAPTER 9: LIVE TV (284+ CHANNELS)
   * ====================================================================== */
  {
    id: "livetv-hub",
    chapterId: "livetv",
    title: "Live TV: 284+ Channels, Smart Categories & Search",
    description:
      "Stream over 284 live TV channels organized automatically by genre (Sports, News, Movies, Entertainment, Kids, Music, and more). Use the Live TV search bar to jump to any broadcast instantly.",
    actionHint: "Pick a category tab or type a channel name on the Live TV screen.",
    targetSelectors: [
      '[data-tour="livetv-categories"]',
      '[data-tour="livetv-search"]',
      '[data-tour="app-main"]',
    ],
    routeHint: "/live-tv",
    needsSidebar: false,
  },
  {
    id: "livetv-pin-history",
    chapterId: "livetv",
    title: "Pin Favorite Channels & Automatic Live History",
    description:
      "Tap the Pin / Star icon on any channel you watch often to lock it to the top of your Live TV list. Every live broadcast you open is also automatically logged into Watch History so you can jump back fast.",
    actionHint: "Pin your favorite channels so they always sit right at the top.",
    targetSelectors: ['[data-tour="channel-pin"]', '[data-tour="channel-card"]', '[data-tour="app-main"]'],
    needsSidebar: false,
  },

  /* ========================================================================
   * CHAPTER 10: GLOBAL SEARCH PAGE
   * ====================================================================== */
  {
    id: "search-page-overview",
    chapterId: "search",
    title: "Global Search Across Movies, Shows & Channels",
    description:
      "The dedicated Search page lets you find any movie, TV series, actor, or live channel in seconds. Narrow hits with category tabs, genre/language filters, and clear your query with one tap.",
    actionHint: "Type any keyword into the Search bar and click any result card to watch.",
    targetSelectors: [
      '[data-tour="global-search-input"]',
      'input[type="search"]',
      '[data-tour="app-main"]',
    ],
    routeHint: "/search",
    needsSidebar: false,
  },

  /* ========================================================================
   * CHAPTER 11: MY LIST & FAVORITES
   * ====================================================================== */
  {
    id: "favorites-watchlist",
    chapterId: "favorites",
    title: "My List & Saved Favorites",
    description:
      "Every movie, TV series, and pinned channel you bookmark lives together in My List / Favorites for one-click launching. Tap Remove / Un-heart anytime to keep your shelf tidy.",
    actionHint: "Bookmark movies you want to watch later so they are always waiting in My List.",
    targetSelectors: ['[data-tour="favorites-grid"]', '[data-tour="app-main"]'],
    routeHint: "/",
    needsSidebar: false,
  },

  /* ========================================================================
   * CHAPTER 12: WATCH HISTORY ACTIVITY HUB
   * ====================================================================== */
  {
    id: "history-hub-overview",
    chapterId: "history",
    title: "Watch History: Search, Filter, Sort & Resume",
    description:
      "Your Watch History Hub tracks everything watched across Movies, TV Shows, and Live TV. Search past items by title, filter by type, sort by date or name, and click any entry to jump straight back in.",
    actionHint: "Use the Watch History toolbar to search, sort, or resume past titles.",
    targetSelectors: ['[data-tour="history-page"]', '[data-tour="history-list"]', '[data-tour="app-main"]'],
    routeHint: "/watch-history",
    needsSidebar: false,
  },
  {
    id: "history-bulk-export",
    chapterId: "history",
    title: "Watch History: Single/Bulk Delete & Export Snapshot",
    description:
      "Remove individual entries, clear multiple items in bulk, or click Export Snapshot to save a clean record of your viewing activity. You can also adjust Watch History Overscale inside the Sidebar for bigger cards.",
    actionHint: "Use Bulk Delete for quick cleanup or Export Snapshot to save your viewing log.",
    targetSelectors: ['[data-tour="history-export"]', '[data-tour="app-main"]'],
    needsSidebar: false,
  },

  /* ========================================================================
   * CHAPTER 13: PAGE FOOTER, TERMS OF SERVICE, VERSION & TMDB LINK
   * ====================================================================== */
  {
    id: "footer-bar",
    chapterId: "footer",
    title: "Page Footer Bar, Quick Tour & Terms of Service",
    description:
      "Scroll to the bottom of any page to reach the Footer Bar. Right here you have one-click links to re-open the Terms of Service & Disclaimer, replay this Interactive Walkthrough, jump back to the top, and view official attribution.",
    actionHint: "Look at the bottom Footer Bar highlighted on your screen.",
    targetSelectors: ['[data-tour="app-footer"]', "footer"],
    routeHint: "/",
    needsSidebar: false,
    scrollToBottom: true,
  },
  {
    id: "footer-tmdb-link",
    chapterId: "footer",
    title: "Clicking the Official TMDB Logo & Link",
    description:
      "RABBiT TV pulls movie posters, episode summaries, cast info, and trailer listings from The Movie Database (TMDB). Clicking the TMDB link at the bottom of the page opens themoviedb.org directly in your browser so you can explore the public database.",
    actionHint: "Click the TMDB link in the footer anytime to visit themoviedb.org.",
    targetSelectors: [
      '[data-tour="tmdb-link"]',
      'footer a[href*="themoviedb.org" i]',
      'a[href*="themoviedb.org" i]',
    ],
    needsSidebar: false,
    scrollToBottom: true,
    proTip: "This footer also displays the official TMDB API notice confirming RABBiT TV is not endorsed or certified by TMDB.",
  },
  {
    id: "footer-version-finish",
    chapterId: "footer",
    title: "App Version Badge — You Know Every Feature!",
    description:
      "Beside the TMDB and Terms of Service links sits your RABBiT TV Version Badge — handy when checking for updates or sending a bug report. You have walked through every interactable feature in RABBiT TV. Enjoy ad-free streaming!",
    actionHint: "Click Finish Tour to start watching, or open Chapters to revisit any section.",
    targetSelectors: ['[data-tour="app-version"]', '[data-tour="app-footer"]', "footer"],
    needsSidebar: false,
    scrollToBottom: true,
  },
];

/* ============================================================================
 * Public Helper Utilities
 * ========================================================================== */

export function triggerRabbitWalkthrough(stepIndex = 0): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(WALKTHROUGH_STEP_KEY, String(stepIndex));
  } catch {
    // ignore storage errors
  }
  window.dispatchEvent(
    new CustomEvent(WALKTHROUGH_OPEN_EVENT, { detail: { stepIndex } })
  );
}

export function resetRabbitWalkthrough(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(WALKTHROUGH_COMPLETED_KEY);
    localStorage.removeItem(WALKTHROUGH_STEP_KEY);
  } catch {
    // ignore storage errors
  }
}

/* ============================================================================
 * Internal DOM Helpers
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
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          parseFloat(style.opacity || "1") > 0.05;
        if (isVisible) {
          return el;
        }
      }
    } catch {
      // ignore invalid selectors
    }
  }
  return null;
}

function getClampedCardPosition(
  rect: SpotlightRect | null,
  cardWidth: number,
  cardHeight: number,
  needsSidebar?: boolean
): { top: number; left: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const margin = 16;

  if (!rect) {
    return {
      top: Math.max(margin, Math.round((vh - cardHeight) / 2)),
      left: Math.max(margin, Math.round((vw - cardWidth) / 2)),
    };
  }

  // Right-docked Crystal Sidebar: place card cleanly to the LEFT of the sidebar!
  if (needsSidebar || rect.left > vw * 0.42) {
    if (rect.left - cardWidth - margin * 2 >= 0) {
      const idealTop = rect.top + rect.height / 2 - cardHeight / 2;
      return {
        top: Math.min(
          Math.max(margin + 56, idealTop),
          Math.max(margin, vh - cardHeight - margin)
        ),
        left: Math.round(rect.left - cardWidth - margin),
      };
    }
  }

  // If element covers almost the entire screen, center cleanly
  if (rect.width > vw * 0.78 && rect.height > vh * 0.72) {
    return {
      top: Math.max(margin, Math.round((vh - cardHeight) / 2)),
      left: Math.max(margin, Math.round((vw - cardWidth) / 2)),
    };
  }

  // Try below the spotlight
  if (rect.top + rect.height + cardHeight + margin * 2 < vh) {
    const idealLeft = rect.left + rect.width / 2 - cardWidth / 2;
    return {
      top: Math.round(rect.top + rect.height + margin),
      left: Math.min(
        Math.max(margin, idealLeft),
        Math.max(margin, vw - cardWidth - margin)
      ),
    };
  }

  // Try above the spotlight (great for Footer & TMDB steps)
  if (rect.top - cardHeight - margin * 2 > 0) {
    const idealLeft = rect.left + rect.width / 2 - cardWidth / 2;
    return {
      top: Math.round(rect.top - cardHeight - margin),
      left: Math.min(
        Math.max(margin, idealLeft),
        Math.max(margin, vw - cardWidth - margin)
      ),
    };
  }

  // Try right of spotlight
  if (rect.left + rect.width + cardWidth + margin * 2 < vw) {
    const idealTop = rect.top + rect.height / 2 - cardHeight / 2;
    return {
      top: Math.min(
        Math.max(margin, idealTop),
        Math.max(margin, vh - cardHeight - margin)
      ),
      left: Math.round(rect.left + rect.width + margin),
    };
  }

  // Fallback: bottom-left / bottom-center
  return {
    top: Math.max(margin, vh - cardHeight - margin),
    left: Math.max(margin, Math.round((vw - cardWidth) / 2)),
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
      return localStorage.getItem(WALKTHROUGH_COMPLETED_KEY) !== "true";
    } catch {
      return false;
    }
  });

  const isVisible =
    forceShow || (controlledOpen !== undefined ? controlledOpen : internalOpen);

  const [stepIndex, setStepIndex] = useState<number>(() => {
    if (typeof initialStepIndex === "number") {
      return Math.max(0, Math.min(WALKTHROUGH_STEPS.length - 1, initialStepIndex));
    }
    try {
      const saved = parseInt(localStorage.getItem(WALKTHROUGH_STEP_KEY) || "0", 10);
      if (!Number.isNaN(saved) && saved >= 0 && saved < WALKTHROUGH_STEPS.length) {
        return saved;
      }
    } catch {
      // ignore
    }
    return 0;
  });

  const [showChapterMenu, setShowChapterMenu] = useState<boolean>(false);
  const [showWelcomeGate, setShowWelcomeGate] = useState<boolean>(() => {
    try {
      const saved = parseInt(localStorage.getItem(WALKTHROUGH_STEP_KEY) || "0", 10);
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
  const autoLaunchTriggeredRef = useRef<boolean>(false);

  const currentStep = WALKTHROUGH_STEPS[stepIndex] || WALKTHROUGH_STEPS[0];
  const currentChapter = useMemo(
    () =>
      WALKTHROUGH_CHAPTERS.find((c) => c.id === currentStep.chapterId) ||
      WALKTHROUGH_CHAPTERS[0],
    [currentStep.chapterId]
  );

  const totalSteps = WALKTHROUGH_STEPS.length;
  const progressPercent = Math.round(((stepIndex + 1) / totalSteps) * 100);

  // Sync controlled open prop
  useEffect(() => {
    if (controlledOpen !== undefined) {
      setInternalOpen(controlledOpen);
    }
  }, [controlledOpen]);

  // Auto-launch once Activation + Terms of Service complete on first run
  useEffect(() => {
    if (
      !autoStartOnFirstLaunch ||
      controlledOpen !== undefined ||
      autoLaunchTriggeredRef.current
    ) {
      return;
    }
    try {
      if (localStorage.getItem(WALKTHROUGH_COMPLETED_KEY) !== "true") {
        autoLaunchTriggeredRef.current = true;
        setShowWelcomeGate(true);
        setStepIndex(0);
        setInternalOpen(true);
      }
    } catch {
      // ignore
    }
  }, [autoStartOnFirstLaunch, controlledOpen]);

  // Mark body flag so sidebar.tsx pauses its auto-close-on-scroll during the tour
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (isVisible) {
      document.body.dataset.walkthroughActive = "true";
    } else {
      delete document.body.dataset.walkthroughActive;
    }
    return () => {
      delete document.body.dataset.walkthroughActive;
    };
  }, [isVisible]);

  // Listen for global relaunch event (Sidebar / Footer -> Replay Tour)
  useEffect(() => {
    const handleOpenEvent = (event: Event) => {
      const custom = event as CustomEvent<{ stepIndex?: number }>;
      const nextIdx =
        typeof custom.detail?.stepIndex === "number"
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

  // Save current step
  useEffect(() => {
    if (!isVisible) return;
    try {
      localStorage.setItem(WALKTHROUGH_STEP_KEY, String(stepIndex));
    } catch {
      // ignore
    }
  }, [isVisible, stepIndex]);

  const finishWalkthrough = useCallback(
    (completed: boolean) => {
      try {
        localStorage.setItem(WALKTHROUGH_COMPLETED_KEY, "true");
        if (completed) {
          localStorage.removeItem(WALKTHROUGH_STEP_KEY);
        }
      } catch {
        // ignore
      }
      onToggleSidebar?.(false);
      window.dispatchEvent(
        new CustomEvent(SIDEBAR_TOGGLE_EVENT, { detail: { open: false } })
      );
      setInternalOpen(false);
      setShowChapterMenu(false);
      if (completed) {
        onComplete?.();
      } else {
        onClose?.();
      }
    },
    [onClose, onComplete, onToggleSidebar]
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

  // Coordinate sidebar visibility, active accordion section, scroll & route hints
  useEffect(() => {
    if (!isVisible || showWelcomeGate) return;

    if (typeof currentStep.needsSidebar === "boolean") {
      onToggleSidebar?.(currentStep.needsSidebar);
      window.dispatchEvent(
        new CustomEvent(SIDEBAR_TOGGLE_EVENT, {
          detail: { open: currentStep.needsSidebar },
        })
      );
    }

    let sectionTimer: number | undefined;
    if (currentStep.needsSidebar) {
      sectionTimer = window.setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent(SIDEBAR_SECTION_EVENT, {
            detail: {
              section:
                currentStep.sidebarSection !== undefined
                  ? currentStep.sidebarSection
                  : null,
              scrollTarget: currentStep.sidebarScrollTarget || null,
            },
          })
        );
      }, 120);
    }

    if (currentStep.routeHint && onNavigate) {
      try {
        if (window.location.pathname !== currentStep.routeHint) {
          onNavigate(currentStep.routeHint);
        }
      } catch {
        // ignore navigation errors
      }
    }

    if (currentStep.scrollToBottom) {
      try {
        window.scrollTo({
          top: document.documentElement.scrollHeight,
          behavior: "smooth",
        });
      } catch {
        window.scrollTo(0, document.documentElement.scrollHeight);
      }
    }

    return () => {
      if (sectionTimer) window.clearTimeout(sectionTimer);
    };
  }, [isVisible, showWelcomeGate, currentStep, onNavigate, onToggleSidebar]);

  // Spotlight measurement + optional click-to-advance listener
  useEffect(() => {
    if (!isVisible || showWelcomeGate) {
      setTargetRect(null);
      setTargetFound(false);
      return;
    }

    let cancelled = false;
    let attachedEl: HTMLElement | null = null;

    const handleTargetInteraction = () => {
      if (currentStep.advanceOnTargetClick) {
        window.setTimeout(() => {
          if (!cancelled) goNext();
        }, 180);
      }
    };

    const locateAndMeasure = (shouldScroll: boolean) => {
      if (cancelled) return;
      const el = findFirstVisibleElement(currentStep.targetSelectors);

      if (attachedEl && attachedEl !== el) {
        attachedEl.removeEventListener("click", handleTargetInteraction);
        attachedEl = null;
      }

      if (!el) {
        setTargetRect(null);
        setTargetFound(false);
        return;
      }

      setTargetFound(true);

      if (shouldScroll && !currentStep.scrollToBottom && !currentStep.needsSidebar) {
        try {
          el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
        } catch {
          // ignore
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
        el.addEventListener("click", handleTargetInteraction);
      }
    };

    locateAndMeasure(true);
    const t1 = window.setTimeout(() => locateAndMeasure(true), 240);
    const t2 = window.setTimeout(() => locateAndMeasure(false), 580);

    const onViewportChange = () => {
      setViewportTick((v) => v + 1);
      locateAndMeasure(false);
    };

    window.addEventListener("resize", onViewportChange);
    window.addEventListener("scroll", onViewportChange, true);

    return () => {
      cancelled = true;
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("scroll", onViewportChange, true);
      if (attachedEl) {
        attachedEl.removeEventListener("click", handleTargetInteraction);
      }
    };
  }, [isVisible, showWelcomeGate, currentStep, goNext]);

  // Keyboard & TV Remote navigation
  useEffect(() => {
    if (!isVisible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (showChapterMenu) {
          setShowChapterMenu(false);
        } else {
          finishWalkthrough(false);
        }
        return;
      }

      if (showWelcomeGate) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setShowWelcomeGate(false);
        }
        return;
      }

      if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isVisible, showWelcomeGate, showChapterMenu, goNext, goPrev, finishWalkthrough]);

  // Keep Next button focused for smooth TV remote navigation
  useEffect(() => {
    if (isVisible && !showWelcomeGate && !showChapterMenu) {
      nextBtnRef.current?.focus({ preventScroll: true });
    }
  }, [isVisible, showWelcomeGate, showChapterMenu, stepIndex]);

  if (!isVisible || typeof document === "undefined") {
    return null;
  }

  const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
  const cardWidth = Math.min(430, Math.max(290, vw - 32));
  const estimatedHeight = cardRef.current?.offsetHeight || 320;
  const pos = getClampedCardPosition(
    showWelcomeGate ? null : targetRect,
    cardWidth,
    estimatedHeight,
    currentStep.needsSidebar
  );
  void viewportTick;

  const chapterStepCounts = WALKTHROUGH_CHAPTERS.map((ch) => {
    const stepsInChapter = WALKTHROUGH_STEPS.filter((s) => s.chapterId === ch.id);
    const firstIndex = WALKTHROUGH_STEPS.findIndex((s) => s.chapterId === ch.id);
    const lastIndex = firstIndex + stepsInChapter.length - 1;
    return {
      ...ch,
      count: stepsInChapter.length,
      isCurrent: ch.id === currentStep.chapterId,
      isDone: stepIndex > lastIndex,
    };
  });

  const overlay = (
    <div
      className="rabtv-wt-root"
      role="dialog"
      aria-modal="true"
      aria-label="RABBiT TV Interactive Walkthrough"
    >
      <style>{`
        .rabtv-wt-root {
          --wt-accent: var(--accent-color, var(--primary-color, #a855f7));
          --wt-accent-glow: rgba(168, 85, 247, 0.55);
          --wt-glass-bg: rgba(12, 15, 28, 0.92);
          --wt-glass-border: rgba(255, 255, 255, 0.18);
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
          background: rgba(5, 7, 15, 0.72);
          backdrop-filter: blur(3px);
          -webkit-backdrop-filter: blur(3px);
          pointer-events: auto;
        }
        .rabtv-wt-spotlight {
          position: fixed;
          border-radius: 16px;
          box-shadow:
            0 0 0 9999px rgba(5, 7, 15, 0.74),
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
              0 0 0 9999px rgba(5, 7, 15, 0.74),
              0 0 0 3px var(--wt-accent),
              0 0 22px 4px var(--wt-accent-glow);
          }
          50% {
            box-shadow:
              0 0 0 9999px rgba(5, 7, 15, 0.74),
              0 0 0 4px #ffffff,
              0 0 34px 10px var(--wt-accent-glow);
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
            0 24px 60px rgba(0, 0, 0, 0.68),
            0 0 0 1px rgba(255, 255, 255, 0.06) inset,
            0 0 32px rgba(168, 85, 247, 0.24);
          padding: 18px 20px 16px;
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
          font-size: 13.5px;
          font-weight: 700;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          transition: transform 0.14s ease, background 0.15s ease;
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

      {showWelcomeGate ? (
        <div
          ref={cardRef}
          className="rabtv-wt-card"
          style={{
            width: Math.min(500, vw - 32),
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#d8b4fe",
                background: "rgba(168, 85, 247, 0.2)",
                border: "1px solid rgba(168, 85, 247, 0.45)",
                padding: "4px 10px",
                borderRadius: 999,
              }}
            >
              RABBiT TV Interactive Tour
            </span>
            <button
              type="button"
              className="rabtv-wt-btn"
              style={{ padding: "6px 10px", fontSize: 12 }}
              onClick={() => finishWalkthrough(false)}
            >
              Skip
            </button>
          </div>

          <h2 style={{ margin: "0 0 10px", fontSize: 22, fontWeight: 800, lineHeight: 1.2 }}>
            Tour Every Feature of RABBiT TV
          </h2>

          <p style={{ margin: "0 0 14px", fontSize: 14.5, lineHeight: 1.55, color: "var(--wt-muted)" }}>
            Walk step-by-step through all{" "}
            <strong style={{ color: "#fff" }}>{WALKTHROUGH_CHAPTERS.length} sections</strong> ({totalSteps}{" "}
            guided stops) — including the full <strong style={{ color: "#fff" }}>Crystal Sidebar</strong>,
            Themes, Lobby Radio, Senior Easy Mode, RAM Modes, Movies, 284+ Live TV channels, Terms of Service,
            and the <strong style={{ color: "#fff" }}>TMDB link</strong> at the bottom of pages.
          </p>

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
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
        <div
          ref={cardRef}
          className="rabtv-wt-card"
          style={{
            width: cardWidth,
            top: pos.top,
            left: pos.left,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
            <button
              type="button"
              className="rabtv-wt-btn"
              style={{
                padding: "5px 10px",
                fontSize: 12,
                borderRadius: 999,
                background: "rgba(168, 85, 247, 0.22)",
                borderColor: "rgba(168, 85, 247, 0.5)",
                color: "#e9d5ff",
              }}
              onClick={() => setShowChapterMenu((prev) => !prev)}
            >
              <span>
                Ch {currentChapter.number}/{WALKTHROUGH_CHAPTERS.length}: {currentChapter.shortTitle}
              </span>
              <span aria-hidden="true">{showChapterMenu ? "▲" : "▼"}</span>
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--wt-muted)" }}>
                {stepIndex + 1} / {totalSteps}
              </span>
              <button
                type="button"
                className="rabtv-wt-btn"
                style={{ padding: "5px 9px", fontSize: 12 }}
                onClick={() => finishWalkthrough(false)}
                aria-label="Close walkthrough"
              >
                ✕
              </button>
            </div>
          </div>

          <div
            style={{
              height: 5,
              width: "100%",
              background: "rgba(255, 255, 255, 0.1)",
              borderRadius: 999,
              overflow: "hidden",
              marginBottom: 14,
            }}
          >
            <div
              style={{
                width: `${progressPercent}%`,
                height: "100%",
                background: "linear-gradient(90deg, var(--wt-accent), #38bdf8)",
                borderRadius: 999,
                transition: "width 0.25s ease",
              }}
            />
          </div>

          {showChapterMenu ? (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: "#e2e8f0" }}>
                Jump to Any Section ({WALKTHROUGH_CHAPTERS.length} Chapters)
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  maxHeight: 280,
                  overflowY: "auto",
                  paddingRight: 4,
                  marginBottom: 14,
                }}
              >
                {chapterStepCounts.map((ch) => (
                  <button
                    key={ch.id}
                    type="button"
                    className={`rabtv-wt-chapter-item ${ch.isCurrent ? "is-current" : ""}`}
                    onClick={() => jumpToChapter(ch.id)}
                  >
                    <span>
                      {ch.isDone ? "✓ " : `${ch.number}. `}
                      {ch.title}
                    </span>
                    <span style={{ fontSize: 11, color: "#cbd5e1", whiteSpace: "nowrap" }}>
                      {ch.count} {ch.count === 1 ? "step" : "steps"}
                    </span>
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
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
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "3px 8px",
                    borderRadius: 999,
                    background: targetFound
                      ? "rgba(34, 197, 94, 0.2)"
                      : "rgba(148, 163, 184, 0.16)",
                    border: targetFound
                      ? "1px solid rgba(34, 197, 94, 0.45)"
                      : "1px solid rgba(148, 163, 184, 0.3)",
                    color: targetFound ? "#86efac" : "#cbd5e1",
                  }}
                >
                  {targetFound ? "● Highlighted on Screen" : "○ Feature Overview"}
                </span>

                {currentStep.needsSidebar && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: "3px 8px",
                      borderRadius: 999,
                      background: "rgba(56, 189, 248, 0.18)",
                      border: "1px solid rgba(56, 189, 248, 0.4)",
                      color: "#bae6fd",
                    }}
                  >
                    Crystal Sidebar
                  </span>
                )}
              </div>

              <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 800, lineHeight: 1.25, color: "#ffffff" }}>
                {currentStep.title}
              </h3>

              <p style={{ margin: "0 0 12px", fontSize: 14, lineHeight: 1.55, color: "var(--wt-muted)" }}>
                {currentStep.description}
              </p>

              <div
                style={{
                  background: "rgba(168, 85, 247, 0.14)",
                  border: "1px solid rgba(168, 85, 247, 0.35)",
                  borderRadius: 12,
                  padding: "9px 12px",
                  fontSize: 13,
                  lineHeight: 1.45,
                  color: "#f3e8ff",
                  marginBottom: currentStep.proTip ? 10 : 14,
                }}
              >
                <strong>Try it: </strong>
                {currentStep.actionHint}
              </div>

              {currentStep.proTip && (
                <div
                  style={{
                    background: "rgba(255, 255, 255, 0.05)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: 10,
                    padding: "8px 11px",
                    fontSize: 12.5,
                    lineHeight: 1.45,
                    color: "#cbd5e1",
                    marginBottom: 14,
                  }}
                >
                  <strong style={{ color: "#fde68a" }}>Tip: </strong>
                  {currentStep.proTip}
                </div>
              )}

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="rabtv-wt-btn"
                  style={{ padding: "8px 12px", fontSize: 13 }}
                  onClick={() => finishWalkthrough(false)}
                >
                  Skip Tour
                </button>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
                    {stepIndex === totalSteps - 1 ? "Finish Tour ✓" : "Next →"}
                  </button>
                </div>
              </div>

              <div style={{ marginTop: 10, textAlign: "center", fontSize: 11, color: "rgba(203, 213, 225, 0.72)" }}>
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