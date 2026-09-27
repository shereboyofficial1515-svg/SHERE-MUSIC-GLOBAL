import { z } from 'zod';
import { boolish, nullableText, pagination, uuid } from './common.js';

export const songIdParam = z.object({ songId: uuid });
export const playlistSongParams = z.object({ id: uuid, songId: uuid });
export const pageQuery = z.object(pagination(50, 20));

export const createPlaylistSchema = z.object({
  name: z.string().trim().min(1, 'Playlist name is required.').max(100),
  description: nullableText(500).optional(),
  isPublic: boolish.optional(),
});

export const updatePlaylistSchema = createPlaylistSchema.partial();

export const addPlaylistSongSchema = z.object({ songId: uuid });

export const studioSongListQuery = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(['all', 'draft', 'pending', 'approved', 'published', 'rejected']).default('all'),
  sort: z.enum(['created_desc', 'title', 'plays', 'downloads']).default('created_desc'),
  ...pagination(100, 25),
});

export const followersQuery = z.object({ artist: z.string().uuid().optional(), ...pagination(100, 30) });
