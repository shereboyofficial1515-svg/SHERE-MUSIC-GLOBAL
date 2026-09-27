import { useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import Artwork from '../../components/ui/Artwork.jsx';
import Icon from '../../components/ui/Icon.jsx';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback.jsx';
import VideoPlayer from '../../components/videos/VideoPlayer.jsx';
import VideoCard from '../../components/videos/VideoCard.jsx';
import FollowButton, { VerifiedBadge } from '../../components/artists/FollowButton.jsx';
import { shareSong } from '../../components/music/SongActions.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useMeta } from '../../hooks/useMeta.js';
import { musicService, videoService } from '../../services/musicService.js';
import { usePlayer } from '../../context/PlayerContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { formatCount, formatDate } from '../../utils/format.js';

export default function VideoPage() {
  const { id } = useParams();
  const toast = useToast();
  const { playSong } = usePlayer();
  const { data: video, loading, error, reload } = useAsync(() => videoService.video(id), [id]);
  const related = useAsync(() => videoService.related(id), [id]);
  const artist = useAsync(() => (video ? musicService.artist(video.artist.id) : Promise.resolve({ data: null })), [video?.artist.id]);
  const onViewed = useCallback(() => videoService.recordView(id).catch(() => {}), [id]);

  useMeta({
    title: video ? `${video.title} — ${video.artist.name} (Music Video)` : 'Music video',
    description: video ? video.description?.slice(0, 160) || `Watch "${video.title}" by ${video.artist.name} on SHERE MUSIC VIDEO.` : undefined,
    image: video?.thumbnailUrl,
    type: 'video.other',
  });

  if (error) {
    return (
      <div className="container page">
        {error.status === 404 ? (
          <EmptyState icon="film" title="Video not found" message="It may have been removed or isn't published yet." action={<Link to="/videos" className="btn btn--secondary">Browse videos</Link>} />
        ) : (
          <ErrorState error={error} onRetry={reload} />
        )}
      </div>
    );
  }

  return (
    <div className="container page">
      <div className="watch">
        <div>
          {loading ? <Skeleton height={420} radius={20} /> : <VideoPlayer key={video.id} video={video} onViewed={onViewed} />}
          {video ? (
            <div className="watch__info">
              <h1 className="watch__title">{video.title}</h1>
              <p className="text-muted text-sm">
                {formatCount(video.viewCount)} views
                {video.releaseDate ? ` · Released ${formatDate(video.releaseDate)}` : ''}
                {video.genre ? (
                  <>
                    {' · '}
                    <Link to={`/videos/browse?genre=${video.genre.slug}`}>{video.genre.name}</Link>
                  </>
                ) : null}
              </p>
              <div className="watch__channel">
                <Link to={`/artists/${video.artist.id}`} className="watch__channel-info">
                  <Artwork src={video.artist.imageUrl} alt="" size={48} rounded icon="mic" />
                  <span>
                    <strong>
                      {video.artist.name} {video.artist.verified ? <VerifiedBadge size={14} /> : null}
                    </strong>
                    {artist.data ? <span className="text-sm text-muted" style={{ display: 'block' }}>{formatCount(artist.data.followerCount)} followers</span> : null}
                  </span>
                </Link>
                <div className="row-gap wrap">
                  {artist.data ? <FollowButton artist={artist.data} size="sm" /> : null}
                  {video.song ? (
                    <button
                      type="button"
                      className="btn btn--secondary btn--sm"
                      onClick={async () => {
                        try {
                          const { data } = await musicService.song(video.song.id);
                          playSong(data);
                        } catch (err) {
                          toast.error(err.message);
                        }
                      }}
                    >
                      <Icon name="headphones" size={16} /> Listen to the song
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => shareSong({ id: video.id, title: video.title, artist: video.artist, path: `/videos/${video.id}` }, toast)}
                  >
                    <Icon name="share" size={16} /> Share
                  </button>
                </div>
              </div>
              {video.subtitles?.length ? (
                <p className="text-sm text-muted">
                  <Icon name="captions" size={14} /> Subtitles: {video.subtitles.map((s) => s.label).join(', ')}. Press C to toggle captions.
                </p>
              ) : null}
              {video.description ? <p className="watch__desc">{video.description}</p> : null}
            </div>
          ) : null}
        </div>
        <aside className="watch__side" aria-label="More videos">
          <h2 className="section__title">Up next</h2>
          {related.loading ? (
            <Skeleton height={120} radius={14} />
          ) : (related.data || []).length ? (
            related.data.map((v) => <VideoCard key={v.id} video={v} size="sm" />)
          ) : (
            <p className="text-muted">More videos will appear here.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
