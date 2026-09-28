# SHERE MUSIC — Technical Documentation

Version 2.1 · Last updated September 2026

This document describes how SHERE MUSIC is built. It is for developers and administrators. It contains **no secrets** — configuration is described by name only; real values live in the server environment. Setup instructions are in [`README.md`](README.md). End-user help lives in `docs/public` (served at `/help`); the private operator guide lives in `docs/admin` (served at `/admin/docs` to administrators only).

---

## 1. Architecture

```text
Browser (React SPA)  ──HTTPS──▶  Express API (/api)  ──▶  Supabase Postgres (service role)
      │                               │                    Supabase Storage (buckets)
      │                               ├──▶ Paystack (payments, subscriptions, webhooks)
      │                               └──▶ Resend (email)
      └── Supabase Auth (Google/Facebook identity only) ──▶ token verified by the API
```

- The **frontend** never talks to the database. All data flows through the API.
- The **API** is the only holder of secrets (Supabase service-role key, JWT secret, Paystack secret key, Resend key, lyrics provider key).
- **Supabase** provides Postgres and Storage. RLS is enabled on every table with no policies and no grants for `anon`/`authenticated`, so public keys can't read data.

## 2. Repository layout

```text
SHERE-MUSIC/
├── backend/            Express API (Node 20+, ES modules)
│   ├── scripts/        setup-storage.js, create-admin.js
│   └── src/
│       ├── config/     env loading, Supabase client
│       ├── controllers/  request handlers (admin/, shared/)
│       ├── database/   schema.sql, seed.sql, storage.sql, migrations/
│       ├── middleware/ auth, CSRF, rate limits, uploads, maintenance, errors
│       ├── routes/     auth, public, library, studio, payments, help, admin
│       ├── services/   domain logic (payments/, docs/, lyrics/, storage, email, reviews…)
│       ├── utils/      errors, db helpers, file sniffing, LRC, CSV, search
│       └── validators/ Zod schemas
├── frontend/           React 19 + Vite SPA
│   ├── public/         favicon, manifest, robots.txt, help/ (public Help Center screenshots)
│   └── src/            components/, context/, hooks/, layouts/, pages/, services/, styles/, utils/
├── docs/
│   ├── public/         Help Center content (Markdown) — served by /api/help
│   └── admin/          Admin Guide content + assets — served by /api/admin/docs (admins only)
├── README.md
└── DOCUMENTATION.md
```

## 3. Frontend

- **React 19, React Router 7, Vite.** Route-level code splitting (`App.jsx`); only the home page is in the initial bundle.
- **Styling:** plain CSS with design tokens (`styles/tokens.css`) for light and dark themes; green/white/black brand. A no-flash theme script in `index.html` applies the saved theme before first paint.
- **Motion:** GSAP via `utils/motion.js`, disabled when the user or OS asks for reduced motion.
- **State:** React contexts — `Auth`, `Settings` (public site settings), `Preferences` (user settings, synced to the API when signed in, local otherwise), `Player` (queue, shuffle, repeat, resume, Media Session), `Plus` (UI state + upgrade dialog), `Download`, `Library`, `Toast`.
- **API client:** `services/api.js` — cookies (`credentials: 'include'`), CSRF header on state-changing requests, errors normalised to `ApiError`.
- **Guards** (`components/layout/Guards.jsx`) are UX only; the API enforces every permission.
- **Layouts:** Main (site), Auth, Dashboard (shared by Admin and Studio), Docs (Help Center and Admin Guide).

## 4. Backend

- **Express 5.** Middleware order: Helmet → CORS allow-list → compression → Paystack webhook (raw body, before JSON parsing) → JSON → cookies → rate limit → CSRF header check → session (`attachUser`) → maintenance gate → routers.
- **Validation:** every input goes through a Zod schema (`middleware/validate.js`, results in `req.valid`).
- **Errors:** `AppError` with an HTTP status and a stable `code` (e.g. `PLUS_REQUIRED`, `SUBMISSION_FEE_REQUIRED`); `middleware/error.js` formats responses.
- **Responses:** `{ data, meta? }` or `{ error: { message, code, details? } }`.

