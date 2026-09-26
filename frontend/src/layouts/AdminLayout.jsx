import { Suspense, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import Icon from '../components/ui/Icon.jsx';
import Logo from '../components/ui/Logo.jsx';
import { PageLoader } from '../components/ui/Feedback.jsx';
import { MenuToggle } from '../components/layout/Header.jsx';
import Player from '../components/music/Player.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { usePlayer } from '../context/PlayerContext.jsx';
import { cx } from '../utils/format.js';

const ADMIN_NAV = [
  { to: '/admin', label: 'Dashboard', icon: 'grid', end: true },
  { to: '/admin/songs', label: 'Music', icon: 'music', end: true },
  { to: '/admin/songs/new', label: 'Upload Music', icon: 'upload' },
  { to: '/admin/artists', label: 'Artists', icon: 'mic' },
  { to: '/admin/albums', label: 'Albums', icon: 'disc' },
  { to: '/admin/genres', label: 'Categories', icon: 'tag' },
  { to: '/admin/playlists', label: 'Playlists', icon: 'list-music' },
  { to: '/admin/users', label: 'Users', icon: 'users' },
  { to: '/admin/downloads', label: 'Downloads', icon: 'download' },
  { to: '/admin/analytics', label: 'Analytics', icon: 'bar-chart' },
  { to: '/admin/reports', label: 'Reports', icon: 'file-text' },
  { to: '/admin/settings', label: 'Settings', icon: 'settings' },
];

export default function AdminLayout() {
  const { user } = useAuth();
  const { current } = usePlayer();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const mainRef = useRef(null);

  // The content area (not the window) is the scroll container, so reset it on navigation.
  useEffect(() => {
    setOpen(false);
    mainRef.current?.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className={cx('admin', current && 'has-player')}>
      <a href="#admin-main" className="skip-link">
        Skip to content
      </a>
      <header className="admin__topbar">
        <div className="row-gap">
          <span className="show-lg">
            <MenuToggle open={open} onClick={() => setOpen((o) => !o)} controls="admin-nav" />
          </span>
          <Logo to="/admin" />
          <span className="badge badge--gold hide-xs">Admin</span>
        </div>
        <div className="row-gap">
          <Link to="/" className="btn btn--ghost btn--sm">
            <Icon name="external-link" size={16} />
            <span className="hide-xs">View site</span>
          </Link>
          <span className="admin__user hide-sm">{user?.name}</span>
        </div>
      </header>

      <div className={cx('drawer-backdrop admin__backdrop', open && 'is-open')} onClick={() => setOpen(false)} aria-hidden="true" />
      <nav id="admin-nav" className={cx('admin__sidebar', open && 'is-open')} aria-label="Admin">
        <ul>
          {ADMIN_NAV.map((item) => (
            <li key={item.to}>
              <NavLink to={item.to} end={item.end} className={({ isActive }) => cx('admin__link', isActive && 'admin__link--active')}>
                <Icon name={item.icon} size={18} />
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Dedicated vertical scroll container for every admin page (see admin.css). */}
      <main id="admin-main" ref={mainRef} className="admin__main" tabIndex={-1}>
        <div className="admin__content">
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </div>
      </main>
      <Player />
    </div>
  );
}
