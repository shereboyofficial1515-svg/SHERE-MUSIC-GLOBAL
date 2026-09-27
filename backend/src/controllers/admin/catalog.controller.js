import { supabase } from '../../config/supabase.js';
import { badRequest, conflict } from '../../utils/AppError.js';
import { dbError, one, unwrap } from '../../utils/db.js';
import { created, noContent, ok, pageMeta, pageRange } from '../../utils/http.js';
import { cleanSearchTerm, ilikeAny, slugify } from '../../utils/search.js';
import { toAlbum, toArtist, toGenre, toPlaylist } from '../../services/mappers.js';
import { notifyUsers } from '../../services/notification.service.js';
import { FOLDERS, removeMedia, withUploadCleanup } from '../../services/storage.service.js';
import { getSettings, uploadLimits } from '../../services/settings.service.js';
import { PLAYLIST_FIELDS } from '../catalog.controller.js';

const imageLimit = async () => uploadLimits(await getSettings()).imageMb;

// ─── Artists ───────────────────────────────────────────────────────────────
const loadArtist = (id) => one(supabase.from('artists_view').select('*').eq('id', id), 'Artist not found.');

export async function listArtists(req, res) {
  const { q, sort, page, limit, verification } = req.valid.query;
  let query = supabase.from('artists_view').select('*', { count: 'exact' });
  const term = cleanSearchTerm(q);
  if (term) query = query.ilike('name', `%${term}%`);
  if (verification) query = query.eq('verification_status', verification);
  query = sort === 'popular' ? query.order('total_plays', { ascending: false }) : sort === 'latest' ? query.order('created_at', { ascending: false }) : query.order('name');
  const { from, to } = pageRange({ page, limit });
  const { data, count, error } = await query.order('id').range(from, to);
  if (error) throw dbError(error);
  const ownerIds = [...new Set(data.map((a) => a.owner_user_id).filter(Boolean))];
  const owners = ownerIds.length ? unwrap(await supabase.from('users').select('id,name,email').in('id', ownerIds)) : [];
  const ownerMap = new Map(owners.map((o) => [o.id, o]));
  ok(
    res,
    data.map((a) => ({ ...toArtist(a, { manage: true }), owner: a.owner_user_id ? ownerMap.get(a.owner_user_id) || null : null })),
    pageMeta({ page, limit }, count)
  );
}

/** Resolve an owner email from the admin form to a user id (null clears ownership). */
async function ownerIdFor(ownerEmail) {
  if (ownerEmail === undefined) return undefined;
  if (ownerEmail === null) return null;
  const user = unwrap(await supabase.from('users').select('id,role').eq('email', ownerEmail).maybeSingle());
  if (!user) throw badRequest(`No account uses ${ownerEmail}.`, [{ field: 'ownerEmail', message: 'No account with this email.' }]);
  // Owning an artist profile makes a listener an artist.
  if (user.role === 'user') unwrap(await supabase.from('users').update({ role: 'artist' }).eq('id', user.id));
  return user.id;
}

/** Lightweight id/name lists for form dropdowns. */
export async function artistOptions(req, res) {
  ok(res, unwrap(await supabase.from('artists').select('id,name').order('name').limit(5000)));
}

export async function createArtist(req, res) {
  const { name, bio, location, socialLinks, ownerEmail } = req.valid.body;
  const limit = await imageLimit();
  const owner_user_id = await ownerIdFor(ownerEmail);
  const id = await withUploadCleanup(async (upload) => {
    const image = req.files?.image?.[0];
    const cover = req.files?.cover?.[0];
    const image_path = image ? await upload.image(image, FOLDERS.artists, limit) : null;
    const cover_path = cover ? await upload.image(cover, FOLDERS.covers, limit) : null;
    const { data, error } = await supabase
      .from('artists')
      .insert({ name, bio: bio ?? null, location: location ?? null, social_links: socialLinks || {}, image_path, cover_path, owner_user_id: owner_user_id ?? null })
      .select('id')
      .single();
    if (error?.code === '23505') throw conflict(`An artist named "${name}" already exists.`);
    if (error) throw dbError(error);
    return data.id;
  });
  created(res, toArtist(await loadArtist(id), { manage: true }));
}

