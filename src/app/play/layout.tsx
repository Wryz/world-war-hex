import type { Metadata } from 'next';

// A battle: an address with state in it (a level, a challenge, a room code), not a page for search
// engines to list - but crawlable, so a shared link still gets its preview
export const metadata: Metadata = { robots: { index: false } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
