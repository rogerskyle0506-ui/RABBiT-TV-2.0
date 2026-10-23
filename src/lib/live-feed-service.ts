// src/lib/live-feed-service.ts
export interface LiveChannel {
  id: string;
  title: string;
  logo: string;
  streamUrl: string;
  category: string;
  provider?: string;
}

const PROVIDER_URLS = [
  // Master Raw M3U Playlist from /all/ directory
  'https://i.mjh.nz/all/raw-tv.m3u8',
  
  // JSON App Manifests
  'https://i.mjh.nz/PlutoTV/app.json',
  'https://i.mjh.nz/SamsungTVPlus/app.json',
  'https://i.mjh.nz/Plex/app.json',
  'https://i.mjh.nz/MeTV/app.json',
  'https://i.mjh.nz/Roku/app.json',
  'https://i.mjh.nz/HGTV/app.json',
  'https://i.mjh.nz/Binge/app.json',
  'https://i.mjh.nz/Kayo/app.json',
  'https://i.mjh.nz/PBS/app.json',
  'https://i.mjh.nz/DStv/app.json',
  'https://i.mjh.nz/Foxtel/app.json',
  'https://i.mjh.nz/Singtel/app.json',
  'https://i.mjh.nz/SkyGo/app.json',
  'https://i.mjh.nz/SkySportNow/app.json',
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
        currentChannel.groups = [groupMatch[1]];
      } else {
        currentChannel.groups = ['General'];
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

        // Automatic format detection for M3U/M3U8 vs JSON
        if (url.includes('.m3u') || text.startsWith('#EXTM3U') || text.includes('#EXTINF:')) {
          return parseM3U(text);
        }

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
    return results.flat().filter(Boolean);
  } catch (error) {
    console.error('Failed to aggregate raw live channels feeds:', error);
    return [];
  }
}

export async function fetchLiveCategories(): Promise<string[]> {
  try {
    const channels = await fetchAllRawChannels();
    const groups = new Set<string>();

    channels.forEach((channel: any) => {
      const channelGroups = 
        channel.groups || 
        channel.group || 
        (channel.category ? [channel.category] : null) || 
        (channel.genre ? [channel.genre] : null) || 
        ['General'];

      if (Array.isArray(channelGroups)) {
        channelGroups.forEach((g) => {
          if (g) groups.add(String(g).trim());
        });
      } else if (typeof channelGroups === 'string') {
        groups.add(channelGroups.trim());
      }
    });

    const categoryArray = Array.from(groups).sort();
    return categoryArray.length > 0 ? categoryArray : ['All', 'Sports', 'News', 'Entertainment', 'General'];
  } catch (error) {
    console.error('Failed to parse aggregated live categories:', error);
    return ['All', 'Sports', 'News', 'Entertainment', 'General'];
  }
}

export async function fetchChannelsByCategory(categoryName: string): Promise<LiveChannel[]> {
  try {
    const channels = await fetchAllRawChannels();
    const results: LiveChannel[] = [];
    const seenUrls = new Set<string>();

    channels.forEach((channel: any, index: number) => {
      const channelGroups = 
        channel.groups || 
        channel.group || 
        (channel.category ? [channel.category] : []) || 
        (channel.genre ? [channel.genre] : []) || 
        ['General'];

      const groupList = Array.isArray(channelGroups) 
        ? channelGroups.map((g) => String(g).trim().toLowerCase()) 
        : [String(channelGroups).trim().toLowerCase()];

      const matchesCategory =
        categoryName === 'All' ||
        categoryName === 'All (Default)' ||
        groupList.includes(categoryName.toLowerCase());

      if (matchesCategory) {
        const streamUrl = 
          channel.url || 
          channel.streamUrl || 
          channel.stream || 
          (Array.isArray(channel.playlist) && channel.playlist[0]) || 
          (typeof channel.playlist === 'string' ? channel.playlist : '') || 
          '';

        if (streamUrl && !seenUrls.has(streamUrl)) {
          seenUrls.add(streamUrl);
          results.push({
            id: String(channel.id || channel.tvg_id || `${index}-${Math.random()}`),
            title: channel.name || channel.title || channel.tvg_name || channel.displayName || `Channel ${index + 1}`,
            logo: channel.logo || channel.tvg_logo || channel.icon || '',
            streamUrl,
            category: Array.isArray(channelGroups) ? channelGroups[0] : categoryName,
          });
        }
      }
    });

    return results.sort((a, b) => a.title.localeCompare(b.title));
  } catch (error) {
    console.error(`Failed to fetch channels for category ${categoryName}:`, error);
    return [];
  }
}
