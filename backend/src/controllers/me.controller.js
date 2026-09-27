import bcrypt from 'bcryptjs';
import { supabase } from '../config/supabase.js';
import { USER_FIELDS } from '../middleware/auth.js';
import { badRequest, conflict } from '../utils/AppError.js';
import { dbError, one, unwrap } from '../utils/db.js';
import { noContent, ok } from '../utils/http.js';
import { FOLDERS, removeMedia, withUploadCleanup } from '../services/storage.service.js';
import { getSettings, uploadLimits } from '../services/settings.service.js';
import { clearSession, issueSession } from '../services/session.service.js';
import { getUserSettingsRow, toSettings, updateUserSettings } from '../services/userSettings.service.js';
import { loginMethods, toMe } from '../services/account.service.js';
import { createAuthToken } from '../services/token.service.js';
import { sendAccountNotification, sendEmailChangeConfirmation } from '../services/email.service.js';
import { AppError } from '../utils/AppError.js';

const BCRYPT_ROUNDS = 12;

const count = async (table, userId) => {
  const { count: n, error } = await supabase.from(table).select('id', { count: 'exact', head: true }).eq('user_id', userId);
  if (error) throw dbError(error);
  return n ?? 0;
};

export async function profile(req, res) {
  const [favorites, playlists, downloads, plays] = await Promise.all([
    count('favorites', req.user.id),
    count('playlists', req.user.id),
    count('downloads', req.user.id),
    count('plays', req.user.id),
  ]);
  const [me, following] = await Promise.all([
    toMe(req.user),
    supabase.from('artist_followers').select('id', { count: 'exact', head: true }).eq('user_id', req.user.id),
  ]);
  ok(res, { ...me, stats: { favorites, playlists, downloads, plays, following: following.count ?? 0 } });
}

const PROFILE_COLUMNS = {
  name: 'name',
  username: 'username',
  bio: 'bio',
  location: 'location',
  website: 'website',
  socialLinks: 'social_links',
  favoriteGenreIds: 'favorite_genre_ids',
};

export async function updateProfile(req, res) {
  const body = req.valid.body;
  const patch = {};
  for (const [key, column] of Object.entries(PROFILE_COLUMNS)) if (body[key] !== undefined) patch[column] = body[key];
  if (patch.social_links) patch.social_links = Object.fromEntries(Object.entries(patch.social_links).filter(([, v]) => v));
  if (!Object.keys(patch).length) throw badRequest('Nothing to update.');
  const { data, error } = await supabase.from('users').update(patch).eq('id', req.user.id).select(USER_FIELDS).single();
  if (error?.code === '23505') throw badRequest('That username is taken. Try another.', [{ field: 'username', message: 'That username is taken.' }]);
  if (error) throw dbError(error);
  ok(res, await toMe(data), { message: 'Profile updated.' });
}

// ─── Settings ──────────────────────────────────────────────────────────────
export async function getMySettings(req, res) {
  ok(res, toSettings(await getUserSettingsRow(req.user.id)));
}

export async function updateMySettings(req, res) {
  ok(res, await updateUserSettings(req.user.id, req.valid.body), { message: 'Settings saved.' });
}

// ─── Security ──────────────────────────────────────────────────────────────
/** Users with a password must confirm it for sensitive changes. */
async function confirmPassword(userId, password) {
  const row = await one(supabase.from('users').select('password_hash').eq('id', userId));
  if (!row.password_hash) return;
  if (!password || !(await bcrypt.compare(password, row.password_hash))) {
    throw badRequest('Your password is incorrect.', [{ field: 'password', message: 'Incorrect password.' }]);
  }
}

/** Start an email change: a confirmation link goes to the new address. */
export async function requestEmailChange(req, res) {
  const { email, password } = req.valid.body;
  await confirmPassword(req.user.id, password);
  if (email === String(req.user.email).toLowerCase()) throw badRequest('That is already your email address.');
  const taken = unwrap(await supabase.from('users').select('id').eq('email', email).maybeSingle());
  if (taken) throw badRequest('Another account already uses that email address.', [{ field: 'email', message: 'Already in use.' }]);
  unwrap(await supabase.from('users').update({ pending_email: email }).eq('id', req.user.id));
  const token = await createAuthToken(req.user.id, 'change_email');
  await sendEmailChangeConfirmation(req.user, email, token);
  ok(res, { pendingEmail: email }, { message: `We sent a confirmation link to ${email}.` });
}

