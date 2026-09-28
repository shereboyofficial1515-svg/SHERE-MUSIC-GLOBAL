---
title: Technical Operations
description: Environment variables, database, storage, email, Paystack, deployment, backups, API reference and troubleshooting.
icon: tool
order: 11
---
@article environment-variables
title: Environment variables
summary: Every server and website setting — what it does and where it belongs.
keywords: environment variables, env, configuration, .env, secrets, keys, supabase_service_role_key, paystack_secret_key, resend_api_key, jwt_secret

Real values live only in the hosting provider's environment settings (or local `.env` files, which are git-ignored). **Never** put real values in code, documentation, tickets or screenshots. `backend/.env.example` and `frontend/.env.example` list every variable with no values.

## Backend (server only — secret)

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Full database/storage access. **Server only, never in the frontend.** |
| `SUPABASE_ANON_KEY` | Not used by the backend (kept for tooling) |
| `JWT_SECRET` | Signs session tokens. At least 32 random characters. Changing it signs everyone out |
| `SESSION_DAYS` | Session length in days (default 7) |
| `FRONTEND_URL` | Public site URL, used in email links, Paystack return links and CORS. Comma-separate several |
| `CORS_ORIGINS` | Extra allowed origins |
| `COOKIE_SECURE`, `COOKIE_SAMESITE`, `COOKIE_DOMAIN` | Cookie overrides for cross-domain setups |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | Email sending (required in production) |
| `PAYSTACK_SECRET_KEY` | Paystack secret key. `sk_test_…` = test mode, `sk_live_…` = live mode |
| `PAYSTACK_PUBLIC_KEY` | Not needed for the current redirect checkout |
| `STORAGE_AUDIO_BUCKET`, `STORAGE_MEDIA_BUCKET`, `STORAGE_VIDEO_BUCKET`, `STORAGE_SUBTITLE_BUCKET` | Bucket names (defaults `music`, `media`, `videos`, `subtitles`) |
| `MAX_AUDIO_MB`, `MAX_IMAGE_MB`, `MAX_VIDEO_MB` | Upload ceilings; admin settings can only lower them |
| `LYRICS_API_URL`, `LYRICS_API_KEY` | Optional lyrics provider; override admin settings |
| `DOCS_DIR` | Optional path to the `docs/` folder if the backend is deployed without the repository root |
| `PORT`, `NODE_ENV`, `TRUST_PROXY` | Server port, environment, number of proxies in front of the API |

## Frontend (public — bundled into the website)

| Variable | Purpose |
| --- | --- |
| `VITE_API_URL` | API base including `/api` |
| `VITE_SITE_URL` | Public site URL (canonical and social links) |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Only for Google/Facebook sign-in. The anon key is public by design; the database grants it nothing |
| `DEV_API_PROXY` | Development only |

> **Important:** Anything starting with `VITE_` is visible to every visitor. Never put a secret there.

@article database
title: Database
summary: Schema, migrations and the main tables.
keywords: database, schema, migrations, tables, supabase sql, postgres

The database is Supabase Postgres. SQL lives in `backend/src/database/`. Run in the Supabase SQL editor, in order (all are safe to re-run):

1. `schema.sql` — core tables, views, functions, RLS
2. `seed.sql` — starter genres
3. `migrations/002_studio_video_lyrics.sql` — Studio, review workflow, lyrics, videos, follows, notifications, user settings
4. `migrations/003_monetization.sql` — Plus, payments, submissions, offers, download types, revenue

## Main tables

| Area | Tables |
| --- | --- |
| Accounts | `users`, `auth_tokens`, `connected_accounts`, `user_settings`, `notifications` |
| Catalog | `artists`, `albums`, `genres`, `songs`, `lyrics`, `lyric_lines` |
| Video | `music_videos`, `video_subtitles`, `video_views` |
| Library & activity | `favorites`, `playlists`, `playlist_songs`, `artist_followers`, `plays`, `downloads`, `search_logs` |
| Money | `payment_transactions`, `plus_subscriptions`, `artist_submissions`, `payment_events`, `plus_offers` |
| Config | `site_settings` (one row) |

Key functions: `has_active_plus`, `fulfill_payment`, `record_plus_renewal`, `record_play`, `record_download`, `trending_songs`, `admin_overview`, `monetization_summary`. Money is stored in minor units (kobo).

Never share the database password or connection string. Use the Supabase dashboard with individual team accounts.

@article storage
title: Storage
summary: Creating and sizing storage buckets.
keywords: storage setup, buckets, setup storage, file size limit

Create the four buckets with `npm run setup:storage` in `backend/` (or run `backend/src/database/storage.sql`). Re-run it after adding features that need new buckets.

If the script warns that a size is above your project's limit, the bucket falls back to the project-wide limit (50 MB per file on the Supabase Free plan). Keep `MAX_VIDEO_MB` and the admin upload limits at or below it, or raise the limit in Supabase → Storage → Settings on a paid plan.

@article email
title: Email
summary: Setting up Resend.
keywords: resend setup, email domain, dns, sender

1. In Resend, verify your sending domain (DNS records).
2. Create an API key and set `RESEND_API_KEY` on the server.
3. Set `RESEND_FROM_EMAIL`, for example `SHERE MUSIC <no-reply@yourdomain.com>`.

In production the server refuses to start without these. In development, emails are printed to the server log if no key is set.

