import { notFound } from '../utils/AppError.js';
import { ok } from '../utils/http.js';
import { COLLECTIONS, adminAssetPath, article, navigation, search } from '../services/docs/docs.service.js';

/**
 * Documentation endpoints. Each handler is bound to ONE collection:
 * the public ones can only read docs/public; the admin ones are mounted in the
 * admin router (requireAdmin) and read docs/admin.
 */
function handlers(collection, { privateDocs }) {
  const headers = (res) => {
    if (privateDocs) res.set({ 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' });
    else res.set('Cache-Control', 'public, max-age=120');
  };
  return {
    async index(req, res) {
      headers(res);
      ok(res, await navigation(collection));
    },
    async read(req, res) {
      const found = await article(collection, req.valid.params.section, req.valid.params.article);
      if (!found) throw notFound('Article not found.');
      headers(res);
      ok(res, found);
    },
    async find(req, res) {
      headers(res);
      ok(res, { query: req.valid.query.q, results: await search(collection, req.valid.query.q) });
    },
  };
}

export const publicDocs = handlers(COLLECTIONS.public, { privateDocs: false });
export const adminDocs = {
  ...handlers(COLLECTIONS.admin, { privateDocs: true }),
  /** Screenshots for the Admin Guide (never in the frontend's public folder). */
  asset(req, res) {
    const file = adminAssetPath(req.valid.params.file);
    if (!file) throw notFound('Not found.');
    res.set({ 'Cache-Control': 'private, max-age=600', 'X-Robots-Tag': 'noindex, nofollow', 'Cross-Origin-Resource-Policy': 'cross-origin' });
    res.sendFile(file);
  },
};
