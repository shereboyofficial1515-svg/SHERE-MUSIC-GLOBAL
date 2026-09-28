import { Router } from 'express';
import { publicDocs } from '../controllers/docs.controller.js';
import { validate } from '../middleware/validate.js';
import { searchLimiter } from '../middleware/security.js';
import { docParams, docSearchQuery } from '../validators/docs.validators.js';

/** /api/help — the public Help Center. Reads docs/public only; never the Admin Guide. */
const router = Router();
router.get('/', publicDocs.index);
router.get('/search', searchLimiter, validate(docSearchQuery, 'query'), publicDocs.find);
router.get('/articles/:section/:article', validate(docParams, 'params'), publicDocs.read);
export default router;
