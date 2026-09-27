import { supabase } from '../../config/supabase.js';
import { env } from '../../config/env.js';
import { badRequest } from '../../utils/AppError.js';
import { dbError, one, unwrap } from '../../utils/db.js';
import { created, noContent, ok, pageMeta, pageRange } from '../../utils/http.js';
import { cleanSearchTerm } from '../../utils/search.js';
import { SONG_MANAGE_FIELDS, toAdminOffer, toArtist, toSong, toSubmission, toTransaction } from '../../services/mappers.js';
import { getSettings, invalidateSettings, toPublicMonetization } from '../../services/settings.service.js';
import { FOLDERS, removeMedia, withUploadCleanup } from '../../services/storage.service.js';
import { loadManagedSong, setSongWorkflow } from '../../services/songManagement.service.js';
import { afterStatusChange, reviewPatch } from '../../services/review.service.js';
import { paystackConfigured } from '../../services/payments/paystack.client.js';

/** Admin → Monetization. Financial data is only ever served under requireAdmin. */

// ─── Settings ──────────────────────────────────────────────────────────────
function monetizationSettings(s) {
  return {
    ...toPublicMonetization(s),
    paystack: {
      configured: paystackConfigured(),
      mode: env.paystack.mode,
      webhookUrl: '/api/payments/paystack/webhook',
      planCode: s.paystack_plan_code,
    },
  };
}

export async function getMonetizationSettings(req, res) {
  ok(res, monetizationSettings(await getSettings()));
}

const COLUMNS = {
  plusEnabled: 'plus_enabled',
  plusPrice: 'plus_price',
  plusBenefits: 'plus_benefits',
  artistSubmissionEnabled: 'artist_submission_enabled',
  artistSubmissionFee: 'artist_submission_fee',
  currency: 'payment_currency',
};

export async function updateMonetizationSettings(req, res) {
  const patch = {};
  for (const [key, column] of Object.entries(COLUMNS)) if (req.valid.body[key] !== undefined) patch[column] = req.valid.body[key];
  if (!Object.keys(patch).length) throw badRequest('Nothing to update.');
  unwrap(await supabase.from('site_settings').update(patch).eq('id', 1));
  invalidateSettings();
  // A price or currency change creates a new Paystack plan on the next checkout; current members keep theirs.
  ok(res, monetizationSettings(await getSettings()), { message: 'Monetization settings saved.' });
}

// ─── Revenue analytics ─────────────────────────────────────────────────────
function rangeBounds({ range, from, to }) {
  const now = new Date();
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(now.getTime() + 60_000);
  switch (range) {
    case 'today':
      return [startOfDay, end];
    case '7d':
      return [new Date(startOfDay.getTime() - 6 * 864e5), end];
    case 'month':
      return [new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)), end];
    case 'custom':
      return [new Date(`${from}T00:00:00Z`), new Date(Date.parse(`${to}T00:00:00Z`) + 864e5)];
    default:
      return [new Date(startOfDay.getTime() - 29 * 864e5), end];
  }
}

export async function summary(req, res) {
  const [from, to] = rangeBounds(req.valid.query);
  const data = unwrap(await supabase.rpc('monetization_summary', { p_from: from.toISOString(), p_to: to.toISOString() }));
  res.set('Cache-Control', 'private, no-store');
  ok(res, { ...data, from: from.toISOString(), to: to.toISOString() });
}

// ─── Payments ──────────────────────────────────────────────────────────────
async function userIdsMatching(term) {
  const rows = unwrap(await supabase.from('users').select('id').or(`email.ilike.%${term}%,name.ilike.%${term}%`).limit(200));
  return rows.map((r) => r.id);
}

export async function payments(req, res) {
  const { page, limit, q, status, product } = req.valid.query;
  let query = supabase.from('payment_transactions').select('*, users(name,email)', { count: 'exact' });
  if (status !== 'all') query = query.eq('status', status);
  if (product) query = query.eq('product_type', product);
  const term = cleanSearchTerm(q);
  if (term) {
    const ids = await userIdsMatching(term);
    query = ids.length ? query.or(`reference.ilike.%${term}%,user_id.in.(${ids.join(',')})`) : query.ilike('reference', `%${term}%`);
  }
  const { from, to } = pageRange({ page, limit });
  const { data, count, error } = await query.order('created_at', { ascending: false }).range(from, to);
  if (error) throw dbError(error);
  ok(res, data.map((r) => toTransaction(r, { admin: true })), pageMeta({ page, limit }, count));
}

