import { supabase } from '../config/supabase.js';
import { badRequest, notFound } from '../utils/AppError.js';
import { dbError, one, orderByIds, unwrap } from '../utils/db.js';
import { noContent, ok, pageMeta, pageRange } from '../utils/http.js';
import { SONG_FIELDS, VIDEO_FIELDS, toArtist, toPlaylist, toPublicUser, toSong, toVideo } from '../services/mappers.js';
import { getPublicLyrics } from '../services/lyrics/lyrics.service.js';
import { getUserSettingsRow, getSettingsForUsers } from '../services/userSettings.service.js';
import { notifyUsers } from '../services/notification.service.js';
import { publishedSongsByIds } from '../services/song.service.js';
import { PLAYLIST_FIELDS } from './catalog.controller.js';

const ARTIST_CARD_FIELDS = 'id,name,image_path,cover_path,verification_status,follower_count,song_count,video_count,owner_user_id,created_at';

// ─── Lyrics (listeners) ────────────────────────────────────────────────────
export async function songLyrics(req, res) {
  const song = await one(
    supabase.from('songs_view').select('id,title,artist_name,album_title,duration,updated_at').eq('id', req.valid.params.id).eq('is_published', true),
    'Song not found.'
  );
  let preferred = req.valid.query.lang;
  if (!preferred && req.user) preferred = (await getUserSettingsRow(req.user.id)).language;
  const result = await getPublicLyrics(song, preferred || 'en');
  res.set('Cache-Control', 'private, max-age=60');
  ok(res, result);
}

// ─── Following artists ─────────────────────────────────────────────────────
async function loadFollowableArtist(id) {
  return one(supabase.from('artists').select('id,name,owner_user_id').eq('id', id), 'Artist not found.');
}

export async function followArtist(req, res) {
  const artist = await loadFollowableArtist(req.valid.params.id);
  if (artist.owner_user_id === req.user.id) throw badRequest('You cannot follow your own artist profile.');
  const { data, error } = await supabase
    .from('artist_followers')
    .upsert({ artist_id: artist.id, user_id: req.user.id }, { onConflict: 'artist_id,user_id', ignoreDuplicates: true })
    .select('id');
  if (error) throw dbError(error);
  // Only notify on a genuinely new follow (upsert with ignoreDuplicates returns no row for existing ones).
  if (data?.length && artist.owner_user_id) {
    notifyUsers([artist.owner_user_id], {
      type: 'new_follower',
      prefKey: 'followers',
      title: `${req.user.name} started following ${artist.name}`,
      link: '/studio/followers',
    });
  }
  const { follower_count } = await one(supabase.from('artists').select('follower_count').eq('id', artist.id));
  ok(res, { artistId: artist.id, following: true, followerCount: Number(follower_count) });
}

export async function unfollowArtist(req, res) {
  const artist = await loadFollowableArtist(req.valid.params.id);
  unwrap(await supabase.from('artist_followers').delete().eq('artist_id', artist.id).eq('user_id', req.user.id));
  const { follower_count } = await one(supabase.from('artists').select('follower_count').eq('id', artist.id));
  ok(res, { artistId: artist.id, following: false, followerCount: Number(follower_count) });
}

/** Followers of an artist. Only listeners with a public profile are listed; the owner can hide the list. */
export async function artistFollowers(req, res) {
  const artist = await one(supabase.from('artists').select('id,owner_user_id').eq('id', req.valid.params.id), 'Artist not found.');
  const isOwner = req.user?.id === artist.owner_user_id || req.user?.role === 'admin';
  if (artist.owner_user_id && !isOwner) {
    const ownerSettings = await getUserSettingsRow(artist.owner_user_id);
    if (ownerSettings.privacy_preferences.showFollowers === false) return ok(res, [], { hidden: true, ...pageMeta(req.valid.query, 0) });
  }
  const { page, limit } = req.valid.query;
  const { from, to } = pageRange({ page, limit });
  const { data, count, error } = await supabase
    .from('artist_followers')
    .select('user_id,created_at', { count: 'exact' })
    .eq('artist_id', artist.id)
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error) throw dbError(error);
  const ids = data.map((r) => r.user_id);
  const settings = await getSettingsForUsers(ids);
  const visible = ids.filter((id) => isOwner || settings.get(id).privacy_preferences.publicProfile !== false);
  const users = visible.length
    ? unwrap(await supabase.from('users').select('id,name,username,avatar_path,bio,location,website,social_links,role,created_at').in('id', visible))
    : [];
  const followedAt = new Map(data.map((r) => [r.user_id, r.created_at]));
  ok(
    res,
    orderByIds(users, visible).map((u) => ({ ...toPublicUser(u), followedAt: followedAt.get(u.id) })),
    { ...pageMeta({ page, limit }, count), privateCount: ids.length - visible.length }
  );
}

