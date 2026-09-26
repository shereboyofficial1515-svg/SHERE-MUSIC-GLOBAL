import { Link } from 'react-router-dom';
import { useSettings } from '../../context/SettingsContext.jsx';

/** Brand mark: the uploaded logo from settings, or the built-in SHERE MUSIC mark. */
export default function Logo({ to = '/', compact = false }) {
  const { settings } = useSettings();
  const name = settings.siteName || 'SHERE MUSIC';
  const [first, ...rest] = name.split(' ');

  return (
    <Link to={to} className="logo" aria-label={`${name} home`}>
      {settings.logoUrl ? (
        <img src={settings.logoUrl} alt="" className="logo__img" />
      ) : (
        <svg className="logo__mark" viewBox="0 0 64 64" aria-hidden="true">
          <circle cx="32" cy="32" r="26" fill="none" stroke="var(--sky)" strokeWidth="5" />
          <rect x="19" y="25" width="5" height="14" rx="2.5" fill="var(--sky)" />
          <rect x="27.5" y="16" width="5" height="32" rx="2.5" fill="var(--gold)" />
          <rect x="36" y="21" width="5" height="22" rx="2.5" fill="var(--sky)" />
          <rect x="44.5" y="27" width="5" height="10" rx="2.5" fill="var(--sky)" />
        </svg>
      )}
      {!compact ? (
        <span className="logo__text">
          {first}
          {rest.length ? <span className="logo__accent"> {rest.join(' ')}</span> : null}
        </span>
      ) : null}
    </Link>
  );
}
