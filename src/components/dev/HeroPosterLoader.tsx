'use client';

import dynamic from 'next/dynamic';

// The 3D island only runs in the browser
const IslandDiorama = dynamic(() => import('../game/intro/IslandDiorama'), { ssr: false });

// Drawn at the poster's size; the page is marked ready once the terrain and scenery are on screen
export const HeroPosterLoader: React.FC = () => (
  <div id="hero-poster" style={{ width: 1800, height: 900 }}>
    <IslandDiorama poster onReady={() => { document.body.dataset.ready = '1'; }} />
  </div>
);
