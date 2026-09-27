import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Artwork from '../../components/ui/Artwork.jsx';
import Icon from '../../components/ui/Icon.jsx';
import Dialog from '../../components/ui/Dialog.jsx';
import { EmptyState, ErrorState, Skeleton, Spinner } from '../../components/ui/Feedback.jsx';
import SongCard from '../../components/music/SongCard.jsx';
import { SongList } from '../../components/music/SongRow.jsx';
import Section, { RowSkeletons } from '../../components/music/Section.jsx';
import { AlbumCard } from '../../components/music/Cards.jsx';
import VideoCard from '../../components/videos/VideoCard.jsx';
import FollowButton, { VerifiedBadge } from '../../components/artists/FollowButton.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useMeta } from '../../hooks/useMeta.js';
import { musicService } from '../../services/musicService.js';
import { usePlayer } from '../../context/PlayerContext.jsx';
import { gsap, motionOK, useGSAP } from '../../utils/motion.js';
import { formatCount, formatDate } from '../../utils/format.js';

const SOCIAL_LABELS = { instagram: 'Instagram', x: 'X', facebook: 'Facebook', youtube: 'YouTube', tiktok: 'TikTok', spotify: 'Spotify', soundcloud: 'SoundCloud', website: 'Website' };

function FollowersDialog({ artist, onClose }) {
  const { data, meta, loading, error, reload } = useAsync(() => musicService.artistFollowers(artist.id, { limit: 50 }), [artist.id]);
  return (
    <Dialog title={`${artist.name}'s followers`} onClose={onClose}>
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading ? (
        <div className="center-pad">
          <Spinner />
        </div>
      ) : meta?.hidden ? (
        <p className="text-muted">This artist keeps their follower list private.</p>
      ) : !data.length ? (
        <p className="text-muted">{meta?.privateCount ? `${meta.privateCount} followers have private profiles.` : 'No followers yet — be the first!'}</p>
      ) : (
        <>
          <ul className="people-list">
            {data.map((u) => (
              <li key={u.id}>
                <Link to={`/u/${u.username || u.id}`} className="person" onClick={onClose}>
                  <Artwork src={u.avatarUrl} alt="" size={40} rounded icon="user" />
                  <span style={{ minWidth: 0 }}>
                    <strong>{u.name}</strong>
                    {u.username ? <span className="text-sm text-muted">@{u.username}</span> : null}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {meta?.privateCount ? <p className="text-sm text-muted" style={{ marginTop: 12 }}>+ {meta.privateCount} with private profiles</p> : null}
        </>
      )}
    </Dialog>
  );
}

export default function ArtistPage() {
  const { id } = useParams();
  const { data: artist, loading, error, reload, setData } = useAsync(() => musicService.artist(id), [id]);
  const { playList } = usePlayer();
  const [showFollowers, setShowFollowers] = useState(false);
  const heroRef = useRef(null);

  useMeta({
    title: artist?.name || 'Artist',
    description: artist ? artist.bio?.slice(0, 160) || `Listen to, watch and download ${artist.name} on SHERE MUSIC.` : undefined,
    image: artist?.imageUrl,
    type: 'profile',
  });

  useGSAP(
    () => {
      if (!artist || !motionOK()) return;
      gsap.from('.artist-hero__cover', { scale: 1.12, duration: 1.4, ease: 'power2.out' });
      gsap.from('.artist-hero__avatar, .artist-hero__info > *', { y: 24, autoAlpha: 0, stagger: 0.07, duration: 0.6 });
    },
    { scope: heroRef, dependencies: [artist?.id] }
  );

  if (error) {
    return (
      <div className="container page">
        {error.status === 404 ? (
          <EmptyState icon="mic" title="Artist not found" action={<Link to="/artists" className="btn btn--secondary">All artists</Link>} />
        ) : (
          <ErrorState error={error} onRetry={reload} />
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container page">
        <Skeleton height={340} radius={28} />
        <div style={{ marginTop: 24 }}>
          <RowSkeletons />
        </div>
      </div>
    );
  }

  const socials = Object.entries(artist.socialLinks || {}).filter(([, v]) => v);

  return (
    <div className="container page">
      <header className="artist-hero" ref={heroRef}>
        {artist.coverUrl ? <div className="artist-hero__cover" style={{ backgroundImage: `url("${artist.coverUrl}")` }} aria-hidden="true" /> : <div className="artist-hero__cover" aria-hidden="true" />}
        <Artwork src={artist.imageUrl} alt={artist.name} rounded size={180} icon="mic" className="artist-hero__avatar" eager />
        <div className="artist-hero__info">
          <p className="eyebrow" style={{ color: '#5ef0a6', marginBottom: 0 }}>
            {artist.verified ? 'Verified artist' : 'Artist'}
          </p>
          <h1 className="artist-hero__name">
            {artist.name} {artist.verified ? <VerifiedBadge size={30} /> : null}
          </h1>
          <div className="artist-hero__stats">
            <button type="button" className="link-btn link-on-dark" style={{ color: '#fff', textDecoration: 'none' }} onClick={() => setShowFollowers(true)}>
              {formatCount(artist.followerCount)} followers
            </button>
            <span>{artist.songCount} songs</span>
            {artist.videoCount ? <span>{artist.videoCount} videos</span> : null}
            {artist.location ? (
              <span>
                <Icon name="globe" size={14} /> {artist.location}
              </span>
            ) : null}
          </div>
          <div className="row-gap wrap">
            <button type="button" className="btn btn--primary btn--lg" onClick={() => playList(artist.songs, 0)} disabled={!artist.songs.length}>
              <Icon name="play" size={18} /> Play
            </button>
            <FollowButton artist={artist} onChange={(r) => setData((a) => ({ ...a, isFollowing: r.following, followerCount: r.followerCount }))} />
            {artist.isOwner ? (
              <Link to="/studio/artists" className="btn btn--secondary">
                <Icon name="edit" size={16} /> Edit in Studio
              </Link>
            ) : null}
          </div>
        </div>
      </header>

      {artist.songs.length ? (
        <Section title="Popular" scroller={false}>
          <SongList songs={artist.songs.slice(0, 10)} showPlays label={`Popular songs by ${artist.name}`} />
        </Section>
      ) : (
        <EmptyState icon="music" title="No songs yet" message={artist.isOwner ? 'Upload your first song in SHERE MUSIC STUDIO.' : 'Songs will appear here when they are released.'} />
      )}

      {artist.latestReleases.length ? (
        <Section title="Latest releases">
          {artist.latestReleases.map((s) => (
            <SongCard key={s.id} song={s} list={artist.latestReleases} />
          ))}
        </Section>
      ) : null}

      {artist.videos.length ? (
        <section className="section">
          <header className="section__header">
            <h2 className="section__title">Music videos</h2>
          </header>
          <div className="video-scroller">
            {artist.videos.map((v) => (
              <VideoCard key={v.id} video={v} />
            ))}
          </div>
        </section>
      ) : null}

      {artist.albums.length ? (
        <Section title="Albums">
          {artist.albums.map((a) => (
            <AlbumCard key={a.id} album={a} />
          ))}
        </Section>
      ) : null}

      {artist.bio || socials.length ? (
        <section className="section">
          <h2 className="section__title">About</h2>
          {artist.bio ? <p className="prose">{artist.bio}</p> : null}
          {socials.length ? (
            <div className="socials" style={{ marginTop: 14 }}>
              {socials.map(([k, url]) => (
                <a key={k} href={url} target="_blank" rel="noopener noreferrer">
                  <Icon name="external-link" size={14} /> {SOCIAL_LABELS[k] || k}
                </a>
              ))}
            </div>
          ) : null}
          <p className="text-sm text-muted" style={{ marginTop: 12 }}>
            On SHERE MUSIC since {formatDate(artist.createdAt, { year: 'numeric', month: 'long' })}
          </p>
        </section>
      ) : null}

      {showFollowers ? <FollowersDialog artist={artist} onClose={() => setShowFollowers(false)} /> : null}
    </div>
  );
}
