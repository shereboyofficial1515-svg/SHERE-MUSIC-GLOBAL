import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import Icon from '../ui/Icon.jsx';
import Logo from '../ui/Logo.jsx';
import { ErrorState, PageLoader } from '../ui/Feedback.jsx';
import { MenuToggle, ThemeToggle } from '../layout/Header.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useScrollLock } from '../../hooks/useScrollLock.js';
import { cx } from '../../utils/format.js';

/**
 * Shared shell for the two documentation sites. `config` decides everything
 * that differs: which API to read (public vs admin), the base URL, branding
 * and footer. The Admin Guide shell is only mounted behind RequireAdmin, and
 * its API refuses non-admins regardless.
 */
export function DocsSearchBox({ config, autoFocus = false, large = false, initial = '' }) {
  const navigate = useNavigate();
  const [q, setQ] = useState(initial);
  useEffect(() => setQ(initial), [initial]);
  return (
    <form
      role="search"
      className={cx('docs-search', large && 'docs-search--large')}
      onSubmit={(e) => {
        e.preventDefault();
        if (q.trim()) navigate(`${config.base}/search?q=${encodeURIComponent(q.trim())}`);
      }}
    >
      <Icon name="search" size={large ? 20 : 16} />
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={config.searchPlaceholder}
        aria-label={config.searchPlaceholder}
        autoFocus={autoFocus}
        maxLength={100}
        enterKeyHint="search"
      />
      {large ? (
        <button type="submit" className="btn btn--primary btn--sm">
          Search
        </button>
      ) : null}
    </form>
  );
}

function DocsNav({ config, sections, onNavigate }) {
  const { section: current } = useParams();
  const [open, setOpen] = useState(() => new Set(current ? [current] : []));
  useEffect(() => {
    if (current) setOpen((s) => new Set(s).add(current));
  }, [current]);
  const toggle = (slug) =>
    setOpen((s) => {
      const next = new Set(s);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  return (
    <nav className="docs-nav" aria-label={`${config.label} sections`}>
      <NavLink to={config.base} end className={({ isActive }) => cx('docs-nav__home', isActive && 'is-active')} onClick={onNavigate}>
        <Icon name="home" size={16} /> {config.homeLabel}
      </NavLink>
      {sections.map((s) => (
        <div key={s.slug} className="docs-nav__group">
          <button type="button" className="docs-nav__section" aria-expanded={open.has(s.slug)} onClick={() => toggle(s.slug)}>
            <Icon name={s.icon} size={16} />
            <span>{s.title}</span>
            <Icon name="chevron-down" size={14} className="docs-nav__chev" />
          </button>
          {open.has(s.slug) ? (
            <ul>
              {s.articles.map((a) => (
                <li key={a.slug}>
                  <NavLink to={`${config.base}/${s.slug}/${a.slug}`} className={({ isActive }) => cx('docs-nav__link', isActive && 'is-active')} onClick={onNavigate}>
                    {a.title}
                  </NavLink>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ))}
    </nav>
  );
}

export default function DocsLayout({ config }) {
  const { data, loading, error, reload } = useAsync(() => config.api.index(), [config.kind]);
  const [menu, setMenu] = useState(false);
  const location = useLocation();
  useScrollLock(menu);
  useEffect(() => setMenu(false), [location.pathname]);

  return (
    <div className={cx('docs', `docs--${config.kind}`)}>
      <a href="#docs-main" className="skip-link">
        Skip to content
      </a>
      <header className="docs-header">
        <div className="docs-header__inner">
          <span className="docs-header__menu">
            <MenuToggle open={menu} onClick={() => setMenu((m) => !m)} controls="docs-drawer" />
          </span>
          <Link to={config.base} className="docs-brand" aria-label={`${config.label} home`}>
            <Logo />
            <span className="docs-brand__label">{config.brandLabel}</span>
          </Link>
          {config.private ? <span className="docs-admin-badge">ADMIN ONLY</span> : null}
          <div className="docs-header__search">
            <DocsSearchBox config={config} />
          </div>
          <div className="docs-header__actions">
            <ThemeToggle />
            <Link to={config.backTo} className="btn btn--ghost btn--sm docs-header__back">
              <Icon name="arrow-left" size={14} /> {config.backLabel}
            </Link>
          </div>
        </div>
      </header>

      {error ? (
        <div className="container page">
          <ErrorState error={error} onRetry={reload} />
        </div>
      ) : loading || !data ? (
        <PageLoader />
      ) : (
        <div className="docs-body">
          <aside id="docs-drawer" className={cx('docs-sidebar', menu && 'docs-sidebar--open')} aria-label="Documentation navigation">
            <div className="docs-sidebar__search">
              <DocsSearchBox config={config} />
            </div>
            <DocsNav config={config} sections={data.sections} onNavigate={() => setMenu(false)} />
            {data.meta?.version ? (
              <p className="docs-version">
                {config.label} · Version {data.meta.version}
                <br />
                Last updated: {data.meta.updated}
              </p>
            ) : null}
          </aside>
          {menu ? <button type="button" className="docs-scrim" aria-label="Close menu" onClick={() => setMenu(false)} /> : null}
          <main id="docs-main" className="docs-main" tabIndex={-1}>
            <Outlet context={{ config, nav: data }} />
          </main>
        </div>
      )}

      <footer className="docs-footer">
        <div className="docs-footer__inner">
          <Logo />
          <nav aria-label="Footer">
            {config.footerLinks.map(([label, to]) => (
              <Link key={label} to={to}>
                {label}
              </Link>
            ))}
          </nav>
          <span className="text-muted text-sm">
            {config.private && data?.meta?.version ? `Admin Guide v${data.meta.version} · ${data.meta.updated}` : `© ${new Date().getFullYear()} SHERE MUSIC`}
          </span>
        </div>
      </footer>
    </div>
  );
}
