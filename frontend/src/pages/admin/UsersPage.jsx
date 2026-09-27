import { useState } from 'react';
import { Link } from 'react-router-dom';
import Artwork from '../../components/ui/Artwork.jsx';
import Icon from '../../components/ui/Icon.jsx';
import { EmptyState, ErrorState, Spinner } from '../../components/ui/Feedback.jsx';
import { AdminHeader, Pagination, SearchInput } from '../../components/admin/AdminUI.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import { useMeta } from '../../hooks/useMeta.js';
import { adminService } from '../../services/adminService.js';
import { cx, formatDate, timeAgo } from '../../utils/format.js';

export function UserBadges({ user }) {
  return (
    <div className="row-gap wrap">
      {user.role === 'admin' ? (
        <span className="badge badge--gold">
          <Icon name="shield" size={12} /> Admin
        </span>
      ) : user.role === 'artist' ? (
        <span className="badge badge--info">
          <Icon name="mic" size={12} /> Artist
        </span>
      ) : null}
      <span className={cx('badge', user.status === 'active' ? 'badge--success' : 'badge--danger')}>
        <Icon name={user.status === 'active' ? 'check-circle' : 'x'} size={12} /> {user.status === 'active' ? 'Active' : 'Disabled'}
      </span>
      {!user.emailVerified ? (
        <span className="badge badge--muted">
          <Icon name="mail" size={12} /> Unverified
        </span>
      ) : null}
    </div>
  );
}

export default function UsersPage() {
  useMeta({ title: 'Users · Admin', noindex: true });
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const term = useDebounce(q.trim(), 300);
  const { data, meta, loading, error, reload } = useAsync(
    () => adminService.users({ q: term || undefined, role: role || undefined, status: status || undefined, page, limit: 25 }),
    [term, role, status, page]
  );

  return (
    <>
      <AdminHeader title="Users" description="View accounts, disable access and manage administrator roles." />
      <div className="filters">
        <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search name or email" />
        <select className="input select select--inline" value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }} aria-label="Filter by role">
          <option value="">All roles</option>
          <option value="user">Listeners</option>
          <option value="artist">Artists</option>
          <option value="admin">Administrators</option>
        </select>
        <select className="input select select--inline" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Filter by status">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="disabled">Disabled</option>
        </select>
      </div>
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading && !data ? (
        <div className="center-pad">
          <Spinner size={28} />
        </div>
      ) : !data.length ? (
        <EmptyState icon="users" title="No users found" />
      ) : (
        <div className="table-wrap" aria-busy={loading}>
          <table className="table">
            <thead>
              <tr>
                <th scope="col">User</th>
                <th scope="col">Status</th>
                <th scope="col" className="hide-md">Joined</th>
                <th scope="col" className="hide-md">Last sign-in</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="table__song">
                      <Artwork src={u.avatarUrl} alt="" size={36} rounded icon="user" />
                      <div>
                        <Link to={`/admin/users/${u.id}`} className="table__title">
                          {u.name}
                        </Link>
                        <span className="text-muted text-sm">{u.email}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <UserBadges user={u} />
                  </td>
                  <td className="hide-md text-muted">{formatDate(u.createdAt)}</td>
                  <td className="hide-md text-muted">{u.lastLoginAt ? timeAgo(u.lastLoginAt) : 'Never'}</td>
                  <td>
                    <Link to={`/admin/users/${u.id}`} className="btn btn--ghost btn--sm">
                      Manage
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination meta={meta} onPage={setPage} />
    </>
  );
}
