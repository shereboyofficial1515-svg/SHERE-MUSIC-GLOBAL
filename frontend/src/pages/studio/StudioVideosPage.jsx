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
import { studioService } from '../../services/studioService.js';
import { useToast } from '../../context/ToastContext.jsx';
import { formatCount, formatDuration, timeAgo } from '../../utils/format.js';

/** Music-video list for Studio (own videos) and Admin (all videos). */
export function VideoList({ scope }) {
  const isAdmin = scope === 'admin';
  useMeta({ title: isAdmin ? 'Music videos · Admin' : 'Music videos · Studio', noindex: true });
  const service = isAdmin ? adminService : studioService;
  const base = isAdmin ? '/admin/videos' : '/studio/videos';
  const toast = useToast();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const term = useDebounce(q.trim(), 300);
  const { data, meta, loading, error, reload, setData } = useAsync(() => service.videos({ q: term || undefined, status, page, limit: 25, sort: status === 'pending' ? 'submitted' : 'created_desc' }), [term, status, page]);

  const feature = async (v) => {
    try {
      const res = await adminService.featureVideo(v.id, !v.isFeatured);
      setData((list) => list.map((x) => (x.id === v.id ? res.data : x)));
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <>
      <AdminHeader
        title="Music videos"
        description={isAdmin ? 'Everything on SHERE MUSIC VIDEO.' : 'Upload videos with subtitles. They go live after review.'}
        actions={
          <Link to={`${base}/new`} className="btn btn--primary">
            <Icon name="plus" size={16} /> New video
          </Link>
        }
      />
      <div className="filters">
        <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search videos" />
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
        <EmptyState icon="film" title="No videos yet" action={<Link to={`${base}/new`} className="btn btn--primary">New video</Link>} />
      ) : (
        <div className="table-wrap" aria-busy={loading}>
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Video</th>
                <th scope="col">Status</th>
                <th scope="col" className="num hide-sm">Views</th>
                <th scope="col" className="hide-md">Subtitles</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((v) => (
                <tr key={v.id}>
                  <td>
                    <div className="table__song">
                      <span className="table__thumb">{v.thumbnailUrl ? <img src={v.thumbnailUrl} alt="" /> : <Icon name="film" size={18} />}</span>
                      <div>
                        <Link to={`${base}/${v.id}`} className="table__title">
                          {v.title} {v.isFeatured ? <Icon name="star-filled" size={12} className="text-accent" title="Featured" /> : null}
                        </Link>
                        <span className="text-muted text-sm">
                          {v.artist.name}
                          {v.duration ? ` · ${formatDuration(v.duration)}` : ''} · {v.hasVideo ? 'file uploaded' : 'no file yet'} · {timeAgo(v.updatedAt || v.createdAt)}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <StatusBadge status={v.status} />
                  </td>
                  <td className="num hide-sm">{formatCount(v.viewCount)}</td>
                  <td className="hide-md">{v.subtitleCount || '—'}</td>
                  <td>
                    <div className="table__actions">
                      {isAdmin ? (
                        <button type="button" className="icon-btn" onClick={() => feature(v)} aria-pressed={v.isFeatured} aria-label={v.isFeatured ? `Unfeature ${v.title}` : `Feature ${v.title}`}>
                          <Icon name={v.isFeatured ? 'star-filled' : 'star'} size={18} />
                        </button>
                      ) : null}
                      <Link to={`${base}/${v.id}`} className="icon-btn" aria-label={`Edit ${v.title}`}>
                        <Icon name="edit" size={18} />
                      </Link>
                    </div>
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

export default function StudioVideosPage() {
  return <VideoList scope="studio" />;
}
