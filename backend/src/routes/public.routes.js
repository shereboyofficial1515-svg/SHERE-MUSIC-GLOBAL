import { Router } from 'express';
import * as catalog from '../controllers/catalog.controller.js';
import * as songs from '../controllers/songs.controller.js';
import * as social from '../controllers/social.controller.js';
import * as videos from '../controllers/videos.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { downloadLimiter, playLimiter } from '../middleware/security.js';
import { validate } from '../middleware/validate.js';
import { idParam } from '../validators/common.js';
import { listQuery, lyricsQuery, searchSchema, songListQuery } from '../validators/catalog.validators.js';
import { pageQuery } from '../validators/library.validators.js';
import { usernameParam } from '../validators/me.validators.js';
import { subtitleParams, videoListQuery } from '../validators/video.validators.js';

const router = Router();

router.get('/settings', catalog.publicSettings);
router.get('/home', catalog.home);
router.get('/search', validate(searchSchema, 'query'), catalog.search);

router.get('/songs', validate(songListQuery, 'query'), songs.listSongs);
router.get('/songs/trending', songs.trending);
router.get('/songs/:id', validate(idParam, 'params'), songs.getSong);
router.get('/songs/:id/related', validate(idParam, 'params'), songs.relatedSongs);
router.get('/songs/:id/lyrics', validate(idParam, 'params'), validate(lyricsQuery, 'query'), social.songLyrics);
router.get('/songs/:id/stream', playLimiter, validate(idParam, 'params'), songs.streamUrl);
router.post('/songs/:id/play', playLimiter, validate(idParam, 'params'), songs.recordPlay);
router.post('/songs/:id/download', downloadLimiter, validate(idParam, 'params'), songs.download);

router.get('/artists', validate(listQuery, 'query'), catalog.listArtists);
router.get('/artists/:id', validate(idParam, 'params'), catalog.getArtist);
router.get('/artists/:id/followers', validate(idParam, 'params'), validate(pageQuery, 'query'), social.artistFollowers);
router.post('/artists/:id/follow', requireAuth, validate(idParam, 'params'), social.followArtist);
router.delete('/artists/:id/follow', requireAuth, validate(idParam, 'params'), social.unfollowArtist);
router.get('/users/:username', validate(usernameParam, 'params'), social.publicProfile);

// SHERE MUSIC VIDEO
router.get('/videos/home', videos.videoHome);
router.get('/videos', validate(videoListQuery, 'query'), videos.listVideos);
router.get('/videos/:id', validate(idParam, 'params'), videos.getVideo);
router.get('/videos/:id/related', validate(idParam, 'params'), videos.relatedVideos);
router.get('/videos/:id/stream', playLimiter, validate(idParam, 'params'), videos.streamVideo);
router.post('/videos/:id/view', playLimiter, validate(idParam, 'params'), videos.recordView);
router.get('/videos/:id/subtitles/:subtitleId', validate(subtitleParams, 'params'), videos.subtitleFile);
router.get('/albums', validate(listQuery, 'query'), catalog.listAlbums);
router.get('/albums/:id', validate(idParam, 'params'), catalog.getAlbum);
router.get('/genres', catalog.listGenres);
router.get('/genres/:slug', catalog.getGenre);

export default router;
