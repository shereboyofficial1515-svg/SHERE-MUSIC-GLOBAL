# SHERE MUSIC

**Discover music. Stream music. Download music.**

SHERE MUSIC is a full-stack music discovery, streaming and download platform. Listeners browse, search, stream and download songs, read synced lyrics, watch music videos and follow artists. Creators manage their own music in **SHERE MUSIC STUDIO**, and administrators review submissions and run the whole platform from a separate, role-protected dashboard.

---

## Contents

- [Technology stack](#technology-stack)
- [Features](#features)
- [Folder structure](#folder-structure)
- [Installation](#installation)
- [Environment variables](#environment-variables)
- [Supabase setup](#supabase-setup)
- [Resend setup](#resend-setup)
- [Local development](#local-development)
- [Admin setup](#admin-setup)
- [Production deployment](#production-deployment)
- [API overview](#api-overview)
- [Security model](#security-model)

---

## Technology stack

| Layer    | Technology |
| -------- | ---------- |
| Frontend | React 19, React Router 7, Vite, plain CSS with light/dark design tokens, GSAP (motion), Fetch/XHR |
| Backend  | Node.js 20+, Express 5, JWT in HTTP-only cookies, Zod validation, Helmet, CORS, rate limiting, Multer |
| Database | Supabase PostgreSQL (views + SQL functions, RLS enabled) |
| Storage  | Supabase Storage (private `music`, `videos` and `subtitles` buckets, public `media` bucket) |
| Sign-in  | Email + password, or Google / Facebook through Supabase Auth (identity check only; SHERE MUSIC keeps its own session) |
| Email    | Resend |

## Features

**Listeners** — home page (featured, trending, latest releases, genres, popular artists, featured playlists, recently added) · discover with genre filters, sorting and infinite scroll · debounced live search across titles, artists, albums and genres · song, artist, album, genre and playlist pages · persistent player (play/pause, seek, volume/mute, next/previous, queue, full-screen view on mobile, lock-screen controls via Media Session) · downloads of the original file with progress · favourites · playlists (create, rename, delete, cover image, public/private, add/remove songs) · profile with recently played and download history · account settings (name, avatar, password, delete account).

**Listening (2.0)** — personal home (recently played, made for you, because you listened, from artists you follow) · player with shuffle, repeat, editable queue, autoplay and resume · expanded player with artwork-matched colours · synced lyrics (tap a line to jump there) and a full-screen lyrics mode · follow artists, following feed and in-app notifications · public profiles at `/u/:username` · grouped search including lyric matches.

**SHERE MUSIC VIDEO** — video home (featured, trending, new releases, recommended, categories) · browse and watch pages · custom player with keyboard shortcuts, captions (WebVTT, uploaded as SRT or VTT) and linked songs.

**Settings** — account, profile, playback, appearance (light / dark / system), accessibility (reduced motion, larger text, high contrast, larger controls), privacy, notifications, downloads (Wi-Fi only where supported), language, security (sign out other devices) and connected Google/Facebook accounts.

**SHERE MUSIC STUDIO** (`/studio`) — creators manage one or more artist profiles, upload songs and music videos, write and sync lyrics (line editor, tap-to-sync, LRC import/export), request verification and see their own analytics and followers. Content moves through **draft → pending review → approved → published** (or **changes requested**), unless the admin turns on auto-publish.

**Accounts** — registration with email verification, login/logout, Google/Facebook sign-in and account linking, forgot/reset password, email change with confirmation, session revocation on password change, disabled-account handling.

**Admins** — review queue for songs, videos, lyrics and artist verification · lyrics and subtitle management · music videos · optional external lyrics provider · dashboard with totals and 14-day chart · music list with search, filters, sort, publish/unpublish, feature, delete · upload & edit with progress, file validation, audio/artwork replacement and draft preview · artists (image, bio) · albums (artwork, add songs) · categories/genres · playlist moderation and featuring · users (search, disable/enable, promote/demote) · download log · analytics (plays, downloads, registrations, searches, top songs/artists/searches) · CSV reports · site settings (name, logo, favicon, description, contact, social links, upload limits, registration, maintenance mode, featured count).

## Folder structure

```text
SHERE-MUSIC/
├── backend/
│   ├── scripts/
│   │   ├── create-admin.js        # create/promote an administrator
│   │   └── setup-storage.js       # create the storage buckets
│   ├── src/
│   │   ├── config/                # env loading + Supabase client
│   │   ├── controllers/           # request handlers (admin/ subfolder for dashboard)
│   │   ├── database/              # schema.sql, seed.sql, storage.sql, migrations/
│   │   ├── middleware/            # auth, CSRF, rate limits, uploads, maintenance, errors
│   │   ├── routes/                # auth, public, library, studio, admin routers
│   │   ├── services/              # storage, email, sessions, settings, lyrics, videos, reviews, ownership, mappers
│   │   ├── utils/                 # errors, db helpers, file sniffing, CSV, search
│   │   ├── validators/            # Zod schemas
│   │   └── app.js
│   ├── server.js
│   └── .env.example
├── frontend/
│   ├── public/                    # favicon, OG image, manifest, robots.txt
│   ├── src/
│   │   ├── components/            # ui/, music/, player/, lyrics/, videos/, content/, settings/, layout/, admin/
│   │   ├── context/               # auth, player, preferences, library, downloads, settings, toasts
│   │   ├── hooks/                 # useAsync, useLyrics, usePaginatedList, useMeta, …
│   │   ├── layouts/               # Main, Auth, Dashboard, Studio, Admin
│   │   ├── pages/                 # public/, videos/, auth/, user/, settings/, studio/, admin/
│   │   ├── services/              # API client + endpoint modules
│   │   ├── styles/                # design tokens + component styles
│   │   ├── utils/
│   │   ├── App.jsx
│   │   └── main.jsx
│   └── .env.example
└── README.md
```

## Installation

Requirements: **Node.js 20+**, a **Supabase** project and a **Resend** account.

```bash
cd backend && npm install
cd ../frontend && npm install
```

## Environment variables

Copy the examples and fill them in. Real `.env` files are git-ignored.

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

### Backend (`backend/.env`) — server secrets

| Variable | Required | Description |
| --- | --- | --- |
| `PORT` | no | API port (default `5000`) |
| `NODE_ENV` | no | `development` or `production` |
| `SUPABASE_URL` | yes | Project URL (Settings → API) |
| `SUPABASE_ANON_KEY` | no | Not used by the backend; kept for tooling |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Service-role key — **server only** |
| `STORAGE_AUDIO_BUCKET` / `STORAGE_MEDIA_BUCKET` | no | Bucket names (default `music` / `media`) |
| `STORAGE_VIDEO_BUCKET` / `STORAGE_SUBTITLE_BUCKET` | no | Bucket names (default `videos` / `subtitles`) |
| `JWT_SECRET` | yes | ≥ 32 random characters |
| `SESSION_DAYS` | no | Session length (default 7) |
| `RESEND_API_KEY` | prod | Resend API key. In development, emails print to the console if empty |
| `RESEND_FROM_EMAIL` | prod | Sender on a verified Resend domain, e.g. `SHERE MUSIC <no-reply@yourdomain.com>` |
| `FRONTEND_URL` | yes | Public site URL (email links + CORS). Comma-separate several origins |
| `CORS_ORIGINS` | no | Extra allowed origins |
| `COOKIE_SECURE`, `COOKIE_SAMESITE`, `COOKIE_DOMAIN` | no | Cookie overrides (see below) |
| `MAX_AUDIO_MB`, `MAX_IMAGE_MB`, `MAX_VIDEO_MB` | no | Hard upload ceilings (defaults 50 / 5 / 500). Admin settings can lower them |
| `LYRICS_API_URL`, `LYRICS_API_KEY` | no | Optional external lyrics provider. The URL may use `{artist}`, `{title}`, `{album}`, `{duration}`. Overrides the values in Admin → Settings → Lyrics; the key never reaches a browser |
| `TRUST_PROXY` | no | Number of proxies in front of the API (default 1 in production) |

Generate a JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### Frontend (`frontend/.env`) — public values only

| Variable | Description |
| --- | --- |
| `VITE_API_URL` | API base including `/api`. Keep `/api` in development (Vite proxies it) |
| `VITE_SITE_URL` | Public site URL for canonical and Open Graph tags |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Needed only for Google/Facebook sign-in. Leave empty to hide those buttons |
| `DEV_API_PROXY` | Dev-only proxy target (default `http://localhost:5000`) |

Nothing secret ever goes in the frontend: every `VITE_*` value is bundled into public JavaScript. The Supabase anon key is public by design, and the database grants it nothing.

## Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. **Database** — open *SQL Editor* and run, in order:
   1. `backend/src/database/schema.sql` — tables, indexes, views, functions, RLS
   2. `backend/src/database/seed.sql` — starter genres (Afrobeats, Afropop, Hip-Hop, R&B, Gospel, Pop, Dance, Highlife, Amapiano, Reggae, Instrumental, Other)
   3. `backend/src/database/migrations/002_studio_video_lyrics.sql` — SHERE MUSIC 2.0: review workflow, Studio ownership, lyrics, music videos, subtitles, follows, notifications, user settings and connected accounts

   All scripts are idempotent and safe to re-run. **Upgrading an existing 1.x database:** run only the 002 migration. Existing songs keep their published/draft state.
3. **Storage** — create the buckets (`music`, `media`, `videos`, `subtitles`), either:
   - `cd backend && npm run setup:storage` (uses your `.env`), **or**
   - run `backend/src/database/storage.sql` in the SQL editor.

   Re-run it after upgrading to 2.0 so the video and subtitle buckets exist.
4. **Google / Facebook sign-in** (optional):
   1. *Authentication → Providers*: enable **Google** and/or **Facebook** and paste the client ID and secret from the Google Cloud console / Meta for Developers. In those consoles, set the OAuth redirect URI to `https://<project-ref>.supabase.co/auth/v1/callback`.
   2. *Authentication → URL Configuration*: set **Site URL** to your site, and add `http://localhost:5173/auth/callback` and `https://your-site.com/auth/callback` to **Redirect URLs**.
   3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `frontend/.env`.

   Supabase only verifies who the person is. The API checks the Supabase access token, then signs the person in with its own cookie session. If the provider has verified the email and it matches an existing account, the provider is linked to that account instead of creating a duplicate. An unverified match is refused, and the person is asked to sign in with their password and connect the provider from Settings. Signed-in users can connect or disconnect providers in *Settings → Connected accounts*.

**Video file size:** videos are uploaded directly from the browser to Supabase Storage through a signed upload URL, so they never pass through the API. Supabase caps the size of a single file (**50 MB on the Free plan**, higher and configurable on paid plans under *Storage → Settings*). Keep `MAX_VIDEO_MB` and Admin → Settings → Uploads at or below that cap, or uploads will fail at the storage step.

### Storage layout

| Bucket | Access | Folders |
| --- | --- | --- |
| `music` | **private** | `songs/YYYY/MM/<uuid>.<ext>` |
| `media` | public read | `artwork/`, `artists/`, `albums/`, `avatars/`, `playlists/`, `branding/`, `covers/` (artist banners), `thumbnails/` (videos) |
| `videos` | **private** | music-video files (streamed through 4-hour signed URLs) |
| `subtitles` | **private** | WebVTT caption files (SRT uploads are converted to VTT) |

Audio is never publicly addressable. The API issues short-lived signed URLs: 4 hours for streaming (so seeking keeps working) and 2 minutes for downloads (with `Content-Disposition: attachment` and a clean `Artist - Title.ext` filename). Images live in a public bucket with random UUID names; no `storage.objects` policies are created, so the bucket cannot be listed or written with the anon key.

Uploaded files are validated by their **actual bytes** (magic numbers), not the browser-supplied MIME type or filename, and stored under generated names.

### Database design

Tables: `users`, `auth_tokens`, `artists`, `albums`, `genres`, `songs`, `favorites`, `playlists`, `playlist_songs`, `plays`, `downloads`, `search_logs`, `site_settings`, and in 2.0 `user_settings`, `connected_accounts`, `notifications`, `artist_followers`, `lyrics`, `lyric_lines`, `music_videos`, `video_subtitles`, `video_views`.

Read models: `songs_view`, `artists_view`, `albums_view`, `genres_view`, `playlists_view`, `videos_view`.
Functions: `record_play`, `record_download`, `record_video_view` (atomic counters), `trending_songs`, `trending_videos`, `popular_artists`, `admin_overview`, `daily_activity`, `top_songs_period`, `top_artists_period`, `top_searches`, `studio_overview`, `studio_daily_activity`, `studio_top_songs`, `replace_lyric_lines`.

Songs and videos have a `status` column (`draft`, `pending`, `approved`, `published`, `rejected`); `is_published` is generated from it. Artists can have an `owner_user_id`, and Studio access is always checked against that owner on the server. Synced lyrics store one row per line with `start_time_ms`.

Storage paths (not URLs) are saved in the database (`audio_path`, `artwork_path`, `image_path`, `avatar_path`); URLs are derived by the API.

## Resend setup

1. Create an account at [resend.com](https://resend.com) and **verify your sending domain** (DNS records).
2. Create an API key → `RESEND_API_KEY`.
3. Set `RESEND_FROM_EMAIL`, e.g. `SHERE MUSIC <no-reply@yourdomain.com>`.

Emails sent: verification (*"Verify your SHERE MUSIC account"*), password reset (*"Reset your SHERE MUSIC password"*), and account notifications (password changed, account disabled/re-enabled, admin role granted/removed). Templates live in `backend/src/services/emailTemplates.js`.

## Local development

```bash
# terminal 1
cd backend && npm run dev        # http://localhost:5000

# terminal 2
cd frontend && npm run dev       # http://localhost:5173
```

Vite proxies `/api` to the backend, so the session cookie is same-origin in development. Without `RESEND_API_KEY`, verification and reset links are printed in the backend terminal.

## Admin setup

Register normally or create the first admin directly:

```bash
cd backend
npm run create-admin -- --email you@example.com --name "Your Name"
```

The script prompts for a password (or reads `ADMIN_PASSWORD`). If the email already exists it is promoted to admin and marked verified. After that, promote other users from **Admin → Users**.

**Upload workflow:** Admin → Upload Music → enter details → choose artist/album/genre → artwork → audio → *Upload song*. Files are validated, uploaded to storage, then the database row is created; if the insert fails, the uploaded files are deleted automatically. The song is saved as a draft unless *Published* is on; publish it from the edit page or the Music list and it is live immediately.

**Creators:** any signed-in listener can open **Studio** (`/studio/welcome`) and create an artist profile, which makes their account an artist account. Admins can turn this off (*Admin → Settings → Studio*) and give artist access from *Admin → Users* instead. Creator uploads wait in *Admin → Reviews* unless *auto-publish* is on.

## Production deployment

**Backend** (Render, Railway, Fly.io, a VPS…):

- Start command `npm start`, Node 20+.
- Set all backend variables, `NODE_ENV=production`, and `FRONTEND_URL=https://your-site.com`.
- The server refuses to start in production without Resend configuration.

**Frontend** (Vercel, Netlify, Cloudflare Pages…):

- Build `npm run build`, output `dist/`.
- `VITE_API_URL=https://api.your-site.com/api`, `VITE_SITE_URL=https://your-site.com`.
- Add an SPA fallback so every path serves `index.html` (Netlify: `/* /index.html 200`; Vercel: rewrite to `/index.html`).

**Cookies across domains:** by default production cookies are `Secure; SameSite=None`, which works when the frontend and API are on different sites. If both are subdomains of one domain (e.g. `app.example.com` and `api.example.com`) you can use `COOKIE_SAMESITE=lax`. Serving the API under the same domain via a reverse proxy (`/api`) is the most robust option, especially for Safari's tracking protection.

**CORS:** only origins in `FRONTEND_URL` / `CORS_ORIGINS` may call the API with credentials.

**SEO note:** the app is a client-rendered SPA. Titles, descriptions, canonical and Open Graph tags are set per page at runtime, which Google indexes. Social previews (which don't run JavaScript) use the defaults in `index.html`; add prerendering or an edge function if you need per-song link previews. Replace `public/og-image.svg` with a 1200×630 PNG for the widest social-network support.

## API overview

All responses are JSON: `{ "data": …, "meta"?: … }` on success and `{ "error": { "message", "code", "details"? } }` on failure. State-changing requests must send `X-Requested-With: SHERE-MUSIC` (CSRF protection); the frontend client does this automatically.

| Area | Endpoints |
| --- | --- |
| Health | `GET /api/health` |
| Auth | `POST /api/auth/register · login · logout · verify-email · resend-verification · forgot-password · reset-password · change-password`, `GET /api/auth/me` |
| Catalog | `GET /api/settings · /home · /search?q=` · `GET /api/songs` (q, genre, artist, album, featured, sort, page, limit) · `/songs/trending` · `/songs/:id` · `/songs/:id/related` · `/songs/:id/stream` |
| Plays & downloads | `POST /api/songs/:id/play` · `POST /api/songs/:id/download` |
| Artists / albums / genres | `GET /api/artists`, `/artists/:id`, `/albums`, `/albums/:id`, `/genres`, `/genres/:slug` |
| Me | `GET /api/me/profile · /me/downloads · /me/recent`, `PATCH /api/me`, `POST/DELETE /api/me/avatar`, `DELETE /api/me` |
| Favorites | `GET /api/favorites`, `GET /api/favorites/ids`, `POST/DELETE /api/favorites/:songId` |
| Playlists | `GET /api/playlists/featured`, `GET/POST /api/playlists`, `GET/PATCH/DELETE /api/playlists/:id`, `POST /api/playlists/:id/artwork`, `POST /api/playlists/:id/songs`, `DELETE /api/playlists/:id/songs/:songId` |
| Lyrics & social | `GET /api/songs/:id/lyrics` · `POST/DELETE /api/artists/:id/follow` · `GET /api/artists/:id/followers` · `GET /api/users/:username` · `GET /api/me/following · /me/feed · /me/notifications` |
| Videos | `GET /api/videos/home · /videos · /videos/:id · /videos/:id/related · /videos/:id/stream · /videos/:id/subtitles/:subtitleId`, `POST /api/videos/:id/view` |
| Settings & account | `GET/PUT /api/me/settings` · `POST /api/me/email · /me/password · /me/sessions/revoke-others` · `GET /api/me/connected-accounts` · `POST /api/auth/oauth/:provider (+ /link)` · `POST /api/auth/confirm-email` |
| Studio | `/api/studio/me · overview · analytics · followers · options` · `artists` (+ `/verification`) · `albums` · `songs` (+ `/submit`, `/publish`, `/preview`, `/lyrics`) · `videos` (+ `/upload-url`, `/complete-upload`, `/subtitles`, `/submit`, `/publish`). Every route is limited to artists the signed-in user owns |
| Admin | `/api/admin/reviews` · `lyrics` · `videos` · `/api/admin/overview · analytics · downloads · reports/:type` · `songs` (CRUD, `/publish`, `/feature`, `/preview`) · `artists` · `albums` (+ `/songs`) · `genres` · `playlists` · `users` (+ `/status`, `/role`) · `settings` (+ `/logo`, `/favicon`) |

Every `/api/admin/*` route passes through `requireAdmin`, which re-reads the user's role from the database on each request.

## Security model

- Passwords hashed with bcrypt (cost 12); constant-time login responses for unknown emails.
- JWT (HS256) in an HTTP-only cookie. The user row is re-checked on every request, so disabling an account, changing a role or resetting a password (which bumps `token_version`) takes effect immediately.
- Email-verification and reset tokens are random 256-bit values; only SHA-256 hashes are stored, and they are single-use with expiry (24 h / 1 h).
- Forgot-password and resend-verification never reveal whether an email is registered.
- Helmet security headers, strict CORS allow-list, CSRF header check, rate limits on auth, email, play, download and upload endpoints.
- Zod validation on every input; PostgREST parameterised queries; search input sanitised for filter syntax.
- Uploads: size limits, byte-level type detection, generated filenames, cleanup of orphaned files on failure.
- RLS enabled on every table with no policies, and anon/authenticated grants revoked, so leaked public keys cannot read data.
- Analytics store no IP addresses or user agents; search logs store only the query text.
- CSV exports are protected against spreadsheet formula injection.
