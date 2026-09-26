import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { musicService } from '../services/musicService.js';
import { useToast } from './ToastContext.jsx';

/**
 * Persistent audio player built on a single HTMLAudioElement.
 *
 * Two contexts keep re-renders cheap: PlayerContext (track, queue, play state —
 * changes rarely) and PlayerProgressContext (time/buffer — changes several
 * times a second and is only consumed by the player bar).
 */
const PlayerContext = createContext(null);
const PlayerProgressContext = createContext(null);

const PLAY_COUNT_AFTER_SECONDS = 5;
const URL_SAFETY_MARGIN_MS = 5 * 60 * 1000;

const readVolume = () => {
  try {
    const v = Number(localStorage.getItem('sm:volume'));
    return Number.isFinite(v) && v >= 0 && v <= 1 && localStorage.getItem('sm:volume') !== null ? v : 0.9;
  } catch {
    return 0.9;
  }
};

export function PlayerProvider({ children }) {
  const toast = useToast();
  const audioRef = useRef(null);
  if (!audioRef.current && typeof Audio !== 'undefined') {
    audioRef.current = new Audio();
    audioRef.current.preload = 'metadata';
  }

  const [queue, setQueue] = useState([]);
  const [index, setIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [volume, setVolumeState] = useState(readVolume);
  const [muted, setMuted] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [progress, setProgress] = useState({ currentTime: 0, duration: 0, buffered: 0 });

  // Refs mirror state for use inside audio event handlers.
  const queueRef = useRef(queue);
  const indexRef = useRef(index);
  queueRef.current = queue;
  indexRef.current = index;
  const urlCache = useRef(new Map()); // songId → { url, expiresAt }
  const loadToken = useRef(0);
  const playCounted = useRef(false);
  const retriedExpired = useRef(false);
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  const current = index >= 0 ? queue[index] : null;

  const getStreamUrl = useCallback(async (songId, { fresh = false } = {}) => {
    const cached = urlCache.current.get(songId);
    if (!fresh && cached && cached.expiresAt - URL_SAFETY_MARGIN_MS > Date.now()) return cached.url;
    const { data } = await musicService.streamUrl(songId);
    urlCache.current.set(songId, { url: data.url, expiresAt: Date.now() + data.expiresIn * 1000 });
    return data.url;
  }, []);

  const loadTrack = useCallback(
    async (song, { autoplay = true, startAt = 0, fresh = false } = {}) => {
      const audio = audioRef.current;
      const token = ++loadToken.current;
      setError(null);
      setIsLoading(true);
      playCounted.current = startAt > 0 ? playCounted.current : false;
      if (!startAt) setProgress({ currentTime: 0, duration: song.duration || 0, buffered: 0 });
      try {
        const url = await getStreamUrl(song.id, { fresh });
        if (token !== loadToken.current) return; // a newer track was requested meanwhile
        audio.src = url;
        if (startAt) audio.currentTime = startAt;
        if (autoplay) await audio.play();
      } catch (err) {
        if (token !== loadToken.current) return;
        setIsLoading(false);
        if (err?.name === 'NotAllowedError') {
          setIsPlaying(false); // browser blocked autoplay; user can press play
          return;
        }
        if (err?.name === 'AbortError') return;
        const message =
          err?.code === 'AUDIO_MISSING'
            ? 'This song is currently unavailable.'
            : err?.code === 'NETWORK_ERROR'
              ? 'Network error. Check your connection and try again.'
              : err?.message || 'Could not play this song.';
        setError(message);
        toast.error(message);
      }
    },
    [getStreamUrl, toast]
  );

  const startAt = useCallback(
    (list, i) => {
      if (!list[i]) return;
      setQueue(list);
      setIndex(i);
      retriedExpired.current = false;
      loadTrack(list[i]);
    },
    [loadTrack]
  );

  /** Play a song. If `list` is given it becomes the queue (e.g. an album or search results). */
  const playSong = useCallback(
    (song, list) => {
      const q = queueRef.current;
      const cur = q[indexRef.current];
      if (cur?.id === song.id && (!list || list === q)) {
        const audio = audioRef.current;
        if (audio.paused) audio.play().catch(() => {});
        return;
      }
      if (list?.length) {
        const i = list.findIndex((s) => s.id === song.id);
        startAt(list, i >= 0 ? i : 0);
      } else {
        const i = q.findIndex((s) => s.id === song.id);
        if (i >= 0) startAt(q, i);
        else startAt([song], 0);
      }
    },
    [startAt]
  );

  const playList = useCallback((songs, start = 0) => songs?.length && startAt(songs, start), [startAt]);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    const song = queueRef.current[indexRef.current];
    if (!song) return;
    if (error || !audio.src) {
      loadTrack(song, { fresh: true });
      return;
    }
    if (audio.paused) audio.play().catch(() => loadTrack(song, { fresh: true, startAt: audio.currentTime }));
    else audio.pause();
  }, [error, loadTrack]);

  const next = useCallback(() => {
    const q = queueRef.current;
    if (indexRef.current < q.length - 1) startAt(q, indexRef.current + 1);
  }, [startAt]);

  const previous = useCallback(() => {
    const audio = audioRef.current;
    if (audio.currentTime > 3 || indexRef.current <= 0) {
      audio.currentTime = 0;
      return;
    }
    startAt(queueRef.current, indexRef.current - 1);
  }, [startAt]);

  const seek = useCallback((time) => {
    const audio = audioRef.current;
    if (!Number.isFinite(time)) return;
    audio.currentTime = Math.max(0, Math.min(time, audio.duration || time));
    setProgress((p) => ({ ...p, currentTime: audio.currentTime }));
  }, []);

  const setVolume = useCallback((v) => {
    const value = Math.max(0, Math.min(1, v));
    setVolumeState(value);
    if (value > 0) setMuted(false);
    try {
      localStorage.setItem('sm:volume', String(value));
    } catch {
      /* storage unavailable */
    }
  }, []);

  const toggleMute = useCallback(() => setMuted((m) => !m), []);

  const addToQueue = useCallback(
    (song, { next: playNext = false } = {}) => {
      const q = queueRef.current;
      if (!q.length) return startAt([song], 0);
      const without = q.filter((s, i) => s.id !== song.id || i === indexRef.current);
      const curIndex = without.findIndex((s) => s.id === q[indexRef.current]?.id);
      const insertAt = playNext ? curIndex + 1 : without.length;
      const updated = [...without.slice(0, insertAt), song, ...without.slice(insertAt)];
      setQueue(updated);
      setIndex(curIndex);
      toast.success(playNext ? `"${song.title}" will play next.` : `Added "${song.title}" to the queue.`);
    },
    [startAt, toast]
  );

  // Apply volume / mute
  useEffect(() => {
    audioRef.current.volume = volume;
    audioRef.current.muted = muted;
  }, [volume, muted]);

  // Audio element events
  useEffect(() => {
    const audio = audioRef.current;
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onWaiting = () => setIsLoading(true);
    const onPlaying = () => {
      retriedExpired.current = false;
      setIsLoading(false);
      setIsPlaying(true);
    };
    const onCanPlay = () => setIsLoading(false);
    const onTime = () => {
      setProgress((p) => ({ ...p, currentTime: audio.currentTime }));
      if (!playCounted.current && audio.currentTime >= PLAY_COUNT_AFTER_SECONDS) {
        playCounted.current = true;
        const song = queueRef.current[indexRef.current];
        if (song) musicService.recordPlay(song.id).catch(() => {});
      }
    };
    const onDuration = () => Number.isFinite(audio.duration) && setProgress((p) => ({ ...p, duration: audio.duration }));
    const onProgress = () => {
      if (audio.buffered.length) setProgress((p) => ({ ...p, buffered: audio.buffered.end(audio.buffered.length - 1) }));
    };
    const onEnded = () => {
      const q = queueRef.current;
      if (indexRef.current < q.length - 1) startAt(q, indexRef.current + 1);
      else setIsPlaying(false);
    };
    const onError = () => {
      if (!audio.src || audio.error?.code === MediaError.MEDIA_ERR_ABORTED) return;
      const song = queueRef.current[indexRef.current];
      // A signed URL may have expired after a long pause: fetch a fresh one once and resume.
      if (song && !retriedExpired.current) {
        retriedExpired.current = true;
        loadTrack(song, { fresh: true, startAt: audio.currentTime || 0, autoplay: !audio.paused || isPlayingRef.current });
        return;
      }
      setIsLoading(false);
      setIsPlaying(false);
      const message = navigator.onLine ? 'This song could not be played.' : 'You are offline. Reconnect to keep listening.';
      setError(message);
      toast.error(message);
    };

    const events = {
      play: onPlay,
      pause: onPause,
      waiting: onWaiting,
      playing: onPlaying,
      canplay: onCanPlay,
      timeupdate: onTime,
      durationchange: onDuration,
      loadedmetadata: onDuration,
      progress: onProgress,
      ended: onEnded,
      error: onError,
    };
    Object.entries(events).forEach(([name, fn]) => audio.addEventListener(name, fn));
    return () => Object.entries(events).forEach(([name, fn]) => audio.removeEventListener(name, fn));
  }, [loadTrack, startAt, toast]);

  // Lock-screen / hardware media keys
  useEffect(() => {
    if (!('mediaSession' in navigator) || !current) return;
    navigator.mediaSession.metadata = new window.MediaMetadata({
      title: current.title,
      artist: current.artist?.name || '',
      album: current.album?.title || '',
      artwork: current.artworkUrl ? [{ src: current.artworkUrl, sizes: '512x512' }] : [],
    });
    const handlers = {
      play: () => audioRef.current.play().catch(() => {}),
      pause: () => audioRef.current.pause(),
      previoustrack: previous,
      nexttrack: next,
      seekto: (d) => seek(d.seekTime),
    };
    Object.entries(handlers).forEach(([action, fn]) => {
      try {
        navigator.mediaSession.setActionHandler(action, fn);
      } catch {
        /* unsupported action */
      }
    });
  }, [current, next, previous, seek]);

  const value = useMemo(
    () => ({
      current,
      queue,
      index,
      isPlaying,
      isLoading,
      error,
      volume,
      muted,
      expanded,
      hasNext: index < queue.length - 1,
      hasPrevious: index > 0,
      playSong,
      playList,
      toggle,
      next,
      previous,
      seek,
      setVolume,
      toggleMute,
      addToQueue,
      setExpanded,
      isCurrent: (id) => current?.id === id,
    }),
    [current, queue, index, isPlaying, isLoading, error, volume, muted, expanded, playSong, playList, toggle, next, previous, seek, setVolume, toggleMute, addToQueue]
  );

  return (
    <PlayerContext.Provider value={value}>
      <PlayerProgressContext.Provider value={progress}>{children}</PlayerProgressContext.Provider>
    </PlayerContext.Provider>
  );
}

export const usePlayer = () => useContext(PlayerContext);
export const usePlayerProgress = () => useContext(PlayerProgressContext);
