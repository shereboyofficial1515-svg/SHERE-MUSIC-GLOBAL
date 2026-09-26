import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { supabase } from '../config/supabase.js';
import { forbidden, unauthorized } from '../utils/AppError.js';
import { dbError } from '../utils/db.js';
import { clearSession } from '../services/session.service.js';

export const USER_FIELDS =
  'id,name,email,role,avatar_path,email_verified,status,token_version,last_login_at,created_at,updated_at';

/**
 * Resolve the session cookie into a user on every request (req.user or null).
 * The user row is re-read each time so role changes, disabled accounts and
 * password resets (token_version bump) take effect immediately.
 */
export async function attachUser(req, res, next) {
  req.user = null;
  req.authError = null;
  const token = req.cookies?.[env.cookie.name];
  if (!token) return next();

  let payload;
  try {
    payload = jwt.verify(token, env.jwt.secret, { algorithms: ['HS256'] });
  } catch (err) {
    req.authError = err.name === 'TokenExpiredError' ? 'SESSION_EXPIRED' : 'INVALID_SESSION';
    clearSession(res);
    return next();
  }

  const { data: user, error } = await supabase.from('users').select(USER_FIELDS).eq('id', payload.sub).maybeSingle();
  if (error) return next(dbError(error));

  if (!user || user.token_version !== payload.tv) {
    req.authError = 'SESSION_EXPIRED';
    clearSession(res);
  } else if (user.status !== 'active') {
    req.authError = 'ACCOUNT_DISABLED';
    clearSession(res);
  } else {
    req.user = user;
  }
  next();
}

export function requireAuth(req, res, next) {
  if (req.user) return next();
  if (req.authError === 'ACCOUNT_DISABLED') {
    return next(forbidden('This account has been disabled. Contact support for help.', 'ACCOUNT_DISABLED'));
  }
  if (req.authError === 'SESSION_EXPIRED') {
    return next(unauthorized('Your session has expired. Please sign in again.', 'SESSION_EXPIRED'));
  }
  next(unauthorized());
}

export function requireAdmin(req, res, next) {
  requireAuth(req, res, (err) => {
    if (err) return next(err);
    if (req.user.role !== 'admin') return next(forbidden('Administrator access required.', 'ADMIN_ONLY'));
    next();
  });
}
