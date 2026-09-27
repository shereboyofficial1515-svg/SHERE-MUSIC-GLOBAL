import { supabase } from '../config/supabase.js';
import { notFound } from '../utils/AppError.js';
import { one, unwrap } from '../utils/db.js';

/**
 * Creator authorization. Ownership is always derived from the signed-in
 * user's id on the server: a creator owns an artist profile (artists.owner_user_id),
 * and every song, album, video and lyric of that artist through it.
 * IDs supplied by the client are only used to *look up* rows, which are then
 * checked against the session user — anything else is reported as "not found"
 * so other creators' content can't even be probed.
 */

export async function ownedArtistIds(userId) {
  const rows = unwrap(await supabase.from('artists').select('id').eq('owner_user_id', userId));
  return rows.map((r) => r.id);
}

export async function loadOwnedArtist(userId, artistId, fields = '*') {
  const row = await one(supabase.from('artists_view').select(fields).eq('id', artistId), 'Artist not found.');
  if (row.owner_user_id !== userId) throw notFound('Artist not found.');
  return row;
}

export async function loadOwnedSong(userId, songId, fields) {
  const row = await one(supabase.from('songs_view').select(fields).eq('id', songId), 'Song not found.');
  if (row.artist_owner_id !== userId) throw notFound('Song not found.');
  return row;
}

export async function loadOwnedAlbum(userId, albumId) {
  const row = await one(supabase.from('albums_view').select('*').eq('id', albumId), 'Album not found.');
  if (row.artist_owner_id !== userId) throw notFound('Album not found.');
  return row;
}

export async function loadOwnedVideo(userId, videoId, fields) {
  const row = await one(supabase.from('videos_view').select(fields).eq('id', videoId), 'Video not found.');
  if (row.artist_owner_id !== userId) throw notFound('Video not found.');
  return row;
}
