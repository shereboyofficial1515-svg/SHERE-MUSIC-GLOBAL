import { useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { EmptyState, ErrorState } from '../../components/ui/Feedback.jsx';
import LoadMore from '../../components/ui/LoadMore.jsx';
import Icon from '../../components/ui/Icon.jsx';
import SongCard from '../../components/music/SongCard.jsx';
import Section, { CardSkeletons, RowSkeletons } from '../../components/music/Section.jsx';
import { SongList } from '../../components/music/SongRow.jsx';
import { AlbumCard, ArtistCard, GenreTile } from '../../components/music/Cards.jsx';
import VideoCard from '../../components/videos/VideoCard.jsx';
import { BrowsePage } from './ArtistsPage.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useMeta } from '../../hooks/useMeta.js';
import { usePaginatedList } from '../../hooks/usePaginatedList.js';
import { musicService, videoService } from '../../services/musicService.js';
import { usePlayer } from '../../context/PlayerContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { cx } from '../../utils/format.js';

const SORTS = [
  { value: 'latest', label: 'Recently added' },
  { value: 'released', label: 'New releases' },
  { value: 'popular', label: 'Most played' },
  { value: 'downloads', label: 'Most downloaded' },
  { value: 'title', label: 'Title A–Z' },
];

/** "For you": trending, new releases, recommendations, genres, artists, albums and videos at a glance. */
function OverviewTab() {
  const { user } = useAuth();
  const home = useAsync(() => musicService.home(), [user?.id]);
  const albums = useAsync(() => musicService.albums({ limit: 12, sort: 'latest' }), []);
  if (home.error) return <ErrorState error={home.error} onRetry={home.reload} />;
  const d = home.data;
  const personalPicks = d?.personal?.madeForYou?.length ? d.personal.madeForYou : null;
  const recommended = personalPicks || d?.featured || [];
  return (
    <>
      <Section title="Trending" subtitle="What everyone is playing this week" to="/discover?tab=music&sort=popular" scroller={false}>
        {home.loading ? <RowSkeletons count={5} /> : <SongList songs={d.trending.slice(0, 8)} showPlays label="Trending songs" />}
      </Section>
      <Section title="New releases" to="/discover?tab=music&sort=released">
        {home.loading ? <CardSkeletons /> : d.latest.map((s) => <SongCard key={s.id} song={s} list={d.latest} />)}
      </Section>
      {recommended.length ? (
        <Section title={personalPicks ? 'Recommended for you' : 'Recommended'} subtitle={personalPicks ? 'Based on your taste' : user ? 'Play more to personalise this' : 'Log in for personal picks'}>
          {recommended.map((s) => (
            <SongCard key={s.id} song={s} list={recommended} />
          ))}
        </Section>
      ) : null}
      {d?.genres?.length ? (
        <Section title="Genres" scroller={false}>
          {d.genres.map((g, i) => (
            <GenreTile key={g.id} genre={g} index={i} />
          ))}
        </Section>
      ) : null}
      {d?.popularArtists?.length ? (
        <Section title="Artists" to="/discover?tab=artists">
          {d.popularArtists.map((a) => (
            <ArtistCard key={a.id} artist={a} />
          ))}
        </Section>
      ) : null}
      {albums.data?.length ? (
        <Section title="Albums" to="/discover?tab=albums">
          {albums.data.map((a) => (
            <AlbumCard key={a.id} album={a} />
          ))}
        </Section>
      ) : null}
      {d?.musicVideos?.length ? (
        <section className="section">
          <header className="section__header">
            <h2 className="section__title">Music videos</h2>
            <Link to="/videos" className="section__link">
              See all
            </Link>
          </header>
          <div className="video-scroller">
            {d.musicVideos.map((v) => (
              <VideoCard key={v.id} video={v} />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

/** The whole catalog with genre filters, sorting and infinite scroll. */
function MusicTab() {
  const [params, setParams] = useSearchParams();
  const genre = params.get('genre') || '';
  const sort = SORTS.some((s) => s.value === params.get('sort')) ? params.get('sort') : 'latest';
  const featured = params.get('featured') === 'true';
  const genres = useAsync(() => musicService.genres(), []);
  const { playList } = usePlayer();

  const fetchPage = useCallback(
    (page) => musicService.songs({ page, limit: 24, genre: genre || undefined, sort, featured: featured || undefined }),
    [genre, sort, featured]
  );
  const list = usePaginatedList(fetchPage, [genre, sort, featured]);

  const update = (key, value) => {
    const next = new URLSearchParams(params);
    next.set('tab', 'music');
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };
  const visibleGenres = (genres.data || []).filter((g) => g.songCount > 0);

  return (
    <>
      <header className="page-header">
        <div>
          <h2 className="section__title" style={{ marginBottom: 2 }}>
            {featured ? 'Spotlight music' : 'All music'}
          </h2>
          <p className="text-muted">{list.total !== null ? `${list.total} ${list.total === 1 ? 'song' : 'songs'}` : 'Explore the SHERE MUSIC catalog'}</p>
        </div>
        <div className="row-gap wrap">
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
        <button type="button" className={cx('chip', !genre && !featured && 'chip--active')} aria-pressed={!genre && !featured} onClick={() => setParams({ tab: 'music', ...(sort !== 'latest' ? { sort } : {}) }, { replace: true })}>
          All
        </button>
        {featured ? (
          <button type="button" className="chip chip--active" aria-pressed="true" onClick={() => update('featured', '')}>
            Spotlight <Icon name="x" size={14} />
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
    </>
  );
}

function VideosTab() {
  const list = useAsync(() => videoService.list({ limit: 24, sort: 'latest' }), []);
  if (list.error) return <ErrorState error={list.error} onRetry={list.reload} />;
  if (list.loading) return <RowSkeletons />;
  if (!list.data.length) return <EmptyState icon="film" title="No music videos yet" />;
  return (
    <>
      <div className="video-grid">
        {list.data.map((v) => (
          <VideoCard key={v.id} video={v} />
        ))}
      </div>
      <div className="load-more">
        <Link to="/videos/browse" className="btn btn--secondary">
          Browse all videos
        </Link>
      </div>
    </>
  );
}

const TABS = [
  { id: 'overview', label: 'For you' },
  { id: 'music', label: 'Music' },
  { id: 'artists', label: 'Artists' },
  { id: 'albums', label: 'Albums' },
  { id: 'videos', label: 'Videos' },
];

export default function DiscoverPage() {
  const [params, setParams] = useSearchParams();
  // Links with filters (genre/sort/featured) open the Music tab directly.
  const implied = params.get('genre') || params.get('sort') || params.get('featured') ? 'music' : 'overview';
  const tab = TABS.some((t) => t.id === params.get('tab')) ? params.get('tab') : implied;
  useMeta({ title: 'Discover', description: 'Discover trending songs, new releases, artists, albums and music videos on SHERE MUSIC.' });

  return (
    <div className="container page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Discover</p>
          <h1 className="page-title">Find your next favourite</h1>
        </div>
        <Link to="/search" className="btn btn--secondary">
          <Icon name="search" size={16} /> Search
        </Link>
      </header>
      <div className="tabs" role="tablist" aria-label="Discover sections" style={{ marginTop: 0 }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={cx('tab', tab === t.id && 'tab--active')}
            onClick={() => setParams(t.id === 'overview' ? {} : { tab: t.id }, { replace: true })}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'overview' ? <OverviewTab /> : null}
      {tab === 'music' ? <MusicTab /> : null}
      {tab === 'artists' ? <BrowsePage kind="artists" embedded /> : null}
      {tab === 'albums' ? <BrowsePage kind="albums" embedded /> : null}
      {tab === 'videos' ? <VideosTab /> : null}
    </div>
  );
}