## 5. Database

Supabase Postgres. SQL in `backend/src/database/`, applied in order: `schema.sql`, `seed.sql`, `migrations/002_studio_video_lyrics.sql`, `migrations/003_monetization.sql`. All are idempotent.

| Area | Tables |
| --- | --- |
| Accounts | `users`, `auth_tokens`, `connected_accounts`, `user_settings`, `notifications` |
| Catalog | `artists`, `albums`, `genres`, `songs`, `lyrics`, `lyric_lines` |
| Video | `music_videos`, `video_subtitles`, `video_views` |
| Library & activity | `favorites`, `playlists`, `playlist_songs`, `artist_followers`, `plays`, `downloads`, `search_logs` |
| Monetization | `payment_transactions`, `plus_subscriptions`, `artist_submissions`, `payment_events`, `plus_offers` |
| Config | `site_settings` (single row) |

Read models: `songs_view`, `artists_view`, `albums_view`, `genres_view`, `playlists_view`, `videos_view`.
Notable functions: `record_play`, `record_download` (typed), `record_video_view`, `trending_songs`, `trending_videos`, `admin_overview`, `studio_overview`, `replace_lyric_lines`, `has_active_plus`, `fulfill_payment`, `record_plus_renewal`, `monetization_summary`. Trigger `songs_sync_submission` keeps paid submissions in step with song review decisions.

Content workflow: songs and videos have `status` (`draft`, `pending`, `approved`, `published`, `rejected`); `is_published` is a generated column. Money is stored in minor units (kobo).

## 6. Authentication & authorization

- Email + password (bcrypt, cost 12) with email verification; password reset; email change with confirmation.
- Session: HS256 JWT in an HTTP-only cookie. `attachUser` re-reads the user each request; `token_version` revokes sessions on password change/reset.
- Google/Facebook: Supabase Auth verifies identity in the browser (PKCE); the API verifies the Supabase access token and issues its own session. Linking requires a provider-verified email.
- Roles: `user`, `artist`, `admin`. Guards: `requireAuth`, `requireArtist`, `requireAdmin` (every `/api/admin/*` route). Studio ownership is always derived server-side (`services/ownership.service.js`).
- CSRF: custom `X-Requested-With: SHERE-MUSIC` header on state-changing requests (and on downloads).

## 7. Storage

| Bucket | Access | Use |
| --- | --- | --- |
| `music` | private | song audio — streamed via short-lived signed URLs |
| `media` | public | artwork, artist images, covers, avatars, playlist covers, branding, thumbnails, offer images |
| `videos` | private | music videos — uploaded via one-time signed upload URLs, streamed via signed URLs |
| `subtitles` | private | WebVTT tracks (SRT converted on upload) |

Uploads are validated by magic bytes and stored under random names; failed operations clean up uploaded files. Buckets are created by `npm run setup:storage`.

## 8. Payments (Paystack)

Code: `backend/src/services/payments/` (`paystack.client.js`, `payment.service.js`, `plusEntitlement.service.js`), `controllers/payments.controller.js`, `controllers/admin/monetization.controller.js`.

