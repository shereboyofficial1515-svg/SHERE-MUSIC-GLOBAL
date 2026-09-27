import { supabase } from '../config/supabase.js';
import { dbError, one, unwrap } from '../utils/db.js';
import { notFound } from '../utils/AppError.js';
import { ok, pageMeta, pageRange } from '../utils/http.js';
import { cleanSearchTerm, ilikeAny } from '../utils/search.js';
import { SONG_FIELDS, VIDEO_FIELDS, toAlbum, toArtist, toGenre, toPlaylist, toSong, toVideo } from '../services/mappers.js';
import { getSettings, toPublicSettings } from '../services/settings.service.js';
import { getUserSettingsRow } from '../services/userSettings.service.js';
import { publishedSongsByIds } from '../services/song.service.js';

const ARTIST_FIELDS =
  'id,name,bio,image_path,cover_path,location,social_links,verification_status,follower_count,owner_user_id,song_count,album_count,video_count,total_plays,created_at';
/** Artists with anything public to show. */
const HAS_CONTENT = 'song_count.gt.0,video_count.gt.0';
const ALBUM_FIELDS = 'id,title,artist_id,artist_name,artwork_path,release_date,description,song_count,created_at';
const PLAYLIST_FIELDS = 'id,user_id,owner_name,name,description,artwork_path,own_artwork_path,is_public,is_featured,song_count,created_at,updated_at';

// ─── Settings ──────────────────────────────────────────────────────────────
export async function publicSettings(req, res) {
  res.set('Cache-Control', 'public, max-age=60');
  ok(res, toPublicSettings(await getSettings()));
}

// ─── Home (one round-trip for the whole landing page) ─────────────────────
const publishedSongs = () => supabase.from('songs_view').select(SONG_FIELDS).eq('is_published', true);

/**
 * Personal sections for a signed-in listener. Uses only their own listening
 * history, favorites and chosen genres, and is skipped entirely when they
 * turned personalised recommendations off.
 */
async function personalSections(user) {
  const settings = await getUserSettingsRow(user.id);
  const personalised = settings.privacy_preferences.personalizedRecommendations !== false;

  const [plays, playlists, favorites, follows] = await Promise.all([
    supabase.from('plays').select('song_id,played_at').eq('user_id', user.id).order('played_at', { ascending: false }).limit(100),
    supabase.from('playlists_view').select(PLAYLIST_FIELDS).eq('user_id', user.id).order('updated_at', { ascending: false }).limit(8),
    supabase.from('favorites').select('song_id').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
    supabase.from('artist_followers').select('artist_id').eq('user_id', user.id).limit(500),
  ]);
  const recentIds = [...new Set(unwrap(plays).map((p) => p.song_id))];
  const recentlyPlayed = await publishedSongsByIds(recentIds.slice(0, 12));

  const out = { recentlyPlayed, yourPlaylists: unwrap(playlists).map(toPlaylist), madeForYou: [], becauseYouListened: null, fromFollowing: [] };

  const followIds = unwrap(follows).map((f) => f.artist_id);
  if (followIds.length) {
    out.fromFollowing = unwrap(
      await publishedSongs().in('artist_id', followIds).order('published_at', { ascending: false, nullsFirst: false }).limit(12)
    ).map((r) => toSong(r));
  }
  if (!personalised) return out;

  // Taste = genres the listener picked + genres of what they play and favorite.
  const tasteSongIds = [...new Set([...recentIds.slice(0, 50), ...unwrap(favorites).map((f) => f.song_id)])];
  const tasteRows = tasteSongIds.length ? unwrap(await supabase.from('songs').select('genre_id').in('id', tasteSongIds).not('genre_id', 'is', null)) : [];
  const counts = new Map();
  for (const g of [...(user.favorite_genre_ids || []), ...tasteRows.map((r) => r.genre_id)]) counts.set(g, (counts.get(g) || 0) + 1);
  const topGenres = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([g]) => g);
  if (topGenres.length) {
    let q = publishedSongs().in('genre_id', topGenres).order('play_count', { ascending: false }).limit(24);
    const rows = unwrap(await q);
    const played = new Set(recentIds.slice(0, 30));
    out.madeForYou = rows.filter((r) => !played.has(r.id)).slice(0, 12).map((r) => toSong(r));
  }

  const seed = recentlyPlayed[0];
  if (seed) {
    const seedRow = await supabase.from('songs').select('artist_id,genre_id').eq('id', seed.id).maybeSingle();
    const filters = [`artist_id.eq.${seedRow.data?.artist_id}`];
    if (seedRow.data?.genre_id) filters.push(`genre_id.eq.${seedRow.data.genre_id}`);
    const related = unwrap(await publishedSongs().neq('id', seed.id).or(filters.join(',')).order('play_count', { ascending: false }).limit(12));
    if (related.length) out.becauseYouListened = { seed, songs: related.map((r) => toSong(r)) };
  }
  return out;
}

