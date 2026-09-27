import crypto from 'node:crypto';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';

/**
 * Minimal Paystack REST client (https://paystack.com/docs/api/). Server-side
 * only: every call is authenticated with the secret key.
 */

export const paystackConfigured = () => Boolean(env.paystack.secretKey);

async function call(method, path, body) {
  if (!paystackConfigured()) {
    throw new AppError(503, 'Payments are not available yet. Please try again later.', 'PAYMENTS_NOT_CONFIGURED');
  }
  let res;
  try {
    res = await fetch(`${env.paystack.baseUrl}${path}`, {
      method,
      headers: { Authorization: `Bearer ${env.paystack.secretKey}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    const e = new AppError(502, 'Could not reach the payment provider. Please try again.', 'PAYMENT_PROVIDER_ERROR');
    e.cause = err;
    throw e;
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.status === false) {
    const e = new AppError(res.status === 404 ? 404 : 502, json.message || 'The payment provider returned an error.', 'PAYMENT_PROVIDER_ERROR');
    e.providerStatus = res.status;
    throw e;
  }
  return json.data;
}

export const paystack = {
  initializeTransaction: (body) => call('POST', '/transaction/initialize', body),
  verifyTransaction: (reference) => call('GET', `/transaction/verify/${encodeURIComponent(reference)}`),
  createPlan: (body) => call('POST', '/plan', body),
  fetchSubscription: (code) => call('GET', `/subscription/${encodeURIComponent(code)}`),
  fetchCustomer: (emailOrCode) => call('GET', `/customer/${encodeURIComponent(emailOrCode)}`),
  disableSubscription: (code, token) => call('POST', '/subscription/disable', { code, token }),
  manageSubscriptionLink: (code) => call('GET', `/subscription/${encodeURIComponent(code)}/manage/link`),
};

/**
 * Paystack signs every webhook with HMAC-SHA512 of the raw request body using
 * the secret key, sent in the `x-paystack-signature` header.
 */
export function isValidWebhookSignature(rawBody, signature) {
  if (!paystackConfigured() || !signature || !Buffer.isBuffer(rawBody)) return false;
  const expected = crypto.createHmac('sha512', env.paystack.secretKey).update(rawBody).digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(String(signature), 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Unique, unguessable transaction reference (Paystack allows letters, digits, - . =). */
export function newReference(prefix) {
  return `SM-${prefix}-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
}
