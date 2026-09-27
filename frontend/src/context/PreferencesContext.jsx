import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthContext.jsx';
import { useSettings } from './SettingsContext.jsx';
import { api } from '../services/api.js';

/**
 * Listener preferences: appearance, accessibility, playback, captions,
 * notifications and privacy. Guests keep them in localStorage; signed-in
 * users sync them to their account (user_settings) so they follow them
 * across devices. A copy always stays in localStorage so index.html can apply
 * theme/accessibility before first paint (no theme flash).
 */
const PreferencesContext = createContext(null);
const STORAGE_KEY = 'sm:prefs';

export const DEFAULT_PREFS = {
  theme: 'system',
  language: 'en',
  subtitleLanguage: null,
  captionsEnabled: false,
  reducedMotion: 'system',
  largeText: false,
  highContrast: false,
  largerControls: false,
  lyricsAutoOpen: false,
  autoplay: true,
  rememberPosition: true,
  wifiOnlyDownloads: false,
  downloadNotifications: true,
  notifications: { newMusic: true, newVideos: true, artistUpdates: true, followers: true, account: true, email: true },
  privacy: {
    publicProfile: true,
    showListeningActivity: false,
    showFollowing: true,
    showFollowers: true,
    personalizedRecommendations: true,
    usageAnalytics: true,
  },
};

const readLocal = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  } catch {
    return null;
  }
};
const writeLocal = (prefs) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* storage unavailable (private mode) — preferences still apply for this visit */
  }
};

const systemDark = () => typeof matchMedia !== 'undefined' && !matchMedia('(prefers-color-scheme: light)').matches;
const systemReducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Apply theme + accessibility classes to <html>. Theme changes cross-fade briefly. */
function applyToDocument(prefs, siteDefaultTheme, animate) {
  const root = document.documentElement;
  const choice = prefs.theme === 'system' && !readLocal()?.theme && siteDefaultTheme ? siteDefaultTheme : prefs.theme;
  const theme = choice === 'system' ? (systemDark() ? 'dark' : 'light') : choice;
  const reduce = prefs.reducedMotion === 'on' || (prefs.reducedMotion === 'system' && systemReducedMotion());
  if (animate && !reduce && root.getAttribute('data-theme') !== theme) {
    root.classList.add('theme-transition');
    window.setTimeout(() => root.classList.remove('theme-transition'), 450);
  }
  root.setAttribute('data-theme', theme);
  root.classList.toggle('a11y-large-text', Boolean(prefs.largeText));
  root.classList.toggle('a11y-high-contrast', Boolean(prefs.highContrast));
  root.classList.toggle('a11y-larger-controls', Boolean(prefs.largerControls));
  root.classList.toggle('reduce-motion', reduce);
  return { theme, reduce };
}

export function PreferencesProvider({ children }) {
  const { user } = useAuth();
  const { settings: site } = useSettings();
  const [prefs, setPrefs] = useState(() => ({ ...DEFAULT_PREFS, ...(readLocal() || {}) }));
  const [resolved, setResolved] = useState({ theme: document.documentElement.getAttribute('data-theme') || 'dark', reduce: false });
  const [synced, setSynced] = useState(false);
  const saveTimer = useRef(null);
  const pending = useRef({});
  const waiters = useRef([]);
  const firstApply = useRef(true);

  // Remember the site default for guests' first paint.
  useEffect(() => {
    if (!site?.defaultTheme) return;
    try {
      localStorage.setItem('sm:site-theme', site.defaultTheme);
    } catch {
      /* ignore */
    }
  }, [site?.defaultTheme]);

  // Apply to the document whenever preferences (or the OS setting) change.
  useEffect(() => {
    const apply = () => setResolved(applyToDocument(prefs, site?.defaultTheme, !firstApply.current));
    apply();
    firstApply.current = false;
    const mqs = [matchMedia('(prefers-color-scheme: light)'), matchMedia('(prefers-reduced-motion: reduce)')];
    mqs.forEach((mq) => mq.addEventListener('change', apply));
    return () => mqs.forEach((mq) => mq.removeEventListener('change', apply));
  }, [prefs, site?.defaultTheme]);

  // Signed in: load the account's settings (they win over this device's copy).
  useEffect(() => {
    let cancelled = false;
    setSynced(false);
    if (!user) return undefined;
    api
      .get('/me/settings')
      .then(({ data }) => {
        if (cancelled) return;
        setPrefs((local) => {
          const merged = { ...local, ...data, notifications: { ...local.notifications, ...data.notifications }, privacy: { ...local.privacy, ...data.privacy } };
          writeLocal(merged);
          return merged;
        });
        setSynced(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user]);

  /** Update one or more preferences. Saved locally at once, and to the account (debounced). */
  const update = useCallback(
    (patch) => {
      setPrefs((current) => {
        const next = {
          ...current,
          ...patch,
          notifications: { ...current.notifications, ...(patch.notifications || {}) },
          privacy: { ...current.privacy, ...(patch.privacy || {}) },
        };
        writeLocal(next);
        return next;
      });
      if (!user) return Promise.resolve();
      pending.current = {
        ...pending.current,
        ...patch,
        ...(patch.notifications ? { notifications: { ...(pending.current.notifications || {}), ...patch.notifications } } : {}),
        ...(patch.privacy ? { privacy: { ...(pending.current.privacy || {}), ...patch.privacy } } : {}),
      };
      window.clearTimeout(saveTimer.current);
      // Every caller in a burst of changes shares the result of the single save.
      return new Promise((resolve, reject) => {
        waiters.current.push({ resolve, reject });
        saveTimer.current = window.setTimeout(async () => {
          const body = pending.current;
          const batch = waiters.current;
          pending.current = {};
          waiters.current = [];
          try {
            await api.put('/me/settings', body);
            batch.forEach((w) => w.resolve());
          } catch (err) {
            batch.forEach((w) => w.reject(err));
          }
        }, 400);
      });
    },
    [user]
  );

  const value = useMemo(
    () => ({ prefs, update, resolvedTheme: resolved.theme, reduceMotion: resolved.reduce, synced }),
    [prefs, update, resolved, synced]
  );
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export const usePreferences = () => useContext(PreferencesContext);
