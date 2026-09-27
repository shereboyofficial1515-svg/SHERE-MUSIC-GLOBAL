import { supabase } from '../../config/supabase.js';
import { env } from '../../config/env.js';
import { AppError, badRequest, conflict, notFound } from '../../utils/AppError.js';
import { unwrap } from '../../utils/db.js';
import { getSettings, invalidateSettings } from '../settings.service.js';
import { sendPaymentEmail } from '../email.service.js';
import { notifyUsers } from '../notification.service.js';
import { loadOwnedSong } from '../ownership.service.js';
import { SONG_MANAGE_FIELDS } from '../mappers.js';
import { hasActivePlus } from './plusEntitlement.service.js';
import { newReference, paystack } from './paystack.client.js';

/**
 * Payments: checkout, verification, fulfilment and subscription lifecycle.
 *
 * Rules that hold everywhere in this file:
 *  - Prices come from site settings on the server, never from the request.
 *  - A payment is fulfilled only with data Paystack returned (verify API) or
 *    signed (webhook), and only through fulfill_payment(), which is atomic and
 *    returns newlyFulfilled = true once per reference. Emails and
 *    notifications are sent only in that case, so duplicates send nothing.
 */

const RETURN_PATH = '/payments/return';

export function formatMoney(amountMinor, currency = 'NGN') {
  try {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(amountMinor) / 100);
  } catch {
    return `${currency} ${(Number(amountMinor) / 100).toFixed(2)}`;
  }
}

const formatDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—');

async function loadUser(id) {
  const { data } = await supabase.from('users').select('id,name,email,status').eq('id', id).maybeSingle();
  return data;
}

// ─── Paystack plan for Plus ────────────────────────────────────────────────
/**
 * The Paystack plan matching the current Plus price, currency and key mode
 * (test/live). A new plan is created when any of them changes; existing
 * subscribers stay on the plan they subscribed to.
 */
export async function ensurePlusPlan(settings) {
  if (
    settings.paystack_plan_code &&
    Number(settings.paystack_plan_amount) === Number(settings.plus_price) &&
    settings.paystack_plan_currency === settings.payment_currency &&
    settings.paystack_plan_mode === env.paystack.mode
  ) {
    return settings.paystack_plan_code;
  }
  const plan = await paystack.createPlan({
    name: `${settings.site_name} PLUS`,
    amount: Number(settings.plus_price),
    interval: 'monthly',
    currency: settings.payment_currency,
    description: `${settings.site_name} Plus monthly membership`,
  });
  unwrap(
    await supabase
      .from('site_settings')
      .update({
        paystack_plan_code: plan.plan_code,
        paystack_plan_amount: Number(settings.plus_price),
        paystack_plan_currency: settings.payment_currency,
        paystack_plan_mode: env.paystack.mode,
      })
      .eq('id', 1)
  );
  invalidateSettings();
  return plan.plan_code;
}

async function startCheckout(tx, { email, plan, metadata }) {
  try {
    const data = await paystack.initializeTransaction({
      email,
      amount: String(tx.amount),
      currency: tx.currency,
      reference: tx.reference,
      callback_url: `${env.frontendUrl}${RETURN_PATH}`,
      ...(plan ? { plan } : {}),
      metadata: { ...metadata, transaction_id: tx.id, cancel_action: `${env.frontendUrl}${RETURN_PATH}?reference=${encodeURIComponent(tx.reference)}&cancelled=1` },
    });
    await supabase
      .from('payment_transactions')
      .update({ metadata: { ...tx.metadata, access_code: data.access_code } })
      .eq('id', tx.id);
    return { reference: tx.reference, authorizationUrl: data.authorization_url, accessCode: data.access_code };
  } catch (err) {
    await supabase.from('payment_transactions').update({ status: 'failed', gateway_response: err.message?.slice(0, 300) }).eq('id', tx.id);
    throw err;
  }
}

