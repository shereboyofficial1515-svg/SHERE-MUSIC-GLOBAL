# SHERE MUSIC — Production Deployment Checklist

Architecture: **Vercel** (React frontend) → **Render** (Node/Express API) → **Supabase** (Postgres + Storage), with **Resend** (email) and **Paystack** (payments). Step-by-step setup is in [README → Production deployment](README.md#production-deployment-vercel--render).

Items marked ✅ were verified in the codebase before release. Everything else must be checked on the real deployment.

## Before deploying

- [ ] Domains decided — custom domain (`www.` + `api.` on one domain) **or** the Vercel `/api` rewrite (needed for Safari/iPhone sign-in; see README step 0)
- [ ] Supabase migrations applied: `schema.sql`, `seed.sql`, `002_studio_video_lyrics.sql`, `003_monetization.sql`
- [ ] Storage buckets created (`npm run setup:storage`)
- [ ] First admin account created (`npm run create-admin`)

## Vercel

- [ ] Root directory `frontend`, framework Vite, build `npm run build`, output `dist`
- ✅ Production build works (`npm run build`)
- ✅ SPA routes rewrite to `index.html` (`frontend/vercel.json`)
- [ ] Refreshing `/discover`, `/studio`, `/admin`, `/help`, `/admin/docs` works on the live site
- [ ] Environment variables set: `VITE_API_URL`, `VITE_SITE_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- ✅ Build fails on Vercel if `VITE_API_URL` / `VITE_SITE_URL` point to localhost
- [ ] Custom domain configured
- [ ] HTTPS enabled (automatic on Vercel)

## Render

- [ ] Web Service created from `render.yaml` (or root `backend`, build `npm ci --omit=dev`, start `npm start`)
- ✅ Start command is `npm start` → `node server.js`
- ✅ Listens on Render's `PORT`, bound to `0.0.0.0`
- ✅ Health endpoint `GET /api/health` → `{"status":"ok","service":"SHERE MUSIC API"}` (no auth, no configuration details)
- [ ] Health check path set to `/api/health` and passing
- [ ] Environment variables set (see README table); `NODE_ENV=production`
- ✅ Server refuses to start in production with a localhost or `http://` `FRONTEND_URL`, or without Resend
- [ ] Logs clean after deploy (a warning about a Paystack test key is expected until launch)
- [ ] Custom domain `api.your-domain.com` (if using option A)

## Supabase

- [ ] Database migrations applied (all four scripts)
- ✅ RLS enabled on every table; no policies; `anon` / `authenticated` have no grants
- [ ] Storage buckets exist: `music` (private), `media` (public), `videos` (private), `subtitles` (private)
- ✅ No storage policies are needed: only the API (service-role key) reads/writes; public images use random names
- [ ] Production service-role key only in Render; anon key only in Vercel
- [ ] Auth URL Configuration: Site URL and `/auth/callback` redirect URLs for production

## Paystack

- [ ] Test-mode secret key in Render; test webhook URL = `https://<api>/api/payments/paystack/webhook`
- [ ] Test payment works (Plus, and an artist submission)
- [ ] Webhook reaches Render (Paystack → Webhooks log shows 200)
- ✅ Webhook signature verification (HMAC-SHA512) — forged signatures get 401
- ✅ Duplicate webhooks / verify calls never fulfil twice
- [ ] Live key and live webhook configured **only** for production at launch

## Resend

- [ ] Domain verified
- [ ] `RESEND_FROM_EMAIL` on the verified domain
- [ ] Verification email arrives
- [ ] Password reset email arrives
- [ ] Payment emails arrive (Plus welcome, submission payment)
- [ ] Artist approval / rejection emails arrive

## OAuth

- [ ] Google: redirect URI = Supabase callback; production origin added; provider enabled in Supabase
- [ ] Facebook: redirect URI = Supabase callback; app domain added; app Live; provider enabled in Supabase
- [ ] Google sign-in works on the production site
- [ ] Facebook sign-in works on the production site

## Security

- ✅ No secrets in Git (`.env` ignored; history scanned)
- ✅ No secrets in the frontend bundle (only public `VITE_` values)
- ✅ CORS restricted to `FRONTEND_URL` / `CORS_ORIGINS` (credentials allowed only for those)
- ✅ Cookies: `HttpOnly`, and `Secure; SameSite=None` in production
- ✅ Admin API routes require the admin role on the server (including `/api/admin/docs/*`)
- ✅ Upload validation by file content and size (audio, images, video, subtitles)
- ✅ Rate limiting: sign-in/registration, password reset and email, payments, uploads, search, lyrics lookups, downloads, plays, and the API overall
- ✅ Error responses sanitised in production (no stack traces or configuration)
- ✅ Security headers (Helmet: HSTS, nosniff, referrer policy, strict CSP on API responses); basic headers on Vercel
- ✅ Plus downloads authorised by the API; free users get 403
- [ ] HTTPS everywhere (Vercel + Render defaults)

## Go-live tests (on the real URLs)

- [ ] Visitor: home, search, playback, lyrics, a music video
- [ ] Register → verification email → sign in → refresh keeps you signed in (test in Chrome **and** Safari/iPhone)
- [ ] Password reset
- [ ] Google and Facebook sign-in
- [ ] Artist: create profile, upload a song (lands in Supabase Storage), pay the submission fee, see it pending
- [ ] Admin: review and approve → song plays for listeners
- [ ] Plus: pay → webhook → Plus active → download works; free account gets the Plus prompt
- [ ] `/help` public; `/admin/docs` → login redirect (logged out), 403 page (listener/artist), works for admin
