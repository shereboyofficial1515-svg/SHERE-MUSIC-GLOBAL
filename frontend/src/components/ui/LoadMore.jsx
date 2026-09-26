import { useEffect, useRef } from 'react';
import { Spinner } from './Feedback.jsx';

/**
 * Infinite-scroll sentinel with a visible "Load more" fallback button
 * (keyboard users and browsers without IntersectionObserver).
 */
export default function LoadMore({ hasMore, loading, error, onLoadMore, onRetry }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!hasMore || loading || error || !('IntersectionObserver' in window)) return undefined;
    const observer = new IntersectionObserver((entries) => entries[0].isIntersecting && onLoadMore(), { rootMargin: '400px' });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [hasMore, loading, error, onLoadMore]);

  if (error) {
    return (
      <div className="load-more">
        <p className="text-muted">{error.message}</p>
        <button type="button" className="btn btn--secondary btn--sm" onClick={onRetry}>
          Try again
        </button>
      </div>
    );
  }
  if (!hasMore) return null;
  return (
    <div className="load-more" ref={ref}>
      {loading ? (
        <Spinner label="Loading more" />
      ) : (
        <button type="button" className="btn btn--ghost btn--sm" onClick={onLoadMore}>
          Load more
        </button>
      )}
    </div>
  );
}
