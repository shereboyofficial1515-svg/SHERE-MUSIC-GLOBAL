---
title: Music Management
description: Upload, edit, publish and remove songs, artwork, artists, albums and categories.
icon: music
order: 2
---
@article uploading-music
title: Uploading music
summary: Add a song directly as an admin.
keywords: upload, add song, new song, audio, admin upload

1. Go to **Upload Music** (or **Music → Upload music**).
2. Enter the **Song title** and choose the **Artist** (create one on the spot with **New artist**).
3. Optionally choose an album, genre, release date, track number and description, and paste lyrics (plain text or LRC).
4. Choose the audio file (MP3, WAV, M4A or AAC, up to {{maxAudioMb}} MB) and artwork (JPG, PNG or WebP, up to {{maxImageMb}} MB).
5. Under **Status & visibility**, pick a status (Draft by default) and optionally **Spotlight**.
6. Select **Upload song**.

![Uploading music](admin-music-upload.png)

Files are checked by their actual content, not their name. If saving the song fails after upload, the uploaded files are removed automatically.

> **Note:** Admin uploads don't pay the artist submission fee and don't go through Reviews.

@article editing-music
title: Editing music
summary: Change details, replace audio or artwork.
keywords: edit song, change title, replace audio, update song

Open **Music**, then select a song's title or the edit icon. You can change every field, replace the audio file, and replace or remove the artwork. **Preview** plays the stored audio, including for drafts. **Lyrics** opens the lyrics editor for the song.

Use the filters on **Music** to find songs by text (title, artist, album, genre), status, genre or artist, and sort by newest, oldest, title, plays, downloads or release date.

@article publishing-music
title: Publishing music
summary: Make a song visible to listeners.
keywords: publish, go live, make public, release, spotlight, feature

A song is visible to listeners only when its status is **Published**. Either:

- select **Publish** in the Music list, or
- set **Status** to **Published** in the song editor and save.

The first time a song is published, followers of the artist get a notification (and an email if they allow it).

## Spotlight

The star icon (or **Spotlight** in the editor) features a song in the home page Spotlight. The number of Spotlight songs is set in **Settings → General**.

## Statuses

| Status | Meaning |
| --- | --- |
| Draft | Private |
| Pending review | Submitted by an artist, waiting in Reviews |
| Approved | Accepted; the artist can publish it |
| Published | Live |
| Rejected | Changes requested; the artist sees the reason |

@article unpublishing-music
title: Unpublishing music
summary: Take a song offline without deleting it.
keywords: unpublish, hide song, take down, offline

Select **Unpublish** in the Music list (or set the status to Draft). The song disappears from the site, search and playlists for listeners, and can no longer be streamed or downloaded. Its files, play counts and history are kept, so you can publish it again later.

Use this first when you need to investigate a complaint. See [Handling copyright complaints](/admin/docs/procedures/handling-copyright-complaints).

@article deleting-music
title: Deleting music
summary: Permanently remove a song and its files.
keywords: delete song, remove song, permanently delete

Select the trash icon in the Music list and confirm. This permanently deletes the song, its audio and artwork files, and its play and download history. It can't be undone.

Paid artist submissions for the song keep their payment record, with the song title saved on the submission.

> **Important:** Prefer **Unpublish** unless the content must be removed permanently (for example a confirmed copyright infringement).

@article artwork-management
title: Artwork management
summary: Song, album and artist images.
keywords: artwork, cover, image, album art, artist image, thumbnail

- **Song artwork** — set in the song editor. A song without its own artwork shows its album's artwork, or else the artist image.
- **Album artwork** — set in **Albums**.
- **Artist image and header cover** — set in **Artists**.

Images must be JPG, PNG or WebP up to {{maxImageMb}} MB. Square images look best for songs and albums. Replacing or removing an image deletes the old file from storage.

@article artists
title: Artists
summary: Create, edit and delete artist profiles; set the owner account.
keywords: artists, artist profile, owner, create artist, delete artist

**Artists** lists every artist profile with its verification status and owner account.

- **New artist** / edit icon — name, biography, location, **Owner account (email)**, artist image and header cover.
- **Owner account** links the profile to a user, who then manages it in Studio. Setting an owner makes a listener an artist. Leave it empty for profiles the team manages.
- **Delete** only works when the artist has no songs, albums or videos — remove or reassign those first.

Artist names must be unique. Verification is covered in [Artist verification](/admin/docs/artists/artist-verification).

@article albums
title: Albums
summary: Create albums and add songs to them.
keywords: albums, create album, add songs to album, tracklist

In **Albums** you can create an album (title, artist, release date, description, artwork), add songs by the same artist, remove songs, and delete albums.

- An album's songs must belong to the album's artist.
- An album can only move to another artist when it has no songs.
- Deleting an album keeps its songs (they become singles).

@article categories
title: Categories
summary: Genres shown across the site.
keywords: categories, genres, genre, create genre, delete genre

**Categories** manages the genres used for browsing, filters and recommendations. Create, rename or delete them; changes appear immediately.

Deleting a category doesn't delete songs — they simply lose that genre.
