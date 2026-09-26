import { Link } from 'react-router-dom';
import Icon from '../../components/ui/Icon.jsx';
import Artwork from '../../components/ui/Artwork.jsx';
import { EmptyState, ErrorState } from '../../components/ui/Feedback.jsx';
import SongCard from '../../components/music/SongCard.jsx';
import { SongList } from '../../components/music/SongRow.jsx';
import Section, { CardSkeletons, RowSkeletons } from '../../components/music/Section.jsx';
import { ArtistCard, GenreTile, PlaylistCard } from '../../components/music/Cards.jsx';
import { PlayButton, DownloadButton } from '../../components/music/SongActions.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useMeta } from '../../hooks/useMeta.js';
import { musicService } from '../../services/musicService.js';
import { usePlayer } from '../../context/PlayerContext.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';

function Hero({ song, featured }) {
  const { settings } = useSettings();
  const { playList } = usePlayer();
  return (
    <section className="hero">
      <div className="hero__glow" aria-hidden="true" />
      <div className="hero__content">
        <p className="eyebrow">Discover · Stream · Download</p>
        <h1 className="hero__title">
          Your next favourite song is <span className="text-gold">one tap away.</span>
        </h1>
        <p className="hero__text">{settings.siteDescription}</p>
        <div className="hero__actions">
          {featured?.length ? (
            <button type="button" className="btn btn--primary btn--lg" onClick={() => playList(featured, 0)}>
              <Icon name="play" size={18} /> Play featured
            </button>
          ) : null}
          <Link to="/discover" className="btn btn--secondary btn--lg">
            <Icon name="compass" size={18} /> Browse music
          </Link>
        </div>
      </div>
      {song ? (
        <div className="hero__spotlight">
          <Link to={`/song/${song.id}`} className="hero__art-link" aria-label={`${song.title} details`}>
            <Artwork src={song.artworkUrl} alt={`${song.title} artwork`} className="hero__art" eager />
          </Link>
          <div className="hero__spot-info">
            <span className="badge badge--gold">
              <Icon name="star-filled" size={12} /> Featured
            </span>
            <strong className="hero__spot-title">{song.title}</strong>
            <span className="text-muted">{song.artist.name}</span>
            <div className="row-gap">
              <PlayButton song={song} list={featured} />
              <DownloadButton song={song} />
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default function HomePage() {
  useMeta({});
  const { data, loading, error, reload } = useAsync(() => musicService.home(), []);

  if (error) {
    return (
      <div className="container page">
        <ErrorState error={error} onRetry={reload} title="We couldn't load the music" />
      </div>
    );
  }

  const empty = !loading && !data.latest.length && !data.recentlyAdded.length;

  return (
    <div className="container page home">
      <Hero song={data?.featured?.[0] || data?.trending?.[0]} featured={data?.featured?.length ? data.featured : data?.trending} />

      {empty ? (
        <EmptyState icon="music" title="No music yet" message="New releases will appear here as soon as they are published. Check back soon." />
      ) : null}

      {loading || data.featured.length ? (
        <Section title="Featured music" subtitle="Hand-picked by the SHERE MUSIC team" to="/discover?featured=true">
          {loading ? <CardSkeletons /> : data.featured.map((s) => <SongCard key={s.id} song={s} list={data.featured} />)}
        </Section>
      ) : null}

      {loading || data.trending.length ? (
        <section className="section" aria-labelledby="trending-heading">
          <header className="section__header">
            <div>
              <h2 id="trending-heading" className="section__title">
                <Icon name="trending-up" size={22} className="text-sky" /> Trending now
              </h2>
              <p className="section__subtitle">Most played and downloaded this week</p>
            </div>
            <Link to="/discover?sort=popular" className="section__link">
              See all
            </Link>
          </header>
          {loading ? <RowSkeletons count={5} /> : <SongList songs={data.trending} showPlays label="Trending songs" />}
        </section>
      ) : null}

      {loading || data.latest.length ? (
        <Section title="Latest releases" to="/discover?sort=released">
          {loading ? <CardSkeletons /> : data.latest.map((s) => <SongCard key={s.id} song={s} list={data.latest} />)}
        </Section>
      ) : null}

      {loading || data.genres.length ? (
        <Section title="Browse by genre" scroller={false}>
          {loading ? <CardSkeletons count={4} /> : data.genres.map((g, i) => <GenreTile key={g.id} genre={g} index={i} />)}
        </Section>
      ) : null}

      {loading || data.popularArtists.length ? (
        <Section title="Popular artists" to="/artists">
          {loading ? <CardSkeletons round /> : data.popularArtists.map((a) => <ArtistCard key={a.id} artist={a} />)}
        </Section>
      ) : null}

      {!loading && data.featuredPlaylists.length ? (
        <Section title="Featured playlists">
          {data.featuredPlaylists.map((p) => (
            <PlaylistCard key={p.id} playlist={p} />
          ))}
        </Section>
      ) : null}

      {loading || data.recentlyAdded.length ? (
        <Section title="Recently added" to="/discover">
          {loading ? <CardSkeletons /> : data.recentlyAdded.map((s) => <SongCard key={s.id} song={s} list={data.recentlyAdded} />)}
        </Section>
      ) : null}
    </div>
  );
}
