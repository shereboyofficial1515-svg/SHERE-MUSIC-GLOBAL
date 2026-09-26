import { useLocation } from 'react-router-dom';
import Logo from '../ui/Logo.jsx';
import Icon from '../ui/Icon.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

/**
 * Shows the maintenance screen to visitors when an admin enables maintenance
 * mode. Admins (and the sign-in page) keep full access so they can turn it off.
 */
export default function MaintenanceGate({ children }) {
  const { settings, maintenance } = useSettings();
  const { isAdmin, loading } = useAuth();
  const { pathname } = useLocation();
  const active = settings.maintenanceMode || Boolean(maintenance);

  if (!active || isAdmin || loading || pathname === '/login') return children;

  return (
    <div className="maintenance">
      <Logo />
      <span className="maintenance__icon">
        <Icon name="tool" size={32} />
      </span>
      <h1>We&apos;ll be right back</h1>
      <p className="text-muted">{settings.maintenanceMessage || maintenance || `${settings.siteName} is undergoing scheduled maintenance. Please check back soon.`}</p>
    </div>
  );
}
