/**
 * ============================================================
 * LIVE FEED HEALTH LAYER, CATALOG & OVER-THE-AIR SERVICES
 * ============================================================
 * - Keeps all built-in channels intact with lower JS bundle footprint
 * - Hardware RAM-aware concurrent health probing & latency telemetry
 * - Optional OTA Gist channel overrides (`live_channels.json`)
 * - Sanitized custom channel & M3U playlist support
 */

import {
  getHardwareLimits,
  getFavoriteChannelIds,
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
}

export interface LiveCatalogSummary {
  totalChannels: number;
  builtInCount: number;
  customCount: number;
  remoteOverrideCount: number;
  drmCount: number;
  regionCount: number;
  pinnedCount: number;
  cachedOnlineCount: number;
}

// ——— Tunables & Storage Keys ———
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const REMOTE_OVERRIDES_TTL_MS = 30 * 60 * 1000; // 30 minutes
const HEALTH_CACHE_KEY = "rabtv_cache_live_health_v3";
const REMOTE_OVERRIDES_CACHE_KEY = "rabtv_cache_live_remote_v1";
const CUSTOM_CHANNELS_KEY = "rabtv_custom_live_channels_v1";
const MAX_CUSTOM_CHANNELS = 50;
const HIDE_OFFLINE_BY_DEFAULT = true;

const GIST_ID = ((import.meta as any).env?.VITE_GIST_ID as string) || "";
const GITHUB_TOKEN = ((import.meta as any).env?.VITE_GH_PAT as string) || "";
const GIST_API_URL = GIST_ID ? `https://api.github.com/gists/${GIST_ID}` : "";

const DEFAULT_LIVE_UA =
  "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.0; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56";

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

