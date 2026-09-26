import { badRequest } from '../utils/AppError.js';

/**
 * Validate `req[source]` against a zod schema. Parsed values are placed on
 * `req.valid[source]` (Express 5 makes `req.query` read-only).
 */
export const validate = (schema, source = 'body') => (req, res, next) => {
  const result = schema.safeParse(req[source] ?? {});
  if (!result.success) {
    const details = result.error.issues.map((i) => ({ field: i.path.join('.') || source, message: i.message }));
    return next(badRequest(details[0]?.message || 'Invalid request.', details));
  }
  req.valid = { ...(req.valid || {}), [source]: result.data };
  next();
};
