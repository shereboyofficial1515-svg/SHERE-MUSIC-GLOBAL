/**
 * Detect file types from their leading bytes ("magic numbers").
 * The client-supplied MIME type and filename are never trusted on their own.
 */

const ascii = (buf, start, end) => buf.subarray(start, end).toString('latin1');

export const AUDIO_TYPES = {
  mp3: { mime: 'audio/mpeg', ext: 'mp3' },
  wav: { mime: 'audio/wav', ext: 'wav' },
  m4a: { mime: 'audio/mp4', ext: 'm4a' },
  aac: { mime: 'audio/aac', ext: 'aac' },
};

export const IMAGE_TYPES = {
  jpeg: { mime: 'image/jpeg', ext: 'jpg' },
  png: { mime: 'image/png', ext: 'png' },
  webp: { mime: 'image/webp', ext: 'webp' },
  ico: { mime: 'image/x-icon', ext: 'ico' },
};

const AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'm4a', 'aac', 'mp4']);
const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'ico']);

const extensionOf = (name = '') => (name.includes('.') ? name.split('.').pop().toLowerCase() : '');

export function detectAudio(buffer) {
  if (!buffer || buffer.length < 12) return null;
  if (ascii(buffer, 0, 3) === 'ID3') return AUDIO_TYPES.mp3;
  if (ascii(buffer, 0, 4) === 'RIFF' && ascii(buffer, 8, 12) === 'WAVE') return AUDIO_TYPES.wav;
  if (ascii(buffer, 4, 8) === 'ftyp') return AUDIO_TYPES.m4a;
  if (buffer[0] === 0xff && (buffer[1] & 0xf6) === 0xf0) return AUDIO_TYPES.aac; // ADTS header
  if (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) return AUDIO_TYPES.mp3; // MPEG frame sync
  return null;
}

export function detectImage(buffer, { allowIco = false } = {}) {
  if (!buffer || buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return IMAGE_TYPES.jpeg;
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return IMAGE_TYPES.png;
  if (ascii(buffer, 0, 4) === 'RIFF' && ascii(buffer, 8, 12) === 'WEBP') return IMAGE_TYPES.webp;
  if (allowIco && buffer[0] === 0 && buffer[1] === 0 && buffer[2] === 1 && buffer[3] === 0) return IMAGE_TYPES.ico;
  return null;
}

export function hasAudioExtension(name) {
  return AUDIO_EXTENSIONS.has(extensionOf(name));
}

export function hasImageExtension(name) {
  return IMAGE_EXTENSIONS.has(extensionOf(name));
}

// ─── Video ─────────────────────────────────────────────────────────────────
export const VIDEO_TYPES = {
  mp4: { mime: 'video/mp4', ext: 'mp4' },
  webm: { mime: 'video/webm', ext: 'webm' },
  mov: { mime: 'video/quicktime', ext: 'mov' },
};
const VIDEO_EXT_TYPES = { mp4: VIDEO_TYPES.mp4, m4v: VIDEO_TYPES.mp4, webm: VIDEO_TYPES.webm, mov: VIDEO_TYPES.mov };

/** Expected video type from the filename, used before the bytes are available (direct uploads). */
export function videoTypeFromName(name) {
  return VIDEO_EXT_TYPES[extensionOf(name)] || null;
}

export function detectVideo(buffer) {
  if (!buffer || buffer.length < 12) return null;
  if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) return VIDEO_TYPES.webm;
  if (ascii(buffer, 4, 8) === 'ftyp') return ascii(buffer, 8, 10) === 'qt' ? VIDEO_TYPES.mov : VIDEO_TYPES.mp4;
  return null;
}

// ─── Subtitles ─────────────────────────────────────────────────────────────
const SRT_TIME = /(\d{2}:\d{2}:\d{2}),(\d{3})/g;

/**
 * Normalise an uploaded subtitle file to WebVTT. Accepts WebVTT as-is and
 * converts SubRip (.srt). Returns null when the text is neither.
 */
export function toWebVtt(buffer, name) {
  let text = buffer.toString('utf8').replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  if (text.includes('\0')) return null; // binary file
  if (/^WEBVTT( |\t|\n|$)/.test(text)) return text;
  if (extensionOf(name) === 'srt' && /\d{2}:\d{2}:\d{2},\d{3}\s*-->\s*\d{2}:\d{2}:\d{2},\d{3}/.test(text)) {
    text = text.replace(SRT_TIME, '$1.$2');
    return `WEBVTT\n\n${text.trim()}\n`;
  }
  return null;
}
