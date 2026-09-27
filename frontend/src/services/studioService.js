import { api, uploadWithProgress } from './api.js';
import { createContentService } from './contentService.js';

/** SHERE MUSIC STUDIO — the creator's own content only (enforced by the API). */
export const studioService = {
  ...createContentService('/studio'),

  status: () => api.get('/studio/me'),
  createArtist: (form) => uploadWithProgress('POST', '/studio/artists', form).promise,
  overview: () => api.get('/studio/overview'),
  analytics: (days) => api.get('/studio/analytics', { query: { days } }),
  options: () => api.get('/studio/options'),
  followers: (query) => api.get('/studio/followers', { query }),

  artists: () => api.get('/studio/artists'),
  updateArtist: (id, form) => uploadWithProgress('PATCH', `/studio/artists/${id}`, form).promise,
  requestVerification: (id, message) => api.post(`/studio/artists/${id}/verification`, { message }),
  deleteArtist: (id) => api.delete(`/studio/artists/${id}`),

  albums: () => api.get('/studio/albums'),
  saveAlbum: (id, form) => uploadWithProgress(id ? 'PATCH' : 'POST', id ? `/studio/albums/${id}` : '/studio/albums', form).promise,
  deleteAlbum: (id) => api.delete(`/studio/albums/${id}`),
  addAlbumSongs: (id, songIds) => api.post(`/studio/albums/${id}/songs`, { songIds }),

  submitSong: (id) => api.post(`/studio/songs/${id}/submit`),
  publishSong: (id, isPublished) => api.post(`/studio/songs/${id}/publish`, { isPublished }),
  lyricsOverview: () => api.get('/studio/lyrics'),
  submitLyrics: (songId, lyricsId) => api.post(`/studio/songs/${songId}/lyrics/${lyricsId}/submit`),
  submitVideo: (id) => api.post(`/studio/videos/${id}/submit`),
  publishVideo: (id, isPublished) => api.post(`/studio/videos/${id}/publish`, { isPublished }),
};
