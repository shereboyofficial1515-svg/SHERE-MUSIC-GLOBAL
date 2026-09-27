import { mediaUrl } from './storage.service.js';

/** Database rows → API shapes (camelCase, public URLs, no storage paths for non-privileged callers). */

export const SONG_FIELDS =
  'id,title,description,artist_id,artist_name,artist_verified,album_id,album_title,genre_id,genre_name,genre_slug,artwork_path,duration,release_date,track_number,is_featured,is_published,published_at,play_count,download_count,created_at,has_lyrics';
/** Admin and Studio views also see workflow and file details. */
export const SONG_MANAGE_FIELDS = `${SONG_FIELDS},status,submitted_at,reviewed_at,rejection_reason,artist_owner_id,own_artwork_path,audio_path,audio_mime,audio_size,updated_at,created_by`;
// Backwards-compatible alias used by v1 admin controllers
export const SONG_ADMIN_FIELDS = SONG_MANAGE_FIELDS;

const num = (v) => (v === undefined || v === null ? undefined : Number(v));

export function toSong(row, { admin = false, manage = admin } = {}) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    artist: { id: row.artist_id, name: row.artist_name, verified: Boolean(row.artist_verified) },
    album: row.album_id ? { id: row.album_id, title: row.album_title } : null,
    genre: row.genre_id ? { id: row.genre_id, name: row.genre_name, slug: row.genre_slug } : null,
    artworkUrl: mediaUrl(row.artwork_path),
    duration: row.duration,
    releaseDate: row.release_date,
    trackNumber: row.track_number,
    isFeatured: row.is_featured,
    hasLyrics: Boolean(row.has_lyrics),
    playCount: Number(row.play_count || 0),
    downloadCount: Number(row.download_count || 0),
    createdAt: row.created_at,
    ...(manage
      ? {
          status: row.status,
          isPublished: row.is_published,
          publishedAt: row.published_at,
          submittedAt: row.submitted_at,
          reviewedAt: row.reviewed_at,
          rejectionReason: row.rejection_reason,
          updatedAt: row.updated_at,
          hasOwnArtwork: Boolean(row.own_artwork_path),
          audio: { path: row.audio_path, mime: row.audio_mime, size: Number(row.audio_size || 0) },
        }
      : {}),
  };
}

export function toArtist(row, { manage = false } = {}) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    bio: row.bio ?? null,
    imageUrl: mediaUrl(row.image_path),
    coverUrl: mediaUrl(row.cover_path),
    location: row.location ?? null,
    socialLinks: row.social_links || {},
    verified: row.verification_status === 'verified' || Boolean(row.is_verified),
    followerCount: num(row.follower_count) ?? 0,
    songCount: num(row.song_count),
    totalSongCount: num(row.total_song_count),
    albumCount: num(row.album_count),
    videoCount: num(row.video_count),
    totalPlays: num(row.total_plays),
    createdAt: row.created_at,
    ...(manage
      ? {
          ownerUserId: row.owner_user_id ?? null,
          verificationStatus: row.verification_status || 'none',
          verificationMessage: row.verification_message ?? null,
          verificationNote: row.verification_note ?? null,
          verificationRequestedAt: row.verification_requested_at ?? null,
          verifiedAt: row.verified_at ?? null,
        }
      : {}),
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
    songCount: num(row.song_count),
    totalSongCount: num(row.total_song_count),
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
    songCount: num(row.song_count),
    totalSongCount: num(row.total_song_count),
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

export function toUser(row, { providers, hasPassword } = {}) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    avatarUrl: mediaUrl(row.avatar_path),
    emailVerified: row.email_verified,
    status: row.status,
    username: row.username ?? null,
    bio: row.bio ?? null,
    location: row.location ?? null,
    website: row.website ?? null,
    socialLinks: row.social_links || {},
    favoriteGenreIds: row.favorite_genre_ids || [],
    pendingEmail: row.pending_email ?? null,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
    ...(providers !== undefined ? { connectedProviders: providers } : {}),
    ...(hasPassword !== undefined ? { hasPassword } : {}),
  };
}

/** Public-facing profile: only fields the user chose to share. */
export function toPublicUser(row) {
  return {
    id: row.id,
    name: row.name,
    username: row.username ?? null,
    avatarUrl: mediaUrl(row.avatar_path),
    bio: row.bio ?? null,
    location: row.location ?? null,
    website: row.website ?? null,
    socialLinks: row.social_links || {},
    isArtist: row.role === 'artist',
    createdAt: row.created_at,
  };
}

