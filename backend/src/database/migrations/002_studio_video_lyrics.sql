-- ═══════════════════════════════════════════════════════════════════════════
-- SHERE MUSIC 2.0 — Studio, lyrics, music videos, followers, settings, OAuth
--
-- Run AFTER schema.sql (and seed.sql). Safe to re-run: every statement is
-- guarded, and existing songs keep their published/draft state.
--
-- Access model is unchanged: only the backend (service role) touches data.
-- RLS is enabled on every new table with no policies.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Users: roles, profile fields, OAuth-only accounts ─────────────────────
alter table public.users alter column password_hash drop not null;
alter table public.users drop constraint if exists users_role_check;
alter table public.users add constraint users_role_check check (role in ('user', 'artist', 'admin'));
alter table public.users add column if not exists username citext unique
  check (username is null or username::text ~ '^[a-z0-9_.]{3,30}$');
alter table public.users add column if not exists bio text check (bio is null or char_length(bio) <= 500);
alter table public.users add column if not exists location text check (location is null or char_length(location) <= 80);
alter table public.users add column if not exists website text check (website is null or char_length(website) <= 200);
alter table public.users add column if not exists social_links jsonb not null default '{}'::jsonb;
alter table public.users add column if not exists favorite_genre_ids uuid[] not null default '{}';
alter table public.users add column if not exists pending_email citext;

alter table public.auth_tokens drop constraint if exists auth_tokens_type_check;
alter table public.auth_tokens add constraint auth_tokens_type_check
  check (type in ('verify_email', 'reset_password', 'change_email'));

-- Google / Facebook identities (verified through Supabase Auth, linked to our users)
create table if not exists public.connected_accounts (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.users (id) on delete cascade,
  provider          text not null check (provider in ('google', 'facebook')),
  provider_user_id  text not null,
  provider_email    citext,
  created_at        timestamptz not null default now(),
  unique (provider, provider_user_id),
  unique (user_id, provider)
);

-- Per-user settings, kept apart from core account data
create table if not exists public.user_settings (
  user_id                  uuid primary key references public.users (id) on delete cascade,
  theme                    text not null default 'system' check (theme in ('light', 'dark', 'system')),
  language                 text not null default 'en',
  subtitle_language        text,
  captions_enabled         boolean not null default false,
  reduced_motion           text not null default 'system' check (reduced_motion in ('system', 'on', 'off')),
  large_text               boolean not null default false,
  high_contrast            boolean not null default false,
  larger_controls          boolean not null default false,
  lyrics_auto_open         boolean not null default false,
  autoplay                 boolean not null default true,
  remember_position        boolean not null default true,
  wifi_only_downloads      boolean not null default false,
  download_notifications   boolean not null default true,
  notification_preferences jsonb not null default
    '{"newMusic": true, "newVideos": true, "artistUpdates": true, "followers": true, "account": true, "email": true}'::jsonb,
  privacy_preferences      jsonb not null default
    '{"publicProfile": true, "showListeningActivity": false, "showFollowing": true, "showFollowers": true, "personalizedRecommendations": true, "usageAnalytics": true}'::jsonb,
  updated_at               timestamptz not null default now()
);
drop trigger if exists user_settings_updated_at on public.user_settings;
create trigger user_settings_updated_at before update on public.user_settings
  for each row execute function public.set_updated_at();

-- In-app notifications
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users (id) on delete cascade,
  type        text not null,
  title       text not null,
  body        text,
  link        text,
  is_read     boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications (user_id) where not is_read;

-- ─── Artists: ownership, verification, followers ───────────────────────────
alter table public.artists add column if not exists owner_user_id uuid references public.users (id) on delete set null;
alter table public.artists add column if not exists cover_path text;
alter table public.artists add column if not exists location text;
alter table public.artists add column if not exists social_links jsonb not null default '{}'::jsonb;
alter table public.artists add column if not exists verification_status text not null default 'none';
alter table public.artists drop constraint if exists artists_verification_status_check;
alter table public.artists add constraint artists_verification_status_check
  check (verification_status in ('none', 'pending', 'verified', 'rejected'));
