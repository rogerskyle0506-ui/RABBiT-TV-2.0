/**
 * ============================================================
 * LIVE FEED ENGINE — SECURITY, PERFORMANCE & SMART CATALOG
 * ============================================================
 * - 215 verified built-in live channels (Network 10 scrubbed)
 * - Hardened SSRF / LAN / ad-host URL security & M3U sanitizer
 * - O(1) indexed memoized catalog & single-flight network deduplication
 * - Smart HLS #EXTM3U content verification & AbortSignal cancellation
 * - Dead-channel circuit breaker (auto-quarantine after repeated failures)
 * - Automatic regional mirror/backup finder (e.g. Seven/Nine/ABC failovers)
 * - Kids-safe filtering, hide/unhide channels, M3U import/export & zapping
 */

import {
  getHardwareLimits,
  getFavoriteChannelIds,
  getKidsModeLocked,
  getSavedUserAge,
  purgeOldTmdbCaches,
} from "./settings";
import { getChannelCategory } from "./channel-categories";
import { matchesChannelSearch } from "./channel-descriptions";

export type ChannelHealth = "online" | "offline" | "checking" | "unknown";

export interface LiveFeedService {
  channelId: string;
  name: string;
  groupTitle: string;
  logo?: string;
  channelNumber?: number;
  url: string;
  userAgent?: string;
  referrer?: string;
  manifestType?: string;
  licenseType?: string;
  licenseKey?: string;
  disabled?: boolean;
  isCustom?: boolean;
}

/** What the rest of the app imports */
export type LiveChannel = LiveFeedService & {
  streamUrl: string;
  title: string;
  category: string;
  isDrm: boolean;
  isFavorite: boolean;
  isHidden?: boolean;
  isQuarantined?: boolean;
  reliabilityScore?: number;
  health?: ChannelHealth;
  healthCheckedAt?: number;
  latencyMs?: number;
};

export interface CatalogHealthStats {
  total: number;
  online: number;
  offline: number;
  unknown: number;
  checking: number;
  quarantined?: number;
}

export interface LiveCatalogSummary {
  totalChannels: number;
  builtInCount: number;
  customCount: number;
  remoteOverrideCount: number;
  hiddenCount: number;
  quarantinedCount: number;
  drmCount: number;
  regionCount: number;
  pinnedCount: number;
  cachedOnlineCount: number;
}

export interface ChannelReliabilityRecord {
  successes: number;
  failures: number;
  consecutiveFailures: number;
  avgLatencyMs: number;
  lastUpdatedAt: number;
  quarantinedUntil?: number;
}

export interface M3uImportResult {
  ok: boolean;
  added: number;
  skipped: number;
  blocked: number;
  totalCustom: number;
  error?: string;
}

// ——— Events & Storage Keys ———
export const LIVE_CATALOG_UPDATED_EVENT = "rabtv_live_catalog_updated";
export const LIVE_HEALTH_UPDATED_EVENT = "rabtv_live_health_updated";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const REMOTE_OVERRIDES_TTL_MS = 30 * 60 * 1000; // 30 minutes
const QUARANTINE_DURATION_MS = 6 * 60 * 60 * 1000; // 6-hour auto-cooldown
const QUARANTINE_FAILURE_THRESHOLD = 3;

const HEALTH_CACHE_KEY = "rabtv_cache_live_health_v4";
const REMOTE_OVERRIDES_CACHE_KEY = "rabtv_cache_live_remote_v1";
const CUSTOM_CHANNELS_KEY = "rabtv_custom_live_channels_v1";
const HIDDEN_CHANNELS_KEY = "rabtv_hidden_live_channels_v1";
const RELIABILITY_CACHE_KEY = "rabtv_live_reliability_v1";

const MAX_CUSTOM_CHANNELS = 50;
const MAX_REMOTE_OVERRIDES = 300;
const MAX_M3U_BYTES = 512 * 1024; // 512 KB cap prevents freezing 1-2GB sticks
const MAX_M3U_LINES = 5000;
const MAX_URL_LENGTH = 2048;
const HIDE_OFFLINE_BY_DEFAULT = true;

const GIST_ID = ((import.meta as any).env?.VITE_GIST_ID as string) || "";
const GITHUB_TOKEN = ((import.meta as any).env?.VITE_GH_PAT as string) || "";
const GIST_API_URL = GIST_ID ? `https://api.github.com/gists/${GIST_ID}` : "";

const DEFAULT_LIVE_UA =
  "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56";

// Known ad/tracker/redirect hosts blocked from custom M3U imports & OTA feeds
const BLOCKED_STREAM_HOST_FRAGMENTS = [
  "doubleclick.net",
  "googlesyndication.com",
  "popads.net",
  "popcash.net",
  "adsterra.com",
  "propellerads.com",
  "exoclick.com",
  "clickadu.com",
  "hilltopads.com",
  "monetag.com",
  "adcash.com",
];

// Mature keywords filtered out when Kids Safe Mode is active
const MATURE_LIVE_KEYWORDS = [
  "adult",
  "crime",
  "deadly",
  "murder",
  "cops",
  "48 hours",
  "csi",
  "thriller",
  "paranormal",
  "haunt",
  "ghost",
  "botched",
  "prisoner",
  "hell",
  "ridiculousness",
  "embarrassing bodies",
  "surveillance",
  "emergency",
  "a&e",
  "warfare",
];

function defineChannel(
  channelId: string,
  name: string,
  groupTitle: string,
  url: string,
  logo?: string,
  channelNumber?: number,
  extra?: Partial<LiveFeedService>
): LiveFeedService {
  const entry: LiveFeedService = {
    channelId,
    name,
    groupTitle,
    logo,
    url,
    userAgent: extra?.userAgent ?? DEFAULT_LIVE_UA,
    referrer: extra?.referrer ?? "",
  };
  if (channelNumber !== undefined) entry.channelNumber = channelNumber;
  if (extra?.manifestType) entry.manifestType = extra.manifestType;
  if (extra?.licenseType) entry.licenseType = extra.licenseType;
  if (extra?.licenseKey) entry.licenseKey = extra.licenseKey;
  if (extra?.disabled) entry.disabled = extra.disabled;
  if (extra?.isCustom) entry.isCustom = extra.isCustom;
  return entry;
}

