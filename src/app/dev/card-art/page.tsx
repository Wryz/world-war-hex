import { notFound } from 'next/navigation';
import { CardArtStudioLoader } from '@/components/dev/CardArtStudioLoader';
import { isTroopId } from '@/lib/game/troops';

// Dev only: one troop posed for its card portrait (scripts/render-card-art.mjs photographs it)
export const dynamic = 'force-dynamic';

export default async function Page({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const { type } = await searchParams;
  if (!type || !isTroopId(type)) notFound();
  return <CardArtStudioLoader type={type} />;
}