export const VIDEO_FIELDS =
  'id,title,description,artist_id,artist_name,artist_verified,artist_image_path,song_id,song_title,genre_id,genre_name,genre_slug,thumbnail_path,duration,release_date,is_featured,is_published,published_at,view_count,created_at,subtitle_count,renditions,processing_status';
export const VIDEO_MANAGE_FIELDS = `${VIDEO_FIELDS},status,submitted_at,reviewed_at,rejection_reason,artist_owner_id,video_path,video_mime,video_size,updated_at,created_by`;

export function toVideo(row, { manage = false } = {}) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    artist: { id: row.artist_id, name: row.artist_name, verified: Boolean(row.artist_verified), imageUrl: mediaUrl(row.artist_image_path) },
    song: row.song_id ? { id: row.song_id, title: row.song_title } : null,
    genre: row.genre_id ? { id: row.genre_id, name: row.genre_name, slug: row.genre_slug } : null,
    thumbnailUrl: mediaUrl(row.thumbnail_path),
    duration: row.duration,
    releaseDate: row.release_date,
    isFeatured: row.is_featured,
    viewCount: Number(row.view_count || 0),
    subtitleCount: Number(row.subtitle_count || 0),
    // Additional renditions appear here once a processing pipeline produces them.
    qualities: (row.renditions || []).map((r) => ({ label: r.label, height: r.height })).filter((r) => r.label),
    publishedAt: row.published_at,
    createdAt: row.created_at,
    ...(manage
      ? {
          status: row.status,
          isPublished: row.is_published,
          processingStatus: row.processing_status,
          hasVideo: Boolean(row.video_path),
          video: row.video_path ? { mime: row.video_mime, size: Number(row.video_size || 0) } : null,
          submittedAt: row.submitted_at,
          reviewedAt: row.reviewed_at,
          rejectionReason: row.rejection_reason,
          updatedAt: row.updated_at,
        }
      : {}),
  };
}

export function toSubtitle(row) {
  return { id: row.id, language: row.language, label: row.label, format: row.format, isDefault: row.is_default, createdAt: row.created_at };
}

// ─── Payments ──────────────────────────────────────────────────────────────
const PRODUCT_LABELS = { plus_subscription: 'SHERE MUSIC Plus', artist_submission: 'Music submission' };

/** Payment record for history pages. No card or provider secrets. */
export function toTransaction(row, { admin = false } = {}) {
  return {
    id: row.id,
    reference: row.reference,
    productType: row.product_type,
    product: row.metadata?.description || PRODUCT_LABELS[row.product_type] || row.product_type,
    amount: Number(row.amount),
    currency: row.currency,
    status: row.status,
    isRenewal: Boolean(row.is_renewal),
    paidAt: row.paid_at,
    createdAt: row.created_at,
    ...(admin
      ? {
          user: row.users ? { id: row.user_id, name: row.users.name, email: row.users.email } : row.user_id ? { id: row.user_id } : null,
          channel: row.channel,
          gatewayResponse: row.gateway_response,
          customerCode: row.provider_customer_code,
          productId: row.product_id,
        }
      : {}),
  };
}

export function toSubmission(row) {
  const tx = row.payment_transactions || null;
  return {
    id: row.id,
    songId: row.song_id,
    songTitle: row.song_title,
    artistId: row.artist_id,
    artistName: row.artist_name,
    fee: Number(row.submission_fee),
    currency: row.currency,
    paymentStatus: row.payment_status,
    reviewStatus: row.review_status,
    rejectionReason: row.rejection_reason,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    transaction: tx ? { id: tx.id, reference: tx.reference, status: tx.status, paidAt: tx.paid_at, amount: Number(tx.amount) } : null,
    ...(row.users ? { user: { id: row.user_id, name: row.users.name, email: row.users.email } } : {}),
  };
}

export function toOffer(row, { locked = false } = {}) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    imageUrl: mediaUrl(row.image_path),
    plusOnly: row.plus_only,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    locked,
    ...(locked ? {} : { linkUrl: row.link_url, linkLabel: row.link_label }),
  };
}

export function toAdminOffer(row) {
  return { ...toOffer(row), isActive: row.is_active, sortOrder: row.sort_order, createdAt: row.created_at, updatedAt: row.updated_at };
}
