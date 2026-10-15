import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api.js';

/**
 * Loads data from a GET endpoint and tracks loading / error state.
 * Pass `null` as the path to skip loading.
 */
export function useApi(path) {
  const [state, setState] = useState({ data: null, meta: null, loading: !!path, error: null });
  const requestId = useRef(0);

  const load = useCallback(async () => {
    if (!path) return;
    const id = ++requestId.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await api.get(path);
      if (id === requestId.current) setState({ data: res.data, meta: res.meta || null, loading: false, error: null });
    } catch (error) {
      if (id === requestId.current) setState((s) => ({ ...s, loading: false, error }));
    }
  }, [path]);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, reload: load, setData: (data) => setState((s) => ({ ...s, data })) };
}
