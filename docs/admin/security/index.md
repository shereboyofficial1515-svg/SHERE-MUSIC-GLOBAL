---
title: Security
description: How SHERE MUSIC protects accounts, data, files and payments — and what to do in an incident.
icon: shield
order: 10
---
@article authentication
title: Authentication
summary: How people sign in and how sessions work.
keywords: authentication, login, session, cookie, jwt, password hashing, oauth

- **Passwords** are hashed with bcrypt (cost 12). Sign-in responses take the same time whether or not the email exists.
- **Sessions** are a signed token (JWT, HS256, signed with `JWT_SECRET`) in an **HTTP-only cookie** that page scripts can't read. They last `SESSION_DAYS` days (default 7).
- On every request the server re-reads the user. Disabling an account, changing a role or changing/resetting a password (which increments the account's token version) takes effect immediately and signs the account out.
- **Email verification and password reset** links are random 256-bit tokens; only their SHA-256 hash is stored. They're single-use and expire (24 hours / 1 hour).
- **Google / Facebook** go through Supabase Auth only to confirm identity; SHERE MUSIC then issues its own session. An account is linked automatically only when the provider has verified the email.

@article authorization
title: Authorization
summary: How the server decides who may do what.
keywords: authorization, permissions, access control, requireAdmin, ownership

Every protected API route checks on the server:

| Check | Used for |
| --- | --- |
| Signed in | Library, settings, payments, downloads |
| `admin` role | Every `/api/admin/*` route, including the Admin Guide (`/api/admin/docs/*`) |
| `artist` or `admin` role, plus **ownership** | Studio: every song, album, video and lyric is looked up and checked against the signed-in user's own artist profiles. Other creators' content is reported as "not found". |
| Plus entitlement | Device downloads |

Hiding a button in the website is never the protection — the API refuses the request regardless of how it's made.

@article roles
title: Roles
summary: Role rules and safeguards.
keywords: roles, role changes, last admin

See [Admin roles](/admin/docs/getting-started/admin-roles). Safeguards: no self-demotion, at least one active admin, admins must have a verified email, and artists who own profiles can't be demoted until the profiles are reassigned.

@article supabase-security
title: Supabase security
summary: Database access model.
keywords: supabase, database security, rls, service role, anon key

- Only the **backend** talks to the database, using the **service-role key** (`SUPABASE_SERVICE_ROLE_KEY`), which must never be exposed to browsers, logs or documentation.
- **Row Level Security is enabled on every table with no policies**, and the `anon` and `authenticated` roles have no grants. The public anon key (used by the website only for Google/Facebook sign-in) therefore can't read or change any data.
- Browsers can never write payment status, subscription status, Plus access, prices or review status; those change only through the API's verified paths.
- Payment fulfilment runs inside a database function with a row lock, so it happens exactly once per payment.

@article api-security
title: API security
summary: Protections on every request.
keywords: api security, csrf, cors, rate limit, validation, headers, webhook signature

- **CSRF**: every state-changing request must send the `X-Requested-With: SHERE-MUSIC` header (the download endpoint requires it too). Browsers can't add it to cross-site requests.
- **CORS**: only origins in `FRONTEND_URL` / `CORS_ORIGINS` may call the API with credentials.
- **Security headers** (Helmet), a strict content-security policy on API responses.
- **Rate limits** on the API overall and tighter ones on sign-in, email, plays, downloads, uploads and payments.
- **Validation**: every input is checked with a schema; unknown fields in payment requests are rejected. Amounts, currencies and statuses are never accepted from the browser.
- **Paystack webhooks** are accepted only with a valid HMAC-SHA512 signature.
- The Admin Guide is served with `Cache-Control: private, no-store` and `X-Robots-Tag: noindex`, and articles containing anything that looks like a key or password are refused.

@article storage-security
title: Storage security
summary: How files are protected.
keywords: storage security, signed urls, private files, file validation

- Audio, videos and subtitles are in **private** buckets. Streaming uses short-lived signed links (audio: 4 hours so seeking works); downloads are streamed through the API after the Plus check, so no reusable link reaches the browser.
- Uploads are validated by their actual bytes (not the file name or browser-supplied type) and stored under random names. Size limits are enforced on the server.
- Video uploads use one-time signed upload links and are verified after upload.
- Public images live in the `media` bucket with unguessable names; the bucket can't be listed or written with public keys.

@article incident-response
title: Incident response
summary: What to do if something goes wrong.
keywords: incident, breach, compromised, leaked key, hacked, security incident, rotate keys

## A secret key was exposed

Rotate it immediately, then redeploy the backend:

| Leaked | Do |
| --- | --- |
| `JWT_SECRET` | Generate a new one. **All users are signed out.** |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → roll the service-role key (JWT secret). |
| `PAYSTACK_SECRET_KEY` | Paystack → Settings → API Keys → generate new keys. Check recent transactions and refunds. |
| `RESEND_API_KEY` | Resend → API Keys → delete and create a new key. |
| OAuth client secrets | Regenerate in Google Cloud / Meta, update Supabase → Authentication → Providers. |

## An admin account was compromised

1. From another admin account, **disable** it (signs it out everywhere) and remove its admin role.
2. Review recent changes: Settings, Monetization prices, Users (roles), published/deleted content.
3. Have the owner reset the password (and secure their Google/Facebook account), then re-enable.

## Suspicious payments

Compare **Payments** with the Paystack dashboard. Only Paystack-verified payments are marked Paid. Report fraud to Paystack support.

## Always

Write down what happened, when, what you changed and who was affected. Inform affected users where required by law.
