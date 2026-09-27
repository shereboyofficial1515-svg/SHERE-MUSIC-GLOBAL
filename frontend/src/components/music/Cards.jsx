import { memo } from 'react';
import { Link } from 'react-router-dom';
import Artwork from '../ui/Artwork.jsx';
import { formatCount } from '../../utils/format.js';
import { VerifiedBadge } from '../artists/FollowButton.jsx';

export const ArtistCard = memo(function ArtistCard({ artist }) {
  return (
    <Link to={`/artists/${artist.id}`} className="entity-card entity-card--round">
      <Artwork src={artist.imageUrl} alt={artist.name} rounded icon="mic" />
      <span className="entity-card__title">
        {artist.name} {artist.verified ? <VerifiedBadge size={14} /> : null}
      </span>
      <span className="entity-card__sub">
        {artist.followerCount ? `${formatCount(artist.followerCount)} followers` : artist.songCount !== undefined ? `${artist.songCount} ${artist.songCount === 1 ? 'song' : 'songs'}` : 'Artist'}
      </span>
    </Link>
  );
});

export const AlbumCard = memo(function AlbumCard({ album }) {
  return (
    <Link to={`/albums/${album.id}`} className="entity-card">
      <Artwork src={album.artworkUrl} alt={`${album.title} cover`} icon="disc" />
      <span className="entity-card__title">{album.title}</span>
      <span className="entity-card__sub">
        {album.artist.name}
        {album.releaseDate ? ` · ${album.releaseDate.slice(0, 4)}` : ''}
      </span>
    </Link>
  );
});

export const PlaylistCard = memo(function PlaylistCard({ playlist }) {
  return (
    <Link to={`/playlists/${playlist.id}`} className="entity-card">
      <Artwork src={playlist.artworkUrl} alt={`${playlist.name} cover`} icon="list-music" />
      <span className="entity-card__title">{playlist.name}</span>
      <span className="entity-card__sub">
        {playlist.songCount} {playlist.songCount === 1 ? 'song' : 'songs'}
        {playlist.isFeatured ? ' · Featured' : ''}
      </span>
    </Link>
  );
});

const GENRE_TONES = ['sky', 'gold', 'teal', 'violet', 'rose', 'slate'];

export const GenreTile = memo(function GenreTile({ genre, index = 0, to }) {
  return (
    <Link to={to || `/genres/${genre.slug}`} className={`genre-tile genre-tile--${GENRE_TONES[index % GENRE_TONES.length]}`}>
      <span className="genre-tile__name">{genre.name}</span>
      {genre.songCount !== undefined ? <span className="genre-tile__count">{formatCount(genre.songCount)} songs</span> : null}
    </Link>
  );
});