// ─── Plus checkout ─────────────────────────────────────────────────────────
export async function initializePlusCheckout(user) {
  const settings = await getSettings();
  if (!settings.plus_enabled) throw badRequest('SHERE MUSIC Plus is not available right now.');
  if (await hasActivePlus(user.id)) throw conflict('You already have SHERE MUSIC Plus.', 'ALREADY_PLUS');
  const planCode = await ensurePlusPlan(settings);

  // Reuse the checkout in progress, if any (retries do not pile up subscriptions).
  const amount = Number(settings.plus_price);
  const currency = settings.payment_currency;
  let sub = unwrap(await supabase.from('plus_subscriptions').select('id').eq('user_id', user.id).eq('status', 'pending').maybeSingle());
  if (sub) {
    unwrap(await supabase.from('plus_subscriptions').update({ amount, currency, provider_plan_code: planCode }).eq('id', sub.id));
  } else {
    const { data, error } = await supabase
      .from('plus_subscriptions')
      .insert({ user_id: user.id, amount, currency, provider_plan_code: planCode, status: 'pending' })
      .select('id')
      .single();
    if (error?.code === '23505') sub = unwrap(await supabase.from('plus_subscriptions').select('id').eq('user_id', user.id).eq('status', 'pending').single());
    else sub = unwrap({ data, error });
  }

  const tx = unwrap(
    await supabase
      .from('payment_transactions')
      .insert({
        user_id: user.id,
        reference: newReference('PLUS'),
        product_type: 'plus_subscription',
        product_id: sub.id,
        amount,
        currency,
        customer_email: user.email,
        metadata: { description: `${settings.site_name} Plus — monthly`, plan_code: planCode },
      })
      .select('*')
      .single()
  );
  return startCheckout(tx, { email: user.email, plan: planCode, metadata: { product_type: 'plus_subscription', user_id: user.id } });
}

// ─── Artist submission checkout ────────────────────────────────────────────
export function submissionFeeRequired(user, settings) {
  return Boolean(settings.artist_submission_enabled) && user.role !== 'admin';
}

async function openSubmissionFor(song, user, settings) {
  const existing = unwrap(await supabase.from('artist_submissions').select('*').eq('song_id', song.id).eq('payment_status', 'payment_pending').maybeSingle());
  const fields = {
    submission_fee: Number(settings.artist_submission_fee),
    currency: settings.payment_currency,
    song_title: song.title,
    artist_name: song.artist_name,
    artist_id: song.artist_id,
  };
  if (existing) {
    return unwrap(await supabase.from('artist_submissions').update(fields).eq('id', existing.id).select('*').single());
  }
  const { data, error } = await supabase
    .from('artist_submissions')
    .insert({ ...fields, user_id: user.id, song_id: song.id })
    .select('*')
    .single();
  if (error?.code === '23505') {
    return unwrap(await supabase.from('artist_submissions').select('*').eq('song_id', song.id).eq('payment_status', 'payment_pending').single());
  }
  return unwrap({ data, error });
}

/** The payment summary shown before paying (song, artist, fee). */
export async function submissionQuote(user, songId) {
  const settings = await getSettings();
  const song = await loadOwnedSong(user.id, songId, SONG_MANAGE_FIELDS);
  const open = unwrap(await supabase.from('artist_submissions').select('id,review_status').eq('song_id', song.id).eq('review_status', 'pending_review').maybeSingle());
  return {
    required: submissionFeeRequired(user, settings),
    fee: Number(settings.artist_submission_fee),
    currency: settings.payment_currency,
    song: { id: song.id, title: song.title, status: song.status, artworkPath: song.artwork_path, hasAudio: Boolean(song.audio_path) },
    artist: { id: song.artist_id, name: song.artist_name },
    alreadySubmitted: Boolean(open) || song.status === 'pending',
    canSubmit: ['draft', 'rejected'].includes(song.status) && !open && Boolean(song.audio_path),
  };
}

