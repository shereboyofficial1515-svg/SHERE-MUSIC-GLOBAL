import { Suspense, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import Icon from '../components/ui/Icon.jsx';
import Logo from '../components/ui/Logo.jsx';
import { PageLoader } from '../components/ui/Feedback.jsx';
import { MenuToggle, ThemeToggle } from '../components/layout/Header.jsx';
import NotificationsBell from '../components/layout/NotificationsBell.jsx';
import Player from '../components/player/Player.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { usePlayer } from '../context/PlayerContext.jsx';
import { gsap, motionOK } from '../utils/motion.js';
import { cx } from '../utils/format.js';

/**
 * Shared shell for the Admin Dashboard and SHERE MUSIC STUDIO.
 * Viewport-height frame: the top bar is fixed height and `.admin__main` is
 * the only vertical scroll container (with a visible scrollbar); the
 * sidebar scrolls independently. Pages never depend on <body> scrolling.
 */
export default function DashboardLayout({ nav, badge, badgeTone = 'gold', homeTo, variant }) {
  const { user } = useAuth();
  const { current, miniHidden } = usePlayer();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const mainRef = useRef(null);
  const contentRef = useRef(null);

  useEffect(() => {
    setOpen(false);
    mainRef.current?.scrollTo(0, 0);
    if (contentRef.current && motionOK()) {
      gsap.fromTo(contentRef.current, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.3, clearProps: 'transform,opacity,visibility' });
    }
  }, [pathname]);

  return (
    <div className={cx('admin', variant && `admin--${variant}`, current && !miniHidden && 'has-player')}>
      <a href="#admin-main" className="skip-link">
        Skip to content
      </a>
      <header className="admin__topbar">
        <div className="row-gap">
          <span className="show-lg">
            <MenuToggle open={open} onClick={() => setOpen((o) => !o)} controls="admin-nav" />
          </span>
          <Logo to={homeTo} />
          <span className={`badge badge--${badgeTone} hide-xs`}>{badge}</span>
        </div>
        <div className="row-gap" style={{ gap: 4 }}>
          <Link to="/" className="btn btn--ghost btn--sm">
            <Icon name="external-link" size={16} />
            <span className="hide-xs">View site</span>
          </Link>
          <ThemeToggle />
          {user ? <NotificationsBell /> : null}
          <span className="admin__user hide-sm">{user?.name}</span>
        </div>
      </header>

      <div className={cx('drawer-backdrop admin__backdrop', open && 'is-open')} onClick={() => setOpen(false)} aria-hidden="true" />
      <nav id="admin-nav" className={cx('admin__sidebar', open && 'is-open')} aria-label={badge}>
        {nav.map((group) => (
          <div key={group.label || 'main'} className="sidebar__group">
            {group.label ? <p className="sidebar__label">{group.label}</p> : null}
            <ul>
              {group.links.map((item) => (
                <li key={item.to}>
                  <NavLink to={item.to} end={item.end} className={({ isActive }) => cx('admin__link', isActive && 'admin__link--active')}>
                    <Icon name={item.icon} size={18} />
                    <span style={{ flex: 1 }}>{item.label}</span>
                    {item.count ? <span className="badge">{item.count}</span> : null}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <main id="admin-main" ref={mainRef} className="admin__main" tabIndex={-1}>
        <div className="admin__content" ref={contentRef}>
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </div>
      </main>
      <Player />
    </div>
  );
}
