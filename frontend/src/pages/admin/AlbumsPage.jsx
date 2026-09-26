import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/ui/Icon.jsx';
import Artwork from '../../components/ui/Artwork.jsx';
import Dialog, { ConfirmDialog } from '../../components/ui/Dialog.jsx';
import { EmptyState, ErrorState, Spinner } from '../../components/ui/Feedback.jsx';
import { Select, TextArea, TextField } from '../../components/ui/Form.jsx';
import { AdminHeader, ImagePicker, Pagination, SearchInput } from '../../components/admin/AdminUI.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import { useMeta } from '../../hooks/useMeta.js';
import { adminService, toFormData } from '../../services/adminService.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import { checkFile } from '../../utils/audio.js';
import { formatDate } from '../../utils/format.js';

function AlbumDialog({ album, artists, onClose, onSaved }) {
  const toast = useToast();
  const { settings } = useSettings();
  const [form, setForm] = useState({
    title: album?.title || '',
    artistId: album?.artist.id || '',
    releaseDate: album?.releaseDate || '',
    description: album?.description || '',
  });
  const [artwork, setArtwork] = useState(null);
  const [removeArtwork, setRemoveArtwork] = useState(false);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const next = {};
    if (!form.title.trim()) next.title = 'Enter the album title.';
    if (!form.artistId) next.artistId = 'Choose an artist.';
    if (Object.keys(next).length) return setErrors(next);
    setBusy(true);
    try {
      const body = toFormData(
        { title: form.title.trim(), artistId: form.artistId, releaseDate: form.releaseDate || null, description: form.description.trim() || null, ...(removeArtwork && !artwork ? { removeArtwork: true } : {}) },
        { artwork }
      );
      const { data } = await adminService.saveAlbum(album?.id, body);
      toast.success(album ? 'Album updated.' : `Album "${data.title}" created.`);
      onSaved(data);
    } catch (err) {
      const fieldErrors = err.fieldErrors || {};
      setErrors(Object.keys(fieldErrors).length ? fieldErrors : { title: err.message });
      setBusy(false);
    }
  };

  return (
    <Dialog
      title={album ? 'Edit album' : 'New album'}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="album-form" className="btn btn--primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save album'}
          </button>
        </>
      }
    >
      <form id="album-form" className="stack" onSubmit={submit}>
        <TextField label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} error={errors.title} maxLength={160} required autoFocus />
        <Select label="Artist" value={form.artistId} onChange={(e) => setForm({ ...form, artistId: e.target.value })} error={errors.artistId} required hint={album?.totalSongCount ? 'An album with songs cannot move to another artist.' : undefined}>
          <option value="">Choose an artist</option>
          {artists.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
        <TextField label="Release date" type="date" value={form.releaseDate} onChange={(e) => setForm({ ...form, releaseDate: e.target.value })} error={errors.releaseDate} />
        <TextArea label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} error={errors.description} rows={3} maxLength={5000} />
        <ImagePicker
          label="Album artwork"
          currentUrl={album?.artworkUrl}
          file={artwork}
          removed={removeArtwork}
          onChange={(file) => {
            const problem = checkFile(file, 'image', settings.maxImageMb);
            setErrors((er) => ({ ...er, artwork: problem }));
            if (!problem) {
              setArtwork(file);
              setRemoveArtwork(false);
            }
          }}
          onRemove={() => {
            setArtwork(null);
            setRemoveArtwork(true);
          }}
          error={errors.artwork}
          hint={`Square JPG, PNG or WebP up to ${settings.maxImageMb} MB.`}
        />
      </form>
    </Dialog>
  );
}