// ─── Plus members ──────────────────────────────────────────────────────────
function toMember(row, lastPayment) {
  const now = Date.now();
  return {
    id: row.id,
    user: row.users ? { id: row.user_id, name: row.users.name, email: row.users.email } : { id: row.user_id },
    status: row.status,
    active: ['active', 'non_renewing', 'attention', 'cancelled'].includes(row.status) && row.current_period_end && Date.parse(row.current_period_end) > now,
    plan: { amount: Number(row.amount), currency: row.currency, interval: row.interval },
    startedAt: row.started_at,
    currentPeriodStart: row.current_period_start,
    currentPeriodEnd: row.current_period_end,
    nextPaymentDate: row.next_payment_date,
    cancelledAt: row.cancelled_at,
    subscriptionCode: row.provider_subscription_code,
    customerCode: row.provider_customer_code,
    lastPayment: lastPayment ? { status: lastPayment.status, paidAt: lastPayment.paid_at, reference: lastPayment.reference, createdAt: lastPayment.created_at } : null,
  };
}

export async function plusMembers(req, res) {
  const { page, limit, q, status } = req.valid.query;
  let query = supabase
    .from('plus_subscriptions')
    .select('*, users(name,email)', { count: 'exact' })
    .neq('status', 'pending');
  if (status === 'active') {
    query = query.in('status', ['active', 'non_renewing', 'attention', 'cancelled']).gt('current_period_end', new Date().toISOString());
  }
  const term = cleanSearchTerm(q);
  if (term) {
    const ids = await userIdsMatching(term);
    if (!ids.length) return ok(res, [], pageMeta({ page, limit }, 0));
    query = query.in('user_id', ids);
  }
  const { from, to } = pageRange({ page, limit });
  const { data, count, error } = await query.order('created_at', { ascending: false }).range(from, to);
  if (error) throw dbError(error);
  const subIds = data.map((r) => r.id);
  const txs = subIds.length
    ? unwrap(await supabase.from('payment_transactions').select('product_id,status,paid_at,reference,created_at').eq('product_type', 'plus_subscription').in('product_id', subIds).order('created_at', { ascending: false }))
    : [];
  const latest = new Map();
  for (const t of txs) if (!latest.has(t.product_id)) latest.set(t.product_id, t);
  ok(res, data.map((r) => toMember(r, latest.get(r.id))), pageMeta({ page, limit }, count));
}

export async function plusMember(req, res) {
  const row = await one(supabase.from('plus_subscriptions').select('*, users(name,email)').eq('id', req.valid.params.id), 'Subscription not found.');
  const txs = unwrap(
    await supabase.from('payment_transactions').select('*').eq('product_type', 'plus_subscription').eq('product_id', row.id).order('created_at', { ascending: false })
  );
  ok(res, { ...toMember(row, txs[0]), payments: txs.map((t) => toTransaction(t)) });
}

// ─── Artist submissions ────────────────────────────────────────────────────
const SUBMISSION_SELECT = '*, users!artist_submissions_user_id_fkey(name,email), payment_transactions!artist_submissions_payment_transaction_id_fkey(id,reference,status,paid_at,amount)';

