import { supabase } from '../config/supabase.js';
import { badRequest, conflict, notFound } from '../utils/AppError.js';
import { dbError, one, unwrap } from '../utils/db.js';
import { created, noContent, ok, pageMeta, pageRange } from '../utils/http.js';
import { toPlaylist } from '../services/mappers.js';
import { publishedSongsByIds } from '../services/song.service.js';
import { FOLDERS, removeMedia, withUploadCleanup } from '../services/storage.service.js';
import { getSettings, uploadLimits } from '../services/settings.service.js';
import { PLAYLIST_FIELDS } from './catalog.controller.js';

// ─── Favorites ─────────────────────────────────────────────────────────────
export async function listFavorites(req, res) {
  const { page, limit } = req.valid.query;
  const { from, to } = pageRange({ page, limit });
  const { data, count, error } = await supabase
    .from('favorites')
    .select('song_id', { count: 'exact' })
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error) throw dbError(error);
  const songs = await publishedSongsByIds(data.map((f) => f.song_id));
  ok(res, songs, pageMeta({ page, limit }, count));
}

/** All favorited song ids, so the UI can render heart states without per-song requests. */
export async function favoriteIds(req, res) {
  const rows = unwrap(await supabase.from('favorites').select('song_id').eq('user_id', req.user.id).limit(10_000));
  ok(res, rows.map((r) => r.song_id));
}

async function assertPublishedSong(songId) {
  await one(supabase.from('songs').select('id').eq('id', songId).eq('is_published', true), 'Song not found.');
}

export async function addFavorite(req, res) {
  const { songId } = req.valid.params;
  await assertPublishedSong(songId);
  unwrap(
    await supabase.from('favorites').upsert({ user_id: req.user.id, song_id: songId }, { onConflict: 'user_id,song_id', ignoreDuplicates: true })
  );
  ok(res, { songId, favorite: true });
}

export async function removeFavorite(req, res) {
  unwrap(await supabase.from('favorites').delete().eq('user_id', req.user.id).eq('song_id', req.valid.params.songId));
  ok(res, { songId: req.valid.params.songId, favorite: false });
}

// ─── Playlists ─────────────────────────────────────────────────────────────
async function loadPlaylist(id) {
  return one(supabase.from('playlists_view').select(PLAYLIST_FIELDS).eq('id', id), 'Playlist not found.');
}

async function loadOwnedPlaylist(req) {
  const playlist = await loadPlaylist(req.valid.params.id);
  if (playlist.user_id !== req.user.id) throw notFound('Playlist not found.');
  return playlist;
}

export async function myPlaylists(req, res) {
  const rows = unwrap(
    await supabase.from('playlists_view').select(PLAYLIST_FIELDS).eq('user_id', req.user.id).order('updated_at', { ascending: false }).limit(500)
  );
  ok(res, rows.map(toPlaylist));
}

export async function createPlaylist(req, res) {
  const { name, description, isPublic } = req.valid.body;
  const row = unwrap(
    await supabase
      .from('playlists')
      .insert({ user_id: req.user.id, name, description: description ?? null, is_public: isPublic ?? false })
      .select('id')
      .single()
  );
  created(res, toPlaylist(await loadPlaylist(row.id)));
}

/** Owners can always view; everyone else only if the playlist is public. */
export async function getPlaylist(req, res) {
  const playlist = await loadPlaylist(req.valid.params.id);
  const isOwner = req.user?.id === playlist.user_id;
  if (!playlist.is_public && !isOwner && req.user?.role !== 'admin') throw notFound('Playlist not found.');

  const entries = unwrap(
    await supabase.from('playlist_songs').select('song_id').eq('playlist_id', playlist.id).order('position').order('created_at').limit(1000)
  );
  const songs = await publishedSongsByIds(entries.map((e) => e.song_id));
  ok(res, { ...toPlaylist(playlist), isOwner, songs });
}

