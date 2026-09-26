import { supabase } from '../../config/supabase.js';
import { badRequest } from '../../utils/AppError.js';
import { dbError, one, unwrap } from '../../utils/db.js';
import { created, noContent, ok, pageMeta, pageRange } from '../../utils/http.js';
import { cleanSearchTerm, ilikeAny } from '../../utils/search.js';
import { SONG_ADMIN_FIELDS, toSong } from '../../services/mappers.js';
import { FOLDERS, removeAudio, removeMedia, signedAudioUrl, withUploadCleanup } from '../../services/storage.service.js';
import { getSettings, uploadLimits } from '../../services/settings.service.js';

const SORTS = {
  created_desc: ['created_at', false],
  created_asc: ['created_at', true],
  title: ['title', true],
  plays: ['play_count', false],
  downloads: ['download_count', false],
  release: ['release_date', false],
};

const loadSong = (id) => one(supabase.from('songs_view').select(SONG_ADMIN_FIELDS).eq('id', id), 'Song not found.');

/** Ensure the album (if any) belongs to the chosen artist, so catalog data stays consistent. */
async function assertAlbumMatchesArtist(albumId, artistId) {
  if (!albumId) return;
  const album = await one(supabase.from('albums').select('artist_id').eq('id', albumId), 'Album not found.');
  if (album.artist_id !== artistId) throw badRequest('The selected album belongs to a different artist.');
}

function toColumns(body) {
  const map = {
    title: 'title',
    artistId: 'artist_id',
    albumId: 'album_id',
    genreId: 'genre_id',
    description: 'description',
    releaseDate: 'release_date',
    duration: 'duration',
    trackNumber: 'track_number',
    isFeatured: 'is_featured',
    isPublished: 'is_published',
  };
  const out = {};
  for (const [key, column] of Object.entries(map)) if (body[key] !== undefined) out[column] = body[key];
  return out;
}

export async function listSongs(req, res) {
  const { q, status, genre, artist, album, featured, sort, page, limit } = req.valid.query;
  let query = supabase.from('songs_view').select(SONG_ADMIN_FIELDS, { count: 'exact' });
  const term = cleanSearchTerm(q);
  if (term) query = query.or(ilikeAny(['title', 'artist_name', 'album_title', 'genre_name'], term));
  if (status !== 'all') query = query.eq('is_published', status === 'published');
  if (genre) query = query.eq('genre_id', genre);
  if (artist) query = query.eq('artist_id', artist);
  if (album) query = query.eq('album_id', album);
  if (featured !== undefined) query = query.eq('is_featured', featured);
  const [column, ascending] = SORTS[sort];
  const { from, to } = pageRange({ page, limit });
  const { data, count, error } = await query.order(column, { ascending, nullsFirst: false }).order('id').range(from, to);
  if (error) throw dbError(error);
  ok(res, data.map((r) => toSong(r, { admin: true })), pageMeta({ page, limit }, count));
}

export async function getSong(req, res) {
  ok(res, toSong(await loadSong(req.valid.params.id), { admin: true }));
}

/** Signed preview URL for any song, including unpublished drafts. */
export async function previewUrl(req, res) {
  const song = await loadSong(req.valid.params.id);
  const url = await signedAudioUrl(song.audio_path, { expiresIn: 60 * 60 });
  res.set('Cache-Control', 'private, no-store');
  ok(res, { url, mime: song.audio_mime, expiresIn: 3600 });
}

/**
 * Upload workflow: validate → upload audio (+ artwork) → insert row.
 * If anything after the first upload fails, the uploaded files are removed.
 */
