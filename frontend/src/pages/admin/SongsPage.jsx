import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Icon from '../../components/ui/Icon.jsx';
import Artwork from '../../components/ui/Artwork.jsx';
import { ConfirmDialog } from '../../components/ui/Dialog.jsx';
import { EmptyState, ErrorState, Spinner } from '../../components/ui/Feedback.jsx';
import { AdminHeader, Pagination, SearchInput, StatusBadge } from '../../components/admin/AdminUI.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import { useMeta } from '../../hooks/useMeta.js';
import { adminService } from '../../services/adminService.js';
import { useToast } from '../../context/ToastContext.jsx';
import { usePlayer } from '../../context/PlayerContext.jsx';
import { formatCount, formatDate, formatDuration } from '../../utils/format.js';

export default function SongsPage() {
  useMeta({ title: 'Music · Admin', noindex: true });
  const toast = useToast();
  const { playSong } = usePlayer();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') || '');
  const term = useDebounce(q.trim(), 300);
  const status = params.get('status') || 'all';
  const genre = params.get('genre') || '';
  const artist = params.get('artist') || '';
  const sort = params.get('sort') || 'created_desc';
  const page = Number(params.get('page')) || 1;
  const [busyId, setBusyId] = useState(null);
  const [toDelete, setToDelete] = useState(null);

  const genres = useAsync(() => adminService.genres(), []);
  const artists = useAsync(() => adminService.artistOptions(), []);
  const { data: songs, meta, loading, error, reload, setData } = useAsync(
    () => adminService.songs({ q: term || undefined, status, genre: genre || undefined, artist: artist || undefined, sort, page, limit: 25 }),
    [term, status, genre, artist, sort, page]
  );

  const update = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };

  const replaceSong = (updated) => setData((list) => list.map((s) => (s.id === updated.id ? updated : s)));

  const togglePublish = async (song) => {
    setBusyId(song.id);
    try {
      const res = await adminService.publishSong(song.id, !song.isPublished);
      replaceSong(res.data);
      toast.success(res.meta?.message);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const toggleFeatured = async (song) => {
    setBusyId(song.id);
    try {
      const res = await adminService.featureSong(song.id, !song.isFeatured);
      replaceSong(res.data);
      toast.success(res.data.isFeatured ? `"${song.title}" is now featured.` : `"${song.title}" is no longer featured.`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    setBusyId(toDelete.id);
    try {
      await adminService.deleteSong(toDelete.id);
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
        title="Music"
        description="Upload, edit, publish and remove songs."
        actions={
          <Link to="/admin/songs/new" className="btn btn--primary">
            <Icon name="upload" size={16} /> Upload music
          </Link>
        }
      />

      <div className="filters">
        <SearchInput value={q} onChange={(v) => { setQ(v); update('page', ''); }} placeholder="Search title, artist, album, genre" />
        <select className="input select select--inline" value={status} onChange={(e) => update('status', e.target.value === 'all' ? '' : e.target.value)} aria-label="Filter by status">
          <option value="all">All statuses</option>
          <option value="published">Published</option>
          <option value="draft">Drafts</option>
        </select>
        <select className="input select select--inline" value={genre} onChange={(e) => update('genre', e.target.value)} aria-label="Filter by genre">
          <option value="">All genres</option>
          {(genres.data || []).map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        <select className="input select select--inline" value={artist} onChange={(e) => update('artist', e.target.value)} aria-label="Filter by artist">
          <option value="">All artists</option>
          {(artists.data || []).map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <select className="input select select--inline" value={sort} onChange={(e) => update('sort', e.target.value)} aria-label="Sort songs">
          <option value="created_desc">Newest first</option>
          <option value="created_asc">Oldest first</option>
          <option value="title">Title A–Z</option>
          <option value="plays">Most played</option>
          <option value="downloads">Most downloaded</option>
          <option value="release">Release date</option>
        </select>
      </div>

      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading && !songs ? (
        <div className="center-pad">
          <Spinner size={28} />
        </div>
      ) : !songs.length ? (
        <EmptyState icon="music" title="No songs found" message={term || status !== 'all' || genre || artist ? 'Try different filters.' : 'Upload your first song to get started.'} action={<Link to="/admin/songs/new" className="btn btn--primary">Upload music</Link>} />
      ) : (
        <div className="table-wrap" aria-busy={loading}>
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Song</th>
                <th scope="col" className="hide-md">Genre</th>
                <th scope="col">Status</th>
                <th scope="col" className="hide-sm num">Plays</th>
                <th scope="col" className="hide-sm num">Downloads</th>
                <th scope="col" className="hide-md">Uploaded</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {songs.map((song) => (
                <tr key={song.id}>
                  <td>
                    <div className="table__song">
                      <button type="button" className="table__art-btn" onClick={() => playSong(song, [song])} aria-label={`Preview ${song.title}`} disabled={!song.isPublished} title={song.isPublished ? 'Preview' : 'Publish to preview in the player'}>
                        <Artwork src={song.artworkUrl} alt="" size={40} />
                        {song.isPublished ? <Icon name="play" size={14} className="table__art-play" /> : null}
                      </button>
                      <div>
                        <Link to={`/admin/songs/${song.id}/edit`} className="table__title">
                          {song.title}
                          {song.isFeatured ? <Icon name="star-filled" size={12} className="text-gold" title="Featured" /> : null}
                        </Link>
                        <span className="text-muted text-sm">
                          {song.artist.name}
                          {song.album ? ` · ${song.album.title}` : ''} · {formatDuration(song.duration)}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="hide-md">{song.genre?.name || <span className="text-muted">—</span>}</td>
                  <td>
                    <StatusBadge published={song.isPublished} />
                  </td>
                  <td className="hide-sm num">{formatCount(song.playCount)}</td>
                  <td className="hide-sm num">{formatCount(song.downloadCount)}</td>
                  <td className="hide-md text-muted">{formatDate(song.createdAt)}</td>
                  <td>
                    <div className="table__actions">
                      <button type="button" className="btn btn--ghost btn--sm" onClick={() => togglePublish(song)} disabled={busyId === song.id}>
                        {song.isPublished ? 'Unpublish' : 'Publish'}
                      </button>
                      <button type="button" className="icon-btn" onClick={() => toggleFeatured(song)} disabled={busyId === song.id} aria-label={song.isFeatured ? `Unfeature ${song.title}` : `Feature ${song.title}`} aria-pressed={song.isFeatured}>
                        <Icon name={song.isFeatured ? 'star-filled' : 'star'} size={18} />
                      </button>
                      <Link to={`/admin/songs/${song.id}/edit`} className="icon-btn" aria-label={`Edit ${song.title}`}>
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
      <Pagination meta={meta} onPage={(p) => update('page', String(p))} />

      {toDelete ? (
        <ConfirmDialog
          title="Delete song?"
          message={`"${toDelete.title}" and its audio and artwork files will be permanently deleted. Its play and download history will also be removed.`}
          confirmLabel="Delete song"
          danger
          busy={busyId === toDelete.id}
          onConfirm={confirmDelete}
          onClose={() => setToDelete(null)}
        />
      ) : null}
    </>
  );
}
