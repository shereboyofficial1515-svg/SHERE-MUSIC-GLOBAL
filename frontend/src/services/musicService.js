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
  lyrics: (id, lang) => api.get(`/songs/${id}/lyrics`, { query: { lang } }),
  streamUrl: (id) => api.get(`/songs/${id}/stream`),
  recordPlay: (id) => api.post(`/songs/${id}/play`),
  requestDownload: (id) => api.post(`/songs/${id}/download`),

  artists: (query) => api.get('/artists', { query }),
  artist: (id) => api.get(`/artists/${id}`),
  artistFollowers: (id, query) => api.get(`/artists/${id}/followers`, { query }),
  follow: (id) => api.post(`/artists/${id}/follow`),
  unfollow: (id) => api.delete(`/artists/${id}/follow`),
  albums: (query) => api.get('/albums', { query }),
  album: (id) => api.get(`/albums/${id}`),
  genres: () => api.get('/genres'),
  genre: (slug) => api.get(`/genres/${encodeURIComponent(slug)}`),
  featuredPlaylists: () => api.get('/playlists/featured'),
  profile: (username) => api.get(`/users/${encodeURIComponent(username)}`),
};

/** SHERE MUSIC VIDEO endpoints. */
export const videoService = {
  home: () => api.get('/videos/home'),
  list: (query) => api.get('/videos', { query }),
  video: (id) => api.get(`/videos/${id}`),
  related: (id) => api.get(`/videos/${id}/related`),
  stream: (id) => api.get(`/videos/${id}/stream`),
  recordView: (id) => api.post(`/videos/${id}/view`),
  /** Subtitles are fetched as text and turned into same-origin blob: URLs for <track>. */
  async subtitleBlobUrl(videoId, subtitleId, base = '') {
    const res = await fetch(`${base || (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '')}/videos/${videoId}/subtitles/${subtitleId}`, { credentials: 'include' });
    if (!res.ok) throw new Error('Subtitles could not be loaded.');
    return URL.createObjectURL(new Blob([await res.text()], { type: 'text/vtt' }));
  },
};
