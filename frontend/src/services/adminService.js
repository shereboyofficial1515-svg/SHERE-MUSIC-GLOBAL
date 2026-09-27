import { api, apiUrl, uploadWithProgress } from './api.js';
import { createContentService, toFormData } from './contentService.js';

export { toFormData };

export const adminService = {
  ...createContentService('/admin'),

  overview: () => api.get('/admin/overview'),
  analytics: (days) => api.get('/admin/analytics', { query: { days } }),
  downloads: (query) => api.get('/admin/downloads', { query }),
  reportUrl: (type, days) => apiUrl(`/admin/reports/${type}`, { days }),
  reviews: (type = 'all') => api.get('/admin/reviews', { query: { type } }),

  publishSong: (id, isPublished) => api.patch(`/admin/songs/${id}/publish`, { isPublished }),
  featureSong: (id, isFeatured) => api.patch(`/admin/songs/${id}/feature`, { isFeatured }),
  reviewSong: (id, decision, reason) => api.post(`/admin/songs/${id}/review`, { decision, reason }),

  lyricsList: (query) => api.get('/admin/lyrics', { query }),
  reviewLyrics: (songId, lyricsId, decision, reason) => api.post(`/admin/songs/${songId}/lyrics/${lyricsId}/review`, { decision, reason }),
  setLyricsVisibility: (songId, lyricsId, isVisible) => api.patch(`/admin/songs/${songId}/lyrics/${lyricsId}/visibility`, { isVisible }),

  reviewVideo: (id, decision, reason) => api.post(`/admin/videos/${id}/review`, { decision, reason }),
  featureVideo: (id, isFeatured) => api.patch(`/admin/videos/${id}/feature`, { isFeatured }),

  artists: (query, options) => api.get('/admin/artists', { query, ...options }),
  artistOptions: () => api.get('/admin/artists/options'),
  saveArtist: (id, form) => uploadWithProgress(id ? 'PATCH' : 'POST', id ? `/admin/artists/${id}` : '/admin/artists', form).promise,
  deleteArtist: (id) => api.delete(`/admin/artists/${id}`),
  decideVerification: (id, decision, note) => api.post(`/admin/artists/${id}/verification`, { decision, note }),

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

// ─── Monetization ──────────────────────────────────────────────────────────
Object.assign(adminService, {
  monetizationSettings: () => api.get('/admin/monetization/settings'),
  saveMonetizationSettings: (body) => api.put('/admin/monetization/settings', body),
  monetizationSummary: (query) => api.get('/admin/monetization/summary', { query }),
  payments: (query) => api.get('/admin/payments', { query }),
  plusMembers: (query) => api.get('/admin/plus-members', { query }),
  plusMember: (id) => api.get(`/admin/plus-members/${id}`),
  submissions: (query) => api.get('/admin/submissions', { query }),
  submission: (id) => api.get(`/admin/submissions/${id}`),
  reviewSubmission: (id, body) => api.post(`/admin/submissions/${id}/review`, body),
  offers: () => api.get('/admin/offers'),
  createOffer: (form) => api.post('/admin/offers', form),
  updateOffer: (id, form) => api.patch(`/admin/offers/${id}`, form),
  deleteOffer: (id) => api.delete(`/admin/offers/${id}`),
});
