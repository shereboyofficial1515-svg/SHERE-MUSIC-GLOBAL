import { Link } from 'react-router-dom';
import Icon from '../../components/ui/Icon.jsx';
import Artwork from '../../components/ui/Artwork.jsx';
import { ErrorState, PageLoader } from '../../components/ui/Feedback.jsx';
import { AdminHeader, BarChart, StatCard } from '../../components/admin/AdminUI.jsx';
import StatusBadge from '../../components/content/StatusBadge.jsx';
import { Alert } from '../../components/ui/Feedback.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useMeta } from '../../hooks/useMeta.js';
import { adminService } from '../../services/adminService.js';
import { formatCount, formatDate } from '../../utils/format.js';

function SongMiniList({ title, songs, metric, empty }) {
  return (
    <section className="panel">
      <h2 className="panel__title">{title}</h2>
      {songs.length ? (
        <ol className="mini-list">
          {songs.map((s) => (
            <li key={s.id} className="mini-list__item">
              <Artwork src={s.artworkUrl} alt="" size={40} />
              <div className="mini-list__main">
                <Link to={`/admin/songs/${s.id}/edit`} className="mini-list__title">
                  {s.title}
                </Link>
                <span className="text-muted text-sm">{s.artist.name}</span>
              </div>
              {metric ? <span className="mini-list__metric">{metric(s)}</span> : <StatusBadge status={s.status} />}
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-muted">{empty}</p>
      )}
    </section>
  );
}

export default function DashboardPage() {
  useMeta({ title: 'Admin dashboard', noindex: true });
  const { data, loading, error, reload } = useAsync(() => adminService.overview(), []);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading) return <PageLoader />;
  const t = data.totals;

  return (
    <>
      <AdminHeader
        title="Dashboard"
        description="An overview of SHERE MUSIC."
        actions={
          <Link to="/admin/songs/new" className="btn btn--primary">
            <Icon name="upload" size={16} /> Upload music
          </Link>
        }
      />
      {t.pendingReviews || t.pendingVerifications ? (
        <Alert type="warning">
          {t.pendingReviews ? `${t.pendingReviews} submission${t.pendingReviews === 1 ? '' : 's'}` : ''}
          {t.pendingReviews && t.pendingVerifications ? ' and ' : ''}
          {t.pendingVerifications ? `${t.pendingVerifications} verification request${t.pendingVerifications === 1 ? '' : 's'}` : ''} waiting for review. <Link to="/admin/reviews">Open reviews</Link>
        </Alert>
      ) : null}
      <div className="stat-grid">
        <StatCard label="Total songs" value={t.totalSongs} icon="music" hint={`${formatCount(t.publishedSongs)} published`} />
        <StatCard label="Total users" value={t.totalUsers} icon="users" tone="gold" hint={`${t.newUsersThisWeek} new this week`} />
        <StatCard label="Total plays" value={t.totalPlays} icon="headphones" hint={`${t.playsToday} today`} />
        <StatCard label="Total downloads" value={t.totalDownloads} icon="download" tone="gold" hint={`${t.downloadsToday} today`} />
        <StatCard label="Artists" value={t.totalArtists} icon="mic" />
        <StatCard label="Albums" value={t.totalAlbums} icon="disc" tone="gold" />
        <StatCard label="Music videos" value={t.totalVideos} icon="film" hint={`${formatCount(t.totalVideoViews)} views`} />
        <StatCard label="Artist accounts" value={t.totalArtistsUsers} icon="layers" tone="gold" />
      </div>

      <section className="panel">
        <div className="panel__head">
          <h2 className="panel__title">Last 14 days</h2>
          <Link to="/admin/analytics" className="section__link">
            Full analytics
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
        <SongMiniList title="Recently uploaded" songs={data.recentSongs} empty="No songs uploaded yet." />
        <SongMiniList title="Most downloaded" songs={data.mostDownloaded} metric={(s) => `${formatCount(s.downloadCount)} downloads`} empty="No downloads yet." />
        <SongMiniList title="Most played" songs={data.mostPlayed} metric={(s) => `${formatCount(s.playCount)} plays`} empty="No plays yet." />
      </div>
    </>
  );
}