// ——— Built-In Live Channels Array (215 Channels — Network 10 Scrubbed) ———
export const liveFeedServices: LiveFeedService[] = [
  defineChannel("mjh-sky-popup2", "ThreeNow Sport 2", "Nz", "https://i.mjh.nz/.r/sky-popup2.m3u8", "https://contentful-images.digital.skyone.co.nz/v3/hf0kmuqe0d45/1jZRHmRhF6VFjZET4V2hFM/6d31709f4e877e133c3d16d28e1b58d2/Logo_Images_-_default.png"),
  defineChannel("mjh-sky-hgtv", "HGTV", "Nz", "https://i.mjh.nz/.r/sky-hgtv.m3u8", "https://contentful-images.digital.skyone.co.nz/v3/hf0kmuqe0d45/7ln9bxKLUYx7i79iVBSREP/3728559763d31ce1a9484fb68db96ddc/Logo_Images_-_default.png", 19),
  defineChannel("mjh-sky-ptcn", "CNN Headlines International", "Nz", "https://i.mjh.nz/.r/sky-ptcn.m3u8", "https://contentful-images.digital.skyone.co.nz/v3/hf0kmuqe0d45/5xPXSNCtJNBngNLKZBGLXU/d3fa23fd249dd7c195fe69df9a49961a/Logo_Images_-_default.png"),
  defineChannel("mjh-sky-ptms", "MovieSphere", "Nz", "https://i.mjh.nz/.r/sky-ptms.m3u8", "https://contentful-images.digital.skyone.co.nz/v3/hf0kmuqe0d45/4mdrvR6alGKw4BOn2sOnso/efe1f352f9ac767b86ed3ca3a1af2b62/Logo_Images_default.png"),
  defineChannel("mjh-sky-fast3", "Below Deck Vault", "Nz", "https://i.mjh.nz/.r/sky-fast3.m3u8", "https://contentful-images.digital.skyone.co.nz/v3/hf0kmuqe0d45/5Z2Ys82fuOd44NeA08xHcn/d5a345204a1bee6ff31f52bc85b0b593/Logo.png"),
  defineChannel("mjh-sky-ptmb", "MythBusters", "Nz", "https://i.mjh.nz/.r/sky-ptmb.m3u8", "https://contentful-images.digital.skyone.co.nz/v3/hf0kmuqe0d45/7IE0yWc4kkOAOZD1Y2w9x6/c950f41e60d2d136c3a3bb4f6dd281f6/Logo_Images_-_default.png"),
  defineChannel("mjh-sky-fast4", "Warner Bros TV True Crime", "Nz", "https://i.mjh.nz/.r/sky-fast4.m3u8", "https://contentful-images.digital.skyone.co.nz/v3/hf0kmuqe0d45/1gHJMQllMFrDalQ3o1yiBd/b223fc44c242254ebcda81101698527a/Logo_-_default.png"),
  defineChannel("mjh-sky-fast5", "Warner Bros TV Paranormal", "Nz", "https://i.mjh.nz/.r/sky-fast5.m3u8", "https://contentful-images.digital.skyone.co.nz/v3/hf0kmuqe0d45/6fSJzwOG5r7dfPc2uP4n7m/1e3923f6869c29300e3d76597c341282/Logo_Images_-_default.png"),
  defineChannel("mjh-sky-fast1", "Warner Bros TV Motorheads", "Nz", "https://i.mjh.nz/.r/sky-fast1.m3u8", "https://contentful-images.digital.skyone.co.nz/v3/hf0kmuqe0d45/laHWrOWVIUsYpUq2F7y0r/900f30b379ffadcdd49ea43ff83dc3d9/Logo_Images_-_default.png"),
  defineChannel("mjh-sky-fast2", "Warner Bros TV Deadliest Catch", "Nz", "https://i.mjh.nz/.r/sky-fast2.m3u8", "https://contentful-images.digital.skyone.co.nz/v3/hf0kmuqe0d45/4sdV9uGhLQRMYrBdMtGTNs/15a364e6a26ee48cff2979fa9f90bf51/Logo_Images_-_default.png"),
  defineChannel("mjh-sky-fast6", "Warner Bros TV House Hunters", "Nz", "https://i.mjh.nz/.r/sky-fast6.m3u8", "https://contentful-images.digital.skyone.co.nz/v3/hf0kmuqe0d45/7lHULtKhOa2XUCfUvXAvL5/23ce1169fbdbda0a219f6af3211b73eb/Logo_Images_-_default.png"),
  defineChannel("mjh-mood-1290", "JuiceTV", "Nz", "https://i.mjh.nz/.r/mood-1290.m3u8", "https://gizmeon-vod.lg.mncdn.com/thumbnails/fastchannel/1744244355255.png", 38),
  defineChannel("mjh-mood-1289", "J2", "Nz", "https://i.mjh.nz/.r/mood-1289.m3u8", "https://gizmeon-vod.lg.mncdn.com/thumbnails/fastchannel/1762940270646.png"),
  defineChannel("mjh-mood-1286", "Big Rig", "Nz", "https://i.mjh.nz/.r/mood-1286.m3u8", "https://gizmeon-vod.lg.mncdn.com/thumbnails/fastchannel/1744244778333.png"),
  defineChannel("mjh-mood-1288", "Melo", "Nz", "https://i.mjh.nz/.r/mood-1288.m3u8", "https://gizmeon-vod.lg.mncdn.com/thumbnails/fastchannel/1744280017572.png"),
  defineChannel("mjh-mood-1287", "The Groat", "Nz", "https://i.mjh.nz/.r/mood-1287.m3u8", "https://gizmeon-vod.lg.mncdn.com/thumbnails/fastchannel/1743730111010.png"),
  defineChannel("mjh-tvnz-1", "TVNZ 1", "Nz", "https://i.mjh.nz/.r/tvnz-1.mpd", "https://i.mjh.nz/.images/tvnz-1.png", 1, { manifestType: "mpd", licenseType: "com.widevine.alpha", licenseKey: "https://c.mjh.nz/tvnz-1-wv" }),
  defineChannel("mjh-tvnz-2", "TVNZ 2", "Nz", "https://i.mjh.nz/.r/tvnz-2.mpd", "https://i.mjh.nz/.images/tvnz-2.png", 2, { manifestType: "mpd", licenseType: "com.widevine.alpha", licenseKey: "https://c.mjh.nz/tvnz-2-wv" }),
  defineChannel("mjh-three", "Three", "Nz", "https://i.mjh.nz/.r/three.m3u8", "https://i.mjh.nz/.images/three.png", 3),
  defineChannel("mjh-bravo", "Bravo", "Nz", "https://i.mjh.nz/.r/bravo.m3u8", "https://i.mjh.nz/.images/bravo.png", 4),
  defineChannel("mjh-maori-tv", "Whakaata Maori", "Nz", "https://i.mjh.nz/.r/maori-tv.m3u8", "https://i.mjh.nz/.images/maori-tv.png", 5),
  defineChannel("mjh-tvnz-duke", "DUKE", "Nz", "https://i.mjh.nz/.r/tvnz-duke.mpd", "https://i.mjh.nz/.images/tvnz-duke.png", 6, { manifestType: "mpd", licenseType: "com.widevine.alpha", licenseKey: "https://c.mjh.nz/tvnz-duke-wv" }),
  defineChannel("mjh-prime", "Sky Open", "Nz", "https://i.mjh.nz/.r/prime.m3u8", "https://i.mjh.nz/.images/sky-open.png", 8),
  defineChannel("mjh-rush-nz", "RUSH", "Nz", "https://i.mjh.nz/.r/rush-nz.m3u8", "https://i.mjh.nz/.images/rush-nz.png", 9),
  defineChannel("mjh-te-reo", "Te Reo", "Nz", "https://i.mjh.nz/.r/te-reo.m3u8", "https://i.mjh.nz/.images/te-reo.png", 10),
  defineChannel("mjh-three-plus1", "ThreePlus1", "Nz", "https://i.mjh.nz/.r/three-plus1.m3u8", "https://i.mjh.nz/.images/three-plus1.png", 13),
  defineChannel("mjh-bravo-plus1", "Bravo PLUS 1", "Nz", "https://i.mjh.nz/.r/bravo-plus1.m3u8", "https://i.mjh.nz/.images/bravo-plus1.png", 14),
  defineChannel("mjh-eden", "eden", "Nz", "https://i.mjh.nz/.r/eden.m3u8", "https://i.mjh.nz/.images/eden.png", 18),
  defineChannel("mjh-al-jazeera", "Al Jazeera", "Nz", "https://i.mjh.nz/.r/al-jazeera.m3u8", "https://i.mjh.nz/.images/al-jazeera.png", 20),
  defineChannel("mjh-trackside-1", "Trackside 1", "Nz", "https://i.mjh.nz/.r/trackside-1.m3u8", "https://i.mjh.nz/.images/trackside-1.png", 23),
  defineChannel("mjh-trackside-2", "Trackside 2", "Nz", "https://i.mjh.nz/.r/trackside-2.m3u8", "https://i.mjh.nz/.images/trackside-2.png", 24),
  defineChannel("mjh-shine-tv", "Shine TV", "Nz", "https://c.mjh.nz/shine-tv.m3u8", "https://i.mjh.nz/.images/shine-tv.png", 25),
  defineChannel("mjh-firstlight", "Firstlight", "Nz", "https://i.mjh.nz/.r/firstlight.m3u8", "https://i.mjh.nz/.images/firstlight.png", 26),
  defineChannel("mjh-hope-channel", "Hope Channel", "Nz", "https://i.mjh.nz/.r/hope-channel.m3u8", "https://i.mjh.nz/.images/hope-channel.png", 27),
  defineChannel("mjh-parliament-tv", "Parliament TV", "Nz", "https://i.mjh.nz/.r/parliament-tv.m3u8", "https://i.mjh.nz/.images/parliament-tv.png", 31),
  defineChannel("mjh-wairarapa-tv", "Wairarapa TV", "Nz", "https://i.mjh.nz/.r/wairarapa-tv.m3u8", "https://i.mjh.nz/.images/wairarapa-tv.png", 41),
  defineChannel("mjh-ch200", "CH200", "Nz", "https://i.mjh.nz/.r/ch200.m3u8", "https://i.mjh.nz/.images/ch200.png", 200),
  defineChannel("mjh-trackside-premier", "Trackside Premier", "Nz", "https://i.mjh.nz/.r/trackside-premier.m3u8", "https://i.mjh.nz/.images/trackside-premier.png"),
  defineChannel("mjh-tvsn-shopping", "TVSN Shopping", "Nz", "https://i.mjh.nz/.r/tvsn-shopping.m3u8", "https://i.mjh.nz/.images/tvsn-shopping.png"),
  defineChannel("mjh-seven-syd", "Seven", "Sydney", "https://i.mjh.nz/.r/seven-syd.m3u8", "https://i.mjh.nz/.images/auto-seven-syd-9608a4.png", 71),
  defineChannel("mjh-7two-syd", "7two", "Sydney", "https://i.mjh.nz/.r/7two-syd.m3u8", "https://i.mjh.nz/.images/auto-7two-syd-701123.png", 72),
  defineChannel("mjh-7mate-syd", "7mate", "Sydney", "https://i.mjh.nz/.r/7mate-syd.m3u8", "https://i.mjh.nz/.images/auto-7mate-syd-360d60.png", 74),
  defineChannel("mjh-7flix-syd", "7flix", "Sydney", "https://i.mjh.nz/.r/7flix-syd.m3u8", "https://i.mjh.nz/.images/auto-7flix-syd-c6badc.png", 76),
  defineChannel("mjh-channel-9-nsw", "Channel 9", "Sydney", "https://i.mjh.nz/.r/channel-9-nsw.m3u8", "https://imageresizer.static9.net.au/lx1XIWcrYZRtnfJOqvxNn9CshDI=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2024%2F09%2F630608%2F9nine-1.png", 91),
  defineChannel("mjh-gem-nsw", "9Gem", "Sydney", "https://i.mjh.nz/.r/gem-nsw.m3u8", "https://imageresizer.static9.net.au/d00389KKc5T4o5isRaDE9Pl9DWk=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2024%2F08%2F620929%2F9gem-1.png", 92),
  defineChannel("mjh-go-nsw", "9Go!", "Sydney", "https://i.mjh.nz/.r/go-nsw.m3u8", "https://imageresizer.static9.net.au/fcTwzkAJT4q81emfp2kYkgoxlDA=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2024%2F03%2F574470%2F9go.png", 93),
  defineChannel("mjh-life-nsw", "9Life", "Sydney", "https://i.mjh.nz/.r/life-nsw.m3u8", "https://imageresizer.static9.net.au/wMK3kBDybfEoN2iqyDDflC91D1U=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2024%2F03%2F574472%2F9life.png", 94),
  defineChannel("mjh-rush-nsw", "9Rush", "Sydney", "https://i.mjh.nz/.r/rush-nsw.m3u8", "https://imageresizer.static9.net.au/5B2ZDlD8Ji6dCecGQEfwy2U2m4Y=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2024%2F03%2F574473%2F9rush.png", 96),
  defineChannel("mjh-channel-9-lismore", "Channel 9 (Norther Rivers)", "Sydney", "https://i.mjh.nz/.r/channel-9-lismore.m3u8", "https://imageresizer.static9.net.au/lx1XIWcrYZRtnfJOqvxNn9CshDI=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2024%2F09%2F630608%2F9nine-1.png"),
  defineChannel("mjh-channel-9-newcastle", "Channel 9 (Newcastle)", "Sydney", "https://i.mjh.nz/.r/channel-9-newcastle.m3u8", "https://imageresizer.static9.net.au/lx1XIWcrYZRtnfJOqvxNn9CshDI=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2024%2F09%2F630608%2F9nine-1.png"),
  defineChannel("mjh-abc-nsw", "ABC TV", "Sydney", "https://c.mjh.nz/abc-nsw.m3u8", "https://i.mjh.nz/.images/abc-nsw.png", 21),
  defineChannel("mjh-snowy-mountains", "Snowy Mountains Television", "Sydney", "https://i.mjh.nz/.r/snowy-mountains.m3u8", "https://i.mjh.nz/.images/smtv.png", undefined, { referrer: "https://player.castr.com/" }),
  defineChannel("mjh-seven-mel", "Seven", "Melbourne", "https://i.mjh.nz/.r/seven-mel.m3u8", "https://i.mjh.nz/.images/auto-seven-mel-9608a4.png", 71),
  defineChannel("mjh-7two-mel", "7two", "Melbourne", "https://i.mjh.nz/.r/7two-mel.m3u8", "https://i.mjh.nz/.images/auto-7two-mel-701123.png", 72),
  defineChannel("mjh-7mate-mel", "7mate", "Melbourne", "https://i.mjh.nz/.r/7mate-mel.m3u8", "https://i.mjh.nz/.images/auto-7mate-mel-360d60.png", 74),
  defineChannel("mjh-7flix-mel", "7flix", "Melbourne", "https://i.mjh.nz/.r/7flix-mel.m3u8", "https://i.mjh.nz/.images/auto-7flix-mel-c6badc.png", 76),
  defineChannel("mjh-channel-9-vic", "Channel 9", "Melbourne", "https://i.mjh.nz/.r/channel-9-vic.m3u8", "https://imageresizer.static9.net.au/lx1XIWcrYZRtnfJOqvxNn9CshDI=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2024%2F09%2F630608%2F9nine-1.png", 91),
  defineChannel("mjh-gem-vic", "9Gem", "Melbourne", "https://i.mjh.nz/.r/gem-vic.m3u8", "https://imageresizer.static9.net.au/d00389KKc5T4o5isRaDE9Pl9DWk=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2024%2F08%2F620929%2F9gem-1.png", 92),
  defineChannel("mjh-go-vic", "9Go!", "Melbourne", "https://i.mjh.nz/.r/go-vic.m3u8", "https://imageresizer.static9.net.au/fcTwzkAJT4q81emfp2kYkgoxlDA=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2024%2F03%2F574470%2F9go.png", 93),
  defineChannel("mjh-life-vic", "9Life", "Melbourne", "https://i.mjh.nz/.r/life-vic.m3u8", "https://imageresizer.static9.net.au/wMK3kBDybfEoN2iqyDDflC91D1U=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2024%2F03%2F574472%2F9life.png", 94),
  defineChannel("mjh-rush-vic", "9Rush", "Melbourne", "https://i.mjh.nz/.r/rush-vic.m3u8", "https://imageresizer.static9.net.au/5B2ZDlD8Ji6dCecGQEfwy2U2m4Y=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2024%2F03%2F574473%2F9rush.png", 96),
  defineChannel("mjh-abc-vic", "ABC TV", "Melbourne", "https://c.mjh.nz/abc-vic.m3u8", "https://i.mjh.nz/.images/abc-nsw.png", 21),
  defineChannel("mjh-c31", "Channel 31", "Melbourne", "https://i.mjh.nz/.r/c31.m3u8", "https://i.mjh.nz/.images/c31.png", 44),
  defineChannel("mjh-seven-bri", "Seven", "Brisbane", "https://i.mjh.nz/.r/seven-bri.m3u8", "https://i.mjh.nz/.images/auto-seven-bri-9608a4.png", 71),
  defineChannel("mjh-7two-bri", "7two", "Brisbane", "https://i.mjh.nz/.r/7two-bri.m3u8", "https://i.mjh.nz/.images/auto-7two-bri-701123.png", 72),
  defineChannel("mjh-7mate-bri", "7mate", "Brisbane", "https://i.mjh.nz/.r/7mate-bri.m3u8", "https://i.mjh.nz/.images/auto-7mate-bri-360d60.png", 74),
  defineChannel("mjh-7flix-bri", "7flix", "Brisbane", "https://i.mjh.nz/.r/7flix-bri.m3u8", "https://i.mjh.nz/.images/auto-7flix-bri-c6badc.png", 76),
  defineChannel("mjh-seven-cns", "Seven Cairns", "Brisbane", "https://i.mjh.nz/.r/seven-cns.m3u8", "https://i.mjh.nz/.images/auto-seven-cns-9608a4.png"),
  defineChannel("mjh-7flix-regional", "7flix Regional", "Brisbane", "https://i.mjh.nz/.r/7flix-regional.m3u8", "https://i.mjh.nz/.images/auto-7flix-regional-c6badc.png"),
  defineChannel("mjh-7two-regional", "7two Regional", "Brisbane", "https://i.mjh.nz/.r/7two-regional.m3u8", "https://i.mjh.nz/.images/auto-7two-regional-701123.png"),
  defineChannel("mjh-7mate-regional", "7mate Regional", "Brisbane", "https://i.mjh.nz/.r/7mate-regional.m3u8", "https://i.mjh.nz/.images/auto-7mate-regional-360d60.png"),
  defineChannel("mjh-seven-mky", "Seven Mackay", "Brisbane", "https://i.mjh.nz/.r/seven-mky.m3u8", "https://i.mjh.nz/.images/auto-seven-mky-9608a4.png"),
  defineChannel("mjh-seven-ssc", "Seven Sunshine Coast", "Brisbane", "https://i.mjh.nz/.r/seven-ssc.m3u8", "https://i.mjh.nz/.images/auto-seven-ssc-9608a4.png"),
  defineChannel("mjh-seven-rky", "Seven Rockhampton", "Brisbane", "https://i.mjh.nz/.r/seven-rky.m3u8", "https://i.mjh.nz/.images/auto-seven-rky-9608a4.png"),
  defineChannel("mjh-seven-twb", "Seven Toowoomba", "Brisbane", "https://i.mjh.nz/.r/seven-twb.m3u8", "https://i.mjh.nz/.images/auto-seven-twb-e627be.png"),
  defineChannel("mjh-seven-tsv", "Seven Townsville", "Brisbane", "https://i.mjh.nz/.r/seven-tsv.m3u8", "https://i.mjh.nz/.images/auto-seven-tsv-9608a4.png"),
  defineChannel("mjh-seven-wby", "Seven Wide Bay", "Brisbane", "https://i.mjh.nz/.r/seven-wby.m3u8", "https://i.mjh.nz/.images/auto-seven-wby-9608a4.png"),
  defineChannel("mjh-channel-9-qld", "Channel 9", "Brisbane", "https://i.mjh.nz/.r/channel-9-qld.m3u8", "https://imageresizer.static9.net.au/lx1XIWcrYZRtnfJOqvxNn9CshDI=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2024%2F09%2F630608%2F9nine-1.png", 91),
  defineChannel("mjh-gem-qld", "9Gem", "Brisbane", "https://i.mjh.nz/.r/gem-qld.m3u8", "https://imageresizer.static9.net.au/d00389KKc5T4o5isRaDE9Pl9DWk=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2024%2F08%2F620929%2F9gem-1.png", 92),
  defineChannel("mjh-go-qld", "9Go!", "Brisbane", "https://i.mjh.nz/.r/go-qld.m3u8", "https://imageresizer.static9.net.au/fcTwzkAJT4q81emfp2kYkgoxlDA=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2024%2F03%2F574470%2F9go.png", 93),
  defineChannel("mjh-life-qld", "9Life", "Brisbane", "https://i.mjh.nz/.r/life-qld.m3u8", "https://imageresizer.static9.net.au/wMK3kBDybfEoN2iqyDDflC91D1U=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2024%2F03%2F574472%2F9life.png", 94),
  defineChannel("mjh-rush-qld", "9Rush", "Brisbane", "https://i.mjh.nz/.r/rush-qld.m3u8", "https://imageresizer.static9.net.au/5B2ZDlD8Ji6dCecGQEfwy2U2m4Y=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2024%2F03%2F574473%2F9rush.png", 96),
  defineChannel("mjh-channel-9-gold-coast", "Channel 9 (Gold Coast)", "Brisbane", "https://i.mjh.nz/.r/channel-9-gold-coast.m3u8", "https://imageresizer.static9.net.au/lx1XIWcrYZRtnfJOqvxNn9CshDI=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2024%2F09%2F630608%2F9nine-1.png"),
  defineChannel("mjh-abc-qld", "ABC TV", "Brisbane", "https://c.mjh.nz/abc-qld.m3u8", "https://i.mjh.nz/.images/abc-nsw.png", 21),
  defineChannel("mjh-seven-per", "Seven", "Perth", "https://i.mjh.nz/.r/seven-per.m3u8", "https://i.mjh.nz/.images/auto-seven-per-9608a4.png", 71),
  defineChannel("mjh-7two-per", "7two", "Perth", "https://i.mjh.nz/.r/7two-per.m3u8", "https://i.mjh.nz/.images/auto-7two-per-701123.png", 72),
  defineChannel("mjh-7mate-per", "7mate", "Perth", "https://i.mjh.nz/.r/7mate-per.m3u8", "https://i.mjh.nz/.images/auto-7mate-per-360d60.png", 74),
  defineChannel("mjh-7flix-per", "7flix", "Perth", "https://i.mjh.nz/.r/7flix-per.m3u8", "https://i.mjh.nz/.images/auto-7flix-per-c6badc.png", 76),
  defineChannel("mjh-channel-9-wa", "Channel 9", "Perth", "https://i.mjh.nz/.r/channel-9-wa.m3u8", "https://imageresizer.static9.net.au/lx1XIWcrYZRtnfJOqvxNn9CshDI=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2024%2F09%2F630608%2F9nine-1.png", 91),
  defineChannel("mjh-gem-wa", "9Gem", "Perth", "https://i.mjh.nz/.r/gem-wa.m3u8", "https://imageresizer.static9.net.au/d00389KKc5T4o5isRaDE9Pl9DWk=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2024%2F08%2F620929%2F9gem-1.png", 92),
  defineChannel("mjh-go-wa", "9Go!", "Perth", "https://i.mjh.nz/.r/go-wa.m3u8", "https://imageresizer.static9.net.au/fcTwzkAJT4q81emfp2kYkgoxlDA=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2024%2F03%2F574470%2F9go.png", 93),
  defineChannel("mjh-life-wa", "9Life", "Perth", "https://i.mjh.nz/.r/life-wa.m3u8", "https://imageresizer.static9.net.au/wMK3kBDybfEoN2iqyDDflC91D1U=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2024%2F03%2F574472%2F9life.png", 94),
  defineChannel("mjh-rush-wa", "9Rush", "Perth", "https://i.mjh.nz/.r/rush-wa.m3u8", "https://imageresizer.static9.net.au/5B2ZDlD8Ji6dCecGQEfwy2U2m4Y=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2024%2F03%2F574473%2F9rush.png", 96),
  defineChannel("mjh-abc-wa", "ABC TV", "Perth", "https://c.mjh.nz/abc-wa.m3u8", "https://i.mjh.nz/.images/abc-nsw.png", 21),
  defineChannel("mjh-seven-ade", "Seven", "Adelaide", "https://i.mjh.nz/.r/seven-ade.m3u8", "https://i.mjh.nz/.images/auto-seven-ade-9608a4.png", 71),
  defineChannel("mjh-7two-ade", "7two", "Adelaide", "https://i.mjh.nz/.r/7two-ade.m3u8", "https://i.mjh.nz/.images/auto-7two-ade-701123.png", 72),
  defineChannel("mjh-7mate-ade", "7mate", "Adelaide", "https://i.mjh.nz/.r/7mate-ade.m3u8", "https://i.mjh.nz/.images/auto-7mate-ade-360d60.png", 74),
  defineChannel("mjh-7flix-ade", "7flix", "Adelaide", "https://i.mjh.nz/.r/7flix-ade.m3u8", "https://i.mjh.nz/.images/auto-7flix-ade-c6badc.png", 76),
  defineChannel("mjh-channel-9-sa", "Channel 9", "Adelaide", "https://i.mjh.nz/.r/channel-9-sa.m3u8", "https://imageresizer.static9.net.au/lx1XIWcrYZRtnfJOqvxNn9CshDI=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2024%2F09%2F630608%2F9nine-1.png", 91),
  defineChannel("mjh-gem-sa", "9Gem", "Adelaide", "https://i.mjh.nz/.r/gem-sa.m3u8", "https://imageresizer.static9.net.au/d00389KKc5T4o5isRaDE9Pl9DWk=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2024%2F08%2F620929%2F9gem-1.png", 92),
  defineChannel("mjh-go-sa", "9Go!", "Adelaide", "https://i.mjh.nz/.r/go-sa.m3u8", "https://imageresizer.static9.net.au/fcTwzkAJT4q81emfp2kYkgoxlDA=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2024%2F03%2F574470%2F9go.png", 93),
  defineChannel("mjh-life-sa", "9Life", "Adelaide", "https://i.mjh.nz/.r/life-sa.m3u8", "https://imageresizer.static9.net.au/wMK3kBDybfEoN2iqyDDflC91D1U=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2024%2F03%2F574472%2F9life.png", 94),
  defineChannel("mjh-rush-sa", "9Rush", "Adelaide", "https://i.mjh.nz/.r/rush-sa.m3u8", "https://imageresizer.static9.net.au/5B2ZDlD8Ji6dCecGQEfwy2U2m4Y=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2024%2F03%2F574473%2F9rush.png", 96),
  defineChannel("mjh-abc-sa", "ABC TV", "Adelaide", "https://c.mjh.nz/abc-sa.m3u8", "https://i.mjh.nz/.images/abc-nsw.png", 21),
  defineChannel("mjh-c44", "Channel 44", "Adelaide", "https://i.mjh.nz/.r/c44.m3u8", "https://i.mjh.nz/.images/c44.png", 44),
  defineChannel("mjh-abc-act", "ABC TV", "Canberra", "https://c.mjh.nz/abc-act.m3u8", "https://i.mjh.nz/.images/abc-nsw.png", 21),
  defineChannel("mjh-abc-nt", "ABC TV", "Darwin", "https://c.mjh.nz/abc-nt.m3u8", "https://i.mjh.nz/.images/abc-nsw.png", 21),
  defineChannel("mjh-first-nations-tv", "First Nations TV", "Darwin", "https://i.mjh.nz/.r/first-nations-tv.m3u8", "https://i.mjh.nz/.images/first-nations-tv.png", 41),
  defineChannel("mjh-tourism-tv", "Tourism TV", "Darwin", "https://i.mjh.nz/.r/tourism-tv.m3u8", "https://i.mjh.nz/.images/tourism-tv.png", 42),
  defineChannel("mjh-seven-hob", "Seven", "Hobart", "https://i.mjh.nz/.r/seven-hob.m3u8", "https://i.mjh.nz/.images/auto-seven-hob-9608a4.png", 71),
  defineChannel("mjh-abc-tas", "ABC TV", "Hobart", "https://c.mjh.nz/abc-tas.m3u8", "https://i.mjh.nz/.images/abc-nsw.png", 21),
  defineChannel("mjh-bordersecurityaustralia-fast", "Border Security Australia", "Au", "https://i.mjh.nz/.r/bordersecurityaustralia-fast.m3u8", "https://i.mjh.nz/.images/auto-bordersecurityaustralia-fast-30b210.png"),
  defineChannel("mjh-racing-fast", "Racing.com", "Au", "https://i.mjh.nz/.r/racing-fast.m3u8", "https://i.mjh.nz/.images/auto-racing-fast-de6aee.png", 78),
  defineChannel("mjh-hardcorepawn-fast", "Hardcore Pawn", "Au", "https://i.mjh.nz/.r/hardcorepawn-fast.m3u8", "https://i.mjh.nz/.images/auto-hardcorepawn-fast-87f8ee.png"),
  defineChannel("mjh-racingwa-fast", "Racing WA", "Au", "https://i.mjh.nz/.r/racingwa-fast.m3u8", "https://i.mjh.nz/.images/auto-racingwa-fast-128220.png"),
  defineChannel("mjh-allsaints-fast", "All Saints", "Au", "https://i.mjh.nz/.r/allsaints-fast.m3u8", "https://i.mjh.nz/.images/auto-allsaints-fast-ebad23.png"),
  defineChannel("mjh-mythbusters-fast", "Mythbusters", "Au", "https://i.mjh.nz/.r/mythbusters-fast.m3u8", "https://i.mjh.nz/.images/auto-mythbusters-fast-3a72b1.png"),
  defineChannel("mjh-travelaustralia-fast", "Travel Australia", "Au", "https://i.mjh.nz/.r/travelaustralia-fast.m3u8", "https://i.mjh.nz/.images/auto-travelaustralia-fast-cfd556.png"),
  defineChannel("mjh-aircrashinvestigations-fast", "Air Crash Investigations", "Au", "https://i.mjh.nz/.r/aircrashinvestigations-fast.m3u8", "https://i.mjh.nz/.images/auto-aircrashinvestigations-fast-7ff35e.png"),
  defineChannel("mjh-betterhomesandgardens-fast", "Better Homes And Gardens", "Au", "https://i.mjh.nz/.r/betterhomesandgardens-fast.m3u8", "https://i.mjh.nz/.images/auto-betterhomesandgardens-fast-8d1753.png"),
  defineChannel("mjh-cas33-fast", "The Yorkshire Vet", "Au", "https://i.mjh.nz/.r/cas33-fast.m3u8", "https://i.mjh.nz/.images/auto-cas33-fast-7aec74.png"),
  defineChannel("mjh-csicrimesceneinvestigation-fast", "CSI Crime Scene Investigation", "Au", "https://i.mjh.nz/.r/csicrimesceneinvestigation-fast.m3u8", "https://i.mjh.nz/.images/auto-csicrimesceneinvestigation-fast-87549e.png"),
  defineChannel("mjh-mightymachines-fast", "Mighty Machines", "Au", "https://i.mjh.nz/.r/mightymachines-fast.m3u8", "https://i.mjh.nz/.images/auto-mightymachines-fast-0fa14e.png"),
  defineChannel("mjh-cas21-fast", "Ghost Hunters", "Au", "https://i.mjh.nz/.r/cas21-fast.m3u8", "https://i.mjh.nz/.images/auto-cas21-fast-f940a9.png"),
  defineChannel("mjh-onthecase-fast", "On The Case", "Au", "https://i.mjh.nz/.r/onthecase-fast.m3u8", "https://i.mjh.nz/.images/auto-onthecase-fast-6ec172.png"),
  defineChannel("mjh-cas24-fast", "Bondi Vet", "Au", "https://i.mjh.nz/.r/cas24-fast.m3u8", "https://i.mjh.nz/.images/auto-cas24-fast-b9e819.png"),
  defineChannel("mjh-cas26-fast", "Home and Away Classics", "Au", "https://i.mjh.nz/.r/cas26-fast.m3u8", "https://i.mjh.nz/.images/auto-cas26-fast-ea7944.png"),
  defineChannel("mjh-livgolfreplays-fast", "LIV Golf Replays", "Au", "https://i.mjh.nz/.r/livgolfreplays-fast.m3u8", "https://i.mjh.nz/.images/auto-livgolfreplays-fast-471f30.png"),
  defineChannel("mjh-waterrats-fast", "Water Rats", "Au", "https://i.mjh.nz/.r/waterrats-fast.m3u8", "https://i.mjh.nz/.images/auto-waterrats-fast-428228.png"),
  defineChannel("mjh-7afl-fast", "7AFL", "Au", "https://i.mjh.nz/.r/7afl-fast.m3u8", "https://i.mjh.nz/.images/auto-7afl-fast-e8fdb6.png"),
  defineChannel("mjh-cas32-fast", "7NEWS Spotlight", "Au", "https://i.mjh.nz/.r/cas32-fast.m3u8", "https://i.mjh.nz/.images/auto-cas32-fast-2bc14f.png"),
  defineChannel("mjh-wtn-fast", "Wicked Tuna", "Au", "https://i.mjh.nz/.r/wtn-fast.m3u8", "https://i.mjh.nz/.images/auto-wtn-fast-0a858d.png"),
  defineChannel("mjh-winnersnlosers-fast", "Winners & Losers", "Au", "https://i.mjh.nz/.r/winnersnlosers-fast.m3u8", "https://i.mjh.nz/.images/auto-winnersnlosers-fast-a59958.png"),
  defineChannel("mjh-surveillancecentral-fast", "Surveillance Central", "Au", "https://i.mjh.nz/.r/surveillancecentral-fast.m3u8", "https://i.mjh.nz/.images/auto-surveillancecentral-fast-4eeefa.png"),
  defineChannel("mjh-outbacktruckers-fast", "Outback Truckers", "Au", "https://i.mjh.nz/.r/outbacktruckers-fast.m3u8", "https://i.mjh.nz/.images/auto-outbacktruckers-fast-332b21.png"),
  defineChannel("mjh-anglersparadise-fast", "Anglers Paradise", "Au", "https://i.mjh.nz/.r/anglersparadise-fast.m3u8", "https://i.mjh.nz/.images/auto-anglersparadise-fast-970ebb.png"),
  defineChannel("mjh-truckinghell-fast", "Trucking Hell", "Au", "https://i.mjh.nz/.r/truckinghell-fast.m3u8", "https://i.mjh.nz/.images/auto-truckinghell-fast-6b08c1.png"),
  defineChannel("mjh-judgejudy-fast", "Judge Judy", "Au", "https://i.mjh.nz/.r/judgejudy-fast.m3u8", "https://i.mjh.nz/.images/auto-judgejudy-fast-8781e8.png"),
  defineChannel("mjh-all-starcinema-fast", "All-Star Cinema", "Au", "https://i.mjh.nz/.r/all-starcinema-fast.m3u8", "https://i.mjh.nz/.images/auto-all-starcinema-fast-9f2397.png"),
  defineChannel("mjh-bluelight-fast", "Blue Light", "Au", "https://i.mjh.nz/.r/bluelight-fast.m3u8", "https://i.mjh.nz/.images/auto-bluelight-fast-dc5718.png"),
  defineChannel("mjh-medicalnrescue-fast", "Medical And Rescue", "Au", "https://i.mjh.nz/.r/medicalnrescue-fast.m3u8", "https://i.mjh.nz/.images/auto-medicalnrescue-fast-bd9388.png"),
  defineChannel("mjh-blueheelers-fast", "Blue Heelers", "Au", "https://i.mjh.nz/.r/blueheelers-fast.m3u8", "https://i.mjh.nz/.images/auto-blueheelers-fast-8cc89d.png"),
  defineChannel("mjh-kitchennightmares-fast", "Kitchen Nightmares", "Au", "https://i.mjh.nz/.r/kitchennightmares-fast.m3u8", "https://i.mjh.nz/.images/auto-kitchennightmares-fast-ba1ad2.png"),
  defineChannel("mjh-acountrypractice-fast", "A Country Practice", "Au", "https://i.mjh.nz/.r/acountrypractice-fast.m3u8", "https://i.mjh.nz/.images/auto-acountrypractice-fast-3f02ad.png"),
  defineChannel("mjh-truecrimefiles-fast", "True Crime Files", "Au", "https://i.mjh.nz/.r/truecrimefiles-fast.m3u8", "https://i.mjh.nz/.images/auto-truecrimefiles-fast-26e3bf.png"),
  defineChannel("mjh-art-fast", "Antiques Road Trip", "Au", "https://i.mjh.nz/.r/art-fast.m3u8", "https://i.mjh.nz/.images/auto-art-fast-99c60f.png"),
  defineChannel("mjh-7bravo-fast", "7Bravo", "Au", "https://i.mjh.nz/.r/7bravo-fast.m3u8", "https://i.mjh.nz/.images/auto-7bravo-fast-04647e.png", 75),
  defineChannel("mjh-heki-fast", "Hells Kitchen", "Au", "https://i.mjh.nz/.r/heki-fast.m3u8", "https://i.mjh.nz/.images/auto-heki-fast-6f7c4d.png"),
  defineChannel("mjh-belowdeckvault-fast", "Below Deck Vault", "Au", "https://i.mjh.nz/.r/belowdeckvault-fast.m3u8", "https://i.mjh.nz/.images/auto-belowdeckvault-fast-587793.png"),
  defineChannel("mjh-tvsn-fast", "TVSN", "Au", "https://i.mjh.nz/.r/tvsn-fast.m3u8", "https://i.mjh.nz/.images/auto-tvsn-fast-eda516.png", 77),
  defineChannel("mjh-etc-fast", "Escape to the Country", "Au", "https://i.mjh.nz/.r/etc-fast.m3u8", "https://i.mjh.nz/.images/auto-etc-fast-6d4429.png"),
  defineChannel("mjh-therealhousewivesvault-fast", "The Real Housewives VAULT", "Au", "https://i.mjh.nz/.r/therealhousewivesvault-fast.m3u8", "https://i.mjh.nz/.images/auto-therealhousewivesvault-fast-dd8ea5.png"),
  defineChannel("mjh-cricketgold-fast", "Cricket Gold", "Au", "https://i.mjh.nz/.r/cricketgold-fast.m3u8", "https://i.mjh.nz/.images/auto-cricketgold-fast-906f03.png"),
  defineChannel("mjh-botchedvault-fast", "Botched VAULT", "Au", "https://i.mjh.nz/.r/botchedvault-fast.m3u8", "https://i.mjh.nz/.images/auto-botchedvault-fast-4c6012.png"),
  defineChannel("mjh-ncis-fast", "NCIS", "Au", "https://i.mjh.nz/.r/ncis-fast.m3u8", "https://i.mjh.nz/.images/auto-ncis-fast-6f82bd.png"),
  defineChannel("mjh-cas39-fast", "24 Hours in A&E", "Au", "https://i.mjh.nz/.r/cas39-fast.m3u8", "https://i.mjh.nz/.images/auto-cas39-fast-aa22c1.png"),
  defineChannel("mjh-cas40-fast", "Million Dollar Listing VAULT", "Au", "https://i.mjh.nz/.r/cas40-fast.m3u8", "https://i.mjh.nz/.images/auto-cas40-fast-0b72b7.png"),
  defineChannel("mjh-cas41-fast", "Bondi Rescue", "Au", "https://i.mjh.nz/.r/cas41-fast.m3u8", "https://i.mjh.nz/.images/auto-cas41-fast-a6b151.png"),
  defineChannel("mjh-seinfeld-fast", "Seinfeld", "Au", "https://i.mjh.nz/.r/seinfeld-fast.m3u8", "https://imageresizer.static9.net.au/yKlUxIHgYC5cpCmL1DYpRCQ6w4o=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2024%2F04%2F585342%2Fgroup-61657.png"),
  defineChannel("mjh-9crime-fast", "9Crime", "Au", "https://i.mjh.nz/.r/9crime-fast.m3u8", "https://imageresizer.static9.net.au/OwBWBtMcLMF5vBP09k6w4LneJQM=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2024%2F04%2F585343%2Fgroup-61566.png"),
  defineChannel("mjh-the-block-247-fast", "The Block 24/7", "Au", "https://i.mjh.nz/.r/the-block-247-fast.m3u8", "https://imageresizer.static9.net.au/Mj-NaVq7oZgtzt2bf55lkLIfyuQ=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2024%2F08%2F623508%2Ftheblock_squircle.png"),
  defineChannel("mjh-taronga-247-fast", "Taronga 24/7", "Au", "https://i.mjh.nz/.r/taronga-247-fast.m3u8", "https://imageresizer.static9.net.au/HvEyaXfq57tpzSGiLjqejGDiyA8=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2026%2F06%2F779914%2Ftaronga_squircle.png"),
  defineChannel("mjh-bbc-news-fast", "BBC News", "Au", "https://i.mjh.nz/.r/bbc-news-fast.m3u8", "https://imageresizer.static9.net.au/85c0UKHMSSRPXJ2MJ2PXqvUcXok=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2026%2F03%2F763537%2Fbbc_squircle.png"),
  defineChannel("mjh-9mysteryparanormal-fast", "9Mystery&Paranormal", "Au", "https://i.mjh.nz/.r/9mysteryparanormal-fast.m3u8", "https://imageresizer.static9.net.au/1l9r5t0Fkyry61l_5eKpIxtv0SE=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2025%2F04%2F685323%2Fmp_squircle.png"),
  defineChannel("mjh-married-at-first-sight-fast", "Married At First Sight", "Au", "https://i.mjh.nz/.r/married-at-first-sight-fast.m3u8", "https://imageresizer.static9.net.au/OCF69HZLp4AWm0cGB8bvgx4U8mQ=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2024%2F04%2F585176%2Fsquircle_mafs.png"),
  defineChannel("mjh-bbc-top-gear-247-fast", "BBC Top Gear", "Au", "https://i.mjh.nz/.r/bbc-top-gear-247-fast.m3u8", "https://imageresizer.static9.net.au/anIncnAgaLBmeroZtHqBIXHpW6c=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2024%2F11%2F648316%2Fgroup-61773.png"),
  defineChannel("mjh-dance-moms-247-fast", "Dance Moms 24/7", "Au", "https://i.mjh.nz/.r/dance-moms-247-fast.m3u8", "https://imageresizer.static9.net.au/OKBRw5HKp9hAAVX3XM-A1HrVRug=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2024%2F04%2F585178%2Fsquircle_dancemoms.png"),
  defineChannel("mjh-lmn-fast", "LMN", "Au", "https://i.mjh.nz/.r/lmn-fast.m3u8", "https://imageresizer.static9.net.au/GfA3WNoMOfZbJOqJeq-UrX5nsdk=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2024%2F12%2F658518%2Fgroup-61484.png"),
  defineChannel("mjh-real-emergency-fast", "Real Emergency", "Au", "https://i.mjh.nz/.r/real-emergency-fast.m3u8", "https://imageresizer.static9.net.au/mEHWZZQZMecm6LaCcdOvOqgSn0Q=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2025%2F10%2F726130%2Frealemergencysquircle.png"),
  defineChannel("mjh-h2-fast", "H2", "Au", "https://i.mjh.nz/.r/h2-fast.m3u8", "https://imageresizer.static9.net.au/OxADVUkSO8Xp2ATCSJmMsa0gcDE=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2025%2F04%2F684622%2Fh2_squircle.png"),
  defineChannel("mjh-60-minutes-australia-fast", "60 Minutes Australia", "Au", "https://i.mjh.nz/.r/60-minutes-australia-fast.m3u8", "https://imageresizer.static9.net.au/kufGcZyXI7lNm32WrMV86xPNAnk=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2024%2F04%2F585173%2Fsquircle_60mins.png"),
  defineChannel("mjh-bbc-antiques-roadshow-247-fast", "BBC Antiques Roadshow", "Au", "https://i.mjh.nz/.r/bbc-antiques-roadshow-247-fast.m3u8", "https://imageresizer.static9.net.au/zRjEXK-6iFh-92EKnAZN9rXREkA=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2024%2F11%2F648315%2Fgroup-61774.png"),
  defineChannel("mjh-bbc-comedy-fast", "BBC Comedy", "Au", "https://i.mjh.nz/.r/bbc-comedy-fast.m3u8", "https://imageresizer.static9.net.au/2bl6ZyviwjpHCeVoXf8twpEVFjo=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2024%2F11%2F648314%2Fgroup-61772.png"),
  defineChannel("mjh-bbc-home-garden-fast", "BBC Home & Garden", "Au", "https://i.mjh.nz/.r/bbc-home-garden-fast.m3u8", "https://imageresizer.static9.net.au/RHsGPvwhtEktqfW-Tg4ygRMy1ug=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2024%2F11%2F648313%2Fgroup-61771.png"),
  defineChannel("mjh-bbc-food-fast", "BBC Food", "Au", "https://i.mjh.nz/.r/bbc-food-fast.m3u8", "https://imageresizer.static9.net.au/fsW8mo_8BA8nztvHgpodxtSmcjo=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2024%2F12%2F652517%2Fgroup-61812.png"),
  defineChannel("mjh-wnbl-202627-fast", "WNBL 2026/27", "Au", "https://i.mjh.nz/.r/wnbl-202627-fast.m3u8", "https://imageresizer.static9.net.au/SBz7DKoMTTXJvmj-XGrjU093es0=/768x0/https%3A%2F%2Fvms-tv-images-prod.s3-ap-southeast-2.amazonaws.com%2F2026%2F10%2F800206%2Fwnbl_squircle.png"),
  defineChannel("mjh-sbs-sbst", "SBS", "Au", "https://i.mjh.nz/.r/sbs-sbst.m3u8", "https://image.pr.sbsod.com/b073959a-a63e-5b6a-a05a-157d615a4b8c", 30),
  defineChannel("mjh-sbs-2syd", "SBS2", "Au", "https://i.mjh.nz/.r/sbs-2syd.m3u8", "https://image.pr.sbsod.com/e7f27bb4-4672-599e-b9b4-a72cfdd8d3ba", 31),
  defineChannel("mjh-sbs-3syd", "SBS Food", "Au", "https://i.mjh.nz/.r/sbs-3syd.m3u8", "https://image.pr.sbsod.com/336c48bb-129d-5348-9d2f-63ab4fe6d493", 33),
  defineChannel("mjh-sbs-5nsw", "NITV", "Au", "https://i.mjh.nz/.r/sbs-5nsw.m3u8", "https://image.pr.sbsod.com/00ff96cd-68c3-5219-b792-c0c2faec1fe6", 34),
  defineChannel("mjh-sbs-4syd", "SBS World Movies", "Au", "https://i.mjh.nz/.r/sbs-4syd.m3u8", "https://image.pr.sbsod.com/cc42ae9e-0e64-5bc3-8c71-6f23f42610fb", 32),
  defineChannel("mjh-sbs-sb04", "Koori Knockout", "Au", "https://i.mjh.nz/.r/sbs-sb04.m3u8", "https://image.pr.sbsod.com/241574b9-51a2-55a5-bef8-a555021dd833"),
  defineChannel("mjh-sbs-france24", "France 24", "Au", "https://i.mjh.nz/.r/sbs-france24.m3u8", "https://image.pr.sbsod.com/940bda61-531e-5e30-bb1e-69db1cdbb077"),
  defineChannel("mjh-sbs-euronews", "euronews", "Au", "https://i.mjh.nz/.r/sbs-euronews.m3u8", "https://image.pr.sbsod.com/60e599d9-82ed-5eac-b51c-7c23a9bb0c55"),
  defineChannel("mjh-sbs-sb02", "Insight", "Au", "https://i.mjh.nz/.r/sbs-sb02.m3u8", "https://image.pr.sbsod.com/ac68f57a-4655-5dc2-b17e-2ca3505e5e6c"),
  defineChannel("mjh-sbs-sb03", "Dateline", "Au", "https://i.mjh.nz/.r/sbs-sb03.m3u8", "https://image.pr.sbsod.com/8664060f-f5f6-598d-8d6a-8f7f59bc91c1"),
  defineChannel("mjh-sbs-sysdata_s_p_a_fifa_6", "FIFA+", "Au", "https://i.mjh.nz/.r/sbs-sysdata_s_p_a_fifa_6.m3u8", "https://image.pr.sbsod.com/82e2f8e9-238d-599f-84e7-891a54026c9f"),
  defineChannel("mjh-sbs-sb01", "The Cook Up", "Au", "https://i.mjh.nz/.r/sbs-sb01.m3u8", "https://image.pr.sbsod.com/82c5d9dc-bda6-5a6b-affa-67f1ba01ff38"),
  defineChannel("mjh-sbs-7faa", "Planet Luke Nguyen", "Au", "https://i.mjh.nz/.r/sbs-7faa.m3u8", "https://image.pr.sbsod.com/6c1ccae0-2ddb-5e67-ae24-a4e42f23b2a0"),
  defineChannel("mjh-sbs-sbs-chill", "SBS Chill", "Au", "https://i.mjh.nz/.r/sbs-sbs-chill.m3u8", "https://image.pr.sbsod.com/e7673a4d-8596-5b98-8ed8-04ff7038b458", 306),
  defineChannel("mjh-sbs-sbs-pop-asia", "SBS PopAsia", "Au", "https://i.mjh.nz/.r/sbs-sbs-pop-asia.m3u8", "https://image.pr.sbsod.com/bc85a376-7433-5d0b-9ba8-2b97a744d61b", 307),
  defineChannel("mjh-sbs-sbs-pop-desi", "SBS South Asian", "Au", "https://i.mjh.nz/.r/sbs-sbs-pop-desi.m3u8", "https://image.pr.sbsod.com/4d5e3445-4705-5d55-81cf-3fc64a3ec2ff", 305),
  defineChannel("mjh-sbs-sbs-pop-araby", "SBS Arabic", "Au", "https://i.mjh.nz/.r/sbs-sbs-pop-araby.m3u8", "https://image.pr.sbsod.com/37ad5c21-7dc4-55a9-bfab-0e6d1d8ebcb3", 304),
  defineChannel("mjh-sbs-sbs-radio-1", "SBS Radio 1", "Au", "https://i.mjh.nz/.r/sbs-sbs-radio-1.m3u8", "https://image.pr.sbsod.com/084f19c8-f6dc-5124-a06a-ebcaf8ef38c6", 301),
  defineChannel("mjh-sbs-sbs-radio-2", "SBS Radio 2", "Au", "https://i.mjh.nz/.r/sbs-sbs-radio-2.m3u8", "https://image.pr.sbsod.com/7d5749f1-254e-57ca-923d-2b2b1b33821f", 302),
  defineChannel("mjh-sbs-sbs-radio-3", "SBS Radio 3", "Au", "https://i.mjh.nz/.r/sbs-sbs-radio-3.m3u8", "https://image.pr.sbsod.com/30724f75-f20c-512c-9108-cda06930de39", 303),
  defineChannel("mjh-sbs-sbs-radio-4", "SBS Radio 4", "Au", "https://i.mjh.nz/.r/sbs-sbs-radio-4.m3u8", "https://image.pr.sbsod.com/a976dde8-b9e1-5fa1-ac7c-d8431839b02f", 304),
  defineChannel("mjh-abc-kids", "ABC Kids", "Au", "https://c.mjh.nz/abc-kids.m3u8", "https://i.mjh.nz/.images/abc-kids.png", 22),
  defineChannel("mjh-abc-tv-plus", "ABC Family", "Au", "https://c.mjh.nz/abc-tv-plus.m3u8", "https://cdn.iview.abc.net.au/thumbs/256/7_Family_C-1053_iview_LivestreamOff_2000x2000_new.png", 22),
  defineChannel("mjh-abc-me", "ABC Entertains", "Au", "https://c.mjh.nz/abc-me.m3u8", "https://cdn.iview.abc.net.au/thumbs/256/6_Entertains_C-1054_iview_LivestreamOn_2000x2000_new.png", 23),
  defineChannel("mjh-abc-news", "ABC NEWS", "Au", "https://c.mjh.nz/abc-news.m3u8", "https://i.mjh.nz/.images/abc-news.png", 24),
  defineChannel("mjh-abc-90-seconds-news", "ABC News in 90 Seconds", "Au", "https://c.mjh.nz/news_in_90_seconds", "https://live-production.wcms.abc-cdn.net.au/144a0dacebeb9f616c1fcd637e3b2cf2?impolicy=wcms_crop_resize&cropH=630&cropW=1119&xPos=10&yPos=0&width=862&height=485"),
  defineChannel("mjh-abc-90-seconds-business", "ABC Business in 90 Seconds", "Au", "https://c.mjh.nz/business_in_90_seconds", "https://live-production.wcms.abc-cdn.net.au/ae76d32898cca0be596b7f23c1bd41f2?impolicy=wcms_crop_resize&cropH=630&cropW=1119&xPos=10&yPos=0&width=862&height=485"),
  defineChannel("mjh-abc-90-seconds-sport", "ABC Sport in 90 Seconds", "Au", "https://c.mjh.nz/sport_in_90_seconds", "https://live-production.wcms.abc-cdn.net.au/646cb8a032c847ec21c3de0de881e4cb?impolicy=wcms_crop_resize&cropH=630&cropW=1119&xPos=10&yPos=0&width=862&height=485"),
  defineChannel("mjh-abc-90-seconds-weather", "ABC Weather in 90 Seconds", "Au", "https://c.mjh.nz/weather_in_90_seconds", "https://live-production.wcms.abc-cdn.net.au/d376e49724862f104d044ff6467f85d8?impolicy=wcms_crop_resize&cropH=630&cropW=1119&xPos=10&yPos=0&width=862&height=485"),
  defineChannel("mjh-sky-racing-1", "Sky Racing #1", "Au", "https://i.mjh.nz/.r/sky-racing-1.m3u8", "https://i.mjh.nz/.images/sky-racing-1.png"),
  defineChannel("mjh-sky-racing-2", "Sky Racing #2", "Au", "https://i.mjh.nz/.r/sky-racing-2.m3u8", "https://i.mjh.nz/.images/sky-racing-2.png"),
  defineChannel("mjh-sky-racing-thoroughbred", "Sky Racing - Thoroughbred Central", "Au", "https://i.mjh.nz/.r/sky-racing-thoroughbred.m3u8", "https://i.mjh.nz/.images/sky-racing-thoroughbred.png"),
  defineChannel("mjh-bloomberg-tv", "Bloomberg TV", "Au", "https://i.mjh.nz/.r/bloomberg-tv.m3u8", "https://i.mjh.nz/.images/bloomberg-tv.png"),
  defineChannel("mjh-sky-news-now", "Sky News Now", "Au", "https://i.mjh.nz/.r/sky-news-now.m3u8", "https://i.mjh.nz/.images/sky-news-now.png"),
  defineChannel("mjh-good-dot", "GOOD.", "Au", "https://c.mjh.nz/good-dot.m3u8", "https://i.mjh.nz/.images/good-dot.png"),
  defineChannel("mjh-bbc-news", "BBC News", "Au", "https://i.mjh.nz/.r/bbc-news.m3u8", "https://i.mjh.nz/.images/bbc-news.png"),
  defineChannel("mjh-redbull-tv", "Redbull TV", "World", "https://i.mjh.nz/.r/redbull-tv.m3u8", "https://i.mjh.nz/.images/redbull-tv.png"),
  defineChannel("mjh-channel-news-asia", "Channel News Asia (CNA)", "World", "https://i.mjh.nz/.r/channel-news-asia.m3u8", "https://i.mjh.nz/.images/channel-news-asia.png"),
  defineChannel("mjh-dw-news", "DW English", "World", "https://i.mjh.nz/.r/dw-news.m3u8", "https://www.dw.com/images/icons/favicon-540x540.png"),
];
// ============================================================
// 1. SECURITY & SANITIZATION UTILITIES
// ============================================================

