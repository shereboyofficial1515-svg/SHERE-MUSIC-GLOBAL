---
title: Analytics
description: Music, downloads, users, artists, videos and revenue.
icon: bar-chart
order: 9
---
@article music-analytics
title: Music analytics
summary: Plays, top songs and trends.
keywords: music analytics, plays, top songs, trending, charts

**Analytics** shows, for **Last 7 days**, **Last 30 days**, **Last 90 days** or **Last 12 months**: plays and downloads per day, registrations per day, top songs by plays, top songs by downloads, top artists, and top searches (with the average number of results — searches with 0 results show what listeners can't find).

The dashboard shows the last 14 days and all-time totals. **Trending** on the site ranks songs by plays plus weighted downloads over the last 7 days.

Plays from listeners who turned off usage analytics are counted without their account.

![Analytics](admin-analytics.png)

@article download-analytics
title: Download analytics
summary: Every completed download.
keywords: download analytics, downloads log, download type

**Downloads** lists every completed device download, newest first, with song, user and **type**:

| Type | Meaning |
| --- | --- |
| Plus | A Plus member |
| Admin | An administrator |
| Artist (own song) | The song's own artist |
| Free (Plus off) | Downloaded while Plus was switched off |
| Before Plus | Downloads recorded before monetization existed |

A download is only counted after the whole file was sent — clicks and interrupted transfers don't count. **Reports → Download log** exports them as CSV.

@article user-analytics
title: User analytics
summary: Registrations and user totals.
keywords: user analytics, registrations, sign ups, new users

- Dashboard: total users and new users this week, artist accounts.
- Analytics: registrations per day.
- **Reports → Users**: CSV with each account's role, status, verification and last sign-in.

@article artist-analytics
title: Artist analytics
summary: Top artists and what artists see.
keywords: artist analytics, top artists, artist report

**Analytics → Top artists** ranks artists by plays and downloads in the period. **Reports → Artists** exports every artist with published song counts, albums and total plays.

Artists see their own numbers in **Studio → Overview / Analytics**, limited to the profiles they own.

@article video-analytics
title: Video analytics
summary: Video views.
keywords: video analytics, video views, top videos

The dashboard shows total music videos and total views. Each video's view count is on **Music Videos**. Artists see their top videos and daily video views in Studio.

@article revenue-analytics
title: Revenue analytics
summary: Money in, by period.
keywords: revenue analytics, income

See [Revenue analytics](/admin/docs/payments/revenue-analytics) under Monetization.

## CSV reports

**Reports** exports: Song catalog, Artists, Download log (by period), Daily activity (by period) and Users. Exports are protected against spreadsheet formula injection. Handle them as confidential — they contain personal data.
