import { supabase } from '../config/supabase.js';
import { badRequest } from '../utils/AppError.js';
import { one, unwrap } from '../utils/db.js';
import { SONG_MANAGE_FIELDS } from './mappers.js';
import { FOLDERS, removeAudio, removeMedia, withUploadCleanup } from './storage.service.js';
import { getSettings, uploadLimits } from './settings.service.js';

/**
 * Song create/update/delete shared by Admin and Studio. Callers decide
 * *who* may act and *which* workflow columns change; this module owns the
 * file handling (validate → upload → write row → clean up on failure).
 */

export const loadManagedSong = (id) => one(supabase.from('songs_view').select(SONG_MANAGE_FIELDS).eq('id', id), 'Song not found.');

const FIELD_COLUMNS = {
  title: 'title',
  artistId: 'artist_id',
  albumId: 'album_id',
  genreId: 'genre_id',
  description: 'description',
  releaseDate: 'release_date',
  duration: 'duration',
  trackNumber: 'track_number',
  isFeatured: 'is_featured',
};

/** Map validated camelCase body → columns, only for the allowed keys. */
export function songColumns(body, allowed = Object.keys(FIELD_COLUMNS)) {
  const out = {};
  for (const key of allowed) if (body[key] !== undefined) out[FIELD_COLUMNS[key]] = body[key];
  return out;
}

/** An album must belong to the song's artist so the catalog stays consistent. */
export async function assertAlbumMatchesArtist(albumId, artistId) {
  if (!albumId) return;
  const album = await one(supabase.from('albums').select('artist_id').eq('id', albumId), 'Album not found.');
  if (album.artist_id !== artistId) throw badRequest('The selected album belongs to a different artist.');
}

export async function createSongRecord({ columns, audio, artwork, actorId, workflow }) {
  if (!audio) throw badRequest('An audio file is required.', [{ field: 'audio', message: 'Choose an audio file.' }]);
  await assertAlbumMatchesArtist(columns.album_id, columns.artist_id);
  const limits = uploadLimits(await getSettings());

  const id = await withUploadCleanup(async (upload) => {
    const stored = await upload.audio(audio, limits.audioMb);
    const artworkPath = artwork ? await upload.image(artwork, FOLDERS.artwork, limits.imageMb) : null;
    const row = unwrap(
      await supabase
        .from('songs')
        .insert({
          ...columns,
          ...workflow,
          audio_path: stored.path,
          audio_mime: stored.mime,
          audio_size: stored.size,
          artwork_path: artworkPath,
          created_by: actorId,
        })
        .select('id')
        .single()
    );
    return row.id;
  });
  return loadManagedSong(id);
}

/** Update metadata/files. Old files are deleted only after the row update succeeds. */
export async function updateSongRecord(existing, { columns, audio, artwork, removeArtwork, workflow = {} }) {
  const artistId = columns.artist_id ?? existing.artist_id;
  const albumId = columns.album_id !== undefined ? columns.album_id : existing.album_id;
  if (columns.artist_id !== undefined || columns.album_id !== undefined) await assertAlbumMatchesArtist(albumId, artistId);

  const limits = uploadLimits(await getSettings());
  const patch = { ...columns, ...workflow };
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
  return loadManagedSong(existing.id);
}

/** Delete the row first (plays, downloads, favorites, lyrics and playlist entries cascade), then the files. */
export async function deleteSongRecord(existing) {
  unwrap(await supabase.from('songs').delete().eq('id', existing.id));
  await Promise.all([removeAudio(existing.audio_path), removeMedia(existing.own_artwork_path)]);
}

/** Apply a workflow patch and return the reloaded row. */
export async function setSongWorkflow(existing, patch) {
  unwrap(await supabase.from('songs').update(patch).eq('id', existing.id));
  return loadManagedSong(existing.id);
}
