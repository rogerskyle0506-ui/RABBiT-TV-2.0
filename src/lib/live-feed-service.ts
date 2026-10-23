// src/lib/live-feed-service.ts
export interface LiveChannel {
  id: string;
  title: string;
  logo: string;
  streamUrl: string;
  category: string;
}

const LIVE_FEED_URL = 'https://i.mjh.nz/Stirr/app.json';

export async function fetchLiveCategories(): Promise<string[]> {
  try {
    const response = await fetch(LIVE_FEED_URL);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    const data = await response.json();
    const rawChannels = data.channels || data || {};
    const groups = new Set<string>();

    const channelList = Array.isArray(rawChannels) 
      ? rawChannels 
      : Object.values(rawChannels);

    channelList.forEach((channel: any) => {
      const channelGroups = channel.groups || (channel.category ? [channel.category] : []);
      if (channelGroups && channelGroups.length > 0) {
        channelGroups.forEach((g: string) => groups.add(g));
      }
    });

    const categoryArray = Array.from(groups).sort();
    return categoryArray.length > 0 ? categoryArray : ['Sports', 'News', 'Entertainment', 'Local'];
  } catch (error) {
    console.error('Failed to fetch live categories:', error);
    return ['Sports', 'News', 'Entertainment', 'Local'];
  }
}

export async function fetchChannelsByCategory(categoryName: string): Promise<LiveChannel[]> {
  try {
    const response = await fetch(LIVE_FEED_URL);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const data = await response.json();
    const rawChannels = data.channels || data || {};
    const results: LiveChannel[] = [];

    const entries = Array.isArray(rawChannels)
      ? rawChannels.map((c, idx) => [String(c.id || idx), c] as [string, any])
      : Object.entries(rawChannels);

    entries.forEach(([id, channel]: [string, any]) => {
      const channelGroups = channel.groups || (channel.category ? [channel.category] : []);
      
      if (
        categoryName === 'All' || 
        categoryName === 'All (Default)' ||
        (channelGroups && channelGroups.includes(categoryName))
      ) {
        results.push({
          id,
          title: channel.name || channel.title || 'Unknown Channel',
          logo: channel.logo || channel.tvg_logo || '',
          streamUrl: channel.url || (channel.playlist && channel.playlist[0]) || '',
          category: channelGroups[0] || categoryName,
        });
      }
    });

    return results.sort((a, b) => a.title.localeCompare(b.title));
  } catch (error) {
    console.error(`Failed to fetch channels for category ${categoryName}:`, error);
    return [];
  }
}
