import { Link, useParams } from 'react-router-dom';
import { EmptyState, ErrorState } from '../../components/ui/Feedback.jsx';
import CollectionHeader from '../../components/music/CollectionHeader.jsx';
import { SongList } from '../../components/music/SongRow.jsx';
import { RowSkeletons } from '../../components/music/Section.jsx';
import { AlbumCard } from '../../components/music/Cards.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useMeta } from '../../hooks/useMeta.js';
import { musicService } from '../../services/musicService.js';

export default function ArtistPage() {
  const { id } = useParams();
  const { data: artist, loading, error, reload } = useAsync(() => musicService.artist(id), [id]);
  useMeta({
    title: artist?.name || 'Artist',
    description: artist ? artist.bio?.slice(0, 160) || `Listen to and download songs by ${artist.name} on SHERE MUSIC.` : undefined,
    image: artist?.imageUrl,
    type: 'profile',
  });

  if (error) {
    return (
      <div className="container page">
        {error.status === 404 ? (
          <EmptyState icon="mic" title="Artist not found" action={<Link to="/artists" className="btn btn--secondary">All artists</Link>} />
        ) : (
          <ErrorState error={error} onRetry={reload} />
        )}
      </div>
    );
  }

  return (
    <div className="container page">
      <CollectionHeader loading={loading} kind="Artist" title={artist?.name} imageUrl={artist?.imageUrl} rounded icon="mic" songs={artist?.songs} />
      {loading ? (
        <RowSkeletons />
      ) : (
        <>
          {artist.bio ? (
            <section className="section">
              <h2 className="section__title">About</h2>
              <p className="prose">{artist.bio}</p>
            </section>
          ) : null}
          <section className="section">
            <h2 className="section__title">Songs</h2>
            <SongList songs={artist.songs} showPlays label={`Songs by ${artist.name}`} />
          </section>
          {artist.albums.length ? (
            <section className="section">
              <h2 className="section__title">Albums</h2>
              <div className="card-grid">
                {artist.albums.map((a) => (
                  <AlbumCard key={a.id} album={a} />
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
