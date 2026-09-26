import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import Artwork from '../../components/ui/Artwork.jsx';
import Icon from '../../components/ui/Icon.jsx';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback.jsx';
import LoadMore from '../../components/ui/LoadMore.jsx';
import { SongList } from '../../components/music/SongRow.jsx';
import { RowSkeletons } from '../../components/music/Section.jsx';
import { PlaylistCard } from '../../components/music/Cards.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useMeta } from '../../hooks/useMeta.js';
import { usePaginatedList } from '../../hooks/usePaginatedList.js';
import { userService } from '../../services/userService.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useLibrary } from '../../context/LibraryContext.jsx';
import { cx, formatCount, formatDate, formatDateTime } from '../../utils/format.js';

const TABS = [
  { id: 'recent', label: 'Recently played', icon: 'clock' },
  { id: 'downloads', label: 'Download history', icon: 'download' },
  { id: 'playlists', label: 'Playlists', icon: 'list-music' },
];

function RecentTab() {
  const { data, loading, error, reload } = useAsync(() => userService.recent(), []);
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading) return <RowSkeletons />;
  if (!data.length) return <EmptyState icon="clock" title="Nothing played yet" message="Songs you listen to will show up here." />;
  return <SongList songs={data} label="Recently played songs" />;
}

function DownloadsTab() {
  const fetchPage = useCallback((page) => userService.downloads({ page, limit: 30 }), []);
  const list = usePaginatedList(fetchPage, []);
  if (list.error && !list.items.length) return <ErrorState error={list.error} onRetry={list.reset} />;
  if (list.initialLoading) return <RowSkeletons />;
  if (!list.items.length) return <EmptyState icon="download" title="No downloads yet" message="Songs you download will be listed here." />;
  return (
    <>
      <ul className="history-list">
        {list.items.map((item) => (
          <li key={item.id} className="history-item">
            <Artwork src={item.song.artworkUrl} alt="" size={44} />
            <div className="history-item__main">
              <Link to={`/song/${item.song.id}`} className="history-item__title">
                {item.song.title}
              </Link>
              <span className="text-muted text-sm">{item.song.artist.name}</span>
            </div>
            <time className="text-muted text-sm" dateTime={item.downloadedAt}>
              {formatDateTime(item.downloadedAt)}
            </time>
          </li>
        ))}
      </ul>
      <LoadMore hasMore={list.hasMore} loading={list.loading} error={list.error} onLoadMore={list.loadMore} onRetry={list.retry} />
    </>
  );
}

function PlaylistsTab() {
  const { playlistsVersion } = useLibrary();
  const { data, loading, error, reload } = useAsync(() => userService.playlists(), [playlistsVersion]);
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading) return <RowSkeletons count={3} />;
  if (!data.length) return <EmptyState icon="list-music" title="No playlists yet" action={<Link to="/playlists" className="btn btn--secondary">Create a playlist</Link>} />;
  return (
    <div className="card-grid">
      {data.map((p) => (
        <PlaylistCard key={p.id} playlist={p} />
      ))}
    </div>
  );
}

export default function ProfilePage() {
  useMeta({ title: 'Your profile', noindex: true });
  const { user } = useAuth();
  const { data: profile, loading, error, reload } = useAsync(() => userService.profile(), []);
  const [tab, setTab] = useState('recent');

  const stats = profile?.stats;

  return (
    <div className="container page">
      <header className="profile-head">
        <Artwork src={user.avatarUrl} alt={`${user.name} profile picture`} rounded size={112} icon="user" className="profile-head__avatar" />
        <div className="profile-head__info">
          <p className="eyebrow">Profile</p>
          <h1 className="page-title">{user.name}</h1>
          <p className="text-muted">
            {user.email} · Member since {formatDate(user.createdAt, { year: 'numeric', month: 'long' })}
          </p>
          <Link to="/account" className="btn btn--secondary btn--sm">
            <Icon name="settings" size={16} /> Account settings
          </Link>
        </div>
      </header>

      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : (
        <dl className="stat-row">
          {[
            ['Favorites', stats?.favorites, '/favorites'],
            ['Playlists', stats?.playlists, '/playlists'],
            ['Downloads', stats?.downloads],
            ['Plays', stats?.plays],
          ].map(([label, value, to]) => (
            <div key={label} className="stat-pill">
              <dt>{to ? <Link to={to}>{label}</Link> : label}</dt>
              <dd>{loading ? <Skeleton width={32} height={20} /> : formatCount(value)}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="tabs" role="tablist" aria-label="Profile sections">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" id={`tab-${t.id}`} aria-selected={tab === t.id} aria-controls={`panel-${t.id}`} className={cx('tab', tab === t.id && 'tab--active')} onClick={() => setTab(t.id)}>
            <Icon name={t.icon} size={16} /> {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="tab-panel">
        {tab === 'recent' ? <RecentTab /> : tab === 'downloads' ? <DownloadsTab /> : <PlaylistsTab />}
      </div>
    </div>
  );
}
