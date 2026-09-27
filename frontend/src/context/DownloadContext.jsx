import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { API_BASE } from '../services/api.js';
import { useToast } from './ToastContext.jsx';
import { usePreferences } from './PreferencesContext.jsx';
import { useAuth } from './AuthContext.jsx';
import { usePlus } from './PlusContext.jsx';

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

function filenameFrom(res, song) {
  const cd = res.headers.get('Content-Disposition') || '';
  const star = cd.match(/filename\*=UTF-8''([^;]+)/i);
  if (star) return decodeURIComponent(star[1]);
  const plain = cd.match(/filename="([^"]+)"/i);
  return plain ? plain[1] : `${song.artist?.name || 'SHERE MUSIC'} - ${song.title}.mp3`;
}

/**
 * Device downloads. The API decides who may download (Plus, admins, the
 * song's own artist) and streams the file itself, so no storage link is ever
 * handed to the browser. Free listeners see the Plus prompt instead and no
 * request is made; a direct call to the API would get 403 anyway.
 */
export function DownloadProvider({ children }) {
  const toast = useToast();
  const { prefs } = usePreferences();
  const { user, refresh } = useAuth();
  const { canDownload, openUpgrade } = usePlus();
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
      // Artists may download their own songs; the API decides, so let them try.
      if (!user || (!canDownload && user.role !== 'artist')) {
        openUpgrade('download');
        return;
      }
      // Settings → Downloads → "Only download on Wi-Fi" (where the browser can tell).
      if (prefs.wifiOnlyDownloads && onCellular()) {
        toast.warning('You are on mobile data. Downloads are set to Wi-Fi only (Settings → Downloads).');
        return;
      }
      const notify = prefs.downloadNotifications !== false;
      setFor(song.id, -1);
      try {
        const res = await fetch(`${API_BASE}/songs/${song.id}/download`, {
          credentials: 'include',
          headers: { 'X-Requested-With': 'SHERE-MUSIC' },
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          const err = new Error(body?.error?.message || 'The download could not be started. Please try again.');
          err.code = body?.error?.code;
          throw err;
        }
        if (notify) toast.info(`Downloading "${song.title}"…`);
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
        if (total && received < total) throw new Error('The download was interrupted. Please try again.');
        saveBlob(new Blob(chunks, { type: res.headers.get('Content-Type') || 'audio/mpeg' }), filenameFrom(res, song));
        toast.success(notify ? `Download complete: "${song.title}".` : 'Download complete.');
      } catch (err) {
        if (err.code === 'PLUS_REQUIRED') {
          await refresh(); // membership may have ended; update the UI
          openUpgrade('download');
        } else if (err.code === 'UNAUTHORIZED' || err.code === 'SESSION_EXPIRED') {
          openUpgrade('download');
        } else {
          toast.error(err.message || 'The download failed. Please try again.');
        }
      } finally {
        setFor(song.id, null);
      }
    },
    [progress, toast, prefs.wifiOnlyDownloads, prefs.downloadNotifications, user, canDownload, openUpgrade, refresh]
  );

  const value = useMemo(() => ({ download, progress }), [download, progress]);
  return <DownloadContext.Provider value={value}>{children}</DownloadContext.Provider>;
}

export const useDownload = () => useContext(DownloadContext);
