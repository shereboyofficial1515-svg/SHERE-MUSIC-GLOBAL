import rateLimit from 'express-rate-limit';
import { forbidden } from '../utils/AppError.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
export const CSRF_HEADER = 'x-requested-with';
export const CSRF_VALUE = 'SHERE-MUSIC';

/**
 * CSRF defence for cookie-authenticated requests: every state-changing request
 * must carry a custom header. Browsers cannot attach custom headers to
 * cross-site form posts, and CORS blocks them from untrusted origins.
 */
export function csrfGuard(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  if (req.get(CSRF_HEADER) !== CSRF_VALUE) return next(forbidden('Request blocked.', 'CSRF'));
  next();
}

const limiter = (windowMs, limit, message) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (req, res) => res.status(429).json({ error: { message, code: 'RATE_LIMITED' } }),
  });

export const apiLimiter = limiter(60_000, 300, 'Too many requests. Please slow down.');
export const authLimiter = limiter(15 * 60_000, 20, 'Too many attempts. Please wait a few minutes and try again.');
export const emailLimiter = limiter(60 * 60_000, 6, 'Too many emails requested. Please try again later.');
export const playLimiter = limiter(60_000, 40, 'Too many requests.');
export const downloadLimiter = limiter(60_000, 20, 'Too many downloads in a short time. Please wait a moment.');
export const paymentLimiter = limiter(60_000, 10, 'Too many payment attempts. Please wait a moment.');
export const uploadLimiter = limiter(60_000, 30, 'Too many uploads. Please wait a moment.');
