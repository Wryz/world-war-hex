import { createClient, SupabaseClient } from '@supabase/supabase-js';

// The game's Supabase project (online rooms). The publishable key is meant to be public: what anyone
// can do with it is decided by the database's own rules (supabase/migrations). Both can be overridden
// for another project with NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://yforzvoicnikfvzsvmjh.supabase.co';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_YFpFLkCHWNvUK44T8H-wpQ_myZghXQq';

let client: SupabaseClient | null = null;

// The one client the browser uses (its session is kept in localStorage)
export const getSupabase = (): SupabaseClient => {
  client ??= createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'hexhordes-auth' }
  });
  return client;
};

// The player's id online: an anonymous account made on this device the first time it's needed (it
// can become a full account later)
export const ensureSignedIn = async (): Promise<string> => {
  const supabase = getSupabase();
  const { data } = await supabase.auth.getSession();
  if (data.session?.user) return data.session.user.id;
  const { data: created, error } = await supabase.auth.signInAnonymously();
  if (error || !created.user) throw new Error(error?.message ?? 'Could not go online');
  return created.user.id;
};
