import { api, uploadWithProgress } from './api.js';

/** Endpoints for the signed-in listener: profile, settings, library, notifications. */
export const userService = {
  profile: () => api.get('/me/profile'),
  updateProfile: (body) => api.patch('/me', body),
  uploadAvatar: (file) => {
    const form = new FormData();
    form.append('avatar', file);
    return uploadWithProgress('POST', '/me/avatar', form).promise;
  },
  removeAvatar: () => api.delete('/me/avatar'),
  deleteAccount: (password) => api.delete('/me', { body: { password } }),
  downloads: (query) => api.get('/me/downloads', { query }),
  recent: () => api.get('/me/recent'),

  settings: () => api.get('/me/settings'),
  saveSettings: (body) => api.put('/me/settings', body),
  requestEmailChange: (body) => api.post('/me/email', body),
  cancelEmailChange: () => api.delete('/me/email'),
  setPassword: (body) => api.post('/me/password', body),
  signOutOthers: () => api.post('/me/sessions/revoke-others'),
  connectedAccounts: () => api.get('/me/connected-accounts'),
  disconnect: (provider) => api.delete(`/me/connected-accounts/${provider}`),

  notifications: () => api.get('/me/notifications'),
  markNotificationsRead: (ids) => api.post('/me/notifications/read', ids ? { ids } : {}),
  deleteNotification: (id) => api.delete(`/me/notifications/${id}`),
  following: () => api.get('/me/following'),
  feed: () => api.get('/me/feed'),

  favorites: (query) => api.get('/favorites', { query }),
  favoriteIds: () => api.get('/favorites/ids'),
  addFavorite: (songId) => api.post(`/favorites/${songId}`),
  removeFavorite: (songId) => api.delete(`/favorites/${songId}`),

  playlists: () => api.get('/playlists'),
  playlist: (id) => api.get(`/playlists/${id}`),
  createPlaylist: (body) => api.post('/playlists', body),
  updatePlaylist: (id, body) => api.patch(`/playlists/${id}`, body),
  deletePlaylist: (id) => api.delete(`/playlists/${id}`),
  addToPlaylist: (id, songId) => api.post(`/playlists/${id}/songs`, { songId }),
  removeFromPlaylist: (id, songId) => api.delete(`/playlists/${id}/songs/${songId}`),
  uploadPlaylistArtwork: (id, file) => {
    const form = new FormData();
    form.append('artwork', file);
    return uploadWithProgress('POST', `/playlists/${id}/artwork`, form).promise;
  },
};
