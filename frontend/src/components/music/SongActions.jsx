import { memo, useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../ui/Icon.jsx';
import { Spinner } from '../ui/Feedback.jsx';
import { usePlayer } from '../../context/PlayerContext.jsx';
import { useLibrary } from '../../context/LibraryContext.jsx';
import { useDownload } from '../../context/DownloadContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useDismiss } from '../../hooks/useDismiss.js';
import { cx } from '../../utils/format.js';

/** Animated bars shown on the song that is currently playing. */
export function NowPlayingBars({ paused }) {
  return (
    <span className={cx('eq', paused && 'eq--paused')} aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}

export const PlayButton = memo(function PlayButton({ song, list, size = 'md', className }) {
  const { isCurrent, isPlaying, isLoading, playSong, toggle } = usePlayer();
  const active = isCurrent(song.id);
  const playing = active && isPlaying;
  const onClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (active) toggle();
    else playSong(song, list);
  };
  return (
    <button
      type="button"
      className={cx('play-btn', `play-btn--${size}`, playing && 'play-btn--active', className)}
      onClick={onClick}
      aria-label={playing ? `Pause ${song.title}` : `Play ${song.title}`}
    >
      {active && isLoading ? <Spinner size={size === 'lg' ? 24 : 16} label="Loading audio" /> : <Icon name={playing ? 'pause' : 'play'} size={size === 'lg' ? 26 : size === 'sm' ? 14 : 18} />}
    </button>
  );
});

export const FavoriteButton = memo(function FavoriteButton({ song, className, withLabel = false }) {
  const { isFavorite, toggleFavorite } = useLibrary();
  const fav = isFavorite(song.id);
  return (
    <button
      type="button"
      className={cx(withLabel ? 'btn btn--secondary' : 'icon-btn', fav && 'is-favorite', className)}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleFavorite(song);
      }}
      aria-pressed={fav}
      aria-label={withLabel ? undefined : fav ? `Remove ${song.title} from favorites` : `Add ${song.title} to favorites`}
    >
      <Icon name={fav ? 'heart-filled' : 'heart'} size={18} />
      {withLabel ? (fav ? 'Favorited' : 'Favorite') : null}
    </button>
  );
});

export const DownloadButton = memo(function DownloadButton({ song, className, withLabel = false }) {
  const { download, progress } = useDownload();
  const value = progress[song.id];
  const busy = value !== undefined;
  const label = busy ? (value >= 0 ? `Downloading ${value}%` : 'Preparing…') : 'Download';
  return (
    <button
      type="button"
      className={cx(withLabel ? 'btn btn--primary' : 'icon-btn', className)}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        download(song);
      }}
      disabled={busy}
      aria-label={withLabel ? undefined : busy ? `${label}: ${song.title}` : `Download ${song.title}`}
    >
      {busy ? <Spinner size={16} label={label} /> : <Icon name="download" size={18} />}
      {withLabel ? label : null}
    </button>
  );
});

/** Share a song (or any item with a `path`) via the native share sheet, falling back to copying the link. */
export async function shareSong(song, toast) {
  const url = `${window.location.origin}${song.path || `/song/${song.id}`}`;
  const text = `${song.title} by ${song.artist?.name} on SHERE MUSIC`;
  if (navigator.share) {
    try {
      await navigator.share({ title: song.title, text, url });
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    toast.success('Link copied to clipboard.');
  } catch {
    toast.info(url);
  }
}

/** "More options" menu for a song. */
export const SongMenu = memo(function SongMenu({ song, extraItems = [] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);
  const navigate = useNavigate();
  const toast = useToast();
  const { addToQueue } = usePlayer();
  const { openAddToPlaylist, toggleFavorite, isFavorite } = useLibrary();
  const { download } = useDownload();

  const items = [
    { icon: 'skip-forward', label: 'Play next', run: () => addToQueue(song, { next: true }) },
    { icon: 'list-music', label: 'Add to queue', run: () => addToQueue(song) },
    { icon: 'list-plus', label: 'Add to playlist', run: () => openAddToPlaylist(song) },
    { icon: isFavorite(song.id) ? 'heart-filled' : 'heart', label: isFavorite(song.id) ? 'Remove from favorites' : 'Add to favorites', run: () => toggleFavorite(song) },
    { icon: 'download', label: 'Download', run: () => download(song) },
    { icon: 'share', label: 'Share', run: () => shareSong(song, toast) },
    { icon: 'info', label: 'Song details', run: () => navigate(`/song/${song.id}`) },
    { icon: 'mic', label: 'Go to artist', run: () => navigate(`/artists/${song.artist.id}`) },
    ...(song.album ? [{ icon: 'disc', label: 'Go to album', run: () => navigate(`/albums/${song.album.id}`) }] : []),
    ...extraItems,
  ];

  const onKeyDown = (e) => {
    const buttons = [...ref.current.querySelectorAll('[role="menuitem"]')];
    const i = buttons.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      buttons[(i + 1) % buttons.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      buttons[(i - 1 + buttons.length) % buttons.length]?.focus();
    }
  };

  return (
    <div className="menu" ref={ref} onKeyDown={onKeyDown}>
      <button
        type="button"
        className="icon-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`More options for ${song.title}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        <Icon name="more" size={18} />
      </button>
      {open ? (
        <div className="menu__list" role="menu" onClick={(e) => e.stopPropagation()}>
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className={cx('menu__item', item.danger && 'menu__item--danger')}
              onClick={(e) => {
                e.preventDefault();
                close();
                item.run();
              }}
            >
              <Icon name={item.icon} size={16} />
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
});
