import { supabase } from '../config/supabase.js';
import { dbError, one, unwrap } from '../utils/db.js';
import { ok, pageMeta, pageRange } from '../utils/http.js';
import { cleanSearchTerm, ilikeAny } from '../utils/search.js';
import { SONG_FIELDS, toAlbum, toArtist, toGenre, toPlaylist, toSong } from '../services/mappers.js';
import { getSettings, toPublicSettings } from '../services/settings.service.js';

const ARTIST_FIELDS = 'id,name,bio,image_path,song_count,album_count,total_plays,created_at';
const ALBUM_FIELDS = 'id,title,artist_id,artist_name,artwork_path,release_date,description,song_count,created_at';
const PLAYLIST_FIELDS = 'id,user_id,owner_name,name,description,artwork_path,own_artwork_path,is_public,is_featured,song_count,created_at,updated_at';

// ─── Settings ──────────────────────────────────────────────────────────────
export async function publicSettings(req, res) {
  res.set('Cache-Control', 'public, max-age=60');
  ok(res, toPublicSettings(await getSettings()));
}

// ─── Home (one round-trip for the whole landing page) ─────────────────────
export async function home(req, res) {
  const settings = await getSettings();
  const published = () => supabase.from('songs_view').select(SONG_FIELDS).eq('is_published', true);

  const [featured, latest, recent, trending, artists, genres, playlists] = await Promise.all([
    published().eq('is_featured', true).order('created_at', { ascending: false }).limit(settings.featured_limit),
    published().order('release_date', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }).limit(12),
    published().order('created_at', { ascending: false }).limit(12),
    supabase.rpc('trending_songs', { p_days: 7, p_limit: 10 }).select(SONG_FIELDS),
    supabase.rpc('popular_artists', { p_limit: 12 }),
    supabase.from('genres_view').select('*').gt('song_count', 0).order('song_count', { ascending: false }),
    supabase.from('playlists_view').select(PLAYLIST_FIELDS).eq('is_featured', true).eq('is_public', true).gt('song_count', 0).order('updated_at', { ascending: false }).limit(10),
  ]);

  res.set('Cache-Control', 'public, max-age=30');
  ok(res, {
    featured: unwrap(featured).map((r) => toSong(r)),
    latest: unwrap(latest).map((r) => toSong(r)),
    recentlyAdded: unwrap(recent).map((r) => toSong(r)),
    trending: unwrap(trending).map((r) => toSong(r)),
    popularArtists: unwrap(artists).map((r) => toArtist(r)),
    genres: unwrap(genres).map(toGenre),
    featuredPlaylists: unwrap(playlists).map(toPlaylist),
  });
}

// ─── Search ────────────────────────────────────────────────────────────────
export async function search(req, res) {
  const { q, limit } = req.valid.query;
  const term = cleanSearchTerm(q);
  if (!term) return ok(res, { songs: [], artists: [], albums: [], genres: [] });

  const [songs, artists, albums, genres] = await Promise.all([
    supabase
      .from('songs_view')
      .select(SONG_FIELDS)
      .eq('is_published', true)
      .or(ilikeAny(['title', 'artist_name', 'album_title', 'genre_name'], term))
      .order('play_count', { ascending: false })
      .limit(limit),
    supabase.from('artists_view').select(ARTIST_FIELDS).gt('song_count', 0).ilike('name', `%${term}%`).order('total_plays', { ascending: false }).limit(8),
    supabase.from('albums_view').select(ALBUM_FIELDS).gt('song_count', 0).or(ilikeAny(['title', 'artist_name'], term)).limit(8),
    supabase.from('genres_view').select('*').ilike('name', `%${term}%`).limit(6),
  ]);

  const result = {
    songs: unwrap(songs).map((r) => toSong(r)),
    artists: unwrap(artists).map(toArtist),
    albums: unwrap(albums).map(toAlbum),
    genres: unwrap(genres).map(toGenre),
  };

  // Anonymous search analytics — failures must never break search.
  const total = result.songs.length + result.artists.length + result.albums.length;
  if (term.length >= 2) {
    supabase
      .from('search_logs')
      .insert({ query: term.toLowerCase(), result_count: total })
      .then(({ error }) => error && console.error('[search] log failed:', error.message));
  }

  ok(res, result);
}

