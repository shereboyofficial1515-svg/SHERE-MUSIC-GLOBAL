import { supabase } from '../../config/supabase.js';
import { badRequest } from '../../utils/AppError.js';
import { dbError } from '../../utils/db.js';
import { created, noContent, ok, pageMeta, pageRange } from '../../utils/http.js';
import { cleanSearchTerm, ilikeAny } from '../../utils/search.js';
import { VIDEO_MANAGE_FIELDS } from '../../services/mappers.js';
import { getSettings } from '../../services/settings.service.js';
import { readSubtitle } from '../../services/storage.service.js';
import { loadOwnedArtist, loadOwnedVideo, ownedArtistIds } from '../../services/ownership.service.js';
import {
  addSubtitle,
  completeVideoUpload,
  createVideoRecord,
  deleteSubtitle,
  deleteVideoRecord,
  listSubtitles,
  loadManagedVideo,
  manageVideo,
  previewVideo,
  setVideoWorkflow,
  startVideoUpload,
  updateVideoRecord,
  videoColumns,
} from '../../services/videoManagement.service.js';
import {
  adminStatusPatch,
  afterStatusChange,
  creatorPublishPatch,
  reviewPatch,
  statusAfterCreatorEdit,
  submitPatch,
} from '../../services/review.service.js';

const SORTS = {
  created_desc: ['created_at', false],
  submitted: ['submitted_at', true],
  title: ['title', true],
  views: ['view_count', false],
};

/**
 * Music-video endpoints for Studio (own artists only, review workflow,
 * no featuring) and Admin (everything, direct status control).
 */
