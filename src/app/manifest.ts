import type { MetadataRoute } from 'next';

// The web app manifest: with it (and the service worker in public/sw.js) browsers offer to
// install the game, which then opens full screen from the home screen or app list, offline too
export const dynamic = 'force-static';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Hex Hordes',
    short_name: 'Hex Hordes',
    description: 'A fantasy strategy card game on a 3D hex battlefield: play your troops, read the land and topple the enemy castle.',
    start_url: '/',
    scope: '/',
    display: 'fullscreen',
    display_override: ['fullscreen', 'standalone'],
    background_color: '#0f172a',
    theme_color: '#0f172a',
    categories: ['games', 'entertainment'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
    ]
  };
}
