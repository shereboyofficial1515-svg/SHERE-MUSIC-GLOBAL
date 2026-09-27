import { looksLikeLrc, parseLrc, parsePlain } from '../../../utils/lrc.js';

/**
 * Generic HTTP lyrics provider.
 *
 * The admin configures a URL, optionally with {artist}, {title}, {album} and
 * {duration} placeholders. Without placeholders, `artist` and `title` query
 * parameters are appended. The API key (if any) is sent as a Bearer token and
 * never leaves the server.
 *
 * Accepted JSON response shapes (first match wins):
 *   { syncedLyrics: "[00:12.00]…", plainLyrics: "…" }
 *   { lyrics: "…", synced: true|false }
 * plus optional: language, attribution, copyright, license.
 *
 * Only configure providers whose terms allow displaying their lyrics.
 */
export function createHttpProvider({ url, apiKey, name, attribution, timeoutMs = 6000 }) {
  return {
    name,
    async fetchLyrics({ artist, title, album, duration }) {
      const values = { artist, title, album: album || '', duration: duration ? String(Math.round(duration)) : '' };
      let target = url;
      if (/\{(artist|title|album|duration)\}/.test(target)) {
        target = target.replace(/\{(artist|title|album|duration)\}/g, (_, key) => encodeURIComponent(values[key]));
      } else {
        const u = new URL(target);
        u.searchParams.set('artist', artist);
        u.searchParams.set('title', title);
        target = u.toString();
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let res;
      try {
        res = await fetch(target, {
          headers: { Accept: 'application/json', 'User-Agent': 'SHERE-MUSIC/2.0', ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`Lyrics provider responded with ${res.status}`);
      const body = await res.json().catch(() => null);
      if (!body || typeof body !== 'object') return null;

      const synced = typeof body.syncedLyrics === 'string' && body.syncedLyrics.trim() ? body.syncedLyrics : body.synced && looksLikeLrc(body.lyrics) ? body.lyrics : null;
      const plain = body.plainLyrics || (!synced ? body.lyrics : null) || null;
      if (!synced && !plain) return null;

      const lines = synced ? parseLrc(synced) : parsePlain(plain);
      if (!lines.length) return null;
      return {
        isSynced: Boolean(synced),
        lines,
        language: typeof body.language === 'string' ? body.language.slice(0, 10) : null,
        attribution: body.attribution || attribution || `Lyrics provided by ${name}`,
        copyrightNotice: body.copyright || null,
        license: body.license || null,
      };
    },
  };
}
