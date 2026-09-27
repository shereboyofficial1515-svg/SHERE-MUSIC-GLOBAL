import { Router } from 'express';
import * as library from '../controllers/library.controller.js';
import * as me from '../controllers/me.controller.js';
import { featuredPlaylists } from '../controllers/catalog.controller.js';
import * as social from '../controllers/social.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { emailLimiter, uploadLimiter } from '../middleware/security.js';
import { singleImage } from '../middleware/upload.js';
import { validate } from '../middleware/validate.js';
import { idParam } from '../validators/common.js';
import { deleteAccountSchema } from '../validators/auth.validators.js';
import {
  changeEmailSchema,
  notificationParam,
  profileSchema,
  providerParam,
  setPasswordSchema,
  settingsSchema,
} from '../validators/me.validators.js';
import {
  addPlaylistSongSchema,
  createPlaylistSchema,
  pageQuery,
  playlistSongParams,
  songIdParam,
  updatePlaylistSchema,
} from '../validators/library.validators.js';

const router = Router();

// ─── Current user ──────────────────────────────────────────────────────────
router.get('/me/profile', requireAuth, me.profile);
router.patch('/me', requireAuth, validate(profileSchema), me.updateProfile);
router.get('/me/settings', requireAuth, me.getMySettings);
router.put('/me/settings', requireAuth, validate(settingsSchema), me.updateMySettings);
router.post('/me/email', requireAuth, emailLimiter, validate(changeEmailSchema), me.requestEmailChange);
router.delete('/me/email', requireAuth, me.cancelEmailChange);
router.post('/me/password', requireAuth, validate(setPasswordSchema), me.setPassword);
router.post('/me/sessions/revoke-others', requireAuth, me.signOutOtherSessions);
router.get('/me/connected-accounts', requireAuth, me.connectedAccounts);
router.delete('/me/connected-accounts/:provider', requireAuth, validate(providerParam, 'params'), me.disconnectProvider);
router.get('/me/notifications', requireAuth, social.listNotifications);
router.post('/me/notifications/read', requireAuth, social.markNotificationsRead);
router.delete('/me/notifications/:id', requireAuth, validate(notificationParam, 'params'), social.deleteNotification);
router.get('/me/following', requireAuth, social.myFollowing);
router.get('/me/feed', requireAuth, social.followingFeed);
router.post('/me/avatar', requireAuth, uploadLimiter, singleImage('avatar'), me.uploadAvatar);
router.delete('/me/avatar', requireAuth, me.removeAvatar);
router.delete('/me', requireAuth, validate(deleteAccountSchema), me.deleteAccount);
router.get('/me/downloads', requireAuth, validate(pageQuery, 'query'), library.downloadHistory);
router.get('/me/recent', requireAuth, library.recentlyPlayed);

// ─── Favorites ─────────────────────────────────────────────────────────────
router.get('/favorites', requireAuth, validate(pageQuery, 'query'), library.listFavorites);
router.get('/favorites/ids', requireAuth, library.favoriteIds);
router.post('/favorites/:songId', requireAuth, validate(songIdParam, 'params'), library.addFavorite);
router.delete('/favorites/:songId', requireAuth, validate(songIdParam, 'params'), library.removeFavorite);

// ─── Playlists ─────────────────────────────────────────────────────────────
router.get('/playlists/featured', featuredPlaylists);
router.get('/playlists', requireAuth, library.myPlaylists);
router.post('/playlists', requireAuth, validate(createPlaylistSchema), library.createPlaylist);
router.get('/playlists/:id', validate(idParam, 'params'), library.getPlaylist);
router.patch('/playlists/:id', requireAuth, validate(idParam, 'params'), validate(updatePlaylistSchema), library.updatePlaylist);
router.delete('/playlists/:id', requireAuth, validate(idParam, 'params'), library.deletePlaylist);
router.post(
  '/playlists/:id/artwork',
  requireAuth,
  uploadLimiter,
  validate(idParam, 'params'),
  singleImage('artwork'),
  library.uploadPlaylistArtwork
);
router.post('/playlists/:id/songs', requireAuth, validate(idParam, 'params'), validate(addPlaylistSongSchema), library.addPlaylistSong);
router.delete('/playlists/:id/songs/:songId', requireAuth, validate(playlistSongParams, 'params'), library.removePlaylistSong);

export default router;
