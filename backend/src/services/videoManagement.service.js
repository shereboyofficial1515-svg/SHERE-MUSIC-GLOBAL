import { supabase } from '../config/supabase.js';
import { badRequest } from '../utils/AppError.js';
import { dbError, one, unwrap } from '../utils/db.js';
import { VIDEO_MANAGE_FIELDS, toSubtitle, toVideo } from './mappers.js';
import {
  FOLDERS,
  createVideoUploadUrl,
  removeMedia,
  removeSubtitle,
  removeVideo,
  signedVideoUrl,
  uploadSubtitle,
  verifyVideoUpload,
  withUploadCleanup,
} from './storage.service.js';
import { getSettings, uploadLimits } from './settings.service.js';
import { processUploadedVideo } from './videoProcessing.service.js';

/**
 * Music-video create/update/delete, direct uploads and subtitles, shared by
 * Admin and Studio. Callers enforce who may act on which video.
 */

export const loadManagedVideo = (id) => one(supabase.from('videos_view').select(VIDEO_MANAGE_FIELDS).eq('id', id), 'Video not found.');

const COLUMNS = {
  title: 'title',
  artistId: 'artist_id',
  songId: 'song_id',
  genreId: 'genre_id',
  description: 'description',
  releaseDate: 'release_date',
  duration: 'duration',
  isFeatured: 'is_featured',
};

export function videoColumns(body, allowed = Object.keys(COLUMNS)) {
  const out = {};
  for (const key of allowed) if (body[key] !== undefined) out[COLUMNS[key]] = body[key];
  return out;
}

/** A linked song must belong to the same artist. */
export async function assertSongMatchesArtist(songId, artistId) {
  if (!songId) return;
  const song = await one(supabase.from('songs').select('artist_id').eq('id', songId), 'Linked song not found.');
  if (song.artist_id !== artistId) throw badRequest('The linked song belongs to a different artist.');
}

export async function createVideoRecord({ columns, thumbnail, actorId, workflow }) {
  await assertSongMatchesArtist(columns.song_id, columns.artist_id);
  const { imageMb } = uploadLimits(await getSettings());
  const id = await withUploadCleanup(async (upload) => {
    const thumbnail_path = thumbnail ? await upload.image(thumbnail, FOLDERS.thumbnails, imageMb) : null;
    const { data, error } = await supabase
      .from('music_videos')
      .insert({ ...columns, ...workflow, thumbnail_path, created_by: actorId })
      .select('id')
      .single();
    if (error) throw dbError(error);
    return data.id;
  });
  return loadManagedVideo(id);
}

export async function updateVideoRecord(existing, { columns, thumbnail, removeThumbnail, workflow = {} }) {
  const artistId = columns.artist_id ?? existing.artist_id;
  const songId = columns.song_id !== undefined ? columns.song_id : existing.song_id;
  if (columns.artist_id !== undefined || columns.song_id !== undefined) await assertSongMatchesArtist(songId, artistId);
  const { imageMb } = uploadLimits(await getSettings());
  const patch = { ...columns, ...workflow };
  const oldThumb = (await one(supabase.from('music_videos').select('thumbnail_path').eq('id', existing.id))).thumbnail_path;
  await withUploadCleanup(async (upload) => {
    if (thumbnail) patch.thumbnail_path = await upload.image(thumbnail, FOLDERS.thumbnails, imageMb);
    else if (removeThumbnail) patch.thumbnail_path = null;
    if (!Object.keys(patch).length) throw badRequest('Nothing to update.');
    unwrap(await supabase.from('music_videos').update(patch).eq('id', existing.id));
  });
  if ((thumbnail || removeThumbnail) && oldThumb) await removeMedia(oldThumb);
  return loadManagedVideo(existing.id);
}

export async function setVideoWorkflow(existing, patch) {
  unwrap(await supabase.from('music_videos').update(patch).eq('id', existing.id));
  return loadManagedVideo(existing.id);
}

