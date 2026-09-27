import { useCallback, useEffect, useRef, useState } from 'react';
import Icon from '../ui/Icon.jsx';
import { Spinner } from '../ui/Feedback.jsx';
import { useDismiss } from '../../hooks/useDismiss.js';
import { usePlayer } from '../../context/PlayerContext.jsx';
import { usePreferences } from '../../context/PreferencesContext.jsx';
import { videoService } from '../../services/musicService.js';
import { cx, formatDuration } from '../../utils/format.js';

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const VIEW_AFTER_SECONDS = 10;
const HIDE_CONTROLS_MS = 2600;

function Menu({ label, icon, children, disabled }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);
  return (
    <div className="vp__menu" ref={ref}>
      <button type="button" className="vp__btn" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} aria-label={label} title={label} disabled={disabled}>
        <Icon name={icon} size={20} />
      </button>
      {open ? (
        <div className="vp__popover" role="menu" onClick={close}>
          {children}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Custom music-video player on top of a native <video>. Captions use the
 * browser's WebVTT engine through <track> elements; the track files are
 * fetched once and served from same-origin blob: URLs so no CORS setup is
 * needed. Keyboard: Space/K play, F fullscreen, M mute, C captions,
 * ←/→ seek 5s, J/L seek 10s, ↑/↓ volume, Shift+>/< speed, 0–9 jump.
 */
export default function VideoPlayer({ video, fetchStream = videoService.stream, fetchSubtitle, onViewed }) {
  const { pause: pauseMusic } = usePlayer();
  const { prefs, update } = usePreferences();
  const wrapRef = useRef(null);
  const videoRef = useRef(null);
  const hideTimer = useRef(null);
  const viewed = useRef(false);
  const retried = useRef(false);

  const [source, setSource] = useState(null); // { url, qualities }
  const [quality, setQuality] = useState(null);
  const [tracks, setTracks] = useState([]); // [{ id, language, label, src }]
  const [captionLang, setCaptionLang] = useState(null);
  const [state, setState] = useState({ playing: false, waiting: true, time: 0, duration: video.duration || 0, buffered: 0, volume: 1, muted: false, rate: 1 });
  const [error, setError] = useState(null);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // 1. Stream URL
  useEffect(() => {
    let cancelled = false;
    setError(null);
    setSource(null);
    fetchStream(video.id)
      .then(({ data }) => !cancelled && setSource(data))
      .catch((err) => !cancelled && setError(err.message || 'This video could not be loaded.'));
    return () => {
      cancelled = true;
    };
  }, [video.id, fetchStream, attempt]);

  // 2. Subtitle tracks → blob URLs
  useEffect(() => {
    let cancelled = false;
    const urls = [];
    const load = async () => {
      const loaded = [];
      for (const sub of video.subtitles || []) {
        try {
          const src = fetchSubtitle ? await fetchSubtitle(sub) : await videoService.subtitleBlobUrl(video.id, sub.id);
          urls.push(src);
          loaded.push({ ...sub, src });
        } catch {
          /* one missing track shouldn't break playback */
        }
      }
      if (cancelled) return;
      setTracks(loaded);
      // Default: the listener's saved caption language, the video's default track, else off.
      const preferred = prefs.captionsEnabled ? loaded.find((t) => t.language === prefs.subtitleLanguage) || loaded.find((t) => t.isDefault) || loaded[0] : null;
      setCaptionLang(preferred?.language || null);
    };
    load();
    return () => {
      cancelled = true;
      urls.forEach((u) => u.startsWith('blob:') && URL.revokeObjectURL(u));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video.id, video.subtitles]);

  // 3. Apply caption selection to the native text tracks
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    for (const track of el.textTracks) track.mode = track.language === captionLang ? 'showing' : 'disabled';
  }, [captionLang, tracks]);

  const src = quality ? source?.qualities?.find((q) => q.label === quality)?.url : source?.url;

  const showControls = useCallback(() => {
    setControlsVisible(true);
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      if (!videoRef.current?.paused) setControlsVisible(false);
    }, HIDE_CONTROLS_MS);
  }, []);

  const togglePlay = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) el.play().catch(() => {});
    else el.pause();
  }, []);

  const seekBy = useCallback((delta) => {
    const el = videoRef.current;
    if (el) el.currentTime = Math.max(0, Math.min((el.duration || 0) - 0.1, el.currentTime + delta));
  }, []);

  const setVolume = (v) => {
    const el = videoRef.current;
    if (!el) return;
    el.volume = Math.max(0, Math.min(1, v));
    el.muted = el.volume === 0;
  };

  const setRate = (r) => {
    if (videoRef.current) videoRef.current.playbackRate = r;
  };

  const chooseCaptions = (lang) => {
    setCaptionLang(lang);
    update({ captionsEnabled: Boolean(lang), ...(lang ? { subtitleLanguage: lang } : {}) }).catch(() => {});
  };

  const toggleFullscreen = useCallback(() => {
    const el = wrapRef.current;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else if (el?.requestFullscreen) el.requestFullscreen().catch(() => {});
    else videoRef.current?.webkitEnterFullscreen?.(); // iOS Safari
  }, []);

  const togglePip = async () => {
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await videoRef.current.requestPictureInPicture();
    } catch {
      /* not allowed right now */
    }
  };

  const changeQuality = (label) => {
    const el = videoRef.current;
    const at = el?.currentTime || 0;
    const wasPlaying = el && !el.paused;
    setQuality(label);
    requestAnimationFrame(() => {
      const v = videoRef.current;
      if (!v) return;
      v.addEventListener(
        'loadedmetadata',
        () => {
          v.currentTime = at;
          if (wasPlaying) v.play().catch(() => {});
        },
        { once: true }
      );
    });
  };

  // Media element events
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return undefined;
    const sync = () =>
      setState((s) => ({
        ...s,
        playing: !el.paused,
        time: el.currentTime,
        duration: Number.isFinite(el.duration) ? el.duration : s.duration,
        volume: el.volume,
        muted: el.muted,
        rate: el.playbackRate,
        buffered: el.buffered.length ? el.buffered.end(el.buffered.length - 1) : s.buffered,
      }));
    const onPlay = () => {
      pauseMusic(); // never play the music player and a video at the same time
      sync();
      showControls();
    };
    const onTime = () => {
      sync();
      if (!viewed.current && el.currentTime >= VIEW_AFTER_SECONDS) {
        viewed.current = true;
        onViewed?.();
      }
    };
    const onWaiting = () => setState((s) => ({ ...s, waiting: true }));
    const onReady = () => setState((s) => ({ ...s, waiting: false }));
    const onPause = () => {
      sync();
      setControlsVisible(true);
    };
    const onError = () => {
      if (!el.getAttribute('src')) return;
      if (!retried.current) {
        retried.current = true; // signed URL may have expired: fetch a new one once
        setAttempt((a) => a + 1);
        return;
      }
      setError(navigator.onLine ? 'This video could not be played.' : 'You are offline. Reconnect to keep watching.');
    };
    const handlers = { play: onPlay, pause: onPause, timeupdate: onTime, durationchange: sync, volumechange: sync, ratechange: sync, progress: sync, waiting: onWaiting, playing: onReady, canplay: onReady, error: onError, ended: onPause };
    Object.entries(handlers).forEach(([n, f]) => el.addEventListener(n, f));
    return () => Object.entries(handlers).forEach(([n, f]) => el.removeEventListener(n, f));
  }, [src, pauseMusic, showControls, onViewed]);

  useEffect(() => {
    const onFs = () => setIsFullscreen(document.fullscreenElement === wrapRef.current);
    document.addEventListener('fullscreenchange', onFs);
    return () => {
      document.removeEventListener('fullscreenchange', onFs);
      window.clearTimeout(hideTimer.current);
    };
  }, []);

  // Keyboard shortcuts while the player has focus
  const onKeyDown = (e) => {
    if (e.target.closest('input, select, [role="menu"]')) return;
    const el = videoRef.current;
    if (!el) return;
    const key = e.key.toLowerCase();
    const handled = true;
    if (key === ' ' || key === 'k') togglePlay();
    else if (key === 'f') toggleFullscreen();
    else if (key === 'm') el.muted = !el.muted;
    else if (key === 'c' && tracks.length) chooseCaptions(captionLang ? null : prefs.subtitleLanguage || tracks[0].language);
    else if (key === 'arrowleft') seekBy(-5);
    else if (key === 'arrowright') seekBy(5);
    else if (key === 'j') seekBy(-10);
    else if (key === 'l') seekBy(10);
    else if (key === 'arrowup') setVolume(el.volume + 0.1);
    else if (key === 'arrowdown') setVolume(el.volume - 0.1);
    else if (e.shiftKey && (key === '>' || key === '.')) setRate(SPEEDS[Math.min(SPEEDS.length - 1, SPEEDS.indexOf(el.playbackRate) + 1)] || 1);
    else if (e.shiftKey && (key === '<' || key === ',')) setRate(SPEEDS[Math.max(0, SPEEDS.indexOf(el.playbackRate) - 1)] || 1);
    else if (/^[0-9]$/.test(key) && el.duration) el.currentTime = (Number(key) / 10) * el.duration;
    else return;
    if (handled) {
      e.preventDefault();
      showControls();
    }
  };

  const { playing, waiting, time, duration, buffered, volume, muted, rate } = state;
  const pct = duration ? (time / duration) * 100 : 0;
  const bufPct = duration ? Math.min(100, (buffered / duration) * 100) : 0;
  const effectiveVolume = muted ? 0 : volume;
  const pipSupported = typeof document !== 'undefined' && document.pictureInPictureEnabled;

  return (
    <div
      ref={wrapRef}
      className={cx('vp force-dark', !controlsVisible && playing && 'vp--idle', isFullscreen && 'vp--fullscreen')}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onPointerMove={showControls}
      aria-label={`Video player: ${video.title}. Press Space to play or pause.`}
    >
      {src ? (
        <video
          ref={videoRef}
          className="vp__video"
          src={src}
          poster={video.thumbnailUrl || undefined}
          preload="metadata"
          playsInline
          onClick={togglePlay}
          onDoubleClick={toggleFullscreen}
        >
          {tracks.map((t) => (
            <track key={t.id} kind="subtitles" srcLang={t.language} label={t.label} src={t.src} />
          ))}
        </video>
      ) : null}

      {error ? (
        <div className="vp__overlay" role="alert">
          <Icon name="alert-triangle" size={32} />
          <p>{error}</p>
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={() => {
              retried.current = false;
              setAttempt((a) => a + 1);
            }}
          >
            Try again
          </button>
        </div>
      ) : !src || (waiting && playing) ? (
        <div className="vp__overlay vp__overlay--quiet">
          <Spinner size={36} label="Loading video" />
        </div>
      ) : !playing && time === 0 ? (
        <button type="button" className="vp__big-play" onClick={togglePlay} aria-label={`Play ${video.title}`}>
          <Icon name="play" size={34} />
        </button>
      ) : null}

      <div className="vp__controls" onClick={(e) => e.stopPropagation()}>
        <input
          type="range"
          className="range range--seek vp__seek"
          min={0}
          max={duration || 1}
          step="any"
          value={Math.min(time, duration || 1)}
          onChange={(e) => {
            if (videoRef.current) videoRef.current.currentTime = Number(e.target.value);
          }}
          aria-label="Seek"
          aria-valuetext={`${formatDuration(time)} of ${formatDuration(duration)}`}
          disabled={!src}
          style={{ '--pct': `${pct}%`, '--buf': `${bufPct}%` }}
        />
        <div className="vp__bar">
          <button type="button" className="vp__btn" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'} disabled={!src}>
            <Icon name={playing ? 'pause' : 'play'} size={22} />
          </button>
          <button type="button" className="vp__btn hide-xs" onClick={() => seekBy(-10)} aria-label="Back 10 seconds" disabled={!src}>
            <Icon name="skip-back" size={18} />
          </button>
          <button type="button" className="vp__btn hide-xs" onClick={() => seekBy(10)} aria-label="Forward 10 seconds" disabled={!src}>
            <Icon name="skip-forward" size={18} />
          </button>
          <div className="vp__volume">
            <button
              type="button"
              className="vp__btn"
              onClick={() => {
                if (videoRef.current) videoRef.current.muted = !videoRef.current.muted;
              }}
              aria-label={muted ? 'Unmute' : 'Mute'}
              aria-pressed={muted}
            >
              <Icon name={effectiveVolume === 0 ? 'volume-x' : effectiveVolume < 0.5 ? 'volume-low' : 'volume'} size={20} />
            </button>
            <input
              type="range"
              className="range hide-sm"
              min={0}
              max={1}
              step={0.01}
              value={effectiveVolume}
              onChange={(e) => setVolume(Number(e.target.value))}
              aria-label="Volume"
              style={{ '--pct': `${effectiveVolume * 100}%` }}
            />
          </div>
          <span className="vp__time">
            {formatDuration(time)} / {formatDuration(duration)}
          </span>
          <span style={{ flex: 1 }} />

          <Menu label={tracks.length ? `Subtitles: ${captionLang ? tracks.find((t) => t.language === captionLang)?.label : 'Off'}` : 'No subtitles available'} icon="captions" disabled={!tracks.length}>
            <button type="button" role="menuitemradio" aria-checked={!captionLang} className="menu__item" onClick={() => chooseCaptions(null)}>
              Off
            </button>
            {tracks.map((t) => (
              <button key={t.id} type="button" role="menuitemradio" aria-checked={captionLang === t.language} className="menu__item" onClick={() => chooseCaptions(t.language)}>
                {t.label}
              </button>
            ))}
          </Menu>

          <Menu label={`Playback speed: ${rate}×`} icon="gauge">
            {SPEEDS.map((s) => (
              <button key={s} type="button" role="menuitemradio" aria-checked={rate === s} className="menu__item" onClick={() => setRate(s)}>
                {s === 1 ? 'Normal' : `${s}×`}
              </button>
            ))}
          </Menu>

          {source?.qualities?.length ? (
            <Menu label={`Quality: ${quality || 'Original'}`} icon="settings">
              <button type="button" role="menuitemradio" aria-checked={!quality} className="menu__item" onClick={() => changeQuality(null)}>
                Original
              </button>
              {source.qualities.map((q) => (
                <button key={q.label} type="button" role="menuitemradio" aria-checked={quality === q.label} className="menu__item" onClick={() => changeQuality(q.label)}>
                  {q.label}
                </button>
              ))}
            </Menu>
          ) : null}

          {pipSupported ? (
            <button type="button" className="vp__btn hide-xs" onClick={togglePip} aria-label="Picture in picture" title="Picture in picture" disabled={!src}>
              <Icon name="pip" size={20} />
            </button>
          ) : null}
          <button type="button" className="vp__btn" onClick={toggleFullscreen} aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'} title="Fullscreen (F)">
            <Icon name={isFullscreen ? 'minimize' : 'maximize'} size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