export async function home(req, res) {
  const settings = await getSettings();
  const [featured, latest, recent, trending, artists, genres, playlists, videos] = await Promise.all([
    publishedSongs().eq('is_featured', true).order('created_at', { ascending: false }).limit(settings.featured_limit),
    publishedSongs().order('release_date', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }).limit(12),
    publishedSongs().order('created_at', { ascending: false }).limit(12),
    supabase.rpc('trending_songs', { p_days: 7, p_limit: 10 }).select(SONG_FIELDS),
    supabase.from('artists_view').select(ARTIST_FIELDS).gt('song_count', 0).order('follower_count', { ascending: false }).order('total_plays', { ascending: false }).limit(12),
    supabase.from('genres_view').select('*').gt('song_count', 0).order('song_count', { ascending: false }),
    supabase.from('playlists_view').select(PLAYLIST_FIELDS).eq('is_featured', true).eq('is_public', true).gt('song_count', 0).order('updated_at', { ascending: false }).limit(10),
    settings.videos_enabled
      ? supabase.from('videos_view').select(VIDEO_FIELDS).eq('is_published', true).eq('processing_status', 'ready').order('published_at', { ascending: false }).limit(8)
      : { data: [] },
  ]);

  const personal = req.user ? await personalSections(req.user) : null;
  res.set('Cache-Control', req.user ? 'private, no-store' : 'public, max-age=30');
  ok(res, {
    featured: unwrap(featured).map((r) => toSong(r)),
    latest: unwrap(latest).map((r) => toSong(r)),
    recentlyAdded: unwrap(recent).map((r) => toSong(r)),
    trending: unwrap(trending).map((r) => toSong(r)),
    popularArtists: unwrap(artists).map((r) => toArtist(r)),
    genres: unwrap(genres).map(toGenre),
    featuredPlaylists: unwrap(playlists).map(toPlaylist),
    musicVideos: unwrap(videos).map((v) => toVideo(v)),
    personal,
  });
}

// ─── Search ────────────────────────────────────────────────────────────────
const EMPTY_SEARCH = { songs: [], artists: [], albums: [], playlists: [], videos: [], lyrics: [], genres: [] };

