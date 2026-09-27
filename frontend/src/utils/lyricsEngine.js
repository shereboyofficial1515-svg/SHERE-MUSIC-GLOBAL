/**
 * Lyric synchronization engine.
 *
 * Input:  playback time (ms).  Output: index of the line being sung.
 *
 * Only timestamped lines take part in timing; untimed lines inside synced
 * lyrics (spacers, stanza breaks) are never "current". Lookups are a binary
 * search, and the previous result is used as a hint so normal playback is
 * O(1) per animation frame. Seeking, pausing, resuming and playback-rate
 * changes need no special handling: the engine is a pure function of time.
 */
export function createLyricIndexer(lines) {
  const timed = [];
  lines.forEach((line, i) => {
    if (Number.isFinite(line.startTimeMs)) timed.push({ i, t: line.startTimeMs });
  });
  timed.sort((a, b) => a.t - b.t);
  let hint = -1;

  function search(ms) {
    let lo = 0;
    let hi = timed.length - 1;
    let found = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (timed[mid].t <= ms) {
        found = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    return found;
  }

  return {
    hasTiming: timed.length > 0,
    /** Line index for `ms`, or -1 before the first timed line. */
    indexAt(ms) {
      if (!timed.length) return -1;
      // Fast path: still inside the same line, or moved to the next one.
      if (hint >= 0 && timed[hint].t <= ms) {
        const next = timed[hint + 1];
        if (!next || next.t > ms) return timed[hint].i;
        const after = timed[hint + 2];
        if (!after || after.t > ms) {
          hint += 1;
          return timed[hint].i;
        }
      }
      hint = search(ms);
      return hint >= 0 ? timed[hint].i : -1;
    },
    /** Start time of a line, if it has one (used to seek when a line is clicked). */
    timeOf(lineIndex) {
      const t = lines[lineIndex]?.startTimeMs;
      return Number.isFinite(t) ? t : null;
    },
  };
}

// ─── LRC import/export for the editor (mirrors the backend parser) ────────
const TIME_TAG = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;
const META_TAG = /^\[(ar|ti|al|au|by|re|ve|length|offset|#):?.*\]$/i;
const toMs = (m, s, f = '0') => (Number(m) * 60 + Number(s)) * 1000 + (f.length === 1 ? Number(f) * 100 : f.length === 2 ? Number(f) * 10 : Number(f));

export const looksLikeLrc = (text) => (String(text || '').match(/^\s*\[\d{1,3}:\d{1,2}(?:[.:]\d{1,3})?\]/gm) || []).length >= 2;

export function parseLrc(text) {
  const out = [];
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || META_TAG.test(line)) continue;
    const times = [...line.matchAll(TIME_TAG)];
    if (!times.length) continue;
    const body = line.replace(TIME_TAG, '').trim();
    for (const t of times) out.push({ text: body, startTimeMs: toMs(t[1], t[2], t[3]) });
  }
  return out.sort((a, b) => a.startTimeMs - b.startTimeMs);
}

export function parsePlainLyrics(text) {
  return String(text || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((t) => ({ text: t.trimEnd(), startTimeMs: null }));
}

export function formatTimestamp(ms) {
  if (!Number.isFinite(ms)) return '--:--.--';
  const total = Math.max(0, Math.round(ms));
  const m = Math.floor(total / 60000);
  const s = Math.floor((total % 60000) / 1000);
  const cs = Math.floor((total % 1000) / 10);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

/** Parse "mm:ss.xx" (or "m:ss") typed by a creator. Returns ms or null. */
export function parseTimestamp(value) {
  const match = /^\s*(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\s*$/.exec(String(value || ''));
  if (!match) return null;
  return toMs(match[1], match[2], match[3]);
}

export function toLrc(lines) {
  return lines
    .filter((l) => Number.isFinite(l.startTimeMs))
    .map((l) => `[${formatTimestamp(l.startTimeMs)}]${l.text}`)
    .join('\n');
}
