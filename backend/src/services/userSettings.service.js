import { supabase } from '../config/supabase.js';
import { unwrap } from '../utils/db.js';

export const DEFAULT_NOTIFICATIONS = { newMusic: true, newVideos: true, artistUpdates: true, followers: true, account: true, email: true };
export const DEFAULT_PRIVACY = {
  publicProfile: true,
  showListeningActivity: false,
  showFollowing: true,
  showFollowers: true,
  personalizedRecommendations: true,
  usageAnalytics: true,
};

const DEFAULTS = {
  theme: 'system',
  language: 'en',
  subtitle_language: null,
  captions_enabled: false,
  reduced_motion: 'system',
  large_text: false,
  high_contrast: false,
  larger_controls: false,
  lyrics_auto_open: false,
  autoplay: true,
  remember_position: true,
  wifi_only_downloads: false,
  download_notifications: true,
  notification_preferences: DEFAULT_NOTIFICATIONS,
  privacy_preferences: DEFAULT_PRIVACY,
};

// camelCase API field → column
export const SETTING_COLUMNS = {
  theme: 'theme',
  language: 'language',
  subtitleLanguage: 'subtitle_language',
  captionsEnabled: 'captions_enabled',
  reducedMotion: 'reduced_motion',
  largeText: 'large_text',
  highContrast: 'high_contrast',
  largerControls: 'larger_controls',
  lyricsAutoOpen: 'lyrics_auto_open',
  autoplay: 'autoplay',
  rememberPosition: 'remember_position',
  wifiOnlyDownloads: 'wifi_only_downloads',
  downloadNotifications: 'download_notifications',
};

function normalise(row) {
  const r = { ...DEFAULTS, ...(row || {}) };
  return {
    ...r,
    notification_preferences: { ...DEFAULT_NOTIFICATIONS, ...(r.notification_preferences || {}) },
    privacy_preferences: { ...DEFAULT_PRIVACY, ...(r.privacy_preferences || {}) },
  };
}

export function toSettings(row) {
  const r = normalise(row);
  const out = {};
  for (const [key, column] of Object.entries(SETTING_COLUMNS)) out[key] = r[column];
  out.notifications = r.notification_preferences;
  out.privacy = r.privacy_preferences;
  return out;
}

export async function getUserSettingsRow(userId) {
  const row = unwrap(await supabase.from('user_settings').select('*').eq('user_id', userId).maybeSingle());
  return normalise(row);
}

/** Settings for many users at once (used for notification fan-out). Missing rows get defaults. */
export async function getSettingsForUsers(userIds) {
  const map = new Map();
  for (let i = 0; i < userIds.length; i += 500) {
    const chunk = userIds.slice(i, i + 500);
    const rows = unwrap(await supabase.from('user_settings').select('user_id,notification_preferences,privacy_preferences').in('user_id', chunk));
    for (const r of rows) map.set(r.user_id, normalise(r));
  }
  for (const id of userIds) if (!map.has(id)) map.set(id, normalise(null));
  return map;
}

export async function updateUserSettings(userId, patch) {
  const current = await getUserSettingsRow(userId);
  const row = { user_id: userId };
  for (const [key, column] of Object.entries(SETTING_COLUMNS)) if (patch[key] !== undefined) row[column] = patch[key];
  if (patch.notifications) row.notification_preferences = { ...current.notification_preferences, ...patch.notifications };
  if (patch.privacy) row.privacy_preferences = { ...current.privacy_preferences, ...patch.privacy };
  const saved = unwrap(await supabase.from('user_settings').upsert(row, { onConflict: 'user_id' }).select('*').single());
  return toSettings(saved);
}
