import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { EmptyState, ErrorState } from '../../components/ui/Feedback.jsx';
import LoadMore from '../../components/ui/LoadMore.jsx';
import SongCard from '../../components/music/SongCard.jsx';
import { CardSkeletons } from '../../components/music/Section.jsx';
import Icon from '../../components/ui/Icon.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useMeta } from '../../hooks/useMeta.js';
import { usePaginatedList } from '../../hooks/usePaginatedList.js';
import { musicService } from '../../services/musicService.js';
import { usePlayer } from '../../context/PlayerContext.jsx';
import { cx } from '../../utils/format.js';

const SORTS = [
  { value: 'latest', label: 'Recently added' },
  { value: 'released', label: 'Latest releases' },
  { value: 'popular', label: 'Most played' },
  { value: 'downloads', label: 'Most downloaded' },
  { value: 'title', label: 'Title A–Z' },
];

/** Browse the whole catalog with genre filters, sorting and infinite scroll. */
export default function DiscoverPage() {
  const [params, setParams] = useSearchParams();
  const genre = params.get('genre') || '';
  const sort = SORTS.some((s) => s.value === params.get('sort')) ? params.get('sort') : 'latest';
  const featured = params.get('featured') === 'true';
  useMeta({ title: 'Discover music', description: 'Browse every song on SHERE MUSIC by genre, popularity and release date.' });

  const genres = useAsync(() => musicService.genres(), []);
  const { playList } = usePlayer();

  const fetchPage = useCallback(
    (page) => musicService.songs({ page, limit: 24, genre: genre || undefined, sort, featured: featured || undefined }),
    [genre, sort, featured]
  );
  const list = usePaginatedList(fetchPage, [genre, sort, featured]);

  const update = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const visibleGenres = (genres.data || []).filter((g) => g.songCount > 0);

  return (
    <div className="container page">
      <header className="page-header">
        <div>
          <h1 className="page-title">{featured ? 'Featured music' : 'Discover'}</h1>
          <p className="text-muted">{list.total !== null ? `${list.total} ${list.total === 1 ? 'song' : 'songs'}` : 'Explore the SHERE MUSIC catalog'}</p>
        </div>
        <div className="row-gap">
          {list.items.length ? (
            <button type="button" className="btn btn--primary" onClick={() => playList(list.items, 0)}>
              <Icon name="play" size={16} /> Play all
            </button>
          ) : null}
          <label className="sr-only" htmlFor="discover-sort">
            Sort songs
          </label>
          <select id="discover-sort" className="input select select--inline" value={sort} onChange={(e) => update('sort', e.target.value)}>
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </header>

      <div className="chips" role="group" aria-label="Filter by genre">
        <button type="button" className={cx('chip', !genre && !featured && 'chip--active')} aria-pressed={!genre && !featured} onClick={() => setParams(sort !== 'latest' ? { sort } : {}, { replace: true })}>
          All
        </button>
        {featured ? (
          <button type="button" className="chip chip--active" aria-pressed="true" onClick={() => update('featured', '')}>
            Featured <Icon name="x" size={14} />
          </button>
        ) : null}
        {visibleGenres.map((g) => (
          <button key={g.id} type="button" className={cx('chip', genre === g.slug && 'chip--active')} aria-pressed={genre === g.slug} onClick={() => update('genre', genre === g.slug ? '' : g.slug)}>
            {g.name}
          </button>
        ))}
      </div>

      {list.error && !list.items.length ? (
        <ErrorState error={list.error} onRetry={list.reset} />
      ) : list.initialLoading ? (
        <div className="card-grid">
          <CardSkeletons count={12} />
        </div>
      ) : !list.items.length ? (
        <EmptyState icon="music" title="No music found" message={genre ? 'There are no songs in this genre yet.' : 'No songs have been published yet.'} />
      ) : (
        <>
          <div className="card-grid">
            {list.items.map((song) => (
              <SongCard key={song.id} song={song} list={list.items} />
            ))}
          </div>
          <LoadMore hasMore={list.hasMore} loading={list.loading} error={list.error} onLoadMore={list.loadMore} onRetry={list.retry} />
        </>
      )}
    </div>
  );
}