export async function deleteVideoRecord(existing) {
  const [subs, thumb] = await Promise.all([
    supabase.from('video_subtitles').select('file_path').eq('video_id', existing.id),
    supabase.from('music_videos').select('thumbnail_path,renditions').eq('id', existing.id).single(),
  ]);
  unwrap(await supabase.from('music_videos').delete().eq('id', existing.id));
  const renditionPaths = (unwrap(thumb).renditions || []).map((r) => r.path).filter(Boolean);
  await Promise.all([
    removeVideo(existing.video_path, ...renditionPaths),
    removeMedia(unwrap(thumb).thumbnail_path),
    removeSubtitle(...unwrap(subs).map((s) => s.file_path)),
  ]);
}

// ─── Direct upload ────────────────────────────────────────────────────────
export async function startVideoUpload(existing, { filename, size }) {
  const { videoMb } = uploadLimits(await getSettings());
  return createVideoUploadUrl(existing.id, filename, size, videoMb);
}

/** Verify the uploaded object, attach it to the video and hand it to the processing pipeline. */
export async function completeVideoUpload(existing, { path, duration }, workflow = {}) {
  const { videoMb } = uploadLimits(await getSettings());
  const file = await verifyVideoUpload(existing.id, path, videoMb);
  unwrap(
    await supabase
      .from('music_videos')
      .update({
        video_path: file.path,
        video_mime: file.mime,
        video_size: file.size,
        processing_status: 'uploaded',
        renditions: [],
        ...(Number.isFinite(duration) ? { duration } : {}),
        ...workflow,
      })
      .eq('id', existing.id)
  );
  if (existing.video_path && existing.video_path !== file.path) await removeVideo(existing.video_path);
  await processUploadedVideo(existing.id);
  return loadManagedVideo(existing.id);
}

export async function previewVideo(existing) {
  if (!existing.video_path) throw badRequest('No video file has been uploaded yet.');
  return signedVideoUrl(existing.video_path, 60 * 60);
}

// ─── Subtitles ─────────────────────────────────────────────────────────────
export async function listSubtitles(videoId) {
  return unwrap(await supabase.from('video_subtitles').select('*').eq('video_id', videoId).order('label')).map(toSubtitle);
}

export async function addSubtitle(videoId, { language, label, isDefault }, file, actorId) {
  const settings = await getSettings();
  const allowed = (settings.subtitle_languages || []).map((l) => l.code);
  if (allowed.length && !allowed.includes(language)) throw badRequest('That subtitle language is not enabled. An admin can add it in Settings → Videos.');
  const existing = unwrap(await supabase.from('video_subtitles').select('id,file_path').eq('video_id', videoId).eq('language', language).maybeSingle());
  const path = await uploadSubtitle(videoId, file);
  try {
    if (isDefault) unwrap(await supabase.from('video_subtitles').update({ is_default: false }).eq('video_id', videoId));
    const row = { video_id: videoId, language, label, file_path: path, format: 'vtt', is_default: Boolean(isDefault), created_by: actorId };
    const saved = existing
      ? unwrap(await supabase.from('video_subtitles').update(row).eq('id', existing.id).select('*').single())
      : unwrap(await supabase.from('video_subtitles').insert(row).select('*').single());
    if (existing) await removeSubtitle(existing.file_path);
    return toSubtitle(saved);
  } catch (err) {
    await removeSubtitle(path);
    throw err;
  }
}

export async function deleteSubtitle(videoId, subtitleId) {
  const sub = await one(supabase.from('video_subtitles').select('id,file_path').eq('id', subtitleId).eq('video_id', videoId), 'Subtitles not found.');
  unwrap(await supabase.from('video_subtitles').delete().eq('id', sub.id));
  await removeSubtitle(sub.file_path);
}

export const manageVideo = (row) => toVideo(row, { manage: true });
