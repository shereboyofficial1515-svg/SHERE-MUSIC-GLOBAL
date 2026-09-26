import bcrypt from 'bcryptjs';
import { supabase } from '../config/supabase.js';
import { USER_FIELDS } from '../middleware/auth.js';
import { AppError, badRequest, conflict, forbidden, unauthorized } from '../utils/AppError.js';
import { one, unwrap } from '../utils/db.js';
import { noContent, ok } from '../utils/http.js';
import { toUser } from '../services/mappers.js';
import { clearSession, issueSession } from '../services/session.service.js';
import { consumeAuthToken, createAuthToken } from '../services/token.service.js';
import { sendAccountNotification, sendPasswordResetEmail, sendVerificationEmail } from '../services/email.service.js';
import { getSettings } from '../services/settings.service.js';

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
  ok(res, toUser(updated));
}

export function logout(req, res) {
  clearSession(res);
  noContent(res);
}

export function me(req, res) {
  ok(res, req.user ? toUser(req.user) : null);
}

export async function verifyEmail(req, res) {
  const userId = await consumeAuthToken(req.valid.body.token, 'verify_email');
  const user = unwrap(
    await supabase.from('users').update({ email_verified: true }).eq('id', userId).select(USER_FIELDS).single()
  );
  if (user.status === 'active') issueSession(res, user);
  ok(res, toUser(user), { message: 'Email verified. Welcome to SHERE MUSIC!' });
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
  ok(res, toUser(user), { message: 'Password changed.' });
}
