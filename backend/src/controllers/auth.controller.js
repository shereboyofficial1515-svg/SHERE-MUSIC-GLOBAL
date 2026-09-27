import bcrypt from 'bcryptjs';
import { supabase } from '../config/supabase.js';
import { USER_FIELDS } from '../middleware/auth.js';
import { AppError, badRequest, conflict, forbidden, unauthorized } from '../utils/AppError.js';
import { dbError, one, unwrap } from '../utils/db.js';
import { noContent, ok } from '../utils/http.js';
import { clearSession, issueSession } from '../services/session.service.js';
import { consumeAuthToken, createAuthToken } from '../services/token.service.js';
import { sendAccountNotification, sendPasswordResetEmail, sendVerificationEmail } from '../services/email.service.js';
import { getSettings } from '../services/settings.service.js';
import { toMe } from '../services/account.service.js';

const BCRYPT_ROUNDS = 12;
// Used to keep login timing constant when the email does not exist.
const DUMMY_HASH = bcrypt.hashSync('shere-music-timing-guard', BCRYPT_ROUNDS);

const findByEmail = (email, fields = `${USER_FIELDS},password_hash`) =>
  supabase.from('users').select(fields).eq('email', email).maybeSingle();

export async function register(req, res) {
  const settings = await getSettings();
  if (!settings.allow_registration) throw forbidden('New registrations are currently closed.', 'REGISTRATION_CLOSED');

  const { name, email, password } = req.valid.body;
  const existing = unwrap(await findByEmail(email, 'id'));
  if (existing) throw conflict('An account with this email already exists. Try signing in instead.', 'EMAIL_TAKEN');

  const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user = unwrap(
    await supabase.from('users').insert({ name, email, password_hash }).select(USER_FIELDS).single()
  );

  try {
    const token = await createAuthToken(user.id, 'verify_email');
    await sendVerificationEmail(user, token);
  } catch (err) {
    console.error('[auth] Verification email failed:', err.message);
    return res.status(201).json({
      data: { email: user.email, emailSent: false },
      meta: { message: 'Account created, but we could not send the verification email. Use "Resend email" to try again.' },
    });
  }

  res.status(201).json({
    data: { email: user.email, emailSent: true },
    meta: { message: 'Account created. Check your inbox to verify your email address.' },
  });
}

export async function login(req, res) {
  const { email, password } = req.valid.body;
  const user = unwrap(await findByEmail(email));
  const valid = await bcrypt.compare(password, user?.password_hash || DUMMY_HASH);
  if (!user || !valid) throw unauthorized('Incorrect email or password.', 'INVALID_CREDENTIALS');
  if (user.status !== 'active') throw forbidden('This account has been disabled. Contact support for help.', 'ACCOUNT_DISABLED');
  if (!user.email_verified) {
    throw new AppError(403, 'Please verify your email address before signing in.', 'EMAIL_NOT_VERIFIED', { email: user.email });
  }

  const updated = unwrap(
    await supabase.from('users').update({ last_login_at: new Date().toISOString() }).eq('id', user.id).select(USER_FIELDS).single()
  );
  issueSession(res, updated);
  ok(res, await toMe(updated));
}

export function logout(req, res) {
  clearSession(res);
  noContent(res);
}

export async function me(req, res) {
  ok(res, req.user ? await toMe(req.user) : null);
}

export async function verifyEmail(req, res) {
  const userId = await consumeAuthToken(req.valid.body.token, 'verify_email');
  const user = unwrap(
    await supabase.from('users').update({ email_verified: true }).eq('id', userId).select(USER_FIELDS).single()
  );
  if (user.status === 'active') issueSession(res, user);
  ok(res, await toMe(user), { message: 'Email verified. Welcome to SHERE MUSIC!' });
}

/** Always answers the same way so the endpoint cannot be used to discover registered emails. */
export async function resendVerification(req, res) {
  const user = unwrap(await findByEmail(req.valid.body.email, 'id,name,email,email_verified,status'));
  if (user && !user.email_verified && user.status === 'active') {
    const token = await createAuthToken(user.id, 'verify_email');
    await sendVerificationEmail(user, token).catch((err) => console.error('[auth] Resend verification failed:', err.message));
  }
  ok(res, null, { message: 'If that account needs verification, a new email is on its way.' });
}

