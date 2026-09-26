import { z } from 'zod';

export const uuid = z.string().uuid('Invalid identifier.');
export const idParam = z.object({ id: uuid });

/** Accepts booleans or "true"/"false" strings (multipart forms send strings). */
export const boolish = z.preprocess((v) => {
  if (v === 'true' || v === '1' || v === 'on') return true;
  if (v === 'false' || v === '0' || v === 'off') return false;
  return v;
}, z.boolean());

/** Empty strings from forms become null. */
export const nullableText = (max) =>
  z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? null : v), z.string().trim().max(max).nullable());

export const nullableUuid = z.preprocess((v) => (v === '' || v === 'null' ? null : v), uuid.nullable());

export const nullableDate = z.preprocess(
  (v) => (v === '' || v === 'null' ? null : v),
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Dates must use the YYYY-MM-DD format.')
    .refine((s) => !Number.isNaN(Date.parse(s)), 'Invalid date.')
    .nullable()
);

export const nullableInt = (min, max) =>
  z.preprocess((v) => (v === '' || v === 'null' || v === undefined ? null : v), z.coerce.number().int().min(min).max(max).nullable());

export const pagination = (maxLimit = 50, defaultLimit = 20) => ({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(maxLimit).default(defaultLimit),
});

export const searchQuery = z.string().trim().max(100).optional();

export const email = z.string().trim().toLowerCase().email('Enter a valid email address.').max(254);

export const password = z
  .string()
  .min(8, 'Password must be at least 8 characters.')
  .max(128, 'Password must be at most 128 characters.')
  .refine((p) => /[a-zA-Z]/.test(p) && /\d/.test(p), 'Password must contain at least one letter and one number.');

export const personName = z.string().trim().min(1, 'Name is required.').max(80, 'Name must be at most 80 characters.');
