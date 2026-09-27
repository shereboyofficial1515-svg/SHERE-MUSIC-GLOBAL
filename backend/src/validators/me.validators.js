import { z } from 'zod';
import { email, password, personName, uuid } from './common.js';

const optionalText = (max) =>
  z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? null : v), z.string().trim().max(max).nullable().optional());

const url = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
  z
    .string()
    .trim()
    .url('Enter a full URL starting with https://')
    .max(200)
    .refine((u) => /^https?:\/\//i.test(u), 'Links must start with http:// or https://')
    .nullable()
    .optional()
);

export const profileSchema = z.object({
  name: personName.optional(),
  username: z.preprocess(
    (v) => (typeof v === 'string' ? (v.trim() === '' ? null : v.trim().toLowerCase()) : v),
    z
      .string()
      .regex(/^[a-z0-9_.]{3,30}$/, 'Usernames use 3–30 lowercase letters, numbers, dots or underscores.')
      .nullable()
      .optional()
  ),
  bio: optionalText(500),
  location: optionalText(80),
  website: url,
  socialLinks: z
    .record(z.enum(['instagram', 'x', 'facebook', 'youtube', 'tiktok', 'spotify', 'soundcloud']), z.string().trim().max(200))
    .optional(),
  favoriteGenreIds: z.array(uuid).max(20).optional(),
});

export const settingsSchema = z
  .object({
    theme: z.enum(['light', 'dark', 'system']),
    language: z.string().trim().max(10),
    subtitleLanguage: z.string().trim().max(10).nullable(),
    captionsEnabled: z.boolean(),
    reducedMotion: z.enum(['system', 'on', 'off']),
    largeText: z.boolean(),
    highContrast: z.boolean(),
    largerControls: z.boolean(),
    lyricsAutoOpen: z.boolean(),
    autoplay: z.boolean(),
    rememberPosition: z.boolean(),
    wifiOnlyDownloads: z.boolean(),
    downloadNotifications: z.boolean(),
    notifications: z
      .object({
        newMusic: z.boolean(),
        newVideos: z.boolean(),
        artistUpdates: z.boolean(),
        followers: z.boolean(),
        account: z.boolean(),
        email: z.boolean(),
      })
      .partial()
      .strict(),
    privacy: z
      .object({
        publicProfile: z.boolean(),
        showListeningActivity: z.boolean(),
        showFollowing: z.boolean(),
        showFollowers: z.boolean(),
        personalizedRecommendations: z.boolean(),
        usageAnalytics: z.boolean(),
      })
      .partial()
      .strict(),
  })
  .partial()
  .strict();

export const changeEmailSchema = z.object({ email, password: z.string().max(128).optional() });
export const setPasswordSchema = z
  .object({ newPassword: password, confirmPassword: z.string() })
  .refine((d) => d.newPassword === d.confirmPassword, { message: 'Passwords do not match.', path: ['confirmPassword'] });
export const oauthTokenSchema = z.object({ accessToken: z.string().min(20).max(8192) });
export const providerParam = z.object({ provider: z.enum(['google', 'facebook']) });
export const usernameParam = z.object({ username: z.string().trim().min(1).max(60) });
export const notificationParam = z.object({ id: uuid });
