import { memo } from 'react';
import { Link } from 'react-router-dom';
import Artwork from '../ui/Artwork.jsx';
import { DownloadButton, NowPlayingBars, PlayButton, SongMenu } from './SongActions.jsx';
import { usePlayer } from '../../context/PlayerContext.jsx';
import { cx, formatDuration } from '../../utils/format.js';
import { VerifiedBadge } from '../artists/FollowButton.jsx';

/**
 * Grid card: artwork, title, artist, genre, duration, play/download/more.
 * Clicking the card opens the details page; the play button starts playback.
 */
function SongCard({ song, list }) {
  const { isCurrent, isPlaying } = usePlayer();
  const active = isCurrent(song.id);
  return (
    <article className={cx('song-card', active && 'song-card--active')}>
      <div className="song-card__media">
        <Link to={`/song/${song.id}`} className="song-card__link" aria-label={`${song.title} by ${song.artist.name}`}>
          <Artwork src={song.artworkUrl} alt={`${song.title} artwork`} className="song-card__art" />
        </Link>
        <PlayButton song={song} list={list} className="song-card__play" />
      </div>
      <div className="song-card__body">
        <h3 className="song-card__title">
          {active ? <NowPlayingBars paused={!isPlaying} /> : null}
          <Link to={`/song/${song.id}`}>{song.title}</Link>
        </h3>
        <p className="song-card__artist">
          <Link to={`/artists/${song.artist.id}`}>{song.artist.name}</Link>
          {song.artist.verified ? <VerifiedBadge size={13} /> : null}
        </p>
        <div className="song-card__meta">
          <span>{song.genre?.name || 'Music'}</span>
          <span aria-label={`Duration ${formatDuration(song.duration)}`}>{formatDuration(song.duration)}</span>
        </div>
        <div className="song-card__actions">
          <DownloadButton song={song} />
          <SongMenu song={song} />
        </div>
      </div>
    </article>
  );
}

export default memo(SongCard);
