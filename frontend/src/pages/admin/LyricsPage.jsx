import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/ui/Icon.jsx';
import { EmptyState, ErrorState, Spinner } from '../../components/ui/Feedback.jsx';
import { AdminHeader, Pagination, SearchInput } from '../../components/admin/AdminUI.jsx';
import StatusBadge, { STATUS_OPTIONS } from '../../components/content/StatusBadge.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import { useMeta } from '../../hooks/useMeta.js';
import { adminService } from '../../services/adminService.js';
import { timeAgo } from '../../utils/format.js';

/** All lyrics across the catalog; open a song to edit, sync or review its lyrics. */
export default function LyricsPage() {
  useMeta({ title: 'Lyrics · Admin', noindex: true });
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const term = useDebounce(q.trim(), 300);
  const { data, meta, loading, error, reload } = useAsync(() => adminService.lyricsList({ q: term || undefined, status, page, limit: 25 }), [term, status, page]);
  return (
    <>
      <AdminHeader
        title="Lyrics"
        description="Every lyrics version on the platform. To add lyrics to a song, open it from Music and choose Lyrics."
        actions={
          <Link to="/admin/settings?tab=lyrics" className="btn btn--secondary">
            <Icon name="settings" size={16} /> Lyrics provider
          </Link>
        }
      />
      <div className="filters">
        <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search inside lyrics" />
        <select className="input select select--inline" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Filter by status">
          <option value="all">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading && !data ? (
        <div className="center-pad">
          <Spinner size={28} />
        </div>
      ) : !data.length ? (
        <EmptyState icon="lyrics" title="No lyrics found" />
      ) : (
        <div className="table-wrap" aria-busy={loading}>
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Song</th>
                <th scope="col">Language</th>
                <th scope="col">Status</th>
                <th scope="col" className="hide-md">Updated</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((l) => (
                <tr key={l.id}>
                  <td>
                    <span className="table__title">{l.songTitle}</span>
                    <span className="text-muted text-sm" style={{ display: 'block' }}>
                      {l.artistName}
                    </span>
                  </td>
                  <td>
                    {l.language.toUpperCase()} · {l.isSynced ? 'synced' : 'plain'}
                    {!l.isVisible ? <span className="badge badge--muted" style={{ marginLeft: 6 }}>Hidden</span> : null}
                  </td>
                  <td>
                    <StatusBadge status={l.status} />
                  </td>
                  <td className="hide-md text-muted">{timeAgo(l.updatedAt)}</td>
                  <td>
                    <Link to={`/admin/lyrics/${l.songId}`} className="btn btn--ghost btn--sm">
                      Open
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
