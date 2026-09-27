import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/ui/Icon.jsx';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback.jsx';
import Section from '../../components/music/Section.jsx';
import { ArtistCard, GenreTile } from '../../components/music/Cards.jsx';
import VideoCard from '../../components/videos/VideoCard.jsx';
import { VerifiedBadge } from '../../components/artists/FollowButton.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useMeta } from '../../hooks/useMeta.js';
import { videoService } from '../../services/musicService.js';
import { gsap, motionOK, revealChildren, useGSAP } from '../../utils/motion.js';
import { formatCount, formatDuration } from '../../utils/format.js';

/** Rotating featured hero with a thumbnail rail (GSAP cross-fade). */
function FeaturedHero({ videos }) {
  const [active, setActive] = useState(0);
  const ref = useRef(null);
  const video = videos[active];

  useEffect(() => {
    if (videos.length < 2) return undefined;
    const t = window.setInterval(() => setActive((i) => (i + 1) % videos.length), 8000);
    return () => window.clearInterval(t);
  }, [videos.length]);

  useGSAP(
    () => {
      if (!motionOK()) return;
      gsap.fromTo('.video-hero__bg', { autoAlpha: 0, scale: 1.12 }, { autoAlpha: 1, scale: 1.05, duration: 1.1, ease: 'power2.out' });
      gsap.fromTo('.video-hero__content > *', { y: 18, autoAlpha: 0 }, { y: 0, autoAlpha: 1, stagger: 0.07, duration: 0.6 });
    },
    { scope: ref, dependencies: [active] }
  );

  return (
    <section ref={ref} className="video-hero" aria-label="Featured music videos">
      <div className="video-hero__bg" style={video.thumbnailUrl ? { backgroundImage: `url("${video.thumbnailUrl}")` } : { background: 'var(--gradient-brand)' }} aria-hidden="true" />
      <div className="video-hero__content">
        <span className="video-hero__eyebrow">
          <Icon name="film" size={14} /> SHERE MUSIC VIDEO · Featured
        </span>
        <h1 className="video-hero__title">{video.title}</h1>
        <p className="video-hero__meta">
          {video.artist.name} {video.artist.verified ? <VerifiedBadge size={14} /> : null} · {formatCount(video.viewCount)} views
          {video.duration ? ` · ${formatDuration(video.duration)}` : ''}
        </p>
        <div className="row-gap wrap">
          <Link to={`/videos/${video.id}`} className="btn btn--primary btn--lg">
            <Icon name="play" size={18} /> Watch now
          </Link>
          <Link to={`/artists/${video.artist.id}`} className="btn btn--ghost btn--lg" style={{ color: '#fff' }}>
            Artist page
          </Link>
        </div>
      </div>
      {videos.length > 1 ? (
        <div className="video-hero__thumbs">
          {videos.slice(0, 4).map((v, i) => (
            <button key={v.id} type="button" className="video-hero__thumb" aria-current={i === active} onClick={() => setActive(i)} aria-label={`Show ${v.title}`}>
              {v.thumbnailUrl ? <img src={v.thumbnailUrl} alt="" /> : <span className="vcard__fallback"><Icon name="film" size={20} /></span>}
              <span style={{ minWidth: 0 }}>
                <strong className="line-clamp-1">{v.title}</strong>
                <span className="text-sm" style={{ opacity: 0.75 }}>
                  {v.artist.name}
                </span>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function VideoRow({ title, subtitle, videos, to }) {
  const ref = useRef(null);
  useGSAP(() => revealChildren(ref.current?.querySelectorAll('.vcard')), { scope: ref, dependencies: [videos.length] });
  if (!videos.length) return null;
  return (
    <section className="section" ref={ref} aria-label={title}>
      <header className="section__header">
        <div>
          <h2 className="section__title">{title}</h2>
          {subtitle ? <p className="section__subtitle">{subtitle}</p> : null}
        </div>
        {to ? (
          <Link to={to} className="section__link">
            See all
          </Link>
        ) : null}
      </header>
      <div className="video-scroller">
        {videos.map((v) => (
          <VideoCard key={v.id} video={v} />
        ))}
      </div>
    </section>
  );
}

export default function VideosHomePage() {
  useMeta({ title: 'SHERE MUSIC VIDEO', description: 'Watch the latest music videos with subtitles on SHERE MUSIC VIDEO.' });
  const { data, loading, error, reload } = useAsync(() => videoService.home(), []);

  if (error) {
    return (
      <div className="container page">
        <ErrorState error={error} onRetry={reload} title={error.code === 'VIDEOS_DISABLED' ? 'Music videos are unavailable' : 'Unable to load videos'} />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container page">
        <Skeleton height={420} radius={28} />
        <div className="video-grid" style={{ marginTop: 32 }}>
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="stack-sm">
              <Skeleton height={170} radius={14} />
              <Skeleton width="70%" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const heroVideos = data.featured.length ? data.featured : data.trending.slice(0, 4);
  const nothing = !data.latest.length;

  return (
    <div className="container page">
      {nothing ? (
        <EmptyState icon="film" title="No music videos yet" message="Music videos will appear here as soon as artists publish them." />
      ) : (
        <>
          {heroVideos.length ? <FeaturedHero videos={heroVideos} /> : null}
          <VideoRow title="Trending videos" subtitle="Most watched this week" videos={data.trending} to="/videos/browse?sort=popular" />
          {data.recommended.length ? <VideoRow title="Recommended for you" subtitle="Based on what you listen to" videos={data.recommended} /> : null}
          <VideoRow title="Latest videos" videos={data.latest} to="/videos/browse" />
          <VideoRow title="New releases" videos={data.newReleases} to="/videos/browse?sort=released" />
          {data.categories.length ? (
            <Section title="Categories" scroller={false}>
              {data.categories.map((g, i) => (
                <GenreTile key={g.id} genre={{ ...g, songCount: undefined }} index={i} to={`/videos/browse?genre=${g.slug}`} />
              ))}
            </Section>
          ) : null}
          {data.popularArtists.length ? (
            <Section title="Popular artists on video">
              {data.popularArtists.map((a) => (
                <ArtistCard key={a.id} artist={a} />
              ))}
            </Section>
          ) : null}
        </>
      )}
    </div>
  );
}
