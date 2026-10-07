'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { CampaignScreen } from '@/components/menu/CampaignScreen';

function CampaignContent() {
  const level = Number(useSearchParams().get('level')) || undefined;
  return <CampaignScreen initialLevel={level} />;
}

export default function CampaignPage() {
  return (
    <Suspense fallback={<div className="h-screen w-screen bg-sky-200" />}>
      <CampaignContent />
    </Suspense>
  );
}