/**
 * Strips HTML tags, control chars, and zero-width spoofing characters.
 */
export function sanitizeChannelText(raw: string, maxLen = 60): string {
  return String(raw || "")
    .replace(/[\u200B-\u200D\uFEFF\x00-\x1F\x7F<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

/**
 * Detects private/loopback/link-local IPv4 & IPv6 hosts to prevent SSRF or
 * accidental local-router probing from untrusted M3U playlists.
 */
function isPrivateOrLocalHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    !host ||
    host === "localhost" ||
    host === "::1" ||
    host === "0.0.0.0" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.startsWith("fe80:") ||
    host.startsWith("fc") ||
    host.startsWith("fd")
  ) {
    return true;
  }
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const a = Number(ipv4[1]);
    const b = Number(ipv4[2]);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true; // link-local / metadata
    if (a === 192 && b === 168) return true; // LAN
    if (a === 172 && b >= 16 && b <= 31) return true; // private RFC1918
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  }
  return false;
}

/**
 * Hardened stream URL validator:
 * - Only allows http:// or https://
 * - Rejects embedded username:password credentials, control chars, & oversized URLs
 * - Blocks private LAN/loopback SSRF targets by default (opt-in via `allowLocalLan`)
 * - Blocks known ad/popunder redirect domains
 */
