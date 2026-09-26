import { randomUUID } from 'node:crypto';
import { supabase } from '../config/supabase.js';
import { env } from '../config/env.js';
import { AppError, badRequest } from '../utils/AppError.js';
import { detectAudio, detectImage, hasAudioExtension, hasImageExtension } from '../utils/fileType.js';

const MB = 1024 * 1024;
const { audioBucket, mediaBucket } = env.supabase;

export const FOLDERS = Object.freeze({
  songs: 'songs',
  artwork: 'artwork',
  artists: 'artists',
  albums: 'albums',
  avatars: 'avatars',
  playlists: 'playlists',
  branding: 'branding',
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