export async function forgotPassword(req, res) {
  const user = unwrap(await findByEmail(req.valid.body.email, 'id,name,email,status'));
  if (user && user.status === 'active') {
    const token = await createAuthToken(user.id, 'reset_password');
    await sendPasswordResetEmail(user, token).catch((err) => console.error('[auth] Reset email failed:', err.message));
  }
  ok(res, null, { message: 'If an account exists for that email, a reset link is on its way.' });
}

export async function resetPassword(req, res) {
  const { token, password } = req.valid.body;
  const userId = await consumeAuthToken(token, 'reset_password');
  const current = await one(supabase.from('users').select('token_version').eq('id', userId), 'Account not found.');
  const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  // Bumping token_version signs out every existing session. A reset link proves inbox access, so it also verifies the email.
  const user = unwrap(
    await supabase
      .from('users')
      .update({ password_hash, token_version: current.token_version + 1, email_verified: true })
      .eq('id', userId)
      .select(USER_FIELDS)
      .single()
  );
  clearSession(res);
  sendAccountNotification(user, {
    heading: 'Your password was changed',
    message: 'The password for your account was just reset. All other sessions have been signed out.',
  });
  ok(res, null, { message: 'Password updated. You can now sign in with your new password.' });
}

export async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.valid.body;
  const row = await one(supabase.from('users').select('password_hash,token_version').eq('id', req.user.id));
  if (!row.password_hash) throw badRequest('Your account does not have a password yet. Use "Set a password" instead.');
  if (!(await bcrypt.compare(currentPassword, row.password_hash))) {
    throw badRequest('Your current password is incorrect.', [{ field: 'currentPassword', message: 'Incorrect password.' }]);
  }
  const password_hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  const user = unwrap(
    await supabase
      .from('users')
      .update({ password_hash, token_version: row.token_version + 1 })
      .eq('id', req.user.id)
      .select(USER_FIELDS)
      .single()
  );
  issueSession(res, user); // keep this device signed in, sign out all others
  sendAccountNotification(user, {
    heading: 'Your password was changed',
    message: 'Your account password was changed. Other devices have been signed out.',
  });
  ok(res, await toMe(user), { message: 'Password changed.' });
}

// ─── Email change confirmation ─────────────────────────────────────────────
export async function confirmEmailChange(req, res) {
  const userId = await consumeAuthToken(req.valid.body.token, 'change_email');
  const current = await one(supabase.from('users').select('id,name,email,pending_email').eq('id', userId), 'Account not found.');
  if (!current.pending_email) throw badRequest('There is no pending email change for this account.');
  const taken = unwrap(await supabase.from('users').select('id').eq('email', current.pending_email).neq('id', userId).maybeSingle());
  if (taken) throw conflict('Another account now uses that email address.', 'EMAIL_TAKEN');
  const user = unwrap(
    await supabase
      .from('users')
      .update({ email: current.pending_email, pending_email: null, email_verified: true })
      .eq('id', userId)
      .select(USER_FIELDS)
      .single()
  );
  // Tell the old address, in case the change was not expected.
  sendAccountNotification(
    { name: current.name, email: current.email },
    { heading: 'Your email address was changed', message: `Your account email is now ${user.email}. If you did not do this, contact support immediately.` }
  );
  ok(res, await toMe(user), { message: 'Email address updated.' });
}

// ─── Google / Facebook (Supabase Auth OAuth) ──────────────────────────────
/**
 * The browser completes Google/Facebook sign-in with Supabase Auth and sends
 * us the resulting Supabase access token. We verify it with Supabase (never
 * trusting client-supplied identity fields), then find or create the matching
 * SHERE MUSIC account and start our own cookie session.
 */
async function verifiedIdentity(accessToken, provider) {
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data?.user) throw unauthorized('Sign-in could not be verified. Please try again.', 'OAUTH_INVALID');
  const identity = (data.user.identities || []).find((i) => i.provider === provider);
  if (!identity) throw unauthorized('Sign-in could not be verified. Please try again.', 'OAUTH_INVALID');
  const info = identity.identity_data || {};
  const email = String(info.email || data.user.email || '').trim().toLowerCase();
  if (!email) {
    throw badRequest(
      `Your ${provider === 'google' ? 'Google' : 'Facebook'} account did not share an email address. Allow email access, or sign up with email instead.`
    );
  }
  return {
    provider,
    providerUserId: String(info.sub || info.provider_id || identity.id),
    email,
    emailVerified: info.email_verified !== false && Boolean(data.user.email_confirmed_at || info.email_verified),
    name: String(info.full_name || info.name || email.split('@')[0]).slice(0, 80),
  };
}

