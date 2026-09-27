import { supabase } from '../config/supabase.js';
import { USER_FIELDS } from '../middleware/auth.js';
import { badRequest, conflict, forbidden } from '../utils/AppError.js';
import { dbError, orderByIds, unwrap } from '../utils/db.js';
import { created, noContent, ok, pageMeta, pageRange } from '../utils/http.js';
import { cleanSearchTerm, ilikeAny } from '../utils/search.js';
import { SONG_MANAGE_FIELDS, toAlbum, toArtist, toGenre, toPublicUser, toSong } from '../services/mappers.js';
import { FOLDERS, removeMedia, signedAudioUrl, withUploadCleanup } from '../services/storage.service.js';
import { getSettings, uploadLimits } from '../services/settings.service.js';
import { loadOwnedAlbum, loadOwnedArtist, loadOwnedSong, ownedArtistIds } from '../services/ownership.service.js';
import {
  createSongRecord,
  deleteSongRecord,
  setSongWorkflow,
  songColumns,
  updateSongRecord,
} from '../services/songManagement.service.js';
import { afterStatusChange, creatorPublishPatch, statusAfterCreatorEdit, submitPatch } from '../services/review.service.js';
import { toMe } from '../services/account.service.js';
import { getSettingsForUsers } from '../services/userSettings.service.js';

/**
 * SHERE MUSIC STUDIO — everything is scoped to artist profiles owned by the
 * signed-in user (artists.owner_user_id = session user). Client-supplied
 * artist ids are only accepted after that ownership check.
 */

const manage = (row) => toSong(row, { manage: true });
const SONG_FIELDS_ALLOWED = ['title', 'artistId', 'albumId', 'genreId', 'description', 'releaseDate', 'duration', 'trackNumber'];
const ARTIST_MANAGE_FIELDS = '*';

async function ownedIdsOrEmpty(userId) {
  return ownedArtistIds(userId);
}

// ─── Onboarding ────────────────────────────────────────────────────────────
export async function studioStatus(req, res) {
  const settings = await getSettings();
  const artists = unwrap(await supabase.from('artists_view').select(ARTIST_MANAGE_FIELDS).eq('owner_user_id', req.user.id).order('name'));
  ok(res, {
    isCreator: ['artist', 'admin'].includes(req.user.role) && artists.length > 0,
    role: req.user.role,
    canCreateArtist: settings.allow_artist_signup || req.user.role !== 'user',
    autoPublish: settings.artist_auto_publish,
    artists: artists.map((a) => toArtist(a, { manage: true })),
  });
}

/** Create an artist profile. The first one turns a listener into an artist. */
export async function createArtistProfile(req, res) {
  const settings = await getSettings();
  if (req.user.role === 'user' && !settings.allow_artist_signup) throw forbidden('Artist sign-ups are currently closed.', 'ARTIST_SIGNUP_CLOSED');
  const owned = await ownedArtistIds(req.user.id);
  if (owned.length >= 10) throw badRequest('You can manage up to 10 artist profiles.');
  const { name, bio, location, socialLinks } = req.valid.body;
  const { imageMb } = uploadLimits(settings);

  const id = await withUploadCleanup(async (upload) => {
    const image_path = req.files?.image?.[0] ? await upload.image(req.files.image[0], FOLDERS.artists, imageMb) : null;
    const cover_path = req.files?.cover?.[0] ? await upload.image(req.files.cover[0], FOLDERS.covers, imageMb) : null;
    const { data, error } = await supabase
      .from('artists')
      .insert({ name, bio: bio ?? null, location: location ?? null, social_links: socialLinks || {}, image_path, cover_path, owner_user_id: req.user.id })
      .select('id')
      .single();
    if (error?.code === '23505') throw conflict(`An artist named "${name}" already exists. If it's you, ask an admin to connect it to your account.`);
    if (error) throw dbError(error);
    return data.id;
  });

  let user = req.user;
  if (req.user.role === 'user') {
    user = unwrap(await supabase.from('users').update({ role: 'artist' }).eq('id', req.user.id).select(USER_FIELDS).single());
  }
  const artist = unwrap(await supabase.from('artists_view').select('*').eq('id', id).single());
  created(res, { artist: toArtist(artist, { manage: true }), user: await toMe(user) });
}