/** Artists the signed-in user follows (with follow ids for heart/follow state). */
export async function myFollowing(req, res) {
  const rows = unwrap(
    await supabase.from('artist_followers').select('artist_id,created_at').eq('user_id', req.user.id).order('created_at', { ascending: false }).limit(1000)
  );
  const ids = rows.map((r) => r.artist_id);
  const artists = ids.length ? unwrap(await supabase.from('artists_view').select(ARTIST_CARD_FIELDS).in('id', ids)) : [];
  ok(res, orderByIds(artists, ids).map((a) => toArtist(a)));
}

/** New releases (songs + videos) from artists the user follows. */
export async function followingFeed(req, res) {
  const follows = unwrap(await supabase.from('artist_followers').select('artist_id').eq('user_id', req.user.id).limit(1000));
  const artistIds = follows.map((f) => f.artist_id);
  if (!artistIds.length) return ok(res, { items: [], followingCount: 0 });
  const [songs, videos] = await Promise.all([
    supabase.from('songs_view').select(SONG_FIELDS).in('artist_id', artistIds).eq('is_published', true).order('published_at', { ascending: false, nullsFirst: false }).limit(40),
    supabase.from('videos_view').select(VIDEO_FIELDS).in('artist_id', artistIds).eq('is_published', true).order('published_at', { ascending: false, nullsFirst: false }).limit(20),
  ]);
  const items = [
    ...unwrap(songs).map((s) => ({ type: 'song', date: s.published_at || s.created_at, song: toSong(s) })),
    ...unwrap(videos).map((v) => ({ type: 'video', date: v.published_at || v.created_at, video: toVideo(v) })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date));
  ok(res, { items: items.slice(0, 50), followingCount: artistIds.length });
}

// ─── Public listener profiles ──────────────────────────────────────────────
export async function publicProfile(req, res) {
  const { username } = req.valid.params;
  const isUuid = /^[0-9a-f-]{36}$/i.test(username);
  const user = await one(
    supabase
      .from('users')
      .select('id,name,username,avatar_path,bio,location,website,social_links,role,status,created_at')
      .eq(isUuid ? 'id' : 'username', username),
    'Profile not found.'
  );
  const isSelf = req.user?.id === user.id;
  const settings = await getUserSettingsRow(user.id);
  const privacy = settings.privacy_preferences;
  if (user.status !== 'active' || (!privacy.publicProfile && !isSelf)) throw notFound('Profile not found.');

  const [playlists, following, artists, recent] = await Promise.all([
    supabase.from('playlists_view').select(PLAYLIST_FIELDS).eq('user_id', user.id).eq('is_public', true).order('updated_at', { ascending: false }).limit(24),
    privacy.showFollowing || isSelf ? supabase.from('artist_followers').select('artist_id').eq('user_id', user.id).order('created_at', { ascending: false }).limit(24) : { data: [] },
    supabase.from('artists_view').select(ARTIST_CARD_FIELDS).eq('owner_user_id', user.id),
    privacy.showListeningActivity || isSelf
      ? supabase.from('plays').select('song_id,played_at').eq('user_id', user.id).order('played_at', { ascending: false }).limit(60)
      : { data: null },
  ]);
  const followIds = unwrap(following).map((f) => f.artist_id);
  const followed = followIds.length ? unwrap(await supabase.from('artists_view').select(ARTIST_CARD_FIELDS).in('id', followIds)) : [];
  const recentRows = recent.data;
  const recentSongs = recentRows ? await publishedSongsByIds([...new Set(recentRows.map((r) => r.song_id))].slice(0, 12)) : null;

  ok(res, {
    ...toPublicUser(user),
    isSelf,
    playlists: unwrap(playlists).map(toPlaylist),
    following: privacy.showFollowing || isSelf ? orderByIds(followed, followIds).map((a) => toArtist(a)) : null,
    artistProfiles: unwrap(artists).map((a) => toArtist(a)),
    recentlyPlayed: recentSongs,
  });
}

// ─── Notifications ─────────────────────────────────────────────────────────
export async function listNotifications(req, res) {
  const [list, unread] = await Promise.all([
    supabase.from('notifications').select('id,type,title,body,link,is_read,created_at').eq('user_id', req.user.id).order('created_at', { ascending: false }).limit(50),
    supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', req.user.id).eq('is_read', false),
  ]);
  if (unread.error) throw dbError(unread.error);
  ok(
    res,
    unwrap(list).map((n) => ({ id: n.id, type: n.type, title: n.title, body: n.body, link: n.link, isRead: n.is_read, createdAt: n.created_at })),
    { unread: unread.count ?? 0 }
  );
}

export async function markNotificationsRead(req, res) {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter((id) => /^[0-9a-f-]{36}$/i.test(id)).slice(0, 200) : null;
  let q = supabase.from('notifications').update({ is_read: true }).eq('user_id', req.user.id).eq('is_read', false);
  if (ids) q = q.in('id', ids);
  unwrap(await q);
  noContent(res);
}

export async function deleteNotification(req, res) {
  unwrap(await supabase.from('notifications').delete().eq('id', req.valid.params.id).eq('user_id', req.user.id));
  noContent(res);
}

export { ARTIST_CARD_FIELDS };
