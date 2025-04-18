'use client';

import { GameController } from '@/components/game/GameController';

export default function Home() {
  return (
    <div className="w-screen h-screen bg-gray-900">
      <div className="w-full h-full">
        <GameController />
      </div>
    </div>
  );
}