export async function search(req, res) {
  const { q, limit } = req.valid.query;
  const term = cleanSearchTerm(q);
  if (!term) return ok(res, EMPTY_SEARCH);
  const settings = await getSettings();

  const [songs, artists, albums, genres, playlists, videos, lyricMatches] = await Promise.all([
    publishedSongs().or(ilikeAny(['title', 'artist_name', 'album_title', 'genre_name'], term)).order('play_count', { ascending: false }).limit(limit),
    supabase.from('artists_view').select(ARTIST_FIELDS).or(HAS_CONTENT).ilike('name', `%${term}%`).order('follower_count', { ascending: false }).limit(8),
    supabase.from('albums_view').select(ALBUM_FIELDS).gt('song_count', 0).or(ilikeAny(['title', 'artist_name'], term)).limit(8),
    supabase.from('genres_view').select('*').ilike('name', `%${term}%`).limit(6),
    supabase.from('playlists_view').select(PLAYLIST_FIELDS).eq('is_public', true).gt('song_count', 0).or(ilikeAny(['name', 'description'], term)).limit(8),
    settings.videos_enabled
      ? supabase.from('videos_view').select(VIDEO_FIELDS).eq('is_published', true).eq('processing_status', 'ready').or(ilikeAny(['title', 'artist_name'], term)).order('view_count', { ascending: false }).limit(8)
      : { data: [] },
    // Lyric search: published, visible lyrics whose text contains the phrase.
    term.length >= 3 && settings.lyrics_enabled
      ? supabase.from('lyrics').select('song_id,content').eq('status', 'published').eq('is_visible', true).ilike('content', `%${term}%`).limit(20)
      : { data: [] },
  ]);

  const lyricRows = unwrap(lyricMatches);
  const lyricSongs = await publishedSongsByIds([...new Set(lyricRows.map((l) => l.song_id))].slice(0, 10));
  const snippet = (content) => {
    const line = content.split('\n').find((l) => l.toLowerCase().includes(term.toLowerCase()));
    return line ? line.slice(0, 160) : null;
  };
  const snippets = new Map(lyricRows.map((l) => [l.song_id, snippet(l.content)]));

  const result = {
    songs: unwrap(songs).map((r) => toSong(r)),
    artists: unwrap(artists).map((r) => toArtist(r)),
    albums: unwrap(albums).map(toAlbum),
    playlists: unwrap(playlists).map(toPlaylist),
    videos: unwrap(videos).map((v) => toVideo(v)),
    lyrics: lyricSongs.map((song) => ({ song, line: snippets.get(song.id) })),
    genres: unwrap(genres).map(toGenre),
  };

  // Anonymous search analytics — failures must never break search.
  const total = Object.values(result).reduce((n, list) => n + list.length, 0);
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
  let query = supabase.from('artists_view').select(ARTIST_FIELDS, { count: 'exact' }).or(HAS_CONTENT);
  const term = cleanSearchTerm(q);
  if (term) query = query.ilike('name', `%${term}%`);
  query =
    sort === 'popular'
      ? query.order('follower_count', { ascending: false }).order('total_plays', { ascending: false })
      : sort === 'latest'
        ? query.order('created_at', { ascending: false })
        : query.order('name');
  const { from, to } = pageRange({ page, limit });
  const { data, count, error } = await query.order('id').range(from, to);
  if (error) throw dbError(error);
  ok(res, data.map((r) => toArtist(r)), pageMeta({ page, limit }, count));
}

/**
 * Artist page: profile, popular tracks, latest releases, albums, videos and
 * follow state. Verified artists and artists with public content are visible;
 * owners can always preview their own page.
 */
export async function getArtist(req, res) {
  const { id } = req.valid.params;
  const artist = await one(supabase.from('artists_view').select(ARTIST_FIELDS).eq('id', id), 'Artist not found.');
  const isOwner = Boolean(req.user && artist.owner_user_id === req.user.id);
  const hasContent = Number(artist.song_count) > 0 || Number(artist.video_count) > 0 || artist.verification_status === 'verified';
  if (!hasContent && !isOwner && req.user?.role !== 'admin') throw notFound('Artist not found.');

  const [popular, latest, albums, videos, following] = await Promise.all([
    publishedSongs().eq('artist_id', id).order('play_count', { ascending: false }).limit(50),
    publishedSongs().eq('artist_id', id).order('release_date', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }).limit(12),
    supabase.from('albums_view').select(ALBUM_FIELDS).eq('artist_id', id).gt('song_count', 0).order('release_date', { ascending: false, nullsFirst: false }),
    supabase.from('videos_view').select(VIDEO_FIELDS).eq('artist_id', id).eq('is_published', true).eq('processing_status', 'ready').order('published_at', { ascending: false }).limit(12),
    req.user ? supabase.from('artist_followers').select('id').eq('artist_id', id).eq('user_id', req.user.id).maybeSingle() : { data: null },
  ]);
  ok(res, {
    ...toArtist(artist),
    isOwner,
    isFollowing: Boolean(following.data),
    songs: unwrap(popular).map((r) => toSong(r)),
    latestReleases: unwrap(latest).map((r) => toSong(r)),
    albums: unwrap(albums).map(toAlbum),
    videos: unwrap(videos).map((v) => toVideo(v)),
  });
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
