---
title: Getting Started
description: The admin dashboard, roles, security basics and navigation.
icon: compass
order: 1
---
@article admin-dashboard-overview
title: Admin dashboard overview
summary: What the dashboard shows and where everything lives.
keywords: dashboard, overview, home, admin, start

The admin dashboard is at `/admin`. It is only available to accounts with the **admin** role. The server re-reads the role from the database on every request, so removing the role takes effect immediately.

![Admin dashboard](admin-dashboard.png)

## The dashboard page

- **Pending banner** — how many submissions and verification requests are waiting in **Reviews**.
- **Totals** — songs (and how many are published), users (new this week), plays and downloads (with today's numbers), artists, albums, music videos (with views) and artist accounts.
- **Last 14 days** — plays and downloads per day. **Full analytics** opens Analytics.
- **Recently uploaded**, **Most downloaded** and **Most played** songs.

**Upload music** in the header adds a song directly.

## Where things are

| Sidebar group | Pages |
| --- | --- |
| (top) | Dashboard, Reviews |
| Music | Music, Upload Music, Lyrics, Artists, Albums, Categories, Playlists |
| Video | Music Videos, Subtitles |
| Monetization | Revenue, Payments, Plus Members, Artist Submissions, Plus Offers |
| Platform | Users, Downloads, Analytics, Reports, Settings, Admin Guide |

@article admin-roles
title: Admin roles
summary: Listener, artist and admin — what each can do.
keywords: roles, permissions, admin role, artist role, user role, promote, moderator, super admin

Every account has one role:

| Role | Can |
| --- | --- |
| `user` (listener) | Listen, playlists, favorites, follows, settings, Plus |
| `artist` | Everything a listener can, plus SHERE MUSIC Studio for the artist profiles they own |
| `admin` | Everything, including this dashboard and the Admin Guide. Admins can also use Studio for artist profiles they own |

## Changing a role

Open **Users**, select the user, then **Make administrator**, **Make artist** (**Change to artist** for an admin) or **Make listener**. The server enforces:

- only users with a **verified email** can become administrators
- you can't change your own role or status
- there must always be at least one active administrator
- a user who still owns artist profiles can't become a listener — reassign the profiles first

Owning an artist profile automatically makes a listener an artist.

> **Note:** There is no separate moderator or super-admin role yet. Every admin has full access, so give the role only to people who need it.

@article administrator-security
title: Administrator security
summary: How to keep admin accounts safe.
keywords: admin security, password, account safety, sign out, phishing, two factor

Admin accounts can change prices, publish or remove content and disable users. Protect them:

- Use a long, unique password. Changing it (Settings → Security) signs out every other device.
- If you sign in with Google or Facebook, turn on two-step verification for that account. SHERE MUSIC itself does not have two-factor sign-in yet.
- Use **Settings → Security → Sign out of all other devices** if a device is lost or you used a shared computer.
- Never share admin credentials. Give each person their own admin account so actions can be told apart.
- Remove the admin role as soon as someone no longer needs it.
- Never paste secrets (API keys, the Paystack secret key, database passwords) into chats, tickets, screenshots or documentation.

Disabling an account (**Users → Disable account**) signs it out everywhere immediately.

@article navigation
title: Navigation
summary: Moving around the admin area, Studio and the Admin Guide.
keywords: navigation, menu, sidebar, mobile, studio, back to site

- The **sidebar** lists every admin page. On phones and tablets it opens from the menu button.
- **Reviews** shows a count when submissions or verification requests are waiting.
- **View site** returns to the public site. Your account menu there links back to the **Admin dashboard**.
- **SHERE MUSIC STUDIO** is the creators' area. Admins can use it for artist profiles they own; manage everyone else's content from this dashboard.
- The **Admin Guide** (this guide) is at `/admin/docs`. It is not linked from any public page, and the server only serves it to admins.

The search box at the top searches only the Admin Guide. The public Help Center (`/help`) has its own, separate search that never includes this guide.