alter table public.artists add column if not exists verification_message text;
alter table public.artists add column if not exists verification_note text;
alter table public.artists add column if not exists verification_requested_at timestamptz;
alter table public.artists add column if not exists verified_at timestamptz;
alter table public.artists add column if not exists follower_count bigint not null default 0;
create index if not exists artists_owner_idx on public.artists (owner_user_id);
create index if not exists artists_verification_idx on public.artists (verification_status) where verification_status = 'pending';

create table if not exists public.artist_followers (
  id          uuid primary key default gen_random_uuid(),
  artist_id   uuid not null references public.artists (id) on delete cascade,
  user_id     uuid not null references public.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (artist_id, user_id)
);
create index if not exists artist_followers_user_idx on public.artist_followers (user_id, created_at desc);
create index if not exists artist_followers_artist_idx on public.artist_followers (artist_id, created_at desc);

create or replace function public.sync_follower_count()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update artists set follower_count = follower_count + 1 where id = new.artist_id;
  elsif tg_op = 'DELETE' then
    update artists set follower_count = greatest(follower_count - 1, 0) where id = old.artist_id;
  end if;
  return null;
end $$;
drop trigger if exists artist_followers_count on public.artist_followers;
create trigger artist_followers_count after insert or delete on public.artist_followers
  for each row execute function public.sync_follower_count();
update public.artists a set follower_count = (select count(*) from public.artist_followers f where f.artist_id = a.id);

-- ─── Songs: review workflow (status replaces the is_published flag) ────────
-- is_published becomes a generated column so every existing query keeps working.
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'songs' and column_name = 'status') then
    alter table public.songs add column status text;
    update public.songs set status = case when is_published then 'published' else 'draft' end;
    alter table public.songs alter column status set not null;
    alter table public.songs alter column status set default 'draft';
    -- Drops the v1 views/functions/indexes that depend on is_published; they are recreated below.
    alter table public.songs drop column is_published cascade;
    alter table public.songs add column is_published boolean generated always as (status = 'published') stored;
  end if;
end $$;
alter table public.songs drop constraint if exists songs_status_check;
alter table public.songs add constraint songs_status_check
  check (status in ('draft', 'pending', 'approved', 'published', 'rejected'));
alter table public.songs add column if not exists submitted_at timestamptz;
alter table public.songs add column if not exists reviewed_at timestamptz;
alter table public.songs add column if not exists reviewed_by uuid references public.users (id) on delete set null;
alter table public.songs add column if not exists rejection_reason text;

create index if not exists songs_status_idx on public.songs (status, submitted_at);
create index if not exists songs_published_created_idx on public.songs (is_published, created_at desc);
create index if not exists songs_published_release_idx on public.songs (is_published, release_date desc nulls last);
create index if not exists songs_published_plays_idx on public.songs (is_published, play_count desc);
create index if not exists songs_published_downloads_idx on public.songs (is_published, download_count desc);
create index if not exists songs_featured_idx on public.songs (created_at desc) where is_featured and is_published;

drop trigger if exists songs_updated_at on public.songs;
create trigger songs_updated_at
  before update of title, artist_id, album_id, genre_id, description, audio_path, artwork_path,
                   duration, release_date, track_number, is_featured, status
  on public.songs for each row execute function public.set_updated_at();

-- ─── Lyrics ─────────────────────────────────────────────────────────────────
create table if not exists public.lyrics (
  id                uuid primary key default gen_random_uuid(),
  song_id           uuid not null references public.songs (id) on delete cascade,
  language          text not null default 'en' check (language ~ '^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$'),
  source            text not null default 'manual' check (source in ('manual', 'imported', 'external')),
  provider          text,
  is_synced         boolean not null default false,
  content           text not null default '',          -- plain text (also used for search)
  copyright_notice  text,
  attribution       text,
  license           text,
  status            text not null default 'draft'
                    check (status in ('draft', 'pending', 'approved', 'published', 'rejected')),
  is_visible        boolean not null default true,      -- admin can hide lyrics without deleting them
  rejection_reason  text,
  created_by        uuid references public.users (id) on delete set null,
  submitted_at      timestamptz,
  reviewed_by       uuid references public.users (id) on delete set null,
  reviewed_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (song_id, language)
);
create index if not exists lyrics_status_idx on public.lyrics (status, submitted_at);
create index if not exists lyrics_content_trgm_idx on public.lyrics using gin (content gin_trgm_ops);
drop trigger if exists lyrics_updated_at on public.lyrics;
create trigger lyrics_updated_at before update on public.lyrics
  for each row execute function public.set_updated_at();

