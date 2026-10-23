// src/lib/live-feed-service.ts
export interface LiveChannel {
  id: string;
  title: string;
  logo: string;
  streamUrl: string;
  category: string;
  provider?: string;
}

// Guaranteed fallback channels so the UI instantly populates even if offline or blocked
const FALLBACK_CHANNELS: LiveChannel[] = [
  {
    id: 'sample-1',
    title: 'NASA TV Live',
    logo: 'https://www.nasa.gov/wp-content/themes/nasa/assets/images/nasa-logo.svg',
    streamUrl: 'https://ntv1.nasa.gov/hls/live/511628/NASA-NTV1-HLS/master.m3u8',
    category: 'News',
  },
  {
    id: 'sample-2',
    title: 'Red Bull TV',
    logo: 'https://image.redbull.com/rbcom/0105/0/000/1/545/657/1200/logo/red-bull-tv-logo.png',
    streamUrl: 'https://rbmn-live.akamaized.net/hls/live/590964/redbull-app-de/index.m3u8',
    category: 'Sports',
  },
  {
    id: 'sample-3',
    title: 'Big Buck Bunny (Test Stream)',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/c/c5/Big_buck_bunny_poster_big.jpg',
    streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    category: 'Entertainment',
  }
];

const PROVIDER_URLS = [
  // Master Raw M3U Playlists
  'https://i.mjh.nz/all/raw-tv.m3u8',
  'https://i.mjh.nz/all/kodi-tv.m3u8',
  
  // Sports & Premium Providers
  'https://i.mjh.nz/Kayo/app.json',
  'https://i.mjh.nz/SkySportNow/app.json',
  'https://i.mjh.nz/Foxtel/app.json',
  'https://i.mjh.nz/Binge/app.json',
  
  // Standard TV & Streaming Manifests
  'https://i.mjh.nz/PlutoTV/app.json',
  'https://i.mjh.nz/SamsungTVPlus/app.json',
  'https://i.mjh.nz/Plex/app.json',
  'https://i.mjh.nz/MeTV/app.json',
  'https://i.mjh.nz/Roku/app.json',
  'https://i.mjh.nz/HGTV/app.json',
  'https://i.mjh.nz/PBS/app.json',
  'https://i.mjh.nz/DStv/app.json',
  'https://i.mjh.nz/Singtel/app.json',
  'https://i.mjh.nz/SkyGo/app.json',
  'https://i.mjh.nz/frndly_tv/app.json',
];

// Parser for M3U / M3U8 text playlists
function parseM3U(text: string): any[] {
  const lines = text.split('\n');
  const channels: any[] = [];
  let currentChannel: any = {};

  for (let line of lines) {
    line = line.trim();
    if (line.startsWith('#EXTINF:')) {
      currentChannel = {};
      
      const logoMatch = line.match(/tvg-logo="([^"]+)"/);
      if (logoMatch) currentChannel.logo = logoMatch[1];

      const groupMatch = line.match(/group-title="([^"]+)"/);
      if (groupMatch) {
        currentChannel.category = groupMatch[1];
      } else {
        currentChannel.category = 'General';
      }

      const commaIndex = line.lastIndexOf(',');
      if (commaIndex !== -1) {
        currentChannel.title = line.substring(commaIndex + 1).trim();
      }
    } else if (line && !line.startsWith('#')) {
      if (currentChannel.title) {
        currentChannel.url = line;
        currentChannel.id = `${channels.length}-${currentChannel.title}`;
        channels.push(currentChannel);
        currentChannel = {};
      }
    }
  }
  return channels;
}

async function fetchAllRawChannels(): Promise<any[]> {
  try {
    const promises = PROVIDER_URLS.map(async (url) => {
      try {
        const res = await fetch(url);
        if (!res.ok) return [];
        const text = await res.text();

        // Handle M3U/M3U8 playlists
        if (url.includes('.m3u') || text.startsWith('#EXTM3U') || text.includes('#EXTINF:')) {
          return parseM3U(text);
        }

        // Handle JSON manifests
        const data = JSON.parse(text);
        let rawList: any[] = [];

        if (Array.isArray(data)) {
          rawList = data;
        } else if (data && typeof data === 'object') {
          const candidate = data.channels || data.items || data.data || data;
          if (Array.isArray(candidate)) {
            rawList = candidate;
          } else if (typeof candidate === 'object') {
            rawList = Object.entries(candidate).map(([key, val]: [string, any]) => ({
              id: val?.id || key,
              ...(typeof val === 'object' && val !== null ? val : { title: String(val) }),
            }));
          }
        }

        return rawList;
      } catch (e) {
        return [];
      }
    });

    const results = await Promise.all(promises);
    const fetched = results.flat().filter(Boolean);

    const mappedFetched: LiveChannel[] = fetched.map((channel: any, index: number) => {
      const streamUrl = 
        channel.url || 
        channel.streamUrl || 
        channel.stream || 
        (Array.isArray(channel.playlist) && channel.playlist[0]) || 
        (typeof channel.playlist === 'string' ? channel.playlist : '') || 
        '';
      
      const rawCategory = channel.category || channel.group || (Array.isArray(channel.groups) ? channel.groups[0] : 'General');

      return {
        id: String(channel.id || channel.tvg_id || `fetched-${index}`),
        title: channel.name || channel.title || channel.tvg_name || channel.displayName || `Channel ${index + 1}`,
        logo: channel.logo || channel.tvg_logo || channel.icon || '',
        streamUrl,
        category: typeof rawCategory === 'string' ? rawCategory : 'General',
      };
    }).filter(c => c.streamUrl);

    return [...mappedFetched, ...FALLBACK_CHANNELS];
  } catch (error) {
    console.error('Failed to aggregate feeds, falling back to defaults:', error);
    return FALLBACK_CHANNELS;
  }
}

export async function fetchLiveCategories(): Promise<string[]> {
  try {
    const channels = await fetchAllRawChannels();
    const groups = new Set<string>();

    channels.forEach((c) => {
      if (c.category) groups.add(c.category.trim());
    });

    const categoryArray = Array.from(groups).sort();
    return ['All', 'Sports', ...categoryArray.filter(c => c !== 'All' && c !== 'Sports')];
  } catch (e) {
    return ['All', 'Sports', 'News', 'Entertainment', 'General'];
  }
}

export async function fetchChannelsByCategory(categoryName: string): Promise<LiveChannel[]> {
  try {
    const channels = await fetchAllRawChannels();
    const seenUrls = new Set<string>();
    const uniqueChannels = channels.filter(c => {
      if (!c.streamUrl || seenUrls.has(c.streamUrl)) return false;
      seenUrls.add(c.streamUrl);
      return true;
    });

    if (categoryName === 'All' || categoryName === 'All (Default)') {
      return uniqueChannels.sort((a, b) => a.title.localeCompare(b.title));
    }

    const filtered = uniqueChannels.filter((c) => 
      c.category.toLowerCase().includes(categoryName.toLowerCase()) ||
      c.title.toLowerCase().includes(categoryName.toLowerCase())
    );

    return filtered.length > 0 ? filtered.sort((a, b) => a.title.localeCompare(b.title)) : uniqueChannels;
  } catch (error) {
    console.error(`Failed to fetch channels for category ${categoryName}:`, error);
    return FALLBACK_CHANNELS;
  }
}
