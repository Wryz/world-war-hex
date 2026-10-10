'use client';

import { Suspense } from 'react';
import { PvpScreen } from '@/components/arena/PvpScreen';

export default function Page() {
  return (
    <Suspense fallback={<div className="h-screen w-screen bg-sky-200" />}>
      <PvpScreen />
    </Suspense>
  );
}
