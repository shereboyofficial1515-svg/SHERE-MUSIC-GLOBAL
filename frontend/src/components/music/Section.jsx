import { useRef } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../ui/Icon.jsx';
import { Skeleton } from '../ui/Feedback.jsx';

/** Home-page section with a heading, optional "See all" link and a horizontal scroller. */
export default function Section({ title, subtitle, to, children, scroller = true, id }) {
  const trackRef = useRef(null);
  const scroll = (dir) => trackRef.current?.scrollBy({ left: dir * trackRef.current.clientWidth * 0.8, behavior: 'smooth' });
  const headingId = id || `section-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

  return (
    <section className="section" aria-labelledby={headingId}>
      <header className="section__header">
        <div>
          <h2 id={headingId} className="section__title">
            {title}
          </h2>
          {subtitle ? <p className="section__subtitle">{subtitle}</p> : null}
        </div>
        <div className="section__tools">
          {to ? (
            <Link to={to} className="section__link">
              See all
            </Link>
          ) : null}
          {scroller ? (
            <span className="section__arrows hide-sm">
              <button type="button" className="icon-btn icon-btn--sm" onClick={() => scroll(-1)} aria-label={`Scroll ${title} left`}>
                <Icon name="chevron-left" size={18} />
              </button>
              <button type="button" className="icon-btn icon-btn--sm" onClick={() => scroll(1)} aria-label={`Scroll ${title} right`}>
                <Icon name="chevron-right" size={18} />
              </button>
            </span>
          ) : null}
        </div>
      </header>
      <div ref={trackRef} className={scroller ? 'scroller' : 'card-grid'}>
        {children}
      </div>
    </section>
  );
}

export function CardSkeletons({ count = 6, round = false }) {
  return Array.from({ length: count }, (_, i) => (
    <div key={i} className="card-skeleton" aria-hidden="true">
      <Skeleton className="card-skeleton__art" radius={round ? '50%' : 12} />
      <Skeleton width="80%" />
      <Skeleton width="50%" height={12} />
    </div>
  ));
}

export function RowSkeletons({ count = 6 }) {
  return (
    <div className="row-skeletons" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="row-skeleton">
          <Skeleton width={44} height={44} radius={8} />
          <div style={{ flex: 1, display: 'grid', gap: 6 }}>
            <Skeleton width="45%" />
            <Skeleton width="25%" height={12} />
          </div>
        </div>
      ))}
    </div>
  );
}
