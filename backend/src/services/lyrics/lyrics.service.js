import { supabase } from '../../config/supabase.js';
import { AppError, badRequest, notFound } from '../../utils/AppError.js';
import { dbError, one, unwrap } from '../../utils/db.js';
import { linesToPlainText, withEndTimes } from '../../utils/lrc.js';
import { getSettings, lyricsProviderConfig } from '../settings.service.js';
import { createHttpProvider } from './providers/http.provider.js';

/**
 * lyricsService — one place that knows where lyrics come from.
 * Sources: manual (typed in the editor), imported (LRC/plain text pasted or
 * pulled from the provider and then saved), external (fetched live from the
 * configured provider, cached in memory, never stored).
 * Swapping providers only means adding another module under ./providers.
 */

export const LYRICS_FIELDS =
  'id,song_id,language,source,provider,is_synced,content,copyright_notice,attribution,license,status,is_visible,rejection_reason,created_by,submitted_at,reviewed_at,created_at,updated_at';

const MAX_LINES = 2000;
const MAX_TIME_MS = 6 * 60 * 60 * 1000;

export function toLyrics(row, lines, { manage = false } = {}) {
  return {
    id: row.id,
    songId: row.song_id,
    language: row.language,
    source: row.source,
    provider: row.provider,
    isSynced: row.is_synced,
    lines: lines.map((l, i) => ({
      lineNumber: l.line_number ?? i,
      text: l.text,
      startTimeMs: l.start_time_ms ?? l.startTimeMs ?? null,
      endTimeMs: l.end_time_ms ?? l.endTimeMs ?? null,
    })),
    copyrightNotice: row.copyright_notice,
    attribution: row.attribution,
    license: row.license,
    updatedAt: row.updated_at,
    ...(manage
      ? {
          status: row.status,
          isVisible: row.is_visible,
          rejectionReason: row.rejection_reason,
          submittedAt: row.submitted_at,
          reviewedAt: row.reviewed_at,
        }
      : {}),
  };
}

async function linesFor(lyricsId) {
  return unwrap(
    await supabase.from('lyric_lines').select('line_number,text,start_time_ms,end_time_ms').eq('lyrics_id', lyricsId).order('line_number').limit(MAX_LINES)
  );
}

export async function loadLyricsById(id) {
  const row = await one(supabase.from('lyrics').select(LYRICS_FIELDS).eq('id', id), 'Lyrics not found.');
  return { row, lines: await linesFor(row.id) };
}

export async function listLyricsForSong(songId) {
  return unwrap(await supabase.from('lyrics').select(LYRICS_FIELDS).eq('song_id', songId).order('language'));
}

/** Validate and normalise editor input. Synced lyrics must have increasing timestamps. */
export function normaliseLines(lines, isSynced) {
  if (!Array.isArray(lines)) throw badRequest('Lyrics must be a list of lines.');
  if (lines.length > MAX_LINES) throw badRequest(`Lyrics can have at most ${MAX_LINES} lines.`);
  const out = lines.map((l, i) => {
    const text = String(l?.text ?? '').slice(0, 500);
    const t = l?.startTimeMs;
    const start = t === null || t === undefined || t === '' ? null : Math.round(Number(t));
    if (start !== null && (!Number.isFinite(start) || start < 0 || start > MAX_TIME_MS)) {
      throw badRequest(`Line ${i + 1} has an invalid timestamp.`);
    }
    return { text, startTimeMs: isSynced ? start : null, endTimeMs: null };
  });
  if (isSynced) {
    const timed = out.filter((l) => l.startTimeMs !== null);
    if (!timed.length) throw badRequest('Synced lyrics need at least one timestamped line. Use the sync tool or switch to unsynced.');
    let last = -1;
    out.forEach((l, i) => {
      if (l.startTimeMs === null) return;
      if (l.startTimeMs < last) throw badRequest(`Line ${i + 1} starts before the line above it. Timestamps must increase.`);
      last = l.startTimeMs;
    });
  }
  return isSynced ? withEndTimes(out) : out;
}

/**
 * Create or update the lyrics for (song, language) and replace its lines
 * atomically. `patch` carries workflow columns decided by the caller.
 */
