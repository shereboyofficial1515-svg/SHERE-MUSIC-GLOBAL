import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../ui/Icon.jsx';
import Dialog, { ConfirmDialog } from '../ui/Dialog.jsx';
import { Alert, ErrorState, PageLoader, Spinner } from '../ui/Feedback.jsx';
import { Select, TextArea, TextField, Toggle } from '../ui/Form.jsx';
import { AdminHeader } from '../admin/AdminUI.jsx';
import StatusBadge from '../content/StatusBadge.jsx';
import LyricsView from './LyricsView.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { adminService } from '../../services/adminService.js';
import { studioService } from '../../services/studioService.js';
import { useToast } from '../../context/ToastContext.jsx';
import { usePlayer } from '../../context/PlayerContext.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import { createLyricIndexer, formatTimestamp, looksLikeLrc, parseLrc, parsePlainLyrics, parseTimestamp, toLrc } from '../../utils/lyricsEngine.js';
import { cx, formatDuration } from '../../utils/format.js';

const LANGUAGES = [
  ['en', 'English'],
  ['fr', 'French'],
  ['es', 'Spanish'],
  ['pt', 'Portuguese'],
  ['pcm', 'Pidgin'],
  ['yo', 'Yoruba'],
  ['ig', 'Igbo'],
  ['ha', 'Hausa'],
  ['sw', 'Swahili'],
];
const KEY_STORE = 'sm:sync-keys';
const DEFAULT_KEYS = { stamp: 'Enter', play: ' ' };
const KEY_NAMES = { Enter: 'Enter', ' ': 'Space', s: 'S', j: 'J', k: 'K' };

const emptyDraft = (language = 'en') => ({ language, isSynced: false, lines: [{ text: '', startTimeMs: null }], copyrightNotice: '', attribution: '', license: '', source: 'manual' });

function fromVersion(v) {
  return {
    language: v.language,
    isSynced: v.isSynced,
    lines: v.lines.length ? v.lines.map((l) => ({ text: l.text, startTimeMs: l.startTimeMs })) : [{ text: '', startTimeMs: null }],
    copyrightNotice: v.copyrightNotice || '',
    attribution: v.attribution || '',
    license: v.license || '',
    source: v.source === 'external' ? 'imported' : v.source,
  };
}

/** First synced line whose timestamp goes backwards (or -1). */
function orderProblem(lines) {
  let last = -1;
  for (let i = 0; i < lines.length; i += 1) {
    const t = lines[i].startTimeMs;
    if (!Number.isFinite(t)) continue;
    if (t < last) return i;
    last = t;
  }
  return -1;
}

/** Local audio for the editor (separate from the site-wide player). */
function useEditorAudio(loadUrl) {
  const audioRef = useRef(null);
  const [state, setState] = useState({ ready: false, playing: false, time: 0, duration: 0, error: null, loading: false });
  const { pause: pauseSitePlayer } = usePlayer();

  const ensure = useCallback(async () => {
    if (audioRef.current?.src) return audioRef.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const { data } = await loadUrl();
      const audio = audioRef.current || new Audio();
      audioRef.current = audio;
      audio.preload = 'auto';
      audio.src = data.url;
      const sync = () => setState((s) => ({ ...s, ready: true, loading: false, playing: !audio.paused, time: audio.currentTime, duration: Number.isFinite(audio.duration) ? audio.duration : s.duration }));
      ['play', 'pause', 'timeupdate', 'loadedmetadata', 'durationchange', 'ended', 'seeked'].forEach((ev) => audio.addEventListener(ev, sync));
      audio.addEventListener('error', () => setState((s) => ({ ...s, loading: false, error: 'The audio could not be loaded.' })));
      return audio;
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: err.message }));
      return null;
    }
  }, [loadUrl]);

  useEffect(
    () => () => {
      audioRef.current?.pause();
    },
    []
  );

  const toggle = useCallback(async () => {
    const audio = await ensure();
    if (!audio) return;
    if (audio.paused) {
      pauseSitePlayer();
      audio.play().catch(() => {});
    } else audio.pause();
  }, [ensure, pauseSitePlayer]);

  const seek = useCallback(
    async (seconds) => {
      const audio = await ensure();
      if (!audio) return;
      audio.currentTime = Math.max(0, seconds);
    },
    [ensure]
  );

  const setRate = (r) => {
    if (audioRef.current) audioRef.current.playbackRate = r;
  };

  return { ...state, audioRef, toggle, seek, ensure, setRate, now: () => audioRef.current?.currentTime || 0 };
}

