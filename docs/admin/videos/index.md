---
title: SHERE MUSIC VIDEO
description: Upload, edit, publish and moderate music videos, thumbnails and subtitles.
icon: film
order: 5
---
@article uploading-videos
title: Uploading videos
summary: Add a music video from the admin area.
keywords: upload video, new video, mp4, video file, large upload

1. **Music Videos → New video**.
2. Enter the title and artist; optionally the linked song, genre, release date, description and thumbnail. Save the details.
3. **Upload video** and choose the file: MP4, M4V, WebM or MOV, up to {{maxVideoMb}} MB. The progress bar shows the upload; keep the tab open.
4. Add subtitles, then publish.

The file goes straight from the browser to private storage using a one-time upload link, so it never passes through the API server. The server then checks the file's real type and size before accepting it.

![Music video management](admin-videos.png)

> **Note:** Your storage provider also limits file size (50 MB per file on the Supabase Free plan). Keep the video limit at or below it — see [Storage](/admin/docs/operations/storage).

@article editing-videos
title: Editing videos
summary: Change details or replace the file.
keywords: edit video, replace video, change thumbnail

Open the video from **Music Videos**. You can change every detail, **Replace video**, change or remove the thumbnail, manage subtitles, and delete the video (which removes its files).

@article publishing-videos
title: Publishing videos
summary: Statuses, review and featuring.
keywords: publish video, feature video, review video, video status

Videos use the same statuses as songs: Draft, Pending review, Approved, Published, Rejected. Artists' videos arrive in **Reviews**. As an admin you can set the status directly in the editor.

Only published videos whose file is ready are shown to listeners. The **star** features a video on the video home page.

@article thumbnails
title: Thumbnails
summary: Video cover images.
keywords: thumbnail, poster, cover image, video image

Upload a JPG, PNG or WebP (16:9 works best, up to {{maxImageMb}} MB) in the video editor. Thumbnails are stored with other public images; video files and subtitles stay private.

@article subtitles
title: Subtitles
summary: Add caption tracks in several languages.
keywords: subtitles, captions, srt, vtt, webvtt, languages, default track

In the video editor's subtitles panel, choose a language, optionally mark it as the default, and upload a `.srt` or `.vtt` file. SRT files are converted to WebVTT automatically. You can preview and delete tracks.

**Subtitles** (sidebar) lists every video with its caption tracks.

The languages offered are set in **Settings → Music video → Subtitle languages** (codes like `en`, `fr`, `yo`, `pcm`).

@article video-categories
title: Video categories
summary: Genres for videos.
keywords: video categories, video genres

Videos use the same **Categories** (genres) as songs. The video home shows categories that have published videos, and the browse page filters by them.

@article video-moderation
title: Video moderation
summary: Taking videos down.
keywords: moderate video, remove video, unpublish video, turn off videos

- **Unpublish** a video by changing its status to Draft in the editor.
- **Delete** removes the video, its file and its subtitles permanently.
- **Settings → Music video → SHERE MUSIC VIDEO** turns the whole video section off for listeners (nothing is deleted).
