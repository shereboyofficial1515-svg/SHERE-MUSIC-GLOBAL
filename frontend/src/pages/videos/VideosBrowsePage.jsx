import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback.jsx';
import LoadMore from '../../components/ui/LoadMore.jsx';
import VideoCard from '../../components/videos/VideoCard.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useMeta } from '../../hooks/useMeta.js';
import { usePaginatedList } from '../../hooks/usePaginatedList.js';
import { musicService, videoService } from '../../services/musicService.js';
import { cx } from '../../utils/format.js';

const SORTS = [
  { value: 'latest', label: 'Latest' },
  { value: 'popular', label: 'Most viewed' },
  { value: 'released', label: 'Release date' },
  { value: 'title', label: 'Title A–Z' },
];

export default function VideosBrowsePage() {
  const [params, setParams] = useSearchParams();
  const genre = params.get('genre') || '';
  const sort = SORTS.some((s) => s.value === params.get('sort')) ? params.get('sort') : 'latest';
  const genres = useAsync(() => musicService.genres(), []);
  const genreName = (genres.data || []).find((g) => g.slug === genre)?.name;
  useMeta({ title: genreName ? `${genreName} music videos` : 'All music videos' });

  const fetchPage = useCallback((page) => videoService.list({ page, limit: 24, genre: genre || undefined, sort }), [genre, sort]);
  const list = usePaginatedList(fetchPage, [genre, sort]);

  const update = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  return (
    <div className="container page">
      <header className="page-header">
        <div>
          <p className="eyebrow">SHERE MUSIC VIDEO</p>
          <h1 className="page-title">{genreName ? `${genreName} videos` : 'All music videos'}</h1>
        </div>
        <select className="input select select--inline" value={sort} onChange={(e) => update('sort', e.target.value)} aria-label="Sort videos">
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </header>
      <div className="chips" role="group" aria-label="Filter by category">
        <button type="button" className={cx('chip', !genre && 'chip--active')} aria-pressed={!genre} onClick={() => update('genre', '')}>
          All
        </button>
        {(genres.data || []).map((g) => (
          <button key={g.id} type="button" className={cx('chip', genre === g.slug && 'chip--active')} aria-pressed={genre === g.slug} onClick={() => update('genre', genre === g.slug ? '' : g.slug)}>
            {g.name}
          </button>
        ))}
      </div>
      {list.error && !list.items.length ? (
        <ErrorState error={list.error} onRetry={list.reset} />
      ) : list.initialLoading ? (
        <div className="video-grid">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} height={170} radius={14} />
          ))}
        </div>
      ) : !list.items.length ? (
        <EmptyState icon="film" title="No videos here yet" />
      ) : (
        <>
          <div className="video-grid">
            {list.items.map((v) => (
              <VideoCard key={v.id} video={v} />
            ))}
          </div>
          <LoadMore hasMore={list.hasMore} loading={list.loading} error={list.error} onLoadMore={list.loadMore} onRetry={list.retry} />
        </>
      )}
    </div>
  );
}
