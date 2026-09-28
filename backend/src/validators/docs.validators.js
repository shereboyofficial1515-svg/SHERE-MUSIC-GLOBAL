import { z } from 'zod';

const slug = z.string().regex(/^[a-z0-9-]{1,80}$/, 'Invalid address.');
export const docParams = z.object({ section: slug, article: slug });
export const docSearchQuery = z.object({ q: z.string().trim().min(1, 'Type something to search for.').max(100) });
export const docAssetParam = z.object({ file: z.string().regex(/^[a-z0-9-]+\.(png|jpe?g|webp)$/, 'Invalid file.') });
