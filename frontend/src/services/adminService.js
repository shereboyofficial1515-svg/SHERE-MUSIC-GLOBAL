import { api, apiUrl, uploadWithProgress } from './api.js';

/** Build FormData from a plain object, skipping undefined values. */
export function toFormData(fields, files = {}) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    form.append(key, value === null ? '' : String(value));
  }
  for (const [key, file] of Object.entries(files)) if (file) form.append(key, file);
  return form;
}

export const adminService = {
  overview: () => api.get('/admin/overview'),
  analytics: (days) => api.get('/admin/analytics', { query: { days } }),
  downloads: (query) => api.get('/admin/downloads', { query }),
  reportUrl: (type, days) => apiUrl(`/admin/reports/${type}`, { days }),

  songs: (query, options) => api.get('/admin/songs', { query, ...options }),
  song: (id) => api.get(`/admin/songs/${id}`),
  songPreview: (id) => api.get(`/admin/songs/${id}/preview`),
  /** Returns { promise, abort } so the upload form can show progress and cancel. */
  createSong: (form, onProgress) => uploadWithProgress('POST', '/admin/songs', form, { onProgress }),
  updateSong: (id, form, onProgress) => uploadWithProgress('PATCH', `/admin/songs/${id}`, form, { onProgress }),
  publishSong: (id, isPublished) => api.patch(`/admin/songs/${id}/publish`, { isPublished }),
  featureSong: (id, isFeatured) => api.patch(`/admin/songs/${id}/feature`, { isFeatured }),
  deleteSong: (id) => api.delete(`/admin/songs/${id}`),

  artists: (query, options) => api.get('/admin/artists', { query, ...options }),
  artistOptions: () => api.get('/admin/artists/options'),
  saveArtist: (id, form) => uploadWithProgress(id ? 'PATCH' : 'POST', id ? `/admin/artists/${id}` : '/admin/artists', form).promise,
  deleteArtist: (id) => api.delete(`/admin/artists/${id}`),

  albums: (query, options) => api.get('/admin/albums', { query, ...options }),
  albumOptions: () => api.get('/admin/albums/options'),
  saveAlbum: (id, form) => uploadWithProgress(id ? 'PATCH' : 'POST', id ? `/admin/albums/${id}` : '/admin/albums', form).promise,
  deleteAlbum: (id) => api.delete(`/admin/albums/${id}`),
  addAlbumSongs: (id, songIds) => api.post(`/admin/albums/${id}/songs`, { songIds }),
  removeAlbumSong: (id, songId) => api.delete(`/admin/albums/${id}/songs/${songId}`),

  genres: () => api.get('/admin/genres'),
  createGenre: (body) => api.post('/admin/genres', body),
  updateGenre: (id, body) => api.patch(`/admin/genres/${id}`, body),
  deleteGenre: (id) => api.delete(`/admin/genres/${id}`),

  playlists: (query, options) => api.get('/admin/playlists', { query, ...options }),
  updatePlaylist: (id, body) => api.patch(`/admin/playlists/${id}`, body),
  deletePlaylist: (id) => api.delete(`/admin/playlists/${id}`),

  users: (query, options) => api.get('/admin/users', { query, ...options }),
  user: (id) => api.get(`/admin/users/${id}`),
  setUserStatus: (id, status) => api.patch(`/admin/users/${id}/status`, { status }),
  setUserRole: (id, role) => api.patch(`/admin/users/${id}/role`, { role }),

  settings: () => api.get('/admin/settings'),
  saveSettings: (body) => api.put('/admin/settings', body),
  uploadBranding: (kind, file) => {
    const form = new FormData();
    if (file) form.append('image', file);
    else form.append('remove', 'true');
    return uploadWithProgress('POST', `/admin/settings/${kind}`, form).promise;
  },
};
