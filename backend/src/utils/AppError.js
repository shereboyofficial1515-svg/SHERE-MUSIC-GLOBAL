/** Operational error with an HTTP status that is safe to show to API clients. */
export class AppError extends Error {
  constructor(status, message, code = 'ERROR', details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message = 'Invalid request.', details) => new AppError(400, message, 'BAD_REQUEST', details);
export const unauthorized = (message = 'Please sign in to continue.', code = 'UNAUTHORIZED') =>
  new AppError(401, message, code);
export const forbidden = (message = 'You do not have permission to do that.', code = 'FORBIDDEN') =>
  new AppError(403, message, code);
export const notFound = (message = 'Not found.') => new AppError(404, message, 'NOT_FOUND');
export const conflict = (message, code = 'CONFLICT') => new AppError(409, message, code);