export async function saveLyrics({ songId, lyricsId, language, isSynced, lines, copyrightNotice, attribution, license, source, provider }, actorId, patch = {}) {
  const clean = normaliseLines(lines, isSynced);
  const record = {
    song_id: songId,
    language,
    is_synced: isSynced,
    content: linesToPlainText(clean),
    copyright_notice: copyrightNotice ?? null,
    attribution: attribution ?? null,
    license: license ?? null,
    source: source || 'manual',
    provider: provider ?? null,
    ...patch,
  };

  let row;
  if (lyricsId) {
    const { data, error } = await supabase.from('lyrics').update(record).eq('id', lyricsId).eq('song_id', songId).select(LYRICS_FIELDS).maybeSingle();
    if (error?.code === '23505') throw new AppError(409, `This song already has lyrics in "${language}".`, 'DUPLICATE');
    if (error) throw dbError(error);
    if (!data) throw notFound('Lyrics not found.');
    row = data;
  } else {
    const { data, error } = await supabase.from('lyrics').insert({ ...record, created_by: actorId, status: patch.status || 'draft' }).select(LYRICS_FIELDS).single();
    if (error?.code === '23505') throw new AppError(409, `This song already has lyrics in "${language}". Edit those instead.`, 'DUPLICATE');
    if (error) throw dbError(error);
    row = data;
  }

  unwrap(await supabase.rpc('replace_lyric_lines', { p_lyrics_id: row.id, p_lines: clean }));
  return toLyrics(row, clean, { manage: true });
}

// ─── External provider ─────────────────────────────────────────────────────
const cache = new Map(); // key → { value, expires }
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const CACHE_MAX = 500;

function providerFor(settings) {
  const config = lyricsProviderConfig(settings);
  if (!config.url) return null;
  return createHttpProvider(config);
}

/** Look lyrics up from the provider for a song row (songs_view). Returns null when unavailable. */
export async function fetchExternalLyrics(song, { useCache = true } = {}) {
  const settings = await getSettings();
  const provider = providerFor(settings);
  if (!provider) return null;
  const key = `${song.id}:${song.updated_at || ''}`;
  const hit = useCache && cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;

  let value = null;
  try {
    value = await provider.fetchLyrics({ artist: song.artist_name, title: song.title, album: song.album_title, duration: song.duration });
    if (value) value = { ...value, provider: provider.name };
  } catch (err) {
    console.error('[lyrics] provider error:', err.message);
    if (!useCache) throw new AppError(502, 'The lyrics provider did not respond. Check the provider settings and try again.', 'PROVIDER_ERROR');
    return null;
  }
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
  cache.set(key, { value, expires: Date.now() + (value ? CACHE_TTL_MS : CACHE_TTL_MS / 12) });
  return value;
}

export function clearLyricsCache() {
  cache.clear();
}

/**
 * Lyrics a listener sees for a published song, honouring the admin's
 * lyrics mode (manual / external / both) and the global display switch.
 */
export async function getPublicLyrics(song, preferredLanguage) {
  const settings = await getSettings();
  if (!settings.lyrics_enabled) return { lyrics: null, languages: [] };

  if (settings.lyrics_mode !== 'external') {
    const rows = unwrap(
      await supabase.from('lyrics').select(LYRICS_FIELDS).eq('song_id', song.id).eq('status', 'published').eq('is_visible', true)
    );
    if (rows.length) {
      const chosen = rows.find((r) => r.language === preferredLanguage) || rows.find((r) => r.language === 'en') || rows[0];
      return { lyrics: toLyrics(chosen, await linesFor(chosen.id)), languages: rows.map((r) => r.language) };
    }
  }

  if (settings.lyrics_mode !== 'manual') {
    const external = await fetchExternalLyrics(song);
    if (external) {
      return {
        lyrics: {
          id: null,
          songId: song.id,
          language: external.language || 'en',
          source: 'external',
          provider: external.provider,
          isSynced: external.isSynced,
          lines: external.lines.map((l, i) => ({ lineNumber: i, ...l })),
          copyrightNotice: external.copyrightNotice,
          attribution: external.attribution,
          license: external.license,
        },
        languages: [external.language || 'en'],
      };
    }
  }
  return { lyrics: null, languages: [] };
}