export function isSafeStreamUrl(
  rawUrl: string,
  options?: { allowLocalLan?: boolean }
): boolean {
  if (!rawUrl || typeof rawUrl !== "string") return false;
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.length > MAX_URL_LENGTH) return false;
  if (/[\x00-\x1F\x7F\s]/.test(trimmed)) return false;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return false;
    }
    if (parsed.username || parsed.password) {
      return false;
    }
    const host = parsed.hostname.toLowerCase();
    if (!host) return false;
    if (!options?.allowLocalLan && isPrivateOrLocalHostname(host)) {
      return false;
    }
    if (BLOCKED_STREAM_HOST_FRAGMENTS.some((bad) => host.includes(bad))) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function isDrmProtectedChannel(service: LiveFeedService): boolean {
  return Boolean(
    service.licenseKey ||
      service.licenseType ||
      service.manifestType === "mpd" ||
      (service.url || "").toLowerCase().endsWith(".mpd")
  );
}

export function isChannelKidsSafe(channelName: string): boolean {
  const lower = String(channelName || "").toLowerCase();
  return !MATURE_LIVE_KEYWORDS.some((kw) => lower.includes(kw));
}

function isKidsFilterActive(): boolean {
  return getKidsModeLocked() || getSavedUserAge() < 13;
}

