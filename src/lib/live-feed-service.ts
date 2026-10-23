// src/lib/live-feed-service.ts
export interface LiveChannel {
  id: string;
  title: string;
  logo: string;
  streamUrl: string;
  category: string;
}

const LIVE_FEED_URL = 'https://i.mjh.nz/Stirr/app.json';

// Helper to safely parse and normalize channels from mjh.nz / Stirr formats
async function fetchRawChannels(): Promise<any[]> {
  try {
    const response = await fetch(LIVE_FEED_URL);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();

    // mjh.nz endpoints can return an array or an object map under .channels or root
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
  } catch (error) {
    console.error('Failed to fetch raw live channels feed:', error);
    return [];
  }
}

export async function fetchLiveCategories(): Promise<string[]> {
  try {
    const channels = await fetchRawChannels();
    const groups = new Set<string>();

    channels.forEach((channel: any) => {
      // Check various group/category property names used across mjh.nz schemas
      const channelGroups = 
        channel.groups || 
        channel.category ? [channel.category] : 
        channel.genre ? [channel.genre] : 
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
    console.error('Failed to parse live categories:', error);
    return ['All', 'Sports', 'News', 'Entertainment', 'General'];
  }
}

export async function fetchChannelsByCategory(categoryName: string): Promise<LiveChannel[]> {
  try {
    const channels = await fetchRawChannels();
    const results: LiveChannel[] = [];

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

        if (streamUrl) {
          results.push({
            id: String(channel.id || channel.tvg_id || index),
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
