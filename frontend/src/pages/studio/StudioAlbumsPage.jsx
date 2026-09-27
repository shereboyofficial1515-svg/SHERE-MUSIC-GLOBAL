import { useState } from 'react';
import Icon from '../../components/ui/Icon.jsx';
import Artwork from '../../components/ui/Artwork.jsx';
import Dialog, { ConfirmDialog } from '../../components/ui/Dialog.jsx';
import { Alert, EmptyState, ErrorState, Spinner } from '../../components/ui/Feedback.jsx';
import { Select, TextArea, TextField } from '../../components/ui/Form.jsx';
import { AdminHeader, ImagePicker } from '../../components/admin/AdminUI.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useMeta } from '../../hooks/useMeta.js';
import { studioService } from '../../services/studioService.js';
import { toFormData } from '../../services/contentService.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import { checkFile } from '../../utils/audio.js';
import { formatDate } from '../../utils/format.js';

function AlbumDialog({ album, options, onClose, onSaved }) {
  const toast = useToast();
  const { settings } = useSettings();
  const [form, setForm] = useState({
    title: album?.title || '',
    artistId: album?.artist.id || (options.artists.length === 1 ? options.artists[0].id : ''),
    releaseDate: album?.releaseDate || '',
    description: album?.description || '',
  });
  const [artwork, setArtwork] = useState(null);
  const [removeArtwork, setRemoveArtwork] = useState(false);
  const [songIds, setSongIds] = useState([]);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const loose = options.songs.filter((s) => s.artist_id === form.artistId);

  const submit = async (e) => {
    e.preventDefault();
    const next = {};
    if (!form.title.trim()) next.title = 'Enter the album title.';
    if (!form.artistId) next.artistId = 'Choose an artist.';
    if (Object.keys(next).length) return setErrors(next);
    setBusy(true);
    try {
      const body = toFormData({ title: form.title.trim(), artistId: form.artistId, releaseDate: form.releaseDate || null, description: form.description.trim() || null, ...(removeArtwork && !artwork ? { removeArtwork: true } : {}) }, { artwork });
      const { data } = await studioService.saveAlbum(album?.id, body);
      if (songIds.length) await studioService.addAlbumSongs(data.id, songIds);
      toast.success(album ? 'Album saved.' : `Album "${data.title}" created.`);
      onSaved();
    } catch (err) {
      setErrors(Object.keys(err.fieldErrors || {}).length ? err.fieldErrors : { title: err.message });
      setBusy(false);
    }
    return undefined;
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
        <Select label="Artist" value={form.artistId} onChange={(e) => { setForm({ ...form, artistId: e.target.value }); setSongIds([]); }} error={errors.artistId} required>
          <option value="">Choose an artist</option>
          {options.artists.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
        <TextField label="Release date" type="date" value={form.releaseDate} onChange={(e) => setForm({ ...form, releaseDate: e.target.value })} />
        <TextArea label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} maxLength={5000} />
        <ImagePicker
          label="Album artwork"
          currentUrl={album?.artworkUrl}
          file={artwork}
          removed={removeArtwork}
          onChange={(f) => {
            const problem = checkFile(f, 'image', settings.maxImageMb);
            if (problem) return toast.error(problem);
            setArtwork(f);
            setRemoveArtwork(false);
            return undefined;
          }}
          onRemove={() => {
            setArtwork(null);
            setRemoveArtwork(true);
          }}
        />
        {loose.length ? (
          <fieldset className="field">
            <legend className="field__label">Add songs to this album</legend>
            <ul className="check-list">
              {loose.map((s) => (
                <li key={s.id}>
                  <label className="check-list__item">
                    <input type="checkbox" checked={songIds.includes(s.id)} onChange={() => setSongIds((ids) => (ids.includes(s.id) ? ids.filter((x) => x !== s.id) : [...ids, s.id]))} />
                    {s.title}
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        ) : null}
      </form>
    </Dialog>
  );
}

export default function StudioAlbumsPage() {
  useMeta({ title: 'Albums · Studio', noindex: true });
  const toast = useToast();
  const options = useAsync(() => studioService.options(), []);
  const { data, loading, error, reload } = useAsync(() => studioService.albums(), []);
  const [editing, setEditing] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    setBusy(true);
    try {
      await studioService.deleteAlbum(toDelete.id);
      toast.success('Album deleted. Its songs are now singles.');
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
        description="Group your songs into albums and EPs."
        actions={
          <button type="button" className="btn btn--primary" onClick={() => setEditing('new')} disabled={!options.data?.artists?.length}>
            <Icon name="plus" size={16} /> New album
          </button>
        }
      />
      {options.data && !options.data.artists.length ? <Alert type="info">Create an artist profile first.</Alert> : null}
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading ? (
        <div className="center-pad">
          <Spinner size={28} />
        </div>
      ) : !data.length ? (
        <EmptyState icon="disc" title="No albums yet" />
      ) : (
        <div className="card-grid">
          {data.map((a) => (
            <article key={a.id} className="entity-card" style={{ margin: 0 }}>
              <Artwork src={a.artworkUrl} alt="" icon="disc" />
              <span className="entity-card__title">{a.title}</span>
              <span className="entity-card__sub">
                {a.artist.name} · {a.totalSongCount} songs{a.releaseDate ? ` · ${formatDate(a.releaseDate, { year: 'numeric' })}` : ''}
              </span>
              <div className="row-gap">
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEditing(a)}>
                  <Icon name="edit" size={14} /> Edit
                </button>
                <button type="button" className="icon-btn icon-btn--danger" onClick={() => setToDelete(a)} aria-label={`Delete ${a.title}`}>
                  <Icon name="trash" size={16} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      {editing && options.data ? (
        <AlbumDialog
          album={editing === 'new' ? null : editing}
          options={options.data}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
            options.reload();
          }}
        />
      ) : null}
      {toDelete ? <ConfirmDialog title="Delete album?" message={`"${toDelete.title}" will be deleted. Its songs are kept as singles.`} confirmLabel="Delete album" danger busy={busy} onConfirm={remove} onClose={() => setToDelete(null)} /> : null}
    </>
  );
}
