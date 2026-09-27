import { Router } from 'express';
import * as payments from '../controllers/payments.controller.js';
import { requireArtist, requireAuth } from '../middleware/auth.js';
import { paymentLimiter } from '../middleware/security.js';
import { validate } from '../middleware/validate.js';
import { historyQuery, referenceParam, songIdParam, submissionCheckoutSchema } from '../validators/payments.validators.js';

/**
 * /api/payments — checkout, verification and history. The Paystack webhook is
 * mounted separately in app.js (it needs the raw body and no cookie session).
 */
const router = Router();

router.get('/offers', payments.offers);

router.post('/plus/initialize', requireAuth, paymentLimiter, payments.plusInitialize);
router.get('/plus/status', requireAuth, payments.plusStatus);
router.post('/plus/cancel', requireAuth, paymentLimiter, payments.plusCancel);
router.get('/plus/manage-link', requireAuth, paymentLimiter, payments.plusManageLink);

router.get('/artist/quote/:songId', requireArtist, validate(songIdParam, 'params'), payments.submissionQuoteHandler);
router.post('/artist/initialize', requireArtist, paymentLimiter, validate(submissionCheckoutSchema), payments.submissionInitialize);

router.get('/verify/:reference', requireAuth, validate(referenceParam, 'params'), payments.verify);
router.get('/history', requireAuth, validate(historyQuery, 'query'), payments.history);

export default router;
