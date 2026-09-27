import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import Icon from '../ui/Icon.jsx';
import Logo from '../ui/Logo.jsx';
import Artwork from '../ui/Artwork.jsx';
import NotificationsBell from './NotificationsBell.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { usePreferences } from '../../context/PreferencesContext.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import { PlusBadge } from '../plus/PlusBadge.jsx';
import { useDismiss } from '../../hooks/useDismiss.js';
import { useScrollLock } from '../../hooks/useScrollLock.js';
import { gsap, motionOK } from '../../utils/motion.js';
import { cx } from '../../utils/format.js';

/** Primary destinations, shared by the sidebar and drawer. */
export function useNavGroups() {
  const { user, isAdmin } = useAuth();
  const { settings } = useSettings();
  const isCreator = user && ['artist', 'admin'].includes(user.role);
  return [
    {
      label: 'Browse',
      links: [
        { to: '/', label: 'Home', icon: 'home', end: true },
        { to: '/discover', label: 'Discover', icon: 'compass' },
        { to: '/search', label: 'Search', icon: 'search' },
        ...(settings.videosEnabled !== false ? [{ to: '/videos', label: 'Music Videos', icon: 'film' }] : []),
        { to: '/artists', label: 'Artists', icon: 'mic' },
        { to: '/albums', label: 'Albums', icon: 'disc' },
        ...(settings.monetization?.plus?.enabled !== false ? [{ to: '/plus', label: 'SHERE MUSIC Plus', icon: 'sparkles' }] : []),
      ],
    },
    {
      label: 'Your library',
      links: [
        { to: '/favorites', label: 'Favorites', icon: 'heart' },
        { to: '/playlists', label: 'Playlists', icon: 'list-music' },
        { to: '/following', label: 'Following', icon: 'user-check' },
        { to: '/library', label: 'History', icon: 'clock' },
      ],
    },
    ...(user
      ? [
          {
            label: 'Create & manage',
            links: [
              { to: '/studio', label: isCreator ? 'SHERE MUSIC STUDIO' : 'Become an artist', icon: 'layers' },
              ...(isAdmin ? [{ to: '/admin', label: 'Admin dashboard', icon: 'shield' }] : []),
              { to: '/settings', label: 'Settings', icon: 'settings' },
            ],
          },
        ]
      : []),
  ];
}

/** Animated hamburger ↔ X (three CSS bars). */
export function MenuToggle({ open, onClick, controls }) {
  return (
    <button type="button" className={cx('menu-toggle', open && 'menu-toggle--open')} onClick={onClick} aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} aria-controls={controls}>
      <span />
      <span />
      <span />
    </button>
  );
}

function SearchBox({ autoFocus = false, onSubmitted }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const [value, setValue] = useState(location.pathname === '/search' ? params.get('q') || '' : '');

  useEffect(() => {
    if (location.pathname !== '/search') setValue('');
  }, [location.pathname]);

  const onChange = (e) => {
    const q = e.target.value;
    setValue(q);
    if (location.pathname === '/search' || q.trim().length >= 2) {
      navigate(`/search?q=${encodeURIComponent(q)}`, { replace: location.pathname === '/search' });
    }
  };

  return (
    <form
      className="search-box"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        navigate(`/search?q=${encodeURIComponent(value.trim())}`);
        onSubmitted?.();
      }}
    >
      <Icon name="search" size={18} className="search-box__icon" />
      <input
        type="search"
        className="search-box__input"
        placeholder="Songs, artists, lyrics, videos…"
        value={value}
        onChange={onChange}
        aria-label="Search music"
        autoFocus={autoFocus}
        enterKeyHint="search"
        maxLength={100}
      />
    </form>
  );
}

const THEME_ORDER = ['dark', 'light', 'system'];
const THEME_META = { dark: { icon: 'moon', label: 'Dark' }, light: { icon: 'sun', label: 'Light' }, system: { icon: 'monitor', label: 'System' } };

export function ThemeToggle() {
  const { prefs, update } = usePreferences();
  const current = prefs.theme || 'system';
  const nextTheme = THEME_ORDER[(THEME_ORDER.indexOf(current) + 1) % THEME_ORDER.length];
  return (
    <button
      type="button"
      className="icon-btn"
      onClick={() => update({ theme: nextTheme }).catch(() => {})}
      aria-label={`Theme: ${THEME_META[current].label}. Switch to ${THEME_META[nextTheme].label}.`}
      title={`Theme: ${THEME_META[current].label}`}
    >
      <Icon name={THEME_META[current].icon} size={19} />
    </button>
  );
}

