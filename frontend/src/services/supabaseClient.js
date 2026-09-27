import { createClient } from '@supabase/supabase-js';

/**
 * Browser Supabase client — used ONLY to run Google/Facebook sign-in through
 * Supabase Auth. The anon key is public by design (and our database grants it
 * nothing); all data access still goes through the SHERE MUSIC API.
 */
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const oauthConfigured = Boolean(url && anonKey);
export const supabaseAnonKey = anonKey || null;

export const supabase = oauthConfigured
  ? createClient(url, anonKey, {
      auth: { flowType: 'pkce', detectSessionInUrl: false, persistSession: true, autoRefreshToken: false, storageKey: 'sm-oauth' },
    })
  : null;

const INTENT_KEY = 'sm:oauth-intent';

/** Start Google/Facebook sign-in. `intent` is 'login' or 'link' (connect to the signed-in account). */
export async function startOAuth(provider, { intent = 'login', returnTo = '/' } = {}) {
  if (!supabase) throw new Error('Social sign-in is not configured yet.');
  sessionStorage.setItem(INTENT_KEY, JSON.stringify({ provider, intent, returnTo }));
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      scopes: provider === 'facebook' ? 'email public_profile' : 'email profile',
    },
  });
  if (error) throw error;
}

/** Finish the redirect: exchange the code for a Supabase session and return its access token. */
export async function finishOAuth() {
  const intent = JSON.parse(sessionStorage.getItem(INTENT_KEY) || 'null');
  sessionStorage.removeItem(INTENT_KEY);
  const params = new URLSearchParams(window.location.search);
  const providerError = params.get('error_description') || params.get('error');
  if (providerError) throw new Error(providerError.replace(/\+/g, ' '));
  const code = params.get('code');
  if (!supabase || !code || !intent) throw new Error('This sign-in link is incomplete. Please try again.');
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) throw error;
  const accessToken = data.session.access_token;
  // We only needed Supabase to verify the provider; SHERE MUSIC keeps its own session.
  supabase.auth.signOut({ scope: 'local' }).catch(() => {});
  return { ...intent, accessToken };
}