export async function submissions(req, res) {
  const { page, limit, q, review, payment } = req.valid.query;
  let query = supabase.from('artist_submissions').select(SUBMISSION_SELECT, { count: 'exact' });
  if (review !== 'all') query = query.eq('review_status', review);
  if (payment !== 'all') query = query.eq('payment_status', payment);
  const term = cleanSearchTerm(q);
  if (term) query = query.or(`song_title.ilike.%${term}%,artist_name.ilike.%${term}%`);
  const { from, to } = pageRange({ page, limit });
  const { data, count, error } = await query
    .order('submitted_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error) throw dbError(error);
  ok(res, data.map(toSubmission), pageMeta({ page, limit }, count));
}

/** Everything needed to review a paid submission in one place. */
export async function submission(req, res) {
  const row = await one(supabase.from('artist_submissions').select(SUBMISSION_SELECT).eq('id', req.valid.params.id), 'Submission not found.');
  const [song, artist, lyrics, payments] = await Promise.all([
    row.song_id ? supabase.from('songs_view').select(SONG_MANAGE_FIELDS).eq('id', row.song_id).maybeSingle().then(unwrap) : null,
    row.artist_id ? supabase.from('artists_view').select('*').eq('id', row.artist_id).maybeSingle().then(unwrap) : null,
    row.song_id
      ? supabase.from('lyrics').select('id,language,is_synced,status,content,updated_at').eq('song_id', row.song_id).order('updated_at', { ascending: false }).then(unwrap)
      : [],
    supabase.from('payment_transactions').select('*').eq('product_type', 'artist_submission').eq('product_id', row.id).order('created_at', { ascending: false }).then(unwrap),
  ]);
  ok(res, {
    ...toSubmission(row),
    song: song ? toSong(song, { manage: true }) : null,
    artist: artist ? toArtist(artist, { manage: true }) : null,
    lyrics: lyrics.map((l) => ({ id: l.id, language: l.language, isSynced: l.is_synced, status: l.status, content: l.content, updatedAt: l.updated_at })),
    payments: payments.map((t) => toTransaction(t)),
  });
}

/** Approve (hold), approve & publish, or reject a paid submission. Updates the song; a trigger syncs the submission. */
export async function reviewSubmission(req, res) {
  const row = await one(supabase.from('artist_submissions').select('id,song_id,review_status').eq('id', req.valid.params.id), 'Submission not found.');
  if (row.review_status !== 'pending_review') throw badRequest('Only submissions waiting for review can be reviewed.');
  if (!row.song_id) throw badRequest('The song for this submission was deleted.');
  const existing = await loadManagedSong(row.song_id);
  if (existing.status !== 'pending') throw badRequest('This song is no longer waiting for review.');
  const { decision, reason } = req.valid.body;
  const song = await setSongWorkflow(existing, reviewPatch(decision, req.user.id, reason, { publishedAt: existing.published_at }));
  afterStatusChange('song', existing, song);
  const updated = unwrap(await supabase.from('artist_submissions').select(SUBMISSION_SELECT).eq('id', row.id).single());
  ok(res, toSubmission(updated), { message: { reject: 'Submission rejected.', approve: 'Submission approved.', publish: 'Approved and published.' }[decision] });
}

// ─── Plus offers ───────────────────────────────────────────────────────────
export async function listOffers(req, res) {
  const rows = unwrap(await supabase.from('plus_offers').select('*').order('sort_order').order('created_at', { ascending: false }));
  ok(res, rows.map(toAdminOffer));
}

function offerColumns(body) {
  const map = { title: 'title', description: 'description', linkUrl: 'link_url', linkLabel: 'link_label', startsAt: 'starts_at', endsAt: 'ends_at', isActive: 'is_active', plusOnly: 'plus_only', sortOrder: 'sort_order' };
  const out = {};
  for (const [k, c] of Object.entries(map)) if (body[k] !== undefined) out[c] = body[k];
  if (out.starts_at && out.ends_at && Date.parse(out.ends_at) <= Date.parse(out.starts_at)) throw badRequest('The end date must be after the start date.');
  return out;
}

export async function createOffer(req, res) {
  const settings = await getSettings();
  const row = await withUploadCleanup(async (upload) => {
    const image_path = req.file ? await upload.image(req.file, FOLDERS.offers, settings.max_image_mb) : null;
    return unwrap(await supabase.from('plus_offers').insert({ ...offerColumns(req.valid.body), image_path }).select('*').single());
  });
  created(res, toAdminOffer(row));
}

export async function updateOffer(req, res) {
  const existing = await one(supabase.from('plus_offers').select('*').eq('id', req.valid.params.id), 'Offer not found.');
  const settings = await getSettings();
  const patch = offerColumns(req.valid.body);
  const row = await withUploadCleanup(async (upload) => {
    if (req.file) patch.image_path = await upload.image(req.file, FOLDERS.offers, settings.max_image_mb);
    else if (req.valid.body.removeImage) patch.image_path = null;
    if (!Object.keys(patch).length) throw badRequest('Nothing to update.');
    return unwrap(await supabase.from('plus_offers').update(patch).eq('id', existing.id).select('*').single());
  });
  if (patch.image_path !== undefined && existing.image_path && existing.image_path !== patch.image_path) await removeMedia(existing.image_path);
  ok(res, toAdminOffer(row), { message: 'Offer saved.' });
}

export async function deleteOffer(req, res) {
  const existing = await one(supabase.from('plus_offers').select('id,image_path').eq('id', req.valid.params.id), 'Offer not found.');
  unwrap(await supabase.from('plus_offers').delete().eq('id', existing.id));
  if (existing.image_path) await removeMedia(existing.image_path);
  noContent(res);
}