export async function createSong(req, res) {
  const body = req.valid.body;
  const audio = req.files?.audio?.[0];
  const artwork = req.files?.artwork?.[0];
  if (!audio) throw badRequest('An audio file is required.', [{ field: 'audio', message: 'Choose an audio file.' }]);

  await one(supabase.from('artists').select('id').eq('id', body.artistId), 'Artist not found.');
  await assertAlbumMatchesArtist(body.albumId, body.artistId);
  const limits = uploadLimits(await getSettings());

  const id = await withUploadCleanup(async (upload) => {
    const stored = await upload.audio(audio, limits.audioMb);
    const artworkPath = artwork ? await upload.image(artwork, FOLDERS.artwork, limits.imageMb) : null;
    const row = unwrap(
      await supabase
        .from('songs')
        .insert({
          ...toColumns(body),
          audio_path: stored.path,
          audio_mime: stored.mime,
          audio_size: stored.size,
          artwork_path: artworkPath,
          published_at: body.isPublished ? new Date().toISOString() : null,
          created_by: req.user.id,
        })
        .select('id')
        .single()
    );
    return row.id;
  });

  created(res, toSong(await loadSong(id), { admin: true }));
}

/** Edit metadata and optionally replace audio/artwork. Old files are removed only after the DB update succeeds. */
export async function updateSong(req, res) {
  const existing = await loadSong(req.valid.params.id);
  const body = req.valid.body;
  const audio = req.files?.audio?.[0];
  const artwork = req.files?.artwork?.[0];
  const removeArtwork = req.body.removeArtwork === 'true' || req.body.removeArtwork === true;

  const artistId = body.artistId ?? existing.artist_id;
  const albumId = body.albumId !== undefined ? body.albumId : existing.album_id;
  if (body.artistId) await one(supabase.from('artists').select('id').eq('id', body.artistId), 'Artist not found.');
  if (body.artistId !== undefined || body.albumId !== undefined) await assertAlbumMatchesArtist(albumId, artistId);

  const limits = uploadLimits(await getSettings());
  const patch = toColumns(body);
  if (body.isPublished === true && !existing.is_published) patch.published_at = new Date().toISOString();

  await withUploadCleanup(async (upload) => {
    if (audio) {
      const stored = await upload.audio(audio, limits.audioMb);
      Object.assign(patch, { audio_path: stored.path, audio_mime: stored.mime, audio_size: stored.size });
    }
    if (artwork) patch.artwork_path = await upload.image(artwork, FOLDERS.artwork, limits.imageMb);
    else if (removeArtwork) patch.artwork_path = null;
    if (!Object.keys(patch).length) throw badRequest('Nothing to update.');
    unwrap(await supabase.from('songs').update(patch).eq('id', existing.id));
  });

  if (audio) await removeAudio(existing.audio_path);
  if ((artwork || removeArtwork) && existing.own_artwork_path) await removeMedia(existing.own_artwork_path);

  ok(res, toSong(await loadSong(existing.id), { admin: true }), { message: 'Song updated.' });
}

export async function setPublished(req, res) {
  const existing = await loadSong(req.valid.params.id);
  const { isPublished } = req.valid.body;
  const patch = { is_published: isPublished };
  if (isPublished && !existing.published_at) patch.published_at = new Date().toISOString();
  unwrap(await supabase.from('songs').update(patch).eq('id', existing.id));
  ok(res, toSong(await loadSong(existing.id), { admin: true }), { message: isPublished ? 'Song published.' : 'Song unpublished.' });
}

export async function setFeatured(req, res) {
  const existing = await loadSong(req.valid.params.id);
  unwrap(await supabase.from('songs').update({ is_featured: req.valid.body.isFeatured }).eq('id', existing.id));
  ok(res, toSong(await loadSong(existing.id), { admin: true }));
}

/** Delete the row first (plays, downloads, favorites and playlist entries cascade), then the files. */
export async function deleteSong(req, res) {
  const existing = await loadSong(req.valid.params.id);
  unwrap(await supabase.from('songs').delete().eq('id', existing.id));
  await Promise.all([removeAudio(existing.audio_path), removeMedia(existing.own_artwork_path)]);
  noContent(res);
}
