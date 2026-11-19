// src/lib/channel-categories.ts

export interface ChannelCategoryMeta {
  id: string;
  icon: string;
  shortLabel: string;
  description: string;
  accentBadgeClass: string;
  kidsSafeDefault: boolean;
}

export const CHANNEL_CATEGORY_META: Record<string, ChannelCategoryMeta> = {
  Sports: {
    id: "Sports",
    icon: "🏆",
    shortLabel: "Sports",
    description: "Live matches, racing fixtures, tournament replays, and athletic coverage.",
    accentBadgeClass: "bg-emerald-950/75 text-emerald-300 border-emerald-500/40",
    kidsSafeDefault: true,
  },
  Automotive: {
    id: "Automotive",
    icon: "🏎️",
    shortLabel: "Auto & Trucks",
    description: "Supercars, custom garage builds, outback haulers, and heavy recovery.",
    accentBadgeClass: "bg-orange-950/75 text-orange-300 border-orange-500/40",
    kidsSafeDefault: true,
  },
  News: {
    id: "News",
    icon: "🌍",
    shortLabel: "Live News",
    description: "24/7 international headlines, finance updates, weather, and live briefings.",
    accentBadgeClass: "bg-sky-950/75 text-sky-300 border-sky-500/40",
    kidsSafeDefault: true,
  },
  "Entertainment & Drama": {
    id: "Entertainment & Drama",
    icon: "🎬",
    shortLabel: "Movies & TV",
    description: "Prime-time drama, feature films, sitcoms, comedy panels, and network TV.",
    accentBadgeClass: "bg-violet-950/75 text-violet-300 border-violet-500/40",
    kidsSafeDefault: true,
  },
  "Lifestyle & Reality": {
    id: "Lifestyle & Reality",
    icon: "✨",
    shortLabel: "Lifestyle",
    description: "Home renovation, gourmet cooking, travel, fashion, and reality hits.",
    accentBadgeClass: "bg-pink-950/75 text-pink-300 border-pink-500/40",
    kidsSafeDefault: true,
  },
  "Documentary & Factual": {
    id: "Documentary & Factual",
    icon: "🔎",
    shortLabel: "Docs & Crime",
    description: "True crime, history, science experiments, nature, rescue, and paranormal.",
    accentBadgeClass: "bg-amber-950/75 text-amber-300 border-amber-500/40",
    kidsSafeDefault: false,
  },
  "Kids & Family": {
    id: "Kids & Family",
    icon: "🧸",
    shortLabel: "Kids & Family",
    description: "Cartoons, family animation, preschool classics, and youth entertainment.",
    accentBadgeClass: "bg-cyan-950/75 text-cyan-300 border-cyan-500/40",
    kidsSafeDefault: true,
  },
  "Music & Audio": {
    id: "Music & Audio",
    icon: "🎵",
    shortLabel: "Music & Radio",
    description: "Non-stop music videos, chill visual soundscapes, and live digital radio.",
    accentBadgeClass: "bg-fuchsia-950/75 text-fuchsia-300 border-fuchsia-500/40",
    kidsSafeDefault: true,
  },
  "Shopping & Special": {
    id: "Shopping & Special",
    icon: "🛍️",
    shortLabel: "Shopping & Info",
    description: "Live home shopping showcases, timeshifted feeds, and broadcast guides.",
    accentBadgeClass: "bg-slate-900/80 text-slate-200 border-white/20",
    kidsSafeDefault: true,
  },
};

