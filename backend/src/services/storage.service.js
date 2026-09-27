import { randomUUID } from 'node:crypto';
import { supabase } from '../config/supabase.js';
import { env } from '../config/env.js';
import { AppError, badRequest } from '../utils/AppError.js';
import { detectAudio, detectImage, detectVideo, hasAudioExtension, hasImageExtension, toWebVtt, videoTypeFromName } from '../utils/fileType.js';

const MB = 1024 * 1024;
const { audioBucket, mediaBucket, videoBucket, subtitleBucket } = env.supabase;

export const FOLDERS = Object.freeze({
  songs: 'songs',
  artwork: 'artwork',
  artists: 'artists',
  albums: 'albums',
  avatars: 'avatars',
  playlists: 'playlists',
  branding: 'branding',
  covers: 'covers',
  thumbnails: 'thumbnails',
});

/** Public URL for an object in the public media bucket. */
export function mediaUrl(path) {
  if (!path) return null;
  const encoded = path.split('/').map(encodeURIComponent).join('/');
  return `${env.supabase.url}/storage/v1/object/public/${mediaBucket}/${encoded}`;
}

/** Storage key with a random name; the uploader's filename is never used. */
function objectKey(folder, ext) {
  const now = new Date();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${folder}/${now.getUTCFullYear()}/${month}/${randomUUID()}.${ext}`;
}

async function put(bucket, key, file, mime) {
  const { error } = await supabase.storage.from(bucket).upload(key, file.buffer, {
    contentType: mime,
    cacheControl: '31536000',
    upsert: false,
  });
  if (error) {
    const err = new AppError(502, 'Could not save the file to storage. Please try again.', 'STORAGE_ERROR');
    err.cause = error;
    throw err;
  }
  return key;
}

export function validateAudio(file, maxMb) {
  if (!file) throw badRequest('An audio file is required.');
  const type = detectAudio(file.buffer);
  if (!type || !hasAudioExtension(file.originalname)) {
    throw badRequest('Unsupported audio file. Upload an MP3, WAV, M4A or AAC file.');
  }
  if (file.size > maxMb * MB) throw new AppError(413, `Audio files must be ${maxMb} MB or smaller.`, 'FILE_TOO_LARGE');
  return type;
}

export function validateImage(file, maxMb, { allowIco = false } = {}) {
  const type = detectImage(file.buffer, { allowIco });
  if (!type || !hasImageExtension(file.originalname)) {
    throw badRequest(`Unsupported image. Upload a JPG, PNG${allowIco ? ', ICO' : ''} or WebP file.`);
  }
  if (file.size > maxMb * MB) throw new AppError(413, `Images must be ${maxMb} MB or smaller.`, 'FILE_TOO_LARGE');
  return type;
}

export async function uploadAudio(file, maxMb) {
  const type = validateAudio(file, maxMb);
  const path = await put(audioBucket, objectKey(FOLDERS.songs, type.ext), file, type.mime);
  return { path, mime: type.mime, size: file.size };
}

export async function uploadImage(file, folder, maxMb, options) {
  const type = validateImage(file, maxMb, options);
  return put(mediaBucket, objectKey(folder, type.ext), file, type.mime);
}

/** Best-effort removal; failures are logged, not thrown, so they never mask the real outcome. */
export async function removeObjects(bucket, paths) {
  const valid = paths.filter(Boolean);
  if (!valid.length) return;
  const { error } = await supabase.storage.from(bucket).remove(valid);
  if (error) console.error(`[storage] Failed to remove ${valid.join(', ')} from ${bucket}:`, error.message);
}

export const removeAudio = (...paths) => removeObjects(audioBucket, paths);
export const removeMedia = (...paths) => removeObjects(mediaBucket, paths);

/**
 * Run `fn` with upload tracking. If `fn` throws after files were uploaded
 * (e.g. the database insert fails), every tracked file is deleted so no
 * orphaned objects accumulate in storage.
 */
export async function withUploadCleanup(fn) {
  const uploaded = [];
  const track = {
    audio: async (file, maxMb) => {
      const result = await uploadAudio(file, maxMb);
      uploaded.push([audioBucket, result.path]);
      return result;
    },
    image: async (file, folder, maxMb, options) => {
      const path = await uploadImage(file, folder, maxMb, options);
      uploaded.push([mediaBucket, path]);
      return path;
    },
  };
  try {
    return await fn(track);
  } catch (err) {
    await Promise.all(uploaded.map(([bucket, path]) => removeObjects(bucket, [path])));
    throw err;
  }
}

/**
 * Short-lived signed URL for a private audio object. Supabase returns an error
 * when the object does not exist, which we surface as a clean 404.
 */
export async function signedAudioUrl(path, { expiresIn, download } = {}) {
  const { data, error } = await supabase.storage
    .from(audioBucket)
    .createSignedUrl(path, expiresIn, download ? { download } : undefined);
  if (error || !data?.signedUrl) {
    const missing = /not.?found/i.test(error?.message || '') || error?.statusCode === '404' || error?.status === 400;
    const err = missing
      ? new AppError(404, 'This audio file is no longer available.', 'AUDIO_MISSING')
      : new AppError(502, 'Audio is temporarily unavailable. Please try again.', 'STORAGE_ERROR');
    err.cause = error;
    throw err;
  }
  return data.signedUrl;
}

export const removeVideo = (...paths) => removeObjects(videoBucket, paths);
export const removeSubtitle = (...paths) => removeObjects(subtitleBucket, paths);

// ─── Music videos: direct browser → storage uploads ────────────────────────
// Videos are too large to stream through the API, so the API issues a
// one-time signed upload URL scoped to a path under the video's own folder,
// then verifies the uploaded object's size and bytes before accepting it.

/** Folder that every upload for a given video must live in. */
export const videoFolder = (videoId) => `videos/${videoId}/`;

export async function createVideoUploadUrl(videoId, filename, size, maxMb) {
  const type = videoTypeFromName(filename);
  if (!type) throw badRequest('Unsupported video. Upload an MP4, WebM or MOV file.');
  if (!Number.isFinite(size) || size <= 0) throw badRequest('Invalid file size.');
  if (size > maxMb * MB) throw new AppError(413, `Videos must be ${maxMb} MB or smaller.`, 'FILE_TOO_LARGE');
  const path = `${videoFolder(videoId)}${randomUUID()}.${type.ext}`;
  const { data, error } = await supabase.storage.from(videoBucket).createSignedUploadUrl(path);
  if (error || !data) {
    const err = new AppError(502, 'Could not prepare the upload. Please try again.', 'STORAGE_ERROR');
    err.cause = error;
    throw err;
  }
  return { path, uploadUrl: data.signedUrl, token: data.token, mime: type.mime };
}

/**
 * Confirm a direct upload: the object must exist under the video's folder,
 * respect the size limit and start with real video bytes. Invalid files are deleted.
 */
export async function verifyVideoUpload(videoId, path, maxMb) {
  if (typeof path !== 'string' || !path.startsWith(videoFolder(videoId)) || path.includes('..')) {
    throw badRequest('Invalid upload path.');
  }
  const folder = path.slice(0, path.lastIndexOf('/'));
  const name = path.slice(path.lastIndexOf('/') + 1);
  const { data: files, error } = await supabase.storage.from(videoBucket).list(folder, { search: name, limit: 5 });
  const meta = !error && files?.find((f) => f.name === name);
  if (!meta) throw badRequest('The uploaded video was not found. Please upload it again.');
  const size = Number(meta.metadata?.size || 0);

  const reject = async (message, status = 400) => {
    await removeVideo(path);
    throw new AppError(status, message, status === 413 ? 'FILE_TOO_LARGE' : 'BAD_REQUEST');
  };
  if (!size) return reject('The uploaded video is empty.');
  if (size > maxMb * MB) return reject(`Videos must be ${maxMb} MB or smaller.`, 413);

  // Read only the first bytes to check the container signature.
  const { data: signed } = await supabase.storage.from(videoBucket).createSignedUrl(path, 60);
  let head = null;
  try {
    if (!signed?.signedUrl) throw new Error('no signed url');
    const res = await fetch(signed.signedUrl, { headers: { Range: 'bytes=0-63' } });
    head = Buffer.from(await res.arrayBuffer());
  } catch {
    throw new AppError(502, 'Could not verify the uploaded video. Please try again.', 'STORAGE_ERROR');
  }
  const type = detectVideo(head);
  if (!type) return reject('This file is not a supported video. Upload an MP4, WebM or MOV file.');
  return { path, mime: type.mime, size };
}

export async function signedVideoUrl(path, expiresIn = 4 * 60 * 60) {
  const { data, error } = await supabase.storage.from(videoBucket).createSignedUrl(path, expiresIn);
  if (error || !data?.signedUrl) {
    const err = new AppError(404, 'This video is no longer available.', 'VIDEO_MISSING');
    err.cause = error;
    throw err;
  }
  return data.signedUrl;
}

// ─── Subtitles ─────────────────────────────────────────────────────────────
export async function uploadSubtitle(videoId, file) {
  if (!file) throw badRequest('Choose a subtitle file.');
  if (file.size > 2 * MB) throw new AppError(413, 'Subtitle files must be 2 MB or smaller.', 'FILE_TOO_LARGE');
  const vtt = toWebVtt(file.buffer, file.originalname);
  if (!vtt) throw badRequest('Unsupported subtitle file. Upload a WebVTT (.vtt) or SubRip (.srt) file.');
  const path = `subtitles/${videoId}/${randomUUID()}.vtt`;
  const { error } = await supabase.storage.from(subtitleBucket).upload(path, Buffer.from(vtt, 'utf8'), {
    contentType: 'text/vtt',
    upsert: false,
  });
  if (error) {
    const err = new AppError(502, 'Could not save the subtitle file. Please try again.', 'STORAGE_ERROR');
    err.cause = error;
    throw err;
  }
  return path;
}

export async function readSubtitle(path) {
  const { data, error } = await supabase.storage.from(subtitleBucket).download(path);
  if (error || !data) throw new AppError(404, 'Subtitles are not available.', 'NOT_FOUND');
  return Buffer.from(await data.arrayBuffer()).toString('utf8');
}
