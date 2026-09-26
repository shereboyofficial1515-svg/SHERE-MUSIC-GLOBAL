import { AppError } from './AppError.js';

/** Translate a Supabase/PostgREST error into an AppError without leaking internals. */
export function dbError(error) {
  switch (error?.code) {
    case '23505':
      return new AppError(409, 'A record with the same value already exists.', 'DUPLICATE');
    case '23503':
      return new AppError(409, 'This record is still in use by other data.', 'IN_USE');
    case '23514':
    case '22001':
      return new AppError(400, 'One of the values is not allowed.', 'CONSTRAINT');
    case '22P02':
      return new AppError(400, 'Invalid identifier.', 'BAD_REQUEST');
    default: {
      const unreachable = /fetch failed|ECONNREFUSED|ENOTFOUND|ETIMEDOUT/i.test(error?.message || '');
      const err = unreachable
        ? new AppError(503, 'The service is temporarily unavailable. Please try again shortly.', 'SERVICE_UNAVAILABLE')
        : new AppError(500, 'A database error occurred.', 'DB_ERROR');
      err.cause = error;
      return err;
    }
  }
}

/** Return `data` from a Supabase response or throw a mapped error. */
export function unwrap({ data, error }) {
  if (error) throw dbError(error);
  return data;
}

/** Run a query expected to return one row; throws 404 when nothing matches. */
export async function one(query, notFoundMessage = 'Not found.') {
  const { data, error } = await query.maybeSingle();
  if (error) throw dbError(error);
  if (!data) throw new AppError(404, notFoundMessage, 'NOT_FOUND');
  return data;
}

/** Fetch rows by id and return them in the order of `ids` (used after paginating a join table). */
export function orderByIds(rows, ids) {
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => byId.get(id)).filter(Boolean);
}
