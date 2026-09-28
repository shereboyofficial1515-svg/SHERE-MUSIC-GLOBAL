---
title: Artist Management
description: Artist accounts, verification, paid submissions and moderation.
icon: mic
order: 4
---
@article artist-accounts
title: Artist accounts
summary: How accounts, roles and artist profiles relate.
keywords: artist accounts, artist role, owner, creator, studio access

- A **user account** signs in. An **artist profile** is what listeners see (name, photo, songs). One account can own up to 10 artist profiles.
- A listener becomes an artist by creating a profile in Studio (if **Allow artist sign-ups** is on in Settings → Studio), or when an admin sets them as a profile's **Owner account** in **Artists**, or gives them the role in **Users**.
- Creators only ever see and manage profiles they own. Ownership is always checked on the server.

To hand a profile to someone else, edit it in **Artists** and change **Owner account (email)**.

@article artist-verification
title: Artist verification
summary: Grant or remove the verified badge.
keywords: verify, verification, verified badge, blue tick, decline verification

Artists request verification in **Studio → Artists**, with a message. Requests appear in **Reviews** and in **Artists** (filter **Requested**), showing the message.

- **Verify** — grants the verified badge.
- **Decline** — refuses, with a note the artist can read.
- **Remove badge** — takes verification away from a verified profile.

Verify only after you've confirmed the profile really belongs to that artist (for example official social accounts, press, or direct contact). Paying a submission fee is never grounds for verification.

@article artist-submissions
title: Artist submissions
summary: Paid song submissions and where to find them.
keywords: submissions, paid submissions, submission fee, artist submissions page

When the submission fee is on (Settings → Monetization), artists pay {{submissionFee}} to submit a song. After Paystack confirms the payment, the song becomes **Pending review**. It is never published automatically.

**Artist Submissions** lists them with the song, artist, amount, payment status, review status and date. Filter by review status (Pending review, Approved, Rejected, Not submitted) and payment (Paid, Awaiting payment). "Awaiting payment" rows are checkouts the artist started but hasn't completed.

Paid songs also appear in the general **Reviews** queue. Deciding in either place updates both.

@article reviewing-submissions
title: Reviewing submissions
summary: Check a submitted song before it goes live.
keywords: review, review submission, play song, check metadata

Open **Artist Submissions** and select **Review** (or open the song from **Reviews**). The review window shows:

- the artwork and **Play song** (plays the uploaded audio)
- metadata: genre, album, release date, duration, audio format and size, description
- lyrics (if added)
- the artist profile, verification state and the account that submitted it
- the payment and its reference

![Reviewing an artist submission](admin-artist-review.png)

Follow the checklist in [Reviewing artist submissions](/admin/docs/procedures/reviewing-artist-submissions).

@article approving-music
title: Approving music
summary: Approve, or approve and publish.
keywords: approve, approve and publish, accept song

- **Approve & publish** — the song goes live immediately.
- **Approve** (Reviews: **Approve only**) — the song is accepted but stays hidden until the artist publishes it from Studio.

The artist gets a notification and an email. First-time publication also notifies the artist's followers.

@article rejecting-music
title: Rejecting music
summary: Send a song back with a reason.
keywords: reject, decline song, changes requested, rejection reason

Select **Reject** and write a clear reason — it's required, and the artist sees it on the song and in their email. Say what to change (for example "Artwork is low resolution" or "Please credit the sampled track").

The song becomes **Changes requested**. When the artist edits it, it returns to draft; resubmitting it needs a new submission fee.

@article artist-moderation
title: Artist moderation
summary: Dealing with problem artists or content.
keywords: moderation, ban artist, remove artist, impersonation, unpublish all

Options, from lightest to strongest:

1. **Reject** the submission with guidance.
2. **Unpublish** individual songs or videos (Music / Music Videos).
3. **Remove badge** if verification was obtained wrongly.
4. **Disable the owner's account** in Users — they are signed out everywhere and can't sign in.
5. **Delete** content, then the artist profile (a profile can only be deleted once it has no songs, albums or videos).

Record why you acted, and for copyright or legal issues follow [Handling copyright complaints](/admin/docs/procedures/handling-copyright-complaints).
