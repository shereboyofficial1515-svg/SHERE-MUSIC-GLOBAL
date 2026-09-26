import multer from 'multer';
import { AppError } from '../utils/AppError.js';
import { env } from '../config/env.js';

export function notFoundHandler(req, res) {
  res.status(404).json({ error: { message: `Route ${req.method} ${req.path} not found.`, code: 'ROUTE_NOT_FOUND' } });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  let error = err;

  if (err instanceof multer.MulterError) {
    const messages = {
      LIMIT_FILE_SIZE: 'The uploaded file is too large.',
      LIMIT_UNEXPECTED_FILE: `Unexpected file field "${err.field}".`,
      LIMIT_FILE_COUNT: 'Too many files uploaded.',
    };
    error = new AppError(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400, messages[err.code] || 'Invalid file upload.', err.code);
  } else if (err?.type === 'entity.too.large') {
    error = new AppError(413, 'Request body is too large.', 'PAYLOAD_TOO_LARGE');
  } else if (err?.type === 'entity.parse.failed') {
    error = new AppError(400, 'Malformed JSON body.', 'BAD_JSON');
  } else if (!(err instanceof AppError)) {
    error = new AppError(500, 'Something went wrong. Please try again.', 'INTERNAL_ERROR');
  }

  if (error.status >= 500) {
    console.error(`[error] ${req.method} ${req.originalUrl}`, err.cause || err);
  }

  if (res.headersSent) return;
  res.status(error.status).json({
    error: {
      message: error.message,
      code: error.code,
      ...(error.details ? { details: error.details } : {}),
      ...(!env.isProduction && error.status >= 500 ? { debug: String(err.cause?.message || err.message) } : {}),
    },
  });
}
