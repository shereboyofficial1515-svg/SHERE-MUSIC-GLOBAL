import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../../components/ui/Icon.jsx';
import Artwork from '../../components/ui/Artwork.jsx';
import { ConfirmDialog } from '../../components/ui/Dialog.jsx';
import { EmptyState, ErrorState, Spinner } from '../../components/ui/Feedback.jsx';
import { AdminHeader, Pagination, SearchInput } from '../../components/admin/AdminUI.jsx';
import StatusBadge, { STATUS_OPTIONS } from '../../components/content/StatusBadge.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import { useMeta } from '../../hooks/useMeta.js';
import { studioService } from '../../services/studioService.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { formatCount, formatDuration, formatMoney, timeAgo } from '../../utils/format.js';

export default function StudioMusicPage() {
  useMeta({ title: 'My Music · Studio', noindex: true });
  const toast = useToast();
  const { settings } = useSettings();
  const { user } = useAuth();
  const navigate = useNavigate();
  const fee = settings.monetization?.artistSubmission;
  const feeLabel = user?.role !== 'admin' && fee?.enabled ? formatMoney(fee.fee, settings.monetization.currency) : null;
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const term = useDebounce(q.trim(), 300);
  const { data, meta, loading, error, reload, setData } = useAsync(() => studioService.songs({ q: term || undefined, status, page, limit: 25 }), [term, status, page]);
  const [busyId, setBusyId] = useState(null);
  const [toDelete, setToDelete] = useState(null);

  const act = async (song, action) => {
    setBusyId(song.id);
    try {
      const res = action === 'submit' ? await studioService.submitSong(song.id) : await studioService.publishSong(song.id, action === 'publish');
      setData((list) => list.map((s) => (s.id === song.id ? res.data : s)));
      toast.success(res.meta?.message);
    } catch (err) {
      if (err.code === 'SUBMISSION_FEE_REQUIRED') navigate(`/studio/submit/${song.id}`);
      else toast.error(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const remove = async () => {
    setBusyId(toDelete.id);
    try {
      await studioService.deleteSong(toDelete.id);
      toast.success(`"${toDelete.title}" was deleted.`);
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
        title="My Music"
        description={settings.artistAutoPublish ? 'Your songs go live when you publish them.' : 'New songs are reviewed by the SHERE MUSIC team before they go live.'}
        actions={
          <Link to="/studio/music/new" className="btn btn--primary">
            <Icon name="upload" size={16} /> Upload music
          </Link>
        }
      />
      <div className="filters">
        <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search your songs" />
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
        <EmptyState icon="music" title={term || status !== 'all' ? 'No matching songs' : 'No songs yet'} message="Upload your first song to get started." action={<Link to="/studio/music/new" className="btn btn--primary">Upload music</Link>} />
      ) : (
        <div className="table-wrap" aria-busy={loading}>
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Song</th>
                <th scope="col">Status</th>
                <th scope="col" className="num hide-sm">Plays</th>
                <th scope="col" className="num hide-sm">Downloads</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((song) => (
                <tr key={song.id}>
                  <td>
                    <div className="table__song">
                      <Artwork src={song.artworkUrl} alt="" size={40} />
                      <div>
                        <Link to={`/studio/music/${song.id}`} className="table__title">
                          {song.title}
                        </Link>
                        <span className="text-muted text-sm">
                          {song.artist.name} · {formatDuration(song.duration)} · updated {timeAgo(song.updatedAt || song.createdAt)}
                        </span>
                        {song.status === 'rejected' && song.rejectionReason ? <span className="text-sm text-danger">“{song.rejectionReason}”</span> : null}
                      </div>
                    </div>
                  </td>
                  <td>
                    <StatusBadge status={song.status} />
                  </td>
                  <td className="num hide-sm">{formatCount(song.playCount)}</td>
                  <td className="num hide-sm">{formatCount(song.downloadCount)}</td>
                  <td>
                    <div className="table__actions">
                      {['draft', 'rejected'].includes(song.status) && feeLabel ? (
                        <Link to={`/studio/submit/${song.id}`} className="btn btn--ghost btn--sm" title={`Submission fee: ${feeLabel}`}>
                          Submit · {feeLabel}
                        </Link>
                      ) : null}
                      {['draft', 'rejected'].includes(song.status) && !feeLabel ? (
                        <button type="button" className="btn btn--ghost btn--sm" onClick={() => act(song, 'submit')} disabled={busyId === song.id}>
                          {settings.artistAutoPublish ? 'Publish' : 'Submit'}
                        </button>
                      ) : null}
                      {song.status === 'approved' ? (
                        <button type="button" className="btn btn--ghost btn--sm" onClick={() => act(song, 'publish')} disabled={busyId === song.id}>
                          Publish
                        </button>
                      ) : null}
                      <Link to={`/studio/lyrics/${song.id}`} className="icon-btn" aria-label={`Lyrics for ${song.title}`} title="Lyrics">
                        <Icon name="lyrics" size={18} />
                      </Link>
                      <Link to={`/studio/music/${song.id}`} className="icon-btn" aria-label={`Edit ${song.title}`}>
                        <Icon name="edit" size={18} />
                      </Link>
                      <button type="button" className="icon-btn icon-btn--danger" onClick={() => setToDelete(song)} aria-label={`Delete ${song.title}`}>
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
        <ConfirmDialog title="Delete song?" message={`"${toDelete.title}", its lyrics and its statistics will be permanently deleted.`} confirmLabel="Delete song" danger busy={busyId === toDelete.id} onConfirm={remove} onClose={() => setToDelete(null)} />
      ) : null}
    </>
  );
}