export function videoHandlers(scope) {
  const isAdmin = scope === 'admin';
  const load = (req) => (isAdmin ? loadManagedVideo(req.valid.params.id) : loadOwnedVideo(req.user.id, req.valid.params.id, VIDEO_MANAGE_FIELDS));
  const allowedFields = isAdmin ? undefined : ['title', 'artistId', 'songId', 'genreId', 'description', 'releaseDate', 'duration'];

  async function assertArtist(req, artistId) {
    if (isAdmin) {
      const { data } = await supabase.from('artists').select('id').eq('id', artistId).maybeSingle();
      if (!data) throw badRequest('Artist not found.');
    } else {
      await loadOwnedArtist(req.user.id, artistId, 'id,owner_user_id');
    }
  }

  /** After a creator changes reviewed content (e.g. replaces the file), it goes back to review. */
  async function creatorEditWorkflow(existing) {
    if (isAdmin) return {};
    const settings = await getSettings();
    const next = statusAfterCreatorEdit(existing.status, settings.artist_auto_publish);
    return next !== existing.status ? { status: next, ...(next === 'pending' ? { submitted_at: new Date().toISOString() } : {}) } : {};
  }

  return {
    async list(req, res) {
      const { q, status, artist, sort, page, limit } = req.valid.query;
      let query = supabase.from('videos_view').select(VIDEO_MANAGE_FIELDS, { count: 'exact' });
      if (!isAdmin) {
        const mine = await ownedArtistIds(req.user.id);
        if (!mine.length) return ok(res, [], pageMeta({ page, limit }, 0));
        query = query.in('artist_id', mine);
      }
      const term = cleanSearchTerm(q);
      if (term) query = query.or(ilikeAny(['title', 'artist_name'], term));
      if (status !== 'all') query = query.eq('status', status);
      if (artist) query = query.eq('artist_id', artist);
      const [column, ascending] = SORTS[sort];
      const { from, to } = pageRange({ page, limit });
      const { data, count, error } = await query.order(column, { ascending, nullsFirst: false }).order('id').range(from, to);
      if (error) throw dbError(error);
      ok(res, data.map(manageVideo), pageMeta({ page, limit }, count));
    },

    async get(req, res) {
      const video = await load(req);
      ok(res, { ...manageVideo(video), subtitles: await listSubtitles(video.id) });
    },

    /** Step 1: create the video record (metadata + optional thumbnail). The file is uploaded next. */
    async create(req, res) {
      const body = req.valid.body;
      await assertArtist(req, body.artistId);
      const status = isAdmin ? body.status || 'draft' : 'draft';
      const video = await createVideoRecord({
        columns: videoColumns(body, allowedFields),
        thumbnail: req.file,
        actorId: req.user.id,
        workflow: isAdmin ? adminStatusPatch(status, req.user.id) : { status: 'draft' },
      });
      created(res, manageVideo(video));
    },

    async update(req, res) {
      const existing = await load(req);
      const body = req.valid.body;
      if (body.artistId && body.artistId !== existing.artist_id) await assertArtist(req, body.artistId);
      let workflow = {};
      if (isAdmin && body.status && body.status !== existing.status) {
        if (body.status === 'published' && existing.processing_status !== 'ready') throw badRequest('Upload the video file before publishing.');
        workflow = adminStatusPatch(body.status, req.user.id, { publishedAt: existing.published_at });
      } else if (!isAdmin) workflow = await creatorEditWorkflow(existing);
      const video = await updateVideoRecord(existing, {
        columns: videoColumns(body, allowedFields),
        thumbnail: req.file,
        removeThumbnail: body.removeThumbnail,
        workflow,
      });
      afterStatusChange('video', existing, video);
      ok(res, manageVideo(video), { message: video.status === 'pending' && existing.status !== 'pending' ? 'Saved. The video was sent back for review.' : 'Video updated.' });
    },

    async remove(req, res) {
      await deleteVideoRecord(await load(req));
      noContent(res);
    },

    /** Step 2: get a one-time signed URL to upload the file straight to storage. */
    async uploadUrl(req, res) {
      const existing = await load(req);
      ok(res, await startVideoUpload(existing, req.valid.body));
    },

    /** Step 3: verify the uploaded file and attach it. */
    async completeUpload(req, res) {
      const existing = await load(req);
      const workflow = await creatorEditWorkflow(existing);
      const video = await completeVideoUpload(existing, req.valid.body, workflow);
      ok(res, manageVideo(video), { message: 'Video uploaded.' });
    },

    async preview(req, res) {
      const existing = await load(req);
      res.set('Cache-Control', 'private, no-store');
      ok(res, { url: await previewVideo(existing) });
    },

    async submit(req, res) {
      const existing = await load(req);
      if (existing.processing_status !== 'ready') throw badRequest('Upload the video file before submitting it for review.');
      const settings = await getSettings();
      const video = await setVideoWorkflow(existing, submitPatch(existing.status, settings.artist_auto_publish, { alreadyPublishedOnce: Boolean(existing.published_at) }));
      afterStatusChange('video', existing, video);
      ok(res, manageVideo(video), { message: video.status === 'published' ? 'Video published.' : 'Video submitted for review.' });
    },

    /** Studio: publish an approved video or withdraw a published one. */
    async publish(req, res) {
      const existing = await load(req);
      const video = await setVideoWorkflow(existing, creatorPublishPatch(existing.status, req.valid.body.isPublished, { publishedAt: existing.published_at }));
      afterStatusChange('video', existing, video);
      ok(res, manageVideo(video), { message: video.status === 'published' ? 'Video published.' : 'Video unpublished.' });
    },

    async review(req, res) {
      const existing = await load(req);
      const { decision, reason } = req.valid.body;
      if (decision !== 'reject' && existing.processing_status !== 'ready') throw badRequest('This video has no playable file yet.');
      const video = await setVideoWorkflow(existing, reviewPatch(decision, req.user.id, reason, { publishedAt: existing.published_at }));
      afterStatusChange('video', existing, video);
      ok(res, manageVideo(video), { message: decision === 'reject' ? 'Video rejected.' : decision === 'approve' ? 'Video approved.' : 'Video approved and published.' });
    },

    async feature(req, res) {
      const existing = await load(req);
      ok(res, manageVideo(await setVideoWorkflow(existing, { is_featured: req.valid.body.isFeatured })));
    },

    async subtitles(req, res) {
      const existing = await load(req);
      ok(res, await listSubtitles(existing.id));
    },

    async addSubtitle(req, res) {
      const existing = await load(req);
      const sub = await addSubtitle(existing.id, req.valid.body, req.file, req.user.id);
      created(res, sub);
    },

    /** WebVTT of any track on a video this caller may manage (for previewing drafts). */
    async subtitleFile(req, res) {
      const existing = await load(req);
      const { data: sub } = await supabase.from('video_subtitles').select('file_path').eq('id', req.valid.params.subtitleId).eq('video_id', existing.id).maybeSingle();
      if (!sub) throw badRequest('Subtitles not found.');
      res.set('Content-Type', 'text/vtt; charset=utf-8');
      res.set('Cache-Control', 'private, no-store');
      res.send(await readSubtitle(sub.file_path));
    },

    async deleteSubtitle(req, res) {
      const existing = await load(req);
      await deleteSubtitle(existing.id, req.valid.params.subtitleId);
      noContent(res);
    },
  };
}