@article paystack
title: Paystack
summary: Connecting Paystack, test mode and going live.
keywords: paystack setup, webhook url, go live, test keys, live keys, plan

1. Paystack dashboard → Settings → API Keys & Webhooks: copy the **test** secret key into `PAYSTACK_SECRET_KEY` on the server and restart it.
2. Set the **test webhook URL** to `https://<your-api-domain>/api/payments/paystack/webhook`.
3. Test with Paystack's test checkout options (Success / Declined).
4. To go live: complete Paystack's business activation, set the **live** secret key, set the **live webhook URL**, restart.

The "SHERE MUSIC PLUS" plan is created automatically on the first Plus checkout in each mode, and again when the price or currency changes. Webhooks can't reach a local computer; the return page's verification still completes payments there.

@article deployment
title: Deployment
summary: Running SHERE MUSIC in production.
keywords: deployment, deploy, production, hosting, render, vercel, netlify

**Backend** (Render, Railway, a VPS…): Node 20+, `npm start`, all backend variables set, `NODE_ENV=production`. Deploy from the repository root (or copy `docs/` and set `DOCS_DIR`) so the Help Center and Admin Guide content is available.

**Frontend** (Vercel, Netlify…): `npm run build`, publish `dist/`, set the `VITE_*` variables, and add an SPA fallback so every path serves `index.html`.

**Before going live:**

- run all migrations and `setup:storage`
- set `FRONTEND_URL` to the real domain; configure the Supabase OAuth redirect URLs (`/auth/callback`)
- set the Paystack live key and webhook URL
- verify the Resend domain
- create the first admin with `npm run create-admin -- --email you@example.com --name "Your Name"` (the script asks for the password)

Cookies across domains default to `Secure; SameSite=None`. Serving the API under the same domain (`/api` via a reverse proxy) is the most robust option.

@article backups
title: Backups
summary: Protecting the database and files.
keywords: backups, restore, point in time recovery, export

- **Database**: Supabase takes automatic daily backups on paid plans; enable Point-in-Time Recovery for critical periods. On the Free plan, export regularly (Supabase dashboard → Database → Backups, or `pg_dump` with a secured connection string kept outside the repository).
- **Files**: Storage isn't included in database backups. Periodically copy the buckets (for example with the Supabase CLI or S3-compatible tools).
- **Payments**: Paystack keeps its own transaction records; the Payments page can be reconciled against it.
- Test a restore occasionally. Store backups encrypted and restrict who can access them.

@article api-reference
title: API reference
summary: Main endpoints (for staff and developers).
keywords: api, endpoints, routes, rest api, api documentation

All responses are JSON: `{ "data": …, "meta"?: … }` or `{ "error": { "message", "code" } }`. State-changing requests need the `X-Requested-With: SHERE-MUSIC` header.

| Area | Endpoints |
| --- | --- |
| Public | `GET /api/settings`, `/api/home`, `/api/search`, `/api/songs`, `/api/songs/:id`, `/api/songs/:id/stream`, `/api/songs/:id/lyrics`, `/api/artists`, `/api/albums`, `/api/genres`, `/api/videos/home`, `/api/videos/:id` |
| Auth | `POST /api/auth/register · login · logout · verify-email · forgot-password · reset-password`, `POST /api/auth/oauth/:provider`, `GET /api/auth/me` |
| Library | `/api/favorites`, `/api/playlists`, `/api/me/*` (profile, settings, notifications, following) |
| Downloads | `GET /api/songs/:id/download` (signed in + Plus, streams the file) |
| Payments | `POST /api/payments/plus/initialize · plus/cancel · artist/initialize`, `GET /api/payments/plus/status · verify/:reference · history`, `POST /api/payments/paystack/webhook` (Paystack only) |
| Help Center | `GET /api/help`, `/api/help/search`, `/api/help/articles/:section/:article` (public docs only) |
| Studio | `/api/studio/*` (artist/admin, owner-scoped) |
| Admin | `/api/admin/*` — overview, analytics, downloads, reports, songs, lyrics, videos, artists, albums, genres, playlists, users, settings, reviews, monetization, payments, plus-members, submissions, offers, docs |

The full list is in the backend route files (`backend/src/routes/`).

@article troubleshooting
title: Troubleshooting
summary: Common operational problems.
keywords: troubleshooting, errors, database error, 500, webhook not arriving, emails not sending

| Symptom | Likely cause / fix |
| --- | --- |
| "A database error occurred" on a page | A migration hasn't been run. Run the latest `migrations/*.sql`. |
| Uploads fail at "storage" | Bucket missing (run `setup:storage`) or file above the Supabase per-file limit. |
| "Payments are not available yet" | `PAYSTACK_SECRET_KEY` not set on the server. |
| Payments stay Pending in production | Webhook URL wrong or not set for the current mode (test vs live). Check Paystack → Webhooks logs. |
| Emails not arriving | Resend domain not verified or `RESEND_FROM_EMAIL` not on that domain; check the server log. |
| Google/Facebook sign-in fails | Redirect URL missing in Supabase → Authentication → URL Configuration, or provider disabled. |
| Everyone got signed out | `JWT_SECRET` changed. |
| Help Center or Admin Guide is empty | The backend can't find `docs/`; deploy from the repository root or set `DOCS_DIR`. Articles that contain something that looks like a secret are refused — check the server log. |