// ─── Overview & analytics ──────────────────────────────────────────────────
export async function overview(req, res) {
  const mine = await ownedIdsOrEmpty(req.user.id);
  const [totals, activity, recentSongs, recentVideos, recentFollowers] = await Promise.all([
    supabase.rpc('studio_overview', { p_user_id: req.user.id }),
    supabase.rpc('studio_daily_activity', { p_user_id: req.user.id, p_days: 14 }),
    mine.length ? supabase.from('songs_view').select(SONG_MANAGE_FIELDS).in('artist_id', mine).order('updated_at', { ascending: false }).limit(6) : { data: [] },
    mine.length
      ? supabase.from('videos_view').select('id,title,status,artist_name,thumbnail_path,updated_at,view_count').in('artist_id', mine).order('updated_at', { ascending: false }).limit(4)
      : { data: [] },
    mine.length ? supabase.from('artist_followers').select('user_id,artist_id,created_at').in('artist_id', mine).order('created_at', { ascending: false }).limit(8) : { data: [] },
  ]);
  const followerRows = unwrap(recentFollowers);
  const followerUsers = await publicUsers(followerRows.map((f) => f.user_id));
  ok(res, {
    totals: unwrap(totals),
    activity: unwrap(activity),
    recentSongs: unwrap(recentSongs).map(manage),
    recentVideos: unwrap(recentVideos).map((v) => ({ id: v.id, title: v.title, status: v.status, artistName: v.artist_name, viewCount: Number(v.view_count), updatedAt: v.updated_at })),
    recentFollowers: followerRows
      .map((f) => ({ user: followerUsers.get(f.user_id), artistId: f.artist_id, followedAt: f.created_at }))
      .filter((f) => f.user),
  });
}

export async function analytics(req, res) {
  const { days } = req.valid.query;
  const mine = await ownedIdsOrEmpty(req.user.id);
  const [daily, topSongs, topVideos] = await Promise.all([
    supabase.rpc('studio_daily_activity', { p_user_id: req.user.id, p_days: days }),
    supabase.rpc('studio_top_songs', { p_user_id: req.user.id, p_days: days, p_limit: 10 }),
    mine.length ? supabase.from('videos_view').select('id,title,view_count').in('artist_id', mine).order('view_count', { ascending: false }).limit(10) : { data: [] },
  ]);
  const series = unwrap(daily);
  const sum = (key) => series.reduce((n, d) => n + Number(d[key] || 0), 0);
  ok(res, {
    days,
    totals: { plays: sum('plays'), downloads: sum('downloads'), videoViews: sum('video_views'), newFollowers: sum('new_followers') },
    daily: series,
    topSongs: unwrap(topSongs),
    topVideos: unwrap(topVideos).map((v) => ({ id: v.id, title: v.title, views: Number(v.view_count) })),
  });
}

// ─── Artist profiles ───────────────────────────────────────────────────────
export async function myArtists(req, res) {
  const rows = unwrap(await supabase.from('artists_view').select(ARTIST_MANAGE_FIELDS).eq('owner_user_id', req.user.id).order('name'));
  ok(res, rows.map((a) => toArtist(a, { manage: true })));
}

export async function updateArtistProfile(req, res) {
  const existing = await loadOwnedArtist(req.user.id, req.valid.params.id);
  const { name, bio, location, socialLinks, removeImage, removeCover } = req.valid.body;
  const { imageMb } = uploadLimits(await getSettings());
  const patch = { name };
  if (bio !== undefined) patch.bio = bio;
  if (location !== undefined) patch.location = location;
  if (socialLinks !== undefined) patch.social_links = Object.fromEntries(Object.entries(socialLinks).filter(([, v]) => v));
  // Renaming a verified artist removes the badge until an admin re-verifies.
  if (name !== existing.name && existing.verification_status === 'verified') patch.verification_status = 'none';

  await withUploadCleanup(async (upload) => {
    const image = req.files?.image?.[0];
    const cover = req.files?.cover?.[0];
    if (image) patch.image_path = await upload.image(image, FOLDERS.artists, imageMb);
    else if (removeImage) patch.image_path = null;
    if (cover) patch.cover_path = await upload.image(cover, FOLDERS.covers, imageMb);
    else if (removeCover) patch.cover_path = null;
    const { error } = await supabase.from('artists').update(patch).eq('id', existing.id);
    if (error?.code === '23505') throw conflict(`An artist named "${name}" already exists.`);
    if (error) throw dbError(error);
  });
  if (patch.image_path !== undefined) await removeMedia(existing.image_path);
  if (patch.cover_path !== undefined) await removeMedia(existing.cover_path);
  const artist = unwrap(await supabase.from('artists_view').select('*').eq('id', existing.id).single());
  ok(res, toArtist(artist, { manage: true }), { message: 'Artist profile saved.' });
}

