---
title: Lyrics Management
description: Add, edit, sync and review lyrics, and configure an external provider.
icon: lyrics
order: 3
---
@article adding-lyrics
title: Adding lyrics
summary: Add lyrics to any song.
keywords: add lyrics, lyrics editor, new lyrics

1. Open **Music**, find the song and select the **Lyrics** icon (or **Lyrics** in the song editor).
2. Type or paste the lyrics in **Lines**, or paste plain text / LRC in **Import / export**.
3. Choose the language. Add a **copyright notice** and **attribution** where required.
4. Select **Save & publish** to make them visible, or **Save** to keep a draft.

A song can have one set of lyrics per language (**New language** adds another).

![Lyrics management](admin-lyrics.png)

@article editing-lyrics
title: Editing lyrics
summary: Change or remove existing lyrics.
keywords: edit lyrics, fix lyrics, delete lyrics, lyrics versions

**Lyrics** (sidebar) lists every lyrics version on the platform with its song, language, whether it's synced, status and visibility. Filter by status or search the text. Open one to edit it in the lyrics editor.

- **Hide from listeners** removes lyrics from the site without deleting them — useful while you check a complaint. **Show to listeners** brings them back.
- **Delete this version** removes that language version permanently.

@article synchronized-lyrics
title: Synchronized lyrics
summary: Timing each line to the music.
keywords: sync lyrics, synchronized, lrc, timestamps, timing

Synced lyrics store a start time for every line, so the site can highlight and scroll them while the song plays.

In the editor's **Sync** tab, play the song and press [[Enter]] as each line starts ([[Space]] plays/pauses; the keys can be changed). **Preview** shows the result. **Import / export** accepts and produces LRC files (`[mm:ss.xx]line`).

Lyrics without timings are shown as plain text.

@article external-lyrics-provider
title: External lyrics provider
summary: Show licensed lyrics from a third-party service.
keywords: lyrics provider, external lyrics, lyrics api, licensed lyrics, provider settings

In **Settings → Lyrics**:

- **Lyrics source** — **Manual only**, **External provider only**, or **Manual + external (manual first)**.
- **Provider name**, **API URL** and **API key**. The URL may contain `{artist}`, `{title}`, `{album}` and `{duration}`. The response must be JSON with `syncedLyrics` / `plainLyrics` (or `lyrics`).
- **Attribution** — shown under provider lyrics.

The API key is sent only from the server as a Bearer token and is never shown again after saving. If the server sets `LYRICS_API_URL` / `LYRICS_API_KEY` in its environment, those override these fields.

Provider lyrics are fetched live and never stored. In the lyrics editor, **Import from lyrics provider** copies them into a draft you can edit and save as your own.

> **Important:** Only use providers whose terms allow displaying their lyrics. Never configure scraped sources.

The **Show lyrics to listeners** switch hides all lyrics site-wide (nothing is deleted).

@article lyrics-review
title: Lyrics review
summary: Approve or reject lyrics submitted by artists.
keywords: review lyrics, approve lyrics, reject lyrics, pending lyrics

Artists' lyrics arrive as **Pending** in **Reviews** (and in **Lyrics** filtered by Pending). Open them in the lyrics editor, check the text and timing, then select **Approve & publish**, or **Reject** with a reason. The artist is notified either way.

Check:

- the lyrics match the song and are complete
- timings line up (use **Preview**)
- the copyright notice and attribution are present when the words aren't the artist's own

@article copyright-attribution
title: Copyright / attribution
summary: What to record with lyrics.
keywords: copyright, attribution, license, credits, songwriter

Each lyrics version has three optional fields shown under the lyrics: **copyright notice**, **attribution** and **license**. Use them to credit songwriters and publishers.

If a rights holder complains, hide the lyrics first, then follow [Handling copyright complaints](/admin/docs/procedures/handling-copyright-complaints).