export async function initializeSubmissionCheckout(user, songId) {
  const settings = await getSettings();
  if (!submissionFeeRequired(user, settings)) throw badRequest('No submission fee is needed. Submit the song for review directly.', 'FEE_NOT_REQUIRED');
  const song = await loadOwnedSong(user.id, songId, SONG_MANAGE_FIELDS);
  if (!['draft', 'rejected'].includes(song.status)) throw badRequest('Only drafts or songs that need changes can be submitted for review.');
  if (!song.audio_path) throw badRequest('Upload the audio file before submitting.');
  const open = unwrap(await supabase.from('artist_submissions').select('id').eq('song_id', song.id).eq('review_status', 'pending_review').maybeSingle());
  if (open) throw conflict('This song is already waiting for review.', 'ALREADY_SUBMITTED');

  const submission = await openSubmissionFor(song, user, settings);
  const tx = unwrap(
    await supabase
      .from('payment_transactions')
      .insert({
        user_id: user.id,
        reference: newReference('SUB'),
        product_type: 'artist_submission',
        product_id: submission.id,
        amount: submission.submission_fee,
        currency: submission.currency,
        customer_email: user.email,
        metadata: { description: `Music submission: "${song.title}"`, song_id: song.id, artist_id: song.artist_id },
      })
      .select('*')
      .single()
  );
  unwrap(await supabase.from('artist_submissions').update({ payment_transaction_id: tx.id }).eq('id', submission.id));
  const checkout = await startCheckout(tx, {
    email: user.email,
    metadata: { product_type: 'artist_submission', user_id: user.id, submission_id: submission.id, song_id: song.id },
  });
  return { ...checkout, submissionId: submission.id };
}

// ─── Fulfilment ────────────────────────────────────────────────────────────
function paidFields(data) {
  return {
    p_amount: Number(data.amount),
    p_currency: String(data.currency || '').toUpperCase(),
    p_paid_at: data.paid_at || data.paidAt || new Date().toISOString(),
    p_channel: data.channel || null,
    p_customer_code: data.customer?.customer_code || null,
    p_customer_email: data.customer?.email || null,
    p_transaction_id: data.id ? Number(data.id) : null,
    p_gateway_response: data.gateway_response ? String(data.gateway_response).slice(0, 300) : null,
  };
}

async function afterFulfilment(result, reference) {
  if (!result.newlyFulfilled || !result.userId) return;
  const [user, tx] = await Promise.all([
    loadUser(result.userId),
    supabase.from('payment_transactions').select('*').eq('id', result.transactionId).single().then(unwrap),
  ]);
  if (!user) return;
  const settings = await getSettings();
  const amount = formatMoney(tx.amount, tx.currency);

  if (result.productType === 'plus_subscription') {
    notifyUsers([user.id], { type: 'plus_active', prefKey: 'account', title: `Welcome to ${settings.site_name} Plus`, body: 'You can now download music to your device.', link: '/plus' });
    await sendPaymentEmail(user, {
      heading: `Welcome to ${settings.site_name} Plus`,
      message: `Your Plus membership is active. You can now download music to your device.`,
      rows: [
        ['Plan', `${settings.site_name} Plus — monthly`],
        ['Amount', amount],
        ['Reference', reference],
        ['Access until', formatDate(result.periodEnd)],
      ],
      ctaLabel: 'Open Billing & Membership',
      ctaPath: '/settings/billing',
      notice: 'Your membership renews automatically each month. You can cancel any time in Settings → Billing & Membership.',
    });
    return;
  }

  const submission = result.submissionId
    ? unwrap(await supabase.from('artist_submissions').select('*').eq('id', result.submissionId).maybeSingle())
    : null;
  notifyUsers([user.id], {
    type: 'submission_paid',
    prefKey: 'account',
    title: `"${submission?.song_title || 'Your song'}" was submitted for review`,
    body: 'Payment received. The SHERE MUSIC team will review it soon.',
    link: '/studio/payments',
  });
  await sendPaymentEmail(user, {
    heading: 'Submission payment received',
    message: `We received your submission fee. "${submission?.song_title || 'Your song'}" is now waiting for review by the ${settings.site_name} team.`,
    rows: [
      ['Song', submission?.song_title || '—'],
      ['Artist', submission?.artist_name || '—'],
      ['Amount', amount],
      ['Reference', reference],
      ['Status', 'Submitted for review'],
    ],
    ctaLabel: 'View in Studio',
    ctaPath: '/studio/payments',
    notice: 'Paying the submission fee sends your song for review. It does not guarantee approval or artist verification.',
  });
}

/** Fulfil from provider-verified transaction data. Safe to call any number of times. */
async function fulfilFromProviderData(data) {
  const result = unwrap(await supabase.rpc('fulfill_payment', { p_reference: data.reference, ...paidFields(data) }));
  if (result.mismatch) console.warn(`[payments] ${data.reference}: amount/currency did not match; not fulfilled.`);
  await afterFulfilment(result, data.reference);
  return result;
}

