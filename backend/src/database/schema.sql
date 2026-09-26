-- ═══════════════════════════════════════════════════════════════════════════
-- SHERE MUSIC — database schema (Supabase PostgreSQL)
--
-- Run this whole file once in the Supabase SQL editor (or with psql).
-- It is idempotent: re-running it will not drop data.
--
-- Access model: the Express API is the only client. It connects with the
-- service-role key, which bypasses RLS. RLS is enabled on every table with no
-- policies, so the public anon/authenticated keys cannot read or write anything
-- directly, even if they leak.
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;
create extension if not exists citext;
create extension if not exists pg_trgm;

-- ─── Helpers ────────────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ─── Users ──────────────────────────────────────────────────────────────────
create table if not exists public.users (
  id              uuid primary key default gen_random_uuid(),
  name            text not null check (char_length(name) between 1 and 80),
  email           citext not null unique,
  password_hash   text not null,
  role            text not null default 'user' check (role in ('user', 'admin')),
  avatar_path     text,
  email_verified  boolean not null default false,
  status          text not null default 'active' check (status in ('active', 'disabled')),
  token_version   integer not null default 0,
  last_login_at   timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists users_created_at_idx on public.users (created_at desc);
create index if not exists users_role_idx on public.users (role);
create index if not exists users_name_trgm_idx on public.users using gin (name gin_trgm_ops);
drop trigger if exists users_updated_at on public.users;
create trigger users_updated_at before update on public.users
  for each row execute function public.set_updated_at();

-- One-time tokens for email verification and password reset (only hashes are stored)
create table if not exists public.auth_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users (id) on delete cascade,
  type        text not null check (type in ('verify_email', 'reset_password')),
  token_hash  text not null unique,
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists auth_tokens_user_type_idx on public.auth_tokens (user_id, type);

-- ─── Catalog ────────────────────────────────────────────────────────────────
create table if not exists public.artists (
  id          uuid primary key default gen_random_uuid(),
  name        citext not null unique check (char_length(name::text) between 1 and 120),
  bio         text,
  image_path  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists artists_name_trgm_idx on public.artists using gin ((name::text) gin_trgm_ops);
drop trigger if exists artists_updated_at on public.artists;
create trigger artists_updated_at before update on public.artists
  for each row execute function public.set_updated_at();

create table if not exists public.albums (
  id            uuid primary key default gen_random_uuid(),
  title         text not null check (char_length(title) between 1 and 160),
  artist_id     uuid not null references public.artists (id) on delete restrict,
  artwork_path  text,
  release_date  date,
  description   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (artist_id, title)
);
create index if not exists albums_artist_idx on public.albums (artist_id);
create index if not exists albums_release_idx on public.albums (release_date desc nulls last);
create index if not exists albums_title_trgm_idx on public.albums using gin (title gin_trgm_ops);
drop trigger if exists albums_updated_at on public.albums;
create trigger albums_updated_at before update on public.albums
  for each row execute function public.set_updated_at();

create table if not exists public.genres (
  id           uuid primary key default gen_random_uuid(),
  name         citext not null unique check (char_length(name::text) between 1 and 60),
  slug         text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description  text,
  created_at   timestamptz not null default now()
);

create table if not exists public.songs (
  id              uuid primary key default gen_random_uuid(),
  title           text not null check (char_length(title) between 1 and 160),
  artist_id       uuid not null references public.artists (id) on delete restrict,
  album_id        uuid references public.albums (id) on delete set null,
  genre_id        uuid references public.genres (id) on delete set null,
  description     text,
  audio_path      text not null,
  audio_mime      text not null,
  audio_size      bigint not null check (audio_size > 0),
  artwork_path    text,
  duration        integer check (duration is null or duration >= 0),
  release_date    date,
  track_number    integer check (track_number is null or track_number > 0),
  is_featured     boolean not null default false,
  is_published    boolean not null default false,
  published_at    timestamptz,
  play_count      bigint not null default 0,
  download_count  bigint not null default 0,
  created_by      uuid references public.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists songs_published_created_idx on public.songs (is_published, created_at desc);
create index if not exists songs_published_release_idx on public.songs (is_published, release_date desc nulls last);
create index if not exists songs_published_plays_idx on public.songs (is_published, play_count desc);
create index if not exists songs_published_downloads_idx on public.songs (is_published, download_count desc);
create index if not exists songs_featured_idx on public.songs (created_at desc) where is_featured and is_published;
create index if not exists songs_artist_idx on public.songs (artist_id);
create index if not exists songs_album_idx on public.songs (album_id);
create index if not exists songs_genre_idx on public.songs (genre_id);
create index if not exists songs_title_trgm_idx on public.songs using gin (title gin_trgm_ops);
-- updated_at only tracks editorial changes, not play/download counters
drop trigger if exists songs_updated_at on public.songs;
create trigger songs_updated_at
  before update of title, artist_id, album_id, genre_id, description, audio_path, artwork_path,
                   duration, release_date, track_number, is_featured, is_published
  on public.songs for each row execute function public.set_updated_at();

-- ─── Library ────────────────────────────────────────────────────────────────
create table if not exists public.favorites (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users (id) on delete cascade,
  song_id     uuid not null references public.songs (id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (user_id, song_id)
);
create index if not exists favorites_user_created_idx on public.favorites (user_id, created_at desc);
create index if not exists favorites_song_idx on public.favorites (song_id);

create table if not exists public.playlists (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users (id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 100),
  description   text,
  artwork_path  text,
  is_public     boolean not null default false,
  is_featured   boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists playlists_user_idx on public.playlists (user_id, updated_at desc);
create index if not exists playlists_featured_idx on public.playlists (updated_at desc) where is_featured and is_public;
drop trigger if exists playlists_updated_at on public.playlists;
create trigger playlists_updated_at before update on public.playlists
  for each row execute function public.set_updated_at();

create table if not exists public.playlist_songs (
  id           uuid primary key default gen_random_uuid(),
  playlist_id  uuid not null references public.playlists (id) on delete cascade,
  song_id      uuid not null references public.songs (id) on delete cascade,
  position     integer not null default 0,
  created_at   timestamptz not null default now(),
  unique (playlist_id, song_id)
);
create index if not exists playlist_songs_order_idx on public.playlist_songs (playlist_id, position);
create index if not exists playlist_songs_song_idx on public.playlist_songs (song_id);

-- ─── Activity (no IP addresses or user agents are stored) ──────────────────
create table if not exists public.plays (
  id         bigint generated always as identity primary key,
  user_id    uuid references public.users (id) on delete set null,
  song_id    uuid not null references public.songs (id) on delete cascade,
  played_at  timestamptz not null default now()
);
create index if not exists plays_song_time_idx on public.plays (song_id, played_at desc);
create index if not exists plays_time_idx on public.plays (played_at);
create index if not exists plays_user_time_idx on public.plays (user_id, played_at desc) where user_id is not null;

create table if not exists public.downloads (
  id             bigint generated always as identity primary key,
  user_id        uuid references public.users (id) on delete set null,
  song_id        uuid not null references public.songs (id) on delete cascade,
  downloaded_at  timestamptz not null default now()
);
create index if not exists downloads_song_time_idx on public.downloads (song_id, downloaded_at desc);
create index if not exists downloads_time_idx on public.downloads (downloaded_at desc);
create index if not exists downloads_user_time_idx on public.downloads (user_id, downloaded_at desc) where user_id is not null;

-- Anonymous search analytics (the query text only, never who searched)
create table if not exists public.search_logs (
  id            bigint generated always as identity primary key,
  query         text not null check (char_length(query) between 1 and 100),
  result_count  integer not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists search_logs_time_idx on public.search_logs (created_at desc);

-- ─── Site settings (single row) ────────────────────────────────────────────
create table if not exists public.site_settings (
  id                   smallint primary key default 1 check (id = 1),
  site_name            text not null default 'SHERE MUSIC',
  site_description     text not null default 'Discover music. Stream music. Download music.',
  logo_path            text,
  favicon_path         text,
  contact_email        text,
  social_links         jsonb not null default '{}'::jsonb,
  max_audio_mb         integer not null default 50 check (max_audio_mb between 1 and 2048),
  max_image_mb         integer not null default 5 check (max_image_mb between 1 and 100),
  allow_registration   boolean not null default true,
  maintenance_mode     boolean not null default false,
  maintenance_message  text,
  featured_limit       integer not null default 10 check (featured_limit between 1 and 50),
  updated_at           timestamptz not null default now()
);
insert into public.site_settings (id) values (1) on conflict (id) do nothing;
drop trigger if exists site_settings_updated_at on public.site_settings;
create trigger site_settings_updated_at before update on public.site_settings
  for each row execute function public.set_updated_at();

-- ─── Read models ────────────────────────────────────────────────────────────
create or replace view public.songs_view with (security_invoker = true) as
select
  s.id, s.title, s.description,
  s.artist_id, a.name::text as artist_name,
  s.album_id, al.title as album_title,
  s.genre_id, g.name::text as genre_name, g.slug as genre_slug,
  coalesce(s.artwork_path, al.artwork_path, a.image_path) as artwork_path,
  s.artwork_path as own_artwork_path,
  s.audio_path, s.audio_mime, s.audio_size, s.duration, s.release_date, s.track_number,
  s.is_featured, s.is_published, s.published_at,
  s.play_count, s.download_count, s.created_at, s.updated_at
from public.songs s
join public.artists a on a.id = s.artist_id
left join public.albums al on al.id = s.album_id
left join public.genres g on g.id = s.genre_id;

create or replace view public.artists_view with (security_invoker = true) as
select
  a.id, a.name::text as name, a.bio, a.image_path, a.created_at, a.updated_at,
  count(s.id) filter (where s.is_published) as song_count,
  count(s.id) as total_song_count,
  coalesce(sum(s.play_count) filter (where s.is_published), 0)::bigint as total_plays,
  (select count(*) from public.albums al where al.artist_id = a.id) as album_count
from public.artists a
left join public.songs s on s.artist_id = a.id
group by a.id;

create or replace view public.albums_view with (security_invoker = true) as
select
  al.id, al.title, al.artist_id, a.name::text as artist_name, al.artwork_path,
  al.release_date, al.description, al.created_at, al.updated_at,
  count(s.id) filter (where s.is_published) as song_count,
  count(s.id) as total_song_count
from public.albums al
join public.artists a on a.id = al.artist_id
left join public.songs s on s.album_id = al.id
group by al.id, a.name;

create or replace view public.genres_view with (security_invoker = true) as
select
  g.id, g.name::text as name, g.slug, g.description, g.created_at,
  count(s.id) filter (where s.is_published) as song_count,
  count(s.id) as total_song_count
from public.genres g
left join public.songs s on s.genre_id = g.id
group by g.id;

create or replace view public.playlists_view with (security_invoker = true) as
select
  p.id, p.user_id, u.name as owner_name, p.name, p.description, p.is_public, p.is_featured,
  coalesce(p.artwork_path, (
    select coalesce(s.artwork_path, al.artwork_path)
    from public.playlist_songs ps
    join public.songs s on s.id = ps.song_id
    left join public.albums al on al.id = s.album_id
    where ps.playlist_id = p.id and coalesce(s.artwork_path, al.artwork_path) is not null
    order by ps.position, ps.created_at
    limit 1
  )) as artwork_path,
  p.artwork_path as own_artwork_path,
  (select count(*) from public.playlist_songs ps where ps.playlist_id = p.id) as song_count,
  p.created_at, p.updated_at
from public.playlists p
join public.users u on u.id = p.user_id;

-- ─── Functions ──────────────────────────────────────────────────────────────
-- Atomically count a play for a published song. Returns false if the song is not playable.
create or replace function public.record_play(p_song_id uuid, p_user_id uuid default null)
returns boolean language plpgsql set search_path = public as $$
begin
  update songs set play_count = play_count + 1 where id = p_song_id and is_published;
  if not found then return false; end if;
  insert into plays (song_id, user_id) values (p_song_id, p_user_id);
  return true;
end $$;

create or replace function public.record_download(p_song_id uuid, p_user_id uuid default null)
returns boolean language plpgsql set search_path = public as $$
begin
  update songs set download_count = download_count + 1 where id = p_song_id and is_published;
  if not found then return false; end if;
  insert into downloads (song_id, user_id) values (p_song_id, p_user_id);
  return true;
end $$;

-- Songs ranked by recent activity (plays + weighted downloads within p_days)
create or replace function public.trending_songs(p_days integer default 7, p_limit integer default 12)
returns setof public.songs_view language sql stable set search_path = public as $$
  select v.*
  from songs_view v
  left join (
    select song_id, count(*) as c from plays
    where played_at > now() - make_interval(days => p_days) group by song_id
  ) p on p.song_id = v.id
  left join (
    select song_id, count(*) as c from downloads
    where downloaded_at > now() - make_interval(days => p_days) group by song_id
  ) d on d.song_id = v.id
  where v.is_published
  order by coalesce(p.c, 0) + 2 * coalesce(d.c, 0) desc, v.play_count desc, v.created_at desc
  limit least(greatest(p_limit, 1), 50);
$$;

create or replace function public.popular_artists(p_limit integer default 12)
returns table (id uuid, name text, image_path text, song_count bigint, score bigint)
language sql stable set search_path = public as $$
  select a.id, a.name::text, a.image_path, count(s.id), coalesce(sum(s.play_count + s.download_count), 0)::bigint
  from artists a
  join songs s on s.artist_id = a.id and s.is_published
  group by a.id
  order by 5 desc, 4 desc, a.name
  limit least(greatest(p_limit, 1), 50);
$$;

create or replace function public.admin_overview()
returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object(
    'totalSongs',        (select count(*) from songs),
    'publishedSongs',    (select count(*) from songs where is_published),
    'totalUsers',        (select count(*) from users),
    'verifiedUsers',     (select count(*) from users where email_verified),
    'totalArtists',      (select count(*) from artists),
    'totalAlbums',       (select count(*) from albums),
    'totalGenres',       (select count(*) from genres),
    'totalPlaylists',    (select count(*) from playlists),
    'totalPlays',        (select coalesce(sum(play_count), 0) from songs),
    'totalDownloads',    (select coalesce(sum(download_count), 0) from songs),
    'playsToday',        (select count(*) from plays where played_at >= date_trunc('day', now())),
    'downloadsToday',    (select count(*) from downloads where downloaded_at >= date_trunc('day', now())),
    'newUsersThisWeek',  (select count(*) from users where created_at >= now() - interval '7 days')
  );
$$;

create or replace function public.daily_activity(p_days integer default 30)
returns table (day date, plays bigint, downloads bigint, registrations bigint, searches bigint)
language sql stable set search_path = public as $$
  with days as (
    select generate_series(current_date - (least(greatest(p_days, 1), 365) - 1), current_date, interval '1 day')::date as d
  )
  select
    d.d,
    (select count(*) from plays       where played_at     >= d.d and played_at     < d.d + 1),
    (select count(*) from downloads   where downloaded_at >= d.d and downloaded_at < d.d + 1),
    (select count(*) from users       where created_at    >= d.d and created_at    < d.d + 1),
    (select count(*) from search_logs where created_at    >= d.d and created_at    < d.d + 1)
  from days d
  order by d.d;
$$;

create or replace function public.top_songs_period(p_days integer default 30, p_metric text default 'plays', p_limit integer default 10)
returns table (song_id uuid, title text, artist_name text, total bigint)
language plpgsql stable set search_path = public as $$
begin
  if p_metric = 'downloads' then
    return query
      select s.id, s.title, a.name::text, count(*)::bigint
      from downloads d join songs s on s.id = d.song_id join artists a on a.id = s.artist_id
      where d.downloaded_at > now() - make_interval(days => p_days)
      group by s.id, s.title, a.name
      order by 4 desc limit least(greatest(p_limit, 1), 100);
  else
    return query
      select s.id, s.title, a.name::text, count(*)::bigint
      from plays p join songs s on s.id = p.song_id join artists a on a.id = s.artist_id
      where p.played_at > now() - make_interval(days => p_days)
      group by s.id, s.title, a.name
      order by 4 desc limit least(greatest(p_limit, 1), 100);
  end if;
end $$;

create or replace function public.top_artists_period(p_days integer default 30, p_limit integer default 10)
returns table (artist_id uuid, name text, plays bigint, downloads bigint)
language sql stable set search_path = public as $$
  select t.id, t.name, t.plays, t.downloads
  from (
    select a.id, a.name::text as name,
      (select count(*) from plays p join songs s on s.id = p.song_id
        where s.artist_id = a.id and p.played_at > now() - make_interval(days => p_days)) as plays,
      (select count(*) from downloads d join songs s on s.id = d.song_id
        where s.artist_id = a.id and d.downloaded_at > now() - make_interval(days => p_days)) as downloads
    from artists a
  ) t
  where t.plays + t.downloads > 0
  order by t.plays + t.downloads desc, t.name
  limit least(greatest(p_limit, 1), 100);
$$;

create or replace function public.top_searches(p_days integer default 30, p_limit integer default 15)
returns table (query text, searches bigint, avg_results numeric)
language sql stable set search_path = public as $$
  select query, count(*), round(avg(result_count), 1)
  from search_logs
  where created_at > now() - make_interval(days => p_days)
  group by query
  order by 2 desc, 1
  limit least(greatest(p_limit, 1), 100);
$$;

-- ─── Security: RLS on, no policies → only the service role can access ───────
alter table public.users          enable row level security;
alter table public.auth_tokens    enable row level security;
alter table public.artists        enable row level security;
alter table public.albums         enable row level security;
alter table public.genres         enable row level security;
alter table public.songs          enable row level security;
alter table public.favorites      enable row level security;
alter table public.playlists      enable row level security;
alter table public.playlist_songs enable row level security;
alter table public.plays          enable row level security;
alter table public.downloads      enable row level security;
alter table public.search_logs    enable row level security;
alter table public.site_settings  enable row level security;

revoke all on all tables in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;
