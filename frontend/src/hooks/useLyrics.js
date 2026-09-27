import { useEffect, useMemo, useRef, useState } from 'react';
import { musicService } from '../services/musicService.js';
import { usePlayer, usePlayerProgress } from '../context/PlayerContext.jsx';
import { usePreferences } from '../context/PreferencesContext.jsx';
import { createLyricIndexer } from '../utils/lyricsEngine.js';

const cache = new Map(); // `${songId}:${lang}` → { lyrics, languages }

/** Published lyrics for a song (cached per session). */
export function useSongLyrics(songId, { enabled = true } = {}) {
  const { prefs } = usePreferences();
  const lang = prefs.language || 'en';
  const key = `${songId}:${lang}`;
  const [state, setState] = useState(() => ({ data: cache.get(key) || null, loading: Boolean(songId && enabled && !cache.has(key)), error: null }));
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!songId || !enabled) return undefined;
    if (cache.has(key)) {
      setState({ data: cache.get(key), loading: false, error: null });
      return undefined;
    }
    let cancelled = false;
    setState({ data: null, loading: true, error: null });
    musicService
      .lyrics(songId, lang)
      .then(({ data }) => {
        cache.set(key, data);
        if (!cancelled) setState({ data, loading: false, error: null });
      })
      .catch((error) => !cancelled && setState({ data: null, loading: false, error }));
    return () => {
      cancelled = true;
    };
  }, [songId, key, lang, enabled, attempt]);

  return { ...state, lyrics: state.data?.lyrics || null, retry: () => setAttempt((a) => a + 1) };
}

/**
 * The index of the lyric line being sung right now. While playing it follows
 * the audio clock every animation frame (cheap: the engine is O(1) per frame);
 * while paused it follows seeks through the progress context.
 */
export function useLyricSync(lyrics) {
  const { getCurrentTime, isPlaying } = usePlayer();
  const { currentTime } = usePlayerProgress();
  const indexer = useMemo(() => (lyrics?.isSynced ? createLyricIndexer(lyrics.lines) : null), [lyrics]);
  const [active, setActive] = useState(-1);
  const activeRef = useRef(-1);

  const update = (seconds) => {
    if (!indexer) return;
    const i = indexer.indexAt(seconds * 1000);
    if (i !== activeRef.current) {
      activeRef.current = i;
      setActive(i);
    }
  };

  // Paused / seeking: follow the reported time.
  useEffect(() => {
    if (!isPlaying) update(currentTime);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTime, isPlaying, indexer]);

  // Playing: follow the audio clock precisely.
  useEffect(() => {
    if (!indexer || !isPlaying) return undefined;
    let frame;
    const tick = () => {
      update(getCurrentTime());
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indexer, isPlaying, getCurrentTime]);

  return { activeIndex: active, indexer };
}