const providerLabel = (p) => (p === 'google' ? 'Google' : 'Facebook');

export async function oauthSignIn(req, res) {
  const { provider } = req.valid.params;
  const identity = await verifiedIdentity(req.valid.body.accessToken, provider);

  // 1. Already linked → sign in that account.
  const link = unwrap(
    await supabase.from('connected_accounts').select('user_id').eq('provider', provider).eq('provider_user_id', identity.providerUserId).maybeSingle()
  );
  let user = link ? unwrap(await supabase.from('users').select(USER_FIELDS).eq('id', link.user_id).maybeSingle()) : null;
  let created = false;

  // 2. Existing account with the same (verified) email → link it, don't duplicate.
  if (!user) {
    const existing = unwrap(await findByEmail(identity.email, USER_FIELDS));
    if (existing) {
      if (!identity.emailVerified) {
        throw forbidden(
          `An account already uses ${identity.email}. Sign in with your password, then connect ${providerLabel(provider)} in Settings → Connected accounts.`,
          'LINK_REQUIRED'
        );
      }
      user = existing;
    }
  }

  // 3. Brand-new listener.
  if (!user) {
    const settings = await getSettings();
    if (!settings.allow_registration) throw forbidden('New registrations are currently closed.', 'REGISTRATION_CLOSED');
    const { data, error } = await supabase
      .from('users')
      .insert({ name: identity.name, email: identity.email, password_hash: null, email_verified: identity.emailVerified })
      .select(USER_FIELDS)
      .single();
    if (error?.code === '23505') throw conflict('An account with this email already exists. Sign in instead.', 'EMAIL_TAKEN');
    if (error) throw dbError(error);
    user = data;
    created = true;
  }

  if (user.status !== 'active') throw forbidden('This account has been disabled. Contact support for help.', 'ACCOUNT_DISABLED');

  if (!link) {
    const { error } = await supabase
      .from('connected_accounts')
      .upsert({ user_id: user.id, provider, provider_user_id: identity.providerUserId, provider_email: identity.email }, { onConflict: 'user_id,provider' });
    if (error) throw dbError(error);
  }

  if (!user.email_verified) {
    const token = await createAuthToken(user.id, 'verify_email');
    await sendVerificationEmail(user, token).catch((err) => console.error('[auth] verification email failed:', err.message));
    throw new AppError(403, 'Please verify your email address. We sent you a link.', 'EMAIL_NOT_VERIFIED', { email: user.email });
  }

  const updated = unwrap(
    await supabase.from('users').update({ last_login_at: new Date().toISOString() }).eq('id', user.id).select(USER_FIELDS).single()
  );
  issueSession(res, updated);
  ok(res, await toMe(updated), { created, message: created ? 'Welcome to SHERE MUSIC!' : undefined });
}

/** Connect Google/Facebook to the signed-in account. */
export async function oauthLink(req, res) {
  const { provider } = req.valid.params;
  const identity = await verifiedIdentity(req.valid.body.accessToken, provider);
  const other = unwrap(
    await supabase.from('connected_accounts').select('user_id').eq('provider', provider).eq('provider_user_id', identity.providerUserId).maybeSingle()
  );
  if (other && other.user_id !== req.user.id) {
    throw conflict(`That ${providerLabel(provider)} account is already connected to a different SHERE MUSIC account.`, 'ALREADY_LINKED');
  }
  const { error } = await supabase
    .from('connected_accounts')
    .upsert({ user_id: req.user.id, provider, provider_user_id: identity.providerUserId, provider_email: identity.email }, { onConflict: 'user_id,provider' });
  if (error?.code === '23505') throw conflict(`That ${providerLabel(provider)} account is already connected elsewhere.`, 'ALREADY_LINKED');
  if (error) throw dbError(error);
  sendAccountNotification(req.user, { heading: `${providerLabel(provider)} connected`, message: `You can now sign in with ${providerLabel(provider)}.` });
  ok(res, await toMe(req.user), { message: `${providerLabel(provider)} connected.` });
}
