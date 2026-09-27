import crypto from 'node:crypto';
import { supabase } from '../config/supabase.js';
import { notFound } from '../utils/AppError.js';
import { dbError, unwrap } from '../utils/db.js';
import { ok, pageMeta, pageRange } from '../utils/http.js';
import { toOffer, toSubmission, toTransaction } from '../services/mappers.js';
import { getPlusStatus, hasActivePlus } from '../services/payments/plusEntitlement.service.js';
import { isValidWebhookSignature, paystackConfigured } from '../services/payments/paystack.client.js';
import {
  cancelPlus,
  handlePaystackEvent,
  initializePlusCheckout,
  initializeSubmissionCheckout,
  manageLink,
  submissionQuote,
  syncSubscription,
  verifyReference,
} from '../services/payments/payment.service.js';

// ─── Plus ──────────────────────────────────────────────────────────────────
export async function plusInitialize(req, res) {
  ok(res, await initializePlusCheckout(req.user));
}

export async function plusStatus(req, res) {
  res.set('Cache-Control', 'private, no-store');
  let status = await getPlusStatus(req.user.id);
  // Active but not yet linked to its Paystack subscription (webhook not received yet)
  if (status.active && !status.canManage && paystackConfigured() && (await syncSubscription(req.user.id))) status = await getPlusStatus(req.user.id);
  ok(res, { ...status, paymentsAvailable: paystackConfigured() });
}

export async function plusCancel(req, res) {
  await cancelPlus(req.user);
  ok(res, await getPlusStatus(req.user.id), { message: 'Your membership will not renew. You keep Plus until the end of the paid period.' });
}

export async function plusManageLink(req, res) {
  ok(res, await manageLink(req.user));
}

// ─── Artist submissions ────────────────────────────────────────────────────
export async function submissionQuoteHandler(req, res) {
  ok(res, await submissionQuote(req.user, req.valid.params.songId));
}

export async function submissionInitialize(req, res) {
  ok(res, await initializeSubmissionCheckout(req.user, req.valid.body.songId));
}

/** Studio → Payments: the creator's own submissions with their payment. */
export async function mySubmissions(req, res) {
  const { page, limit } = req.valid.query;
  const { from, to } = pageRange({ page, limit });
  const { data, count, error } = await supabase
    .from('artist_submissions')
    .select('*, payment_transactions!artist_submissions_payment_transaction_id_fkey(id,reference,status,paid_at,amount)', { count: 'exact' })
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error) throw dbError(error);
  ok(res, data.map(toSubmission), pageMeta({ page, limit }, count));
}

// ─── Verification & history ────────────────────────────────────────────────
/**
 * Called by the checkout return page. Only the owner of the transaction may
 * check it, and the answer always comes from our database after asking
 * Paystack — never from query parameters.
 */
export async function verify(req, res) {
  const { reference } = req.valid.params;
  const load = async () =>
    unwrap(await supabase.from('payment_transactions').select('*').eq('reference', reference).eq('user_id', req.user.id).maybeSingle());
  let tx = await load();
  if (!tx) throw notFound('Payment not found.');

  let providerStatus = null;
  if (tx.status !== 'success') {
    try {
      providerStatus = (await verifyReference(reference)).providerStatus ?? 'success';
    } catch (err) {
      if (err.providerStatus !== 404) console.warn(`[payments] verify ${reference}:`, err.message);
    }
    tx = await load();
  }

  const out = { transaction: toTransaction(tx), providerStatus };
  if (tx.product_type === 'plus_subscription') out.plus = await getPlusStatus(req.user.id);
  if (tx.product_type === 'artist_submission' && tx.product_id) {
    const row = unwrap(await supabase.from('artist_submissions').select('*').eq('id', tx.product_id).maybeSingle());
    if (row) out.submission = toSubmission(row);
  }
  res.set('Cache-Control', 'private, no-store');
  ok(res, out);
}

export async function history(req, res) {
  const { page, limit, product } = req.valid.query;
  const { from, to } = pageRange({ page, limit });
  let query = supabase.from('payment_transactions').select('*', { count: 'exact' }).eq('user_id', req.user.id);
  if (product) query = query.eq('product_type', product);
  const { data, count, error } = await query.order('created_at', { ascending: false }).range(from, to);
  if (error) throw dbError(error);
  res.set('Cache-Control', 'private, no-store');
  ok(res, data.map((r) => toTransaction(r)), pageMeta({ page, limit }, count));
}

// ─── Plus offers ───────────────────────────────────────────────────────────
/** Current offers. Plus-only offers show their details (and link) to Plus members only. */
export async function offers(req, res) {
  const now = Date.now();
  const rows = unwrap(
    await supabase.from('plus_offers').select('*').eq('is_active', true).order('sort_order').order('created_at', { ascending: false }).limit(100)
  ).filter((r) => (!r.starts_at || Date.parse(r.starts_at) <= now) && (!r.ends_at || Date.parse(r.ends_at) > now));
  const plus = req.user ? req.user.role === 'admin' || (await hasActivePlus(req.user.id)) : false;
  res.set('Cache-Control', 'private, no-store');
  ok(res, rows.map((r) => toOffer(r, { locked: r.plus_only && !plus })));
}

// ─── Webhook ───────────────────────────────────────────────────────────────
/**
 * POST /api/payments/paystack/webhook — mounted with a raw body parser and
 * outside the cookie/CSRF middleware. Authenticity comes from the HMAC
 * signature. Each exact delivery is processed once (payment_events.event_key);
 * if processing fails the record is removed and we answer 500 so Paystack
 * retries.
 */
export async function paystackWebhook(req, res) {
  const raw = req.body;
  if (!isValidWebhookSignature(raw, req.get('x-paystack-signature'))) {
    return res.status(401).json({ error: { message: 'Invalid signature.', code: 'INVALID_SIGNATURE' } });
  }
  let payload;
  try {
    payload = JSON.parse(raw.toString('utf8'));
  } catch {
    return res.status(400).json({ error: { message: 'Invalid JSON.', code: 'BAD_REQUEST' } });
  }

  const eventKey = crypto.createHash('sha256').update(raw).digest('hex');
  // Keep an audit copy without card details.
  const { authorization, ...safeData } = payload.data || {};
  const { data: inserted, error } = await supabase
    .from('payment_events')
    .insert({ event: String(payload.event || 'unknown'), event_key: eventKey, reference: safeData.reference || safeData.transaction?.reference || null, payload: { event: payload.event, data: safeData } })
    .select('id')
    .single();
  if (error?.code === '23505') return res.status(200).json({ received: true, duplicate: true });
  if (error) {
    console.error('[payments] could not store webhook event:', error.message);
    return res.status(500).json({ error: { message: 'Try again.' } });
  }

  try {
    await handlePaystackEvent(payload);
    await supabase.from('payment_events').update({ processed_at: new Date().toISOString() }).eq('id', inserted.id);
    res.status(200).json({ received: true });
  } catch (err) {
    console.error(`[payments] webhook ${payload.event} failed:`, err.message);
    await supabase.from('payment_events').delete().eq('id', inserted.id);
    res.status(500).json({ error: { message: 'Processing failed.' } });
  }
}
