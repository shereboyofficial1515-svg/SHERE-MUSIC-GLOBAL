import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../ui/Icon.jsx';
import Artwork from '../ui/Artwork.jsx';
import { Spinner } from '../ui/Feedback.jsx';
import { DownloadButton, FavoriteButton } from './SongActions.jsx';
import { usePlayer, usePlayerProgress } from '../../context/PlayerContext.jsx';
import { useLibrary } from '../../context/LibraryContext.jsx';
import { useScrollLock } from '../../hooks/useScrollLock.js';
import { cx, formatDuration } from '../../utils/format.js';

/** Seek slider. Uses a native range input for keyboard and screen-reader support. */
function SeekBar({ compact = false }) {
  const { seek, current } = usePlayer();
  const { currentTime, duration, buffered } = usePlayerProgress();
  const [dragValue, setDragValue] = useState(null);
  const total = duration || current?.duration || 0;
  const value = dragValue ?? currentTime;
  const pct = total ? (value / total) * 100 : 0;
  const bufferedPct = total ? Math.min(100, (buffered / total) * 100) : 0;

  const input = (
    <input
      type="range"
      className="range range--seek"
      min={0}
      max={total || 1}
      step="any"
      value={Math.min(value, total || 1)}
      onChange={(e) => setDragValue(Number(e.target.value))}
      onPointerUp={() => {
        if (dragValue !== null) seek(dragValue);
        setDragValue(null);
      }}
      onKeyUp={() => {
        if (dragValue !== null) seek(dragValue);
        setDragValue(null);
      }}
      onBlur={() => setDragValue(null)}
      aria-label="Seek"
      aria-valuetext={`${formatDuration(value)} of ${formatDuration(total)}`}
      disabled={!current}
      style={{ '--pct': `${pct}%`, '--buf': `${bufferedPct}%` }}
    />
  );

  if (compact) return <div className="seek seek--compact">{input}</div>;
  return (
    <div className="seek">
      <span className="seek__time" aria-hidden="true">
        {formatDuration(value)}
      </span>
      {input}
      <span className="seek__time" aria-hidden="true">
        {formatDuration(total)}
      </span>
    </div>
  );
}

function VolumeControl() {
  const { volume, muted, setVolume, toggleMute } = usePlayer();
  const effective = muted ? 0 : volume;
  const icon = effective === 0 ? 'volume-x' : effective < 0.5 ? 'volume-low' : 'volume';
  return (
    <div className="volume">
      <button type="button" className="icon-btn" onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'} aria-pressed={muted}>
        <Icon name={icon} size={20} />
      </button>
      <input
        type="range"
        className="range"
        min={0}
        max={1}
        step={0.01}
        value={effective}
        onChange={(e) => setVolume(Number(e.target.value))}
        aria-label="Volume"
        aria-valuetext={`${Math.round(effective * 100)}%`}
        style={{ '--pct': `${effective * 100}%` }}
      />
    </div>
  );
}

function TransportControls({ large = false }) {
  const { isPlaying, isLoading, toggle, next, previous, hasNext, current } = usePlayer();
  const size = large ? 28 : 22;
  return (
    <div className={cx('transport', large && 'transport--large')}>
      <button type="button" className="icon-btn" onClick={previous} aria-label="Previous song" disabled={!current}>
        <Icon name="skip-back" size={size - 4} />
      </button>
      <button type="button" className="transport__play" onClick={toggle} aria-label={isPlaying ? 'Pause' : 'Play'} disabled={!current}>
        {isLoading && isPlaying ? <Spinner size={size - 4} label="Buffering" /> : <Icon name={isPlaying ? 'pause' : 'play'} size={size} />}
      </button>
      <button type="button" className="icon-btn" onClick={next} aria-label="Next song" disabled={!hasNext}>
        <Icon name="skip-forward" size={size - 4} />
      </button>
    </div>
  );
}

