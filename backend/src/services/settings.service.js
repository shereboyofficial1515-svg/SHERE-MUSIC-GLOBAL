import { supabase } from '../config/supabase.js';
import { env } from '../config/env.js';
import { unwrap } from '../utils/db.js';
import { mediaUrl } from './storage.service.js';

const DEFAULTS = {
  site_name: 'SHERE MUSIC',
  site_description: 'Discover music. Stream music. Download music.',
  logo_path: null,
  favicon_path: null,
  contact_email: null,
  social_links: {},
  max_audio_mb: env.uploads.maxAudioMb,
  max_image_mb: env.uploads.maxImageMb,
  allow_registration: true,
  maintenance_mode: false,
  maintenance_message: null,
  featured_limit: 10,
  lyrics_enabled: true,
  lyrics_mode: 'manual',
  lyrics_provider_name: null,
  lyrics_api_url: null,
  lyrics_api_key: null,
  lyrics_attribution: null,
  videos_enabled: true,
  max_video_mb: env.uploads.maxVideoMb,
  subtitle_languages: [{ code: 'en', label: 'English' }],
  allow_artist_signup: true,
  artist_auto_publish: false,
  default_theme: 'dark',
  email_new_releases: true,
};

const TTL_MS = 30_000;
let cache = null;
let cachedAt = 0;

/** Site settings with a short in-memory cache (invalidated on admin update). */
export async function getSettings() {
  if (cache && Date.now() - cachedAt < TTL_MS) return cache;
  const row = unwrap(await supabase.from('site_settings').select('*').eq('id', 1).maybeSingle());
  cache = { ...DEFAULTS, ...(row || {}) };
  cachedAt = Date.now();
  return cache;
}

export function invalidateSettings() {
  cache = null;
}

/** Effective upload limits: admin settings may lower, never raise, the env ceilings. */
export function uploadLimits(settings) {
  return {
    audioMb: Math.min(settings.max_audio_mb, env.uploads.maxAudioMb),
    imageMb: Math.min(settings.max_image_mb, env.uploads.maxImageMb),
    videoMb: Math.min(settings.max_video_mb, env.uploads.maxVideoMb),
  };
}

/** Effective external lyrics provider config (env vars take precedence over admin settings). */
export function lyricsProviderConfig(settings) {
  return {
    mode: settings.lyrics_mode,
    name: settings.lyrics_provider_name || 'External provider',
    url: env.lyrics.apiUrl || settings.lyrics_api_url || '',
    apiKey: env.lyrics.apiKey || settings.lyrics_api_key || '',
    attribution: settings.lyrics_attribution || null,
    configuredViaEnv: Boolean(env.lyrics.apiUrl),
  };
}

export function toPublicSettings(s) {
  const limits = uploadLimits(s);
  return {
    siteName: s.site_name,
    siteDescription: s.site_description,
    logoUrl: mediaUrl(s.logo_path),
    faviconUrl: mediaUrl(s.favicon_path),
    contactEmail: s.contact_email,
    socialLinks: s.social_links || {},
    allowRegistration: s.allow_registration,
    maintenanceMode: s.maintenance_mode,
    maintenanceMessage: s.maintenance_message,
    featuredLimit: s.featured_limit,
    maxAudioMb: limits.audioMb,
    maxImageMb: limits.imageMb,
    maxVideoMb: limits.videoMb,
    lyricsEnabled: s.lyrics_enabled,
    videosEnabled: s.videos_enabled,
    subtitleLanguages: s.subtitle_languages || [],
    allowArtistSignup: s.allow_artist_signup,
    artistAutoPublish: s.artist_auto_publish,
    defaultTheme: s.default_theme,
  };
}

export function toAdminSettings(s) {
  return {
    ...toPublicSettings(s),
    maxAudioMb: s.max_audio_mb,
    maxImageMb: s.max_image_mb,
    maxVideoMb: s.max_video_mb,
    ceilings: { maxAudioMb: env.uploads.maxAudioMb, maxImageMb: env.uploads.maxImageMb, maxVideoMb: env.uploads.maxVideoMb },
    emailNewReleases: s.email_new_releases,
    lyricsProvider: {
      mode: s.lyrics_mode,
      name: s.lyrics_provider_name,
      apiUrl: env.lyrics.apiUrl || s.lyrics_api_url,
      // The key itself is never sent to any browser, admins included.
      hasApiKey: Boolean(env.lyrics.apiKey || s.lyrics_api_key),
      attribution: s.lyrics_attribution,
      configuredViaEnv: Boolean(env.lyrics.apiUrl),
    },
    updatedAt: s.updated_at,
  };
}
