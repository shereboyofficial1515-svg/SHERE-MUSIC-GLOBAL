import { Link, useParams } from 'react-router-dom';
import Artwork from '../../components/ui/Artwork.jsx';
import Icon from '../../components/ui/Icon.jsx';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback.jsx';
import SongCard from '../../components/music/SongCard.jsx';
import Section, { CardSkeletons } from '../../components/music/Section.jsx';
import { DownloadButton, FavoriteButton, shareSong } from '../../components/music/SongActions.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useMeta } from '../../hooks/useMeta.js';
import { musicService } from '../../services/musicService.js';
import { usePlayer } from '../../context/PlayerContext.jsx';
import { useLibrary } from '../../context/LibraryContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { formatCount, formatDate, formatDuration } from '../../utils/format.js';

export default function SongPage() {
  const { id } = useParams();
  const { data: song, loading, error, reload } = useAsync(() => musicService.song(id), [id]);
  const related = useAsync(() => musicService.related(id), [id]);
  const { isCurrent, isPlaying, playSong, toggle, isLoading } = usePlayer();
  const { openAddToPlaylist } = useLibrary();
  const toast = useToast();

  useMeta({
    title: song ? `${song.title} by ${song.artist.name}` : 'Song',
    description: song
      ? song.description?.slice(0, 160) || `Listen to and download "${song.title}" by ${song.artist.name}${song.genre ? ` (${song.genre.name})` : ''} on SHERE MUSIC.`
      : undefined,
    image: song?.artworkUrl,
    type: 'music.song',
  });

  if (error) {
    return (
      <div className="container page">
        {error.status === 404 ? (
          <EmptyState
            icon="music"
            title="Song not found"
            message="This song may have been removed or is not available right now."
            action={
              <Link to="/discover" className="btn btn--secondary">
                Browse music
              </Link>
            }
          />
        ) : (
          <ErrorState error={error} onRetry={reload} />
        )}
      </div>
    );
  }

  const active = song && isCurrent(song.id);
  const playing = active && isPlaying;
  const relatedSongs = related.data || [];

  return (
    <div className="container page">
      <article className="detail">
        {loading ? (
          <Skeleton className="detail__art" radius={16} />
        ) : (
          <Artwork src={song.artworkUrl} alt={`${song.title} artwork`} className="detail__art" eager />
        )}
        <div className="detail__info">
          <p className="eyebrow">Song</p>
          {loading ? (
            <>
              <Skeleton width="70%" height={36} />
              <Skeleton width="40%" height={18} />
            </>
          ) : (
            <>
              <h1 className="detail__title">{song.title}</h1>
              <p className="detail__artist">
                <Link to={`/artists/${song.artist.id}`}>{song.artist.name}</Link>
              </p>
              <dl className="meta-list">
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
                  <dt>Duration</dt>
                  <dd>{formatDuration(song.duration)}</dd>
                </div>
                <div>
                  <dt>Plays</dt>
                  <dd>{formatCount(song.playCount)}</dd>
                </div>
                <div>
                  <dt>Downloads</dt>
                  <dd>{formatCount(song.downloadCount)}</dd>
                </div>
              </dl>
              <div className="detail__actions">
                <button type="button" className="btn btn--primary btn--lg" onClick={() => (active ? toggle() : playSong(song, [song, ...relatedSongs]))}>
                  <Icon name={playing ? 'pause' : 'play'} size={18} />
                  {playing ? 'Pause' : active && isLoading ? 'Loading…' : 'Play'}
                </button>
                <DownloadButton song={song} withLabel className="btn--lg" />
                <FavoriteButton song={song} withLabel />
                <button type="button" className="btn btn--secondary" onClick={() => openAddToPlaylist(song)}>
                  <Icon name="list-plus" size={18} /> Add to playlist
                </button>
                <button type="button" className="btn btn--secondary" onClick={() => shareSong(song, toast)}>
                  <Icon name="share" size={18} /> Share
                </button>
              </div>
              {song.description ? <p className="detail__description">{song.description}</p> : null}
            </>
          )}
        </div>
      </article>

      <Section title="Related music" subtitle="More from this artist and genre">
        {related.loading ? (
          <CardSkeletons />
        ) : relatedSongs.length ? (
          relatedSongs.map((s) => <SongCard key={s.id} song={s} list={relatedSongs} />)
        ) : (
          <p className="text-muted">No related songs yet.</p>
        )}
      </Section>
    </div>
  );
}
