import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/ui/Icon.jsx';
import Artwork from '../../components/ui/Artwork.jsx';
import { EmptyState, ErrorState, PageLoader, Spinner } from '../../components/ui/Feedback.jsx';
import { AdminHeader, BarChart, Pagination, StatCard } from '../../components/admin/AdminUI.jsx';
import { NotificationsSection, PrivacySection } from '../../components/settings/PreferenceSections.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useMeta } from '../../hooks/useMeta.js';
import { studioService } from '../../services/studioService.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import { formatDate, formatNumber, timeAgo } from '../../utils/format.js';

export function StudioAnalyticsPage() {
  useMeta({ title: 'Analytics · Studio', noindex: true });
  const [days, setDays] = useState(30);
  const { data, loading, error, reload } = useAsync(() => studioService.analytics(days), [days]);
  const label = (d) => formatDate(d, { month: 'short', day: 'numeric' });
  return (
    <>
      <AdminHeader
        title="Analytics"
        description="Only your own music, videos and followers."
        actions={
          <select className="input select select--inline" value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Time range">
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={365}>Last 12 months</option>
          </select>
        }
      />
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading ? (
        <PageLoader />
      ) : (
        <>
          <div className="stat-grid">
            <StatCard label="Plays" value={data.totals.plays} icon="headphones" />
            <StatCard label="Downloads" value={data.totals.downloads} icon="download" tone="gold" />
            <StatCard label="Video views" value={data.totals.videoViews} icon="film" />
            <StatCard label="New followers" value={data.totals.newFollowers} icon="users" tone="gold" />
          </div>
          <section className="panel">
            <h2 className="panel__title">Plays &amp; downloads</h2>
            <BarChart data={data.daily} series={[{ key: 'plays', label: 'Plays', color: 'var(--accent)' }, { key: 'downloads', label: 'Downloads', color: 'var(--text-subtle)' }]} formatLabel={label} />
          </section>
          <section className="panel">
            <h2 className="panel__title">Video views &amp; new followers</h2>
            <BarChart data={data.daily} series={[{ key: 'video_views', label: 'Video views', color: 'var(--accent)' }, { key: 'new_followers', label: 'New followers', color: 'var(--teal)' }]} height={160} formatLabel={label} />
          </section>
          <div className="admin-grid-2">
            <section className="panel">
              <h2 className="panel__title">Top songs</h2>
              {data.topSongs.length ? (
                <table className="table table--compact">
                  <thead>
                    <tr>
                      <th scope="col">Song</th>
                      <th scope="col" className="num">Plays</th>
                      <th scope="col" className="num">Downloads</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topSongs.map((s) => (
                      <tr key={s.song_id}>
                        <td>
                          <Link to={`/studio/music/${s.song_id}`}>{s.title}</Link>
                        </td>
                        <td className="num">{formatNumber(s.plays)}</td>
                        <td className="num">{formatNumber(s.downloads)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-muted">No songs yet.</p>
              )}
            </section>
            <section className="panel">
              <h2 className="panel__title">Top videos (all time)</h2>
              {data.topVideos.length ? (
                <table className="table table--compact">
                  <thead>
                    <tr>
                      <th scope="col">Video</th>
                      <th scope="col" className="num">Views</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topVideos.map((v) => (
                      <tr key={v.id}>
                        <td>
                          <Link to={`/studio/videos/${v.id}`}>{v.title}</Link>
                        </td>
                        <td className="num">{formatNumber(v.views)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-muted">No videos yet.</p>
              )}
            </section>
          </div>
        </>
      )}
    </>
  );
}

export function StudioFollowersPage() {
  useMeta({ title: 'Followers · Studio', noindex: true });
  const artists = useAsync(() => studioService.artists(), []);
  const [artist, setArtist] = useState('');
  const [page, setPage] = useState(1);
  const { data, meta, loading, error, reload } = useAsync(() => studioService.followers({ artist: artist || undefined, page, limit: 30 }), [artist, page]);
  const names = new Map((artists.data || []).map((a) => [a.id, a.name]));
  return (
    <>
      <AdminHeader title="Followers" description="People following your artist profiles. Listeners with private profiles appear anonymously." />
      {(artists.data || []).length > 1 ? (
        <div className="filters">
          <select className="input select select--inline" value={artist} onChange={(e) => { setArtist(e.target.value); setPage(1); }} aria-label="Artist">
            <option value="">All my artists</option>
            {artists.data.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading && !data ? (
        <div className="center-pad">
          <Spinner size={28} />
        </div>
      ) : !data.length ? (
        <EmptyState icon="users" title="No followers yet" message="Share your artist page — listeners can follow you from it." />
      ) : (
        <ul className="people-list">
          {data.map((f, i) => (
            <li key={i} className="person">
              <Artwork src={f.user?.avatarUrl} alt="" size={44} rounded icon="user" />
              <span style={{ minWidth: 0 }}>
                {f.user ? (
                  <Link to={`/u/${f.user.username || f.user.id}`}>
                    <strong>{f.user.name}</strong>
                  </Link>
                ) : (
                  <strong className="text-muted">Private listener</strong>
                )}
                <span className="text-sm text-muted" style={{ display: 'block' }}>
                  Follows {names.get(f.artistId) || 'you'} · {timeAgo(f.followedAt)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
      <Pagination meta={meta} onPage={setPage} />
    </>
  );
}

export function StudioProfilePage() {
  useMeta({ title: 'Profile · Studio', noindex: true });
  const { user } = useAuth();
  return (
    <>
      <AdminHeader title="Profile" description="Your personal account, separate from your artist profiles." />
      <section className="panel artist-panel">
        <Artwork src={user.avatarUrl} alt="" size={88} rounded icon="user" />
        <div className="artist-panel__info">
          <h2 className="panel__title">{user.name}</h2>
          <p className="text-muted text-sm">
            {user.username ? `@${user.username} · ` : ''}
            {user.email}
          </p>
          {user.bio ? <p className="prose">{user.bio}</p> : null}
          <div className="row-gap wrap">
            <Link to="/settings/profile" className="btn btn--secondary btn--sm">
              <Icon name="edit" size={14} /> Edit personal profile
            </Link>
            <Link to={`/u/${user.username || user.id}`} className="btn btn--ghost btn--sm">
              <Icon name="external-link" size={14} /> View public profile
            </Link>
            <Link to="/studio/artists" className="btn btn--ghost btn--sm">
              <Icon name="mic" size={14} /> Artist profiles
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

export function StudioSettingsPage() {
  useMeta({ title: 'Settings · Studio', noindex: true });
  const { settings } = useSettings();
  return (
    <>
      <AdminHeader title="Studio settings" description="Notifications and visibility for your creator account." />
      <section className="panel stack-sm">
        <h2 className="panel__title">How publishing works</h2>
        <p className="text-muted">
          {settings.artistAutoPublish
            ? 'Songs, lyrics and videos go live as soon as you publish them.'
            : 'New songs, lyrics and videos are reviewed by the SHERE MUSIC team. You’ll get a notification when a decision is made. Editing live content sends it back for review.'}
        </p>
      </section>
      <NotificationsSection />
      <PrivacySection />
      <p className="text-sm text-muted">
        More options in <Link to="/settings">account settings</Link>.
      </p>
    </>
  );
}

export function StudioPlaylistsNote() {
  return (
    <EmptyState icon="list-music" title="Playlists" message="Playlists belong to your listener account." action={<Link to="/playlists" className="btn btn--secondary">Open my playlists</Link>} />
  );
}
