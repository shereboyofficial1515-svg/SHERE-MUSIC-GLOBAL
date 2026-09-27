import { supabase } from '../config/supabase.js';
import { unwrap } from '../utils/db.js';
import { toUser } from './mappers.js';
import { plusSummary } from './payments/plusEntitlement.service.js';

/** Login methods for a user: whether a password is set and which OAuth providers are linked. */
export async function loginMethods(userId) {
  const [pw, accounts] = await Promise.all([
    supabase.from('users').select('password_hash').eq('id', userId).single(),
    supabase.from('connected_accounts').select('provider,provider_email,created_at').eq('user_id', userId),
  ]);
  const rows = unwrap(accounts);
  return {
    hasPassword: Boolean(unwrap(pw).password_hash),
    providers: rows.map((r) => r.provider),
    accounts: rows.map((r) => ({ provider: r.provider, email: r.provider_email, connectedAt: r.created_at })),
  };
}

/** Full "me" payload for the frontend: profile + login methods. */
export async function toMe(userRow) {
  const [methods, plus] = await Promise.all([loginMethods(userRow.id), plusSummary(userRow.id)]);
  return { ...toUser(userRow, { providers: methods.providers, hasPassword: methods.hasPassword }), plus };
}
