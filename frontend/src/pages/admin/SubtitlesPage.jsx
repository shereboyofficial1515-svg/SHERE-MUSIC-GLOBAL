import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/ui/Icon.jsx';
import { EmptyState, ErrorState, Spinner } from '../../components/ui/Feedback.jsx';
import { AdminHeader, Pagination, SearchInput } from '../../components/admin/AdminUI.jsx';
import StatusBadge from '../../components/content/StatusBadge.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import { useMeta } from '../../hooks/useMeta.js';
import { adminService } from '../../services/adminService.js';
import { useSettings } from '../../context/SettingsContext.jsx';

/** Subtitle coverage across music videos. Tracks are managed on each video. */
export default function SubtitlesPage() {
  useMeta({ title: 'Subtitles · Admin', noindex: true });
  const { settings } = useSettings();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const term = useDebounce(q.trim(), 300);
  const { data, meta, loading, error, reload } = useAsync(() => adminService.videos({ q: term || undefined, page, limit: 25 }), [term, page]);
  const languages = settings.subtitleLanguages || [];

  return (
    <>
      <AdminHeader
        title="Subtitles"
        description={`WebVTT subtitle tracks for music videos. Available languages: ${languages.map((l) => l.label).join(', ') || 'none'}.`}
        actions={
          <Link to="/admin/settings?tab=videos" className="btn btn--secondary">
            <Icon name="settings" size={16} /> Manage languages
          </Link>
        }
      />
      <div className="filters">
        <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search videos" />
      </div>
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading && !data ? (
        <div className="center-pad">
          <Spinner size={28} />
        </div>
      ) : !data.length ? (
        <EmptyState icon="captions" title="No music videos yet" />
      ) : (
        <div className="table-wrap" aria-busy={loading}>
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Video</th>
                <th scope="col">Status</th>
                <th scope="col" className="num">Tracks</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((v) => (
                <tr key={v.id}>
                  <td>
                    <span className="table__title">{v.title}</span>
                    <span className="text-muted text-sm" style={{ display: 'block' }}>
                      {v.artist.name}
                    </span>
                  </td>
                  <td>
                    <StatusBadge status={v.status} />
                  </td>
                  <td className="num">{v.subtitleCount ? v.subtitleCount : <span className="text-danger">0</span>}</td>
                  <td>
                    <Link to={`/admin/videos/${v.id}`} className="btn btn--ghost btn--sm">
                      <Icon name="captions" size={14} /> Manage
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
