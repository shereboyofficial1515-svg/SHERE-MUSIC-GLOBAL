import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Icon from '../../components/ui/Icon.jsx';
import Dialog, { ConfirmDialog } from '../../components/ui/Dialog.jsx';
import { EmptyState, ErrorState } from '../../components/ui/Feedback.jsx';
import { TextArea, TextField, Toggle } from '../../components/ui/Form.jsx';
import CollectionHeader from '../../components/music/CollectionHeader.jsx';
import { SongList } from '../../components/music/SongRow.jsx';
import { RowSkeletons } from '../../components/music/Section.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useMeta } from '../../hooks/useMeta.js';
import { userService } from '../../services/userService.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useLibrary } from '../../context/LibraryContext.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import { checkFile, IMAGE_ACCEPT } from '../../utils/audio.js';

export function PlaylistFormDialog({ playlist, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: playlist?.name || '', description: playlist?.description || '', isPublic: playlist?.isPublic || false });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return setErrors({ name: 'Give your playlist a name.' });
    setBusy(true);
    try {
      const body = { name: form.name.trim(), description: form.description.trim() || null, isPublic: form.isPublic };
      const { data } = playlist ? await userService.updatePlaylist(playlist.id, body) : await userService.createPlaylist(body);
      toast.success(playlist ? 'Playlist updated.' : `Playlist "${data.name}" created.`);
      onSaved(data);
    } catch (err) {
      const fieldErrors = err.fieldErrors || {};
      setErrors(fieldErrors);
      if (!Object.keys(fieldErrors).length) toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      title={playlist ? 'Edit playlist' : 'New playlist'}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="playlist-form" className="btn btn--primary" disabled={busy}>
            {busy ? 'Saving…' : playlist ? 'Save changes' : 'Create playlist'}
          </button>
        </>
      }
    >
      <form id="playlist-form" onSubmit={submit} className="stack">
        <TextField label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={errors.name} maxLength={100} required autoFocus />
        <TextArea label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} error={errors.description} maxLength={500} rows={3} />
        <Toggle label="Public playlist" description="Anyone with the link can view and play it." checked={form.isPublic} onChange={(v) => setForm({ ...form, isPublic: v })} />
      </form>
    </Dialog>
  );
}

export default function PlaylistPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { settings } = useSettings();
  const { playlistsVersion } = useLibrary();
  const { data: playlist, loading, error, reload, setData } = useAsync(() => userService.playlist(id), [id, playlistsVersion]);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  useMeta({
    title: playlist?.name || 'Playlist',
    description: playlist?.description || (playlist ? `${playlist.name} — a playlist on SHERE MUSIC.` : undefined),
    image: playlist?.artworkUrl,
    noindex: playlist ? !playlist.isPublic : true,
  });

  if (error) {
    return (
      <div className="container page">
        {error.status === 404 ? (
          <EmptyState icon="list-music" title="Playlist not found" message="It may be private or deleted." action={<Link to="/" className="btn btn--secondary">Go home</Link>} />
        ) : (
          <ErrorState error={error} onRetry={reload} />
        )}
      </div>
    );
  }

  const removeSong = async (song) => {
    try {
      await userService.removeFromPlaylist(playlist.id, song.id);
      setData((p) => ({ ...p, songs: p.songs.filter((s) => s.id !== song.id), songCount: p.songCount - 1 }));
      toast.success(`Removed "${song.title}" from this playlist.`);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const deletePlaylist = async () => {
    setBusy(true);
    try {
      await userService.deletePlaylist(playlist.id);
      toast.success('Playlist deleted.');
      navigate('/playlists');
    } catch (err) {
      toast.error(err.message);
      setBusy(false);
    }
  };

  const uploadCover = async (file) => {
    const problem = checkFile(file, 'image', settings.maxImageMb);
    if (problem) return toast.error(problem);
    setBusy(true);
    try {
      const res = await userService.uploadPlaylistArtwork(playlist.id, file);
      setData((p) => ({ ...p, artworkUrl: res.data.artworkUrl }));
      toast.success('Cover updated.');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container page">
      <CollectionHeader
        loading={loading}
        kind={playlist?.isPublic ? 'Public playlist' : 'Private playlist'}
        title={playlist?.name}
        imageUrl={playlist?.artworkUrl}
        icon="list-music"
        songs={playlist?.songs}
        description={playlist?.description}
        subtitle={playlist ? <span className="text-muted">By {playlist.owner.name}</span> : null}
        actions={
          playlist?.isOwner ? (
            <>
              <button type="button" className="btn btn--secondary" onClick={() => setEditing(true)}>
                <Icon name="edit" size={16} /> Edit
              </button>
              <button type="button" className="btn btn--secondary" onClick={() => fileRef.current?.click()} disabled={busy}>
                <Icon name="image" size={16} /> {busy ? 'Uploading…' : 'Cover'}
              </button>
              <input ref={fileRef} type="file" accept={IMAGE_ACCEPT} hidden onChange={(e) => e.target.files[0] && uploadCover(e.target.files[0])} />
              <button type="button" className="btn btn--ghost text-danger" onClick={() => setConfirmDelete(true)}>
                <Icon name="trash" size={16} /> Delete
              </button>
            </>
          ) : null
        }
      />

      {loading ? (
        <RowSkeletons />
      ) : playlist.songs.length ? (
        <SongList
          songs={playlist.songs}
          label={`Songs in ${playlist.name}`}
          menuItems={playlist.isOwner ? (song) => [{ icon: 'trash', label: 'Remove from playlist', run: () => removeSong(song), danger: true }] : undefined}
        />
      ) : (
        <EmptyState
          icon="list-music"
          title="This playlist is empty"
          message={playlist.isOwner ? 'Add songs using the "More options" menu on any song.' : undefined}
          action={playlist.isOwner ? <Link to="/discover" className="btn btn--secondary">Find music</Link> : null}
        />
      )}

      {editing ? (
        <PlaylistFormDialog
          playlist={playlist}
          onClose={() => setEditing(false)}
          onSaved={(updated) => {
            setData((p) => ({ ...p, ...updated }));
            setEditing(false);
          }}
        />
      ) : null}
      {confirmDelete ? (
        <ConfirmDialog
          title="Delete playlist?"
          message={`"${playlist.name}" will be permanently deleted. The songs themselves are not affected.`}
          confirmLabel="Delete playlist"
          danger
          busy={busy}
          onConfirm={deletePlaylist}
          onClose={() => setConfirmDelete(false)}
        />
      ) : null}
    </div>
  );
}
