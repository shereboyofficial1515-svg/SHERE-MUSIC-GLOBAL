import { api } from './api.js';

/**
 * Payments. The browser only ever sends *what* to buy (Plus, or which song to
 * submit). Prices, statuses and entitlements are decided by the API.
 */
export const paymentService = {
  plusStatus: () => api.get('/payments/plus/status'),
  startPlus: () => api.post('/payments/plus/initialize'),
  cancelPlus: () => api.post('/payments/plus/cancel'),
  manageLink: () => api.get('/payments/plus/manage-link'),
  submissionQuote: (songId) => api.get(`/payments/artist/quote/${songId}`),
  startSubmission: (songId) => api.post('/payments/artist/initialize', { songId }),
  verify: (reference) => api.get(`/payments/verify/${encodeURIComponent(reference)}`),
  history: (query) => api.get('/payments/history', { query }),
  offers: () => api.get('/payments/offers'),
  mySubmissions: (query) => api.get('/studio/submissions', { query }),
};

/** Send the browser to Paystack's secure checkout page. */
export function goToCheckout(checkout) {
  window.location.assign(checkout.authorizationUrl);
}
