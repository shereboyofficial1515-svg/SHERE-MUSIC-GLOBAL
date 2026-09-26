import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { EmptyState, ErrorState, Spinner } from '../../components/ui/Feedback.jsx';
import { AdminHeader, Pagination } from '../../components/admin/AdminUI.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useMeta } from '../../hooks/useMeta.js';
import { adminService } from '../../services/adminService.js';
import { formatDateTime } from '../../utils/format.js';

export default function DownloadsPage() {
  useMeta({ title: 'Downloads · Admin', noindex: true });
  const [params] = useSearchParams();
  const song = params.get('song') || undefined;
  const [page, setPage] = useState(1);
  const { data, meta, loading, error, reload } = useAsync(() => adminService.downloads({ song, page, limit: 50 }), [song, page]);

  return (
    <>
      <AdminHeader
        title="Downloads"
        description="Every download, newest first. Signed-out downloads are counted without a user."
        actions={
          <Link to="/admin/reports" className="btn btn--secondary">
            Export CSV
          </Link>
        }
      />
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading && !data ? (
        <div className="center-pad">
          <Spinner size={28} />
        </div>
      ) : !data.length ? (
        <EmptyState icon="download" title="No downloads yet" />
      ) : (
        <div className="table-wrap" aria-busy={loading}>
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Song</th>
                <th scope="col">User</th>
                <th scope="col">Date &amp; time</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.id}>
                  <td>
                    {d.song ? (
                      <>
                        <Link to={`/admin/songs/${d.song.id}/edit`} className="table__title">
                          {d.song.title}
                        </Link>
                        <span className="text-muted text-sm">{d.song.artist}</span>
                      </>
                    ) : (
                      <span className="text-muted">Deleted song</span>
                    )}
                  </td>
                  <td>
                    {d.user ? (
                      <>
                        <span className="table__title">{d.user.name}</span>
                        <span className="text-muted text-sm">{d.user.email}</span>
                      </>
                    ) : (
                      <span className="text-muted">Guest</span>
                    )}
                  </td>
                  <td className="text-muted">{formatDateTime(d.downloadedAt)}</td>
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
