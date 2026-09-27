import { supabase } from '../../config/supabase.js';
import { unwrap } from '../../utils/db.js';
import { ok } from '../../utils/http.js';
import { SONG_MANAGE_FIELDS, VIDEO_MANAGE_FIELDS, toArtist, toSong, toVideo } from '../../services/mappers.js';

/** Everything waiting for an admin decision, oldest first. */
export async function reviewQueue(req, res) {
  const { type } = req.valid.query;
  const want = (t) => type === 'all' || type === t;
  const [songs, videos, lyrics, verifications] = await Promise.all([
    want('songs') ? supabase.from('songs_view').select(SONG_MANAGE_FIELDS).eq('status', 'pending').order('submitted_at', { ascending: true }).limit(100) : { data: [] },
    want('videos') ? supabase.from('videos_view').select(VIDEO_MANAGE_FIELDS).eq('status', 'pending').order('submitted_at', { ascending: true }).limit(100) : { data: [] },
    want('lyrics')
      ? supabase.from('lyrics').select('id,song_id,language,is_synced,submitted_at,updated_at').eq('status', 'pending').order('submitted_at', { ascending: true }).limit(100)
      : { data: [] },
    type === 'all' ? supabase.from('artists_view').select('*').eq('verification_status', 'pending').order('verification_requested_at', { ascending: true }).limit(100) : { data: [] },
  ]);

  const lyricRows = unwrap(lyrics);
  const songIds = [...new Set(lyricRows.map((l) => l.song_id))];
  const lyricSongs = songIds.length ? unwrap(await supabase.from('songs_view').select('id,title,artist_name').in('id', songIds)) : [];
  const songMap = new Map(lyricSongs.map((s) => [s.id, s]));

  ok(res, {
    songs: unwrap(songs).map((s) => toSong(s, { manage: true })),
    videos: unwrap(videos).map((v) => toVideo(v, { manage: true })),
    lyrics: lyricRows.map((l) => ({
      id: l.id,
      songId: l.song_id,
      songTitle: songMap.get(l.song_id)?.title,
      artistName: songMap.get(l.song_id)?.artist_name,
      language: l.language,
      isSynced: l.is_synced,
      submittedAt: l.submitted_at,
    })),
    verifications: unwrap(verifications).map((a) => toArtist(a, { manage: true })),
  });
}
