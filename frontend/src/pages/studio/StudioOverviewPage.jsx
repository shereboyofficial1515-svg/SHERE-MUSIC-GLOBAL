import { Link } from 'react-router-dom';
import Icon from '../../components/ui/Icon.jsx';
import Artwork from '../../components/ui/Artwork.jsx';
import { ErrorState, PageLoader } from '../../components/ui/Feedback.jsx';
import { AdminHeader, BarChart, StatCard } from '../../components/admin/AdminUI.jsx';
import StatusBadge from '../../components/content/StatusBadge.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useMeta } from '../../hooks/useMeta.js';
import { studioService } from '../../services/studioService.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { formatCount, formatDate, timeAgo } from '../../utils/format.js';

export default function StudioOverviewPage() {
  useMeta({ title: 'Studio', noindex: true });
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(() => studioService.overview(), []);
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading) return <PageLoader />;
  const t = data.totals;

  return (
    <>
      <AdminHeader
        title={`Welcome back, ${user.name.split(' ')[0]}`}
        description="Here's how your music is doing."
        actions={
          <>
            <Link to="/studio/music/new" className="btn btn--primary">
              <Icon name="upload" size={16} /> Upload music
            </Link>
            <Link to="/studio/videos/new" className="btn btn--secondary">
              <Icon name="film" size={16} /> New video
            </Link>
          </>
        }
      />
      <div className="stat-grid">
        <StatCard label="Songs" value={t.totalSongs} icon="music" hint={`${t.publishedSongs} live · ${t.pendingSongs} in review`} />
        <StatCard label="Plays" value={t.totalPlays} icon="headphones" tone="gold" />
        <StatCard label="Downloads" value={t.totalDownloads} icon="download" />
        <StatCard label="Followers" value={t.followers} icon="users" tone="gold" />
        <StatCard label="Albums" value={t.totalAlbums} icon="disc" />
        <StatCard label="Music videos" value={t.totalVideos} icon="film" tone="gold" hint={`${formatCount(t.videoViews)} views`} />
      </div>

      <section className="panel">
        <div className="panel__head">
          <h2 className="panel__title">Last 14 days</h2>
          <Link to="/studio/analytics" className="section__link">
            Analytics
          </Link>
        </div>
        <BarChart
          data={data.activity}
          series={[
            { key: 'plays', label: 'Plays', color: 'var(--accent)' },
            { key: 'downloads', label: 'Downloads', color: 'var(--text-subtle)' },
          ]}
          formatLabel={(d) => formatDate(d, { month: 'short', day: 'numeric' })}
        />
      </section>

      <div className="admin-grid-3">
        <section className="panel">
          <h2 className="panel__title">Recent activity</h2>
          {data.recentSongs.length ? (
            <ol className="mini-list">
              {data.recentSongs.map((s) => (
                <li key={s.id} className="mini-list__item">
                  <Artwork src={s.artworkUrl} alt="" size={40} />
                  <div className="mini-list__main">
                    <Link to={`/studio/music/${s.id}`} className="mini-list__title">
                      {s.title}
                    </Link>
                    <span className="text-muted text-sm">Updated {timeAgo(s.updatedAt || s.createdAt)}</span>
                  </div>
                  <StatusBadge status={s.status} />
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-muted">
              No songs yet. <Link to="/studio/music/new">Upload your first song</Link>.
            </p>
          )}
        </section>
        <section className="panel">
          <h2 className="panel__title">Music videos</h2>
          {data.recentVideos.length ? (
            <ol className="mini-list">
              {data.recentVideos.map((v) => (
                <li key={v.id} className="mini-list__item">
                  <div className="mini-list__main">
                    <Link to={`/studio/videos/${v.id}`} className="mini-list__title">
                      {v.title}
                    </Link>
                    <span className="text-muted text-sm">{formatCount(v.viewCount)} views</span>
                  </div>
                  <StatusBadge status={v.status} />
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-muted">
              No videos yet. <Link to="/studio/videos/new">Add a music video</Link>.
            </p>
          )}
        </section>
        <section className="panel">
          <h2 className="panel__title">New followers</h2>
          {data.recentFollowers.length ? (
            <ol className="mini-list">
              {data.recentFollowers.map((f, i) => (
                <li key={i} className="mini-list__item">
                  <Artwork src={f.user.avatarUrl} alt="" size={36} rounded icon="user" />
                  <div className="mini-list__main">
                    <span className="mini-list__title">{f.user.name}</span>
                    <span className="text-muted text-sm">{timeAgo(f.followedAt)}</span>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-muted">Share your artist page to gain followers.</p>
          )}
        </section>
      </div>
    </>
  );
}
