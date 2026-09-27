import { z } from 'zod';
import { boolish, nullableDate, nullableInt, nullableText, nullableUuid, pagination, searchQuery, uuid } from './common.js';

const videoFields = {
  title: z.string().trim().min(1, 'Title is required.').max(160),
  artistId: uuid,
  songId: nullableUuid.optional(),
  genreId: nullableUuid.optional(),
  description: nullableText(5000).optional(),
  releaseDate: nullableDate.optional(),
  duration: nullableInt(0, 60 * 60 * 6).optional(),
  isFeatured: boolish.optional(),
  status: z.enum(['draft', 'pending', 'approved', 'published', 'rejected']).optional(),
  removeThumbnail: boolish.optional(),
};

export const createVideoSchema = z.object(videoFields);
export const updateVideoSchema = z.object(videoFields).partial();

export const uploadUrlSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  size: z.number().int().positive(),
});
export const completeUploadSchema = z.object({
  path: z.string().min(1).max(500),
  duration: z.number().int().min(0).max(21600).nullable().optional(),
});

export const subtitleSchema = z.object({
  language: z.string().trim().regex(/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/, 'Choose a language.'),
  label: z.string().trim().min(1).max(40),
  isDefault: boolish.optional(),
});
export const subtitleParams = z.object({ id: uuid, subtitleId: uuid });

export const videoListQuery = z.object({
  q: searchQuery,
  genre: z.string().trim().max(80).optional(),
  artist: uuid.optional(),
  featured: boolish.optional(),
  sort: z.enum(['latest', 'popular', 'released', 'title']).default('latest'),
  ...pagination(48, 24),
});

export const manageVideoListQuery = z.object({
  q: searchQuery,
  status: z.enum(['all', 'draft', 'pending', 'approved', 'published', 'rejected']).default('all'),
  artist: uuid.optional(),
  sort: z.enum(['created_desc', 'submitted', 'title', 'views']).default('created_desc'),
  ...pagination(100, 25),
});
