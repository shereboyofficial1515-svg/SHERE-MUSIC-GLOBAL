import { api, API_BASE } from './api.js';

/**
 * Documentation clients. The public Help Center and the private Admin Guide
 * use separate API endpoints; the admin ones are authorised by the server
 * (admin role required), not by this file.
 */
export const helpDocs = {
  index: () => api.get('/help'),
  article: (section, slug) => api.get(`/help/articles/${section}/${slug}`),
  search: (q) => api.get('/help/search', { query: { q } }),
  resolveImage: (src) => (/^(https?:)?\//.test(src) ? src : `/help/${src}`),
};

export const adminDocs = {
  index: () => api.get('/admin/docs'),
  article: (section, slug) => api.get(`/admin/docs/articles/${section}/${slug}`),
  search: (q) => api.get('/admin/docs/search', { query: { q } }),
  // Screenshots come from the authenticated API, never from public static files.
  resolveImage: (src) => (/^https?:/.test(src) ? src : `${API_BASE}/admin/docs/assets/${src.replace(/^.*\//, '')}`),
};
