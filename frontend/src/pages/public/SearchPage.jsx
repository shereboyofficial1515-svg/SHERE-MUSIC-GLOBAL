import { Link, useSearchParams } from 'react-router-dom';
import { EmptyState, ErrorState } from '../../components/ui/Feedback.jsx';
import Icon from '../../components/ui/Icon.jsx';
import Artwork from '../../components/ui/Artwork.jsx';
import { SongList } from '../../components/music/SongRow.jsx';
import { RowSkeletons } from '../../components/music/Section.jsx';
import { AlbumCard, ArtistCard, GenreTile, PlaylistCard } from '../../components/music/Cards.jsx';
import { PlayButton } from '../../components/music/SongActions.jsx';
import VideoCard from '../../components/videos/VideoCard.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import { useMeta } from '../../hooks/useMeta.js';
import { musicService } from '../../services/musicService.js';

const GROUPS = [
  { key: 'songs', label: 'Songs' },
  { key: 'artists', label: 'Artists' },
  { key: 'albums', label: 'Albums' },
  { key: 'playlists', label: 'Playlists' },
  { key: 'videos', label: 'Music Videos' },
  { key: 'lyrics', label: 'Lyrics' },
  { key: 'genres', label: 'Genres' },
];

/** Highlight the matched phrase inside a lyric line. */
function Highlight({ text, term }) {
  const i = text.toLowerCase().indexOf(term.toLowerCase());
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark className="hl">{text.slice(i, i + term.length)}</mark>
      {text.slice(i + term.length)}
    </>
  );
}

function Group({ id, label, count, children }) {
  return (
    <section className="section search-group" id={`results-${id}`} aria-labelledby={`h-${id}`}>
      <h2 id={`h-${id}`} className="search-group__title">
        {label} <span className="text-muted text-sm">{count}</span>
      </h2>
      {children}
    </section>
  );
}

export default function SearchPage() {
  const [params] = useSearchParams();
  const raw = params.get('q') || '';
  const q = useDebounce(raw.trim(), 300);
  useMeta({ title: q ? `Search: ${q}` : 'Search', noindex: true });

  const { data, loading, error, reload } = useAsync(() => (q ? musicService.search(q) : Promise.resolve({ data: null })), [q]);
  const genres = useAsync(() => musicService.genres(), [], { enabled: !q });

  const total = data ? GROUPS.reduce((n, g) => n + (data[g.key]?.length || 0), 0) : 0;
  const pending = loading || raw.trim() !== q;

  return (
    <div className="container page">
      <h1 className="page-title">{q ? `Results for “${q}”` : 'Search'}</h1>

      {!q ? (
        <>
          <p className="text-muted">Find songs, artists, albums, playlists, music videos — or a line from the lyrics. Use the search bar above.</p>
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
      ) : data && total === 0 ? (
        <EmptyState
          icon="search"
          title="No music found for your search."
          message="Check the spelling, or try an artist, album, genre or a few words from the lyrics."
          action={
            <Link to="/discover" className="btn btn--secondary">
              <Icon name="compass" size={16} /> Discover music
            </Link>
          }
        />
      ) : data ? (
        <div className={pending ? 'is-refreshing' : undefined} aria-busy={pending}>
          <nav className="chips" aria-label="Jump to results">
            {GROUPS.filter((g) => data[g.key]?.length).map((g) => (
              <a key={g.key} href={`#results-${g.key}`} className="chip">
                {g.label} · {data[g.key].length}
              </a>
            ))}
          </nav>

          {data.songs.length ? (
            <Group id="songs" label="Songs" count={data.songs.length}>
              <SongList songs={data.songs} label="Matching songs" />
            </Group>
          ) : null}
          {data.artists.length ? (
            <Group id="artists" label="Artists" count={data.artists.length}>
              <div className="card-grid">
                {data.artists.map((a) => (
                  <ArtistCard key={a.id} artist={a} />
                ))}
              </div>
            </Group>
          ) : null}
          {data.albums.length ? (
            <Group id="albums" label="Albums" count={data.albums.length}>
              <div className="card-grid">
                {data.albums.map((a) => (
                  <AlbumCard key={a.id} album={a} />
                ))}
              </div>
            </Group>
          ) : null}
          {data.playlists.length ? (
            <Group id="playlists" label="Playlists" count={data.playlists.length}>
              <div className="card-grid">
                {data.playlists.map((p) => (
                  <PlaylistCard key={p.id} playlist={p} />
                ))}
              </div>
            </Group>
          ) : null}
          {data.videos.length ? (
            <Group id="videos" label="Music Videos" count={data.videos.length}>
              <div className="video-grid">
                {data.videos.map((v) => (
                  <VideoCard key={v.id} video={v} />
                ))}
              </div>
            </Group>
          ) : null}
          {data.lyrics.length ? (
            <Group id="lyrics" label="Lyrics" count={data.lyrics.length}>
              <ul className="lyric-results">
                {data.lyrics.map(({ song, line }) => (
                  <li key={song.id} className="lyric-result">
                    <Artwork src={song.artworkUrl} alt="" size={48} />
                    <div className="lyric-result__main">
                      {line ? (
                        <p className="lyric-result__line">
                          “<Highlight text={line} term={q} />”
                        </p>
                      ) : null}
                      <Link to={`/song/${song.id}`} className="lyric-result__song">
                        {song.title} · {song.artist.name}
                      </Link>
                    </div>
                    <PlayButton song={song} size="sm" />
                  </li>
                ))}
              </ul>
            </Group>
          ) : null}
          {data.genres.length ? (
            <Group id="genres" label="Genres" count={data.genres.length}>
              <div className="card-grid">
                {data.genres.map((g, i) => (
                  <GenreTile key={g.id} genre={g} index={i} />
                ))}
              </div>
            </Group>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
