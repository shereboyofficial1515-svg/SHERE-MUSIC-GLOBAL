---
title: Platform Settings
description: Site details, appearance, email, lyrics, storage, limits, notifications and maintenance.
icon: settings
order: 8
---
@article general-settings
title: General settings
summary: Name, description, contact and social links.
keywords: general settings, site name, contact email, social links, spotlight, branding, logo, favicon

**Settings → General**: website name, site description, **contact email** (shown in the footer and the Help Center's Contact Support page), the number of songs in the home page Spotlight, and social media links.

**Settings → Branding**: upload a logo (square PNG or WebP) and a favicon (PNG or ICO, 64×64 or larger).

**Settings → Access**: **Allow new registrations** (email and Google/Facebook sign-ups). **Settings → Studio**: **Allow artist sign-ups** and **Publish without review**.

![Settings](admin-settings.png)

Changes apply immediately (the server caches settings for up to 30 seconds).

@article appearance
title: Appearance
summary: The default theme for new visitors.
keywords: appearance, default theme, dark mode, light mode

**Settings → Appearance → Default theme**: Dark, Light, or follow the visitor's device. Visitors who pick their own theme keep their choice.

@article email
title: Email
summary: What SHERE MUSIC emails and how it's configured.
keywords: email, resend, sender, emails sent, release emails, from address

Emails are sent through Resend, configured on the server (`RESEND_API_KEY`, `RESEND_FROM_EMAIL` — see [Environment variables](/admin/docs/operations/environment-variables)). Without a key in development, emails are printed in the server log instead.

Emails sent:

- account: verification, password reset, email-change confirmation, password changed, account disabled/enabled, admin role granted/removed
- releases: new songs and videos from followed artists (listeners can opt out; admins can turn these off in **Settings → Notifications → Release emails**)
- reviews: decisions on paid submissions
- payments: Plus welcome, submission payment received, renewal failed, cancellation, payment not completed

Payment and security emails are always sent. Templates live in the backend (`services/emailTemplates.js`).

@article lyrics-provider
title: Lyrics provider
summary: Where to configure external lyrics.
keywords: lyrics provider settings, lyrics api

**Settings → Lyrics** — see [External lyrics provider](/admin/docs/lyrics/external-lyrics-provider).

@article storage
title: Storage
summary: Where files live.
keywords: storage, buckets, files, audio storage, images

Files are stored in Supabase Storage, in four buckets:

| Bucket | Access | Contents |
| --- | --- | --- |
| `music` | Private | Song audio (streamed and downloaded only through short-lived signed links or the API) |
| `media` | Public | Artwork, artist images, album covers, avatars, playlist covers, branding, video thumbnails, offer images |
| `videos` | Private | Music video files |
| `subtitles` | Private | WebVTT caption files |

File names are random, so public images can't be guessed or listed. See [Storage](/admin/docs/operations/storage) for setup.

@article upload-limits
title: Upload limits
summary: Maximum audio, image and video sizes.
keywords: upload limits, file size, max size, audio limit, video limit

**Settings → Uploads** (audio, images) and **Settings → Music video** (video) set the maximum sizes. They can be lowered but never raised above the server ceilings (`MAX_AUDIO_MB`, `MAX_IMAGE_MB`, `MAX_VIDEO_MB`). Current effective limits: audio {{maxAudioMb}} MB, images {{maxImageMb}} MB, video {{maxVideoMb}} MB.

Your Supabase plan's per-file limit also applies (50 MB on the Free plan).

@article notifications
title: Notifications
summary: Release emails and in-app notifications.
keywords: notifications settings, release emails, in-app notifications

**Settings → Notifications → Release emails** emails followers when an artist they follow publishes a song or video. In-app notifications are always on; each listener chooses what they receive in their own Settings → Notifications.

@article maintenance-mode
title: Maintenance mode
summary: Temporarily hide the site from visitors.
keywords: maintenance mode, take site offline, downtime

**Settings → Access → Maintenance mode** shows visitors a maintenance page with your **Maintenance message**. Administrators can still sign in and use the site and dashboard. Paystack webhooks keep working during maintenance.

Turn it off again in the same place. A yellow banner in Settings reminds you while it's on.
