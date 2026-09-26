import { Link } from 'react-router-dom';
import Logo from '../ui/Logo.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';

const SOCIAL_LABELS = { instagram: 'Instagram', x: 'X (Twitter)', facebook: 'Facebook', youtube: 'YouTube', tiktok: 'TikTok', spotify: 'Spotify' };

export default function Footer() {
  const { settings } = useSettings();
  const socials = Object.entries(settings.socialLinks || {}).filter(([, url]) => url);

  return (
    <footer className="footer">
      <div className="container footer__inner">
        <div className="footer__brand">
          <Logo />
          <p className="text-muted">{settings.siteDescription}</p>
        </div>
        <nav className="footer__col" aria-label="Browse">
          <h2 className="footer__heading">Browse</h2>
          <Link to="/discover">Discover</Link>
          <Link to="/artists">Artists</Link>
          <Link to="/albums">Albums</Link>
          <Link to="/search">Search</Link>
        </nav>
        <nav className="footer__col" aria-label="Your library">
          <h2 className="footer__heading">Your library</h2>
          <Link to="/favorites">Favorites</Link>
          <Link to="/playlists">Playlists</Link>
          <Link to="/profile">Profile</Link>
        </nav>
        {socials.length || settings.contactEmail ? (
          <div className="footer__col">
            <h2 className="footer__heading">Connect</h2>
            {socials.map(([key, url]) => (
              <a key={key} href={url} target="_blank" rel="noopener noreferrer">
                {SOCIAL_LABELS[key] || key}
              </a>
            ))}
            {settings.contactEmail ? <a href={`mailto:${settings.contactEmail}`}>{settings.contactEmail}</a> : null}
          </div>
        ) : null}
      </div>
      <div className="container footer__bottom">
        <span>
          © {new Date().getFullYear()} {settings.siteName}. All rights reserved.
        </span>
        <span>Discover music. Stream music. Download music.</span>
      </div>
    </footer>
  );
}
