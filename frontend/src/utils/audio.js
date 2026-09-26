/** Read an audio file's duration in the browser (used by the admin upload form). */
export function readAudioDuration(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    audio.preload = 'metadata';
    const done = (value) => {
      URL.revokeObjectURL(url);
      resolve(value);
    };
    audio.onloadedmetadata = () => done(Number.isFinite(audio.duration) ? Math.round(audio.duration) : null);
    audio.onerror = () => done(null);
    audio.src = url;
  });
}

export const AUDIO_ACCEPT = '.mp3,.wav,.m4a,.aac,audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/x-m4a,audio/aac';
export const IMAGE_ACCEPT = '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp';

const AUDIO_EXT = ['mp3', 'wav', 'm4a', 'aac'];
const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'webp'];
const ext = (name) => name.split('.').pop().toLowerCase();

/** Client-side pre-check for fast feedback; the server re-validates the actual bytes. */
export function checkFile(file, kind, maxMb) {
  if (!file) return null;
  const allowed = kind === 'audio' ? AUDIO_EXT : IMAGE_EXT;
  if (!allowed.includes(ext(file.name))) {
    return kind === 'audio' ? 'Choose an MP3, WAV, M4A or AAC file.' : 'Choose a JPG, PNG or WebP image.';
  }
  if (maxMb && file.size > maxMb * 1024 * 1024) return `File is larger than the ${maxMb} MB limit.`;
  return null;
}
