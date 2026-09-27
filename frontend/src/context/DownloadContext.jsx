import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { musicService } from '../services/musicService.js';
import { useToast } from './ToastContext.jsx';
import { usePreferences } from './PreferencesContext.jsx';

/** Network Information API (Chromium/Android). Unknown elsewhere → null. */
const onCellular = () => {
  const c = navigator.connection;
  if (!c) return null;
  return c.type === 'cellular' || (c.type === undefined && c.saveData === true);
};

const DownloadContext = createContext(null);

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Navigate to the signed URL; storage sends Content-Disposition: attachment. */
function saveViaLink(url) {
  const a = document.createElement('a');
  a.href = url;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * Downloads the original stored file with progress. The API validates the song,
 * checks the file exists, records the download and returns a short-lived signed
 * URL. If streaming the bytes fails (e.g. storage CORS), it falls back to a
 * direct attachment link.
 */
export function DownloadProvider({ children }) {
  const toast = useToast();
  const { prefs } = usePreferences();
  const [progress, setProgress] = useState({}); // songId → 0-100 | -1 (indeterminate)

  const setFor = (id, value) =>
    setProgress((p) => {
      const next = { ...p };
      if (value === null) delete next[id];
      else next[id] = value;
      return next;
    });

  const download = useCallback(
    async (song) => {
      if (progress[song.id] !== undefined) return;
      // Settings → Downloads → "Only download on Wi-Fi" (where the browser can tell).
      if (prefs.wifiOnlyDownloads && onCellular()) {
        toast.warning('You are on mobile data. Downloads are set to Wi-Fi only (Settings → Downloads).');
        return;
      }
      const notify = prefs.downloadNotifications !== false;
      setFor(song.id, -1);
      let signed;
      try {
        ({ data: signed } = await musicService.requestDownload(song.id));
      } catch (err) {
        setFor(song.id, null);
        toast.error(err.code === 'AUDIO_MISSING' ? 'Sorry, this song\'s audio file is no longer available.' : err.message);
        return;
      }

      if (notify) toast.info(`Downloading "${song.title}"…`);
      try {
        const res = await fetch(signed.url);
        if (!res.ok || !res.body) throw new Error('stream');
        const total = Number(res.headers.get('Content-Length')) || 0;
        const reader = res.body.getReader();
        const chunks = [];
        let received = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          received += value.length;
          if (total) setFor(song.id, Math.round((received / total) * 100));
        }
        saveBlob(new Blob(chunks, { type: signed.mime || 'audio/mpeg' }), signed.filename);
        if (notify) toast.success(`Downloaded "${song.title}".`);
      } catch {
        saveViaLink(signed.url);
        if (notify) toast.success(`Download started for "${song.title}".`);
      } finally {
        setFor(song.id, null);
      }
    },
    [progress, toast, prefs.wifiOnlyDownloads, prefs.downloadNotifications]
  );

  const value = useMemo(() => ({ download, progress }), [download, progress]);
  return <DownloadContext.Provider value={value}>{children}</DownloadContext.Provider>;
}

export const useDownload = () => useContext(DownloadContext);
