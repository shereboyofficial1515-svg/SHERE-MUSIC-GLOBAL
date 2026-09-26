import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import Icon from '../ui/Icon.jsx';
import Logo from '../ui/Logo.jsx';
import Artwork from '../ui/Artwork.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useDismiss } from '../../hooks/useDismiss.js';
import { useScrollLock } from '../../hooks/useScrollLock.js';
import { cx } from '../../utils/format.js';

export const NAV_LINKS = [
  { to: '/', label: 'Home', icon: 'home', end: true },
  { to: '/discover', label: 'Discover', icon: 'compass' },
  { to: '/artists', label: 'Artists', icon: 'mic' },
  { to: '/albums', label: 'Albums', icon: 'disc' },
  { to: '/playlists', label: 'Playlists', icon: 'list-music' },
  { to: '/favorites', label: 'Favorites', icon: 'heart' },
];

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

  // Live search: update the results page as the user types (debounced on that page).
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
        placeholder="Search songs, artists, albums, genres"
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

  return (
    <div className="menu" ref={ref}>
      <button type="button" className="avatar-btn" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} aria-label="Account menu">
        <Artwork src={user.avatarUrl} alt="" size={34} rounded icon="user" />
        <Icon name="chevron-down" size={16} className="hide-sm" />
      </button>
      {open ? (
        <div className="menu__list menu__list--right" role="menu">
          <div className="menu__header">
            <strong>{user.name}</strong>
            <span className="text-muted text-sm">{user.email}</span>
          </div>
          {[
            { to: '/profile', icon: 'user', label: 'Profile' },
            { to: '/favorites', icon: 'heart', label: 'Favorites' },
            { to: '/playlists', icon: 'list-music', label: 'Playlists' },
            { to: '/account', icon: 'settings', label: 'Account settings' },
            ...(isAdmin ? [{ to: '/admin', icon: 'shield', label: 'Admin dashboard' }] : []),
          ].map((item) => (
            <Link key={item.to} to={item.to} role="menuitem" className="menu__item" onClick={close}>
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

export default function Header() {
  const { user, isAdmin, loading, logout } = useAuth();
  const toast = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMenuOpen(false);
    setSearchOpen(false);
  }, [location.pathname]);

  useScrollLock(menuOpen);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (e) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  // The drawer is rendered outside <header>: the header's backdrop-filter would
  // otherwise become the containing block for the fixed-position drawer.
  return (
    <>
    <header className="header">
      <div className="header__inner container">
        <div className="header__left">
          <span className="header__toggle">
            <MenuToggle open={menuOpen} onClick={() => setMenuOpen((o) => !o)} controls="mobile-nav" />
          </span>
          <Logo />
        </div>

        <nav className="header__nav" aria-label="Main">
          {NAV_LINKS.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.end} className={({ isActive }) => cx('nav-link', isActive && 'nav-link--active')}>
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="header__search hide-sm">
          <SearchBox />
        </div>

        <div className="header__right">
          <button type="button" className="icon-btn show-sm" onClick={() => setSearchOpen((o) => !o)} aria-label={searchOpen ? 'Close search' : 'Search'} aria-expanded={searchOpen}>
            <Icon name={searchOpen ? 'x' : 'search'} size={20} />
          </button>
          {loading ? null : user ? (
            <UserMenu />
          ) : (
            <div className="row-gap hide-xs">
              <Link to="/login" className="btn btn--ghost btn--sm">
                Sign in
              </Link>
              <Link to="/register" className="btn btn--primary btn--sm">
                Sign up
              </Link>
            </div>
          )}
        </div>
      </div>

      {searchOpen ? (
        <div className="header__mobile-search show-sm container">
          <SearchBox autoFocus onSubmitted={() => setSearchOpen(false)} />
        </div>
      ) : null}
    </header>

      <div className={cx('drawer-backdrop', menuOpen && 'is-open')} onClick={() => setMenuOpen(false)} aria-hidden="true" />
      <nav id="mobile-nav" className={cx('drawer', menuOpen && 'is-open')} aria-label="Mobile">
        <ul className="drawer__list">
          {NAV_LINKS.map((link) => (
            <li key={link.to}>
              <NavLink to={link.to} end={link.end} className={({ isActive }) => cx('drawer__link', isActive && 'drawer__link--active')}>
                <Icon name={link.icon} size={20} />
                {link.label}
              </NavLink>
            </li>
          ))}
        </ul>
        <div className="drawer__footer">
          {user ? (
            <>
              <Link to="/profile" className="drawer__link">
                <Icon name="user" size={20} /> Profile
              </Link>
              <Link to="/account" className="drawer__link">
                <Icon name="settings" size={20} /> Account settings
              </Link>
              {isAdmin ? (
                <Link to="/admin" className="drawer__link">
                  <Icon name="shield" size={20} /> Admin dashboard
                </Link>
              ) : null}
              <button
                type="button"
                className="drawer__link"
                onClick={async () => {
                  await logout();
                  setMenuOpen(false);
                  toast.success('You have been signed out.');
                }}
              >
                <Icon name="log-out" size={20} /> Sign out
              </button>
            </>
          ) : (
            <div className="stack-sm">
              <Link to="/login" className="btn btn--secondary btn--block">
                Sign in
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