create table if not exists public.lyric_lines (
  id             uuid primary key default gen_random_uuid(),
  lyrics_id      uuid not null references public.lyrics (id) on delete cascade,
  line_number    integer not null check (line_number >= 0),
  text           text not null default '' check (char_length(text) <= 500),
  start_time_ms  integer check (start_time_ms is null or start_time_ms >= 0),
  end_time_ms    integer check (end_time_ms is null or end_time_ms >= 0),
  unique (lyrics_id, line_number)
);
create index if not exists lyric_lines_order_idx on public.lyric_lines (lyrics_id, line_number);

-- Replace all lines of a lyrics record atomically (one transaction).
create or replace function public.replace_lyric_lines(p_lyrics_id uuid, p_lines jsonb)
returns void language plpgsql set search_path = public as $$
begin
  delete from lyric_lines where lyrics_id = p_lyrics_id;
  insert into lyric_lines (lyrics_id, line_number, text, start_time_ms, end_time_ms)
  select p_lyrics_id,
         (ord - 1)::int,
         coalesce(line ->> 'text', ''),
         nullif(line ->> 'startTimeMs', '')::int,
         nullif(line ->> 'endTimeMs', '')::int
  from jsonb_array_elements(p_lines) with ordinality as t(line, ord);
end $$;