/** Normalizes a channel title for cross-region mirror matching & deduplication */
function normalizeChannelBaseName(name: string): string {
  return String(name || "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, "") // strip "(Gold Coast)", "(Newcastle)", etc.
    .replace(/\b(regional|syd|mel|bri|per|ade|hob|nsw|vic|qld|wa|sa|tas|act|nt|cns|mky|ssc|rky|twb|tsv|wby|fast|24\/7|hd)\b/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

// ============================================================
// 2. QUOTA-SAFE STORAGE & IN-MEMORY MEMOIZATION ENGINE
// ============================================================

function safeWriteStorage(key: string, payload: unknown): boolean {
  if (typeof window === "undefined") return false;
  const serialized = JSON.stringify(payload);
  try {
    localStorage.setItem(key, serialized);
    return true;
  } catch {
    try {
      purgeOldTmdbCaches();
      localStorage.setItem(key, serialized);
      return true;
    } catch {
      return false;
    }
  }
}

function dispatchLiveEvent(eventName: string): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(eventName));
  }
}

// Memoized indexes so lookups & filtering run in O(1) with zero repeated JSON.parse
let customChannelsMem: LiveFeedService[] | null = null;
let hiddenIdsMem: Set<string> | null = null;
let mergedServicesMem: LiveFeedService[] | null = null;
let byIdIndexMem: Map<string, LiveFeedService> | null = null;
let byUrlIndexMem: Map<string, LiveFeedService> | null = null;
let byBaseNameIndexMem: Map<string, LiveFeedService[]> | null = null;
let searchTokensMem: Map<string, string> | null = null;

function invalidateCatalogCache(): void {
  mergedServicesMem = null;
  byIdIndexMem = null;
  byUrlIndexMem = null;
  byBaseNameIndexMem = null;
  searchTokensMem = null;
}

function ensureCatalogIndexes(): void {
  if (mergedServicesMem && byIdIndexMem && byUrlIndexMem && byBaseNameIndexMem) {
    return;
  }

  const remote = loadCachedRemoteOverrides();
  const custom = getCustomLiveChannels();

  const map = new Map<string, LiveFeedService>();
  for (const s of liveFeedServices) {
    map.set(s.channelId, s);
  }
  for (const r of remote) {
    if (r.disabled) {
      map.delete(r.channelId);
    } else {
      const prev = map.get(r.channelId);
      map.set(r.channelId, prev ? { ...prev, ...r } : r);
    }
  }
  for (const c of custom) {
    map.set(c.channelId, c);
  }

  const merged = Array.from(map.values());
  const byId = new Map<string, LiveFeedService>();
  const byUrl = new Map<string, LiveFeedService>();
  const byBase = new Map<string, LiveFeedService[]>();
  const tokens = new Map<string, string>();

  for (const s of merged) {
    byId.set(s.channelId, s);
    byUrl.set(s.url, s);

    const baseKey = normalizeChannelBaseName(s.name);
    if (baseKey) {
      const group = byBase.get(baseKey);
      if (group) group.push(s);
      else byBase.set(baseKey, [s]);
    }

    tokens.set(
      s.channelId,
      `${s.name} ${s.groupTitle} ${s.channelNumber ?? ""} ${getChannelCategory(s.name)}`.toLowerCase()
    );
  }

  mergedServicesMem = merged;
  byIdIndexMem = byId;
  byUrlIndexMem = byUrl;
  byBaseNameIndexMem = byBase;
  searchTokensMem = tokens;
}

// ============================================================
// 3. HIDDEN / BLOCKED CHANNELS MANAGEMENT
// ============================================================

export function getHiddenLiveChannelIds(): string[] {
  if (hiddenIdsMem) return Array.from(hiddenIdsMem);
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HIDDEN_CHANNELS_KEY);
    if (!raw) {
      hiddenIdsMem = new Set();
      return [];
    }
    const parsed = JSON.parse(raw);
    hiddenIdsMem = new Set(
      Array.isArray(parsed)
        ? parsed.filter((x): x is string => typeof x === "string" && x.length > 0)
        : []
    );
    return Array.from(hiddenIdsMem);
  } catch {
    hiddenIdsMem = new Set();
    return [];
  }
}

export function isLiveChannelHidden(channelId: string): boolean {
  if (!hiddenIdsMem) getHiddenLiveChannelIds();
  return hiddenIdsMem ? hiddenIdsMem.has(channelId) : false;
}

export function hideLiveChannel(channelId: string): void {
  const cleanId = String(channelId || "").trim();
  if (!cleanId) return;
  if (!hiddenIdsMem) getHiddenLiveChannelIds();
  hiddenIdsMem!.add(cleanId);
  safeWriteStorage(HIDDEN_CHANNELS_KEY, Array.from(hiddenIdsMem!));
  dispatchLiveEvent(LIVE_CATALOG_UPDATED_EVENT);
}

export function unhideLiveChannel(channelId: string): void {
  const cleanId = String(channelId || "").trim();
  if (!cleanId) return;
  if (!hiddenIdsMem) getHiddenLiveChannelIds();
  if (hiddenIdsMem!.delete(cleanId)) {
    safeWriteStorage(HIDDEN_CHANNELS_KEY, Array.from(hiddenIdsMem!));
    dispatchLiveEvent(LIVE_CATALOG_UPDATED_EVENT);
  }
}

export function clearHiddenLiveChannels(): void {
  hiddenIdsMem = new Set();
  if (typeof window !== "undefined") {
    localStorage.removeItem(HIDDEN_CHANNELS_KEY);
  }
  dispatchLiveEvent(LIVE_CATALOG_UPDATED_EVENT);
}

// ============================================================
// 4. CUSTOM USER CHANNELS & M3U PLAYLIST IMPORT / EXPORT
// ============================================================

