import { supabase } from '../config/supabase.js';
import { AppError, notFound } from '../utils/AppError.js';
import { dbError, one, unwrap } from '../utils/db.js';
import { ok, pageMeta, pageRange } from '../utils/http.js';
import { cleanSearchTerm, ilikeAny } from '../utils/search.js';
import { SONG_FIELDS, toSong } from '../services/mappers.js';
import { signedAudioUrl } from '../services/storage.service.js';
import { downloadFilename } from '../services/song.service.js';
import { getUserSettingsRow } from '../services/userSettings.service.js';

const STREAM_TTL_SECONDS = 4 * 60 * 60; // long enough for seeking through a long listening session
const DOWNLOAD_TTL_SECONDS = 120;

const SORTS = {
  latest: [['created_at', false]],
  released: [['release_date', false], ['created_at', false]],
  popular: [['play_count', false], ['created_at', false]],
  downloads: [['download_count', false], ['created_at', false]],
  title: [['title', true]],
};

export async function listSongs(req, res) {
  const { q, genre, artist, album, featured, sort, page, limit } = req.valid.query;
  let query = supabase.from('songs_view').select(SONG_FIELDS, { count: 'exact' }).eq('is_published', true);

  const term = cleanSearchTerm(q);
  if (term) query = query.or(ilikeAny(['title', 'artist_name', 'album_title', 'genre_name'], term));
  if (genre) query = /^[0-9a-f-]{36}$/i.test(genre) ? query.eq('genre_id', genre) : query.eq('genre_slug', genre);
  if (artist) query = query.eq('artist_id', artist);
  if (album) query = query.eq('album_id', album);
  if (featured !== undefined) query = query.eq('is_featured', featured);

  for (const [column, ascending] of SORTS[sort]) query = query.order(column, { ascending, nullsFirst: false });
  query = query.order('id');

  const { from, to } = pageRange({ page, limit });
  const { data, count, error } = await query.range(from, to);
  if (error) throw dbError(error);
  ok(res, data.map((r) => toSong(r)), pageMeta({ page, limit }, count));
}

export async function trending(req, res) {
  const limit = Math.min(Number(req.query.limit) || 12, 50);
  const rows = unwrap(await supabase.rpc('trending_songs', { p_days: 7, p_limit: limit }).select(SONG_FIELDS));
  ok(res, rows.map((r) => toSong(r)));
}

async function getPublishedSong(id) {
  return one(supabase.from('songs_view').select(`${SONG_FIELDS},audio_path,audio_mime`).eq('id', id).eq('is_published', true), 'Song not found.');
}

export async function getSong(req, res) {
  const row = await getPublishedSong(req.valid.params.id);
  ok(res, toSong(row));
}

/** Songs by the same artist or in the same genre, most played first. */
export async function relatedSongs(req, res) {
  const song = await getPublishedSong(req.valid.params.id);
  const filters = [`artist_id.eq.${song.artist_id}`];
  if (song.genre_id) filters.push(`genre_id.eq.${song.genre_id}`);
  if (song.album_id) filters.push(`album_id.eq.${song.album_id}`);

  let rows = unwrap(
    await supabase
      .from('songs_view')
      .select(SONG_FIELDS)
      .eq('is_published', true)
      .neq('id', song.id)
      .or(filters.join(','))
      .order('play_count', { ascending: false })
      .limit(12)
  );

  // Top up with popular songs so the section is never empty on a young catalog.
  if (rows.length < 6) {
    const exclude = [song.id, ...rows.map((r) => r.id)];
    const extra = unwrap(
      await supabase
        .from('songs_view')
        .select(SONG_FIELDS)
        .eq('is_published', true)
        .not('id', 'in', `(${exclude.join(',')})`)
        .order('play_count', { ascending: false })
        .limit(6 - rows.length)
    );
    rows = rows.concat(extra);
  }
  ok(res, rows.map((r) => toSong(r)));
}

/** Short-lived signed URL the browser's <audio> element can stream (supports HTTP range requests). */
export async function streamUrl(req, res) {
  const song = await getPublishedSong(req.valid.params.id);
  const url = await signedAudioUrl(song.audio_path, { expiresIn: STREAM_TTL_SECONDS });
  res.set('Cache-Control', 'private, no-store');
  ok(res, { url, mime: song.audio_mime, expiresIn: STREAM_TTL_SECONDS });
}

/** Listeners who opted out of usage analytics are counted anonymously (so no listening history is kept). */
async function analyticsUserId(user) {
  if (!user) return null;
  const settings = await getUserSettingsRow(user.id);
  return settings.privacy_preferences.usageAnalytics === false ? null : user.id;
}

export async function recordPlay(req, res) {
  const counted = unwrap(await supabase.rpc('record_play', { p_song_id: req.valid.params.id, p_user_id: await analyticsUserId(req.user) }));
  if (!counted) throw notFound('Song not found.');
  ok(res, { counted: true });
}

/**
 * Issue a signed download URL (Content-Disposition: attachment) for the original
 * file. The URL is only created — and the download only counted — if the file exists.
 */
export async function download(req, res) {
  const song = await getPublishedSong(req.valid.params.id);
  const filename = downloadFilename(song, song.audio_mime);
  const url = await signedAudioUrl(song.audio_path, { expiresIn: DOWNLOAD_TTL_SECONDS, download: filename });

  // Download history is a user-facing feature, so signed-in downloads are always attributed.
  const counted = unwrap(await supabase.rpc('record_download', { p_song_id: song.id, p_user_id: req.user?.id ?? null }));
  if (!counted) throw new AppError(404, 'Song not found.', 'NOT_FOUND');

  res.set('Cache-Control', 'private, no-store');
  ok(res, { url, filename, mime: song.audio_mime });
}
