import { supabase } from '../config/supabase.js';

/**
 * Video processing pipeline hook.
 *
 * Today uploads are played as-is (MP4/WebM/MOV straight from storage), so a
 * verified upload is marked `ready` immediately. To add transcoding, multiple
 * resolutions, compression or thumbnail generation later:
 *   1. set processing_status = 'processing' here and enqueue a job
 *      (e.g. a worker, Supabase Edge Function or external transcoder);
 *   2. when the job finishes, write `renditions` as
 *      [{ label: '720p', height: 720, path: 'videos/<id>/720p.mp4' }, …]
 *      and set processing_status = 'ready' (or 'failed');
 * The player already offers a quality menu when renditions exist, and public
 * endpoints only list videos whose processing_status is 'ready'.
 */
export async function processUploadedVideo(videoId) {
  const { error } = await supabase.from('music_videos').update({ processing_status: 'ready' }).eq('id', videoId);
  if (error) console.error('[video] could not mark video ready:', error.message);
}
