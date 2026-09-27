import { useRef } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/ui/Icon.jsx';
import Artwork from '../../components/ui/Artwork.jsx';
import { EmptyState, ErrorState } from '../../components/ui/Feedback.jsx';
import SongCard from '../../components/music/SongCard.jsx';
import { SongList } from '../../components/music/SongRow.jsx';
import Section, { CardSkeletons, RowSkeletons } from '../../components/music/Section.jsx';
import { ArtistCard, GenreTile, PlaylistCard } from '../../components/music/Cards.jsx';
import { DownloadButton, PlayButton } from '../../components/music/SongActions.jsx';
import VideoCard from '../../components/videos/VideoCard.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useMeta } from '../../hooks/useMeta.js';
import { useReveal } from '../../hooks/useReveal.js';
import { musicService } from '../../services/musicService.js';
import { usePlayer } from '../../context/PlayerContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import { gsap, motionOK, useGSAP } from '../../utils/motion.js';

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Up late';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function Hero({ song, featured }) {
  const { user } = useAuth();
  const { settings } = useSettings();
  const { playList, isPlaying, isCurrent } = usePlayer();
  const ref = useRef(null);

  useGSAP(
    () => {
      if (!motionOK()) return;
      gsap.from('.hero__content > *', { y: 22, autoAlpha: 0, stagger: 0.08, duration: 0.7, ease: 'power3.out' });
      gsap.from('.hero__spotlight', { x: 30, autoAlpha: 0, duration: 0.8, delay: 0.15, ease: 'power3.out' });
    },
    { scope: ref }
  );

  // Equaliser bars on the spotlight dance while that song plays.
  const playingSpotlight = song && isCurrent(song.id) && isPlaying;
  useGSAP(
    () => {
      const bars = ref.current?.querySelectorAll('.hero__bars span');
      if (!bars?.length) return;
      if (!playingSpotlight || !motionOK()) {
        gsap.to(bars, { scaleY: 0.3, duration: 0.3, overwrite: true });
        return;
      }
      bars.forEach((b, i) => gsap.to(b, { scaleY: () => 0.3 + Math.random() * 0.7, duration: 0.35, repeat: -1, yoyo: true, repeatRefresh: true, delay: i * 0.05, overwrite: true }));
    },
    { scope: ref, dependencies: [playingSpotlight] }
  );

  return (
    <section className="hero" ref={ref}>
      <div className="hero__glow" aria-hidden="true" />
      <div className="hero__content">
        <p className="hero__greeting">
          {greeting()}
          {user ? `, ${user.name.split(' ')[0]}` : ''}
        </p>
        <h1 className="hero__title">
          Discover it. Stream it. <span className="text-accent">Keep it.</span>
        </h1>
        <p className="hero__text">{settings.siteDescription}</p>
        <div className="hero__actions">
          {featured?.length ? (
            <button type="button" className="btn btn--primary btn--lg" onClick={() => playList(featured, 0)}>
              <Icon name="play" size={18} /> Play the spotlight
            </button>
          ) : null}
          <Link to="/discover" className="btn btn--secondary btn--lg">
            <Icon name="compass" size={18} /> Discover
          </Link>
        </div>
      </div>
      {song ? (
        <div className="hero__spotlight">
          <Link to={`/song/${song.id}`} className="hero__art-link" aria-label={`${song.title} details`}>
            <Artwork src={song.artworkUrl} alt={`${song.title} artwork`} className="hero__art" eager />
          </Link>
          <div className="hero__spot-info">
            <span className="badge">
              <Icon name="star-filled" size={12} /> Spotlight
            </span>
            <strong className="hero__spot-title">{song.title}</strong>
            <span className="text-muted">{song.artist.name}</span>
            <div className="hero__bars" aria-hidden="true">
              {Array.from({ length: 7 }, (_, i) => (
                <span key={i} />
              ))}
            </div>
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

function CardRow({ title, subtitle, to, songs, loading, round }) {
  const ref = useRef(null);
  useReveal(ref, '.song-card, .card-skeleton', [songs?.length]);
  if (!loading && !songs?.length) return null;
  return (
    <div ref={ref}>
      <Section title={title} subtitle={subtitle} to={to}>
        {loading ? <CardSkeletons round={round} /> : songs.map((s) => <SongCard key={s.id} song={s} list={songs} />)}
      </Section>
    </div>
  );
}

export default function HomePage() {
  useMeta({});
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(() => musicService.home(), [user?.id]);
  const personal = data?.personal;

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

      {empty ? <EmptyState icon="music" title="No music yet" message="New releases will appear here as soon as they are published. Check back soon." /> : null}

      {personal?.recentlyPlayed?.length ? <CardRow title="Pick up where you left off" subtitle="Your recent listens" to="/library" songs={personal.recentlyPlayed} /> : null}
      {personal?.fromFollowing?.length ? <CardRow title="Fresh from artists you follow" to="/following" songs={personal.fromFollowing} /> : null}
      {personal?.madeForYou?.length ? <CardRow title="Tuned for you" subtitle="Picked from the genres you love" songs={personal.madeForYou} /> : null}

      <CardRow title="In the spotlight" subtitle="Hand-picked by the SHERE MUSIC team" to="/discover?featured=true" songs={data?.featured} loading={loading} />

      {loading || data.trending.length ? (
        <section className="section" aria-labelledby="trending-heading">
          <header className="section__header">
            <div>
              <h2 id="trending-heading" className="section__title">
                <Icon name="trending-up" size={22} className="text-accent" /> Trending now
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

      {personal?.becauseYouListened ? (
        <CardRow title={`More like “${personal.becauseYouListened.seed.title}”`} subtitle={`Because you listened to ${personal.becauseYouListened.seed.artist.name}`} songs={personal.becauseYouListened.songs} />
      ) : null}

      <CardRow title="Just dropped" subtitle="The newest releases" to="/discover?sort=released" songs={data?.latest} loading={loading} />

      {!loading && data.musicVideos?.length ? (
        <section className="section" aria-labelledby="videos-heading">
          <header className="section__header">
            <div>
              <h2 id="videos-heading" className="section__title">
                <Icon name="film" size={22} className="text-accent" /> Music videos
              </h2>
              <p className="section__subtitle">Now showing on SHERE MUSIC VIDEO</p>
            </div>
            <Link to="/videos" className="section__link">
              See all
            </Link>
          </header>
          <div className="video-scroller">
            {data.musicVideos.map((v) => (
              <VideoCard key={v.id} video={v} />
            ))}
          </div>
        </section>
      ) : null}

      {loading || data.genres.length ? (
        <Section title="Browse by genre" scroller={false}>
          {loading ? <CardSkeletons count={4} /> : data.genres.map((g, i) => <GenreTile key={g.id} genre={g} index={i} />)}
        </Section>
      ) : null}

      {loading || data.popularArtists.length ? (
        <Section title="Artists to know" to="/artists">
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

      {personal?.yourPlaylists?.length ? (
        <Section title="Your playlists" to="/playlists">
          {personal.yourPlaylists.map((p) => (
            <PlaylistCard key={p.id} playlist={p} />
          ))}
        </Section>
      ) : null}

      <CardRow title="Latest music" subtitle="Recently added to SHERE MUSIC" to="/discover" songs={data?.recentlyAdded} loading={loading} />
    </div>
  );
}
