import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Infinite list backed by a `{ data, meta: { hasMore } }` endpoint.
 * `fetchPage(page)` is called with 1, 2, 3…; the list resets when `deps` change.
 */
export function usePaginatedList(fetchPage, deps = []) {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [total, setTotal] = useState(null);
  const generation = useRef(0);
  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;
  const busy = useRef(false);

  const load = useCallback(async (nextPage, gen) => {
    busy.current = true;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchRef.current(nextPage);
      if (gen !== generation.current) return;
      setItems((prev) => (nextPage === 1 ? res.data : [...prev, ...res.data]));
      setHasMore(Boolean(res.meta?.hasMore));
      setTotal(res.meta?.total ?? null);
      setPage(nextPage);
    } catch (err) {
      if (gen === generation.current) setError(err);
    } finally {
      if (gen === generation.current) {
        setLoading(false);
        busy.current = false;
      }
    }
  }, []);

  useEffect(() => {
    generation.current += 1;
    setItems([]);
    setHasMore(true);
    load(1, generation.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const loadMore = useCallback(() => {
    if (busy.current || !hasMore || error) return;
    load(page + 1, generation.current);
  }, [hasMore, error, load, page]);

  const retry = useCallback(() => load(page + 1 || 1, generation.current), [load, page]);
  const reset = useCallback(() => {
    generation.current += 1;
    load(1, generation.current);
  }, [load]);

  return { items, setItems, loading, error, hasMore, total, loadMore, retry, reset, initialLoading: loading && page === 0 };
}
