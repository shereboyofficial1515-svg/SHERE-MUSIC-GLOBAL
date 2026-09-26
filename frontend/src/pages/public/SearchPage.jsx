import { useSearchParams, Link } from 'react-router-dom';
import { EmptyState, ErrorState } from '../../components/ui/Feedback.jsx';
import Icon from '../../components/ui/Icon.jsx';
import { SongList } from '../../components/music/SongRow.jsx';
import { RowSkeletons } from '../../components/music/Section.jsx';
import { AlbumCard, ArtistCard, GenreTile } from '../../components/music/Cards.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import { useMeta } from '../../hooks/useMeta.js';
import { musicService } from '../../services/musicService.js';

export default function SearchPage() {
  const [params] = useSearchParams();
  const raw = params.get('q') || '';
  const q = useDebounce(raw.trim(), 300);
  useMeta({ title: q ? `Search: ${q}` : 'Search', noindex: true });

  const { data, loading, error, reload } = useAsync(
    () => (q ? musicService.search(q) : Promise.resolve({ data: null })),
    [q]
  );
  const genres = useAsync(() => musicService.genres(), [], { enabled: !q });

  const nothing = data && !data.songs.length && !data.artists.length && !data.albums.length && !data.genres.length;
  const pending = loading || raw.trim() !== q;

  return (
    <div className="container page">
      <h1 className="page-title">{q ? `Results for "${q}"` : 'Search'}</h1>

      {!q ? (
        <>
          <p className="text-muted">Search by song title, artist, album, genre or category. Use the search bar at the top of the page.</p>
          {genres.data?.length ? (
            <section className="section">
              <h2 className="section__title">Browse genres</h2>
              <div className="card-grid">
                {genres.data.map((g, i) => (
                  <GenreTile key={g.id} genre={g} index={i} />
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : pending && !data ? (
        <RowSkeletons count={8} />
      ) : nothing ? (
        <EmptyState
          icon="search"
          title="No music found for your search."
          message="Check the spelling, or try an artist name, album or genre."
          action={
            <Link to="/discover" className="btn btn--secondary">
              <Icon name="compass" size={16} /> Browse all music
            </Link>
          }
        />
      ) : data ? (
        <div className={pending ? 'is-refreshing' : undefined} aria-busy={pending}>
          {data.songs.length ? (
            <section className="section">
              <h2 className="section__title">Songs</h2>
              <SongList songs={data.songs} label="Matching songs" />
            </section>
          ) : null}
          {data.artists.length ? (
            <section className="section">
              <h2 className="section__title">Artists</h2>
              <div className="card-grid">
                {data.artists.map((a) => (
                  <ArtistCard key={a.id} artist={a} />
                ))}
              </div>
            </section>
          ) : null}
          {data.albums.length ? (
            <section className="section">
              <h2 className="section__title">Albums</h2>
              <div className="card-grid">
                {data.albums.map((a) => (
                  <AlbumCard key={a.id} album={a} />
                ))}
              </div>
            </section>
          ) : null}
          {data.genres.length ? (
            <section className="section">
              <h2 className="section__title">Genres</h2>
              <div className="card-grid">
                {data.genres.map((g, i) => (
                  <GenreTile key={g.id} genre={g} index={i} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
