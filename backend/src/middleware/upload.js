import multer from 'multer';
import { env } from '../config/env.js';

const MB = 1024 * 1024;
const storage = multer.memoryStorage();

/**
 * Multer enforces the hard ceilings from the environment. The (possibly lower)
 * limits configured in admin settings and the file-type checks are applied
 * afterwards in the upload service, where the file bytes can be inspected.
 */
export const songFiles = multer({
  storage,
  limits: { fileSize: Math.max(env.uploads.maxAudioMb, env.uploads.maxImageMb) * MB, files: 2, fields: 40 },
}).fields([
  { name: 'audio', maxCount: 1 },
  { name: 'artwork', maxCount: 1 },
]);

export const singleImage = (field) =>
  multer({ storage, limits: { fileSize: env.uploads.maxImageMb * MB, files: 1, fields: 40 } }).single(field);
