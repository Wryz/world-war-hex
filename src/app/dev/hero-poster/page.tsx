import { notFound } from 'next/navigation';
import { HeroPosterLoader } from '@/components/dev/HeroPosterLoader';

// Dev only: the landing page's island, terrain alone and standing still, for its poster picture
// (scripts/render-hero-poster.mjs photographs it)
export const dynamic = 'force-dynamic';

export default function Page() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <HeroPosterLoader />;
}
