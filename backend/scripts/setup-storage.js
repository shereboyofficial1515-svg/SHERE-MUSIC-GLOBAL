/**
 * Create (or update) the Supabase Storage buckets SHERE MUSIC needs.
 *   npm run setup:storage
 */
import { env } from '../src/config/env.js';
import { supabase } from '../src/config/supabase.js';

const GB = 1024 * 1024 * 1024;
const MB = 1024 * 1024;

const buckets = [
  {
    id: env.supabase.audioBucket,
    options: {
      public: false, // audio is only reachable through short-lived signed URLs
      fileSizeLimit: Math.min(env.uploads.maxAudioMb * MB, 2 * GB),
      allowedMimeTypes: ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/aac'],
    },
  },
  {
    id: env.supabase.mediaBucket,
    options: {
      public: true, // artwork and avatars are safe to serve publicly (random, unguessable names)
      fileSizeLimit: env.uploads.maxImageMb * MB,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/x-icon'],
    },
  },
];

const { data: existing, error: listError } = await supabase.storage.listBuckets();
if (listError) {
  console.error('Could not list buckets:', listError.message);
  process.exit(1);
}

for (const { id, options } of buckets) {
  const exists = existing.some((b) => b.id === id);
  const { error } = exists ? await supabase.storage.updateBucket(id, options) : await supabase.storage.createBucket(id, options);
  if (error) {
    console.error(`✗ ${id}: ${error.message}`);
    process.exitCode = 1;
  } else {
    console.log(`✓ ${id} ${exists ? 'updated' : 'created'} (${options.public ? 'public' : 'private'})`);
  }
}