export async function cancelEmailChange(req, res) {
  unwrap(await supabase.from('users').update({ pending_email: null }).eq('id', req.user.id));
  unwrap(await supabase.from('auth_tokens').delete().eq('user_id', req.user.id).eq('type', 'change_email').is('used_at', null));
  noContent(res);
}

/** Accounts created with Google/Facebook can add a password so they can also sign in by email. */
export async function setPassword(req, res) {
  const methods = await loginMethods(req.user.id);
  if (methods.hasPassword) throw badRequest('You already have a password. Use "Change password" instead.');
  const password_hash = await bcrypt.hash(req.valid.body.newPassword, BCRYPT_ROUNDS);
  unwrap(await supabase.from('users').update({ password_hash }).eq('id', req.user.id));
  sendAccountNotification(req.user, { heading: 'A password was added to your account', message: 'You can now also sign in with your email and password.' });
  ok(res, await toMe(req.user), { message: 'Password set.' });
}

/** Revoke every other session by bumping token_version, then re-issue this device's session. */
export async function signOutOtherSessions(req, res) {
  const user = unwrap(
    await supabase.from('users').update({ token_version: req.user.token_version + 1 }).eq('id', req.user.id).select(USER_FIELDS).single()
  );
  issueSession(res, user);
  ok(res, null, { message: 'Signed out of all other devices.' });
}

export async function connectedAccounts(req, res) {
  const methods = await loginMethods(req.user.id);
  ok(res, methods);
}

/** Unlink a provider, but never remove the last way to sign in. */
export async function disconnectProvider(req, res) {
  const { provider } = req.valid.params;
  const methods = await loginMethods(req.user.id);
  if (!methods.providers.includes(provider)) throw badRequest('That account is not connected.');
  if (!methods.hasPassword && methods.providers.length === 1) {
    throw new AppError(409, 'Set a password or connect another account first, so you can still sign in.', 'LAST_LOGIN_METHOD');
  }
  unwrap(await supabase.from('connected_accounts').delete().eq('user_id', req.user.id).eq('provider', provider));
  sendAccountNotification(req.user, { heading: `${provider === 'google' ? 'Google' : 'Facebook'} was disconnected`, message: `You can no longer sign in with ${provider === 'google' ? 'Google' : 'Facebook'}.` });
  ok(res, await loginMethods(req.user.id), { message: 'Account disconnected.' });
}

export async function uploadAvatar(req, res) {
  if (!req.file) throw badRequest('Choose an image to upload.');
  const { imageMb } = uploadLimits(await getSettings());
  const user = await withUploadCleanup(async (upload) => {
    const path = await upload.image(req.file, FOLDERS.avatars, imageMb);
    return unwrap(await supabase.from('users').update({ avatar_path: path }).eq('id', req.user.id).select(USER_FIELDS).single());
  });
  await removeMedia(req.user.avatar_path);
  ok(res, await toMe(user), { message: 'Profile picture updated.' });
}

export async function removeAvatar(req, res) {
  const user = unwrap(await supabase.from('users').update({ avatar_path: null }).eq('id', req.user.id).select(USER_FIELDS).single());
  await removeMedia(req.user.avatar_path);
  ok(res, await toMe(user), { message: 'Profile picture removed.' });
}

export async function deleteAccount(req, res) {
  const row = await one(supabase.from('users').select('password_hash,role').eq('id', req.user.id));
  // Password accounts confirm with their password; OAuth-only accounts confirm by typing DELETE.
  const confirmed = row.password_hash ? await bcrypt.compare(req.valid.body.password, row.password_hash) : req.valid.body.password === 'DELETE';
  if (!confirmed) {
    throw badRequest(row.password_hash ? 'Incorrect password.' : 'Type DELETE to confirm.', [{ field: 'password', message: row.password_hash ? 'Incorrect password.' : 'Type DELETE to confirm.' }]);
  }
  if (row.role === 'admin') {
    const { count: admins } = await supabase.from('users').select('id', { count: 'exact', head: true }).eq('role', 'admin').eq('status', 'active');
    if ((admins ?? 0) <= 1) throw conflict('You are the only administrator. Promote another admin before deleting your account.');
  }
  const playlists = unwrap(await supabase.from('playlists').select('artwork_path').eq('user_id', req.user.id));
  unwrap(await supabase.from('users').delete().eq('id', req.user.id));
  await removeMedia(req.user.avatar_path, ...playlists.map((p) => p.artwork_path));
  clearSession(res);
  noContent(res);
}
