import { useState } from 'react';
import Artwork from '../ui/Artwork.jsx';
import Icon from '../ui/Icon.jsx';
import { usePlayer } from '../../context/PlayerContext.jsx';
import { cx, formatDuration } from '../../utils/format.js';

/**
 * "Up next": view, reorder (drag, or the move buttons for keyboard/touch),
 * remove and clear. The current song keeps playing through every edit.
 */
export default function QueuePanel() {
  const { queue, index, playList, moveInQueue, removeFromQueue, clearQueue } = usePlayer();
  const [dragFrom, setDragFrom] = useState(null);
  const [dropAt, setDropAt] = useState(null);
  const upcoming = queue.length - index - 1;

  if (!queue.length) return <p className="lyrics__state">Nothing is queued.</p>;

  const onDrop = (to) => {
    if (dragFrom !== null && to !== null) moveInQueue(dragFrom, to);
    setDragFrom(null);
    setDropAt(null);
  };

  return (
    <div className="queue">
      <div className="queue__head">
        <span className="text-sm text-muted">
          {upcoming > 0 ? `${upcoming} up next` : 'Last song in the queue'}
        </span>
        {upcoming > 0 ? (
          <button type="button" className="btn btn--ghost btn--sm" onClick={clearQueue}>
            Clear up next
          </button>
        ) : null}
      </div>
      <ol className="queue__list">
        {queue.map((song, i) => (
          <li
            key={`${song.id}-${i}`}
            className={cx('qi', i === index && 'qi--current', dragFrom === i && 'qi--dragging', dropAt === i && dragFrom !== i && 'qi--drop-target')}
            draggable
            onDragStart={(e) => {
              setDragFrom(i);
              e.dataTransfer.effectAllowed = 'move';
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDropAt(i);
            }}
            onDragEnd={() => {
              setDragFrom(null);
              setDropAt(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              onDrop(i);
            }}
          >
            <span className="qi__handle" aria-hidden="true">
              <Icon name="grip" size={16} />
            </span>
            <button type="button" className="qi__main" onClick={() => playList(queue, i)} aria-current={i === index ? 'true' : undefined} aria-label={`Play ${song.title}`}>
              <Artwork src={song.artworkUrl} alt="" size={40} />
              <span className="qi__text">
                <span className="qi__title">{song.title}</span>
                <span className="qi__artist">
                  {song.artist.name} · {formatDuration(song.duration)}
                </span>
              </span>
            </button>
            <span className="qi__tools">
              <button type="button" className="icon-btn" onClick={() => moveInQueue(i, i - 1)} disabled={i === 0} aria-label={`Move ${song.title} up`}>
                <Icon name="arrow-up" size={16} />
              </button>
              <button type="button" className="icon-btn" onClick={() => moveInQueue(i, i + 1)} disabled={i === queue.length - 1} aria-label={`Move ${song.title} down`}>
                <Icon name="arrow-down" size={16} />
              </button>
              <button type="button" className="icon-btn icon-btn--danger" onClick={() => removeFromQueue(i)} aria-label={`Remove ${song.title} from queue`}>
                <Icon name="x" size={16} />
              </button>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
