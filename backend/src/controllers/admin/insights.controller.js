import { supabase } from '../../config/supabase.js';
import { dbError, orderByIds, unwrap } from '../../utils/db.js';
import { ok, pageMeta, pageRange } from '../../utils/http.js';
import { toCsv } from '../../utils/csv.js';
import { SONG_ADMIN_FIELDS, toSong } from '../../services/mappers.js';

export async function overview(req, res) {
  const songs = () => supabase.from('songs_view').select(SONG_ADMIN_FIELDS);
  const [totals, recent, mostDownloaded, mostPlayed, activity] = await Promise.all([
    supabase.rpc('admin_overview'),
    songs().order('created_at', { ascending: false }).limit(6),
    songs().gt('download_count', 0).order('download_count', { ascending: false }).limit(6),
    songs().gt('play_count', 0).order('play_count', { ascending: false }).limit(6),
    supabase.rpc('daily_activity', { p_days: 14 }),
  ]);
  const admin = (r) => toSong(r, { admin: true });
  ok(res, {
    totals: unwrap(totals),
    recentSongs: unwrap(recent).map(admin),
    mostDownloaded: unwrap(mostDownloaded).map(admin),
    mostPlayed: unwrap(mostPlayed).map(admin),
    activity: unwrap(activity),
  });
}

export async function analytics(req, res) {
  const { days } = req.valid.query;
  const [daily, topPlayed, topDownloaded, topArtists, topSearches] = await Promise.all([
    supabase.rpc('daily_activity', { p_days: days }),
    supabase.rpc('top_songs_period', { p_days: days, p_metric: 'plays', p_limit: 10 }),
    supabase.rpc('top_songs_period', { p_days: days, p_metric: 'downloads', p_limit: 10 }),
    supabase.rpc('top_artists_period', { p_days: days, p_limit: 10 }),
    supabase.rpc('top_searches', { p_days: days, p_limit: 15 }),
  ]);
  const series = unwrap(daily);
  const sum = (key) => series.reduce((acc, d) => acc + Number(d[key] || 0), 0);
  ok(res, {
    days,
    totals: { plays: sum('plays'), downloads: sum('downloads'), registrations: sum('registrations'), searches: sum('searches') },
    daily: series,
    topPlayed: unwrap(topPlayed),
    topDownloaded: unwrap(topDownloaded),
    topArtists: unwrap(topArtists),
    topSearches: unwrap(topSearches),
  });
}

/** Download log with song and (if signed in) user details. */
export async function downloads(req, res) {
  const { song, page, limit } = req.valid.query;
  let query = supabase.from('downloads').select('id,song_id,user_id,downloaded_at', { count: 'exact' });
  if (song) query = query.eq('song_id', song);
  const { from, to } = pageRange({ page, limit });
  const { data, count, error } = await query.order('downloaded_at', { ascending: false }).range(from, to);
  if (error) throw dbError(error);

  const songIds = [...new Set(data.map((d) => d.song_id))];
  const userIds = [...new Set(data.map((d) => d.user_id).filter(Boolean))];
  const [songs, users] = await Promise.all([
    songIds.length ? supabase.from('songs_view').select('id,title,artist_name').in('id', songIds) : { data: [] },
    userIds.length ? supabase.from('users').select('id,name,email').in('id', userIds) : { data: [] },
  ]);
  const songMap = new Map(unwrap(songs).map((s) => [s.id, s]));
  const userMap = new Map(unwrap(users).map((u) => [u.id, u]));

  ok(
    res,
    data.map((d) => ({
      id: d.id,
      downloadedAt: d.downloaded_at,
      song: songMap.has(d.song_id) ? { id: d.song_id, title: songMap.get(d.song_id).title, artist: songMap.get(d.song_id).artist_name } : null,
      user: d.user_id && userMap.has(d.user_id) ? userMap.get(d.user_id) : null,
    })),
    pageMeta({ page, limit }, count)
  );
}

