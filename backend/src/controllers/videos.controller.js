import { supabase } from '../config/supabase.js';
import { AppError, notFound } from '../utils/AppError.js';
import { dbError, one, unwrap } from '../utils/db.js';
import { ok, pageMeta, pageRange } from '../utils/http.js';
import { cleanSearchTerm, ilikeAny } from '../utils/search.js';
import { VIDEO_FIELDS, toArtist, toGenre, toSubtitle, toVideo } from '../services/mappers.js';
import { readSubtitle, signedVideoUrl } from '../services/storage.service.js';
import { getSettings } from '../services/settings.service.js';
import { getUserSettingsRow } from '../services/userSettings.service.js';

const STREAM_TTL_SECONDS = 4 * 60 * 60;
const SORTS = {
  latest: [['published_at', false], ['created_at', false]],
  popular: [['view_count', false], ['created_at', false]],
  released: [['release_date', false], ['created_at', false]],
  title: [['title', true]],
};

const published = (fields = VIDEO_FIELDS) =>
  supabase.from('videos_view').select(fields).eq('is_published', true).eq('processing_status', 'ready');

async function assertVideosEnabled() {
  const settings = await getSettings();
  if (!settings.videos_enabled) throw new AppError(404, 'SHERE MUSIC VIDEO is not available right now.', 'VIDEOS_DISABLED');
}

async function loadPublishedVideo(id, fields = VIDEO_FIELDS) {
  return one(published(fields).eq('id', id), 'Video not found.');
}

/** SHERE MUSIC VIDEO landing page in one round-trip. */
export async function videoHome(req, res) {
  await assertVideosEnabled();
  const [featured, trending, latest, released, genres, artists] = await Promise.all([
    published().eq('is_featured', true).order('published_at', { ascending: false }).limit(8),
    supabase.rpc('trending_videos', { p_days: 7, p_limit: 12 }).select(VIDEO_FIELDS),
    published().order('published_at', { ascending: false, nullsFirst: false }).limit(12),
    published().order('release_date', { ascending: false, nullsFirst: false }).limit(12),
    supabase.from('music_videos').select('genre_id').eq('is_published', true).not('genre_id', 'is', null).limit(1000),
    supabase.from('artists_view').select('id,name,image_path,verification_status,follower_count,video_count').gt('video_count', 0).order('follower_count', { ascending: false }).limit(12),
  ]);
  const genreIds = [...new Set(unwrap(genres).map((g) => g.genre_id))];
  const genreRows = genreIds.length ? unwrap(await supabase.from('genres_view').select('*').in('id', genreIds).order('name')) : [];

  // "Recommended": genres the listener plays most, falling back to trending.
  let recommended = [];
  if (req.user) {
    const settings = await getUserSettingsRow(req.user.id);
    if (settings.privacy_preferences.personalizedRecommendations !== false) {
      const recent = unwrap(await supabase.from('plays').select('song_id').eq('user_id', req.user.id).order('played_at', { ascending: false }).limit(50));
      const songIds = [...new Set(recent.map((r) => r.song_id))];
      if (songIds.length) {
        const songGenres = unwrap(await supabase.from('songs').select('genre_id').in('id', songIds).not('genre_id', 'is', null));
        const favGenres = [...new Set(songGenres.map((s) => s.genre_id))].slice(0, 5);
        if (favGenres.length) recommended = unwrap(await published().in('genre_id', favGenres).order('view_count', { ascending: false }).limit(12));
      }
    }
  }

  ok(res, {
    featured: unwrap(featured).map((v) => toVideo(v)),
    trending: unwrap(trending).filter((v) => v.processing_status === 'ready').map((v) => toVideo(v)),
    latest: unwrap(latest).map((v) => toVideo(v)),
    newReleases: unwrap(released).map((v) => toVideo(v)),
    recommended: recommended.map((v) => toVideo(v)),
    categories: genreRows.map(toGenre),
    popularArtists: unwrap(artists).map((a) => toArtist(a)),
  });
}