- **Products:** SHERE MUSIC Plus (monthly Paystack plan, created automatically for the current price/currency/mode) and artist music submissions (one-time fee). Prices come from `site_settings`, never from the client.
- **Checkout:** the API creates a `payment_transactions` row with a unique reference and initializes a Paystack transaction; the browser is redirected to Paystack's hosted page.
- **Fulfilment:** only from Paystack data — the HMAC-SHA512-signed webhook (`POST /api/payments/paystack/webhook`) or the verify API (called by the return page). `fulfill_payment()` locks the row, checks amount and currency, and fulfils exactly once. Duplicate webhook deliveries are de-duplicated in `payment_events`.
- **Subscriptions:** `subscription.create`, `charge.success` / `invoice.update` (renewals), `invoice.payment_failed`, `subscription.disable` / `not_renew`. A fallback links subscriptions via the Paystack customer API when webhooks can't reach the server.
- **Entitlement:** `has_active_plus(user)` — any subscription whose paid period hasn't ended. Used by downloads, `/auth/me` and offers.
- **Downloads:** `GET /api/songs/:id/download` — auth + entitlement (Plus, admin, or the song's own artist) → the API streams the file and records the download with its type only after completion.
- **Submissions:** paid → `pending_review` (never auto-published); failed payments keep the draft and retries reuse the submission.

## 9. Email (Resend)

`services/email.service.js` + `services/emailTemplates.js`. Account emails, release notifications (respecting user preferences), review decisions and payment emails. Payment and security emails are always sent. Without an API key in development, emails are logged.

## 10. Lyrics

Tables `lyrics` (one version per song and language, with status and visibility) and `lyric_lines` (`start_time_ms` per line). LRC import/export (`utils/lrc.js`), a sync editor in the frontend, and a binary-search line indexer (`utils/lyricsEngine.js`) for playback sync. Optional external provider (`services/lyrics/`) with a generic HTTP adapter, URL placeholders and an in-memory cache; provider lyrics are never stored.

## 11. Music videos

`music_videos` + `video_subtitles`. Direct-to-storage uploads with signed upload URLs, server-side verification, signed streaming URLs, WebVTT subtitles delivered to the player as blob URLs, a custom player (captions, speed, quality list, PiP, keyboard shortcuts). Views counted by `record_video_view`.

## 12. Artist Studio

`/studio` (frontend) and `/api/studio` (backend). Creators manage their own artist profiles, songs, albums, lyrics and videos; review workflow; verification requests; analytics (`studio_overview`, `studio_daily_activity`, `studio_top_songs`); followers; paid submissions (Studio → Payments).

## 13. Admin system

`/admin` (frontend) and `/api/admin` (backend, `requireAdmin`). Dashboard, review queue, catalog management, lyrics, videos and subtitles, users and roles, downloads log, analytics, CSV reports, platform settings, monetization (revenue, payments, Plus members, artist submissions, offers, prices).

## 14. Documentation system

- Content: Markdown in `docs/public/<section>/index.md` and `docs/admin/<section>/index.md` (`@article` blocks with title, summary and keywords), plus `guide.json` (version, popular articles, quick actions).
- Delivery: `services/docs/docs.service.js` loads each collection into its own in-memory index. Public: `GET /api/help`, `/api/help/search`, `/api/help/articles/:section/:article`. Admin: the same under `/api/admin/docs` (behind `requireAdmin`) plus `/api/admin/docs/assets/:file` for screenshots.
- Separation: the public endpoints can only read `docs/public`; admin content is never in the frontend bundle or in `frontend/public`.
- Safety: articles containing anything that looks like a credential (or a value from the server environment) are refused and logged. Placeholders such as `{{plusPrice}}` are filled from current settings.
- Frontend: `components/docs/` (layout, Markdown renderer that builds React elements — no raw HTML) and `pages/docs/`. `/help` is public; `/admin/docs` is guarded in the UI and, more importantly, by the API.
- Maintenance: update the relevant article when a feature changes and bump `version`/`updated` in `guide.json`.

## 15. Configuration reference

Backend variables (names only): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `JWT_SECRET`, `SESSION_DAYS`, `FRONTEND_URL`, `CORS_ORIGINS`, `COOKIE_SECURE`, `COOKIE_SAMESITE`, `COOKIE_DOMAIN`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY`, `STORAGE_*_BUCKET`, `MAX_AUDIO_MB`, `MAX_IMAGE_MB`, `MAX_VIDEO_MB`, `LYRICS_API_URL`, `LYRICS_API_KEY`, `DOCS_DIR`, `PORT`, `NODE_ENV`, `TRUST_PROXY`.

Frontend variables (public): `VITE_API_URL`, `VITE_SITE_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `DEV_API_PROXY`.

Descriptions are in `README.md` and the Admin Guide (Technical Operations → Environment variables). Never commit real values.