export async function requestVerification(req, res) {
  const existing = await loadOwnedArtist(req.user.id, req.valid.params.id);
  if (existing.verification_status === 'verified') throw badRequest('This artist is already verified.');
  if (existing.verification_status === 'pending') throw badRequest('A verification request is already pending.');
  unwrap(
    await supabase
      .from('artists')
      .update({ verification_status: 'pending', verification_message: req.valid.body.message, verification_note: null, verification_requested_at: new Date().toISOString() })
      .eq('id', existing.id)
  );
  const artist = unwrap(await supabase.from('artists_view').select('*').eq('id', existing.id).single());
  ok(res, toArtist(artist, { manage: true }), { message: 'Verification requested. An admin will review it.' });
}

export async function deleteArtistProfile(req, res) {
  const existing = await loadOwnedArtist(req.user.id, req.valid.params.id);
  if (Number(existing.total_song_count) > 0 || Number(existing.album_count) > 0 || Number(existing.video_count) > 0) {
    throw conflict('Delete this artist’s songs, albums and videos first.', 'IN_USE');
  }
  unwrap(await supabase.from('artists').delete().eq('id', existing.id));
  await removeMedia(existing.image_path, existing.cover_path);
  noContent(res);
}

// ─── Followers ────────────────────────────────────────────────────────────
async function publicUsers(ids) {
  if (!ids.length) return new Map();
  const users = unwrap(await supabase.from('users').select('id,name,username,avatar_path,bio,location,website,social_links,role,created_at').in('id', [...new Set(ids)]));
  return new Map(users.map((u) => [u.id, toPublicUser(u)]));
}

/** Followers of the creator's artists. Listeners with a private profile appear anonymously. */
export async function followers(req, res) {
  const { artist, page, limit } = req.valid.query;
  const mine = await ownedIdsOrEmpty(req.user.id);
  const scope = artist ? mine.filter((id) => id === artist) : mine;
  if (!scope.length) return ok(res, [], pageMeta({ page, limit }, 0));
  const { from, to } = pageRange({ page, limit });
  const { data, count, error } = await supabase
    .from('artist_followers')
    .select('user_id,artist_id,created_at', { count: 'exact' })
    .in('artist_id', scope)
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error) throw dbError(error);
  const settings = await getSettingsForUsers(data.map((d) => d.user_id));
  const users = await publicUsers(data.map((d) => d.user_id));
  ok(
    res,
    data.map((d) => ({
      artistId: d.artist_id,
      followedAt: d.created_at,
      user: settings.get(d.user_id).privacy_preferences.publicProfile === false ? null : users.get(d.user_id) || null,
    })),
    pageMeta({ page, limit }, count)
  );
}

// ─── Options for forms ────────────────────────────────────────────────────
export async function options(req, res) {
  const settings = await getSettings();
  const mine = await ownedIdsOrEmpty(req.user.id);
  const [artists, albums, genres, songs] = await Promise.all([
    mine.length ? supabase.from('artists').select('id,name').in('id', mine).order('name') : { data: [] },
    mine.length ? supabase.from('albums').select('id,title,artist_id').in('artist_id', mine).order('title') : { data: [] },
    supabase.from('genres_view').select('*').order('name'),
    mine.length ? supabase.from('songs').select('id,title,artist_id').in('artist_id', mine).order('title').limit(2000) : { data: [] },
  ]);
  ok(res, {
    artists: unwrap(artists),
    albums: unwrap(albums),
    genres: unwrap(genres).map(toGenre),
    songs: unwrap(songs),
    subtitleLanguages: settings.subtitle_languages || [],
    limits: uploadLimits(settings),
    autoPublish: settings.artist_auto_publish,
  });
}

