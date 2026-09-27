import { Router } from 'express';
import * as songs from '../controllers/admin/songs.controller.js';
import * as catalog from '../controllers/admin/catalog.controller.js';
import * as users from '../controllers/admin/users.controller.js';
import * as insights from '../controllers/admin/insights.controller.js';
import * as settings from '../controllers/admin/settings.controller.js';
import * as reviews from '../controllers/admin/reviews.controller.js';
import { adminListLyrics, lyricsHandlers } from '../controllers/shared/lyrics.handlers.js';
import { videoHandlers } from '../controllers/shared/video.handlers.js';
import { requireAdmin } from '../middleware/auth.js';
import { uploadLimiter } from '../middleware/security.js';
import { artistImages, singleImage, songFiles, subtitleFile } from '../middleware/upload.js';
import { validate } from '../middleware/validate.js';
import { idParam } from '../validators/common.js';
import {
  adminSongListQuery,
  albumSchema,
  albumSongsSchema,
  artistSchema,
  createSongSchema,
  featureSchema,
  genreSchema,
  listQuery,
  publishSchema,
  reviewSchema,
  updateSongSchema,
  verificationDecisionSchema,
} from '../validators/catalog.validators.js';
import { lyricsListQuery, lyricsParams, lyricsVisibilitySchema, saveLyricsSchema } from '../validators/lyrics.validators.js';
import {
  completeUploadSchema,
  createVideoSchema,
  manageVideoListQuery,
  subtitleParams,
  subtitleSchema,
  updateVideoSchema,
  uploadUrlSchema,
} from '../validators/video.validators.js';
import {
  adminPlaylistQuery,
  adminPlaylistUpdate,
  analyticsQuery,
  downloadsQuery,
  reportParams,
  reportQuery,
  reviewQueueQuery,
  settingsSchema,
  userListQuery,
  userRoleSchema,
  userStatusSchema,
} from '../validators/admin.validators.js';
import { playlistSongParams } from '../validators/library.validators.js';

const router = Router();

// Every admin endpoint requires an authenticated administrator.
router.use(requireAdmin);

const id = validate(idParam, 'params');
const lyrics = lyricsHandlers('admin');
const videos = videoHandlers('admin');

// Review queue (creator submissions + verification requests)
router.get('/reviews', validate(reviewQueueQuery, 'query'), reviews.reviewQueue);

// Overview, analytics, reports
router.get('/overview', insights.overview);
router.get('/analytics', validate(analyticsQuery, 'query'), insights.analytics);
router.get('/downloads', validate(downloadsQuery, 'query'), insights.downloads);
router.get('/reports/:type', validate(reportParams, 'params'), validate(reportQuery, 'query'), insights.report);

// Songs
router.get('/songs', validate(adminSongListQuery, 'query'), songs.listSongs);
router.get('/songs/:id', id, songs.getSong);
router.get('/songs/:id/preview', id, songs.previewUrl);
router.post('/songs', uploadLimiter, songFiles, validate(createSongSchema), songs.createSong);
router.patch('/songs/:id', uploadLimiter, id, songFiles, validate(updateSongSchema), songs.updateSong);
router.patch('/songs/:id/publish', id, validate(publishSchema), songs.setPublished);
router.patch('/songs/:id/feature', id, validate(featureSchema), songs.setFeatured);
router.post('/songs/:id/review', id, validate(reviewSchema), songs.reviewSong);

// Lyrics
router.get('/lyrics', validate(lyricsListQuery, 'query'), adminListLyrics);
router.get('/songs/:id/lyrics', id, lyrics.list);
router.post('/songs/:id/lyrics', id, validate(saveLyricsSchema), lyrics.save);
router.get('/songs/:id/lyrics/provider', id, lyrics.importFromProvider);
router.put('/songs/:id/lyrics/:lyricsId', validate(lyricsParams, 'params'), validate(saveLyricsSchema), lyrics.save);
router.post('/songs/:id/lyrics/:lyricsId/review', validate(lyricsParams, 'params'), validate(reviewSchema), lyrics.review);
router.patch('/songs/:id/lyrics/:lyricsId/visibility', validate(lyricsParams, 'params'), validate(lyricsVisibilitySchema), lyrics.visibility);
router.delete('/songs/:id/lyrics/:lyricsId', validate(lyricsParams, 'params'), lyrics.remove);

