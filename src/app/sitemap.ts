import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/legal';

// The game's public pages, for search engines (robots.ts points to it)
const PAGES: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] }[] = [
  { path: '', priority: 1, changeFrequency: 'weekly' },
  { path: '/campaign', priority: 0.8, changeFrequency: 'weekly' },
  { path: '/pvp', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/army', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/bestiary', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/privacy', priority: 0.2, changeFrequency: 'yearly' },
  { path: '/terms', priority: 0.2, changeFrequency: 'yearly' }
];

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.map(({ path, priority, changeFrequency }) => ({ url: `${SITE_URL}${path}`, changeFrequency, priority }));
}