export const channelCategories: Record<string, string[]> = {
  Sports: [
    "ThreeNow Sport 2",
    "Sky Open",
    "Trackside 1",
    "Trackside 2",
    "Trackside Premier",
    "Racing.com",
    "Racing WA",
    "LIV Golf Replays",
    "7AFL",
    "WNBL 2026/27",
    "FIFA+",
    "Koori Knockout",
    "Sky Racing #1",
    "Sky Racing #2",
    "Sky Racing - Thoroughbred Central",
    "Cricket Gold",
  ],
  Automotive: [
    "Warner Bros TV Motorheads",
    "Big Rig",
    "BBC Top Gear",
    "Outback Truckers",
    "Trucking Hell",
    "Highway Thru Hell",
  ],
  News: [
    "CNN Headlines International",
    "Al Jazeera",
    "Parliament TV",
    "ABC NEWS",
    "ABC News in 90 Seconds",
    "ABC Business in 90 Seconds",
    "ABC Sport in 90 Seconds",
    "ABC Weather in 90 Seconds",
    "Bloomberg TV",
    "Sky News Now",
    "BBC News",
    "Channel News Asia (CNA)",
    "DW English",
    "France 24",
    "euronews",
    "60 Minutes Australia",
    "7NEWS Spotlight",
  ],
  "Entertainment & Drama": [
    "TVNZ 1",
    "TVNZ 2",
    "Three",
    "DUKE",
    "eden",
    "Seven",
    "7two",
    "7mate",
    "7flix",
    "Channel 9",
    "9Gem",
    "9Go!",
    "ABC TV",
    "10",
    "10 Drama",
    "10 Comedy",
    "Seven Cairns",
    "7flix Regional",
    "7two Regional",
    "7mate Regional",
    "Seven Mackay",
    "Seven Sunshine Coast",
    "Seven Rockhampton",
    "Seven Toowoomba",
    "Seven Townsville",
    "Seven Wide Bay",
    "Channel 9 (Gold Coast)",
    "Channel 9 (Norther Rivers)",
    "Channel 9 (Newcastle)",
    "All Saints",
    "Home and Away Classics",
    "Water Rats",
    "Winners & Losers",
    "Blue Heelers",
    "A Country Practice",
    "NCIS",
    "Seinfeld",
    "LMN",
    "BBC Comedy",
    "The Graham Norton Show",
    "Thank God You're Here",
    "Diagnosis Murder",
    "Becker",
    "8 Out Of 10 Cats",
    "Have You Been Paying Attention?",
    "The Cheap Seats",
    "Adult Animation",
    "Rush",
    "rookie-blue",
    "Heartland",
    "Prisoner: Cell Block H",
    "SBS",
    "SBS2",
    "SBS World Movies",
    "ABC Entertains",
    "Thriller Movies",
    "Moviesphere",
    "MovieSphere",
    "All-Star Cinema",
  ],
  "Lifestyle & Reality": [
    "HGTV",
    "Below Deck Vault",
    "Warner Bros TV House Hunters",
    "Bravo",
    "Bravo PLUS 1",
    "9Life",
    "Escape to the Country",
    "The Real Housewives VAULT",
    "Million Dollar Listing VAULT",
    "Married At First Sight",
    "Dance Moms 24/7",
    "BBC Home & Garden",
    "BBC Food",
    "SBS Food",
    "MTV The Shores",
    "The Only Way Is Essex",
    "Undercover Boss",
    "Embarrassing Bodies",
    "Jamie Oliver",
    "Anthony Bourdain: Parts Unknown",
    "The Cook Up",
    "Planet Luke Nguyen",
    "GOOD.",
    "Hardcore Pawn",
    "Kitchen Nightmares",
    "7Bravo",
    "Hells Kitchen",
    "The Block 24/7",
    "Dallas Cowboy Cheerleaders: Making The Team",
    "Next Top Model",
    "Project Runway",
    "MasterChef",
    "World Of Survivor",
    "Better Homes And Gardens",
  ],
  "Documentary & Factual": [
    "MythBusters",
    "Mythbusters",
    "Warner Bros TV True Crime",
    "Warner Bros TV Paranormal",
    "Warner Bros TV Deadliest Catch",
    "Whakaata Maori",
    "RUSH",
    "9Rush",
    "Te Reo",
    "Shine TV",
    "Firstlight",
    "Hope Channel",
    "Wairarapa TV",
    "First Nations TV",
    "Tourism TV",
    "Border Security Australia",
    "Travel Australia",
    "Air Crash Investigations",
    "The Yorkshire Vet",
    "CSI Crime Scene Investigation",
    "Mighty Machines",
    "Ghost Hunters",
    "On The Case",
    "Bondi Vet",
    "Surveillance Central",
    "Anglers Paradise",
    "Judge Judy",
    "Blue Light",
    "Medical And Rescue",
    "True Crime Files",
    "Antiques Road Trip",
    "Botched VAULT",
    "24 Hours in A&E",
    "Bondi Rescue",
    "9Crime",
    "Taronga 24/7",
    "9Mystery&Paranormal",
    "Real Emergency",
    "H2",
    "BBC Antiques Roadshow",
    "MTV Ridiculousness",
    "COPS",
    "Medical Emergency",
    "Deadly Women",
    "Crime Time",
    "Crime Hunters",
    "48 Hours",
    "True Stories",
    "Haunt TV",
    "Wildest",
    "Shockwave",
    "History & Warfare",
    "Insight",
    "Dateline",
    "Snowy Mountains Television",
    "Channel 31",
    "Channel 44",
    "Channel 31 (Adelaide)",
    "Gecko TV",
    "YouTV",
    "NITV",
    "Redbull TV",
    "Wicked Tuna",
  ],
  "Kids & Family": [
    "Nickelodeon",
    "Nick Jr Club",
    "SpongeBob SquarePants",
    "NickToons",
    "NickToons 90s",
    "NickTeen",
    "ABC Kids",
    "ABC Family",
  ],
  "Music & Audio": [
    "JuiceTV",
    "J2",
    "Melo",
    "The Groat",
    "SBS Chill",
    "SBS PopAsia",
    "SBS South Asian",
    "SBS Arabic",
    "SBS Radio 1",
    "SBS Radio 2",
    "SBS Radio 3",
    "SBS Radio 4",
  ],
  "Shopping & Special": [
    "TVSN Shopping",
    "TVSN",
    "CH200",
    "ThreePlus1",
  ],
};