export function getCustomLiveChannels(): LiveFeedService[] {
  if (customChannelsMem) return customChannelsMem;
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CUSTOM_CHANNELS_KEY);
    if (!raw) {
      customChannelsMem = [];
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      customChannelsMem = [];
      return [];
    }
    customChannelsMem = parsed
      .filter(
        (item: any) =>
          item &&
          typeof item.name === "string" &&
          isSafeStreamUrl(item.url, { allowLocalLan: true })
      )
      .map((item: any) => ({
        ...item,
        name: sanitizeChannelText(item.name, 50) || "Custom Channel",
        groupTitle: sanitizeChannelText(item.groupTitle || "Custom", 25) || "Custom",
        isCustom: true,
        userAgent: item.userAgent || DEFAULT_LIVE_UA,
        referrer: item.referrer || "",
      }))
      .slice(0, MAX_CUSTOM_CHANNELS);
    return customChannelsMem;
  } catch {
    customChannelsMem = [];
    return [];
  }
}

export function addCustomLiveChannel(input: {
  name: string;
  url: string;
  groupTitle?: string;
  logo?: string;
  channelNumber?: number;
  allowLocalLan?: boolean;
}): { ok: boolean; error?: string; channel?: LiveFeedService } {
  const cleanName = sanitizeChannelText(input.name, 50);
  const cleanUrl = String(input.url || "").trim();

  if (cleanName.length < 2) {
    return { ok: false, error: "Channel name must be at least 2 characters." };
  }
  if (!isSafeStreamUrl(cleanUrl, { allowLocalLan: input.allowLocalLan })) {
    return {
      ok: false,
      error: "Stream URL must be a valid public http:// or https:// link.",
    };
  }

  const existing = getCustomLiveChannels();
  if (existing.some((c) => c.url === cleanUrl)) {
    return { ok: false, error: "This stream URL is already in your custom list." };
  }
  if (existing.length >= MAX_CUSTOM_CHANNELS) {
    return {
      ok: false,
      error: `Maximum of ${MAX_CUSTOM_CHANNELS} custom channels reached.`,
    };
  }

  const safeLogo =
    input.logo && isSafeStreamUrl(input.logo) ? input.logo.trim() : undefined;
  const cleanGroup = sanitizeChannelText(input.groupTitle || "Custom", 25) || "Custom";

  const newChannel: LiveFeedService = defineChannel(
    `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    cleanName,
    cleanGroup,
    cleanUrl,
    safeLogo,
    input.channelNumber,
    { isCustom: true }
  );

  const next = [newChannel, ...existing];
  customChannelsMem = next;
  safeWriteStorage(CUSTOM_CHANNELS_KEY, next);
  invalidateCatalogCache();
  dispatchLiveEvent(LIVE_CATALOG_UPDATED_EVENT);
  return { ok: true, channel: newChannel };
}

export function updateCustomLiveChannel(
  channelId: string,
  updates: Partial<Pick<LiveFeedService, "name" | "url" | "groupTitle" | "logo" | "channelNumber">>
): { ok: boolean; error?: string } {
  const existing = getCustomLiveChannels();
  const idx = existing.findIndex((c) => c.channelId === channelId);
  if (idx === -1) return { ok: false, error: "Custom channel not found." };

  const current = existing[idx];
  const nextName =
    updates.name !== undefined
      ? sanitizeChannelText(updates.name, 50)
      : current.name;
  const nextUrl =
    updates.url !== undefined ? String(updates.url).trim() : current.url;

  if (nextName.length < 2) {
    return { ok: false, error: "Channel name must be at least 2 characters." };
  }
  if (!isSafeStreamUrl(nextUrl, { allowLocalLan: true })) {
    return { ok: false, error: "Stream URL is not valid." };
  }

  const updated: LiveFeedService = {
    ...current,
    name: nextName,
    url: nextUrl,
    groupTitle:
      updates.groupTitle !== undefined
        ? sanitizeChannelText(updates.groupTitle, 25) || "Custom"
        : current.groupTitle,
    logo:
      updates.logo !== undefined
        ? isSafeStreamUrl(updates.logo)
          ? updates.logo.trim()
          : undefined
        : current.logo,
    channelNumber:
      updates.channelNumber !== undefined
        ? updates.channelNumber
        : current.channelNumber,
  };

  const next = [...existing];
  next[idx] = updated;
  customChannelsMem = next;
  safeWriteStorage(CUSTOM_CHANNELS_KEY, next);
  invalidateCatalogCache();
  dispatchLiveEvent(LIVE_CATALOG_UPDATED_EVENT);
  return { ok: true };
}

export function removeCustomLiveChannel(channelId: string): boolean {
  const existing = getCustomLiveChannels();
  const next = existing.filter((c) => c.channelId !== channelId);
  if (next.length === existing.length) return false;
  customChannelsMem = next;
  safeWriteStorage(CUSTOM_CHANNELS_KEY, next);
  invalidateCatalogCache();
  dispatchLiveEvent(LIVE_CATALOG_UPDATED_EVENT);
  return true;
}

export function clearCustomLiveChannels(): void {
  customChannelsMem = [];
  if (typeof window !== "undefined") {
    localStorage.removeItem(CUSTOM_CHANNELS_KEY);
  }
  invalidateCatalogCache();
  dispatchLiveEvent(LIVE_CATALOG_UPDATED_EVENT);
}

/**
 * Hardened M3U/M3U8 playlist parser with size & line caps to protect 1-2GB TVs.
 */
export function parseM3uPlaylist(
  rawText: string,
  options?: { allowLocalLan?: boolean }
): LiveFeedService[] {
  const safeText = String(rawText || "").slice(0, MAX_M3U_BYTES);
  const lines = safeText
    .split(/\r?\n/)
    .slice(0, MAX_M3U_LINES)
    .map((l) => l.trim())
    .filter(Boolean);

  const parsed: LiveFeedService[] = [];
  const seenUrls = new Set<string>();
  let pendingMeta: {
    name: string;
    logo?: string;
    groupTitle: string;
    channelNumber?: number;
  } | null = null;

  for (const line of lines) {
    if (line.startsWith("#EXTINF:")) {
      const logoMatch = line.match(/tvg-logo="([^"]+)"/i);
      const groupMatch = line.match(/group-title="([^"]+)"/i);
      const numMatch = line.match(/tvg-chno="(\d+)"/i);
      const commaIdx = line.lastIndexOf(",");
      const rawTitle =
        commaIdx >= 0 ? line.slice(commaIdx + 1).trim() : "Custom Channel";

      pendingMeta = {
        name: sanitizeChannelText(rawTitle, 50) || "Custom Channel",
        logo:
          logoMatch?.[1] && isSafeStreamUrl(logoMatch[1])
            ? logoMatch[1].trim()
            : undefined,
        groupTitle:
          sanitizeChannelText(groupMatch?.[1] || "Custom", 25) || "Custom",
        channelNumber: numMatch?.[1] ? parseInt(numMatch[1], 10) : undefined,
      };
    } else if (!line.startsWith("#")) {
      if (
        !seenUrls.has(line) &&
        isSafeStreamUrl(line, { allowLocalLan: options?.allowLocalLan })
      ) {
        seenUrls.add(line);
        const meta = pendingMeta || {
          name: `Channel ${parsed.length + 1}`,
          groupTitle: "Custom",
        };
        parsed.push(
          defineChannel(
            `m3u-${parsed.length + 1}-${Date.now().toString(36)}`,
            meta.name,
            meta.groupTitle,
            line,
            meta.logo,
            meta.channelNumber,
            { isCustom: true }
          )
        );
      }
      pendingMeta = null;
      if (parsed.length >= MAX_CUSTOM_CHANNELS) break;
    }
  }
  return parsed;
}

/**
 * One-call M3U importer: parses, validates, deduplicates against existing custom
 * channels, enforces capacity limits, and saves cleanly.
 */
export function importM3uPlaylist(
  rawText: string,
  options?: { allowLocalLan?: boolean }
): M3uImportResult {
  if (!rawText || typeof rawText !== "string" || !rawText.trim()) {
    return {
      ok: false,
      added: 0,
      skipped: 0,
      blocked: 0,
      totalCustom: getCustomLiveChannels().length,
      error: "Playlist text is empty.",
    };
  }

  const rawUrlsCount = rawText
    .slice(0, MAX_M3U_BYTES)
    .split(/\r?\n/)
    .slice(0, MAX_M3U_LINES)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#")).length;

  const parsed = parseM3uPlaylist(rawText, options);
  const blocked = Math.max(0, rawUrlsCount - parsed.length);

  const existing = getCustomLiveChannels();
  const existingUrls = new Set(existing.map((c) => c.url));
  const merged = [...existing];
  let added = 0;
  let skipped = 0;

  for (const ch of parsed) {
    if (merged.length >= MAX_CUSTOM_CHANNELS) {
      skipped++;
      continue;
    }
    if (existingUrls.has(ch.url)) {
      skipped++;
      continue;
    }
    existingUrls.add(ch.url);
    merged.unshift(ch);
    added++;
  }

  if (added > 0) {
    customChannelsMem = merged;
    safeWriteStorage(CUSTOM_CHANNELS_KEY, merged);
    invalidateCatalogCache();
    dispatchLiveEvent(LIVE_CATALOG_UPDATED_EVENT);
  }

  return {
    ok: added > 0 || skipped > 0,
    added,
    skipped,
    blocked,
    totalCustom: merged.length,
    error:
      added === 0 && skipped === 0
        ? "No valid public stream URLs were found in that playlist."
        : undefined,
  };
}

/**
 * Exports either Custom Channels or the Full Catalog as a standard #EXTM3U string.
 */
export function exportChannelsAsM3u(scope: "custom" | "all" = "custom"): string {
  const list =
    scope === "all" ? getMergedLiveServices() : getCustomLiveChannels();
  const out: string[] = ["#EXTM3U"];
  for (const ch of list) {
    const attrs: string[] = [];
    if (ch.channelId) attrs.push(`tvg-id="${ch.channelId.replace(/"/g, "")}"`);
    if (ch.channelNumber !== undefined) attrs.push(`tvg-chno="${ch.channelNumber}"`);
    if (ch.logo) attrs.push(`tvg-logo="${ch.logo.replace(/"/g, "")}"`);
    if (ch.groupTitle) attrs.push(`group-title="${ch.groupTitle.replace(/"/g, "")}"`);
    out.push(`#EXTINF:-1 ${attrs.join(" ")},${ch.name}`);
    out.push(ch.url);
  }
  return out.join("\n");
}

// ============================================================
// 5. OVER-THE-AIR REMOTE GIST OVERRIDES (SINGLE-FLIGHT LOCKED)
// ============================================================

interface RemoteOverrideCache {
  fetchedAt: number;
  channels: LiveFeedService[];
}

let remoteOverridesMem: RemoteOverrideCache | null = null;
let remoteSyncInFlight: Promise<LiveFeedService[]> | null = null;

function loadCachedRemoteOverrides(): LiveFeedService[] {
  if (
    remoteOverridesMem &&
    Date.now() - remoteOverridesMem.fetchedAt < REMOTE_OVERRIDES_TTL_MS
  ) {
    return remoteOverridesMem.channels;
  }
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(REMOTE_OVERRIDES_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RemoteOverrideCache;
    if (
      parsed &&
      Array.isArray(parsed.channels) &&
      Date.now() - parsed.fetchedAt < REMOTE_OVERRIDES_TTL_MS
    ) {
      remoteOverridesMem = parsed;
      return parsed.channels;
    }
  } catch {
    // ignore
  }
  return [];
}

/**
 * Fetches optional `live_channels.json` from the admin Gist so broken feeds can be
 * patched or new live channels pushed over-the-air without rebuilding the APK.
 * Deduplicated via single-flight lock so concurrent mounts only fire 1 request.
 */
export async function syncRemoteChannelOverrides(
  force = false
): Promise<LiveFeedService[]> {
  if (!force) {
    const cached = loadCachedRemoteOverrides();
    if (cached.length > 0) return cached;
  }
  if (!GIST_ID || !GITHUB_TOKEN || !GIST_API_URL) return [];
  if (remoteSyncInFlight && !force) return remoteSyncInFlight;

  const task = (async () => {
    const controller = new AbortController();
    const timer =
      typeof window !== "undefined"
        ? window.setTimeout(() => controller.abort(), 5000)
        : setTimeout(() => controller.abort(), 5000);

    try {
      const res = await fetch(`${GIST_API_URL}?t=${Date.now()}`, {
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "RabbitTV-App",
        },
        signal: controller.signal,
        cache: "no-store",
      });
      if (!res.ok) return loadCachedRemoteOverrides();

      const gistData = await res.json();
      const rawContent = gistData.files?.["live_channels.json"]?.content;
      if (!rawContent) return [];

      const parsed = JSON.parse(rawContent);
      if (!Array.isArray(parsed)) return [];

      const sanitized: LiveFeedService[] = parsed
        .slice(0, MAX_REMOTE_OVERRIDES)
        .filter(
          (item: any) =>
            item &&
            typeof item.channelId === "string" &&
            (item.disabled === true || isSafeStreamUrl(item.url))
        )
        .map((item: any) => ({
          channelId: sanitizeChannelText(item.channelId, 80),
          name: sanitizeChannelText(item.name || "Live Channel", 50) || "Live Channel",
          groupTitle: sanitizeChannelText(item.groupTitle || "World", 25) || "World",
          logo:
            item.logo && isSafeStreamUrl(item.logo) ? String(item.logo).trim() : undefined,
          channelNumber:
            typeof item.channelNumber === "number"
              ? item.channelNumber
              : undefined,
          url: String(item.url || "").trim(),
          userAgent: item.userAgent || DEFAULT_LIVE_UA,
          referrer:
            item.referrer && isSafeStreamUrl(item.referrer)
              ? String(item.referrer).trim()
              : "",
          manifestType:
            item.manifestType === "mpd" || item.manifestType === "hls"
              ? item.manifestType
              : undefined,
          licenseType:
            typeof item.licenseType === "string"
              ? sanitizeChannelText(item.licenseType, 40)
              : undefined,
          licenseKey:
            item.licenseKey && isSafeStreamUrl(item.licenseKey)
              ? String(item.licenseKey).trim()
              : undefined,
          disabled: Boolean(item.disabled),
        }))
        .filter((item) => item.channelId.length > 0);

      const entry: RemoteOverrideCache = {
        fetchedAt: Date.now(),
        channels: sanitized,
      };
      remoteOverridesMem = entry;
      safeWriteStorage(REMOTE_OVERRIDES_CACHE_KEY, entry);
      invalidateCatalogCache();
      dispatchLiveEvent(LIVE_CATALOG_UPDATED_EVENT);
      return sanitized;
    } catch {
      return loadCachedRemoteOverrides();
    } finally {
      if (typeof window !== "undefined") {
        window.clearTimeout(timer as number);
      } else {
        clearTimeout(timer);
      }
      remoteSyncInFlight = null;
    }
  })();

  remoteSyncInFlight = task;
  return task;
}