// ─── Artists ───────────────────────────────────────────────────────────────
export async function listArtists(req, res) {
  const { q, sort, page, limit } = req.valid.query;
  let query = supabase.from('artists_view').select(ARTIST_FIELDS, { count: 'exact' }).gt('song_count', 0);
  const term = cleanSearchTerm(q);
  if (term) query = query.ilike('name', `%${term}%`);
  query =
    sort === 'popular'
      ? query.order('total_plays', { ascending: false })
      : sort === 'latest'
        ? query.order('created_at', { ascending: false })
        : query.order('name');
  const { from, to } = pageRange({ page, limit });
  const { data, count, error } = await query.order('id').range(from, to);
  if (error) throw dbError(error);
  ok(res, data.map(toArtist), pageMeta({ page, limit }, count));
}

export async function getArtist(req, res) {
  const { id } = req.valid.params;
  const artist = await one(supabase.from('artists_view').select(ARTIST_FIELDS).eq('id', id).gt('song_count', 0), 'Artist not found.');
  const [songs, albums] = await Promise.all([
    supabase.from('songs_view').select(SONG_FIELDS).eq('artist_id', id).eq('is_published', true).order('play_count', { ascending: false }).limit(100),
    supabase.from('albums_view').select(ALBUM_FIELDS).eq('artist_id', id).gt('song_count', 0).order('release_date', { ascending: false, nullsFirst: false }),
  ]);
  ok(res, { ...toArtist(artist), songs: unwrap(songs).map((r) => toSong(r)), albums: unwrap(albums).map(toAlbum) });
}

// ─── Albums ────────────────────────────────────────────────────────────────
export async function listAlbums(req, res) {
  const { q, artist, sort, page, limit } = req.valid.query;
  let query = supabase.from('albums_view').select(ALBUM_FIELDS, { count: 'exact' }).gt('song_count', 0);
  const term = cleanSearchTerm(q);
  if (term) query = query.or(ilikeAny(['title', 'artist_name'], term));
  if (artist) query = query.eq('artist_id', artist);
  query =
    sort === 'name'
      ? query.order('title')
      : query.order('release_date', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false });
  const { from, to } = pageRange({ page, limit });
  const { data, count, error } = await query.order('id').range(from, to);
  if (error) throw dbError(error);
  ok(res, data.map(toAlbum), pageMeta({ page, limit }, count));
}

export async function getAlbum(req, res) {
  const { id } = req.valid.params;
  const album = await one(supabase.from('albums_view').select(ALBUM_FIELDS).eq('id', id).gt('song_count', 0), 'Album not found.');
  const songs = unwrap(
    await supabase
      .from('songs_view')
      .select(SONG_FIELDS)
      .eq('album_id', id)
      .eq('is_published', true)
      .order('track_number', { ascending: true, nullsFirst: false })
      .order('created_at')
  );
  ok(res, { ...toAlbum(album), songs: songs.map((r) => toSong(r)) });
}

// ─── Genres ────────────────────────────────────────────────────────────────
export async function listGenres(req, res) {
  const rows = unwrap(await supabase.from('genres_view').select('*').order('name'));
  res.set('Cache-Control', 'public, max-age=60');
  ok(res, rows.map(toGenre));
}

export async function getGenre(req, res) {
  const genre = await one(supabase.from('genres_view').select('*').eq('slug', req.params.slug), 'Genre not found.');
  ok(res, toGenre(genre));
}

// ─── Public / featured playlists ──────────────────────────────────────────
export async function featuredPlaylists(req, res) {
  const rows = unwrap(
    await supabase.from('playlists_view').select(PLAYLIST_FIELDS).eq('is_featured', true).eq('is_public', true).order('updated_at', { ascending: false }).limit(30)
  );
  ok(res, rows.map(toPlaylist));
}

export { PLAYLIST_FIELDS };