export async function updateArtist(req, res) {
  const existing = await loadArtist(req.valid.params.id);
  const { name, bio, location, socialLinks, removeImage, removeCover, ownerEmail } = req.valid.body;
  const limit = await imageLimit();
  const patch = { name, ...(bio !== undefined ? { bio } : {}), ...(location !== undefined ? { location } : {}) };
  if (socialLinks !== undefined) patch.social_links = Object.fromEntries(Object.entries(socialLinks).filter(([, v]) => v));
  const owner = await ownerIdFor(ownerEmail);
  if (owner !== undefined) patch.owner_user_id = owner;
  await withUploadCleanup(async (upload) => {
    const image = req.files?.image?.[0];
    const cover = req.files?.cover?.[0];
    if (image) patch.image_path = await upload.image(image, FOLDERS.artists, limit);
    else if (removeImage) patch.image_path = null;
    if (cover) patch.cover_path = await upload.image(cover, FOLDERS.covers, limit);
    else if (removeCover) patch.cover_path = null;
    const { error } = await supabase.from('artists').update(patch).eq('id', existing.id);
    if (error?.code === '23505') throw conflict(`An artist named "${name}" already exists.`);
    if (error) throw dbError(error);
  });
  if (patch.image_path !== undefined) await removeMedia(existing.image_path);
  if (patch.cover_path !== undefined) await removeMedia(existing.cover_path);
  ok(res, toArtist(await loadArtist(existing.id), { manage: true }));
}

export async function deleteArtist(req, res) {
  const existing = await loadArtist(req.valid.params.id);
  const videos = Number(existing.video_count || 0);
  const { count: allVideos } = await supabase.from('music_videos').select('id', { count: 'exact', head: true }).eq('artist_id', existing.id);
  if (Number(existing.total_song_count) > 0 || Number(existing.album_count) > 0 || (allVideos ?? videos) > 0) {
    throw conflict(
      `Remove or reassign this artist's ${existing.total_song_count} song(s), ${existing.album_count} album(s) and ${allVideos ?? videos} video(s) before deleting.`,
      'IN_USE'
    );
  }
  unwrap(await supabase.from('artists').delete().eq('id', existing.id));
  await removeMedia(existing.image_path, existing.cover_path);
  noContent(res);
}

/** Verify, reject a request, or remove verification. The owner is notified. */
export async function decideVerification(req, res) {
  const existing = await loadArtist(req.valid.params.id);
  const { decision, note } = req.valid.body;
  const patch =
    decision === 'verify'
      ? { verification_status: 'verified', verified_at: new Date().toISOString(), verification_note: note || null }
      : decision === 'reject'
        ? { verification_status: 'rejected', verification_note: note || 'Your request was not approved.' }
        : { verification_status: 'none', verified_at: null, verification_note: note || null };
  unwrap(await supabase.from('artists').update(patch).eq('id', existing.id));
  if (existing.owner_user_id) {
    notifyUsers([existing.owner_user_id], {
      type: `verification_${decision}`,
      prefKey: 'account',
      title:
        decision === 'verify'
          ? `${existing.name} is now verified`
          : decision === 'reject'
            ? `Verification for ${existing.name} was not approved`
            : `Verification was removed from ${existing.name}`,
      body: patch.verification_note,
      link: '/studio/profile',
    });
  }
  ok(res, toArtist(await loadArtist(existing.id), { manage: true }), {
    message: { verify: 'Artist verified.', reject: 'Verification request rejected.', revoke: 'Verification removed.' }[decision],
  });
}

// ─── Albums ────────────────────────────────────────────────────────────────
const loadAlbum = (id) => one(supabase.from('albums_view').select('*').eq('id', id), 'Album not found.');

