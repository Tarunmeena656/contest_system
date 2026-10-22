import { useCallback, useEffect, useState } from 'react';

// small loader hook: runs the async function on mount and whenever deps change
export function useLoad<T>(loader: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  // eslint would want `loader` here; the caller lists what the loader reads instead
  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    return loader()
      .then((value) => setData(value))
      .catch((err) => setError(err))
      .finally(() => setLoading(false));
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, error, loading, reload, setData };
}