-- ─── Music videos ───────────────────────────────────────────────────────────
create table if not exists public.music_videos (
  id                 uuid primary key default gen_random_uuid(),
  artist_id          uuid not null references public.artists (id) on delete restrict,
  song_id            uuid references public.songs (id) on delete set null,
  genre_id           uuid references public.genres (id) on delete set null,
  title              text not null check (char_length(title) between 1 and 160),
  description        text,
  video_path         text,
  video_mime         text,
  video_size         bigint,
  thumbnail_path     text,
  duration           integer check (duration is null or duration >= 0),
  release_date       date,
  -- Future processing pipeline (transcoding, renditions, thumbnails) plugs in here.
  processing_status  text not null default 'awaiting_upload'
                     check (processing_status in ('awaiting_upload', 'uploaded', 'processing', 'ready', 'failed')),
  renditions         jsonb not null default '[]'::jsonb,
  status             text not null default 'draft'
                     check (status in ('draft', 'pending', 'approved', 'published', 'rejected')),
  is_published       boolean generated always as (status = 'published') stored,
  is_featured        boolean not null default false,
  published_at       timestamptz,
  view_count         bigint not null default 0,
  rejection_reason   text,
  submitted_at       timestamptz,
  reviewed_at        timestamptz,
  reviewed_by        uuid references public.users (id) on delete set null,
  created_by         uuid references public.users (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists music_videos_published_idx on public.music_videos (is_published, created_at desc);
create index if not exists music_videos_views_idx on public.music_videos (is_published, view_count desc);
create index if not exists music_videos_artist_idx on public.music_videos (artist_id);
create index if not exists music_videos_status_idx on public.music_videos (status, submitted_at);
create index if not exists music_videos_title_trgm_idx on public.music_videos using gin (title gin_trgm_ops);
drop trigger if exists music_videos_updated_at on public.music_videos;
create trigger music_videos_updated_at
  before update of title, description, artist_id, song_id, genre_id, video_path, thumbnail_path,
                   duration, release_date, status, is_featured, processing_status
  on public.music_videos for each row execute function public.set_updated_at();

create table if not exists public.video_subtitles (
  id          uuid primary key default gen_random_uuid(),
  video_id    uuid not null references public.music_videos (id) on delete cascade,
  language    text not null check (language ~ '^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$'),
  label       text not null check (char_length(label) between 1 and 40),
  file_path   text not null,
  format      text not null default 'vtt' check (format in ('vtt')),
  is_default  boolean not null default false,
  created_by  uuid references public.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (video_id, language)
);

create table if not exists public.video_views (
  id         bigint generated always as identity primary key,
  video_id   uuid not null references public.music_videos (id) on delete cascade,
  user_id    uuid references public.users (id) on delete set null,
  viewed_at  timestamptz not null default now()
);
create index if not exists video_views_video_time_idx on public.video_views (video_id, viewed_at desc);
create index if not exists video_views_time_idx on public.video_views (viewed_at);

-- ─── Site settings: lyrics provider, studio and video options ──────────────
alter table public.site_settings add column if not exists lyrics_enabled boolean not null default true;
alter table public.site_settings add column if not exists lyrics_mode text not null default 'manual';
alter table public.site_settings drop constraint if exists site_settings_lyrics_mode_check;
alter table public.site_settings add constraint site_settings_lyrics_mode_check check (lyrics_mode in ('manual', 'external', 'both'));
alter table public.site_settings add column if not exists lyrics_provider_name text;
alter table public.site_settings add column if not exists lyrics_api_url text;
alter table public.site_settings add column if not exists lyrics_api_key text;   -- never returned to clients
alter table public.site_settings add column if not exists lyrics_attribution text;
alter table public.site_settings add column if not exists videos_enabled boolean not null default true;
alter table public.site_settings add column if not exists max_video_mb integer not null default 500;
alter table public.site_settings add column if not exists subtitle_languages jsonb not null default
  '[{"code":"en","label":"English"},{"code":"fr","label":"French"},{"code":"es","label":"Spanish"},{"code":"pcm","label":"Pidgin"},{"code":"yo","label":"Yoruba"},{"code":"ig","label":"Igbo"}]'::jsonb;
alter table public.site_settings add column if not exists allow_artist_signup boolean not null default true;
alter table public.site_settings add column if not exists artist_auto_publish boolean not null default false;
alter table public.site_settings add column if not exists default_theme text not null default 'dark';
alter table public.site_settings drop constraint if exists site_settings_default_theme_check;
alter table public.site_settings add constraint site_settings_default_theme_check check (default_theme in ('light', 'dark', 'system'));
alter table public.site_settings add column if not exists email_new_releases boolean not null default true;

-- ─── Read models (recreated with v2 columns) ───────────────────────────────
drop view if exists public.songs_view cascade;
create view public.songs_view with (security_invoker = true) as
select
  s.id, s.title, s.description,
  s.artist_id, a.name::text as artist_name, a.owner_user_id as artist_owner_id,
  (a.verification_status = 'verified') as artist_verified,
  s.album_id, al.title as album_title,
  s.genre_id, g.name::text as genre_name, g.slug as genre_slug,
  coalesce(s.artwork_path, al.artwork_path, a.image_path) as artwork_path,
  s.artwork_path as own_artwork_path,
  s.audio_path, s.audio_mime, s.audio_size, s.duration, s.release_date, s.track_number,
  s.is_featured, s.is_published, s.status, s.published_at,
  s.submitted_at, s.reviewed_at, s.rejection_reason, s.created_by,
  s.play_count, s.download_count, s.created_at, s.updated_at,
  exists (select 1 from public.lyrics l
          where l.song_id = s.id and l.status = 'published' and l.is_visible) as has_lyrics
from public.songs s
join public.artists a on a.id = s.artist_id
left join public.albums al on al.id = s.album_id
left join public.genres g on g.id = s.genre_id;

drop view if exists public.artists_view cascade;
create view public.artists_view with (security_invoker = true) as
select
  a.id, a.name::text as name, a.bio, a.image_path, a.cover_path, a.location, a.social_links,
  a.owner_user_id, a.verification_status, (a.verification_status = 'verified') as is_verified,
  a.verification_message, a.verification_note, a.verification_requested_at, a.verified_at,
  a.follower_count, a.created_at, a.updated_at,
  count(s.id) filter (where s.is_published) as song_count,
  count(s.id) as total_song_count,
  coalesce(sum(s.play_count) filter (where s.is_published), 0)::bigint as total_plays,
  (select count(*) from public.albums al where al.artist_id = a.id) as album_count,
  (select count(*) from public.music_videos v where v.artist_id = a.id and v.is_published) as video_count
from public.artists a
left join public.songs s on s.artist_id = a.id
group by a.id;

drop view if exists public.albums_view cascade;
create view public.albums_view with (security_invoker = true) as
select
  al.id, al.title, al.artist_id, a.name::text as artist_name, a.owner_user_id as artist_owner_id,
  al.artwork_path, al.release_date, al.description, al.created_at, al.updated_at,
  count(s.id) filter (where s.is_published) as song_count,
  count(s.id) as total_song_count
from public.albums al
join public.artists a on a.id = al.artist_id
left join public.songs s on s.album_id = al.id
group by al.id, a.name, a.owner_user_id;

drop view if exists public.genres_view cascade;
create view public.genres_view with (security_invoker = true) as
select
  g.id, g.name::text as name, g.slug, g.description, g.created_at,
  count(s.id) filter (where s.is_published) as song_count,
  count(s.id) as total_song_count
from public.genres g
left join public.songs s on s.genre_id = g.id
group by g.id;

drop view if exists public.videos_view cascade;
create view public.videos_view with (security_invoker = true) as
select
  v.id, v.title, v.description, v.artist_id, a.name::text as artist_name, a.owner_user_id as artist_owner_id,
  (a.verification_status = 'verified') as artist_verified, a.image_path as artist_image_path,
  v.song_id, s.title as song_title, v.genre_id, g.name::text as genre_name, g.slug as genre_slug,
  v.video_path, v.video_mime, v.video_size, v.thumbnail_path, v.duration, v.release_date,
  v.processing_status, v.renditions, v.status, v.is_published, v.is_featured, v.published_at,
  v.view_count, v.rejection_reason, v.submitted_at, v.reviewed_at, v.created_by, v.created_at, v.updated_at,
  (select count(*) from public.video_subtitles vs where vs.video_id = v.id) as subtitle_count
from public.music_videos v
join public.artists a on a.id = v.artist_id
left join public.songs s on s.id = v.song_id
left join public.genres g on g.id = v.genre_id;

-- ─── Functions (recreated or new) ──────────────────────────────────────────
create or replace function public.trending_songs(p_days integer default 7, p_limit integer default 12)
returns setof public.songs_view language sql stable set search_path = public as $$
  select v.*
  from songs_view v
  left join (select song_id, count(*) as c from plays
             where played_at > now() - make_interval(days => p_days) group by song_id) p on p.song_id = v.id
  left join (select song_id, count(*) as c from downloads
             where downloaded_at > now() - make_interval(days => p_days) group by song_id) d on d.song_id = v.id
  where v.is_published
  order by coalesce(p.c, 0) + 2 * coalesce(d.c, 0) desc, v.play_count desc, v.created_at desc
  limit least(greatest(p_limit, 1), 50);
$$;

create or replace function public.trending_videos(p_days integer default 7, p_limit integer default 12)
returns setof public.videos_view language sql stable set search_path = public as $$
  select v.*
  from videos_view v
  left join (select video_id, count(*) as c from video_views
             where viewed_at > now() - make_interval(days => p_days) group by video_id) w on w.video_id = v.id
  where v.is_published
  order by coalesce(w.c, 0) desc, v.view_count desc, v.created_at desc
  limit least(greatest(p_limit, 1), 50);
$$;

create or replace function public.record_video_view(p_video_id uuid, p_user_id uuid default null)
returns boolean language plpgsql set search_path = public as $$
begin
  update music_videos set view_count = view_count + 1 where id = p_video_id and is_published;
  if not found then return false; end if;
  insert into video_views (video_id, user_id) values (p_video_id, p_user_id);
  return true;
end $$;

create or replace function public.admin_overview()
returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object(
    'totalSongs',        (select count(*) from songs),
    'publishedSongs',    (select count(*) from songs where is_published),
    'pendingReviews',    (select count(*) from songs where status = 'pending')
                         + (select count(*) from music_videos where status = 'pending')
                         + (select count(*) from lyrics where status = 'pending'),
    'pendingVerifications', (select count(*) from artists where verification_status = 'pending'),
    'totalUsers',        (select count(*) from users),
    'totalArtistsUsers', (select count(*) from users where role = 'artist'),
    'verifiedUsers',     (select count(*) from users where email_verified),
    'totalArtists',      (select count(*) from artists),
    'totalAlbums',       (select count(*) from albums),
    'totalGenres',       (select count(*) from genres),
    'totalPlaylists',    (select count(*) from playlists),
    'totalVideos',       (select count(*) from music_videos),
    'totalVideoViews',   (select coalesce(sum(view_count), 0) from music_videos),
    'totalPlays',        (select coalesce(sum(play_count), 0) from songs),
    'totalDownloads',    (select coalesce(sum(download_count), 0) from songs),
    'playsToday',        (select count(*) from plays where played_at >= date_trunc('day', now())),
    'downloadsToday',    (select count(*) from downloads where downloaded_at >= date_trunc('day', now())),
    'newUsersThisWeek',  (select count(*) from users where created_at >= now() - interval '7 days')
  );
$$;

-- Creator statistics are always scoped to artists the user owns.
create or replace function public.studio_overview(p_user_id uuid)
returns jsonb language sql stable set search_path = public as $$
  with mine as (select id from artists where owner_user_id = p_user_id)
  select jsonb_build_object(
    'artists',        (select count(*) from mine),
    'totalSongs',     (select count(*) from songs where artist_id in (select id from mine)),
    'publishedSongs', (select count(*) from songs where artist_id in (select id from mine) and is_published),
    'pendingSongs',   (select count(*) from songs where artist_id in (select id from mine) and status = 'pending'),
    'totalPlays',     (select coalesce(sum(play_count), 0) from songs where artist_id in (select id from mine)),
    'totalDownloads', (select coalesce(sum(download_count), 0) from songs where artist_id in (select id from mine)),
    'followers',      (select coalesce(sum(follower_count), 0) from artists where id in (select id from mine)),
    'totalAlbums',    (select count(*) from albums where artist_id in (select id from mine)),
    'totalVideos',    (select count(*) from music_videos where artist_id in (select id from mine)),
    'videoViews',     (select coalesce(sum(view_count), 0) from music_videos where artist_id in (select id from mine))
  );
$$;

create or replace function public.studio_daily_activity(p_user_id uuid, p_days integer default 30)
returns table (day date, plays bigint, downloads bigint, video_views bigint, new_followers bigint)
language sql stable set search_path = public as $$
  with mine as (select id from artists where owner_user_id = p_user_id),
       my_songs as (select id from songs where artist_id in (select id from mine)),
       my_videos as (select id from music_videos where artist_id in (select id from mine)),
       days as (select generate_series(current_date - (least(greatest(p_days, 1), 365) - 1), current_date, interval '1 day')::date as d)
  select d.d,
    (select count(*) from plays p where p.song_id in (select id from my_songs) and p.played_at >= d.d and p.played_at < d.d + 1),
    (select count(*) from downloads w where w.song_id in (select id from my_songs) and w.downloaded_at >= d.d and w.downloaded_at < d.d + 1),
    (select count(*) from video_views vv where vv.video_id in (select id from my_videos) and vv.viewed_at >= d.d and vv.viewed_at < d.d + 1),
    (select count(*) from artist_followers f where f.artist_id in (select id from mine) and f.created_at >= d.d and f.created_at < d.d + 1)
  from days d order by d.d;
$$;

create or replace function public.studio_top_songs(p_user_id uuid, p_days integer default 30, p_limit integer default 10)
returns table (song_id uuid, title text, artist_name text, plays bigint, downloads bigint)
language sql stable set search_path = public as $$
  select s.id, s.title, a.name::text,
    (select count(*) from plays p where p.song_id = s.id and p.played_at > now() - make_interval(days => p_days)),
    (select count(*) from downloads d where d.song_id = s.id and d.downloaded_at > now() - make_interval(days => p_days))
  from songs s join artists a on a.id = s.artist_id
  where a.owner_user_id = p_user_id
  order by 4 desc, 5 desc, s.title
  limit least(greatest(p_limit, 1), 50);
$$;

-- ─── Security ───────────────────────────────────────────────────────────────
alter table public.connected_accounts enable row level security;
alter table public.user_settings      enable row level security;
alter table public.notifications      enable row level security;
alter table public.artist_followers   enable row level security;
alter table public.lyrics             enable row level security;
alter table public.lyric_lines        enable row level security;
alter table public.music_videos       enable row level security;
alter table public.video_subtitles    enable row level security;
alter table public.video_views        enable row level security;

revoke all on all tables in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- Ask PostgREST to pick up the new columns, tables and functions immediately.
notify pgrst, 'reload schema';