function QueueList() {
  const { queue, index, playList } = usePlayer();
  if (queue.length <= 1) return null;
  return (
    <div className="queue">
      <h3 className="queue__title">Up next</h3>
      <ol className="queue__list">
        {queue.map((song, i) => (
          <li key={`${song.id}-${i}`}>
            <button type="button" className={cx('queue__item', i === index && 'queue__item--active')} onClick={() => playList(queue, i)} aria-current={i === index ? 'true' : undefined}>
              <Artwork src={song.artworkUrl} alt="" size={36} />
              <span className="queue__text">
                <span className="queue__song">{song.title}</span>
                <span className="queue__artist">{song.artist.name}</span>
              </span>
              <span className="queue__dur">{formatDuration(song.duration)}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

function ExpandedPlayer() {
  const { current, error, setExpanded } = usePlayer();
  const { openAddToPlaylist } = useLibrary();
  useScrollLock(true);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && setExpanded(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [setExpanded]);

  return (
    <div className="player-full" role="dialog" aria-modal="true" aria-label="Now playing">
      <div className="player-full__bg" style={current.artworkUrl ? { backgroundImage: `url("${current.artworkUrl}")` } : undefined} aria-hidden="true" />
      <header className="player-full__header">
        <button type="button" className="icon-btn" onClick={() => setExpanded(false)} aria-label="Minimise player" autoFocus>
          <Icon name="chevron-down" size={24} />
        </button>
        <span className="player-full__label">Now playing</span>
        <span style={{ width: 40 }} />
      </header>
      <div className="player-full__content">
        <div className="player-full__main">
          <Artwork src={current.artworkUrl} alt={`${current.title} artwork`} className="player-full__art" eager />
          <div className="player-full__info">
            <div className="player-full__titles">
              <Link to={`/song/${current.id}`} className="player-full__title" onClick={() => setExpanded(false)}>
                {current.title}
              </Link>
              <Link to={`/artists/${current.artist.id}`} className="player-full__artist" onClick={() => setExpanded(false)}>
                {current.artist.name}
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
          <TransportControls large />
          <div className="player-full__extras">
            <VolumeControl />
            <div className="row-gap">
              <button type="button" className="icon-btn" onClick={() => openAddToPlaylist(current)} aria-label="Add to playlist">
                <Icon name="list-plus" size={20} />
              </button>
              <DownloadButton song={current} />
            </div>
          </div>
        </div>
        <QueueList />
      </div>
    </div>
  );
}

/** Persistent bottom player: compact bar on mobile, full bar on desktop, expandable to a full-screen view. */
export default function Player() {
  const { current, expanded, setExpanded, isPlaying, toggle, isLoading, error, next, hasNext } = usePlayer();
  const { openAddToPlaylist } = useLibrary();
  if (!current) return null;

  return (
    <>
      <div className="player" role="region" aria-label="Music player">
        <SeekBar compact />
        <div className="player__inner">
          <button type="button" className="player__track" onClick={() => setExpanded(true)} aria-label={`Open full player: ${current.title} by ${current.artist.name}`}>
            <Artwork src={current.artworkUrl} alt="" size={48} className="player__art" />
            <span className="player__text">
              <span className="player__title">{current.title}</span>
              <span className="player__artist">{error ? <span className="text-danger">{error}</span> : current.artist.name}</span>
            </span>
          </button>

          <div className="player__center hide-sm">
            <TransportControls />
            <SeekBar />
          </div>

          <div className="player__right">
            <FavoriteButton song={current} className="hide-sm" />
            <button type="button" className="icon-btn hide-sm" onClick={() => openAddToPlaylist(current)} aria-label="Add to playlist">
              <Icon name="list-plus" size={20} />
            </button>
            <div className="hide-md">
              <VolumeControl />
            </div>
            {/* Mobile: compact play + next */}
            <button type="button" className="transport__play show-sm" onClick={toggle} aria-label={isPlaying ? 'Pause' : 'Play'}>
              {isLoading && isPlaying ? <Spinner size={18} label="Buffering" /> : <Icon name={isPlaying ? 'pause' : 'play'} size={20} />}
            </button>
            <button type="button" className="icon-btn show-sm" onClick={next} disabled={!hasNext} aria-label="Next song">
              <Icon name="skip-forward" size={18} />
            </button>
            <button type="button" className="icon-btn hide-sm" onClick={() => setExpanded(true)} aria-label="Expand player">
              <Icon name="maximize" size={18} />
            </button>
          </div>
        </div>
      </div>
      {expanded ? <ExpandedPlayer /> : null}
    </>
  );
}
