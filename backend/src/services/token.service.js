import { createHash, randomBytes } from 'node:crypto';
import { supabase } from '../config/supabase.js';
import { unwrap } from '../utils/db.js';
import { badRequest } from '../utils/AppError.js';

const TTL_MINUTES = { verify_email: 24 * 60, reset_password: 60 };

const hash = (token) => createHash('sha256').update(token).digest('hex');

/** Create a one-time token. Only its SHA-256 hash is stored; older unused tokens of the same type are revoked. */
export async function createAuthToken(userId, type) {
  unwrap(await supabase.from('auth_tokens').delete().eq('user_id', userId).eq('type', type).is('used_at', null));
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + TTL_MINUTES[type] * 60_000).toISOString();
  unwrap(await supabase.from('auth_tokens').insert({ user_id: userId, type, token_hash: hash(token), expires_at: expiresAt }));
  return token;
}

/** Atomically mark a token as used and return its user id. */
export async function consumeAuthToken(token, type) {
  const data = unwrap(
    await supabase
      .from('auth_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('token_hash', hash(token))
      .eq('type', type)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .select('user_id')
      .maybeSingle()
  );
  if (!data) {
    throw badRequest(
      type === 'verify_email'
        ? 'This verification link is invalid or has expired. Request a new one.'
        : 'This reset link is invalid or has expired. Request a new one.'
    );
  }
  return data.user_id;
}
