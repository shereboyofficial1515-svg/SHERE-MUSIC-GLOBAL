import { useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { EmptyState, ErrorState } from '../../components/ui/Feedback.jsx';
import LoadMore from '../../components/ui/LoadMore.jsx';
import Icon from '../../components/ui/Icon.jsx';
import SongCard from '../../components/music/SongCard.jsx';
import { CardSkeletons } from '../../components/music/Section.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useMeta } from '../../hooks/useMeta.js';
import { usePaginatedList } from '../../hooks/usePaginatedList.js';
import { musicService } from '../../services/musicService.js';
import { usePlayer } from '../../context/PlayerContext.jsx';

export default function GenrePage() {
  const { slug } = useParams();
  const { data: genre, error, reload } = useAsync(() => musicService.genre(slug), [slug]);
  const { playList } = usePlayer();
  useMeta({
    title: genre ? `${genre.name} music` : 'Genre',
    description: genre ? genre.description || `Stream and download the best ${genre.name} songs on SHERE MUSIC.` : undefined,
  });

  const fetchPage = useCallback((page) => musicService.songs({ page, limit: 24, genre: slug, sort: 'popular' }), [slug]);
  const list = usePaginatedList(fetchPage, [slug]);

  if (error) {
    return (
      <div className="container page">
        {error.status === 404 ? (
          <EmptyState icon="tag" title="Genre not found" action={<Link to="/discover" className="btn btn--secondary">Discover music</Link>} />
        ) : (
          <ErrorState error={error} onRetry={reload} />
        )}
      </div>
    );
  }

  return (
    <div className="container page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Genre</p>
          <h1 className="page-title">{genre?.name || ' '}</h1>
          {genre?.description ? <p className="text-muted">{genre.description}</p> : null}
        </div>
        {list.items.length ? (
          <button type="button" className="btn btn--primary" onClick={() => playList(list.items, 0)}>
            <Icon name="play" size={16} /> Play all
          </button>
        ) : null}
      </header>
      {list.error && !list.items.length ? (
        <ErrorState error={list.error} onRetry={list.reset} />
      ) : list.initialLoading ? (
        <div className="card-grid">
          <CardSkeletons count={12} />
        </div>
      ) : !list.items.length ? (
        <EmptyState icon="music" title="No songs in this genre yet" />
      ) : (
        <>
          <div className="card-grid">
            {list.items.map((s) => (
              <SongCard key={s.id} song={s} list={list.items} />
            ))}
          </div>
          <LoadMore hasMore={list.hasMore} loading={list.loading} error={list.error} onLoadMore={list.loadMore} onRetry={list.retry} />
        </>
      )}
    </div>
  );
}
