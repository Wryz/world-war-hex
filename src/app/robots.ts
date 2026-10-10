import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/legal';

// Search engines may index the menus and the legal pages. Battles and rooms stay crawlable, so shared
// challenge and invite links get their link previews, but ask not to be indexed (play/layout.tsx,
// pvp/layout.tsx); the dev pages are kept out
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/dev/'] },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL
  };
}
