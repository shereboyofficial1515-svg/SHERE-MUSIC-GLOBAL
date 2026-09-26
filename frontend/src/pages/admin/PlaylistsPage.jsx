import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/ui/Icon.jsx';
import Artwork from '../../components/ui/Artwork.jsx';
import { ConfirmDialog } from '../../components/ui/Dialog.jsx';
import { EmptyState, ErrorState, Spinner } from '../../components/ui/Feedback.jsx';
import { AdminHeader, Pagination, SearchInput } from '../../components/admin/AdminUI.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import { useMeta } from '../../hooks/useMeta.js';
import { adminService } from '../../services/adminService.js';
import { useToast } from '../../context/ToastContext.jsx';
import { cx, formatDate } from '../../utils/format.js';

export default function PlaylistsPage() {
  useMeta({ title: 'Playlists · Admin', noindex: true });
  const toast = useToast();
  const [q, setQ] = useState('');
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const term = useDebounce(q.trim(), 300);
  const { data, meta, loading, error, reload, setData } = useAsync(
    () => adminService.playlists({ q: term || undefined, featured: featuredOnly || undefined, page, limit: 25 }),
    [term, featuredOnly, page]
  );
  const [busyId, setBusyId] = useState(null);
  const [toDelete, setToDelete] = useState(null);

  const update = async (playlist, body, message) => {
    setBusyId(playlist.id);
    try {
      const res = await adminService.updatePlaylist(playlist.id, body);
      setData((list) => list.map((p) => (p.id === playlist.id ? res.data : p)));
      toast.success(message(res.data));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const remove = async () => {
    setBusyId(toDelete.id);
    try {
      await adminService.deletePlaylist(toDelete.id);
      toast.success('Playlist deleted.');
      setToDelete(null);
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <AdminHeader
        title="Playlists"
        description="Feature public playlists on the home page. To curate an official playlist, create it from your own library, then feature it here."
        actions={
          <Link to="/playlists" className="btn btn--secondary">
            <Icon name="list-music" size={16} /> My playlists
          </Link>
        }
      />
      <div className="filters">
        <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search playlists or owners" />
        <button type="button" className={cx('chip', featuredOnly && 'chip--active')} aria-pressed={featuredOnly} onClick={() => { setFeaturedOnly((f) => !f); setPage(1); }}>
          <Icon name="star" size={14} /> Featured only
        </button>
      </div>

      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading && !data ? (
        <div className="center-pad">
          <Spinner size={28} />
        </div>
      ) : !data.length ? (
        <EmptyState icon="list-music" title="No playlists found" />
      ) : (
        <div className="table-wrap" aria-busy={loading}>
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Playlist</th>
                <th scope="col" className="num">Songs</th>
                <th scope="col">Visibility</th>
                <th scope="col" className="hide-md">Updated</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="table__song">
                      <Artwork src={p.artworkUrl} alt="" size={40} icon="list-music" />
                      <div>
                        {p.isPublic ? (
                          <Link to={`/playlists/${p.id}`} className="table__title">
                            {p.name}
                          </Link>
                        ) : (
                          <span className="table__title">{p.name}</span>
                        )}
                        <span className="text-muted text-sm">by {p.owner.name}</span>
                      </div>
                    </div>
                  </td>
                  <td className="num">{p.songCount}</td>
                  <td>
                    <div className="row-gap wrap">
                      <span className={cx('badge', p.isPublic ? 'badge--success' : 'badge--muted')}>
                        <Icon name={p.isPublic ? 'globe' : 'lock'} size={12} /> {p.isPublic ? 'Public' : 'Private'}
                      </span>
                      {p.isFeatured ? (
                        <span className="badge badge--gold">
                          <Icon name="star-filled" size={12} /> Featured
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="hide-md text-muted">{formatDate(p.updatedAt)}</td>
                  <td>
                    <div className="table__actions">
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        disabled={busyId === p.id}
                        onClick={() => update(p, { isFeatured: !p.isFeatured }, (d) => (d.isFeatured ? `"${d.name}" is now featured.` : `"${d.name}" is no longer featured.`))}
                      >
                        {p.isFeatured ? 'Unfeature' : 'Feature'}
                      </button>
                      {p.isPublic ? (
                        <button type="button" className="btn btn--ghost btn--sm hide-sm" disabled={busyId === p.id} onClick={() => update(p, { isPublic: false }, (d) => `"${d.name}" is now private.`)}>
                          Make private
                        </button>
                      ) : null}
                      <button type="button" className="icon-btn icon-btn--danger" onClick={() => setToDelete(p)} aria-label={`Delete ${p.name}`}>
                        <Icon name="trash" size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination meta={meta} onPage={setPage} />

      {toDelete ? (
        <ConfirmDialog
          title="Delete playlist?"
          message={`"${toDelete.name}" by ${toDelete.owner.name} will be permanently deleted.`}
          confirmLabel="Delete playlist"
          danger
          busy={busyId === toDelete.id}
          onConfirm={remove}
          onClose={() => setToDelete(null)}
        />
      ) : null}
    </>
  );
}
