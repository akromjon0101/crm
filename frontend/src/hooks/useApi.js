import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';

/**
 * Generic data-fetching hook.
 *
 * @param {string|null} url   - API endpoint (relative to baseURL). Pass null to skip fetching.
 * @param {object}      opts  - Options: { params, deps, immediate }
 *   params    — query params object passed to axios
 *   deps      — extra dependency array values that trigger a refetch
 *   immediate — whether to fetch on mount (default: true)
 *
 * @returns {{ data, loading, error, refetch }}
 *
 * Usage:
 *   const { data: groups, loading, refetch } = useApi('/groups');
 *   const { data, refetch } = useApi('/students', { params: { page, limit }, deps: [page] });
 */
const useApi = (url, { params = {}, deps = [], immediate = true } = {}) => {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(!!url && immediate);
  const [error,   setError]   = useState(null);

  // Serialize params so we can safely use them as a dep
  const paramsRef = useRef(params);
  paramsRef.current = params;

  // Tracks the most recently issued request so a slow, stale response
  // (from an earlier url/deps combination) can never clobber fresher data.
  const requestIdRef = useRef(0);

  const fetch = useCallback(async () => {
    if (!url) return;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(url, { params: paramsRef.current });
      if (requestId === requestIdRef.current) setData(res.data);
    } catch (err) {
      if (requestId === requestIdRef.current) {
        setError(err.response?.data?.message || err.message || 'Request failed');
      }
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, ...deps]);

  useEffect(() => {
    if (immediate) fetch();
  }, [fetch, immediate]);

  return { data, loading, error, refetch: fetch };
};

export default useApi;
