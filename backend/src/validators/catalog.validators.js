import { z } from 'zod';
import { boolish, nullableDate, nullableInt, nullableText, nullableUuid, pagination, searchQuery, uuid } from './common.js';

// ─── Public queries ────────────────────────────────────────────────────────
export const songListQuery = z.object({
  q: searchQuery,
  genre: z.string().trim().max(80).optional(),
  artist: uuid.optional(),
  album: uuid.optional(),
  featured: boolish.optional(),
  sort: z.enum(['latest', 'released', 'popular', 'downloads', 'title']).default('latest'),
  ...pagination(50, 20),
});

export const listQuery = z.object({
  q: searchQuery,
  artist: uuid.optional(),
  verification: z.enum(['none', 'pending', 'verified', 'rejected']).optional(),
  sort: z.enum(['name', 'popular', 'latest']).default('name'),
  ...pagination(60, 24),
});

export const searchSchema = z.object({
  q: z.string().trim().min(1).max(100),
  limit: z.coerce.number().int().min(1).max(30).default(20),
});

export const lyricsQuery = z.object({ lang: z.string().trim().max(10).optional() });

// ─── Admin: songs ──────────────────────────────────────────────────────────
const songFields = {
  title: z.string().trim().min(1, 'Title is required.').max(160),
  artistId: uuid,
  albumId: nullableUuid.optional(),
  genreId: nullableUuid.optional(),
  description: nullableText(5000).optional(),
  releaseDate: nullableDate.optional(),
  duration: nullableInt(0, 60 * 60 * 6).optional(),
  trackNumber: nullableInt(1, 999).optional(),
  isFeatured: boolish.optional(),
  isPublished: boolish.optional(),
  status: z.enum(['draft', 'pending', 'approved', 'published', 'rejected']).optional(),
};

export const createSongSchema = z.object(songFields);
export const updateSongSchema = z.object(songFields).partial();
export const publishSchema = z.object({ isPublished: boolish });
export const featureSchema = z.object({ isFeatured: boolish });
export const reviewSchema = z.object({
  decision: z.enum(['approve', 'publish', 'reject']),
  reason: z.string().trim().max(1000).optional(),
});
export const statusSchema = z.object({ status: z.enum(['draft', 'pending', 'approved', 'published', 'rejected']) });

export const adminSongListQuery = z.object({
  q: searchQuery,
  status: z.enum(['all', 'published', 'draft', 'pending', 'approved', 'rejected']).default('all'),
  genre: uuid.optional(),
  artist: uuid.optional(),
  album: uuid.optional(),
  featured: boolish.optional(),
  sort: z.enum(['created_desc', 'created_asc', 'submitted', 'title', 'plays', 'downloads', 'release']).default('created_desc'),
  ...pagination(100, 25),
});

// ─── Admin: artists / albums / genres ─────────────────────────────────────
// Multipart forms send objects as JSON strings.
const socialLinks = z.preprocess((v) => {
  if (typeof v !== 'string') return v;
  try {
    return JSON.parse(v);
  } catch {
    return v;
  }
}, z.record(z.string().max(30), z.string().trim().max(300)).optional());

export const artistSchema = z.object({
  name: z.string().trim().min(1, 'Artist name is required.').max(120),
  bio: nullableText(5000).optional(),
  location: nullableText(80).optional(),
  socialLinks,
  removeImage: boolish.optional(),
  removeCover: boolish.optional(),
  ownerEmail: z.preprocess((v) => (v === '' ? null : v), z.string().trim().toLowerCase().email('Enter a valid owner email.').nullable().optional()),
});

export const verificationDecisionSchema = z.object({
  decision: z.enum(['verify', 'reject', 'revoke']),
  note: z.string().trim().max(1000).optional(),
});

export const verificationRequestSchema = z.object({ message: z.string().trim().min(10, 'Tell us a little about yourself (10+ characters).').max(1000) });

export const albumSchema = z.object({
  title: z.string().trim().min(1, 'Album title is required.').max(160),
  artistId: uuid,
  releaseDate: nullableDate.optional(),
  description: nullableText(5000).optional(),
  removeArtwork: boolish.optional(),
});

export const albumSongsSchema = z.object({ songIds: z.array(uuid).min(1).max(200) });

export const genreSchema = z.object({
  name: z.string().trim().min(1, 'Genre name is required.').max(60),
  description: nullableText(500).optional(),
});
