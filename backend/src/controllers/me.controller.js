import bcrypt from 'bcryptjs';
import { supabase } from '../config/supabase.js';
import { USER_FIELDS } from '../middleware/auth.js';
import { badRequest, conflict } from '../utils/AppError.js';
import { dbError, one, unwrap } from '../utils/db.js';
import { noContent, ok } from '../utils/http.js';
import { toUser } from '../services/mappers.js';
import { FOLDERS, removeMedia, withUploadCleanup } from '../services/storage.service.js';
import { getSettings, uploadLimits } from '../services/settings.service.js';
import { clearSession } from '../services/session.service.js';

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
  ok(res, { ...toUser(req.user), stats: { favorites, playlists, downloads, plays } });
}

export async function updateProfile(req, res) {
  const user = unwrap(await supabase.from('users').update({ name: req.valid.body.name }).eq('id', req.user.id).select(USER_FIELDS).single());
  ok(res, toUser(user), { message: 'Profile updated.' });
}

export async function uploadAvatar(req, res) {
  if (!req.file) throw badRequest('Choose an image to upload.');
  const { imageMb } = uploadLimits(await getSettings());
  const user = await withUploadCleanup(async (upload) => {
    const path = await upload.image(req.file, FOLDERS.avatars, imageMb);
    return unwrap(await supabase.from('users').update({ avatar_path: path }).eq('id', req.user.id).select(USER_FIELDS).single());
  });
  await removeMedia(req.user.avatar_path);
  ok(res, toUser(user), { message: 'Profile picture updated.' });
}

export async function removeAvatar(req, res) {
  const user = unwrap(await supabase.from('users').update({ avatar_path: null }).eq('id', req.user.id).select(USER_FIELDS).single());
  await removeMedia(req.user.avatar_path);
  ok(res, toUser(user), { message: 'Profile picture removed.' });
}

export async function deleteAccount(req, res) {
  const row = await one(supabase.from('users').select('password_hash,role').eq('id', req.user.id));
  if (!(await bcrypt.compare(req.valid.body.password, row.password_hash))) {
    throw badRequest('Incorrect password.', [{ field: 'password', message: 'Incorrect password.' }]);
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