// ─── CSV reports ──────────────────────────────────────────────────────────
/** Page through a query so reports are not silently truncated at PostgREST's row limit. */
async function fetchAll(build, pageSize = 1000, max = 100_000) {
  const rows = [];
  for (let from = 0; from < max; from += pageSize) {
    const batch = unwrap(await build().range(from, from + pageSize - 1));
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }
  return rows;
}

const REPORTS = {
  songs: async () => ({
    columns: [
      { label: 'Title', value: (r) => r.title },
      { label: 'Artist', value: (r) => r.artist_name },
      { label: 'Album', value: (r) => r.album_title },
      { label: 'Genre', value: (r) => r.genre_name },
      { label: 'Published', value: (r) => (r.is_published ? 'yes' : 'no') },
      { label: 'Featured', value: (r) => (r.is_featured ? 'yes' : 'no') },
      { label: 'Plays', value: (r) => r.play_count },
      { label: 'Downloads', value: (r) => r.download_count },
      { label: 'Duration (s)', value: (r) => r.duration },
      { label: 'Release date', value: (r) => r.release_date },
      { label: 'Uploaded at', value: (r) => r.created_at },
    ],
    rows: await fetchAll(() => supabase.from('songs_view').select('*').order('created_at', { ascending: false })),
  }),
  artists: async () => ({
    columns: [
      { label: 'Artist', value: (r) => r.name },
      { label: 'Published songs', value: (r) => r.song_count },
      { label: 'Albums', value: (r) => r.album_count },
      { label: 'Total plays', value: (r) => r.total_plays },
      { label: 'Created at', value: (r) => r.created_at },
    ],
    rows: await fetchAll(() => supabase.from('artists_view').select('*').order('name')),
  }),
  users: async () => ({
    columns: [
      { label: 'Name', value: (r) => r.name },
      { label: 'Email', value: (r) => r.email },
      { label: 'Role', value: (r) => r.role },
      { label: 'Status', value: (r) => r.status },
      { label: 'Email verified', value: (r) => (r.email_verified ? 'yes' : 'no') },
      { label: 'Last login', value: (r) => r.last_login_at },
      { label: 'Registered at', value: (r) => r.created_at },
    ],
    rows: await fetchAll(() => supabase.from('users').select('name,email,role,status,email_verified,last_login_at,created_at').order('created_at', { ascending: false })),
  }),
  downloads: async (days) => {
    const since = new Date(Date.now() - days * 86_400_000).toISOString();
    const rows = await fetchAll(() =>
      supabase.from('downloads').select('song_id,user_id,downloaded_at').gte('downloaded_at', since).order('downloaded_at', { ascending: false })
    );
    const songIds = [...new Set(rows.map((r) => r.song_id))];
    const songs = songIds.length ? orderByIds(unwrap(await supabase.from('songs_view').select('id,title,artist_name').in('id', songIds)), songIds) : [];
    const songMap = new Map(songs.map((s) => [s.id, s]));
    return {
      columns: [
        { label: 'Downloaded at', value: (r) => r.downloaded_at },
        { label: 'Song', value: (r) => songMap.get(r.song_id)?.title },
        { label: 'Artist', value: (r) => songMap.get(r.song_id)?.artist_name },
        { label: 'Signed-in user', value: (r) => (r.user_id ? 'yes' : 'no') },
      ],
      rows,
    };
  },
  'daily-activity': async (days) => ({
    columns: [
      { label: 'Date', value: (r) => r.day },
      { label: 'Plays', value: (r) => r.plays },
      { label: 'Downloads', value: (r) => r.downloads },
      { label: 'Registrations', value: (r) => r.registrations },
      { label: 'Searches', value: (r) => r.searches },
    ],
    rows: unwrap(await supabase.rpc('daily_activity', { p_days: days })),
  }),
};

export async function report(req, res) {
  const { type } = req.valid.params;
  const { days } = req.valid.query;
  const { columns, rows } = await REPORTS[type](days);
  const stamp = new Date().toISOString().slice(0, 10);
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="shere-music-${type}-${stamp}.csv"`);
  res.set('Cache-Control', 'no-store');
  res.send(`﻿${toCsv(columns, rows)}`);
}