// ─── Albums ────────────────────────────────────────────────────────────────
export async function listAlbums(req, res) {
  const mine = await ownedIdsOrEmpty(req.user.id);
  if (!mine.length) return ok(res, []);
  const rows = unwrap(await supabase.from('albums_view').select('*').in('artist_id', mine).order('created_at', { ascending: false }).limit(500));
  ok(res, rows.map(toAlbum));
}

export async function saveAlbum(req, res) {
  const { title, artistId, releaseDate, description, removeArtwork } = req.valid.body;
  await loadOwnedArtist(req.user.id, artistId, 'id,owner_user_id');
  const existing = req.valid.params?.id ? await loadOwnedAlbum(req.user.id, req.valid.params.id) : null;
  if (existing && existing.artist_id !== artistId && Number(existing.total_song_count) > 0) {
    throw badRequest("Remove this album's songs before moving it to another artist.");
  }
  const { imageMb } = uploadLimits(await getSettings());
  const row = { title, artist_id: artistId };
  if (releaseDate !== undefined) row.release_date = releaseDate;
  if (description !== undefined) row.description = description;

  const id = await withUploadCleanup(async (upload) => {
    if (req.file) row.artwork_path = await upload.image(req.file, FOLDERS.albums, imageMb);
    else if (removeArtwork) row.artwork_path = null;
    const q = existing ? supabase.from('albums').update(row).eq('id', existing.id).select('id').single() : supabase.from('albums').insert(row).select('id').single();
    const { data, error } = await q;
    if (error?.code === '23505') throw conflict(`This artist already has an album called "${title}".`);
    if (error) throw dbError(error);
    return data.id;
  });
  if (existing && row.artwork_path !== undefined) await removeMedia(existing.artwork_path);
  const album = unwrap(await supabase.from('albums_view').select('*').eq('id', id).single());
  (existing ? ok : created)(res, toAlbum(album));
}

export async function deleteAlbum(req, res) {
  const existing = await loadOwnedAlbum(req.user.id, req.valid.params.id);
  unwrap(await supabase.from('albums').delete().eq('id', existing.id));
  await removeMedia(existing.artwork_path);
  noContent(res);
}

export async function addAlbumSongs(req, res) {
  const album = await loadOwnedAlbum(req.user.id, req.valid.params.id);
  const { songIds } = req.valid.body;
  const songs = unwrap(await supabase.from('songs').select('id,artist_id').in('id', songIds));
  if (songs.length !== songIds.length || songs.some((s) => s.artist_id !== album.artist_id)) {
    throw badRequest('Songs must belong to the same artist as the album.');
  }
  unwrap(await supabase.from('songs').update({ album_id: album.id }).in('id', songIds));
  ok(res, toAlbum(unwrap(await supabase.from('albums_view').select('*').eq('id', album.id).single())));
}

// ─── Songs ────────────────────────────────────────────────────────────────
export async function listSongs(req, res) {
  const { q, status, sort, page, limit } = req.valid.query;
  const mine = await ownedIdsOrEmpty(req.user.id);
  if (!mine.length) return ok(res, [], pageMeta({ page, limit }, 0));
  let query = supabase.from('songs_view').select(SONG_MANAGE_FIELDS, { count: 'exact' }).in('artist_id', mine);
  const term = cleanSearchTerm(q);
  if (term) query = query.or(ilikeAny(['title', 'album_title'], term));
  if (status !== 'all') query = query.eq('status', status);
  const order = { created_desc: ['created_at', false], title: ['title', true], plays: ['play_count', false], downloads: ['download_count', false] }[sort] || ['created_at', false];
  const { from, to } = pageRange({ page, limit });
  const { data, count, error } = await query.order(order[0], { ascending: order[1] }).order('id').range(from, to);
  if (error) throw dbError(error);
  ok(res, data.map(manage), pageMeta({ page, limit }, count));
}

export async function getSong(req, res) {
  ok(res, manage(await loadOwnedSong(req.user.id, req.valid.params.id, SONG_MANAGE_FIELDS)));
}

export async function previewSong(req, res) {
  const song = await loadOwnedSong(req.user.id, req.valid.params.id, SONG_MANAGE_FIELDS);
  res.set('Cache-Control', 'private, no-store');
  ok(res, { url: await signedAudioUrl(song.audio_path, { expiresIn: 3600 }), mime: song.audio_mime, expiresIn: 3600 });
}

