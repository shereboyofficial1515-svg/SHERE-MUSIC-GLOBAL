import { badRequest } from '../utils/AppError.js';
import { notifyArtistOwner, notifyFollowersOfRelease } from './notification.service.js';
import { notifySubmissionDecision } from './payments/payment.service.js';

/**
 * Shared review workflow for creator content (songs, music videos, lyrics):
 *
 *   draft ──submit──▶ pending ──admin approve──▶ published
 *     ▲                  │  └──admin approve (hold)──▶ approved ──creator publish──▶ published
 *     └──── edit ◀── rejected ◀──admin reject (reason)
 *
 * When the platform allows auto-publishing, a creator's submit publishes
 * immediately. Functions here return column patches; callers persist them.
 */
export const STATUSES = ['draft', 'pending', 'approved', 'published', 'rejected'];
const now = () => new Date().toISOString();

/** Status after a creator edits content. Changing reviewed content sends it back for review. */
export function statusAfterCreatorEdit(current, autoPublish) {
  if (current === 'rejected') return 'draft';
  if ((current === 'published' || current === 'approved') && !autoPublish) return 'pending';
  return current;
}

export function submitPatch(current, autoPublish, { alreadyPublishedOnce = false } = {}) {
  if (!['draft', 'rejected'].includes(current)) throw badRequest('Only drafts or rejected items can be submitted for review.');
  if (autoPublish) return { status: 'published', submitted_at: now(), rejection_reason: null, ...(alreadyPublishedOnce ? {} : { published_at: now() }) };
  return { status: 'pending', submitted_at: now(), rejection_reason: null };
}

/** Creator can publish content an admin approved, or withdraw published content. */
export function creatorPublishPatch(current, publish, { publishedAt } = {}) {
  if (publish) {
    if (current !== 'approved') throw badRequest('Only approved items can be published.');
    return { status: 'published', ...(publishedAt ? {} : { published_at: now() }) };
  }
  if (current !== 'published') throw badRequest('Only published items can be unpublished.');
  return { status: 'approved' };
}

/** Admin decision on a submission. */
export function reviewPatch(decision, adminId, reason, { publishedAt } = {}) {
  const base = { reviewed_at: now(), reviewed_by: adminId };
  if (decision === 'reject') {
    if (!reason?.trim()) throw badRequest('Give the creator a reason for the rejection.');
    return { ...base, status: 'rejected', rejection_reason: reason.trim() };
  }
  if (decision === 'approve') return { ...base, status: 'approved', rejection_reason: null };
  return { ...base, status: 'published', rejection_reason: null, ...(publishedAt ? {} : { published_at: now() }) };
}

/** Admin direct status change (admins can set any status on any content). */
export function adminStatusPatch(status, adminId, { publishedAt } = {}) {
  if (!STATUSES.includes(status)) throw badRequest('Invalid status.');
  return {
    status,
    reviewed_at: now(),
    reviewed_by: adminId,
    ...(status === 'published' && !publishedAt ? { published_at: now() } : {}),
    ...(status !== 'rejected' ? { rejection_reason: null } : {}),
  };
}

/**
 * Side effects after a status change: first-time publications notify
 * followers; review decisions notify the owning creator.
 */
export async function afterStatusChange(kind, before, after) {
  const label = { song: 'song', video: 'music video', lyrics: 'lyrics' }[kind];
  const title = after.title || before.title;
  const firstPublish = after.status === 'published' && before.status !== 'published' && !before.published_at;
  if (firstPublish && kind !== 'lyrics') {
    notifyFollowersOfRelease(kind, { artistId: after.artist_id || before.artist_id, artistName: before.artist_name, title, id: before.id });
  }
  // Paid submissions are synced by a database trigger; email the artist about the decision (once).
  if (kind === 'song' && before.status === 'pending' && ['approved', 'published', 'rejected'].includes(after.status)) {
    notifySubmissionDecision(before.id);
  }
  if (before.status === 'pending' && ['approved', 'published', 'rejected'].includes(after.status) && before.artist_id) {
    const link = kind === 'video' ? '/studio/videos' : kind === 'lyrics' ? '/studio/lyrics' : '/studio/music';
    notifyArtistOwner(before.artist_id, {
      type: `review_${after.status}`,
      prefKey: 'account',
      title:
        after.status === 'rejected'
          ? `Your ${label} "${title}" needs changes`
          : after.status === 'published'
            ? `Your ${label} "${title}" is live`
            : `Your ${label} "${title}" was approved`,
      body: after.status === 'rejected' ? after.rejection_reason : null,
      link,
    });
  }
}
