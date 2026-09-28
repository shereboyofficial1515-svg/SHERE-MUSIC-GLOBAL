import { useRef } from 'react';
import { Link, useOutletContext, useParams, useSearchParams } from 'react-router-dom';
import Icon from '../../components/ui/Icon.jsx';
import { EmptyState, ErrorState, PageLoader, Spinner } from '../../components/ui/Feedback.jsx';
import DocMarkdown, { headingsOf } from '../../components/docs/DocMarkdown.jsx';
import { DocsSearchBox } from '../../components/docs/DocsLayout.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useMeta } from '../../hooks/useMeta.js';
import { motionOK, revealChildren, useGSAP } from '../../utils/motion.js';

const useDocs = () => useOutletContext();

function findArticle(nav, path) {
  const [section, slug] = path.split('/');
  const s = nav.sections.find((x) => x.slug === section);
  const a = s?.articles.find((x) => x.slug === slug);
  return a ? { section, slug, title: a.title, summary: a.summary, sectionTitle: s.title } : null;
}

// ─── Home ──────────────────────────────────────────────────────────────────
export function DocsHome() {
  const { config, nav } = useDocs();
  useMeta({ title: config.label, description: config.metaDescription, noindex: config.private });
  const ref = useRef(null);
  useGSAP(
    () => {
      if (motionOK()) revealChildren(ref.current.querySelectorAll('[data-reveal]'), { stagger: 0.04, y: 10 });
    },
    { scope: ref }
  );
  const popular = (nav.meta?.popular || []).map((p) => findArticle(nav, p)).filter(Boolean);
  const quick = nav.meta?.quickActions || [];

  return (
    <div ref={ref} className="docs-home">
      <section className="docs-hero" data-reveal>
        {config.private ? (
          <>
            <p className="docs-hero__eyebrow">SHERE MUSIC · ADMIN GUIDE</p>
            <h1>Welcome to SHERE MUSIC Administration</h1>
            <p className="text-muted">Manage the platform, musicians, music, videos, memberships, payments and users.</p>
          </>
        ) : (
          <>
            <p className="docs-hero__eyebrow">SHERE MUSIC HELP</p>
            <h1>How can we help?</h1>
          </>
        )}
        <DocsSearchBox config={config} large />
        {nav.meta?.version ? (
          <p className="text-sm text-muted">
            Version {nav.meta.version} · Last updated: {nav.meta.updated}
          </p>
        ) : null}
      </section>

      {quick.length ? (
        <section className="stack" data-reveal>
          <h2 className="section__title">Quick actions</h2>
          <div className="docs-quick">
            {quick.map((q) => (
              <Link key={q.label} to={q.to} className="docs-quick__item">
                <Icon name={q.icon} size={20} />
                <span>{q.label}</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {popular.length ? (
        <section className="stack" data-reveal>
          <h2 className="section__title">{config.private ? 'Start here' : 'Popular articles'}</h2>
          <ul className="docs-popular">
            {popular.map((a) => (
              <li key={`${a.section}/${a.slug}`}>
                <Link to={`${config.base}/${a.section}/${a.slug}`}>
                  <Icon name="file-text" size={16} />
                  <span>{a.title}</span>
                  <Icon name="chevron-right" size={14} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="stack" data-reveal>
        <h2 className="section__title">Browse by topic</h2>
        <div className="docs-sections">
          {nav.sections.map((s) => (
            <Link key={s.slug} to={`${config.base}/${s.slug}/${s.articles[0]?.slug}`} className="docs-card">
              <span className="docs-card__icon">
                <Icon name={s.icon} size={20} />
              </span>
              <strong>{s.title}</strong>
              <span className="text-muted text-sm">{s.description}</span>
              <span className="text-sm docs-card__count">{s.articles.length} articles</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

// ─── Article ───────────────────────────────────────────────────────────────
export function DocsArticle() {
  const { config } = useDocs();
  const { section, article } = useParams();
  const { data, loading, error, reload } = useAsync(() => config.api.article(section, article), [section, article]);
  useMeta({ title: data ? `${data.article.title} · ${config.label}` : config.label, description: data?.article.summary, noindex: config.private, skip: !data });

  if (error) return error.status === 404 ? <EmptyState icon="file-text" title="Article not found" action={<Link to={config.base} className="btn btn--secondary">{config.homeLabel}</Link>} /> : <ErrorState error={error} onRetry={reload} />;
  if (loading) return <PageLoader />;
  const toc = headingsOf(data.article.body);

  return (
    <div className="docs-article">
      <article className="docs-article__main">
        <nav className="docs-crumbs" aria-label="Breadcrumb">
          <Link to={config.base}>{config.homeLabel}</Link>
          <Icon name="chevron-right" size={12} />
          <span>{data.section.title}</span>
        </nav>
        <h1 className="docs-article__title">{data.article.title}</h1>
        {data.article.summary ? <p className="docs-article__summary">{data.article.summary}</p> : null}
        <DocMarkdown body={data.article.body} resolveImage={config.api.resolveImage} />
        <nav className="docs-pager" aria-label="More articles">
          {data.prev ? (
            <Link to={`${config.base}/${data.prev.section}/${data.prev.slug}`} className="docs-pager__link">
              <span className="text-sm text-muted">Previous</span>
              <span>
                <Icon name="arrow-left" size={14} /> {data.prev.title}
              </span>
            </Link>
          ) : (
            <span />
          )}
          {data.next ? (
            <Link to={`${config.base}/${data.next.section}/${data.next.slug}`} className="docs-pager__link docs-pager__link--next">
              <span className="text-sm text-muted">Next</span>
              <span>
                {data.next.title} <Icon name="arrow-right" size={14} />
              </span>
            </Link>
          ) : null}
        </nav>
        {config.private ? null : (
          <p className="docs-help-more">
            <Icon name="mail" size={16} /> Still need help? See <Link to="/help/troubleshooting/contact-support">Contact Support</Link>.
          </p>
        )}
      </article>
      {toc.length > 1 ? (
        <aside className="docs-toc" aria-label="On this page">
          <p className="docs-toc__title">On this page</p>
          <ul>
            {toc.map((h) => (
              <li key={h.id} className={h.level === 3 ? 'docs-toc__sub' : undefined}>
                <a href={`#${h.id}`}>{h.text}</a>
              </li>
            ))}
          </ul>
        </aside>
      ) : null}
    </div>
  );
}

// ─── Search ────────────────────────────────────────────────────────────────
export function DocsSearch() {
  const { config } = useDocs();
  const [params] = useSearchParams();
  const q = (params.get('q') || '').trim();
  useMeta({ title: q ? `Search: ${q} · ${config.label}` : config.label, noindex: true });
  const { data, loading, error, reload } = useAsync(() => config.api.search(q), [q], { enabled: Boolean(q) });

  return (
    <div className="docs-search-page stack">
      <h1 className="page-title">Search {config.label}</h1>
      <DocsSearchBox config={config} large initial={q} />
      {!q ? null : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading ? (
        <Spinner size={24} />
      ) : !data.results.length ? (
        <EmptyState icon="search" title="No articles found" message={`Nothing matched “${q}”. Try different words${config.private ? '' : ', or browse the topics'}.`} action={<Link to={config.base} className="btn btn--secondary">{config.homeLabel}</Link>} />
      ) : (
        <>
          <p className="text-muted text-sm">
            {data.results.length} result{data.results.length === 1 ? '' : 's'} for “{q}”
          </p>
          <ol className="docs-results">
            {data.results.map((r) => (
              <li key={`${r.section}/${r.slug}`}>
                <Link to={`${config.base}/${r.section}/${r.slug}`}>
                  <span className="docs-results__section">{r.sectionTitle}</span>
                  <strong>{r.title}</strong>
                  <span className="text-muted text-sm">{r.snippet}</span>
                </Link>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