/**
 * Ask Paystack for the transaction's real status (used when the customer
 * returns from checkout). The webhook remains authoritative; this simply
 * makes the result visible without waiting for it.
 */
export async function verifyReference(reference) {
  const data = await paystack.verifyTransaction(reference);
  if (data.status === 'success') return fulfilFromProviderData(data);
  if (['failed', 'abandoned', 'reversed'].includes(data.status)) {
    const changed = unwrap(
      await supabase
        .from('payment_transactions')
        .update({ status: data.status, gateway_response: data.gateway_response ? String(data.gateway_response).slice(0, 300) : null })
        .eq('reference', reference)
        .in('status', ['pending', 'abandoned'])
        .select('id,user_id,product_type,amount,currency,metadata')
    );
    if (data.status === 'failed' && changed[0]) await paymentFailedEmail(changed[0], reference);
  }
  return { found: true, newlyFulfilled: false, providerStatus: data.status };
}

async function paymentFailedEmail(tx, reference) {
  const user = tx.user_id ? await loadUser(tx.user_id) : null;
  if (!user) return;
  const isSubmission = tx.product_type === 'artist_submission';
  await sendPaymentEmail(user, {
    heading: 'Payment not completed',
    message: isSubmission
      ? 'Your submission fee payment did not go through, so your song has not been submitted for review yet. Your draft is safe — you can try again from Studio.'
      : 'Your Plus payment did not go through. You have not been charged for Plus. You can try again any time.',
    rows: [
      ['Item', tx.metadata?.description || (isSubmission ? 'Music submission' : 'Plus')],
      ['Amount', formatMoney(tx.amount, tx.currency)],
      ['Reference', reference],
    ],
    ctaLabel: 'Try again',
    ctaPath: isSubmission ? '/studio/music' : '/plus',
  });
}

// ─── Subscription lifecycle ────────────────────────────────────────────────
async function subscriptionByCode(code) {
  if (!code) return null;
  return unwrap(await supabase.from('plus_subscriptions').select('*').eq('provider_subscription_code', code).maybeSingle());
}

