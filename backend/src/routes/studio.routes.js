import { Router } from 'express';
import * as studio from '../controllers/studio.controller.js';
import { lyricsHandlers } from '../controllers/shared/lyrics.handlers.js';
import { videoHandlers } from '../controllers/shared/video.handlers.js';
import { requireArtist, requireAuth } from '../middleware/auth.js';
import { uploadLimiter } from '../middleware/security.js';
import { artistImages, singleImage, songFiles, subtitleFile } from '../middleware/upload.js';
import { validate } from '../middleware/validate.js';
import { idParam } from '../validators/common.js';
import { albumSchema, albumSongsSchema, artistSchema, createSongSchema, publishSchema, updateSongSchema, verificationRequestSchema } from '../validators/catalog.validators.js';
import { analyticsQuery } from '../validators/admin.validators.js';
import { followersQuery, studioSongListQuery } from '../validators/library.validators.js';
import { lyricsParams, saveLyricsSchema } from '../validators/lyrics.validators.js';
import {
  completeUploadSchema,
  createVideoSchema,
  manageVideoListQuery,
  subtitleParams,
  subtitleSchema,
  updateVideoSchema,
  uploadUrlSchema,
} from '../validators/video.validators.js';

/**
 * SHERE MUSIC STUDIO API. Every route below `requireArtist` is scoped to the
 * signed-in creator's own artist profiles inside the controllers.
 */
const router = Router();
const id = validate(idParam, 'params');
const lyrics = lyricsHandlers('studio');
const videos = videoHandlers('studio');

// Onboarding (any signed-in user can become an artist)
router.get('/me', requireAuth, studio.studioStatus);
router.post('/artists', requireAuth, uploadLimiter, artistImages, validate(artistSchema), studio.createArtistProfile);

router.use(requireArtist);

router.get('/overview', studio.overview);
router.get('/analytics', validate(analyticsQuery, 'query'), studio.analytics);
router.get('/options', studio.options);
router.get('/followers', validate(followersQuery, 'query'), studio.followers);

// Artist profiles
router.get('/artists', studio.myArtists);
router.patch('/artists/:id', uploadLimiter, id, artistImages, validate(artistSchema), studio.updateArtistProfile);
router.post('/artists/:id/verification', id, validate(verificationRequestSchema), studio.requestVerification);
router.delete('/artists/:id', id, studio.deleteArtistProfile);

// Albums
router.get('/albums', studio.listAlbums);
router.post('/albums', uploadLimiter, singleImage('artwork'), validate(albumSchema), studio.saveAlbum);
router.patch('/albums/:id', uploadLimiter, id, singleImage('artwork'), validate(albumSchema), studio.saveAlbum);
router.delete('/albums/:id', id, studio.deleteAlbum);
router.post('/albums/:id/songs', id, validate(albumSongsSchema), studio.addAlbumSongs);

// Songs
router.get('/songs', validate(studioSongListQuery, 'query'), studio.listSongs);
router.get('/songs/:id', id, studio.getSong);
router.get('/songs/:id/preview', id, studio.previewSong);
router.post('/songs', uploadLimiter, songFiles, validate(createSongSchema), studio.createSong);
router.patch('/songs/:id', uploadLimiter, id, songFiles, validate(updateSongSchema), studio.updateSong);
router.post('/songs/:id/submit', id, studio.submitSong);
router.post('/songs/:id/publish', id, validate(publishSchema), studio.publishSong);
router.delete('/songs/:id', id, studio.deleteSong);

// Lyrics
router.get('/lyrics', studio.lyricsOverview);
router.get('/songs/:id/lyrics', id, lyrics.list);
router.post('/songs/:id/lyrics', id, validate(saveLyricsSchema), lyrics.save);
router.get('/songs/:id/lyrics/provider', id, lyrics.importFromProvider);
router.put('/songs/:id/lyrics/:lyricsId', validate(lyricsParams, 'params'), validate(saveLyricsSchema), lyrics.save);
router.post('/songs/:id/lyrics/:lyricsId/submit', validate(lyricsParams, 'params'), lyrics.submit);
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
router.post('/videos/:id/submit', id, videos.submit);
router.post('/videos/:id/publish', id, validate(publishSchema), videos.publish);
router.get('/videos/:id/subtitles', id, videos.subtitles);
router.post('/videos/:id/subtitles', uploadLimiter, id, subtitleFile, validate(subtitleSchema), videos.addSubtitle);
router.get('/videos/:id/subtitles/:subtitleId/file', validate(subtitleParams, 'params'), videos.subtitleFile);
router.delete('/videos/:id/subtitles/:subtitleId', validate(subtitleParams, 'params'), videos.deleteSubtitle);

export default router;
