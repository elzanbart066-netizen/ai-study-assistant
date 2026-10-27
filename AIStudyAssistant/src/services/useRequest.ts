import { useCallback, useRef, useState } from "react";

/** Tracks one async request: loading flag, last error and last result. */
export function useRequest<A extends unknown[], R>(fn: (...args: A) => Promise<R>) {
  const [data, setData] = useState<R | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const lastArgs = useRef<A | null>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const run = useCallback(async (...args: A) => {
    lastArgs.current = args;
    setLoading(true);
    setError(null);
    try {
      const result = await fnRef.current(...args);
      setData(result);
      return result;
    } catch (e) {
      setError(e);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const retry = useCallback(() => {
    if (lastArgs.current) void run(...lastArgs.current);
  }, [run]);

  return { data, error, loading, run, retry, setData };
}
