import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { musicService } from '../services/musicService.js';

const SettingsContext = createContext(null);

const FALLBACK = {
  siteName: 'SHERE MUSIC',
  siteDescription: 'Discover music. Stream music. Download music.',
  logoUrl: null,
  faviconUrl: null,
  contactEmail: null,
  socialLinks: {},
  allowRegistration: true,
  maintenanceMode: false,
  maintenanceMessage: null,
  maxAudioMb: 50,
  maxImageMb: 5,
};

/** Public site settings managed from the admin dashboard (name, logo, favicon, limits…). */
export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(FALLBACK);
  const [loaded, setLoaded] = useState(false);
  const [maintenance, setMaintenance] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const { data } = await musicService.settings();
      setSettings({ ...FALLBACK, ...data });
    } catch {
      /* keep fallback values; pages show their own errors */
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    refresh();
    const onMaintenance = (e) => setMaintenance(e.detail?.message || 'We are performing maintenance.');
    window.addEventListener('sm:maintenance', onMaintenance);
    return () => window.removeEventListener('sm:maintenance', onMaintenance);
  }, [refresh]);

  useEffect(() => {
    if (!settings.faviconUrl) return;
    const link = document.querySelector('link[rel="icon"]');
    if (link) {
      link.href = settings.faviconUrl;
      link.removeAttribute('type');
    }
  }, [settings.faviconUrl]);

  const value = useMemo(
    () => ({ settings, loaded, refresh, maintenance, clearMaintenance: () => setMaintenance(null) }),
    [settings, loaded, refresh, maintenance]
  );
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export const useSettings = () => useContext(SettingsContext);
