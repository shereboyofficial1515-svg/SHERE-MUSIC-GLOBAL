import { supabase } from '../../config/supabase.js';
import { USER_FIELDS } from '../../middleware/auth.js';
import { badRequest, conflict } from '../../utils/AppError.js';
import { dbError, one, unwrap } from '../../utils/db.js';
import { ok, pageMeta, pageRange } from '../../utils/http.js';
import { cleanSearchTerm, ilikeAny } from '../../utils/search.js';
import { toUser } from '../../services/mappers.js';
import { publishedSongsByIds } from '../../services/song.service.js';
import { sendAccountNotification } from '../../services/email.service.js';

const loadUser = (id) => one(supabase.from('users').select(USER_FIELDS).eq('id', id), 'User not found.');

async function activeAdminCount() {
  const { count, error } = await supabase.from('users').select('id', { count: 'exact', head: true }).eq('role', 'admin').eq('status', 'active');
  if (error) throw dbError(error);
  return count ?? 0;
}

export async function listUsers(req, res) {
  const { q, role, status, page, limit } = req.valid.query;
  let query = supabase.from('users').select(USER_FIELDS, { count: 'exact' });
  const term = cleanSearchTerm(q);
  if (term) query = query.or(ilikeAny(['name', 'email'], term));
  if (role) query = query.eq('role', role);
  if (status) query = query.eq('status', status);
  const { from, to } = pageRange({ page, limit });
  const { data, count, error } = await query.order('created_at', { ascending: false }).order('id').range(from, to);
  if (error) throw dbError(error);
  ok(res, data.map(toUser), pageMeta({ page, limit }, count));
}

export async function getUser(req, res) {
  const user = await loadUser(req.valid.params.id);
  const countOf = async (table) => {
    const { count, error } = await supabase.from(table).select('id', { count: 'exact', head: true }).eq('user_id', user.id);
    if (error) throw dbError(error);
    return count ?? 0;
  };
  const [favorites, playlists, downloads, plays, recentDownloads] = await Promise.all([
    countOf('favorites'),
    countOf('playlists'),
    countOf('downloads'),
    countOf('plays'),
    supabase.from('downloads').select('song_id,downloaded_at').eq('user_id', user.id).order('downloaded_at', { ascending: false }).limit(10),
  ]);
  const downloadRows = unwrap(recentDownloads);
  const songs = await publishedSongsByIds([...new Set(downloadRows.map((d) => d.song_id))]);
  const byId = new Map(songs.map((s) => [s.id, s]));
  ok(res, {
    ...toUser(user),
    stats: { favorites, playlists, downloads, plays },
    recentDownloads: downloadRows.filter((d) => byId.has(d.song_id)).map((d) => ({ downloadedAt: d.downloaded_at, song: byId.get(d.song_id) })),
  });
}

export async function setStatus(req, res) {
  const user = await loadUser(req.valid.params.id);
  const { status } = req.valid.body;
  if (user.id === req.user.id) throw badRequest('You cannot change the status of your own account.');
  if (user.status === status) return ok(res, toUser(user));
  if (status === 'disabled' && user.role === 'admin' && (await activeAdminCount()) <= 1) {
    throw conflict('At least one active administrator is required.');
  }
  // Disabling bumps token_version so any live session is revoked immediately.
  const patch = status === 'disabled' ? { status, token_version: user.token_version + 1 } : { status };
  const updated = unwrap(await supabase.from('users').update(patch).eq('id', user.id).select(USER_FIELDS).single());
  sendAccountNotification(updated, {
    heading: status === 'disabled' ? 'Your account has been disabled' : 'Your account has been re-enabled',
    message:
      status === 'disabled'
        ? 'An administrator has disabled your account. If you believe this is a mistake, reply to the support contact on our website.'
        : 'Your account is active again. You can sign in and continue listening.',
    withLoginLink: status === 'active',
  });
  ok(res, toUser(updated), { message: status === 'disabled' ? 'Account disabled.' : 'Account enabled.' });
}

export async function setRole(req, res) {
  const user = await loadUser(req.valid.params.id);
  const { role } = req.valid.body;
  if (user.id === req.user.id) throw badRequest('You cannot change your own role.');
  if (user.role === role) return ok(res, toUser(user));
  if (role === 'admin' && !user.email_verified) throw badRequest('Only users with a verified email can become administrators.');
  if (role === 'user') {
    const { count } = await supabase.from('artists').select('id', { count: 'exact', head: true }).eq('owner_user_id', user.id);
    if ((count ?? 0) > 0 && user.role === 'artist') {
      throw conflict('This user still owns artist profiles. Reassign them in Artists first, or keep the artist role.');
    }
  }
  if (role === 'user' && user.role === 'admin' && (await activeAdminCount()) <= 1) {
    throw conflict('At least one active administrator is required.');
  }
  const updated = unwrap(await supabase.from('users').update({ role }).eq('id', user.id).select(USER_FIELDS).single());
  sendAccountNotification(updated, {
    heading: { admin: 'You are now an administrator', artist: 'You now have artist access', user: 'Your role was changed' }[role],
    message: {
      admin: 'You have been granted administrator access. You can now open the admin dashboard after signing in.',
      artist: 'You can now use SHERE MUSIC STUDIO to upload music, lyrics and videos.',
      user: 'Your account is now a listener account. Your library is unchanged.',
    }[role],
    withLoginLink: role !== 'user',
  });
  ok(res, toUser(updated), { message: { admin: 'User promoted to administrator.', artist: 'User is now an artist.', user: 'User is now a listener.' }[role] });
}
