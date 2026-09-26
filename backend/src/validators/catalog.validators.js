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
  sort: z.enum(['name', 'popular', 'latest']).default('name'),
  ...pagination(60, 24),
});

export const searchSchema = z.object({
  q: z.string().trim().min(1).max(100),
  limit: z.coerce.number().int().min(1).max(30).default(20),
});

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
};

export const createSongSchema = z.object(songFields);
export const updateSongSchema = z.object(songFields).partial();
export const publishSchema = z.object({ isPublished: boolish });
export const featureSchema = z.object({ isFeatured: boolish });

export const adminSongListQuery = z.object({
  q: searchQuery,
  status: z.enum(['all', 'published', 'draft']).default('all'),
  genre: uuid.optional(),
  artist: uuid.optional(),
  album: uuid.optional(),
  featured: boolish.optional(),
  sort: z.enum(['created_desc', 'created_asc', 'title', 'plays', 'downloads', 'release']).default('created_desc'),
  ...pagination(100, 25),
});

// ─── Admin: artists / albums / genres ─────────────────────────────────────
export const artistSchema = z.object({
  name: z.string().trim().min(1, 'Artist name is required.').max(120),
  bio: nullableText(5000).optional(),
  removeImage: boolish.optional(),
});

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
