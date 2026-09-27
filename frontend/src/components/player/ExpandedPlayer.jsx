import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../ui/Icon.jsx';
import Artwork from '../ui/Artwork.jsx';
import LyricsView, { LyricsState } from '../lyrics/LyricsView.jsx';
import QueuePanel from './QueuePanel.jsx';
import { PlayPauseButton, SeekBar, Transport, Visualizer, VolumeControl } from './Controls.jsx';
import { DownloadButton, FavoriteButton, shareSong } from '../music/SongActions.jsx';
import { usePlayer } from '../../context/PlayerContext.jsx';
import { useLibrary } from '../../context/LibraryContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import { useScrollLock } from '../../hooks/useScrollLock.js';
import { useLyricSync, useSongLyrics } from '../../hooks/useLyrics.js';
import { useArtworkColors } from '../../utils/artworkColors.js';
import { gsap, motionOK, useGSAP } from '../../utils/motion.js';
import { formatCount, formatDate } from '../../utils/format.js';

const TABS = [
  { id: 'lyrics', label: 'Lyrics' },
  { id: 'queue', label: 'Up next' },
  { id: 'info', label: 'Info' },
];

export function useLyricsForCurrent(enabled) {
  const { current, seek } = usePlayer();
  const { settings } = useSettings();
  const lyricsState = useSongLyrics(current?.id, { enabled: enabled && settings.lyricsEnabled !== false });
  const { activeIndex } = useLyricSync(lyricsState.lyrics);
  return { ...lyricsState, activeIndex, seek };
}

function InfoPanel({ song }) {
  return (
    <dl className="info-list">
      <div>
        <dt>Artist</dt>
        <dd>
          <Link to={`/artists/${song.artist.id}`}>{song.artist.name}</Link>
        </dd>
      </div>
      {song.album ? (
        <div>
          <dt>Album</dt>
          <dd>
            <Link to={`/albums/${song.album.id}`}>{song.album.title}</Link>
          </dd>
        </div>
      ) : null}
      {song.genre ? (
        <div>
          <dt>Genre</dt>
          <dd>
            <Link to={`/genres/${song.genre.slug}`}>{song.genre.name}</Link>
          </dd>
        </div>
      ) : null}
      {song.releaseDate ? (
        <div>
          <dt>Released</dt>
          <dd>{formatDate(song.releaseDate)}</dd>
        </div>
      ) : null}
      <div>
        <dt>Plays</dt>
        <dd>{formatCount(song.playCount)}</dd>
      </div>
      <div>
        <dt>Downloads</dt>
        <dd>{formatCount(song.downloadCount)}</dd>
      </div>
      <div>
        <dt>Song page</dt>
        <dd>
          <Link to={`/song/${song.id}`}>Open</Link>
        </dd>
      </div>
    </dl>
  );
}

