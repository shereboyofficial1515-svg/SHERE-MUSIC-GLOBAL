import { Link } from 'react-router-dom';
import Icon from '../../components/ui/Icon.jsx';
import Artwork from '../../components/ui/Artwork.jsx';
import { EmptyState, ErrorState, Spinner } from '../../components/ui/Feedback.jsx';
import { AdminHeader } from '../../components/admin/AdminUI.jsx';
import StatusBadge from '../../components/content/StatusBadge.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useMeta } from '../../hooks/useMeta.js';
import { studioService } from '../../services/studioService.js';

/** My Lyrics: every song with the status of each lyrics language. */
export default function StudioLyricsPage() {
  useMeta({ title: 'Lyrics · Studio', noindex: true });
  const { data, loading, error, reload } = useAsync(() => studioService.lyricsOverview(), []);
  return (
    <>
      <AdminHeader title="Lyrics" description="Write lyrics, sync them to your music line by line, and submit them for review." />
      {error ? (
        <ErrorState error={error} onRetry={reload} title="Unable to load lyrics" />
      ) : loading ? (
        <div className="center-pad">
          <Spinner size={28} />
        </div>
      ) : !data.length ? (
        <EmptyState icon="lyrics" title="No songs yet" message="Upload a song, then add its lyrics here." action={<Link to="/studio/music/new" className="btn btn--primary">Upload music</Link>} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Song</th>
                <th scope="col">Lyrics</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map(({ song, lyrics }) => (
                <tr key={song.id}>
                  <td>
                    <div className="table__song">
                      <Artwork src={song.artworkUrl} alt="" size={40} />
                      <div>
                        <span className="table__title">{song.title}</span>
                        <span className="text-muted text-sm">{song.artistName}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    {lyrics.length ? (
                      <div className="stack-sm">
                        {lyrics.map((l) => (
                          <span key={l.id} className="row-gap wrap" style={{ gap: 6 }}>
                            <span className="badge badge--muted">{l.language.toUpperCase()}</span>
                            <StatusBadge status={l.status} />
                            <span className="text-sm text-muted">{l.isSynced ? 'Synced' : 'Not synced'}</span>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted text-sm">No lyrics yet</span>
                    )}
                  </td>
                  <td>
                    <div className="table__actions">
                      <Link to={`/studio/lyrics/${song.id}`} className="btn btn--secondary btn--sm">
                        <Icon name={lyrics.length ? 'edit' : 'plus'} size={14} /> {lyrics.length ? 'Edit' : 'Add lyrics'}
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