export async function listAlbums(req, res) {
  const { q, artist, sort, page, limit } = req.valid.query;
  let query = supabase.from('albums_view').select('*', { count: 'exact' });
  const term = cleanSearchTerm(q);
  if (term) query = query.or(ilikeAny(['title', 'artist_name'], term));
  if (artist) query = query.eq('artist_id', artist);
  query = sort === 'name' ? query.order('title') : query.order('created_at', { ascending: false });
  const { from, to } = pageRange({ page, limit });
  const { data, count, error } = await query.order('id').range(from, to);
  if (error) throw dbError(error);
  ok(res, data.map(toAlbum), pageMeta({ page, limit }, count));
}

export async function albumOptions(req, res) {
  ok(res, unwrap(await supabase.from('albums').select('id,title,artist_id').order('title').limit(5000)));
}

export async function createAlbum(req, res) {
  const { title, artistId, releaseDate, description } = req.valid.body;
  await one(supabase.from('artists').select('id').eq('id', artistId), 'Artist not found.');
  const limit = await imageLimit();
  const id = await withUploadCleanup(async (upload) => {
    const artwork_path = req.file ? await upload.image(req.file, FOLDERS.albums, limit) : null;
    const { data, error } = await supabase
      .from('albums')
      .insert({ title, artist_id: artistId, release_date: releaseDate ?? null, description: description ?? null, artwork_path })
      .select('id')
      .single();
    if (error?.code === '23505') throw conflict(`This artist already has an album called "${title}".`);
    if (error) throw dbError(error);
    return data.id;
  });
  created(res, toAlbum(await loadAlbum(id)));
}

export async function updateAlbum(req, res) {
  const existing = await loadAlbum(req.valid.params.id);
  const { title, artistId, releaseDate, description, removeArtwork } = req.valid.body;
  if (artistId !== existing.artist_id) {
    if (Number(existing.total_song_count) > 0) throw badRequest('Remove this album\'s songs before moving it to another artist.');
    await one(supabase.from('artists').select('id').eq('id', artistId), 'Artist not found.');
  }
  const limit = await imageLimit();
  const patch = { title, artist_id: artistId };
  if (releaseDate !== undefined) patch.release_date = releaseDate;
  if (description !== undefined) patch.description = description;
  await withUploadCleanup(async (upload) => {
    if (req.file) patch.artwork_path = await upload.image(req.file, FOLDERS.albums, limit);
    else if (removeArtwork) patch.artwork_path = null;
    const { error } = await supabase.from('albums').update(patch).eq('id', existing.id);
    if (error?.code === '23505') throw conflict(`This artist already has an album called "${title}".`);
    if (error) throw dbError(error);
  });
  if (patch.artwork_path !== undefined) await removeMedia(existing.artwork_path);
  ok(res, toAlbum(await loadAlbum(existing.id)));
}

/** Songs on the album are kept and simply detached (album_id → null). */
export async function deleteAlbum(req, res) {
  const existing = await loadAlbum(req.valid.params.id);
  unwrap(await supabase.from('albums').delete().eq('id', existing.id));
  await removeMedia(existing.artwork_path);
  noContent(res);
}

export async function addAlbumSongs(req, res) {
  const album = await loadAlbum(req.valid.params.id);
  const { songIds } = req.valid.body;
  const songs = unwrap(await supabase.from('songs').select('id,artist_id').in('id', songIds));
  const mismatched = songs.filter((s) => s.artist_id !== album.artist_id);
  if (songs.length !== songIds.length) throw badRequest('One or more songs were not found.');
  if (mismatched.length) throw badRequest(`${mismatched.length} song(s) belong to a different artist than this album.`);
  unwrap(await supabase.from('songs').update({ album_id: album.id }).in('id', songIds));
  ok(res, toAlbum(await loadAlbum(album.id)), { message: `${songIds.length} song(s) added to ${album.title}.` });
}

export async function removeAlbumSong(req, res) {
  unwrap(await supabase.from('songs').update({ album_id: null }).eq('id', req.valid.params.songId).eq('album_id', req.valid.params.id));
  noContent(res);
}

