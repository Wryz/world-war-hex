'use client';

import dynamic from 'next/dynamic';
import type { TroopId } from '@/lib/game/troops';

// The 3D studio only runs in the browser
const CardArtStudio = dynamic(() => import('./CardArtStudio'), { ssr: false });

export const CardArtStudioLoader: React.FC<{ type: TroopId }> = ({ type }) => <CardArtStudio type={type} />;
