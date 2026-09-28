---
title: Administration Procedures
description: Step-by-step procedures for everyday administration.
icon: check-circle
order: 12
---
@article reviewing-artist-submissions
title: Reviewing artist submissions
summary: The checklist for every submitted song.
keywords: review procedure, submission checklist, approve, reject, quality

Aim to review submissions within 2–3 working days. Open **Artist Submissions** (filter **Pending review**) and select **Review**.

1. **Payment** — when the submission fee is on, the submission shows **Paid** with a reference. (A song can only reach Pending review after the payment is verified.)
2. **Listen** — play the song. Check it plays through, isn't silence/noise, and the audio quality is acceptable.
3. **Metadata** — title, artist, genre and release date are correct; no misleading names.
4. **Artwork** — the artist owns it; no offensive or low-resolution images.
5. **Rights** — the artist appears to own the music; covers and samples are credited.
6. **Lyrics** — if present, they match the song and credit writers.
7. **Guidelines** — nothing that breaks the Community Guidelines.

Then:

- **Approve & publish** — everything is fine.
- **Approve** — fine, but the artist should choose when to publish.
- **Reject** — with a specific reason the artist can act on.

The decision is emailed to the artist once.

@article handling-payment-issues
title: Handling payment issues
summary: "I paid but…" — how to investigate.
keywords: payment issue, paid but no plus, refund, dispute, missing payment, double charge

Ask the member for their **payment reference** (starts with `SM-`, shown on the return page, receipt email and payment history).

1. Search **Payments** for the reference.
2. **Paid** — they should have Plus (check **Plus Members**) or the song should be pending review (check **Artist Submissions**). Ask them to reload and check they're signed into the right account.
3. **Pending** — the customer may not have finished paying. Ask them to open the return link again or check their bank statement. If Paystack shows it as successful, the next webhook or verify call completes it automatically.
4. **Failed / Not completed** — no charge was made by that attempt. They can try again; retries never create duplicates.
5. Compare with the **Paystack dashboard**, which is the source of truth for money movements.

**Refunds** are issued in the Paystack dashboard. After refunding Plus, the member keeps access until the paid period ends unless you also cancel their subscription in Paystack.

> **Important:** Never ask for card numbers, PINs or one-time passcodes. There is no manual "mark as paid" — if Paystack shows a successful payment that SHERE MUSIC doesn't, report it to a developer instead of working around it.

@article handling-copyright-complaints
title: Handling copyright complaints
summary: What to do when someone reports infringement.
keywords: copyright complaint, takedown, dmca, infringement report, counter notice

1. **Check the report is complete**: who they are, what work they own, links to the content, a good-faith statement and signature (see the public Copyright Policy).
2. **Act quickly**: **Unpublish** the song/video, or **Hide from listeners** for lyrics. Don't delete yet.
3. **Notify the uploader** (their account email is on the submission or the artist's owner), explaining what was reported and inviting a counter-notice with proof of rights.
4. **Decide**: restore if the uploader proves rights; delete if infringement is confirmed.
5. **Repeat offenders**: disable the account.
6. **Record** the dates, the parties, the content and the decision.

@article managing-users
title: Managing users
summary: Everyday account requests.
keywords: user requests, change role, make artist, locked out, delete account request

- **Can't sign in** — check the account isn't disabled and the email is verified (Users). Point them to Forgot password; admins can't set passwords.
- **Wants to become an artist** — they can create a profile in Studio. If sign-ups are closed, use **Make artist** and set them as the owner of their profile in Artists.
- **Transfer an artist profile** — edit the profile in Artists and change the owner email.
- **Delete my account** — they can do it in Settings → Account. Confirm identity by email before acting for them.
- **Make someone an admin** — only with the owner's approval, only verified accounts.

@article moderating-content
title: Moderating content
summary: Reports about songs, videos, lyrics, playlists or profiles.
keywords: moderation, report content, offensive, remove content, playlist moderation

1. Open the reported item and check it against the Community Guidelines.
2. Take the lightest effective action: unpublish (songs/videos), hide (lyrics), make private or delete (playlists), remove verification (profiles).
3. For serious or repeated abuse, disable the account.
4. Tell the owner what happened and why, where appropriate.
5. Keep a short record.

@article platform-maintenance
title: Platform maintenance
summary: Routine checks and planned maintenance.
keywords: maintenance, routine, weekly checks, updates, downtime

## Weekly

- Clear **Reviews** and **Artist Submissions**.
- Check **Payments** for stuck **Pending** items older than a day and compare with Paystack.
- Look at **Analytics → Top searches** with 0 results — they show what listeners can't find.

## Monthly

- Review who has the **admin** role.
- Check storage usage in Supabase and your plan's limits.
- Confirm backups exist and can be restored.
- Update the Help Center and this guide when features change (bump the version in `docs/*/guide.json`).

## Planned downtime

1. Turn on **Maintenance mode** with a clear message.
2. Deploy / migrate (run new `migrations/*.sql` first, then the backend, then the frontend).
3. Test sign-in, playback, a download and the Plus page.
4. Turn maintenance mode off.