function normalizeChannelName(name: string): string {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

// Pre-computed O(1) normalized channel -> category index for zero-lag lookups on 1-2GB sticks
const NORMALIZED_CATEGORY_INDEX: Map<string, string> = (() => {
  const map = new Map<string, string>();
  for (const [category, channels] of Object.entries(channelCategories)) {
    for (const chName of channels) {
      const key = normalizeChannelName(chName);
      if (key && !map.has(key)) {
        map.set(key, category);
      }
    }
  }
  return map;
})();

/**
 * Smart keyword fallback classifier for newly added or remote Gist channels.
 */
function inferCategoryByKeywords(channelName: string): string {
  const lower = String(channelName || "").toLowerCase();
  if (
    /\b(sport|sports|racing|golf|afl|nba|nfl|nhl|fifa|cricket|tennis|boxing|ufc|wnbl|trackside)\b/.test(
      lower
    )
  ) {
    return "Sports";
  }
  if (/\b(news|cnn|bbc|bloomberg|jazeera|euronews|cna|dw|parliament|weather|business)\b/.test(lower)) {
    return "News";
  }
  if (/\b(kids|nick|spongebob|cartoon|disney|junior|jr|family)\b/.test(lower)) {
    return "Kids & Family";
  }
  if (/\b(radio|music|chill|pop|juice|hits|jazz|rock|melo|beats)\b/.test(lower)) {
    return "Music & Audio";
  }
  if (/\b(truck|motor|gear|car|auto|rig|highway)\b/.test(lower)) {
    return "Automotive";
  }
  if (
    /\b(crime|murder|cops|csi|ghost|paranormal|haunt|vet|emergency|rescue|history|warfare|wild|science|myth|doc)\b/.test(
      lower
    )
  ) {
    return "Documentary & Factual";
  }
  if (/\b(food|cook|chef|kitchen|house|home|garden|design|fashion|runway|deck|real housewives|pawn)\b/.test(lower)) {
    return "Lifestyle & Reality";
  }
  if (/\b(shop|shopping|tvsn|qvc)\b/.test(lower)) {
    return "Shopping & Special";
  }
  return "Entertainment & Drama";
}

/**
 * Fast O(1) lookup returning a channel's category (with intelligent keyword fallback).
 */
export function getChannelCategory(channelName: string): string {
  const key = normalizeChannelName(channelName);
  if (!key) return "Entertainment & Drama";
  return NORMALIZED_CATEGORY_INDEX.get(key) || inferCategoryByKeywords(channelName);
}

/**
 * Returns icon, badge style, and description metadata for any category name.
 */
export function getCategoryMeta(categoryName: string): ChannelCategoryMeta {
  return (
    CHANNEL_CATEGORY_META[categoryName] || {
      id: categoryName || "Entertainment & Drama",
      icon: "📺",
      shortLabel: categoryName || "Live TV",
      description: "Live broadcast television and streaming channels.",
      accentBadgeClass: "bg-slate-900/80 text-slate-200 border-white/15",
      kidsSafeDefault: true,
    }
  );
}

/**
 * Returns all channels matching a specific category tab (case & punctuation insensitive).
 */
export function getChannelsByCategoryName<
  T extends { title?: string; name?: string }
>(categoryName: string, allChannels: T[]): T[] {
  if (!categoryName || categoryName === "All" || categoryName === "All Genres") {
    return allChannels;
  }

  const targetChannelNames = channelCategories[categoryName] || [];
  const targetSet = new Set(targetChannelNames.map(normalizeChannelName));

  return allChannels.filter((c) => {
    const chTitle = c.title || c.name || "";
    const norm = normalizeChannelName(chTitle);
    return targetSet.has(norm) || getChannelCategory(chTitle) === categoryName;
  });
}

/**
 * Returns live channel counts per genre category for analytics or badge counters.
 */
export function getCategoryBreakdown<
  T extends { title?: string; name?: string }
>(allChannels: T[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const cat of Object.keys(channelCategories)) {
    counts[cat] = 0;
  }
  for (const ch of allChannels) {
    const cat = getChannelCategory(ch.title || ch.name || "");
    counts[cat] = (counts[cat] || 0) + 1;
  }
  return counts;
}

/**
 * Finds related channels in the same genre category (great for Live Player "More Like This").
 */
export function getRelatedChannels<
  T extends { channelId?: string; title?: string; name?: string }
>(currentChannelName: string, allChannels: T[], limit = 6): T[] {
  const targetCategory = getChannelCategory(currentChannelName);
  const currentNorm = normalizeChannelName(currentChannelName);
  const matches: T[] = [];
  const seen = new Set<string>([currentNorm]);

  for (const ch of allChannels) {
    const chTitle = ch.title || ch.name || "";
    const norm = normalizeChannelName(chTitle);
    if (!norm || seen.has(norm)) continue;
    if (getChannelCategory(chTitle) === targetCategory) {
      seen.add(norm);
      matches.push(ch);
      if (matches.length >= limit) break;
    }
  }
  return matches;
}

/**
 * Checks whether a category is generally kid-safe by default.
 */
export function isChannelCategoryKidsSafe(categoryName: string): boolean {
  return getCategoryMeta(categoryName).kidsSafeDefault;
}
