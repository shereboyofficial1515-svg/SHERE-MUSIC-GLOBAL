import { supabase } from '../../config/supabase.js';
import { AppError, badRequest } from '../../utils/AppError.js';
import { dbError, unwrap } from '../../utils/db.js';
import { noContent, ok } from '../../utils/http.js';
import { SONG_MANAGE_FIELDS } from '../../services/mappers.js';
import { fetchExternalLyrics, listLyricsForSong, loadLyricsById, saveLyrics, toLyrics } from '../../services/lyrics/lyrics.service.js';
import { getSettings } from '../../services/settings.service.js';
import { loadOwnedSong } from '../../services/ownership.service.js';
import { loadManagedSong } from '../../services/songManagement.service.js';
import { adminStatusPatch, afterStatusChange, reviewPatch, statusAfterCreatorEdit, submitPatch } from '../../services/review.service.js';

/**
 * Lyrics endpoints for Studio (scope 'studio': only the creator's own songs,
 * review workflow applies) and Admin (scope 'admin': any song, direct control).
 */
export function lyricsHandlers(scope) {
  const isAdmin = scope === 'admin';
  const loadSong = (req) =>
    isAdmin ? loadManagedSong(req.valid.params.id) : loadOwnedSong(req.user.id, req.valid.params.id, SONG_MANAGE_FIELDS);

  async function loadLyricsOfSong(req, song) {
    const { row, lines } = await loadLyricsById(req.valid.params.lyricsId);
    if (row.song_id !== song.id) throw new AppError(404, 'Lyrics not found.', 'NOT_FOUND');
    return { row, lines };
  }

  const withSong = (row, song) => ({ ...row, title: song.title, artist_id: song.artist_id, artist_name: song.artist_name });

  return {
    /** All lyric versions (languages) of a song, with lines. */
    async list(req, res) {
      const song = await loadSong(req);
      const rows = await listLyricsForSong(song.id);
      const full = await Promise.all(rows.map(async (r) => toLyrics(r, (await loadLyricsById(r.id)).lines, { manage: true })));
      ok(res, { song: { id: song.id, title: song.title, artist: song.artist_name, duration: song.duration, status: song.status }, lyrics: full });
    },

    /** Create or update lyrics for a language (upsert by language when no id is given). */
    async save(req, res) {
      const song = await loadSong(req);
      const body = req.valid.body;
      const settings = await getSettings();
      let existing = null;
      if (req.valid.params.lyricsId) existing = (await loadLyricsOfSong(req, song)).row;
      else {
        existing = unwrap(await supabase.from('lyrics').select('*').eq('song_id', song.id).eq('language', body.language).maybeSingle());
      }

      let patch;
      if (isAdmin) {
        patch = body.publish ? adminStatusPatch('published', req.user.id) : {};
      } else {
        const current = existing?.status || 'draft';
        const next = statusAfterCreatorEdit(current, settings.artist_auto_publish);
        patch = next !== current ? { status: next, ...(next === 'pending' ? { submitted_at: new Date().toISOString() } : {}) } : {};
        if (body.submit && ['draft', 'rejected'].includes(next)) patch = { ...patch, ...submitPatch(next, settings.artist_auto_publish) };
      }

      const saved = await saveLyrics(
        {
          songId: song.id,
          lyricsId: existing?.id,
          language: body.language,
          isSynced: body.isSynced,
          lines: body.lines,
          copyrightNotice: body.copyrightNotice,
          attribution: body.attribution,
          license: body.license,
          source: body.source,
        },
        req.user.id,
        patch
      );
      if (existing && patch.status && patch.status !== existing.status) {
        afterStatusChange('lyrics', withSong(existing, song), { status: saved.status, rejection_reason: null });
      }
      const message = saved.status === 'pending' ? 'Lyrics saved and submitted for review.' : saved.status === 'published' ? 'Lyrics saved and published.' : 'Lyrics saved.';
      ok(res, saved, { message });
    },

    /** Studio: submit a draft for review. */
    async submit(req, res) {
      const song = await loadSong(req);
      const { row, lines } = await loadLyricsOfSong(req, song);
      if (!lines.some((l) => l.text.trim())) throw badRequest('Add some lyrics before submitting.');
      const settings = await getSettings();
      const updated = unwrap(
        await supabase.from('lyrics').update(submitPatch(row.status, settings.artist_auto_publish)).eq('id', row.id).select('*').single()
      );
      ok(res, toLyrics(updated, lines, { manage: true }), {
        message: updated.status === 'published' ? 'Lyrics published.' : 'Lyrics submitted for review.',
      });
    },

    /** Admin: approve/publish/reject. */
    async review(req, res) {
      const song = await loadSong(req);
      const { row, lines } = await loadLyricsOfSong(req, song);
      const { decision, reason } = req.valid.body;
      const updated = unwrap(await supabase.from('lyrics').update(reviewPatch(decision, req.user.id, reason)).eq('id', row.id).select('*').single());
      afterStatusChange('lyrics', withSong(row, song), updated);
      ok(res, toLyrics(updated, lines, { manage: true }), { message: decision === 'reject' ? 'Lyrics rejected.' : 'Lyrics approved.' });
    },

    /** Admin: show/hide lyrics without deleting them. */
    async visibility(req, res) {
      const song = await loadSong(req);
      const { row, lines } = await loadLyricsOfSong(req, song);
      const updated = unwrap(await supabase.from('lyrics').update({ is_visible: req.valid.body.isVisible }).eq('id', row.id).select('*').single());
      ok(res, toLyrics(updated, lines, { manage: true }));
    },

    async remove(req, res) {
      const song = await loadSong(req);
      const { row } = await loadLyricsOfSong(req, song);
      unwrap(await supabase.from('lyrics').delete().eq('id', row.id));
      noContent(res);
    },

    /**
     * Pull lyrics from the configured provider into the editor (not saved).
     * Only available when the admin enabled an external provider.
     */
    async importFromProvider(req, res) {
      const song = await loadSong(req);
      const settings = await getSettings();
      if (settings.lyrics_mode === 'manual') throw badRequest('External lyrics are turned off. An admin can enable a provider in Settings → Lyrics.');
      const found = await fetchExternalLyrics(song, { useCache: false });
      if (!found) throw new AppError(404, 'The lyrics provider has no lyrics for this song.', 'NOT_FOUND');
      ok(res, {
        isSynced: found.isSynced,
        language: found.language || 'en',
        lines: found.lines.map((l) => ({ text: l.text, startTimeMs: l.startTimeMs ?? null })),
        attribution: found.attribution,
        copyrightNotice: found.copyrightNotice,
        license: found.license,
        provider: found.provider,
      });
    },
  };
}

