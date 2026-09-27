import { supabase } from '../../config/supabase.js';
import { dbError, one } from '../../utils/db.js';
import { created, noContent, ok, pageMeta, pageRange } from '../../utils/http.js';
import { cleanSearchTerm, ilikeAny } from '../../utils/search.js';
import { SONG_MANAGE_FIELDS, toSong } from '../../services/mappers.js';
import { signedAudioUrl } from '../../services/storage.service.js';
import {
  createSongRecord,
  deleteSongRecord,
  loadManagedSong,
  setSongWorkflow,
  songColumns,
  updateSongRecord,
} from '../../services/songManagement.service.js';
import { adminStatusPatch, afterStatusChange, reviewPatch } from '../../services/review.service.js';

const SORTS = {
  created_desc: ['created_at', false],
  created_asc: ['created_at', true],
  submitted: ['submitted_at', true],
  title: ['title', true],
  plays: ['play_count', false],
  downloads: ['download_count', false],
  release: ['release_date', false],
};

const admin = (row) => toSong(row, { manage: true });

/** Status requested by the admin form: explicit `status`, or the v1 `isPublished` toggle. */
function requestedStatus(body) {
  if (body.status) return body.status;
  if (body.isPublished !== undefined) return body.isPublished ? 'published' : 'draft';
  return undefined;
}

export async function listSongs(req, res) {
  const { q, status, genre, artist, album, featured, sort, page, limit } = req.valid.query;
  let query = supabase.from('songs_view').select(SONG_MANAGE_FIELDS, { count: 'exact' });
  const term = cleanSearchTerm(q);
  if (term) query = query.or(ilikeAny(['title', 'artist_name', 'album_title', 'genre_name'], term));
  if (status === 'draft') query = query.in('status', ['draft', 'approved', 'rejected']);
  else if (status !== 'all') query = query.eq('status', status);
  if (genre) query = query.eq('genre_id', genre);
  if (artist) query = query.eq('artist_id', artist);
  if (album) query = query.eq('album_id', album);
  if (featured !== undefined) query = query.eq('is_featured', featured);
  const [column, ascending] = SORTS[sort];
  const { from, to } = pageRange({ page, limit });
  const { data, count, error } = await query.order(column, { ascending, nullsFirst: false }).order('id').range(from, to);
  if (error) throw dbError(error);
  ok(res, data.map(admin), pageMeta({ page, limit }, count));
}

export async function getSong(req, res) {
  ok(res, admin(await loadManagedSong(req.valid.params.id)));
}

/** Signed preview URL for any song, including drafts and submissions under review. */
export async function previewUrl(req, res) {
  const song = await loadManagedSong(req.valid.params.id);
  const url = await signedAudioUrl(song.audio_path, { expiresIn: 60 * 60 });
  res.set('Cache-Control', 'private, no-store');
  ok(res, { url, mime: song.audio_mime, expiresIn: 3600 });
}

export async function createSong(req, res) {
  const body = req.valid.body;
  await one(supabase.from('artists').select('id').eq('id', body.artistId), 'Artist not found.');
  const status = requestedStatus(body) || 'draft';
  const song = await createSongRecord({
    columns: songColumns(body),
    audio: req.files?.audio?.[0],
    artwork: req.files?.artwork?.[0],
    actorId: req.user.id,
    workflow: adminStatusPatch(status, req.user.id),
  });
  if (status === 'published') afterStatusChange('song', { ...song, status: 'draft', published_at: null }, song);
  created(res, admin(song));
}

export async function updateSong(req, res) {
  const existing = await loadManagedSong(req.valid.params.id);
  const body = req.valid.body;
  if (body.artistId) await one(supabase.from('artists').select('id').eq('id', body.artistId), 'Artist not found.');
  const status = requestedStatus(body);
  const song = await updateSongRecord(existing, {
    columns: songColumns(body),
    audio: req.files?.audio?.[0],
    artwork: req.files?.artwork?.[0],
    removeArtwork: req.body.removeArtwork === 'true' || req.body.removeArtwork === true,
    workflow: status && status !== existing.status ? adminStatusPatch(status, req.user.id, { publishedAt: existing.published_at }) : {},
  });
  afterStatusChange('song', existing, song);
  ok(res, admin(song), { message: 'Song updated.' });
}

/** Publish/unpublish toggle (v1 endpoint, kept for the Music list). */
export async function setPublished(req, res) {
  const existing = await loadManagedSong(req.valid.params.id);
  const status = req.valid.body.isPublished ? 'published' : 'draft';
  const song = await setSongWorkflow(existing, adminStatusPatch(status, req.user.id, { publishedAt: existing.published_at }));
  afterStatusChange('song', existing, song);
  ok(res, admin(song), { message: status === 'published' ? 'Song published.' : 'Song unpublished.' });
}

/** Review decision on a creator submission: approve (hold), publish, or reject with a reason. */
export async function reviewSong(req, res) {
  const existing = await loadManagedSong(req.valid.params.id);
  const { decision, reason } = req.valid.body;
  const song = await setSongWorkflow(existing, reviewPatch(decision, req.user.id, reason, { publishedAt: existing.published_at }));
  afterStatusChange('song', existing, song);
  ok(res, admin(song), { message: { reject: 'Submission rejected.', approve: 'Submission approved.', publish: 'Song approved and published.' }[decision] });
}

export async function setFeatured(req, res) {
  const existing = await loadManagedSong(req.valid.params.id);
  const song = await setSongWorkflow(existing, { is_featured: req.valid.body.isFeatured });
  ok(res, admin(song));
}

export async function deleteSong(req, res) {
  await deleteSongRecord(await loadManagedSong(req.valid.params.id));
  noContent(res);
}
