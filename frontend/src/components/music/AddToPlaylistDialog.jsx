import { useState } from 'react';
import Dialog from '../ui/Dialog.jsx';
import Icon from '../ui/Icon.jsx';
import Artwork from '../ui/Artwork.jsx';
import { ErrorState, Spinner } from '../ui/Feedback.jsx';
import { TextField } from '../ui/Form.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { userService } from '../../services/userService.js';
import { useToast } from '../../context/ToastContext.jsx';

/** Pick one of the user's playlists (or create a new one) for a song. */
export default function AddToPlaylistDialog({ song, onClose, onChanged }) {
  const toast = useToast();
  const { data: playlists, loading, error, reload } = useAsync(() => userService.playlists(), []);
  const [busyId, setBusyId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState(null);

  const add = async (playlist) => {
    setBusyId(playlist.id);
    try {
      await userService.addToPlaylist(playlist.id, song.id);
      toast.success(`Added to "${playlist.name}".`);
      onChanged?.();
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const createAndAdd = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setNameError('Give your playlist a name.');
      return;
    }
    setBusyId('new');
    try {
      const { data: playlist } = await userService.createPlaylist({ name: name.trim() });
      await userService.addToPlaylist(playlist.id, song.id);
      toast.success(`Playlist "${playlist.name}" created.`);
      onChanged?.();
      onClose();
    } catch (err) {
      setNameError(err.fieldErrors?.name || err.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Dialog title="Add to playlist" onClose={onClose} busy={Boolean(busyId)}>
      <div className="playlist-picker__song">
        <Artwork src={song.artworkUrl} alt="" size={48} />
        <div>
          <strong>{song.title}</strong>
          <p className="text-muted text-sm">{song.artist?.name}</p>
        </div>
      </div>

      {creating ? (
        <form onSubmit={createAndAdd} className="stack-sm">
          <TextField
            label="Playlist name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setNameError(null);
            }}
            error={nameError}
            maxLength={100}
            autoFocus
          />
          <div className="row-end">
            <button type="button" className="btn btn--ghost" onClick={() => setCreating(false)}>
              Back
            </button>
            <button type="submit" className="btn btn--primary" disabled={busyId === 'new'}>
              {busyId === 'new' ? 'Creating…' : 'Create and add'}
            </button>
          </div>
        </form>
      ) : (
        <>
          <button type="button" className="playlist-picker__item playlist-picker__new" onClick={() => setCreating(true)}>
            <span className="playlist-picker__icon">
              <Icon name="plus" />
            </span>
            New playlist
          </button>
          {loading ? (
            <div className="center-pad">
              <Spinner label="Loading playlists" />
            </div>
          ) : error ? (
            <ErrorState error={error} onRetry={reload} />
          ) : (
            <ul className="playlist-picker__list">
              {playlists.map((p) => (
                <li key={p.id}>
                  <button type="button" className="playlist-picker__item" onClick={() => add(p)} disabled={Boolean(busyId)}>
                    <Artwork src={p.artworkUrl} alt="" size={40} icon="list-music" />
                    <span className="playlist-picker__name">
                      {p.name}
                      <span className="text-muted text-sm">{p.songCount} songs</span>
                    </span>
                    {busyId === p.id ? <Spinner size={16} /> : null}
                  </button>
                </li>
              ))}
              {!playlists.length ? <li className="text-muted text-sm center-pad">You have no playlists yet.</li> : null}
            </ul>
          )}
        </>
      )}
    </Dialog>
  );
}
