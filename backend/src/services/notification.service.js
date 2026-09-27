import { supabase } from '../config/supabase.js';
import { env } from '../config/env.js';
import { getSettingsForUsers } from './userSettings.service.js';
import { getSettings } from './settings.service.js';
import { sendBatch } from './email.service.js';
import { releaseEmail } from './emailTemplates.js';

/**
 * In-app notifications (+ optional email) that honour each user's
 * notification preferences. `prefKey` is one of: newMusic, newVideos,
 * artistUpdates, followers, account. Users who turned a category off get
 * nothing; `email: false` in their preferences suppresses emails only.
 *
 * Failures are logged, never thrown: notifications must not break the
 * action that triggered them.
 */
export async function notifyUsers(userIds, { type, title, body = null, link = null, prefKey, email = null }) {
  try {
    const unique = [...new Set(userIds.filter(Boolean))];
    if (!unique.length) return;
    const settings = await getSettingsForUsers(unique);
    const allowed = unique.filter((id) => settings.get(id).notification_preferences[prefKey] !== false);
    if (!allowed.length) return;

    const rows = allowed.map((user_id) => ({ user_id, type, title, body, link }));
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await supabase.from('notifications').insert(rows.slice(i, i + 500));
      if (error) throw error;
    }

    if (email) {
      const wantsEmail = allowed.filter((id) => settings.get(id).notification_preferences.email !== false);
      if (!wantsEmail.length) return;
      const users = [];
      for (let i = 0; i < wantsEmail.length; i += 500) {
        const { data } = await supabase.from('users').select('id,name,email,status').in('id', wantsEmail.slice(i, i + 500));
        users.push(...(data || []).filter((u) => u.status === 'active'));
      }
      await sendBatch(users.map((u) => ({ to: u.email, ...email(u) })));
    }
  } catch (err) {
    console.error(`[notify] ${type} failed:`, err.message);
  }
}

async function followerIds(artistId) {
  const ids = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('artist_followers').select('user_id').eq('artist_id', artistId).range(from, from + 999);
    if (error) throw error;
    ids.push(...data.map((r) => r.user_id));
    if (data.length < 1000) break;
  }
  return ids;
}

/** Tell an artist's followers about a newly published song or video. */
export async function notifyFollowersOfRelease(kind, { artistId, artistName, title, id }) {
  try {
    const ids = await followerIds(artistId);
    if (!ids.length) return;
    const site = await getSettings();
    const isVideo = kind === 'video';
    const link = isVideo ? `/videos/${id}` : `/song/${id}`;
    await notifyUsers(ids, {
      type: isVideo ? 'new_video' : 'new_music',
      prefKey: isVideo ? 'newVideos' : 'newMusic',
      title: isVideo ? `New video from ${artistName}` : `New from ${artistName}`,
      body: title,
      link,
      email: site.email_new_releases
        ? (user) =>
            releaseEmail({
              siteName: site.site_name,
              name: user.name,
              artistName,
              title,
              kind,
              url: `${env.frontendUrl}${link}`,
            })
        : null,
    });
  } catch (err) {
    console.error('[notify] release fan-out failed:', err.message);
  }
}

/** Notify whoever owns an artist profile (e.g. new follower, review decisions). */
export async function notifyArtistOwner(artistId, message) {
  const { data } = await supabase.from('artists').select('owner_user_id').eq('id', artistId).maybeSingle();
  if (data?.owner_user_id) await notifyUsers([data.owner_user_id], message);
}