/** Upload a song as a draft; `submit=true` also sends it for review in one step. */
export async function createSong(req, res) {
  const body = req.valid.body;
  await loadOwnedArtist(req.user.id, body.artistId, 'id,owner_user_id');
  const settings = await getSettings();
  const submit = req.body.submit === 'true' || req.body.submit === true;
  const workflow = submit ? submitPatch('draft', settings.artist_auto_publish) : { status: 'draft' };
  const song = await createSongRecord({
    columns: songColumns(body, SONG_FIELDS_ALLOWED),
    audio: req.files?.audio?.[0],
    artwork: req.files?.artwork?.[0],
    actorId: req.user.id,
    workflow,
  });
  if (song.status === 'published') afterStatusChange('song', { ...song, status: 'draft', published_at: null }, song);
  created(res, manage(song));
}

export async function updateSong(req, res) {
  const existing = await loadOwnedSong(req.user.id, req.valid.params.id, SONG_MANAGE_FIELDS);
  const body = req.valid.body;
  if (body.artistId && body.artistId !== existing.artist_id) await loadOwnedArtist(req.user.id, body.artistId, 'id,owner_user_id');
  const settings = await getSettings();
  const next = statusAfterCreatorEdit(existing.status, settings.artist_auto_publish);
  const workflow = next !== existing.status ? { status: next, ...(next === 'pending' ? { submitted_at: new Date().toISOString() } : {}) } : {};
  const song = await updateSongRecord(existing, {
    columns: songColumns(body, SONG_FIELDS_ALLOWED),
    audio: req.files?.audio?.[0],
    artwork: req.files?.artwork?.[0],
    removeArtwork: req.body.removeArtwork === 'true' || req.body.removeArtwork === true,
    workflow,
  });
  ok(res, manage(song), { message: next === 'pending' && existing.status !== 'pending' ? 'Saved. Your changes were sent for review.' : 'Song saved.' });
}

export async function submitSong(req, res) {
  const existing = await loadOwnedSong(req.user.id, req.valid.params.id, SONG_MANAGE_FIELDS);
  const settings = await getSettings();
  const song = await setSongWorkflow(existing, submitPatch(existing.status, settings.artist_auto_publish, { alreadyPublishedOnce: Boolean(existing.published_at) }));
  afterStatusChange('song', existing, song);
  ok(res, manage(song), { message: song.status === 'published' ? 'Song published.' : 'Song submitted for review.' });
}

export async function publishSong(req, res) {
  const existing = await loadOwnedSong(req.user.id, req.valid.params.id, SONG_MANAGE_FIELDS);
  const song = await setSongWorkflow(existing, creatorPublishPatch(existing.status, req.valid.body.isPublished, { publishedAt: existing.published_at }));
  afterStatusChange('song', existing, song);
  ok(res, manage(song), { message: song.status === 'published' ? 'Song published.' : 'Song unpublished.' });
}

export async function deleteSong(req, res) {
  await deleteSongRecord(await loadOwnedSong(req.user.id, req.valid.params.id, SONG_MANAGE_FIELDS));
  noContent(res);
}

/** Songs with their lyrics status, for the "My Lyrics" overview. */
export async function lyricsOverview(req, res) {
  const mine = await ownedIdsOrEmpty(req.user.id);
  if (!mine.length) return ok(res, []);
  const songs = unwrap(await supabase.from('songs_view').select('id,title,artist_name,artwork_path,status,duration').in('artist_id', mine).order('title').limit(1000));
  const ids = songs.map((s) => s.id);
  const lyrics = ids.length ? unwrap(await supabase.from('lyrics').select('id,song_id,language,is_synced,status,rejection_reason,updated_at').in('song_id', ids)) : [];
  const bySong = new Map();
  for (const l of lyrics) bySong.set(l.song_id, [...(bySong.get(l.song_id) || []), l]);
  ok(
    res,
    orderByIds(songs, ids).map((s) => ({
      song: { id: s.id, title: s.title, artistName: s.artist_name, status: s.status, duration: s.duration, artworkUrl: toSong(s).artworkUrl },
      lyrics: (bySong.get(s.id) || []).map((l) => ({
        id: l.id,
        language: l.language,
        isSynced: l.is_synced,
        status: l.status,
        rejectionReason: l.rejection_reason,
        updatedAt: l.updated_at,
      })),
    }))
  );
}