/** Admin: lyrics across the catalog (review queue and management list). */
export async function adminListLyrics(req, res) {
  const { status, q, page, limit } = req.valid.query;
  let query = supabase.from('lyrics').select('id,song_id,language,is_synced,status,is_visible,source,submitted_at,updated_at', { count: 'exact' });
  if (status !== 'all') query = query.eq('status', status);
  if (q) query = query.ilike('content', `%${q.replace(/[%_,()]/g, ' ')}%`);
  const from = (page - 1) * limit;
  const { data, count, error } = await query.order(status === 'pending' ? 'submitted_at' : 'updated_at', { ascending: status === 'pending' }).range(from, from + limit - 1);
  if (error) throw dbError(error);
  const songIds = [...new Set(data.map((l) => l.song_id))];
  const songs = songIds.length ? unwrap(await supabase.from('songs_view').select('id,title,artist_name,artwork_path').in('id', songIds)) : [];
  const byId = new Map(songs.map((s) => [s.id, s]));
  ok(
    res,
    data.map((l) => ({
      id: l.id,
      songId: l.song_id,
      songTitle: byId.get(l.song_id)?.title,
      artistName: byId.get(l.song_id)?.artist_name,
      language: l.language,
      isSynced: l.is_synced,
      status: l.status,
      isVisible: l.is_visible,
      source: l.source,
      submittedAt: l.submitted_at,
      updatedAt: l.updated_at,
    })),
    { page, limit, total: count ?? 0, totalPages: Math.max(1, Math.ceil((count ?? 0) / limit)), hasMore: page * limit < (count ?? 0) }
  );
}