/**
 * Merges Built-In Channels + Remote Gist Overrides + Local Custom Channels.
 * Backed by an in-memory cache for instant O(1) repeated calls.
 */
export function getMergedLiveServices(): LiveFeedService[] {
  ensureCatalogIndexes();
  return mergedServicesMem!;
}

// ============================================================
// 6. RELIABILITY TELEMETRY & DEAD-CHANNEL CIRCUIT BREAKER
// ============================================================

type ReliabilityMap = Record<string, ChannelReliabilityRecord>;

function loadReliabilityMap(): ReliabilityMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(RELIABILITY_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as ReliabilityMap) : {};
  } catch {
    return {};
  }
}

let reliabilityMap: ReliabilityMap = loadReliabilityMap();

function persistReliabilityMap(): void {
  // Keep storage lean on 1-2GB sticks (cap at 350 most recently updated channels)
  const entries = Object.entries(reliabilityMap)
    .sort((a, b) => (b[1]?.lastUpdatedAt || 0) - (a[1]?.lastUpdatedAt || 0))
    .slice(0, 350);
  reliabilityMap = Object.fromEntries(entries);
  safeWriteStorage(RELIABILITY_CACHE_KEY, reliabilityMap);
}

export function isChannelQuarantined(channelId: string): boolean {
  const rec = reliabilityMap[channelId];
  if (!rec?.quarantinedUntil) return false;
  if (Date.now() >= rec.quarantinedUntil) {
    rec.quarantinedUntil = undefined;
    rec.consecutiveFailures = 0;
    return false;
  }
  return true;
}

/**
 * Call when a channel successfully starts playing or passes a live health probe.
 * Clears any quarantine and updates rolling latency & reliability score.
 */
export function reportChannelPlaybackSuccess(
  channelId: string,
  latencyMs?: number
): void {
  const cleanId = String(channelId || "").trim();
  if (!cleanId) return;
  const prev = reliabilityMap[cleanId] || {
    successes: 0,
    failures: 0,
    consecutiveFailures: 0,
    avgLatencyMs: 0,
    lastUpdatedAt: 0,
  };
  const nextSuccesses = prev.successes + 1;
  const nextAvgLatency =
    typeof latencyMs === "number" && latencyMs > 0
      ? prev.avgLatencyMs > 0
        ? Math.round(prev.avgLatencyMs * 0.7 + latencyMs * 0.3)
        : Math.round(latencyMs)
      : prev.avgLatencyMs;

  reliabilityMap[cleanId] = {
    successes: nextSuccesses,
    failures: prev.failures,
    consecutiveFailures: 0,
    avgLatencyMs: nextAvgLatency,
    lastUpdatedAt: Date.now(),
    quarantinedUntil: undefined,
  };
  persistReliabilityMap();
}

/**
 * Call when a channel fails to resolve, stalls out, or errors in the player.
 * After 3 consecutive failures, the circuit breaker quarantines it for 6 hours.
 */
export function reportChannelPlaybackFailure(channelId: string): {
  quarantined: boolean;
  consecutiveFailures: number;
} {
  const cleanId = String(channelId || "").trim();
  if (!cleanId) return { quarantined: false, consecutiveFailures: 0 };

  const prev = reliabilityMap[cleanId] || {
    successes: 0,
    failures: 0,
    consecutiveFailures: 0,
    avgLatencyMs: 0,
    lastUpdatedAt: 0,
  };
  const nextConsecutive = prev.consecutiveFailures + 1;
  const shouldQuarantine = nextConsecutive >= QUARANTINE_FAILURE_THRESHOLD;

  reliabilityMap[cleanId] = {
    successes: prev.successes,
    failures: prev.failures + 1,
    consecutiveFailures: nextConsecutive,
    avgLatencyMs: prev.avgLatencyMs,
    lastUpdatedAt: Date.now(),
    quarantinedUntil: shouldQuarantine
      ? Date.now() + QUARANTINE_DURATION_MS
      : prev.quarantinedUntil,
  };
  persistReliabilityMap();

  if (shouldQuarantine) {
    healthCache[cleanId] = {
      health: "offline",
      checkedAt: Date.now(),
      latencyMs: prev.avgLatencyMs || 0,
    };
    saveHealthCache(healthCache);
    dispatchLiveEvent(LIVE_HEALTH_UPDATED_EVENT);
  }

  return {
    quarantined: shouldQuarantine,
    consecutiveFailures: nextConsecutive,
  };
}

/**
 * Computes a 0–100 reliability score using probe health, playback history, & latency.
 */
export function getChannelReliabilityScore(channelId: string): number {
  if (isChannelQuarantined(channelId)) return 5;
  const rec = reliabilityMap[channelId];
  const cached = healthCache[channelId];

  let score = 60;
  if (cached?.health === "online") score = 85;
  else if (cached?.health === "offline") score = 15;
  else if (cached?.health === "unknown") score = 55;

  if (rec) {
    const total = rec.successes + rec.failures;
    if (total > 0) {
      const rateScore = Math.round((rec.successes / total) * 100);
      score = Math.round(score * 0.45 + rateScore * 0.55);
    }
    if (rec.consecutiveFailures > 0) {
      score -= rec.consecutiveFailures * 15;
    }
  }

  const latency = cached?.latencyMs || rec?.avgLatencyMs || 0;
  if (latency > 0) {
    if (latency < 600) score += 8;
    else if (latency > 2500) score -= 10;
  }

  return Math.max(0, Math.min(100, score));
}

// ============================================================
// 7. HARDWARE-AWARE HEALTH PROBING (SINGLE-FLIGHT + HLS CHECK)
// ============================================================

type HealthCacheEntry = {
  health: ChannelHealth;
  checkedAt: number;
  latencyMs?: number;
};
type HealthCache = Record<string, HealthCacheEntry>;

function loadHealthCache(): HealthCache {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(HEALTH_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as HealthCache;
    const now = Date.now();
    const fresh: HealthCache = {};
    for (const [id, entry] of Object.entries(parsed)) {
      if (entry && now - entry.checkedAt < CACHE_TTL_MS) {
        fresh[id] = entry;
      }
    }
    return fresh;
  } catch {
    return {};
  }
}

function saveHealthCache(cache: HealthCache) {
  safeWriteStorage(HEALTH_CACHE_KEY, cache);
}

let healthCache: HealthCache = loadHealthCache();
const inFlightProbes = new Map<
  string,
  Promise<{ health: ChannelHealth; latencyMs: number }>
>();

/**
 * Probe a single stream URL with hardware-aware timeout, HLS `#EXTM3U` content
 * verification (catches soft-dead HTTP 200 HTML error pages), single-flight
 * deduplication, and optional AbortSignal cancellation.
 */
export async function probeStreamWithLatency(
  url: string,
  signal?: AbortSignal
): Promise<{ health: ChannelHealth; latencyMs: number }> {
  if (!isSafeStreamUrl(url, { allowLocalLan: true }) || signal?.aborted) {
    return { health: "offline", latencyMs: 0 };
  }

  const cleanUrl = url.trim();
  const existingPromise = inFlightProbes.get(cleanUrl);
  if (existingPromise) return existingPromise;

  const task = (async (): Promise<{
    health: ChannelHealth;
    latencyMs: number;
  }> => {
    const isLowRam = getHardwareLimits().effectiveMode === "low";
    const timeoutMs = isLowRam ? 3200 : 4500;
    const startedAt = Date.now();

    const controller = new AbortController();
    const onParentAbort = () => controller.abort();
    signal?.addEventListener("abort", onParentAbort, { once: true });

    const timer =
      typeof window !== "undefined"
        ? window.setTimeout(() => controller.abort(), timeoutMs)
        : setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(cleanUrl, {
        method: "GET",
        signal: controller.signal,
        mode: "cors",
        cache: "no-store",
        credentials: "omit",
        headers: { Range: "bytes=0-512" },
      });

      const latencyMs = Date.now() - startedAt;
      if (res.ok || res.status === 206) {
        // Verify HLS playlists aren't returning an HTML error/geo-block page
        if (cleanUrl.toLowerCase().includes(".m3u8")) {
          const contentType = (res.headers.get("content-type") || "").toLowerCase();
          if (contentType.includes("text/html")) {
            return { health: "offline", latencyMs };
          }
          try {
            const snippet = (await res.text()).slice(0, 256).trim();
            if (snippet && !snippet.startsWith("#EXTM3U") && /<!doctype|<html/i.test(snippet)) {
              return { health: "offline", latencyMs };
            }
          } catch {
            // If body can't be read, HTTP 200 is still good
          }
        }
        return { health: "online", latencyMs };
      }
      if (res.status === 401 || res.status === 403) {
        return { health: "unknown", latencyMs };
      }
      if (res.status >= 400) {
        return { health: "offline", latencyMs };
      }
      return { health: "unknown", latencyMs };
    } catch (err: any) {
      const latencyMs = Date.now() - startedAt;
      if (signal?.aborted) return { health: "checking", latencyMs };
      if (err?.name === "AbortError") return { health: "offline", latencyMs };
      if (err?.name === "TypeError") return { health: "unknown", latencyMs };
      return { health: "offline", latencyMs };
    } finally {
      signal?.removeEventListener("abort", onParentAbort);
      if (typeof window !== "undefined") {
        window.clearTimeout(timer as number);
      } else {
        clearTimeout(timer);
      }
      inFlightProbes.delete(cleanUrl);
    }
  })();

  inFlightProbes.set(cleanUrl, task);
  return task;
}

/** Backwards-compatible stream probe returning ChannelHealth */
export async function probeStream(
  url: string,
  signal?: AbortSignal
): Promise<ChannelHealth> {
  const res = await probeStreamWithLatency(url, signal);
  return res.health;
}

/** Run probes with a hardware-aware concurrency limit & AbortSignal support */
async function mapPool<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
  signal?: AbortSignal
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function run() {
    while (next < items.length) {
      if (signal?.aborted) return;
      const i = next++;
      results[i] = await worker(items[i], i);
    }
  }

  const runners = Array.from(
    { length: Math.min(Math.max(1, limit), items.length) },
    () => run()
  );
  await Promise.all(runners);
  return results;
}

/**
 * Enrich channels with health status & latency using memory cache to avoid re-probing.
 * Persists progress in batches of 15 so navigating away never loses scan progress.
 */
export async function enrichChannelsWithHealth(
  channels: LiveChannel[],
  options?: {
    force?: boolean;
    signal?: AbortSignal;
    onProgress?: (done: number, total: number) => void;
  }
): Promise<LiveChannel[]> {
  const now = Date.now();
  const force = options?.force === true;
  const concurrency = getHardwareLimits().effectiveMode === "low" ? 4 : 8;

  const needsProbe = channels.filter((ch) => {
    if (force) return true;
    if (isChannelQuarantined(ch.channelId)) return false;
    const cached = healthCache[ch.channelId];
    return !cached || now - cached.checkedAt >= CACHE_TTL_MS;
  });

  if (needsProbe.length > 0 && !options?.signal?.aborted) {
    let completed = 0;
    await mapPool(
      needsProbe,
      concurrency,
      async (ch) => {
        const res = await probeStreamWithLatency(
          ch.url || ch.streamUrl,
          options?.signal
        );
        if (!options?.signal?.aborted) {
          healthCache[ch.channelId] = {
            health: res.health,
            checkedAt: Date.now(),
            latencyMs: res.latencyMs,
          };
          if (res.health === "online") {
            reportChannelPlaybackSuccess(ch.channelId, res.latencyMs);
          }
          completed++;
          if (completed % 15 === 0) {
            saveHealthCache(healthCache);
          }
          options?.onProgress?.(completed, needsProbe.length);
        }
        return res.health;
      },
      options?.signal
    );
    saveHealthCache(healthCache);
    dispatchLiveEvent(LIVE_HEALTH_UPDATED_EVENT);
  }

  return channels.map((ch) => {
    const entry = healthCache[ch.channelId];
    const quarantined = isChannelQuarantined(ch.channelId);
    return {
      ...ch,
      health: quarantined ? "offline" : entry?.health ?? "unknown",
      healthCheckedAt: entry?.checkedAt,
      latencyMs: entry?.latencyMs,
      isQuarantined: quarantined,
      reliabilityScore: getChannelReliabilityScore(ch.channelId),
    };
  });
}

/** Drop offline, quarantined, unknown, or checking channels — only keep online channels */
export function filterHealthyChannels(
  channels: LiveChannel[],
  hideOffline = HIDE_OFFLINE_BY_DEFAULT
): LiveChannel[] {
  if (!hideOffline) return channels;
  return channels.filter(
    (ch) => ch.health === "online" && !ch.isQuarantined
  );
}

export function getCatalogHealthStats(
  channels: LiveChannel[]
): CatalogHealthStats {
  const stats: CatalogHealthStats = {
    total: channels.length,
    online: 0,
    offline: 0,
    unknown: 0,
    checking: 0,
    quarantined: 0,
  };
  for (const ch of channels) {
    if (ch.isQuarantined) stats.quarantined = (stats.quarantined || 0) + 1;
    switch (ch.health) {
      case "online":
        stats.online++;
        break;
      case "offline":
        stats.offline++;
        break;
      case "checking":
        stats.checking++;
        break;
      default:
        stats.unknown++;
    }
  }
  return stats;
}

// ============================================================
// 8. CATALOG API, REGIONAL BACKUPS & ZAPPING ENGINE
// ============================================================

