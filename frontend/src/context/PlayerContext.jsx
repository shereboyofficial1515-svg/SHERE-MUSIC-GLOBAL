import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { musicService } from '../services/musicService.js';
import { useToast } from './ToastContext.jsx';
import { usePreferences } from './PreferencesContext.jsx';

/**
 * Persistent audio player built on ONE HTMLAudioElement that lives for the
 * whole session, so music keeps playing across every route change.
 *
 * Two contexts keep re-renders cheap: PlayerContext (track, queue, modes —
 * changes rarely) and PlayerProgressContext (time/buffer — several times a
 * second, only consumed by progress UI). Lyrics read the exact time through
 * getCurrentTime() inside requestAnimationFrame instead of re-rendering.
 */
const PlayerContext = createContext(null);
const PlayerProgressContext = createContext(null);

const PLAY_COUNT_AFTER_SECONDS = 5;
const URL_SAFETY_MARGIN_MS = 5 * 60 * 1000;
const RESUME_KEY = 'sm:resume';

const readStored = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
};
const store = (key, value) => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
};

function shuffled(list, keepFirstId) {
  const rest = list.filter((s) => s.id !== keepFirstId);
  for (let i = rest.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  const first = list.find((s) => s.id === keepFirstId);
  return first ? [first, ...rest] : rest;
}

export function PlayerProvider({ children }) {
  const toast = useToast();
  const { prefs } = usePreferences();
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
  const [volume, setVolumeState] = useState(() => {
    const v = Number(readStored('sm:volume', 0.9));
    return Number.isFinite(v) && v >= 0 && v <= 1 ? v : 0.9;
  });
  const [muted, setMuted] = useState(false);
  const [shuffle, setShuffle] = useState(() => Boolean(readStored('sm:shuffle', false)));
  const [repeat, setRepeat] = useState(() => readStored('sm:repeat', 'off')); // off | all | one
  const [view, setView] = useState('mini'); // mini | expanded | lyrics
  const [panel, setPanel] = useState('lyrics'); // expanded-view side panel: lyrics | queue | info
  const [progress, setProgress] = useState({ currentTime: 0, duration: 0, buffered: 0 });
  const progressRef = useRef(progress);
  progressRef.current = progress;

  // Refs mirror state for audio event handlers.
  const queueRef = useRef(queue);
  const indexRef = useRef(index);
  const repeatRef = useRef(repeat);
  const prefsRef = useRef(prefs);
  queueRef.current = queue;
  indexRef.current = index;
  repeatRef.current = repeat;
  prefsRef.current = prefs;
  const originalOrder = useRef(null); // queue order before shuffling
  const urlCache = useRef(new Map());
  const loadToken = useRef(0);
  const playCounted = useRef(false);
  const retriedExpired = useRef(false);
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;
  const autoplayBusy = useRef(false);

  const current = index >= 0 ? queue[index] : null;

  const getStreamUrl = useCallback(async (songId, { fresh = false } = {}) => {
    const cached = urlCache.current.get(songId);
    if (!fresh && cached && cached.expiresAt - URL_SAFETY_MARGIN_MS > Date.now()) return cached.url;
    const { data } = await musicService.streamUrl(songId);
    urlCache.current.set(songId, { url: data.url, expiresAt: Date.now() + data.expiresIn * 1000 });
    return data.url;
  }, []);

  const loadTrack = useCallback(
    async (song, { autoplay = true, startAt = 0, fresh = false, silent = false } = {}) => {
      const audio = audioRef.current;
      const token = ++loadToken.current;
      setError(null);
      setIsLoading(autoplay);
      if (!startAt) {
        playCounted.current = false;
        setProgress({ currentTime: 0, duration: song.duration || 0, buffered: 0 });
      }
      try {
        const url = await getStreamUrl(song.id, { fresh });
        if (token !== loadToken.current) return; // a newer track was requested meanwhile
        audio.src = url;
        if (startAt) {
          const seekWhenReady = () => {
            audio.currentTime = startAt;
            setProgress((p) => ({ ...p, currentTime: startAt }));
          };
          if (audio.readyState >= 1) seekWhenReady();
          else audio.addEventListener('loadedmetadata', seekWhenReady, { once: true });
        }
        if (autoplay) await audio.play();
      } catch (err) {
        if (token !== loadToken.current) return;
        setIsLoading(false);
        if (err?.name === 'NotAllowedError') return setIsPlaying(false); // autoplay blocked; user can press play
        if (err?.name === 'AbortError') return undefined;
        if (silent) {
          // A remembered song that is no longer available: start fresh instead of showing an error.
          store(RESUME_KEY, null);
          setQueue([]);
          setIndex(-1);
          return undefined;
        }
        const message =
          err?.code === 'AUDIO_MISSING'
            ? 'This song is currently unavailable.'
            : err?.code === 'NETWORK_ERROR'
              ? 'Network error. Check your connection and try again.'
              : err?.message || 'Could not play this song.';
        setError(message);
        toast.error(message);
      }
      return undefined;
    },
    [getStreamUrl, toast]
  );

  const startAt = useCallback(
    (list, i, options) => {
      if (!list[i]) return;
      setQueue(list);
      setIndex(i);
      retriedExpired.current = false;
      loadTrack(list[i], options);
    },
    [loadTrack]
  );

  /** Play a song. If `list` is given it becomes the queue (album, playlist, search results…). */
  const playSong = useCallback(
    (song, list, options) => {
      const q = queueRef.current;
      const cur = q[indexRef.current];
      if (cur?.id === song.id && (!list || list === q)) {
        const audio = audioRef.current;
        if (options?.startAt !== undefined) audio.currentTime = options.startAt;
        if (audio.paused) audio.play().catch(() => {});
        return;
      }
      if (list?.length) {
        originalOrder.current = null;
        let next = list;
        if (shuffle) {
          originalOrder.current = list;
          next = shuffled(list, song.id);
        }
        const i = next.findIndex((s) => s.id === song.id);
        startAt(next, i >= 0 ? i : 0, options);
      } else {
        const i = q.findIndex((s) => s.id === song.id);
        if (i >= 0) startAt(q, i, options);
        else startAt([song], 0, options);
      }
    },
    [startAt, shuffle]
  );

  const playList = useCallback(
    (songs, start = 0) => {
      if (!songs?.length) return;
      originalOrder.current = null;
      if (shuffle) {
        originalOrder.current = songs;
        startAt(shuffled(songs, songs[start].id), 0);
      } else startAt(songs, start);
    },
    [startAt, shuffle]
  );

  const pause = useCallback(() => audioRef.current.pause(), []);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    const song = queueRef.current[indexRef.current];
    if (!song) return;
    if (error || !audio.src) {
      loadTrack(song, { fresh: true, startAt: progressRef.current.currentTime || 0 });
      return;
    }
    if (audio.paused) audio.play().catch(() => loadTrack(song, { fresh: true, startAt: audio.currentTime }));
    else audio.pause();
  }, [error, loadTrack]);

  /** When the queue runs out: repeat-all wraps, autoplay continues with related songs, otherwise stop. */
  const continueAfterEnd = useCallback(async () => {
    const q = queueRef.current;
    if (repeatRef.current === 'all' && q.length) return startAt(q, 0);
    if (!prefsRef.current.autoplay || autoplayBusy.current) return setIsPlaying(false);
    const last = q[q.length - 1];
    if (!last) return setIsPlaying(false);
    autoplayBusy.current = true;
    try {
      const { data } = await musicService.related(last.id);
      const known = new Set(q.map((s) => s.id));
      const fresh = data.filter((s) => !known.has(s.id)).slice(0, 10);
      if (!fresh.length) return setIsPlaying(false);
      const next = [...queueRef.current, ...fresh];
      startAt(next, q.length);
      toast.info('Autoplay: continuing with similar music.');
    } catch {
      setIsPlaying(false);
    } finally {
      autoplayBusy.current = false;
    }
    return undefined;
  }, [startAt, toast]);

  const next = useCallback(() => {
    const q = queueRef.current;
    if (indexRef.current < q.length - 1) startAt(q, indexRef.current + 1);
    else continueAfterEnd();
  }, [startAt, continueAfterEnd]);

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

  const getCurrentTime = useCallback(() => audioRef.current?.currentTime || 0, []);

  const setVolume = useCallback((v) => {
    const value = Math.max(0, Math.min(1, v));
    setVolumeState(value);
    if (value > 0) setMuted(false);
    store('sm:volume', value);
  }, []);

  const toggleMute = useCallback(() => setMuted((m) => !m), []);

  const toggleShuffle = useCallback(() => {
    setShuffle((on) => {
      const nextOn = !on;
      store('sm:shuffle', nextOn);
      const q = queueRef.current;
      const cur = q[indexRef.current];
      if (q.length > 1 && cur) {
        if (nextOn) {
          originalOrder.current = q;
          const mixed = shuffled(q, cur.id);
          setQueue(mixed);
          setIndex(0);
        } else if (originalOrder.current) {
          const restored = originalOrder.current;
          const extra = q.filter((s) => !restored.some((r) => r.id === s.id));
          const list = [...restored, ...extra];
          setQueue(list);
          setIndex(Math.max(0, list.findIndex((s) => s.id === cur.id)));
          originalOrder.current = null;
        }
      }
      return nextOn;
    });
  }, []);

  const cycleRepeat = useCallback(() => {
    setRepeat((r) => {
      const nextMode = r === 'off' ? 'all' : r === 'all' ? 'one' : 'off';
      store('sm:repeat', nextMode);
      return nextMode;
    });
  }, []);

  // ─── Queue editing ──────────────────────────────────────────────────────
  const addToQueue = useCallback(
    (song, { next: playNext = false } = {}) => {
      const q = queueRef.current;
      if (!q.length) return startAt([song], 0);
      const curId = q[indexRef.current]?.id;
      const without = q.filter((s, i) => s.id !== song.id || i === indexRef.current);
      const curIndex = without.findIndex((s) => s.id === curId);
      const insertAt = playNext ? curIndex + 1 : without.length;
      const updated = [...without.slice(0, insertAt), song, ...without.slice(insertAt)];
      setQueue(updated);
      setIndex(curIndex);
      toast.success(playNext ? `"${song.title}" will play next.` : `Added "${song.title}" to the queue.`);
      return undefined;
    },
    [startAt, toast]
  );

  /** Move a queue entry; the current song keeps playing wherever it ends up. */
  const moveInQueue = useCallback((from, to) => {
    const q = queueRef.current;
    if (from === to || from < 0 || to < 0 || from >= q.length || to >= q.length) return;
    const curId = q[indexRef.current]?.id;
    const list = [...q];
    const [item] = list.splice(from, 1);
    list.splice(to, 0, item);
    setQueue(list);
    setIndex(list.findIndex((s) => s.id === curId));
  }, []);

  const removeFromQueue = useCallback(
    (i) => {
      const q = queueRef.current;
      if (i === indexRef.current) {
        // Removing the playing song skips to the next one.
        const list = q.filter((_, k) => k !== i);
        if (!list.length) {
          audioRef.current.pause();
          audioRef.current.removeAttribute('src');
          setQueue([]);
          setIndex(-1);
          setView('mini');
          return;
        }
        startAt(list, Math.min(i, list.length - 1));
        return;
      }
      const curId = q[indexRef.current]?.id;
      const list = q.filter((_, k) => k !== i);
      setQueue(list);
      setIndex(list.findIndex((s) => s.id === curId));
    },
    [startAt]
  );

  /** Clear everything after the current song. */
  const clearQueue = useCallback(() => {
    const cur = queueRef.current[indexRef.current];
    setQueue(cur ? [cur] : []);
    setIndex(cur ? 0 : -1);
    originalOrder.current = null;
  }, []);

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
      if (repeatRef.current === 'one') {
        audio.currentTime = 0;
        playCounted.current = false;
        audio.play().catch(() => {});
        return;
      }
      const q = queueRef.current;
      if (indexRef.current < q.length - 1) startAt(q, indexRef.current + 1);
      else continueAfterEnd();
    };
    const onError = () => {
      if (!audio.src || audio.error?.code === MediaError.MEDIA_ERR_ABORTED) return;
      const song = queueRef.current[indexRef.current];
      // A signed URL may have expired after a long pause: fetch a fresh one once and resume.
      if (song && !retriedExpired.current) {
        retriedExpired.current = true;
        loadTrack(song, { fresh: true, startAt: audio.currentTime || 0, autoplay: isPlayingRef.current });
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
  }, [loadTrack, startAt, continueAfterEnd, toast]);

  // ─── Remember playback position (per device) ───────────────────────────
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    if (!prefs.rememberPosition) return;
    const saved = readStored(RESUME_KEY, null);
    if (!saved?.queue?.length || !saved.queue[saved.index]) return;
    setQueue(saved.queue);
    setIndex(saved.index);
    setProgress({ currentTime: saved.time || 0, duration: saved.queue[saved.index].duration || 0, buffered: 0 });
    // Load paused at the saved time; the listener presses play to continue.
    loadTrack(saved.queue[saved.index], { autoplay: false, startAt: saved.time || 0, silent: true });
  }, [prefs.rememberPosition, loadTrack]);

  useEffect(() => {
    if (!prefs.rememberPosition) {
      store(RESUME_KEY, null);
      return undefined;
    }
    const save = () => {
      const q = queueRef.current;
      if (!q.length || indexRef.current < 0) return;
      store(RESUME_KEY, { queue: q.slice(0, 200), index: indexRef.current, time: Math.floor(audioRef.current.currentTime || 0) });
    };
    const timer = window.setInterval(save, 5000);
    window.addEventListener('pagehide', save);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('pagehide', save);
    };
  }, [prefs.rememberPosition]);

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
      shuffle,
      repeat,
      view,
      panel,
      hasNext: index < queue.length - 1 || repeat === 'all',
      hasPrevious: index > 0,
      playSong,
      playList,
      toggle,
      pause,
      next,
      previous,
      seek,
      getCurrentTime,
      setVolume,
      toggleMute,
      toggleShuffle,
      cycleRepeat,
      addToQueue,
      moveInQueue,
      removeFromQueue,
      clearQueue,
      setView,
      setPanel,
      // v1 compatibility
      expanded: view !== 'mini',
      setExpanded: (open) => setView(open ? 'expanded' : 'mini'),
      isCurrent: (id) => current?.id === id,
    }),
    [current, queue, index, isPlaying, isLoading, error, volume, muted, shuffle, repeat, view, panel, playSong, playList, toggle, pause, next, previous, seek, getCurrentTime, setVolume, toggleMute, toggleShuffle, cycleRepeat, addToQueue, moveInQueue, removeFromQueue, clearQueue]
  );

  return (
    <PlayerContext.Provider value={value}>
      <PlayerProgressContext.Provider value={progress}>{children}</PlayerProgressContext.Provider>
    </PlayerContext.Provider>
  );
}

export const usePlayer = () => useContext(PlayerContext);
export const usePlayerProgress = () => useContext(PlayerProgressContext);
