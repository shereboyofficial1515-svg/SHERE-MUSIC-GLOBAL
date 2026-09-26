import Artwork from '../ui/Artwork.jsx';
import Icon from '../ui/Icon.jsx';
import { Skeleton } from '../ui/Feedback.jsx';
import { usePlayer } from '../../context/PlayerContext.jsx';
import { formatDuration } from '../../utils/format.js';

/** Header for artist, album, genre and playlist pages with Play all. */
export default function CollectionHeader({ loading, kind, title, subtitle, imageUrl, rounded, icon, songs = [], description, actions }) {
  const { playList, isPlaying, toggle, queue } = usePlayer();
  const totalSeconds = songs.reduce((sum, s) => sum + (s.duration || 0), 0);
  const isThisQueue = songs.length > 0 && queue.length === songs.length && queue.every((s, i) => s.id === songs[i].id);

  return (
    <header className="collection">
      {loading ? <Skeleton className="collection__art" radius={rounded ? '50%' : 16} /> : <Artwork src={imageUrl} alt={title} rounded={rounded} icon={icon} className="collection__art" eager />}
      <div className="collection__info">
        <p className="eyebrow">{kind}</p>
        {loading ? (
          <>
            <Skeleton width="60%" height={40} />
            <Skeleton width="30%" />
          </>
        ) : (
          <>
            <h1 className="collection__title">{title}</h1>
            {subtitle ? <div className="collection__subtitle">{subtitle}</div> : null}
            <p className="text-muted text-sm">
              {songs.length} {songs.length === 1 ? 'song' : 'songs'}
              {totalSeconds ? ` · ${formatDuration(totalSeconds)}` : ''}
            </p>
            {description ? <p className="collection__description">{description}</p> : null}
            <div className="row-gap wrap">
              <button
                type="button"
                className="btn btn--primary btn--lg"
                disabled={!songs.length}
                onClick={() => (isThisQueue ? toggle() : playList(songs, 0))}
              >
                <Icon name={isThisQueue && isPlaying ? 'pause' : 'play'} size={18} />
                {isThisQueue && isPlaying ? 'Pause' : 'Play all'}
              </button>
              {actions}
            </div>
          </>
        )}
      </div>
    </header>
  );
}