function toLiveChannel(
  s: LiveFeedService,
  favoriteSet?: Set<string>
): LiveChannel {
  const cached = healthCache[s.channelId];
  const favSet = favoriteSet ?? new Set(getFavoriteChannelIds());
  const quarantined = isChannelQuarantined(s.channelId);
  return {
    ...s,
    streamUrl: s.url,
    title: s.name,
    category: getChannelCategory(s.name),
    isDrm: isDrmProtectedChannel(s),
    isFavorite: favSet.has(s.channelId),
    isHidden: isLiveChannelHidden(s.channelId),
    isQuarantined: quarantined,
    reliabilityScore: getChannelReliabilityScore(s.channelId),
    health: quarantined ? "offline" : cached?.health ?? "checking",
    healthCheckedAt: cached?.checkedAt,
    latencyMs: cached?.latencyMs,
  };
}

export async function fetchLiveCategories(): Promise<string[]> {
  const categories = new Set<string>();
  for (const service of getMergedLiveServices()) {
    if (service.groupTitle && !isLiveChannelHidden(service.channelId)) {
      categories.add(service.groupTitle);
    }
  }
  return ["All", ...Array.from(categories).sort((a, b) => a.localeCompare(b))];
}

export async function fetchChannelsByCategory(
  category: string,
  options?: {
    probe?: boolean;
    hideOffline?: boolean;
    forceProbe?: boolean;
    includeHidden?: boolean;
    respectKidsMode?: boolean;
    signal?: AbortSignal;
  }
): Promise<LiveChannel[]> {
  const probe = options?.probe !== false;
  const hideOffline = options?.hideOffline ?? HIDE_OFFLINE_BY_DEFAULT;
  const includeHidden = options?.includeHidden === true;
  const kidsGuard = options?.respectKidsMode === true && isKidsFilterActive();
  const favSet = new Set(getFavoriteChannelIds());

  const merged = getMergedLiveServices();
  const filtered = merged.filter((service) => {
    if (!includeHidden && isLiveChannelHidden(service.channelId)) return false;
    if (kidsGuard && !isChannelKidsSafe(service.name)) return false;
    if (!category || category === "All") return true;
    return service.groupTitle.toLowerCase() === category.toLowerCase();
  });

  let channels = filtered.map((s) => toLiveChannel(s, favSet));

  if (probe) {
    channels = await enrichChannelsWithHealth(channels, {
      force: options?.forceProbe,
      signal: options?.signal,
    });
    channels = filterHealthyChannels(channels, hideOffline);
  }

  channels.sort((a, b) => {
    const na = a.channelNumber ?? 9999;
    const nb = b.channelNumber ?? 9999;
    if (na !== nb) return na - nb;
    return a.name.localeCompare(b.name);
  });

  return channels;
}

export async function fetchAllChannels(options?: {
  probe?: boolean;
  hideOffline?: boolean;
  forceProbe?: boolean;
  includeHidden?: boolean;
  respectKidsMode?: boolean;
  signal?: AbortSignal;
}): Promise<LiveChannel[]> {
  const probe = options?.probe !== false;
  const hideOffline = options?.hideOffline ?? HIDE_OFFLINE_BY_DEFAULT;
  const includeHidden = options?.includeHidden === true;
  const kidsGuard = options?.respectKidsMode === true && isKidsFilterActive();
  const favSet = new Set(getFavoriteChannelIds());

  void syncRemoteChannelOverrides(false);

  let channels = getMergedLiveServices()
    .filter((s) => {
      if (!includeHidden && isLiveChannelHidden(s.channelId)) return false;
      if (kidsGuard && !isChannelKidsSafe(s.name)) return false;
      return true;
    })
    .map((s) => toLiveChannel(s, favSet));

  if (probe) {
    channels = await enrichChannelsWithHealth(channels, {
      force: options?.forceProbe,
      signal: options?.signal,
    });
    channels = filterHealthyChannels(channels, hideOffline);
  }
  return channels;
}

/**
 * O(1) channel lookup by ID or Stream URL.
 */
export function getChannelById(idOrUrl: string): LiveChannel | null {
  const target = String(idOrUrl || "").trim();
  if (!target) return null;
  ensureCatalogIndexes();
  const match = byIdIndexMem!.get(target) || byUrlIndexMem!.get(target);
  return match ? toLiveChannel(match) : null;
}

/**
 * Classic cable-box channel number lookup (e.g. 71 -> Seven, 91 -> Channel 9).
 */
export function getChannelByNumber(
  channelNumber: number,
  preferredRegion?: string
): LiveChannel | null {
  if (!Number.isFinite(channelNumber)) return null;
  const matches = getMergedLiveServices().filter(
    (s) =>
      s.channelNumber === channelNumber && !isLiveChannelHidden(s.channelId)
  );
  if (matches.length === 0) return null;
  if (preferredRegion) {
    const regional = matches.find(
      (s) => s.groupTitle.toLowerCase() === preferredRegion.toLowerCase()
    );
    if (regional) return toLiveChannel(regional);
  }
  const ranked = matches
    .map((s) => toLiveChannel(s))
    .sort((a, b) => (b.reliabilityScore || 0) - (a.reliabilityScore || 0));
  return ranked[0] || null;
}

/**
 * Smart Automatic Backup Mirror Finder:
 * If a regional feed fails (e.g. Seven Sydney, Channel 9 NSW, ABC TV, BBC News),
 * returns alternate regional feeds of the exact same channel sorted by reliability
 * and lowest latency so the player can seamlessly auto-failover!
 */
export function getBackupStreamsForChannel(idOrUrl: string): LiveChannel[] {
  const current = getChannelById(idOrUrl);
  if (!current) return [];
  ensureCatalogIndexes();
  const baseKey = normalizeChannelBaseName(current.name);
  if (!baseKey) return [];

  const siblings = byBaseNameIndexMem!.get(baseKey) || [];
  const favSet = new Set(getFavoriteChannelIds());

  return siblings
    .filter(
      (s) =>
        s.channelId !== current.channelId &&
        s.url !== current.url &&
        !isLiveChannelHidden(s.channelId) &&
        !isChannelQuarantined(s.channelId)
    )
    .map((s) => toLiveChannel(s, favSet))
    .sort((a, b) => {
      const scoreDiff = (b.reliabilityScore || 0) - (a.reliabilityScore || 0);
      if (scoreDiff !== 0) return scoreDiff;
      return (a.latencyMs || 9999) - (b.latencyMs || 9999);
    });
}

/**
 * Instant CH+ / CH- Channel Zapping helper for TV remotes & live-player surfing.
 */
export function getAdjacentChannels(
  currentIdOrUrl: string,
  options?: { region?: string; genre?: string; onlineOnly?: boolean }
): { prev: LiveChannel | null; next: LiveChannel | null } {
  const kidsGuard = isKidsFilterActive();
  const favSet = new Set(getFavoriteChannelIds());

  const pool = getMergedLiveServices()
    .filter((s) => {
      if (isLiveChannelHidden(s.channelId)) return false;
      if (kidsGuard && !isChannelKidsSafe(s.name)) return false;
      if (
        options?.region &&
        options.region !== "All" &&
        s.groupTitle.toLowerCase() !== options.region.toLowerCase()
      ) {
        return false;
      }
      if (
        options?.genre &&
        options.genre !== "All Genres" &&
        getChannelCategory(s.name).toLowerCase() !== options.genre.toLowerCase()
      ) {
        return false;
      }
      if (options?.onlineOnly && healthCache[s.channelId]?.health !== "online") {
        return false;
      }
      return true;
    })
    .map((s) => toLiveChannel(s, favSet));

  if (pool.length === 0) return { prev: null, next: null };

  const idx = pool.findIndex(
    (c) => c.channelId === currentIdOrUrl || c.url === currentIdOrUrl
  );
  if (idx === -1) {
    return { prev: pool[pool.length - 1], next: pool[0] };
  }
  return {
    prev: pool[(idx - 1 + pool.length) % pool.length],
    next: pool[(idx + 1) % pool.length],
  };
}

/**
 * Smart "Channel Surf" picker: prefers verified online, non-quarantined channels
 * and avoids picking the currently playing channel.
 */
export function getRandomHealthyChannel(
  excludeIdOrUrl?: string
): LiveChannel | null {
  const kidsGuard = isKidsFilterActive();
  const favSet = new Set(getFavoriteChannelIds());

  const candidates = getMergedLiveServices()
    .filter(
      (s) =>
        s.channelId !== excludeIdOrUrl &&
        s.url !== excludeIdOrUrl &&
        !isLiveChannelHidden(s.channelId) &&
        !isChannelQuarantined(s.channelId) &&
        (!kidsGuard || isChannelKidsSafe(s.name))
    )
    .map((s) => toLiveChannel(s, favSet));

  if (candidates.length === 0) return null;

  const online = candidates.filter((c) => c.health === "online");
  const pool = online.length > 0 ? online : candidates;
  return pool[Math.floor(Math.random() * pool.length)] || null;
}

/**
 * Returns the fastest & most reliable online channels for "Quick Watch" shelves.
 */
export function getMostReliableChannels(limit = 12): LiveChannel[] {
  const kidsGuard = isKidsFilterActive();
  const favSet = new Set(getFavoriteChannelIds());

  return getMergedLiveServices()
    .filter(
      (s) =>
        !isLiveChannelHidden(s.channelId) &&
        !isChannelQuarantined(s.channelId) &&
        (!kidsGuard || isChannelKidsSafe(s.name))
    )
    .map((s) => toLiveChannel(s, favSet))
    .sort((a, b) => {
      const scoreDiff = (b.reliabilityScore || 0) - (a.reliabilityScore || 0);
      if (scoreDiff !== 0) return scoreDiff;
      return (a.latencyMs || 9999) - (b.latencyMs || 9999);
    })
    .slice(0, Math.max(1, limit));
}

/**
 * Returns the user's Pinned Favorite Live Channels in their saved order.
 */
export function getFavoriteLiveChannels(): LiveChannel[] {
  const favIds = getFavoriteChannelIds();
  if (favIds.length === 0) return [];
  ensureCatalogIndexes();
  const favSet = new Set(favIds);

  return favIds
    .map((id) => byIdIndexMem!.get(id))
    .filter(
      (s): s is LiveFeedService =>
        Boolean(s) && !isLiveChannelHidden(s.channelId)
    )
    .map((s) => toLiveChannel(s, favSet));
}

/**
 * Fast multi-token search across channel name, number, region, genre, and description.
 */
export function searchLiveChannels(
  query: string,
  options?: { region?: string; genre?: string; includeHidden?: boolean }
): LiveChannel[] {
  const q = String(query || "").trim().toLowerCase();
  const queryWords = q ? q.split(/\s+/).filter(Boolean) : [];
  const favSet = new Set(getFavoriteChannelIds());
  const kidsGuard = isKidsFilterActive();
  ensureCatalogIndexes();

  return mergedServicesMem!
    .filter((s) => {
      if (!options?.includeHidden && isLiveChannelHidden(s.channelId)) {
        return false;
      }
      if (kidsGuard && !isChannelKidsSafe(s.name)) return false;
      if (
        options?.region &&
        options.region !== "All" &&
        s.groupTitle.toLowerCase() !== options.region.toLowerCase()
      ) {
        return false;
      }
      if (
        options?.genre &&
        options.genre !== "All Genres" &&
        getChannelCategory(s.name).toLowerCase() !== options.genre.toLowerCase()
      ) {
        return false;
      }
      if (queryWords.length === 0) return true;

      const indexed = searchTokensMem!.get(s.channelId) || "";
      if (queryWords.every((w) => indexed.includes(w))) return true;
      return matchesChannelSearch(s.name, q);
    })
    .map((s) => toLiveChannel(s, favSet));
}

/**
 * Returns a snapshot of Live TV catalog telemetry for dashboards or settings views.
 */
export function getLiveCatalogSummary(): LiveCatalogSummary {
  const merged = getMergedLiveServices();
  const regions = new Set<string>();
  let drmCount = 0;
  let cachedOnlineCount = 0;
  let quarantinedCount = 0;

  for (const s of merged) {
    if (s.groupTitle) regions.add(s.groupTitle);
    if (isDrmProtectedChannel(s)) drmCount++;
    if (isChannelQuarantined(s.channelId)) quarantinedCount++;
    if (healthCache[s.channelId]?.health === "online") {
      cachedOnlineCount++;
    }
  }

  return {
    totalChannels: merged.length,
    builtInCount: liveFeedServices.length,
    customCount: getCustomLiveChannels().length,
    remoteOverrideCount: loadCachedRemoteOverrides().length,
    hiddenCount: getHiddenLiveChannelIds().length,
    quarantinedCount,
    drmCount,
    regionCount: regions.size,
    pinnedCount: getFavoriteChannelIds().length,
    cachedOnlineCount,
  };
}

export async function refreshLiveHealth(options?: {
  signal?: AbortSignal;
  onProgress?: (done: number, total: number) => void;
}): Promise<Record<string, "online" | "offline">> {
  // Clear temporary quarantines on explicit user refresh so recovered feeds can come back
  for (const rec of Object.values(reliabilityMap)) {
    rec.quarantinedUntil = undefined;
    rec.consecutiveFailures = 0;
  }
  persistReliabilityMap();

  await syncRemoteChannelOverrides(true);
  const favSet = new Set(getFavoriteChannelIds());
  const allChannels = getMergedLiveServices()
    .filter((s) => !isLiveChannelHidden(s.channelId))
    .map((s) => toLiveChannel(s, favSet));
  const enriched = await enrichChannelsWithHealth(allChannels, {
    force: true,
    signal: options?.signal,
    onProgress: options?.onProgress,
  });

  const healthResults: Record<string, "online" | "offline"> = {};
  for (const ch of enriched) {
    healthResults[ch.channelId] = ch.health === "offline" ? "offline" : "online";
  }
  return healthResults;
}

export function clearLiveHealthCache(): void {
  healthCache = {};
  remoteOverridesMem = null;
  reliabilityMap = {};
  invalidateCatalogCache();
  if (typeof window !== "undefined") {
    localStorage.removeItem(HEALTH_CACHE_KEY);
    localStorage.removeItem(REMOTE_OVERRIDES_CACHE_KEY);
    localStorage.removeItem(RELIABILITY_CACHE_KEY);
  }
  dispatchLiveEvent(LIVE_HEALTH_UPDATED_EVENT);
}