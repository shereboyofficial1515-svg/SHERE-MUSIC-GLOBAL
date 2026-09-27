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
  {
    id: env.supabase.videoBucket,
    options: {
      public: false, // streamed through signed URLs; uploaded via one-time signed upload URLs
      fileSizeLimit: Math.min(env.uploads.maxVideoMb * MB, 5 * GB),
      allowedMimeTypes: ['video/mp4', 'video/webm', 'video/quicktime'],
    },
  },
  {
    id: env.supabase.subtitleBucket,
    options: {
      public: false, // served through the API
      fileSizeLimit: 2 * MB,
      allowedMimeTypes: ['text/vtt'],
    },
  },
];

const { data: existing, error: listError } = await supabase.storage.listBuckets();
if (listError) {
  console.error('Could not list buckets:', listError.message);
  process.exit(1);
}

const save = (id, options, exists) => (exists ? supabase.storage.updateBucket(id, options) : supabase.storage.createBucket(id, options));

for (const { id, options } of buckets) {
  const exists = existing.some((b) => b.id === id);
  let { error } = await save(id, options, exists);
  // The project's global file size limit (50 MB on the Free plan) is lower than
  // the one requested: fall back to the global limit instead of failing.
  if (error && /maximum allowed size/i.test(error.message)) {
    const { fileSizeLimit, ...rest } = options;
    ({ error } = await save(id, rest, exists));
    if (!error) {
      console.warn(
        `! ${id}: ${Math.round(fileSizeLimit / MB)} MB is above your project's file size limit, so the project limit applies. ` +
          'Set MAX_*_MB in .env (and Admin → Settings → Uploads) at or below it, or raise it in Supabase → Storage → Settings.'
      );
    }
  }
  if (error) {
    console.error(`✗ ${id}: ${error.message}`);
    process.exitCode = 1;
  } else {
    console.log(`✓ ${id} ${exists ? 'updated' : 'created'} (${options.public ? 'public' : 'private'})`);
  }
}
