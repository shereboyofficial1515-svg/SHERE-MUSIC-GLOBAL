import { mediaUrl } from './storage.service.js';

/** Database rows → API shapes (camelCase, public URLs, no storage paths for non-admins). */

export const SONG_FIELDS =
  'id,title,description,artist_id,artist_name,album_id,album_title,genre_id,genre_name,genre_slug,artwork_path,duration,release_date,track_number,is_featured,is_published,published_at,play_count,download_count,created_at';
export const SONG_ADMIN_FIELDS = `${SONG_FIELDS},own_artwork_path,audio_path,audio_mime,audio_size,updated_at`;

export function toSong(row, { admin = false } = {}) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    artist: { id: row.artist_id, name: row.artist_name },
    album: row.album_id ? { id: row.album_id, title: row.album_title } : null,
    genre: row.genre_id ? { id: row.genre_id, name: row.genre_name, slug: row.genre_slug } : null,
    artworkUrl: mediaUrl(row.artwork_path),
    duration: row.duration,
    releaseDate: row.release_date,
    trackNumber: row.track_number,
    isFeatured: row.is_featured,
    playCount: Number(row.play_count || 0),
    downloadCount: Number(row.download_count || 0),
    createdAt: row.created_at,
    ...(admin
      ? {
          isPublished: row.is_published,
          publishedAt: row.published_at,
          updatedAt: row.updated_at,
          hasOwnArtwork: Boolean(row.own_artwork_path),
          audio: { path: row.audio_path, mime: row.audio_mime, size: Number(row.audio_size || 0) },
        }
      : {}),
  };
}

export function toArtist(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    bio: row.bio ?? null,
    imageUrl: mediaUrl(row.image_path),
    songCount: row.song_count !== undefined ? Number(row.song_count) : undefined,
    totalSongCount: row.total_song_count !== undefined ? Number(row.total_song_count) : undefined,
    albumCount: row.album_count !== undefined ? Number(row.album_count) : undefined,
    totalPlays: row.total_plays !== undefined ? Number(row.total_plays) : undefined,
    createdAt: row.created_at,
  };
}

export function toAlbum(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    artist: { id: row.artist_id, name: row.artist_name },
    artworkUrl: mediaUrl(row.artwork_path),
    releaseDate: row.release_date,
    description: row.description,
    songCount: row.song_count !== undefined ? Number(row.song_count) : undefined,
    totalSongCount: row.total_song_count !== undefined ? Number(row.total_song_count) : undefined,
    createdAt: row.created_at,
  };
}

export function toGenre(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    songCount: row.song_count !== undefined ? Number(row.song_count) : undefined,
    totalSongCount: row.total_song_count !== undefined ? Number(row.total_song_count) : undefined,
  };
}

export function toPlaylist(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    owner: { id: row.user_id, name: row.owner_name },
    artworkUrl: mediaUrl(row.artwork_path),
    hasOwnArtwork: Boolean(row.own_artwork_path),
    isPublic: row.is_public,
    isFeatured: row.is_featured,
    songCount: Number(row.song_count || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    avatarUrl: mediaUrl(row.avatar_path),
    emailVerified: row.email_verified,
    status: row.status,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
  };
}
