import { useEffect, useState } from 'react';

/**
 * Player color engine: derive a small palette from album artwork, once per
 * image. The image is downscaled to 24×24 on a canvas, so extraction costs a
 * few hundred pixel reads and never runs per frame. Results are cached in
 * memory and localStorage. If the image can't be read (e.g. no CORS headers),
 * the brand gradient is used instead.
 */
const memory = new Map();
const STORAGE_KEY = 'sm:artwork-colors';
const MAX_STORED = 200;

function loadStore() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}
function saveStore(key, value) {
  try {
    const all = loadStore();
    all[key] = value;
    const keys = Object.keys(all);
    if (keys.length > MAX_STORED) keys.slice(0, keys.length - MAX_STORED).forEach((k) => delete all[k]);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

const toHex = (r, g, b) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return { s, l };
}

function analyse(img) {
  const size = 24;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);
  let avg = [0, 0, 0];
  let best = null;
  let bestScore = -1;
  let count = 0;
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
    if (a < 200) continue;
    avg = [avg[0] + r, avg[1] + g, avg[2] + b];
    count += 1;
    const { s, l } = rgbToHsl(r, g, b);
    // Prefer saturated, mid-lightness pixels as the "vibrant" color.
    const score = s * (1 - Math.abs(l - 0.5) * 1.6);
    if (score > bestScore) {
      bestScore = score;
      best = [r, g, b];
    }
  }
  if (!count) return null;
  avg = avg.map((v) => v / count);
  const vibrant = best || avg;
  // Darken for use behind white text.
  const shade = (c, f) => c.map((v) => v * f);
  return { primary: toHex(...shade(vibrant, 0.72)), secondary: toHex(...shade(avg, 0.45)), base: toHex(...avg) };
}

export function extractArtworkColors(url) {
  if (!url) return Promise.resolve(null);
  if (memory.has(url)) return memory.get(url);
  const stored = loadStore()[url];
  if (stored) {
    const done = Promise.resolve(stored);
    memory.set(url, done);
    return done;
  }
  const promise = new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => {
      try {
        const colors = analyse(img);
        if (colors) saveStore(url, colors);
        resolve(colors);
      } catch {
        resolve(null); // tainted canvas (no CORS) — fall back to brand colors
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
  memory.set(url, promise);
  return promise;
}

export function useArtworkColors(url) {
  const [colors, setColors] = useState(null);
  useEffect(() => {
    let cancelled = false;
    setColors(null);
    extractArtworkColors(url).then((c) => !cancelled && setColors(c));
    return () => {
      cancelled = true;
    };
  }, [url]);
  return colors;
}