// ─── Genres ────────────────────────────────────────────────────────────────
export async function listGenres(req, res) {
  ok(res, unwrap(await supabase.from('genres_view').select('*').order('name')).map(toGenre));
}

async function uniqueSlug(name, excludeId) {
  const base = slugify(name) || 'genre';
  let slug = base;
  for (let i = 2; i < 50; i += 1) {
    let q = supabase.from('genres').select('id').eq('slug', slug);
    if (excludeId) q = q.neq('id', excludeId);
    if (!unwrap(await q.maybeSingle())) return slug;
    slug = `${base}-${i}`;
  }
  throw conflict('Could not generate a unique URL for this genre.');
}

export async function createGenre(req, res) {
  const { name, description } = req.valid.body;
  const slug = await uniqueSlug(name);
  const { data, error } = await supabase.from('genres').insert({ name, slug, description: description ?? null }).select('*').single();
  if (error?.code === '23505') throw conflict(`A genre named "${name}" already exists.`);
  if (error) throw dbError(error);
  created(res, toGenre({ ...data, song_count: 0, total_song_count: 0 }));
}

export async function updateGenre(req, res) {
  const { id } = req.valid.params;
  const { name, description } = req.valid.body;
  await one(supabase.from('genres').select('id').eq('id', id), 'Genre not found.');
  const slug = await uniqueSlug(name, id);
  const { error } = await supabase.from('genres').update({ name, slug, ...(description !== undefined ? { description } : {}) }).eq('id', id);
  if (error?.code === '23505') throw conflict(`A genre named "${name}" already exists.`);
  if (error) throw dbError(error);
  ok(res, toGenre(await one(supabase.from('genres_view').select('*').eq('id', id))));
}

/** Songs in a deleted genre become uncategorised (genre_id → null). */
export async function deleteGenre(req, res) {
  const { id } = req.valid.params;
  await one(supabase.from('genres').select('id').eq('id', id), 'Genre not found.');
  unwrap(await supabase.from('genres').delete().eq('id', id));
  noContent(res);
}

// ─── Playlists (moderation / featuring) ───────────────────────────────────
export async function listPlaylists(req, res) {
  const { q, featured, page, limit } = req.valid.query;
  let query = supabase.from('playlists_view').select(PLAYLIST_FIELDS, { count: 'exact' });
  const term = cleanSearchTerm(q);
  if (term) query = query.or(ilikeAny(['name', 'owner_name'], term));
  if (featured !== undefined) query = query.eq('is_featured', featured);
  const { from, to } = pageRange({ page, limit });
  const { data, count, error } = await query.order('updated_at', { ascending: false }).order('id').range(from, to);
  if (error) throw dbError(error);
  ok(res, data.map(toPlaylist), pageMeta({ page, limit }, count));
}

export async function updatePlaylist(req, res) {
  const { id } = req.valid.params;
  const { isFeatured, isPublic } = req.valid.body;
  const current = await one(supabase.from('playlists').select('is_public').eq('id', id), 'Playlist not found.');
  const patch = {};
  if (isPublic !== undefined) patch.is_public = isPublic;
  if (isFeatured !== undefined) patch.is_featured = isFeatured;
  // A featured playlist must be public, otherwise visitors could not open it.
  if (patch.is_featured && !(patch.is_public ?? current.is_public)) patch.is_public = true;
  if (patch.is_public === false) patch.is_featured = false;
  unwrap(await supabase.from('playlists').update(patch).eq('id', id));
  ok(res, toPlaylist(await one(supabase.from('playlists_view').select(PLAYLIST_FIELDS).eq('id', id))));
}

export async function deletePlaylist(req, res) {
  const playlist = await one(supabase.from('playlists').select('id,artwork_path').eq('id', req.valid.params.id), 'Playlist not found.');
  unwrap(await supabase.from('playlists').delete().eq('id', playlist.id));
  await removeMedia(playlist.artwork_path);
  noContent(res);
}