// ——— Built-In Live Channels Array ———
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
  defineChannel("mjh-10-nsw", "10", "Sydney", "https://i.mjh.nz/.r/10-nsw.m3u8", "https://10play.com.au/ip/s3/2025/06/25/b18ae76555d114f7bfaf1c3bfa43dd3f-1384577.png", 10),
  defineChannel("mjh-10bold-nsw", "10 Drama", "Sydney", "https://i.mjh.nz/.r/10bold-nsw.m3u8", "https://10play.com.au/ip/s3/2025/06/25/66c9f2639a7bca4a6691764a0db801d7-1384581.png", 12),
  defineChannel("mjh-10peach-nsw", "10 Comedy", "Sydney", "https://i.mjh.nz/.r/10peach-nsw.m3u8", "https://10play.com.au/ip/s3/2025/06/25/443fa2a5bca1191f12efa002a2a8ef85-1384586.png", 11),
  defineChannel("mjh-10shake-nsw", "Nickelodeon", "Sydney", "https://i.mjh.nz/.r/10shake-nsw.m3u8", "https://10play.com.au/ip/s3/2023/07/31/dc4873abc5ba0fde04b59a78c89e0943-1252731.png", 13),
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
  defineChannel("mjh-10-vic", "10", "Melbourne", "https://i.mjh.nz/.r/10-vic.m3u8", "https://10play.com.au/ip/s3/2025/06/25/b18ae76555d114f7bfaf1c3bfa43dd3f-1384577.png", 10),
  defineChannel("mjh-10bold-vic", "10 Drama", "Melbourne", "https://i.mjh.nz/.r/10bold-vic.m3u8", "https://10play.com.au/ip/s3/2025/06/25/66c9f2639a7bca4a6691764a0db801d7-1384581.png", 12),
  defineChannel("mjh-10peach-vic", "10 Comedy", "Melbourne", "https://i.mjh.nz/.r/10peach-vic.m3u8", "https://10play.com.au/ip/s3/2025/06/25/443fa2a5bca1191f12efa002a2a8ef85-1384586.png", 11),
  defineChannel("mjh-10shake-vic", "Nickelodeon", "Melbourne", "https://i.mjh.nz/.r/10shake-vic.m3u8", "https://10play.com.au/ip/s3/2023/07/31/dc4873abc5ba0fde04b59a78c89e0943-1252731.png", 13),
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
  defineChannel("mjh-10-qld", "10", "Brisbane", "https://i.mjh.nz/.r/10-qld.m3u8", "https://10play.com.au/ip/s3/2025/06/25/b18ae76555d114f7bfaf1c3bfa43dd3f-1384577.png", 10),
  defineChannel("mjh-10bold-qld", "10 Drama", "Brisbane", "https://i.mjh.nz/.r/10bold-qld.m3u8", "https://10play.com.au/ip/s3/2025/06/25/66c9f2639a7bca4a6691764a0db801d7-1384581.png", 12),
  defineChannel("mjh-10peach-qld", "10 Comedy", "Brisbane", "https://i.mjh.nz/.r/10peach-qld.m3u8", "https://10play.com.au/ip/s3/2025/06/25/443fa2a5bca1191f12efa002a2a8ef85-1384586.png", 11),
  defineChannel("mjh-10shake-qld", "Nickelodeon", "Brisbane", "https://i.mjh.nz/.r/10shake-qld.m3u8", "https://10play.com.au/ip/s3/2023/07/31/dc4873abc5ba0fde04b59a78c89e0943-1252731.png", 13),
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
  defineChannel("mjh-10-wa", "10", "Perth", "https://i.mjh.nz/.r/10-wa.m3u8", "https://10play.com.au/ip/s3/2025/06/25/b18ae76555d114f7bfaf1c3bfa43dd3f-1384577.png", 10),
  defineChannel("mjh-10bold-wa", "10 Drama", "Perth", "https://i.mjh.nz/.r/10bold-wa.m3u8", "https://10play.com.au/ip/s3/2025/06/25/66c9f2639a7bca4a6691764a0db801d7-1384581.png", 12),
  defineChannel("mjh-10peach-wa", "10 Comedy", "Perth", "https://i.mjh.nz/.r/10peach-wa.m3u8", "https://10play.com.au/ip/s3/2025/06/25/443fa2a5bca1191f12efa002a2a8ef85-1384586.png", 11),
  defineChannel("mjh-10shake-wa", "Nickelodeon", "Perth", "https://i.mjh.nz/.r/10shake-wa.m3u8", "https://10play.com.au/ip/s3/2023/07/31/dc4873abc5ba0fde04b59a78c89e0943-1252731.png", 13),
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
  defineChannel("mjh-10-sa", "10", "Adelaide", "https://i.mjh.nz/.r/10-sa.m3u8", "https://10play.com.au/ip/s3/2025/06/25/b18ae76555d114f7bfaf1c3bfa43dd3f-1384577.png", 10),
  defineChannel("mjh-10bold-sa", "10 Drama", "Adelaide", "https://i.mjh.nz/.r/10bold-sa.m3u8", "https://10play.com.au/ip/s3/2025/06/25/66c9f2639a7bca4a6691764a0db801d7-1384581.png", 12),
  defineChannel("mjh-10peach-sa", "10 Comedy", "Adelaide", "https://i.mjh.nz/.r/10peach-sa.m3u8", "https://10play.com.au/ip/s3/2025/06/25/443fa2a5bca1191f12efa002a2a8ef85-1384586.png", 11),
  defineChannel("mjh-10shake-sa", "Nickelodeon", "Adelaide", "https://i.mjh.nz/.r/10shake-sa.m3u8", "https://10play.com.au/ip/s3/2023/07/31/dc4873abc5ba0fde04b59a78c89e0943-1252731.png", 13),
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
  defineChannel("mjh-10-grahamnorton", "The Graham Norton Show", "Au", "https://i.mjh.nz/.r/10-grahamnorton.m3u8", "https://10.com.au/ip/s3/2023/07/12/bcb38e1591564d24894210f4abd02423-1248623.png?image-profile=logo"),
  defineChannel("mjh-10-mtv-the-shores", "MTV The Shores", "Au", "https://i.mjh.nz/.r/10-mtv-the-shores.m3u8", "https://10.com.au/ip/s3/2023/07/11/3901f5c4522a0c36cfed8630ab781a5e-1248401.png?image-profile=logo"),
  defineChannel("mjh-10-thankgodyourehere", "Thank God You're Here", "Au", "https://i.mjh.nz/.r/10-thankgodyourehere.m3u8", "https://10.com.au/ip/s3/2025/08/19/9cde4af8ad28a81defc2e020775ff74f-1390978.png?image-profile=logo"),
  defineChannel("mjh-10-diagnosismurder", "Diagnosis Murder", "Au", "https://i.mjh.nz/.r/10-diagnosismurder.m3u8", "https://10.com.au/ip/s3/2023/06/28/5f85fc3d794a167630b935cb639abcc3-1246005.png?image-profile=logo"),
  defineChannel("mjh-10-becker", "Becker", "Au", "https://i.mjh.nz/.r/10-becker.m3u8", "https://10.com.au/ip/s3/2023/06/28/e0449ed804aaacb1de64f87d94912dd3-1246030.png?image-profile=logo"),
  defineChannel("mjh-10-eightoutof10cats", "8 Out Of 10 Cats", "Au", "https://i.mjh.nz/.r/10-eightoutof10cats.m3u8", "https://10.com.au/ip/s3/2024/11/18/03a9b9a1a42bcf2ce1bbb94a8fa47224-1350731.png?image-profile=logo"),
  defineChannel("mjh-10-mtvridiculousness", "MTV Ridiculousness", "Au", "https://i.mjh.nz/.r/10-mtvridiculousness.m3u8", "https://10.com.au/ip/s3/2024/02/19/6a7d740896d031b59c9d33d0e6dff544-1298686.png?image-profile=logo"),
  defineChannel("mjh-10-haveyoubeenpayingattention", "Have You Been Paying Attention?", "Au", "https://i.mjh.nz/.r/10-haveyoubeenpayingattention.m3u8", "https://10.com.au/ip/s3/2024/12/17/20963e84ceedc64212b60c21c883e5c4-1356262.png?image-profile=logo"),
  defineChannel("mjh-10-cheapseats", "The Cheap Seats", "Au", "https://i.mjh.nz/.r/10-cheapseats.m3u8", "https://10.com.au/ip/s3/2025/08/08/47006754904d1d36520e76157ecbfb41-1390280.png?image-profile=logo"),
  defineChannel("mjh-10-adultanimation", "Adult Animation", "Au", "https://i.mjh.nz/.r/10-adultanimation.m3u8", "https://10.com.au/ip/s3/2024/03/21/fb3a87d8a0126b81727106f43c2a2aef-1304705.png?image-profile=logo"),
  defineChannel("mjh-10-aussiedramapopup", "Rush", "Au", "https://i.mjh.nz/.r/10-aussiedramapopup.m3u8", "https://10.com.au/ip/s3/2023/01/24/082f00086b990e915cd774644d67484c-1213111.png?image-profile=logo"),
  defineChannel("mjh-10-rookieblue", "rookie-blue", "Au", "https://i.mjh.nz/.r/10-rookieblue.m3u8", "https://10.com.au/ip/s3/2026/02/01/b4f014a58a872ecca3409d233c38f122-1408366.png?image-profile=logo"),
  defineChannel("mjh-10-heartland", "Heartland", "Au", "https://i.mjh.nz/.r/10-heartland.m3u8", "https://10.com.au/ip/s3/2026/02/01/8b5e285428d559ef6e3afdeebfe53a5d-1408387.png?image-profile=logo"),
  defineChannel("mjh-10-prisoner-cell-block-h", "Prisoner: Cell Block H", "Au", "https://i.mjh.nz/.r/10-prisoner-cell-block-h.m3u8", "https://10.com.au/ip/s3/2022/09/26/b6430b0f79d6b4c9fc5c6ea295bbae03-1182444.png?image-profile=logo"),
  defineChannel("mjh-10-dallascheerleaders", "Dallas Cowboy Cheerleaders: Making The Team", "Au", "https://i.mjh.nz/.r/10-dallascheerleaders.m3u8", "https://10.com.au/ip/s3/2026/10/13/0908d845bb84c3146f50501d394ca2a6-1466626.png?image-profile=logo"),
  defineChannel("mjh-10-nexttopmodel", "Next Top Model", "Au", "https://i.mjh.nz/.r/10-nexttopmodel.m3u8", "https://10.com.au/ip/s3/2026/08/04/7b46b0620b6c96c6afcd7c47bf356f79-1448048.png?image-profile=logo"),
  defineChannel("mjh-10-projectrunway", "Project Runway", "Au", "https://i.mjh.nz/.r/10-projectrunway.m3u8", "https://10.com.au/ip/s3/2025/03/18/9652b72f62d4dcb715e22ec6f972b1e7-1369332.png?image-profile=logo"),
  defineChannel("mjh-10-masterchef", "MasterChef", "Au", "https://i.mjh.nz/.r/10-masterchef.m3u8", "https://10.com.au/ip/s3/2022/09/02/3fff1b47f7c01770b7f0f319770d5362-1177252.png?image-profile=logo"),
  defineChannel("mjh-10-world-of-survivor", "World Of Survivor", "Au", "https://i.mjh.nz/.r/10-world-of-survivor.m3u8", "https://10.com.au/ip/s3/2024/09/24/6a7955dee63fad795d40332b9cfbf8ce-1340644.png?image-profile=logo"),
  defineChannel("mjh-10-judge-judy", "Judge Judy", "Au", "https://i.mjh.nz/.r/10-judge-judy.m3u8", "https://10.com.au/ip/s3/2022/09/02/461008ac0d02137f713ec0e4883be6c4-1177265.png?image-profile=logo"),
  defineChannel("mjh-10-theonlywayisessex", "The Only Way Is Essex", "Au", "https://i.mjh.nz/.r/10-theonlywayisessex.m3u8", "https://10.com.au/ip/s3/2024/10/21/644463c986545838587c1b800be3da68-1345463.png?image-profile=logo"),
  defineChannel("mjh-10-undercoverboss", "Undercover Boss", "Au", "https://i.mjh.nz/.r/10-undercoverboss.m3u8", "https://10.com.au/ip/s3/2024/10/21/45e53866fa7cd6757ddf34e52e7a9262-1345397.png?image-profile=logo"),
  defineChannel("mjh-10-hardcorepawn", "Hardcore Pawn", "Au", "https://i.mjh.nz/.r/10-hardcorepawn.m3u8", "https://10.com.au/ip/s3/2025/03/03/1d46b70035ba5c816af46c6d4ee079cd-1366514.png?image-profile=logo"),
  defineChannel("mjh-10-wicked-tuna", "Wicked Tuna", "Au", "https://i.mjh.nz/.r/10-wicked-tuna.m3u8", "https://10.com.au/ip/s3/2022/09/02/2d667eb54bf0119b84b744f9569ee214-1177247.png?image-profile=logo"),
  defineChannel("mjh-10-embarrassing-bodies", "Embarrassing Bodies", "Au", "https://i.mjh.nz/.r/10-embarrassing-bodies.m3u8", "https://10.com.au/ip/s3/2024/10/21/f315a8cda9494cc30e29fdba87430ff8-1345391.png?image-profile=logo"),
  defineChannel("mjh-10-highwaythruhell", "Highway Thru Hell", "Au", "https://i.mjh.nz/.r/10-highwaythruhell.m3u8", "https://10.com.au/ip/s3/2025/06/19/3c941c6bd357c1bc3acc855f846e842c-1383806.png?image-profile=logo"),
  defineChannel("mjh-10-cops", "COPS", "Au", "https://i.mjh.nz/.r/10-cops.m3u8", "https://10.com.au/ip/s3/2025/03/30/6fadf0873ac36ecacdc63ed8bba4cf3d-1371071.png?image-profile=logo"),
  defineChannel("mjh-10-medical-emergency", "Medical Emergency", "Au", "https://i.mjh.nz/.r/10-medical-emergency.m3u8", "https://10.com.au/ip/s3/2023/06/28/115b6796134f1e983f41c224c31cc7c9-1246084.png?image-profile=logo"),
  defineChannel("mjh-10-deadlywomen", "Deadly Women", "Au", "https://i.mjh.nz/.r/10-deadlywomen.m3u8", "https://10.com.au/ip/s3/2025/06/19/01e576c63918373cd03aa21ea8566f1e-1383812.png?image-profile=logo"),
  defineChannel("mjh-10-crime-time", "Crime Time", "Au", "https://i.mjh.nz/.r/10-crime-time.m3u8", "https://10.com.au/ip/s3/2024/09/25/c27b803a4128c5b097cd3a23e1be973c-1341004.png?image-profile=logo"),
  defineChannel("mjh-10-crime-hunters", "Crime Hunters", "Au", "https://i.mjh.nz/.r/10-crime-hunters.m3u8", "https://10.com.au/ip/s3/2024/03/06/cb69de15e7b8989a218ad25b7f6547ef-1301820.png?image-profile=logo"),
  defineChannel("mjh-10-forty-eight-hours", "48 Hours", "Au", "https://i.mjh.nz/.r/10-forty-eight-hours.m3u8", "https://10.com.au/ip/s3/2023/06/28/7dd910de29f31095b69e17f1da8f3f0e-1245997.png?image-profile=logo"),
  defineChannel("mjh-10-true-stories", "True Stories", "Au", "https://i.mjh.nz/.r/10-true-stories.m3u8", "https://10.com.au/ip/s3/2022/09/22/bf31efb3f5efe008cc774909b0cef282-1181809.png?image-profile=logo"),
  defineChannel("mjh-10-haunt-tv", "Haunt TV", "Au", "https://i.mjh.nz/.r/10-haunt-tv.m3u8", "https://10.com.au/ip/s3/2023/07/12/8cb62aeb9de0e12611b68059325da0f3-1248632.png?image-profile=logo"),
  defineChannel("mjh-10-ghosthunters", "Ghost Hunters", "Au", "https://i.mjh.nz/.r/10-ghosthunters.m3u8", "https://10.com.au/ip/s3/2024/02/20/6a0f5d5002748886ee7b1936f996a304-1298978.png?image-profile=logo"),
  defineChannel("mjh-10-jamieoliver", "Jamie Oliver", "Au", "https://i.mjh.nz/.r/10-jamieoliver.m3u8", "https://10.com.au/ip/s3/2026/10/05/f56ba740d7edd193360ff0e4cdba004b-1465603.png?image-profile=logo"),
  defineChannel("mjh-10-anthonybourdain", "Anthony Bourdain: Parts Unknown", "Au", "https://i.mjh.nz/.r/10-anthonybourdain.m3u8", "https://10.com.au/ip/s3/2025/05/26/cbf83588f02110ded81566ecc62e2f0e-1380501.png?image-profile=logo"),
  defineChannel("mjh-10-wildest", "Wildest", "Au", "https://i.mjh.nz/.r/10-wildest.m3u8", "https://10.com.au/ip/s3/2026/04/28/230f46ab9b55bdb4f98a00f616d8b0a2-1424324.png?image-profile=logo"),
  defineChannel("mjh-10-shockwave", "Shockwave", "Au", "https://i.mjh.nz/.r/10-shockwave.m3u8", "https://10.com.au/ip/s3/2026/03/31/145f61f54f2e66b3bf4a2fefff5b267a-1421437.png?image-profile=logo"),
  defineChannel("mjh-10-historyandwarfare", "History & Warfare", "Au", "https://i.mjh.nz/.r/10-historyandwarfare.m3u8", "https://10.com.au/ip/s3/2026/03/17/5010fc64782edb4842a94d1484f72514-1419388.png?image-profile=logo"),
  defineChannel("mjh-10-seasonalmovies", "Thriller Movies", "Au", "https://i.mjh.nz/.r/10-seasonalmovies.m3u8", "https://10.com.au/ip/s3/2024/04/01/86e45216ee9df7d873e393dccb379d94-1306209.png?image-profile=logo"),
  defineChannel("mjh-10-moviesphere", "Moviesphere", "Au", "https://i.mjh.nz/.r/10-moviesphere.m3u8", "https://10.com.au/ip/s3/2022/12/05/6bb229de8fcf96e206e99ca455fc2267-1202912.png?image-profile=logo"),
  defineChannel("mjh-10-nick-jr", "Nick Jr Club", "Au", "https://i.mjh.nz/.r/10-nick-jr.m3u8", "https://10.com.au/ip/s3/2024/06/06/d14509f218578984e3a6f6f34f0ee12c-1319009.png?image-profile=logo"),
  defineChannel("mjh-10-spongebobsquarepants", "SpongeBob SquarePants", "Au", "https://i.mjh.nz/.r/10-spongebobsquarepants.m3u8", "https://10.com.au/ip/s3/2024/05/27/ee4d9694aa3f7a2fe97b6f18aa773b88-1316803.png?image-profile=logo"),
  defineChannel("mjh-10-nicktoons", "NickToons", "Au", "https://i.mjh.nz/.r/10-nicktoons.m3u8", "https://10.com.au/ip/s3/2024/06/04/f2f7c4166d8450351c2ae5d8b28c769e-1318512.png?image-profile=logo"),
  defineChannel("mjh-10-nicktoons-90s", "NickToons 90s", "Au", "https://i.mjh.nz/.r/10-nicktoons-90s.m3u8", "https://10.com.au/ip/s3/2024/06/07/a1aaf63737e7d2076759dd850b58471a-1319376.png?image-profile=logo"),
  defineChannel("mjh-10-nickteen", "NickTeen", "Au", "https://i.mjh.nz/.r/10-nickteen.m3u8", "https://10.com.au/ip/s3/2024/06/04/ecc540be818b29d753e036e046028a27-1318595.png?image-profile=logo"),
  defineChannel("mjh-10-geckotv", "Gecko TV", "Au", "https://i.mjh.nz/.r/10-geckotv.m3u8", "https://10.com.au/ip/s3/2023/02/23/b81bfc3f4737696257ef326b0e68208e-1219777.png?image-profile=logo", 17),
  defineChannel("mjh-10-youtv", "YouTV", "Au", "https://i.mjh.nz/.r/10-youtv.m3u8", "https://10.com.au/ip/s3/2024/07/10/33f7c16e8ba1628d52844cb45b8eac4f-1326074.png?image-profile=logo", 16),
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

