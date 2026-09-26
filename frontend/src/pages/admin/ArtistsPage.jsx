import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/ui/Icon.jsx';
import Artwork from '../../components/ui/Artwork.jsx';
import Dialog, { ConfirmDialog } from '../../components/ui/Dialog.jsx';
import { EmptyState, ErrorState, Spinner } from '../../components/ui/Feedback.jsx';
import { TextArea, TextField } from '../../components/ui/Form.jsx';
import { AdminHeader, ImagePicker, Pagination, SearchInput } from '../../components/admin/AdminUI.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import { useMeta } from '../../hooks/useMeta.js';
import { adminService, toFormData } from '../../services/adminService.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import { checkFile } from '../../utils/audio.js';
import { formatCount } from '../../utils/format.js';

function ArtistDialog({ artist, onClose, onSaved }) {
  const toast = useToast();
  const { settings } = useSettings();
  const [form, setForm] = useState({ name: artist?.name || '', bio: artist?.bio || '' });
  const [image, setImage] = useState(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return setErrors({ name: 'Enter the artist name.' });
    setBusy(true);
    try {
      const body = toFormData({ name: form.name.trim(), bio: form.bio.trim() || null, ...(removeImage && !image ? { removeImage: true } : {}) }, { image });
      const { data } = await adminService.saveArtist(artist?.id, body);
      toast.success(artist ? 'Artist updated.' : `Artist "${data.name}" created.`);
      onSaved(data);
    } catch (err) {
      const fieldErrors = err.fieldErrors || {};
      setErrors(Object.keys(fieldErrors).length ? fieldErrors : { name: err.message });
      setBusy(false);
    }
  };

  return (
    <Dialog
      title={artist ? 'Edit artist' : 'New artist'}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="artist-form" className="btn btn--primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save artist'}
          </button>
        </>
      }
    >
      <form id="artist-form" className="stack" onSubmit={submit}>
        <TextField label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={errors.name} maxLength={120} required autoFocus />
        <TextArea label="Biography" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} error={errors.bio} rows={5} maxLength={5000} />
        <ImagePicker
          label="Artist image"
          round
          currentUrl={artist?.imageUrl}
          file={image}
          removed={removeImage}
          onChange={(file) => {
            const problem = checkFile(file, 'image', settings.maxImageMb);
            setErrors((er) => ({ ...er, image: problem }));
            if (!problem) {
              setImage(file);
              setRemoveImage(false);
            }
          }}
          onRemove={() => {
            setImage(null);
            setRemoveImage(true);
          }}
          error={errors.image}
          hint={`JPG, PNG or WebP up to ${settings.maxImageMb} MB.`}
        />
      </form>
    </Dialog>
  );
}

export default function ArtistsPage() {
  useMeta({ title: 'Artists · Admin', noindex: true });
  const toast = useToast();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const term = useDebounce(q.trim(), 300);
  const { data, meta, loading, error, reload } = useAsync(() => adminService.artists({ q: term || undefined, page, limit: 25, sort: 'name' }), [term, page]);
  const [editing, setEditing] = useState(null); // artist | 'new' | null
  const [toDelete, setToDelete] = useState(null);
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    setBusy(true);
    try {
      await adminService.deleteArtist(toDelete.id);
      toast.success(`"${toDelete.name}" was deleted.`);
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
        title="Artists"
        description="Create and manage artist profiles."
        actions={
          <button type="button" className="btn btn--primary" onClick={() => setEditing('new')}>
            <Icon name="plus" size={16} /> New artist
          </button>
        }
      />
      <div className="filters">
        <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search artists" />
      </div>

      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading && !data ? (
        <div className="center-pad">
          <Spinner size={28} />
        </div>
      ) : !data.length ? (
        <EmptyState icon="mic" title={term ? 'No matching artists' : 'No artists yet'} action={<button type="button" className="btn btn--primary" onClick={() => setEditing('new')}>Create artist</button>} />
      ) : (
        <div className="table-wrap" aria-busy={loading}>
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Artist</th>
                <th scope="col" className="num">Songs</th>
                <th scope="col" className="num hide-sm">Albums</th>
                <th scope="col" className="num hide-sm">Plays</th>
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
                      <Artwork src={a.imageUrl} alt="" size={40} rounded icon="mic" />
                      <div>
                        <span className="table__title">{a.name}</span>
                        {a.bio ? <span className="text-muted text-sm line-clamp-1">{a.bio}</span> : null}
                      </div>
                    </div>
                  </td>
                  <td className="num">
                    <Link to={`/admin/songs?artist=${a.id}`} title="View this artist's songs">
                      {a.totalSongCount}
                    </Link>
                  </td>
                  <td className="num hide-sm">{a.albumCount}</td>
                  <td className="num hide-sm">{formatCount(a.totalPlays)}</td>
                  <td>
                    <div className="table__actions">
                      <Link to={`/admin/songs?artist=${a.id}`} className="btn btn--ghost btn--sm hide-sm">
                        Songs
                      </Link>
                      <button type="button" className="icon-btn" onClick={() => setEditing(a)} aria-label={`Edit ${a.name}`}>
                        <Icon name="edit" size={18} />
                      </button>
                      <button type="button" className="icon-btn icon-btn--danger" onClick={() => setToDelete(a)} aria-label={`Delete ${a.name}`}>
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
        <ArtistDialog
          artist={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      ) : null}
      {toDelete ? (
        <ConfirmDialog
          title="Delete artist?"
          message={
            toDelete.totalSongCount || toDelete.albumCount
              ? `"${toDelete.name}" still has ${toDelete.totalSongCount} song(s) and ${toDelete.albumCount} album(s). Delete or reassign them first.`
              : `"${toDelete.name}" will be permanently deleted.`
          }
          confirmLabel="Delete artist"
          danger
          busy={busy}
          onConfirm={remove}
          onClose={() => setToDelete(null)}
        />
      ) : null}
    </>
  );
}