export async function listVideos(req, res) {
  await assertVideosEnabled();
  const { q, genre, artist, featured, sort, page, limit } = req.valid.query;
  let query = supabase.from('videos_view').select(VIDEO_FIELDS, { count: 'exact' }).eq('is_published', true).eq('processing_status', 'ready');
  const term = cleanSearchTerm(q);
  if (term) query = query.or(ilikeAny(['title', 'artist_name', 'genre_name'], term));
  if (genre) query = /^[0-9a-f-]{36}$/i.test(genre) ? query.eq('genre_id', genre) : query.eq('genre_slug', genre);
  if (artist) query = query.eq('artist_id', artist);
  if (featured !== undefined) query = query.eq('is_featured', featured);
  for (const [column, ascending] of SORTS[sort]) query = query.order(column, { ascending, nullsFirst: false });
  const { from, to } = pageRange({ page, limit });
  const { data, count, error } = await query.order('id').range(from, to);
  if (error) throw dbError(error);
  ok(res, data.map((v) => toVideo(v)), pageMeta({ page, limit }, count));
}

export async function getVideo(req, res) {
  await assertVideosEnabled();
  const video = await loadPublishedVideo(req.valid.params.id);
  const subtitles = unwrap(await supabase.from('video_subtitles').select('*').eq('video_id', video.id).order('label'));
  ok(res, { ...toVideo(video), subtitles: subtitles.map(toSubtitle) });
}

export async function relatedVideos(req, res) {
  const video = await loadPublishedVideo(req.valid.params.id);
  const filters = [`artist_id.eq.${video.artist_id}`];
  if (video.genre_id) filters.push(`genre_id.eq.${video.genre_id}`);
  let rows = unwrap(await published().neq('id', video.id).or(filters.join(',')).order('view_count', { ascending: false }).limit(12));
  if (rows.length < 6) {
    const exclude = [video.id, ...rows.map((r) => r.id)];
    rows = rows.concat(unwrap(await published().not('id', 'in', `(${exclude.join(',')})`).order('view_count', { ascending: false }).limit(6 - rows.length)));
  }
  ok(res, rows.map((v) => toVideo(v)));
}

export async function streamVideo(req, res) {
  const video = await loadPublishedVideo(req.valid.params.id, 'id,video_path,video_mime,renditions');
  if (!video.video_path) throw notFound('This video is not available.');
  const url = await signedVideoUrl(video.video_path, STREAM_TTL_SECONDS);
  // Future renditions (from a processing pipeline) get their own signed URLs here.
  const qualities = [];
  for (const r of video.renditions || []) {
    if (r.path && r.label) qualities.push({ label: r.label, height: r.height, url: await signedVideoUrl(r.path, STREAM_TTL_SECONDS) });
  }
  res.set('Cache-Control', 'private, no-store');
  ok(res, { url, mime: video.video_mime, expiresIn: STREAM_TTL_SECONDS, qualities });
}

export async function recordView(req, res) {
  let userId = req.user?.id ?? null;
  if (userId) {
    const settings = await getUserSettingsRow(userId);
    if (settings.privacy_preferences.usageAnalytics === false) userId = null;
  }
  const counted = unwrap(await supabase.rpc('record_video_view', { p_video_id: req.valid.params.id, p_user_id: userId }));
  if (!counted) throw notFound('Video not found.');
  ok(res, { counted: true });
}

/** WebVTT text for a published video's subtitle track. */
export async function subtitleFile(req, res) {
  const { id, subtitleId } = req.valid.params;
  await loadPublishedVideo(id, 'id');
  const sub = await one(supabase.from('video_subtitles').select('file_path').eq('id', subtitleId).eq('video_id', id), 'Subtitles not found.');
  const text = await readSubtitle(sub.file_path);
  res.set('Content-Type', 'text/vtt; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=300');
  res.send(text);
}