export async function updatePlaylist(req, res) {
  await loadOwnedPlaylist(req);
  const { name, description, isPublic } = req.valid.body;
  const patch = {};
  if (name !== undefined) patch.name = name;
  if (description !== undefined) patch.description = description;
  if (isPublic !== undefined) patch.is_public = isPublic;
  if (isPublic === false) patch.is_featured = false;
  if (!Object.keys(patch).length) throw badRequest('Nothing to update.');
  unwrap(await supabase.from('playlists').update(patch).eq('id', req.valid.params.id));
  ok(res, toPlaylist(await loadPlaylist(req.valid.params.id)));
}

export async function deletePlaylist(req, res) {
  const playlist = await loadOwnedPlaylist(req);
  unwrap(await supabase.from('playlists').delete().eq('id', playlist.id));
  await removeMedia(playlist.own_artwork_path);
  noContent(res);
}

export async function addPlaylistSong(req, res) {
  const playlist = await loadOwnedPlaylist(req);
  const { songId } = req.valid.body;
  await assertPublishedSong(songId);

  const last = unwrap(
    await supabase.from('playlist_songs').select('position').eq('playlist_id', playlist.id).order('position', { ascending: false }).limit(1)
  );
  const { error } = await supabase
    .from('playlist_songs')
    .insert({ playlist_id: playlist.id, song_id: songId, position: (last[0]?.position ?? -1) + 1 });
  if (error?.code === '23505') throw conflict(`This song is already in "${playlist.name}".`, 'ALREADY_IN_PLAYLIST');
  if (error) throw dbError(error);
  unwrap(await supabase.from('playlists').update({ updated_at: new Date().toISOString() }).eq('id', playlist.id));
  ok(res, { playlistId: playlist.id, songId, name: playlist.name });
}

export async function removePlaylistSong(req, res) {
  const playlist = await loadOwnedPlaylist(req);
  unwrap(await supabase.from('playlist_songs').delete().eq('playlist_id', playlist.id).eq('song_id', req.valid.params.songId));
  noContent(res);
}

export async function uploadPlaylistArtwork(req, res) {
  const playlist = await loadOwnedPlaylist(req);
  if (!req.file) throw badRequest('Choose an image to upload.');
  const { imageMb } = uploadLimits(await getSettings());
  await withUploadCleanup(async (upload) => {
    const path = await upload.image(req.file, FOLDERS.playlists, imageMb);
    unwrap(await supabase.from('playlists').update({ artwork_path: path }).eq('id', playlist.id));
  });
  await removeMedia(playlist.own_artwork_path);
  ok(res, toPlaylist(await loadPlaylist(playlist.id)));
}

// ─── Listening history ────────────────────────────────────────────────────
export async function downloadHistory(req, res) {
  const { page, limit } = req.valid.query;
  const { from, to } = pageRange({ page, limit });
  const { data, count, error } = await supabase
    .from('downloads')
    .select('id,song_id,downloaded_at', { count: 'exact' })
    .eq('user_id', req.user.id)
    .order('downloaded_at', { ascending: false })
    .range(from, to);
  if (error) throw dbError(error);
  const songs = await publishedSongsByIds([...new Set(data.map((d) => d.song_id))]);
  const byId = new Map(songs.map((s) => [s.id, s]));
  const items = data.filter((d) => byId.has(d.song_id)).map((d) => ({ id: d.id, downloadedAt: d.downloaded_at, song: byId.get(d.song_id) }));
  ok(res, items, pageMeta({ page, limit }, count));
}

/** Distinct recently played songs (newest first). */
export async function recentlyPlayed(req, res) {
  const rows = unwrap(
    await supabase.from('plays').select('song_id,played_at').eq('user_id', req.user.id).order('played_at', { ascending: false }).limit(200)
  );
  const ids = [...new Set(rows.map((r) => r.song_id))].slice(0, 30);
  const songs = await publishedSongsByIds(ids);
  const lastPlayed = new Map();
  for (const r of rows) if (!lastPlayed.has(r.song_id)) lastPlayed.set(r.song_id, r.played_at);
  ok(res, songs.map((s) => ({ ...s, lastPlayedAt: lastPlayed.get(s.id) })));
}

