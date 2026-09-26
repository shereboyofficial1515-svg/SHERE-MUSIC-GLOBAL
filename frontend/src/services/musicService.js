import { api } from './api.js';

/** Public catalog endpoints. */
export const musicService = {
  settings: () => api.get('/settings'),
  home: () => api.get('/home'),
  search: (q, options) => api.get('/search', { query: { q }, ...options }),

  songs: (query, options) => api.get('/songs', { query, ...options }),
  trending: (limit = 20) => api.get('/songs/trending', { query: { limit } }),
  song: (id) => api.get(`/songs/${id}`),
  related: (id) => api.get(`/songs/${id}/related`),
  streamUrl: (id) => api.get(`/songs/${id}/stream`),
  recordPlay: (id) => api.post(`/songs/${id}/play`),
  requestDownload: (id) => api.post(`/songs/${id}/download`),

  artists: (query) => api.get('/artists', { query }),
  artist: (id) => api.get(`/artists/${id}`),
  albums: (query) => api.get('/albums', { query }),
  album: (id) => api.get(`/albums/${id}`),
  genres: () => api.get('/genres'),
  genre: (slug) => api.get(`/genres/${encodeURIComponent(slug)}`),
  featuredPlaylists: () => api.get('/playlists/featured'),
};