/** Large player: artwork, controls, and a Lyrics / Up next / Info panel. */
export default function ExpandedPlayer({ onClose, onLyricsMode }) {
  const { current, error, isPlaying, panel, setPanel } = usePlayer();
  const { openAddToPlaylist } = useLibrary();
  const toast = useToast();
  const colors = useArtworkColors(current.artworkUrl);
  const rootRef = useRef(null);
  const artRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement));
  const lyrics = useLyricsForCurrent(panel === 'lyrics');
  useScrollLock(true);

  // Entrance
  useGSAP(
    () => {
      if (!motionOK()) return;
      gsap.from(rootRef.current, { yPercent: 6, autoAlpha: 0, duration: 0.45, ease: 'power3.out' });
      gsap.from('.xp__main > *', { y: 18, autoAlpha: 0, stagger: 0.05, duration: 0.5, delay: 0.08 });
    },
    { scope: rootRef }
  );

  // Artwork "breathes" while music plays and settles when paused.
  useGSAP(
    () => {
      const el = artRef.current;
      if (!el) return;
      if (!motionOK()) return gsap.set(el, { scale: 1, rotate: 0 });
      if (isPlaying) {
        gsap.to(el, { scale: 1.025, rotate: 0.6, duration: 2.6, ease: 'sine.inOut', repeat: -1, yoyo: true, overwrite: true });
      } else {
        gsap.to(el, { scale: 0.95, rotate: 0, duration: 0.5, ease: 'power2.out', overwrite: true });
      }
      return undefined;
    },
    { dependencies: [isPlaying, current.id] }
  );

  const close = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    if (!motionOK()) return onClose();
    gsap.to(rootRef.current, { yPercent: 6, autoAlpha: 0, duration: 0.3, ease: 'power2.in', onComplete: onClose });
    return undefined;
  }, [onClose]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && !document.fullscreenElement && close();
    const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('keydown', onKey);
    document.addEventListener('fullscreenchange', onFs);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('fullscreenchange', onFs);
    };
  }, [close]);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else rootRef.current?.requestFullscreen?.().catch(() => toast.error('Fullscreen is not available in this browser.'));
  };

  return (
    <div
      ref={rootRef}
      className="xp force-dark"
      role="dialog"
      aria-modal="true"
      aria-label={`Now playing: ${current.title} by ${current.artist.name}`}
      style={colors ? { '--c1': colors.primary, '--c2': colors.secondary } : undefined}
    >
      <div className="xp__bg" aria-hidden="true" />
      <header className="xp__header">
        <button type="button" className="icon-btn" onClick={close} aria-label="Minimise player" autoFocus>
          <Icon name="chevron-down" size={24} />
        </button>
        <span className="xp__label">
          <strong>Now playing</strong>
          {current.album ? <span>{current.album.title}</span> : null}
        </span>
        <span className="row-gap" style={{ gap: 2 }}>
          <button type="button" className="icon-btn" onClick={onLyricsMode} aria-label="Lyrics mode" title="Lyrics mode">
            <Icon name="lyrics" size={20} />
          </button>
          {document.fullscreenEnabled ? (
            <button type="button" className="icon-btn" onClick={toggleFullscreen} aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen listening mode'} title="Fullscreen">
              <Icon name={isFullscreen ? 'minimize' : 'maximize'} size={20} />
            </button>
          ) : null}
        </span>
      </header>

      <div className="xp__body">
        <section className="xp__main" aria-label="Player controls">
          <div className="xp__art-wrap" ref={artRef}>
            <Artwork src={current.artworkUrl} alt={`${current.title} artwork`} className="xp__art" eager />
          </div>
          <div className="xp__info">
            <div className="xp__titles">
              <Link to={`/song/${current.id}`} className="xp__title" onClick={close}>
                {current.title}
              </Link>
              <Link to={`/artists/${current.artist.id}`} className="xp__artist" onClick={close}>
                {current.artist.name}
                {current.artist.verified ? <Icon name="badge-check" size={15} className="text-accent" title="Verified artist" /> : null}
              </Link>
            </div>
            <FavoriteButton song={current} />
          </div>
          {error ? (
            <p className="player-error" role="alert">
              <Icon name="alert-circle" size={16} /> {error}
            </p>
          ) : null}
          <SeekBar />
          <Transport large withModes />
          <Visualizer />
          <div className="xp__actions">
            <VolumeControl />
            <div className="row-gap" style={{ gap: 2 }}>
              <button type="button" className="icon-btn" onClick={() => openAddToPlaylist(current)} aria-label="Add to playlist" title="Add to playlist">
                <Icon name="list-plus" size={20} />
              </button>
              <DownloadButton song={current} />
              <button type="button" className="icon-btn" onClick={() => shareSong(current, toast)} aria-label="Share" title="Share">
                <Icon name="share" size={19} />
              </button>
            </div>
          </div>
        </section>

        <section className="xp__panel" aria-label="Lyrics, queue and song information">
          <div className="xp__tabs" role="tablist">
            {TABS.map((t) => (
              <button key={t.id} type="button" role="tab" className="xp__tab" aria-selected={panel === t.id} onClick={() => setPanel(t.id)}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="xp__panel-body" role="tabpanel">
            {panel === 'lyrics' ? (
              lyrics.lyrics ? (
                <LyricsView lyrics={lyrics.lyrics} activeIndex={lyrics.activeIndex} onSeek={lyrics.seek} />
              ) : (
                <LyricsState loading={lyrics.loading} error={lyrics.error} onRetry={lyrics.retry} empty />
              )
            ) : panel === 'queue' ? (
              <QueuePanel />
            ) : (
              <InfoPanel song={current} />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export { PlayPauseButton };
