import { z } from 'zod';
import { boolish, nullableText, pagination, searchQuery, uuid } from './common.js';

/**
 * Payment inputs. Note what is NOT accepted anywhere: amounts, currencies,
 * statuses, user ids or Plus flags. Those always come from the server.
 */
export const referenceParam = z.object({ reference: z.string().trim().regex(/^[A-Za-z0-9._=-]{6,100}$/, 'Invalid payment reference.') });
export const songIdParam = z.object({ songId: uuid });
export const submissionCheckoutSchema = z.object({ songId: uuid }).strict();

const productType = z.enum(['plus_subscription', 'artist_submission']);
export const historyQuery = z.object({ ...pagination(50, 20), product: productType.optional() });

// ─── Admin ─────────────────────────────────────────────────────────────────
/** Prices are entered in major units (₦600) and stored in minor units (60000 kobo). */
const price = z.coerce.number().min(50, 'The minimum price is 50.').max(10_000_000).transform((v) => Math.round(v * 100));

export const monetizationSettingsSchema = z
  .object({
    plusEnabled: boolish,
    plusPrice: price,
    plusBenefits: z.array(z.string().trim().min(1).max(120)).min(1, 'List at least one benefit.').max(10),
    artistSubmissionEnabled: boolish,
    artistSubmissionFee: price,
    currency: z.enum(['NGN', 'USD', 'GHS', 'ZAR', 'KES']),
  })
  .partial()
  .strict();

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Dates must use the YYYY-MM-DD format.');
export const summaryQuery = z
  .object({ range: z.enum(['today', '7d', '30d', 'month', 'custom']).default('30d'), from: isoDate.optional(), to: isoDate.optional() })
  .refine((q) => q.range !== 'custom' || (q.from && q.to && q.from <= q.to), { message: 'Choose a start and end date.' });

export const adminPaymentsQuery = z.object({
  ...pagination(100, 25),
  q: searchQuery,
  status: z.enum(['all', 'pending', 'success', 'failed', 'abandoned', 'reversed']).default('all'),
  product: productType.optional(),
});

export const plusMembersQuery = z.object({ ...pagination(100, 25), q: searchQuery, status: z.enum(['active', 'all']).default('active') });

export const submissionsQuery = z.object({
  ...pagination(100, 25),
  q: searchQuery,
  review: z.enum(['all', 'not_submitted', 'pending_review', 'approved', 'rejected']).default('all'),
  payment: z.enum(['all', 'payment_pending', 'payment_successful']).default('all'),
});

export const submissionReviewSchema = z
  .object({ decision: z.enum(['approve', 'publish', 'reject']), reason: nullableText(500).optional() })
  .strict()
  .refine((b) => b.decision !== 'reject' || (b.reason && b.reason.trim()), { message: 'Give the artist a reason for the rejection.', path: ['reason'] });

const nullableDateTime = z.preprocess(
  (v) => (v === '' || v === 'null' || v === undefined ? null : v),
  z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'Invalid date.').nullable()
);
const httpUrl = z.preprocess(
  (v) => (v === '' ? null : v),
  z.string().trim().max(500).refine((s) => /^https?:\/\//i.test(s) || s.startsWith('/'), 'Links must start with https:// or /').nullable()
);

export const offerSchema = z.object({
  title: z.string().trim().min(1, 'Add a title.').max(120),
  description: nullableText(1000).optional(),
  linkUrl: httpUrl.optional(),
  linkLabel: nullableText(40).optional(),
  startsAt: nullableDateTime.optional(),
  endsAt: nullableDateTime.optional(),
  isActive: boolish.optional(),
  plusOnly: boolish.optional(),
  sortOrder: z.coerce.number().int().min(0).max(1000).optional(),
  removeImage: boolish.optional(),
});
export const offerUpdateSchema = offerSchema.partial();
