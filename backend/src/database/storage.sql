-- SHERE MUSIC — storage buckets (alternative to `npm run setup:storage`).
-- Bucket names must match STORAGE_AUDIO_BUCKET / STORAGE_MEDIA_BUCKET.
--
-- music  (private): audio files under songs/. Only reachable through short-lived
--                   signed URLs issued by the API for published songs.
-- videos (private): music videos under videos/<video-id>/, uploaded directly by the browser
--                   through one-time signed upload URLs issued by the API.
-- subtitles (private): WebVTT files, served through the API.
-- media  (public):  artwork/, artists/, albums/, avatars/, playlists/, branding/.
--                   Files have unguessable UUID names; the bucket cannot be listed
--                   with the anon key because no storage.objects policies are added.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('music', 'music', false, 2147483648,
    array['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/aac']),
  ('media', 'media', true, 104857600,
    array['image/jpeg', 'image/png', 'image/webp', 'image/x-icon']),
  ('videos', 'videos', false, 5368709120,
    array['video/mp4', 'video/webm', 'video/quicktime']),
  ('subtitles', 'subtitles', false, 2097152,
    array['text/vtt'])
on conflict (id) do update
  set public = excluded.public,
      allowed_mime_types = excluded.allowed_mime_types;