// ——— Security: Safe Stream URL Validator ———
export function isSafeStreamUrl(rawUrl: string): boolean {
  if (!rawUrl || typeof rawUrl !== "string") return false;
  try {
    const parsed = new URL(rawUrl.trim());
    return parsed.protocol === "https:" || parsed.protocol === "http:";
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

// ——— Safe LocalStorage Writer (Quota-Protected for 1-2GB Sticks) ———
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

// ——— Custom User Channels & M3U Playlist Support ———
export function getCustomLiveChannels(): LiveFeedService[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CUSTOM_CHANNELS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item: any) =>
          item && typeof item.name === "string" && isSafeStreamUrl(item.url)
      )
      .map((item: any) => ({
        ...item,
        isCustom: true,
        userAgent: item.userAgent || DEFAULT_LIVE_UA,
        referrer: item.referrer || "",
      }))
      .slice(0, MAX_CUSTOM_CHANNELS);
  } catch {
    return [];
  }
}

export function addCustomLiveChannel(input: {
  name: string;
  url: string;
  groupTitle?: string;
  logo?: string;
  channelNumber?: number;
}): { ok: boolean; error?: string; channel?: LiveFeedService } {
  const cleanName = String(input.name || "").trim().slice(0, 50);
  const cleanUrl = String(input.url || "").trim();

  if (cleanName.length < 2) {
    return { ok: false, error: "Channel name must be at least 2 characters." };
  }
  if (!isSafeStreamUrl(cleanUrl)) {
    return {
      ok: false,
      error: "Stream URL must be a valid http:// or https:// link.",
    };
  }

  const existing = getCustomLiveChannels();
  if (existing.length >= MAX_CUSTOM_CHANNELS) {
    return {
      ok: false,
      error: `Maximum of ${MAX_CUSTOM_CHANNELS} custom channels reached.`,
    };
  }

  const safeLogo =
    input.logo && isSafeStreamUrl(input.logo) ? input.logo.trim() : undefined;

  const newChannel: LiveFeedService = defineChannel(
    `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    cleanName,
    (input.groupTitle || "Custom").trim().slice(0, 25),
    cleanUrl,
    safeLogo,
    input.channelNumber,
    { isCustom: true }
  );

  safeWriteStorage(CUSTOM_CHANNELS_KEY, [newChannel, ...existing]);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("rabtv_live_catalog_updated"));
  }
  return { ok: true, channel: newChannel };
}

export function removeCustomLiveChannel(channelId: string): boolean {
  const existing = getCustomLiveChannels();
  const next = existing.filter((c) => c.channelId !== channelId);
  if (next.length === existing.length) return false;
  safeWriteStorage(CUSTOM_CHANNELS_KEY, next);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("rabtv_live_catalog_updated"));
  }
  return true;
}

/**
 * Lightweight M3U/M3U8 playlist parser for importing custom IPTV channels safely.
 */
export function parseM3uPlaylist(rawText: string): LiveFeedService[] {
  const lines = String(rawText || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const parsed: LiveFeedService[] = [];
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
      const title =
        commaIdx >= 0 ? line.slice(commaIdx + 1).trim() : "Custom Channel";

      pendingMeta = {
        name: title.slice(0, 50) || "Custom Channel",
        logo:
          logoMatch?.[1] && isSafeStreamUrl(logoMatch[1])
            ? logoMatch[1]
            : undefined,
        groupTitle: (groupMatch?.[1] || "Custom").slice(0, 25),
        channelNumber: numMatch?.[1] ? parseInt(numMatch[1], 10) : undefined,
      };
    } else if (!line.startsWith("#") && isSafeStreamUrl(line)) {
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
      pendingMeta = null;
      if (parsed.length >= MAX_CUSTOM_CHANNELS) break;
    }
  }
  return parsed;
}

// ——— Optional Over-the-Air Remote Gist Channel Overrides (`live_channels.json`) ———
interface RemoteOverrideCache {
  fetchedAt: number;
  channels: LiveFeedService[];
}

let remoteOverridesMem: RemoteOverrideCache | null = null;

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
 */
export async function syncRemoteChannelOverrides(
  force = false
): Promise<LiveFeedService[]> {
  if (!force) {
    const cached = loadCachedRemoteOverrides();
    if (cached.length > 0) return cached;
  }
  if (!GIST_ID || !GITHUB_TOKEN || !GIST_API_URL) return [];

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
      .filter(
        (item: any) =>
          item &&
          typeof item.channelId === "string" &&
          (item.disabled === true || isSafeStreamUrl(item.url))
      )
      .map((item: any) => ({
        channelId: String(item.channelId).trim(),
        name: String(item.name || "Live Channel").trim(),
        groupTitle: String(item.groupTitle || "World").trim(),
        logo:
          item.logo && isSafeStreamUrl(item.logo) ? String(item.logo) : undefined,
        channelNumber:
          typeof item.channelNumber === "number"
            ? item.channelNumber
            : undefined,
        url: String(item.url || "").trim(),
        userAgent: item.userAgent || DEFAULT_LIVE_UA,
        referrer: item.referrer || "",
        manifestType: item.manifestType,
        licenseType: item.licenseType,
        licenseKey: item.licenseKey,
        disabled: Boolean(item.disabled),
      }));

    const entry: RemoteOverrideCache = {
      fetchedAt: Date.now(),
      channels: sanitized,
    };
    remoteOverridesMem = entry;
    safeWriteStorage(REMOTE_OVERRIDES_CACHE_KEY, entry);
    return sanitized;
  } catch {
    return loadCachedRemoteOverrides();
  } finally {
    if (typeof window !== "undefined") {
      window.clearTimeout(timer as number);
    } else {
      clearTimeout(timer);
    }
  }
}

/**
 * Merges Built-In Channels + Remote Gist Overrides + Local Custom Channels.
 */
export function getMergedLiveServices(): LiveFeedService[] {
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
  return Array.from(map.values());
}

// ——— In-Memory + LocalStorage Health Cache ———
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

/**
 * Probe a single stream URL with hardware-aware timeout and latency measurement.
 */
export async function probeStreamWithLatency(
  url: string
): Promise<{ health: ChannelHealth; latencyMs: number }> {
  if (!isSafeStreamUrl(url)) return { health: "offline", latencyMs: 0 };

  const isLowRam = getHardwareLimits().effectiveMode === "low";
  const timeoutMs = isLowRam ? 3500 : 4500;
  const startedAt = Date.now();

  const controller = new AbortController();
  const timer =
    typeof window !== "undefined"
      ? window.setTimeout(() => controller.abort(), timeoutMs)
      : setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      mode: "cors",
      cache: "no-store",
      credentials: "omit",
      headers: { Range: "bytes=0-512" },
    });

    const latencyMs = Date.now() - startedAt;
    if (res.ok || res.status === 206) {
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
    if (err?.name === "AbortError") return { health: "offline", latencyMs };
    if (err?.name === "TypeError") return { health: "unknown", latencyMs };
    return { health: "offline", latencyMs };
  } finally {
    if (typeof window !== "undefined") {
      window.clearTimeout(timer as number);
    } else {
      clearTimeout(timer);
    }
  }
}

/** Backwards-compatible stream probe returning ChannelHealth */
export async function probeStream(url: string): Promise<ChannelHealth> {
  const res = await probeStreamWithLatency(url);
  return res.health;
}

/** Run probes with a hardware-aware concurrency limit */
async function mapPool<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function run() {
    while (next < items.length) {
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
 */
export async function enrichChannelsWithHealth(
  channels: LiveChannel[],
  options?: { force?: boolean }
): Promise<LiveChannel[]> {
  const now = Date.now();
  const force = options?.force === true;
  const concurrency = getHardwareLimits().effectiveMode === "low" ? 4 : 8;

  const needsProbe = channels.filter((ch) => {
    if (force) return true;
    const cached = healthCache[ch.channelId];
    return !cached || now - cached.checkedAt >= CACHE_TTL_MS;
  });

  if (needsProbe.length > 0) {
    await mapPool(needsProbe, concurrency, async (ch) => {
      const res = await probeStreamWithLatency(ch.url || ch.streamUrl);
      healthCache[ch.channelId] = {
        health: res.health,
        checkedAt: Date.now(),
        latencyMs: res.latencyMs,
      };
      return res.health;
    });
    saveHealthCache(healthCache);
  }

  return channels.map((ch) => {
    const entry = healthCache[ch.channelId];
    return {
      ...ch,
      health: entry?.health ?? "unknown",
      healthCheckedAt: entry?.checkedAt,
      latencyMs: entry?.latencyMs,
    };
  });
}

/** Drop offline, unknown, or checking channels — only keep online (green) channels */
export function filterHealthyChannels(
  channels: LiveChannel[],
  hideOffline = HIDE_OFFLINE_BY_DEFAULT
): LiveChannel[] {
  if (!hideOffline) return channels;
  return channels.filter((ch) => ch.health === "online");
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
  };
  for (const ch of channels) {
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

// ——— Catalog API Exports ———

function toLiveChannel(
  s: LiveFeedService,
  favoriteSet?: Set<string>
): LiveChannel {
  const cached = healthCache[s.channelId];
  const favSet = favoriteSet ?? new Set(getFavoriteChannelIds());
  return {
    ...s,
    streamUrl: s.url,
    title: s.name,
    category: getChannelCategory(s.name),
    isDrm: isDrmProtectedChannel(s),
    isFavorite: favSet.has(s.channelId),
    health: cached?.health ?? "checking",
    healthCheckedAt: cached?.checkedAt,
    latencyMs: cached?.latencyMs,
  };
}

export async function fetchLiveCategories(): Promise<string[]> {
  const categories = new Set<string>();
  for (const service of getMergedLiveServices()) {
    if (service.groupTitle) categories.add(service.groupTitle);
  }
  return ["All", ...Array.from(categories).sort((a, b) => a.localeCompare(b))];
}

export async function fetchChannelsByCategory(
  category: string,
  options?: { probe?: boolean; hideOffline?: boolean; forceProbe?: boolean }
): Promise<LiveChannel[]> {
  const probe = options?.probe !== false;
  const hideOffline = options?.hideOffline ?? HIDE_OFFLINE_BY_DEFAULT;
  const favSet = new Set(getFavoriteChannelIds());

  const merged = getMergedLiveServices();
  const filtered =
    !category || category === "All"
      ? merged
      : merged.filter(
          (service) =>
            service.groupTitle.toLowerCase() === category.toLowerCase()
        );

  let channels = filtered.map((s) => toLiveChannel(s, favSet));

  if (probe) {
    channels = await enrichChannelsWithHealth(channels, {
      force: options?.forceProbe,
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
}): Promise<LiveChannel[]> {
  const probe = options?.probe !== false;
  const hideOffline = options?.hideOffline ?? HIDE_OFFLINE_BY_DEFAULT;
  const favSet = new Set(getFavoriteChannelIds());

  void syncRemoteChannelOverrides(false);

  let channels = getMergedLiveServices().map((s) => toLiveChannel(s, favSet));
  if (probe) {
    channels = await enrichChannelsWithHealth(channels, {
      force: options?.forceProbe,
    });
    channels = filterHealthyChannels(channels, hideOffline);
  }
  return channels;
}

/**
 * Fast channel lookup by ID or Stream URL.
 */
export function getChannelById(idOrUrl: string): LiveChannel | null {
  const target = String(idOrUrl || "").trim();
  if (!target) return null;
  const match = getMergedLiveServices().find(
    (s) => s.channelId === target || s.url === target
  );
  return match ? toLiveChannel(match) : null;
}

/**
 * Returns the user's Pinned Favorite Live Channels in their saved order.
 */
export function getFavoriteLiveChannels(): LiveChannel[] {
  const favIds = getFavoriteChannelIds();
  if (favIds.length === 0) return [];
  const favSet = new Set(favIds);
  const byId = new Map<string, LiveFeedService>();
  for (const s of getMergedLiveServices()) {
    byId.set(s.channelId, s);
  }
  return favIds
    .map((id) => byId.get(id))
    .filter((s): s is LiveFeedService => Boolean(s))
    .map((s) => toLiveChannel(s, favSet));
}

/**
 * Rich search across channel name, number, region, genre category, and description.
 */
export function searchLiveChannels(
  query: string,
  options?: { region?: string; genre?: string }
): LiveChannel[] {
  const q = String(query || "").trim().toLowerCase();
  const favSet = new Set(getFavoriteChannelIds());

  return getMergedLiveServices()
    .filter((s) => {
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
      if (!q) return true;
      return (
        String(s.channelNumber || "").includes(q) ||
        s.groupTitle.toLowerCase().includes(q) ||
        matchesChannelSearch(s.name, q)
      );
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

  for (const s of merged) {
    if (s.groupTitle) regions.add(s.groupTitle);
    if (isDrmProtectedChannel(s)) drmCount++;
    if (healthCache[s.channelId]?.health === "online") {
      cachedOnlineCount++;
    }
  }

  return {
    totalChannels: merged.length,
    builtInCount: liveFeedServices.length,
    customCount: getCustomLiveChannels().length,
    remoteOverrideCount: loadCachedRemoteOverrides().length,
    drmCount,
    regionCount: regions.size,
    pinnedCount: getFavoriteChannelIds().length,
    cachedOnlineCount,
  };
}

export async function refreshLiveHealth(): Promise<
  Record<string, "online" | "offline">
> {
  await syncRemoteChannelOverrides(true);
  const favSet = new Set(getFavoriteChannelIds());
  const allChannels = getMergedLiveServices().map((s) =>
    toLiveChannel(s, favSet)
  );
  const enriched = await enrichChannelsWithHealth(allChannels, { force: true });

  const healthResults: Record<string, "online" | "offline"> = {};
  for (const ch of enriched) {
    healthResults[ch.channelId] = ch.health === "offline" ? "offline" : "online";
  }
  return healthResults;
}

export function clearLiveHealthCache(): void {
  healthCache = {};
  remoteOverridesMem = null;
  if (typeof window !== "undefined") {
    localStorage.removeItem(HEALTH_CACHE_KEY);
    localStorage.removeItem(REMOTE_OVERRIDES_CACHE_KEY);
  }
}