// Music videos
router.get('/videos', validate(manageVideoListQuery, 'query'), videos.list);
router.get('/videos/:id', id, videos.get);
router.post('/videos', uploadLimiter, singleImage('thumbnail'), validate(createVideoSchema), videos.create);
router.patch('/videos/:id', uploadLimiter, id, singleImage('thumbnail'), validate(updateVideoSchema), videos.update);
router.delete('/videos/:id', id, videos.remove);
router.post('/videos/:id/upload-url', uploadLimiter, id, validate(uploadUrlSchema), videos.uploadUrl);
router.post('/videos/:id/complete-upload', id, validate(completeUploadSchema), videos.completeUpload);
router.get('/videos/:id/preview', id, videos.preview);
router.post('/videos/:id/review', id, validate(reviewSchema), videos.review);
router.patch('/videos/:id/feature', id, validate(featureSchema), videos.feature);
router.get('/videos/:id/subtitles', id, videos.subtitles);
router.post('/videos/:id/subtitles', uploadLimiter, id, subtitleFile, validate(subtitleSchema), videos.addSubtitle);
router.get('/videos/:id/subtitles/:subtitleId/file', validate(subtitleParams, 'params'), videos.subtitleFile);
router.delete('/videos/:id/subtitles/:subtitleId', validate(subtitleParams, 'params'), videos.deleteSubtitle);
router.delete('/songs/:id', id, songs.deleteSong);

// Artists
router.get('/artists', validate(listQuery, 'query'), catalog.listArtists);
router.get('/artists/options', catalog.artistOptions);
router.post('/artists', uploadLimiter, artistImages, validate(artistSchema), catalog.createArtist);
router.patch('/artists/:id', uploadLimiter, id, artistImages, validate(artistSchema), catalog.updateArtist);
router.delete('/artists/:id', id, catalog.deleteArtist);
router.post('/artists/:id/verification', id, validate(verificationDecisionSchema), catalog.decideVerification);

// Albums
router.get('/albums', validate(listQuery, 'query'), catalog.listAlbums);
router.get('/albums/options', catalog.albumOptions);
router.post('/albums', uploadLimiter, singleImage('artwork'), validate(albumSchema), catalog.createAlbum);
router.patch('/albums/:id', uploadLimiter, id, singleImage('artwork'), validate(albumSchema), catalog.updateAlbum);
router.delete('/albums/:id', id, catalog.deleteAlbum);
router.post('/albums/:id/songs', id, validate(albumSongsSchema), catalog.addAlbumSongs);
router.delete('/albums/:id/songs/:songId', validate(playlistSongParams, 'params'), catalog.removeAlbumSong);

// Genres
router.get('/genres', catalog.listGenres);
router.post('/genres', validate(genreSchema), catalog.createGenre);
router.patch('/genres/:id', id, validate(genreSchema), catalog.updateGenre);
router.delete('/genres/:id', id, catalog.deleteGenre);

// Playlists
router.get('/playlists', validate(adminPlaylistQuery, 'query'), catalog.listPlaylists);
router.patch('/playlists/:id', id, validate(adminPlaylistUpdate), catalog.updatePlaylist);
router.delete('/playlists/:id', id, catalog.deletePlaylist);

// Users
router.get('/users', validate(userListQuery, 'query'), users.listUsers);
router.get('/users/:id', id, users.getUser);
router.patch('/users/:id/status', id, validate(userStatusSchema), users.setStatus);
router.patch('/users/:id/role', id, validate(userRoleSchema), users.setRole);

// Settings
router.get('/settings', settings.getAdminSettings);
router.put('/settings', validate(settingsSchema), settings.updateSettings);
router.post('/settings/logo', uploadLimiter, singleImage('image'), settings.uploadLogo);
router.post('/settings/favicon', uploadLimiter, singleImage('image'), settings.uploadFavicon);

export default router;
