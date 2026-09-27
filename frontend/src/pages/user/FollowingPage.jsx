import { useRef } from 'react';
import { Link } from 'react-router-dom';
import Artwork from '../../components/ui/Artwork.jsx';
import Icon from '../../components/ui/Icon.jsx';
import { EmptyState, ErrorState } from '../../components/ui/Feedback.jsx';
import { RowSkeletons } from '../../components/music/Section.jsx';
import { PlayButton } from '../../components/music/SongActions.jsx';
import { ArtistCard } from '../../components/music/Cards.jsx';
import Section from '../../components/music/Section.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useMeta } from '../../hooks/useMeta.js';
import { useReveal } from '../../hooks/useReveal.js';
import { userService } from '../../services/userService.js';
import { formatDuration, timeAgo } from '../../utils/format.js';

/** "New from artists you follow": a feed of songs and videos, newest first. */
export default function FollowingPage() {
  useMeta({ title: 'Following', noindex: true });
  const feed = useAsync(() => userService.feed(), []);
  const following = useAsync(() => userService.following(), []);
  const listRef = useRef(null);
  useReveal(listRef, '.feed-item', [feed.data?.items?.length]);
  const songs = (feed.data?.items || []).filter((i) => i.type === 'song').map((i) => i.song);

  return (
    <div className="container page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Your library</p>
          <h1 className="page-title">Following</h1>
          <p className="text-muted">New releases from artists you follow.</p>
        </div>
        <Link to="/settings/followers" className="btn btn--secondary">
          <Icon name="users" size={16} /> Manage
        </Link>
      </header>

      {following.data?.length ? (
        <Section title="Artists you follow">
          {following.data.map((a) => (
            <ArtistCard key={a.id} artist={a} />
          ))}
        </Section>
      ) : null}

      <section className="section" aria-labelledby="feed-heading">
        <h2 id="feed-heading" className="section__title">
          New from artists you follow
        </h2>
        {feed.error ? (
          <ErrorState error={feed.error} onRetry={feed.reload} />
        ) : feed.loading ? (
          <RowSkeletons />
        ) : !feed.data.items.length ? (
          <EmptyState
            icon="user-plus"
            title={feed.data.followingCount ? 'No new releases yet' : 'Follow artists to fill your feed'}
            message={feed.data.followingCount ? "When artists you follow release music or videos, they'll show up here." : 'Tap Follow on any artist page.'}
            action={<Link to="/artists" className="btn btn--secondary">Find artists</Link>}
          />
        ) : (
          <ol className="feed" ref={listRef}>
            {feed.data.items.map((item) =>
              item.type === 'song' ? (
                <li key={`s-${item.song.id}`} className="feed-item">
                  <Artwork src={item.song.artworkUrl} alt="" size={64} />
                  <div className="feed-item__main">
                    <span className="badge">New song</span>
                    <Link to={`/song/${item.song.id}`} className="feed-item__title">
                      {item.song.title}
                    </Link>
                    <span className="text-sm text-muted">
                      <Link to={`/artists/${item.song.artist.id}`}>{item.song.artist.name}</Link> · {formatDuration(item.song.duration)} · {timeAgo(item.date)}
                    </span>
                  </div>
                  <PlayButton song={item.song} list={songs} />
                </li>
              ) : (
                <li key={`v-${item.video.id}`} className="feed-item">
                  <Link to={`/videos/${item.video.id}`} className="feed-item__thumb" aria-label={`Watch ${item.video.title}`}>
                    {item.video.thumbnailUrl ? <img src={item.video.thumbnailUrl} alt="" loading="lazy" /> : <Icon name="film" size={24} />}
                  </Link>
                  <div className="feed-item__main">
                    <span className="badge">New music video</span>
                    <Link to={`/videos/${item.video.id}`} className="feed-item__title">
                      {item.video.title}
                    </Link>
                    <span className="text-sm text-muted">
                      <Link to={`/artists/${item.video.artist.id}`}>{item.video.artist.name}</Link> · {timeAgo(item.date)}
                    </span>
                  </div>
                  <Link to={`/videos/${item.video.id}`} className="play-btn" aria-label={`Watch ${item.video.title}`}>
                    <Icon name="play" size={18} />
                  </Link>
                </li>
              )
            )}
          </ol>
        )}
      </section>
    </div>
  );
}
