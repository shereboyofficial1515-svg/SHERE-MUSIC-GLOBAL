import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/ui/Icon.jsx';
import { EmptyState, ErrorState } from '../../components/ui/Feedback.jsx';
import { PlaylistCard } from '../../components/music/Cards.jsx';
import { CardSkeletons } from '../../components/music/Section.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useMeta } from '../../hooks/useMeta.js';
import { userService } from '../../services/userService.js';
import { useLibrary } from '../../context/LibraryContext.jsx';
import { PlaylistFormDialog } from '../public/PlaylistPage.jsx';

export default function PlaylistsPage() {
  useMeta({ title: 'Your playlists', noindex: true });
  const navigate = useNavigate();
  const { playlistsVersion, bumpPlaylists } = useLibrary();
  const { data, loading, error, reload } = useAsync(() => userService.playlists(), [playlistsVersion]);
  const [creating, setCreating] = useState(false);

  return (
    <div className="container page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Your library</p>
          <h1 className="page-title">Playlists</h1>
        </div>
        <button type="button" className="btn btn--primary" onClick={() => setCreating(true)}>
          <Icon name="plus" size={16} /> New playlist
        </button>
      </header>

      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading ? (
        <div className="card-grid">
          <CardSkeletons count={6} />
        </div>
      ) : !data.length ? (
        <EmptyState
          icon="list-music"
          title="No playlists yet"
          message="Create a playlist and add songs from any song's options menu."
          action={
            <button type="button" className="btn btn--primary" onClick={() => setCreating(true)}>
              <Icon name="plus" size={16} /> Create playlist
            </button>
          }
        />
      ) : (
        <div className="card-grid">
          {data.map((p) => (
            <PlaylistCard key={p.id} playlist={p} />
          ))}
        </div>
      )}

      {creating ? (
        <PlaylistFormDialog
          onClose={() => setCreating(false)}
          onSaved={(playlist) => {
            setCreating(false);
            bumpPlaylists();
            navigate(`/playlists/${playlist.id}`);
          }}
        />
      ) : null}
    </div>
  );
}