function UserMenu() {
  const { user, isAdmin, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);

  const signOut = async () => {
    close();
    await logout();
    toast.success('You have been signed out.');
    navigate('/');
  };

  const items = [
    { to: user.username ? `/u/${user.username}` : `/u/${user.id}`, icon: 'user', label: 'Your profile' },
    { to: '/library', icon: 'clock', label: 'Listening history' },
    { to: '/studio', icon: 'layers', label: ['artist', 'admin'].includes(user.role) ? 'SHERE MUSIC STUDIO' : 'Become an artist' },
    { to: user.plus?.active ? '/settings/billing' : '/plus', icon: 'sparkles', label: user.plus?.active ? 'Billing & Membership' : 'Get SHERE MUSIC Plus' },
    { to: '/settings', icon: 'settings', label: 'Settings' },
    ...(isAdmin ? [{ to: '/admin', icon: 'shield', label: 'Admin dashboard' }] : []),
  ];

  return (
    <div className="menu" ref={ref}>
      <button type="button" className="avatar-btn" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} aria-label="Account menu">
        <Artwork src={user.avatarUrl} alt="" size={32} rounded icon="user" />
      </button>
      {open ? (
        <div className="menu__list menu__list--right" role="menu">
          <div className="menu__header">
            <strong>
              {user.name} {user.plus?.active ? <PlusBadge /> : null}
            </strong>
            <span className="text-muted text-sm">{user.email}</span>
          </div>
          {items.map((item) => (
            <Link key={item.label} to={item.to} role="menuitem" className="menu__item" onClick={close}>
              <Icon name={item.icon} size={16} />
              {item.label}
            </Link>
          ))}
          <button type="button" role="menuitem" className="menu__item" onClick={signOut}>
            <Icon name="log-out" size={16} />
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** Mobile/tablet drawer with the full navigation, animated with GSAP. */
function Drawer({ open, onClose }) {
  const groups = useNavGroups();
  const { user, logout } = useAuth();
  const toast = useToast();
  const ref = useRef(null);
  useScrollLock(open);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const animate = motionOK();
    if (open) {
      gsap.set(el, { visibility: 'visible' });
      gsap.to(el, { x: '0%', duration: animate ? 0.35 : 0, ease: 'power3.out', overwrite: true });
      if (animate) gsap.fromTo(el.querySelectorAll('.side-link'), { x: -12, autoAlpha: 0 }, { x: 0, autoAlpha: 1, stagger: 0.025, duration: 0.3, delay: 0.08 });
    } else {
      gsap.to(el, { x: '-100%', duration: animate ? 0.28 : 0, ease: 'power2.in', overwrite: true, onComplete: () => gsap.set(el, { visibility: 'hidden' }) });
    }
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <>
      <div className={cx('drawer-backdrop', open && 'is-open')} onClick={onClose} aria-hidden="true" />
      <nav id="mobile-nav" ref={ref} className="drawer" aria-label="Menu">
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
        <div className="sidebar__group" style={{ marginTop: 'auto', paddingTop: 12 }}>
          {user ? (
            <button
              type="button"
              className="side-link"
              style={{ border: 0, background: 'none', width: '100%' }}
              onClick={async () => {
                await logout();
                onClose();
                toast.success('You have been signed out.');
              }}
            >
              <Icon name="log-out" size={19} /> Sign out
            </button>
          ) : (
            <div className="stack-sm">
              <Link to="/login" className="btn btn--secondary btn--block">
                Log in
              </Link>
              <Link to="/register" className="btn btn--primary btn--block">
                Create account
              </Link>
            </div>
          )}
        </div>
      </nav>
    </>
  );
}

export default function Header() {
  const { user, loading } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const location = useLocation();
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useEffect(() => {
    setMenuOpen(false);
    setSearchOpen(false);
  }, [location.pathname]);

  return (
    <>
      <header className="topbar">
        <div className="topbar__inner container">
          <div className="topbar__left">
            <span className="header__toggle">
              <MenuToggle open={menuOpen} onClick={() => setMenuOpen((o) => !o)} controls="mobile-nav" />
            </span>
            <span className="topbar__logo">
              <Logo />
            </span>
          </div>
          <div className="topbar__search">
            <SearchBox />
          </div>
          <div className="topbar__right">
            <button type="button" className="icon-btn show-sm" onClick={() => setSearchOpen((o) => !o)} aria-label={searchOpen ? 'Close search' : 'Search'} aria-expanded={searchOpen}>
              <Icon name={searchOpen ? 'x' : 'search'} size={20} />
            </button>
            <ThemeToggle />
            {loading ? null : user ? (
              <>
                <NotificationsBell />
                <UserMenu />
              </>
            ) : (
              <div className="row-gap" style={{ gap: 6 }}>
                <Link to="/login" className="btn btn--ghost btn--sm hide-xs">
                  Log in
                </Link>
                <Link to="/register" className="btn btn--primary btn--sm">
                  Sign up
                </Link>
              </div>
            )}
          </div>
        </div>
        {searchOpen ? (
          <div className="topbar__mobile-search container">
            <SearchBox autoFocus onSubmitted={() => setSearchOpen(false)} />
          </div>
        ) : null}
      </header>
      <Drawer open={menuOpen} onClose={closeMenu} />
    </>
  );
}
