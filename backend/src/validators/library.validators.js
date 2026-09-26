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
