import { Link, useParams } from 'react-router-dom';
import { EmptyState, ErrorState } from '../../components/ui/Feedback.jsx';
import CollectionHeader from '../../components/music/CollectionHeader.jsx';
import { SongList } from '../../components/music/SongRow.jsx';
import { RowSkeletons } from '../../components/music/Section.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useMeta } from '../../hooks/useMeta.js';
import { musicService } from '../../services/musicService.js';
import { formatDate } from '../../utils/format.js';

export default function AlbumPage() {
  const { id } = useParams();
  const { data: album, loading, error, reload } = useAsync(() => musicService.album(id), [id]);
  useMeta({
    title: album ? `${album.title} by ${album.artist.name}` : 'Album',
    description: album ? album.description?.slice(0, 160) || `Stream and download the album "${album.title}" by ${album.artist.name} on SHERE MUSIC.` : undefined,
    image: album?.artworkUrl,
    type: 'music.album',
  });

  if (error) {
    return (
      <div className="container page">
        {error.status === 404 ? (
          <EmptyState icon="disc" title="Album not found" action={<Link to="/albums" className="btn btn--secondary">All albums</Link>} />
        ) : (
          <ErrorState error={error} onRetry={reload} />
        )}
      </div>
    );
  }

  return (
    <div className="container page">
      <CollectionHeader
        loading={loading}
        kind="Album"
        title={album?.title}
        imageUrl={album?.artworkUrl}
        icon="disc"
        songs={album?.songs}
        description={album?.description}
        subtitle={
          album ? (
            <>
              <Link to={`/artists/${album.artist.id}`}>{album.artist.name}</Link>
              {album.releaseDate ? <span className="text-muted"> · {formatDate(album.releaseDate)}</span> : null}
            </>
          ) : null
        }
      />
      {loading ? <RowSkeletons /> : <SongList songs={album.songs} showAlbum={false} label={`Tracks on ${album.title}`} />}
    </div>
  );
}
