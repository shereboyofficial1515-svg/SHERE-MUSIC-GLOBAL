/**
 * Thin fetch wrapper for the SHERE MUSIC API.
 * - Sends the session cookie (credentials: 'include')
 * - Adds the CSRF header the backend requires on state-changing requests
 * - Normalises every failure into an ApiError with a user-friendly message
 */
export const API_BASE = resolveApiBase(import.meta.env.VITE_API_URL);

/**
 * The one place the API address is decided.
 * - VITE_API_URL=https://api.example.com (or …/api) → that server (e.g. Render)
 * - unset or "/api" → same origin (Vite dev proxy locally, or a Vercel rewrite)
 */
function resolveApiBase(value) {
  const raw = String(value || '/api').trim().replace(/\/+$/, '');
  if (/^https?:\/\//i.test(raw) && !/\/api$/i.test(raw)) return `${raw}/api`;
  return raw || '/api';
}

const CSRF = { 'X-Requested-With': 'SHERE-MUSIC' };

export class ApiError extends Error {
  constructor(message, status = 0, code = 'ERROR', details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** Field → message map for form validation errors. */
  get fieldErrors() {
    return Object.fromEntries((this.details || []).filter((d) => d.field).map((d) => [d.field, d.message]));
  }
}

function buildUrl(path, query) {
  const url = `${API_BASE}${path}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

function emit(name, detail) {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

function toApiError(status, payload) {
  const err = payload?.error;
  const error = new ApiError(
    err?.message || (status >= 500 ? 'The server had a problem. Please try again.' : `Request failed (${status}).`),
    status,
    err?.code || 'HTTP_ERROR',
    err?.details
  );
  if (status === 401 && ['SESSION_EXPIRED', 'UNAUTHORIZED'].includes(error.code)) emit('sm:unauthorized', error);
  if (status === 403 && error.code === 'ACCOUNT_DISABLED') emit('sm:unauthorized', error);
  if (status === 503 && error.code === 'MAINTENANCE') emit('sm:maintenance', error);
  return error;
}

async function request(method, path, { body, query, signal } = {}) {
  const headers = { Accept: 'application/json', ...(method === 'GET' ? {} : CSRF) };
  let payload;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(buildUrl(path, query), { method, headers, body: payload, credentials: 'include', signal });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError('Network error. Check your internet connection and try again.', 0, 'NETWORK_ERROR');
  }

  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res.status, data);
  return data ?? { data: null };
}

export const api = {
  get: (path, options) => request('GET', path, options),
  post: (path, body, options) => request('POST', path, { ...options, body }),
  put: (path, body, options) => request('PUT', path, { ...options, body }),
  patch: (path, body, options) => request('PATCH', path, { ...options, body }),
  delete: (path, options) => request('DELETE', path, options),
};

/**
 * Multipart upload with progress (fetch cannot report upload progress yet).
 * Returns a promise plus an abort() handle.
 */
export function uploadWithProgress(method, path, formData, { onProgress } = {}) {
  const xhr = new XMLHttpRequest();
  const promise = new Promise((resolve, reject) => {
    xhr.open(method, buildUrl(path));
    xhr.withCredentials = true;
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.setRequestHeader('X-Requested-With', CSRF['X-Requested-With']);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      let data = null;
      try {
        data = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        /* non-JSON response */
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(toApiError(xhr.status, data));
    };
    xhr.onerror = () => reject(new ApiError('Upload failed. Check your connection and try again.', 0, 'NETWORK_ERROR'));
    xhr.onabort = () => reject(new ApiError('Upload cancelled.', 0, 'ABORTED'));
    xhr.send(formData);
  });
  return { promise, abort: () => xhr.abort() };
}

/** Absolute URL for a GET endpoint (used for CSV report links). */
export const apiUrl = buildUrl;
