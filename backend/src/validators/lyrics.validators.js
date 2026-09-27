import { z } from 'zod';
import { nullableText, uuid } from './common.js';

const line = z.object({
  text: z.string().max(500, 'Each lyric line can be at most 500 characters.'),
  startTimeMs: z.number().int().min(0).nullable().optional(),
});

export const saveLyricsSchema = z.object({
  language: z
    .string()
    .trim()
    .regex(/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/, 'Use a language code such as en, fr or yo.')
    .default('en'),
  isSynced: z.boolean(),
  lines: z.array(line).max(2000),
  source: z.enum(['manual', 'imported']).default('manual'),
  copyrightNotice: nullableText(500).optional(),
  attribution: nullableText(500).optional(),
  license: nullableText(200).optional(),
  // Studio: save and submit for review in one step. Admin: publish immediately.
  submit: z.boolean().optional(),
  publish: z.boolean().optional(),
});

export const lyricsParams = z.object({ id: uuid, lyricsId: uuid });
export const lyricsVisibilitySchema = z.object({ isVisible: z.boolean() });
export const lyricsListQuery = z.object({
  status: z.enum(['all', 'draft', 'pending', 'approved', 'published', 'rejected']).default('all'),
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
