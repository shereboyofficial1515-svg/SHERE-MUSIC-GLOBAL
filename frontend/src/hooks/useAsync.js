import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Run an async loader when `deps` change. Stale responses are ignored.
 * Returns { data, meta, error, loading, reload, setData }.
 */
export function useAsync(loader, deps = [], { enabled = true } = {}) {
  const [state, setState] = useState({ data: undefined, meta: undefined, error: null, loading: enabled });
  const requestId = useRef(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const run = useCallback(async () => {
    const id = ++requestId.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await loaderRef.current();
      if (id === requestId.current) setState({ data: res?.data, meta: res?.meta, error: null, loading: false });
    } catch (error) {
      if (error.name === 'AbortError') return;
      if (id === requestId.current) setState((s) => ({ ...s, error, loading: false }));
    }
  }, []);

  useEffect(() => {
    if (enabled) run();
    else setState((s) => ({ ...s, loading: false }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  const setData = useCallback((updater) => {
    setState((s) => ({ ...s, data: typeof updater === 'function' ? updater(s.data) : updater }));
  }, []);

  return { ...state, reload: run, setData };
}