/** Attach existing songs by the album's artist to the album. */
function AddSongsDialog({ album, onClose, onSaved }) {
  const toast = useToast();
  const { data: songs, loading, error, reload } = useAsync(() => adminService.songs({ artist: album.artist.id, limit: 100, sort: 'title' }), [album.id]);
  const [selected, setSelected] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const candidates = (songs || []).filter((s) => s.album?.id !== album.id);

  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const save = async () => {
    setBusy(true);
    try {
      const res = await adminService.addAlbumSongs(album.id, [...selected]);
      toast.success(res.meta?.message || 'Songs added.');
      onSaved();
    } catch (err) {
      toast.error(err.message);
      setBusy(false);
    }
  };

  return (
    <Dialog
      title={`Add songs to ${album.title}`}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" onClick={save} disabled={busy || !selected.size}>
            {busy ? 'Adding…' : `Add ${selected.size || ''} song${selected.size === 1 ? '' : 's'}`}
          </button>
        </>
      }
    >
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading ? (
        <div className="center-pad">
          <Spinner />
        </div>
      ) : !candidates.length ? (
        <p className="text-muted">All of {album.artist.name}&apos;s songs are already on this album. Upload a new song and choose this album.</p>
      ) : (
        <ul className="check-list">
          {candidates.map((s) => (
            <li key={s.id}>
              <label className="check-list__item">
                <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} />
                <Artwork src={s.artworkUrl} alt="" size={36} />
                <span>
                  {s.title}
                  <span className="text-muted text-sm">{s.album ? ` · currently on ${s.album.title}` : ' · single'}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}

export default function AlbumsPage() {
  useMeta({ title: 'Albums · Admin', noindex: true });
  const toast = useToast();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const term = useDebounce(q.trim(), 300);
  const artists = useAsync(() => adminService.artistOptions(), []);
  const { data, meta, loading, error, reload } = useAsync(() => adminService.albums({ q: term || undefined, page, limit: 25, sort: 'latest' }), [term, page]);
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    setBusy(true);
    try {
      await adminService.deleteAlbum(toDelete.id);
      toast.success(`"${toDelete.title}" was deleted.`);
      setToDelete(null);
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <AdminHeader
        title="Albums"
        description="Create albums and group songs into them."
        actions={
          <button type="button" className="btn btn--primary" onClick={() => setEditing('new')} disabled={!artists.data?.length} title={!artists.data?.length ? 'Create an artist first' : undefined}>
            <Icon name="plus" size={16} /> New album
          </button>
        }
      />
      <div className="filters">
        <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search albums or artists" />
      </div>

      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading && !data ? (
        <div className="center-pad">
          <Spinner size={28} />
        </div>
      ) : !data.length ? (
        <EmptyState icon="disc" title={term ? 'No matching albums' : 'No albums yet'} message={!artists.data?.length ? 'Create an artist first, then add albums.' : undefined} />
      ) : (
        <div className="table-wrap" aria-busy={loading}>
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Album</th>
                <th scope="col" className="hide-sm">Released</th>
                <th scope="col" className="num">Songs</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((a) => (
                <tr key={a.id}>
                  <td>
                    <div className="table__song">
                      <Artwork src={a.artworkUrl} alt="" size={40} icon="disc" />
                      <div>
                        <span className="table__title">{a.title}</span>
                        <span className="text-muted text-sm">{a.artist.name}</span>
                      </div>
                    </div>
                  </td>
                  <td className="hide-sm text-muted">{formatDate(a.releaseDate) || '—'}</td>
                  <td className="num">
                    <Link to={`/admin/songs?artist=${a.artist.id}`}>{a.totalSongCount}</Link>
                  </td>
                  <td>
                    <div className="table__actions">
                      <button type="button" className="btn btn--ghost btn--sm" onClick={() => setAdding(a)}>
                        <Icon name="plus" size={14} /> <span className="hide-xs">Songs</span>
                      </button>
                      <button type="button" className="icon-btn" onClick={() => setEditing(a)} aria-label={`Edit ${a.title}`}>
                        <Icon name="edit" size={18} />
                      </button>
                      <button type="button" className="icon-btn icon-btn--danger" onClick={() => setToDelete(a)} aria-label={`Delete ${a.title}`}>
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

      {editing ? (
        <AlbumDialog
          album={editing === 'new' ? null : editing}
          artists={artists.data || []}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      ) : null}
      {adding ? (
        <AddSongsDialog
          album={adding}
          onClose={() => setAdding(null)}
          onSaved={() => {
            setAdding(null);
            reload();
          }}
        />
      ) : null}
      {toDelete ? (
        <ConfirmDialog
          title="Delete album?"
          message={`"${toDelete.title}" will be deleted. Its ${toDelete.totalSongCount} song(s) are kept and become singles.`}
          confirmLabel="Delete album"
          danger
          busy={busy}
          onConfirm={remove}
          onClose={() => setToDelete(null)}
        />
      ) : null}
    </>
  );
}
