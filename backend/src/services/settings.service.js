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
  };
}

export function toAdminSettings(s) {
  return {
    ...toPublicSettings(s),
    maxAudioMb: s.max_audio_mb,
    maxImageMb: s.max_image_mb,
    ceilings: { maxAudioMb: env.uploads.maxAudioMb, maxImageMb: env.uploads.maxImageMb },
    updatedAt: s.updated_at,
  };
}
