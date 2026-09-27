import { Link, NavLink } from 'react-router-dom';
import Icon from '../ui/Icon.jsx';
import Logo from '../ui/Logo.jsx';
import { useNavGroups } from './Header.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { cx } from '../../utils/format.js';

/** Desktop navigation (≥1024px). */
export default function Sidebar() {
  const groups = useNavGroups();
  const { user } = useAuth();
  return (
    <nav className="sidebar" aria-label="Main">
      <div className="sidebar__brand">
        <Logo />
      </div>
      {groups.map((group) => (
        <div key={group.label} className="sidebar__group">
          <p className="sidebar__label">{group.label}</p>
          {group.links.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.end} className={({ isActive }) => cx('side-link', isActive && 'side-link--active')}>
              <Icon name={link.icon} size={19} />
              {link.label}
            </NavLink>
          ))}
        </div>
      ))}
      {!user ? (
        <div className="sidebar__cta">
          <strong>Your music, your way</strong>
          <p>Save favourites, build playlists and follow artists.</p>
          <Link to="/register" className="btn btn--sm">
            Create free account
          </Link>
        </div>
      ) : null}
    </nav>
  );
}

/** Mobile bottom tab bar (<768px). */
export function TabBar() {
  const tabs = [
    { to: '/', label: 'Home', icon: 'home', end: true },
    { to: '/discover', label: 'Discover', icon: 'compass' },
    { to: '/search', label: 'Search', icon: 'search' },
    { to: '/videos', label: 'Videos', icon: 'film' },
    { to: '/library', label: 'Library', icon: 'list-music' },
  ];
  return (
    <nav className="tabbar" aria-label="Quick navigation">
      {tabs.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => cx('tab-link', isActive && 'tab-link--active')}>
          <Icon name={t.icon} size={21} />
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}
