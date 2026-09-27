/**
 * LRC ⇄ structured lyric lines.
 * Lines are stored as { text, startTimeMs, endTimeMs } rows; LRC is only an
 * import/export format, so the app never depends on its text layout.
 */

const TIME_TAG = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;
const META_TAG = /^\[(ar|ti|al|au|by|re|ve|length|offset|#):?.*\]$/i;

function tagToMs(min, sec, frac = '0') {
  const ms = frac.length === 1 ? Number(frac) * 100 : frac.length === 2 ? Number(frac) * 10 : Number(frac);
  return (Number(min) * 60 + Number(sec)) * 1000 + ms;
}

/** Parse LRC text. Lines with several time tags are duplicated at each time. Returns lines sorted by time. */
export function parseLrc(input) {
  const lines = [];
  let offset = 0;
  for (const raw of String(input ?? '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const offsetMatch = /^\[offset:\s*([+-]?\d+)\]$/i.exec(line);
    if (offsetMatch) {
      offset = Number(offsetMatch[1]);
      continue;
    }
    if (META_TAG.test(line)) continue;
    const times = [...line.matchAll(TIME_TAG)];
    if (!times.length) continue;
    const text = line.replace(TIME_TAG, '').replace(/<\d{1,3}:\d{1,2}(?:[.:]\d{1,3})?>/g, '').trim();
    for (const t of times) lines.push({ text, startTimeMs: Math.max(0, tagToMs(t[1], t[2], t[3]) + offset) });
  }
  lines.sort((a, b) => a.startTimeMs - b.startTimeMs);
  return withEndTimes(lines);
}

/** Whether text looks like LRC (at least two time-tagged lines). */
export const looksLikeLrc = (text) => (String(text ?? '').match(/^\s*\[\d{1,3}:\d{1,2}(?:[.:]\d{1,3})?\]/gm) || []).length >= 2;

/** Plain text → unsynced lines (blank lines kept as stanza breaks). */
export function parsePlain(text) {
  return String(text ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((t) => ({ text: t.trimEnd(), startTimeMs: null, endTimeMs: null }))
    .filter((l, i, all) => !(l.text === '' && (i === 0 || all[i - 1].text === ''))) // collapse repeated blanks
    .slice(0, 2000);
}

/** Fill endTimeMs from the next line's start where missing. */
export function withEndTimes(lines) {
  return lines.map((line, i) => {
    const next = lines.slice(i + 1).find((l) => Number.isFinite(l.startTimeMs));
    return {
      ...line,
      endTimeMs: Number.isFinite(line.endTimeMs) ? line.endTimeMs : Number.isFinite(line.startTimeMs) && next ? next.startTimeMs : null,
    };
  });
}

const pad = (n, w = 2) => String(n).padStart(w, '0');

export function formatLrcTime(ms) {
  const total = Math.max(0, Math.round(ms));
  const min = Math.floor(total / 60000);
  const sec = Math.floor((total % 60000) / 1000);
  const cs = Math.floor((total % 1000) / 10);
  return `${pad(min)}:${pad(sec)}.${pad(cs)}`;
}

/** Structured lines → LRC text (untimed lines are skipped). */
export function toLrc(lines, meta = {}) {
  const head = [meta.title && `[ti:${meta.title}]`, meta.artist && `[ar:${meta.artist}]`].filter(Boolean);
  const body = lines.filter((l) => Number.isFinite(l.startTimeMs)).map((l) => `[${formatLrcTime(l.startTimeMs)}]${l.text}`);
  return [...head, ...body].join('\n');
}

export const linesToPlainText = (lines) => lines.map((l) => l.text).join('\n').trim();