/** Paystack created the recurring subscription for a Plus checkout: link it to our record. */
async function linkSubscription(data) {
  const code = data.subscription_code;
  if (!code || (await subscriptionByCode(code))) return;
  const email = String(data.customer?.email || '').toLowerCase();
  const { data: user } = await supabase.from('users').select('id').eq('email', email).maybeSingle();
  if (!user) return console.warn(`[payments] subscription ${code}: no user with the customer email.`);
  const sub = unwrap(
    await supabase
      .from('plus_subscriptions')
      .select('id,status,current_period_end')
      .eq('user_id', user.id)
      .is('provider_subscription_code', null)
      .in('status', ['pending', 'active'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
  );
  if (!sub) return console.warn(`[payments] subscription ${code}: no matching Plus checkout.`);
  const next = data.next_payment_date || null;
  const patch = {
    provider_subscription_code: code,
    provider_email_token: data.email_token || null,
    provider_plan_code: data.plan?.plan_code || null,
    provider_customer_code: data.customer?.customer_code || null,
    next_payment_date: next,
  };
  if (sub.status === 'active' && next && (!sub.current_period_end || Date.parse(next) > Date.parse(sub.current_period_end))) {
    patch.current_period_end = next;
  }
  unwrap(await supabase.from('plus_subscriptions').update(patch).eq('id', sub.id));
}

async function recordRenewal({ reference, subscriptionCode, customerCode, amount, currency, paidAt, periodEnd, channel, transactionId }) {
  const result = unwrap(
    await supabase.rpc('record_plus_renewal', {
      p_reference: reference,
      p_subscription_code: subscriptionCode || null,
      p_customer_code: customerCode || null,
      p_amount: Number(amount),
      p_currency: String(currency || 'NGN').toUpperCase(),
      p_paid_at: paidAt || new Date().toISOString(),
      p_period_end: periodEnd || null,
      p_channel: channel || null,
      p_transaction_id: transactionId ? Number(transactionId) : null,
    })
  );
  if (!result.found) console.warn(`[payments] renewal ${reference}: no matching subscription.`);
  return result;
}

/** Move a subscription to a stopped state and email the member once. */
async function markStopped(sub, status) {
  const updated = unwrap(
    await supabase
      .from('plus_subscriptions')
      .update({ status, cancelled_at: sub.cancelled_at || new Date().toISOString(), next_payment_date: null })
      .eq('id', sub.id)
      .in('status', ['active', 'attention', 'non_renewing'])
      .select('*')
  )[0];
  if (!updated) return;
  const claimed = unwrap(
    await supabase.from('plus_subscriptions').update({ cancellation_notified_at: new Date().toISOString() }).eq('id', sub.id).is('cancellation_notified_at', null).select('id')
  )[0];
  if (!claimed) return;
  const user = await loadUser(sub.user_id);
  if (!user) return;
  const settings = await getSettings();
  await sendPaymentEmail(user, {
    heading: 'Your Plus membership was cancelled',
    message: `Your ${settings.site_name} Plus membership will not renew. You keep your Plus benefits until ${formatDate(updated.current_period_end)}.`,
    rows: [['Plus access until', formatDate(updated.current_period_end)]],
    ctaLabel: 'Billing & Membership',
    ctaPath: '/settings/billing',
  });
}

async function markPaymentFailed(sub, data) {
  const updated = unwrap(await supabase.from('plus_subscriptions').update({ status: 'attention' }).eq('id', sub.id).eq('status', 'active').select('*'))[0];
  if (!updated) return;
  const user = await loadUser(sub.user_id);
  if (!user) return;
  const settings = await getSettings();
  await sendPaymentEmail(user, {
    heading: "We couldn't renew your Plus membership",
    message: `Paystack could not charge your card for ${settings.site_name} Plus. Update your card to keep your Plus benefits.`,
    rows: [['Amount due', formatMoney(data.amount ?? sub.amount, sub.currency)]],
    ctaLabel: 'Update payment method',
    ctaPath: '/settings/billing',
  });
}

/**
 * Fallback when the subscription.create webhook has not arrived (for example
 * in local development, where Paystack cannot reach the API): look the
 * subscription up on the Paystack customer and link it.
 */
export async function syncSubscription(userId) {
  const sub = unwrap(
    await supabase
      .from('plus_subscriptions')
      .select('id,provider_customer_code,provider_plan_code,status,current_period_end')
      .eq('user_id', userId)
      .is('provider_subscription_code', null)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
  );
  if (!sub?.provider_customer_code) return false;
  try {
    const customer = await paystack.fetchCustomer(sub.provider_customer_code);
    const planCode = (p) => (typeof p === 'object' ? p?.plan_code : null);
    const found = (customer.subscriptions || [])
      .filter((s) => ['active', 'non-renewing', 'attention'].includes(s.status))
      .filter((s) => !sub.provider_plan_code || !planCode(s.plan) || planCode(s.plan) === sub.provider_plan_code)
      .sort((a, b) => Date.parse(b.createdAt || b.created_at || 0) - Date.parse(a.createdAt || a.created_at || 0))[0];
    if (!found?.subscription_code || (await subscriptionByCode(found.subscription_code))) return false;
    const next = found.next_payment_date || null;
    unwrap(
      await supabase
        .from('plus_subscriptions')
        .update({
          provider_subscription_code: found.subscription_code,
          provider_email_token: found.email_token || null,
          next_payment_date: next,
          ...(next && (!sub.current_period_end || Date.parse(next) > Date.parse(sub.current_period_end)) ? { current_period_end: next } : {}),
        })
        .eq('id', sub.id)
        .is('provider_subscription_code', null)
    );
    return true;
  } catch (err) {
    console.warn('[payments] subscription sync failed:', err.message);
    return false;
  }
}

/** The member's subscription that can still be cancelled (renews automatically). */
async function renewingSubscription(userId) {
  return unwrap(
    await supabase
      .from('plus_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['active', 'attention'])
      .not('provider_subscription_code', 'is', null)
      .gt('current_period_end', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
  );
}

export async function cancelPlus(user) {
  await syncSubscription(user.id);
  const sub = await renewingSubscription(user.id);
  if (!sub) throw badRequest('You have no Plus membership that renews.');
  if (!sub.provider_email_token) throw new AppError(409, 'This membership cannot be cancelled here yet. Please try again in a few minutes.', 'SUBSCRIPTION_NOT_READY');
  await paystack.disableSubscription(sub.provider_subscription_code, sub.provider_email_token);
  await markStopped(sub, 'cancelled');
}

export async function manageLink(user) {
  await syncSubscription(user.id);
  const sub = unwrap(
    await supabase
      .from('plus_subscriptions')
      .select('provider_subscription_code')
      .eq('user_id', user.id)
      .not('provider_subscription_code', 'is', null)
      .gt('current_period_end', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
  );
  if (!sub) throw notFound('No Plus membership to manage.');
  const data = await paystack.manageSubscriptionLink(sub.provider_subscription_code);
  return { url: data.link };
}

// ─── Webhook events ────────────────────────────────────────────────────────
/**
 * Handle a Paystack event whose signature was already verified. Handlers are
 * idempotent; the controller also skips exact duplicate deliveries.
 */
export async function handlePaystackEvent({ event, data }) {
  switch (event) {
    case 'charge.success': {
      const result = await fulfilFromProviderData(data);
      if (result.found) return;
      // Not a checkout we started: a monthly Plus charge made by Paystack.
      if (data.plan?.plan_code || data.plan_object?.plan_code) {
        await recordRenewal({
          reference: data.reference,
          customerCode: data.customer?.customer_code,
          amount: data.amount,
          currency: data.currency,
          paidAt: data.paid_at || data.paidAt,
          channel: data.channel,
          transactionId: data.id,
        });
      }
      return;
    }
    case 'subscription.create':
      return linkSubscription(data);
    case 'invoice.update':
    case 'invoice.create': {
      if (!data.paid || !data.transaction?.reference) return;
      const code = data.subscription?.subscription_code;
      const sub = await subscriptionByCode(code);
      if (!sub) return;
      await recordRenewal({
        reference: data.transaction.reference,
        subscriptionCode: code,
        customerCode: data.customer?.customer_code,
        amount: data.amount,
        currency: data.transaction.currency || sub.currency,
        paidAt: data.paid_at || data.paidAt,
        periodEnd: data.subscription?.next_payment_date,
      });
      return;
    }
    case 'invoice.payment_failed': {
      const sub = await subscriptionByCode(data.subscription?.subscription_code);
      if (sub) await markPaymentFailed(sub, data);
      return;
    }
    case 'subscription.not_renew': {
      const sub = await subscriptionByCode(data.subscription_code);
      if (sub) await markStopped(sub, 'non_renewing');
      return;
    }
    case 'subscription.disable': {
      const sub = await subscriptionByCode(data.subscription_code);
      if (sub) await markStopped(sub, 'cancelled');
      return;
    }
    default:
      return; // other events are acknowledged and ignored
  }
}

// ─── Review decisions on paid submissions ──────────────────────────────────
/** Email the artist once when a paid submission is approved or rejected. */
export async function notifySubmissionDecision(songId) {
  try {
    const claimed = unwrap(
      await supabase
        .from('artist_submissions')
        .update({ decision_notified_at: new Date().toISOString() })
        .eq('song_id', songId)
        .in('review_status', ['approved', 'rejected'])
        .is('decision_notified_at', null)
        .select('*')
    );
    for (const s of claimed) {
      const user = s.user_id ? await loadUser(s.user_id) : null;
      if (!user) continue;
      const approved = s.review_status === 'approved';
      await sendPaymentEmail(user, {
        heading: approved ? 'Your submission was approved' : 'Your submission needs changes',
        message: approved
          ? `"${s.song_title}" was approved by the SHERE MUSIC team.`
          : `"${s.song_title}" was not approved. Reason: ${s.rejection_reason || 'not given'}. You can edit the song and submit it again.`,
        rows: [
          ['Song', s.song_title],
          ['Decision', approved ? 'Approved' : 'Changes requested'],
        ],
        ctaLabel: 'Open Studio',
        ctaPath: '/studio/music',
      });
    }
  } catch (err) {
    console.error('[payments] submission decision email failed:', err.message);
  }
}
