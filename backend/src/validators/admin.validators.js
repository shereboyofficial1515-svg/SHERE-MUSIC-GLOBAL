import { z } from 'zod';
import { boolish, nullableText, pagination, searchQuery, uuid } from './common.js';

export const userListQuery = z.object({
  q: searchQuery,
  role: z.enum(['user', 'admin']).optional(),
  status: z.enum(['active', 'disabled']).optional(),
  ...pagination(100, 25),
});

export const userStatusSchema = z.object({ status: z.enum(['active', 'disabled']) });
export const userRoleSchema = z.object({ role: z.enum(['user', 'admin']) });

export const adminPlaylistQuery = z.object({
  q: searchQuery,
  featured: boolish.optional(),
  ...pagination(100, 25),
});

export const adminPlaylistUpdate = z
  .object({ isFeatured: boolish.optional(), isPublic: boolish.optional() })
  .refine((d) => d.isFeatured !== undefined || d.isPublic !== undefined, 'Nothing to update.');

export const downloadsQuery = z.object({ song: uuid.optional(), ...pagination(100, 50) });

export const analyticsQuery = z.object({ days: z.coerce.number().int().min(1).max(365).default(30) });

export const reportParams = z.object({ type: z.enum(['songs', 'downloads', 'users', 'daily-activity', 'artists']) });
export const reportQuery = z.object({ days: z.coerce.number().int().min(1).max(365).default(30) });

const url = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
  z.string().trim().url('Enter a full URL starting with https://').max(300).refine((u) => /^https?:\/\//i.test(u), 'Links must start with http:// or https://').nullable()
);

export const settingsSchema = z
  .object({
    siteName: z.string().trim().min(1).max(60),
    siteDescription: z.string().trim().max(300),
    contactEmail: z.preprocess((v) => (v === '' ? null : v), z.string().trim().email('Enter a valid contact email.').max(254).nullable()),
    socialLinks: z
      .object({
        instagram: url.optional(),
        x: url.optional(),
        facebook: url.optional(),
        youtube: url.optional(),
        tiktok: url.optional(),
        spotify: url.optional(),
      })
      .strict(),
    maxAudioMb: z.coerce.number().int().min(1).max(2048),
    maxImageMb: z.coerce.number().int().min(1).max(100),
    allowRegistration: boolish,
    maintenanceMode: boolish,
    maintenanceMessage: nullableText(300),
    featuredLimit: z.coerce.number().int().min(1).max(50),
  })
  .partial();
