import { supabase } from '../../config/supabase.js';
import { env } from '../../config/env.js';
import { badRequest } from '../../utils/AppError.js';
import { unwrap } from '../../utils/db.js';
import { ok } from '../../utils/http.js';
import { FOLDERS, removeMedia, withUploadCleanup } from '../../services/storage.service.js';
import { getSettings, invalidateSettings, toAdminSettings, uploadLimits } from '../../services/settings.service.js';
import { clearLyricsCache } from '../../services/lyrics/lyrics.service.js';

const COLUMN_MAP = {
  siteName: 'site_name',
  siteDescription: 'site_description',
  contactEmail: 'contact_email',
  socialLinks: 'social_links',
  maxAudioMb: 'max_audio_mb',
  maxImageMb: 'max_image_mb',
  allowRegistration: 'allow_registration',
  maintenanceMode: 'maintenance_mode',
  maintenanceMessage: 'maintenance_message',
  featuredLimit: 'featured_limit',
  maxVideoMb: 'max_video_mb',
  lyricsEnabled: 'lyrics_enabled',
  videosEnabled: 'videos_enabled',
  allowArtistSignup: 'allow_artist_signup',
  artistAutoPublish: 'artist_auto_publish',
  emailNewReleases: 'email_new_releases',
  defaultTheme: 'default_theme',
  subtitleLanguages: 'subtitle_languages',
};

export async function getAdminSettings(req, res) {
  ok(res, toAdminSettings(await getSettings()));
}

export async function updateSettings(req, res) {
  const body = req.valid.body;
  if (body.maxAudioMb > env.uploads.maxAudioMb) {
    throw badRequest(`Audio limit cannot exceed the server ceiling of ${env.uploads.maxAudioMb} MB (MAX_AUDIO_MB).`);
  }
  if (body.maxImageMb > env.uploads.maxImageMb) {
    throw badRequest(`Image limit cannot exceed the server ceiling of ${env.uploads.maxImageMb} MB (MAX_IMAGE_MB).`);
  }
  if (body.maxVideoMb > env.uploads.maxVideoMb) {
    throw badRequest(`Video limit cannot exceed the server ceiling of ${env.uploads.maxVideoMb} MB (MAX_VIDEO_MB).`);
  }
  const patch = {};
  for (const [key, column] of Object.entries(COLUMN_MAP)) if (body[key] !== undefined) patch[column] = body[key];
  if (patch.social_links) {
    patch.social_links = Object.fromEntries(Object.entries(patch.social_links).filter(([, v]) => v));
  }
  const lp = body.lyricsProvider;
  if (lp) {
    if (lp.mode !== undefined) patch.lyrics_mode = lp.mode;
    if (lp.name !== undefined) patch.lyrics_provider_name = lp.name;
    if (lp.apiUrl !== undefined) patch.lyrics_api_url = lp.apiUrl;
    if (lp.apiKey !== undefined) patch.lyrics_api_key = lp.apiKey;
    if (lp.attribution !== undefined) patch.lyrics_attribution = lp.attribution;
    const current = await getSettings();
    const mode = patch.lyrics_mode ?? current.lyrics_mode;
    const urlSet = env.lyrics.apiUrl || (patch.lyrics_api_url !== undefined ? patch.lyrics_api_url : current.lyrics_api_url);
    if (mode !== 'manual' && !urlSet) throw badRequest('Add the provider API URL before enabling external lyrics.');
  }
  if (!Object.keys(patch).length) throw badRequest('Nothing to update.');
  unwrap(await supabase.from('site_settings').update(patch).eq('id', 1));
  invalidateSettings();
  if (lp) clearLyricsCache();
  ok(res, toAdminSettings(await getSettings()), { message: 'Settings saved.' });
}

/** Upload handler factory for the logo and favicon. */
const brandingUpload = (column, { allowIco = false } = {}) =>
  async function uploadBranding(req, res) {
    const settings = await getSettings();
    if (!req.file) {
      if (req.body?.remove === 'true') {
        unwrap(await supabase.from('site_settings').update({ [column]: null }).eq('id', 1));
        await removeMedia(settings[column]);
        invalidateSettings();
        return ok(res, toAdminSettings(await getSettings()));
      }
      throw badRequest('Choose an image to upload.');
    }
    const { imageMb } = uploadLimits(settings);
    await withUploadCleanup(async (upload) => {
      const path = await upload.image(req.file, FOLDERS.branding, imageMb, { allowIco });
      unwrap(await supabase.from('site_settings').update({ [column]: path }).eq('id', 1));
    });
    await removeMedia(settings[column]);
    invalidateSettings();
    ok(res, toAdminSettings(await getSettings()), { message: 'Image updated.' });
  };

export const uploadLogo = brandingUpload('logo_path');
export const uploadFavicon = brandingUpload('favicon_path', { allowIco: true });
