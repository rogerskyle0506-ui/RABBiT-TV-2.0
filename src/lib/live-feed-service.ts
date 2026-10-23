// src/lib/live-feed-service.ts
import axios from 'axios';

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
    const response = await axios.get(LIVE_FEED_URL);
    const channels = response.data.channels || {};
    const groups = new Set<string>();

    Object.values(channels).forEach((channel: any) => {
      if (channel.groups && channel.groups.length > 0) {
        groups.add(channel.groups[0]);
      }
    });

    return Array.from(groups).sort();
  } catch (error) {
    console.error('Failed to fetch live categories:', error);
    return ['Sports', 'News', 'Entertainment', 'Local'];
  }
}

export async function fetchChannelsByCategory(categoryName: string): Promise<LiveChannel[]> {
  try {
    const response = await axios.get(LIVE_FEED_URL);
    const channels = response.data.channels || {};
    const results: LiveChannel[] = [];

    Object.entries(channels).forEach(([id, channel]: [string, any]) => {
      if (channel.groups && channel.groups.includes(categoryName)) {
        results.push({
          id,
          title: channel.name || 'Unknown Channel',
          logo: channel.logo || '',
          streamUrl: channel.url || '',
          category: categoryName,
        });
      }
    });

    return results.sort((a, b) => a.title.localeCompare(b.title));
  } catch (error) {
    console.error(`Failed to fetch channels for category ${categoryName}:`, error);
    return [];
  }
}
