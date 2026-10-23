// src/lib/live-feed-service.ts
export interface LiveChannel {
  id: string;
  title: string;
  logo: string;
  streamUrl: string;
  category: string;
  provider?: string;
}

// Comprehensive list pointing to every provider endpoint available in the repository index
const PROVIDER_URLS = [
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

async function fetchAllRawChannels(): Promise<any[]> {
  try {
    const promises = PROVIDER_URLS.map(async (url) => {
      try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const data = await res.json();
        const raw = data.channels || data.items || data;
        
        if (Array.isArray(raw)) {
          return raw;
        }
        if (raw && typeof raw === 'object') {
          return Object.entries(raw).map(([key, val]: [string, any]) => ({
            id: val.id || key,
            ...val,
          }));
        }
        return [];
      } catch (e) {
        // Skip any providers that fail or use a different file structure silently
        return null;
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
        (channel.category ? [channel.category] : null) || 
        (channel.genre ? [channel.genre] : null) || 
        ['General'];

      if (Array.isArray(channelGroups)) {
        channelGroups.forEach((g) => {
          if (g) groups.add(String(g));
        });
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
    const seenUrls = new Set<string>(); // Prevent duplicate streams

    channels.forEach((channel: any, index: number) => {
      const channelGroups = 
        channel.groups || 
        (channel.category ? [channel.category] : []) || 
        (channel.genre ? [channel.genre] : []) || 
        ['General'];

      const matchesCategory =
        categoryName === 'All' ||
        categoryName === 'All (Default)' ||
        (Array.isArray(channelGroups) && channelGroups.some((g) => String(g).toLowerCase() === categoryName.toLowerCase()));

      if (matchesCategory) {
        const streamUrl = 
          channel.url || 
          (Array.isArray(channel.playlist) && channel.playlist[0]) || 
          channel.streamUrl || 
          '';

        if (streamUrl && !seenUrls.has(streamUrl)) {
          seenUrls.add(streamUrl);
          results.push({
            id: String(channel.id || channel.tvg_id || `${index}-${Math.random()}`),
            title: channel.name || channel.title || channel.tvg_name || `Channel ${index + 1}`,
            logo: channel.logo || channel.tvg_logo || '',
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
