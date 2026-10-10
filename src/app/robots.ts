import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/legal';

// Search engines may index the menus and the legal pages; battles, rooms and the dev pages are
// addresses with state in them (a level, a room code, a friend's challenge), not pages worth listing
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/play', '/pvp?', '/dev/'] },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL
  };
}
