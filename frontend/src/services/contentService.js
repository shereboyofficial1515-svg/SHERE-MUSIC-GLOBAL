import { api, ApiError, apiUrl, uploadWithProgress } from './api.js';
import { supabaseAnonKey } from './supabaseClient.js';

/** Build FormData from a plain object, skipping undefined values. Objects are sent as JSON. */
export function toFormData(fields, files = {}) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    if (value !== null && typeof value === 'object') form.append(key, JSON.stringify(value));
    else form.append(key, value === null ? '' : String(value));
  }
  for (const [key, file] of Object.entries(files)) if (file) form.append(key, file);
  return form;
}

/**
 * Songs, lyrics and music videos are managed from two places with the same
 * shape of API: Admin (`/admin`, everything) and Studio (`/studio`, only the
 * creator's own content). Shared editors receive one of these clients.
 */
export function createContentService(prefix) {
  const p = (path) => `${prefix}${path}`;
  return {
    scope: prefix === '/admin' ? 'admin' : 'studio',

    // Songs
    songs: (query, options) => api.get(p('/songs'), { query, ...options }),
    song: (id) => api.get(p(`/songs/${id}`)),
    songPreview: (id) => api.get(p(`/songs/${id}/preview`)),
    createSong: (form, onProgress) => uploadWithProgress('POST', p('/songs'), form, { onProgress }),
    updateSong: (id, form, onProgress) => uploadWithProgress('PATCH', p(`/songs/${id}`), form, { onProgress }),
    deleteSong: (id) => api.delete(p(`/songs/${id}`)),

    // Lyrics
    songLyrics: (songId) => api.get(p(`/songs/${songId}/lyrics`)),
    saveLyrics: (songId, lyricsId, body) =>
      lyricsId ? api.put(p(`/songs/${songId}/lyrics/${lyricsId}`), body) : api.post(p(`/songs/${songId}/lyrics`), body),
    deleteLyrics: (songId, lyricsId) => api.delete(p(`/songs/${songId}/lyrics/${lyricsId}`)),
    lyricsFromProvider: (songId) => api.get(p(`/songs/${songId}/lyrics/provider`)),

    // Music videos
    videos: (query, options) => api.get(p('/videos'), { query, ...options }),
    video: (id) => api.get(p(`/videos/${id}`)),
    createVideo: (form) => uploadWithProgress('POST', p('/videos'), form).promise,
    updateVideo: (id, form) => uploadWithProgress('PATCH', p(`/videos/${id}`), form).promise,
    deleteVideo: (id) => api.delete(p(`/videos/${id}`)),
    videoPreview: (id) => api.get(p(`/videos/${id}/preview`)),
    subtitles: (id) => api.get(p(`/videos/${id}/subtitles`)),
    addSubtitle: (id, fields, file) => uploadWithProgress('POST', p(`/videos/${id}/subtitles`), toFormData(fields, { file })).promise,
    deleteSubtitle: (id, subtitleId) => api.delete(p(`/videos/${id}/subtitles/${subtitleId}`)),
    /** Draft-safe subtitle preview: the WebVTT as a same-origin blob: URL. */
    async subtitleBlobUrl(id, subtitleId) {
      const res = await fetch(apiUrl(p(`/videos/${id}/subtitles/${subtitleId}/file`)), { credentials: 'include' });
      if (!res.ok) throw new Error('Subtitles could not be loaded.');
      return URL.createObjectURL(new Blob([await res.text()], { type: 'text/vtt' }));
    },

    /**
     * Upload a video file straight to storage with progress:
     * 1) ask the API for a one-time signed upload URL, 2) PUT the file,
     * 3) ask the API to verify and attach it. Returns { promise, abort }.
     */
    uploadVideoFile(id, file, { onProgress, duration } = {}) {
      let xhr = null;
      let aborted = false;
      const promise = (async () => {
        const { data } = await api.post(p(`/videos/${id}/upload-url`), { filename: file.name, size: file.size });
        if (aborted) throw new ApiError('Upload cancelled.', 0, 'ABORTED');
        await new Promise((resolve, reject) => {
          xhr = new XMLHttpRequest();
          xhr.open('PUT', data.uploadUrl);
          xhr.setRequestHeader('x-upsert', 'false');
          if (supabaseAnonKey) xhr.setRequestHeader('apikey', supabaseAnonKey);
          xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100));
          xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(storageError(xhr)));
          xhr.onerror = () => reject(new ApiError('Video upload failed. Please check your connection and try again.', 0, 'NETWORK_ERROR'));
          xhr.onabort = () => reject(new ApiError('Upload cancelled.', 0, 'ABORTED'));
          const form = new FormData();
          form.append('cacheControl', '3600');
          form.append('', file);
          xhr.send(form);
        });
        return api.post(p(`/videos/${id}/complete-upload`), { path: data.path, duration: Number.isFinite(duration) ? Math.round(duration) : null });
      })();
      return {
        promise,
        abort: () => {
          aborted = true;
          xhr?.abort();
        },
      };
    },
  };
}

function storageError(xhr) {
  let message = 'Video upload failed. Please try again.';
  try {
    const body = JSON.parse(xhr.responseText);
    if (/maximum allowed size|too large|Payload too large/i.test(body.message || body.error || '')) {
      message = 'This video is larger than the storage limit allows. Ask an admin to raise the limit, or compress the video.';
    } else if (body.message) message = `Video upload failed: ${body.message}`;
  } catch {
    /* non-JSON */
  }
  return new ApiError(message, xhr.status, 'STORAGE_ERROR');
}
