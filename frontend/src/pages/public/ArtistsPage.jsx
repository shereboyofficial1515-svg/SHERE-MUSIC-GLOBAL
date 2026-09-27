import { useCallback, useState } from 'react';
import { EmptyState, ErrorState } from '../../components/ui/Feedback.jsx';
import LoadMore from '../../components/ui/LoadMore.jsx';
import Icon from '../../components/ui/Icon.jsx';
import { ArtistCard, AlbumCard } from '../../components/music/Cards.jsx';
import { CardSkeletons } from '../../components/music/Section.jsx';
import { useDebounce } from '../../hooks/useDebounce.js';
import { useMeta } from '../../hooks/useMeta.js';
import { usePaginatedList } from '../../hooks/usePaginatedList.js';
import { musicService } from '../../services/musicService.js';

/** Shared browse page for artists and albums (same filter + grid + infinite scroll). */
function BrowsePage({ kind, embedded = false }) {
  const isArtists = kind === 'artists';
  const [q, setQ] = useState('');
  const [sort, setSort] = useState(isArtists ? 'popular' : 'latest');
  const term = useDebounce(q.trim(), 300);
  useMeta({
    skip: embedded,
    title: isArtists ? 'Artists' : 'Albums',
    description: isArtists ? 'Browse artists on SHERE MUSIC and listen to their songs.' : 'Browse albums on SHERE MUSIC and play them in full.',
  });

  const fetchPage = useCallback(
    (page) => (isArtists ? musicService.artists : musicService.albums)({ page, limit: 24, q: term || undefined, sort }),
    [isArtists, term, sort]
  );
  const list = usePaginatedList(fetchPage, [term, sort, isArtists]);

  return (
    <div className={embedded ? undefined : 'container page'}>
      <header className="page-header">
        {embedded ? <span /> : <h1 className="page-title">{isArtists ? 'Artists' : 'Albums'}</h1>}
        <div className="row-gap">
          <div className="search-box search-box--inline">
            <Icon name="search" size={16} className="search-box__icon" />
            <input
              type="search"
              className="search-box__input"
              placeholder={isArtists ? 'Filter artists' : 'Filter albums'}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label={isArtists ? 'Filter artists by name' : 'Filter albums by title or artist'}
            />
          </div>
          <label className="sr-only" htmlFor="browse-sort">
            Sort
          </label>
          <select id="browse-sort" className="input select select--inline" value={sort} onChange={(e) => setSort(e.target.value)}>
            {isArtists ? <option value="popular">Most popular</option> : <option value="latest">Newest</option>}
            <option value="name">A–Z</option>
            {isArtists ? <option value="latest">Newest</option> : null}
          </select>
        </div>
      </header>

      {list.error && !list.items.length ? (
        <ErrorState error={list.error} onRetry={list.reset} />
      ) : list.initialLoading ? (
        <div className="card-grid">
          <CardSkeletons count={12} round={isArtists} />
        </div>
      ) : !list.items.length ? (
        <EmptyState icon={isArtists ? 'mic' : 'disc'} title={term ? `No ${kind} match "${term}"` : `No ${kind} yet`} />
      ) : (
        <>
          <div className="card-grid">
            {list.items.map((item) => (isArtists ? <ArtistCard key={item.id} artist={item} /> : <AlbumCard key={item.id} album={item} />))}
          </div>
          <LoadMore hasMore={list.hasMore} loading={list.loading} error={list.error} onLoadMore={list.loadMore} onRetry={list.retry} />
        </>
      )}
    </div>
  );
}

export default function ArtistsPage() {
  return <BrowsePage kind="artists" />;
}

export { BrowsePage };