// ─── Line list editor ──────────────────────────────────────────────────────
function LinesEditor({ draft, setLines, problemIndex, onSeek }) {
  const refs = useRef([]);
  const update = (i, patch) => setLines((lines) => lines.map((l, k) => (k === i ? { ...l, ...patch } : l)));
  const insert = (i) => {
    setLines((lines) => [...lines.slice(0, i + 1), { text: '', startTimeMs: null }, ...lines.slice(i + 1)]);
    requestAnimationFrame(() => refs.current[i + 1]?.focus());
  };
  const remove = (i) => setLines((lines) => (lines.length > 1 ? lines.filter((_, k) => k !== i) : [{ text: '', startTimeMs: null }]));
  const move = (i, d) =>
    setLines((lines) => {
      const j = i + d;
      if (j < 0 || j >= lines.length) return lines;
      const next = [...lines];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  return (
    <ol className="le-lines">
      {draft.lines.map((line, i) => (
        <li key={i} className={cx('le-line', problemIndex === i && 'le-line--error')}>
          <span className="le-line__n" aria-hidden="true">
            {i + 1}
          </span>
          {draft.isSynced ? (
            <TimeInput value={line.startTimeMs} onChange={(ms) => update(i, { startTimeMs: ms })} label={`Timestamp for line ${i + 1}`} onSeek={onSeek} />
          ) : null}
          <input
            ref={(el) => (refs.current[i] = el)}
            className="input le-line__text"
            value={line.text}
            placeholder={i === 0 ? 'First line…' : 'Lyric line (leave empty for a stanza break)'}
            maxLength={500}
            onChange={(e) => update(i, { text: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                insert(i);
              } else if (e.key === 'Backspace' && !line.text && draft.lines.length > 1) {
                e.preventDefault();
                remove(i);
                requestAnimationFrame(() => refs.current[Math.max(0, i - 1)]?.focus());
              }
            }}
            aria-label={`Line ${i + 1}`}
          />
          <span className="le-line__tools">
            <button type="button" className="icon-btn icon-btn--sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move line ${i + 1} up`}>
              <Icon name="arrow-up" size={15} />
            </button>
            <button type="button" className="icon-btn icon-btn--sm" onClick={() => move(i, 1)} disabled={i === draft.lines.length - 1} aria-label={`Move line ${i + 1} down`}>
              <Icon name="arrow-down" size={15} />
            </button>
            <button type="button" className="icon-btn icon-btn--sm" onClick={() => insert(i)} aria-label={`Add a line after line ${i + 1}`}>
              <Icon name="plus" size={15} />
            </button>
            <button type="button" className="icon-btn icon-btn--sm icon-btn--danger" onClick={() => remove(i)} aria-label={`Delete line ${i + 1}`}>
              <Icon name="trash" size={15} />
            </button>
          </span>
        </li>
      ))}
    </ol>
  );
}

function TimeInput({ value, onChange, label, onSeek }) {
  const [text, setText] = useState(formatTimestamp(value));
  const [bad, setBad] = useState(false);
  useEffect(() => setText(Number.isFinite(value) ? formatTimestamp(value) : ''), [value]);
  return (
    <span className="le-time">
      <input
        className={cx('input le-time__input', bad && 'le-time__input--bad')}
        value={text}
        placeholder="--:--.--"
        onChange={(e) => {
          setText(e.target.value);
          setBad(false);
        }}
        onBlur={() => {
          if (!text.trim()) return onChange(null);
          const ms = parseTimestamp(text);
          if (ms === null) setBad(true);
          else onChange(ms);
          return undefined;
        }}
        aria-label={label}
        inputMode="decimal"
      />
      {Number.isFinite(value) && onSeek ? (
        <button type="button" className="icon-btn icon-btn--sm" onClick={() => onSeek(value / 1000)} aria-label={`Play from ${formatTimestamp(value)}`}>
          <Icon name="play" size={12} />
        </button>
      ) : null}
    </span>
  );
}

// ─── Live sync tool ────────────────────────────────────────────────────────
function SyncTool({ draft, setLines, player }) {
  const [cursor, setCursor] = useState(() => Math.max(0, draft.lines.findIndex((l) => !Number.isFinite(l.startTimeMs) && l.text.trim())));
  const [keys, setKeys] = useState(() => {
    try {
      return { ...DEFAULT_KEYS, ...JSON.parse(localStorage.getItem(KEY_STORE) || '{}') };
    } catch {
      return DEFAULT_KEYS;
    }
  });
  const [showKeys, setShowKeys] = useState(false);
  const rootRef = useRef(null);
  const lines = draft.lines;

  const nextLyric = useCallback(
    (from, dir = 1) => {
      let i = from;
      do i += dir;
      while (i >= 0 && i < lines.length && !lines[i].text.trim());
      return Math.max(0, Math.min(lines.length - 1, i));
    },
    [lines]
  );

  const stamp = useCallback(() => {
    const ms = Math.round(player.now() * 1000);
    setLines((ls) => ls.map((l, i) => (i === cursor ? { ...l, startTimeMs: ms } : l)));
    setCursor((c) => nextLyric(c));
  }, [player, cursor, setLines, nextLyric]);

  const nudge = (delta) =>
    setLines((ls) => ls.map((l, i) => (i === cursor && Number.isFinite(l.startTimeMs) ? { ...l, startTimeMs: Math.max(0, l.startTimeMs + delta) } : l)));

  const clearFrom = () => setLines((ls) => ls.map((l, i) => (i >= cursor ? { ...l, startTimeMs: null } : l)));

  const onKeyDown = (e) => {
    if (e.target.closest('input, textarea, select')) return;
    if (e.key === keys.stamp || e.key.toLowerCase() === keys.stamp) {
      e.preventDefault();
      if (player.playing) stamp();
    } else if (e.key === keys.play || e.key.toLowerCase() === keys.play) {
      e.preventDefault();
      player.toggle();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor((c) => nextLyric(c));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor((c) => nextLyric(c, -1));
    }
  };

  useEffect(() => rootRef.current?.focus(), []);
  const saveKeys = (next) => {
    setKeys(next);
    try {
      localStorage.setItem(KEY_STORE, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const current = lines[cursor];
  const prev = lines.slice(0, cursor).filter((l) => l.text.trim()).slice(-2);
  const upcoming = lines.slice(cursor + 1).filter((l) => l.text.trim()).slice(0, 4);
  const stamped = lines.filter((l) => l.text.trim() && Number.isFinite(l.startTimeMs)).length;
  const total = lines.filter((l) => l.text.trim()).length;

  return (
    <div className="sync" ref={rootRef} tabIndex={0} onKeyDown={onKeyDown} aria-label="Lyrics sync tool. Use the keyboard shortcuts listed below.">
      <div className="sync__player">
        <button type="button" className="transport__play" onClick={player.toggle} aria-label={player.playing ? 'Pause' : 'Play'} disabled={player.loading}>
          {player.loading ? <Spinner size={18} /> : <Icon name={player.playing ? 'pause' : 'play'} size={20} />}
        </button>
        <span className="sync__clock" aria-live="off">
          {formatTimestamp(player.time * 1000)} <span className="text-muted">/ {formatDuration(player.duration)}</span>
        </span>
        <input
          type="range"
          className="range"
          min={0}
          max={player.duration || 1}
          step="any"
          value={player.time}
          onChange={(e) => player.seek(Number(e.target.value))}
          aria-label="Seek"
          style={{ '--pct': `${player.duration ? (player.time / player.duration) * 100 : 0}%`, flex: 1 }}
        />
        <select className="input select select--inline" onChange={(e) => player.setRate(Number(e.target.value))} defaultValue="1" aria-label="Playback speed">
          <option value="0.75">0.75×</option>
          <option value="1">1×</option>
        </select>
      </div>
      {player.error ? <Alert type="error">{player.error}</Alert> : null}

      <div className="sync__stage" aria-live="polite">
        {prev.map((l, i) => (
          <p key={`p${i}`} className="sync__line sync__line--past">
            <span className="sync__t">{formatTimestamp(l.startTimeMs)}</span> {l.text}
          </p>
        ))}
        <p className="sync__line sync__line--current">
          <span className="sync__t">{formatTimestamp(current?.startTimeMs)}</span> {current?.text || <em className="text-muted">No more lines</em>}
        </p>
        {upcoming.map((l, i) => (
          <p key={`u${i}`} className="sync__line">
            {l.text}
          </p>
        ))}
      </div>

      <div className="sync__actions">
        <button type="button" className="btn btn--primary btn--lg" onClick={stamp} disabled={!player.playing || !current?.text.trim()}>
          <Icon name="timer" size={18} /> Set timestamp <kbd>{KEY_NAMES[keys.stamp] || keys.stamp}</kbd>
        </button>
        <button type="button" className="btn btn--secondary" onClick={() => setCursor((c) => nextLyric(c, -1))}>
          <Icon name="arrow-up" size={16} /> Previous line
        </button>
        <button type="button" className="btn btn--secondary" onClick={() => setCursor((c) => nextLyric(c))}>
          <Icon name="arrow-down" size={16} /> Next line
        </button>
        <button type="button" className="btn btn--ghost" onClick={() => nudge(-100)} disabled={!Number.isFinite(current?.startTimeMs)} aria-label="Move this timestamp 0.1 seconds earlier">
          −0.1s
        </button>
        <button type="button" className="btn btn--ghost" onClick={() => nudge(100)} disabled={!Number.isFinite(current?.startTimeMs)} aria-label="Move this timestamp 0.1 seconds later">
          +0.1s
        </button>
        <button type="button" className="btn btn--ghost" onClick={() => current && Number.isFinite(current.startTimeMs) && player.seek(Math.max(0, current.startTimeMs / 1000 - 2))} disabled={!Number.isFinite(current?.startTimeMs)}>
          <Icon name="refresh" size={16} /> Replay this line
        </button>
        <button type="button" className="btn btn--ghost text-danger" onClick={clearFrom}>
          Clear from here
        </button>
      </div>
      <div className="sync__foot">
        <span className="text-sm text-muted">
          {stamped} of {total} lines timed. <kbd>{KEY_NAMES[keys.play] || 'Space'}</kbd> play/pause · <kbd>{KEY_NAMES[keys.stamp] || keys.stamp}</kbd> stamp · <kbd>↑</kbd>/<kbd>↓</kbd> move
        </span>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setShowKeys(true)}>
          <Icon name="settings" size={14} /> Shortcuts
        </button>
      </div>
      {showKeys ? (
        <Dialog title="Sync shortcuts" size="sm" onClose={() => setShowKeys(false)}>
          <div className="stack">
            <Select label="Stamp the current line" value={keys.stamp} onChange={(e) => saveKeys({ ...keys, stamp: e.target.value })}>
              <option value="Enter">Enter</option>
              <option value="s">S</option>
              <option value="j">J</option>
            </Select>
            <Select label="Play / pause" value={keys.play} onChange={(e) => saveKeys({ ...keys, play: e.target.value })}>
              <option value=" ">Space</option>
              <option value="k">K</option>
            </Select>
            <p className="field__hint">Shortcuts only work while the sync tool has focus, so they never interfere with typing.</p>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}

// ─── Preview ───────────────────────────────────────────────────────────────
function Preview({ draft, player }) {
  const lyrics = useMemo(() => ({ ...draft, lines: draft.lines.map((l, i) => ({ ...l, lineNumber: i })) }), [draft]);
  const indexer = useMemo(() => createLyricIndexer(draft.lines), [draft.lines]);
  const [active, setActive] = useState(-1);
  useEffect(() => {
    let frame;
    const tick = () => {
      setActive(indexer.indexAt(player.now() * 1000));
      frame = requestAnimationFrame(tick);
    };
    if (player.playing) frame = requestAnimationFrame(tick);
    else setActive(indexer.indexAt(player.time * 1000));
    return () => cancelAnimationFrame(frame);
  }, [indexer, player]);
  return (
    <div className="stack">
      <div className="sync__player">
        <button type="button" className="transport__play" onClick={player.toggle} aria-label={player.playing ? 'Pause' : 'Play'}>
          {player.loading ? <Spinner size={18} /> : <Icon name={player.playing ? 'pause' : 'play'} size={20} />}
        </button>
        <span className="sync__clock">{formatTimestamp(player.time * 1000)}</span>
      </div>
      <div className="le-preview force-dark">
        <LyricsView lyrics={lyrics} activeIndex={draft.isSynced ? active : -1} onSeek={draft.isSynced ? player.seek : undefined} />
      </div>
    </div>
  );
}

// ─── Editor ────────────────────────────────────────────────────────────────
export default function LyricsEditor({ scope, songId }) {
  const isAdmin = scope === 'admin';
  const service = isAdmin ? adminService : studioService;
  const toast = useToast();
  const { settings } = useSettings();
  const { data, loading, error, reload, setData } = useAsync(() => service.songLyrics(songId), [songId]);
  const [versionId, setVersionId] = useState(null); // null = new version
  const [draft, setDraft] = useState(emptyDraft());
  const [dirty, setDirty] = useState(false);
  const [tab, setTab] = useState('edit');
  const [paste, setPaste] = useState('');
  const [busy, setBusy] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const loadUrl = useCallback(() => service.songPreview(songId), [service, songId]);
  const player = useEditorAudio(loadUrl);

  // Open the first existing version when data arrives.
  useEffect(() => {
    if (!data) return;
    const first = data.lyrics[0];
    if (first) {
      setVersionId(first.id);
      setDraft(fromVersion(first));
    }
  }, [data]);

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!dirty) return undefined;
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const version = data?.lyrics.find((v) => v.id === versionId) || null;
  const setLines = useCallback((updater) => {
    setDraft((d) => {
      const lines = typeof updater === 'function' ? updater(d.lines) : updater;
      const anyTimed = lines.some((l) => Number.isFinite(l.startTimeMs));
      return { ...d, lines, isSynced: d.isSynced || anyTimed };
    });
    setDirty(true);
  }, []);
  const setField = (key) => (e) => {
    const value = e?.target ? e.target.value : e;
    setDraft((d) => ({ ...d, [key]: value }));
    setDirty(true);
  };
  const problemIndex = draft.isSynced ? orderProblem(draft.lines) : -1;

  const openVersion = (id) => {
    if (dirty && !window.confirm('Discard your unsaved changes?')) return;
    const v = data.lyrics.find((x) => x.id === id);
    setVersionId(id);
    setDraft(v ? fromVersion(v) : emptyDraft(nextFreeLanguage(data.lyrics)));
    setDirty(false);
  };

  const importText = () => {
    const text = paste.trim();
    if (!text) return;
    const synced = looksLikeLrc(text);
    setDraft((d) => ({ ...d, isSynced: synced, source: 'imported', lines: synced ? parseLrc(text) : parsePlainLyrics(text) }));
    setDirty(true);
    setPaste('');
    setTab('edit');
    toast.success(synced ? 'Synced lyrics imported (LRC).' : 'Lyrics imported. Use the Sync tool to add timestamps.');
  };

  const importFromProvider = async () => {
    setBusy('provider');
    try {
      const { data: found } = await service.lyricsFromProvider(songId);
      setDraft((d) => ({
        ...d,
        language: found.language || d.language,
        isSynced: found.isSynced,
        lines: found.lines,
        attribution: found.attribution || d.attribution,
        copyrightNotice: found.copyrightNotice || d.copyrightNotice,
        license: found.license || d.license,
        source: 'imported',
      }));
      setDirty(true);
      setTab('edit');
      toast.success(`Imported from ${found.provider}. Review and edit before saving.`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(null);
    }
  };

  const exportLrc = () => {
    const blob = new Blob([toLrc(draft.lines)], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${data.song.title}.${draft.language}.lrc`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  const save = async ({ submit = false, publish = false } = {}) => {
    if (problemIndex >= 0) {
      toast.error(`Line ${problemIndex + 1} starts before the line above it. Fix the timestamps first.`);
      setTab('edit');
      return;
    }
    const lines = draft.lines.map((l) => ({ text: l.text, startTimeMs: draft.isSynced && Number.isFinite(l.startTimeMs) ? l.startTimeMs : null }));
    // Trim trailing empty lines.
    while (lines.length > 1 && !lines[lines.length - 1].text.trim()) lines.pop();
    if (!lines.some((l) => l.text.trim())) {
      toast.error('Add some lyrics first.');
      return;
    }
    if (draft.isSynced && !lines.some((l) => l.startTimeMs !== null)) {
      toast.error('Synced lyrics need at least one timestamp. Use the Sync tool, or turn off “Synced”.');
      return;
    }
    setBusy(submit ? 'submit' : publish ? 'publish' : 'save');
    try {
      const res = await service.saveLyrics(songId, versionId, {
        language: draft.language,
        isSynced: draft.isSynced,
        lines,
        source: draft.source === 'imported' ? 'imported' : 'manual',
        copyrightNotice: draft.copyrightNotice || null,
        attribution: draft.attribution || null,
        license: draft.license || null,
        ...(submit ? { submit: true } : {}),
        ...(publish ? { publish: true } : {}),
      });
      setData((d) => ({ ...d, lyrics: [...d.lyrics.filter((v) => v.id !== res.data.id), res.data].sort((a, b) => a.language.localeCompare(b.language)) }));
      setVersionId(res.data.id);
      setDraft(fromVersion(res.data));
      setDirty(false);
      toast.success(res.meta?.message || 'Lyrics saved.');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(null);
    }
  };

  const review = async (decision) => {
    setBusy(decision);
    try {
      const res = await adminService.reviewLyrics(songId, versionId, decision, decision === 'reject' ? reason : undefined);
      setData((d) => ({ ...d, lyrics: d.lyrics.map((v) => (v.id === res.data.id ? res.data : v)) }));
      setRejecting(false);
      setReason('');
      toast.success(res.meta?.message || 'Done.');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(null);
    }
  };

  const toggleVisibility = async () => {
    try {
      const res = await adminService.setLyricsVisibility(songId, versionId, !version.isVisible);
      setData((d) => ({ ...d, lyrics: d.lyrics.map((v) => (v.id === res.data.id ? res.data : v)) }));
      toast.success(res.data.isVisible ? 'Lyrics are visible to listeners.' : 'Lyrics hidden from listeners.');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const remove = async () => {
    setBusy('delete');
    try {
      await service.deleteLyrics(songId, versionId);
      const rest = data.lyrics.filter((v) => v.id !== versionId);
      setData((d) => ({ ...d, lyrics: rest }));
      setVersionId(rest[0]?.id || null);
      setDraft(rest[0] ? fromVersion(rest[0]) : emptyDraft());
      setDirty(false);
      setConfirmDelete(false);
      toast.success('Lyrics deleted.');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(null);
    }
  };

  if (error) return <ErrorState error={error} onRetry={reload} title="Unable to load lyrics" />;
  if (loading) return <PageLoader />;

  const back = isAdmin ? '/admin/lyrics' : '/studio/lyrics';
  const songLink = isAdmin ? `/admin/songs/${songId}/edit` : `/studio/music/${songId}`;
  const providerOn = settings.lyricsEnabled !== false;
  const usedLanguages = data.lyrics.map((v) => v.language);

  return (
    <>
      <AdminHeader
        title="Lyrics editor"
        description={
          <>
            {data.song.title} · {data.song.artist} · {formatDuration(data.song.duration)}
          </>
        }
        actions={
          <>
            {version ? <StatusBadge status={version.status} /> : <span className="badge badge--muted">New</span>}
            <Link to={songLink} className="btn btn--ghost btn--sm">
              <Icon name="music" size={16} /> Song
            </Link>
            <Link to={back} className="btn btn--ghost btn--sm">
              <Icon name="arrow-left" size={16} /> All lyrics
            </Link>
          </>
        }
      />

      <div className="chips" role="tablist" aria-label="Language versions">
        {data.lyrics.map((v) => (
          <button key={v.id} type="button" role="tab" aria-selected={v.id === versionId} className={cx('chip', v.id === versionId && 'chip--active')} onClick={() => openVersion(v.id)}>
            {(LANGUAGES.find(([c]) => c === v.language) || [v.language, v.language])[1]} {v.isSynced ? '· synced' : ''}
          </button>
        ))}
        <button type="button" role="tab" aria-selected={versionId === null} className={cx('chip', versionId === null && 'chip--active')} onClick={() => openVersion(null)}>
          <Icon name="plus" size={14} /> New language
        </button>
      </div>

      {version?.status === 'rejected' && version.rejectionReason ? (
        <Alert type="error">
          <strong>Changes requested:</strong> {version.rejectionReason}
        </Alert>
      ) : null}
      {isAdmin && version && !version.isVisible ? <Alert type="warning">These lyrics are hidden from listeners.</Alert> : null}

      <div className="le">
        <section className="panel stack le__main">
          <div className="tabs" role="tablist" style={{ margin: 0 }}>
            {[
              ['edit', 'Lines', 'edit'],
              ['sync', 'Sync', 'timer'],
              ['preview', 'Preview', 'eye'],
              ['import', 'Import / export', 'upload'],
            ].map(([id, label, icon]) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} className={cx('tab', tab === id && 'tab--active')} onClick={() => setTab(id)}>
                <Icon name={icon} size={15} /> {label}
              </button>
            ))}
          </div>

          {tab === 'edit' ? (
            <>
              {problemIndex >= 0 ? <Alert type="error">Line {problemIndex + 1} starts before the line above it. Timestamps must increase.</Alert> : null}
              <LinesEditor draft={draft} setLines={setLines} problemIndex={problemIndex} onSeek={player.seek} />
              <div className="row-gap wrap">
                <button type="button" className="btn btn--secondary btn--sm" onClick={() => setLines((ls) => [...ls, { text: '', startTimeMs: null }])}>
                  <Icon name="plus" size={14} /> Add line
                </button>
                <span className="field__hint">Enter adds a line · Backspace on an empty line removes it.</span>
              </div>
            </>
          ) : null}
          {tab === 'sync' ? <SyncTool draft={draft} setLines={setLines} player={player} /> : null}
          {tab === 'preview' ? <Preview draft={draft} player={player} /> : null}
          {tab === 'import' ? (
            <div className="stack">
              <TextArea
                label="Paste lyrics"
                value={paste}
                onChange={(e) => setPaste(e.target.value)}
                rows={10}
                hint="Plain text (one line per lyric line) or LRC with timestamps like [00:12.50]. This replaces the current lines."
              />
              <div className="row-gap wrap">
                <button type="button" className="btn btn--primary" onClick={importText} disabled={!paste.trim()}>
                  <Icon name="upload" size={16} /> Replace lines
                </button>
                {providerOn ? (
                  <button type="button" className="btn btn--secondary" onClick={importFromProvider} disabled={busy === 'provider'}>
                    <Icon name="globe" size={16} /> {busy === 'provider' ? 'Looking up…' : 'Import from lyrics provider'}
                  </button>
                ) : null}
                <button type="button" className="btn btn--ghost" onClick={exportLrc} disabled={!draft.lines.some((l) => Number.isFinite(l.startTimeMs))}>
                  <Icon name="download" size={16} /> Export .lrc
                </button>
              </div>
              <p className="settings-note">
                <Icon name="info" size={14} /> Only import lyrics you have the right to publish, and keep any attribution the source requires.
              </p>
            </div>
          ) : null}
        </section>

        <aside className="panel stack le__side">
          <h2 className="panel__title">Details</h2>
          <Select label="Language" value={draft.language} onChange={setField('language')} disabled={Boolean(versionId)} hint={versionId ? 'Create a new language version to add a translation.' : undefined}>
            {LANGUAGES.map(([code, label]) => (
              <option key={code} value={code} disabled={!versionId && usedLanguages.includes(code)}>
                {label}
                {!versionId && usedLanguages.includes(code) ? ' (exists)' : ''}
              </option>
            ))}
          </Select>
          <Toggle label="Synced" description="Lines light up in time with the music." checked={draft.isSynced} onChange={(v) => { setDraft((d) => ({ ...d, isSynced: v })); setDirty(true); }} />
          <TextField label="Copyright notice" value={draft.copyrightNotice} onChange={setField('copyrightNotice')} maxLength={500} placeholder="© 2026 Artist Name" />
          <TextField label="Attribution" value={draft.attribution} onChange={setField('attribution')} maxLength={500} hint="Shown under the lyrics (required for provider lyrics)." />
          <TextField label="License" value={draft.license} onChange={setField('license')} maxLength={200} />

          <div className="stack-sm le__actions">
            {dirty ? <p className="field__hint">You have unsaved changes.</p> : null}
            <button type="button" className="btn btn--secondary" onClick={() => save()} disabled={Boolean(busy)}>
              <Icon name="check" size={16} /> {busy === 'save' ? 'Saving…' : 'Save'}
            </button>
            {isAdmin ? (
              <button type="button" className="btn btn--primary" onClick={() => save({ publish: true })} disabled={Boolean(busy)}>
                <Icon name="eye" size={16} /> {busy === 'publish' ? 'Publishing…' : 'Save & publish'}
              </button>
            ) : (
              <button type="button" className="btn btn--primary" onClick={() => save({ submit: true })} disabled={Boolean(busy) || version?.status === 'pending'}>
                <Icon name="send" size={16} /> {busy === 'submit' ? 'Submitting…' : settings.artistAutoPublish ? 'Save & publish' : 'Save & submit for review'}
              </button>
            )}
            {isAdmin && version?.status === 'pending' ? (
              <div className="row-gap wrap">
                <button type="button" className="btn btn--secondary btn--sm" onClick={() => review('publish')} disabled={Boolean(busy) || dirty}>
                  Approve & publish
                </button>
                <button type="button" className="btn btn--ghost btn--sm text-danger" onClick={() => setRejecting(true)} disabled={Boolean(busy)}>
                  Reject
                </button>
              </div>
            ) : null}
            {isAdmin && version ? (
              <button type="button" className="btn btn--ghost btn--sm" onClick={toggleVisibility}>
                <Icon name={version.isVisible ? 'eye-off' : 'eye'} size={14} /> {version.isVisible ? 'Hide from listeners' : 'Show to listeners'}
              </button>
            ) : null}
            {version ? (
              <button type="button" className="btn btn--ghost btn--sm text-danger" onClick={() => setConfirmDelete(true)}>
                <Icon name="trash" size={14} /> Delete this version
              </button>
            ) : null}
          </div>
        </aside>
      </div>

      {confirmDelete ? (
        <ConfirmDialog title="Delete these lyrics?" message="This language version and its timestamps will be deleted." confirmLabel="Delete" danger busy={busy === 'delete'} onConfirm={remove} onClose={() => setConfirmDelete(false)} />
      ) : null}
      {rejecting ? (
        <Dialog
          title="Request changes"
          size="sm"
          onClose={() => setRejecting(false)}
          footer={
            <>
              <button type="button" className="btn btn--ghost" onClick={() => setRejecting(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn--danger" onClick={() => review('reject')} disabled={!reason.trim() || busy === 'reject'}>
                Reject
              </button>
            </>
          }
        >
          <TextArea label="Reason (sent to the artist)" value={reason} onChange={(e) => setReason(e.target.value)} rows={4} autoFocus />
        </Dialog>
      ) : null}
    </>
  );
}

function nextFreeLanguage(versions) {
  const used = new Set(versions.map((v) => v.language));
  return (LANGUAGES.find(([code]) => !used.has(code)) || ['en'])[0];
}
