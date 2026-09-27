import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useAuth } from './AuthContext.jsx';
import { useSettings } from './SettingsContext.jsx';
import PlusUpgradeDialog from '../components/plus/PlusUpgradeDialog.jsx';

const PlusContext = createContext(null);

/**
 * SHERE MUSIC Plus in the UI. `isPlus` only decides what to *show*; every
 * Plus feature is enforced by the API (e.g. downloads answer 403 without Plus).
 */
export function PlusProvider({ children }) {
  const { user } = useAuth();
  const { settings } = useSettings();
  const [dialog, setDialog] = useState(null); // { reason } | null

  const plus = settings.monetization?.plus;
  const plusEnabled = plus?.enabled !== false;
  const isPlus = Boolean(user?.plus?.active);
  // Admins and (when Plus is off) every signed-in listener can download without Plus.
  const canDownload = Boolean(user) && (isPlus || user.role === 'admin' || !plusEnabled);

  const openUpgrade = useCallback((reason = 'plus') => setDialog({ reason }), []);
  const closeUpgrade = useCallback(() => setDialog(null), []);

  const value = useMemo(
    () => ({ isPlus, plusEnabled, canDownload, openUpgrade, closeUpgrade, plus: plus || null, currency: settings.monetization?.currency || 'NGN' }),
    [isPlus, plusEnabled, canDownload, openUpgrade, closeUpgrade, plus, settings.monetization?.currency]
  );

  return (
    <PlusContext.Provider value={value}>
      {children}
      {dialog ? <PlusUpgradeDialog reason={dialog.reason} onClose={closeUpgrade} /> : null}
    </PlusContext.Provider>
  );
}

export const usePlus = () => useContext(PlusContext);
