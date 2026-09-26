import { Router } from 'express';
import * as catalog from '../controllers/catalog.controller.js';
import * as songs from '../controllers/songs.controller.js';
import { downloadLimiter, playLimiter } from '../middleware/security.js';
import { validate } from '../middleware/validate.js';
import { idParam } from '../validators/common.js';
import { listQuery, searchSchema, songListQuery } from '../validators/catalog.validators.js';

const router = Router();

router.get('/settings', catalog.publicSettings);
router.get('/home', catalog.home);
router.get('/search', validate(searchSchema, 'query'), catalog.search);

router.get('/songs', validate(songListQuery, 'query'), songs.listSongs);
router.get('/songs/trending', songs.trending);
router.get('/songs/:id', validate(idParam, 'params'), songs.getSong);
router.get('/songs/:id/related', validate(idParam, 'params'), songs.relatedSongs);
router.get('/songs/:id/stream', playLimiter, validate(idParam, 'params'), songs.streamUrl);
router.post('/songs/:id/play', playLimiter, validate(idParam, 'params'), songs.recordPlay);
router.post('/songs/:id/download', downloadLimiter, validate(idParam, 'params'), songs.download);

router.get('/artists', validate(listQuery, 'query'), catalog.listArtists);
router.get('/artists/:id', validate(idParam, 'params'), catalog.getArtist);
router.get('/albums', validate(listQuery, 'query'), catalog.listAlbums);
router.get('/albums/:id', validate(idParam, 'params'), catalog.getAlbum);
router.get('/genres', catalog.listGenres);
router.get('/genres/:slug', catalog.getGenre);

export default router;
