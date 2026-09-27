import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Artwork from '../../components/ui/Artwork.jsx';
import Icon from '../../components/ui/Icon.jsx';
import { ConfirmDialog } from '../../components/ui/Dialog.jsx';
import { ErrorState, PageLoader } from '../../components/ui/Feedback.jsx';
import { AdminHeader, StatCard } from '../../components/admin/AdminUI.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useMeta } from '../../hooks/useMeta.js';
import { adminService } from '../../services/adminService.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { formatDate, formatDateTime } from '../../utils/format.js';
import { UserBadges } from './UsersPage.jsx';

export default function UserDetailPage() {
  const { id } = useParams();
  useMeta({ title: 'User · Admin', noindex: true });
  const { user: me } = useAuth();
  const toast = useToast();
  const { data: user, loading, error, reload, setData } = useAsync(() => adminService.user(id), [id]);
  const [confirm, setConfirm] = useState(null); // { kind, value }
  const [busy, setBusy] = useState(false);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading) return <PageLoader />;
  const isSelf = me.id === user.id;

  const apply = async () => {
    setBusy(true);
    try {
      const res = confirm.kind === 'status' ? await adminService.setUserStatus(user.id, confirm.value) : await adminService.setUserRole(user.id, confirm.value);
      setData((u) => ({ ...u, ...res.data }));
      toast.success(res.meta?.message || 'User updated.');
      setConfirm(null);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const dialogs = {
    'status:disabled': { title: 'Disable account?', message: `${user.name} will be signed out everywhere and will not be able to sign in until re-enabled. They will be notified by email.`, label: 'Disable account', danger: true },
    'status:active': { title: 'Enable account?', message: `${user.name} will be able to sign in again.`, label: 'Enable account' },
    'role:admin': { title: 'Make administrator?', message: `${user.name} will get full access to the admin dashboard, including uploads, users and settings.`, label: 'Make administrator' },
    'role:user': { title: 'Make this a listener account?', message: `${user.name} will lose ${user.role === 'admin' ? 'admin dashboard' : 'Studio'} access.`, label: 'Make listener', danger: true },
    'role:artist': { title: 'Give artist access?', message: `${user.name} will be able to use SHERE MUSIC STUDIO to manage their own artist profiles and uploads.`, label: 'Make artist' },
  };
  const dialog = confirm ? dialogs[`${confirm.kind}:${confirm.value}`] : null;

  return (
    <>
      <AdminHeader
        title={user.name}
        description={user.email}
        actions={
          <Link to="/admin/users" className="btn btn--ghost btn--sm">
            <Icon name="arrow-left" size={16} /> All users
          </Link>
        }
      />
      <div className="user-detail">
        <section className="panel stack">
          <div className="row-gap">
            <Artwork src={user.avatarUrl} alt="" size={72} rounded icon="user" />
            <div className="stack-sm">
              <UserBadges user={user} />
              <span className="text-muted text-sm">Joined {formatDate(user.createdAt)}</span>
              <span className="text-muted text-sm">Last sign-in: {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : 'Never'}</span>
            </div>
          </div>
          {isSelf ? (
            <p className="text-muted text-sm">This is your account. Ask another administrator to change your role or status.</p>
          ) : (
            <div className="row-gap wrap">
              {user.status === 'active' ? (
                <button type="button" className="btn btn--danger" onClick={() => setConfirm({ kind: 'status', value: 'disabled' })}>
                  <Icon name="lock" size={16} /> Disable account
                </button>
              ) : (
                <button type="button" className="btn btn--primary" onClick={() => setConfirm({ kind: 'status', value: 'active' })}>
                  <Icon name="check" size={16} /> Enable account
                </button>
              )}
              {user.role !== 'admin' ? (
                <button type="button" className="btn btn--secondary" onClick={() => setConfirm({ kind: 'role', value: 'admin' })} disabled={!user.emailVerified} title={!user.emailVerified ? 'The user must verify their email first' : undefined}>
                  <Icon name="shield" size={16} /> Make administrator
                </button>
              ) : null}
              {user.role !== 'artist' ? (
                <button type="button" className="btn btn--secondary" onClick={() => setConfirm({ kind: 'role', value: 'artist' })}>
                  <Icon name="mic" size={16} /> {user.role === 'admin' ? 'Change to artist' : 'Make artist'}
                </button>
              ) : null}
              {user.role !== 'user' ? (
                <button type="button" className="btn btn--ghost" onClick={() => setConfirm({ kind: 'role', value: 'user' })}>
                  Make listener
                </button>
              ) : null}
            </div>
          )}
        </section>

        <div className="stat-grid">
          <StatCard label="Favorites" value={user.stats.favorites} icon="heart" />
          <StatCard label="Playlists" value={user.stats.playlists} icon="list-music" tone="gold" />
          <StatCard label="Downloads" value={user.stats.downloads} icon="download" />
          <StatCard label="Plays" value={user.stats.plays} icon="headphones" tone="gold" />
        </div>

        <section className="panel">
          <h2 className="panel__title">Recent downloads</h2>
          {user.recentDownloads.length ? (
            <ul className="history-list">
              {user.recentDownloads.map((d, i) => (
                <li key={i} className="history-item">
                  <Artwork src={d.song.artworkUrl} alt="" size={40} />
                  <div className="history-item__main">
                    <span className="history-item__title">{d.song.title}</span>
                    <span className="text-muted text-sm">{d.song.artist.name}</span>
                  </div>
                  <time className="text-muted text-sm" dateTime={d.downloadedAt}>
                    {formatDateTime(d.downloadedAt)}
                  </time>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted">No downloads yet.</p>
          )}
        </section>
      </div>

      {dialog ? <ConfirmDialog title={dialog.title} message={dialog.message} confirmLabel={dialog.label} danger={dialog.danger} busy={busy} onConfirm={apply} onClose={() => setConfirm(null)} /> : null}
    </>
  );
}
