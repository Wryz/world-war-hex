// ads.txt names the ad networks allowed to sell ads on this site. AdSense needs it at the site root
// before it serves ads, so it is built from the same publisher ID the game's ads use.
export const dynamic = 'force-static';

export const GET = () => {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
  if (!client) return new Response('Not found\n', { status: 404 });
  return new Response(`google.com, ${client.replace(/^ca-/, '')}, DIRECT, f08c47fec0942fa0\n`, {
    headers: { 'content-type': 'text/plain; charset=utf-8' }
  });
};
