import { supabase } from '../../config/supabase.js';
import { unwrap } from '../../utils/db.js';
import { getSettings } from '../settings.service.js';

/**
 * plusEntitlementService — the single source of truth for SHERE MUSIC Plus.
 *
 * Entitlement is always computed on the server from stored, provider-verified
 * subscription periods (see has_active_plus in 003_monetization.sql). Nothing
 * a browser sends (isPlus, status, amounts) is ever consulted.
 */

const ENTITLED = ['active', 'non_renewing', 'attention', 'cancelled'];

export async function hasActivePlus(userId) {
  if (!userId) return false;
  return Boolean(unwrap(await supabase.rpc('has_active_plus', { p_user_id: userId })));
}

/** The subscription that currently grants Plus, or the most recent one. */
async function currentSubscription(userId) {
  const rows = unwrap(
    await supabase
      .from('plus_subscriptions')
      .select('id,status,amount,currency,interval,started_at,current_period_start,current_period_end,next_payment_date,cancelled_at,provider_subscription_code,created_at')
      .eq('user_id', userId)
      .neq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(10)
  );
  const now = Date.now();
  const entitled = rows.find((r) => ENTITLED.includes(r.status) && r.current_period_end && Date.parse(r.current_period_end) > now);
  return { sub: entitled || rows[0] || null, active: Boolean(entitled) };
}

/** Plus status for the account/billing UI (no provider secrets). */
export async function getPlusStatus(userId) {
  const { sub, active } = await currentSubscription(userId);
  if (!sub) return { active: false, status: 'free' };
  const renewing = active && ['active', 'attention'].includes(sub.status);
  return {
    active,
    status: active ? sub.status : 'expired',
    plan: { amount: Number(sub.amount), currency: sub.currency, interval: sub.interval },
    startedAt: sub.started_at,
    currentPeriodStart: sub.current_period_start,
    currentPeriodEnd: sub.current_period_end,
    nextBillingDate: renewing ? sub.next_payment_date || sub.current_period_end : null,
    cancelledAt: sub.cancelled_at,
    canCancel: renewing && Boolean(sub.provider_subscription_code),
    canManage: active && Boolean(sub.provider_subscription_code),
  };
}

/** Compact version for /auth/me. */
export async function plusSummary(userId) {
  const s = await getPlusStatus(userId);
  return { active: s.active, status: s.status, currentPeriodEnd: s.currentPeriodEnd || null };
}

/**
 * Who may download a song to their device, and how the download is recorded:
 *   admin               → admin_download
 *   owner of the artist → artist_download (their own music)
 *   active Plus member  → plus_device_download
 *   Plus switched off   → free_download (any signed-in listener, as before Plus)
 * Everyone else gets { allowed: false } and the API answers 403 PLUS_REQUIRED.
 */
export async function downloadAccess(user, song) {
  if (!user) return { allowed: false, reason: 'SIGN_IN' };
  if (user.role === 'admin') return { allowed: true, type: 'admin_download' };
  if (song.artist_owner_id && song.artist_owner_id === user.id) return { allowed: true, type: 'artist_download' };
  const settings = await getSettings();
  if (!settings.plus_enabled) return { allowed: true, type: 'free_download' };
  if (await hasActivePlus(user.id)) return { allowed: true, type: 'plus_device_download' };
  return { allowed: false, reason: 'PLUS_REQUIRED' };
}
