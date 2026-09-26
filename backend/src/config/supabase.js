import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';

/**
 * Server-side Supabase client using the service-role key.
 * It bypasses Row Level Security, so it must only ever run on the backend.
 * All authorization decisions are made by this API before a query is issued.
 */
export const supabase = createClient(env.supabase.url, env.supabase.serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: { headers: { 'x-application-name': 'shere-music-api' } },
});
