import { supabase } from '../config/supabase.js';
import { orderByIds, unwrap } from '../utils/db.js';
import { SONG_FIELDS, toSong } from './mappers.js';

/** Load published songs by id, preserving the order of `ids`. */
export async function publishedSongsByIds(ids) {
  if (!ids.length) return [];
  const rows = unwrap(await supabase.from('songs_view').select(SONG_FIELDS).in('id', ids).eq('is_published', true));
  return orderByIds(rows, ids).map((r) => toSong(r));
}

/** A clean download filename like "Artist - Title.mp3" (only safe characters). */
export function downloadFilename(song, mime) {
  const ext = { 'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/mp4': 'm4a', 'audio/aac': 'aac' }[mime] || 'mp3';
  const base = `${song.artist_name} - ${song.title}`
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w\s\-().&']/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  return `${base || 'shere-music-track'}.${ext}`;
}
